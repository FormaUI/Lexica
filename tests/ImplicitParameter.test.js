import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { extensionDeclaration } from './support/declarations.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates, derivedUpdates } from './support/updates.mjs';
import { evaluateWithCreatedBindings, resolveWith, createImportingRegistry } from './support/pipeline.mjs';

const { createPropertyDeclaration, createFunctionParameterDeclaration, createValueParameterDeclaration, createExpressionParameterDeclaration, createPredicateParameterDeclaration, createFunctionDeclaration } = lexica.declarations;

/**
 * A pantry's module on words: a word's size, its weight and whether it is vegan, the last two also module members of the word, which a script names by reference; members that keep the predicate or the expression they are
 * given, so a later call finds it called after its member returned, and one that keeps its predicate in what the host holds and fails; members that call their expression with two items, and with a number; one that picks
 * the words its options' predicate keeps and sums what its options' expression gives of each; and a module member that gives a word to its test.
 */
const createPantry = (held = {}) => {
    let kept = null;

    return lexica.createModule('pantry', {
        types: [
            extensionDeclaration('StringExtensions', 'String', [
                createPropertyDeclaration('size', 'Number', { updates: constantUpdates, impl: ({ receiver }) => receiver.length }),
                createFunctionDeclaration('weight', 'Number', { updates: constantUpdates, impl: ({ receiver }) => receiver.length * 10 }),
                createFunctionDeclaration('vegan', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => receiver.startsWith('oat') }),
                createFunctionDeclaration('callKept', 'Boolean', { updates: derivedUpdates, impl: ({ receiver }) => kept(receiver) }),
                createFunctionDeclaration('check', 'Boolean', {
                    updates: derivedUpdates,
                    arguments: 'options',
                    parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String']), createValueParameterDeclaration('note', 'Boolean?', { default: null })],
                    impl: ({ receiver, args }) => args.test(receiver),
                }),
            ]),
            extensionDeclaration('StringListExtensions', 'List<String>', [
                createFunctionDeclaration('keepWhere', 'Number', { updates: derivedUpdates, parameters: [createPredicateParameterDeclaration()], impl: ({ receiver, args }) => ((kept = args.expression), receiver.length) }),
                createFunctionDeclaration('keepBy', 'Number', { updates: derivedUpdates, parameters: [createExpressionParameterDeclaration('Number')], impl: ({ receiver, args }) => ((kept = args.expression), receiver.length) }),
                createFunctionDeclaration('keepWhereAndFail', 'Number', {
                    updates: derivedUpdates,
                    parameters: [createPredicateParameterDeclaration()],
                    impl: ({ args }) => {
                        held.expression = args.expression;
                        throw new Error('The pantry is closed');
                    },
                }),
                createFunctionDeclaration('weighPair', 'Number', { updates: derivedUpdates, parameters: [createExpressionParameterDeclaration('Number')], impl: ({ args }) => args.expression('oat', 'rye') }),
                createFunctionDeclaration('weighNumber', 'Number', { updates: derivedUpdates, parameters: [createExpressionParameterDeclaration('Number')], impl: ({ args }) => args.expression(42) }),
                createFunctionDeclaration('choose', 'Number', {
                    updates: derivedUpdates,
                    arguments: 'options',
                    parameters: [{ ...createExpressionParameterDeclaration('Number'), name: 'by' }, { ...createPredicateParameterDeclaration(), name: 'keep' }],
                    impl: ({ receiver, args }) => receiver.filter(word => args.keep(word)).reduce((sum, word) => sum + args.by(word), 0),
                }),
            ]),
        ],
        // A word's weight and whether it is vegan as module members of the word, which a script names by reference, and a test of a word its function gives.
        members: [
            createFunctionDeclaration('weight', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('word', 'String')], impl: ({ args }) => args.word.length * 10 }),
            createFunctionDeclaration('vegan', 'Boolean', { updates: constantUpdates, parameters: [createValueParameterDeclaration('word', 'String')], impl: ({ args }) => args.word.startsWith('oat') }),
            createFunctionDeclaration('passes', 'Boolean', {
                updates: derivedUpdates,
                parameters: [createValueParameterDeclaration('word', 'String'), createFunctionParameterDeclaration('test', 'Boolean', ['String'])],
                impl: ({ args }) => args.test(args.word),
            }),
        ],
    });
};

const values = { words: ['oat', 'milk', 'rye'], gaps: ['oat', null], flag: true, chosen: 'rye' };

