import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { Evaluator } from '#nexo/language/Evaluator.mjs';
import { LanguageResolver } from '#nexo/language/LanguageResolver.mjs';
import { ParameterBindings } from '#nexo/language/ParameterBindings.mjs';
import { ParsedTexts } from '#nexo/language/ParsedTexts.mjs';
import { NexoRegistry } from '#nexo/language/vocabulary/NexoRegistry.mjs';
import { Vocabulary } from '#nexo/language/vocabulary/Vocabulary.mjs';
import { Device, Light, Room, Thermostat, homeTypeOf, homeTypes, withHome } from '../support/home.mjs';
import { errorThrownBy, expectNexoError } from '../support/errors.mjs';
import { constantUpdates, derivedUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from '../support/declarations.mjs';
import { createImportingRegistry, parseImporting } from '../support/pipeline.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createFunctionParameterDeclaration, createFunctionDeclaration, createIndexerDeclaration } = nexo.declarations;

/** What the test gives a member's implementation to do, by the member's name, so each test decides how its member fails. */
let behaviors = {};

/** The function a member of the pantry was given last, which a later member calls after the first's invocation has ended. */
let kept = null;

/**
 * A pantry's module on words: a word's size, the device it names, a value it answers as the test says, a value of Any the test gives, a word repeated a number of times, a maintained quote, a check that calls the test it is given, a member
 * that keeps it and one that calls it later, and a cup a word converts to, through the conversion the test gives.
 */
const createPantry = () => nexo.createModule('pantry', withHome({
    types: [
        { name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) },
        extensionDeclaration('StringExtensions', 'String', [
            createPropertyDeclaration('size', 'Number', { updates: constantUpdates, impl: input => (behaviors.size ?? (({ receiver }) => receiver.length))(input) }),
            createPropertyDeclaration('device', 'Device', { updates: constantUpdates, impl: () => new Thermostat('heater') }),
            createPropertyDeclaration('held', 'Any', { updates: constantUpdates, impl: () => behaviors.held }),
            createFunctionDeclaration('repeat', 'String', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('times', 'Number')], impl: ({ receiver, args }) => receiver.repeat(args.times) }),
            createPropertyDeclaration('quoted', 'Number?', { updates: { changes: 'observable', reads: 'maintained', observations: [{ type: 'quote', of: 'receiver' }] }, impl: ({ samples: [quote] }) => quote }),
            createFunctionDeclaration('check', 'Boolean', { updates: derivedUpdates, parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])], impl: input => (behaviors.check ?? (({ receiver, args }) => args.test(receiver)))(input) }),
            createFunctionDeclaration('keep', 'Boolean', { updates: derivedUpdates, parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])], impl: ({ args }) => ((kept = args.test), true) }),
            createFunctionDeclaration('callKept', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => kept(receiver) }),
            createFunctionDeclaration('order', 'Number', { invokedBy: 'host', parameters: [createValueParameterDeclaration('count', 'Number')] }),
            createFunctionDeclaration('drop', undefined, { invokedBy: 'host' }),
            operatorDeclaration('convert', 'Cup', input => behaviors.convert(input)),
        ]),
    ],
    observationTypes: [{ name: 'quote', contract: 'maintained', impl: () => ({ stop: () => {}, sample: () => ({ pending: false, value: 1 }) }) }],
}));

/** A module whose member and conversion have no implementation. */
const createBare = () => nexo.createModule('bare', {
    types: [{ name: 'Mug', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }, extensionDeclaration('StringExtensions', 'String', [createPropertyDeclaration('weight', 'Number', { updates: constantUpdates }), operatorDeclaration('convert', 'Mug')])],
});

/** The evaluator of the text against a registry of the pantry, bound to the values given. */
const evaluatorOf = (text, values = { word: 'oat' }, env = {}) => createImportingRegistry([createPantry()]).resolve(text, values).createEvaluator(values, env);

/** The error evaluating the text throws, for the host given. */
const failureOf = (text, values = { word: 'oat' }, host = null) => errorThrownBy(() => evaluatorOf(text, values).evaluate(host));

