import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { evaluateWith, resolveWith } from './support/pipeline.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createIndexerDeclaration, createFunctionDeclaration } = lexica.declarations;

/** A plain host's module of text: a word's letter by its index, a named indexer, and its words, a list, which a word without any has none of. */
const createText = () => lexica.createModule('text', {
    types: [
        extensionDeclaration('StringExtensions', 'String', [
            createIndexerDeclaration('letter', 'String?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('index', 'Number')], impl: ({ receiver, args }) => receiver[args.index] ?? null }),
            createPropertyDeclaration('words', 'List<String>', { updates: constantUpdates, impl: ({ receiver }) => receiver.split(' ') }),
            createPropertyDeclaration('someWords', 'List<String>?', { updates: constantUpdates, impl: ({ receiver }) => (receiver === '' ? null : receiver.split(' ')) }),
        ]),
    ],
});

/** The value the text gives, read through the text module with the bindings. */
const evaluate = (text, bindings) => evaluateWith([createText()], text, bindings);

/** The error resolving the text through the text module with the bindings throws. */
const refusalOf = (text, bindings) => errorThrownBy(() => resolveWith([createText()], text, bindings));

describe('indexers and computed properties', () => {
    describe('in text and definitions', () => {
        it('writes each form as it is read, its optional access where the text places it', () => {
            const texts = ['a.b[k]', 'a?.b[k]', 'a.b?[k]', 'a[k]', 'a?[k]', 'a.[p]', 'a?.[p]', 'a.b[k].[p]', 'a?.b?[k]?.[p]'];

            texts.forEach(text => expect(lexica.format(text), text).toBe(text));
        });

        it('records a named indexer as an indexer of the member access its name is written in, an optional receiver on the access and optional brackets on the indexer', () => {
            const a = { kind: 'parameter', name: 'a' };
            const k = { kind: 'parameter', name: 'k' };

            expect(lexica.parse('a.b[k]').expression).toEqual({ kind: 'indexer', target: { kind: 'member', target: a, name: 'b' }, argument: k });
            expect(lexica.parse('a?.b[k]').expression).toEqual({ kind: 'optionalChain', target: { kind: 'indexer', target: { kind: 'member', target: a, name: 'b', optional: true }, argument: k } });
            expect(lexica.parse('a.b?[k]').expression).toEqual({ kind: 'optionalChain', target: { kind: 'indexer', target: { kind: 'member', target: a, name: 'b' }, argument: k, optional: true } });
        });

        it('records a computed property as a member named by its expression, or by the name a string literal is', () => {
            expect(lexica.parse('a.[p]').expression).toEqual({ kind: 'member', target: { kind: 'parameter', name: 'a' }, name: { kind: 'parameter', name: 'p' } });
            expect(lexica.parse('a.["b"]').expression).toEqual(lexica.parse('a.b').expression);
            expect(lexica.parse('a.["night-mode"]').expression.name).toEqual({ kind: 'literal', value: 'night-mode' });
        });

        it('adds no node for a group, so a grouped member access before brackets is the named indexer written plainly', () => {
            expect(lexica.format('(a.b)[k]')).toBe('a.b[k]');
        });

        it('refuses a colon in a chain, giving the form with a dot', () => {
            expect(errorThrownBy(() => lexica.parse('device:setting["mode"]')).message).toContain("write 'device.setting[…]'");
            expect(errorThrownBy(() => lexica.parse('it:["mode"]')).message).toContain("write 'it.[…]'");
            expect(errorThrownBy(() => lexica.parse('it?:["mode"]')).message).toContain("write 'it?.[…]'");
            expect(errorThrownBy(() => lexica.parse('a.b ?: c'))).toMatchObject({ kind: 'syntax' });
        });

        it('refuses an indexer of no key or of several, and optional brackets after a dot', () => {
            expect(errorThrownBy(() => lexica.parse('a.b[]')).message).toContain('An indexer takes one key in its brackets');
            expect(errorThrownBy(() => lexica.parse('a.b[1, 2]')).message).toContain('An indexer takes one key');
            expect(errorThrownBy(() => lexica.parse('a.?[p]')).message).toContain("writes its '?' before the dot, as '?.[…]'");
        });

        it('refuses an indexer node holding a name, and a definition of version 32', () => {
            const named = { version: 33, expression: { kind: 'indexer', target: { kind: 'parameter', name: 'a' }, name: 'b', argument: { kind: 'literal', value: 1 } } };

            expect(errorThrownBy(() => lexica.validate(named))).toMatchObject({ kind: 'structure' });
            expect(errorThrownBy(() => lexica.validate({ version: 32, expression: { kind: 'it' } }))).toMatchObject({ kind: 'structure' });
        });
    });

    describe('a named indexer', () => {
        it('is invoked with its key where the receiver\'s type declares it, the access its name is written in never read alone', () => {
            expect(evaluate('item.letter[1]', { item: 'latte' })).toBe('a');
            expect(evaluate('item.letter[9]', { item: 'latte' })).toBeNull();
        });

        it('refuses a key it does not take as its own error, never reading the brackets another way', () => {
            const error = refusalOf('item.letter["x"]', { item: 'latte' });

            expect(error).toBeInstanceOf(LexicaError);
            expect(error.kind).toBe('validation');
            expect(error.message).toContain('letter');
            expect(error.message).not.toContain('no unnamed indexer');
        });

        it('refuses being written without its key or as a call, giving its form', () => {
            expect(refusalOf('item.letter', { item: 'latte' }).message).toContain("'letter' is an indexer: write 'item.letter[…]'");
            expect(refusalOf('item.letter(1)', { item: 'latte' }).message).toContain("'letter' is an indexer: write 'item.letter[1]'");
        });

        it('takes optional brackets after its name, which add nothing, its access\'s own marker alone making its receiver optional, an optional enclosed access among them', () => {
            expect(evaluate('item.letter?[1]', { item: 'latte' })).toBe('a');
            expect(evaluate('item?.letter?[1]', { item: 'latte' })).toBe('a');
            expect(evaluate('item?.letter?[1]', { item: null })).toBeNull();
            expect(evaluate('(?item.letter[1])', { item: 'latte' })).toBe('a');
            expect(evaluate('(?item.letter[1])', { item: null })).toBeNull();
            expect(lexica.format('(?item.letter[1])')).toBe('item?.letter?[1]');
        });

        it('refuses a receiver that can be null where only its brackets are optional, which protect nothing before its name', () => {
            const registry = lexica.createRegistry([createText(), lexica.createModule('maybe', {
                types: [extensionDeclaration('StringExtensions', 'String', [createPropertyDeclaration('maybe', 'String?', { updates: constantUpdates, impl: ({ receiver }) => (receiver === '' ? null : receiver) })])],
            })]);

            expect(errorThrownBy(() => registry.resolve('item.maybe.letter?[1]', { item: 'latte' })).message).toContain("write 'item.maybe?.letter?[1]'");
            expect(registry.resolve('item.maybe?.letter?[1]', { item: '' }).createEvaluator({ item: '' }).evaluate().value).toBeNull();
        });

        it('answers null for a null receiver written optionally, its key unevaluated', () => {
            const keys = [];
            const registry = lexica.createRegistry([createText(), lexica.createModule('keys', {
                types: [extensionDeclaration('StringExtensions', 'String', [createPropertyDeclaration('key', 'Number', { updates: constantUpdates, impl: ({ receiver }) => (keys.push(receiver), 1) })])],
            })]);

            expect(registry.resolve('item?.letter[other.key]', { item: null, other: 'x' }).createEvaluator({ item: null, other: 'x' }).evaluate().value).toBeNull();
            expect(registry.resolve('item?.letter[other.key]', { item: 'latte', other: 'x' }).createEvaluator({ item: 'latte', other: 'x' }).evaluate().value).toBe('a');
            expect(keys).toEqual(['x']);
        });

        it('evaluates the receiver before its name once, before its key, a member\'s answer among them', () => {
            const invoked = [];
            const registry = lexica.createRegistry([createText(), lexica.createModule('steps', {
                types: [
                    extensionDeclaration('StringExtensions', 'String', [
                        createPropertyDeclaration('trimmed', 'String', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push('trimmed'), receiver.trim()) }),
                        createPropertyDeclaration('key', 'Number', { updates: constantUpdates, impl: () => (invoked.push('key'), 1) }),
                    ]),
                ],
            })]);
            const bound = { item: ' latte ', other: 'x' };

            expect(registry.resolve('item.trimmed.letter[other.key]', bound).createEvaluator(bound).evaluate().value).toBe('a');
            expect(invoked).toEqual(['trimmed', 'key']);
        });

        it('is never selected by a computed name, which reads properties alone', () => {
            expect(refusalOf('item.[name][0]', { item: 'latte', name: 'letter' }).message).toContain("'letter' is an indexer");
            expect(evaluate('item.[name][0]', { item: 'oat latte', name: 'words' })).toBe('oat');
        });

        it('resolves each part of a chain of named indexers once, so a long chain resolves as quickly as a short one', () => {
            expect(evaluate(`item${'?.letter[0]'.repeat(30)}`, { item: 'latte' })).toBe('l');
        });

        it('refuses a function written with brackets, giving its call', () => {
            const registry = lexica.createRegistry([lexica.createModule('cut', {
                types: [extensionDeclaration('StringExtensions', 'String', [createFunctionDeclaration('cut', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('percent', 'Number')], impl: ({ args }) => args.percent })])],
            })]);

            expect(errorThrownBy(() => registry.resolve('item.cut[5]', { item: 'latte' })).message).toContain("'cut' uses call syntax: write 'item.cut(5)'");
        });
    });

    describe('an unnamed indexer', () => {
        it('is named in a message as its access is written, brackets alone, a receiver known to be null\'s candidates among them', () => {
            expect(refusalOf('words[true]', { words: ['oat'] })).toMatchObject({ code: 'LEXICA3042', message: expect.stringContaining("The argument 'index' of '[…]' expects Number and finds Boolean") });
            expect(refusalOf('nothing?[true]', { nothing: null })).toMatchObject({ code: 'LEXICA3042', message: expect.stringContaining("The argument 'index' of '[…]' expects Number and finds Boolean") });
        });

        it('indexes what the property before its brackets answers, where the receiver\'s type has no named indexer of that name', () => {
            expect(evaluate('item.words[1]', { item: 'oat latte' })).toBe('latte');
            expect(evaluate('item.words[1]', { item: 'latte' })).toBeNull();
        });

        it('requires a receiver that cannot be null, giving the optional brackets, which answer null for a null one', () => {
            expect(refusalOf('item.someWords[0]', { item: '' }).message).toContain("write 'item.someWords?[0]'");
            expect(evaluate('item.someWords?[0]', { item: '' })).toBeNull();
            expect(evaluate('item.someWords?[0]', { item: 'oat latte' })).toBe('oat');
            expect(evaluate('item?.someWords?[0]', { item: null })).toBeNull();
            expect(evaluate('(?item.someWords[0])', { item: '' })).toBeNull();
            expect(evaluate('(?item.someWords[0])', { item: 'oat latte' })).toBe('oat');
        });

        it('refuses a receiver whose type has none, giving the computed property access a string key may mean', () => {
            expect(refusalOf('item[0]', { item: 'latte' }).message).toContain('String has no unnamed indexer');
            expect(refusalOf('item["words"]', { item: 'latte' }).message).toContain("write 'item.[\"words\"]'");
        });

        it('is what a number where a computed property\'s name stands means', () => {
            expect(refusalOf('item.words.[0]', { item: 'oat latte' }).message).toContain("write 'item.words[0]'");
        });
    });

    describe('a property read by a computed name', () => {
        /** A module whose `size` answers what the test gives it and `cup`, a structure, a copy of the one it answers. */
        const createCups = size => lexica.createModule('cups', {
            types: [
                { name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ volume: 'Number' }) },
                extensionDeclaration('StringExtensions', 'String', [
                    createPropertyDeclaration('size', 'Number', { updates: constantUpdates, impl: () => size }),
                    createPropertyDeclaration('cup', 'Cup', { updates: constantUpdates, impl: () => ({ volume: 2, lid: true }) }),
                ]),
            ],
        });
        const valueOf = (text, size, bound) => lexica.createRegistry([createCups(size)]).resolve(text, bound).createEvaluator(bound).evaluate().value;

        it('is invoked, checked and copied as the property read by its name is', () => {
            const bound = { item: 'latte', name: 'size', other: 'cup' };

            expect(valueOf('{ direct = item.size, computed = item.[name] }', 3, bound)).toEqual({ direct: 3, computed: 3 });
            expect(valueOf('{ direct = item.cup, computed = item.[other] }', 3, bound)).toEqual({ direct: { volume: 2 }, computed: { volume: 2 } });
            expect(errorThrownBy(() => valueOf('item.[name]', 'large', bound))).toMatchObject({ code: 'LEXICA5006', message: expect.stringContaining("The member 'size' answered") });
            expect(errorThrownBy(() => valueOf('item.size', 'large', bound))).toMatchObject({ code: 'LEXICA5006', message: expect.stringContaining("The member 'size' answered") });
        });
    });

    describe('a type name qualified by its module', () => {
        const createCups = () => lexica.createModule('cups', {
            types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }, extensionDeclaration('Orders', 'String', [operatorDeclaration('convert', 'Cup', ({ value }) => ({ size: value.length }))])],
        });

        it('is read and written as it is, in text read without a registry too', () => {
            expect(lexica.parse('order to cups.Cup').expression).toEqual({ kind: 'conversion', type: 'cups.Cup', target: { kind: 'parameter', name: 'order' } });
            expect(lexica.format('(order to cups.Cup).size')).toBe('(order to cups.Cup).size');
            expect(lexica.format('node as dom.element')).toBe('node as dom.element');
        });

        it('names the type its registered module declares', () => {
            const resolution = lexica.createRegistry([createCups()]).resolve('(order to cups.Cup).size', { order: 'tall' });

            expect(resolution.createEvaluator({ order: 'tall' }).evaluate().value).toBe(4);
        });

        it('refuses a module no registry holds, and a type its module does not declare', () => {
            const registry = lexica.createRegistry([createCups()]);

            expect(errorThrownBy(() => registry.resolve('order to mugs.Cup', { order: 'tall' })).message).toContain("No module named 'mugs' is registered");
            expect(errorThrownBy(() => registry.resolve('order to cups.Mug', { order: 'tall' })).message).toContain("The module 'cups' does not declare a type named 'Mug'");
        });
    });
});
