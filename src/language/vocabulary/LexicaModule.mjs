/**
 * LexicaModule — a vocabulary's declarations as data, each that runs code carrying its implementation
 */

import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaError } from '../LexicaError.mjs';
import { Names } from '../Names.mjs';
import { Type } from '../Type.mjs';

const MEMBER_KINDS = ['property', 'function', 'eventSource', 'action', 'behavior'];

/** How a member that is no property is written: a function call, `it.device("lamp")`, or a named indexer, `it:setting["mode"]`. */
const SYNTAXES = ['function-call', 'indexer'];

/** The form a member's arguments take: one for each parameter in order, or one object whose fields supply them. */
const ARGUMENT_FORMS = ['positional', 'options'];

/** How a member changes, as the specification's categories name it, `derived` for a contract that comes from the items and expression a member selects or evaluates. */
const CHANGE_CATEGORIES = ['constant', 'observable', 'partly-observable', 'unobserved', 'derived'];

/** How a member reads, as the specification's modes name it, `derived` for a contract that comes from the items and expression a member selects or evaluates. */
const READING_MODES = ['fresh', 'maintained', 'captured', 'derived'];
const NULL_POLICIES = ['propagate', 'accept'];
const SELECTION_KINDS = ['eventType', 'predicate'];
const PARAMETER_KINDS = ['value', 'expression', 'predicate', 'function'];

/** What an observation type provides: a signal that an answer may have changed, or a sampled value a member reads. */
const OBSERVATION_CONTRACTS = ['invalidation', 'maintained'];

/** The categories whose changes observations cover. */
const OBSERVED_CHANGE_CATEGORIES = ['observable', 'partly-observable'];

/** The names of the types Lexica defines, which a declaration names without any module declaring them. */
const BUILT_IN_TYPE_NAMES = ['number', 'string', 'boolean', 'node', 'element', 'document', 'documentFragment', 'shadowRoot', 'shadow', 'aria', 'window'];

/** The names of the types Lexica defines whose values hold no number, so a tolerance means nothing for them. */
const UNTOLERATED_TYPE_NAMES = new Set(BUILT_IN_TYPE_NAMES.filter(name => name !== 'number'));

/** The names no module declares a type by: those Lexica defines, and the words of the type notation. */
const RESERVED_TYPE_NAMES = new Set([...BUILT_IN_TYPE_NAMES, 'list', 'event', 'null', 'never']);

/** The types of data Lexica defines, which a conversion converts between, as it does between them and the structured types modules declare. */
const DATA_TYPE_NAMES = ['number', 'string', 'boolean'];

/** What a module can declare. */
const CONTENTS = ['types', 'members', 'predicates', 'eventTypes', 'observationTypes', 'observationTargets', 'conversions'];

/** The fields each member kind takes, beside those every member takes, so a field one does not take is refused rather than ignored. */
const MEMBER_KEYS = ['name', 'kind', 'target', 'result', 'implementation'];
const MEMBER_KEYS_BY_KIND = {
    property: ['updates'],
    function: ['syntax', 'arguments', 'default', 'parameters', 'updates'],
    eventSource: ['syntax', 'arguments', 'parameters', 'updates'],
    action: ['syntax', 'arguments', 'parameters'],
    behavior: ['syntax', 'arguments', 'parameters'],
};
const UPDATES_KEYS = ['changes', 'reads', 'misses', 'tolerance', 'observations'];
const PARAMETER_KEYS = ['name', 'kind', 'type', 'required', 'default', 'fixed', 'selects', 'nulls', 'context', 'omitted', 'parameters'];
const TYPE_KEYS = ['name', 'fields'];
const EVENT_TYPE_KEYS = ['name', 'data'];
const OBSERVATION_TYPE_KEYS = ['name', 'contract', 'identity', 'shared', 'implementation'];
const OBSERVATION_TARGET_KEYS = ['name', 'from', 'count'];
const PREDICATE_KEYS = ['name', 'target', 'verb', 'updates', 'implementation'];
const CONVERSION_KEYS = ['from', 'to', 'implementation'];

