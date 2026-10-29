import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { dataPropertyDeclarations } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = lexica.declarations;

/** A board, a reference its module recognizes, which places points, and a pin, a reference of another type. */
class Board {}

class Pin {}

/** What the member a test calls last was given, by its parameter's name. */
let received = null;

/** What the board's value of Any answers, as a test sets it. */
let held = null;

/** A member of the board taking its arguments, recording them and answering a number. */
const taking = (name, parameters, options = {}) => createFunctionDeclaration(name, 'Number', { updates: constantUpdates, parameters, impl: ({ args }) => ((received = args), 1), ...options });

/**
 * The board's module: a point of a number and an optional label, a vector of a number alone, a frame of an origin and its corners, and buttons holding the board they belong to; and the board's members, each
 * taking one of them, its points, a value of Any, a member answering what it is given, a host call taking a point, and an unnamed indexer taking a point or a vector.
 */
const createBoards = () => lexica.createModule('Boards', {
    typeOf: value => (value instanceof Board ? 'Board' : value instanceof Pin ? 'Pin' : null),
    types: [
        { name: 'Point', kind: 'structured', members: dataPropertyDeclarations({ x: 'Number', label: 'String?' }) },
        { name: 'Vector', kind: 'structured', members: dataPropertyDeclarations({ x: 'Number' }) },
        { name: 'Frame', kind: 'structured', members: dataPropertyDeclarations({ origin: 'Point', corners: 'List<Point>?' }) },
        { name: 'Buttons', kind: 'structured', members: dataPropertyDeclarations({ container: 'Board?', size: 'Number?' }) },
        { name: 'Pin', kind: 'reference', isInstance: value => value instanceof Pin },
        {
            name: 'Board',
            kind: 'reference',
            isInstance: value => value instanceof Board,
            members: [
                taking('place', [createValueParameterDeclaration('at', 'Point')]),
                taking('placeMaybe', [createValueParameterDeclaration('at', 'Point?', { nulls: 'accept' })]),
                taking('frame', [createValueParameterDeclaration('frame', 'Frame')]),
                taking('arrange', [createValueParameterDeclaration('at', 'Point'), createValueParameterDeclaration('buttons', 'Buttons?', { required: false, default: null, nulls: 'accept' })], { arguments: 'options' }),
                createPropertyDeclaration('points', 'List<Point>', { updates: constantUpdates, impl: () => [{ x: 1, label: null }] }),
                createPropertyDeclaration('spot', 'Point?', { updates: constantUpdates, impl: () => null }),
                createPropertyDeclaration('held', 'Any', { updates: constantUpdates, impl: () => held }),
                createFunctionDeclaration('same<T>', 'T', { updates: constantUpdates, parameters: [createValueParameterDeclaration('value', 'T')], impl: ({ args }) => args.value }),
                createFunctionDeclaration('mark', undefined, { invokedBy: 'host', parameters: [createValueParameterDeclaration('at', 'Point')] }),
                createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'Point')], impl: () => 'point' }),
                createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'Vector')], impl: () => 'vector' }),
            ],
        },
    ],
});

const board = new Board();
const registry = lexica.createRegistry([createBoards()]);
const resolve = (text, values = {}) => registry.resolve(text, { board, ...values }, { imports: ['Boards'] });
const evaluate = (text, values = {}) => resolve(text, values).createEvaluator({ board, ...values }).evaluate().value;

