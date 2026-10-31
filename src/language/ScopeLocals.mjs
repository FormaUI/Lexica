/**
 * ScopeLocals — the names in scope where resolution reaches a node, each with what it holds: a local, an object field, a conditional binding, a function parameter or an option
 */

/** How many names a scope adds over the map beneath it before it is flattened into one. */
const MOST_LAYERS = 16;

export class ScopeLocals {
    /** The names this scope adds to, the one beneath it; null for a scope flattened into its map. @type {ScopeLocals | null} */
    #enclosing;

    /** The name this scope adds. @type {string | null} */
    #name;

    /** What the name it adds holds. */
    #entry;

    /** Every name in scope, for a scope flattened into one map; null for one that adds a name. @type {Map<string, unknown> | null} */
    #names;

    /** How many names this scope and those beneath it add over the map beneath them. */
    #layers;

    /**
     * A scope is made empty, or by adding a name to another; neither is made directly.
     * @param {ScopeLocals | null} enclosing The scope the name is added to, null for one flattened into its map.
     * @param {string | null} name The name it adds.
     * @param {unknown} entry What the name holds.
     * @param {Map<string, unknown> | null} names Every name in scope, for a scope flattened into one map.
     * @param {number} layers How many names it and those beneath it add over the map beneath them.
     */
    constructor(enclosing, name, entry, names, layers) {
        this.#enclosing = enclosing;
        this.#name = name;
        this.#entry = entry;
        this.#names = names;
        this.#layers = layers;
    }

    /** The scope with no name in it. */
    static empty = new ScopeLocals(null, null, undefined, new Map(), 0);

    /**
     * The scope with the name added, holding the entry, and hiding any name of its spelling this one has; this scope is left as it is, so each scope keeps the names in scope where it was made. A scope adds its name over
     * this one rather than copying every name, so adding the fields of an object one by one takes as long as the fields do, not as their square; every sixteenth added flattens them into one map, so a lookup reads
     * sixteen names at most.
     */
    with(name, entry) {
        if (this.#layers < MOST_LAYERS) {
            return new ScopeLocals(this, name, entry, null, this.#layers + 1);
        }

        const names = new Map();

        this.#copyInto(names);
        names.set(name, entry);

        return new ScopeLocals(null, null, undefined, names, 0);
    }

    /** What the name holds in this scope, the one added last of its spelling; undefined where none is in scope. */
    get(name) {
        let scope = this;

        while (scope.#names === null) {
            if (scope.#name === name) {
                return scope.#entry;
            }

            scope = scope.#enclosing;
        }

        return scope.#names.get(name);
    }

    /** Whether a name of the spelling is in scope. */
    has(name) {
        let scope = this;

        while (scope.#names === null) {
            if (scope.#name === name) {
                return true;
            }

            scope = scope.#enclosing;
        }

        return scope.#names.has(name);
    }

    /** Copies every name in scope into the map, each added later replacing one of its spelling added before it. */
    #copyInto(names) {
        if (this.#names !== null) {
            this.#names.forEach((entry, name) => names.set(name, entry));

            return;
        }

        this.#enclosing.#copyInto(names);
        names.set(this.#name, this.#entry);
    }
}
