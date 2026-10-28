import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Device, Light, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';

const { createFunctionDeclaration, createPropertyDeclaration, createValueParameterDeclaration } = lexica.declarations;

const lamp = new Light('lamp');
const fan = new Device('fan');

/**
 * A shop of the home: its prices as a map, its tags as a set and its best offer as an object of a key and a value, each a collection a host gives in a form of its own where its declaration names the language's;
 * a price looked up through a dictionary it is given; and a mistyped map, whose values are no numbers.
 */
const createShop = () => lexica.createModule('Shop', withHome({
    members: [
        createPropertyDeclaration('prices', 'Dictionary<String, Number>', { updates: constantUpdates, impl: () => new Map([['coffee', 3], ['tea', 2]]) }),
        createPropertyDeclaration('tags', 'List<String>', { updates: constantUpdates, impl: () => new Set(['hot', 'iced', 'hot']) }),
        createPropertyDeclaration('offer', 'Pair<String, Number>', { updates: constantUpdates, impl: () => ({ key: 'tea', value: 1 }) }),
        createPropertyDeclaration('wrong', 'Dictionary<String, Number>', { updates: constantUpdates, impl: () => new Map([['coffee', 'three']]) }),
        createPropertyDeclaration('devices', 'Dictionary<String, Device>', { updates: constantUpdates, impl: () => new Map([['lamp', lamp], ['fan', fan]]) }),
        createFunctionDeclaration('priceOf', 'Number?', {
            updates: constantUpdates, parameters: [createValueParameterDeclaration('prices', 'Dictionary<String, Number>'), createValueParameterDeclaration('name', 'String')],
            impl: ({ args }) => (args.prices.has(args.name) ? args.prices.get(args.name) : null),
        }),
    ],
}));

/** The resolution of the text against a registry of the shop, imported, with the values bound. */
const resolve = (text, values = {}) => lexica.createRegistry([createShop()]).resolve(text, values, { imports: ['Shop'] });

/** What the text evaluates to against the shop, with the values bound. */
const evaluate = (text, values = {}) => resolve(text, values).createEvaluator(values).evaluate().value;

const prices = new Map([['coffee', 3], ['tea', null], ['water', 0]]);

