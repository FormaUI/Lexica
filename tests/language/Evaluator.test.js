import { describe, it, expect } from 'vitest';
import { Evaluator } from '#nexo/language/Evaluator.mjs';
import { LanguageResolver } from '#nexo/language/LanguageResolver.mjs';
import { ParameterBindings } from '#nexo/language/ParameterBindings.mjs';
import { ParsedTexts } from '#nexo/language/ParsedTexts.mjs';
import { Declarations } from '#nexo/language/vocabulary/Declarations.mjs';
import { NexoModule } from '#nexo/language/vocabulary/NexoModule.mjs';
import { NexoRegistry } from '#nexo/language/vocabulary/NexoRegistry.mjs';
import { Vocabulary } from '#nexo/language/vocabulary/Vocabulary.mjs';
import { extensionDeclaration } from '../support/declarations.mjs';
import { errorThrownBy } from '../support/errors.mjs';
import { parseImporting } from '../support/pipeline.mjs';

const { createPropertyDeclaration } = Declarations;

/**
 * A plain application-data host's module on names: a price read from a name, a rate the environment holds, and a quote maintained by an observation, which a host samples.
 * Every implementation records its receiver, so a test sees which invocations ran.
 */
const createPrices = invoked => new NexoModule('prices', {
    observationTypes: [{ name: 'quote', contract: 'maintained', impl: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 1 }) }) }],
    types: [
        extensionDeclaration('StringExtensions', 'String', [
            createPropertyDeclaration('price', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => (invoked.push(`price:${receiver}`), receiver.length) }),
            createPropertyDeclaration('rate', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ env }) => env.rate }),
            createPropertyDeclaration('quoted', 'Number?', { updates: { changes: 'observable', reads: 'maintained', observations: [{ type: 'quote', of: 'receiver' }] }, impl: ({ samples: [quote] }) => quote }),
        ]),
    ],
});

