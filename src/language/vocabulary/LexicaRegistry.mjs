/**
 * LexicaRegistry — the declarations of every module registered with the registry, which requests resolve against
 */

import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaError } from '../LexicaError.mjs';
import { Type } from '../Type.mjs';
import { LexicaModule } from './LexicaModule.mjs';
import { Vocabulary } from './Vocabulary.mjs';

export class LexicaRegistry {
    /** @type {Map<string, import('./LexicaModule.mjs').LexicaModule>} */
    #modules = new Map();

    /** @type {Map<string, object[]>} */
    #members = new Map();

    /** @type {Map<string, object>} */
    #types = new Map();

    /** Each type selector, by its name. @type {Map<string, object>} */
    #typeSelectors = new Map();

    /** Each selector's keys, by the selector's name and then the key, each the selectable type a module declared. @type {Map<string, Map<string, object>>} */
    #selectableTypes = new Map();

    /** @type {Map<string, object>} */
    #observationTypes = new Map();

    /** Each predicate, by its name, a name naming one for each of the receivers it applies to. @type {Map<string, object[]>} */
    #predicates = new Map();

    /** Each conversion, by its source type and then its target. @type {Map<string, Map<string, object>>} */
    #conversions = new Map();

    /** @type {Map<object, string>} */
    #owners = new Map();

    /** @param {import('./LexicaModule.mjs').LexicaModule[]} modules The modules registered at the start. */
    constructor(modules = []) {
        modules.forEach(module => this.registerModule(module));
    }

    /** The number of modules registered, which changes whenever the vocabulary does. */
    get revision() {
        return this.#modules.size;
    }

