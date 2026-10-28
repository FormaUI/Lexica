import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Device, Light, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { extensionDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration } = lexica.declarations;

const lamp = new Light('lamp');
const fan = new Device('fan');

/** The numbers a counted member was read on, in order, so a test sees how often and how far an expression was evaluated. */
let seen = [];

/** A probe of the home: each number's `seen`, which records the number and answers it, so an expression reading it is counted. */
const createProbe = () => lexica.createModule('Probe', withHome({ types: [extensionDeclaration('Numbers', 'Number', [createPropertyDeclaration('seen', 'Number', { updates: constantUpdates, impl: ({ receiver }) => (seen.push(receiver), receiver) })])] }));

const values = {
    xs: [3, 1, 2],
    gaps: [1, null, 2],
    none: [],
    words: ['tea', 'coffee', 'tea'],
    nested: [[1, 2], [], [3]],
    lights: [lamp],
    devices: [fan, lamp],
    people: [{ name: 'ann', team: 'a' }, { name: 'bob', team: 'b' }, { name: 'cy', team: 'a' }],
    prices: new Map([['tea', 2], ['coffee', 3], ['milk', null]]),
};

/** What the text evaluates to, its value and its type, against Lexica's own vocabulary and the probe. */
const evaluate = text => {
    seen = [];

    const resolution = lexica.createRegistry([createProbe()]).resolve(text, values, { imports: ['Probe'] });

    return { value: resolution.createEvaluator(values).evaluate().value, type: resolution.type };
};

const valueOf = text => evaluate(text).value;

/** The error resolving or evaluating the text throws. */
const failureOf = text => errorThrownBy(() => evaluate(text));

