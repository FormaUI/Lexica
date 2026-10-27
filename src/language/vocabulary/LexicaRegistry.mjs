/**
 * LexicaRegistry — the declarations of every module registered with the registry, which requests resolve against
 */

import { ArrayUtils } from '../../common/ArrayUtils.mjs';
import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { LexicaErrors } from '../LexicaError.mjs';
import { Names } from '../Names.mjs';
import { Type } from '../Type.mjs';
import { TypeChecker } from '../TypeChecker.mjs';
import { LexicaModule } from './LexicaModule.mjs';
import { Vocabulary } from './Vocabulary.mjs';

export class LexicaRegistry {
    /** @type {Map<string, import('./LexicaModule.mjs').LexicaModule>} */
    #modules = new Map();

    /** @type {Map<string, object[]>} */
    #receiverMembers = new Map();

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

    /**
     * The module each declaration belongs to, by the declaration: the name of the module that declares it, which its notations are read in, and the modules a structured type imports, which they read unqualified too.
     * Written for every declaration of a module as its registration starts, so its own declarations read its own types, and removed for each where the module is refused.
     * @type {WeakMap<object, { moduleName: string, imports: readonly string[] }>}
     */
    #declaringModules = new WeakMap();

    /**
     * The type each member a type declares within it stands in, by the member: its receiver, which it names no target for. Written for every such member as its module's registration starts, beside its declaring module, and
     * removed for each where the module is refused. @type {WeakMap<object, object>}
     */
    #containingTypes = new WeakMap();

    /** The type each notation of a declaration writes, every name in it resolved to its identity, by the declaration and then the notation. @type {WeakMap<object, Map<string, Type>>} */
    #declaredTypeCache = new WeakMap();

    /** The data shape of each structured type, by its declaration: valid for good, since a declaration is frozen and the types its notations write are kept for good, and released with the declaration. @type {WeakMap<object, ReadonlyMap<string, Type>>} */
    #dataShapeCache = new WeakMap();

    /** The module being registered and the names of its types, which its own declarations name before it is registered; null between registrations. */
    #pending = null;

    /** @param {import('./LexicaModule.mjs').LexicaModule[]} modules The modules registered at the start. */
    constructor(modules = []) {
        modules.forEach(module => this.registerModule(module));
    }

    /** The checker of the relations between the types the registry's modules declare and Lexica's own. */
    get typeChecker() {
        return this.#typeChecker;
    }

    #typeChecker = new TypeChecker(this);

