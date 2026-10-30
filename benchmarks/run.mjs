/**
 * Nexo's benchmark: the billing app in plain JavaScript and in Nexo, each case timed and its allocation measured
 *
 *     node benchmarks/run.mjs [--quick] [--filter <text>] [--save <file>] [--compare <file>]
 *
 * --quick measures with fewer and shorter samples; --filter runs the cases whose group or name holds the text; --save writes the results as JSON; --compare shows each case's change from results saved before.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
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
    },
});

/** How many customers the app holds; the portfolio report reads them all. */
const CUSTOMER_COUNT = 1000;

const customers = createCustomers(CUSTOMER_COUNT);
const registry = nexo.createRegistry([createBillingModule(nexo)]);
const env = { today: TODAY };
const bindCustomer = customer => registry.createBindings({ customer }, { types: { customer: 'Billing.Customer' } });
const bindCustomers = () => registry.createBindings({ customers }, { types: { customers: 'List<Billing.Customer>' } });

/** An operation that takes each item in turn, so a case measures every customer rather than the first. */
const cycling = (items, operation) => {
    let next = 0;

    return () => operation(items[next++ % items.length]);
};

const summary = registry.resolve(ACCOUNT_SUMMARY, bindCustomer(customers[0]));
const report = registry.resolve(PORTFOLIO_REPORT, bindCustomers());

/** The cases, by group, each creating its operation once its group runs; the first of a group is the one the others are compared with. */
const GROUPS = [
    {
        name: 'Account summary, one customer',
        cases: [
            { name: 'JavaScript', create: () => cycling(customers, customer => summarizeAccount(customer, TODAY)) },
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
            { name: 'JavaScript', create: () => () => reportPortfolio(customers, TODAY) },
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

                    return () => nexo.parse(`${ACCOUNT_SUMMARY}\n// ${run++}`);
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
        ],
    },
];

const settings = options.quick ? { warmup: 100, sampleTime: 20, samples: 5 } : {};
const saved = options.compare === undefined ? null : JSON.parse(readFileSync(options.compare, 'utf8'));
const savedOf = (group, name) => saved?.cases.find(entry => entry.group === group && entry.name === name);
const change = (now, before) => (before === undefined ? '' : `${now >= before ? '+' : ''}${(((now - before) / before) * 100).toFixed(1)}%`);
const results = [];

const columns = [
    ['Case', 34, 'left'],
    ['µs/op', 10],
    ['±', 6],
    ['KB/op', 10],
    ['× first', 9],
    ...(saved === null ? [] : [['Δ time', 9], ['Δ alloc', 9]]),
];
const row = cells => cells.map((cell, index) => (columns[index][2] === 'left' ? String(cell).padEnd(columns[index][1]) : String(cell).padStart(columns[index][1]))).join(' ');

console.log(`Nexo ${nexo.info.versions.implementation} · Node ${process.version} · ${cpus()[0]?.model.trim() ?? 'unknown processor'}`);

for (const group of GROUPS) {
    const cases = group.cases.filter(entry => options.filter === undefined || `${group.name} ${entry.name}`.toLowerCase().includes(options.filter.toLowerCase()));

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
                result.microseconds < 10 ? result.microseconds.toFixed(2) : result.microseconds.toFixed(1),
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
