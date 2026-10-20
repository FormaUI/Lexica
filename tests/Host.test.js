import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

const { property, valueParameter } = lexica.declarations;

/** A plain host's module, of no domain: an order's total within a cent, a discount by code, and a product's stock, maintained by an observation the host samples. */
const createShop = () => lexica.createModule('shop', {
    types: [{ name: 'price', fields: { amount: 'number', currency: 'string' } }],
    observationTypes: [{ name: 'stock', contract: 'maintained', function: 'watchStock' }],
    members: [
        property('total', 'string', 'price', { changes: 'constant', tolerance: 0.01 }),
        lexica.declarations.function('discount', 'string', 'number', { changes: 'constant', parameters: [valueParameter('code', 'string')] }),
        property('stock', 'string', 'number?', { changes: 'observable', reads: 'maintained', observations: [{ type: 'stock', of: 'receiver' }] }),
    ],
}, {
    total: (order, _args, env) => ({ amount: env.prices[order], currency: 'EUR' }),
    discount: (_order, { code }) => (code === 'TEN' ? 10 : 0),
    stock: (_product, _args, _env, [count]) => count,
    watchStock: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 0 }) }),
});

describe('a host of plain data', () => {
    it('binds data as a frozen copy that later changes to the original never reach, keeping the resolution key', () => {
        const codes = ['TEN'];
        const bindings = lexica.bind({ order: 'a', codes });

        codes.push('TWENTY');

        expect(bindings.get('codes')).toEqual(['TEN']);
        expect(Object.isFrozen(bindings.get('codes'))).toBe(true);
        expect(bindings.resolutionKey).toBe(lexica.bind({ order: 'a', codes: ['X'] }).resolutionKey);
        expect(bindings.resolutionKey).not.toBe(lexica.bind({ order: 'b', codes }).resolutionKey);
    });

    it('resolves against its registry, telling the type, the declarations used and where each stands', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('{ total = order.total, cut = order.discount(code) }', lexica.bind({ order: 'a', code: 'TEN' }));

        expect(resolution.kind).toBe('value');
        expect(resolution.type).toBe('{ total: price, cut: number }');
        expect(resolution.typeAt(['total', 'amount'])).toBe('number');
        expect(resolution.usedDeclarations.map(({ name, pointer }) => [name, pointer])).toEqual([['string.total', '/expression/fields/0/value'], ['string.discount', '/expression/fields/1/value']]);
        expect(resolution.locate('/expression/fields/1/value')).toMatchObject({ pointer: '/expression/fields/1/value', line: 1 });
        expect(registry.revision).toBe(2);
        expect(registry.getOwner(resolution.usedDeclarations[0].declaration)).toBe('shop');
    });

    it('evaluates for a host, giving the environment to each implementation and describing the result', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('{ total = order.total, cut = order.discount(code) }', { order: 'a', code: 'TEN' });
        const evaluator = resolution.createEvaluator({ order: 'a', code: 'TEN' }, { prices: { a: 12.5 } });
        const first = evaluator.evaluate();
        const again = evaluator.evaluate();

        expect(first.value).toEqual({ total: { amount: 12.5, currency: 'EUR' }, cut: 10 });
        expect(first.metadata.fields.total.tolerance).toBe(0.01);
        expect(first.metadata.fields.cut.tolerance).toBeNull();
        expect(again.metadata.fields.total.origin).toBe(first.metadata.fields.total.origin);
        expect(first.metadata.fields.total.origin).not.toBe(first.metadata.fields.cut.origin);
    });

    it('reads a maintained member through the samples its host answers', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('product.stock', { product: 'p' });

        expect(resolution.createEvaluator({ product: 'p' }).evaluate({ beforeInvoke: () => [7] }).value).toBe(7);
        expect(resolution.createEvaluator({ product: 'p' }).evaluate({ beforeInvoke: () => ({ pending: true }) })).toMatchObject({ value: null, isPending: true });
    });

    it('reuses a resolution with bindings of its resolution key alone', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('{ cut = order.discount(code), note = extra.note }', { order: 'a', code: 'TEN', extra: { note: 'x' } });

        expect(resolution.createEvaluator({ order: 'a', code: 'TEN', extra: { note: 'y' } }).evaluate().value).toEqual({ cut: 10, note: 'y' });
        expect(getError(() => resolution.createEvaluator({ order: 'a', code: 'NONE', extra: { note: 'x' } }))).toMatchObject({ kind: 'structure', message: expect.stringContaining('resolve it with these bindings') });
    });

    it('refuses to evaluate a resolution a module registered since has made stale, wherever the evaluator was created', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('order.total', { order: 'a' });
        const evaluator = resolution.createEvaluator({ order: 'a' }, { prices: { a: 1 } });

        expect(evaluator.evaluate().value).toEqual({ amount: 1, currency: 'EUR' });

        registry.registerModule(lexica.createModule('extra', {}));

        expect(getError(() => evaluator.evaluate())).toMatchObject({ kind: 'structure', message: expect.stringContaining('stale') });
        expect(getError(() => resolution.createEvaluator({ order: 'a' }))).toMatchObject({ kind: 'structure' });
    });

    it('refuses an evaluator evaluating within its own evaluation, and evaluates again once it is done', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('order.discount(code)', { order: 'a', code: 'TEN' });
        const evaluator = resolution.createEvaluator({ order: 'a', code: 'TEN' });
        let inner = null;

        evaluator.evaluate({ beforeInvoke: () => { inner = getError(() => evaluator.evaluate()); } });

        expect(inner).toBeInstanceOf(LexicaError);
        expect(inner.message).toContain('one evaluation at a time');
        expect(evaluator.evaluate().value).toBe(10);
    });

    it('quotes and locates source, and refuses a pointer the definition does not hold', () => {
        const definition = lexica.parse('{ total = order.total }');

        expect(lexica.quote('{\n    total = order.total\n}')).toBe('{ total = order.total }');
        expect(lexica.locate(definition, '/expression/fields/0/value')).toMatchObject({ line: 1, column: 11 });
        expect(lexica.locate(lexica.validate({ version: lexica.info.definitionVersion, expression: { kind: 'literal', value: 1 } }), '/expression')).toEqual({ pointer: '/expression' });
        expect(getError(() => lexica.locate(definition, '/expression/fields/9'))).toMatchObject({ kind: 'structure' });
    });

    it('checks a result path and reads the value it reaches', () => {
        expect(lexica.paths.valueAt({ total: { amount: 3 } }, ['total', 'amount'])).toBe(3);
        expect(getError(() => lexica.paths.check(['total', -1]))).toMatchObject({ kind: 'structure' });
    });
});
