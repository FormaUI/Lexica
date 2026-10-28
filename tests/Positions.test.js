import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';

const { createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = lexica.declarations;

/** A grid of cells, a reference its module recognizes, which an index or a range reads. */
class Grid {
    cells = ['a', 'b', 'c'];
}

/** An indexer of the grid taking a key of the type given, answering what its implementation answers. */
const indexerOf = (name, keyType, result, impl) => createIndexerDeclaration(name, result, { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', keyType)], impl });

/** A module of grids, declaring the indexers given within its type, and a member answering a value of Any. */
const createSheets = indexers => lexica.createModule('Sheets', {
    typeOf: value => (value instanceof Grid ? 'Grid' : null),
    types: [{ name: 'Grid', kind: 'reference', isInstance: value => value instanceof Grid, members: indexers }],
    members: [createFunctionDeclaration('held', 'Any', { updates: constantUpdates, impl: () => [10, 20, 30] })],
});

const values = { xs: [10, 20, 30, 40, 50], n: 2, maybe: null, word: 'oat' };

/** The resolution of the text against Lexica's own vocabulary and the values. */
const resolve = (text, bound = values) => lexica.createRegistry([]).resolve(text, bound);

/** What the text evaluates to. */
const evaluate = (text, bound = values) => resolve(text, bound).createEvaluator(bound).evaluate().value;

describe('positions', () => {
    describe('in text and definitions', () => {
        it('reads an index from the end and a range of each form, a boundary left out absent from its node', () => {
            const literal = value => ({ kind: 'literal', value });
            const fromEnd = value => ({ kind: 'fromEndIndex', offset: literal(value) });
            const argumentOf = text => lexica.parse(text).expression.argument;

            expect(argumentOf('xs[^1]')).toEqual(fromEnd(1));
            expect(argumentOf('xs[1..4]')).toEqual({ kind: 'range', start: literal(1), end: literal(4) });
            expect(argumentOf('xs[..4]')).toEqual({ kind: 'range', end: literal(4) });
            expect(argumentOf('xs[4..]')).toEqual({ kind: 'range', start: literal(4) });
            expect(argumentOf('xs[^3..]')).toEqual({ kind: 'range', start: fromEnd(3) });
            expect(argumentOf('xs[..^1]')).toEqual({ kind: 'range', end: fromEnd(1) });
            expect(argumentOf('xs[..]')).toEqual({ kind: 'range' });
            expect(lexica.parse('let middle = 1..^1\nreturn xs[middle]').expression.locals[0].value).toEqual({ kind: 'range', start: literal(1), end: fromEnd(1) });
        });

        it('validates a definition\'s index and range, a range holding a start, an end, both or neither and an index its offset', () => {
            const literal = value => ({ kind: 'literal', value });
            const validating = expression => () => lexica.validate({ version: 35, imports: [], expression });

            expect(validating({ kind: 'range' })().expression).toEqual({ kind: 'range' });
            expect(errorThrownBy(validating({ kind: 'range', start: literal(1), step: literal(2) }))).toMatchObject({ code: 'LEXICA2000', location: { pointer: '/expression' }, message: expect.stringContaining("'step' is no property") });
            expect(errorThrownBy(validating({ kind: 'fromEndIndex' }))).toMatchObject({ code: 'LEXICA2000', message: expect.stringContaining("requires 'offset'") });
        });

        it('refuses an ungrouped operator expression as a boundary and a range as a range\'s, and a line break within either', () => {
            expect(errorThrownBy(() => lexica.parse('xs[n + 1..4]'))).toMatchObject({ code: 'LEXICA1069', location: { column: 4 }, message: expect.stringContaining("write '(n + 1)..'") });
            expect(errorThrownBy(() => lexica.parse('xs[1..n + 1]'))).toMatchObject({ code: 'LEXICA1069', location: { column: 7 } });
            expect(errorThrownBy(() => lexica.parse('1..2..3'))).toMatchObject({ code: 'LEXICA1070', location: { column: 5 } });
            expect(errorThrownBy(() => lexica.parse('^-1'))).toMatchObject({ code: 'LEXICA1000' });

            for (const lineBreak of ['\n', '\r\n']) {
                expect(errorThrownBy(() => lexica.parse(`xs[1${lineBreak}..4]`))).toMatchObject({ code: 'LEXICA1041', message: expect.stringContaining("A range, its boundaries and its '..' stand on one line: write '1..'") });
                expect(errorThrownBy(() => lexica.parse(`xs[^${lineBreak}1]`))).toMatchObject({ code: 'LEXICA1041', message: expect.stringContaining("write '^1'") });
            }
        });

        it('writes them as canonical text, each without spaces, grouping an operator expression and a negative offset, which reads back as the same definition', () => {
            for (const [text, canonical] of [['xs[ 1 .. 4 ]', 'xs[1..4]'], ['xs[ .. ]', 'xs[..]'], ['xs[..^ 1]', 'xs[..^1]'], ['xs[(n + 1)..(n * 2)]', 'xs[(n + 1)..(n * 2)]'], ['xs[^(n + 1)]', 'xs[^(n + 1)]'], ['xs[^(-1)]', 'xs[^(-1)]'], ['let m = (1..2)\nreturn m', 'let m = 1..2\nreturn m']]) {
                expect(lexica.format(text)).toBe(canonical);
                expect(lexica.quote(text)).toBe(canonical);
                expect(lexica.parse(canonical)).toEqual(lexica.parse(text));
            }
        });
    });

    describe('typed and evaluated', () => {
        it('types an index as Index and a range as Range, values a script reuses on any list and no result holds', () => {
            expect(resolve('xs[^1]').type).toBe('Number?');
            expect(resolve('xs[1..4]').type).toBe('List<Number>');
            expect(evaluate('let middle = 1..^1\nreturn { a = xs[middle], b = [1, 2, 3][middle] }')).toEqual({ a: [20, 30, 40], b: [2] });
            expect(errorThrownBy(() => resolve('1..2'))).toMatchObject({ code: 'LEXICA3043', message: expect.stringContaining('Range, which is no data') });
            expect(errorThrownBy(() => resolve('{ last = ^1 }'))).toMatchObject({ code: 'LEXICA3043' });
        });

        it('refuses an offset that is no number and a boundary that is neither a number nor an index, a nullable one among them', () => {
            expect(errorThrownBy(() => resolve('xs[^word]'))).toMatchObject({ code: 'LEXICA3085', location: { pointer: '/expression/argument/offset' }, message: expect.stringContaining("An index's offset is a number, and this one is String") });
            expect(errorThrownBy(() => resolve('xs[word..]'))).toMatchObject({ code: 'LEXICA3085', location: { pointer: '/expression/argument/start' }, message: expect.stringContaining('a number or an index') });
            expect(errorThrownBy(() => resolve('xs[..xs.first]'))).toMatchObject({ code: 'LEXICA3085', location: { pointer: '/expression/argument/end' }, message: expect.stringContaining('can be null') });
            expect(errorThrownBy(() => resolve('xs[(1..2)..]'))).toMatchObject({ code: 'LEXICA3085', message: expect.stringContaining('this one is Range') });
        });

        it('looks a number and an index up tolerantly, null where the list has no item, and slices a range strictly, against one length', () => {
            expect([evaluate('xs[^1]'), evaluate('xs[^5]'), evaluate('xs[^0]'), evaluate('xs[^6]'), evaluate('xs[7]'), evaluate('xs[1.5]')]).toEqual([50, 10, null, null, null, null]);
            expect([evaluate('xs[1..4]'), evaluate('xs[..2]'), evaluate('xs[3..]'), evaluate('xs[^2..]'), evaluate('xs[..^1]'), evaluate('xs[..]'), evaluate('xs[0..5]')]).toEqual([[20, 30, 40], [10, 20], [40, 50], [40, 50], [10, 20, 30, 40], [10, 20, 30, 40, 50], [10, 20, 30, 40, 50]]);
            expect([evaluate('xs[2..2]'), evaluate('xs[5..]'), evaluate('xs[..^5]')]).toEqual([[], [], []]);

            for (const text of ['xs[3..1]', 'xs[1..6]', 'xs[^6..]', 'xs[..^6]']) {
                expect(errorThrownBy(() => evaluate(text)), text).toMatchObject({ code: 'LEXICA5033', location: { pointer: '/expression' } });
            }

            expect(errorThrownBy(() => evaluate('xs[3..1]')).message).toContain('The range 3..1 is applied to a list of 5 items, and gives 3..1, which starts after it ends');
            expect(evaluate('{ head = xs.take(9), tail = xs.drop(9) }')).toEqual({ head: [10, 20, 30, 40, 50], tail: [] });
        });

        it('refuses an offset or a boundary that is no nonnegative whole number when it is evaluated, never rounding one', () => {
            expect(errorThrownBy(() => evaluate('xs[^1.5]'))).toMatchObject({ code: 'LEXICA5032', location: { pointer: '/expression/argument' }, message: expect.stringContaining("An index's offset is a nonnegative whole number, and this one is 1.5") });
            expect(errorThrownBy(() => evaluate('xs[-1..2]'))).toMatchObject({ code: 'LEXICA5032', location: { pointer: '/expression/argument' }, message: expect.stringContaining("A range's boundary is a nonnegative whole number or an index") });
            expect(errorThrownBy(() => evaluate('xs[^(n - 3)]'))).toMatchObject({ code: 'LEXICA5032' });
            expect(evaluate('xs[^(n - 2)..]')).toEqual([]);
        });

        it('gives the entry at an index from the end, its index from the start', () => {
            expect(evaluate('xs.entry[^2]')).toEqual({ key: 3, value: 40 });
            expect(evaluate('xs.entry[^6]')).toBeNull();
        });

        it('refuses a key no signature of the unnamed indexer takes, never falling through, and a range as a dictionary\'s key', () => {
            expect(errorThrownBy(() => resolve('xs[word]'))).toMatchObject({ code: 'LEXICA3084', location: { pointer: '/expression/argument' }, message: expect.stringContaining('The unnamed indexer of List<Number> takes Number, Index or Range, and is given String') });
            expect(errorThrownBy(() => resolve('pairs[1..2]', { pairs: new Map([['a', 1]]) }))).toMatchObject({ code: 'LEXICA3042' });
        });
    });

    describe('picking and sequences', () => {
        it('picks the item at each position in the positions\' order, a position twice giving its item twice, and refuses a position no item stands at', () => {
            expect(evaluate('xs.pick([4, 0, 4])')).toEqual([50, 10, 50]);
            expect(evaluate('xs.pick([])')).toEqual([]);

            for (const [text, position] of [['xs.pick([5])', 5], ['xs.pick([-1])', -1], ['xs.pick([1.5])', 1.5]]) {
                expect(errorThrownBy(() => evaluate(text))).toMatchObject({ code: 'LEXICA5034', location: { pointer: '/expression' }, message: expect.stringContaining(`'pick' is given the position ${position}`) });
            }
        });

        it('generates a number\'s sequence apart from any range, its step 1 where it is left out, and refuses a count that is no nonnegative whole number', () => {
            expect(evaluate('1.sequence(3)')).toEqual([1, 2, 3]);
            expect(evaluate('n.sequence(3, -2)')).toEqual([2, 0, -2]);
            expect(evaluate('n.sequence(0)')).toEqual([]);
            expect(resolve('n.sequence(2)').type).toBe('List<Number>');

            for (const count of ['-1', '1.5']) {
                expect(errorThrownBy(() => evaluate(`n.sequence(${count})`))).toMatchObject({ code: 'LEXICA5035', location: { pointer: '/expression' } });
            }
        });
    });

    describe('an indexer\'s signatures', () => {
        const unnamed = [
            indexerOf(null, 'Number', 'String?', ({ receiver, args }) => receiver.cells[args.key] ?? null),
            indexerOf(null, 'String', 'Number?', ({ receiver, args }) => receiver.cells.indexOf(args.key)),
        ];
        const evaluateOn = (indexers, text) => {
            const bound = { grid: new Grid(), cell: 'b' };

            return lexica.createRegistry([createSheets(indexers)]).resolve(text, bound, { imports: ['Sheets'] }).createEvaluator(bound).evaluate().value;
        };

        it('registers indexers of one name, or unnamed, within one type as signatures of disjoint key types, each selected by its key\'s type', () => {
            expect([evaluateOn(unnamed, 'grid[1]'), evaluateOn(unnamed, 'grid[cell]')]).toEqual(['b', 1]);
            expect(errorThrownBy(() => evaluateOn(unnamed, 'grid[true]'))).toMatchObject({ code: 'LEXICA3084', message: expect.stringContaining('The unnamed indexer of Grid takes Number or String, and is given Boolean') });

            const named = [
                indexerOf('cell', 'Number', 'String?', ({ receiver, args }) => receiver.cells[args.key] ?? null),
                indexerOf('cell', 'Range', 'List<String>', ({ receiver, args }) => {
                    const { start, end } = args.key.resolveIn(receiver.cells.length);

                    return receiver.cells.slice(start, end);
                }),
            ];

            expect([evaluateOn(named, 'grid.cell[0]'), evaluateOn(named, 'grid.cell[^2..]')]).toEqual(['a', ['b', 'c']]);
        });

        it('refuses two signatures whose key types overlap when they are registered, a nullable pair, a type and a supertype, and Any among them', () => {
            const registering = indexers => errorThrownBy(() => lexica.createRegistry([createSheets(indexers)]));

            expect(registering([indexerOf(null, 'Number', 'String?', () => null), indexerOf(null, 'Number?', 'String?', () => null)])).toMatchObject({ code: 'LEXICA4068', message: expect.stringContaining('taking a key of a type of its own') });
            expect(registering([indexerOf(null, 'Number', 'String?', () => null), indexerOf(null, 'Number', 'String?', () => null)])).toMatchObject({ code: 'LEXICA4068' });
            expect(registering([indexerOf('cell', 'String', 'String?', () => null), indexerOf('cell', 'Any', 'String?', () => null)])).toMatchObject({ code: 'LEXICA4029', message: expect.stringContaining("'cell' is declared already for Grid, and an indexer of its name is one of its signatures only within its type") });
        });

        it('selects the signature a value of Any\'s key is of as it is evaluated, and refuses a key of Any where several stand when it is resolved', () => {
            const bound = { grid: new Grid() };
            const registry = lexica.createRegistry([createSheets(unnamed)]);

            expect(registry.resolve('Sheets.held()[^1]', {}, { imports: ['Sheets'] }).createEvaluator({}).evaluate().value).toBe(30);
            expect(registry.resolve('Sheets.held()[1..]', {}, { imports: ['Sheets'] }).createEvaluator({}).evaluate().value).toEqual([20, 30]);
            expect(errorThrownBy(() => registry.resolve('grid[Sheets.held()]', bound, { imports: ['Sheets'] }))).toMatchObject({ code: 'LEXICA3084', message: expect.stringContaining('its key is of Any') });
        });
    });
});
