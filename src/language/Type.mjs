/**
 * Type — a Lexica type: a named type, a list, an object type, the object root, a function value or a type parameter, each nullable or not, the type of null, and the type no value has
 */

const NAME = /^@?[A-Za-z][A-Za-z0-9]*$/;
const TYPE_PARAMETER = /^(?:[A-Z]|@[A-Za-z][A-Za-z0-9]*)$/;

/** The name of the type of a JavaScript primitive, by what `typeof` answers for it. */
const PRIMITIVE_TYPE_NAMES = Object.freeze({ string: 'String', number: 'Number', boolean: 'Boolean' });

export class Type {
    /** @type {Map<string, Type | null>} */
    static #parsed = new Map();

    /** The type's kind: named, list, object, root, function, typeParameter, null or never. */
    kind;

    /** The type's name, for a named type or a type parameter: a named type's local name, unique within its module. */
    name;

    /** The name of the module that declares a named type, null for one of Lexica's own types and for a name no module qualifies yet. */
    module;

    /** The type of a list's items. */
    itemType;

    /** An object type's field types by name, or the fields of the outermost object the object root reads. */
    fieldTypes;

    /** The object expression that builds the outermost object the object root refers to, which its fields belong to; null for any other type. */
    objectExpression;

    /** The functions a function value may be, each with the scope it was declared in, which a call through the value is checked against; null for any other type. @type {readonly object[] | null} */
    functions;

    /** Whether the type admits null. */
    isNullable;

    constructor(kind, { name = null, module = null, itemType = null, fieldTypes = null, objectExpression = null, functions = null, isNullable = false } = {}) {
        this.kind = kind;
        this.name = name;
        this.module = module;
        this.itemType = itemType;
        this.fieldTypes = fieldTypes;
        this.objectExpression = objectExpression;
        this.functions = functions;
        this.isNullable = isNullable;
        Object.freeze(this);
    }

    /** The type the notation writes, or null where it is not a type: a named type qualified where its module's name and a dot precede it. */
    static parse(text) {
        if (!Type.#parsed.has(text)) {
            Type.#parsed.set(text, new TypeReader(text).readAll());
        }

        return Type.#parsed.get(text);
    }

    /** A named type, one of Lexica's own types where no module declares it. */
    static createNamedType(name, isNullable = false, module = null) {
        return new Type('named', { name, module, isNullable });
    }

    /** A named type's identity, its module's name and its local name, or its local name alone for one of Lexica's own types; null for any other type. */
    get identity() {
        if (this.kind !== 'named') {
            return null;
        }

        return this.module === null ? this.name : `${this.module}.${this.name}`;
    }

    /** The type of a string, a number or a Boolean, the language's `String`, `Number` or `Boolean`. */
    static createPrimitiveType(value) {
        return Type.createNamedType(PRIMITIVE_TYPE_NAMES[typeof value]);
    }

    /** A list of the item type. */
    static createListType(itemType, isNullable = false) {
        return new Type('list', { itemType, isNullable });
    }

    /** The object type of the field types, by name. */
    static createObjectType(fieldTypes, isNullable = false) {
        return new Type('object', { fieldTypes, isNullable });
    }

    /**
     * The object root, a reference to the outermost object the object expression builds, through which the fields completed where the reference is written are read: its type identifies the object expression and those fields,
     * and holds no data, so no result holds the reference.
     */
    static createRootType(objectExpression, fieldTypes, isNullable = false) {
        return new Type('root', { fieldTypes, objectExpression, isNullable });
    }

    /** A function value, which may be any of the functions, each a function the expression declares with the scope it captures: no data, so no result holds one. */
    static createFunctionType(functions, isNullable = false) {
        return new Type('function', { functions: Object.freeze([...new Set(functions)]), isNullable });
    }

    /** A type parameter a declaration's types write, whose argument matching infers. */
    static createTypeParameter(name, isNullable = false) {
        return new Type('typeParameter', { name, isNullable });
    }

    /** The type of null alone, which fits every nullable type. */
    static get null() {
        return Type.#null;
    }

    static #null = new Type('null', { isNullable: true });

    /** The type no value has, which fits every type: the item type of the empty list. */
    static get never() {
        return Type.#never;
    }

    static #never = new Type('never');

    /** The same type, admitting null; never admitting null is null's type. */
    toNullable() {
        if (this.kind === 'never') {
            return Type.null;
        }

        return this.isNullable ? this : new Type(this.kind, { name: this.name, module: this.module, itemType: this.itemType, fieldTypes: this.fieldTypes, objectExpression: this.objectExpression, functions: this.functions, isNullable: true });
    }

