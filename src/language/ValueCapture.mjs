/**
 * ValueCapture — a value from outside a script captured as the type declared for it, as a value a host supplies is: a value its type admits taken, a list from an array or a set, a structure as its data shape alone,
 * and a reference of another type null where a nullable reference type is declared
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { Dictionary } from './Dictionary.mjs';
import { Pair } from './Pair.mjs';
import { StructureTypes } from './StructureTypes.mjs';
import { NexoModule } from './vocabulary/NexoModule.mjs';

export class ValueCapture {
    #registry;

    /** @param {import('./vocabulary/NexoRegistry.mjs').NexoRegistry} registry The registry whose types the value is captured as, whose modules recognize a reference of another type. */
    constructor(registry) {
        this.#registry = registry;
    }

    /**
     * The value captured as its type at every level of it: a value its type admits taken, a structure as its declared fields alone and a list item by item, from an array or a set, its items in their traversal
     * order and no uniqueness kept; nothing, or null, null where its type is nullable; and a
     * reference of another type null where a nullable reference type is declared, so the value keeps only the reference its type names. Anything else is given to `fail`, which throws, with the part of the value
     * by its path within it, the value itself by none, the part and the type it is declared; and data that reaches itself, a list or an object holding one of the lists or objects it lies within, is given to `fail`
     * as well, with the reason `'cycle'`, since data never does.
     * @param {unknown} value
     * @param {import('./Type.mjs').Type} type
     * @param {(path: string, part: unknown, type: import('./Type.mjs').Type, reason?: 'cycle') => never} fail
     * @param {string} [asked] What asks for the capture, as a recognition's fault names it.
     */
    capture(value, type, fail, asked = 'capturing a supplied value') {
        this.#asked = asked;
        this.#enclosing = new Set();
        this.#steps = [];

        return this.#capture(value, type, fail);
    }

    /** The lists and objects the part being captured lies within, which it never holds, since data doesn't reach itself. */
    #enclosing = new Set();

    /**
     * The steps from the value to the part being captured: a field's name, a list item's index, or a dictionary entry's key or value. The path they make is written only where a part fails, so a capture that succeeds
     * writes none.
     * @type {(string | number | { entry: number, part: 'key' | 'value' })[]}
     */
    #steps = [];

    /** What the capture under way was asked by, which a module's recognition, faulting, names. */
    #asked = 'capturing a supplied value';

    /** The path of the part being captured within the value, as `fail` is given it: `rooms[2].name`, and a dictionary entry's part as `.entries[0].key`. */
    #path() {
        let path = '';

        for (const step of this.#steps) {
            path = typeof step === 'number' ? `${path}[${step}]` : typeof step === 'string' ? ValueCapture.#pathOf(path, step) : `${path}.entries[${step.entry}].${step.part}`;
        }

        return path;
    }

    /** A part of the value captured as its type, one step further along the path. */
    #captureStep(value, type, step, fail) {
        this.#steps.push(step);

        const captured = this.#capture(value, type, fail);

        this.#steps.pop();

        return captured;
    }

    /** Enters a list or an object of data, whose parts are captured next, refusing one of those it lies within; `#leave` releases it once they are. */
    #enter(value, type, fail) {
        if (this.#enclosing.has(value)) {
            fail(this.#path(), value, type, 'cycle');
        }

        this.#enclosing.add(value);
    }

    #leave(value) {
        this.#enclosing.delete(value);
    }

    /** The fields of an object or a structure, each captured as its type and defined as an ordinary field, in the order of their types. */
    #captureFields(value, fieldTypes, fail) {
        const captured = {};

        for (const [name, fieldType] of fieldTypes) {
            ObjectUtils.defineDataProperty(captured, name, this.#captureStep(value[name], fieldType, name, fail));
        }

        return captured;
    }

    #capture(value, type, fail) {
        if (value === undefined || value === null) {
            if (!type.isNullable) {
                fail(this.#path(), value, type);
            }

            return null;
        }

        // A list is supplied as an array or a set, a set's items in their traversal order, the list it gives holding no uniqueness.
        if (type.isList) {
            const items = value instanceof Set ? [...value] : value;

            if (!Array.isArray(items) || ArrayUtils.findMissingIndex(items) !== -1) {
                fail(this.#path(), value, type);
            }

            this.#enter(value, type, fail);

            try {
                const captured = new Array(items.length);

                for (let index = 0; index < items.length; index++) {
                    captured[index] = this.#captureStep(items[index], type.itemType, index, fail);
                }

                return captured;
            } finally {
                this.#leave(value);
            }
        }

        // A dictionary is supplied as a map or the language's, each key and value captured as its type declares, and a pair as the language's or an object of a key and a value alone.
        if (type.isDictionary) {
            const entries = value instanceof Map ? [...value] : value instanceof Dictionary ? value.entries.map(entry => [entry.key, entry.value]) : fail(this.#path(), value, type);
            const [keyType, valueType] = type.typeArguments;

            this.#enter(value, type, fail);

            try {
                return new Dictionary(entries.map(([key, entry], index) => [this.#captureStep(key, keyType, { entry: index, part: 'key' }, fail), this.#captureStep(entry, valueType, { entry: index, part: 'value' }, fail)]));
            } finally {
                this.#leave(value);
            }
        }

        if (type.isPair) {
            const isPair = value instanceof Pair || (ObjectUtils.isPlainObject(value) && Object.keys(value).length === 2 && Object.hasOwn(value, 'key') && Object.hasOwn(value, 'value'));

            if (!isPair) {
                fail(this.#path(), value, type);
            }

            const [keyType, valueType] = type.typeArguments;

            this.#enter(value, type, fail);

            try {
                return new Pair(this.#captureStep(value.key, keyType, 'key', fail), this.#captureStep(value.value, valueType, 'value', fail));
            } finally {
                this.#leave(value);
            }
        }

        switch (type.kind) {
            case 'typeParameter':
                return value;
            case 'object':
                if (!ObjectUtils.isNonArrayObject(value)) {
                    fail(this.#path(), value, type);
                }

                this.#enter(value, type, fail);

                try {
                    return this.#captureFields(value, type.fieldTypes, fail);
                } finally {
                    this.#leave(value);
                }
            default:
                return this.#captureNamed(value, type, fail);
        }
    }

    /**
     * A value captured as a named type: a built-in type's value and a reference of the type as they are, a reference of another type null where a nullable reference type is declared, and a structure as its declared
     * fields, each captured in turn. A value from outside has no type until it is captured, so where it doesn't belong to a reference type, the registry's recognition tells a reference of another type from mistyped
     * data, which fails whatever its nullability.
     */
    #captureNamed(value, type, fail) {
        if (type.moduleName === null && NexoModule.scalarTypeNames.includes(type.name)) {
            if (!ValueCapture.belongsToScalar(value, type.name)) {
                fail(this.#path(), value, type);
            }

            return value;
        }

        const declaration = this.#registry.getTypeDeclaration(type);

        if (declaration?.kind === 'reference') {
            const asked = this.#asked;

            if (this.#registry.belongsTo(value, type, asked)) {
                return value;
            }

            if (type.isNullable && this.#registry.recognize(value, asked).length > 0) {
                return null;
            }

            fail(this.#path(), value, type);
        }

        if (declaration?.kind !== 'structured' || !ObjectUtils.isNonArrayObject(value)) {
            fail(this.#path(), value, type);
        }

        this.#enter(value, type, fail);

        let structure;

        try {
            structure = this.#captureFields(value, this.#registry.getDataShape(type), fail);
        } finally {
            this.#leave(value);
        }

        // A captured structure keeps its type through a value of Any, as one a member answers does.
        StructureTypes.recordType(structure, this.#registry, type.toNonNullable());

        return structure;
    }

    /** The path of a field within the path of the value that holds it. */
    static #pathOf(path, name) {
        return path === '' ? name : `${path}.${name}`;
    }

    /** Whether the value belongs to the scalar type the name names, one of `NexoModule.scalarTypeNames`: a finite number, a string or a Boolean. */
    static belongsToScalar(value, typeName) {
        switch (typeName) {
            case 'Number':
                return Number.isFinite(value);
            case 'String':
                return typeof value === 'string';
            case 'Boolean':
                return typeof value === 'boolean';
            default:
                return false;
        }
    }
}
