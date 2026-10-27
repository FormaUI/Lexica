import { describe, it, expect } from 'vitest';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration } from '../support/declarations.mjs';

/** A word the shop sells, a value with identity the shop recognizes. */
class Word {
    constructor(text) {
        this.text = text;
    }
}

const padding = countType => Declarations.createFunctionDeclaration('pad', 'String', { updates: constantUpdates, parameters: [Declarations.createValueParameterDeclaration('count', countType)], impl: ({ receiver }) => receiver });
const trimming = impl => Declarations.createFunctionDeclaration('trim', 'String', { updates: constantUpdates, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl });

/**
 * A shop whose `pad` is a module member taking a word and a count written as a string, a member of its own word taking a count, which its namespace reaches too, and a member of a Boolean taking a count written as a
 * string; and whose `trim` is a member of a string and of a Boolean, each taking a count.
 */
const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', {
    typeOf: value => (value instanceof Word ? 'Word' : null),
    types: [
        { name: 'Word', kind: 'reference', isInstance: value => value instanceof Word, members: [padding('Number')] },
        extensionDeclaration('Booleans', 'Boolean', [padding('String'), trimming(() => 'trimmed')]),
        extensionDeclaration('Strings', 'String', [trimming(({ receiver }) => receiver)]),
    ],
    members: [
        Declarations.createFunctionDeclaration('pad', 'String', { updates: constantUpdates, parameters: [Declarations.createValueParameterDeclaration('text', 'Word'), Declarations.createValueParameterDeclaration('count', 'String')], impl: ({ args }) => args.text }),
    ],
})]);

/** Local functions a script's arguments call, each call resolving a copy of its body: one answering a number and one a string. */
const LOCALS = 'let next = function(x) return x + 1 end\nlet same = function(s) return s end';

