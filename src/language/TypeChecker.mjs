/**
 * TypeChecker — every relation between two types: assignability, merging, the types an equality compares, and the receivers a member applies to, read from what declares the types
 */

import { Type } from './Type.mjs';

/** The scalar types, whose values an equality compares with each other. */
const SCALAR_TYPE_NAMES = Object.freeze(['String', 'Number', 'Boolean']);

/**
 * The answers to whether a value of one type is assignable to another: assignable, assignable once its value is checked when it is evaluated, as a value of `Any` is, or refused.
 * @typedef {'assignable' | 'checked' | 'refused'} Assignability
 */

export class TypeChecker {
    /**
     * What declares the types the checker relates, a registry: a generic type's parameters and their variance, a reference type's supertype, whether a type is a reference type, and a member's receiver types.
     * @type {{ getGenericType(type: Type): { parameters: readonly { variance: 'covariant' | 'invariant' }[] } | undefined, getSupertype(type: Type): Type | null, isReferenceType(type: Type): boolean, getTargetTypes(declaration: object): (Type | 'any')[] }}
     */
    #declarations;

    /** @param {object} declarations What declares the types the checker relates, a registry. */
    constructor(declarations) {
        this.#declarations = declarations;
    }

    /**
     * Whether a value of the type is assignable to the declared type: `assignable`, `refused`, or `checked`, assignable once its value is checked against the declared
     * type when it is evaluated, which a value of `Any` asks for, the check refusing null where the declared type isn't nullable.
     * @param {Type} type
     * @param {Type} declaredType
     * @returns {Assignability}
     */
    assignabilityOf(type, declaredType) {
        if (type.kind === 'never') {
            return 'assignable';
        }

        if (type.kind === 'null') {
            return declaredType.isNullable ? 'assignable' : 'refused';
        }

        // A value of `Any` waits for its value, whatever is declared but `Any` itself, whose nullability the value's must fit; no value is a never, and only a nullable one is null.
        if (type.kind === 'any') {
            if (declaredType.kind === 'never' || (declaredType.kind === 'null' && !type.isNullable)) {
                return 'refused';
            }

            return declaredType.kind === 'any' && (declaredType.isNullable || !type.isNullable) ? 'assignable' : 'checked';
        }

        if (type.isNullable && !declaredType.isNullable) {
            return 'refused';
        }

        if (declaredType.kind === 'any') {
            return 'assignable';
        }

        if (type.kind !== declaredType.kind) {
            return 'refused';
        }

        switch (type.kind) {
            case 'named':
                return this.#fitsByName(declaredType, type) ? this.#typeArgumentsAssignability(type, declaredType) : 'refused';
            case 'object':
                return TypeChecker.#holdsFieldsOf(type, declaredType) ? TypeChecker.#combine([...type.fieldTypes].map(([name, fieldType]) => this.assignabilityOf(fieldType, declaredType.fieldTypes.get(name)))) : 'refused';
            // An object root stands where one of its object expression reads the fields it does, and a function value where one that may be any of its functions does.
            case 'root':
                return type.toNonNullable().equals(declaredType.toNonNullable()) ? 'assignable' : 'refused';
            case 'function':
                return type.functions.every(candidate => declaredType.functions.includes(candidate)) ? 'assignable' : 'refused';
            default:
                return type.name === declaredType.name ? 'assignable' : 'refused';
        }
    }

    /** Whether a value of the type is proven assignable to the declared type; one that waits for a check is not, so a caller that records no check refuses it. */
    isAssignable(type, declaredType) {
        return this.assignabilityOf(type, declaredType) === 'assignable';
    }