describe('a structured value written in place', () => {
    it('constructs the structure a value argument declares, a nullable property it leaves out null, its properties in the shape\'s order, frozen', () => {
        evaluate('board.place({ label = "a", x = 1 })');

        expect(Object.keys(received.at)).toEqual(['x', 'label']);
        expect(received.at).toEqual({ x: 1, label: 'a' });
        expect(Object.isFrozen(received.at)).toBe(true);

        evaluate('board.place({ x = 1 })');

        expect(received.at).toEqual({ x: 1, label: null });
    });

    it('constructs through an option, an object field of a structure, a list\'s items, a conditional\'s branches and a coalescing\'s sides, parentheses changing nothing', () => {
        evaluate('board.frame({ origin = { x = 1 }, corners = [{ x = 2 }, { x = 3, label = "c" }] })');

        expect(received.frame).toEqual({ origin: { x: 1, label: null }, corners: [{ x: 2, label: null }, { x: 3, label: 'c' }] });

        evaluate('board.place(if wanted then { x = 1 } else { x = 2, label = "b" } end)', { wanted: false });

        expect(received.at).toEqual({ x: 2, label: 'b' });

        evaluate('board.place(board.spot ?? { x = 9 })');

        expect(received.at).toEqual({ x: 9, label: null });

        evaluate('board.place(({ x = 4 }))');

        expect(received.at).toEqual({ x: 4, label: null });

        evaluate('board.placeMaybe({ x = 5 })');

        expect(received.at).toEqual({ x: 5, label: null });
    });

    it('constructs a structure holding a reference, which a structure written in place keeps as it is', () => {
        evaluate('board.arrange({ at = { x = 1 }, buttons = { container = board } })');

        expect(received.buttons).toEqual({ container: board, size: null });
        expect(received.buttons.container).toBe(board);
    });

    it('constructs where a receiver binds the type parameter a parameter writes, and infers an object where nothing binds it', () => {
        expect(evaluate('board.points.concat([{ x = 5 }]).select(it.x)')).toEqual([1, 5]);
        expect(resolve('board.same({ x = 1 })').type).toBe('{ x: Number }');
    });

    it('keeps the type a value has where it is written, so a local and a function\'s answer construct nothing', () => {
        expect(errorThrownBy(() => resolve('let point = { x = 1 }\nreturn board.place(point)'))).toMatchObject({ code: 'LEXICA3042', message: expect.stringContaining('expects Point and finds { x: Number }') });
        expect(errorThrownBy(() => resolve('let make = () => { x = 1 }\nreturn board.place(make())'))).toMatchObject({ code: 'LEXICA3042' });
    });

    it('refuses an object field the data shape lacks, a property left out that can\'t be null, and a value its property doesn\'t take, each where it stands', () => {
        expect(errorThrownBy(() => resolve('board.place({ x = 1, y = 2 })'))).toMatchObject({ code: 'LEXICA3086', location: { pointer: '/expression/arguments/0/objectFields/1' }, message: expect.stringContaining("The Point written here has no property 'y'; it holds x, label") });
        expect(errorThrownBy(() => resolve('board.place({ label = "a" })'))).toMatchObject({ code: 'LEXICA3087', location: { pointer: '/expression/arguments/0' }, message: expect.stringContaining("leaves out 'x', which is Number and can't be null") });
        expect(errorThrownBy(() => resolve('board.place({ x = "one" })'))).toMatchObject({ code: 'LEXICA3088', location: { pointer: '/expression/arguments/0/objectFields/0/value' }, message: expect.stringContaining("The property 'x' of the Point written here is Number, and is given String") });
    });

    it('checks a value of Any where it is evaluated, against the type of the property it is given to', () => {
        held = 3;

        evaluate('board.place({ x = board.held })');

        expect(received.at).toEqual({ x: 3, label: null });

        held = 'three';

        expect(errorThrownBy(() => evaluate('board.place({ x = board.held })'))).toMatchObject({ code: 'LEXICA5038', message: expect.stringContaining("The property 'x' of the Point written here is Number, and is given") });
    });

    it('prepares a host call with the structure its argument constructs', () => {
        const call = resolve('board.mark({ x = 1 })').createEvaluator({ board }).prepareHostCall();

        expect(call.args).toEqual({ at: { x: 1, label: null } });
    });

    it('selects an indexer\'s signature by the one structure a key constructs, and refuses a key two structures fit alike', () => {
        expect(evaluate('board[{ x = 1, label = "a" }]')).toBe('point');
        expect(errorThrownBy(() => resolve('board[{ x = 1 }]'))).toMatchObject({ code: 'LEXICA3089', location: { pointer: '/expression/argument' }, message: expect.stringContaining('constructs Point and Vector alike') });
    });

    it('constructs nothing for a deferred call, whose parameters are known only as it is evaluated, checking the object it is given as any argument of a value of Any', () => {
        held = board;

        expect(errorThrownBy(() => evaluate('board.held.place({ x = 1 })'))).toMatchObject({ code: 'LEXICA5021' });
    });
});

describe('a structured value bound', () => {
    /** The bindings of the values, each declared the type given by its name, against the board's registry. */
    const bind = (values, types) => registry.createBindings({ board, ...values }, { types });

    it('captures a binding of a declared data type as a supplied value is captured: its data shape alone, a nullable property left out null, frozen', () => {
        const bindings = bind({ points: [{ x: 1, extra: true }, { x: 2, label: 'b' }] }, { points: 'List<Boards.Point>' });

        expect(bindings.readValue('points')).toEqual([{ x: 1, label: null }, { x: 2, label: 'b' }]);
        expect(Object.isFrozen(bindings.readValue('points')) && Object.isFrozen(bindings.readValue('points')[0])).toBe(true);
        expect(String(bindings.getType('points'))).toBe('List<Point>');
    });

    it('gives a script the structure, which a member taking one takes, and resolves it by its declared type', () => {
        const bindings = bind({ point: { x: 3 } }, { point: 'Point' });

        registry.resolve('board.place(point)', bindings, { imports: ['Boards'] }).createEvaluator(bindings).evaluate();

        expect(received.at).toEqual({ x: 3, label: null });
        expect(bindings.resolutionKey).not.toBe(registry.createBindings({ board, point: { x: 3 } }).resolutionKey);
    });

    it('keeps a reference a structure holds as it is, and captures a reference of another type as null where a nullable reference type is declared', () => {
        const buttons = bind({ buttons: { container: board } }, { buttons: 'Buttons' }).readValue('buttons');
        const elsewhere = bind({ buttons: { container: new Pin() } }, { buttons: 'Buttons' }).readValue('buttons');

        expect(buttons.container).toBe(board);
        expect(Object.isFrozen(board)).toBe(false);
        expect(elsewhere).toEqual({ container: null, size: null });
    });

    it('refuses data its declared type does not admit, naming the binding and the part of its value', () => {
        expect(errorThrownBy(() => bind({ point: { label: 'a' } }, { point: 'Point' }))).toMatchObject({ code: 'LEXICA2045', location: { binding: 'point' }, message: expect.stringContaining("is declared Point, and it is given a value without 'x', where Number is declared") });
        expect(errorThrownBy(() => bind({ buttons: { container: {} } }, { buttons: 'Buttons' }))).toMatchObject({ code: 'LEXICA2045' });
    });

    it('keeps a declared reference type\'s contract, a nullable one taking null', () => {
        expect(bind({ other: null }, { other: 'Board?' }).getType('other').toString()).toBe('Board?');
        expect(errorThrownBy(() => bind({ other: new Pin() }, { other: 'Board' }))).toMatchObject({ code: 'LEXICA2036' });
    });
});

