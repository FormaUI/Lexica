/**
 * ItemPositions — where in its receiver each item stood of a list one of Nexo's own members answered of its receiver's items, handed with that list to the invocation that answers it, so the item's lineage follows its
 * occurrence rather than its value
 */

export class ItemPositions {
    /**
     * The list `createAnswer` created last, and the receiver's position of each of its items, which `takePositions` hands over once. A member creates its answer after everything it evaluates, its functions' calls among
     * them, and its invocation takes the positions as the member returns, so no other answer is created between the two. The slot is valid until another answer is created, and releases the list and its positions
     * once taken; a global map of every answer's positions, written for each, measured a twentieth of an evaluation.
     */
    static #answer = null;

    /** @type {readonly number[] | null} */
    static #positions = null;

    /**
     * The receiver's items at the positions, in the positions' order, a position given twice giving its item twice, as a frozen list whose positions `takePositions` hands over. Each position is one the receiver has an
     * item at, which its member has checked, and the member never changes the positions it gives.
     */
    static createAnswer(receiver, positions) {
        const answer = Object.freeze(positions.map(position => receiver[position]));

        ItemPositions.#answer = answer;
        ItemPositions.#positions = positions;

        return answer;
    }

    /** The position in its receiver of each item of the list, in the list's order, where `createAnswer` created it last and none has taken them, handed over once; undefined for any other list. */
    static takePositions(list) {
        if (list !== ItemPositions.#answer) {
            return undefined;
        }

        const positions = ItemPositions.#positions;

        ItemPositions.#answer = null;
        ItemPositions.#positions = null;

        return positions;
    }

    /** The positions from the start to before the end, in order, none where the end is not after the start. */
    static createSpan(start, end) {
        return Array.from({ length: Math.max(end - start, 0) }, (_, offset) => start + offset);
    }
}
