/**
 * Pair — a Lexica pair, immutable data of a key and its value, as a dictionary's entries give them
 */

export class Pair {
    /** The pair's key. */
    key;

    /** The pair's value. */
    value;

    /**
     * @param {unknown} key
     * @param {unknown} value
     */
    constructor(key, value) {
        this.key = key;
        this.value = value;
        Object.freeze(this);
    }
}
