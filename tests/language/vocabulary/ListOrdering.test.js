import { describe, it, expect } from 'vitest';
import { ItemPositions } from '#lexica/language/vocabulary/ItemPositions.mjs';
import { ListOrdering } from '#lexica/language/vocabulary/ListOrdering.mjs';
import { MemberFailure } from '#lexica/language/vocabulary/MemberFailure.mjs';

const byName = item => item.name;
const byGroup = item => item.group;

describe('ListOrdering', () => {
    it('compares two keys of one domain in either direction, a null key after any other whichever the direction', () => {
        expect([ListOrdering.compareKeys(1, 2, false), ListOrdering.compareKeys(1, 2, true), ListOrdering.compareKeys(-0, 0, false)]).toEqual([-1, 1, 0]);
        expect([ListOrdering.compareKeys(null, 1, false), ListOrdering.compareKeys(null, 1, true), ListOrdering.compareKeys(1, null, true), ListOrdering.compareKeys(null, null, true)]).toEqual([1, 1, -1, 0]);
        expect([ListOrdering.compareKeys(false, true, false), ListOrdering.compareKeys('B', 'a', false)]).toEqual([-1, -1]);
    });

    it('answers a frozen ordered list, its receiver unchanged, which thenBy refines run by run and whose copy it carries', () => {
        const items = Object.freeze([{ group: 2, name: 'a' }, { group: 1, name: 'c' }, { group: 1, name: 'b' }]);
        const ordered = ListOrdering.orderBy(items, byGroup, false, 'orderBy');
        const copy = ordered.map(item => ({ ...item }));

        expect(ordered.map(byName)).toEqual(['c', 'b', 'a']);
        expect(Object.isFrozen(ordered)).toBe(true);
        expect(items.map(byName)).toEqual(['a', 'c', 'b']);
        expect(ListOrdering.thenBy(ordered, byName, false, 'thenBy').map(byName)).toEqual(['b', 'c', 'a']);
        // Each answer keeps the position its items stood at in its own receiver.
        expect([ItemPositions.getPositions(ordered), ItemPositions.getPositions(ListOrdering.thenBy(ordered, byName, false, 'thenBy'))]).toEqual([[1, 2, 0], [1, 0, 2]]);

        ListOrdering.carry(ordered, copy);

        expect(ListOrdering.thenBy(copy, byName, true, 'thenByDescending').map(byName)).toEqual(['c', 'b', 'a']);
    });

    it('takes the first item of the least or the greatest key, null keys skipped, and refuses what no ordering orders', () => {
        const items = [{ name: 'b' }, { name: null }, { name: 'a' }, { name: 'b' }];

        expect(ListOrdering.findExtreme(items, byName, false, 'minBy')).toBe(items[2]);
        expect(ListOrdering.findExtreme(items, byName, true, 'maxBy')).toBe(items[0]);
        expect(ListOrdering.findExtreme([{ name: null }], byName, true, 'maxBy')).toBeNull();
        expect(() => ListOrdering.thenBy(Object.freeze([1]), item => item, false, 'thenBy')).toThrow(MemberFailure);
        expect(() => ListOrdering.orderBy([1, 'one'], item => item, false, 'orderBy')).toThrow(expect.objectContaining({ code: 'LEXICA5036' }));
    });
});
