import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { dataPropertyDeclarations } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration } = nexo.declarations;

/** The people whose weight was read, in order, so a test sees how often an ordering evaluated a key. */
let weighed = [];

/** A team of structured people, each with a weight a module computes and counts, whose list a member answers, so the evaluation copies it as it copies any structure. */
const createTeam = () => nexo.createModule('Team', {
    types: [{ name: 'Person', kind: 'structured', members: [...dataPropertyDeclarations({ name: 'String', age: 'Number?' }), createPropertyDeclaration('weight', 'Number', { updates: constantUpdates, impl: ({ receiver }) => (weighed.push(receiver.name), receiver.age ?? 0) })] }],
    members: [
        createFunctionDeclaration('members', 'List<Person>', { updates: constantUpdates, impl: () => [{ name: 'bo', age: 30 }, { name: 'al', age: null }, { name: 'cy', age: 30 }, { name: 'al', age: 20 }] }),
        createFunctionDeclaration('mixed', 'List<Any>', { updates: constantUpdates, impl: () => [1, 'one'] }),
    ],
});

const people = [{ name: 'b', age: 30 }, { name: 'a', age: null }, { name: 'c', age: 30 }, { name: 'a', age: 20 }];

/** What the text evaluates to against a registry of the team, the team imported, with the values given. */
const evaluate = (text, values = { people }) => nexo.createRegistry([createTeam()]).resolve(text, values, { imports: ['Team'] }).createEvaluator(values).evaluate().value;

/** The error evaluating the text throws. */
const failure = (text, values = { people }) => errorThrownBy(() => evaluate(text, values));