describe('a structure expected in one reading of a node', () => {
    /** A module whose `distance` is both a module member taking two points and a point's own member taking another, and whose `show` is a module member taking a point and a count beside a point's own `show`. */
    const createGeo = () => lexica.createModule('Geo', {
        types: [{
            name: 'Point',
            kind: 'structured',
            members: [
                ...dataPropertyDeclarations({ x: 'Number' }),
                createFunctionDeclaration('distance', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('other', 'Point')], impl: () => -1 }),
                createFunctionDeclaration('show', 'Number', { updates: constantUpdates, impl: () => -1 }),
            ],
        }],
        members: [
            createFunctionDeclaration('distance', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('a', 'Point'), createValueParameterDeclaration('b', 'Point')], impl: ({ args }) => Math.abs(args.b.x - args.a.x) }),
            createFunctionDeclaration('show', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('at', 'Point'), createValueParameterDeclaration('count', 'Number')], impl: () => 1 }),
        ],
    });
    const geo = lexica.createRegistry([createGeo()]);
    const resolveGeo = text => geo.resolve(text, {}, { imports: ['Geo'] });

    it('expects nothing of it in another reading, so a qualified form\'s receiver, which no structure\'s type reaches, constructs nothing', () => {
        expect(resolveGeo('Geo.distance({ x = 1 }, { x = 4 })').createEvaluator({}).evaluate().value).toBe(3);
        expect(errorThrownBy(() => resolveGeo('Geo.show({ x = 1 })'))).toMatchObject({ code: 'LEXICA3080', message: expect.stringContaining("'show' requires the argument 'count'") });
    });

    it('constructs an indexer\'s key written in any form the type reaches, a conditional among them, selecting the signature of the structure it constructs', () => {
        expect(evaluate('board[if wanted then { x = 1, label = "a" } else { x = 2, label = "b" } end]', { wanted: true })).toBe('point');
    });
});

describe("a structure's type through a value of Any", () => {
    /** A module whose point has a member of its own, which a member answering its argument as a value of Any passes on, and a host call supplying a point. */
    const createMarks = () => lexica.createModule('Marks', {
        typeOf: value => (value instanceof Board ? 'Sheet' : null),
        types: [
            { name: 'Point', kind: 'structured', members: [...dataPropertyDeclarations({ x: 'Number' }), createFunctionDeclaration('double', 'Number', { updates: constantUpdates, impl: ({ receiver }) => receiver.x * 2 })] },
            {
                name: 'Sheet',
                kind: 'reference',
                isInstance: value => value instanceof Board,
                members: [
                    createFunctionDeclaration('wrap', 'Any', { updates: constantUpdates, parameters: [createValueParameterDeclaration('at', 'Point')], impl: ({ args }) => args.at }),
                    createFunctionDeclaration('latest', 'Point', { invokedBy: 'host' }),
                ],
            },
        ],
    });
    const marks = lexica.createRegistry([createMarks()]);
    const sheet = new Board();
    const evaluateMarks = (text, bindings) => marks.resolve(text, bindings, { imports: ['Marks'] }).createEvaluator(bindings).evaluate().value;

    it('keeps the type of a structure written in place, so a member selected by the value\'s type finds it', () => {
        expect(evaluateMarks('sheet.wrap({ x = 5 }).double()', marks.createBindings({ sheet }))).toBe(10);
    });

    it('keeps the type of a structure a host binds as a declared type, and of one a host call supplies', () => {
        expect(evaluateMarks('sheet.wrap(point).double()', marks.createBindings({ sheet, point: { x: 10 } }, { types: { point: 'Point' } }))).toBe(20);

        const call = marks.resolve('sheet.latest() { doubled = sheet.wrap(it).double() }', { sheet }, { imports: ['Marks'] }).createEvaluator({ sheet }).prepareHostCall();

        expect(call.project({ x: 4 }).value).toEqual({ doubled: 8 });
    });
});
