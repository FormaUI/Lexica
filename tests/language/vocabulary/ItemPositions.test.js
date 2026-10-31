import { describe, it, expect } from 'vitest';
import { ItemPositions } from '#nexo/language/vocabulary/ItemPositions.mjs';

describe('ItemPositions', () => {
    it("answers the receiver's items at the positions, in their order, a position given twice giving its item twice, as a frozen list whose positions it hands over once", () => {
        const receiver = ['a', 'b', 'c'];
        const positions = [2, 0, 2];
        const answer = ItemPositions.createAnswer(receiver, positions);

        expect(answer).toEqual(['c', 'a', 'c']);
        expect(Object.isFrozen(answer)).toBe(true);
        expect(ItemPositions.takePositions(answer)).toBe(positions);
        expect(ItemPositions.takePositions(answer)).toBeUndefined();
        expect(receiver).toEqual(['a', 'b', 'c']);
    });

    it('hands over the positions of the answer created last alone, never those of an earlier one, an equal list or a copy', () => {
        const earlier = ItemPositions.createAnswer(['a'], [0]);
        const later = ItemPositions.createAnswer(['a', 'b'], [1]);

        expect([ItemPositions.takePositions(earlier), ItemPositions.takePositions(['b']), ItemPositions.takePositions([...later])]).toEqual([undefined, undefined, undefined]);
        expect(ItemPositions.takePositions(later)).toEqual([1]);
    });

    it('creates the positions from a start to before an end, none where the end is not after the start', () => {
        expect([ItemPositions.createSpan(1, 4), ItemPositions.createSpan(2, 2), ItemPositions.createSpan(3, 1)]).toEqual([[1, 2, 3], [], []]);
    });
});