    /**
     * The least type holding a value of either type, nullable where either can be null; null where the two don't merge.
     * @param {Type} firstType
     * @param {Type} secondType
     * @returns {Type | null}
     */
    merge(firstType, secondType) {
        if (firstType.kind === 'never') {
            return secondType;
        }

        if (secondType.kind === 'never') {
            return firstType;
        }

        if (firstType.kind === 'null') {
            return secondType.toNullable();
        }

        if (secondType.kind === 'null') {
            return firstType.toNullable();
        }

        const isNullable = firstType.isNullable || secondType.isNullable;

        // `Any` holds a value of any type.
        if (firstType.kind === 'any' || secondType.kind === 'any') {
            return isNullable ? Type.any.toNullable() : Type.any;
        }

        // Object roots merge where they identify one object expression and read the same fields, and with nothing else.
        if (firstType.kind === 'root' || secondType.kind === 'root') {
            return firstType.toNonNullable().equals(secondType.toNonNullable()) ? (isNullable ? firstType.toNullable() : firstType.toNonNullable()) : null;
        }

        // Function values merge into one that may be any of their functions, and with nothing else.
        if (firstType.kind === 'function' || secondType.kind === 'function') {
            return firstType.kind === secondType.kind ? Type.createFunctionType([...firstType.functions, ...secondType.functions], isNullable) : null;
        }

        // Two reference types of one hierarchy merge to the nearest supertype they share, and of two hierarchies to none.
        if (firstType.kind === 'named' && secondType.kind === 'named' && firstType.identity !== secondType.identity && this.#declarations.isReferenceType(firstType) && this.#declarations.isReferenceType(secondType)) {
            const shared = this.#lineageOf(firstType).find(ancestor => this.#lineageOf(secondType).some(other => other.identity === ancestor.identity));

            return shared === undefined ? null : isNullable ? shared.toNullable() : shared.toNonNullable();
        }

        if (firstType.kind !== secondType.kind || firstType.name !== secondType.name || firstType.module !== secondType.module) {
            return null;
        }

        if (firstType.kind === 'object') {
            if (!TypeChecker.#holdsFieldsOf(firstType, secondType)) {
                return null;
            }

            const fieldTypes = new Map();

            for (const [name, fieldType] of firstType.fieldTypes) {
                const merged = this.merge(fieldType, secondType.fieldTypes.get(name));

                if (merged === null) {
                    return null;
                }

                fieldTypes.set(name, merged);
            }

            return Type.createObjectType(fieldTypes, isNullable);
        }

        if (firstType.typeArguments.length > 0) {
            const typeArguments = this.#mergeTypeArguments(firstType, secondType);

            return typeArguments === null ? null : new Type(firstType.kind, { name: firstType.name, module: firstType.module, typeArguments, isNullable });
        }

        return isNullable ? firstType.toNullable() : firstType.toNonNullable();
    }

    /** Whether two values an equality compares are of types that fit one way or the other, each proven assignable to the other's. */
    fitsEitherWay(firstType, secondType) {
        return this.isAssignable(firstType, secondType) || this.isAssignable(secondType, firstType);
    }

