import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { extensionDeclaration } from './support/declarations.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { resolveWith } from './support/pipeline.mjs';

const { createPropertyDeclaration, createFunctionParameterDeclaration, createValueParameterDeclaration, createFunctionDeclaration } = lexica.declarations;

/**
 * A pantry's module on words: a word's size and whether it is vegan, a member of a word and a module member of the word it tests; a member that ignores the test it is given, one that keeps it for a member that calls
 * it later, and one that keeps it in what the host holds and fails; and module members a script names by reference, a test that answers no Boolean and a test of a number. Every implementation records what it read, so a
 * test sees which ran.
 */
const createPantry = (invoked = [], held = {}) => {
    let kept = null;

    return lexica.createModule('pantry', {
        types: [
            extensionDeclaration('StringExtensions', 'String', [
                createPropertyDeclaration('size', 'Number', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push(['size', receiver]), receiver.length) }),
                createFunctionDeclaration('vegan', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push(['vegan', receiver]), receiver.startsWith('oat')) }),
                createFunctionDeclaration('ignore', 'Boolean', { updates: { changes: 'derived', reads: 'derived' }, parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])], impl: () => true }),
                createFunctionDeclaration('keep', 'Boolean', { updates: { changes: 'derived', reads: 'derived' }, parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])], impl: ({ args }) => ((kept = args.test), true) }),
                createFunctionDeclaration('callKept', 'Boolean', { updates: { changes: 'derived', reads: 'derived' }, impl: ({ receiver }) => kept(receiver) }),
                createFunctionDeclaration('keepAndFail', 'Boolean', {
                    updates: { changes: 'derived', reads: 'derived' },
                    parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])],
                    impl: ({ args }) => {
                        held.test = args.test;
                        throw new Error('The pantry is closed');
                    },
                }),
            ]),
        ],
        // The tests a script names by reference, each a module member of the value it tests, which its namespace reaches.
        members: [
            createFunctionDeclaration('vegan', 'Boolean', { updates: constantUpdates, parameters: [createValueParameterDeclaration('word', 'String')], impl: ({ args }) => (invoked.push(['vegan', args.word]), args.word.startsWith('oat')) }),
            createFunctionDeclaration('fresh', 'Boolean', { updates: constantUpdates, parameters: [createValueParameterDeclaration('word', 'String')], impl: () => 'yes' }),
            createFunctionDeclaration('even', 'Boolean', { updates: constantUpdates, parameters: [createValueParameterDeclaration('number', 'Number')], impl: ({ args }) => args.number % 2 === 0 }),
        ],
    });
};

const values = { word: 'oat', other: 'milk', words: ['oat', 'milk', 'rye'], missing: null };

/** What the text evaluates to against a registry of the pantry, with what each implementation read and the declarations the host was asked before each invocation. */
const evaluate = (text, bound = values) => {
    const invoked = [];
    const asked = [];
    const registry = lexica.createRegistry([createPantry(invoked)]);
    const bindings = registry.createBindings(bound);
    const value = registry.resolve(text, bindings, { imports: ['pantry'] }).createEvaluator(bindings).evaluate({ beforeInvoke: request => void asked.push(request.declaration.name) }).value;

    return { value, invoked, asked };
};

/** The resolution of the text against a registry of the pantry. */
const resolve = (text, bound = values) => resolveWith([createPantry()], text, bound);

