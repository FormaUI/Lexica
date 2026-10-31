import { describe, it, expect } from 'vitest';
import { LanguageResolver } from '#nexo/language/LanguageResolver.mjs';
import { ParameterBindings } from '#nexo/language/ParameterBindings.mjs';
import { ParsedTexts } from '#nexo/language/ParsedTexts.mjs';
import { ResolvedDefinition } from '#nexo/language/ResolvedDefinition.mjs';
import { Declarations } from '#nexo/language/vocabulary/Declarations.mjs';
import { NexoModule } from '#nexo/language/vocabulary/NexoModule.mjs';
import { NexoRegistry } from '#nexo/language/vocabulary/NexoRegistry.mjs';
import { Vocabulary } from '#nexo/language/vocabulary/Vocabulary.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { extensionDeclaration } from '../support/declarations.mjs';

/** A shop whose `isSmall` is a module function a script passes by reference, and whose `Strings` extension gives a string `trim`. */
const registry = new NexoRegistry([Vocabulary.module, new NexoModule('shop', {
    types: [
        extensionDeclaration('Strings', 'String', [
            Declarations.createFunctionDeclaration('trim', 'String', { updates: constantUpdates, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl: ({ receiver }) => receiver }),
        ]),
    ],
    members: [
        Declarations.createFunctionDeclaration('isSmall', 'Boolean', { updates: constantUpdates, parameters: [Declarations.createValueParameterDeclaration('n', 'Number')], impl: ({ args }) => args.n < 3 }),
    ],
})]);

const resolve = text => {
    const definition = ParsedTexts.parse(text, [{ module: 'shop' }]);

    return new LanguageResolver(registry, new ParameterBindings(registry, { numbers: [1, 2, 3], word: 'oat' }), ParsedTexts.locationsOf(definition)).resolveDefinition(definition);
};

/**
 * Each node beneath the part at the pointer, with the JSON Pointer it stands at, but a function's body, which each call of the function resolves a copy of; an interpolated string's part, and a local's, a field's or a
 * binding's entry, holds a node and is none.
 */
const nodesOf = (part, pointer, found = []) => {
    if (Array.isArray(part)) {
        part.forEach((item, index) => nodesOf(item, `${pointer}/${index}`, found));
    } else if (part !== null && typeof part === 'object') {
        if (typeof part.kind === 'string' && !/\/parts\/\d+$/.test(pointer)) {
            found.push({ node: part, pointer });
        }

        Object.entries(part)
            .filter(([key]) => !(part.kind === 'function' && key === 'body'))
            .forEach(([key, value]) => nodesOf(value, `${pointer}/${key}`, found));
    }

    return found;
};

/**
 * Each node of the definition's expression, and of each call's copy of a function's body, that resolution resolves as a node: all but a namespace, read as part of the access through it, a call's callee, resolved as
 * part of the call, which holds its resolution, and a function a local holds, which each call of the local resolves.
 */
const resolvedNodesOf = resolved => [
    ...nodesOf(resolved.definition.expression, '/expression'),
    ...resolved.functionBodyCopies.flatMap(bodyCopy => nodesOf(bodyCopy.node, bodyCopy.pointer)),
].filter(({ node, pointer }) => node.kind !== 'namespace' && !pointer.endsWith('/callee') && !(node.kind === 'function' && /\/locals\/\d+\/value$/.test(pointer)));

describe('ResolvedDefinition', () => {
    it.each([
        ['a body of locals, its result an object of fields', 'let total = numbers.sum(it)\nreturn { total = total, label = $"{total} in all" }'],
        ['a do block in the terminal position', 'do\n    numbers.count\nend'],
        ["an equality 'not' negates", 'not (word == "oat")'],
        ['an extension access, by its extension and by its name alone', '{ named = word:Strings.trim(1), alone = word:trim(2) }'],
        ['a module function given by reference, and an arrow function given as it is written', 'numbers.where(shop.isSmall).count + numbers.where(n => n > 1).count'],
        ['an access before brackets', 'numbers.reverse[0]'],
        ["a function's calls, each resolving a copy of its body", 'let next = x => x + 1\nreturn next(next(1)) + numbers.select(next(it)).count'],
    ])('gives each node of %s the pointer it stands at, and what resolution stored there', (_, text) => {
        const resolved = resolve(text);
        const nodes = resolvedNodesOf(resolved);

        expect(nodes.length).toBeGreaterThan(0);

        for (const { node, pointer } of nodes) {
            expect({ pointer: resolved.pointerOf(node), resolution: resolved.resolutionOf(node) }).toEqual({ pointer, resolution: resolved.getResolution(pointer) });
        }
    });

    it("keeps each declaration once at each pointer of the definition it is used at, in the order first used, every call of a function using its body's again", () => {
        const resolved = resolve('let next = x => x.count + numbers.count\nreturn next(numbers) + next(numbers)');

        expect(resolved.usedDeclarations.map(use => `${use.qualifiedName}@${use.pointer}`)).toEqual([
            'List.count@/expression/locals/0/value/body/left',
            'List.count@/expression/locals/0/value/body/right',
        ]);
    });

    it("takes a pointer within a call's copy of a function's body back to the body it copies, the innermost copy first, and leaves one a copy's pointer only begins", () => {
        const copies = [
            { pointer: '/expression/arguments/1', bodyPointer: '/expression/locals/0/value/body' },
            { pointer: '/expression/arguments/1/arguments/0', bodyPointer: '/expression/locals/1/value/body' },
        ];

        expect(['/expression/arguments/1', '/expression/arguments/1/left', '/expression/arguments/1/arguments/0/right', '/expression/arguments/10', '/expression'].map(pointer => ResolvedDefinition.resolveDefinitionPointer(pointer, copies))).toEqual([
            '/expression/locals/0/value/body',
            '/expression/locals/0/value/body/left',
            '/expression/locals/1/value/body/right',
            '/expression/arguments/10',
            '/expression',
        ]);
    });

    it('gives no pointer and no resolution for a node the definition does not hold', () => {
        const resolved = resolve('numbers.count');

        expect([resolved.pointerOf({ kind: 'it' }), resolved.resolutionOf({ kind: 'it' })]).toEqual([undefined, undefined]);
    });
});