    /** Whether values of the type are compared with each other by an equality, rather than with null alone: strings, numbers and Booleans by their values, and references by their identity. */
    isComparable(type) {
        return type.kind === 'named' && ((type.module === null && SCALAR_TYPE_NAMES.includes(type.name)) || this.#declarations.isReferenceType(type));
    }

    /** Whether the member applies to the receiver, by one of its receiver types, as inferring its receiver's type arguments succeeds; it records nothing. */
    matchesReceiver(declaration, receiverType) {
        return this.inferReceiverTypeArguments(declaration, receiverType) !== null;
    }

    /**
     * The arguments of the type parameters the member's receiver type binds for the receiver, by the first of its receiver types the receiver applies to: an empty map where that one binds none, or null where the member applies
     * to the receiver by none. Each receiver type is matched apart, so one that does not apply binds nothing for the next.
     * @returns {Map<string, Type> | null}
     */
    inferReceiverTypeArguments(declaration, receiverType) {
        const base = receiverType.toNonNullable();
        const isValue = base.kind === 'named' || base.kind === 'object';

        for (const type of this.#declarations.getTargetTypes(declaration)) {
            if (type === 'any') {
                if (isValue) {
                    return new Map();
                }

                continue;
            }

            // A target that is a type parameter alone takes a receiver of any type a value has, and binds the parameter to it.
            if (type.kind !== 'typeParameter' || isValue) {
                const typeArguments = this.inferTypeArguments(type, base);

                if (typeArguments !== null) {
                    return typeArguments;
                }
            }
        }

        return null;
    }

    /**
     * The applicable declaration of those given whose receiver type is more specific than every other applicable declaration's, alone, as `Light` is than `Device` and `List<Light>` than `List<Device>`, a receiver of any type
     * the least specific: a type's member hides one of its name its supertype declares. Where no declaration is, it answers the competing ones, each applicable and none less specific than another, which make the access ambiguous;
     * none where none applies.
     */
    mostSpecificOf(declarations, receiverType) {
        const applying = declarations.map(declaration => ({ declaration, type: this.#applyingTypeOf(declaration, receiverType) })).filter(({ type }) => type !== undefined);
        const selected = applying.find(candidate => applying.every(other => other === candidate || this.#isMoreSpecific(candidate.type, other.type)));

        if (selected !== undefined) {
            return [selected.declaration];
        }

        return applying.filter(({ type }) => !applying.some(other => this.#isMoreSpecific(other.type, type))).map(({ declaration }) => declaration);
    }

    /** The receiver type of the declaration the receiver applies to it by, `any` for a receiver of any type, or undefined where it applies by none. */
    #applyingTypeOf(declaration, receiverType) {
        const base = receiverType.toNonNullable();
        const isValue = base.kind === 'named' || base.kind === 'object';

        return this.#declarations.getTargetTypes(declaration).find(type => (type === 'any' ? isValue : (type.kind !== 'typeParameter' || isValue) && this.matchesType(type, base)));
    }

    /** Whether the one receiver type is more specific than the other: assignable to it by the type relationships, the other matching it and not it the other; a receiver of any type, written `any`, is the least specific. */
    #isMoreSpecific(one, other) {
        if (one === 'any') {
            return false;
        }

        if (other === 'any') {
            return true;
        }

        return this.matchesType(other, one) && !this.matchesType(one, other);
    }

    /** Whether the actual type matches the declared one, structure for structure, as inferring the declared type's parameters from it succeeds; it records nothing. */
    matchesType(declaredType, actualType) {
        return this.inferTypeArguments(declaredType, actualType) !== null;
    }

    /**
     * The arguments of the type parameters the declared type writes, inferred from the actual type, structure for structure, beside those bound already: an empty map where it writes none, or null where the actual type does not
     * match. A type parameter matches any type the first time it is met, and binds to it; met again, or bound already, it matches the type it binds to, nullability aside.
     * @param {Type} declaredType
     * @param {Type} actualType
     * @param {ReadonlyMap<string, Type>} [bound] The arguments bound already, by parameter name, which it never changes.
     * @returns {Map<string, Type> | null}
     */
    inferTypeArguments(declaredType, actualType, bound = new Map()) {
        const typeArguments = new Map(bound);

        return this.#inferInto(declaredType, actualType, typeArguments) ? typeArguments : null;
    }

    /** Matches the actual type against the declared one, adding each argument it binds to the map: the one relation matching and inferring share. */
    #inferInto(declaredType, actualType, typeArguments) {
        if (declaredType.kind === 'typeParameter') {
            const typeArgument = typeArguments.get(declaredType.name);

            if (typeArgument === undefined) {
                typeArguments.set(declaredType.name, actualType);

                return true;
            }

            return typeArgument.toNonNullable().equals(actualType.toNonNullable());
        }

        // No value is a never, so a never matches whatever is declared.
        if (actualType.kind === 'never') {
            return true;
        }

        if (declaredType.kind !== actualType.kind || !this.#fitsByName(declaredType, actualType)) {
            return false;
        }

        return declaredType.typeArguments.length === actualType.typeArguments.length && declaredType.typeArguments.every((typeArgument, index) => this.#inferInto(typeArgument, actualType.typeArguments[index], typeArguments));
    }

    /** Whether a value of the actual type is a value of the declared type by its name: the same named type, by its identity, or a reference type beneath the declared one. */
    #fitsByName(declaredType, actualType) {
        if (declaredType.name === actualType.name && declaredType.module === actualType.module) {
            return true;
        }

        return declaredType.kind === 'named' && actualType.kind === 'named' && this.#lineageOf(actualType).some(ancestor => ancestor.identity === declaredType.identity);
    }

    /** The reference type and each supertype above it, nearest first, each without null; the type alone for any other type. */
    #lineageOf(type) {
        const lineage = [];

        for (let current = type.toNonNullable(); current !== null; current = this.#declarations.getSupertype(current)) {
            lineage.push(current.toNonNullable());
        }

        return lineage;
    }

    /** Whether two types of one generic declaration, or of none, relate argument by argument: a covariant one by assignability, an invariant one by equality. */
    #typeArgumentsAssignability(type, declaredType) {
        if (type.typeArguments.length === 0) {
            return 'assignable';
        }

        const { parameters } = this.#declarations.getGenericType(declaredType);

        return TypeChecker.#combine(type.typeArguments.map((typeArgument, index) => {
            const declaredArgument = declaredType.typeArguments[index];

            if (parameters[index].variance === 'covariant') {
                return this.assignabilityOf(typeArgument, declaredArgument);
            }

            return typeArgument.equals(declaredArgument) ? 'assignable' : 'refused';
        }));
    }

    /** The type arguments two types of one generic declaration merge to, each a covariant one's merge and an invariant one's where they are equal; null where one doesn't merge. */
    #mergeTypeArguments(firstType, secondType) {
        const { parameters } = this.#declarations.getGenericType(firstType);
        const typeArguments = [];

        for (const [index, typeArgument] of firstType.typeArguments.entries()) {
            const other = secondType.typeArguments[index];
            const merged = parameters[index].variance === 'covariant' ? this.merge(typeArgument, other) : typeArgument.equals(other) ? typeArgument : null;

            if (merged === null) {
                return null;
            }

            typeArguments.push(merged);
        }

        return typeArguments;
    }

    /** Whether two object types hold the same field names, none more and none fewer. */
    static #holdsFieldsOf(type, otherType) {
        return type.fieldTypes.size === otherType.fieldTypes.size && [...type.fieldTypes.keys()].every(name => otherType.fieldTypes.has(name));
    }

    /** The assignability of a type whose parts answer these: refused where one is, checked where one waits for evaluation, and assignable where every one is. */
    static #combine(answers) {
        return answers.includes('refused') ? 'refused' : answers.includes('checked') ? 'checked' : 'assignable';
    }
}
