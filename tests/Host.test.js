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
    observationTypes: [{ name: 'stock', contract: 'maintained', implementation: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 0 }) }) }],
    members: [
        property('total', 'string', 'price', { updates: { changes: 'constant', reads: 'fresh', tolerance: 0.01 }, implementation: ({ receiver, env }) => ({ amount: env.prices[receiver], currency: 'EUR' }) }),
        lexica.declarations.function('discount', 'string', 'number', { updates: { changes: 'constant', reads: 'fresh' }, parameters: [valueParameter('code', 'string')], implementation: ({ args }) => (args.code === 'TEN' ? 10 : 0) }),
        property('stock', 'string', 'number?', { updates: { changes: 'observable', reads: 'maintained', observations: [{ type: 'stock', of: 'receiver' }] }, implementation: ({ samples: [count] }) => count }),
    ],
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

    it('answers a result that is frozen through its value and its metadata, so nothing a caller does changes what an evaluation produced', () => {
        const result = lexica.createRegistry([createShop()]).resolve('{ total = order.total, codes = codes.where(context != "x") }', { order: 'a', codes: ['TEN', 'x'] })
            .createEvaluator({ order: 'a', codes: ['TEN', 'x'] }, { prices: { a: 3 } })
            .evaluate();

        expect([result, result.value, result.value.total, result.value.codes, result.metadata].every(part => Object.isFrozen(part))).toBe(true);
        expect(() => { result.value = null; }).toThrow(TypeError);
        expect(result.value.codes).toEqual(['TEN']);
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
        expect(lexica.locate(lexica.validate({ version: lexica.info.versions.definition, expression: { kind: 'literal', value: 1 } }), '/expression')).toEqual({ pointer: '/expression' });
        expect(getError(() => lexica.locate(definition, '/expression/fields/9'))).toMatchObject({ kind: 'structure' });
    });

    it('checks a result path and reads the value it reaches', () => {
        expect(lexica.paths.valueAt({ total: { amount: 3 } }, ['total', 'amount'])).toBe(3);
        expect(getError(() => lexica.paths.check(['total', -1]))).toMatchObject({ kind: 'structure' });
    });
});

