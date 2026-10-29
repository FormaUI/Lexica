/**
 * StructureTypes — the structured type each structured value Nexo made is of, by the value: a member's answer it copied, an object expression it constructed, and a value a host supplies or binds that it captured,
 * so a value of Any keeps the identity its declaration gave it
 */

export class StructureTypes {
    /**
     * The type of each structured value, with the registry whose declaration typed it, by the value. An entry is held as long as its value is, and is replaced where another declaration gives that value as another
     * type, which only an answer of its declared shape already can; it is read only against the registry that wrote it, so a value never carries a type into a registry that doesn't declare it.
     * @type {WeakMap<object, { registry: object, type: import('./Type.mjs').Type }>}
     */
    static #types = new WeakMap();

    /** Records the structured value as of the type, a non-null structured type the registry declares. */
    static recordType(value, registry, type) {
        StructureTypes.#types.set(value, { registry, type });
    }

    /** The structured type the value was recorded as, where the registry given recorded it, and undefined otherwise. */
    static getType(value, registry) {
        const recorded = StructureTypes.#types.get(value);

        return recorded?.registry === registry ? recorded.type : undefined;
    }
}