    /** The names of the modules registered. */
    get moduleNames() {
        return [...this.#modules.keys()];
    }

    /** Registers a module's declarations, refusing a module whose names are taken or whose declarations break the registry's rules, before registering any of them. */
    registerModule(module) {
        if (!LexicaModule.isModule(module)) {
            throw LexicaError.module('A module is registered as createModule makes it', { module: String(module?.name) });
        }

        const fail = (message, declaration, field) => {
            throw LexicaError.module(message, { module: module.name, ...(declaration === undefined ? {} : { declaration }), ...(field === undefined ? {} : { field }) });
        };

        if (this.#modules.has(module.name)) {
            fail('A module is registered once, and this name is taken');
        }

        const ownTypes = new Set(module.types.map(type => type.name));

        for (const type of module.types) {
            if (this.#types.has(type.name)) {
                fail(`The type '${type.name}' is declared already`, type.name);
            }
        }

        LexicaRegistry.#checkTypeSelections(module, this.#typeSelectors, this.#selectableTypes, declaration => this.#owners.get(declaration), fail);

        for (const type of module.observationTypes) {
            if (this.#observationTypes.has(type.name)) {
                fail(`The observation type '${type.name}' is declared already`, type.name);
            }
        }

        const observationTypes = new Map([...this.#observationTypes, ...module.observationTypes.map(type => [type.name, type])]);

        // A target belongs to the module that declares the observation type observing it, this module's own types observing this module's own targets.
        const ownObservationTypes = new Set(module.observationTypes);
        const ownerOf = type => (ownObservationTypes.has(type) ? module : this.#modules.get(this.#owners.get(type)));

        // Every type a declaration names is one Lexica defines, one the module declares, wherever it declares it, or one a module registered before it declares.
        const types = new Map([...this.#types, ...module.types.map(type => [type.name, type])]);

        LexicaRegistry.#checkTypeNames(module, types, fail);

        for (const declaration of [...module.members, ...module.predicates]) {
            LexicaRegistry.#validateObservations(declaration, observationTypes, ownerOf, fail);
        }

        // A module declares members and predicates on any type, its own or another module's, by any name, and module members, which have no target, by any name its own module members do not take.
        module.predicates.forEach((predicate, index) => {
            this.#checkCollision(predicate, [...this.getPredicates(predicate.name), ...module.predicates.slice(0, index).filter(other => other.name === predicate.name)], fail, 'predicate');
        });

        module.members.forEach((declaration, index) => {
            const earlier = module.members.slice(0, index).filter(other => other.name === declaration.name);

            if (declaration.target === undefined) {
                if (earlier.some(other => other.target === undefined)) {
                    fail(`The module member '${declaration.name}' is declared already`, declaration.name, 'name');
                }

                return;
            }

            this.#checkCollision(declaration, [...this.getMembers(declaration.name), ...earlier], fail);

            // A receiver has one default indexer at most, so `:[…]` names one indexer for it.
            if (declaration.default === true) {
                for (const other of [...this.getDefaultIndexers(), ...module.members.slice(0, index).filter(member => member.default === true)]) {
                    const overlapping = [declaration.target].flat().find(mine => [other.target].flat().some(theirs => LexicaRegistry.#overlap(mine, theirs)));

                    if (overlapping !== undefined) {
                        fail(`'${other.name}' is the default indexer of ${overlapping} already`, declaration.name, 'default');
                    }
                }
            }
        });

        module.conversions.forEach((conversion, index) => {
            const name = LexicaModule.conversionNameOf(conversion);

            for (const typeName of [conversion.from, conversion.to]) {
                if (!LexicaRegistry.#isData(Type.createNamedType(typeName), types, new Set())) {
                    fail(`'${typeName}' is no type of data Lexica or a module registered with it declares, which a conversion converts between`, name);
                }
            }

            // A module converts to or from a type of its own; Lexica's own module alone converts between the language's types.
            if (module !== Vocabulary.module && !ownTypes.has(conversion.from) && !ownTypes.has(conversion.to)) {
                fail("A conversion converts to or from one of its module's own types", name);
            }

            // A conversion is declared once across the registry, whatever its module owns; types of data have no subtypes, so two sources overlap where they are one type.
            if (this.getConversion(conversion.from, conversion.to) !== undefined || module.conversions.slice(0, index).some(other => other.from === conversion.from && other.to === conversion.to)) {
                fail(`The conversion from ${conversion.from} to ${conversion.to} is declared already`, name);
            }
        });

        this.#modules.set(module.name, module);

        for (const type of module.types) {
            this.#types.set(type.name, type);
        }

        for (const selector of module.typeSelectors) {
            this.#typeSelectors.set(selector.name, selector);
            this.#selectableTypes.set(selector.name, new Map());
            this.#owners.set(selector, module.name);
        }

        for (const selectable of module.selectableTypes) {
            this.#selectableTypes.get(selectable.selector).set(selectable.name, selectable);
            this.#owners.set(selectable, module.name);
        }

        for (const type of module.observationTypes) {
            this.#observationTypes.set(type.name, type);
            this.#owners.set(type, module.name);
        }

        // A module member has no receiver, so no receiver's member of its name finds it.
        for (const declaration of module.members) {
            if (declaration.target !== undefined) {
                this.#members.set(declaration.name, [...this.getMembers(declaration.name), declaration]);
            }

            this.#owners.set(declaration, module.name);
        }

        for (const predicate of module.predicates) {
            this.#predicates.set(predicate.name, [...this.getPredicates(predicate.name), predicate]);
            this.#owners.set(predicate, module.name);
        }

        for (const conversion of module.conversions) {
            if (!this.#conversions.has(conversion.from)) {
                this.#conversions.set(conversion.from, new Map());
            }

            this.#conversions.get(conversion.from).set(conversion.to, conversion);
            this.#owners.set(conversion, module.name);
        }

        return this;
    }

    /** The members named so that receivers answer, across every module. */
    getMembers(name) {
        return this.#members.get(name) ?? [];
    }

    /** The predicates named so, across every module, each for the receivers it applies to. */
    getPredicates(name) {
        return this.#predicates.get(name) ?? [];
    }

    /** The names of every member declared, across every module. */
    get memberNames() {
        return [...this.#members.keys()];
    }

    /** The names of every predicate declared, across every module. */
    get predicateNames() {
        return [...this.#predicates.keys()];
    }

    /** The indexers declared the default of their receivers, across every module. */
    getDefaultIndexers() {
        return [...this.#members.values()].flat().filter(declaration => declaration.default === true);
    }

    /** The structured type declared so, or undefined. */
    getType(name) {
        return this.#types.get(name);
    }

    /** The type of each field named so, as its structured type declares it, across every structured type. */
    getFieldTypes(name) {
        return [...this.#types.values()].flatMap(type => (Object.hasOwn(type.fields, name) ? [type.fields[name]] : []));
    }

    /** The type selector declared so, or undefined. */
    getTypeSelector(name) {
        return this.#typeSelectors.get(name);
    }

    /** The selectable type the selector maps the key to, or undefined. */
    getSelectableType(selector, key) {
        return this.#selectableTypes.get(selector)?.get(key);
    }

    /** The type of observation declared so, or undefined. */
    getObservationType(name) {
        return this.#observationTypes.get(name);
    }

    /** The conversion declared from the one type to the other, or undefined. */
    getConversion(from, to) {
        return this.#conversions.get(from)?.get(to);
    }

    /** The types a value of the type converts to through a declared conversion. */
    getConversionTargets(from) {
        return [...(this.#conversions.get(from)?.keys() ?? [])];
    }

    /** Whether the type is one a conversion converts between: a type of data Lexica defines, or a structured type that holds data alone. */
    isConvertible(typeName) {
        return LexicaRegistry.#isData(Type.createNamedType(typeName), this.#types, new Set());
    }

    /** The name of the module that declared the member. */
    getOwner(declaration) {
        return this.#owners.get(declaration);
    }

    /** The implementation that carries the declaration out, or undefined where its module gives it none. */
    getImplementation(declaration) {
        return declaration.implementation;
    }

    /** Refuses a type notation in the module's declarations that names a type neither Lexica nor a module declares. */
    /**
     * Refuses a type selector named already, by this module or one registered before it; a key of a selector neither declares; a key its selector maps already, which is never replaced; and a parameter that selects a type
     * through a selector neither declares.
     */
    static #checkTypeSelections(module, typeSelectors, selectableTypes, ownerOf, fail) {
        for (const selector of module.typeSelectors) {
            if (typeSelectors.has(selector.name)) {
                fail(`The type selector '${selector.name}' is declared already, by the module '${ownerOf(typeSelectors.get(selector.name))}'`, selector.name, 'name');
            }
        }

        const isDeclared = name => typeSelectors.has(name) || module.typeSelectors.some(selector => selector.name === name);

        module.selectableTypes.forEach((selectable, index) => {
            if (!isDeclared(selectable.selector)) {
                fail(`The key '${selectable.name}' belongs to the type selector '${selectable.selector}', which no module registered declares`, selectable.name, 'selector');
            }

            const registered = selectableTypes.get(selectable.selector)?.get(selectable.name);
            const isDeclaredEarlier = module.selectableTypes.slice(0, index).some(other => other.selector === selectable.selector && other.name === selectable.name);

            if (registered !== undefined || isDeclaredEarlier) {
                fail(`The type selector '${selectable.selector}' maps the key '${selectable.name}' already, as the module '${registered === undefined ? module.name : ownerOf(registered)}' declared it, and a key is never replaced`, selectable.name, 'name');
            }
        });

        for (const declaration of module.members) {
            for (const parameter of declaration.parameters.filter(candidate => candidate.selects === 'type')) {
                if (!isDeclared(parameter.selector)) {
                    fail(`The parameter '${parameter.name}' selects a type through '${parameter.selector}', which no module registered declares`, declaration.name, 'parameters');
                }
            }
        }
    }

    static #checkTypeNames(module, types, fail) {
        const check = (notation, declarationName) => {
            for (const name of LexicaRegistry.#namedTypesOf(Type.parse(notation))) {
                if (!LexicaModule.builtInTypeNames.includes(name) && !types.has(name)) {
                    fail(`'${notation}' names the type '${name}', which neither Lexica nor a module registered with it declares`, declarationName);
                }
            }
        };

        for (const type of module.types) {
            Object.values(type.fields).forEach(notation => check(notation, type.name));
        }

        module.selectableTypes.forEach(selectable => check(selectable.type, selectable.name));

        for (const predicate of module.predicates) {
            [predicate.target].flat().filter(notation => notation !== 'any').forEach(notation => check(notation, predicate.name));
        }

        for (const declaration of module.members) {
            [declaration.target ?? []].flat().filter(notation => notation !== 'any').forEach(notation => check(notation, declaration.name));

            // A host call that supplies nothing declares no result.
            if (declaration.result !== undefined) {
                check(declaration.result, declaration.name);
            }

            // A tolerance applies to a numeric result, or to the numbers a structured result holds, which only now, every type known, is told apart from a reference type; a member with updates always declares a result.
            const resultType = declaration.updates?.tolerance === undefined ? null : Type.parse(declaration.result);

            if (resultType !== null && resultType.name !== 'number' && !types.has(resultType.name)) {
                fail('A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', declaration.name, 'updates.tolerance');
            }

            for (const parameter of declaration.parameters) {
                check(parameter.type, declaration.name);

                if (Object.hasOwn(parameter, 'default') && !LexicaRegistry.#admits(parameter.default, Type.parse(parameter.type), types)) {
                    fail(`The default of '${parameter.name}' is no ${parameter.type}`, declaration.name);
                }
            }
        }
    }

    /** The names of the named types a type holds, itself, its items and its fields included. */
    static #namedTypesOf(type) {
        switch (type.kind) {
            case 'named':
                return [type.name];
            case 'list':
                return LexicaRegistry.#namedTypesOf(type.itemType);
            case 'object':
                return [...type.fieldTypes.values()].flatMap(fieldType => LexicaRegistry.#namedTypesOf(fieldType));
            default:
                return [];
        }
    }

    /** Whether values of the type are data, a structured type's fields included; a structure already being checked counts as data where it holds itself, since its other fields are checked where it is first met. */
    static #isData(type, types, checking) {
        switch (type.kind) {
            case 'list':
                return LexicaRegistry.#isData(type.itemType, types, checking);
            case 'named': {
                if (LexicaModule.dataTypeNames.includes(type.name) || checking.has(type.name)) {
                    return true;
                }

                const structure = types.get(type.name);

                if (structure === undefined) {
                    return false;
                }

                checking.add(type.name);

                return Object.values(structure.fields).every(notation => LexicaRegistry.#isData(Type.parse(notation), types, checking));
            }
            default:
                return false;
        }
    }

    /** Whether the type admits a default: a value of data, its nullability, its items and a structure's fields as declared, and never a node. */
    static #admits(value, type, types) {
        if (value === null) {
            return type.isNullable;
        }

        switch (type.kind) {
            case 'typeParameter':
                return value !== undefined;
            case 'list':
                return Array.isArray(value) && value.every(item => LexicaRegistry.#admits(item, type.itemType, types));
            case 'named': {
                if (['number', 'string', 'boolean'].includes(type.name)) {
                    return typeof value === type.name;
                }

                const structure = types.get(type.name);

                return structure !== undefined && ObjectUtils.isNonArrayObject(value)
                    && Object.entries(structure.fields).every(([field, notation]) => LexicaRegistry.#admits(value[field], Type.parse(notation), types));
            }
            default:
                return false;
        }
    }

    /**
     * Refuses an observation of a type no module declares; one of a target its observation type's module declares none of, one of a target found from the receiver for a member without one,
     * and a maintained one of a target of several; and a member that reads maintained values without a maintained observation, or any other that has one.
     */
    static #validateObservations(declaration, observationTypes, ownerOf, fail) {
        const { updates } = declaration;

        if (updates === undefined) {
            return;
        }

        let hasMaintained = false;

        for (const observationDeclaration of updates.observations) {
            const type = observationTypes.get(observationDeclaration.type);

            if (type === undefined) {
                fail(`The observation type '${observationDeclaration.type}' is declared by no module`, declaration.name, 'updates.observations');
            }

            if (typeof observationDeclaration.of === 'string' && observationDeclaration.of !== 'receiver') {
                LexicaRegistry.#validateTarget(declaration, observationDeclaration, type, ownerOf(type), fail);
            }

            hasMaintained ||= type.contract === 'maintained';
        }

        if ((updates.reads === 'maintained') !== hasMaintained) {
            fail(updates.reads === 'maintained' ? 'It reads maintained values, so it names a maintained observation' : 'It names a maintained observation, so it reads maintained values', declaration.name, 'updates');
        }
    }

    /** Refuses a target its observation type's module does not declare, one found from the receiver for a member without one, and one of several for a maintained observation, which gives its member one sample. */
    static #validateTarget(declaration, observationDeclaration, type, owner, fail) {
        const target = owner.observationTargets.find(candidate => candidate.name === observationDeclaration.of);

        if (target === undefined) {
            fail(`The observation '${type.name}' observes '${observationDeclaration.of}', and the module '${owner.name}', which declares '${type.name}', declares no target of that name`, declaration.name, 'updates.observations');
        }

        if (target.from === 'receiver' && declaration.target === undefined) {
            fail(`The observation '${type.name}' observes '${target.name}', a target found from the receiver, and a member without a target has no receiver`, declaration.name, 'updates.observations');
        }

        if (type.contract === 'maintained' && target.count === 'many') {
            fail(`The maintained observation '${type.name}' gives one sample, so it observes one target, never '${target.name}', a target of several`, declaration.name, 'updates.observations');
        }
    }

    /** Refuses a member, or a predicate, that a registered one of its name already answers on one of the same receivers; a module member, which has no target, answers on none. */
    #checkCollision(declaration, others, fail, what = 'member') {
        for (const other of others.filter(candidate => candidate.target !== undefined)) {
            for (const mine of [declaration.target].flat()) {
                for (const theirs of [other.target].flat()) {
                    if (LexicaRegistry.#overlap(mine, theirs)) {
                        fail(`${what === 'predicate' ? 'The predicate ' : ''}'${declaration.name}' is declared already for ${theirs}`, declaration.name, 'target');
                    }
                }
            }
        }
    }

    static #overlap(first, second) {
        if (first === 'any' || second === 'any') {
            return true;
        }

        return Type.tryMatchType(Type.parse(first), Type.parse(second), new Map()) || Type.tryMatchType(Type.parse(second), Type.parse(first), new Map());
    }
}
