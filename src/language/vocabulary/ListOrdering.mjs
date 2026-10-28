/**
 * ListOrdering — the order `orderBy` and `thenBy` give a list: each item's keys, one for each criterion, kept with the list they ordered, so a later `thenBy` refines its ties without evaluating them again
 */

import { MemberFailure } from './MemberFailure.mjs';

/** The domains an ordering key is of, each compared within itself alone: numbers numerically, strings by code unit, without a locale, and Booleans, false before true. */
const KEY_DOMAINS = Object.freeze(['number', 'string', 'boolean']);

export class ListOrdering {
    /**
     * The ordering of each list `orderBy` or `thenBy` answered, or a copy of it carried that ordering, by the list. A list never changes, so an entry is valid for good, and it is released with its list, which the map holds
     * weakly; no evaluation reads another's lists, so none shares an entry.
     * @type {WeakMap<object, ListOrdering>}
     */
    static #orderings = new WeakMap();

    /** Each item's keys, in the list's order, one for each criterion in the order they were applied. @type {readonly (readonly unknown[])[]} */
    #keys;

    /** @param {readonly (readonly unknown[])[]} keys Each item's keys, in the list's order. */
    constructor(keys) {
        this.#keys = keys;
    }

    /**
     * The items ordered by the key each gives, its expression evaluated once for each item, ascending or descending, a null key last either way, items of equal keys keeping their order; the answer keeps its
     * keys, so `thenBy` refines it. A key of no domain, or keys of two, are refused (LEXICA5036).
     */
    static orderBy(list, keyOf, isDescending, memberName) {
        const keys = ListOrdering.#evaluateKeys(list, keyOf, memberName);
        const order = list.map((_, index) => index).sort((one, other) => ListOrdering.compareKeys(keys[one], keys[other], isDescending));

        return ListOrdering.#createOrdered(order.map(index => list[index]), order.map(index => Object.freeze([keys[index]])));
    }

    /**
     * The items `orderBy` and any `thenBy` after it ordered, each run of items whose keys so far are equal ordered within itself by the key each gives, evaluated once for each item, ascending or descending, a null key
     * last either way; items keep their place where their keys are equal, so the list is refined, never sorted again. A list no `orderBy` ordered is refused (LEXICA5037), and a key of no domain, or keys of two
     * (LEXICA5036).
     */
    static thenBy(list, keyOf, isDescending, memberName) {
        const ordering = ListOrdering.#orderings.get(list);

        if (ordering === undefined) {
            throw new MemberFailure('LEXICA5037', `'${memberName}' refines the order 'orderBy' gave a list, and this list was ordered by no 'orderBy': order it with 'orderBy' first, which a local or 'thenBy' keeps, and no other member does`);
        }

        const keys = ListOrdering.#evaluateKeys(list, keyOf, memberName);
        const order = [];

        for (let start = 0; start < list.length;) {
            let end = start + 1;

            while (end < list.length && ListOrdering.#haveEqualKeys(ordering.#keys[start], ordering.#keys[end])) {
                end++;
            }

            const run = Array.from({ length: end - start }, (_, offset) => start + offset);

            order.push(...run.sort((one, other) => ListOrdering.compareKeys(keys[one], keys[other], isDescending)));
            start = end;
        }

        return ListOrdering.#createOrdered(order.map(index => list[index]), order.map(index => Object.freeze([...ordering.#keys[index], keys[index]])));
    }

    /** The first item whose key is the least, or the greatest, items whose key is null skipped, and null where none gives one; a key of no domain, or keys of two, are refused (LEXICA5036). */
    static findExtreme(list, keyOf, isGreatest, memberName) {
        const keys = ListOrdering.#evaluateKeys(list, keyOf, memberName);
        let best = -1;

        keys.forEach((key, index) => {
            if (key !== null && (best === -1 || ListOrdering.compareKeys(key, keys[best], isGreatest) < 0)) {
                best = index;
            }
        });

        return best === -1 ? null : list[best];
    }

    /** Carries the ordering of the list a member answered to the copy of it the evaluation keeps, its items in the same places, so a `thenBy` given the copy refines it. */
    static carry(list, copy) {
        const ordering = ListOrdering.#orderings.get(list);

        if (ordering !== undefined) {
            ListOrdering.#orderings.set(copy, ordering);
        }
    }

    /** How two keys of one domain order, ascending or descending, a null key after any other whichever the direction. */
    static compareKeys(one, other, isDescending) {
        if (one === null || other === null) {
            return one === other ? 0 : one === null ? 1 : -1;
        }

        const ascending = one < other ? -1 : one > other ? 1 : 0;

        return isDescending ? -ascending : ascending;
    }

    /** Each item's key, its expression evaluated once for each item, checked to be null or of one domain, which every key of the criterion shares. */
    static #evaluateKeys(list, keyOf, memberName) {
        const keys = list.map(item => keyOf(item));
        let domain = null;

        for (const key of keys) {
            if (key === null) {
                continue;
            }

            if (!KEY_DOMAINS.includes(typeof key)) {
                throw new MemberFailure('LEXICA5036', `'${memberName}' orders by numbers, strings or Booleans, and a key is ${ListOrdering.#describe(key)}`);
            }

            domain ??= typeof key;

            if (typeof key !== domain) {
                throw new MemberFailure('LEXICA5036', `'${memberName}' orders by keys of one domain, and its keys are ${domain}s and ${typeof key}s`);
            }
        }

        return keys;
    }

    /** Whether two items' keys so far are equal, criterion by criterion, null equal to null and `-0` to `0`. */
    static #haveEqualKeys(one, other) {
        return one.every((key, index) => key === other[index]);
    }

    /** The items, frozen, holding each item's keys as their ordering. */
    static #createOrdered(items, keys) {
        const ordered = Object.freeze(items);

        ListOrdering.#orderings.set(ordered, new ListOrdering(Object.freeze(keys)));

        return ordered;
    }

    /** A key outside the ordering domains, as a message names it. */
    static #describe(key) {
        return Array.isArray(key) ? 'a list' : typeof key === 'object' ? 'an object or a reference' : `a ${typeof key}`;
    }
}