/** The script resolved against the shop, with `missing` bound to null and `word` to one of its words. */
const resolve = result => {
    const definition = ParsedTexts.parse(`${LOCALS}\nreturn ${result}`, new Set(registry.namespaceNames));

    return new LanguageResolver(registry, new ParameterBindings(registry, { missing: null, word: new Word('oat') }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition);
};

/** What a resolution kept of the three stores a speculative resolution restores: each use by its name and pointer, the pointer of each body copy, and whether the pointer was resolved. */
const keptOf = (resolved, pointer) => ({
    uses: resolved.usedDeclarations.map(use => `${use.qualifiedName}@${use.pointer}`),
    copies: resolved.functionBodyCopies.map(bodyCopy => bodyCopy.pointer),
    isResolved: resolved.getResolution(pointer) !== undefined,
});

describe('LanguageResolver', () => {
    describe('a reading through a namespace that fits two ways', () => {
        it('keeps nothing of a refused reading: no resolution, no use and no body copy', () => {
            // The module member's count is a string, so its reading is refused after it resolved `next(1)`; the qualified form's count is a number.
            expect(keptOf(resolve('shop.pad(word, next(1))'), '/expression/result/arguments/1')).toEqual({
                uses: ['Word.pad@/expression/result'],
                copies: ['/expression/result/arguments/1/body'],
                isResolved: true,
            });
        });

        it('keeps a successful reading\'s records where a later reading is refused', () => {
            // The module member takes a string count; the qualified form, read later, is refused for the same argument after resolving it again.
            const resolved = resolve('shop.pad(word, same("x"))');

            expect(keptOf(resolved, '/expression/result/arguments/1')).toEqual({
                uses: ['shop.pad@/expression/result'],
                copies: ['/expression/result/arguments/1/body'],
                isResolved: true,
            });

            const { kind, declaration } = resolved.getResolution('/expression/result');

            expect({ kind, name: declaration.name, takesReceiver: registry.takesReceiver(declaration) }).toEqual({ kind: 'invocation', name: 'pad', takesReceiver: false });
        });
    });

    describe('the candidates of a receiver of unknown type', () => {
        it('keeps nothing of a refused candidate\'s arguments', () => {
            // Of the two `pad`s of a receiver, the word's takes `next(1)` and the Boolean's refuses it, each after resolving it.
            expect(keptOf(resolve('missing?.pad(next(1))'), '/expression/result/target/arguments/0')).toEqual({ uses: [], copies: [], isResolved: false });
        });

        it('keeps nothing of a fitting candidate\'s arguments, while its fit and its type are kept', () => {
            const resolved = resolve('missing?.trim(next(1))');

            expect(keptOf(resolved, '/expression/result/target/arguments/0')).toEqual({ uses: [], copies: [], isResolved: false });
            expect(resolved.getResolution('/expression/result/target')).toMatchObject({ kind: 'invocation', candidates: [{ name: 'trim' }, { name: 'trim' }], arguments: [] });
            expect(String(resolved.type)).toBe('String?');
        });
    });

    describe('a computed property access', () => {
        it('keeps each name\'s resolution by its name and records each use as its name is resolved, its own pointer holding its own resolution', () => {
            const property = (name, result = 'Number') => Declarations.createPropertyDeclaration(name, result, { updates: constantUpdates, impl: () => 1 });
            const lit = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', { types: [extensionDeclaration('Words', 'String', [property('glow'), property('dim'), property('long', 'Boolean')])] })]);
            const definition = ParsedTexts.parse('return word.[if word.long then "glow" else "dim" end]', new Set(lit.namespaceNames));
            const resolved = new LanguageResolver(lit, new ParameterBindings(lit, { word: 'oat' }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition);
            const { kind, resolutionsByName } = resolved.getResolution('/expression/result');

            expect(kind).toBe('computedPropertyAccess');
            expect([...resolutionsByName].map(([name, resolution]) => [name, resolution.kind, resolution.declaration.name])).toEqual([['glow', 'invocation', 'glow'], ['dim', 'invocation', 'dim']]);
            expect(resolved.usedDeclarations.map(use => `${use.qualifiedName}@${use.pointer}`)).toEqual(['String.long@/expression/result/name/condition', 'String.glow@/expression/result', 'String.dim@/expression/result']);
        });
    });

    describe('an object field and a structured type\'s data property', () => {
        /** A registry whose `Cup` is a structured type of a size, converted from a string. */
        const cups = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', {
            types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }],
            conversions: [{ from: 'String', to: 'Cup', impl: ({ value }) => ({ size: value.length }) }],
        })]);
        const values = { word: 'oat', pair: { a: 1, b: null }, missing: null };
        const resolveCups = text => {
            const definition = ParsedTexts.parse(`return ${text}`, new Set(cups.namespaceNames));

            return new LanguageResolver(cups, new ParameterBindings(cups, values), ParsedTexts.locationsOf(definition)).resolveDefinition(definition);
        };
        const refusalOf = text => {
            try {
                resolveCups(text);
            } catch (error) {
                return { code: error.code, message: error.message, pointer: error.location.pointer };
            }

            return null;
        };

        it('are read by their names: an object field by its name alone, of the type null among them, and a data property by its declaration, which the script uses and never invokes', () => {
            expect(resolveCups('pair.a').getResolution('/expression/result')).toEqual({ kind: 'objectField', name: 'a' });
            expect(String(resolveCups('pair.b').type)).toBe('null');

            const resolved = resolveCups('(word to Cup).size');

            expect(resolved.getResolution('/expression/result')).toEqual({ kind: 'dataProperty', declaration: { name: 'size', kind: 'property', result: 'Number', parameters: [] }, name: 'size' });
            expect(resolved.usedDeclarations.map(use => use.qualifiedName)).toEqual(['Cup.size']);
        });

        it('is refused where it is called, as an object field, as a property of a structured type\'s data, and as one where the receiver\'s type is unknown', () => {
            expect(refusalOf('pair.a()')).toEqual({ code: 'LEXICA3017', message: expect.stringContaining("'a' is an object field of { a: Number, b: null } and takes no argument: write 'pair.a'"), pointer: '/expression/result' });
            expect(refusalOf('(word to Cup).size()')).toEqual({ code: 'LEXICA3017', message: expect.stringContaining("'size' is a property of Cup's data and takes no argument: write '(word to Cup).size'"), pointer: '/expression/result' });
            expect(refusalOf('missing?.size()')).toEqual({ code: 'LEXICA3017', message: expect.stringContaining("'size' is a property of a structured type's data and takes no argument: write 'missing?.size'"), pointer: '/expression/result/target' });
        });
    });

    describe('the object root', () => {
        /** The code of the error resolving the script fails with. */
        const codeOf = result => {
            try {
                resolve(result);
            } catch (error) {
                return error.code;
            }

            return null;
        };

        it('reads the fields completed where it is written, a reference written earlier and a scope captured earlier keeping the fields completed there', () => {
            expect(String(resolve('{ a = 1, b = root.a, c = "x", d = { e = root.c, f = root.b } }').type)).toBe('{ a: Number, b: Number, c: String, d: { e: String, f: Number } }');
            expect(codeOf('{ a = 1, b = root.c, c = 2 }')).toBe('LEXICA3044');
            expect(codeOf('{ let peek = () => root.a, a = 1, b = peek() }')).toBe('LEXICA3044');
            expect(String(resolve('{ a = 1, b = { let peek = () => root.a, c = peek() } }').type)).toBe('{ a: Number, b: { c: Number } }');
        });
    });

    describe('the name a use is qualified by', () => {
        /** The qualified names `word.fade` uses, where `fade` is a property of an extension of the target given. */
        const usesOf = target => {
            const fading = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', {
                types: [extensionDeclaration(target === 'T' ? 'Fades<T>' : 'Fades', target, [Declarations.createPropertyDeclaration('fade', 'String', { updates: constantUpdates, impl: ({ receiver }) => receiver })])],
            })]);
            const definition = ParsedTexts.parse('return word.fade', new Set(fading.namespaceNames));

            return new LanguageResolver(fading, new ParameterBindings(fading, { word: 'oat' }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition).usedDeclarations.map(use => use.qualifiedName);
        };

        it('is the type the receiver applies to it by, and the name alone where that is a type parameter, which takes a receiver of any type', () => {
            expect(usesOf('String')).toEqual(['String.fade']);
            expect(usesOf('T')).toEqual(['fade']);
        });
    });
});
