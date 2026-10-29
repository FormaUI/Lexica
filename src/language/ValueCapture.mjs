/**
 * ValueCapture — a value from outside a script captured as the type declared for it, as a value a host supplies is: a value its type admits taken, a structure as its data shape alone, and a reference of another type
 * null where a nullable reference type is declared
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { Dictionary } from './Dictionary.mjs';
import { Pair } from './Pair.mjs';
import { StructureTypes } from './StructureTypes.mjs';
import { LexicaModule } from './vocabulary/LexicaModule.mjs';

export class ValueCapture {
    #registry;

    /** @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} registry The registry whose types the value is captured as, whose modules recognize a reference of another type. */
    constructor(registry) {
        this.#registry = registry;
    }

    /**
     * The value captured as its type at every level of it: a value its type admits taken, a structure as its declared fields alone and a list item by item; nothing, or null, null where its type is nullable; and a
     * reference of another type null where a nullable reference type is declared, so the value keeps only the reference its type names. Anything else is given to `fail`, which throws, with the part of the value
     * by its path within it, the value itself by none, the part and the type it is declared.
     * @param {unknown} value
     * @param {import('./Type.mjs').Type} type
     * @param {(path: string, part: unknown, type: import('./Type.mjs').Type) => never} fail
     * @param {string} [asked] What asks for the capture, as a recognition's fault names it.
     */
    capture(value, type, fail, asked = 'capturing a supplied value') {
        this.#asked = asked;

        return this.#capture(value, type, '', fail);
    }

    /** What the capture under way was asked by, which a module's recognition, faulting, names. */
    #asked = 'capturing a supplied value';

    #capture(value, type, path, fail) {
        if (value === undefined || value === null) {
            if (!type.isNullable) {
                fail(path, value, type);
            }

            return null;
        }

        if (type.isList) {
            if (!Array.isArray(value) || ArrayUtils.findMissingIndex(value) !== -1) {
                fail(path, value, type);
            }

            return value.map((item, index) => this.#capture(item, type.itemType, `${path}[${index}]`, fail));
        }

        // A dictionary is supplied as a map or the language's, each key and value captured as its type declares, and a pair as the language's or an object of a key and a value alone.
        if (type.isDictionary) {
            const entries = value instanceof Map ? [...value] : value instanceof Dictionary ? value.entries.map(entry => [entry.key, entry.value]) : fail(path, value, type);
            const [keyType, valueType] = type.typeArguments;

            return new Dictionary(entries.map(([key, entry], index) => [this.#capture(key, keyType, `${path}.entries[${index}].key`, fail), this.#capture(entry, valueType, `${path}.entries[${index}].value`, fail)]));
        }

        if (type.isPair) {
            const isPair = value instanceof Pair || (ObjectUtils.isPlainObject(value) && Object.keys(value).length === 2 && Object.hasOwn(value, 'key') && Object.hasOwn(value, 'value'));

            if (!isPair) {
                fail(path, value, type);
            }

            const [keyType, valueType] = type.typeArguments;

            return new Pair(this.#capture(value.key, keyType, ValueCapture.#pathOf(path, 'key'), fail), this.#capture(value.value, valueType, ValueCapture.#pathOf(path, 'value'), fail));
        }

        switch (type.kind) {
            case 'typeParameter':
                return value;
            case 'object':
                if (!ObjectUtils.isNonArrayObject(value)) {
                    fail(path, value, type);
                }

                return Object.fromEntries([...type.fieldTypes].map(([name, fieldType]) => [name, this.#capture(value[name], fieldType, ValueCapture.#pathOf(path, name), fail)]));
            default:
                return this.#captureNamed(value, type, path, fail);
        }
    }

    /**
     * A value captured as a named type: a built-in type's value and a reference of the type as they are, a reference of another type null where a nullable reference type is declared, and a structure as its declared
     * fields, each captured in turn. A value from outside has no type until it is captured, so where it doesn't belong to a reference type, the registry's recognition tells a reference of another type from mistyped
     * data, which fails whatever its nullability.
     */
    #captureNamed(value, type, path, fail) {
        if (type.moduleName === null && LexicaModule.scalarTypeNames.includes(type.name)) {
            if (!ValueCapture.belongsToScalar(value, type.name)) {
                fail(path, value, type);
            }

            return value;
        }

        if (this.#registry.isReferenceType(type)) {
            const asked = this.#asked;

            if (this.#registry.belongsTo(value, type, asked)) {
                return value;
            }

            if (type.isNullable && this.#registry.recognize(value, asked).length > 0) {
                return null;
            }

            fail(path, value, type);
        }

        const isStructured = this.#registry.getTypeDeclaration(type)?.kind === 'structured';

        if (!isStructured || !ObjectUtils.isNonArrayObject(value)) {
            fail(path, value, type);
        }

        const structure = Object.fromEntries([...this.#registry.getDataShape(type)].map(([name, fieldType]) => [name, this.#capture(value[name], fieldType, ValueCapture.#pathOf(path, name), fail)]));

        // A captured structure keeps its type through a value of Any, as one a member answers does.
        StructureTypes.recordType(structure, this.#registry, type.toNonNullable());

        return structure;
    }

    /** The path of a field within the path of the value that holds it. */
    static #pathOf(path, name) {
        return path === '' ? name : `${path}.${name}`;
    }

    /** Whether the value belongs to the scalar type the name names, one of `LexicaModule.scalarTypeNames`: a finite number, a string or a Boolean. */
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