/** The verbs that ask a predicate, each its own kind of Boolean question: `is` a state, `has` a possession or a presence, and `supports` a capability. */
export const PREDICATE_VERBS = Object.freeze(['is', 'has', 'supports']);

/** How a predicate is named: words of letters and digits joined by hyphens, as `focus-within` is. */
const PREDICATE_NAME = /^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/;

export class LexicaModule {
    #name;
    #types;
    #members;
    #predicates;
    #eventTypes;
    #observationTypes;
    #observationTargets;
    #conversions;

    /**
     * @param {string} name The module's name.
     * @param {object} contents What the module declares, each declaration that runs code carrying its implementation.
     * @param {object[]} [contents.types] The structured types it declares, each with its fields.
     * @param {object[]} [contents.members] The properties, functions, event sources, actions and behaviors it adds, a member without a target a module member.
     * @param {object[]} [contents.predicates] The predicates it declares, each a Boolean of its receivers that its verb asks by its name.
     * @param {object[]} [contents.eventTypes] The event types it declares, each with the type of its event data.
     * @param {object[]} [contents.observationTypes] The types of observation it declares.
     * @param {object[]} [contents.observationTargets] The targets its observation types observe besides a receiver and an argument, each found from the receiver or independent of it, one target or several.
     * @param {object[]} [contents.conversions] The conversions it declares, each from a type of data to another.
     */
    constructor(name, contents = {}) {
        if (!Names.isName(name)) {
            throw LexicaError.module('A module is named as a name is', { module: String(name) });
        }

        const fail = (message, declaration, field) => {
            throw LexicaError.module(message, { module: name, ...(declaration === undefined ? {} : { declaration }), ...(field === undefined ? {} : { field }) });
        };

        if (!ObjectUtils.isNonArrayObject(contents)) {
            fail(`A module's contents are an object declaring ${CONTENTS.join(', ')}`);
        }

        for (const key of Object.keys(contents)) {
            if (!CONTENTS.includes(key)) {
                fail(`A module declares ${CONTENTS.join(', ')}, and '${key}' is none of them${key === 'conditions' ? '; a Boolean its verb asks by its name is a predicate' : ''}`, undefined, key);
            }
        }

        const { types = [], members = [], predicates = [], eventTypes = [], observationTypes = [], observationTargets = [], conversions = [] } = contents;

        for (const [key, list] of Object.entries({ types, members, predicates, eventTypes, observationTypes, observationTargets, conversions })) {
            if (!Array.isArray(list)) {
                fail(`A module's ${key} are a list`, undefined, key);
            }
        }

        this.#name = name;
        this.#types = LexicaModule.#freezeItems(types.map(type => LexicaModule.#validateTypeDeclaration(type, fail)));
        this.#members = LexicaModule.#freezeItems(members.map(member => LexicaModule.#validateMember(member, fail)));
        this.#predicates = LexicaModule.#freezeItems(predicates.map(predicate => LexicaModule.#validatePredicate(predicate, fail)));
        this.#eventTypes = LexicaModule.#freezeItems(eventTypes.map(eventType => LexicaModule.#validateEventType(eventType, fail)));
        this.#observationTypes = LexicaModule.#freezeItems(observationTypes.map(type => LexicaModule.#validateObservationType(type, fail)));
        this.#observationTargets = LexicaModule.#freezeItems(LexicaModule.#validateObservationTargets(observationTargets, fail));
        this.#conversions = LexicaModule.#freezeItems(conversions.map(conversion => LexicaModule.#validateConversion(conversion, fail)));
    }

    /** The module's name. */
    get name() {
        return this.#name;
    }

    /** The structured types the module declares. */
    get types() {
        return this.#types;
    }

    /** The members the module adds. */
    get members() {
        return this.#members;
    }

    /** The predicates the module declares. */
    get predicates() {
        return this.#predicates;
    }

