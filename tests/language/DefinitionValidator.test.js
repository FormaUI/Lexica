import { describe, it, expect } from 'vitest';
import { DefinitionValidator } from '#nexo/language/DefinitionValidator.mjs';
import { ParsedTexts } from '#nexo/language/ParsedTexts.mjs';

/** Every object the part holds, itself among them, in order. */
const objectsOf = (part, found = []) => {
    if (part !== null && typeof part === 'object') {
        found.push(part);
        Object.values(part).forEach(value => objectsOf(value, found));
    }

    return found;
};

describe('DefinitionValidator', () => {
    describe('a copy of a canonical node', () => {
        // `a` is written alone, `~b` hidden by the local `b`, and the list, the call and the strings hold every kind of part a node does.
        const { expression } = ParsedTexts.parse('let b = 1\nreturn { x = a, y = ~b, z = [a, $"{b} of {a}"].count, w = b }');

        it('holds what the node holds, every object its own and none of them frozen', () => {
            const copy = DefinitionValidator.copyOf(expression);
            const originals = new Set(objectsOf(expression));

            expect(copy).toEqual(expression);
            expect(objectsOf(copy).filter(part => originals.has(part) || Object.isFrozen(part))).toEqual([]);
        });

        it('marks each script parameter as the node marks it, written alone or hidden, and nothing else', () => {
            const marksOf = node => objectsOf(node).filter(part => part.kind === 'scriptParameter').map(part => ({ name: part.name, isWrittenAlone: DefinitionValidator.isWrittenAlone(part), isHidden: DefinitionValidator.isHidden(part) }));

            expect(marksOf(DefinitionValidator.copyOf(expression))).toEqual(marksOf(expression));
            expect(marksOf(expression)).toEqual([
                { name: 'a', isWrittenAlone: true, isHidden: false },
                { name: 'b', isWrittenAlone: false, isHidden: true },
                { name: 'a', isWrittenAlone: true, isHidden: false },
                { name: 'a', isWrittenAlone: true, isHidden: false },
            ]);
        });
    });
});
