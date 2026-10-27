/**
 * LexicaModule — a vocabulary's declarations as data, each that runs code carrying its implementation
 */

import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaErrors } from '../LexicaError.mjs';
import { Names } from '../Names.mjs';
import { Type } from '../Type.mjs';

/** The kinds of member a module declares: a property, read by its name; a function, called; and an indexer, given its key in brackets, after its name or, an unnamed one, after its receiver. */
const MEMBER_KINDS = ['property', 'function', 'indexer'];

/** Who invokes a function: the evaluator, as it evaluates the script, or the host, which the script's host call is prepared for. */
const INVOKERS = ['evaluator', 'host'];

/** The form a member's arguments take: one for each parameter in order, or one object whose fields supply them. */
const ARGUMENT_FORMS = ['positional', 'options'];

/** How a member changes, as the specification's categories name it, `derived` for a contract that comes from the items and expression a member selects or evaluates. */
const CHANGE_CATEGORIES = ['constant', 'observable', 'partly-observable', 'unobserved', 'derived'];

/** How a member reads, as the specification's modes name it, `derived` for a contract that comes from the items and expression a member selects or evaluates. */
const READING_MODES = ['fresh', 'maintained', 'captured', 'derived'];
const NULL_POLICIES = ['propagate', 'accept'];
const SELECTION_KINDS = ['type'];
const PARAMETER_KINDS = ['value', 'expression', 'predicate', 'function'];

/** What an observation type provides: a signal that an answer may have changed, or a sampled value a member reads. */
const OBSERVATION_CONTRACTS = ['invalidation', 'maintained'];

/** The categories whose changes observations cover. */
const OBSERVED_CHANGE_CATEGORIES = ['observable', 'partly-observable'];

/** The scalar types Lexica defines, each a value of data alone: what conversions convert between, what data and equality read as scalars, and what a default of one is. */
const SCALAR_TYPE_NAMES = Object.freeze(['Number', 'String', 'Boolean']);

/** The names of the scalar types whose values hold no number, so a tolerance means nothing for them. */
const UNTOLERATED_TYPE_NAMES = new Set(SCALAR_TYPE_NAMES.filter(name => name !== 'Number'));

/** The kinds of type a module declares: a reference type, whose values have identity; a structured type, of data; and an extension, the members it adds to a type another module owns, which is never a value's type. */
const TYPE_KINDS = ['reference', 'structured', 'extension'];

/** A declaration's name as it declares its type parameters: a local name, and, in angle brackets after it, the parameters, separated by commas. */
const DECLARED_NAME = /^([^<>]*)(?:<(.*)>)?$/;

/** What a module can declare. */
const MODULE_KEYS = ['typeOf', 'types', 'members', 'typeSelectors', 'mappings', 'observationTypes', 'observationTargets', 'conversions'];

/** The fields each member kind takes, beside those every member takes, so a field one does not take is refused rather than ignored. */
const MEMBER_KEYS = ['name', 'kind', 'target', 'result', 'impl', 'internal'];
const MEMBER_KEYS_BY_KIND = {
    property: ['updates'],
    function: ['invokedBy', 'arguments', 'parameters', 'updates'],
    // An indexer's arguments are its one key, positional, so it takes no argument form; who invokes it is read to refuse the host.
    indexer: ['invokedBy', 'parameters', 'updates'],
};

/** How a location names an unnamed indexer, which declares no name: as a script writes its access after the receiver. */
const UNNAMED_INDEXER_NAME = '[]';
const UPDATES_KEYS = ['changes', 'reads', 'misses', 'tolerance', 'observations'];
const PARAMETER_KEYS = ['name', 'kind', 'type', 'required', 'default', 'fixed', 'selects', 'selector', 'nulls', 'context', 'omitted', 'parameterTypes'];
/** The keys each kind of type takes, so a key its kind does not take, a structured type's `fields` among them, is refused rather than ignored. */
const TYPE_KEYS_BY_KIND = {
    reference: ['name', 'kind', 'isInstance', 'supertype', 'abstract', 'import', 'members', 'internal'],
    structured: ['name', 'kind', 'import', 'members', 'internal'],
    // An extension's types are its module's and Lexica's, and foreign ones written qualified, so it imports none.
    extension: ['name', 'kind', 'target', 'members', 'internal'],
};

/** The keys a property of a structured type's data shape takes: its name, its kind and the type of its value, which Lexica reads from the data, so it takes no `impl`. */
const DATA_PROPERTY_KEYS = ['name', 'kind', 'result', 'internal'];
const TYPE_SELECTOR_KEYS = ['name'];
const MAPPING_KEYS = ['selector', 'key', 'type'];
const OBSERVATION_TYPE_KEYS = ['name', 'contract', 'identity', 'shared', 'impl'];
const OBSERVATION_TARGET_KEYS = ['name', 'from', 'count'];
const CONVERSION_KEYS = ['from', 'to', 'impl'];

export class LexicaModule {
    #name;
    #typeOf;
    #types;
    #members;
    #typeSelectors;
    #mappings;
    #observationTypes;
    #observationTargets;
    #conversions;

