/**
 * LexicaModule — a vocabulary's declarations as data, each that runs code carrying its implementation
 */

import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaErrors } from '../LexicaError.mjs';
import { Names } from '../Names.mjs';
import { Type } from '../Type.mjs';

const MEMBER_KINDS = ['property', 'function'];

/** Who invokes a function: the evaluator, as it evaluates the script, or the host, which the script's host call is prepared for. */
const INVOKERS = ['evaluator', 'host'];

/** How a member that is no property is written: a function call, `it.device("lamp")`, or a named indexer, `it.setting["mode"]`. */
const SYNTAXES = ['function-call', 'indexer'];

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

/** The names of the types Lexica defines, which a declaration names without any module declaring them. */
const BUILT_IN_TYPE_NAMES = ['Number', 'String', 'Boolean'];

/** The names of the types Lexica defines whose values hold no number, so a tolerance means nothing for them. */
const UNTOLERATED_TYPE_NAMES = new Set(BUILT_IN_TYPE_NAMES.filter(name => name !== 'Number'));

/** The kinds of type a module declares: a reference type, whose values have identity; a type declared without a kind is structured, of data. */
const TYPE_KINDS = ['reference'];

/** The kinds of type the declaration model brings, which a type declared in the flat member shape does not take yet. */
const DECLARATION_MODEL_TYPE_KINDS = ['structured', 'extension'];



/** The types of data Lexica defines, which a conversion converts between, as it does between them and the structured types modules declare. */
const DATA_TYPE_NAMES = ['Number', 'String', 'Boolean'];

/** What a module can declare. */
const CONTENTS = ['typeOf', 'types', 'members', 'typeSelectors', 'selectableTypes', 'observationTypes', 'observationTargets', 'conversions'];

/** The fields each member kind takes, beside those every member takes, so a field one does not take is refused rather than ignored. */
const MEMBER_KEYS = ['name', 'kind', 'target', 'result', 'implementation'];
const MEMBER_KEYS_BY_KIND = {
    property: ['updates'],
    function: ['invokedBy', 'syntax', 'arguments', 'default', 'parameters', 'updates'],
};
const UPDATES_KEYS = ['changes', 'reads', 'misses', 'tolerance', 'observations'];
const PARAMETER_KEYS = ['name', 'kind', 'type', 'required', 'default', 'fixed', 'selects', 'selector', 'nulls', 'context', 'omitted', 'parameters'];
const TYPE_KEYS = ['name', 'fields', 'import'];
const REFERENCE_TYPE_KEYS = ['name', 'kind', 'isInstance', 'supertype', 'abstract', 'import'];
const TYPE_SELECTOR_KEYS = ['name'];
const SELECTABLE_TYPE_KEYS = ['name', 'selector', 'type'];
const OBSERVATION_TYPE_KEYS = ['name', 'contract', 'identity', 'shared', 'implementation'];
const OBSERVATION_TARGET_KEYS = ['name', 'from', 'count'];
const CONVERSION_KEYS = ['from', 'to', 'implementation'];

/** How a selectable type's key is written: a letter, then letters, digits, colons and hyphens, as `motion` and `door:open` are. */
const SELECTABLE_KEY = /^[A-Za-z][A-Za-z0-9:-]*$/;

export class LexicaModule {
    #name;
    #typeOf;
    #types;
    #members;
    #typeSelectors;
    #selectableTypes;
    #observationTypes;
    #observationTargets;
    #conversions;