    /** The declaration of the generic value type the type is one of, or undefined for a type of none; Lexica alone declares one. */
    getGenericType(type) {
        return Vocabulary.getGenericType(type);
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

    /**
     * Registers a module's declarations, refusing a module whose names are taken or whose declarations break the registry's rules, before registering any of them. It calls no host code: a module's `isInstance`, `typeOf`
     * and implementations are called only as values are bound or evaluated.
     */
    registerModule(module) {
        if (!LexicaModule.isModule(module)) {
            throw LexicaErrors.module('LEXICA4546', 'A module is registered as createModule makes it', { module: String(module?.name) });
        }

        const fail = (code, message, declarationName, declarationKey, typeName) => {
            throw LexicaErrors.module(code, message, {
                module: module.name,
                ...(typeName === undefined ? {} : { type: typeName }),
                ...(declarationName === undefined ? {} : { declaration: declarationName }),
                ...(declarationKey === undefined ? {} : { declarationKey }),
            });
        };
        // A member declared within a type is located at its type as well.
        const failAt = declaration => (code, message, declarationName, declarationKey) => fail(code, message, declarationName, declarationKey, this.#containingTypes.get(declaration)?.name);

        // Module names are compared case-insensitively for uniqueness, each keeping its own spelling.
        const taken = [...this.#modules.keys()].find(name => name.toLowerCase() === module.name.toLowerCase());

        if (taken !== undefined) {
            fail('LEXICA4035', `A module is registered once under a name compared case-insensitively, and '${taken}' is registered already`);
        }

        // A module's name begins its namespace in this implementation's text, which reads a word the language reserves as that word, and has no import binding to read with `@` yet.
        if (Names.isReservedWord(module.name)) {
            fail('LEXICA4557', `'${module.name}' is a word the language reserves, whose module this implementation's text can't reach until a script imports it`);
        }

        // A type is named once within its module, which creating it checks, and two modules may each declare a type of one name, since its module is part of its identity.
        const ownTypes = new Set(module.types.map(type => type.name));

        for (const type of module.types) {

            for (const moduleName of type.import ?? []) {
                if (!this.#modules.has(moduleName)) {
                    fail('LEXICA4015', `The type imports the module '${moduleName}', which is not registered`, type.name, 'import');
                }
            }
        }

        // A module's members are those it declares flat, module members among them, and those each of its types declares within it.
        const typesOfMembers = new Map(module.types.flatMap(type => (type.members ?? []).map(member => [member, type])));
        const members = [...module.members, ...typesOfMembers.keys()];

        LexicaRegistry.#validateTypeSelections(module, members, this.#typeSelectors, this.#selectableTypes, declaration => this.getDeclaringModuleName(declaration), fail, failAt);

        for (const type of module.observationTypes) {
            if (this.#observationTypes.has(type.name)) {
                fail('LEXICA4007', `The observation type '${type.name}' is declared already`, type.name);
            }
        }

        const observationTypes = new Map([...this.#observationTypes, ...module.observationTypes.map(type => [type.name, type])]);

        // A target belongs to the module that declares the observation type observing it, this module's own types observing this module's own targets.
        const ownObservationTypes = new Set(module.observationTypes);
        const getDeclaringModule = type => (ownObservationTypes.has(type) ? module : this.#modules.get(this.getDeclaringModuleName(type)));

        // Every declaration's notations are read in its module: its own types, Lexica's, and those of a module a type imports, unqualified, and any other qualified by its module; a member a type declares within it reads
        // its type's imports, which cover the type's whole declaration.
        const declarations = [...module.types, ...members, ...module.typeSelectors, ...module.selectableTypes, ...module.observationTypes, ...module.conversions];

        for (const declaration of declarations) {
            const type = module.types.includes(declaration) ? declaration : typesOfMembers.get(declaration);

            this.#declaringModules.set(declaration, { moduleName: module.name, imports: type?.import ?? [] });
        }

        typesOfMembers.forEach((type, member) => this.#containingTypes.set(member, type));

        this.#pending = { module, typeNames: ownTypes, types: new Map(module.types.map(type => [`${module.name}.${type.name}`, type])) };

        try {
            this.#resolveDeclaredTypes(module, members);
            this.#validateDeclaredTypes(module, members, fail, failAt);

            for (const declaration of members) {
                LexicaRegistry.#validateObservations(declaration, this.hasReceiver(declaration), observationTypes, getDeclaringModule, failAt(declaration));
            }

            this.#validateMemberCollisions(members, failAt);
            this.#validateConversions(module, fail);
        } catch (error) {
            // A refused module's declarations belong to no module of the registry, and its members to none of its types.
            declarations.forEach(declaration => this.#declaringModules.delete(declaration));
            typesOfMembers.forEach((type, member) => this.#containingTypes.delete(member));

            throw error;
        } finally {
            this.#pending = null;
        }

        this.#modules.set(module.name, module);

        for (const type of module.types) {
            this.#types.set(`${module.name}.${type.name}`, type);
        }

        for (const selector of module.typeSelectors) {
            this.#typeSelectors.set(selector.name, selector);
            this.#selectableTypes.set(selector.name, new Map());
        }

        for (const selectable of module.selectableTypes) {
            this.#selectableTypes.get(selectable.selector).set(selectable.name, selectable);
        }

        for (const type of module.observationTypes) {
            this.#observationTypes.set(type.name, type);
        }

        // A module member has no receiver, so no receiver's member of its name finds it.
        for (const declaration of members) {
            if (this.hasReceiver(declaration)) {
                this.#receiverMembers.set(declaration.name, [...this.getReceiverMembers(declaration.name), declaration]);
            }
        }

        for (const conversion of module.conversions) {
            const from = this.getDeclaredType(conversion, conversion.from).identity;

            if (!this.#conversions.has(from)) {
                this.#conversions.set(from, new Map());
            }

            this.#conversions.get(from).set(this.getDeclaredType(conversion, conversion.to).identity, conversion);
        }

        return this;
    }

    /** The members named so that receivers answer, across every module. */
    getReceiverMembers(name) {
        return this.#receiverMembers.get(name) ?? [];
    }

    /** The members named so that the module declares, its module members among them, those it declares flat first and then those its types declare within them, each in the order it declares them. */
    getMembersDeclaredBy(moduleName, name) {
        const module = this.#modules.get(moduleName);

        return module === undefined ? [] : [...module.members, ...module.types.flatMap(type => type.members ?? [])].filter(declaration => declaration.name === name);
    }

    /** Whether the member has a receiver: one a type declares within it, whose receiver the type is, or one that names its target; a module member has none. */
    hasReceiver(declaration) {
        return this.#containingTypes.has(declaration) || declaration.target !== undefined;
    }

    /**
     * The notations of the types the member applies to, in the order it declares them: its type's local name for a member declared within it, which resolves to that type in its module as any notation does, and its target
     * otherwise, a type, a list of them or 'any'; none for a module member.
     */
    #receiverNotationsOf(declaration) {
        const type = this.#containingTypes.get(declaration);

        if (type !== undefined) {
            return [type.name];
        }

        return declaration.target === undefined ? [] : [declaration.target].flat();
    }

    /** How a script writes the member: `access` for a property, `function-call` for a function called with arguments in parentheses, and `indexer` for one given its key in brackets. */
    formOf(declaration) {
        return declaration.kind === 'property' ? 'access' : declaration.syntax;
    }

    /** The names of every receiver member declared, across every module; a module member, read through its namespace, is none of them. */
    get receiverMemberNames() {
        return [...this.#receiverMembers.keys()];
    }

    /** The module registered under the name, or undefined. */
    getModule(name) {
        return this.#modules.get(name);
    }

    /** The indexers declared the default of their receivers, across every module. */
    getDefaultIndexers() {
        return [...this.#receiverMembers.values()].flat().filter(declaration => declaration.default === true);
    }

    /**
     * The type the notation writes in the declaration, a member, one of its parameters' notations among them, a structured type, a selectable type or a conversion: each name resolved to its identity in the module
     * that declares it. It is resolved once and kept by the declaration for good, since a registered module is never removed and its declarations are frozen, and it is released with the declaration; a notation that
     * names no type the declaration's module can reach is refused at that module and the declaration's name, a conversion's being its source and destination, and kept by none. It calls no host code.
     */
    getDeclaredType(declaration, notation) {
        let types = this.#declaredTypeCache.get(declaration);

        if (types === undefined) {
            types = new Map();
            this.#declaredTypeCache.set(declaration, types);
        }

        if (!types.has(notation)) {
            const typeName = this.#containingTypes.get(declaration)?.name;
            const fail = (code, message) => {
                throw LexicaErrors.module(code, message, { module: this.getDeclaringModuleName(declaration), ...(typeName === undefined ? {} : { type: typeName }), declaration: declaration.name ?? LexicaModule.conversionNameOf(declaration) });
            };

            types.set(notation, this.#resolveNotation(notation, this.#declaringModules.get(declaration), fail));
        }

        return types.get(notation);
    }

    /** The types the member applies to, in the order it declares them: each a type, a type parameter for a receiver of any type, or 'any'. */
    getTargetTypes(declaration) {
        return this.#receiverNotationsOf(declaration).map(notation => (notation === 'any' ? notation : this.getDeclaredType(declaration, notation)));
    }

    /** The structured type the named type is, or undefined for a type no module declares as one. */
    getStructure(type) {
        const declared = this.#typeDeclarationOf(type);

        return declared?.kind === 'reference' ? undefined : declared;
    }

    /** The reference type the named type is, or undefined for a type no module declares as one. */
    getReferenceType(type) {
        const declared = this.#typeDeclarationOf(type);

        return declared?.kind === 'reference' ? declared : undefined;
    }

    /** Whether the type is a reference type a module declares, nullable or not. */
    isReferenceType(type) {
        return this.getReferenceType(type) !== undefined;
    }

    /** The supertype the reference type names, made nullable where the type is, or null where it names none or is no reference type. */
    getSupertype(type) {
        const declared = this.getReferenceType(type);

        if (declared?.supertype === undefined) {
            return null;
        }

        const supertype = this.getDeclaredType(declared, declared.supertype);

        return type.isNullable ? supertype.toNullable() : supertype;
    }

    /**
     * Whether the value belongs to the reference type: where the `isInstance` of the type and of every supertype above it answers true, each asked in turn until one answers false, on every call, no answer kept.
     * An exception it throws (LEXICA5027) and an answer that isn't a Boolean (LEXICA5017) are faults of the module that declares the type, naming what asked.
     * @param {unknown} value
     * @param {Type} type
     * @param {string} asked What asked whether the value belongs, as a message names it.
     */
    belongsTo(value, type, asked) {
        for (let current = type.toNonNullable(); current !== null; current = this.getSupertype(current)) {
            const declared = this.getReferenceType(current);
            const location = { module: this.getDeclaringModuleName(declared), declaration: declared.name };
            let answer;

            try {
                answer = declared.isInstance(value);
            } catch (error) {
                throw LexicaErrors.evaluation('LEXICA5027', `The isInstance of ${current} threw as ${asked} asked whether a value belongs to it`, location, { cause: error });
            }

            if (typeof answer !== 'boolean') {
                throw LexicaErrors.evaluation('LEXICA5017', `The isInstance of ${current} answered what isn't a Boolean as ${asked} asked whether a value belongs to it`, location);
            }

            if (!answer) {
                return false;
            }
        }

        return true;
    }

    /**
     * The reference types the registry's modules recognize the value as, each module's `typeOf` naming the most specific of its own reference types the value is of, or null; none for a value that isn't an object, which is data.
     * It asks the `typeOf` of every module declaring one, in the order they were registered, and `belongsTo` of each type named, on every call, no answer kept. A name that is no reference type of its module, an abstract one,
     * and one the value doesn't belong to (LEXICA5002), and an exception `typeOf` throws (LEXICA5026), are faults of the module, naming what asked.
     * @param {unknown} value
     * @param {string} asked What asked for the value's type, as a message names it.
     * @returns {Type[]}
     */
    recognize(value, asked) {
        if (value === null || typeof value !== 'object') {
            return [];
        }

        const recognized = [];

        for (const module of this.#modules.values()) {
            if (module.typeOf === undefined) {
                continue;
            }

            let name;

            try {
                name = module.typeOf(value);
            } catch (error) {
                throw LexicaErrors.evaluation('LEXICA5026', `The typeOf of the module '${module.name}' threw as ${asked} asked for a value's type`, { module: module.name }, { cause: error });
            }

            if (name === null || name === undefined) {
                continue;
            }

            const type = typeof name === 'string' ? Type.createNamedType(name, false, module.name) : null;
            const declared = type === null ? undefined : this.getReferenceType(type);

            if (declared === undefined || declared.abstract === true || !this.belongsTo(value, type, asked)) {
                const wrong = declared === undefined ? `${JSON.stringify(name) ?? String(name)}, which is no reference type of its own` : declared.abstract === true ? `the abstract type ${name}` : `${name}, which the value doesn't belong to`;

                throw LexicaErrors.evaluation('LEXICA5002', `The typeOf of the module '${module.name}' named ${wrong}, as ${asked} asked for a value's type`, { module: module.name });
            }

            recognized.push(type);
        }

        return recognized;
    }

    /** The public types of the local name, Lexica's own among them, or the one type a qualified name names, as a host's declared binding type names one; none where no type is named so. */
    getTypesNamed(name) {
        const dot = name.indexOf('.');

        if (dot !== -1) {
            const type = Type.createNamedType(name.slice(dot + 1), false, name.slice(0, dot));

            return this.#typeDeclarationOf(type) === undefined ? [] : [type];
        }

        const own = LexicaModule.builtInTypeNames.includes(name) ? [Type.createNamedType(name)] : [];

        return [...own, ...this.getModuleNamesDeclaringType(name).map(moduleName => Type.createNamedType(name, false, moduleName))];
    }

    /** The declaration of the named type a module declares, registered or being registered, or undefined. */
    #typeDeclarationOf(type) {
        if (type.kind !== 'named' || type.moduleName === null) {
            return undefined;
        }

        return this.#types.get(type.identity) ?? this.#pending?.types.get(type.identity);
    }

    /**
     * Returns the structured type's data properties and their types, in declaration order, or null if the supplied type does not name a structured type; a structured type of no data properties would answer an empty
     * map, though module creation requires one at least. The map is kept in the data-shape cache.
     * @returns {ReadonlyMap<string, Type> | null}
     */
    getDataShape(type) {
        const structure = this.getStructure(type);

        if (structure === undefined) {
            return null;
        }

        let shape = this.#dataShapeCache.get(structure);

        if (shape === undefined) {
            shape = new Map(Object.entries(structure.fields).map(([name, notation]) => [name, this.getDeclaredType(structure, notation)]));
            this.#dataShapeCache.set(structure, shape);
        }

        return shape;
    }

    /** The types of the data properties of the name, across every structured type, as each declares it. */
    getDataPropertyTypes(propertyName) {
        return [...this.#types.values()].flatMap(type => (type.kind !== 'reference' && Object.hasOwn(type.fields, propertyName) ? [this.getDeclaredType(type, type.fields[propertyName])] : []));
    }

    /** The names of the registered modules that declare a type of the local name, in the order they were registered. */
    getModuleNamesDeclaringType(name) {
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
        return type.kind === 'named' && type.typeArguments.length === 0 && !type.isNullable && this.isData(type);
    }

    /** The name of the module that declares the declaration: a member, a type, a type selector, a selectable type or a conversion. */
    getDeclaringModuleName(declaration) {
        return this.#declaringModules.get(declaration)?.moduleName;
    }

    /** The implementation that carries the declaration out, its `impl`, or undefined where its module gives it none. */
    getImplementation(declaration) {
        return declaration.impl;
    }

    /** Whether the module, registered or being registered, declares a type of the local name. */
    #declaresType(moduleName, name) {
        return this.#types.has(`${moduleName}.${name}`) || (this.#pending?.module.name === moduleName && this.#pending.typeNames.has(name));
    }

    /**
     * The type the notation writes in its context, each name resolved to its identity: a qualified name to the type its module declares; an unqualified one to a type of the declaring module, one of Lexica's own types,
     * or the one type of its name among the modules a structured type imports, refusing one that several imported modules declare and one outside them, which is named qualified.
     */
    #resolveNotation(notation, context, fail) {
        const resolve = type => {
            switch (type.kind) {
                case 'object':
                    return Type.createObjectType(new Map([...type.fieldTypes].map(([name, fieldType]) => [name, resolve(fieldType)])), type.isNullable);
                // A generic value type is Lexica's own, and its type arguments are resolved in turn.
                case 'named':
                    return type.typeArguments.length > 0
                        ? new Type('named', { name: type.name, typeArguments: type.typeArguments.map(resolve), isNullable: type.isNullable })
                        : Type.createNamedType(type.name, type.isNullable, this.#moduleOfType(type, notation, context, fail));
                default:
                    return type;
            }
        };

        return resolve(Type.parse(notation));
    }

    /** The name of the module that declares the named type, null for one of Lexica's own types, as its context resolves it. */
    #moduleOfType(type, notation, context, fail) {
        const { name } = type;

        if (type.moduleName !== null) {
            if (!this.#modules.has(type.moduleName) && this.#pending?.module.name !== type.moduleName) {
                fail('LEXICA4047', `'${notation}' names the type '${type.identity}', and no module named '${type.moduleName}' is registered`);
            }

            if (!this.#declaresType(type.moduleName, name)) {
                fail('LEXICA4047', `'${notation}' names the type '${type.identity}', which the module '${type.moduleName}' does not declare`);
            }

            return type.moduleName;
        }

        if (this.#declaresType(context.moduleName, name)) {
            return context.moduleName;
        }

        if (LexicaModule.builtInTypeNames.includes(name)) {
            return null;
        }

        const imported = context.imports.filter(moduleName => this.#declaresType(moduleName, name));

        if (imported.length > 1) {
            fail('LEXICA4048', `'${notation}' names the type '${name}', which the modules it imports each declare, so it is named qualified: ${imported.map(moduleName => `${moduleName}.${name}`).join(' or ')}`);
        }

        if (imported.length === 1) {
            return imported[0];
        }

        const foreign = this.getModuleNamesDeclaringType(name);

        if (foreign.length > 0) {
            fail('LEXICA4049', `'${notation}' names the type '${name}', which only another module declares, so it is named qualified: ${foreign.map(moduleName => `${moduleName}.${name}`).join(' or ')}`);
        }

        fail('LEXICA4047', `'${notation}' names the type '${name}', which neither Lexica nor a module registered with it declares`);
    }

    /**
     * Refuses a type selector named already, by this module or one registered before it; a key of a selector neither declares; a key its selector maps already, which is never replaced; and a parameter that selects a type
     * through a selector neither declares.
     */
    static #validateTypeSelections(module, members, typeSelectors, selectableTypes, getDeclaringModuleName, fail, failAt) {
        for (const selector of module.typeSelectors) {
            if (typeSelectors.has(selector.name)) {
                fail('LEXICA4007', `The type selector '${selector.name}' is declared already, by the module '${getDeclaringModuleName(typeSelectors.get(selector.name))}'`, selector.name, 'name');
            }
        }

        const isDeclared = name => typeSelectors.has(name) || module.typeSelectors.some(selector => selector.name === name);

        module.selectableTypes.forEach(selectable => {
            if (!isDeclared(selectable.selector)) {
                fail('LEXICA4039', `The key '${selectable.name}' belongs to the type selector '${selectable.selector}', which no module registered declares`, selectable.name, 'selector');
            }

            // A key its own module maps twice is refused when the module is created.
            const registered = selectableTypes.get(selectable.selector)?.get(selectable.name);

            if (registered !== undefined) {
                fail('LEXICA4038', `The type selector '${selectable.selector}' maps the key '${selectable.name}' already, as the module '${getDeclaringModuleName(registered)}' declared it, and a key is never replaced`, selectable.name, 'name');
            }
        });

        for (const declaration of members) {
            for (const parameter of declaration.parameters.filter(candidate => candidate.selects === 'type')) {
                if (!isDeclared(parameter.selector)) {
                    failAt(declaration)('LEXICA4547', `The parameter '${parameter.name}' selects a type through '${parameter.selector}', which no module registered declares`, declaration.name, 'parameters');
                }
            }
        }
    }

    /**
     * Resolves each notation in the module's declarations through the declared-type cache, in the order the module declares them, refusing one that names no type the declaration's module can reach. Type resolution
     * precedes resolved-type validation, so a module whose notations name no type reports that before any rule that reads a resolved type, whichever declaration breaks it.
     */
    #resolveDeclaredTypes(module, members) {
        for (const type of module.types) {
            Object.values(type.fields ?? {}).forEach(notation => this.getDeclaredType(type, notation));

            if (type.supertype !== undefined) {
                this.getDeclaredType(type, type.supertype);
            }
        }

        module.selectableTypes.forEach(selectable => this.getDeclaredType(selectable, selectable.type));

        for (const declaration of members) {
            this.#receiverNotationsOf(declaration).filter(notation => notation !== 'any').forEach(notation => this.getDeclaredType(declaration, notation));

            if (declaration.result !== undefined) {
                this.getDeclaredType(declaration, declaration.result);
            }

            for (const parameter of declaration.parameters) {
                [parameter.type, ...(parameter.parameters ?? [])].forEach(notation => this.getDeclaredType(declaration, notation));
            }
        }

        module.conversions.forEach(conversion => ['from', 'to'].forEach(key => this.getDeclaredType(conversion, conversion[key])));
    }

    /** Refuses, every notation resolved, a supertype that is no reference type, a cycle of supertypes, a tolerance on a result that holds no number, and a default its parameter's type does not admit. */
    #validateDeclaredTypes(module, members, fail, failAt) {
        for (const type of module.types) {
            // A supertype is a reference type, one the module declares or one a module registered before it declares.
            if (type.supertype !== undefined && !this.isReferenceType(this.getDeclaredType(type, type.supertype))) {
                fail('LEXICA4016', `The supertype of '${type.name}', ${type.supertype}, is no reference type`, type.name, 'supertype');
            }
        }

        // A module registered before names none of this module's types, so a hierarchy that cycles does within the module.
        for (const type of module.types.filter(declared => declared.supertype !== undefined)) {
            const visited = [type.name];

            for (let current = this.getSupertype(Type.createNamedType(type.name, false, module.name)); current !== null && current.moduleName === module.name; current = this.getSupertype(current)) {
                if (visited.includes(current.name)) {
                    fail('LEXICA4050', `The hierarchy of '${type.name}' is a cycle: ${[...visited, current.name].join(' beneath ')}`, type.name, 'supertype');
                }

                visited.push(current.name);
            }
        }

        for (const declaration of members) {
            // A host call that supplies nothing declares no result.
            const resultType = declaration.result === undefined ? null : this.getDeclaredType(declaration, declaration.result);

            // A tolerance applies to a numeric result, or to the numbers a structured result holds, which only now, every type known, is told apart from a reference type; a member with updates always declares a result.
            if (declaration.updates?.tolerance !== undefined && !(resultType.kind === 'named' && ((resultType.moduleName === null && resultType.name === 'Number') || this.getStructure(resultType) !== undefined))) {
                failAt(declaration)('LEXICA4026', 'A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', declaration.name, 'updates.tolerance');
            }

            for (const parameter of declaration.parameters) {
                const type = this.getDeclaredType(declaration, parameter.type);

                if (Object.hasOwn(parameter, 'default') && !this.#admits(parameter.default, type)) {
                    failAt(declaration)('LEXICA4548', `The default of '${parameter.name}' is no ${parameter.type}`, declaration.name);
                }
            }
        }
    }

    /**
     * Refuses a member a registered one of its name already answers on one of the same receivers, and a second default indexer of a receiver; a module member of a name its module declares already is refused when the module
     * is created, and one beside a member of its name on a receiver registers, as the namespace reaches both.
     */
    #validateMemberCollisions(members, failAt) {
        // A module declares members on any type, its own or another module's, by any name, a module member beside a member of its name among them: a declaration is refused where it duplicates another in its own namespace,
        // and an access or a qualified call two of them take is refused where it is resolved.
        members.forEach((declaration, index) => {
            const earlier = members.slice(0, index).filter(other => other.name === declaration.name);
            const fail = failAt(declaration);

            if (!this.hasReceiver(declaration)) {
                return;
            }

            this.#validateReceiverCollisions(declaration, [...this.getReceiverMembers(declaration.name), ...earlier], fail);

            // A receiver type has one unnamed indexer of a module at most, and another module's default indexer of an overlapping receiver is refused in alpha.33, which has no owner to select one.
            if (declaration.default === true) {
                for (const other of this.getDefaultIndexers()) {
                    const overlapping = this.#getOverlappingReceiver(declaration, other);

                    if (overlapping !== undefined) {
                        fail('LEXICA4550', `'${other.name}' is the default indexer of ${overlapping} already`, declaration.name, 'default');
                    }
                }

                for (const other of members.slice(0, index).filter(member => member.default === true)) {
                    const shared = this.#getSharedReceiver(declaration, other);

                    if (shared !== undefined) {
                        fail('LEXICA4068', `'${other.name}' is the default indexer of ${shared} already`, declaration.name, 'default');
                    }
                }
            }
        });
    }

    /** Refuses a conversion between types that are not data, one between types none of which its module owns, and one declared already. */
    #validateConversions(module, fail) {
        module.conversions.forEach((conversion, index) => {
            const name = LexicaModule.conversionNameOf(conversion);
            const from = this.getDeclaredType(conversion, conversion.from);
            const to = this.getDeclaredType(conversion, conversion.to);

            for (const type of [from, to]) {
                if (!this.isData(type)) {
                    fail('LEXICA4065', `'${type}' is no type of data Lexica or a module registered with it declares, which a conversion converts between`, name);
                }
            }

            // A module converts to or from a type of its own; Lexica's own module alone converts between the language's types.
            if (module !== Vocabulary.module && from.moduleName !== module.name && to.moduleName !== module.name) {
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

    /**
     * Whether values of the type are data: Number, String, Boolean, null and never; a list or another generic value type of data; an object type of data; and a structured type whose data shape holds data.
     * It classifies a type, and validates no JavaScript value: whether a value is data of a type is a separate check, as a default's and a supplied value's are. Being data does not make a type a conversion's endpoint,
     * which module creation and `isConvertible` decide apart.
     */
    isData(type) {
        return this.#isData(type, new Set());
    }

    /** Whether values of the type are data, as `isData` says, a structure already being checked counting as data where it holds itself, since its other properties are checked where it is first met. */
    #isData(type, checking) {
        switch (type.kind) {
            case 'null':
            case 'never':
                return true;
            case 'object':
                return [...type.fieldTypes.values()].every(fieldType => this.#isData(fieldType, checking));
            case 'named': {
                // A generic value type holds data where each of its type arguments does, as a list of data does.
                if (type.typeArguments.length > 0) {
                    return type.typeArguments.every(typeArgument => this.#isData(typeArgument, checking));
                }

                if ((type.moduleName === null && LexicaModule.dataTypeNames.includes(type.name)) || checking.has(type.identity)) {
                    return true;
                }

                const structure = this.getStructure(type);

                if (structure === undefined) {
                    return false;
                }

                checking.add(type.identity);

                return [...this.getDataShape(type).values()].every(propertyType => this.#isData(propertyType, checking));
            }
            default:
                return false;
        }
    }

    /**
     * Whether the type admits a default: a value of data, its nullability, its items and a structure's fields as declared, and never a node. A number is finite and a list holds a value at every index, at any depth,
     * as every value an evaluation produces does. A type parameter admits any value of data, whatever it binds to, since what it binds to is known only where the member is called.
     */
    #admits(value, type) {
        if (value === null) {
            return type.isNullable;
        }

        switch (type.kind) {
            // A type parameter's default is data, whatever the parameter binds to; whether it fits that binding is checked nowhere yet.
            case 'typeParameter':
                return LexicaRegistry.#isDataValue(value);
            case 'named': {
                if (type.isList) {
                    return Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(item => this.#admits(item, type.itemType));
                }

                if (type.moduleName === null && type.name === 'Number') {
                    return Number.isFinite(value);
                }

                if (type.moduleName === null && ['String', 'Boolean'].includes(type.name)) {
                    return typeof value === type.name.toLowerCase();
                }

                const structure = this.getStructure(type);

                return structure !== undefined && ObjectUtils.isNonArrayObject(value) && [...this.getDataShape(type)].every(([property, propertyType]) => this.#admits(value[property], propertyType));
            }
            default:
                return false;
        }
    }

    /** Whether the value is data as a default holds it: null, a string, a Boolean, a finite number, a list holding a value at every index, or a plain object, each item and each field data in turn, at any depth. */
    static #isDataValue(value) {
        if (value === null || typeof value === 'string' || typeof value === 'boolean') {
            return true;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value);
        }

        if (Array.isArray(value)) {
            return ArrayUtils.findMissingIndex(value) === -1 && value.every(item => LexicaRegistry.#isDataValue(item));
        }

        return ObjectUtils.isPlainObject(value) && Object.values(value).every(field => LexicaRegistry.#isDataValue(field));
    }

    /**
     * Refuses an observation of a type no module declares; one of a target its observation type's module declares none of, one of a target found from the receiver for a member without one,
     * and a maintained one of a target of several; and a member that reads maintained values without a maintained observation, or any other that has one.
     */
    static #validateObservations(declaration, hasReceiver, observationTypes, getDeclaringModule, fail) {
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
                LexicaRegistry.#validateObservedTarget(declaration, hasReceiver, observationDeclaration, type, getDeclaringModule(type), fail);
            }

            hasMaintained ||= type.contract === 'maintained';
        }

        if ((updates.reads === 'maintained') !== hasMaintained) {
            fail(updates.reads === 'maintained' ? 'LEXICA4025' : 'LEXICA4062', updates.reads === 'maintained' ? 'It reads maintained values, so it names a maintained observation' : 'It names a maintained observation, so it reads maintained values', declaration.name, 'updates');
        }
    }

    /** Validates an observation's reference to a target, not the target's own declaration, which creating its module validates: refuses a target its observation type's module does not declare, one found from the receiver for a member without one, and one of several for a maintained observation, which gives its member one sample. */
    static #validateObservedTarget(declaration, hasReceiver, observationDeclaration, type, declaringModule, fail) {
        const target = declaringModule.observationTargets.find(candidate => candidate.name === observationDeclaration.of);

        if (target === undefined) {
            fail('LEXICA4024', `The observation '${type.name}' observes '${observationDeclaration.of}', and the module '${declaringModule.name}', which declares '${type.name}', declares no target of that name`, declaration.name, 'updates.observations');
        }

        if (target.from === 'receiver' && !hasReceiver) {
            fail('LEXICA4057', `The observation '${type.name}' observes '${target.name}', a target found from the receiver, and a member without a target has no receiver`, declaration.name, 'updates.observations');
        }

        if (type.contract === 'maintained' && target.count === 'many') {
            fail('LEXICA4063', `The maintained observation '${type.name}' gives one sample, so it observes one target, never '${target.name}', a target of several`, declaration.name, 'updates.observations');
        }
    }

    /**
     * Refuses a member its module declares already on one of the same receiver types, an exact duplicate, and, in alpha.33, one another registered module declares on an overlapping receiver; a module member, which has no target,
     * answers on none. Two of one module's members on overlapping receivers, as a type and the type beneath it, both register, an access both take refused where it is resolved.
     */
    #validateReceiverCollisions(declaration, others, fail) {
        // A member declared within a type collides by its name there, and a flat one by the target it names.
        const collidingKey = this.#containingTypes.has(declaration) ? 'name' : 'target';

        for (const other of others.filter(candidate => this.hasReceiver(candidate))) {
            // A member of another module is registered already, since its module is not the one being registered.
            if (this.getDeclaringModuleName(other) !== this.getDeclaringModuleName(declaration)) {
                const overlapping = this.#getOverlappingReceiver(other, declaration);

                if (overlapping !== undefined) {
                    fail('LEXICA4551', `'${declaration.name}' is declared already for ${overlapping}`, declaration.name, collidingKey);
                }

                continue;
            }

            const shared = this.#getSharedReceiver(other, declaration);

            if (shared !== undefined) {
                fail('LEXICA4029', `'${declaration.name}' is declared already for ${shared}`, declaration.name, collidingKey);
            }
        }
    }

    /** The first receiver type the one member declares that the other declares too, as the one declares it, or undefined where they declare none alike; a type and the type beneath it are two receiver types. */
    #getSharedReceiver(one, other) {
        const theirs = this.getTargetTypes(other);
        const mine = this.getTargetTypes(one);

        return this.#receiverNotationsOf(one).find((notation, index) => theirs.some(type => (mine[index] === 'any' || type === 'any' ? mine[index] === type : mine[index].equals(type))));
    }

    /** The first type the one member applies to that the other member applies to as well, as the one declares it, or undefined where they share no receiver. */
    #getOverlappingReceiver(one, other) {
        const theirs = this.getTargetTypes(other);
        const notations = this.#receiverNotationsOf(one);

        return notations.find((notation, index) => {
            const mine = this.getTargetTypes(one)[index];

            return theirs.some(type => this.#overlap(mine, type));
        });
    }

    #overlap(first, second) {
        if (first === 'any' || second === 'any') {
            return true;
        }

        return this.#typeChecker.matchesType(first, second) || this.#typeChecker.matchesType(second, first);
    }
}
