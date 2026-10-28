/**
 * ParameterBindings — the values an expression's parameters are bound to, by name, against the registry that recognizes their references
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { LexicaErrors } from './LexicaError.mjs';
import { Names } from './Names.mjs';
import { Type } from './Type.mjs';
import { TypeNameScope } from './vocabulary/TypeNameScope.mjs';

export class ParameterBindings {
    /** @type {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} */
    #registry;

    /** @type {Map<string, unknown>} */
    #values = new Map();

    /** @type {Map<string, Type>} */
    #types = new Map();

    /**
     * Binds each value to its name, asking the registry's modules which values are references before copying anything: a reference is kept as it is, by its identity, a reference nested in data among them, and the rest of the data
     * is copied and frozen. A top-level binding's declared type, a reference type the registry resolves, is its type in place of recognition, the value checked by the type's membership.
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} registry The registry the bindings belong to.
     * @param {Record<string, unknown>} parameters Each parameter's name and the value it is bound to.
     * @param {{ types?: Record<string, string> }} [options] The reference type declared for a top-level binding, by its name.
     */
    constructor(registry, parameters = {}, options = {}) {
        this.#registry = registry;

        if (!ObjectUtils.isPlainObject(parameters)) {
            throw LexicaErrors.structure('LEXICA2020', 'Bindings are a plain object of names and the values bound to them', {});
        }

        const declaredTypeNames = options?.types ?? {};

        if (!ObjectUtils.isPlainObject(options ?? {}) || !ObjectUtils.isPlainObject(declaredTypeNames)) {
            throw LexicaErrors.structure('LEXICA2020', "A binding's options are a plain object, and the types it declares a plain object of top-level bindings' names and the types declared for them", {});
        }

        for (const name of Object.keys(declaredTypeNames)) {
            if (!Object.hasOwn(parameters, name)) {
                throw LexicaErrors.structure('LEXICA2039', `A type is declared for a top-level binding alone, and no binding is named '${name}'`, { binding: name });
            }
        }

        for (const [name, value] of Object.entries(parameters)) {
            // A binding a reserved word names is read as `~` and its name, which written alone keeps its own meaning.
            if (!Names.isIdentifier(name)) {
                throw LexicaErrors.structure('LEXICA2033', 'A binding is named by a letter followed by letters and digits', { binding: name });
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

    /** A top-level binding of a declared type: a reference type the registry resolves by the name, qualified or not, which a reference the binding holds belongs to; no `typeOf` is asked of it. */
    #bindDeclared(name, value, typeName) {
        const types = typeof typeName === 'string' ? this.#registry.resolveTypeName(typeName, TypeNameScope.bindingScope).types : [];

        if (types.length === 0) {
            throw LexicaErrors.structure('LEXICA2036', `The type declared for '${name}', ${String(typeName)}, is no public type`, { binding: name });
        }

        if (types.length > 1) {
            throw LexicaErrors.structure('LEXICA2037', `The type declared for '${name}', ${typeName}, is several types' name, so it is named qualified: ${types.map(type => type.toString(true)).join(' or ')}`, { binding: name });
        }

        const [type] = types;

        if (!this.#registry.isReferenceType(type)) {
            throw LexicaErrors.structure('LEXICA2023', `The type declared for '${name}', ${typeName}, is no reference type, and data is typed by its value alone`, { binding: name });
        }

        if (value === null || typeof value !== 'object') {
            throw LexicaErrors.structure('LEXICA2038', `A type is declared for a reference, and '${name}' is bound to data`, { binding: name });
        }

        if (!this.#registry.belongsTo(value, type, `the binding '${name}'`)) {
            throw LexicaErrors.structure('LEXICA2036', `The value bound to '${name}' doesn't belong to its declared type, ${type}`, { binding: name });
        }

        return { type, value };
    }

    /**
     * The type and the bound form of a value, at any depth of a binding: a reference the registry's modules recognize, the one type beneath every other where several do, kept as it is; null, a string, a finite number and a Boolean as
     * they are; a list typed by the type its items share and an object by its fields' types, each copied and frozen. It types and copies in one walk, offering each object it reaches to the registry's modules before
     * copying it, so every module's `typeOf` is asked of it and a reference nested in data is kept as it is. A value no module recognizes that is no data (LEXICA2034), a list of items of no shared type (LEXICA2021), and data
     * that reaches itself (LEXICA2022) are refused.
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
                throw LexicaErrors.structure('LEXICA2022', 'A binding holds a cycle, a list or an object that reaches itself, which data never does', { binding: name });
            }

            if (Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1) {
                return this.#bindList(name, value, ancestors);
            }

            if (ObjectUtils.isPlainObject(value)) {
                return this.#bindObject(name, value, ancestors);
            }
        }

        throw LexicaErrors.structure('LEXICA2034', 'A binding is a reference a registered module recognizes, or data: a number, a string, a Boolean, null, a list holding a value at every index, or an object', { binding: name });
    }

    /** A list, typed by the type its items share, the nearest supertype references of different types share, made nullable where one of them is null, and the empty list's being never; copied and frozen. Its type merges as each item is bound, so binding stops at the first item whose type shares none with those before it. */
    #bindList(name, list, ancestors) {
        ancestors.add(list);

        let itemType = Type.never;
        const items = [];

        for (const item of list) {
            const bound = this.#bind(name, item, ancestors);

            itemType = this.#registry.typeChecker.merge(itemType, bound.type);

            if (itemType === null) {
                throw LexicaErrors.structure('LEXICA2021', 'A list whose items have different types has no type, since Lexica has no union types and a list holds items of one type', { binding: name });
            }

            items.push(bound.value);
        }

        ancestors.delete(list);

        return { type: Type.createListType(itemType), value: Object.freeze(items) };
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
            throw LexicaErrors.structure('LEXICA2035', `The value bound to '${name}' is recognized as ${types.map(type => type.toString(true)).join(' and ')}, of which none is beneath the others`, { binding: name });
        }

        return specific;
    }
}