    /**
     * @param {string} name The module's name.
     * @param {object} contents What the module declares, each declaration that runs code carrying its implementation.
     * @param {object[]} [contents.types] The structured types it declares, each with its fields.
     * @param {object[]} [contents.members] The properties and functions it adds, a function its host invokes among them, a member without a target a module member.
     * @param {object[]} [contents.typeSelectors] The type selectors it declares, each by its name alone, through which a function's fixed argument selects the type of its result.
     * @param {object[]} [contents.selectableTypes] The keys it declares for type selectors, its own or another module's, each with the selector it belongs to and the type it maps to.
     * @param {object[]} [contents.observationTypes] The types of observation it declares.
     * @param {object[]} [contents.observationTargets] The targets its observation types observe besides a receiver and an argument, each found from the receiver or independent of it, one target or several.
     * @param {object[]} [contents.conversions] The conversions it declares, each from a type of data to another.
     */
    constructor(name, contents = {}) {
        if (!Names.isIdentifier(name)) {
            throw LexicaErrors.module('LEXICA4500', 'A module is named as a name is', { module: String(name) });
        }

        const fail = (code, message, declaration, field) => {
            throw LexicaErrors.module(code, message, { module: name, ...(declaration === undefined ? {} : { declaration }), ...(field === undefined ? {} : { field }) });
        };

        if (!ObjectUtils.isNonArrayObject(contents)) {
            fail('LEXICA4501', `A module's contents are an object declaring ${CONTENTS.join(', ')}`);
        }

        for (const key of Object.keys(contents)) {
            if (!CONTENTS.includes(key)) {
                fail('LEXICA4502', `A module declares ${CONTENTS.join(', ')}, and '${key}' is none of them${key === 'predicates' ? '; a test of a receiver is one of its members, a function whose result is a boolean' : ''}`, undefined, key);
            }
        }

        const { typeOf, types = [], members = [], typeSelectors = [], selectableTypes = [], observationTypes = [], observationTargets = [], conversions = [] } = contents;

        if (typeOf !== undefined && typeof typeOf !== 'function') {
            fail('LEXICA4051', "A module's typeOf is a function, which names the type of a value it recognizes", undefined, 'typeOf');
        }

        for (const [key, list] of Object.entries({ types, members, typeSelectors, selectableTypes, observationTypes, observationTargets, conversions })) {
            if (!Array.isArray(list)) {
                fail('LEXICA4503', `A module's ${key} are a list`, undefined, key);
            }
        }

        this.#name = name;
        this.#typeOf = typeOf;
        this.#types = LexicaModule.#freezeItems(types.map(type => LexicaModule.#validateTypeDeclaration(type, fail)));
        this.#members = LexicaModule.#freezeItems(members.map(member => LexicaModule.#validateMember(member, fail)));
        this.#typeSelectors = LexicaModule.#freezeItems(LexicaModule.#validateTypeSelectors(typeSelectors, fail));
        this.#selectableTypes = LexicaModule.#freezeItems(selectableTypes.map(selectable => LexicaModule.#validateSelectableType(selectable, fail)));
        this.#observationTypes = LexicaModule.#freezeItems(LexicaModule.#validateObservationTypes(observationTypes, fail));
        this.#observationTargets = LexicaModule.#freezeItems(LexicaModule.#validateObservationTargets(observationTargets, fail));
        this.#conversions = LexicaModule.#freezeItems(conversions.map(conversion => LexicaModule.#validateConversion(conversion, fail)));
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

    /** The keys the module declares for type selectors, each mapping to a type. */
    get selectableTypes() {
        return this.#selectableTypes;
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

    /** The names of the types Lexica defines, which a declaration names without any module declaring them. */
    static get builtInTypeNames() {
        return BUILT_IN_TYPE_NAMES;
    }

    /** The names of the types of data Lexica defines, which a conversion converts between. */
    static get dataTypeNames() {
        return DATA_TYPE_NAMES;
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
    static isHostCall(declaration) {
        return declaration.invokedBy === 'host';
    }

    /** The object without its fields that hold undefined, which a declaration leaves out as it leaves out a field it does not write. */
    static #defined(object) {
        return ObjectUtils.isNonArrayObject(object) ? Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) : object;
    }

    /** Refuses a declaration that is no object, or that declares a field its kind does not take, naming that field; a field holding undefined is one it leaves out. */
    static #validateKeys(declaration, keys, what, fail, name) {
        if (!ObjectUtils.isNonArrayObject(declaration)) {
            fail('LEXICA4504', `${what} is an object declaring ${keys.join(', ')}`, name === undefined ? undefined : String(name));
        }

        for (const key of Object.keys(LexicaModule.#defined(declaration))) {
            if (!keys.includes(key)) {
                fail('LEXICA4030', `${what} declares ${keys.join(', ')}, and '${key}' is none of them`, String(name ?? declaration.name), key);
            }
        }
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

    /** Refuses an implementation that is given and is no function. */
    static #validateImplementation(declaration, name, fail) {
        if (declaration.implementation !== undefined && typeof declaration.implementation !== 'function') {
            fail('LEXICA4505', 'Its implementation is a function', name, 'implementation');
        }
    }

    static #validateTypeDeclaration(type, fail) {
        const isReference = type?.kind === 'reference';

        if (ObjectUtils.isNonArrayObject(type) && DECLARATION_MODEL_TYPE_KINDS.includes(type.kind)) {
            fail('LEXICA4556', `A type of the kind '${type.kind}' declares its members within it, which this implementation does not read yet: declare a structured type by its fields, without a kind`, String(type.name), 'kind');
        }

        if (ObjectUtils.isNonArrayObject(type) && type.kind !== undefined && !TYPE_KINDS.includes(type.kind)) {
            fail('LEXICA4554', `A type is of the kind ${TYPE_KINDS.join(' or ')}, or declares its fields, and '${String(type.kind)}' is none of them`, String(type.name), 'kind');
        }

        LexicaModule.#validateKeys(type, isReference ? REFERENCE_TYPE_KEYS : TYPE_KEYS, isReference ? 'A reference type' : 'A type', fail);

        if (!Names.isIdentifier(type?.name)) {
            fail('LEXICA4552', 'A type is named by an identifier, a letter followed by letters and digits', String(type?.name), 'name');
        }

        // Every single capital letter is a type parameter, so a type of one letter would be read as one wherever it is named.
        if (type.name.length === 1) {
            fail('LEXICA4506', `'${type.name}', a single capital letter, is read as a type parameter, so a type is named by more than one letter`, type.name, 'name');
        }

        const imports = type.import ?? [];

        if (!Array.isArray(imports) || !imports.every(moduleName => Names.isIdentifier(moduleName))) {
            fail('LEXICA4507', 'A type imports modules by their names, as a list', type.name, 'import');
        }

        const repeated = imports.find((moduleName, index) => imports.indexOf(moduleName) < index);

        if (repeated !== undefined) {
            fail('LEXICA4508', `The type imports the module '${repeated}' twice`, type.name, 'import');
        }

        if (isReference) {
            return LexicaModule.#validateReferenceType(type, fail);
        }

        const fields = Object.entries(type.fields ?? {});

        if (fields.length === 0) {
            fail('LEXICA4509', 'A structured type declares at least one field', type.name, 'fields');
        }

        for (const [name, notation] of fields) {
            // A field of a structured type is read after a dot, so a keyword names one.
            if (!Names.isIdentifier(name) || !LexicaModule.#isTypeNotation(notation)) {
                fail('LEXICA4510', `The field '${name}' is not a name with a type`, type.name, 'fields');
            }
        }

        return LexicaModule.#copyOf(type);
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

        return LexicaModule.#copyOf(type);
    }