/** An evaluator of the text against a registry holding Nexo's own module and the prices module, with the bindings and the environment given. */
const createEvaluator = (text, values, { env = {}, invoked = [] } = {}) => {
    const registry = new NexoRegistry([Vocabulary.module, createPrices(invoked)]);
    const definition = parseImporting(registry, text);
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
        expect(createEvaluator('{ total = name:price * quantity, count = names.count }', { name: 'tea', quantity: 2, names: ['tea', 'milk'] }).evaluate()).toMatchObject({ value: { total: 6, count: 2 }, isPending: false });
    });

    it('gives every implementation the environment, which Nexo never reads', () => {
        expect(createEvaluator('name:rate', { name: 'tea' }, { env: { rate: 7 } }).evaluate().value).toBe(7);
    });

    it('calls beforeInvoke and afterInvoke around each invocation, with the member, its receiver and where it stands, and afterEvaluation once', () => {
        const host = createHost();
        const requests = [];

        createEvaluator('{ a = name:price, b = name:rate }', { name: 'tea' }, { env: { rate: 1 } }).evaluate({ ...host, beforeInvoke: request => (requests.push(request), host.beforeInvoke(request)) });

        expect(host.calls).toEqual(['before:price@/expression/objectFields/0/value', 'after:price=3', 'before:rate@/expression/objectFields/1/value', 'after:rate=1', 'ended:completed']);
        expect(requests[0]).toMatchObject({ receiver: 'tea', args: {}, pointer: '/expression/objectFields/0/value' });
    });

    it('names a member invoked within a script function\'s body by the part of the body it is, which the definition holds, whichever call reached it', () => {
        const text = 'let f = function(n)\n    return n:price\nend\nreturn { a = f(name), b = f(other) }';
        const requests = [];

        createEvaluator(text, { name: 'tea', other: 'milk' }).evaluate({ beforeInvoke: request => void requests.push(request) });

        expect(requests.map(({ receiver, pointer }) => ({ receiver, pointer }))).toEqual([
            { receiver: 'tea', pointer: '/expression/locals/0/value/body/result' },
            { receiver: 'milk', pointer: '/expression/locals/0/value/body/result' },
        ]);
        expect(ParsedTexts.locationsOf(ParsedTexts.parse(text)).locate(requests[0].pointer)).toMatchObject({ line: 2, column: 12 });
    });

    it('names an invocation by the same pointer at every evaluation, its request naming its parts in order', () => {
        const evaluator = createEvaluator('let f = function(n)\n    return n:price\nend\nreturn { a = f(name), b = f(other) }', { name: 'tea', other: 'milk' });
        const requests = [];

        evaluator.evaluate({ beforeInvoke: request => void requests.push(request) });
        evaluator.evaluate({ beforeInvoke: request => void requests.push(request) });

        expect(requests.map(request => request.pointer)).toEqual(Array(4).fill('/expression/locals/0/value/body/result'));
        expect(requests.map(request => Object.keys(request))).toEqual(Array(4).fill(['declaration', 'receiver', 'args', 'pointer', 'isDeferred']));
    });

    it('calls the hooks for the invocations an evaluation reaches alone', () => {
        const host = createHost();
        const invoked = [];

        createEvaluator('if false then name:price else 0 end', { name: 'tea' }, { invoked }).evaluate(host);

        expect(host.calls).toEqual(['ended:completed']);
        expect(invoked).toEqual([]);
    });

    it('answers null for a member of a receiver known to be null, evaluating the receiver once and selecting and invoking nothing', () => {
        const host = createHost();
        const invoked = [];
        const evaluation = createEvaluator('{ none = nothing?.price, indexed = nothing?[0], some = name:price }', { name: 'tea', nothing: null }, { invoked }).evaluate(host);

        expect(evaluation.value).toEqual({ none: null, indexed: null, some: 3 });
        expect(invoked).toEqual(['price:tea']);
        expect(host.calls.filter(call => call.startsWith('before'))).toEqual(['before:price@/expression/objectFields/2/value']);
    });

    it('reads a maintained member through the samples beforeInvoke answers', () => {
        const host = createHost({ beforeInvoke: request => (request.declaration.name === 'quoted' ? [42] : undefined) });

        expect(createEvaluator('name:quoted', { name: 'tea' }).evaluate(host)).toMatchObject({ value: 42, isPending: false });
    });

    it('leaves a member pending where beforeInvoke answers that its sample is, invoking nothing and ending pending', () => {
        const outcomes = [];
        const host = createHost({ beforeInvoke: () => ({ pending: true }), afterEvaluation: outcome => outcomes.push(outcome) });

        expect(createEvaluator('{ quote = name:quoted }', { name: 'tea' }).evaluate(host)).toMatchObject({ value: { quote: null }, isPending: true });
        expect(host.calls).toEqual(['before:quoted@/expression/objectFields/0/value', 'ended:pending']);
        expect(outcomes).toEqual([{ kind: 'pending', value: { quote: null } }]);
    });

    it('refuses a maintained member without a host to sample it', () => {
        expect(errorThrownBy(() => createEvaluator('name:quoted', { name: 'tea' }).evaluate())).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('maintained by an observation') });
        expect(errorThrownBy(() => createEvaluator('name:quoted', { name: 'tea' }).evaluate({ afterInvoke: () => {} }))).toMatchObject({ kind: 'evaluation' });
    });

    it('ends failed where the evaluation fails, and throws the failure', () => {
        const host = createHost();
        const failure = errorThrownBy(() => createEvaluator('name:price / 0', { name: 'tea' }).evaluate(host));

        expect(failure).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('divides by zero') });
        expect(host.calls).toEqual(['before:price@/expression/left', 'after:price=3', 'ended:failed']);
    });

    it('fails the evaluation at the member where beforeInvoke or afterInvoke throws', () => {
        const before = errorThrownBy(() => createEvaluator('name:price', { name: 'tea' }).evaluate({ beforeInvoke: () => { throw new Error('no session'); } }));
        const after = errorThrownBy(() => createEvaluator('name:price', { name: 'tea' }).evaluate({ afterInvoke: () => { throw new Error('no record'); } }));

        expect(before).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('no session'), location: { pointer: '/expression' } });
        expect(after).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('no record'), location: { pointer: '/expression' } });
    });

    it('fails a completed evaluation whose afterEvaluation throws, and keeps a failure thrown, the cleanup failure recorded on it', () => {
        const cleanup = new Error('cleanup');

        const completed = errorThrownBy(() => createEvaluator('name:price', { name: 'tea' }).evaluate({ afterEvaluation: () => { throw cleanup; } }));

        expect(completed).toMatchObject({ code: 'NEXO5009', kind: 'evaluation' });
        expect(completed.cause).toBe(cleanup);

        const failure = errorThrownBy(() => createEvaluator('name:price / 0', { name: 'tea' }).evaluate({ afterEvaluation: () => { throw cleanup; } }));

        expect(failure).toMatchObject({ kind: 'evaluation', message: expect.stringContaining('divides by zero') });
        expect(failure.suppressed).toBe(cleanup);
    });

    it('keeps each evaluation its own, so one after a pending evaluation starts complete', () => {
        const evaluator = createEvaluator('name:quoted', { name: 'tea' });

        expect(evaluator.evaluate({ beforeInvoke: () => ({ pending: true }) }).isPending).toBe(true);
        expect(evaluator.evaluate({ beforeInvoke: () => [5] })).toMatchObject({ value: 5, isPending: false });
    });

    it('keeps a conditional binding in the scope of a function made within its consequent, called after the consequent ends, the nearest binding of a name read', () => {
        const held = `let f = if let x = a then
    do
        let g = y => x + y
        return g
    end
else
    do
        let h = y => 0
        return h
    end
end
return f(1)`;
        const nested = `let f = if let x = a then
    if let x = b then
        do
            let g = y => x + y
            return g
        end
    else
        do
            let h = y => x
            return h
        end
    end
else
    do
        let h = y => 0
        return h
    end
end
return f(1)`;

        expect(createEvaluator(held, { a: 5 }).evaluate().value).toBe(6);
        expect(createEvaluator(held, { a: null }).evaluate().value).toBe(0);
        expect(createEvaluator(nested, { a: 5, b: 10 }).evaluate().value).toBe(11);
        expect(createEvaluator(nested, { a: 5, b: null }).evaluate().value).toBe(5);
        expect(createEvaluator('if let x = a then x + 1 else 0 end', { a: 2 }).evaluate().value).toBe(3);
    });

    it('evaluates an object expression\'s local at its first read alone, once for each application of the expression, and never where nothing reads it', () => {
        const evaluate = (text, values) => {
            const invoked = [];

            return { value: createEvaluator(text, values, { invoked }).evaluate().value, invoked };
        };

        expect(evaluate('{ let p = name:price, n = 1 }', { name: 'tea' })).toEqual({ value: { n: 1 }, invoked: [] });
        expect(evaluate('{ let p = name:price, a = p, b = p + 1 }', { name: 'tea' })).toEqual({ value: { a: 3, b: 4 }, invoked: ['price:tea'] });
        expect(evaluate('names { let p = it:price, a = p, b = p }', { names: ['tea', 'milk'] })).toEqual({ value: [{ a: 3, b: 3 }, { a: 4, b: 4 }], invoked: ['price:tea', 'price:milk'] });
    });

    it('reads each name from the nearest scope declaring it, a function\'s parameter, an object expression\'s local, a field and a body\'s local each hiding an outer name', () => {
        const valueOf = text => createEvaluator(text, {}).evaluate().value;

        expect(valueOf('let a = 1\nlet f = a => a * 10\nreturn { called = f(2), outer = a }')).toEqual({ called: 20, outer: 1 });
        expect(valueOf('let a = 1\nreturn { let a = 2, inner = a }')).toEqual({ inner: 2 });
        expect(valueOf('let a = 1\nreturn { outer = a, a = 2, later = a }')).toEqual({ outer: 1, a: 2, later: 2 });
        expect(valueOf('let a = 1\nreturn { let b = a + 1, c = do\n    let a = 5\n    return a + b\nend }')).toEqual({ c: 7 });
    });
});
