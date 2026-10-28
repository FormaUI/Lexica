import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createFunctionDeclaration } = lexica.declarations;

/** A plain host's module, of no domain: an order's total within a cent, a discount by code, and a product's stock, maintained by an observation the host samples. */
const createShop = () => lexica.createModule('shop', {
    types: [
        { name: 'Price', kind: 'structured', members: dataPropertyDeclarations({ amount: 'Number', currency: 'String' }) },
        extensionDeclaration('StringExtensions', 'String', [
            createPropertyDeclaration('total', 'Price', { updates: { changes: 'constant', reads: 'fresh', tolerance: 0.01 }, impl: ({ receiver, env }) => ({ amount: env.prices[receiver], currency: 'EUR' }) }),
            createFunctionDeclaration('discount', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, parameters: [createValueParameterDeclaration('code', 'String')], impl: ({ args }) => (args.code === 'TEN' ? 10 : 0) }),
            createPropertyDeclaration('stock', 'Number?', { updates: { changes: 'observable', reads: 'maintained', observations: [{ type: 'stock', of: 'receiver' }] }, impl: ({ samples: [count] }) => count }),
        ]),
    ],
    observationTypes: [{ name: 'stock', contract: 'maintained', impl: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 0 }) }) }],
});

describe('a host of plain data', () => {
    it('binds data as a frozen copy that later changes to the original never reach, keeping the resolution key', () => {
        const codes = ['TEN'];
        const registry = lexica.createRegistry([createShop()]);
        const bindings = registry.createBindings({ order: 'a', codes });

        codes.push('TWENTY');

        expect(bindings.readValue('codes')).toEqual(['TEN']);
        expect(Object.isFrozen(bindings.readValue('codes'))).toBe(true);
        expect(bindings.resolutionKey).toBe(registry.createBindings({ order: 'a', codes: ['X'] }).resolutionKey);
        expect(bindings.resolutionKey).not.toBe(registry.createBindings({ order: 'b', codes }).resolutionKey);
    });

    it('resolves against its registry, telling the type, the declarations used and where each stands', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('{ total = order.total, cut = order.discount(code) }', registry.createBindings({ order: 'a', code: 'TEN' }));

        expect(resolution.hostCall).toBeNull();
        expect(resolution.type).toBe('{ total: Price, cut: Number }');
        expect(resolution.typeAt(['total', 'amount'])).toBe('Number');
        expect(() => resolution.typeAt(['total', 'weight'])).toThrow("The path names 'weight', which Price does not hold");
        expect(registry.resolve('{ none = null }').typeAt(['none'])).toBe('null');
        expect(resolution.usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([['String.total', '/expression/objectFields/0/value'], ['String.discount', '/expression/objectFields/1/value']]);
        expect(resolution.usedDeclarations.map(({ name }) => name)).toEqual(['total', 'discount']);
        expect(resolution.getLocation('/expression/objectFields/1/value')).toMatchObject({ pointer: '/expression/objectFields/1/value', line: 1 });
        expect(registry.revision).toBe(2);
        expect(registry.getDeclaringModuleName(resolution.usedDeclarations[0].declaration)).toBe('shop');
    });

    it('tells where a declaration a script function\'s body uses stands in the definition, once for every call that reaches it', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('let f = function(x) return x.count end\nreturn f(items) + f(items)', registry.createBindings({ items: [1, 2] }));

        expect(resolution.usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([['List.count', '/expression/locals/0/value/body/result']]);
        expect(resolution.getLocation(resolution.usedDeclarations[0].pointer)).toMatchObject({ line: 1, column: 28 });
    });

    it('names a used member of a list by its type, Lexica\'s List, as any member is named by the type it matched', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('items.count', registry.createBindings({ items: [1, 2] }));

        expect(resolution.usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['List.count']);
    });

    it('evaluates for a host, giving the environment to each implementation and describing the result', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('{ total = order.total, cut = order.discount(code) }', { order: 'a', code: 'TEN' });
        const evaluator = resolution.createEvaluator({ order: 'a', code: 'TEN' }, { prices: { a: 12.5 } });
        const first = evaluator.evaluate();
        const again = evaluator.evaluate();

        expect(first.value).toEqual({ total: { amount: 12.5, currency: 'EUR' }, cut: 10 });
        expect(first.metadata.objectFields.total.tolerance).toBe(0.01);
        expect(first.metadata.objectFields.cut.tolerance).toBeNull();
        expect(again.metadata.objectFields.total.origin).toBe(first.metadata.objectFields.total.origin);
        expect(first.metadata.objectFields.total.origin).not.toBe(first.metadata.objectFields.cut.origin);
    });

    it('answers a result that is frozen through its value and its metadata, so nothing a caller does changes what an evaluation produced', () => {
        const result = lexica.createRegistry([createShop()]).resolve('{ total = order.total, codes = codes.where(it != "x") }', { order: 'a', codes: ['TEN', 'x'] })
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
        expect(errorThrownBy(() => resolution.createEvaluator({ order: 'a', code: 'NONE', extra: { note: 'x' } }))).toMatchObject({ kind: 'structure', message: expect.stringContaining('These bindings resolve the script otherwise than the bindings it was resolved with') });
    });

    it('refuses to evaluate a resolution a module registered since has made stale, wherever the evaluator was created', () => {
        const registry = lexica.createRegistry([createShop()]);
        const resolution = registry.resolve('order.total', { order: 'a' });
        const evaluator = resolution.createEvaluator({ order: 'a' }, { prices: { a: 1 } });

        expect(evaluator.evaluate().value).toEqual({ amount: 1, currency: 'EUR' });

        registry.registerModule(lexica.createModule('extra', {}));

        expect(errorThrownBy(() => evaluator.evaluate())).toMatchObject({ kind: 'structure', message: expect.stringContaining('its resolution is stale; resolve the script again') });
        expect(errorThrownBy(() => resolution.createEvaluator({ order: 'a' }))).toMatchObject({ kind: 'structure' });
    });

    it('registers a module and answers nothing, so no registration hands out the registry behind it', () => {
        const registry = lexica.createRegistry([createShop()]);

        expect(registry.registerModule(lexica.createModule('extra', {}))).toBeUndefined();
        expect(registry.moduleNames).toContain('extra');
    });

    it('types a call nullable where an argument that may be null meets a parameter propagating null, its own type nullable or not, as the call answers null without invoking the implementation', () => {
        const invoked = [];
        const add = type => createFunctionDeclaration('add', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('amount', type)], impl: ({ receiver, args }) => (invoked.push(args.amount), receiver + args.amount) });
        const none = createPropertyDeclaration('none', 'Number?', { updates: constantUpdates, impl: () => null });
        const sums = type => lexica.createRegistry([lexica.createModule('sums', { types: [extensionDeclaration('Sums', 'Number', [add(type), none])] })]);
        const resolve = (type, text) => sums(type).resolve(text, { n: 1 });

        for (const type of ['Number', 'Number?']) {
            expect(resolve(type, 'n.add(null)').type, type).toBe('Number?');
            expect(resolve(type, 'n.add(n.none)').type, type).toBe('Number?');
            expect(resolve(type, 'n.add(2)').type, type).toBe('Number');
            expect(resolve(type, 'n.add(null)').createEvaluator({ n: 1 }).evaluate().value, type).toBeNull();
            expect(resolve(type, 'n.add(n.none)').createEvaluator({ n: 1 }).evaluate().value, type).toBeNull();
            expect(invoked, type).toEqual([]);
        }
    });

    it('refuses an evaluator evaluating within its own evaluation, and evaluates again once it is done', () => {
        const resolution = lexica.createRegistry([createShop()]).resolve('order.discount(code)', { order: 'a', code: 'TEN' });
        const evaluator = resolution.createEvaluator({ order: 'a', code: 'TEN' });
        let inner = null;

        evaluator.evaluate({ beforeInvoke: () => { inner = errorThrownBy(() => evaluator.evaluate()); } });

        expect(inner).toBeInstanceOf(LexicaError);
        expect(inner.message).toContain('one evaluation at a time');
        expect(evaluator.evaluate().value).toBe(10);
    });

    it('quotes and locates source, and refuses a pointer the definition does not hold', () => {
        const definition = lexica.parse('{ total = order.total }');

        expect(lexica.quote('{\n    total = order.total\n}')).toBe('{ total = order.total }');
        expect(lexica.getLocation(definition, '/expression/objectFields/0/value')).toMatchObject({ line: 1, column: 11 });
        expect(lexica.getLocation(lexica.validate({ version: lexica.info.versions.definition, imports: [], expression: { kind: 'literal', value: 1 } }), '/expression')).toEqual({ pointer: '/expression' });
        expect(errorThrownBy(() => lexica.getLocation(definition, '/expression/objectFields/9'))).toMatchObject({ kind: 'structure' });
    });

    it('checks a result path and reads the value it reaches', () => {
        expect(lexica.paths.valueAt({ total: { amount: 3 } }, ['total', 'amount'])).toBe(3);
        expect(errorThrownBy(() => lexica.paths.validate(['total', -1]))).toMatchObject({ kind: 'structure' });
    });
});