    /**
     * @param {string} name The module's name.
     * @param {object} contents What the module declares, each declaration that runs code carrying its implementation.
     * @param {object[]} [contents.types] The types it declares, reference and structured, each with its own members, which take it as their receiver; a structured type's data shape is the properties it declares directly without updates.
     * @param {object[]} [contents.members] The properties and functions it adds, a function its host invokes among them, a member without a target a module member.
     * @param {object[]} [contents.typeSelectors] The type selectors it declares, each by its name alone, through which a function's fixed argument selects the type of its result.
     * @param {object[]} [contents.mappings] The keys it maps for type selectors, its own or another module's, each with the selector it belongs to, the key, any string, and the type it maps to.
     * @param {object[]} [contents.observationTypes] The types of observation it declares.
     * @param {object[]} [contents.observationTargets] The targets its observation types observe besides a receiver and an argument, each found from the receiver or independent of it, one target or several.
     * @param {object[]} [contents.conversions] The conversions it declares, each from a type of data to another.
     */
    constructor(name, contents = {}) {
        if (!Names.isIdentifier(name)) {
            throw LexicaErrors.module('LEXICA4500', 'A module is named as a name is', { module: String(name) });
        }

        // A declaration nested in a type is located at the type it stands in, as well as at its module.
        const failWithin = typeName => (code, message, declarationName, declarationKey) => {
            throw LexicaErrors.module(code, message, {
                module: name,
                ...(typeName === undefined ? {} : { type: typeName }),
                ...(declarationName === undefined ? {} : { declaration: declarationName }),
                ...(declarationKey === undefined ? {} : { declarationKey }),
            });
        };
        const fail = failWithin(undefined);

        // A module's contents take their keys as a declaration does, refused by codes of their own.
        LexicaModule.#validateKeys(contents, MODULE_KEYS, "A module's contents", fail, null, {
            notObjectCode: 'LEXICA4501',
            unknownKeyCode: 'LEXICA4502',
            declaringSubject: 'A module',
            hintOf: key => (key === 'predicates' ? '; a test of a receiver is one of its members, a function whose result is a boolean' : ''),
        });

        const { typeOf, types = [], members = [], typeSelectors = [], mappings = [], observationTypes = [], observationTargets = [], conversions = [] } = contents;

        if (typeOf !== undefined && typeof typeOf !== 'function') {
            fail('LEXICA4051', "A module's typeOf is a function, which names the type of a value it recognizes", undefined, 'typeOf');
        }

        for (const [key, list] of Object.entries({ types, members, typeSelectors, mappings, observationTypes, observationTargets, conversions })) {
            if (!Array.isArray(list)) {
                fail('LEXICA4503', `A module's ${key} are a list`, undefined, key);
            }
        }

        // Data that reaches itself is refused before anything reads into it, since validating, copying and freezing a declaration each walk its data.
        for (const [key, list] of Object.entries({ types, members, typeSelectors, mappings, observationTypes, observationTargets, conversions })) {
            list.forEach(declared => LexicaModule.#refuseCycles(declared, LexicaModule.#declarationNameOf(declared, key), fail));
        }

        this.#name = name;
        this.#typeOf = typeOf;

        // Each declaration but a type is read without its keys that hold undefined, which it leaves out as it leaves out a key it does not write; a type is kept as it is given.
        const normalized = declarations => declarations.map(declared => LexicaModule.#withoutUndefinedValues(declared));
        const memberDeclarations = normalized(members);
        const typeSelectorDeclarations = normalized(typeSelectors);
        const mappingDeclarations = normalized(mappings);
        const observationTypeDeclarations = normalized(observationTypes);
        const observationTargetDeclarations = normalized(observationTargets);
        const conversionDeclarations = normalized(conversions);

        LexicaModule.#validateTypeDeclarations(types, fail, failWithin);
        LexicaModule.#validateMembers(memberDeclarations, fail);
        LexicaModule.#validateTypeSelectors(typeSelectorDeclarations, fail);
        LexicaModule.#validateMappings(mappingDeclarations, name, fail);
        LexicaModule.#validateObservationTypes(observationTypeDeclarations, fail);
        LexicaModule.#validateObservationTargets(observationTargetDeclarations, fail);
        conversionDeclarations.forEach(conversion => LexicaModule.#validateConversion(conversion, fail));

        this.#types = LexicaModule.#freezeItems(types.map(type => LexicaModule.#createTypeCopy(type)));
        this.#members = LexicaModule.#freezeItems(memberDeclarations.map(member => LexicaModule.#createMemberCopy(member)));
        this.#typeSelectors = LexicaModule.#freezeItems(typeSelectorDeclarations.map(selector => LexicaModule.#copyOf(selector)));
        this.#mappings = LexicaModule.#freezeItems(mappingDeclarations.map(mapping => LexicaModule.#copyOf(mapping)));
        this.#observationTypes = LexicaModule.#freezeItems(observationTypeDeclarations.map(type => LexicaModule.#createObservationTypeCopy(type)));
        this.#observationTargets = LexicaModule.#freezeItems(observationTargetDeclarations.map(target => LexicaModule.#copyOf(target)));
        this.#conversions = LexicaModule.#freezeItems(conversionDeclarations.map(conversion => LexicaModule.#copyOf(conversion)));
    }

    /** The module's name. */
    get name() {
        return this.#name;
    }

    /** The module's recognition of a host's value, naming the most specific of its reference types the value is of, or null; undefined where it recognizes none. */
    get typeOf() {
        return this.#typeOf;
    }

    /** The types the module declares, its reference types and its structured types. */
    get types() {
        return this.#types;
    }

    /** The members the module adds. */
    get members() {
        return this.#members;
    }

    /** The type selectors the module declares. */
    get typeSelectors() {
        return this.#typeSelectors;
    }

    /** The keys the module maps for type selectors, each to a type. */
    get mappings() {
        return this.#mappings;
    }

    /** The types of observation the module declares. */
    get observationTypes() {
        return this.#observationTypes;
    }

    /** The targets the module's observation types observe besides a receiver and an argument. */
    get observationTargets() {
        return this.#observationTargets;
    }

    /** The conversions the module declares. */
    get conversions() {
        return this.#conversions;
    }

    /** The names of the scalar types Lexica defines, each a value of data alone, which conversions, data, equality and defaults read. */
    static get scalarTypeNames() {
        return SCALAR_TYPE_NAMES;
    }

    /** How a conversion is named where a message names it: its source type and its target, as `String to Number`. */
    static conversionNameOf(conversion) {
        return `${conversion.from} to ${conversion.to}`;
    }

    /** Whether the value is a module `createModule` made. */
    static isModule(value) {
        return value instanceof LexicaModule;
    }

    /** Whether the declaration is a host call's: a function the host invokes, which the evaluator never does. */
    static isInvokedByHost(declaration) {
        return declaration.invokedBy === 'host';
    }

    /** The object without its fields that hold undefined, which a declaration leaves out as it leaves out a field it does not write. */
    static #withoutUndefinedValues(object) {
        return ObjectUtils.isNonArrayObject(object) ? Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) : object;
    }

    /**
     * Refuses a declaration that is no object, or that declares a key its kind does not take, naming that key; a key holding undefined is one it leaves out. A declaration is named by the name given, by its own where none
     * is, and by none where the name is null, as a module's contents are, which keep codes of their own, the subject that declares their keys, and a hint for a key.
     */
    static #validateKeys(declaration, keys, what, fail, name, { notObjectCode = 'LEXICA4504', unknownKeyCode = 'LEXICA4030', declaringSubject = what, hintOf = () => '' } = {}) {
        if (!ObjectUtils.isNonArrayObject(declaration)) {
            fail(notObjectCode, `${what} ${name === null ? 'are' : 'is'} an object declaring ${keys.join(', ')}`, name === undefined || name === null ? undefined : String(name));
        }

        const declarationName = name === null ? undefined : String(name ?? declaration.name);

        for (const key of Object.keys(LexicaModule.#withoutUndefinedValues(declaration))) {
            if (!keys.includes(key)) {
                fail(unknownKeyCode, `${declaringSubject} declares ${keys.join(', ')}, and '${key}' is none of them${hintOf(key)}`, declarationName, key);
            }
        }
    }

    /** The failure of a declaration's part under the key given, `updates` or `parameters`: its own key is located beneath that key, and the part itself at it. */
    static #failUnder(fail, partKey) {
        return (code, message, declarationName, declarationKey) => fail(code, message, declarationName, declarationKey === undefined ? partKey : `${partKey}.${declarationKey}`);
    }

    static #freezeItems(items) {
        return Object.freeze(items.map(item => LexicaModule.#deepFreeze(item)));
    }

    /** Freezes the data a declaration holds, leaving its implementation, a function its module owns, as it is. */
    static #deepFreeze(value) {
        if (value !== null && typeof value === 'object') {
            Object.values(value).forEach(item => LexicaModule.#deepFreeze(item));
            Object.freeze(value);
        }

        return value;
    }

    /**
     * Refuses a declaration whose data reaches itself through the objects it holds, lists and class instances among them, which data never does, naming the declaration key it stands under: every object freezing walks into.
     * A value two parts of it share, which reaches itself through neither, is no cycle, and a function, an implementation among them, is never looked into, as copying and freezing never look into one.
     */
    static #refuseCycles(declaration, name, fail) {
        const visit = (value, ancestors, declarationKey) => {
            if (value === null || typeof value !== 'object') {
                return;
            }

            if (ancestors.has(value)) {
                fail('LEXICA4562', 'A declaration holds a value that reaches itself, which data never does', name, declarationKey);
            }

            ancestors.add(value);

            for (const [key, item] of Object.entries(value)) {
                visit(item, ancestors, declarationKey ?? key);
            }

            ancestors.delete(value);
        };

        visit(declaration, new Set(), undefined);
    }

    /** The name a declaration's diagnostics give it before it is validated: a conversion's source and destination, a mapping's key, and any other declaration's own name, each where it is a string. */
    static #declarationNameOf(declared, key) {
        if (!ObjectUtils.isNonArrayObject(declared)) {
            return undefined;
        }

        if (key === 'conversions') {
            return LexicaModule.conversionNameOf(declared);
        }

        const name = key === 'mappings' ? declared.key : declared.name;

        return typeof name === 'string' ? name : undefined;
    }

    /** A copy of a declaration's data, through its lists and objects, each function in it kept as it is. */
    static #copyOf(value) {
        if (Array.isArray(value)) {
            return value.map(item => LexicaModule.#copyOf(item));
        }

        if (ObjectUtils.isPlainObject(value)) {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, LexicaModule.#copyOf(item)]));
        }

        return value;
    }

    static #isIdentifier(text) {
        return typeof text === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(text);
    }

    static #isTypeNotation(notation) {
        return Type.parse(notation) !== null;
    }

    /** Whether the type notation writes `@selected`, where the type a fixed argument selects stands. */
    static #writesSelected(notation) {
        const writes = type => {
            switch (type.kind) {
                case 'typeParameter':
                    return type.name === '@selected';
                case 'named':
                    return type.typeArguments.some(writes);
                case 'object':
                    return [...type.fieldTypes.values()].some(writes);
                default:
                    return false;
            }
        };

        return notation !== undefined && writes(Type.parse(notation));
    }

    /** Refuses an `impl`, the implementation a declaration carries, that is given and is no function. */
    static #validateImplementation(declaration, name, fail) {
        if (declaration.impl !== undefined && typeof declaration.impl !== 'function') {
            fail('LEXICA4505', 'Its `impl` is a function', name, 'impl');
        }
    }

    /** Validates the types a module declares, each named once in the module, since a type is identified by its module and its name, and each one's own members, located at it. */
    static #validateTypeDeclarations(types, fail, failWithin) {
        const names = new Set();

        for (const type of types) {
            LexicaModule.#validateTypeDeclaration(type, fail, failWithin);

            // A type and an extension are named once among a module's types, by their local names, the parameters a name declares taking no part.
            const { name } = LexicaModule.#parseDeclaredName(type.name);

            if (names.has(name)) {
                fail('LEXICA4033', `The type '${name}' is declared already`, name);
            }

            names.add(name);
        }
    }

    /**
     * A declaration's name as it is written: its local name and the type parameters it declares in angle brackets after it, `ListExtensions<T>` naming `ListExtensions` and declaring `T`, and none where it writes no
     * brackets. A name that writes brackets with nothing in them, or a parameter without a name, answers the failure.
     * @returns {{ name: string, typeParameters: string[], failure?: string }}
     */
    static #parseDeclaredName(written) {
        const match = typeof written === 'string' ? DECLARED_NAME.exec(written) : null;

        if (match === null) {
            return { name: written, typeParameters: [] };
        }

        const [, name, list] = match;

        if (list === undefined) {
            return { name, typeParameters: [] };
        }

        const typeParameters = list.split(',').map(parameter => parameter.trim());

        if (typeParameters.some(parameter => !Names.isIdentifier(parameter))) {
            return { name, typeParameters, failure: list.trim() === '' ? `'${written}' writes empty angle brackets, where a declaration declares its type parameters` : `'${written}' declares a type parameter without a name` };
        }

        return { name, typeParameters };
    }

    /** Refuses a declared name's failed parameters (LEXICA4010) and a parameter it declares twice (LEXICA4041), answering its local name and its parameters. */
    static #validateDeclaredName(written, fail, declarationKey = 'name') {
        const parsed = LexicaModule.#parseDeclaredName(written);

        if (parsed.failure !== undefined) {
            fail('LEXICA4010', parsed.failure, String(parsed.name), declarationKey);
        }

        const repeated = parsed.typeParameters.find((parameter, index) => parsed.typeParameters.indexOf(parameter) < index);

        if (repeated !== undefined) {
            fail('LEXICA4041', `'${written}' declares the type parameter '${repeated}' twice`, parsed.name, declarationKey);
        }

        return parsed;
    }

    static #validateTypeDeclaration(type, fail, failWithin) {
        if (ObjectUtils.isNonArrayObject(type) && !TYPE_KINDS.includes(type.kind)) {
            fail('LEXICA4554', type.kind === undefined ? `A type declares its kind, ${TYPE_KINDS.join(' or ')}` : `A type is of the kind ${TYPE_KINDS.join(' or ')}, and '${String(type.kind)}' is none of them`, String(type.name), 'kind');
        }

        LexicaModule.#validateKeys(type, TYPE_KEYS_BY_KIND[type?.kind] ?? TYPE_KEYS_BY_KIND.structured, type?.kind === 'extension' ? 'An extension' : `A ${type?.kind ?? 'structured'} type`, fail);

        const { name, typeParameters } = LexicaModule.#validateDeclaredName(type.name, fail);

        if (!Names.isIdentifier(name)) {
            fail('LEXICA4552', 'A type is named by an identifier, a letter followed by letters and digits', String(name), 'name');
        }

        // A type's data is never generic, so only an extension's name declares type parameters.
        if (type.kind !== 'extension' && typeParameters.length > 0) {
            fail('LEXICA4558', `'${type.name}' is a ${type.kind} type, which declares no type parameters`, name, 'name');
        }

        // Every single capital letter is a type parameter of a member declared flat with its target, so a type of one letter would be read as one wherever such a member names it.
        if (name.length === 1) {
            fail('LEXICA4506', `'${name}', a single capital letter, is read as a type parameter, so a type is named by more than one letter`, name, 'name');
        }

        if (type.kind === 'extension') {
            LexicaModule.#validateExtensionTarget(type, name, fail);
        }

        const imports = type.import ?? [];

        if (!Array.isArray(imports) || !imports.every(moduleName => Names.isIdentifier(moduleName))) {
            fail('LEXICA4507', 'A type imports modules by their names, as a list', type.name, 'import');
        }

        const repeated = imports.find((moduleName, index) => imports.indexOf(moduleName) < index);

        if (repeated !== undefined) {
            fail('LEXICA4508', `The type imports the module '${repeated}' twice`, type.name, 'import');
        }

        LexicaModule.#validateInternal(type, name, fail);

        if (type.kind === 'reference') {
            LexicaModule.#validateReferenceType(type, fail);
        }

        LexicaModule.#validateOwnMembers(type, fail, failWithin(name), typeParameters);
    }

    /** Refuses an extension that names no target (LEXICA4012), one that is no type (LEXICA4512), and one that is `Any` or nullable (LEXICA4559): its one target, a type or a parameter it declares, which a member is read on a value of. */
    static #validateExtensionTarget(extension, name, fail) {
        if (extension.target === undefined) {
            fail('LEXICA4012', 'An extension names its target, the type its members extend', name, 'target');
        }

        if (!LexicaModule.#isTypeNotation(extension.target)) {
            fail('LEXICA4512', 'An extension names its target as a type', name, 'target');
        }

        const target = Type.parse(extension.target);

        if (target.isNullable || (target.kind === 'named' && target.name === 'Any' && target.moduleName === null)) {
            fail('LEXICA4559', `An extension's target is never Any, since a parameter it declares extends every type, and never nullable, since a member is read on a value, and ${extension.target} is ${target.isNullable ? 'nullable' : 'Any'}`, name, 'target');
        }
    }

    /** Validates a reference type's membership, the supertype it names and whether it is abstract, keeping its `isInstance` as it is. */
    static #validateReferenceType(type, fail) {
        if (type.isInstance === undefined) {
            fail('LEXICA4017', 'A reference type declares its isInstance, which answers whether a value belongs to it', type.name, 'isInstance');
        }

        if (typeof type.isInstance !== 'function') {
            fail('LEXICA4051', "A reference type's isInstance is a function, which answers whether a value belongs to it", type.name, 'isInstance');
        }

        if (type.supertype !== undefined && !LexicaModule.#isTypeNotation(type.supertype)) {
            fail('LEXICA4512', 'A reference type names its supertype as a type', type.name, 'supertype');
        }

        if (type.abstract !== undefined && typeof type.abstract !== 'boolean') {
            fail('LEXICA4555', 'Whether a reference type is abstract is a Boolean', type.name, 'abstract');
        }
    }

    /**
     * Validates the members a type declares within it, a list of members each taking the type as its receiver, so none names a target, a structured type's properties without updates its data shape; each is located at
     * the type.
     */
    static #validateOwnMembers(type, fail, failWithinType, typeParameters) {
        if (type.members === undefined) {
            return;
        }

        if (!Array.isArray(type.members)) {
            fail('LEXICA4503', "A type's members are a list", type.name, 'members');
        }

        type.members.forEach(member => LexicaModule.#validateMember(LexicaModule.#withoutUndefinedValues(member), failWithinType, type.kind, typeParameters));
    }

    /** Creates the stored copy of a valid type: its data, named by its local name with the type parameters it declares beside it, and each of its own members as a member's stored copy is created. */
    static #createTypeCopy(type) {
        const copy = { ...LexicaModule.#copyOf(type), ...LexicaModule.#namedCopyOf(type.name) };

        return type.members === undefined ? copy : { ...copy, members: type.members.map(member => LexicaModule.#createMemberCopy(LexicaModule.#withoutUndefinedValues(member), true)) };
    }

    /** The keys a declared name gives its stored copy: its local name, and the type parameters it declares, `typeParameters`, where it declares any. */
    static #namedCopyOf(written) {
        const { name, typeParameters } = LexicaModule.#parseDeclaredName(written);

        return typeParameters.length === 0 ? { name } : { name, typeParameters: Object.freeze(typeParameters) };
    }

    /** Validates the type selectors a module declares, each named as a name is, once in the module. */
    static #validateTypeSelectors(selectors, fail) {
        const names = new Set();

        for (const selector of selectors) {
            LexicaModule.#validateKeys(selector, TYPE_SELECTOR_KEYS, 'A type selector', fail);

            if (!Names.isIdentifier(selector.name)) {
                fail('LEXICA4006', 'A type selector is named as a name is', String(selector.name), 'name');
            }

            if (names.has(selector.name)) {
                fail('LEXICA4007', `The type selector '${selector.name}' is declared twice`, selector.name, 'name');
            }

            names.add(selector.name);
        }
    }

    /** Validates the mappings a module declares, each key once in its selector within the module, since a key is never replaced. */
    static #validateMappings(mappings, moduleName, fail) {
        const keys = new Set();

        for (const mapping of mappings) {
            LexicaModule.#validateMapping(mapping, fail);

            const key = JSON.stringify([mapping.selector, mapping.key]);

            if (keys.has(key)) {
                fail('LEXICA4038', `The type selector '${mapping.selector}' maps the key '${mapping.key}' already, as the module '${moduleName}' declared it, and a key is never replaced`, mapping.key, 'key');
            }

            keys.add(key);
        }
    }

    /** Validates a mapping: the selector it belongs to, its key, any string, as a fixed argument may give any, and the type it maps the key to. A mapping is located by its key, as its selector's keys are told apart. */
    static #validateMapping(mapping, fail) {
        LexicaModule.#validateKeys(mapping, MAPPING_KEYS, 'A mapping', fail, ObjectUtils.isNonArrayObject(mapping) && typeof mapping.key === 'string' ? mapping.key : null);

        if (typeof mapping.key !== 'string') {
            fail('LEXICA4008', 'A mapping declares its key, a string, as a fixed argument gives it', undefined, 'key');
        }

        // A selector that isn't a name can't be one a module declares.
        if (!Names.isIdentifier(mapping.selector)) {
            fail(mapping.selector === undefined ? 'LEXICA4008' : 'LEXICA4039', 'A mapping names the type selector it belongs to', mapping.key, 'selector');
        }

        if (!LexicaModule.#isTypeNotation(mapping.type)) {
            fail(mapping.type === undefined ? 'LEXICA4008' : 'LEXICA4512', 'A mapping declares the type its key maps to', mapping.key, 'type');
        }
    }

    /** Validates the types a member applies to, which a module member has none of. */
    static #validateTarget(declaration, name, fail) {
        const targets = [declaration.target].flat();

        if (targets.length === 0 || targets.some(notation => notation !== 'any' && !LexicaModule.#isTypeNotation(notation))) {
            fail('LEXICA4513', 'It declares the types it applies to, a type, a list of types or any', name, 'target');
        }
    }

    /**
     * Validates how a member changes and reads, the changes it misses, the tolerance it compares with and the observations that cover its changes, as one `updates` object.
     * @param {object} member The declaration whose updates they are.
     * @param {Map<string, object>} parameters Its parameters by name, which an observation can give an argument of.
     * @param {boolean} hasReceiver Whether it has a receiver, which a module member has none of.
     */
    static #validateUpdates(member, parameters, hasReceiver, name, fail) {
        const updates = LexicaModule.#withoutUndefinedValues(member.updates);

        LexicaModule.#validateKeys(updates, UPDATES_KEYS, 'Its updates', LexicaModule.#failUnder(fail, 'updates'), name);

        if (!CHANGE_CATEGORIES.includes(updates.changes) || !READING_MODES.includes(updates.reads)) {
            const updatesKey = CHANGE_CATEGORIES.includes(updates.changes) ? 'reads' : 'changes';

            fail(updates[updatesKey] === undefined ? 'LEXICA4023' : 'LEXICA4514', `It declares how it changes, one of ${CHANGE_CATEGORIES.join(', ')}, and how it reads, one of ${READING_MODES.join(', ')}`, name, `updates.${updatesKey}`);
        }

        if (updates.changes === 'partly-observable' && (typeof updates.misses !== 'string' || updates.misses === '')) {
            fail('LEXICA4058', 'A partly observable member states the changes it misses', name, 'updates.misses');
        }

        if (updates.changes !== 'partly-observable' && updates.misses !== undefined) {
            fail('LEXICA4058', `It changes as ${updates.changes}, so it misses no changes`, name, 'updates.misses');
        }

        if (updates.tolerance !== undefined) {
            if (!(Number.isFinite(updates.tolerance) && updates.tolerance >= 0)) {
                fail('LEXICA4515', 'Its tolerance is a number that is not negative', name, 'updates.tolerance');
            }

            if (!LexicaModule.#takesTolerance(member.result)) {
                fail('LEXICA4026', 'A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', name, 'updates.tolerance');
            }
        }

        const observations = updates.observations ?? [];

        if (!Array.isArray(observations)) {
            fail('LEXICA4516', 'Its observations are a list', name, 'updates.observations');
        }

        if (OBSERVED_CHANGE_CATEGORIES.includes(updates.changes) && observations.length === 0) {
            fail('LEXICA4059', `It changes as ${updates.changes}, so it names the observations that cover its changes`, name, 'updates.observations');
        }

        if (!OBSERVED_CHANGE_CATEGORIES.includes(updates.changes) && observations.length > 0) {
            fail('LEXICA4059', `It changes as ${updates.changes}, so it names no observations`, name, 'updates.observations');
        }

        for (const observationDeclaration of observations) {
            LexicaModule.#validateObservation(observationDeclaration, parameters, hasReceiver, name, fail);
        }
    }

    /** Whether a tolerance means something for the result: a number, a nullable one, or a named type that may be a structure holding numbers, which the registry checks once every type is known; never a generic value type, as a list is. */
    static #takesTolerance(notation) {
        const type = Type.parse(notation);

        return type?.kind === 'named' && type.typeArguments.length === 0 && !UNTOLERATED_TYPE_NAMES.has(type.name);
    }

    /** Validates one observation a declaration names: its type, what it observes, which a module member's never a receiver is, and the arguments its type takes. */
    static #validateObservation(observationDeclaration, parameters, hasReceiver, name, fail) {
        const declarationKey = 'updates.observations';

        if (observationDeclaration === null || typeof observationDeclaration !== 'object' || !Names.isIdentifier(observationDeclaration.type)) {
            fail(observationDeclaration === null || typeof observationDeclaration !== 'object' ? 'LEXICA4504' : 'LEXICA4060', 'An observation names its type as a name is', name, declarationKey);
        }

        // A function a member is given lasts as long as its invocation, so no observation, which outlives it, is given one.
        const functionArgumentReference = Object.values(observationDeclaration).find(value => typeof value?.argument === 'string' && parameters.get(value.argument)?.kind === 'function');

        if (functionArgumentReference !== undefined) {
            fail('LEXICA4055', `The observation '${observationDeclaration.type}' is given the parameter '${functionArgumentReference.argument}', a function that lasts only while the member's invocation does`, name, declarationKey);
        }

        // A target is named as a name is, and whether its observation type's module declares it is the registry's to check, which knows every module.
        // Whether `of` takes a form an observation may name, an identifier or an argument reference; that the target it names exists, registration checks.
        const namesObserved = Names.isIdentifier(observationDeclaration.of) || LexicaModule.#isArgumentReference(observationDeclaration.of, parameters);

        if (!namesObserved) {
            fail('LEXICA4060', `The observation '${observationDeclaration.type}' observes the receiver, an argument of the member or an observation target by its name, and not '${JSON.stringify(observationDeclaration.of)}'`, name, declarationKey);
        }

        if (!hasReceiver && observationDeclaration.of === 'receiver') {
            fail('LEXICA4057', `The observation '${observationDeclaration.type}' observes the receiver, and a member without a target has no receiver`, name, declarationKey);
        }

        for (const [key, value] of Object.entries(observationDeclaration)) {
            if (key !== 'type' && key !== 'of' && !LexicaModule.#isObservationArgument(value, parameters)) {
                fail(LexicaModule.#isMisplacedPrefix(value, parameters) ? 'LEXICA4061' : 'LEXICA4060', `The observation '${observationDeclaration.type}' gives '${key}' a value that is no literal, list of literals or argument of the member, which a prefix, a string, is joined to only where its parameter is a value parameter of type string`, name, declarationKey);
            }
        }
    }

    /** Whether the value joins a prefix to an argument of the member whose parameter is not a value parameter of type string, the one parameter a prefix is joined to. */
    static #isMisplacedPrefix(value, parameters) {
        if (!ObjectUtils.isNonArrayObject(value) || Object.keys(value).length !== 2 || typeof value.prefix !== 'string' || value.prefix === '' || !parameters.has(value.argument)) {
            return false;
        }

        const parameter = parameters.get(value.argument);

        return parameter.kind !== 'value' || parameter.type !== 'String';
    }

    static #isArgumentReference(value, parameters) {
        return value !== null && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.argument === 'string' && parameters.has(value.argument);
    }

    /** Whether the value is an argument with a prefix joined to it, `{ argument, prefix }`, as `{ argument: 'name', prefix: 'aria-' }` names the attribute `aria-` and the name: the prefix a string no empty one, and the parameter a value parameter of type string, so nothing but a string is joined to it. */
    static #isPrefixedArgumentReference(value, parameters) {
        if (value === null || typeof value !== 'object' || Object.keys(value).length !== 2 || typeof value.prefix !== 'string' || value.prefix === '' || typeof value.argument !== 'string') {
            return false;
        }

        const parameter = parameters.get(value.argument);

        return parameter?.kind === 'value' && parameter.type === 'String';
    }

    /** Whether the value is an argument an observation may give its observation type: a literal, a reference to an argument of the member, which can carry a prefix, or a list of them. */
    static #isObservationArgument(value, parameters) {
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
            return true;
        }

        if (Array.isArray(value)) {
            return value.every(item => LexicaModule.#isObservationArgument(item, parameters));
        }

        return LexicaModule.#isArgumentReference(value, parameters) || LexicaModule.#isPrefixedArgumentReference(value, parameters);
    }

    /** Validates the targets a module declares: each named once, never `receiver`, found from the receiver where it says `from: 'receiver'`, and several where it says `count: 'many'`. */
    static #validateObservationTargets(targets, fail) {
        const names = new Set();

        for (const target of targets) {
            LexicaModule.#validateKeys(target, OBSERVATION_TARGET_KEYS, 'An observation target', fail);

            if (!Names.isIdentifier(target.name)) {
                fail('LEXICA4006', 'An observation target is named as a name is', String(target.name), 'name');
            }

            if (target.name === 'receiver') {
                fail('LEXICA4037', "'receiver' names an observation's receiver, so no target is named by it", target.name, 'name');
            }

            if (names.has(target.name)) {
                fail('LEXICA4517', `The observation target '${target.name}' is declared twice`, target.name, 'name');
            }

            names.add(target.name);

            if (target.from !== undefined && target.from !== 'receiver') {
                fail('LEXICA4518', "A target found from the receiver says from: 'receiver', and one independent of it leaves from out", target.name, 'from');
            }

            if (target.count !== undefined && target.count !== 'many') {
                fail('LEXICA4519', "A target of several says count: 'many', and one target leaves count out", target.name, 'count');
            }
        }
    }

    /** Validates the observation types a module declares, each once in the module. */
    static #validateObservationTypes(types, fail) {
        const names = new Set();

        for (const type of types) {
            LexicaModule.#validateObservationType(type, fail);

            if (names.has(type.name)) {
                fail('LEXICA4007', `The observation type '${type.name}' is declared twice`, type.name, 'name');
            }

            names.add(type.name);
        }
    }

    static #validateObservationType(type, fail) {
        LexicaModule.#validateKeys(type, OBSERVATION_TYPE_KEYS, 'An observation type', fail);

        const identity = type?.identity ?? [];

        if (!Names.isIdentifier(type?.name) || !OBSERVATION_CONTRACTS.includes(type.contract)) {
            fail(Names.isIdentifier(type?.name) ? 'LEXICA4520' : 'LEXICA4006', `An observation type is named as a name is and is one of ${OBSERVATION_CONTRACTS.join(', ')}`, String(type?.name), Names.isIdentifier(type?.name) ? 'contract' : 'name');
        }

        if (!Array.isArray(identity) || !identity.every(argument => LexicaModule.#isIdentifier(argument))) {
            fail('LEXICA4521', 'It names the arguments that belong to the identity of an observation, as identifiers', type.name, 'identity');
        }

        if (type.shared !== undefined && typeof type.shared !== 'boolean') {
            fail('LEXICA4522', 'It declares whether observations are shared, as a Boolean', type.name, 'shared');
        }

        LexicaModule.#validateImplementation(type, type.name, fail);
    }

    /** Creates the stored copy of a valid observation type, its identity none and its observations shared where it says neither. */
    static #createObservationTypeCopy(type) {
        return LexicaModule.#copyOf({ identity: [], shared: true, ...type });
    }

    /**
     * Validates a conversion: the type of data it converts from, the one it converts to, each a name, and its implementation where it has one.
     * A value already of a type converts to itself, as the language says, so no conversion is declared from a type to itself.
     */
    static #validateConversion(conversion, fail) {
        LexicaModule.#validateKeys(conversion, CONVERSION_KEYS, 'A conversion', fail, ObjectUtils.isNonArrayObject(conversion) ? LexicaModule.conversionNameOf(conversion) : undefined);

        const name = LexicaModule.conversionNameOf(conversion);

        for (const key of ['from', 'to']) {
            const type = Type.parse(conversion[key]);

            if (type?.kind !== 'named' || type.isNullable || type.typeArguments.length > 0) {
                fail('LEXICA4065', `A conversion is from a type of data to another, each named as it is declared: ${SCALAR_TYPE_NAMES.join(', ')} or a structured type, and its '${key}' is none of them`, name, key);
            }
        }

        if (conversion.from === conversion.to) {
            fail('LEXICA4066', 'A value already of a type converts to itself, so no conversion is declared from a type to itself', name, 'to');
        }

        LexicaModule.#validateImplementation(conversion, name, fail);
    }

    /** Validates the members a module declares, each module member named once in the module, since its namespace reaches it by its name alone. */
    static #validateMembers(members, fail) {
        const moduleMemberNames = new Set();

        for (const member of members) {
            LexicaModule.#validateMember(member, fail);

            if (member.target !== undefined) {
                continue;
            }

            if (moduleMemberNames.has(member.name)) {
                fail('LEXICA4549', `The module member '${member.name}' is declared already`, member.name, 'name');
            }

            moduleMemberNames.add(member.name);
        }
    }

    /**
     * Validates a member: a flat one, which names its target where it has a receiver, or one declared within a type of the kind given, whose receiver the type is, so it names none; a property a structured type declares
     * directly without updates is a property of its data shape, which takes its name, its kind and its result alone.
     */
    static #validateMember(member, fail, containingKind = undefined, containingParameters = []) {
        const isWithinType = containingKind !== undefined;
        const isDataProperty = containingKind === 'structured' && member?.kind === 'property' && member.updates === undefined;
        // A member within a type takes the type as its receiver, so it takes no target.
        const memberKeys = isDataProperty ? DATA_PROPERTY_KEYS : isWithinType ? MEMBER_KEYS.filter(key => key !== 'target') : MEMBER_KEYS;
        const kindKeys = isDataProperty ? [] : (MEMBER_KEYS_BY_KIND[member?.kind] ?? []);

        if (!ObjectUtils.isNonArrayObject(member)) {
            fail('LEXICA4504', `A member is an object declaring ${memberKeys.join(', ')} and what its kind takes`);
        }

        // An unnamed indexer declares no name, and is located as its access is written; a member within a type or an extension, and a module member, declare their own type parameters in their names, and a member
        // declared flat with its target reads every single capital letter as one, until named extension types replace it.
        const isUnnamedIndexer = member.kind === 'indexer' && member.name === undefined;
        const declaresParameters = isWithinType || member.target === undefined;
        const declared = declaresParameters && !isUnnamedIndexer ? LexicaModule.#validateDeclaredName(member.name, fail) : { name: member.name, typeParameters: [] };
        const name = isUnnamedIndexer ? UNNAMED_INDEXER_NAME : declared.name;
        const ownParameter = declared.typeParameters.find(parameter => containingParameters.includes(parameter));

        if (ownParameter !== undefined) {
            fail('LEXICA4043', `'${member.name}' declares the type parameter '${ownParameter}', which its extension declares, so its extension's stands within it`, name, 'name');
        }

        // A member is read after a dot or, an indexer, after a colon, where only a member's name stands, so a keyword names one.
        if (!isUnnamedIndexer && !Names.isIdentifier(name)) {
            fail(name === undefined ? 'LEXICA4002' : 'LEXICA4523', 'A member is named as a name is, a keyword among them', String(name), 'name');
        }

        if (!MEMBER_KINDS.includes(member.kind)) {
            fail('LEXICA4524', `A member is one of ${MEMBER_KINDS.join(', ')}`, name, 'kind');
        }

        LexicaModule.#validateKeys(member, [...memberKeys, ...kindKeys], isDataProperty ? "A property of a structured type's data" : `A member of kind '${member.kind}'`, fail, isUnnamedIndexer ? UNNAMED_INDEXER_NAME : undefined);

        const hasReceiver = isWithinType || member.target !== undefined;

        if (!isWithinType && hasReceiver) {
            LexicaModule.#validateTarget(member, name, fail);
        }

        if (member.invokedBy !== undefined && !INVOKERS.includes(member.invokedBy)) {
            fail('LEXICA4525', `A function is invoked by one of ${INVOKERS.join(', ')}, the evaluator where it says none`, name, 'invokedBy');
        }

        const isInvokedByHost = LexicaModule.isInvokedByHost(member);

        // A host call's result is the type of each value its host supplies, and one that supplies none declares none.
        if (!(isInvokedByHost && member.result === undefined) && !LexicaModule.#isTypeNotation(member.result)) {
            fail(member.result === undefined ? 'LEXICA4003' : 'LEXICA4512', isInvokedByHost ? 'It declares the type of each value its host supplies, or none, where it supplies none' : 'It declares the type of its result', name, 'result');
        }

        const parameters = Array.isArray(member.parameters) ? member.parameters.map(parameter => LexicaModule.#withoutUndefinedValues(parameter)) : (member.parameters ?? []);

        if (!Array.isArray(parameters)) {
            fail('LEXICA4526', 'Its parameters are a list', name, 'parameters');
        }

        const parameterNames = new Set();

        for (const parameter of parameters) {
            LexicaModule.#validateParameter(parameter, name, fail);

            if (parameterNames.has(parameter.name)) {
                fail('LEXICA4527', `The parameter '${parameter.name}' is declared twice`, name, 'parameters');
            }

            parameterNames.add(parameter.name);
        }

        if (isInvokedByHost) {
            LexicaModule.#validateHostInvokedFunction(member, parameters, name, fail);
        }

        LexicaModule.#validateSelections(member, parameters, name, fail);
        LexicaModule.#validateForm(member, parameters, hasReceiver, name, fail);

        if (kindKeys.includes('updates') && !isInvokedByHost) {
            // A property declared directly in a structured type without updates is its data, which Lexica reads; any other property declares how it changes and how it reads, as a function does.
            if (member.updates === undefined && member.kind === 'property') {
                fail('LEXICA4032', "It declares its updates, how it changes and how it reads, since only a property declared directly in a structured type declares none, and is that type's data", name, 'updates');
            }

            if (member.updates === undefined) {
                fail('LEXICA4003', 'It declares its updates, how it changes and how it reads', name, 'updates');
            }

            LexicaModule.#validateUpdates(member, new Map(parameters.map(parameter => [parameter.name, parameter])), hasReceiver, name, fail);
        }

        LexicaModule.#validateInternal(member, name, fail);
        LexicaModule.#validateImplementation(member, name, fail);
    }

    /** Refuses an `internal` that is given and is no Boolean: `false` where it is left out, and any other value, a string among them, refused. */
    static #validateInternal(declaration, name, fail) {
        if (declaration.internal !== undefined && typeof declaration.internal !== 'boolean') {
            fail('LEXICA4031', 'Whether it is internal, available within its declaring module alone, is a Boolean', name, 'internal');
        }
    }

    /** Creates the stored copy of a valid member: its updates' observations none where it names none, and its parameters each without its keys that hold undefined. */
    static #createMemberCopy(member, isWithinType = false) {
        const parameters = (member.parameters ?? []).map(parameter => LexicaModule.#withoutUndefinedValues(parameter));
        const updates = member.updates === undefined ? {} : { updates: { observations: [], ...LexicaModule.#withoutUndefinedValues(member.updates) } };
        // A member that declares its own type parameters is named by its local name, and keeps them beside it.
        const named = member.name !== undefined && (isWithinType || member.target === undefined) ? LexicaModule.#namedCopyOf(member.name) : {};

        // A property is read with no arguments, so it keeps an empty list of parameters, which every member then has.
        return LexicaModule.#copyOf({ ...member, ...named, parameters, ...updates });
    }

    /**
     * Refuses what a host call cannot take: updates, since it is never evaluated; an implementation, since its host invokes it; an indexer's kind, since it is a function; and a parameter other than a value parameter, whose argument is prepared as a value its host keeps.
     */
    static #validateHostInvokedFunction(member, parameters, name, fail) {
        if (member.updates !== undefined) {
            fail('LEXICA4030', 'Its host invokes it, and the evaluator never evaluates it, so it declares no updates', name, 'updates');
        }

        if (member.impl !== undefined) {
            fail('LEXICA4030', 'Its host invokes it, so its module gives Lexica no implementation of it', name, 'impl');
        }

        if (member.kind === 'indexer') {
            fail('LEXICA4053', 'A function the host invokes is written as a function call, never as an indexer', name, 'invokedBy');
        }

        const unprepared = parameters.find(parameter => parameter.kind !== 'value');

        if (unprepared !== undefined) {
            fail('LEXICA4056', `A function the host invokes takes value parameters alone, each argument prepared as a value its host keeps, and '${unprepared.name}' is ${unprepared.kind === 'expression' ? 'an' : 'a'} ${unprepared.kind} parameter`, name, 'parameters');
        }
    }

    /**
     * Checks the fixed parameters a member takes: a function's one at most, which selects a type, whose result writes `@selected` where that type stands, as a member selecting none writes none.
     */
    static #validateSelections(member, parameters, name, fail) {
        const typeSelectingParameters = parameters.filter(parameter => parameter.fixed === true && parameter.selects === 'type');

        if (typeSelectingParameters.length > 1) {
            fail('LEXICA4009', `A function has one parameter at most that selects a type, since its result writes one @selected, and ${typeSelectingParameters.map(parameter => `'${parameter.name}'`).join(' and ')} each select one`, name, 'parameters');
        }

        if (typeSelectingParameters.length === 1 && !LexicaModule.#writesSelected(member.result)) {
            fail('LEXICA4529', `Its parameter '${typeSelectingParameters[0].name}' selects a type, so its result writes @selected where that type stands`, name, 'result');
        }

        if (typeSelectingParameters.length === 0 && LexicaModule.#writesSelected(member.result)) {
            fail('LEXICA4040', 'Its result writes @selected, and none of its parameters selects a type', name, 'result');
        }
    }

    /**
     * Checks how the member is written, by its kind, then the form its arguments take: a property is accessed and takes none; a function is called, its arguments positional, one for each parameter in order, so none that
     * is required follows one that is optional, or an options object; and an indexer is given its one key in brackets.
     */
    static #validateForm(member, parameters, hasReceiver, name, fail) {
        if (member.kind === 'indexer') {
            LexicaModule.#validateIndexer(parameters, hasReceiver, name, fail);
        }

        if (member.kind === 'function') {
            LexicaModule.#validateArgumentForm(member, parameters, name, fail);
        }
    }

    /** Checks an indexer, named or unnamed: its key is its one parameter, a required value parameter, given positionally in brackets after its receiver, so a member without a receiver is none. */
    static #validateIndexer(parameters, hasReceiver, name, fail) {
        const [parameter] = parameters;

        if (parameters.length !== 1 || parameter.kind !== 'value' || !parameter.required) {
            fail('LEXICA4020', 'An indexer takes its key as its one parameter, a required value parameter', name, 'parameters');
        }

        if (!hasReceiver) {
            fail('LEXICA4022', 'An indexer is written after its receiver, and a member without a target has none', name, 'kind');
        }
    }

    /** Checks the form a function's arguments take: none where it has no parameters, and otherwise one it declares, its positional arguments supplying its parameters in order, so none that is required follows one that is optional. */
    static #validateArgumentForm(member, parameters, name, fail) {
        if (parameters.length === 0) {
            if (member.arguments !== undefined) {
                fail('LEXICA4534', 'It has no parameters, so it declares no form of its arguments', name, 'arguments');
            }

            return;
        }

        if (!ARGUMENT_FORMS.includes(member.arguments)) {
            fail(member.arguments === undefined ? 'LEXICA4003' : 'LEXICA4535', `It has parameters, so it declares the form of its arguments, ${ARGUMENT_FORMS.join(' or ')}`, name, 'arguments');
        }

        // Arguments supply positional parameters in order, so one left out is one after the last given, which only an optional parameter can be.
        const firstOptional = parameters.findIndex(parameter => !parameter.required);
        const lateRequired = firstOptional === -1 ? undefined : parameters.slice(firstOptional).find(parameter => parameter.required);

        if (member.arguments === 'positional' && lateRequired !== undefined) {
            fail('LEXICA4019', `The required parameter '${lateRequired.name}' follows an optional one, and positional arguments supply parameters in order`, name, 'parameters');
        }
    }

    static #validateParameter(parameter, memberName, fail) {
        LexicaModule.#validateKeys(parameter, PARAMETER_KEYS, 'A parameter', LexicaModule.#failUnder(fail, 'parameters'), memberName);

        const declarationKey = 'parameters';

        // A function is never null, so a function parameter declares no null policy.
        const hasValidNullPolicy = parameter?.kind === 'function' ? parameter.nulls === undefined : NULL_POLICIES.includes(parameter?.nulls);

        if (!Names.isIdentifier(parameter.name) || !PARAMETER_KINDS.includes(parameter.kind) || !hasValidNullPolicy || typeof parameter.required !== 'boolean') {
            fail(parameter.kind === 'function' && !hasValidNullPolicy ? 'LEXICA4054' : 'LEXICA4536', 'A parameter declares its name, its kind, whether it is required and how it handles null, which a function parameter leaves out', memberName, declarationKey);
        }

        if (!LexicaModule.#isTypeNotation(parameter.type)) {
            fail(parameter.type === undefined ? 'LEXICA4536' : 'LEXICA4512', `The parameter '${parameter.name}' declares a type`, memberName, declarationKey);
        }

        // A function parameter's contract declares the type of each argument the member calls the function with, in order, and, as its type, the type of the result it takes from it.
        if (parameter.kind === 'function') {
            if (!Array.isArray(parameter.parameterTypes) || !parameter.parameterTypes.every(type => LexicaModule.#isTypeNotation(type))) {
                fail(Array.isArray(parameter.parameterTypes) ? 'LEXICA4512' : 'LEXICA4537', `The parameter '${parameter.name}' is a function that declares its parameterTypes, a list of the types it is called with`, memberName, declarationKey);
            }

            if (!parameter.required) {
                fail('LEXICA4054', `The parameter '${parameter.name}' is a function, so it is required`, memberName, declarationKey);
            }

            if (parameter.fixed !== undefined) {
                fail('LEXICA4030', `The parameter '${parameter.name}' is a function, so it cannot be fixed`, memberName, declarationKey);
            }

            if (parameter.context !== undefined) {
                fail('LEXICA4030', `The parameter '${parameter.name}' is a function, so it declares no 'context'`, memberName, declarationKey);
            }
        } else if (parameter.parameterTypes !== undefined) {
            fail('LEXICA4030', `The parameter '${parameter.name}' is no function, so it declares no parameterTypes`, memberName, declarationKey);
        }

        if (parameter.required && 'default' in parameter) {
            fail('LEXICA4538', `The required parameter '${parameter.name}' declares no default`, memberName, declarationKey);
        }

        if ((parameter.kind === 'expression' || parameter.kind === 'predicate') && parameter.context !== 'item') {
            fail('LEXICA4539', `The ${parameter.kind} parameter '${parameter.name}' declares its implicit parameter as context: 'item'`, memberName, declarationKey);
        }

        // A predicate's expression gives any value, and its implementation receives that value's truthiness.
        if (parameter.kind === 'predicate' && parameter.type !== 'Boolean') {
            fail('LEXICA4540', `The predicate parameter '${parameter.name}' is of type boolean, the truthiness its implementation receives`, memberName, declarationKey);
        }

        if (parameter.fixed !== undefined && typeof parameter.fixed !== 'boolean') {
            fail('LEXICA4541', `The parameter '${parameter.name}' declares whether it is fixed as a Boolean`, memberName, declarationKey);
        }

        if (parameter.fixed !== true) {
            if (parameter.selects !== undefined || parameter.selector !== undefined) {
                fail('LEXICA4542', `The parameter '${parameter.name}' selects nothing, since it is not fixed`, memberName, declarationKey);
            }

            return;
        }

        if (!SELECTION_KINDS.includes(parameter.selects)) {
            const predicateHint = parameter.selects === 'predicate' ? '; a test of the receiver is passed as a function, to a function parameter' : '';

            fail('LEXICA4543', `The fixed parameter '${parameter.name}' declares what it selects, one of ${SELECTION_KINDS.join(', ')}${predicateHint}`, memberName, declarationKey);
        }

        // A type is selected through the type selector the parameter names.
        if (!Names.isIdentifier(parameter.selector)) {
            fail('LEXICA4544', `The fixed parameter '${parameter.name}' selects a type, so it names the type selector it selects through`, memberName, declarationKey);
        }

        // A fixed argument names a declaration, which only a string can.
        if (parameter.kind !== 'value' || parameter.type !== 'String') {
            fail('LEXICA4545', `The fixed parameter '${parameter.name}' is a value parameter of type string, since it names what it selects`, memberName, declarationKey);
        }
    }
}
