import { describe, it, expect } from 'vitest';
import { Evaluator } from '#lexica/language/Evaluator.mjs';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

const { property } = Declarations;

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

/**
 * A plain application-data host's module on names: a price read from a name, a rate the environment holds, and a quote maintained by an observation, which a host samples.
 * Every implementation records its receiver, so a test sees which invocations ran.
 */
const createPrices = invoked => new LexicaModule('prices', {
    observationTypes: [{ name: 'quote', contract: 'maintained', implementation: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 1 }) }) }],
    members: [
        property('price', 'String', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, implementation: ({ receiver }) => (invoked.push(`price:${receiver}`), receiver.length) }),
        property('rate', 'String', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, implementation: ({ env }) => env.rate }),
        property('quoted', 'String', 'Number?', { updates: { changes: 'observable', reads: 'maintained', observations: [{ type: 'quote', of: 'receiver' }] }, implementation: ({ samples: [quote] }) => quote }),
    ],
});

/** An evaluator of the text against a registry holding Lexica's own module and the prices module, with the bindings and the environment given. */
const createEvaluator = (text, values, { env = {}, invoked = [] } = {}) => {
    const registry = new LexicaRegistry([Vocabulary.module, createPrices(invoked)]);
    const definition = ParsedTexts.parse(text);
    const bindings = new ParameterBindings(registry, values);
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, bindings, locations).resolveDefinition(definition);

    return new Evaluator(registry, resolved, bindings, env, locations);
};

/** A host whose hooks record what they are called with, in order, and answer what the test gives. */
const createHost = ({ beforeInvoke = () => undefined, afterInvoke = () => {}, afterEvaluation = () => {} } = {}) => {
    const calls = [];

    return {
        calls,
        beforeInvoke: request => (calls.push(`before:${request.declaration.name}@${request.pointer}`), beforeInvoke(request)),
        afterInvoke: (request, value) => (calls.push(`after:${request.declaration.name}=${value}`), afterInvoke(request, value)),
        afterEvaluation: outcome => (calls.push(`ended:${outcome.kind}`), afterEvaluation(outcome)),
    };
};


describe('Evaluator', () => {
    it('evaluates an expression without a host, in Node and with no browser', () => {
        expect(createEvaluator('{ total = name.price * quantity, count = names.count }', { name: 'tea', quantity: 2, names: ['tea', 'milk'] }).evaluate()).toMatchObject({ value: { total: 6, count: 2 }, isPending: false });
    });

    it('gives every implementation the environment, which Lexica never reads', () => {
        expect(createEvaluator('name.rate', { name: 'tea' }, { env: { rate: 7 } }).evaluate().value).toBe(7);
    });

    it('calls beforeInvoke and afterInvoke around each invocation, with the member, its receiver and where it stands, and afterEvaluation once', () => {
        const host = createHost();
        const requests = [];

        createEvaluator('{ a = name.price, b = name.rate }', { name: 'tea' }, { env: { rate: 1 } }).evaluate({ ...host, beforeInvoke: request => (requests.push(request), host.beforeInvoke(request)) });

        expect(host.calls).toEqual(['before:price@/expression/fields/0/value', 'after:price=3', 'before:rate@/expression/fields/1/value', 'after:rate=1', 'ended:completed']);
        expect(requests[0]).toMatchObject({ receiver: 'tea', args: {}, pointer: '/expression/fields/0/value' });
    });

    it('calls the hooks for the invocations an evaluation reaches alone', () => {
        const host = createHost();
        const invoked = [];

        createEvaluator('if false then name.price else 0 end', { name: 'tea' }, { invoked }).evaluate(host);

        expect(host.calls).toEqual(['ended:completed']);
        expect(invoked).toEqual([]);
    });

    it('reads a maintained member through the samples beforeInvoke answers', () => {
        const host = createHost({ beforeInvoke: request => (request.declaration.name === 'quoted' ? [42] : undefined) });

        expect(createEvaluator('name.quoted', { name: 'tea' }).evaluate(host)).toMatchObject({ value: 42, isPending: false });
    });

    it('leaves a member pending where beforeInvoke answers that its sample is, invoking nothing and ending pending', () => {
        const outcomes = [];
        const host = createHost({ beforeInvoke: () => ({ pending: true }), afterEvaluation: outcome => outcomes.push(outcome) });

        expect(createEvaluator('{ quote = name.quoted }', { name: 'tea' }).evaluate(host)).toMatchObject({ value: { quote: null }, isPending: true });
        expect(host.calls).toEqual(['before:quoted@/expression/fields/0/value', 'ended:pending']);
        expect(outcomes).toEqual([{ kind: 'pending', value: { quote: null } }]);
    });

    it('refuses a maintained member without a host to sample it', () => {
        expect(getError(() => createEvaluator('name.quoted', { name: 'tea' }).evaluate())).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('maintained by an observation') });
        expect(getError(() => createEvaluator('name.quoted', { name: 'tea' }).evaluate({ afterInvoke: () => {} }))).toMatchObject({ kind: 'evaluation' });
    });

    it('ends failed where the evaluation fails, and throws the failure', () => {
        const host = createHost();
        const failure = getError(() => createEvaluator('name.price / 0', { name: 'tea' }).evaluate(host));

        expect(failure).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('divides by zero') });
        expect(host.calls).toEqual(['before:price@/expression/left', 'after:price=3', 'ended:failed']);
    });

    it('fails the evaluation at the member where beforeInvoke or afterInvoke throws', () => {
        const before = getError(() => createEvaluator('name.price', { name: 'tea' }).evaluate({ beforeInvoke: () => { throw new Error('no session'); } }));
        const after = getError(() => createEvaluator('name.price', { name: 'tea' }).evaluate({ afterInvoke: () => { throw new Error('no record'); } }));

        expect(before).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('no session'), location: { pointer: '/expression' } });
        expect(after).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('no record'), location: { pointer: '/expression' } });
    });

    it('fails a completed evaluation whose afterEvaluation throws, and keeps a failure thrown, the cleanup failure recorded on it', () => {
        const cleanup = new Error('cleanup');

        const completed = getError(() => createEvaluator('name.price', { name: 'tea' }).evaluate({ afterEvaluation: () => { throw cleanup; } }));

        expect(completed).toMatchObject({ code: 'LEXICA5009', kind: 'evaluation' });
        expect(completed.cause).toBe(cleanup);

        const failure = getError(() => createEvaluator('name.price / 0', { name: 'tea' }).evaluate({ afterEvaluation: () => { throw cleanup; } }));

        expect(failure).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('divides by zero') });
        expect(failure.suppressed).toBe(cleanup);
    });

    it('keeps each evaluation its own, so one after a pending evaluation starts complete', () => {
        const evaluator = createEvaluator('name.quoted', { name: 'tea' });

        expect(evaluator.evaluate({ beforeInvoke: () => ({ pending: true }) }).isPending).toBe(true);
        expect(evaluator.evaluate({ beforeInvoke: () => [5] })).toMatchObject({ value: 5, isPending: false });
    });
});
