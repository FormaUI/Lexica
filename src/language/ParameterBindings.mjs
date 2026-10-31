/**
 * ParameterBindings — the values an expression's parameters are bound to, by name, against the registry that recognizes their references
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { Dictionary } from './Dictionary.mjs';
import { NexoErrors } from './NexoError.mjs';
import { Names } from './Names.mjs';
import { Pair } from './Pair.mjs';
import { Type } from './Type.mjs';
import { ValueCapture } from './ValueCapture.mjs';

export class ParameterBindings {
    /** @type {import('./vocabulary/NexoRegistry.mjs').NexoRegistry} */
    #registry;

    /** @type {Map<string, unknown>} */
    #values = new Map();

    /** @type {Map<string, Type>} */
    #types = new Map();

    /**
     * Binds each value to its name, asking the registry's modules which values are references before copying anything: a reference is kept as it is, by its identity, a reference nested in data among them, and the rest of the data
     * is copied and frozen. A top-level binding's declared type, a notation the registry resolves, is its type in place of recognition: a reference type's value checked by the type's membership, and any other
     * type's value captured as that type.
     * @param {import('./vocabulary/NexoRegistry.mjs').NexoRegistry} registry The registry the bindings belong to.
     * @param {Record<string, unknown>} parameters Each parameter's name and the value it is bound to.
     * @param {{ types?: Record<string, string> }} [options] The type declared for a top-level binding, by its name, as a notation.
     */
    constructor(registry, parameters = {}, options = {}) {
        this.#registry = registry;

        if (!ObjectUtils.isPlainObject(parameters)) {
            throw NexoErrors.structure('NEXO2020', 'Bindings are a plain object of names and the values bound to them', {});
        }

        const declaredTypeNames = options?.types ?? {};

        if (!ObjectUtils.isPlainObject(options ?? {}) || !ObjectUtils.isPlainObject(declaredTypeNames)) {
            throw NexoErrors.structure('NEXO2020', "A binding's options are a plain object, and the types it declares a plain object of top-level bindings' names and the types declared for them", {});
        }

        for (const name of Object.keys(declaredTypeNames)) {
            if (!Object.hasOwn(parameters, name)) {
                throw NexoErrors.structure('NEXO2039', `A type is declared for a top-level binding alone, and no binding is named '${name}'`, { binding: name });
            }
        }

        for (const [name, value] of Object.entries(parameters)) {
            // A binding a reserved word names is read as `~` and its name, which written alone keeps its own meaning.
            if (!Names.isIdentifier(name)) {
                throw NexoErrors.structure('NEXO2033', 'A binding is named by a letter followed by letters and digits', { binding: name });
            }

            const bound = Object.hasOwn(declaredTypeNames, name) ? this.#bindDeclared(name, value, declaredTypeNames[name]) : this.#bind(name, value, new Set());

            this.#types.set(name, bound.type);
            this.#values.set(name, bound.value);
        }
    }

    /** The registry the bindings belong to, which recognized their references. */
    get registry() {
        return this.#registry;
    }

    /** Whether a value is bound to the name. */
    has(name) {
        return this.#values.has(name);
    }

    /** Reads the value bound to the name: its data a frozen copy of the data given, and each reference the reference itself. */
    readValue(name) {
        return this.#values.get(name);
    }

    /** The type of the value bound to the name, which its host declared or the value reveals. */
    getType(name) {
        return this.#types.get(name);
    }

    /**
     * What resolving a definition against these bindings depends on: each name with its type, written by its qualified identity, and its value where that is a string, a number, a Boolean or null, since a bound string can select
     * what a member reads. Two bindings with one key resolve a definition alike, so they can share its resolution.
     */
    get resolutionKey() {
        return [...this.#types.keys()].sort().map(name => {
            const value = this.#values.get(name);
            const isPrimitive = value === null || ['string', 'number', 'boolean'].includes(typeof value);

            return `${name}:${this.#types.get(name).toString(true)}${isPrimitive ? `=${JSON.stringify(value)}` : ''}`;
        }).join(';');
    }

    /**
     * A top-level binding of a declared type, the notation read in the binding scope, its names qualified or not. A reference type keeps its contract: the value belongs to it, checked by its membership, and no `typeOf`
     * is asked of it. Any other type captures the value as a value its host supplies is captured: a structure as its data shape alone, a property left out null where its type is nullable, a reference of another type
     * null where a nullable reference type is declared, and data the type doesn't admit refused (NEXO2045), naming the part; the capture freezes the data it makes, as bound data is, its references kept as they are.
     */
    #bindDeclared(name, value, typeName) {
        const fail = (code, message) => {
            throw NexoErrors.structure(code, `The type declared for '${name}': ${message}`, { binding: name });
        };
        const type = typeof typeName === 'string' ? this.#registry.resolveBindingType(typeName, fail) : fail('NEXO2036', `${String(typeName)} is no public type`);

        if (this.#registry.isReferenceType(type)) {
            if (value === null && type.isNullable) {
                return { type, value };
            }

            if (value === null || typeof value !== 'object') {
                throw NexoErrors.structure('NEXO2038', `A type is declared for a reference, and '${name}' is bound to data`, { binding: name });
            }

            if (!this.#registry.belongsTo(value, type, `the binding '${name}'`)) {
                throw NexoErrors.structure('NEXO2036', `The value bound to '${name}' doesn't belong to its declared type, ${type}`, { binding: name });
            }

            return { type, value };
        }

        if (!this.#holdsBoundValues(type, new Set())) {
            fail('NEXO2044', `${typeName} is a type no binding holds, or holds one in its data, as Any, Never, an Index and a Range are`);
        }

        const captured = new ValueCapture(this.#registry).capture(value, type, (path, part, partType, reason) => {
            if (reason === 'cycle') {
                throw NexoErrors.structure('NEXO2022', `A binding holds a cycle, a list or an object that reaches itself, which data never does${path === '' ? '' : `, at '${path}'`}`, { binding: name });
            }

            const given = path === '' ? `it is given ${ParameterBindings.#describe(part)}` : part === undefined ? `it is given a value without '${path}'` : `its '${path}' is ${ParameterBindings.#describe(part)}`;

            throw NexoErrors.structure('NEXO2045', `The value bound to '${name}' is declared ${type}, and ${given}, where ${partType} is declared`, { binding: name });
        }, `the binding '${name}'`);

        // The capture freezes each part of the data it makes, never a reference it holds, which stays the host's own.
        return { type, value: captured };
    }

    /**
     * Whether values of the type are ones a binding holds, at any depth, its type arguments, its object fields and a structure's data shape among them: never `Any`, `Never` or a position, which no host gives a
     * script, a structure already being walked counting as holding none, since its properties are walked where it is first met.
     */
    #holdsBoundValues(type, walking) {
        switch (type.kind) {
            case 'any':
            case 'never':
                return false;
            case 'object':
                return [...type.fieldTypes.values()].every(fieldType => this.#holdsBoundValues(fieldType, walking));
            case 'named': {
                if (type.moduleName === null && ['Index', 'Range'].includes(type.name)) {
                    return false;
                }

                if (type.typeArguments.length > 0) {
                    return type.typeArguments.every(typeArgument => this.#holdsBoundValues(typeArgument, walking));
                }

                const shape = this.#registry.getDataShape(type);

                if (shape === null || walking.has(type.identity)) {
                    return true;
                }

                walking.add(type.identity);

                return [...shape.values()].every(propertyType => this.#holdsBoundValues(propertyType, walking));
            }
            default:
                return true;
        }
    }

    /** What a value is, for a message: its text where it is data, and what kind of value it is otherwise. */
    static #describe(value) {
        if (value === undefined) {
            return 'nothing';
        }

        // JSON writes a number that isn't finite as null, which would name another value.
        if (typeof value === 'number' && !Number.isFinite(value)) {
            return String(value);
        }

        try {
            return JSON.stringify(value) ?? String(value);
        } catch {
            return Array.isArray(value) ? 'a list' : 'an object';
        }
    }

    /**
     * The type and the bound form of a value, at any depth of a binding: a reference the registry's modules recognize, the one type beneath every other where several do, kept as it is; null, a string, a finite number and a Boolean as
     * they are; a list typed by the type its items share, a set as the list of its items in its order, a map and a dictionary as a dictionary of the key and value types its entries share, a pair by its key's and value's
     * types, and an object by its fields' types, each copied and frozen. It types and copies in one walk, offering each object it reaches to the registry's modules before copying it, so every module's `typeOf` is asked
     * of it and a reference nested in data is kept as it is. A value no module recognizes that is no data (NEXO2034), a list of items of no shared type (NEXO2021), a dictionary key of no key type (NEXO2041), keys or
     * values of no shared type (NEXO2042), and data that reaches itself (NEXO2022) are refused.
     */
    #bind(name, value, ancestors) {
        if (value === null) {
            return { type: Type.null, value };
        }

        if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
            return { type: Type.createPrimitiveType(value), value };
        }

        if (typeof value === 'object') {
            const recognized = this.#registry.recognize(value, `the binding '${name}'`);

            if (recognized.length > 0) {
                return { type: this.#mostSpecificOf(name, recognized), value };
            }

            if (ancestors.has(value)) {
                throw NexoErrors.structure('NEXO2022', 'A binding holds a cycle, a list or an object that reaches itself, which data never does', { binding: name });
            }

            if (Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1) {
                return this.#bindList(name, value, ancestors);
            }

            // A set is a list of its items in its order, its uniqueness making no later projection one, and a map a dictionary, each captured as it stands and never a live view.
            if (value instanceof Set) {
                return this.#bindList(name, [...value], ancestors, value);
            }

            if (value instanceof Map || value instanceof Dictionary) {
                return this.#bindDictionary(name, value instanceof Map ? [...value] : value.entries.map(entry => [entry.key, entry.value]), ancestors, value);
            }

            if (value instanceof Pair) {
                return this.#bindPair(name, value, ancestors);
            }

            if (ObjectUtils.isPlainObject(value)) {
                return this.#bindObject(name, value, ancestors);
            }
        }

        throw NexoErrors.structure('NEXO2034', 'A binding is a reference a registered module recognizes, or data: a number, a string, a Boolean, null, a list holding a value at every index, or an object', { binding: name });
    }

    /** A list, typed by the type its items share, the nearest supertype references of different types share, made nullable where one of them is null, and the empty list's being never; copied and frozen. Its type merges as each item is bound, so binding stops at the first item whose type shares none with those before it. */
    #bindList(name, list, ancestors, container = list) {
        ancestors.add(container);

        let itemType = Type.never;
        const items = [];

        for (const item of list) {
            const bound = this.#bind(name, item, ancestors);

            itemType = this.#registry.typeChecker.merge(itemType, bound.type);

            if (itemType === null) {
                throw NexoErrors.structure('NEXO2021', 'A list whose items have different types has no type, since Nexo has no union types and a list holds items of one type', { binding: name });
            }

            items.push(bound.value);
        }

        ancestors.delete(container);

        return { type: Type.createListType(itemType), value: Object.freeze(items) };
    }

    /**
     * A dictionary of its entries, in their order, of the key type its keys share and the value type its values share, each merging as a list's items' types do, the empty one's both never: each key a number, a string,
     * a Boolean, a reference or null, which Nexo's key equality compares exactly, and each key and value bound in turn. A JavaScript map's keys are unique by that equality, so no capture holds a key twice.
     */
    #bindDictionary(name, entries, ancestors, container) {
        ancestors.add(container);

        let keyType = Type.never;
        let valueType = Type.never;
        const bound = [];

        for (const [key, value] of entries) {
            const boundKey = this.#bind(name, key, ancestors);

            if (!this.#registry.isKeyType(boundKey.type)) {
                throw NexoErrors.structure('NEXO2041', `A dictionary's key is a number, a string, a Boolean, a reference or null, which Nexo's key equality compares exactly, and one bound to '${name}' is of ${boundKey.type}`, { binding: name });
            }

            const boundValue = this.#bind(name, value, ancestors);

            keyType = this.#registry.typeChecker.merge(keyType, boundKey.type);
            valueType = valueType === null ? null : this.#registry.typeChecker.merge(valueType, boundValue.type);

            if (keyType === null || valueType === null) {
                throw NexoErrors.structure('NEXO2042', `A dictionary whose ${keyType === null ? 'keys' : 'values'} have different types has no type, since Nexo has no union types and a dictionary holds keys of one type and values of one type`, { binding: name });
            }

            bound.push([boundKey.value, boundValue.value]);
        }

        ancestors.delete(container);

        return { type: Type.createDictionaryType(keyType, valueType), value: new Dictionary(bound) };
    }

    /** A pair, of its key's type and its value's, each bound in turn. */
    #bindPair(name, pair, ancestors) {
        ancestors.add(pair);

        const key = this.#bind(name, pair.key, ancestors);
        const value = this.#bind(name, pair.value, ancestors);

        ancestors.delete(pair);

        return { type: Type.createPairType(key.type, value.type), value: new Pair(key.value, value.value) };
    }

    /** An object, of the object type of its fields' types, copied and frozen, every own field kept, `__proto__` among them, as an ordinary field. */
    #bindObject(name, object, ancestors) {
        ancestors.add(object);

        const fieldTypes = new Map();
        const copy = {};

        for (const [fieldName, field] of Object.entries(object)) {
            const bound = this.#bind(name, field, ancestors);

            fieldTypes.set(fieldName, bound.type);
            ObjectUtils.defineDataProperty(copy, fieldName, bound.value);
        }

        ancestors.delete(object);

        return { type: Type.createObjectType(fieldTypes), value: Object.freeze(copy) };
    }

    /** The one recognized type beneath every other, as a light that two modules recognize as a `Device` and a `Light` is a `Light`; types of which none is beneath the others are refused as ambiguous. */
    #mostSpecificOf(name, types) {
        const specific = types.find(type => types.every(other => this.#registry.typeChecker.isAssignable(type, other)));

        if (specific === undefined) {
            throw NexoErrors.structure('NEXO2035', `The value bound to '${name}' is recognized as ${types.map(type => type.toString(true)).join(' and ')}, of which none is beneath the others`, { binding: name });
        }

        return specific;
    }
}