describe('the verbs', () => {
    it('take a test in any form a function argument takes: an arrow function, a function a name holds, a module\'s function by reference, or an implicit body', () => {
        const forms = ['word.is(w => w.size > 2)', 'let long = w => w.size > 2\nreturn word.is(long)', 'word.is(pantry.vegan)', 'word.has(it.size > 2)'];

        expect(forms.map(text => evaluate(text).value)).toEqual([true, true, true, true]);
        expect(forms.map(text => evaluate(text, { ...values, word: 'ry' }).value)).toEqual([false, false, false, false]);
        expect(evaluate('words { is = it.is(pantry.vegan), has = it.has(it.size > 3), supports = it.supports(w => w == "rye") }').value).toEqual([
            { is: true, has: false, supports: false },
            { is: false, has: true, supports: false },
            { is: false, has: false, supports: true },
        ]);
    });

    it('test a receiver of any type, their test taking the receiver as its own type, and answer null without testing it where ?. meets null', () => {
        expect(evaluate('{ list = words.is(ws => ws.count > 2), number = (4).is(pantry.even), text = word.is(w => w.size == 3) }').value).toEqual({ list: true, number: true, text: true });
        expect(evaluate('missing?.is(w => w.size > 2)')).toEqual({ value: null, invoked: [], asked: [] });
        expect(resolve('missing?.is(it.size > 2)').type).toBe('Boolean?');
        expect(errorThrownBy(() => resolve('word.is(pantry.even)'))).toMatchObject({ kind: 'validation' });
    });

    it('refuse a test that is no function, one that does not take the receiver\'s type, one of another number of arguments, and one answering anything but a boolean', () => {
        expect(errorThrownBy(() => resolve('word.is(metered)', { ...values, metered: true }))).toMatchObject({ kind: 'validation', message: expect.stringContaining("The parameter 'test' of 'is' takes a function, as an arrow function, a function a name holds, a module's function by reference or an implicit body gives, and finds Boolean") });
        expect(errorThrownBy(() => resolve('word.is((a, b) => true)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('takes 2 arguments, and its contract passes 1') });
        expect(errorThrownBy(() => resolve('word.is(w => w.size)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('gives Number, and its contract takes Boolean') });
        expect(errorThrownBy(() => resolve('word.is(it.size)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("The implicit body given as 'test' of 'is' gives Number, and its contract takes Boolean") });
        expect(errorThrownBy(() => resolve('word.is(w => if w.size > 2 then true else null end)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('gives Boolean?, and its contract takes Boolean') });
    });

    it('take a Boolean that cannot be null and convert no truthiness, failing where a module\'s function answers anything else', () => {
        expect(errorThrownBy(() => evaluate('word.is(pantry.fresh)'))).toMatchObject({ kind: 'evaluation', message: expect.stringContaining("The member 'fresh' answered") });
        expect(errorThrownBy(() => resolve('word.is(w => w)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('gives String, and its contract takes Boolean') });
    });

    it('read what their test reads: a module\'s function as its declaration says, and an arrow function or an implicit body the reads it makes', () => {
        expect(evaluate('word.is(pantry.vegan)').asked).toEqual(['is', 'vegan']);
        expect(evaluate('word.is(w => w.size > 2)').asked).toEqual(['is', 'size']);
        expect(evaluate('word.has(it.size > 2)').asked).toEqual(['has', 'size']);
        expect(evaluate('let test = pantry.vegan\nreturn 1').asked).toEqual([]);
    });
});

describe('implicit bodies', () => {
    it('are recognized by an it of the argument\'s own scope, and an it a projection, an expression or a predicate argument within it supplies makes it none', () => {
        expect(evaluate('word.is(it.size > 2)').value).toBe(true);
        expect(errorThrownBy(() => resolve('word.is(words { s = it.size }.count > 0)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('takes a function') });
        expect(errorThrownBy(() => resolve('word.is(words.where(it.vegan()).count > 0)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('takes a function') });
    });

    it('count an it an arrow function within them reads, since an arrow function keeps the it of the place it is written', () => {
        expect(evaluate('let apply = function(f, n) f(n) end\nreturn word.is(apply(n => it.size > n, 2))').value).toBe(true);
    });

    it('read every other name where they are written, a local and a script parameter among them, and their it alone as the argument the member calls them with', () => {
        expect(evaluate('let limit = 2\nreturn { long = word.is(it.size > limit), longer = word.is(it.size > ~limit) }', { ...values, limit: 5 }).value).toEqual({ long: true, longer: false });
        expect(evaluate('words { longer = it.is(it.size > other.size) }').value).toEqual([{ longer: false }, { longer: false }, { longer: false }]);
    });

    it('leave an arrow function the it of the place it is written, which a top level has none of', () => {
        expect(evaluate('words { shorter = word.is(w => it.size > w.size) }').value).toEqual([{ shorter: false }, { shorter: true }, { shorter: false }]);
        expect(errorThrownBy(() => resolve('word.is(w => it.size > 2)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'it' is the implicit parameter, and there is none here") });
    });

    it('are evaluated only as the member calls them, so one it never calls reads nothing', () => {
        expect(evaluate('word.ignore(it.size > 2)')).toMatchObject({ value: true, invoked: [] });
    });

    it('are recorded as written, an argument node like any other, the resolution telling them apart', () => {
        const registry = lexica.createRegistry([createPantry()]);

        expect(registry.parse('word.is(it.size > 2)').expression.arguments).toEqual([{ kind: 'comparison', operands: [{ kind: 'memberAccess', receiver: { kind: 'it' }, name: 'size' }, { kind: 'literal', value: 2 }], operators: ['>'] }]);
        expect(registry.format('word.is(it.size > 2)')).toBe('word.is(it.size > 2)');
    });
});

describe('functions passed to members', () => {
    it('are called only while the member\'s invocation lasts, a call after that failing, an implicit body and a reference alike', () => {
        for (const test of ['w => w.size > 2', 'it.size > 2', 'pantry.vegan']) {
            expect(errorThrownBy(() => evaluate(`{ kept = word.keep(${test}), called = word.callKept() }`))).toMatchObject({ kind: 'evaluation', message: expect.stringContaining("is called after 'keep' returned") });
        }
    });

    it('expire only the function the member was given, the function beneath it staying callable in another invocation and by itself', () => {
        for (const test of ['w => w.size > 2', 'pantry.vegan']) {
            expect(evaluate(`let test = ${test}\nreturn { kept = word.keep(test), again = word.is(test), direct = test(word) }`).value).toEqual({ kept: true, again: true, direct: true });
        }
    });

    it('expire when the member fails as when it returns, a call after its failure refused', () => {
        for (const test of ['w => w.size > 2', 'it.size > 2', 'pantry.vegan']) {
            const held = {};
            const registry = lexica.createRegistry([createPantry([], held)]);
            const bindings = registry.createBindings(values);
            const evaluator = registry.resolve(`word.keepAndFail(${test})`, bindings, { imports: ['pantry'] }).createEvaluator(bindings);

            expect(errorThrownBy(() => evaluator.evaluate()), test).toMatchObject({ code: 'LEXICA5007', message: expect.stringContaining('The pantry is closed') });
            expect(errorThrownBy(() => held.test('oat')), test).toMatchObject({ code: 'LEXICA5008', kind: 'evaluation' });
        }
    });
});
