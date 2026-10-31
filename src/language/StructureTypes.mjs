/**
 * StructureTypes — the structured type each structured value Nexo made is of, held by the value itself: a member's answer it copied, an object expression it constructed, and a value a host supplies or binds that it
 * captured, so a value of Any keeps the identity its declaration gave it
 */

/** A base whose constructor answers the value it is given, so a private field its subclass declares is added to that value. */
class Stamp {
    constructor(value) {
        return value;
    }
}

export class StructureTypes extends Stamp {
    /**
     * The registry whose declaration typed the structured value, held by the value as a private field, which no reflection reads and no copy carries, beside its type. A record lives as long as its value, is replaced
     * where another declaration gives that value as another type, and is read only against the registry that wrote it, so a value never carries a type into a registry that doesn't declare it. A weak map of every
     * value, which each record was written to before, grew with every binding until a collection, and writing it measured half of binding.
     * @type {object}
     */
    #registry;

    /** The structured type the registry gave the value. @type {import('./Type.mjs').Type} */
    #type;

    constructor(value, registry, type) {
        super(value);
        this.#registry = registry;
        this.#type = type;
    }

    /**
     * Records the structured value as of the type, a non-null structured type the registry declares; a value recorded already as the same type by the same registry keeps its record. The value is one Nexo made,
     * recorded before it is frozen, never a host's own.
     */
    static recordType(value, registry, type) {
        if (!(#registry in value)) {
            new StructureTypes(value, registry, type);
        } else {
            value.#registry = registry;
            value.#type = type;
        }
    }

    /** The structured type the value was recorded as, where the registry given recorded it, and undefined otherwise. */
    static getType(value, registry) {
        return #registry in value && value.#registry === registry ? value.#type : undefined;
    }
}