describe('ordering a list', () => {
    it('orders by a key ascending or descending, stable, a null key last in either direction', () => {
        expect(evaluate('people.orderBy(it.age).select(it.name)')).toEqual(['a', 'b', 'c', 'a']);
        expect(evaluate('people.orderByDescending(it.age).select(it.name)')).toEqual(['b', 'c', 'a', 'a']);
        expect(evaluate('people.orderBy(it.age).select(it.age)')).toEqual([20, 30, 30, null]);
        expect(evaluate('people.orderByDescending(it.age).select(it.age)')).toEqual([30, 30, 20, null]);
        expect(evaluate('xs.orderBy(it)', { xs: [] })).toEqual([]);
    });

    it('orders numbers numerically, -0 with 0, strings by code unit without a locale, and Booleans false before true', () => {
        expect(evaluate('xs.orderBy(it)', { xs: [10, 9, -1, 0, -0, 2.5] })).toEqual([-1, 0, -0, 2.5, 9, 10]);
        expect(evaluate('xs.orderBy(it)', { xs: ['b', 'B', 'a', 'é', 'Z', 'ab'] })).toEqual(['B', 'Z', 'a', 'ab', 'b', 'é']);
        expect(evaluate('xs.orderByDescending(it)', { xs: [true, false, true] })).toEqual([true, true, false]);
        expect(evaluate('xs.orderBy(it)', { xs: [true, null, false] })).toEqual([false, true, null]);
    });

    it("refines an ordering's ties with thenBy, never sorting again, through a local and another thenBy", () => {
        expect(evaluate('people.orderBy(it.age).thenBy(it.name).select(it.name)')).toEqual(['a', 'b', 'c', 'a']);
        expect(evaluate('let sorted = people.orderByDescending(it.age)\nreturn sorted.thenByDescending(it.name).select(it.name)')).toEqual(['c', 'b', 'a', 'a']);
        expect(evaluate('xs.orderBy(it.size).thenBy(it.name).thenByDescending(it.rank).select(it.rank)', { xs: [{ size: 1, name: 'a', rank: 1 }, { size: 0, name: 'b', rank: 2 }, { size: 1, name: 'a', rank: 3 }, { size: 1, name: 'b', rank: 4 }] })).toEqual([2, 3, 1, 4]);
        // A refinement leaves each run where the ordering put it, even where its own key would order the runs otherwise.
        expect(evaluate('xs.orderBy(it.size).thenByDescending(it.name).select(it.name)', { xs: [{ size: 2, name: 'a' }, { size: 1, name: 'b' }, { size: 1, name: 'c' }] })).toEqual(['c', 'b', 'a']);
    });

    it("keeps a structured list's ordering through the copy an evaluation makes of it, evaluating each key once for each item and criterion", () => {
        weighed = [];

        expect(evaluate('Team.members().orderBy(it.weight).thenBy(it.name).select(it.name)')).toEqual(['al', 'al', 'bo', 'cy']);
        expect(weighed).toEqual(['bo', 'al', 'cy', 'al']);

        weighed = [];

        expect(evaluate('Team.members().orderBy(it.weight).thenByDescending(it.weight).select(it.name)')).toEqual(['al', 'al', 'bo', 'cy']);
        expect(weighed).toEqual(['bo', 'al', 'cy', 'al', 'al', 'al', 'bo', 'cy']);
    });

    it('orders nulls first by whether a key is null, a null item first by a function alone, since a body never reads a null item', () => {
        expect(evaluate('people.orderBy(it.age != null).thenBy(it.age).select(it.age)')).toEqual([null, 20, 30, 30]);
        expect(evaluate('xs.orderBy(it != null).thenBy(it)', { xs: [2, null, 1] })).toEqual([1, 2, null]);
        expect(evaluate('xs.orderBy(item => item != null).thenBy(it)', { xs: [2, null, 1] })).toEqual([null, 1, 2]);
    });

    it('keeps the ordering of a list of collections through the capture that replaces the list an ordering answers', () => {
        expect(evaluate('xs.orderBy(it.count).thenBy(it.first)', { xs: [[2], [1, 1], [1]] })).toEqual([[1], [2], [1, 1]]);
        expect(evaluate('let sorted = xs.orderByDescending(it.count)\nreturn sorted.thenBy(it.first)', { xs: [[2], [1, 1], [1]] })).toEqual([[1, 1], [1], [2]]);
    });

    it('takes the least or the greatest item by a key of any ordering domain, the first of equal keys, null keys skipped', () => {
        expect(evaluate('people.minBy(it.age)?.name')).toBe('a');
        expect(evaluate('people.maxBy(it.age)?.name')).toBe('b');
        expect(evaluate('people.minBy(it.name)?.age')).toBeNull();
        expect(evaluate('people.maxBy(it.name)?.name')).toBe('c');
        expect(evaluate('xs.maxBy(it)', { xs: [false, true, null] })).toBe(true);
        expect(evaluate('xs.minBy(it)', { xs: [null, null] })).toBeNull();
    });

    it('refuses a key of no ordering domain, and keys of two, at the call (NEXO5036)', () => {
        expect(failure('xs.orderBy(it)', { xs: [[1], [2]] })).toMatchObject({ code: 'NEXO5036', location: { pointer: '/expression' }, message: expect.stringContaining("'orderBy' orders by numbers, strings or Booleans, and a key is a list") });
        expect(failure('xs.orderBy(it.key)', { xs: [{ key: { a: 1 } }] })).toMatchObject({ code: 'NEXO5036', message: expect.stringContaining('an object or a reference') });
        expect(failure('xs.minBy(it)', { xs: [[1]] })).toMatchObject({ code: 'NEXO5036', message: expect.stringContaining("'minBy'") });
        expect(failure('Team.mixed().orderBy(it)')).toMatchObject({ code: 'NEXO5036', message: expect.stringContaining("'orderBy' orders by keys of one domain, and its keys are numbers and strings") });
    });

    it('refuses thenBy of a list no orderBy ordered, a filtered ordering among them (NEXO5037)', () => {
        expect(failure('people.thenBy(it.name)')).toMatchObject({ code: 'NEXO5037', location: { pointer: '/expression' }, message: expect.stringContaining("'thenBy' refines the order 'orderBy' gave a list") });
        expect(failure('people.orderBy(it.age).where(true).thenByDescending(it.name)')).toMatchObject({ code: 'NEXO5037', message: expect.stringContaining("'thenByDescending'") });
    });

    it("leaves string ordering to the collection's members: an ordering between strings in an expression is still refused", () => {
        expect(errorThrownBy(() => nexo.createRegistry([]).resolve('"a" < "b"', {}))).toMatchObject({ code: 'NEXO3078' });
    });
});