/**
 * An evaluator made directly, the text resolved with one set of values and evaluated with another, so it reaches what the public entry point refuses before evaluating: the checks an evaluation keeps where resolution has already made sure.
 */
const directEvaluatorOf = (modules, text, resolvedWith, evaluatedWith = resolvedWith) => {
    const registry = new NexoRegistry([Vocabulary.module, ...modules]);
    const definition = parseImporting(registry, text);
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, new ParameterBindings(registry, resolvedWith), locations).resolveDefinition(definition);

    return new Evaluator(registry, resolved, new ParameterBindings(registry, evaluatedWith), {}, locations);
};

describe('the runtime codes', () => {
    describe('of bindings', () => {
        it('NEXO2020: bindings that are not a plain object', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings([1])), 'NEXO2020', 'structure');
        });

        it('NEXO2033: a binding not named by a letter followed by letters and digits', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ 'floor-area': 1 })), 'NEXO2033', 'structure');
        });

        it('NEXO2034: a binding that is not data and that nothing recognizes', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ shelf: new WeakMap() })), 'NEXO2034', 'structure');
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ weight: Number.NaN })), 'NEXO2034', 'structure');
        });

        it('NEXO2022: a bound value holding a cycle', () => {
            const shelf = { name: 'top' };

            shelf.self = shelf;

            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ shelf })), 'NEXO2022', 'structure');
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ shelves: [shelf] })), 'NEXO2022', 'structure');
        });

        it('NEXO2041: a bound map holding a key of no key type', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ table: new Map([[[1], 'list']]) })), 'NEXO2041', 'structure');
        });

        it('NEXO2042: a bound map whose keys or values share no type', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ table: new Map([['a', 1], [2, 2]]) })), 'NEXO2042', 'structure');
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ table: new Map([['a', 1], ['b', 'two']]) })), 'NEXO2042', 'structure');
        });

        it('NEXO2021: a bound list whose items share no type', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ items: [1, 'two'] })), 'NEXO2021', 'structure');
            expectNexoError(errorThrownBy(() => createImportingRegistry([nexo.createModule('home', withHome())]).createBindings({ items: [new Room('hall'), new Light('lamp')] })), 'NEXO2021', 'structure');
        });
    });

    describe('of reference bindings', () => {
        const home = () => createImportingRegistry([nexo.createModule('home', withHome())]);
        const recognizing = (typeOf, types = homeTypes) => createImportingRegistry([nexo.createModule('home', { typeOf, types })]);

        it('NEXO2034: a value no module recognizes that is no data', () => {
            expectNexoError(errorThrownBy(() => createImportingRegistry().createBindings({ lamp: new Light('lamp') })), 'NEXO2034', 'structure');
        });

        it('NEXO2035: a value modules recognize as unrelated types', () => {
            const garden = nexo.createModule('garden', { typeOf: value => (value instanceof Light ? 'Lamp' : null), types: [{ name: 'Lamp', kind: 'reference', isInstance: value => value instanceof Light }] });

            expectNexoError(errorThrownBy(() => createImportingRegistry([nexo.createModule('home', withHome()), garden]).createBindings({ lamp: new Light('lamp') })), 'NEXO2035', 'structure');
        });

        it('NEXO2036: a declared type that no public type is, or that the value does not belong to', () => {
            expectNexoError(errorThrownBy(() => home().createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Lantern' } })), 'NEXO2036', 'structure');
            expectNexoError(errorThrownBy(() => home().createBindings({ lamp: new Thermostat('heater') }, { types: { lamp: 'Light' } })), 'NEXO2036', 'structure');
        });

        it('NEXO2037: a declared type several types share unqualified', () => {
            const office = nexo.createModule('office', { types: [{ name: 'Device', kind: 'reference', isInstance: () => true }] });

            expectNexoError(errorThrownBy(() => createImportingRegistry([nexo.createModule('home', withHome()), office]).createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Device' } })), 'NEXO2037', 'structure');
        });

        it('NEXO2044: a declared type no binding holds, a notation that is none or a dictionary keyed by no key type among them', () => {
            expectNexoError(errorThrownBy(() => home().createBindings({ held: 1 }, { types: { held: 'Any' } })), 'NEXO2044', 'structure');
            expectNexoError(errorThrownBy(() => home().createBindings({ held: 1 }, { types: { held: 'List<' } })), 'NEXO2044', 'structure');
            expectNexoError(errorThrownBy(() => home().createBindings({ held: new Map() }, { types: { held: 'Dictionary<List<Number>, Number>' } })), 'NEXO2044', 'structure');
        });

        it('NEXO2045: a value its declared data type does not admit', () => {
            expectNexoError(errorThrownBy(() => home().createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Number' } })), 'NEXO2045', 'structure');
            expect(errorThrownBy(() => home().createBindings({ sizes: [1, 'two'] }, { types: { sizes: 'List<Number>' } })).message).toContain("its '[1]' is \"two\"");
        });

        it('NEXO2038: a type declared for a value that is not a reference', () => {
            expectNexoError(errorThrownBy(() => home().createBindings({ lamp: 'lamp' }, { types: { lamp: 'Light' } })), 'NEXO2038', 'structure');
        });

        it('NEXO2039: a type declared for anything but a top-level binding', () => {
            expectNexoError(errorThrownBy(() => home().createBindings({ room: { lamp: new Light('lamp') } }, { types: { lamp: 'Light' } })), 'NEXO2039', 'structure');
        });

        it('NEXO2024: resolving or evaluating with a binding set another registry made', () => {
            const bindings = home().createBindings({ lamp: new Light('lamp') });
            const other = home();

            expectNexoError(errorThrownBy(() => other.resolve('lamp.name == null', bindings)), 'NEXO2024', 'structure');
            expectNexoError(errorThrownBy(() => other.resolve('lamp == null', { lamp: new Light('lamp') }).createEvaluator(bindings)), 'NEXO2024', 'structure');
        });

        it('NEXO5002: a typeOf naming what is no reference type of its module, an abstract one, or one the value does not belong to', () => {
            const abstract = [{ name: 'Device', kind: 'reference', abstract: true, isInstance: value => value instanceof Device }];

            for (const [typeOf, types] of [[() => 'Lantern', homeTypes], [() => 5, homeTypes], [() => 'Device', abstract], [() => 'Room', homeTypes]]) {
                expectNexoError(errorThrownBy(() => recognizing(typeOf, types).createBindings({ lamp: new Light('lamp') })), 'NEXO5002', 'evaluation');
            }
        });

        it('NEXO5026: a typeOf that throws, what it threw the cause', () => {
            const thrown = new Error('unrecognizable');
            const failure = errorThrownBy(() => recognizing(() => { throw thrown; }).createBindings({ lamp: new Light('lamp') }));

            expectNexoError(failure, 'NEXO5026', 'evaluation');
            expect(failure.cause).toBe(thrown);
        });

        it('NEXO5017: an isInstance answering what isn\'t a Boolean', () => {
            const types = [{ name: 'Light', kind: 'reference', isInstance: () => 'yes' }];

            expectNexoError(errorThrownBy(() => recognizing(() => 'Light', types).createBindings({ lamp: new Light('lamp') })), 'NEXO5017', 'evaluation');
        });

        it('NEXO5027: an isInstance that throws, what it threw the cause', () => {
            const types = [{ name: 'Light', kind: 'reference', isInstance: () => { throw 'unknown'; } }];
            const failure = errorThrownBy(() => recognizing(() => 'Light', types).createBindings({ lamp: new Light('lamp') }));

            expectNexoError(failure, 'NEXO5027', 'evaluation');
            expect(failure.cause).toBe('unknown');
        });

        it('check a supertype\'s membership too, where a type beneath it answers true', () => {
            const types = [{ name: 'Device', kind: 'reference', isInstance: () => false }, { name: 'Light', kind: 'reference', supertype: 'Device', isInstance: () => true }];

            expectNexoError(errorThrownBy(() => recognizing(homeTypeOf, types).createBindings({ lamp: new Light('lamp') })), 'NEXO5002', 'evaluation');
        });
    });

    describe('of the entry point', () => {
        const registry = createImportingRegistry([createPantry()]);

        it('NEXO2643: a pointer that is not a JSON Pointer', () => {
            expectNexoError(errorThrownBy(() => nexo.getLocation(nexo.parse('1 + 2'), 'expression')), 'NEXO2643', 'structure');
            expectNexoError(errorThrownBy(() => registry.resolve('1 + 2').getLocation(5)), 'NEXO2643', 'structure');
        });

        it('NEXO2644: a pointer at nothing the definition holds', () => {
            expectNexoError(errorThrownBy(() => nexo.getLocation(nexo.parse('1 + 2'), '/expression/middle')), 'NEXO2644', 'structure');
        });

        it('NEXO2645: parsing what is not a script\'s source', () => {
            expectNexoError(errorThrownBy(() => nexo.parse(5)), 'NEXO2645', 'structure');
            expectNexoError(errorThrownBy(() => nexo.parse({ version: 36 })), 'NEXO2645', 'structure');
            expect(errorThrownBy(() => nexo.parse(5)).message).toBe("What parse reads is a script's source");
        });

        it('NEXO2040: creating or entering an evaluator, or projecting a prepared call, once its resolution is no longer current', () => {
            const growing = createImportingRegistry([createPantry()]);
            const resolution = growing.resolve('word.held', { word: 'oat' });
            const evaluator = resolution.createEvaluator({ word: 'oat' });
            const call = growing.resolve('word.order(2) { count = it, held = word.held }', { word: 'oat' }).createEvaluator({ word: 'oat' }).prepareHostCall();

            growing.registerModule(nexo.createModule('bakery', { typeOf: () => null }));

            expectNexoError(errorThrownBy(() => resolution.createEvaluator({ word: 'oat' })), 'NEXO2040', 'structure');
            expectNexoError(errorThrownBy(() => evaluator.evaluate()), 'NEXO2040', 'structure');
            expectNexoError(errorThrownBy(() => call.project(1)), 'NEXO2040', 'structure');
        });

        it('NEXO2025: creating an evaluator with bindings of another resolution key', () => {
            const resolution = registry.resolve('word.size', { word: 'oat' });

            expectNexoError(errorThrownBy(() => resolution.createEvaluator({ word: 5 })), 'NEXO2025', 'structure');
        });

        it('NEXO4001: creating an evaluator for a resolution whose used member or conversion has no implementation', () => {
            const bare = createImportingRegistry([createBare()]);

            const member = errorThrownBy(() => bare.resolve('word.weight', { word: 'oat' }).createEvaluator({ word: 'oat' }));
            const conversion = errorThrownBy(() => bare.resolve('(word to Mug).size', { word: 'oat' }).createEvaluator({ word: 'oat' }));

            expectNexoError(member, 'NEXO4001', 'module');
            expectNexoError(conversion, 'NEXO4001', 'module');
            expect(member.location).toEqual({ module: 'bare', type: 'StringExtensions', declaration: 'weight', declarationKey: 'impl' });
            expect(conversion.location).toEqual({ module: 'bare', type: 'StringExtensions', declaration: 'convert', declarationKey: 'impl' });
        });

        it('NEXO5010: evaluating an evaluator from within its own evaluation', () => {
            const holder = {};

            behaviors = { size: () => holder.evaluator.evaluate() };
            holder.evaluator = evaluatorOf('word.size');

            expectNexoError(errorThrownBy(() => holder.evaluator.evaluate()), 'NEXO5010', 'evaluation');
        });
    });

    describe('of result paths', () => {
        const registry = createImportingRegistry([createPantry()]);

        it('NEXO2646: a path item that is neither a name nor a list index', () => {
            expectNexoError(errorThrownBy(() => nexo.paths.validate(['total', -1])), 'NEXO2646', 'structure');
            expectNexoError(errorThrownBy(() => nexo.paths.validate(['total', 'floor-area'])), 'NEXO2646', 'structure');
        });

        it('NEXO3600: a path into the result of a host call that supplies nothing', () => {
            expectNexoError(errorThrownBy(() => registry.resolve('word.drop()', { word: 'oat' }).typeAt([])), 'NEXO3600', 'validation');
        });

        it('NEXO3601: a path indexing what is not a list', () => {
            expectNexoError(errorThrownBy(() => registry.resolve('{ total = 1 }').typeAt(['total', 0])), 'NEXO3601', 'validation');
        });

        it('NEXO3602: a path naming a field the result does not hold', () => {
            expectNexoError(errorThrownBy(() => registry.resolve('{ total = 1 }').typeAt(['count'])), 'NEXO3602', 'validation');
        });
    });

    describe('of evaluation', () => {
        it('NEXO5014: preparing a script that ends in no host call', () => {
            expectNexoError(errorThrownBy(() => evaluatorOf('word.size').prepareHostCall()), 'NEXO5014', 'evaluation');
        });

        it('NEXO5023: evaluating a script that ends in a host call', () => {
            expectNexoError(failureOf('word.order(2)'), 'NEXO5023', 'evaluation');
        });

        it('NEXO5015: a value a host supplies that its host call\'s declared result does not admit', () => {
            const call = evaluatorOf('word.order(2)').prepareHostCall();

            expectNexoError(errorThrownBy(() => call.project('many')), 'NEXO5015', 'evaluation');
        });

        it('NEXO5001: a value a strict cast rejects, naming the type its value is of', () => {
            const failure = failureOf('(word.device as Light) == null');

            expectNexoError(failure, 'NEXO5001', 'evaluation');
            expect(failure.message).toContain('The cast to Light rejected its value: it is a Device that isn\'t a Light');
            expect(evaluatorOf('(try word.device as Light) == null').evaluate().value).toBe(true);
        });

        it('NEXO5016: a value a conversion rejects', () => {
            expectNexoError(failureOf('word to Number', { word: '12px' }), 'NEXO5016', 'evaluation');
        });

        it('NEXO5003: a conversion that throws', () => {
            behaviors = { convert: () => { throw new Error('no cups'); } };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5003', 'evaluation');
        });

        it('NEXO5018: a conversion that rejects with a reason that is not a string, or rejects and then answers', () => {
            behaviors = { convert: ({ reject }) => reject(5) };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5018', 'evaluation');

            behaviors = {
                convert: ({ reject }) => {
                    try {
                        reject('too small');
                    } catch {
                        // The conversion answers past its own rejection.
                    }

                    return { size: 1 };
                },
            };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5018', 'evaluation');
        });

        it('NEXO5019: a conversion that answers a value not of its type', () => {
            behaviors = { convert: () => ({ size: 'large' }) };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5019', 'evaluation');

            behaviors = { convert: () => null };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5019', 'evaluation');
        });

        it('NEXO5005: a division or a remainder by zero', () => {
            expectNexoError(failureOf('1 / none', { none: 0 }), 'NEXO5005', 'evaluation');
            expectNexoError(failureOf('1 % none', { none: 0 }), 'NEXO5005', 'evaluation');
        });

        it('NEXO5020: an arithmetic result no finite number holds', () => {
            expectNexoError(failureOf('big * big', { big: 1e308 }), 'NEXO5020', 'evaluation');
        });

        it('NEXO5006: a module returning a value of a type other than the one it declared', () => {
            behaviors = { size: () => 'three' };

            expectNexoError(failureOf('word.size'), 'NEXO5006', 'evaluation');
        });

        it('NEXO5006: a module returning a number no finite number holds, described as it is, alone or within data', () => {
            for (const [answer, described] of [[Infinity, 'Infinity'], [-Infinity, '-Infinity'], [NaN, 'NaN'], [[1, -Infinity, NaN], '[1,-Infinity,NaN]'], [{ low: NaN, label: 'Infinity' }, '{"low":NaN,"label":"Infinity"}']]) {
                behaviors = { size: () => answer };

                const error = failureOf('word.size');

                expectNexoError(error, 'NEXO5006', 'evaluation');
                expect(error.message, described).toContain(`answered ${described}, and it declares Number`);
            }
        });

        it('NEXO5007: a member whose implementation throws', () => {
            behaviors = { size: () => { throw new Error('no scale'); } };

            expectNexoError(failureOf('word.size'), 'NEXO5007', 'evaluation');
        });

        it('NEXO5008: a function given to a member called after that member\'s invocation has ended', () => {
            expectNexoError(failureOf('{ kept = word.keep(w => w.size > 2), called = word.callKept() }'), 'NEXO5008', 'evaluation');
        });

        it('NEXO5503: a member calling a function it was given with arguments its callback contract does not declare', () => {
            behaviors = { check: ({ args }) => args.test() };

            expectNexoError(failureOf('word.check(w => w.size > 2)'), 'NEXO5503', 'evaluation');

            behaviors = { check: ({ args }) => args.test(5) };

            expectNexoError(failureOf('word.check(w => w.size > 2)'), 'NEXO5503', 'evaluation');
        });

        it('NEXO5009: a hook that throws, before or after an invocation or after a completed evaluation', () => {
            expectNexoError(failureOf('word.size', undefined, { beforeInvoke: () => { throw new Error('refused'); } }), 'NEXO5009', 'evaluation');
            expectNexoError(failureOf('word.size', undefined, { afterInvoke: () => { throw new Error('no record'); } }), 'NEXO5009', 'evaluation');
            expectNexoError(failureOf('word.size', undefined, { afterEvaluation: () => { throw new Error('no cleanup'); } }), 'NEXO5009', 'evaluation');
        });

        it('NEXO5011: evaluating without beforeInvoke a script that reads a maintained member', () => {
            expectNexoError(failureOf('word.quoted'), 'NEXO5011', 'evaluation');
            expectNexoError(failureOf('word.quoted', undefined, { afterInvoke: () => {} }), 'NEXO5011', 'evaluation');
        });
    });

    describe('of the checks an evaluation keeps where resolution has made sure already', () => {
        it('NEXO5500: an interpolation of what is no string or number', () => {
            const failure = errorThrownBy(() => directEvaluatorOf([], 'return $"a {label}"', { label: 'a' }, { label: true }).evaluate());

            expectNexoError(failure, 'NEXO5500', 'evaluation');
            // A failure raised within a compiled part is located at that part.
            expect(failure.location).toEqual({ pointer: '/expression/result/parts/1/expression', offset: 12, line: 1, column: 13 });
        });

        it('NEXO5501: a comparison of what is no number', () => {
            expectNexoError(errorThrownBy(() => directEvaluatorOf([], 'count < 2', { count: 1 }, { count: 'one' }).evaluate()), 'NEXO5501', 'evaluation');
        });

        it('NEXO5505: arithmetic on what is no number', () => {
            expectNexoError(errorThrownBy(() => directEvaluatorOf([], 'count + 1', { count: 1 }, { count: 'one' }).evaluate()), 'NEXO5505', 'evaluation');
            expectNexoError(errorThrownBy(() => directEvaluatorOf([], '-count', { count: 1 }, { count: 'one' }).evaluate()), 'NEXO5505', 'evaluation');
        });

        it('NEXO5504: a function given to a member that gives a value its callback contract does not declare', () => {
            behaviors = {};

            expectNexoError(errorThrownBy(() => directEvaluatorOf([createPantry()], 'word.check(w => flag)', { word: 'oat', flag: true }, { word: 'oat', flag: 'yes' }).evaluate()), 'NEXO5504', 'evaluation');
        });

        it('NEXO4001: a used member or conversion without an implementation, reached by an evaluator made without the entry point\'s check', () => {
            const member = errorThrownBy(() => directEvaluatorOf([createBare()], 'word.weight', { word: 'oat' }).evaluate());
            const conversion = errorThrownBy(() => directEvaluatorOf([createBare()], '(word to Mug).size', { word: 'oat' }).evaluate());

            expectNexoError(member, 'NEXO4001', 'module');
            expectNexoError(conversion, 'NEXO4001', 'module');
            expect(member.location).toEqual({ pointer: '/expression', offset: 0, line: 1, column: 1 });
            expect(conversion.location).toEqual({ pointer: '/expression/receiver', offset: 1, line: 1, column: 2 });

            const indexers = nexo.createModule('indexers', { types: [extensionDeclaration('Cells', 'Boolean', [createIndexerDeclaration(null, 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')] })])] });

            expect(errorThrownBy(() => directEvaluatorOf([indexers], 'flag["k"]', { flag: true }).evaluate())).toMatchObject({ code: 'NEXO4001', message: expect.stringContaining("The module 'indexers' gives '[…]' no implementation") });
        });
    });

    describe('of values of Any', () => {
        /** The error evaluating the text throws, where the pantry's word holds the value given. */
        const holding = (value, text) => {
            behaviors = { held: value };

            return failureOf(text);
        };

        it('NEXO5012: a deferred access whose receiver\'s actual type lacks the member', () => {
            expectNexoError(holding(1, 'word.held.device'), 'NEXO5012', 'evaluation');
        });

        it('NEXO5013: a deferred access whose selection would be a host call', () => {
            expectNexoError(holding('oat', '{ count = word.held.order(1) }'), 'NEXO5013', 'evaluation');
        });

        it('NEXO5021: a value of Any its parameter does not admit', () => {
            expectNexoError(holding('twice', 'word.repeat(word.held)'), 'NEXO5021', 'evaluation');
        });

        it('NEXO5022: a direct access on null at a deferred access', () => {
            expectNexoError(holding({ inner: null }, 'word.held.inner.size'), 'NEXO5022', 'evaluation');
        });

        it('NEXO5024: an equality of values of types that fit neither way', () => {
            expectNexoError(holding(1, 'word.held == "oat"'), 'NEXO5024', 'evaluation');
        });

        it('NEXO5025: an equality of a list with a value that is not null', () => {
            expectNexoError(holding([1], 'word.held == word.held'), 'NEXO5025', 'evaluation');
        });

        it('NEXO5028: a result holding a value of Any that is no data', () => {
            expectNexoError(holding(new Thermostat('heater'), 'word.held'), 'NEXO5028', 'evaluation');
        });
    });

    describe('the failure contract', () => {
        it('makes an implementation\'s thrown error the cause of Nexo\'s own, exactly as thrown', () => {
            const thrown = new Error('no scale');

            behaviors = { size: () => { throw thrown; } };

            const failure = failureOf('word.size');

            expectNexoError(failure, 'NEXO5007', 'evaluation');
            expect(failure.cause).toBe(thrown);
            expect(failure.location).toMatchObject({ pointer: '/expression' });
        });

        it('makes a thrown value that is no error the cause, unchanged', () => {
            for (const thrown of ['no scale', 42, null, undefined, Object.create(null)]) {
                behaviors = { size: () => { throw thrown; } };

                const failure = failureOf('word.size');

                expectNexoError(failure, 'NEXO5007', 'evaluation');
                expect(Object.hasOwn(failure, 'cause')).toBe(true);
                expect(failure.cause).toBe(thrown);
            }
        });

        it('keeps a code the thrown value carries on it, never copied into Nexo\'s', () => {
            const thrown = Object.assign(new Error('no scale'), { code: 'PANTRY0001' });

            behaviors = { size: () => { throw thrown; } };

            const failure = failureOf('word.size');

            expect(failure.code).toBe('NEXO5007');
            expect(failure.cause).toBe(thrown);
            expect(thrown.code).toBe('PANTRY0001');
        });

        it('never wraps again a Nexo error an implementation lets through, as a nested evaluation\'s failure', () => {
            const inner = evaluatorOf('1 / none', { none: 0 });
            const innerFailure = errorThrownBy(() => inner.evaluate());

            behaviors = { size: () => inner.evaluate() };

            const failure = failureOf('word.size');

            expectNexoError(failure, 'NEXO5005', 'evaluation');
            expect(failure.message).toBe(innerFailure.message);
            expect(failure.cause).toBeUndefined();
        });

        it('wraps a NexoError a host builds, thrown from an implementation, a hook or a conversion, keeping it as the cause', () => {
            const built = NexoError.evaluation('PANTRY0002', 'The pantry is closed', {});
            const expectWrapped = (failure, code) => {
                expectNexoError(failure, code, 'evaluation');
                expect(failure.cause).toBe(built);
                expect(built.code).toBe('PANTRY0002');
            };

            behaviors = { size: () => { throw built; } };
            expectWrapped(failureOf('word.size'), 'NEXO5007');

            behaviors = {};
            expectWrapped(failureOf('word.size', undefined, { beforeInvoke: () => { throw built; } }), 'NEXO5009');
            expectWrapped(failureOf('word.size', undefined, { afterInvoke: () => { throw built; } }), 'NEXO5009');
            expectWrapped(failureOf('word.size', undefined, { afterEvaluation: () => { throw built; } }), 'NEXO5009');

            behaviors = { convert: () => { throw built; } };
            expectWrapped(failureOf('(word to Cup).size'), 'NEXO5003');
        });

        it('never wraps again a failure Nexo raised within a function given to a member, which the member lets through', () => {
            let raised;

            behaviors = {
                check: ({ receiver, args }) => {
                    try {
                        return args.test(receiver);
                    } catch (error) {
                        raised = error;

                        throw error;
                    }
                },
            };

            const failure = failureOf('word.check(w => 1 / none > 0)', { word: 'oat', none: 0 });

            expect(failure).toBe(raised);
            expectNexoError(failure, 'NEXO5005', 'evaluation');
            expect(failure.cause).toBeUndefined();
        });

        it('wraps another error a member throws after catching a failure within a function it was given', () => {
            const thrown = new Error('no check');

            behaviors = {
                check: ({ receiver, args }) => {
                    try {
                        return args.test(receiver);
                    } catch {
                        throw thrown;
                    }
                },
            };

            const failure = failureOf('word.check(w => 1 / none > 0)', { word: 'oat', none: 0 });

            expectNexoError(failure, 'NEXO5007', 'evaluation');
            expect(failure.cause).toBe(thrown);
        });

        it('never wraps again a Nexo error a conversion lets through, and makes anything else it throws the cause', () => {
            const inner = evaluatorOf('1 / none', { none: 0 });

            behaviors = { convert: () => inner.evaluate() };

            expectNexoError(failureOf('(word to Cup).size'), 'NEXO5005', 'evaluation');

            behaviors = { convert: () => { throw 'no cups'; } };

            const failure = failureOf('(word to Cup).size');

            expectNexoError(failure, 'NEXO5003', 'evaluation');
            expect(failure.cause).toBe('no cups');
        });

        it('makes what a hook throws the cause of Nexo\'s own, exactly as thrown, an error, a value that is none, and one carrying a code', () => {
            behaviors = {};

            const refusal = Object.assign(new Error('refused'), { code: 'PANTRY0003' });
            const before = failureOf('word.size', undefined, { beforeInvoke: () => { throw refusal; } });
            const after = failureOf('word.size', undefined, { afterInvoke: () => { throw 'no record'; } });

            expectNexoError(before, 'NEXO5009', 'evaluation');
            expect(before.cause).toBe(refusal);
            expect(refusal.code).toBe('PANTRY0003');
            expect(before.location).toMatchObject({ pointer: '/expression' });
            expectNexoError(after, 'NEXO5009', 'evaluation');
            expect(after.cause).toBe('no record');
        });

        it('fails a completed evaluation whose afterEvaluation throws with Nexo\'s own, and keeps a failed evaluation\'s failure, the cleanup failure recorded on it', () => {
            behaviors = {};

            const cleanup = new Error('no cleanup');
            const completed = failureOf('word.size', undefined, { afterEvaluation: () => { throw cleanup; } });

            expectNexoError(completed, 'NEXO5009', 'evaluation');
            expect(completed.cause).toBe(cleanup);

            const failed = failureOf('1 / none', { none: 0 }, { afterEvaluation: () => { throw cleanup; } });

            expectNexoError(failed, 'NEXO5005', 'evaluation');
            expect(failed.suppressed).toBe(cleanup);
        });
    });
});
