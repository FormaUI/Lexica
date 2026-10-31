/**
 * Nexo's benchmark: the billing app in plain JavaScript and in Nexo, each case timed and its allocation measured
 *
 *     node benchmarks/run.mjs [--quick] [--filter <text>] [--save <file>] [--compare <file>]
 *     node benchmarks/run.mjs --baseline <directory> [--rounds <count>] [--quick] [--filter <text>]
 *
 * --quick measures with fewer and shorter samples; --filter runs the cases whose group or name holds the text; --save writes the results as JSON; --compare shows each case's change from results saved before.
 * --baseline measures each Nexo case against the same case run by the Nexo checked out in the directory, in pairs: each round measures both, alternating which runs first, and --rounds sets how many rounds run.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { nexo } from '../src/nexo.js';
import { createCustomers, TODAY } from './billing/data.mjs';
import { ACCOUNT_SUMMARY, PORTFOLIO_REPORT, createBillingModule } from './billing/nexo.mjs';
import { reportPortfolio, summarizeAccount } from './billing/plain.mjs';
import { measure } from './measure.mjs';

const { values: options } = parseArgs({
    options: {
        quick: { type: 'boolean', default: false },
        filter: { type: 'string' },
        save: { type: 'string' },
        compare: { type: 'string' },
        baseline: { type: 'string' },
        rounds: { type: 'string', default: '7' },
    },
});

if (options.baseline !== undefined && (options.save !== undefined || options.compare !== undefined)) {
    throw new Error('--baseline measures in pairs, and takes neither --save nor --compare');
}

/** How many customers the app holds; the portfolio report reads them all. */
const CUSTOMER_COUNT = 1000;

const customers = createCustomers(CUSTOMER_COUNT);
const env = { today: TODAY };

/** An operation that takes each item in turn, so a case measures every customer rather than the first. */
const cycling = (items, operation) => {
    let next = 0;

    return () => operation(items[next++ % items.length]);
};

/** The JavaScript twin of each group's Nexo cases, by the group's name; it runs no Nexo, so a paired run leaves it out. */
const JAVASCRIPT = {
    summary: { name: 'JavaScript', create: () => cycling(customers, customer => summarizeAccount(customer, TODAY)) },
    report: { name: 'JavaScript', create: () => () => reportPortfolio(customers, TODAY) },
};

/** The cases by group, as the given Nexo runs them, each creating its operation once its group runs; the first of a group is the one the others are compared with. */
const createGroups = implementation => {
    const registry = implementation.createRegistry([createBillingModule(implementation)]);
    const bindCustomer = customer => registry.createBindings({ customer }, { types: { customer: 'Billing.Customer' } });
    const bindCustomers = () => registry.createBindings({ customers }, { types: { customers: 'List<Billing.Customer>' } });
    const summary = registry.resolve(ACCOUNT_SUMMARY, bindCustomer(customers[0]));
    const report = registry.resolve(PORTFOLIO_REPORT, bindCustomers());

    return [
        {
            name: 'Account summary, one customer',
            cases: [
                JAVASCRIPT.summary,
                { name: 'Nexo: evaluate', create: () => cycling(customers.map(customer => summary.createEvaluator(bindCustomer(customer), env)), evaluator => evaluator.evaluate()) },
                {
                    name: 'Nexo: evaluate, reporting reads',
                    create: () => {
                        let reads = 0;
                        const hooks = { afterInvoke: () => void reads++ };

                        return cycling(customers.map(customer => summary.createEvaluator(bindCustomer(customer), env)), evaluator => evaluator.evaluate(hooks));
                    },
                },
                { name: 'Nexo: bind and evaluate', create: () => cycling(customers, customer => summary.createEvaluator(bindCustomer(customer), env).evaluate()) },
            ],
        },
        {
            name: `Portfolio report, ${CUSTOMER_COUNT.toLocaleString('en-US')} customers`,
            cases: [
                JAVASCRIPT.report,
                {
                    name: 'Nexo: evaluate',
                    create: () => {
                        const evaluator = report.createEvaluator(bindCustomers(), env);

                        return () => evaluator.evaluate();
                    },
                },
                { name: 'Nexo: bind', create: () => bindCustomers },
            ],
        },
        {
            name: 'Preparing the account summary',
            cases: [
                {
                    name: 'Nexo: parse',
                    create: () => {
                        // A comment makes each text new, so no parse is answered from the texts parsed before.
                        let run = 0;

                        return () => implementation.parse(`${ACCOUNT_SUMMARY}\n// ${run++}`);
                    },
                },
                {
                    name: 'Nexo: resolve',
                    create: () => {
                        const bindings = bindCustomer(customers[0]);

                        return () => registry.resolve(ACCOUNT_SUMMARY, bindings);
                    },
                },
                {
                    name: 'Nexo: create an evaluator',
                    create: () => {
                        const bindings = bindCustomer(customers[0]);

                        return () => summary.createEvaluator(bindings, env);
                    },
                },
                {
                    name: 'Nexo: resolve, evaluate once',
                    create: () => {
                        const bindings = bindCustomer(customers[0]);

                        // Each resolution is new, so its first evaluation compiles it, as a host's first evaluation of each script it resolves does.
                        return () => registry.resolve(ACCOUNT_SUMMARY, bindings).createEvaluator(bindings, env).evaluate();
                    },
                },
            ],
        },
    ];
};