    /** The event types the module declares. */
    get eventTypes() {
        return this.#eventTypes;
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

    /** How a conversion is named where a message names it: its source type and its target, as `string to number`. */
    static conversionNameOf(conversion) {
        return `${conversion.from} to ${conversion.to}`;
    }

    /** Whether the value is a module `createModule` made. */
    static isModule(value) {
        return value instanceof LexicaModule;
    }

    /** Whether the declaration is a verb, a member whose fixed argument selects the predicate that carries it out, so it has no implementation of its own. */
    static isVerb(declaration) {
        return declaration.parameters?.some(parameter => parameter.selects === 'predicate') === true;
    }

    /** The object without its fields that hold undefined, which a declaration leaves out as it leaves out a field it does not write. */
    static #defined(object) {
        return ObjectUtils.isNonArrayObject(object) ? Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) : object;
    }

    /** Refuses a declaration that is no object, or that declares a field its kind does not take, naming that field; a field holding undefined is one it leaves out. */
    static #validateKeys(declaration, keys, what, fail, name) {
        if (!ObjectUtils.isNonArrayObject(declaration)) {
            fail(`${what} is an object declaring ${keys.join(', ')}`, name === undefined ? undefined : String(name));
        }

        for (const key of Object.keys(LexicaModule.#defined(declaration))) {
            if (!keys.includes(key)) {
                fail(`${what} declares ${keys.join(', ')}, and '${key}' is none of them`, String(name ?? declaration.name), key);
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

    /** Refuses an implementation that is given and is no function. */
    static #validateImplementation(declaration, name, fail) {
        if (declaration.implementation !== undefined && typeof declaration.implementation !== 'function') {
            fail('Its implementation is a function', name, 'implementation');
        }
    }

    static #validateTypeDeclaration(type, fail) {
        LexicaModule.#validateKeys(type, TYPE_KEYS, 'A type', fail);

        if (!Names.isName(type?.name) || RESERVED_TYPE_NAMES.has(type.name)) {
            fail('A type is named as a name is and takes none of the built-in names', type?.name, 'name');
        }

        const fields = Object.entries(type.fields ?? {});

        if (fields.length === 0) {
            fail('A structured type declares at least one field', type.name, 'fields');
        }

        for (const [name, notation] of fields) {
            // A field of a structured type is read after a dot, so a keyword names one.
            if (!Names.isName(name) || !LexicaModule.#isTypeNotation(notation)) {
                fail(`The field '${name}' is not a name with a type`, type.name, 'fields');
            }
        }

        return LexicaModule.#copyOf(type);
    }

    static #validateEventType(eventType, fail) {
        LexicaModule.#validateKeys(eventType, EVENT_TYPE_KEYS, 'An event type', fail);

        if (typeof eventType?.name !== 'string' || !/^[A-Za-z][A-Za-z0-9:-]*$/.test(eventType.name) || !LexicaModule.#isTypeNotation(eventType.data)) {
            fail('An event type declares the name of the event and the type of its event data', eventType?.name, typeof eventType?.name === 'string' ? 'data' : 'name');
        }

        return LexicaModule.#copyOf(eventType);
    }

    /** Validates the types a member or a predicate applies to, which a module member has none of. */
    static #validateTarget(declaration, name, fail) {
        const targets = [declaration.target].flat();

        if (targets.length === 0 || targets.some(notation => notation !== 'any' && !LexicaModule.#isTypeNotation(notation))) {
            fail('It declares the types it applies to, a type, a list of types or any', name, 'target');
        }
    }

    /**
     * Validates how a member or a predicate changes and reads, the changes it misses, the tolerance it compares with and the observations that cover its changes, as one `updates` object.
     * @param {object} owner The declaration whose updates they are.
     * @param {Map<string, object>} parameters Its parameters by name, which an observation can give an argument of.
     * @param {boolean} hasReceiver Whether it has a receiver, which a module member has none of.
     */
    static #validateUpdates(owner, parameters, hasReceiver, name, fail) {
        const updates = LexicaModule.#defined(owner.updates);

        LexicaModule.#validateKeys(updates, UPDATES_KEYS, 'Its updates', (message, declaration, field) => fail(message, declaration, field === undefined ? 'updates' : `updates.${field}`), name);

        if (!CHANGE_CATEGORIES.includes(updates.changes) || !READING_MODES.includes(updates.reads)) {
            fail(`It declares how it changes, one of ${CHANGE_CATEGORIES.join(', ')}, and how it reads, one of ${READING_MODES.join(', ')}`, name, CHANGE_CATEGORIES.includes(updates.changes) ? 'updates.reads' : 'updates.changes');
        }

        if (updates.changes === 'partly-observable' && (typeof updates.misses !== 'string' || updates.misses === '')) {
            fail('A partly observable member states the changes it misses', name, 'updates.misses');
        }

        if (updates.changes !== 'partly-observable' && updates.misses !== undefined) {
            fail(`It changes as ${updates.changes}, so it misses no changes`, name, 'updates.misses');
        }

        if (updates.tolerance !== undefined) {
            if (!(Number.isFinite(updates.tolerance) && updates.tolerance >= 0)) {
                fail('Its tolerance is a number that is not negative', name, 'updates.tolerance');
            }

            if (!LexicaModule.#takesTolerance(owner.result)) {
                fail('A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', name, 'updates.tolerance');
            }
        }

        const observations = updates.observations ?? [];

        if (!Array.isArray(observations)) {
            fail('Its observations are a list', name, 'updates.observations');
        }

        if (OBSERVED_CHANGE_CATEGORIES.includes(updates.changes) && observations.length === 0) {
            fail(`It changes as ${updates.changes}, so it names the observations that cover its changes`, name, 'updates.observations');
        }

        if (!OBSERVED_CHANGE_CATEGORIES.includes(updates.changes) && observations.length > 0) {
            fail(`It changes as ${updates.changes}, so it names no observations`, name, 'updates.observations');
        }

        for (const observationDeclaration of observations) {
            LexicaModule.#validateObservation(observationDeclaration, parameters, hasReceiver, name, fail);
        }
    }

    /** Whether a tolerance means something for the result: a number, a nullable one, or a named type that may be a structure holding numbers, which the registry checks once every type is known. */
    static #takesTolerance(notation) {
        const type = Type.parse(notation);

        return type?.kind === 'named' && !UNTOLERATED_TYPE_NAMES.has(type.name);
    }

    /** Validates one observation a declaration names: its type, what it observes, which a module member's never a receiver is, and the arguments its type takes. */
    static #validateObservation(observationDeclaration, parameters, hasReceiver, name, fail) {
        const field = 'updates.observations';

        if (observationDeclaration === null || typeof observationDeclaration !== 'object' || !Names.isName(observationDeclaration.type)) {
            fail('An observation names its type as a name is', name, field);
        }

        // A function a member is given lasts as long as its invocation, so no observation, which outlives it, is given one.
        const functionArgument = Object.values(observationDeclaration).find(value => typeof value?.argument === 'string' && parameters.get(value.argument)?.kind === 'function');

        if (functionArgument !== undefined) {
            fail(`The observation '${observationDeclaration.type}' is given the parameter '${functionArgument.argument}', a function that lasts only while the member's invocation does`, name, field);
        }

        // A target is named as a name is, and whether its observation type's module declares it is the registry's to check, which knows every module.
        const isTarget = Names.isName(observationDeclaration.of) || LexicaModule.#isArgumentReference(observationDeclaration.of, parameters);

        if (!isTarget) {
            fail(`The observation '${observationDeclaration.type}' observes the receiver, an argument of the member or an observation target by its name, and not '${JSON.stringify(observationDeclaration.of)}'`, name, field);
        }

        if (!hasReceiver && observationDeclaration.of === 'receiver') {
            fail(`The observation '${observationDeclaration.type}' observes the receiver, and a member without a target has no receiver`, name, field);
        }

        for (const [key, value] of Object.entries(observationDeclaration)) {
            if (key !== 'type' && key !== 'of' && !LexicaModule.#isObservationValue(value, parameters)) {
                fail(`The observation '${observationDeclaration.type}' gives '${key}' a value that is no literal, list of literals or argument of the member, which a prefix, a string, is joined to only where its parameter is a value parameter of type string`, name, field);
            }
        }
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

        return parameter?.kind === 'value' && parameter.type === 'string';
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

            if (!Names.isName(target.name)) {
                fail('An observation target is named as a name is', String(target.name), 'name');
            }

            if (target.name === 'receiver') {
                fail("'receiver' names an observation's receiver, so no target is named by it", target.name, 'name');
            }

            if (names.has(target.name)) {
                fail(`The observation target '${target.name}' is declared twice`, target.name, 'name');
            }

            names.add(target.name);

            if (target.from !== undefined && target.from !== 'receiver') {
                fail("A target found from the receiver says from: 'receiver', and one independent of it leaves from out", target.name, 'from');
            }

            if (target.count !== undefined && target.count !== 'many') {
                fail("A target of several says count: 'many', and one target leaves count out", target.name, 'count');
            }

            return LexicaModule.#copyOf(target);
        });
    }

    static #validateObservationType(declared, fail) {
        const type = LexicaModule.#defined(declared);

        LexicaModule.#validateKeys(type, OBSERVATION_TYPE_KEYS, 'An observation type', fail);

        const identity = type?.identity ?? [];

        if (!Names.isName(type?.name) || !OBSERVATION_CONTRACTS.includes(type.contract)) {
            fail(`An observation type is named as a name is and is one of ${OBSERVATION_CONTRACTS.join(', ')}`, String(type?.name), Names.isName(type?.name) ? 'contract' : 'name');
        }

        if (!Array.isArray(identity) || !identity.every(argument => LexicaModule.#isIdentifier(argument))) {
            fail('It names the arguments that belong to the identity of an observation, as identifiers', type.name, 'identity');
        }

        if (type.shared !== undefined && typeof type.shared !== 'boolean') {
            fail('It declares whether observations are shared, as a Boolean', type.name, 'shared');
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
            const typeName = conversion[key];

            if (!Names.isName(typeName) || (RESERVED_TYPE_NAMES.has(typeName) && !DATA_TYPE_NAMES.includes(typeName))) {
                fail(`A conversion is from a type of data to another, each named as it is declared: ${DATA_TYPE_NAMES.join(', ')} or a structured type, and its '${key}' is none of them`, name, key);
            }
        }

        if (conversion.from === conversion.to) {
            fail('A value already of a type converts to itself, so no conversion is declared from a type to itself', name, 'to');
        }

        LexicaModule.#validateImplementation(conversion, name, fail);

        return LexicaModule.#copyOf(conversion);
    }

    /**
     * Validates a predicate: its name, the types it applies to, which it always names, the verb that asks it, its updates, as a member's, and its implementation, which answers a Boolean.
     * A predicate takes no argument, so an observation names no argument of it.
     */
    static #validatePredicate(declared, fail) {
        const predicate = LexicaModule.#defined(declared);

        LexicaModule.#validateKeys(predicate, PREDICATE_KEYS, 'A predicate', fail);

        const name = predicate.name;

        if (typeof name !== 'string' || !PREDICATE_NAME.test(name)) {
            fail('A predicate is named by words of letters and digits joined by hyphens, as focus-within is', String(name), 'name');
        }

        if (predicate.target === undefined) {
            fail('A predicate is a question of its receiver, so it declares the types it applies to', name, 'target');
        }

        LexicaModule.#validateTarget(predicate, name, fail);

        if (predicate.verb !== undefined && !PREDICATE_VERBS.includes(predicate.verb)) {
            fail(`A predicate is asked by one verb, ${PREDICATE_VERBS.join(', ')}, is where it declares none`, name, 'verb');
        }

        if (predicate.updates === undefined) {
            fail('It declares its updates, how it changes and how it reads', name, 'updates');
        }

        LexicaModule.#validateUpdates({ ...predicate, result: 'boolean' }, new Map(), true, name, fail);

        // A predicate is a Boolean of its receiver, read as it is or kept by an observation; it selects no items and captures no event.
        if (predicate.updates.changes === 'derived' || (predicate.updates.reads !== 'fresh' && predicate.updates.reads !== 'maintained')) {
            fail('A predicate changes as constant, observable, partly-observable or unobserved, and reads fresh or maintained', name, 'updates');
        }

        LexicaModule.#validateImplementation(predicate, name, fail);

        return LexicaModule.#copyOf({ verb: 'is', ...predicate, updates: { observations: [], ...LexicaModule.#defined(predicate.updates) } });
    }

    static #validateMember(declared, fail) {
        const member = LexicaModule.#defined(declared);

        if (!ObjectUtils.isNonArrayObject(member)) {
            fail(`A member is an object declaring ${MEMBER_KEYS.join(', ')} and what its kind takes`);
        }

        const name = member.name;

        // A member is read after a dot or, an indexer, after a colon, where only a member's name stands, so a keyword names one.
        if (!Names.isName(name)) {
            fail('A member is named as a name is, a keyword among them', String(name), 'name');
        }

        if (!MEMBER_KINDS.includes(member.kind)) {
            fail(`A member is one of ${MEMBER_KINDS.join(', ')}`, name, 'kind');
        }

        LexicaModule.#validateKeys(member, [...MEMBER_KEYS, ...MEMBER_KEYS_BY_KIND[member.kind]], `A member of kind '${member.kind}'`, fail);

        const hasReceiver = member.target !== undefined;

        if (hasReceiver) {
            LexicaModule.#validateTarget(member, name, fail);
        }

        if (!LexicaModule.#isTypeNotation(member.result)) {
            fail('It declares the type of its result', name, 'result');
        }

        if (member.kind === 'eventSource' && Type.parse(member.result).kind !== 'event') {
            fail('An event source delivers events, so its result is an event<…>', name, 'result');
        }

        const parameters = Array.isArray(member.parameters) ? member.parameters.map(parameter => LexicaModule.#defined(parameter)) : (member.parameters ?? []);

        if (!Array.isArray(parameters)) {
            fail('Its parameters are a list', name, 'parameters');
        }

        const parameterNames = new Set();

        for (const parameter of parameters) {
            LexicaModule.#validateParameter(parameter, name, fail);

            // Only a member of kind `function` calls what it is given while its own invocation lasts.
            if (parameter.kind === 'function' && member.kind !== 'function') {
                fail(`The parameter '${parameter.name}' belongs to a member of kind 'function', which calls it while its own invocation lasts`, name, 'parameters');
            }

            if (parameterNames.has(parameter.name)) {
                fail(`The parameter '${parameter.name}' is declared twice`, name, 'parameters');
            }

            parameterNames.add(parameter.name);
        }

        LexicaModule.#validateSelections(member, parameters, name, fail);
        LexicaModule.#validateSyntax(member, parameters, hasReceiver, name, fail);

        if (MEMBER_KEYS_BY_KIND[member.kind].includes('updates')) {
            if (member.updates === undefined) {
                fail('It declares its updates, how it changes and how it reads', name, 'updates');
            }

            LexicaModule.#validateUpdates(member, new Map(parameters.map(parameter => [parameter.name, parameter])), hasReceiver, name, fail);

            if (member.kind === 'eventSource' && member.updates.reads !== 'captured') {
                fail('An event source captures each event as it happens, so it reads captured', name, 'updates.reads');
            }
        }

        if (LexicaModule.isVerb(member) && member.implementation !== undefined) {
            fail('It selects a predicate, which carries it out, so it has no implementation of its own', name, 'implementation');
        }

        LexicaModule.#validateImplementation(member, name, fail);

        const syntax = member.kind === 'property' ? {} : { syntax: 'function-call' };
        const argumentForm = member.syntax === 'indexer' ? { arguments: 'positional' } : {};
        const updates = member.updates === undefined ? {} : { updates: { observations: [], ...LexicaModule.#defined(member.updates) } };

        // A property is read with no arguments, so it keeps an empty list of parameters, which every member then has.
        return LexicaModule.#copyOf({ ...syntax, ...argumentForm, ...member, parameters, ...updates });
    }

    /** Checks the fixed parameters a member's kind allows: an event source's one designated parameter that selects its event type, and a verb's one that selects the predicate it asks. */
    static #validateSelections(member, parameters, name, fail) {
        const selecting = parameters.filter(parameter => parameter.fixed === true);
        const eventTypeSelections = selecting.filter(parameter => parameter.selects === 'eventType');
        const predicateSelections = selecting.filter(parameter => parameter.selects === 'predicate');

        if (member.kind === 'eventSource' && (eventTypeSelections.length !== 1 || selecting.length !== 1)) {
            fail('An event source designates one fixed parameter that selects its event type, and its other parameters select nothing', name, 'parameters');
        }

        if (member.kind !== 'eventSource' && eventTypeSelections.length > 0) {
            fail('Only an event source has a parameter that selects an event type', name, 'parameters');
        }

        if (predicateSelections.length > 0) {
            if (!PREDICATE_VERBS.includes(name) || member.kind !== 'function' || selecting.length !== 1) {
                fail(`A parameter that selects a predicate belongs to one of the verbs that ask one, ${PREDICATE_VERBS.join(', ')}`, name, 'parameters');
            }

            if (member.updates?.changes !== 'derived' || member.updates?.reads !== 'derived') {
                fail('It selects a predicate, which carries it out, so it changes and reads as derived', name, 'updates');
            }
        }
    }

    /**
     * Checks how the member is written and the form its arguments take: a property is accessed and takes none, and any other member is a function call by default, whose arguments are positional, one for each parameter in order,
     * so none that is required follows one that is optional, or an options object; or an indexer, a function whose one key is its one parameter, a required value parameter, so its argument is positional. A member without a target has no receiver to index.
     */
    static #validateSyntax(member, parameters, hasReceiver, name, fail) {
        if (member.default !== undefined && member.syntax !== 'indexer') {
            fail('Only an indexer is the default of its receivers, which `:[…]` invokes', name, 'default');
        }

        if (member.kind === 'property') {
            return;
        }

        if (member.syntax !== undefined && !SYNTAXES.includes(member.syntax)) {
            fail(`It is written as ${SYNTAXES.join(' or ')}`, name, 'syntax');
        }

        if (member.syntax === 'indexer') {
            const [parameter] = parameters;

            if (member.kind !== 'function' || parameters.length !== 1 || parameter.kind !== 'value' || !parameter.required) {
                fail('An indexer is a function whose key is its one parameter, a required value parameter', name, 'syntax');
            }

            if (!hasReceiver) {
                fail('An indexer is written after its receiver, and a member without a target has none', name, 'syntax');
            }

            if (member.arguments !== undefined && member.arguments !== 'positional') {
                fail("An indexer's key is its one argument, so its arguments are positional", name, 'arguments');
            }

            if (member.default !== undefined && typeof member.default !== 'boolean') {
                fail('It declares whether it is the default indexer of its receivers as a Boolean', name, 'default');
            }

            return;
        }

        if (parameters.length === 0) {
            if (member.arguments !== undefined) {
                fail('It has no parameters, so it declares no form of its arguments', name, 'arguments');
            }

            return;
        }

        if (!ARGUMENT_FORMS.includes(member.arguments)) {
            fail(`It has parameters, so it declares the form of its arguments, ${ARGUMENT_FORMS.join(' or ')}`, name, 'arguments');
        }

        // Arguments supply positional parameters in order, so one left out is one after the last given, which only an optional parameter can be.
        const firstOptional = parameters.findIndex(parameter => !parameter.required);
        const lateRequired = firstOptional === -1 ? undefined : parameters.slice(firstOptional).find(parameter => parameter.required);

        if (member.arguments === 'positional' && lateRequired !== undefined) {
            fail(`The required parameter '${lateRequired.name}' follows an optional one, and positional arguments supply parameters in order`, name, 'parameters');
        }
    }

    static #validateParameter(parameter, memberName, fail) {
        LexicaModule.#validateKeys(parameter, PARAMETER_KEYS, 'A parameter', (message, declaration, field) => fail(message, declaration, field === undefined ? 'parameters' : `parameters.${field}`), memberName);

        const field = 'parameters';

        // A function is never null, so a function parameter declares no null policy.
        const declaresNulls = parameter?.kind === 'function' ? parameter.nulls === undefined : NULL_POLICIES.includes(parameter?.nulls);

        if (!Names.isName(parameter.name) || !PARAMETER_KINDS.includes(parameter.kind) || !declaresNulls || typeof parameter.required !== 'boolean') {
            fail('A parameter declares its name, its kind, whether it is required and how it handles null, which a function parameter leaves out', memberName, field);
        }

        if (!LexicaModule.#isTypeNotation(parameter.type)) {
            fail(`The parameter '${parameter.name}' declares a type`, memberName, field);
        }

        // A function parameter's contract declares the type of each argument the member calls the function with, in order, and, as its type, the type of the result it takes from it.
        if (parameter.kind === 'function') {
            if (!Array.isArray(parameter.parameters) || !parameter.parameters.every(type => LexicaModule.#isTypeNotation(type))) {
                fail(`The parameter '${parameter.name}' is a function that declares its parameters as a list of the types it is called with`, memberName, field);
            }

            if (!parameter.required) {
                fail(`The parameter '${parameter.name}' is a function, so it is required`, memberName, field);
            }

            if (parameter.fixed !== undefined) {
                fail(`The parameter '${parameter.name}' is a function, so it cannot be fixed`, memberName, field);
            }

            if (parameter.context !== undefined) {
                fail(`The parameter '${parameter.name}' is a function, so it declares no 'context'`, memberName, field);
            }
        } else if (parameter.parameters !== undefined) {
            fail(`The parameter '${parameter.name}' is no function, so it declares no parameters`, memberName, field);
        }

        if (parameter.required && 'default' in parameter) {
            fail(`The required parameter '${parameter.name}' declares no default`, memberName, field);
        }

        if ((parameter.kind === 'expression' || parameter.kind === 'predicate') && parameter.context !== 'item') {
            fail(`The ${parameter.kind} parameter '${parameter.name}' declares its implicit parameter as context: 'item'`, memberName, field);
        }

        // A predicate's expression gives any value, and its implementation receives that value's truthiness.
        if (parameter.kind === 'predicate' && parameter.type !== 'boolean') {
            fail(`The predicate parameter '${parameter.name}' is of type boolean, the truthiness its implementation receives`, memberName, field);
        }

        if (parameter.fixed !== undefined && typeof parameter.fixed !== 'boolean') {
            fail(`The parameter '${parameter.name}' declares whether it is fixed as a Boolean`, memberName, field);
        }

        if (parameter.fixed !== true) {
            if (parameter.selects !== undefined) {
                fail(`The parameter '${parameter.name}' selects nothing, since it is not fixed`, memberName, field);
            }

            return;
        }

        if (!SELECTION_KINDS.includes(parameter.selects)) {
            fail(`The fixed parameter '${parameter.name}' declares what it selects, one of ${SELECTION_KINDS.join(', ')}`, memberName, field);
        }

        // A fixed argument names a declaration, which only a string can.
        if (parameter.kind !== 'value' || parameter.type !== 'string') {
            fail(`The fixed parameter '${parameter.name}' is a value parameter of type string, since it names what it selects`, memberName, field);
        }
    }
}
