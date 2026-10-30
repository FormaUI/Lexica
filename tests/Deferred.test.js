import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { Device, Light, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates, derivedUpdates } from './support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration, createFunctionParameterDeclaration } = nexo.declarations;

/** A value parameter that accepts null, so a call given null is invoked with it. */
const accepting = (name, type) => createValueParameterDeclaration(name, type, { nulls: 'accept' });

/** What the shelf holds, each a value of Any its `item` answers by its key. */
const held = {
    word: 'oat',
    number: 2,
    light: new Light('lamp'),
    device: new Device('fan'),
    numbers: [1, 2],
    mixed: [1, 'oat'],
    empty: [],
    record: { size: 3, name: 'jar' },
    none: null,
    func: () => 1,
};

/**
 * A shelf of values of Any on the home: its module members answer a value it holds, one that may be null, the value they are given and a cup, and double a number. A device's members answer its power, dim it, answer
 * nothing, take options, echo what they are given, index it by a key and are ordered by the host, and a light glows; a cup describes itself, and a word shouts.
 */
const createShelf = () => nexo.createModule('shelf', withHome({
    types: [
        { name: 'Cup', kind: 'structured', members: [...dataPropertyDeclarations({ size: 'Number' }), createFunctionDeclaration('describe', 'String', { updates: derivedUpdates, impl: ({ receiver }) => `a cup of ${receiver.size}` })] },
        extensionDeclaration('Words', 'String', [createPropertyDeclaration('shout', 'String', { updates: derivedUpdates, impl: ({ receiver }) => receiver.toUpperCase() })]),
    ],
    members: [
        createFunctionDeclaration('item', 'Any', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ args }) => held[args.key] }),
        createFunctionDeclaration('maybe', 'Any?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ args }) => held[args.key] }),
        createFunctionDeclaration('wrap', 'Any', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('value', 'Any')], impl: ({ args }) => args.value }),
        createFunctionDeclaration('things', 'List<Any>', { updates: constantUpdates, impl: () => [held.light, new Thermostat('heater'), held.light] }),
        createFunctionDeclaration('cup', 'Cup', { updates: constantUpdates, impl: () => ({ size: 2 }) }),
        createFunctionDeclaration('double', 'Number', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('value', 'Number')], impl: ({ args }) => args.value * 2 }),
    ],
}, {
    Device: [
        createPropertyDeclaration('power', 'String', { updates: constantUpdates, impl: () => 'home' }),
        createPropertyDeclaration('nothing', 'String?', { updates: constantUpdates, impl: () => null }),
        createFunctionDeclaration('dim', 'String', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('level', 'Number')], impl: ({ receiver, args }) => `${receiver.name} at ${args.level}` }),
        createFunctionDeclaration('tune', 'String', { updates: derivedUpdates, arguments: 'options', parameters: [createValueParameterDeclaration('level', 'Number'), createValueParameterDeclaration('mode', 'String', { default: 'eco' })], impl: ({ args }) => `${args.level} ${args.mode}` }),
        createFunctionDeclaration('echo<U>', 'U', { updates: derivedUpdates, parameters: [accepting('value', 'U')], impl: ({ args }) => args.value }),
        createFunctionDeclaration('test', 'Boolean', { updates: derivedUpdates, parameters: [createFunctionParameterDeclaration('check', 'Boolean', ['String'])], impl: ({ receiver, args }) => args.check(receiver.name) }),
        createFunctionDeclaration('order', 'Number', { invokedBy: 'host', parameters: [createValueParameterDeclaration('count', 'Number')] }),
        createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ receiver, args }) => `${receiver.name}[${args.key}]` }),
    ],
    Light: [createPropertyDeclaration('glow', 'String', { updates: constantUpdates, impl: ({ receiver }) => `${receiver.name} glows` })],
}));

/** The resolution of the text against a registry of the shelf. */
const resolve = text => nexo.createRegistry([createShelf()]).resolve(text, {}, { imports: ['shelf'] });

/** What the text evaluates to against a registry of the shelf, with the hooks given. */
const evaluate = (text, hooks = null) => resolve(text).createEvaluator({}).evaluate(hooks).value;

/** The error resolving the text throws. */
const refusal = text => errorThrownBy(() => resolve(text));

/** The error evaluating the text throws. */
const failure = text => errorThrownBy(() => evaluate(text));