describe('the declaration shape', () => {
    const { property, valueParameter } = lexica.declarations;

    /** A module of a cafe's menu, each implementation recording the one object it was given. */
    const createMenu = (received = []) => lexica.createModule('menu', {
        members: [
            property('price', 'string', 'number', { updates: { changes: 'constant', reads: 'fresh' }, implementation: input => (received.push(input), input.receiver.length) }),
            lexica.declarations.function('discounted', 'string', 'number', {
                updates: { changes: 'constant', reads: 'fresh' }, parameters: [valueParameter('percent', 'number')],
                implementation: ({ receiver, args, env }) => receiver.length * (1 - args.percent / 100) * env.rate,
            }),
            property('special', 'string', 'string', { updates: { changes: 'constant', reads: 'fresh' } }),
        ],
        predicates: [lexica.declarations.predicate('vegan', 'string', ({ receiver, args }) => (received.push(args), receiver.startsWith('oat')), { updates: { changes: 'constant', reads: 'fresh' } })],
    });

    it('gives each implementation one object it reads by name: the receiver, the arguments by parameter name and the environment', () => {
        const received = [];
        const resolution = lexica.createRegistry([createMenu(received)]).resolve('{ price = item.price, discounted = item.discounted(50) }', { item: 'latte' });
        const { value } = resolution.createEvaluator({ item: 'latte' }, { rate: 2 }).evaluate();

        expect(value).toEqual({ price: 5, discounted: 5 });
        expect(received).toEqual([{ receiver: 'latte', args: {}, env: { rate: 2 } }]);
    });

    it('carries a predicate out by its own implementation, which its verb selects, given its name as its argument', () => {
        const received = [];
        const registry = lexica.createRegistry([createMenu(received)]);
        const evaluate = item => registry.resolve('item.is("vegan")', { item }).createEvaluator({ item }).evaluate().value;

        expect([evaluate('oat latte'), evaluate('latte')]).toEqual([true, false]);
        expect(received).toEqual([{ name: 'vegan' }, { name: 'vegan' }]);
    });

    it('resolves an expression that uses a declaration without an implementation, and refuses to evaluate it, naming the declaration, its module and the field', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('item.special', { item: 'latte' });

        expect(resolution.type).toBe('string');
        expect(getError(() => resolution.createEvaluator({ item: 'latte' }))).toMatchObject({ kind: 'module', location: { module: 'menu', declaration: 'special', field: 'implementation' } });
    });

    it('decides before anything is evaluated, so a branch evaluation would not take refuses its expression too', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('if item.is("vegan") then item.price else item.special.price end', { item: 'oat latte' });

        expect(getError(() => resolution.createEvaluator({ item: 'oat latte' }))).toMatchObject({ kind: 'module', location: { declaration: 'special' } });
    });

    it('reads a required parameter whose default holds undefined as one that declares none, so its argument is still required', () => {
        const percent = { ...valueParameter('percent', 'number'), default: undefined };
        const registry = lexica.createRegistry([lexica.createModule('cut', {
            members: [lexica.declarations.function('cut', 'string', 'number', { updates: { changes: 'constant', reads: 'fresh' }, parameters: [percent], implementation: ({ args }) => args.percent })],
        })]);

        expect(registry.resolve('item.cut(5)', { item: 'latte' }).createEvaluator({ item: 'latte' }).evaluate().value).toBe(5);
        expect(getError(() => registry.resolve('item.cut()', { item: 'latte' }))).toBeInstanceOf(LexicaError);
    });

    it('refuses a function call written as an indexer, giving the call to write', () => {
        expect(getError(() => lexica.createRegistry([createMenu()]).resolve('item:discounted[50]', { item: 'latte' })).message).toContain("'discounted' uses call syntax: write 'item.discounted(50)'");
    });

    it('evaluates an expression of a mixed module that uses its implemented declarations alone', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('if item.is("vegan") then item.price else 0 end', { item: 'oat latte' });

        expect(resolution.createEvaluator({ item: 'oat latte' }).evaluate().value).toBe(9);
    });

    it('refuses to evaluate an expression that converts through a conversion without an implementation, in a branch it may not take as well', () => {
        const cups = lexica.createModule('cups', { types: [{ name: 'cup', fields: { size: 'number' } }], conversions: [{ from: 'string', to: 'cup' }] });
        const resolution = lexica.createRegistry([cups]).resolve('if large then (order to "cup").size else 0 end', { order: 'tall', large: false });

        expect(getError(() => resolution.createEvaluator({ order: 'tall', large: false }))).toMatchObject({ kind: 'module', location: { module: 'cups', declaration: 'string to cup', field: 'implementation' } });
    });

    it('registers a module member, which has no target, beside the members of a type, and no receiver answers it', () => {
        const registry = lexica.createRegistry([lexica.createModule('clock', {
            members: [
                property('now', null, 'number', { updates: { changes: 'unobserved', reads: 'fresh' }, implementation: () => 0 }),
                property('now', 'string', 'number', { updates: { changes: 'constant', reads: 'fresh' }, implementation: ({ receiver }) => receiver.length }),
                property('zone', null, 'string', { updates: { changes: 'unobserved', reads: 'fresh' }, implementation: () => 'UTC' }),
            ],
        })]);

        expect(registry.moduleNames).toEqual(['lexica', 'clock']);
        expect(registry.resolve('item.now', { item: 'latte' }).createEvaluator({ item: 'latte' }).evaluate().value).toBe(5);
        expect(getError(() => registry.resolve('item.zone', { item: 'latte' }))).toBeInstanceOf(LexicaError);
    });
});
