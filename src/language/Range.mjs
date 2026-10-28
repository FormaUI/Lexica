/**
 * Range — a half-open interval of a list's positions: its start and its end, each a number counted from the start, an index counted from the end, or null where the range leaves it out
 */

import { Index } from './Index.mjs';

export class Range {
    /** @type {number | Index | null} */
    #start;

    /** @type {number | Index | null} */
    #end;

    /**
     * @param {number | Index | null} start Its start, a nonnegative safe integer or an index, null where it is left out, the list's start.
     * @param {number | Index | null} end Its end, a nonnegative safe integer or an index, null where it is left out, the list's end.
     */
    constructor(start, end) {
        this.#start = start;
        this.#end = end;
        Object.freeze(this);
    }

    /** Its start, null where it is left out. */
    get start() {
        return this.#start;
    }

    /** Its end, null where it is left out. */
    get end() {
        return this.#end;
    }

    /** The offsets from the start its boundaries stand at within a list of the length, applied to that one length: a start left out 0, an end left out the length, an index the length less its offset. */
    resolveIn(length) {
        return { start: Range.#offsetOf(this.#start, 0, length), end: Range.#offsetOf(this.#end, length, length) };
    }

    /** The range as a script writes it. */
    toString() {
        return `${this.#start ?? ''}..${this.#end ?? ''}`;
    }

    static #offsetOf(boundary, absent, length) {
        if (boundary === null) {
            return absent;
        }

        return boundary instanceof Index ? boundary.resolveIn(length) : boundary;
    }
}
