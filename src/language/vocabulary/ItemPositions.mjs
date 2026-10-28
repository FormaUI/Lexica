/**
 * ItemPositions — where in its receiver each item stood of a list one of Lexica's own members answered of its receiver's items, kept with that list, so the item's lineage follows its occurrence rather than its value
 */

export class ItemPositions {
    /**
     * The receiver's positions of the items of each list `createAnswer` created, by the list. A list never changes, so an entry is valid for good, and it is released with its list, which the map holds weakly; no
     * evaluation reads another's lists, so none shares an entry.
     * @type {WeakMap<object, readonly number[]>}
     */
    static #positions = new WeakMap();

    /**
     * The receiver's items at the positions, in the positions' order, a position given twice giving its item twice, as a frozen list that keeps the positions, which `getPositions` reads. Each position is one the
     * receiver has an item at, which its member has checked.
     */
    static createAnswer(receiver, positions) {
        const answer = Object.freeze(positions.map(position => receiver[position]));

        ItemPositions.#positions.set(answer, Object.freeze([...positions]));

        return answer;
    }

    /** The position in its receiver of each item of a list `createAnswer` created, in the list's order, or undefined for any other list. */
    static getPositions(list) {
        return ItemPositions.#positions.get(list);
    }

    /** The positions from the start to before the end, in order, none where the end is not after the start. */
    static createSpan(start, end) {
        return Array.from({ length: Math.max(end - start, 0) }, (_, offset) => start + offset);
    }
}
