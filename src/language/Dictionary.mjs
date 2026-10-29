/**
 * Dictionary — a Nexo dictionary, immutable: its entries in the order they were inserted, each key at most once by Nexo's key equality, a number's zero and negative zero one key, a string by its code units, a
 * Boolean by its value, a reference by its identity and null as one key of its own
 */

import { Pair } from './Pair.mjs';

export class Dictionary {
    /** Each key's value, in the order the keys were inserted, a JavaScript map's key equality being Nexo's for the keys a dictionary holds. @type {Map<unknown, unknown>} */
    #entries;

    /** @param {Iterable<[unknown, unknown]>} entries Its entries, in order, each key once, which its caller has checked. */
    constructor(entries) {
        this.#entries = new Map(entries);
        Object.freeze(this);
    }

    /** How many entries the dictionary holds. */
    get count() {
        return this.#entries.size;
    }

    /** Whether the dictionary holds the key, a key whose value is null among them. */
    has(key) {
        return this.#entries.has(key);
    }

    /** The key's value, or null where the dictionary holds no such key, so a key whose value is null is told apart by `has` alone. */
    get(key) {
        return this.#entries.has(key) ? this.#entries.get(key) : null;
    }

    /** The key's entry as a pair, or null where the dictionary holds no such key. */
    getEntry(key) {
        return this.#entries.has(key) ? new Pair(key, this.#entries.get(key)) : null;
    }

    /** The keys, in their order, as a frozen list. */
    get keys() {
        return Object.freeze([...this.#entries.keys()]);
    }

    /** The values, in their keys' order, as a frozen list. */
    get values() {
        return Object.freeze([...this.#entries.values()]);
    }

    /** The entries, in their order, each a pair, as a frozen list. */
    get entries() {
        return Object.freeze([...this.#entries].map(([key, value]) => new Pair(key, value)));
    }
}
