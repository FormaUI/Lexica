import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';

const { createFunctionDeclaration } = lexica.declarations;

/** What the text evaluates to and the type it resolves to, against Lexica's own vocabulary alone. */
const evaluated = (text, values = {}) => {
    const resolution = lexica.createRegistry([]).resolve(text, values);

    return { type: resolution.type, value: resolution.createEvaluator(values).evaluate().value };
};

/** The error resolving the text throws, against Lexica's own vocabulary alone. */
const refusalOf = (text, values = {}) => errorThrownBy(() => lexica.createRegistry([]).resolve(text, values));

describe('collection expressions', () => {
    describe('in text and definitions', () => {
        it('reads a list and a dictionary by their written form, an empty one of each among them, into the nodes of definition version 35', () => {
            expect(lexica.parse('[10, 20, 30]')).toEqual({ version: 35, imports: [], expression: { kind: 'list', items: [{ kind: 'literal', value: 10 }, { kind: 'literal', value: 20 }, { kind: 'literal', value: 30 }] } });
            expect(lexica.parse(`["coffee" = 3, 'tea' = 2,]`).expression).toEqual({ kind: 'dictionary', entries: [{ key: 'coffee', value: { kind: 'literal', value: 3 } }, { key: 'tea', value: { kind: 'literal', value: 2 } }] });
            expect(lexica.parse('[]').expression).toEqual({ kind: 'list', items: [] });
            expect(lexica.parse('[=]').expression).toEqual({ kind: 'dictionary', entries: [] });
            expect(lexica.parse('["first\\nsecond" = 1]').expression.entries[0].key).toBe('first\nsecond');
        });

        it('reads a string an extension access follows as a list\'s item, never a dictionary\'s key', () => {
            expect(lexica.parse('["coffee":Lookup.value]').expression).toEqual({
                kind: 'list',
                items: [{ kind: 'memberAccess', receiver: { kind: 'literal', value: 'coffee' }, name: 'value', extension: { name: 'Lookup' } }],
            });
        });

        it('refuses a key that is no inline string literal at the key, giving the literal key for a name and toDictionary for a computed key', () => {
            const named = errorThrownBy(() => lexica.parse('[name = 1]'));

            expect(named).toMatchObject({ code: 'LEXICA1066', kind: 'syntax', location: { offset: 1, line: 1, column: 2 } });
            expect(named.message).toContain('A dictionary key must be an inline string literal. Write ["name" = 1] for the literal key "name". For a computed key, construct the dictionary with toDictionary.');
            expect(errorThrownBy(() => lexica.parse('[$"co{x}" = 1]'))).toMatchObject({ code: 'LEXICA1066', location: { column: 2 } });
            expect(errorThrownBy(() => lexica.parse('[3 = 1]'))).toMatchObject({ code: 'LEXICA1066', message: expect.stringContaining('Write it between quotes, as ["coffee" = 3]') });
            expect(errorThrownBy(() => lexica.parse('["""\n    coffee\n    """ = 1]'))).toMatchObject({ code: 'LEXICA1066', location: { column: 2 } });
        });

        it('refuses keyed and unkeyed entries mixed, and an item left out between commas, each at its place', () => {
            expect(errorThrownBy(() => lexica.parse('[1, "a" = 2]'))).toMatchObject({ code: 'LEXICA1067', location: { column: 5 }, message: expect.stringContaining("this one, a list, holds an entry of a key and a value") });
            expect(errorThrownBy(() => lexica.parse('["a" = 1, 2]'))).toMatchObject({ code: 'LEXICA1067', location: { column: 11 }, message: expect.stringContaining('this one, a dictionary, holds an item without a key') });
            expect(errorThrownBy(() => lexica.parse('[1, , 2]'))).toMatchObject({ code: 'LEXICA1068', location: { column: 5 } });
            expect(errorThrownBy(() => lexica.parse('[, 1]'))).toMatchObject({ code: 'LEXICA1068', location: { column: 2 } });
        });

        it('refuses two entries of one key, compared once their escapes are read, at the later entry when the definition is validated', () => {
            const duplicate = errorThrownBy(() => lexica.parse('["a" = 1, "\\u{61}" = 2]'));

            expect(duplicate).toMatchObject({ code: 'LEXICA2043', kind: 'structure', location: { pointer: '/expression/entries/1', line: 1, column: 11 } });
            expect(duplicate.message).toContain('"a" is the key of an entry before this one');
            expect(errorThrownBy(() => lexica.validate({ version: 35, imports: [], expression: { kind: 'dictionary', entries: [{ key: 'a', value: { kind: 'literal', value: 1 } }, { key: 'a', value: { kind: 'literal', value: 2 } }] } }))).toMatchObject({ code: 'LEXICA2043', location: { pointer: '/expression/entries/1' } });
        });

        it('holds simple expressions alone, refusing a do block and an arrow function as an item, and validates a definition\'s key as a string', () => {
            expect(errorThrownBy(() => lexica.parse('[do 1 end]'))).toMatchObject({ code: 'LEXICA2011', message: expect.stringContaining("A list's item is a simple expression") });
            expect(errorThrownBy(() => lexica.parse('["a" = do 1 end]'))).toMatchObject({ code: 'LEXICA2011', message: expect.stringContaining("A dictionary's value is a simple expression") });
            expect(errorThrownBy(() => lexica.parse('[x => 1]'))).toMatchObject({ code: 'LEXICA2027', location: { pointer: '/expression/items/0' } });
            expect(errorThrownBy(() => lexica.validate({ version: 35, imports: [], expression: { kind: 'dictionary', entries: [{ key: 1, value: { kind: 'literal', value: 1 } }] } }))).toMatchObject({ code: 'LEXICA2000', location: { pointer: '/expression/entries/0/key' } });
        });

        it('refuses a definition of version 34, which holds no collection expression, naming both versions', () => {
            expect(errorThrownBy(() => lexica.validate({ version: 34, imports: [], expression: { kind: 'literal', value: 1 } }))).toMatchObject({ code: 'LEXICA2007', message: expect.stringContaining('this one is of version 34'), location: { pointer: '/version' } });
        });
    });

    describe('in their lines', () => {
        it('breaks after a bracket, after a comma and before the closing bracket, and keeps a key with its =, its value free to start the next line', () => {
            expect(lexica.parse('[\n    1,\n    2\n]')).toEqual(lexica.parse('[1, 2]'));
            expect(lexica.parse('[\n    "coffee" =\n        3\n]')).toEqual(lexica.parse('["coffee" = 3]'));
            expect(errorThrownBy(() => lexica.parse('["coffee"\n= 3]'))).toMatchObject({ code: 'LEXICA1041', location: { line: 2, column: 1 } });
            expect(errorThrownBy(() => lexica.parse('[1\n, 2]'))).toMatchObject({ code: 'LEXICA1041', location: { line: 2, column: 1 } });
            expect(errorThrownBy(() => lexica.parse('[=\n]'))).toMatchObject({ code: 'LEXICA1041' });
        });

        it('encloses neither an item nor a value, so a line breaks before an operator there only inside parentheses of its own', () => {
            expect(errorThrownBy(() => lexica.parse('[1\n    + 2]'))).toMatchObject({ code: 'LEXICA1042', location: { line: 2 } });
            expect(errorThrownBy(() => lexica.parse('["a" = 1\n    + 2]'))).toMatchObject({ code: 'LEXICA1042', location: { line: 2 } });
            expect(lexica.parse('[(1\n    + 2)]')).toEqual(lexica.parse('[1 + 2]'));
        });
    });

    describe('in canonical text', () => {
        it("writes an empty dictionary as [=], one entry on one line, and any other a line for each entry without a trailing comma, a list's items on one line", () => {
            expect(lexica.format('[ = ]')).toBe('[=]');
            expect(lexica.format('["coffee"=3]')).toBe('["coffee" = 3]');
            expect(lexica.format(`['coffee' = 3, "tea" = 2,]`)).toBe('[\n    "coffee" = 3,\n    "tea" = 2\n]');
            expect(lexica.format('[10,20,30,]')).toBe('[10, 20, 30]');
            expect(lexica.quote(`["coffee" = 3, "tea" = 2]`)).toBe('["coffee" = 3, "tea" = 2]');
            expect(lexica.format('{ stock = ["coffee" = 3, "tea" = 2] }')).toBe('{\n    stock = [\n        "coffee" = 3,\n        "tea" = 2\n    ]\n}');
            expect(lexica.format('["first\\nsecond" = 1]')).toBe('["first\\nsecond" = 1]');
        });
    });

    describe('resolved and evaluated', () => {
        it('types a list by the type its items merge to and a dictionary by its values\', each empty one of Never', () => {
            expect(evaluated('[10, 20, 30]')).toEqual({ type: 'List<Number>', value: [10, 20, 30] });
            expect(evaluated('["coffee" = 3, "tea" = 2]')).toEqual({ type: 'Dictionary<String, Number>', value: { entries: [{ key: 'coffee', value: 3 }, { key: 'tea', value: 2 }] } });
            expect(evaluated('[]')).toEqual({ type: 'List<Never>', value: [] });
            expect(evaluated('[=]')).toEqual({ type: 'Dictionary<String, Never>', value: { entries: [] } });
            expect(evaluated('[1, 2, null]')).toEqual({ type: 'List<Number?>', value: [1, 2, null] });
            expect(evaluated('[null, null]')).toEqual({ type: 'List<null>', value: [null, null] });
            expect(evaluated('[[1], [2, 3]]')).toEqual({ type: 'List<List<Number>>', value: [[1], [2, 3]] });
        });

        it('keeps a list of pairs a list, never a dictionary', () => {
            expect(evaluated('let stock = ["coffee" = 3]\nreturn [stock.entries[0]]').type).toBe('List<Pair<String, Number>?>');
        });

        it('refuses items or values of no common type, never widening them to Any, and a function as an item', () => {
            expect(refusalOf('[1, "two"]')).toMatchObject({ code: 'LEXICA3081', kind: 'validation', location: { pointer: '/expression' }, message: expect.stringContaining("A list's items share no type: Number, String") });
            expect(refusalOf('["a" = 1, "b" = true]')).toMatchObject({ code: 'LEXICA3081', message: expect.stringContaining("A dictionary's values share no type: Number, Boolean") });
            expect(refusalOf('let f = x => x\nreturn [f]')).toMatchObject({ code: 'LEXICA3082', location: { pointer: '/expression/result/items/0' } });
        });

        it('reads a dictionary it wrote by key and a list by position, as any of its kind is read', () => {
            expect(evaluated('["coffee" = 3, "tea" = 2]["tea"]')).toEqual({ type: 'Number?', value: 2 });
            expect(evaluated('[10, 20, 30][1]')).toEqual({ type: 'Number?', value: 20 });
            expect(evaluated('["2" = "two"].containsKey("2")').value).toBe(true);
        });

        it('evaluates each item once, left to right, and a dictionary keeps its entries in the order written', () => {
            let count = 0;
            const clock = lexica.createModule('Clock', { members: [createFunctionDeclaration('next', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, impl: () => ++count })] });
            const registry = lexica.createRegistry([clock]);
            const evaluate = text => registry.resolve(text, {}, { imports: ['Clock'] }).createEvaluator({}).evaluate().value;

            expect(evaluate('[Clock.next(), Clock.next(), Clock.next()]')).toEqual([1, 2, 3]);
            expect(evaluate('["z" = Clock.next(), "a" = Clock.next()]')).toEqual({ entries: [{ key: 'z', value: 4 }, { key: 'a', value: 5 }] });
        });
    });
});
