/**
 * Type — a Lexica type: a named type, a generic one with its type arguments among them, an object type, the object root, a function type, whose values are delegates, a type parameter or `Any`, each nullable or not, the type of null, and the type no value has;
 * a value alone, whose relations to another type `TypeChecker` answers
 */

const NAME = /^@?[A-Za-z][A-Za-z0-9]*$/;
const TYPE_PARAMETER = /^(?:[A-Z]|@[A-Za-z][A-Za-z0-9]*)$/;

/** The name of the type of a JavaScript primitive, by what `typeof` answers for it. */
/** The scalar types' names by the JavaScript type of their values: `LexicaModule.scalarTypeNames`, which a test keeps this map to, by `typeof`, since `Type` imports nothing of the vocabulary. */
const PRIMITIVE_TYPE_NAMES = Object.freeze({ string: 'String', number: 'Number', boolean: 'Boolean' });

export class Type {
    /** @type {Map<string, Type | null>} */
    static #parseCache = new Map();

    /** The type's kind: named, object, root, function, typeParameter, any, null or never. */
    kind;

    /** The type's name, for a named type or a type parameter: a named type's local name, unique within its module. */
    name;

    /** The name of the module that declares a named type, null for one of Lexica's own types and for a name no module qualifies yet. */
    moduleName;

    /** A generic named type's type arguments, in the order its declaration declares its parameters; empty for any other type. @type {readonly Type[]} */
    typeArguments;

    /** An object type's field types by name, or the fields of the outermost object the object root reads. */
    fieldTypes;

    /** The object expression that builds the outermost object the object root refers to, which its fields belong to; null for any other type. */
    objectExpression;

    /** The functions a delegate of the type may be, each with the scope it was declared in, which a call through the value is checked against; null for any other type. @type {readonly object[] | null} */
    functions;

    /** Whether the type admits null. */
    isNullable;

    constructor(kind, { name = null, moduleName = null, typeArguments = [], fieldTypes = null, objectExpression = null, functions = null, isNullable = false } = {}) {
        this.kind = kind;
        this.name = name;
        this.moduleName = moduleName;
        this.typeArguments = Object.freeze([...typeArguments]);
        this.fieldTypes = fieldTypes;
        this.objectExpression = objectExpression;
        this.functions = functions;
        this.isNullable = isNullable;
        Object.freeze(this);
    }

    /** The type the notation writes, or null where it is not a type: a named type qualified where its module's name and a dot precede it. */
    static parse(text) {
        if (!Type.#parseCache.has(text)) {
            Type.#parseCache.set(text, new TypeReader(text).readAll());
        }

        return Type.#parseCache.get(text);
    }

    /** A named type, one of Lexica's own types where no module declares it. */
    static createNamedType(name, isNullable = false, moduleName = null) {
        return new Type('named', { name, moduleName, isNullable });
    }

    /** A named type's identity, its module's name and its local name, or its local name alone for one of Lexica's own types; null for any other type. */
    get identity() {
        if (this.kind !== 'named') {
            return null;
        }

        return this.moduleName === null ? this.name : `${this.moduleName}.${this.name}`;
    }

    /** The type of a string, a number or a Boolean, the language's `String`, `Number` or `Boolean`. */
    static createPrimitiveType(value) {
        return Type.createNamedType(PRIMITIVE_TYPE_NAMES[typeof value]);
    }

    /** A list of the item type: Lexica's own generic `List`, its one type argument the item type. */
    static createListType(itemType, isNullable = false) {
        return new Type('named', { name: 'List', typeArguments: [itemType], isNullable });
    }

    /** Whether the type is a list, Lexica's own `List`. */
    get isList() {
        return this.kind === 'named' && this.moduleName === null && this.name === 'List';
    }

    /** The type of a list's items, its one type argument; null for any other type. */
    get itemType() {
        return this.isList ? this.typeArguments[0] : null;
    }

    /**
     * The type of the object field an object type holds under the name, which may be the type null; null where it holds none, and for a type of any other kind, the object root among them, whose completed fields its own
     * reads check.
     */
    getObjectFieldType(name) {
        return this.kind === 'object' ? (this.fieldTypes.get(name) ?? null) : null;
    }

    /** The object type of the field types, by name. */
    static createObjectType(fieldTypes, isNullable = false) {
        return new Type('object', { fieldTypes, isNullable });
    }

    /**
     * The object root, a reference to the outermost object the object expression builds, through which the fields completed where the reference is written are read: its type identifies the object expression and those fields,
     * and holds no data, so no result holds the reference.
     */
    static createObjectRootType(objectExpression, fieldTypes, isNullable = false) {
        return new Type('objectRoot', { fieldTypes, objectExpression, isNullable });
    }

    /** The function type of a delegate, which may be any of the functions, each a function the expression declares with the scope it captures: no data, so no result holds one. */
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

    /** The type of a value of any type that isn't null, `Any`, whose concrete type is known when it is evaluated. */
    static get any() {
        return Type.#any;
    }

    static #any = new Type('any');

    /** The same type, admitting null; never admitting null is null's type. */
    toNullable() {
        if (this.kind === 'never') {
            return Type.null;
        }

        return this.isNullable ? this : new Type(this.kind, { name: this.name, moduleName: this.moduleName, typeArguments: this.typeArguments, fieldTypes: this.fieldTypes, objectExpression: this.objectExpression, functions: this.functions, isNullable: true });
    }

    /** The same type, admitting no null. */
    toNonNullable() {
        return !this.isNullable || this.kind === 'null' ? this : new Type(this.kind, { name: this.name, moduleName: this.moduleName, typeArguments: this.typeArguments, fieldTypes: this.fieldTypes, objectExpression: this.objectExpression, functions: this.functions, isNullable: false });
    }

    /** Whether the two types are the same, nullability included. */
    equals(otherType) {
        if (this.kind !== otherType.kind || this.name !== otherType.name || this.moduleName !== otherType.moduleName || this.objectExpression !== otherType.objectExpression || this.isNullable !== otherType.isNullable) {
            return false;
        }

        if (this.typeArguments.length !== otherType.typeArguments.length || this.typeArguments.some((typeArgument, index) => !typeArgument.equals(otherType.typeArguments[index]))) {
            return false;
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
            case 'object':
                text = `{ ${[...this.fieldTypes].map(([name, fieldType]) => `${name}: ${fieldType.toString(isQualified)}`).join(', ')} }`;
                break;
            case 'objectRoot':
                text = this.fieldTypes.size === 0 ? 'root { }' : `root { ${[...this.fieldTypes].map(([name, fieldType]) => `${name}: ${fieldType.toString(isQualified)}`).join(', ')} }`;
                break;
            case 'function':
                text = 'function';
                break;
            case 'null':
                return 'null';
            case 'never':
                return 'Never';
            case 'any':
                text = 'Any';
                break;
            case 'named':
                text = isQualified ? this.identity : this.name;

                if (this.typeArguments.length > 0) {
                    text = `${text}<${this.typeArguments.map(typeArgument => typeArgument.toString(isQualified)).join(', ')}>`;
                }

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

        if (this.typeArguments.length > 0) {
            return new Type(this.kind, { name: this.name, moduleName: this.moduleName, typeArguments: this.typeArguments.map(typeArgument => typeArgument.resolveTypeParameters(typeArguments)), isNullable: this.isNullable });
        }

        return this;
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
