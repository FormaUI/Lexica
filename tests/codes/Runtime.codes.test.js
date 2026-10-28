import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { Evaluator } from '#lexica/language/Evaluator.mjs';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { Device, Light, Room, Thermostat, homeTypeOf, homeTypes, withHome } from '../support/home.mjs';
import { errorThrownBy, expectLexicaError } from '../support/errors.mjs';
import { constantUpdates, derivedUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from '../support/declarations.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createFunctionParameterDeclaration, createFunctionDeclaration, createIndexerDeclaration } = lexica.declarations;

/** What the test gives a member's implementation to do, by the member's name, so each test decides how its member fails. */
let behaviors = {};

/** The function a member of the pantry was given last, which a later member calls after the first's invocation has ended. */
let kept = null;

/**
 * A pantry's module on words: a word's size, the device it names, a value it answers as the test says, a value of Any the test gives, a word repeated a number of times, a maintained quote, a check that calls the test it is given, a member
 * that keeps it and one that calls it later, and a cup a word converts to, through the conversion the test gives.
 */
const createPantry = () => lexica.createModule('pantry', withHome({
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
const createBare = () => lexica.createModule('bare', {
    types: [{ name: 'Mug', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }, extensionDeclaration('StringExtensions', 'String', [createPropertyDeclaration('weight', 'Number', { updates: constantUpdates }), operatorDeclaration('convert', 'Mug')])],
});

/** The evaluator of the text against a registry of the pantry, bound to the values given. */
const evaluatorOf = (text, values = { word: 'oat' }, env = {}) => lexica.createRegistry([createPantry()]).resolve(text, values).createEvaluator(values, env);

/** The error evaluating the text throws, for the host given. */
const failureOf = (text, values = { word: 'oat' }, host = null) => errorThrownBy(() => evaluatorOf(text, values).evaluate(host));

/**
 * An evaluator made directly, the text resolved with one set of values and evaluated with another, so it reaches what the public entry point refuses before evaluating: the checks an evaluation keeps where resolution has already made sure.
 */
const directEvaluatorOf = (modules, text, resolvedWith, evaluatedWith = resolvedWith) => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);
    const definition = ParsedTexts.parse(text);
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, new ParameterBindings(registry, resolvedWith), locations).resolveDefinition(definition);

    return new Evaluator(registry, resolved, new ParameterBindings(registry, evaluatedWith), {}, locations);
};

describe('the runtime codes', () => {
    describe('of bindings', () => {
        it('LEXICA2020: bindings that are not a plain object', () => {
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings([1])), 'LEXICA2020', 'structure');
        });

        it('LEXICA2033: a binding not named by a letter followed by letters and digits', () => {
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ 'floor-area': 1 })), 'LEXICA2033', 'structure');
        });

        it('LEXICA2034: a binding that is not data and that nothing recognizes', () => {
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ shelf: new Map() })), 'LEXICA2034', 'structure');
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ weight: Number.NaN })), 'LEXICA2034', 'structure');
        });

        it('LEXICA2022: a bound value holding a cycle', () => {
            const shelf = { name: 'top' };

            shelf.self = shelf;

            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ shelf })), 'LEXICA2022', 'structure');
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ shelves: [shelf] })), 'LEXICA2022', 'structure');
        });

        it('LEXICA2021: a bound list whose items share no type', () => {
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ items: [1, 'two'] })), 'LEXICA2021', 'structure');
            expectLexicaError(errorThrownBy(() => lexica.createRegistry([lexica.createModule('home', withHome())]).createBindings({ items: [new Room('hall'), new Light('lamp')] })), 'LEXICA2021', 'structure');
        });
    });

    describe('of reference bindings', () => {
        const home = () => lexica.createRegistry([lexica.createModule('home', withHome())]);
        const recognizing = (typeOf, types = homeTypes) => lexica.createRegistry([lexica.createModule('home', { typeOf, types })]);

        it('LEXICA2034: a value no module recognizes that is no data', () => {
            expectLexicaError(errorThrownBy(() => lexica.createRegistry().createBindings({ lamp: new Light('lamp') })), 'LEXICA2034', 'structure');
        });

        it('LEXICA2035: a value modules recognize as unrelated types', () => {
            const garden = lexica.createModule('garden', { typeOf: value => (value instanceof Light ? 'Lamp' : null), types: [{ name: 'Lamp', kind: 'reference', isInstance: value => value instanceof Light }] });

            expectLexicaError(errorThrownBy(() => lexica.createRegistry([lexica.createModule('home', withHome()), garden]).createBindings({ lamp: new Light('lamp') })), 'LEXICA2035', 'structure');
        });

        it('LEXICA2036: a declared type that no public type is, or that the value does not belong to', () => {
            expectLexicaError(errorThrownBy(() => home().createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Lantern' } })), 'LEXICA2036', 'structure');
            expectLexicaError(errorThrownBy(() => home().createBindings({ lamp: new Thermostat('heater') }, { types: { lamp: 'Light' } })), 'LEXICA2036', 'structure');
        });

        it('LEXICA2037: a declared type several types share unqualified', () => {
            const office = lexica.createModule('office', { types: [{ name: 'Device', kind: 'reference', isInstance: () => true }] });

            expectLexicaError(errorThrownBy(() => lexica.createRegistry([lexica.createModule('home', withHome()), office]).createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Device' } })), 'LEXICA2037', 'structure');
        });

        it('LEXICA2023: a declared type that is not a reference type', () => {
            expectLexicaError(errorThrownBy(() => home().createBindings({ lamp: new Light('lamp') }, { types: { lamp: 'Number' } })), 'LEXICA2023', 'structure');
        });

        it('LEXICA2038: a type declared for a value that is not a reference', () => {
            expectLexicaError(errorThrownBy(() => home().createBindings({ lamp: 'lamp' }, { types: { lamp: 'Light' } })), 'LEXICA2038', 'structure');
        });

        it('LEXICA2039: a type declared for anything but a top-level binding', () => {
            expectLexicaError(errorThrownBy(() => home().createBindings({ room: { lamp: new Light('lamp') } }, { types: { lamp: 'Light' } })), 'LEXICA2039', 'structure');
        });

        it('LEXICA2024: resolving or evaluating with a binding set another registry made', () => {
            const bindings = home().createBindings({ lamp: new Light('lamp') });
            const other = home();

            expectLexicaError(errorThrownBy(() => other.resolve('lamp.name == null', bindings)), 'LEXICA2024', 'structure');
            expectLexicaError(errorThrownBy(() => other.resolve('lamp == null', { lamp: new Light('lamp') }).createEvaluator(bindings)), 'LEXICA2024', 'structure');
        });

        it('LEXICA5002: a typeOf naming what is no reference type of its module, an abstract one, or one the value does not belong to', () => {
            const abstract = [{ name: 'Device', kind: 'reference', abstract: true, isInstance: value => value instanceof Device }];

            for (const [typeOf, types] of [[() => 'Lantern', homeTypes], [() => 5, homeTypes], [() => 'Device', abstract], [() => 'Room', homeTypes]]) {
                expectLexicaError(errorThrownBy(() => recognizing(typeOf, types).createBindings({ lamp: new Light('lamp') })), 'LEXICA5002', 'evaluation');
            }
        });

        it('LEXICA5026: a typeOf that throws, what it threw the cause', () => {
            const thrown = new Error('unrecognizable');
            const failure = errorThrownBy(() => recognizing(() => { throw thrown; }).createBindings({ lamp: new Light('lamp') }));

            expectLexicaError(failure, 'LEXICA5026', 'evaluation');
            expect(failure.cause).toBe(thrown);
        });

        it('LEXICA5017: an isInstance answering what isn\'t a Boolean', () => {
            const types = [{ name: 'Light', kind: 'reference', isInstance: () => 'yes' }];

            expectLexicaError(errorThrownBy(() => recognizing(() => 'Light', types).createBindings({ lamp: new Light('lamp') })), 'LEXICA5017', 'evaluation');
        });

        it('LEXICA5027: an isInstance that throws, what it threw the cause', () => {
            const types = [{ name: 'Light', kind: 'reference', isInstance: () => { throw 'unknown'; } }];
            const failure = errorThrownBy(() => recognizing(() => 'Light', types).createBindings({ lamp: new Light('lamp') }));

            expectLexicaError(failure, 'LEXICA5027', 'evaluation');
            expect(failure.cause).toBe('unknown');
        });

        it('check a supertype\'s membership too, where a type beneath it answers true', () => {
            const types = [{ name: 'Device', kind: 'reference', isInstance: () => false }, { name: 'Light', kind: 'reference', supertype: 'Device', isInstance: () => true }];

            expectLexicaError(errorThrownBy(() => recognizing(homeTypeOf, types).createBindings({ lamp: new Light('lamp') })), 'LEXICA5002', 'evaluation');
        });
    });

    describe('of the entry point', () => {
        const registry = lexica.createRegistry([createPantry()]);

        it('LEXICA2640: a definition reading through a namespace, formatted without a registry', () => {
            expectLexicaError(errorThrownBy(() => lexica.format(registry.parse('pantry.size'))), 'LEXICA2640', 'structure');
            expectLexicaError(errorThrownBy(() => lexica.quote(registry.parse('pantry.size'))), 'LEXICA2640', 'structure');
        });

        it('LEXICA2641: a definition read without the registry\'s module names that writes one of them alone', () => {
            expectLexicaError(errorThrownBy(() => registry.resolve(lexica.parse('pantry.size'))), 'LEXICA2641', 'structure');
        });

        it('LEXICA2642: a namespace no module the registry holds gives', () => {
            expectLexicaError(errorThrownBy(() => registry.resolve({ version: 33, expression: { kind: 'member', target: { kind: 'namespace', name: 'bakery' }, name: 'open' } })), 'LEXICA2642', 'structure');
        });

        it('LEXICA2643: a pointer that is not a JSON Pointer', () => {
            expectLexicaError(errorThrownBy(() => lexica.getLocation(lexica.parse('1 + 2'), 'expression')), 'LEXICA2643', 'structure');
            expectLexicaError(errorThrownBy(() => registry.resolve('1 + 2').getLocation(5)), 'LEXICA2643', 'structure');
        });

        it('LEXICA2644: a pointer at nothing the definition holds', () => {
            expectLexicaError(errorThrownBy(() => lexica.getLocation(lexica.parse('1 + 2'), '/expression/middle')), 'LEXICA2644', 'structure');
        });

        it('LEXICA2645: parsing what is not a script\'s source', () => {
            expectLexicaError(errorThrownBy(() => lexica.parse(5)), 'LEXICA2645', 'structure');
            expectLexicaError(errorThrownBy(() => registry.parse({ version: 33 })), 'LEXICA2645', 'structure');
            expect(errorThrownBy(() => lexica.parse(5)).message).toBe("What parse reads is a script's source");
        });

        it('LEXICA2040: creating or entering an evaluator after its registry\'s revision has moved', () => {
            const growing = lexica.createRegistry([createPantry()]);
            const resolution = growing.resolve('word.size', { word: 'oat' });
            const evaluator = resolution.createEvaluator({ word: 'oat' });

            growing.registerModule(lexica.createModule('bakery', {}));

            expectLexicaError(errorThrownBy(() => resolution.createEvaluator({ word: 'oat' })), 'LEXICA2040', 'structure');
            expectLexicaError(errorThrownBy(() => evaluator.evaluate()), 'LEXICA2040', 'structure');
        });

        it('LEXICA2025: creating an evaluator with bindings of another resolution key', () => {
            const resolution = registry.resolve('word.size', { word: 'oat' });

            expectLexicaError(errorThrownBy(() => resolution.createEvaluator({ word: 5 })), 'LEXICA2025', 'structure');
        });

        it('LEXICA4001: creating an evaluator for a resolution whose used member or conversion has no implementation', () => {
            const bare = lexica.createRegistry([createBare()]);

            const member = errorThrownBy(() => bare.resolve('word.weight', { word: 'oat' }).createEvaluator({ word: 'oat' }));
            const conversion = errorThrownBy(() => bare.resolve('(word to Mug).size', { word: 'oat' }).createEvaluator({ word: 'oat' }));

            expectLexicaError(member, 'LEXICA4001', 'module');
            expectLexicaError(conversion, 'LEXICA4001', 'module');
            expect(member.location).toEqual({ module: 'bare', type: 'StringExtensions', declaration: 'weight', declarationKey: 'impl' });
            expect(conversion.location).toEqual({ module: 'bare', type: 'StringExtensions', declaration: 'convert', declarationKey: 'impl' });
        });

        it('LEXICA5010: evaluating an evaluator from within its own evaluation', () => {
            const holder = {};

            behaviors = { size: () => holder.evaluator.evaluate() };
            holder.evaluator = evaluatorOf('word.size');

            expectLexicaError(errorThrownBy(() => holder.evaluator.evaluate()), 'LEXICA5010', 'evaluation');
        });
    });

    describe('of result paths', () => {
        const registry = lexica.createRegistry([createPantry()]);

        it('LEXICA2646: a path item that is neither a name nor a list index', () => {
            expectLexicaError(errorThrownBy(() => lexica.paths.validate(['total', -1])), 'LEXICA2646', 'structure');
            expectLexicaError(errorThrownBy(() => lexica.paths.validate(['total', 'floor-area'])), 'LEXICA2646', 'structure');
        });

        it('LEXICA3600: a path into the result of a host call that supplies nothing', () => {
            expectLexicaError(errorThrownBy(() => registry.resolve('word.drop()', { word: 'oat' }).typeAt([])), 'LEXICA3600', 'validation');
        });

        it('LEXICA3601: a path indexing what is not a list', () => {
            expectLexicaError(errorThrownBy(() => registry.resolve('{ total = 1 }').typeAt(['total', 0])), 'LEXICA3601', 'validation');
        });

        it('LEXICA3602: a path naming a field the result does not hold', () => {
            expectLexicaError(errorThrownBy(() => registry.resolve('{ total = 1 }').typeAt(['count'])), 'LEXICA3602', 'validation');
        });
    });

    describe('of evaluation', () => {
        it('LEXICA5014: preparing a script that ends in no host call', () => {
            expectLexicaError(errorThrownBy(() => evaluatorOf('word.size').prepareHostCall()), 'LEXICA5014', 'evaluation');
        });

        it('LEXICA5023: evaluating a script that ends in a host call', () => {
            expectLexicaError(failureOf('word.order(2)'), 'LEXICA5023', 'evaluation');
        });

        it('LEXICA5015: a value a host supplies that its host call\'s declared result does not admit', () => {
            const call = evaluatorOf('word.order(2)').prepareHostCall();

            expectLexicaError(errorThrownBy(() => call.project('many')), 'LEXICA5015', 'evaluation');
        });

        it('LEXICA5001: a value a strict cast rejects, naming the type its value is of', () => {
            const failure = failureOf('(word.device as Light) == null');

            expectLexicaError(failure, 'LEXICA5001', 'evaluation');
            expect(failure.message).toContain('The cast to Light rejected its value: it is a Device that isn\'t a Light');
            expect(evaluatorOf('(try word.device as Light) == null').evaluate().value).toBe(true);
        });

        it('LEXICA5016: a value a conversion rejects', () => {
            expectLexicaError(failureOf('word to Number', { word: '12px' }), 'LEXICA5016', 'evaluation');
        });

        it('LEXICA5003: a conversion that throws', () => {
            behaviors = { convert: () => { throw new Error('no cups'); } };

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5003', 'evaluation');
        });

        it('LEXICA5018: a conversion that rejects with a reason that is not a string, or rejects and then answers', () => {
            behaviors = { convert: ({ reject }) => reject(5) };

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5018', 'evaluation');

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

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5018', 'evaluation');
        });

        it('LEXICA5019: a conversion that answers a value not of its type', () => {
            behaviors = { convert: () => ({ size: 'large' }) };

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5019', 'evaluation');

            behaviors = { convert: () => null };

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5019', 'evaluation');
        });

        it('LEXICA5005: a division or a remainder by zero', () => {
            expectLexicaError(failureOf('1 / none', { none: 0 }), 'LEXICA5005', 'evaluation');
            expectLexicaError(failureOf('1 % none', { none: 0 }), 'LEXICA5005', 'evaluation');
        });

        it('LEXICA5020: an arithmetic result no finite number holds', () => {
            expectLexicaError(failureOf('big * big', { big: 1e308 }), 'LEXICA5020', 'evaluation');
        });

        it('LEXICA5006: a module returning a value of a type other than the one it declared', () => {
            behaviors = { size: () => 'three' };

            expectLexicaError(failureOf('word.size'), 'LEXICA5006', 'evaluation');
        });

        it('LEXICA5006: a module returning a number no finite number holds, described as it is, alone or within data', () => {
            for (const [answer, described] of [[Infinity, 'Infinity'], [-Infinity, '-Infinity'], [NaN, 'NaN'], [[1, -Infinity, NaN], '[1,-Infinity,NaN]'], [{ low: NaN, label: 'Infinity' }, '{"low":NaN,"label":"Infinity"}']]) {
                behaviors = { size: () => answer };

                const error = failureOf('word.size');

                expectLexicaError(error, 'LEXICA5006', 'evaluation');
                expect(error.message, described).toContain(`answered ${described}, and it declares Number`);
            }
        });

        it('LEXICA5007: a member whose implementation throws', () => {
            behaviors = { size: () => { throw new Error('no scale'); } };

            expectLexicaError(failureOf('word.size'), 'LEXICA5007', 'evaluation');
        });

        it('LEXICA5008: a function given to a member called after that member\'s invocation has ended', () => {
            expectLexicaError(failureOf('{ kept = word.keep(w => w.size > 2), called = word.callKept() }'), 'LEXICA5008', 'evaluation');
        });

        it('LEXICA5503: a member calling a function it was given with arguments its callback contract does not declare', () => {
            behaviors = { check: ({ args }) => args.test() };

            expectLexicaError(failureOf('word.check(w => w.size > 2)'), 'LEXICA5503', 'evaluation');

            behaviors = { check: ({ args }) => args.test(5) };

            expectLexicaError(failureOf('word.check(w => w.size > 2)'), 'LEXICA5503', 'evaluation');
        });

        it('LEXICA5009: a hook that throws, before or after an invocation or after a completed evaluation', () => {
            expectLexicaError(failureOf('word.size', undefined, { beforeInvoke: () => { throw new Error('refused'); } }), 'LEXICA5009', 'evaluation');
            expectLexicaError(failureOf('word.size', undefined, { afterInvoke: () => { throw new Error('no record'); } }), 'LEXICA5009', 'evaluation');
            expectLexicaError(failureOf('word.size', undefined, { afterEvaluation: () => { throw new Error('no cleanup'); } }), 'LEXICA5009', 'evaluation');
        });

        it('LEXICA5011: evaluating without beforeInvoke a script that reads a maintained member', () => {
            expectLexicaError(failureOf('word.quoted'), 'LEXICA5011', 'evaluation');
            expectLexicaError(failureOf('word.quoted', undefined, { afterInvoke: () => {} }), 'LEXICA5011', 'evaluation');
        });
    });

    describe('of the checks an evaluation keeps where resolution has made sure already', () => {
        it('LEXICA5500: an interpolation of what is no string or number', () => {
            const failure = errorThrownBy(() => directEvaluatorOf([], 'return $"a {label}"', { label: 'a' }, { label: true }).evaluate());

            expectLexicaError(failure, 'LEXICA5500', 'evaluation');
            // A failure raised within a compiled part is located at that part.
            expect(failure.location).toEqual({ pointer: '/expression/result/parts/1/expression', offset: 12, line: 1, column: 13 });
        });

        it('LEXICA5501: a comparison of what is no number', () => {
            expectLexicaError(errorThrownBy(() => directEvaluatorOf([], 'count < 2', { count: 1 }, { count: 'one' }).evaluate()), 'LEXICA5501', 'evaluation');
        });

        it('LEXICA5505: arithmetic on what is no number', () => {
            expectLexicaError(errorThrownBy(() => directEvaluatorOf([], 'count + 1', { count: 1 }, { count: 'one' }).evaluate()), 'LEXICA5505', 'evaluation');
            expectLexicaError(errorThrownBy(() => directEvaluatorOf([], '-count', { count: 1 }, { count: 'one' }).evaluate()), 'LEXICA5505', 'evaluation');
        });

        it('LEXICA5504: a function given to a member that gives a value its callback contract does not declare', () => {
            behaviors = {};

            expectLexicaError(errorThrownBy(() => directEvaluatorOf([createPantry()], 'word.check(w => flag)', { word: 'oat', flag: true }, { word: 'oat', flag: 'yes' }).evaluate()), 'LEXICA5504', 'evaluation');
        });

        it('LEXICA4001: a used member or conversion without an implementation, reached by an evaluator made without the entry point\'s check', () => {
            const member = errorThrownBy(() => directEvaluatorOf([createBare()], 'word.weight', { word: 'oat' }).evaluate());
            const conversion = errorThrownBy(() => directEvaluatorOf([createBare()], '(word to Mug).size', { word: 'oat' }).evaluate());

            expectLexicaError(member, 'LEXICA4001', 'module');
            expectLexicaError(conversion, 'LEXICA4001', 'module');
            expect(member.location).toEqual({ pointer: '/expression', offset: 0, line: 1, column: 1 });
            expect(conversion.location).toEqual({ pointer: '/expression/target', offset: 1, line: 1, column: 2 });

            const indexers = lexica.createModule('indexers', { types: [extensionDeclaration('Cells', 'String', [createIndexerDeclaration(null, 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')] })])] });

            expect(errorThrownBy(() => directEvaluatorOf([indexers], 'word["k"]', { word: 'oat' }).evaluate())).toMatchObject({ code: 'LEXICA4001', message: expect.stringContaining("The module 'indexers' gives '[…]' no implementation") });
        });
    });

    describe('of values of Any', () => {
        /** The error evaluating the text throws, where the pantry's word holds the value given. */
        const holding = (value, text) => {
            behaviors = { held: value };

            return failureOf(text);
        };

        it('LEXICA5012: a deferred access whose receiver\'s actual type lacks the member', () => {
            expectLexicaError(holding(1, 'word.held.device'), 'LEXICA5012', 'evaluation');
        });

        it('LEXICA5013: a deferred access whose selection would be a host call', () => {
            expectLexicaError(holding('oat', '{ count = word.held.order(1) }'), 'LEXICA5013', 'evaluation');
        });

        it('LEXICA5021: a value of Any its parameter does not admit', () => {
            expectLexicaError(holding('twice', 'word.repeat(word.held)'), 'LEXICA5021', 'evaluation');
        });

        it('LEXICA5022: a direct access on null at a deferred access', () => {
            expectLexicaError(holding({ inner: null }, 'word.held.inner.size'), 'LEXICA5022', 'evaluation');
        });

        it('LEXICA5024: an equality of values of types that fit neither way', () => {
            expectLexicaError(holding(1, 'word.held == "oat"'), 'LEXICA5024', 'evaluation');
        });

        it('LEXICA5025: an equality of a list with a value that is not null', () => {
            expectLexicaError(holding([1], 'word.held == word.held'), 'LEXICA5025', 'evaluation');
        });

        it('LEXICA5028: a result holding a value of Any that is no data', () => {
            expectLexicaError(holding(new Thermostat('heater'), 'word.held'), 'LEXICA5028', 'evaluation');
        });
    });

    describe('the failure contract', () => {
        it('makes an implementation\'s thrown error the cause of Lexica\'s own, exactly as thrown', () => {
            const thrown = new Error('no scale');

            behaviors = { size: () => { throw thrown; } };

            const failure = failureOf('word.size');

            expectLexicaError(failure, 'LEXICA5007', 'evaluation');
            expect(failure.cause).toBe(thrown);
            expect(failure.location).toMatchObject({ pointer: '/expression' });
        });

        it('makes a thrown value that is no error the cause, unchanged', () => {
            for (const thrown of ['no scale', 42, null, undefined, Object.create(null)]) {
                behaviors = { size: () => { throw thrown; } };

                const failure = failureOf('word.size');

                expectLexicaError(failure, 'LEXICA5007', 'evaluation');
                expect(Object.hasOwn(failure, 'cause')).toBe(true);
                expect(failure.cause).toBe(thrown);
            }
        });

        it('keeps a code the thrown value carries on it, never copied into Lexica\'s', () => {
            const thrown = Object.assign(new Error('no scale'), { code: 'PANTRY0001' });

            behaviors = { size: () => { throw thrown; } };

            const failure = failureOf('word.size');

            expect(failure.code).toBe('LEXICA5007');
            expect(failure.cause).toBe(thrown);
            expect(thrown.code).toBe('PANTRY0001');
        });

        it('never wraps again a Lexica error an implementation lets through, as a nested evaluation\'s failure', () => {
            const inner = evaluatorOf('1 / none', { none: 0 });
            const innerFailure = errorThrownBy(() => inner.evaluate());

            behaviors = { size: () => inner.evaluate() };

            const failure = failureOf('word.size');

            expectLexicaError(failure, 'LEXICA5005', 'evaluation');
            expect(failure.message).toBe(innerFailure.message);
            expect(failure.cause).toBeUndefined();
        });

        it('wraps a LexicaError a host builds, thrown from an implementation, a hook or a conversion, keeping it as the cause', () => {
            const built = LexicaError.evaluation('PANTRY0002', 'The pantry is closed', {});
            const expectWrapped = (failure, code) => {
                expectLexicaError(failure, code, 'evaluation');
                expect(failure.cause).toBe(built);
                expect(built.code).toBe('PANTRY0002');
            };

            behaviors = { size: () => { throw built; } };
            expectWrapped(failureOf('word.size'), 'LEXICA5007');

            behaviors = {};
            expectWrapped(failureOf('word.size', undefined, { beforeInvoke: () => { throw built; } }), 'LEXICA5009');
            expectWrapped(failureOf('word.size', undefined, { afterInvoke: () => { throw built; } }), 'LEXICA5009');
            expectWrapped(failureOf('word.size', undefined, { afterEvaluation: () => { throw built; } }), 'LEXICA5009');

            behaviors = { convert: () => { throw built; } };
            expectWrapped(failureOf('(word to Cup).size'), 'LEXICA5003');
        });

        it('never wraps again a failure Lexica raised within a function given to a member, which the member lets through', () => {
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
            expectLexicaError(failure, 'LEXICA5005', 'evaluation');
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

            expectLexicaError(failure, 'LEXICA5007', 'evaluation');
            expect(failure.cause).toBe(thrown);
        });

        it('never wraps again a Lexica error a conversion lets through, and makes anything else it throws the cause', () => {
            const inner = evaluatorOf('1 / none', { none: 0 });

            behaviors = { convert: () => inner.evaluate() };

            expectLexicaError(failureOf('(word to Cup).size'), 'LEXICA5005', 'evaluation');

            behaviors = { convert: () => { throw 'no cups'; } };

            const failure = failureOf('(word to Cup).size');

            expectLexicaError(failure, 'LEXICA5003', 'evaluation');
            expect(failure.cause).toBe('no cups');
        });

        it('makes what a hook throws the cause of Lexica\'s own, exactly as thrown, an error, a value that is none, and one carrying a code', () => {
            behaviors = {};

            const refusal = Object.assign(new Error('refused'), { code: 'PANTRY0003' });
            const before = failureOf('word.size', undefined, { beforeInvoke: () => { throw refusal; } });
            const after = failureOf('word.size', undefined, { afterInvoke: () => { throw 'no record'; } });

            expectLexicaError(before, 'LEXICA5009', 'evaluation');
            expect(before.cause).toBe(refusal);
            expect(refusal.code).toBe('PANTRY0003');
            expect(before.location).toMatchObject({ pointer: '/expression' });
            expectLexicaError(after, 'LEXICA5009', 'evaluation');
            expect(after.cause).toBe('no record');
        });

        it('fails a completed evaluation whose afterEvaluation throws with Lexica\'s own, and keeps a failed evaluation\'s failure, the cleanup failure recorded on it', () => {
            behaviors = {};

            const cleanup = new Error('no cleanup');
            const completed = failureOf('word.size', undefined, { afterEvaluation: () => { throw cleanup; } });

            expectLexicaError(completed, 'LEXICA5009', 'evaluation');
            expect(completed.cause).toBe(cleanup);

            const failed = failureOf('1 / none', { none: 0 }, { afterEvaluation: () => { throw cleanup; } });

            expectLexicaError(failed, 'LEXICA5005', 'evaluation');
            expect(failed.suppressed).toBe(cleanup);
        });
    });
});