    /** The same type, admitting no null. */
    toNonNullable() {
        return !this.isNullable || this.kind === 'null' ? this : new Type(this.kind, { name: this.name, module: this.module, itemType: this.itemType, fieldTypes: this.fieldTypes, objectExpression: this.objectExpression, functions: this.functions, isNullable: false });
    }

    /** Whether the two types are the same, nullability included. */
    equals(otherType) {
        if (this.kind !== otherType.kind || this.name !== otherType.name || this.module !== otherType.module || this.objectExpression !== otherType.objectExpression || this.isNullable !== otherType.isNullable) {
            return false;
        }

        if (this.itemType !== null) {
            return this.itemType.equals(otherType.itemType);
        }

        if (this.fieldTypes !== null) {
            return this.fieldTypes.size === otherType.fieldTypes.size && [...this.fieldTypes].every(([name, fieldType]) => otherType.fieldTypes.get(name)?.equals(fieldType) === true);
        }

        if (this.functions !== null) {
            return this.functions.length === otherType.functions.length && this.functions.every(candidate => otherType.functions.includes(candidate));
        }

        return true;
    }

    /** The notation of the type, each named type in it by its local name, or by its identity where it is written qualified. */
    toString(isQualified = false) {
        let text;

        switch (this.kind) {
            case 'list':
                text = `List<${this.itemType.toString(isQualified)}>`;
                break;
            case 'object':
                text = `{ ${[...this.fieldTypes].map(([name, fieldType]) => `${name}: ${fieldType}`).join(', ')} }`;
                break;
            case 'root':
                text = this.fieldTypes.size === 0 ? 'root { }' : `root { ${[...this.fieldTypes].map(([name, fieldType]) => `${name}: ${fieldType}`).join(', ')} }`;
                break;
            case 'function':
                text = 'function';
                break;
            case 'null':
                return 'null';
            case 'never':
                return 'Never';
            case 'named':
                text = isQualified ? this.identity : this.name;
                break;
            default:
                text = this.name;
        }

        return this.isNullable ? `${text}?` : text;
    }

    /** How a message writes two types it names together: each by its local names, and both qualified where they read alike and are different types, as `home.Sensor` and `garden.Sensor`. */
    static namesOf(firstType, secondType) {
        const isAlike = String(firstType) === String(secondType) && !firstType.equals(secondType);

        return [firstType.toString(isAlike), secondType.toString(isAlike)];
    }

    /** The kinds of node, each of which fits where a node is declared. */
    static nodeKinds = Object.freeze(['Element', 'Document', 'DocumentFragment', 'ShadowRoot']);

    /** Whether the type is a node or one of its kinds, Lexica's own. */
    get isNode() {
        return this.kind === 'named' && this.module === null && (this.name === 'Node' || Type.nodeKinds.includes(this.name));
    }

