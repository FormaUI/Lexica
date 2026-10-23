/**
 * LexicaRegistry — the declarations of every module registered with the registry, which requests resolve against
 */

import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaError } from '../LexicaError.mjs';
import { Names } from '../Names.mjs';
import { Type } from '../Type.mjs';
import { LexicaModule } from './LexicaModule.mjs';
import { Vocabulary } from './Vocabulary.mjs';

export class LexicaRegistry {
    /** @type {Map<string, import('./LexicaModule.mjs').LexicaModule>} */
    #modules = new Map();

    /** @type {Map<string, object[]>} */
    #members = new Map();

    /** Each structured type, by its identity, its module's name and its local name. @type {Map<string, object>} */
    #types = new Map();

    /** Each type selector, by its name. @type {Map<string, object>} */
    #typeSelectors = new Map();

    /** Each selector's keys, by the selector's name and then the key, each the selectable type a module declared. @type {Map<string, Map<string, object>>} */
    #selectableTypes = new Map();

    /** @type {Map<string, object>} */
    #observationTypes = new Map();

    /** Each conversion, by the identity of its source type and then of its target. @type {Map<string, Map<string, object>>} */
    #conversions = new Map();

    /** @type {Map<object, string>} */
    #owners = new Map();

    /** What each declaration's notations are read in: the module that declares it, and the modules a structured type imports. @type {WeakMap<object, object>} */
    #contexts = new WeakMap();

    /** The type each notation of a declaration writes, every name in it resolved to its identity, by the declaration and then the notation. @type {WeakMap<object, Map<string, Type>>} */
    #declaredTypes = new WeakMap();

    /** The module being registered, its name and the names of its types, which its own declarations name before it is registered; null between registrations. */
    #pending = null;

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