describe('the members of collections', () => {
    describe('select', () => {
        it('evaluates its expression for every item, null among them, its it of the item type, so select(it) keeps the list and select(it ?? 0) replaces its nulls', () => {
            expect(evaluate('gaps.select(it)')).toEqual({ value: [1, null, 2], type: 'List<Number?>' });
            expect(evaluate('gaps.select(it ?? 0)')).toEqual({ value: [1, 0, 2], type: 'List<Number>' });
            expect(evaluate('people.select(it.name)')).toEqual({ value: ['ann', 'bob', 'cy'], type: 'List<String>' });
            expect(valueOf('xs.select(it * 2)')).toEqual([6, 2, 4]);
        });

        it('differs from an object projection, which keeps a null item null and evaluates no field for it', () => {
            expect(evaluate('gaps { n = it.seen }')).toEqual({ value: [{ n: 1 }, null, { n: 2 }], type: 'List<{ n: Number }?>' });
            expect(seen).toEqual([1, 2]);
        });
    });

    describe('partitions and joins', () => {
        it('takes and drops by an index less than the count, whatever the count, and while a predicate holds, evaluating it against nothing after the first it fails', () => {
            expect([valueOf('xs.take(2)'), valueOf('xs.drop(2)'), valueOf('xs.take(10)'), valueOf('xs.take(-1)'), valueOf('xs.drop(0)')]).toEqual([[3, 1], [2], [3, 1, 2], [], [3, 1, 2]]);
            expect(valueOf('xs.takeWhile(it.seen > 2)')).toEqual([3]);
            expect(seen).toEqual([3, 1]);
            expect(valueOf('xs.dropWhile(it.seen > 2)')).toEqual([1, 2]);
            expect(seen).toEqual([3, 1]);
        });

        it('joins lists: concat keeps the receiver\'s item type, flatten a list of lists, and selectMany each item\'s list, refusing a null one', () => {
            expect(valueOf('xs.concat(none)')).toEqual([3, 1, 2]);
            expect(evaluate('nested.flatten')).toEqual({ value: [1, 2, 3], type: 'List<Number>' });
            expect(evaluate('nested.selectMany(it)')).toEqual({ value: [1, 2, 3], type: 'List<Number>' });
            expect(failureOf('lights.concat(devices)')).toMatchObject({ code: 'LEXICA3042', location: { pointer: '/expression/arguments/0' } });
            expect(failureOf('gaps.selectMany(xs)')).toMatchObject({ code: 'LEXICA5031', location: { pointer: '/expression' } });
        });

        it('reverses and keeps each item\'s first occurrence, by value and by key', () => {
            expect(valueOf('xs.reverse')).toEqual([2, 1, 3]);
            expect(valueOf('words.distinct')).toEqual(['tea', 'coffee']);
            expect(valueOf('people.distinctBy(it.team).select(it.name)')).toEqual(['ann', 'bob']);
        });

        it("evaluates a filter's predicate and a key once for each item, in order", () => {
            expect(valueOf('xs.where(it.seen > 1)')).toEqual([3, 2]);
            expect(seen).toEqual([3, 1, 2]);
            expect(valueOf('xs.distinctBy(it.seen)')).toEqual([3, 1, 2]);
            expect(seen).toEqual([3, 1, 2]);
        });
    });

    describe('tests and aggregates', () => {
        it('answers any and all over no items as false and true, stopping at the first decisive item, a null item falsy to a body', () => {
            expect([valueOf('none.any(it > 0)'), valueOf('none.all(it > 0)')]).toEqual([false, true]);
            expect(valueOf('xs.any(it.seen == 1)')).toBe(true);
            expect(seen).toEqual([3, 1]);
            expect(valueOf('xs.all(it.seen > 2)')).toBe(false);
            expect(seen).toEqual([3, 1]);
            expect(valueOf('gaps.all(it > 0)')).toBe(false);
        });

        it('finds an item by key equality, a null item among them, stopping at the first equal', () => {
            expect([valueOf('xs.contains(1)'), valueOf('xs.contains(5)'), valueOf('gaps.contains(null)'), valueOf('devices.contains(lights.first)')]).toEqual([true, false, true, true]);
        });

        it('answers the one item, null for none, and refuses a list of several', () => {
            expect([valueOf('lights.single == lights.first'), valueOf('none.single == null')]).toEqual([true, true]);
            expect(failureOf('xs.single')).toMatchObject({ code: 'LEXICA5030', location: { pointer: '/expression' }, message: expect.stringContaining('holds 3') });
        });

        it('averages, and finds the first item of the least and the greatest number, skipping null numbers and answering null for none', () => {
            expect([valueOf('xs.average(it)'), valueOf('none.average(it)'), valueOf('gaps.average(it)')]).toEqual([2, null, 1.5]);
            expect([valueOf('xs.minBy(it)'), valueOf('xs.maxBy(it)'), valueOf('none.minBy(it)')]).toEqual([1, 3, null]);
            expect(valueOf('people.maxBy(if it.team == "b" then 1 else 0 end)?.name')).toBe('bob');
        });
    });

    describe('construction and grouping', () => {
        it('builds a dictionary of the items by their keys in their order, refusing two items of one key, which grouping collects', () => {
            expect(evaluate('people.toDictionary(it.name)["bob"]?.team')).toEqual({ value: 'b', type: 'String?' });
            expect(valueOf('people.toDictionary(it.name).keys')).toEqual(['ann', 'bob', 'cy']);
            expect(failureOf('people.toDictionary(it.team)')).toMatchObject({ code: 'LEXICA5029', location: { pointer: '/expression' }, message: expect.stringContaining('the key "a"') });
            expect(evaluate('people.groupBy(it.team)')).toMatchObject({ type: 'Dictionary<String, List<{ name: String, team: String }>>' });
            expect(valueOf('people.groupBy(it.team).entries.select(it.value.count)')).toEqual([2, 1]);
            expect(valueOf('people.groupBy(it.team).keys')).toEqual(['a', 'b']);
        });

        it('refuses a key of no key type where the call is resolved', () => {
            expect(failureOf('people.toDictionary({ n = it.name })')).toMatchObject({ code: 'LEXICA3083', location: { pointer: '/expression' } });
        });
    });

    describe('of a dictionary', () => {
        it('filters and projects its values, each entry keeping its key and its place, its it the value, an operation needing the key reading the entries', () => {
            expect(valueOf('prices.where(it > 2).keys')).toEqual(['coffee']);
            expect(evaluate('prices.select(it ?? 0).values')).toEqual({ value: [2, 3, 0], type: 'List<Number>' });
            expect(valueOf('prices.select(it ?? 0).keys')).toEqual(['tea', 'coffee', 'milk']);
            expect(valueOf('prices.entries.where(it.key != "tea").select(it.key)')).toEqual(['coffee', 'milk']);
        });
    });
});