    /** Whether a value of the actual type is a value of the declared type by kind: the same named type, by its identity, or a kind of node where a node is declared. */
    static #fitsByName(declaredType, actualType) {
        return (declaredType.name === actualType.name && declaredType.module === actualType.module) || (declaredType.name === 'Node' && declaredType.module === null && actualType.isNode);
    }

    /**
     * Whether the actual type matches the declared one, structure for structure: a type parameter the declared type writes matches any type, the first time it is met, and records that type as its argument; a parameter met again matches the type it recorded, nullability aside.
     * @param {Type} declaredType
     * @param {Type} actualType
     * @param {Map<string, Type>} typeArguments The arguments inferred so far, by parameter name, which matching adds to.
     */
    static tryMatchType(declaredType, actualType, typeArguments) {
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

        if (declaredType.kind !== actualType.kind || !Type.#fitsByName(declaredType, actualType)) {
            return false;
        }

        return declaredType.itemType === null || Type.tryMatchType(declaredType.itemType, actualType.itemType, typeArguments);
    }

    /**
     * The type with each type parameter that has an argument replaced by it, nullable where the parameter is; a concrete type, and a parameter with no argument, stay as they are.
     * @param {Map<string, Type>} typeArguments The arguments, by parameter name.
     */
    resolveTypeParameters(typeArguments) {
        if (this.kind === 'typeParameter') {
            const typeArgument = typeArguments.get(this.name);

            if (typeArgument === undefined) {
                return this;
            }

            return this.isNullable ? typeArgument.toNullable() : typeArgument;
        }

        if (this.itemType !== null) {
            return new Type(this.kind, { itemType: this.itemType.resolveTypeParameters(typeArguments), isNullable: this.isNullable });
        }

        return this;
    }

    /**
     * The least type holding a value of either type: their one structure, nullable wherever either is, null being of every nullable type; null where their structures differ.
     * @param {Type} firstType
     * @param {Type} secondType
     */
    static merge(firstType, secondType) {
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

        // Object roots merge where they identify one object expression and read the same fields, and with nothing else.
        if (firstType.kind === 'root' || secondType.kind === 'root') {
            return firstType.toNonNullable().equals(secondType.toNonNullable()) ? (isNullable ? firstType.toNullable() : firstType.toNonNullable()) : null;
        }

        // Function values merge into one that may be any of their functions, and with nothing else.
        if (firstType.kind === 'function' || secondType.kind === 'function') {
            return firstType.kind === secondType.kind ? Type.createFunctionType([...firstType.functions, ...secondType.functions], isNullable) : null;
        }

        // Two kinds of node are both nodes, the least type holding either.
        if (firstType.isNode && secondType.isNode && firstType.name !== secondType.name) {
            return Type.createNamedType('Node', isNullable);
        }

        if (firstType.kind !== secondType.kind || firstType.name !== secondType.name || firstType.module !== secondType.module) {
            return null;
        }

        if (firstType.itemType !== null) {
            const itemType = Type.merge(firstType.itemType, secondType.itemType);

            return itemType === null ? null : new Type(firstType.kind, { itemType, isNullable });
        }

        if (firstType.fieldTypes !== null) {
            if (firstType.fieldTypes.size !== secondType.fieldTypes.size) {
                return null;
            }

            const fieldTypes = new Map();

            for (const [name, fieldType] of firstType.fieldTypes) {
                const otherFieldType = secondType.fieldTypes.get(name);
                const merged = otherFieldType === undefined ? null : Type.merge(fieldType, otherFieldType);

                if (merged === null) {
                    return null;
                }

                fieldTypes.set(name, merged);
            }

            return Type.createObjectType(fieldTypes, isNullable);
        }

        return isNullable ? firstType.toNullable() : firstType;
    }

    /** Whether a value of this type may stand where the other type is declared, a list by its items. */
    isAssignableTo(otherType) {
        if (this.kind === 'never') {
            return true;
        }

        if (this.kind === 'null') {
            return otherType.isNullable;
        }

        if (this.isNullable && !otherType.isNullable) {
            return false;
        }

        if (this.kind !== otherType.kind || !Type.#fitsByName(otherType, this)) {
            return false;
        }

        // An object root stands where one of its object expression reads the fields it does, and a function value where one that may be any of its functions does.
        if (this.kind === 'root') {
            return this.toNonNullable().equals(otherType.toNonNullable());
        }

        if (this.kind === 'function') {
            return this.functions.every(candidate => otherType.functions.includes(candidate));
        }

        return this.itemType === null || this.itemType.isAssignableTo(otherType.itemType);
    }
}

class TypeReader {
    #text;
    #offset = 0;

    constructor(text) {
        this.#text = typeof text === 'string' ? text : '';
    }

    readAll() {
        const type = this.#readType();

        return type !== null && this.#offset === this.#text.length ? type : null;
    }

    #readType() {
        const word = /@?[A-Za-z][A-Za-z0-9]*/y;
        word.lastIndex = this.#offset;
        const match = word.exec(this.#text);

        if (match === null || !NAME.test(match[0])) {
            return null;
        }

        this.#offset = word.lastIndex;

        // A name its module's name and a dot qualify is a type that module declares.
        if (this.#text[this.#offset] === '.' && !match[0].startsWith('@')) {
            word.lastIndex = this.#offset + 1;
            const local = word.exec(this.#text);

            if (local === null || local[0].startsWith('@')) {
                return null;
            }

            this.#offset = word.lastIndex;

            return this.#readNullable(Type.createNamedType(local[0], false, match[0]));
        }

        let type;

        if (this.#text[this.#offset] === '<') {
            if (match[0] !== 'List') {
                return null;
            }

            this.#offset++;
            const itemType = this.#readType();

            if (itemType === null || this.#text[this.#offset] !== '>') {
                return null;
            }

            this.#offset++;
            type = Type.createListType(itemType);
        } else if (match[0] === 'null') {
            type = Type.null;
        } else if (match[0] === 'Never') {
            type = Type.never;
        } else if (TYPE_PARAMETER.test(match[0])) {
            type = Type.createTypeParameter(match[0]);
        } else if (match[0] === 'List') {
            return null;
        } else {
            type = Type.createNamedType(match[0]);
        }

        return this.#readNullable(type);
    }

    /** The type, made nullable where `?` follows it. */
    #readNullable(type) {
        if (this.#text[this.#offset] === '?') {
            this.#offset++;

            return type.toNullable();
        }

        return type;
    }
}