    /** The names of the modules whose namespaces text read with the registry reaches: every module registered but Lexica's own, which has no namespace. */
    get namespaceNames() {
        return [...this.#modules.values()].filter(module => module !== Vocabulary.module).map(module => module.name);
    }

    /** Registers a module's declarations, refusing a module whose names are taken or whose declarations break the registry's rules, before registering any of them. */
    registerModule(module) {
        if (!LexicaModule.isModule(module)) {
            throw LexicaError.module('LEXICA4546', 'A module is registered as createModule makes it', { module: String(module?.name) });
        }

        const fail = (code, message, declaration, field) => {
            throw LexicaError.module(code, message, { module: module.name, ...(declaration === undefined ? {} : { declaration }), ...(field === undefined ? {} : { field }) });
        };

        if (this.#modules.has(module.name)) {
            fail('LEXICA4035', 'A module is registered once, and this name is taken');
        }

        // A module's name begins its namespace in the registry's text, which a word the language reserves already means something in.
        if (Names.isReservedWord(module.name)) {
            fail('LEXICA4036', `'${module.name}' is a word the language reserves, and names no module`);
        }

        // A type is named once within its module, and two modules may each declare a type of one name, since its module is part of its identity.
        const ownTypes = new Set();

        for (const type of module.types) {
            if (ownTypes.has(type.name)) {
                fail('LEXICA4033', `The type '${type.name}' is declared already`, type.name);
            }

            ownTypes.add(type.name);

            for (const moduleName of type.import ?? []) {
                if (!this.#modules.has(moduleName)) {
                    fail('LEXICA4015', `The type imports the module '${moduleName}', which is not registered`, type.name, 'import');
                }
            }
        }

        LexicaRegistry.#checkTypeSelections(module, this.#typeSelectors, this.#selectableTypes, declaration => this.#owners.get(declaration), fail);

        for (const type of module.observationTypes) {
            if (this.#observationTypes.has(type.name)) {
                fail('LEXICA4007', `The observation type '${type.name}' is declared already`, type.name);
            }
        }

        const observationTypes = new Map([...this.#observationTypes, ...module.observationTypes.map(type => [type.name, type])]);

        // A target belongs to the module that declares the observation type observing it, this module's own types observing this module's own targets.
        const ownObservationTypes = new Set(module.observationTypes);
        const ownerOf = type => (ownObservationTypes.has(type) ? module : this.#modules.get(this.#owners.get(type)));

        // Every declaration's notations are read in its module: its own types, Lexica's, and those of a module a structured type imports, unqualified, and any other qualified by its module.
        for (const type of module.types) {
            this.#contexts.set(type, { module: module.name, imports: type.import ?? [] });
        }

        for (const declaration of [...module.members, ...module.selectableTypes, ...module.conversions]) {
            this.#contexts.set(declaration, { module: module.name, imports: [] });
        }

        this.#pending = { name: module.name, typeNames: ownTypes, types: new Map(module.types.map(type => [`${module.name}.${type.name}`, type])) };

        try {
            this.#checkTypeNames(module, fail);

            for (const declaration of module.members) {
                LexicaRegistry.#validateObservations(declaration, observationTypes, ownerOf, fail);
            }

            this.#checkMembers(module, fail);
            this.#checkConversions(module, fail);
        } finally {
            this.#pending = null;
        }

        this.#modules.set(module.name, module);

        for (const type of module.types) {
            this.#types.set(`${module.name}.${type.name}`, type);
            this.#owners.set(type, module.name);
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

        for (const conversion of module.conversions) {
            const from = this.getDeclaredType(conversion, conversion.from).identity;

            if (!this.#conversions.has(from)) {
                this.#conversions.set(from, new Map());
            }

            this.#conversions.get(from).set(this.getDeclaredType(conversion, conversion.to).identity, conversion);
            this.#owners.set(conversion, module.name);
        }

        return this;
    }

    /** The members named so that receivers answer, across every module. */
    getMembers(name) {
        return this.#members.get(name) ?? [];
    }

    /** The names of every member declared, across every module. */
    get memberNames() {
        return [...this.#members.keys()];
    }

    /** The module registered under the name, or undefined. */
    getModule(name) {
        return this.#modules.get(name);
    }

    /** The indexers declared the default of their receivers, across every module. */
    getDefaultIndexers() {
        return [...this.#members.values()].flat().filter(declaration => declaration.default === true);
    }

    /**
     * The type the notation writes in the declaration, a member, one of its parameters' notations among them, a structured type, a selectable type or a conversion: each name resolved to its identity in the module
     * that declares it.
     */
    getDeclaredType(declaration, text) {
        return this.#declaredTypeOf(declaration, text, (code, message) => {
            throw LexicaError.module(code, message, { module: this.#contexts.get(declaration).module });
        });
    }

    /** The type the notation writes in the declaration, kept once it is resolved, a failure to resolve it refused through the function given. */
    #declaredTypeOf(declaration, text, fail) {
        let types = this.#declaredTypes.get(declaration);

        if (types === undefined) {
            types = new Map();
            this.#declaredTypes.set(declaration, types);
        }

        if (!types.has(text)) {
            types.set(text, this.#resolveNotation(text, this.#contexts.get(declaration), fail));
        }

        return types.get(text);
    }

    /** The types the member applies to, in the order it declares them: each a type, a type parameter for a receiver of any type, or 'any'. */
    getTargetTypes(declaration) {
        return [declaration.target].flat().map(notation => (notation === 'any' ? notation : this.getDeclaredType(declaration, notation)));
    }

    /** The structured type the named type is, or undefined for a type no module declares as one. */
    getStructure(type) {
        if (type.kind !== 'named' || type.module === null) {
            return undefined;
        }

        return this.#types.get(type.identity) ?? this.#pending?.types.get(type.identity);
    }

    /** The fields of the structured type, in order, each with its type. @returns {[string, Type][]} */
    getFieldTypesOf(structure) {
        return Object.entries(structure.fields).map(([name, text]) => [name, this.getDeclaredType(structure, text)]);
    }

    /** The type of each field named so, as its structured type declares it, across every structured type. */
    getFieldTypes(name) {
        return [...this.#types.values()].flatMap(type => (Object.hasOwn(type.fields, name) ? [this.getDeclaredType(type, type.fields[name])] : []));
    }

    /** The names of the registered modules that declare a type of the local name, in the order they were registered. */
    getModulesDeclaringType(name) {
        return [...this.#modules.keys()].filter(moduleName => this.#types.has(`${moduleName}.${name}`));
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
        return this.#conversions.get(from.identity)?.get(to.identity);
    }

    /** The types a value of the type converts to through a declared conversion. */
    getConversionTargets(from) {
        return [...(this.#conversions.get(from.identity)?.values() ?? [])].map(conversion => this.getDeclaredType(conversion, conversion.to));
    }

    /** Whether the type is one a conversion converts between: a type of data Lexica defines, or a structured type that holds data alone, never null. */
    isConvertible(type) {
        return type.kind === 'named' && !type.isNullable && this.#isData(type, new Set());
    }

    /** The name of the module that declared the member. */
    getOwner(declaration) {
        return this.#owners.get(declaration);
    }

    /** The implementation that carries the declaration out, or undefined where its module gives it none. */
    getImplementation(declaration) {
        return declaration.implementation;
    }

    /** Whether the module, registered or being registered, declares a type of the local name. */
    #declaresType(moduleName, name) {
        return this.#types.has(`${moduleName}.${name}`) || (this.#pending?.name === moduleName && this.#pending.typeNames.has(name));
    }

    /**
     * The type the notation writes in its context, each name resolved to its identity: a qualified name to the type its module declares; an unqualified one to a type of the declaring module, one of Lexica's own types,
     * or the one type of its name among the modules a structured type imports, refusing one that several imported modules declare and one outside them, which is named qualified.
     */
    #resolveNotation(text, context, fail) {
        const resolve = type => {
            switch (type.kind) {
                case 'list':
                    return Type.createListType(resolve(type.itemType), type.isNullable);
                case 'object':
                    return Type.createObjectType(new Map([...type.fieldTypes].map(([name, fieldType]) => [name, resolve(fieldType)])), type.isNullable);
                case 'named':
                    return Type.createNamedType(type.name, type.isNullable, this.#moduleOfType(type, text, context, fail));
                default:
                    return type;
            }
        };

        return resolve(Type.parse(text));
    }

    /** The name of the module that declares the named type, null for one of Lexica's own types, as its context resolves it. */
    #moduleOfType(type, text, context, fail) {
        const { name } = type;

        if (type.module !== null) {
            if (!this.#modules.has(type.module) && this.#pending?.name !== type.module) {
                fail('LEXICA4047', `'${text}' names the type '${type.identity}', and no module named '${type.module}' is registered`);
            }

            if (!this.#declaresType(type.module, name)) {
                fail('LEXICA4047', `'${text}' names the type '${type.identity}', which the module '${type.module}' does not declare`);
            }

            return type.module;
        }

        if (this.#declaresType(context.module, name)) {
            return context.module;
        }

        if (LexicaModule.builtInTypeNames.includes(name)) {
            return null;
        }

        const imported = context.imports.filter(moduleName => this.#declaresType(moduleName, name));

        if (imported.length > 1) {
            fail('LEXICA4048', `'${text}' names the type '${name}', which the modules it imports each declare, so it is named qualified: ${imported.map(moduleName => `${moduleName}.${name}`).join(' or ')}`);
        }

        if (imported.length === 1) {
            return imported[0];
        }

        const foreign = this.getModulesDeclaringType(name);

        if (foreign.length > 0) {
            fail('LEXICA4049', `'${text}' names the type '${name}', which only another module declares, so it is named qualified: ${foreign.map(moduleName => `${moduleName}.${name}`).join(' or ')}`);
        }

        fail('LEXICA4047', `'${text}' names the type '${name}', which neither Lexica nor a module registered with it declares`);
    }

    /**
     * Refuses a type selector named already, by this module or one registered before it; a key of a selector neither declares; a key its selector maps already, which is never replaced; and a parameter that selects a type
     * through a selector neither declares.
     */
    static #checkTypeSelections(module, typeSelectors, selectableTypes, ownerOf, fail) {
        for (const selector of module.typeSelectors) {
            if (typeSelectors.has(selector.name)) {
                fail('LEXICA4007', `The type selector '${selector.name}' is declared already, by the module '${ownerOf(typeSelectors.get(selector.name))}'`, selector.name, 'name');
            }
        }

        const isDeclared = name => typeSelectors.has(name) || module.typeSelectors.some(selector => selector.name === name);

        module.selectableTypes.forEach((selectable, index) => {
            if (!isDeclared(selectable.selector)) {
                fail('LEXICA4039', `The key '${selectable.name}' belongs to the type selector '${selectable.selector}', which no module registered declares`, selectable.name, 'selector');
            }

            const registered = selectableTypes.get(selectable.selector)?.get(selectable.name);
            const isDeclaredEarlier = module.selectableTypes.slice(0, index).some(other => other.selector === selectable.selector && other.name === selectable.name);

            if (registered !== undefined || isDeclaredEarlier) {
                fail('LEXICA4038', `The type selector '${selectable.selector}' maps the key '${selectable.name}' already, as the module '${registered === undefined ? module.name : ownerOf(registered)}' declared it, and a key is never replaced`, selectable.name, 'name');
            }
        });

        for (const declaration of module.members) {
            for (const parameter of declaration.parameters.filter(candidate => candidate.selects === 'type')) {
                if (!isDeclared(parameter.selector)) {
                    fail('LEXICA4547', `The parameter '${parameter.name}' selects a type through '${parameter.selector}', which no module registered declares`, declaration.name, 'parameters');
                }
            }
        }
    }

    /** Refuses a notation in the module's declarations that names no type it can reach, a tolerance on a result that holds no number, and a default its parameter's type does not admit. */
    #checkTypeNames(module, fail) {
        const check = (declaration, notation, declarationName) => this.#declaredTypeOf(declaration, notation, (code, message) => fail(code, message, declarationName));

        for (const type of module.types) {
            Object.values(type.fields).forEach(notation => check(type, notation, type.name));
        }

        module.selectableTypes.forEach(selectable => check(selectable, selectable.type, selectable.name));

        for (const declaration of module.members) {
            [declaration.target ?? []].flat().filter(notation => notation !== 'any').forEach(notation => check(declaration, notation, declaration.name));

            // A host call that supplies nothing declares no result.
            const resultType = declaration.result === undefined ? null : check(declaration, declaration.result, declaration.name);

            // A tolerance applies to a numeric result, or to the numbers a structured result holds, which only now, every type known, is told apart from a reference type; a member with updates always declares a result.
            if (declaration.updates?.tolerance !== undefined && !(resultType.kind === 'named' && ((resultType.module === null && resultType.name === 'Number') || this.getStructure(resultType) !== undefined))) {
                fail('LEXICA4026', 'A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', declaration.name, 'updates.tolerance');
            }

            for (const parameter of declaration.parameters) {
                const type = check(declaration, parameter.type, declaration.name);

                (parameter.parameters ?? []).forEach(notation => check(declaration, notation, declaration.name));

                if (Object.hasOwn(parameter, 'default') && !this.#admits(parameter.default, type)) {
                    fail('LEXICA4548', `The default of '${parameter.name}' is no ${parameter.type}`, declaration.name);
                }
            }
        }

        module.conversions.forEach(conversion => ['from', 'to'].forEach(key => check(conversion, conversion[key], LexicaModule.conversionNameOf(conversion))));
    }

    /**
     * Refuses a module member of a name the module declares already, or one beside a member of its name on a receiver, which the namespace would reach too; a member a registered one of its name already answers on one of
     * the same receivers; and a second default indexer of a receiver.
     */
    #checkMembers(module, fail) {
        // A module member reserves its name against members of its module's own types; in alpha.33 it reserves it against its module's members on any receiver, a refusal of its own.
        const clashCodeOf = member => (this.getTargetTypes(member).some(type => type === 'any' || type.module === module.name) ? 'LEXICA4014' : 'LEXICA4553');

        // A module declares members on any type, its own or another module's, by any name, and module members, which have no target, by any name its own members do not take: a module member's name in its namespace is its own.
        module.members.forEach((declaration, index) => {
            const earlier = module.members.slice(0, index).filter(other => other.name === declaration.name);

            if (declaration.target === undefined) {
                if (earlier.some(other => other.target === undefined)) {
                    fail('LEXICA4549', `The module member '${declaration.name}' is declared already`, declaration.name, 'name');
                }

                if (earlier.length > 0) {
                    fail(earlier.some(other => clashCodeOf(other) === 'LEXICA4014') ? 'LEXICA4014' : 'LEXICA4553', `'${declaration.name}' is a module member, read as ${module.name}.${declaration.name}, and a member of that name on a receiver is declared already, which ${module.name}.${declaration.name}(…) would call`, declaration.name, 'target');
                }

                return;
            }

            if (earlier.some(other => other.target === undefined)) {
                fail(clashCodeOf(declaration), `'${declaration.name}' is a module member, read as ${module.name}.${declaration.name}, so no member of that name is declared on a receiver beside it`, declaration.name, 'target');
            }

            this.#checkCollision(declaration, [...this.getMembers(declaration.name), ...earlier], fail);

            // A receiver has one default indexer at most, so `[…]` names one indexer for it.
            if (declaration.default === true) {
                for (const other of [...this.getDefaultIndexers(), ...module.members.slice(0, index).filter(member => member.default === true)]) {
                    const overlapping = this.#overlapping(declaration, other);

                    if (overlapping !== undefined) {
                        fail('LEXICA4550', `'${other.name}' is the default indexer of ${overlapping} already`, declaration.name, 'default');
                    }
                }
            }
        });
    }

    /** Refuses a conversion between types that are not data, one between types none of which its module owns, and one declared already. */
    #checkConversions(module, fail) {
        module.conversions.forEach((conversion, index) => {
            const name = LexicaModule.conversionNameOf(conversion);
            const from = this.getDeclaredType(conversion, conversion.from);
            const to = this.getDeclaredType(conversion, conversion.to);

            for (const type of [from, to]) {
                if (!this.#isData(type, new Set())) {
                    fail('LEXICA4065', `'${type}' is no type of data Lexica or a module registered with it declares, which a conversion converts between`, name);
                }
            }

            // A module converts to or from a type of its own; Lexica's own module alone converts between the language's types.
            if (module !== Vocabulary.module && from.module !== module.name && to.module !== module.name) {
                fail('LEXICA4028', "A conversion converts to or from one of its module's own types", name);
            }

            // A conversion is declared once across the registry: it converts to or from a type of its own module, which no module registered before it names, so its own module alone can declare it again.
            // Types of data have no subtypes, so two sources overlap where they are one type.
            const isDeclaredEarlier = module.conversions.slice(0, index).some(other => this.getDeclaredType(other, other.from).equals(from) && this.getDeclaredType(other, other.to).equals(to));

            if (isDeclaredEarlier) {
                fail('LEXICA4069', `The conversion from ${conversion.from} to ${conversion.to} is declared already`, name);
            }
        });
    }

    /** Whether values of the type are data, a structured type's fields included; a structure already being checked counts as data where it holds itself, since its other fields are checked where it is first met. */
    #isData(type, checking) {
        switch (type.kind) {
            case 'list':
                return this.#isData(type.itemType, checking);
            case 'named': {
                if ((type.module === null && LexicaModule.dataTypeNames.includes(type.name)) || checking.has(type.identity)) {
                    return true;
                }

                const structure = this.getStructure(type);

                if (structure === undefined) {
                    return false;
                }

                checking.add(type.identity);

                return this.getFieldTypesOf(structure).every(([, fieldType]) => this.#isData(fieldType, checking));
            }
            default:
                return false;
        }
    }

    /** Whether the type admits a default: a value of data, its nullability, its items and a structure's fields as declared, and never a node. */
    #admits(value, type) {
        if (value === null) {
            return type.isNullable;
        }

        switch (type.kind) {
            case 'typeParameter':
                return value !== undefined;
            case 'list':
                return Array.isArray(value) && value.every(item => this.#admits(item, type.itemType));
            case 'named': {
                if (type.module === null && ['Number', 'String', 'Boolean'].includes(type.name)) {
                    return typeof value === type.name.toLowerCase();
                }

                const structure = this.getStructure(type);

                return structure !== undefined && ObjectUtils.isNonArrayObject(value) && this.getFieldTypesOf(structure).every(([field, fieldType]) => this.#admits(value[field], fieldType));
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
                fail('LEXICA4060', `The observation type '${observationDeclaration.type}' is declared by no module`, declaration.name, 'updates.observations');
            }

            if (typeof observationDeclaration.of === 'string' && observationDeclaration.of !== 'receiver') {
                LexicaRegistry.#validateTarget(declaration, observationDeclaration, type, ownerOf(type), fail);
            }

            hasMaintained ||= type.contract === 'maintained';
        }

        if ((updates.reads === 'maintained') !== hasMaintained) {
            fail(updates.reads === 'maintained' ? 'LEXICA4025' : 'LEXICA4062', updates.reads === 'maintained' ? 'It reads maintained values, so it names a maintained observation' : 'It names a maintained observation, so it reads maintained values', declaration.name, 'updates');
        }
    }

    /** Refuses a target its observation type's module does not declare, one found from the receiver for a member without one, and one of several for a maintained observation, which gives its member one sample. */
    static #validateTarget(declaration, observationDeclaration, type, owner, fail) {
        const target = owner.observationTargets.find(candidate => candidate.name === observationDeclaration.of);

        if (target === undefined) {
            fail('LEXICA4024', `The observation '${type.name}' observes '${observationDeclaration.of}', and the module '${owner.name}', which declares '${type.name}', declares no target of that name`, declaration.name, 'updates.observations');
        }

        if (target.from === 'receiver' && declaration.target === undefined) {
            fail('LEXICA4057', `The observation '${type.name}' observes '${target.name}', a target found from the receiver, and a member without a target has no receiver`, declaration.name, 'updates.observations');
        }

        if (type.contract === 'maintained' && target.count === 'many') {
            fail('LEXICA4063', `The maintained observation '${type.name}' gives one sample, so it observes one target, never '${target.name}', a target of several`, declaration.name, 'updates.observations');
        }
    }

    /** Refuses a member that a registered one of its name already answers on one of the same receivers; a module member, which has no target, answers on none. */
    #checkCollision(declaration, others, fail) {
        for (const other of others.filter(candidate => candidate.target !== undefined)) {
            const overlapping = this.#overlapping(other, declaration);

            // A member with an owner is another module's, since the module being registered records its owners once it is registered.
            if (overlapping !== undefined) {
                fail(this.#owners.has(other) ? 'LEXICA4551' : 'LEXICA4029',`'${declaration.name}' is declared already for ${overlapping}`, declaration.name, 'target');
            }
        }
    }

    /** The first type the one member applies to that the other member applies to as well, as the one declares it, or undefined where they share no receiver. */
    #overlapping(one, other) {
        const theirs = this.getTargetTypes(other);
        const notations = [one.target].flat();

        return notations.find((notation, index) => {
            const mine = this.getTargetTypes(one)[index];

            return theirs.some(type => LexicaRegistry.#overlap(mine, type));
        });
    }

    static #overlap(first, second) {
        if (first === 'any' || second === 'any') {
            return true;
        }

        return Type.tryMatchType(first, second, new Map()) || Type.tryMatchType(second, first, new Map());
    }
}