describe('values of Any', () => {
    describe('resolved', () => {
        it('types an access on a value of Any as Any, selecting no declaration, so it uses none', () => {
            const resolution = resolve('shelf.item("light").glow');

            expect(resolution.type).toBe('Any');
            expect(resolution.usedDeclarations.map(used => used.name)).toEqual(['item']);
        });

        it('refuses a call or an indexer no accessible declaration of its name takes in that form, and takes a property of any name, which a plain object\'s fields may give', () => {
            expect(refusal('shelf.item("light").missing()')).toMatchObject({ code: 'NEXO3001', location: { pointer: '/expression' } });
            expect(refusal('shelf.item("light").glow()')).toMatchObject({ code: 'NEXO3017' });
            expect(resolve('shelf.item("record").missing').type).toBe('Any');
        });

        it('refuses an argument whose reading would depend on the declaration selected: one that reads its own implicit parameter, and a function', () => {
            expect(refusal('shelf.item("light").dim(it.size)')).toMatchObject({ code: 'NEXO3029', location: { pointer: '/expression/arguments/0' } });
            expect(refusal('shelf.item("light").test(word => word == "lamp")')).toMatchObject({ code: 'NEXO3029', location: { pointer: '/expression/arguments/0' } });
        });
    });

    describe('reported', () => {
        it('reports each deferred access by where it stands and the name it accesses, an unnamed indexer\'s null, once in a script function\'s body whichever calls reach it', () => {
            const resolution = resolve('{ glow = shelf.item("light").glow, dim = shelf.item("device").dim(2), key = shelf.item("device")["k"] }');

            expect(resolution.deferredAccesses).toEqual([
                { name: 'glow', pointer: '/expression/objectFields/0/value' },
                { name: 'dim', pointer: '/expression/objectFields/1/value' },
                { name: null, pointer: '/expression/objectFields/2/value' },
            ]);
            expect(Object.isFrozen(resolution.deferredAccesses) && resolution.deferredAccesses.every(Object.isFrozen)).toBe(true);
            expect(resolve('let f = function(x)\n    return x.glow\nend\nreturn { a = f(shelf.item("light")), b = f(shelf.item("light")) }').deferredAccesses).toEqual([{ name: 'glow', pointer: '/expression/locals/0/value/body/result' }]);
            expect(resolve('shelf.cup().size').deferredAccesses).toEqual([]);
        });

        it('gives, asked for them, the candidate declarations: the used ones, and each deferred access\'s accessible declarations of its name and form at its pointer, an overestimate while a deferred access remains', () => {
            const candidates = resolve('{ glow = shelf.item("light").glow, shout = shelf.item("word"):shout, key = shelf.item("device")["k"] }').getCandidateDeclarations();

            expect(candidates.isOverestimate).toBe(true);
            expect(candidates.declarations.map(({ name, qualifiedName, pointer }) => [name, qualifiedName, pointer])).toEqual([
                ['item', 'shelf.item', '/expression/objectFields/0/value/receiver'],
                ['item', 'shelf.item', '/expression/objectFields/1/value/receiver'],
                ['item', 'shelf.item', '/expression/objectFields/2/value/receiver'],
                ['glow', 'Light.glow', '/expression/objectFields/0/value'],
                ['shout', 'String.shout', '/expression/objectFields/1/value'],
                [null, 'String[]', '/expression/objectFields/2/value'],
                [null, 'List[]', '/expression/objectFields/2/value'],
                [null, 'List[]', '/expression/objectFields/2/value'],
                [null, 'List[]', '/expression/objectFields/2/value'],
                [null, 'Dictionary[]', '/expression/objectFields/2/value'],
                [null, 'Device[]', '/expression/objectFields/2/value'],
            ]);
            expect(Object.isFrozen(candidates) && Object.isFrozen(candidates.declarations)).toBe(true);

            const known = resolve('shelf.cup().size');

            expect(known.getCandidateDeclarations()).toEqual({ declarations: known.usedDeclarations, isOverestimate: false });
        });
    });

    describe('selected as they are evaluated', () => {
        it('selects a member by the actual type of its receiver\'s value: a reference\'s, an inherited one\'s, a string\'s, a list\'s and an indexer\'s', () => {
            expect(evaluate('shelf.item("light").glow')).toBe('lamp glows');
            expect(evaluate('shelf.item("light").power')).toBe('home');
            expect(evaluate('shelf.item("word"):shout')).toBe('OAT');
            expect(evaluate('shelf.item("numbers").count')).toBe(2);
            expect(evaluate('shelf.item("mixed").count')).toBe(2);
            expect(evaluate('shelf.item("empty").count')).toBe(0);
            expect(evaluate('shelf.item("light")["mode"]')).toBe('lamp[mode]');
        });

        it('reads a plain object\'s own field by its name, and a structured value\'s data and members by the type its declared result gave it, which Any keeps', () => {
            expect(evaluate('shelf.item("record").size')).toBe(3);
            expect(evaluate('shelf.wrap(shelf.cup()).size')).toBe(2);
            expect(evaluate('shelf.wrap(shelf.cup()).describe()')).toBe('a cup of 2');
            expect(failure('shelf.item("record").describe()')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'describe' is not available on { size: Number, name: String }") });
        });

        it('selects anew for each actual type an access meets, as the items of a list of Any are', () => {
            expect(evaluate('shelf.things().where(it.power == "home").count')).toBe(3);
            expect(evaluate('{ first = shelf.things().first?.glow, last = shelf.things().last?.glow }')).toEqual({ first: 'lamp glows', last: 'lamp glows' });
            expect(errorThrownBy(() => evaluate('shelf.things().where(it.glow == "lamp glows").count'))).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'glow' is not available on Thermostat") });
        });

        it('binds the values a call gives, in order or as the fields of the object a member taking options is given, a default for each left out, and a type parameter of its own by their types', () => {
            expect(evaluate('shelf.item("light").dim(3)')).toBe('lamp at 3');
            expect(evaluate('shelf.item("light").tune({ level = 2 })')).toBe('2 eco');
            expect(evaluate('shelf.item("light").echo(5)')).toBe(5);
            expect(evaluate('shelf.item("light").echo("oat")')).toBe('oat');
        });

        it('fails a call its selected member doesn\'t take: a value its parameter doesn\'t admit, too many values, one left out that is required, and a field it has no parameter of', () => {
            expect(failure('shelf.item("light").dim("high")')).toMatchObject({ code: 'NEXO5021', message: expect.stringContaining("The argument 'level' of 'dim' on Light is declared Number, and is given \"high\"") });
            expect(failure('shelf.item("light").dim(1, 2)')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'dim' on Light takes one argument, and is given 2") });
            expect(failure('shelf.item("light").dim()')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'dim' on Light requires the argument 'level'") });
            expect(failure('shelf.item("light").tune({ speed = 2 })')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("has no parameter 'speed'") });
        });

        it('fails a member its receiver\'s actual type lacks, a value of no type the vocabulary knows, and a host call, which resolution alone selects, before invoking anything', () => {
            expect(failure('shelf.item("word").glow')).toMatchObject({ code: 'NEXO5012', location: { pointer: '/expression' }, message: expect.stringContaining("'glow' is not available on String") });
            expect(failure('shelf.item("func").power')).toMatchObject({ code: 'NEXO5012' });
            expect(failure('{ count = shelf.item("light").order(1) }')).toMatchObject({ code: 'NEXO5013', message: expect.stringContaining("'order' on Light is a host call") });
        });

        it('fails a direct access on null, and answers null for an optional one and for every access after an optional one that met null', () => {
            expect(failure('shelf.item("light").nothing.size')).toMatchObject({ code: 'NEXO5022', location: { pointer: '/expression' }, message: expect.stringContaining("write '?.'") });
            expect(evaluate('shelf.item("light").nothing?.size')).toBeNull();
            expect(evaluate('shelf.maybe("none")?.power.size')).toBeNull();
            expect(failure('shelf.maybe("light")?.nothing.size')).toMatchObject({ code: 'NEXO5022', location: { pointer: '/expression/chain' } });
            expect(evaluate('shelf.maybe("light")?.nothing?.size')).toBeNull();
        });

        it('asks the host before invoking a member it selects, its request saying it was deferred, and an ordinary request saying it was not', () => {
            const requests = [];

            evaluate('shelf.item("light").glow', { beforeInvoke: request => void requests.push({ name: request.declaration.name, isDeferred: request.isDeferred }) });

            expect(requests).toEqual([{ name: 'item', isDeferred: false }, { name: 'glow', isDeferred: true }]);
        });

        it('prepares a host call whose receiver a cast makes known, which resolution selects, so it is never deferred', () => {
            const call = resolve('(shelf.item("light") as Light).order(2)').createEvaluator({}).prepareHostCall();

            expect(call).toMatchObject({ kind: 'prepared', receiver: held.light, args: { count: 2 }, isDeferred: false });
        });

        it('fails the evaluation where the host refuses a member it selects, before invoking it', () => {
            const refused = new Error('not here');
            const invoked = [];

            const error = errorThrownBy(() => evaluate('shelf.item("light").glow', { beforeInvoke: request => { if (request.isDeferred) throw refused; invoked.push(request.declaration.name); } }));

            expect(error).toMatchObject({ code: 'NEXO5009', cause: refused });
            expect(invoked).toEqual(['item']);
        });
    });

    describe('checked as they are evaluated', () => {
        it('checks a value of Any given where a type is declared against that type', () => {
            expect(evaluate('shelf.double(shelf.item("number"))')).toBe(4);
            expect(failure('shelf.double(shelf.item("word"))')).toMatchObject({ code: 'NEXO5021', location: { pointer: '/expression/arguments/0' }, message: expect.stringContaining("The argument 'value' of 'double' is declared Number, and is given \"oat\"") });
        });

        it('checks a function\'s or an expression\'s answer of Any against the result its callback contract declares', () => {
            const values = { numbers: [1, 2] };
            const evaluateOver = text => nexo.createRegistry([createShelf()]).resolve(text, values, { imports: ['shelf'] }).createEvaluator(values).evaluate().value;

            expect(evaluateOver('numbers.sum(n => shelf.item("number"))')).toBe(4);
            expect(evaluateOver('numbers.sum(shelf.item("number"))')).toBe(4);
            expect(evaluateOver('numbers.max(n => shelf.maybe("none"))')).toBeNull();
            expect(evaluateOver('numbers.sum(shelf.wrap)')).toBe(3);
            expect(errorThrownBy(() => evaluateOver('numbers.sum(n => shelf.item("word"))'))).toMatchObject({ code: 'NEXO5504', location: { pointer: '/expression/arguments/0' }, message: expect.stringContaining("The function given as 'expression' of 'sum' gave \"oat\", and its contract declares Number?") });
            expect(errorThrownBy(() => evaluateOver('numbers.sum(shelf.item("word"))'))).toMatchObject({ code: 'NEXO5504', location: { pointer: '/expression/arguments/0' } });
        });

        it('compares a value of Any with a value of a type it fits one way or the other, and with null, and fails other equalities', () => {
            expect(evaluate('shelf.item("word") == "oat"')).toBe(true);
            expect(evaluate('shelf.item("light") != shelf.item("device")')).toBe(true);
            expect(evaluate('shelf.maybe("none") == 1')).toBe(false);
            expect(failure('shelf.item("number") == "oat"')).toMatchObject({ code: 'NEXO5024', message: expect.stringContaining('Number and String, which fit neither way') });
            expect(failure('shelf.item("record") != null and shelf.item("record") == shelf.item("record")')).toMatchObject({ code: 'NEXO5025' });
        });

        it('answers a result holding data through Any, and fails one holding a reference or a function', () => {
            expect(evaluate('shelf.item("record")')).toEqual({ size: 3, name: 'jar' });
            expect(evaluate('{ word = shelf.item("word"), numbers = shelf.item("numbers") }')).toEqual({ word: 'oat', numbers: [1, 2] });
            expect(failure('shelf.item("light")')).toMatchObject({ code: 'NEXO5028' });
            expect(failure('{ light = shelf.item("light") }')).toMatchObject({ code: 'NEXO5028' });
            expect(failure('shelf.item("func")')).toMatchObject({ code: 'NEXO5028' });
        });

        it('applies arithmetic, ordering and interpolation to a value of Any as they apply to any operand evaluated', () => {
            expect(evaluate('shelf.item("number") + 1')).toBe(3);
            expect(evaluate('$"{shelf.item("word")}!"')).toBe('oat!');
            expect(failure('$"{shelf.item("light")}!"')).toMatchObject({ code: 'NEXO5500' });
            expect(failure('shelf.item("word") * 2')).toMatchObject({ code: 'NEXO5505' });
            expect(failure('shelf.item("word") > 2')).toMatchObject({ code: 'NEXO5501' });
        });
    });
});