    /** Validates the type selectors a module declares, each named as a name is, once in the module. */
    static #validateTypeSelectors(selectors, fail) {
        const names = new Set();

        return selectors.map(declared => {
            const selector = LexicaModule.#defined(declared);

            LexicaModule.#validateKeys(selector, TYPE_SELECTOR_KEYS, 'A type selector', fail);

            if (!Names.isIdentifier(selector.name)) {
                fail('LEXICA4006', 'A type selector is named as a name is', String(selector.name), 'name');
            }

            if (names.has(selector.name)) {
                fail('LEXICA4007', `The type selector '${selector.name}' is declared twice`, selector.name, 'name');
            }

            names.add(selector.name);

            return LexicaModule.#copyOf(selector);
        });
    }

    /** Validates a selectable type: its key, the selector it belongs to, and the type it maps to. */
    static #validateSelectableType(declared, fail) {
        const selectable = LexicaModule.#defined(declared);

        LexicaModule.#validateKeys(selectable, SELECTABLE_TYPE_KEYS, 'A selectable type', fail);

        if (typeof selectable.name !== 'string' || !SELECTABLE_KEY.test(selectable.name)) {
            fail(selectable.name === undefined ? 'LEXICA4008' : 'LEXICA4511', 'A selectable type is named by its key, a letter followed by letters, digits, colons and hyphens', String(selectable.name), 'name');
        }

        // A selector that isn't a name can't be one a module declares.
        if (!Names.isIdentifier(selectable.selector)) {
            fail(selectable.selector === undefined ? 'LEXICA4008' : 'LEXICA4039', 'A selectable type names the type selector it belongs to', selectable.name, 'selector');
        }

        if (!LexicaModule.#isTypeNotation(selectable.type)) {
            fail(selectable.type === undefined ? 'LEXICA4008' : 'LEXICA4512', 'A selectable type declares the type its key maps to', selectable.name, 'type');
        }

        return LexicaModule.#copyOf(selectable);
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
     * @param {object} owner The declaration whose updates they are.
     * @param {Map<string, object>} parameters Its parameters by name, which an observation can give an argument of.
     * @param {boolean} hasReceiver Whether it has a receiver, which a module member has none of.
     */
    static #validateUpdates(owner, parameters, hasReceiver, name, fail) {
        const updates = LexicaModule.#defined(owner.updates);

        LexicaModule.#validateKeys(updates, UPDATES_KEYS, 'Its updates', (code, message, declaration, field) => fail(code, message, declaration, field === undefined ? 'updates' : `updates.${field}`), name);

        if (!CHANGE_CATEGORIES.includes(updates.changes) || !READING_MODES.includes(updates.reads)) {
            const field = CHANGE_CATEGORIES.includes(updates.changes) ? 'reads' : 'changes';

            fail(updates[field] === undefined ? 'LEXICA4023' : 'LEXICA4514', `It declares how it changes, one of ${CHANGE_CATEGORIES.join(', ')}, and how it reads, one of ${READING_MODES.join(', ')}`, name, `updates.${field}`);
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

            if (!LexicaModule.#takesTolerance(owner.result)) {
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
        const field = 'updates.observations';

        if (observationDeclaration === null || typeof observationDeclaration !== 'object' || !Names.isIdentifier(observationDeclaration.type)) {
            fail(observationDeclaration === null || typeof observationDeclaration !== 'object' ? 'LEXICA4504' : 'LEXICA4060', 'An observation names its type as a name is', name, field);
        }

        // A function a member is given lasts as long as its invocation, so no observation, which outlives it, is given one.
        const functionArgument = Object.values(observationDeclaration).find(value => typeof value?.argument === 'string' && parameters.get(value.argument)?.kind === 'function');

        if (functionArgument !== undefined) {
            fail('LEXICA4055', `The observation '${observationDeclaration.type}' is given the parameter '${functionArgument.argument}', a function that lasts only while the member's invocation does`, name, field);
        }

        // A target is named as a name is, and whether its observation type's module declares it is the registry's to check, which knows every module.
        const isTarget = Names.isIdentifier(observationDeclaration.of) || LexicaModule.#isArgumentReference(observationDeclaration.of, parameters);

        if (!isTarget) {
            fail('LEXICA4060', `The observation '${observationDeclaration.type}' observes the receiver, an argument of the member or an observation target by its name, and not '${JSON.stringify(observationDeclaration.of)}'`, name, field);
        }

        if (!hasReceiver && observationDeclaration.of === 'receiver') {
            fail('LEXICA4057', `The observation '${observationDeclaration.type}' observes the receiver, and a member without a target has no receiver`, name, field);
        }

        for (const [key, value] of Object.entries(observationDeclaration)) {
            if (key !== 'type' && key !== 'of' && !LexicaModule.#isObservationValue(value, parameters)) {
                fail(LexicaModule.#isMisplacedPrefix(value, parameters) ? 'LEXICA4061' : 'LEXICA4060', `The observation '${observationDeclaration.type}' gives '${key}' a value that is no literal, list of literals or argument of the member, which a prefix, a string, is joined to only where its parameter is a value parameter of type string`, name, field);
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

    static #isObservationValue(value, parameters) {
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
            return true;
        }

        if (Array.isArray(value)) {
            return value.every(item => LexicaModule.#isObservationValue(item, parameters));
        }

        return LexicaModule.#isArgumentReference(value, parameters) || LexicaModule.#isPrefixedArgumentReference(value, parameters);
    }

    /** Validates the targets a module declares: each named once, never `receiver`, found from the receiver where it says `from: 'receiver'`, and several where it says `count: 'many'`. */
    static #validateObservationTargets(targets, fail) {
        const names = new Set();

        return targets.map(declared => {
            const target = LexicaModule.#defined(declared);

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

            return LexicaModule.#copyOf(target);
        });
    }

    /** Validates the observation types a module declares, each once in the module. */
    static #validateObservationTypes(types, fail) {
        const names = new Set();

        return types.map(declared => {
            const type = LexicaModule.#validateObservationType(declared, fail);

            if (names.has(type.name)) {
                fail('LEXICA4007', `The observation type '${type.name}' is declared twice`, type.name, 'name');
            }

            names.add(type.name);

            return type;
        });
    }

    static #validateObservationType(declared, fail) {
        const type = LexicaModule.#defined(declared);

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

        return LexicaModule.#copyOf({ identity: [], shared: true, ...type });
    }

    /**
     * Validates a conversion: the type of data it converts from, the one it converts to, each a name, and its implementation where it has one.
     * A value already of a type converts to itself, as the language says, so no conversion is declared from a type to itself.
     */
    static #validateConversion(declared, fail) {
        const conversion = LexicaModule.#defined(declared);

        LexicaModule.#validateKeys(conversion, CONVERSION_KEYS, 'A conversion', fail, ObjectUtils.isNonArrayObject(conversion) ? LexicaModule.conversionNameOf(conversion) : undefined);

        const name = LexicaModule.conversionNameOf(conversion);

        for (const key of ['from', 'to']) {
            const type = Type.parse(conversion[key]);

            if (type?.kind !== 'named' || type.isNullable || type.typeArguments.length > 0) {
                fail('LEXICA4065', `A conversion is from a type of data to another, each named as it is declared: ${DATA_TYPE_NAMES.join(', ')} or a structured type, and its '${key}' is none of them`, name, key);
            }
        }

        if (conversion.from === conversion.to) {
            fail('LEXICA4066', 'A value already of a type converts to itself, so no conversion is declared from a type to itself', name, 'to');
        }

        LexicaModule.#validateImplementation(conversion, name, fail);

        return LexicaModule.#copyOf(conversion);
    }

    static #validateMember(declared, fail) {
        const member = LexicaModule.#defined(declared);

        if (!ObjectUtils.isNonArrayObject(member)) {
            fail('LEXICA4504', `A member is an object declaring ${MEMBER_KEYS.join(', ')} and what its kind takes`);
        }

        const name = member.name;

        // A member is read after a dot or, an indexer, after a colon, where only a member's name stands, so a keyword names one.
        // An indexer is named in alpha.33, where `[…]` reads a default one by its name.
        if (name === undefined && member.syntax === 'indexer') {
            fail('LEXICA4528', 'An indexer is named as a member is', String(name), 'name');
        }

        if (!Names.isIdentifier(name)) {
            fail(name === undefined ? 'LEXICA4002' : 'LEXICA4523', 'A member is named as a name is, a keyword among them', String(name), 'name');
        }

        if (!MEMBER_KINDS.includes(member.kind)) {
            fail('LEXICA4524', `A member is one of ${MEMBER_KINDS.join(', ')}`, name, 'kind');
        }

        LexicaModule.#validateKeys(member, [...MEMBER_KEYS, ...MEMBER_KEYS_BY_KIND[member.kind]], `A member of kind '${member.kind}'`, fail);

        const hasReceiver = member.target !== undefined;

        if (hasReceiver) {
            LexicaModule.#validateTarget(member, name, fail);
        }

        if (member.invokedBy !== undefined && !INVOKERS.includes(member.invokedBy)) {
            fail('LEXICA4525', `A function is invoked by one of ${INVOKERS.join(', ')}, the evaluator where it says none`, name, 'invokedBy');
        }

        const isHostCall = LexicaModule.isHostCall(member);

        // A host call's result is the type of each value its host supplies, and one that supplies none declares none.
        if (!(isHostCall && member.result === undefined) && !LexicaModule.#isTypeNotation(member.result)) {
            fail(member.result === undefined ? 'LEXICA4003' : 'LEXICA4512', isHostCall ? 'It declares the type of each value its host supplies, or none, where it supplies none' : 'It declares the type of its result', name, 'result');
        }

        const parameters = Array.isArray(member.parameters) ? member.parameters.map(parameter => LexicaModule.#defined(parameter)) : (member.parameters ?? []);

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

        if (isHostCall) {
            LexicaModule.#validateHostCall(member, parameters, name, fail);
        }

        LexicaModule.#validateSelections(member, parameters, name, fail);
        LexicaModule.#validateSyntax(member, parameters, hasReceiver, name, fail);

        if (MEMBER_KEYS_BY_KIND[member.kind].includes('updates') && !isHostCall) {
            if (member.updates === undefined) {
                fail('LEXICA4003', 'It declares its updates, how it changes and how it reads', name, 'updates');
            }

            LexicaModule.#validateUpdates(member, new Map(parameters.map(parameter => [parameter.name, parameter])), hasReceiver, name, fail);
        }

        LexicaModule.#validateImplementation(member, name, fail);

        const syntax = member.kind === 'property' ? {} : { syntax: 'function-call' };
        const argumentForm = member.syntax === 'indexer' ? { arguments: 'positional' } : {};
        const updates = member.updates === undefined ? {} : { updates: { observations: [], ...LexicaModule.#defined(member.updates) } };

        // A property is read with no arguments, so it keeps an empty list of parameters, which every member then has.
        return LexicaModule.#copyOf({ ...syntax, ...argumentForm, ...member, parameters, ...updates });
    }

    /**
     * Refuses what a host call cannot take: updates, since it is never evaluated; an implementation, since its host invokes it; the indexer syntax; and a parameter other than a value parameter, whose argument is prepared as a value its host keeps.
     */
    static #validateHostCall(member, parameters, name, fail) {
        if (member.updates !== undefined) {
            fail('LEXICA4030', 'Its host invokes it, and the evaluator never evaluates it, so it declares no updates', name, 'updates');
        }

        if (member.implementation !== undefined) {
            fail('LEXICA4030', 'Its host invokes it, so its module gives Lexica no implementation of it', name, 'implementation');
        }

        if (member.syntax === 'indexer') {
            fail('LEXICA4053', 'A host call is written as a function call, never as an indexer', name, 'syntax');
        }

        const unprepared = parameters.find(parameter => parameter.kind !== 'value');

        if (unprepared !== undefined) {
            fail('LEXICA4056', `A host call takes value parameters alone, each argument prepared as a value its host keeps, and '${unprepared.name}' is ${unprepared.kind === 'expression' ? 'an' : 'a'} ${unprepared.kind} parameter`, name, 'parameters');
        }
    }

    /**
     * Checks the fixed parameters a member takes: a function's one at most, which selects a type, whose result writes `@selected` where that type stands, as a member selecting none writes none.
     */
    static #validateSelections(member, parameters, name, fail) {
        const typeSelections = parameters.filter(parameter => parameter.fixed === true && parameter.selects === 'type');

        if (typeSelections.length > 1) {
            fail('LEXICA4009', `A function has one parameter at most that selects a type, since its result writes one @selected, and ${typeSelections.map(parameter => `'${parameter.name}'`).join(' and ')} each select one`, name, 'parameters');
        }

        if (typeSelections.length === 1 && !LexicaModule.#writesSelected(member.result)) {
            fail('LEXICA4529', `Its parameter '${typeSelections[0].name}' selects a type, so its result writes @selected where that type stands`, name, 'result');
        }

        if (typeSelections.length === 0 && LexicaModule.#writesSelected(member.result)) {
            fail('LEXICA4040', 'Its result writes @selected, and none of its parameters selects a type', name, 'result');
        }
    }

    /**
     * Checks how the member is written and the form its arguments take: a property is accessed and takes none, and any other member is a function call by default, whose arguments are positional, one for each parameter in order,
     * so none that is required follows one that is optional, or an options object; or an indexer, a function whose one key is its one parameter, a required value parameter, so its argument is positional. A member without a target has no receiver to index.
     */
    static #validateSyntax(member, parameters, hasReceiver, name, fail) {
        if (member.default !== undefined && member.syntax !== 'indexer') {
            fail('LEXICA4530', 'Only an indexer is the default of its receivers, which `[…]` invokes', name, 'default');
        }

        if (member.kind === 'property') {
            return;
        }

        if (member.syntax !== undefined && !SYNTAXES.includes(member.syntax)) {
            fail('LEXICA4531', `It is written as ${SYNTAXES.join(' or ')}`, name, 'syntax');
        }

        if (member.syntax === 'indexer') {
            const [parameter] = parameters;

            if (parameters.length !== 1 || parameter.kind !== 'value' || !parameter.required) {
                fail('LEXICA4020', 'An indexer is a function whose key is its one parameter, a required value parameter', name, 'syntax');
            }

            if (!hasReceiver) {
                fail('LEXICA4022', 'An indexer is written after its receiver, and a member without a target has none', name, 'syntax');
            }

            if (member.arguments !== undefined && member.arguments !== 'positional') {
                fail('LEXICA4532', "An indexer's key is its one argument, so its arguments are positional", name, 'arguments');
            }

            if (member.default !== undefined && typeof member.default !== 'boolean') {
                fail('LEXICA4533', 'It declares whether it is the default indexer of its receivers as a Boolean', name, 'default');
            }

            return;
        }

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
        LexicaModule.#validateKeys(parameter, PARAMETER_KEYS, 'A parameter', (code, message, declaration, field) => fail(code, message, declaration, field === undefined ? 'parameters' : `parameters.${field}`), memberName);

        const field = 'parameters';

        // A function is never null, so a function parameter declares no null policy.
        const declaresNulls = parameter?.kind === 'function' ? parameter.nulls === undefined : NULL_POLICIES.includes(parameter?.nulls);

        if (!Names.isIdentifier(parameter.name) || !PARAMETER_KINDS.includes(parameter.kind) || !declaresNulls || typeof parameter.required !== 'boolean') {
            fail(parameter.kind === 'function' && !declaresNulls ? 'LEXICA4054' : 'LEXICA4536', 'A parameter declares its name, its kind, whether it is required and how it handles null, which a function parameter leaves out', memberName, field);
        }

        if (!LexicaModule.#isTypeNotation(parameter.type)) {
            fail(parameter.type === undefined ? 'LEXICA4536' : 'LEXICA4512', `The parameter '${parameter.name}' declares a type`, memberName, field);
        }

        // A function parameter's contract declares the type of each argument the member calls the function with, in order, and, as its type, the type of the result it takes from it.
        if (parameter.kind === 'function') {
            if (!Array.isArray(parameter.parameters) || !parameter.parameters.every(type => LexicaModule.#isTypeNotation(type))) {
                fail(Array.isArray(parameter.parameters) ? 'LEXICA4512' : 'LEXICA4537', `The parameter '${parameter.name}' is a function that declares its parameters as a list of the types it is called with`, memberName, field);
            }

            if (!parameter.required) {
                fail('LEXICA4054', `The parameter '${parameter.name}' is a function, so it is required`, memberName, field);
            }

            if (parameter.fixed !== undefined) {
                fail('LEXICA4030', `The parameter '${parameter.name}' is a function, so it cannot be fixed`, memberName, field);
            }

            if (parameter.context !== undefined) {
                fail('LEXICA4030', `The parameter '${parameter.name}' is a function, so it declares no 'context'`, memberName, field);
            }
        } else if (parameter.parameters !== undefined) {
            fail('LEXICA4030', `The parameter '${parameter.name}' is no function, so it declares no parameters`, memberName, field);
        }

        if (parameter.required && 'default' in parameter) {
            fail('LEXICA4538', `The required parameter '${parameter.name}' declares no default`, memberName, field);
        }

        if ((parameter.kind === 'expression' || parameter.kind === 'predicate') && parameter.context !== 'item') {
            fail('LEXICA4539', `The ${parameter.kind} parameter '${parameter.name}' declares its implicit parameter as context: 'item'`, memberName, field);
        }

        // A predicate's expression gives any value, and its implementation receives that value's truthiness.
        if (parameter.kind === 'predicate' && parameter.type !== 'Boolean') {
            fail('LEXICA4540', `The predicate parameter '${parameter.name}' is of type boolean, the truthiness its implementation receives`, memberName, field);
        }

        if (parameter.fixed !== undefined && typeof parameter.fixed !== 'boolean') {
            fail('LEXICA4541', `The parameter '${parameter.name}' declares whether it is fixed as a Boolean`, memberName, field);
        }

        if (parameter.fixed !== true) {
            if (parameter.selects !== undefined || parameter.selector !== undefined) {
                fail('LEXICA4542', `The parameter '${parameter.name}' selects nothing, since it is not fixed`, memberName, field);
            }

            return;
        }

        if (!SELECTION_KINDS.includes(parameter.selects)) {
            const test = parameter.selects === 'predicate' ? '; a test of the receiver is passed as a function, to a function parameter' : '';

            fail('LEXICA4543', `The fixed parameter '${parameter.name}' declares what it selects, one of ${SELECTION_KINDS.join(', ')}${test}`, memberName, field);
        }

        // A type is selected through the type selector the parameter names.
        if (!Names.isIdentifier(parameter.selector)) {
            fail('LEXICA4544', `The fixed parameter '${parameter.name}' selects a type, so it names the type selector it selects through`, memberName, field);
        }

        // A fixed argument names a declaration, which only a string can.
        if (parameter.kind !== 'value' || parameter.type !== 'String') {
            fail('LEXICA4545', `The fixed parameter '${parameter.name}' is a value parameter of type string, since it names what it selects`, memberName, field);
        }
    }
}