describe('collections', () => {
    describe('captured from a host', () => {
        it('binds a map as a dictionary of the types its keys and its values share, in its order, and a set as a list of its items in its order', () => {
            expect(resolve('prices', { prices }).type).toBe('Dictionary<String, Number?>');
            expect(evaluate('prices.keys', { prices })).toEqual(['coffee', 'tea', 'water']);
            expect(resolve('tags', { tags: new Set(['b', 'a', 'b']) }).type).toBe('List<String>');
            expect(evaluate('tags', { tags: new Set(['b', 'a']) })).toEqual(['b', 'a']);
            const registry = lexica.createRegistry([createShop()]);

            expect(String(registry.createBindings({ lights: new Map([[1, lamp]]) }).getType('lights'))).toBe('Dictionary<Number, Light>');
            expect(String(registry.createBindings({ byLight: new Map([[lamp, 'on'], [fan, 'off']]) }).getType('byLight'))).toBe('Dictionary<Device, String>');
        });

        it('binds an empty map as a dictionary of no key and no value type, which fits wherever a dictionary is declared', () => {
            expect(resolve('none', { none: new Map() }).type).toBe('Dictionary<Never, Never>');
            expect(evaluate('Shop.priceOf(none, "tea")', { none: new Map() })).toBeNull();
        });

        it('copies a map and a set as they stand, never a live view, and leaves an object of a key and a value or of entries an object', () => {
            const live = new Map([['a', 1]]);
            const registry = lexica.createRegistry([]);
            const bindings = registry.createBindings({ live });

            live.set('b', 2);
            expect(registry.resolve('live.count', bindings).createEvaluator(bindings).evaluate().value).toBe(1);
            expect(resolve('pair', { pair: { key: 'a', value: 1 } }).type).toBe('{ key: String, value: Number }');
            expect(resolve('dictionary', { dictionary: { entries: [] } }).type).toBe('{ entries: List<Never> }');
        });

        it('refuses a key of no key type and keys or values that share no type, and an iterable no host materialized', () => {
            expect(errorThrownBy(() => resolve('m', { m: new Map([[[1], 'list']]) }))).toMatchObject({ code: 'LEXICA2041', location: { binding: 'm' } });
            expect(errorThrownBy(() => resolve('m', { m: new Map([[{ a: 1 }, 'object']]) }))).toMatchObject({ code: 'LEXICA2041' });
            expect(errorThrownBy(() => resolve('m', { m: new Map([['a', 1], [2, 2]]) }))).toMatchObject({ code: 'LEXICA2042', message: expect.stringContaining('keys') });
            expect(errorThrownBy(() => resolve('m', { m: new Map([['a', 1], ['b', 'two']]) }))).toMatchObject({ code: 'LEXICA2042', message: expect.stringContaining('values') });
            expect(errorThrownBy(() => resolve('m', { m: (function* items() { yield 1; })() }))).toMatchObject({ code: 'LEXICA2034' });
        });
    });

    describe('looked up', () => {
        it('reads a key\'s value, null for an absent key and for a null value, which containsKey and entry tell apart', () => {
            expect(evaluate('{ coffee = prices["coffee"], tea = prices["tea"], milk = prices["milk"] }', { prices })).toEqual({ coffee: 3, tea: null, milk: null });
            expect(evaluate('{ tea = prices.containsKey("tea"), milk = prices.containsKey("milk") }', { prices })).toEqual({ tea: true, milk: false });
            expect(evaluate('{ tea = prices.entry["tea"], milk = prices.entry["milk"] }', { prices })).toEqual({ tea: { key: 'tea', value: null }, milk: null });
            expect(evaluate('prices.count', { prices })).toBe(3);
        });

        it('reads a key, never a position, a number\'s zero and negative zero one key, and a null key as a key of its own', () => {
            const numbers = new Map([[2, 'two'], [0, 'zero']]);

            expect(evaluate('{ two = numbers[2], zero = numbers[-0], first = numbers[1] }', { numbers })).toEqual({ two: 'two', zero: 'zero', first: null });

            const named = new Map([[null, 'nobody'], ['ann', 'Ann']]);

            expect(resolve('named', { named }).type).toBe('Dictionary<String?, String>');
            expect(evaluate('{ none = named[null], has = named.containsKey(null), ann = named["ann"] }', { named })).toEqual({ none: 'nobody', has: true, ann: 'Ann' });
            expect(evaluate('prices.containsKey(null)', { prices })).toBe(false);
        });

        it('gives its keys, its values and its entries in its order, and a list\'s entry at an index as a pair', () => {
            expect(evaluate('{ keys = prices.keys, values = prices.values, entries = prices.entries }', { prices })).toEqual({
                keys: ['coffee', 'tea', 'water'],
                values: [3, null, 0],
                entries: [{ key: 'coffee', value: 3 }, { key: 'tea', value: null }, { key: 'water', value: 0 }],
            });
            expect(resolve('prices.entries', { prices }).type).toBe('List<Pair<String, Number?>>');
            expect(evaluate('{ second = items.entry[1], none = items.entry[5], negative = items.entry[-1], key = items.entry[0]?.key }', { items: ['a', 'b'] })).toEqual({ second: { key: 1, value: 'b' }, none: null, negative: null, key: 0 });
        });

        it('keeps the dictionary\'s keys and order through a filter of its entries and a projection of them', () => {
            expect(evaluate('prices.entries.where(it.value != null) { name = it.key, price = it.value }', { prices })).toEqual([{ name: 'coffee', price: 3 }, { name: 'water', price: 0 }]);
        });
    });

    describe('in a result', () => {
        it('exports a dictionary as its entries in their order, each key\'s type kept, and a pair as its key and its value', () => {
            const numbers = new Map([[2, 'two'], [1, 'one']]);
            const exported = evaluate('{ numbers = numbers, entry = numbers.entry[2] }', { numbers });

            expect(exported).toEqual({ numbers: { entries: [{ key: 2, value: 'two' }, { key: 1, value: 'one' }] }, entry: { key: 2, value: 'two' } });
            expect(Object.isFrozen(exported.numbers) && Object.isFrozen(exported.numbers.entries) && Object.isFrozen(exported.numbers.entries[0])).toBe(true);
            expect(exported.numbers instanceof Map).toBe(false);
        });

        it('refuses a dictionary holding a reference, as a key or a value, where a result would hold it', () => {
            expect(errorThrownBy(() => resolve('lights', { lights: new Map([['lamp', lamp]]) }))).toMatchObject({ code: 'LEXICA3043' });
            expect(errorThrownBy(() => resolve('byLight', { byLight: new Map([[lamp, 'on']]) }))).toMatchObject({ code: 'LEXICA3043' });
            expect(evaluate('Shop.devices.keys')).toEqual(['lamp', 'fan']);
        });

        it('refuses comparing a dictionary or a pair by an equality with anything but null', () => {
            expect(errorThrownBy(() => resolve('prices == prices', { prices })).code).toMatch(/^LEXICA3/);
            expect(evaluate('prices != null', { prices })).toBe(true);
        });
    });

    describe('given by a member', () => {
        it('captures a map, a set and an object of a key and a value where the member declares a dictionary, a list and a pair', () => {
            expect(evaluate('{ prices = Shop.prices, tags = Shop.tags, offer = Shop.offer }')).toEqual({
                prices: { entries: [{ key: 'coffee', value: 3 }, { key: 'tea', value: 2 }] },
                tags: ['hot', 'iced'],
                offer: { key: 'tea', value: 1 },
            });
            expect(evaluate('Shop.prices["coffee"]')).toBe(3);
        });

        it('fails a member whose map holds values its declaration refuses, and gives an implementation a dictionary it reads', () => {
            expect(errorThrownBy(() => evaluate('Shop.wrong.count'))).toMatchObject({ code: 'LEXICA5006', message: expect.stringContaining('Dictionary<String, Number>') });
            expect(evaluate('Shop.priceOf(prices, "coffee")', { prices: new Map([['coffee', 3]]) })).toBe(3);
        });

        it('captures a host call\'s supplied map as the dictionary its call declares, and refuses one its keys don\'t fit', () => {
            const feed = lexica.createModule('Feed', { members: [createFunctionDeclaration('latest', 'Dictionary<String, Number>', { invokedBy: 'host' })] });
            const prepared = lexica.createRegistry([feed]).resolve('Feed.latest()', {}, { imports: ['Feed'] }).createEvaluator({}).prepareHostCall();

            expect(prepared.project(new Map([['tea', 2]])).value).toEqual({ entries: [{ key: 'tea', value: 2 }] });
            expect(errorThrownBy(() => prepared.project(new Map([[1, 2]])))).toMatchObject({ code: 'LEXICA5015' });
        });

        it('refuses a declaration naming a dictionary whose keys are of no key type', () => {
            const refused = errorThrownBy(() => lexica.createRegistry([lexica.createModule('Bad', { members: [createPropertyDeclaration('table', 'Dictionary<List<Number>, String>', { updates: constantUpdates, impl: () => new Map() })] })]));

            expect(refused).toMatchObject({ code: 'LEXICA4563', kind: 'module', message: expect.stringContaining('List<Number>') });
        });
    });
});