describe('the declaration shape', () => {
    const { createPropertyDeclaration, createValueParameterDeclaration } = lexica.declarations;

    /** A module of a cafe's menu, each implementation recording the one object it was given. */
    const createMenu = (received = []) => lexica.createModule('menu', {
        types: [
            extensionDeclaration('StringExtensions', 'String', [
                createPropertyDeclaration('price', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: input => (received.push(input), input.receiver.length) }),
                createFunctionDeclaration('discounted', 'Number', {
                    updates: { changes: 'constant', reads: 'fresh' }, parameters: [createValueParameterDeclaration('percent', 'Number')],
                    impl: ({ receiver, args, env }) => receiver.length * (1 - args.percent / 100) * env.rate,
                }),
                createPropertyDeclaration('special', 'String', { updates: { changes: 'constant', reads: 'fresh' } }),
                createFunctionDeclaration('vegan', 'Boolean', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver, args }) => (received.push(args), receiver.startsWith('oat')) }),
            ]),
        ],
        // The vegan test as a module member of the item, which the module's namespace and a reference reach.
        members: [
            createFunctionDeclaration('vegan', 'Boolean', {
                updates: { changes: 'constant', reads: 'fresh' }, parameters: [createValueParameterDeclaration('item', 'String')],
                impl: ({ args }) => (received.push(args), args.item.startsWith('oat')),
            }),
        ],
    });

    it('gives each implementation one object it reads by name: the receiver, the arguments by parameter name and the environment', () => {
        const received = [];
        const resolution = lexica.createRegistry([createMenu(received)]).resolve('{ price = item.price, discounted = item.discounted(50) }', { item: 'latte' });
        const { value } = resolution.createEvaluator({ item: 'latte' }, { rate: 2 }).evaluate();

        expect(value).toEqual({ price: 5, discounted: 5 });
        expect(received).toEqual([{ receiver: 'latte', args: {}, env: { rate: 2 } }]);
    });

    it('carries a Boolean function out by its own implementation, a receiver\'s called on it, and a module member\'s called through its module or by reference as the test a verb is given', () => {
        const received = [];
        const registry = lexica.createRegistry([createMenu(received)]);
        const evaluate = (text, item) => registry.resolve(text, { item }, { imports: ['menu'] }).createEvaluator({ item }).evaluate().value;

        expect(['item.vegan()', 'menu.vegan(item)', 'item.is(menu.vegan)'].map(text => [evaluate(text, 'oat latte'), evaluate(text, 'latte')])).toEqual([[true, false], [true, false], [true, false]]);
        expect(received).toEqual([{}, {}, ...Array(2).fill([{ item: 'oat latte' }, { item: 'latte' }]).flat()]);
    });

    it('resolves a script that uses a declaration without an implementation, and refuses to evaluate it, naming the declaration, its module and the field', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('item.special', { item: 'latte' });

        expect(resolution.type).toBe('String');
        expect(errorThrownBy(() => resolution.createEvaluator({ item: 'latte' }))).toMatchObject({ kind: 'module', message: expect.stringContaining('so a script that uses it is resolved and never evaluated'), location: { module: 'menu', declaration: 'special', declarationKey: 'impl' } });
    });

    it('decides before anything is evaluated, so a branch evaluation would not take refuses its script too', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('if item.vegan() then item.price else item.special.price end', { item: 'oat latte' });

        expect(errorThrownBy(() => resolution.createEvaluator({ item: 'oat latte' }))).toMatchObject({ kind: 'module', location: { declaration: 'special' } });
    });

    it('reads a required parameter whose default holds undefined as one that declares none, so its argument is still required', () => {
        const percent = { ...createValueParameterDeclaration('percent', 'Number'), default: undefined };
        const registry = lexica.createRegistry([lexica.createModule('cut', {
            types: [extensionDeclaration('StringExtensions', 'String', [createFunctionDeclaration('cut', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, parameters: [percent], impl: ({ args }) => args.percent })])],
        })]);

        expect(registry.resolve('item.cut(5)', { item: 'latte' }).createEvaluator({ item: 'latte' }).evaluate().value).toBe(5);
        expect(errorThrownBy(() => registry.resolve('item.cut()', { item: 'latte' }))).toBeInstanceOf(LexicaError);
    });

    it('refuses a function call written as an indexer, giving the call to write', () => {
        expect(errorThrownBy(() => lexica.createRegistry([createMenu()]).resolve('item.discounted[50]', { item: 'latte' })).message).toContain("'discounted' uses call syntax: write 'item.discounted(50)'");
    });

    it('evaluates an expression of a mixed module that uses its implemented declarations alone', () => {
        const resolution = lexica.createRegistry([createMenu()]).resolve('if item.vegan() then item.price else 0 end', { item: 'oat latte' });

        expect(resolution.createEvaluator({ item: 'oat latte' }).evaluate().value).toBe(9);
    });

    it('refuses to evaluate an expression that converts through a conversion without an implementation, in a branch it may not take as well', () => {
        const cups = lexica.createModule('cups', { types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }, extensionDeclaration('Orders', 'String', [operatorDeclaration('convert', 'Cup')])] });
        const resolution = lexica.createRegistry([cups]).resolve('if large then (order to Cup).size else 0 end', { order: 'tall', large: false });

        expect(errorThrownBy(() => resolution.createEvaluator({ order: 'tall', large: false }))).toMatchObject({ kind: 'module', message: expect.stringContaining('The conversion from String to Cup has no implementation'), location: { module: 'cups', type: 'Orders', declaration: 'convert', declarationKey: 'impl' } });
    });

    it('registers a module member, which has no target, beside the members of a type, read through its namespace and answered by no receiver, its implementation given no receiver', () => {
        const received = [];
        const registry = lexica.createRegistry([lexica.createModule('clock', {
            types: [
                extensionDeclaration('StringExtensions', 'String', [
                    createPropertyDeclaration('length', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => receiver.length }),
                ]),
            ],
            members: [
                createPropertyDeclaration('zone', 'String', { updates: { changes: 'unobserved', reads: 'fresh' }, impl: input => (received.push(input), 'UTC') }),
            ],
        })]);

        expect(registry.moduleNames).toEqual(['Lexica', 'clock']);
        expect(registry.resolve('import clock\n{ length = item.length, zone = clock.zone }', { item: 'latte' }).createEvaluator({ item: 'latte' }, { rate: 1 }).evaluate().value).toEqual({ length: 5, zone: 'UTC' });
        expect(received).toEqual([{ args: {}, env: { rate: 1 } }]);
        expect(errorThrownBy(() => registry.resolve('item.zone', { item: 'latte' }))).toBeInstanceOf(LexicaError);
    });

    it('registers a module member and an extension member of one name in one module, the namespace reading the module member and a receiver the extension\'s', () => {
        const registry = lexica.createRegistry([lexica.createModule('clock', {
            types: [extensionDeclaration('Words', 'String', [createPropertyDeclaration('now', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => receiver.length })])],
            members: [createPropertyDeclaration('now', 'Number', { updates: { changes: 'unobserved', reads: 'fresh' }, impl: () => 0 })],
        })]);
        const evaluate = text => registry.resolve(text, { word: 'oat' }, { imports: ['clock'] }).createEvaluator({ word: 'oat' }).evaluate().value;

        expect(evaluate('clock.now')).toBe(0);
        expect(evaluate('word.now')).toBe(3);
    });
});
