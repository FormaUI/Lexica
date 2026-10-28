/**
 * Index — a position counted from a list's end, `^n`: its offset, a nonnegative safe integer, `^1` the last item and `^0` the end past it
 */

export class Index {
    /** How far from the end the position stands. */
    #offset;

    /** @param {number} offset A nonnegative safe integer, which its expression's evaluation checked. */
    constructor(offset) {
        this.#offset = offset;
        Object.freeze(this);
    }

    /** How far from the end the position stands. */
    get offset() {
        return this.#offset;
    }

    /** The offset from the start the index stands at within a list of the length: the length less its offset, which is negative for an index before the start. */
    resolveIn(length) {
        return length - this.#offset;
    }

    /** The index as a script writes it. */
    toString() {
        return `^${this.#offset}`;
    }
}