/** What the text evaluates to against a registry of the pantry. */
const evaluate = (text, bound = values) => evaluateWithCreatedBindings([createPantry()], text, bound);

/** The resolution of the text against a registry of the pantry. */
const resolve = (text, bound = values) => resolveWith([createPantry()], text, bound);

describe('the implicit parameter', () => {
    describe('of an expression argument', () => {
        it('is the item a function of the item is called with, so its body, an arrow function, a function a name holds and a module\'s function by reference give alike', () => {
            const forms = ['words.max(it.weight())', 'words.max(w => w.weight())', 'let weigh = w => w.weight()\nreturn words.max(weigh)', 'words.max(pantry.weight)'];

            expect(forms.map(text => evaluate(text))).toEqual([40, 40, 40, 40]);
        });

        it('keeps the expression\'s result policy for a function as for a body, refusing a result of another type', () => {
            expect(errorThrownBy(() => resolve('words.sum(w => w)')).message).toContain("The function given as 'expression' of 'sum' gives String, and its contract takes Number");
            expect(errorThrownBy(() => resolve('words.sum(it)')).message).toContain("The expression of 'sum' must produce Number");
            expect(errorThrownBy(() => resolve('words.sum(pantry.vegan)')).message).toContain("'pantry.vegan' names no function that takes those or answers that");
        });

        it('gives every item the same value where its body reads no it', () => {
            expect(evaluate('words.sum(1)')).toBe(3);
        });

        it('is a function the member calls only while its invocation lasts, with one item of the list\'s item type, whether a body or an arrow function gives it', () => {
            for (const expression of ['it.size', 'w => w.size']) {
                expect(errorThrownBy(() => evaluate(`{ kept = words.keepBy(${expression}), late = chosen.callKept() }`)), expression).toMatchObject({
                    code: 'LEXICA5008',
                    message: expect.stringContaining("The function given as 'expression' of 'keepBy' is called after 'keepBy' returned"),
                    location: { pointer: '/expression/objectFields/0/value/arguments/0' },
                });
                expect(errorThrownBy(() => evaluate(`words.weighPair(${expression})`)), expression).toMatchObject({
                    code: 'LEXICA5503',
                    message: expect.stringContaining("The function given as 'expression' of 'weighPair' is called with 2 arguments, and its contract declares 1"),
                    location: { pointer: '/expression/arguments/0' },
                });
                expect(errorThrownBy(() => evaluate(`words.weighNumber(${expression})`)), expression).toMatchObject({
                    code: 'LEXICA5503',
                    message: expect.stringContaining("The function given as 'expression' of 'weighNumber' is called with 42, and its contract declares String"),
                    location: { pointer: '/expression/arguments/0' },
                });
            }
        });

        it('refuses a body that reads it and gives a function, giving the function written as the argument', () => {
            expect(errorThrownBy(() => resolve('let weigh = w => w.weight()\nreturn words.max(if it == "oat" then weigh else weigh end)')).message).toContain("a function of the item is written as the argument itself, as max(x => …)");
        });
    });

    describe('of a predicate argument', () => {
        it('is the item a function of the item is called with, its truthiness what the member receives, whatever form gives it', () => {
            const forms = ['words.where(it.vegan())', 'words.where(w => w.vegan())', 'let vegan = w => w.vegan()\nreturn words.where(vegan)', 'words.where(pantry.vegan)'];

            expect(forms.map(text => evaluate(text))).toEqual([['oat'], ['oat'], ['oat'], ['oat']]);
            expect(evaluate('words.where(w => if w == "milk" then "yes" else null end)')).toEqual(['milk']);
        });

        it('keeps a value that is no function a body, the same for every item, so a Boolean name keeps or drops them all', () => {
            expect(evaluate('words.where(flag)')).toEqual(['oat', 'milk', 'rye']);
            expect(evaluate('words.where(flag)', { ...values, flag: false })).toEqual([]);
        });

        it('refuses a function the member calls after it returned or failed, whether a body or an arrow function gives it', () => {
            for (const predicate of ['it.vegan()', 'w => w.vegan()']) {
                const held = {};
                const registry = createImportingRegistry([createPantry(held)]);
                const bindings = registry.createBindings(values);
                const evaluator = registry.resolve(`words.keepWhereAndFail(${predicate})`, bindings).createEvaluator(bindings);

                expect(errorThrownBy(() => evaluate(`{ kept = words.keepWhere(${predicate}), late = chosen.callKept() }`)), predicate).toMatchObject({ code: 'LEXICA5008', message: expect.stringContaining("is called after 'keepWhere' returned") });
                expect(errorThrownBy(() => evaluator.evaluate()), predicate).toMatchObject({ code: 'LEXICA5007', message: expect.stringContaining('The pantry is closed') });
                expect(errorThrownBy(() => held.expression('oat')), predicate).toMatchObject({ code: 'LEXICA5008', message: expect.stringContaining("is called after 'keepWhereAndFail' returned") });
            }
        });
    });

    describe('of a function given as an option', () => {
        it('is the item, as a positional argument\'s is, a function a local holds standing for an arrow function, which no option is', () => {
            expect(evaluate('words.choose({ by = it.size, keep = it != "milk" })')).toBe(6);
            expect(evaluate('let size = w => w.size\nlet kept = w => w != "milk"\nreturn words.choose({ by = size, keep = kept })')).toBe(6);
            expect(evaluate('words.choose({ by = pantry.weight, keep = pantry.vegan })')).toBe(30);
        });

        it('is the argument an implicit body option is called with, an option that has no value to read, by its name or through root', () => {
            expect(evaluate('chosen.check({ test = it.size > 2 })')).toBe(true);
            expect(errorThrownBy(() => resolve('chosen.check({ test = it.size > 2, note = test })')).message).toContain("Option 'test' is an implicit body evaluated by the member");
            expect(errorThrownBy(() => resolve('chosen.check({ test = it.size > 2, note = root.test })')).message).toContain("Option 'test' is an implicit body evaluated by the member");
        });
    });

    describe('of a list holding nulls', () => {
        it('is each item as it is for a function of the item, null among them, and a value that is not for a body', () => {
            expect(evaluate('gaps.where(w => w == null)')).toEqual([null]);
            expect(evaluate('gaps.where(it == null)')).toEqual([]);
            expect(evaluate('gaps.max(w => w?.size)')).toBe(3);
            expect(errorThrownBy(() => resolve('gaps.where(pantry.vegan)')).message).toContain("'pantry.vegan' names no function that takes those or answers that");
        });
    });

    describe('of an argument of a reference a local holds', () => {
        it('is the one the qualified form gives it, an implicit body where the member takes a function, which resolution decides', () => {
            expect(evaluate('pantry.passes(chosen, it.size > 2)')).toBe(true);
            expect(evaluate('let passes = pantry.passes\nreturn passes(chosen, it.size > 2)')).toBe(true);
            expect(evaluate('let passes = pantry.passes\nreturn passes(chosen, it.size > 5)')).toBe(false);
        });

        it('is refused where the function called gives it no value, by resolution, and where the text alone shows none, by the structure', () => {
            expect(errorThrownBy(() => resolve('let same = w => w\nreturn same(it)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'it' is the implicit parameter, and there is none here") });
            expect(errorThrownBy(() => resolve('let same = w => w\nreturn same(it)')).location.pointer).toBe('/expression/result/arguments/0');
            expect(errorThrownBy(() => resolve('it.size'))).toMatchObject({ kind: 'structure' });
        });
    });

    describe('of an implicit body', () => {
        it('is read within an object expression following no value, which keeps it', () => {
            expect(evaluate('chosen.is({ long = it.size > 2 }.long)')).toBe(true);
        });
    });

    describe('in nested bodies', () => {
        it('is shadowed by a body of its own, and kept by a plain object and by an arrow function, which captures it where it is written', () => {
            expect(evaluate('words { same = words.where(it.size == 3).count, larger = words.where(w => w.size > it.size).count, inner = { size = it.size } }')).toEqual([
                { same: 2, larger: 1, inner: { size: 3 } },
                { same: 2, larger: 0, inner: { size: 4 } },
                { same: 2, larger: 1, inner: { size: 3 } },
            ]);
        });

        it('is no value where nothing gives it one, an arrow function at the top level among them', () => {
            expect(errorThrownBy(() => resolve('words.max(w => it.size)')).message).toContain("'it' is the implicit parameter, and there is none here");
            expect(errorThrownBy(() => resolve('it.size')).message).toContain("'it' is the implicit parameter, and the top level has none");
        });

        it('is the item of a projection, which root does not change, reading the fields already built', () => {
            expect(evaluate('words { name = it, details = { shown = root.name, size = it.size } }')).toEqual([
                { name: 'oat', details: { shown: 'oat', size: 3 } },
                { name: 'milk', details: { shown: 'milk', size: 4 } },
                { name: 'rye', details: { shown: 'rye', size: 3 } },
            ]);
        });
    });
});
