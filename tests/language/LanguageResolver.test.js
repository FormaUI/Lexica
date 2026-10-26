import { describe, it, expect } from 'vitest';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

const constant = { changes: 'constant', reads: 'fresh' };
const padding = (target, countType) => Declarations.function('pad', target, 'String', { updates: constant, parameters: [Declarations.valueParameter('count', countType)], implementation: ({ receiver }) => receiver });

/**
 * A shop whose `pad` is a module member taking a text and a count written as a string, a member of a string taking a count, and a member of a Boolean taking a count written as a string; and whose `trim` is a member of a string
 * and of a Boolean, each taking a count.
 */
const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', {
    members: [
        Declarations.function('pad', null, 'String', { updates: constant, parameters: [Declarations.valueParameter('text', 'String'), Declarations.valueParameter('count', 'String')], implementation: ({ args }) => args.text }),
        padding('String', 'Number'),
        padding('Boolean', 'String'),
        Declarations.function('trim', 'String', 'String', { updates: constant, parameters: [Declarations.valueParameter('count', 'Number')], implementation: ({ receiver }) => receiver }),
        Declarations.function('trim', 'Boolean', 'String', { updates: constant, parameters: [Declarations.valueParameter('count', 'Number')], implementation: () => 'trimmed' }),
    ],
})]);

/** Local functions a script's arguments call, each call resolving a copy of its body: one answering a number and one a string. */
const LOCALS = 'let next = function(x) return x + 1 end\nlet same = function(s) return s end';

/** The script resolved against the shop, with `missing` bound to null and `word` to a string. */
const resolve = result => {
    const definition = ParsedTexts.parse(`${LOCALS}\nreturn ${result}`, new Set(registry.namespaceNames));

    return new LanguageResolver(registry, new ParameterBindings(registry, { missing: null, word: 'oat' }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition);
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
                uses: ['String.pad@/expression/result'],
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

            expect({ kind, name: declaration.name, takesReceiver: registry.hasReceiver(declaration) }).toEqual({ kind: 'invocation', name: 'pad', takesReceiver: false });
        });
    });

    describe('the candidates of a receiver of unknown type', () => {
        it('keeps nothing of a refused candidate\'s arguments', () => {
            // Of the two `pad`s, the string's takes `next(1)` and the Boolean's refuses it, each after resolving it.
            expect(keptOf(resolve('missing?.pad(next(1))'), '/expression/result/target/arguments/0')).toEqual({ uses: [], copies: [], isResolved: false });
        });

        it('keeps nothing of a fitting candidate\'s arguments, while its fit and its type are kept', () => {
            const resolved = resolve('missing?.trim(next(1))');

            expect(keptOf(resolved, '/expression/result/target/arguments/0')).toEqual({ uses: [], copies: [], isResolved: false });
            expect(resolved.getResolution('/expression/result/target')).toMatchObject({ kind: 'invocation', candidates: [{ name: 'trim' }, { name: 'trim' }], arguments: [] });
            expect(String(resolved.type)).toBe('String?');
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
        /** The qualified names `word.fade` uses, where `fade` is a property of the receiver types given, in order. */
        const usesOf = target => {
            const fading = new LexicaRegistry([Vocabulary.module, new LexicaModule('shop', {
                members: [Declarations.property('fade', target, 'String', { updates: constant, implementation: ({ receiver }) => receiver })],
            })]);
            const definition = ParsedTexts.parse('return word.fade', new Set(fading.namespaceNames));

            return new LanguageResolver(fading, new ParameterBindings(fading, { word: 'oat' }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition).usedDeclarations.map(use => use.qualifiedName);
        };

        it('is the type of the first receiver type the receiver applies to it by, and the name alone where that one is any receiver or a type parameter, though a later one is the receiver\'s type', () => {
            expect(usesOf(['String', 'any'])).toEqual(['String.fade']);
            expect(usesOf(['any', 'String'])).toEqual(['fade']);
            expect(usesOf(['T', 'String'])).toEqual(['fade']);
        });
    });
});
