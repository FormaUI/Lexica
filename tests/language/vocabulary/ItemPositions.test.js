import { describe, it, expect } from 'vitest';
import { ItemPositions } from '#nexo/language/vocabulary/ItemPositions.mjs';

describe('ItemPositions', () => {
    it("answers the receiver's items at the positions, in their order, a position given twice giving its item twice, as a frozen list keeping a frozen copy of the positions", () => {
        const receiver = ['a', 'b', 'c'];
        const positions = [2, 0, 2];
        const answer = ItemPositions.createAnswer(receiver, positions);

        expect(answer).toEqual(['c', 'a', 'c']);
        expect(ItemPositions.getPositions(answer)).toEqual([2, 0, 2]);
        expect(ItemPositions.getPositions(answer)).not.toBe(positions);
        expect([Object.isFrozen(answer), Object.isFrozen(ItemPositions.getPositions(answer)), Object.isFrozen(positions)]).toEqual([true, true, false]);
        expect(receiver).toEqual(['a', 'b', 'c']);
    });

    it('keeps no positions for any other list, an equal one and a copy among them', () => {
        const answer = ItemPositions.createAnswer(['a'], [0]);

        expect([ItemPositions.getPositions(['a']), ItemPositions.getPositions([...answer])]).toEqual([undefined, undefined]);
    });

    it('creates the positions from a start to before an end, none where the end is not after the start', () => {
        expect([ItemPositions.createSpan(1, 4), ItemPositions.createSpan(2, 2), ItemPositions.createSpan(3, 1)]).toEqual([[1, 2, 3], [], []]);
    });
});