const settings = options.quick ? { warmup: 100, sampleTime: 20, samples: 5 } : {};
const isSelected = (group, entry) => options.filter === undefined || `${group.name} ${entry.name}`.toLowerCase().includes(options.filter.toLowerCase());
const change = (now, before) => (before === undefined ? '' : `${now >= before ? '+' : ''}${(((now - before) / before) * 100).toFixed(1)}%`);
const formatTime = microseconds => (microseconds < 10 ? microseconds.toFixed(2) : microseconds.toFixed(1));
const median = values => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = sorted.length >> 1;

    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A row of cells, each padded to its column's width, the first to the left and the rest to the right. */
const createRow = columns => cells => cells.map((cell, index) => (index === 0 ? String(cell).padEnd(columns[index][1]) : String(cell).padStart(columns[index][1]))).join(' ');

console.log(`Nexo ${nexo.info.versions.implementation} · Node ${process.version} · ${cpus()[0]?.model.trim() ?? 'unknown processor'}`);

if (options.baseline === undefined) {
    const saved = options.compare === undefined ? null : JSON.parse(readFileSync(options.compare, 'utf8'));
    const savedOf = (group, name) => saved?.cases.find(entry => entry.group === group && entry.name === name);
    const results = [];
    const columns = [['Case', 34], ['µs/op', 10], ['±', 6], ['KB/op', 10], ['× first', 9], ...(saved === null ? [] : [['Δ time', 9], ['Δ alloc', 9]])];
    const row = createRow(columns);

    for (const group of createGroups(nexo)) {
        const cases = group.cases.filter(entry => isSelected(group, entry));

        if (cases.length === 0) {
            continue;
        }

        console.log(`\n${group.name}`);
        console.log(row(columns.map(([title]) => title)));

        let first = null;

        for (const entry of cases) {
            const result = measure(entry.create(), settings);
            const before = savedOf(group.name, entry.name);

            first ??= result;
            results.push({ group: group.name, name: entry.name, ...result });
            console.log(
                row([
                    entry.name,
                    formatTime(result.microseconds),
                    `${Math.round(result.spread * 100)}%`,
                    (result.bytes / 1024).toFixed(1),
                    `${(result.microseconds / first.microseconds).toFixed(1)}×`,
                    ...(saved === null ? [] : [change(result.microseconds, before?.microseconds), change(result.bytes, before?.bytes)]),
                ]),
            );
        }
    }

    if (options.save !== undefined) {
        writeFileSync(options.save, `${JSON.stringify({ implementation: nexo.info.versions.implementation, node: process.version, cases: results }, null, 4)}\n`);
    }
} else {
    // The baseline is another checkout's own modules, loaded beside these, so both run in one process and each round measures them under the same conditions.
    const { nexo: baseline } = await import(pathToFileURL(resolve(options.baseline, 'src/nexo.js')).href);
    const rounds = Number(options.rounds);

    if (!Number.isInteger(rounds) || rounds < 1) {
        throw new Error(`--rounds takes a whole number of rounds, one or more, and was given '${options.rounds}'`);
    }

    console.log(`Against the baseline ${baseline.info.versions.implementation} at ${resolve(options.baseline)}, in ${rounds} rounds, each alternating which runs first`);

    // A change is the median of the rounds' own changes, each comparing the two measured side by side, and its range the least and the greatest of them, which shows whether every round agrees.
    const columns = [['Case', 34], ['Base µs', 10], ['µs/op', 10], ['Δ time', 9], ['Range', 17], ['Base KB', 10], ['KB/op', 10], ['Δ alloc', 9], ['Rounds', 11]];
    const row = createRow(columns);
    const percent = ratio => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;
    const agreement = ratios => (ratios.every(ratio => ratio < 1) ? 'all faster' : ratios.every(ratio => ratio > 1) ? 'all slower' : 'mixed');
    const baselineGroups = createGroups(baseline);

    for (const [index, group] of createGroups(nexo).entries()) {
        const cases = group.cases.filter(entry => !Object.values(JAVASCRIPT).includes(entry) && isSelected(group, entry));

        if (cases.length === 0) {
            continue;
        }

        console.log(`\n${group.name}`);
        console.log(row(columns.map(([title]) => title)));

        for (const entry of cases) {
            const operations = { baseline: baselineGroups[index].cases.find(other => other.name === entry.name).create(), candidate: entry.create() };
            const measured = { baseline: [], candidate: [] };

            for (let round = 0; round < rounds; round++) {
                for (const side of round % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']) {
                    measured[side].push(measure(operations[side], settings));
                }
            }

            const timeRatios = measured.candidate.map((result, round) => result.microseconds / measured.baseline[round].microseconds);
            const allocationRatios = measured.candidate.map((result, round) => result.bytes / measured.baseline[round].bytes);

            console.log(
                row([
                    entry.name,
                    formatTime(median(measured.baseline.map(result => result.microseconds))),
                    formatTime(median(measured.candidate.map(result => result.microseconds))),
                    percent(median(timeRatios)),
                    `${percent(Math.min(...timeRatios))} … ${percent(Math.max(...timeRatios))}`,
                    (median(measured.baseline.map(result => result.bytes)) / 1024).toFixed(1),
                    (median(measured.candidate.map(result => result.bytes)) / 1024).toFixed(1),
                    percent(median(allocationRatios)),
                    agreement(timeRatios),
                ]),
            );
        }
    }
}
