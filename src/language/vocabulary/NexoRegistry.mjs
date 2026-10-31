/**
 * NexoRegistry — the declarations of every module registered with the registry, which requests resolve against
 */

import { ArrayUtils } from '../../common/ArrayUtils.mjs';
import { ObjectUtils } from '../../common/ObjectUtils.mjs';
import { Imports } from '../Imports.mjs';
import { NexoErrors } from '../NexoError.mjs';
import { MemberSelector } from '../MemberSelector.mjs';
import { Type } from '../Type.mjs';
import { TypeChecker } from '../TypeChecker.mjs';
import { NexoModule } from './NexoModule.mjs';
import { TypeNameScope } from './TypeNameScope.mjs';
import { Vocabulary } from './Vocabulary.mjs';

/** The receiver types of a module member, which no type contains. */
const NO_RECEIVER_TYPES = Object.freeze([]);

export class NexoRegistry {
    /** @type {Map<string, import('./NexoModule.mjs').NexoModule>} */
    #modules = new Map();

    /** @type {Map<string, object[]>} */
    #receiverMembers = new Map();

    /** Every unnamed indexer registered, across every module, in the order registered: an indexer declared without a name, which no name finds. @type {object[]} */
    #unnamedIndexers = [];

    /** Each value type a module declares, reference and structured, by its identity, its module's name and its local name. @type {Map<string, object>} */
    #types = new Map();

    /** Each extension a module declares, by its identity, as a type's: never a value's type, so no notation names one. @type {Map<string, object>} */
    #extensions = new Map();

    /** Each type selector, by its name. @type {Map<string, object>} */
    #typeSelectors = new Map();

    /** Each selector's keys, by the selector's name and then the key, each the mapping a module declared. @type {Map<string, Map<string, object>>} */
    #mappings = new Map();

    /** @type {Map<string, object>} */
    #observationTypes = new Map();

    /** Every operator registered, by its name, `cast` or `convert`, in the order registered: looked up apart from the members, which the language's syntax never confuses with one. @type {Map<string, object[]>} */
    #operators = new Map();

    /**
     * The module each declaration belongs to, by the declaration: the name of the module that declares it, which its notations are read in, and the modules a structured type imports, which they read unqualified too.
     * Written for every declaration of a module as its registration starts, so its own declarations read its own types, and removed for each where the module is refused.
     * and the type parameters its notations read as parameters.
     * @type {WeakMap<object, { moduleName: string, imports: readonly string[], typeParameters: ReadonlySet<string> }>}
     */
    #declaringModules = new WeakMap();

    /**
     * The type or the extension each member is declared within, by the member, which gives its receiver: a type a module declares, one of Nexo's own value types, or an extension. Written for every such member as its
     * module's registration starts, beside its declaring module, and removed for each where the module is refused. @type {WeakMap<object, object>}
     */
    #containingTypes = new WeakMap();

    /** The type each notation of a declaration writes, every name in it resolved to its identity, by the declaration and then the notation. @type {WeakMap<object, Map<string, Type>>} */
    #declaredTypeCache = new WeakMap();

    /**
     * The types each member a type contains is read on, by the member, settled at the first time they are asked for. A member's containing type never changes once written, so an entry is valid until the member's
     * module is refused, which removes it with the containing type, and is released with the member; a member no type contains has none, never kept. Building them anew for each request measured a tenth of
     * resolving.
     * @type {WeakMap<object, readonly Type[]>}
     */
    #receiverTypes = new WeakMap();

    /** The data shape of each structured type, by its declaration: valid for good, since a declaration is frozen and the types its notations write are kept for good, and released with the declaration. @type {WeakMap<object, ReadonlyMap<string, Type>>} */
    #dataShapeCache = new WeakMap();

    /** The module being registered and its value types, by identity, which its own declarations name before it is registered; null between registrations. */
    #pending = null;

    /** @param {import('./NexoModule.mjs').NexoModule[]} modules The modules registered at the start. */
    constructor(modules = []) {
        modules.forEach(module => this.registerModule(module));
    }

    /** The checker of the relations between the types the registry's modules declare and Nexo's own. */
    get typeChecker() {
        return this.#typeChecker;
    }

    #typeChecker = new TypeChecker(this);

    /** The selection of a declaration among those of a name for a receiver, by the owner of its type and the specificity of its extensions. */
    get memberSelector() {
        return this.#memberSelector;
    }

    #memberSelector = new MemberSelector(this, this.#typeChecker);

    /** The number of modules registered, which changes whenever the vocabulary does. */
    get revision() {
        return this.#modules.size;
    }

    /** The revision the last module declaring a `typeOf` was registered at, 0 where none is, since a registration changes a resolution made before it through recognition alone. */
    get recognitionRevision() {
        return this.#recognitionRevision;
    }

    #recognitionRevision = 0;

    /** The names of the modules registered. */
    get moduleNames() {
        return [...this.#modules.keys()];
    }

    /**
     * Registers a module's declarations, refusing a module whose names are taken or whose declarations break the registry's rules, before registering any of them. It calls no host code: a module's `isInstance`, `typeOf`
     * and implementations are called only as values are bound or evaluated.
     */
    registerModule(module) {
        if (!NexoModule.isModule(module)) {
            throw NexoErrors.module('NEXO4546', 'A module is registered as createModule makes it', { module: String(module?.name) });
        }

        const fail = (code, message, declarationName, declarationKey, typeName) => {
            throw NexoErrors.module(code, message, {
                module: module.name,
                ...(typeName === undefined ? {} : { type: typeName }),
                ...(declarationName === undefined ? {} : { declaration: declarationName }),
                ...(declarationKey === undefined ? {} : { declarationKey }),
            });
        };
        // A member declared within a type is located at its type as well, and an unnamed indexer as its access is written.
        const failAt = declaration => (code, message, declarationName, declarationKey) => fail(code, message, declarationName ?? NexoRegistry.#locatedNameOf(declaration), declarationKey, this.#containingTypes.get(declaration)?.name);

        // Module names are compared case-insensitively for uniqueness, each keeping its own spelling.
        const taken = [...this.#modules.keys()].find(name => name.toLowerCase() === module.name.toLowerCase());

        if (taken !== undefined) {
            fail('NEXO4035', `A module is registered once under a name compared case-insensitively, and '${taken}' is registered already`);
        }

        // A type is named once within its module, which creating it checks, and two modules may each declare a type of one name, since its module is part of its identity.
        // An extension is no value's type, so a notation names its module's value types alone.
        const valueTypes = module.types.filter(type => type.kind !== 'extension');

        for (const type of module.types) {

            for (const moduleName of type.import ?? []) {
                if (!this.#modules.has(moduleName)) {
                    fail('NEXO4015', `The type imports the module '${moduleName}', which is not registered`, type.name, 'import');
                }
            }
        }

        // A module's members are its module members, declared flat, and those each of its types and extensions declares within it; Nexo's own module owns its value types, declared through Nexo's internal form,
        // so the members of lists are its own.
        const ownValueTypes = module === Vocabulary.module ? Vocabulary.valueTypes : [];
        const typesOfMembers = new Map([...ownValueTypes, ...module.types].flatMap(type => (type.members ?? []).map(member => [member, type])));
        const members = [...module.members, ...typesOfMembers.keys()];

        NexoRegistry.#validateTypeSelections(module, members, this.#typeSelectors, this.#mappings, declaration => this.getDeclaringModuleName(declaration), fail, failAt);

        for (const type of module.observationTypes) {
            if (this.#observationTypes.has(type.name)) {
                fail('NEXO4007', `The observation type '${type.name}' is declared already`, type.name);
            }
        }

        const observationTypes = new Map([...this.#observationTypes, ...module.observationTypes.map(type => [type.name, type])]);

        // A target belongs to the module that declares the observation type observing it, this module's own types observing this module's own targets.
        const ownObservationTypes = new Set(module.observationTypes);
        const getDeclaringModule = type => (ownObservationTypes.has(type) ? module : this.#modules.get(this.getDeclaringModuleName(type)));

        // Every declaration's notations are read in its module: its own types, Nexo's, and those of a module a type imports, unqualified, and any other qualified by its module; a member a type declares within it reads
        // its type's imports, which cover the type's whole declaration.
        const declarations = [...module.types, ...members, ...module.typeSelectors, ...module.mappings, ...module.observationTypes];

        for (const declaration of declarations) {
            const type = module.types.includes(declaration) ? declaration : typesOfMembers.get(declaration);

            this.#declaringModules.set(declaration, { moduleName: module.name, imports: type?.import ?? [], typeParameters: NexoRegistry.#typeParameterScopeOf(declaration, type) });
        }

        typesOfMembers.forEach((type, member) => this.#containingTypes.set(member, type));

        this.#pending = { module, types: new Map(valueTypes.map(type => [`${module.name}.${type.name}`, type])) };

        try {
            this.#resolveDeclaredTypes(module, members);
            this.#validateDeclaredTypes(module, members, fail, failAt);

            for (const declaration of members) {
                NexoRegistry.#validateObservations(declaration, this.takesReceiver(declaration), observationTypes, getDeclaringModule, failAt(declaration));
            }

            this.#validateMemberCollisions(members, failAt);
            this.#validateAccessibility(module, members, fail, failAt);
            this.#validateTypeParameters(module, members, fail, failAt);
            this.#validateOperators(module, members, failAt);
        } catch (error) {
            // A refused module's declarations belong to no module of the registry, and its members to none of its types.
            declarations.forEach(declaration => this.#declaringModules.delete(declaration));
            typesOfMembers.forEach((type, member) => {
                this.#containingTypes.delete(member);
                this.#receiverTypes.delete(member);
            });

            throw error;
        } finally {
            this.#pending = null;
        }

        this.#modules.set(module.name, module);

        if (module.typeOf !== undefined) {
            this.#recognitionRevision = this.revision;
        }

        for (const type of module.types) {
            (type.kind === 'extension' ? this.#extensions : this.#types).set(`${module.name}.${type.name}`, type);
        }

        for (const selector of module.typeSelectors) {
            this.#typeSelectors.set(selector.name, selector);
            this.#mappings.set(selector.name, new Map());
        }

        for (const mapping of module.mappings) {
            this.#mappings.get(mapping.selector).set(mapping.key, mapping);
        }

        for (const type of module.observationTypes) {
            this.#observationTypes.set(type.name, type);
        }

        // A module member has no receiver, so no receiver's member of its name finds it; an unnamed indexer has no name; and an operator is looked up by its operation alone.
        for (const declaration of members) {
            if (declaration.kind === 'operator') {
                this.#operators.set(declaration.name, [...this.getOperators(declaration.name), declaration]);
            } else if (NexoRegistry.#isUnnamedIndexer(declaration)) {
                this.#unnamedIndexers.push(declaration);
            } else if (this.takesReceiver(declaration)) {
                this.#receiverMembers.set(declaration.name, [...this.getReceiverMembers(declaration.name), declaration]);
            }
        }

        return this;
    }

    /** The members named so that receivers answer, across every module. */
    getReceiverMembers(name) {
        return this.#receiverMembers.get(name) ?? [];
    }

    /**
     * The members named so that the module's namespace reaches: its module members, and those its own types declare within them, each in the order it declares them; an extension's members, which extension access
     * selects, and an operator, which its syntax alone invokes, are none of them.
     */
    getMembersDeclaredBy(moduleName, name) {
        const module = this.#modules.get(moduleName);
        const ownTypes = module?.types.filter(type => type.kind !== 'extension') ?? [];

        // An operator is reached through its syntax alone, never through a namespace.
        return module === undefined ? [] : [...module.members, ...ownTypes.flatMap(type => type.members ?? [])].filter(declaration => declaration.name === name && declaration.kind !== 'operator');
    }

    /** The type, Nexo's own value type or the extension the member is declared within, which gives its receiver and decides whether its module owns it; undefined for a module member. */
    getContainingType(declaration) {
        return this.#containingTypes.get(declaration);
    }

    /**
     * The signatures of the indexer the declaration is one of: the indexers its type or its extension declares of its name, or unnamed where it is, in the order declared, each taking a key of its own type; the
     * declaration alone where it is no indexer within one.
     */
    getIndexerSignatures(declaration) {
        const containing = this.#containingTypes.get(declaration);

        if (declaration.kind !== 'indexer' || containing === undefined) {
            return [declaration];
        }

        return containing.members.filter(member => member.kind === 'indexer' && member.name === declaration.name);
    }

    /** Whether the member takes a receiver: one declared within a type or an extension, whose receiver the type or the extension's target is; a module member takes none. */
    takesReceiver(declaration) {
        return this.#containingTypes.has(declaration);
    }

    /**
     * How the type the member is read on is written, as a message names it: its type's local name for a member declared within it, whose receiver is that type, written with its type parameters for Nexo's generic
     * type, and its extension's target for one declared within an extension; none for a module member.
     */
    #receiverNotationsOf(declaration) {
        const type = this.#containingTypes.get(declaration);

        if (type?.kind === 'extension') {
            return [type.target];
        }

        if (type !== undefined) {
            return [type.kind === 'generic' ? `${type.name}<${type.typeParameters.join(', ')}>` : type.name];
        }

        return [];
    }

    /** The names of every receiver member declared, across every module; a module member, read through its namespace, is none of them. */
    get receiverMemberNames() {
        return [...this.#receiverMembers.keys()];
    }

    /** The module registered under the name, or undefined. */
    getModule(name) {
        return this.#modules.get(name);
    }

    /**
     * The type parameters a declaration's notations read as parameters: an extension's own, and an extension member's with its own; a member's own, with those of the generic type it is declared within, as a list's
     * member reads its `T`; and none for any other declaration, whose names are types'.
     */
    static #typeParameterScopeOf(declaration, type) {
        if (declaration === type) {
            return new Set(declaration.typeParameters ?? []);
        }

        // A reference or a structured type declares none, so the type a member is declared within adds its parameters where it declares any.
        return new Set([...(type?.typeParameters ?? []), ...(declaration.typeParameters ?? [])]);
    }

    /** The unnamed indexers, each declared without a name for its receivers, across every module. */
    getUnnamedIndexers() {
        return this.#unnamedIndexers;
    }

    /** Whether the member is an unnamed indexer: an indexer declared without a name, which brackets after its receiver invoke. */
    static #isUnnamedIndexer(declaration) {
        return declaration.kind === 'indexer' && declaration.name === undefined;
    }

    /** How a location names the declaration: an unnamed indexer, which is given no name, as its access is written, and any other by its name. */
    static #locatedNameOf(declaration) {
        return NexoRegistry.#isUnnamedIndexer(declaration) ? '[]' : declaration.name;
    }

    /**
     * The type the notation writes in the declaration, a member, one of its parameters' notations among them, a type, an extension or a mapping: each name resolved to its identity in the module that declares it. It is
     * resolved once and kept by the declaration for good, since a registered module is never removed and its declarations are frozen, and it is released with the declaration; a notation that names no type the
     * declaration's module can reach is refused at that module and the declaration's name, and kept by none. It calls no host code.
     */
    getDeclaredType(declaration, notation) {
        let types = this.#declaredTypeCache.get(declaration);

        if (types === undefined) {
            types = new Map();
            this.#declaredTypeCache.set(declaration, types);
        }

        if (!types.has(notation)) {
            const typeName = this.#containingTypes.get(declaration)?.name;
            const declarationName = NexoRegistry.#locatedNameOf(declaration);
            const fail = (code, message) => {
                throw NexoErrors.module(code, message, { module: this.getDeclaringModuleName(declaration), ...(typeName === undefined ? {} : { type: typeName }), declaration: declarationName });
            };

            types.set(notation, this.#resolveNotation(notation, this.#declaringModules.get(declaration), fail));
        }

        return types.get(notation);
    }

    /**
     * The type the member is read on, as a list of it, none for a module member: the type it is declared within, Nexo's generic type written with its own type parameters, as `List<T>`, or its extension's target, a
     * type parameter where the extension extends every type.
     */
    getReceiverTypes(declaration) {
        const type = this.#containingTypes.get(declaration);

        if (type === undefined) {
            return NO_RECEIVER_TYPES;
        }

        let receiverTypes = this.#receiverTypes.get(declaration);

        if (receiverTypes === undefined) {
            receiverTypes = Object.freeze([this.#receiverTypeOf(declaration, type)]);
            this.#receiverTypes.set(declaration, receiverTypes);
        }

        return receiverTypes;
    }

    /** The type the member is read on within the type or the extension that contains it. */
    #receiverTypeOf(declaration, type) {
        // An extension's member is read on its extension's target, which the extension's own context resolves.
        if (type.kind === 'extension') {
            return this.getDeclaredType(type, type.target);
        }

        // Nexo's own value types are named without a module, as a notation writes them; a member one declares as its own for a narrower receiver, as `List`'s `flatten` is for a list of lists, is read on that receiver.
        if (type.kind === 'generic') {
            const narrowed = type.receivers?.get(declaration);

            return narrowed === undefined ? new Type('named', { name: type.name, typeArguments: type.typeParameters.map(name => Type.createTypeParameter(name)), isNullable: false }) : this.getDeclaredType(declaration, narrowed);
        }

        if (type.kind === 'scalar') {
            return Type.createNamedType(type.name);
        }

        return Type.createNamedType(type.name, false, this.getDeclaringModuleName(declaration));
    }

    /** Whether the declaration is internal, available within its declaring module alone: a type or a member that says so, and a member within an internal type, whatever its own flag says, since its type bounds it. */
    isInternal(declaration) {
        return declaration.internal === true || this.#containingTypes.get(declaration)?.internal === true;
    }

    /** Whether the member is a property of a structured type's data shape: a property the structured type declares directly without updates, which Nexo reads from the data and never invokes. */
    isDataProperty(declaration) {
        return declaration.kind === 'property' && declaration.updates === undefined && this.#containingTypes.get(declaration)?.kind === 'structured';
    }

    /**
     * The declaration of the value type the named type is, nullable or not, whatever its type arguments, its kind an attribute: a type a module declares, registered or being registered, `reference` or `structured`, and
     * one of Nexo's own, `scalar` or `generic`, its type parameters under `typeParameters`; undefined for any other type, an extension among them, which no value is of.
     */
    getTypeDeclaration(type) {
        if (type.kind !== 'named') {
            return undefined;
        }

        if (type.moduleName === null) {
            return Vocabulary.getTypeDeclaration(type.name);
        }

        return this.#types.get(type.identity) ?? this.#pending?.types.get(type.identity);
    }

    /** Whether the type is a reference type a module declares, nullable or not. */
    isReferenceType(type) {
        return this.getTypeDeclaration(type)?.kind === 'reference';
    }

    /**
     * Whether a dictionary's keys may be of the type, the types Nexo's key equality compares exactly: a scalar, by its value, a reference type, by its identity, and null, nullable or not, and a type parameter, which a
     * dictionary binds to its own key type, and a never, an empty dictionary's; a list, an object, a structured value, a dictionary, a pair and a value of Any never are.
     */
    isKeyType(type) {
        switch (type.kind) {
            case 'null':
            case 'never':
            case 'typeParameter':
                return true;
            case 'named':
                return (type.moduleName === null && NexoModule.scalarTypeNames.includes(type.name)) || this.isReferenceType(type);
            default:
                return false;
        }
    }

    /** The supertype the reference type names, made nullable where the type is, or null where it names none or is no reference type. */
    getSupertype(type) {
        const declared = this.getTypeDeclaration(type);

        if (declared?.kind !== 'reference' || declared.supertype === undefined) {
            return null;
        }

        const supertype = this.getDeclaredType(declared, declared.supertype);

        return type.isNullable ? supertype.toNullable() : supertype;
    }

    /**
     * Whether the value belongs to the reference type: where the `isInstance` of the type and of every supertype above it answers true, each asked in turn until one answers false, on every call, no answer kept.
     * An exception it throws (NEXO5027) and an answer that isn't a Boolean (NEXO5017) are faults of the module that declares the type, naming what asked.
     * @param {unknown} value
     * @param {Type} type
     * @param {string} asked What asked whether the value belongs, as a message names it.
     */
    belongsTo(value, type, asked) {
        for (let current = type.toNonNullable(); current !== null; current = this.getSupertype(current)) {
            const declared = this.getTypeDeclaration(current);
            const location = { module: this.getDeclaringModuleName(declared), declaration: declared.name };
            let answer;

            try {
                answer = declared.isInstance(value);
            } catch (error) {
                throw NexoErrors.evaluation('NEXO5027', `The isInstance of ${current} threw as ${asked} asked whether a value belongs to it`, location, { cause: error });
            }

            if (typeof answer !== 'boolean') {
                throw NexoErrors.evaluation('NEXO5017', `The isInstance of ${current} answered what isn't a Boolean as ${asked} asked whether a value belongs to it`, location);
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
     * and one the value doesn't belong to (NEXO5002), and an exception `typeOf` throws (NEXO5026), are faults of the module, naming what asked.
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
                throw NexoErrors.evaluation('NEXO5026', `The typeOf of the module '${module.name}' threw as ${asked} asked for a value's type`, { module: module.name }, { cause: error });
            }

            if (name === null || name === undefined) {
                continue;
            }

            const type = typeof name === 'string' ? Type.createNamedType(name, false, module.name) : null;
            const declaration = type === null ? undefined : this.getTypeDeclaration(type);
            const declared = declaration?.kind === 'reference' ? declaration : undefined;

            if (declared === undefined || declared.abstract === true || declared.internal === true || !this.belongsTo(value, type, asked)) {
                const wrong = declared === undefined ? `${JSON.stringify(name) ?? String(name)}, which is no reference type of its own` : declared.abstract === true ? `the abstract type ${name}` : declared.internal === true ? `the internal type ${name}, which no script names` : `${name}, which the value doesn't belong to`;

                throw NexoErrors.evaluation('NEXO5002', `The typeOf of the module '${module.name}' named ${wrong}, as ${asked} asked for a value's type`, { module: module.name });
            }

            recognized.push(type);
        }

        return recognized;
    }

    /**
     * The types a type name names in its scope, a declaration's, a declared binding's or a script's, the one path each reads, its own refusals its caller's. A qualified name, `Q.Name`, names the type of its local name
     * the module `Q` names declares, `Q` the local name an import of the scope gives a module or, in a scope naming modules by their own names, a registered module's, and its answer holds that module, undefined where
     * `Q` names none. An unqualified name names the types of the first of the scope's tiers that holds any: a type import's of that local name, then the declaring module's own type, then Nexo's own, then those the
     * modules the scope imports declare, in the order they were registered; in a scope reaching every module, Nexo's own and every module's alike. Internal types are among them, and an extension, which no type name
     * names, is none.
     * @param {string} name
     * @param {import('./TypeNameScope.mjs').TypeNameScope} scope
     * @returns {{ moduleName?: string, types: Type[] }}
     */
    resolveTypeName(name, scope) {
        const dot = name.indexOf('.');

        if (dot !== -1) {
            const localName = name.slice(dot + 1);
            const moduleName = this.#moduleQualifiedBy(name.slice(0, dot), scope);

            return { moduleName, types: moduleName !== undefined && this.#declaresType(moduleName, localName) ? [Type.createNamedType(localName, false, moduleName)] : [] };
        }

        return { types: this.#typesNamedIn(name, scope) };
    }

    /** The module a type name's qualifier names in the scope: the one an import of it gives the qualifier as its local name, else, in a scope naming modules by their own names, the registered module of that name. */
    #moduleQualifiedBy(qualifier, scope) {
        const imported = scope.imports.find(entry => Imports.isModuleImport(entry) && Imports.localNameOf(entry) === qualifier);

        if (imported !== undefined) {
            return imported.module;
        }

        return scope.namesModulesByOwnName && (this.#modules.has(qualifier) || this.#pending?.module.name === qualifier) ? qualifier : undefined;
    }

    /** The types an unqualified name names in the scope, its first tier that holds any. */
    #typesNamedIn(name, scope) {
        const own = Vocabulary.builtInTypeNames.includes(name) ? [Type.createNamedType(name)] : [];

        if (scope.reachesEveryModule) {
            return [...own, ...this.getModuleNamesDeclaringType(name).map(moduleName => Type.createNamedType(name, false, moduleName))];
        }

        const typeImports = scope.imports.filter(entry => !Imports.isModuleImport(entry) && Imports.localNameOf(entry) === name && this.getModuleType(entry.module, entry.type)?.kind !== 'extension');

        if (typeImports.length > 0) {
            return typeImports.map(entry => Type.createNamedType(entry.type, false, entry.module));
        }

        if (scope.declaringModule !== null && this.#declaresType(scope.declaringModule, name)) {
            return [Type.createNamedType(name, false, scope.declaringModule)];
        }

        if (own.length > 0) {
            return own;
        }

        const imported = new Set(scope.imports.filter(entry => Imports.isModuleImport(entry)).map(entry => entry.module));

        return this.getModuleNamesDeclaringType(name).filter(moduleName => imported.has(moduleName)).map(moduleName => Type.createNamedType(name, false, moduleName));
    }

    /**
     * Returns the structured type's data properties and their types, in declaration order, or null if the supplied type does not name a structured type; a structured type of no data properties answers an empty map.
     * The map is kept in the data-shape cache.
     * @returns {ReadonlyMap<string, Type> | null}
     */
    getDataShape(type) {
        const structure = this.getTypeDeclaration(type);

        if (structure?.kind !== 'structured') {
            return null;
        }

        let shape = this.#dataShapeCache.get(structure);

        if (shape === undefined) {
            shape = new Map(NexoRegistry.#dataPropertiesOf(structure).map(property => [property.name, this.getDeclaredType(property, property.result)]));
            this.#dataShapeCache.set(structure, shape);
        }

        return shape;
    }

    /** The types of the data properties of the name, across every structured type, as each declares it. */
    getDataPropertyTypes(propertyName) {
        return [...this.#types.values()]
            .filter(type => type.kind === 'structured')
            .flatMap(type => NexoRegistry.#dataPropertiesOf(type).filter(property => property.name === propertyName).map(property => this.getDeclaredType(property, property.result)));
    }

    /** The properties the structured type declares directly without updates, its data shape, in the order it declares them. */
    static #dataPropertiesOf(structure) {
        return (structure.members ?? []).filter(member => member.kind === 'property' && member.updates === undefined);
    }

    /** The type or the extension the registered module declares under the local name, as its `types` hold it, or undefined where it declares none. */
    getModuleType(moduleName, name) {
        return this.#types.get(`${moduleName}.${name}`) ?? this.#extensions.get(`${moduleName}.${name}`);
    }

    /** The names of the registered modules that declare a type of the local name, in the order they were registered. */
    getModuleNamesDeclaringType(name) {
        return [...this.#modules.keys()].filter(moduleName => this.#types.has(`${moduleName}.${name}`));
    }

    /** The type selector declared so, or undefined. */
    getTypeSelector(name) {
        return this.#typeSelectors.get(name);
    }

    /** The mapping of the key in the selector, or undefined where the selector maps none. */
    getMapping(selector, key) {
        return this.#mappings.get(selector)?.get(key);
    }

    /** The type of observation declared so, or undefined. */
    getObservationType(name) {
        return this.#observationTypes.get(name);
    }

    /** The operators of the name, `cast` or `convert`, across every module, in the order registered, each within the type or the extension whose receiver it is invoked on. */
    getOperators(name) {
        return this.#operators.get(name) ?? [];
    }

    /** The type an operator answers, its destination, which selects it beside its receiver's type. */
    getOperatorDestination(declaration) {
        return this.getDeclaredType(declaration, declaration.result);
    }

    /** How a message names an operator: its receiver's type and its destination, by the syntax that invokes it, as `String to Number` and `Meter as Device`. */
    formatOperator(declaration) {
        return `${this.getReceiverTypes(declaration)[0]} ${declaration.name === 'cast' ? 'as' : 'to'} ${declaration.result}`;
    }

    /** Whether the type is one a conversion converts between: a type of data Nexo defines, or a structured type that holds data alone, never null. */
    isConvertible(type) {
        return type.kind === 'named' && type.typeArguments.length === 0 && !type.isNullable && this.isData(type);
    }

    /** The name of the module that declares the declaration: a member, an operator among them, a type, an extension, a type selector, a mapping or an observation type. */
    getDeclaringModuleName(declaration) {
        return this.#declaringModules.get(declaration)?.moduleName;
    }

    /** The implementation that carries the declaration out, its `impl`, or undefined where its module gives it none. */
    getImplementation(declaration) {
        return declaration.impl;
    }

    /** Whether the module, registered or being registered, declares a value type of the local name. */
    #declaresType(moduleName, name) {
        return this.getTypeDeclaration(Type.createNamedType(name, false, moduleName)) !== undefined;
    }

    /**
     * The type the notation writes in its context, each name resolved to its identity: a qualified name to the type its module declares; an unqualified one to a type of the declaring module, one of Nexo's own types,
     * or the one type of its name among the modules a structured type imports, refusing one that several imported modules declare and one outside them, which is named qualified.
     */
    #resolveNotation(notation, context, fail) {
        // A name the declaration's scope declares is that parameter, and any other names a type, whatever its length.
        const scope = context.typeParameters;
        const resolve = type => {
            if (type.kind === 'typeParameter' && type.name !== '@selected' && !scope.has(type.name)) {
                return Type.createNamedType(type.name, type.isNullable, this.#moduleOfType(type, notation, context, fail));
            }

            if (scope.has(type.name) && type.kind === 'named' && type.typeArguments.length === 0) {
                return Type.createTypeParameter(type.name, type.isNullable);
            }

            switch (type.kind) {
                case 'object':
                    return Type.createObjectType(new Map([...type.fieldTypes].map(([name, fieldType]) => [name, resolve(fieldType)])), type.isNullable);
                // A generic value type is Nexo's own, and its type arguments are resolved in turn, a dictionary's key one of a key type.
                case 'named': {
                    if (type.typeArguments.length === 0) {
                        return Type.createNamedType(type.name, type.isNullable, this.#moduleOfType(type, notation, context, fail));
                    }

                    const typeArguments = type.typeArguments.map(resolve);

                    if (type.isDictionary && !this.isKeyType(typeArguments[0])) {
                        fail('NEXO4563', `'${notation}' names a dictionary whose keys are ${typeArguments[0]}, and a key is a number, a string, a Boolean, a reference or null, which Nexo's key equality compares exactly`);
                    }

                    return new Type('named', { name: type.name, typeArguments, isNullable: type.isNullable });
                }
                default:
                    return type;
            }
        };

        return resolve(Type.parse(notation));
    }

    /**
     * The type a binding's declared notation writes, each name in it read as a declared binding's is, in the binding scope, every registered module's public types alike: a name no type is (NEXO2036), one several types
     * share unqualified (NEXO2037), a notation that is none, and a dictionary keyed by no key type (NEXO2044), are given to `fail`, which throws, with the code and the message. It reads no script's imports.
     * @param {string} notation
     * @param {(code: string, message: string) => never} fail
     */
    resolveBindingType(notation, fail) {
        // A notation that writes no type parses to none.
        const parsed = Type.parse(notation);

        if (parsed === null) {
            fail('NEXO2044', `${JSON.stringify(notation)} is no type's notation`);
        }

        const resolve = type => {
            switch (type.kind) {
                case 'object':
                    return Type.createObjectType(new Map([...type.fieldTypes].map(([name, fieldType]) => [name, resolve(fieldType)])), type.isNullable);
                case 'named':
                case 'typeParameter': {
                    if (type.kind === 'named' && type.typeArguments.length > 0) {
                        const typeArguments = type.typeArguments.map(resolve);

                        if (type.isDictionary && !this.isKeyType(typeArguments[0])) {
                            fail('NEXO2044', `${notation} names a dictionary whose keys are ${typeArguments[0]}, and a key is a number, a string, a Boolean, a reference or null`);
                        }

                        return new Type('named', { name: type.name, typeArguments, isNullable: type.isNullable });
                    }

                    const { types } = this.resolveTypeName(type.moduleName === null ? type.name : `${type.moduleName}.${type.name}`, TypeNameScope.bindingScope);

                    if (types.length === 0) {
                        fail('NEXO2036', `${notation} names ${type.moduleName === null ? type.name : `${type.moduleName}.${type.name}`}, which is no public type`);
                    }

                    if (types.length > 1) {
                        fail('NEXO2037', `${notation} names ${type.name}, which is several types' name, so it is named qualified: ${types.map(found => found.toString(true)).join(' or ')}`);
                    }

                    return type.isNullable ? types[0].toNullable() : types[0];
                }
                default:
                    return type;
            }
        };

        return resolve(parsed);
    }

    /** The name of the module that declares the named type, null for one of Nexo's own types, as its declaration's scope resolves it. */
    #moduleOfType(type, notation, context, fail) {
        const { name } = type;
        const { moduleName, types } = this.resolveTypeName(type.moduleName === null ? name : `${type.moduleName}.${name}`, TypeNameScope.createDeclarationScope(context.moduleName, context.imports));

        if (type.moduleName !== null) {
            if (moduleName === undefined) {
                fail('NEXO4047', `'${notation}' names the type '${type.identity}', and no module named '${type.moduleName}' is registered`);
            }

            if (types.length === 0) {
                fail('NEXO4047', `'${notation}' names the type '${type.identity}', which the module '${type.moduleName}' does not declare`);
            }

            return type.moduleName;
        }

        // Only the imported modules' tier holds several types, Nexo's own and the declaring module's one each.
        if (types.length > 1) {
            fail('NEXO4048', `'${notation}' names the type '${name}', which the modules it imports each declare, so it is named qualified: ${types.map(found => `${found.moduleName}.${name}`).join(' or ')}`);
        }

        if (types.length === 1) {
            return types[0].moduleName;
        }

        const foreign = this.getModuleNamesDeclaringType(name);

        if (foreign.length > 0) {
            fail('NEXO4049', `'${notation}' names the type '${name}', which only another module declares, so it is named qualified: ${foreign.map(moduleName => `${moduleName}.${name}`).join(' or ')}`);
        }

        fail('NEXO4047', `'${notation}' names the type '${name}', which neither Nexo nor a module registered with it declares`);
    }

    /**
     * Refuses a type selector named already, by this module or one registered before it; a key of a selector neither declares; a key its selector maps already, which is never replaced; and a parameter that selects a type
     * through a selector neither declares.
     */
    static #validateTypeSelections(module, members, typeSelectors, mappings, getDeclaringModuleName, fail, failAt) {
        for (const selector of module.typeSelectors) {
            if (typeSelectors.has(selector.name)) {
                fail('NEXO4007', `The type selector '${selector.name}' is declared already, by the module '${getDeclaringModuleName(typeSelectors.get(selector.name))}'`, selector.name, 'name');
            }
        }

        const isDeclared = name => typeSelectors.has(name) || module.typeSelectors.some(selector => selector.name === name);

        module.mappings.forEach(mapping => {
            if (!isDeclared(mapping.selector)) {
                fail('NEXO4039', `The key '${mapping.key}' belongs to the type selector '${mapping.selector}', which no module registered declares`, mapping.key, 'selector');
            }

            // A key its own module maps twice is refused when the module is created.
            const registered = mappings.get(mapping.selector)?.get(mapping.key);

            if (registered !== undefined) {
                fail('NEXO4038', `The type selector '${mapping.selector}' maps the key '${mapping.key}' already, as the module '${getDeclaringModuleName(registered)}' declared it, and a key is never replaced`, mapping.key, 'key');
            }
        });

        for (const declaration of members) {
            for (const parameter of declaration.parameters.filter(candidate => candidate.selects === 'type')) {
                if (!isDeclared(parameter.selector)) {
                    failAt(declaration)('NEXO4547', `The parameter '${parameter.name}' selects a type through '${parameter.selector}', which no module registered declares`, declaration.name, 'parameters');
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
            if (type.supertype !== undefined) {
                this.getDeclaredType(type, type.supertype);
            }

            if (type.kind === 'extension') {
                this.getDeclaredType(type, type.target);
            }
        }

        module.mappings.forEach(mapping => this.getDeclaredType(mapping, mapping.type));

        // A member's receiver is the type it is declared within, or its extension's target, resolved with the extension; an operator's result is its destination.
        for (const declaration of members) {
            if (declaration.result !== undefined) {
                this.getDeclaredType(declaration, declaration.result);
            }

            for (const parameter of declaration.parameters) {
                [parameter.type, ...(parameter.parameterTypes ?? [])].forEach(notation => this.getDeclaredType(declaration, notation));
            }
        }

    }

    /** Refuses, every notation resolved, a supertype that is no reference type, a cycle of supertypes, a tolerance on a result that holds no number, and a default its parameter's type does not admit. */
    #validateDeclaredTypes(module, members, fail, failAt) {
        for (const type of module.types.filter(declared => declared.kind === 'extension')) {
            const target = this.getDeclaredType(type, type.target);
            const isOwnType = target.kind === 'named' && (target.moduleName === module.name || (target.moduleName === null && module === Vocabulary.module));

            // A type its module owns takes its members in its own declaration, so an extension's target is another module's.
            if (isOwnType) {
                fail('NEXO4045', `The extension '${type.name}' targets ${target}, a type its own module owns, which takes its members within its own declaration`, type.name, 'target');
            }

            // An extension's indexers are named, read after ':' as its other members are, and brackets after a value alone read its type's owner's unnamed indexer.
            if (type.members.some(member => member.kind === 'indexer' && member.name === undefined)) {
                fail('NEXO4564', `The extension '${type.name}' declares an indexer without a name, and an extension's indexers are named, since brackets alone read the receiver's owner's indexer: name it, and read it as 'receiver:name[key]'`, type.name, 'members');
            }
        }

        for (const type of module.types) {
            // A supertype is a reference type, one the module declares or one a module registered before it declares.
            if (type.supertype !== undefined && !this.isReferenceType(this.getDeclaredType(type, type.supertype))) {
                fail('NEXO4016', `The supertype of '${type.name}', ${type.supertype}, is no reference type`, type.name, 'supertype');
            }
        }

        // A module registered before names none of this module's types, so a hierarchy that cycles does within the module.
        for (const type of module.types.filter(declared => declared.supertype !== undefined)) {
            const visited = [type.name];

            for (let current = this.getSupertype(Type.createNamedType(type.name, false, module.name)); current !== null && current.moduleName === module.name; current = this.getSupertype(current)) {
                if (visited.includes(current.name)) {
                    fail('NEXO4050', `The hierarchy of '${type.name}' is a cycle: ${[...visited, current.name].join(' beneath ')}`, type.name, 'supertype');
                }

                visited.push(current.name);
            }
        }

        for (const declaration of members) {
            // A host call that supplies nothing declares no result.
            const resultType = declaration.result === undefined ? null : this.getDeclaredType(declaration, declaration.result);

            // A tolerance applies to a numeric result, or to the numbers a structured result holds, which only now, every type known, is told apart from a reference type; a member with updates always declares a result.
            if (declaration.updates?.tolerance !== undefined && !(resultType.kind === 'named' && ((resultType.moduleName === null && resultType.name === 'Number') || this.getTypeDeclaration(resultType)?.kind === 'structured'))) {
                failAt(declaration)('NEXO4026', 'A tolerance applies to a numeric result, or to the numbers a structured result holds, and this result holds neither', declaration.name, 'updates.tolerance');
            }

            for (const parameter of declaration.parameters) {
                const type = this.getDeclaredType(declaration, parameter.type);

                if (Object.hasOwn(parameter, 'default') && !this.#admits(parameter.default, type)) {
                    failAt(declaration)('NEXO4548', `The default of '${parameter.name}' is no ${parameter.type}`, declaration.name);
                }
            }
        }
    }

    /**
     * Refuses a member its module declares already on the same receiver type, an exact duplicate, and a second unnamed indexer of one module for a receiver type; a module member of a name its module declares already is
     * refused when the module is created, and one beside a member of its name on a receiver registers, as the namespace reaches both. Declarations of different modules never collide here, competing extensions among them:
     * each registers, and an access is resolved by the owner of its receiver's type and the specificity of its extensions, refused where it can't choose.
     */
    #validateMemberCollisions(members, failAt) {
        // Two of one module's members on overlapping receivers, as a type and the type beneath it, both register, an access both take refused where it is resolved.
        members.forEach((declaration, index) => {
            const earlier = members.slice(0, index).filter(other => other.name === declaration.name && other.kind !== 'operator');
            const fail = failAt(declaration);

            // An operator collides by its destination too, which its own check reads.
            if (!this.takesReceiver(declaration) || declaration.kind === 'operator') {
                return;
            }

            if (NexoRegistry.#isUnnamedIndexer(declaration)) {
                for (const other of members.slice(0, index).filter(member => NexoRegistry.#isUnnamedIndexer(member) && !this.#areDisjointSignatures(member, declaration))) {
                    const shared = this.#getSharedReceiver(declaration, other);

                    if (shared !== undefined) {
                        fail('NEXO4068', `An unnamed indexer of ${shared} is declared already, and a second is one of its signatures only within its type, taking a key of a type of its own`, undefined, 'kind');
                    }
                }

                return;
            }

            const shared = earlier.filter(other => this.takesReceiver(other) && !this.#areDisjointSignatures(other, declaration)).map(other => this.#getSharedReceiver(other, declaration)).find(notation => notation !== undefined);

            if (shared !== undefined) {
                fail('NEXO4029', `'${declaration.name}' is declared already for ${shared}${declaration.kind === 'indexer' ? ', and an indexer of its name is one of its signatures only within its type, taking a key of a type of its own' : ''}`, declaration.name, 'name');
            }
        });
    }

    /**
     * Refuses a declaration that names another module's internal type, as a supertype, an extension's target, a parameter's, a callback's, a result's, an operator's destination or a mapping's type (NEXO4018), and a
     * public declaration that exposes an internal type of its own module through what it writes of them (NEXO4052): a type's supertype, an extension's target, a member's parameters', callbacks' and result's types, an
     * operator's destination among them, and a mapping's type, through list items and nullable types. A member within an internal type, and an internal one, is no public declaration; within one module, declarations name each other's internal declarations freely.
     */
    #validateAccessibility(module, members, fail, failAt) {
        const writtenTypesOf = declaration => {
            if (module.types.includes(declaration)) {
                return [...(declaration.supertype === undefined ? [] : [declaration.supertype]), ...(declaration.kind === 'extension' ? [declaration.target] : [])];
            }

            if (module.mappings.includes(declaration)) {
                return [declaration.type];
            }

            return [...(declaration.result === undefined ? [] : [declaration.result]), ...declaration.parameters.flatMap(parameter => [parameter.type, ...(parameter.parameterTypes ?? [])])];
        };
        const namedTypesOf = type => {
            if (type.kind === 'object') {
                return [...type.fieldTypes.values()].flatMap(namedTypesOf);
            }

            if (type.kind !== 'named') {
                return [];
            }

            return [...(type.moduleName === null ? [] : [type]), ...type.typeArguments.flatMap(namedTypesOf)];
        };

        for (const declaration of [...module.types, ...members, ...module.mappings]) {
            const failHere = members.includes(declaration) ? failAt(declaration) : fail;
            const name = module.mappings.includes(declaration) ? declaration.key : declaration.name;

            for (const type of writtenTypesOf(declaration).flatMap(notation => namedTypesOf(this.getDeclaredType(declaration, notation)))) {
                if (this.getTypeDeclaration(type)?.internal !== true) {
                    continue;
                }

                if (type.moduleName !== module.name) {
                    failHere('NEXO4018', `It names ${type.identity}, an internal type of the module '${type.moduleName}', which its own module's declarations alone name`, name);
                }

                if (!this.isInternal(declaration)) {
                    failHere('NEXO4052', `It is public, and exposes ${type.name}, an internal type of its module: a public declaration writes public types alone`, name);
                }
            }
        }
    }

    /**
     * Refuses a type parameter named as a type its declaration reaches unqualified, one of Nexo's own, `Any` and `Never` among them, one of its module's, or one of a module its type imports (NEXO4042); a member whose
     * result writes a parameter with no supported source to bind it from, its extension's target or its generic type's receiver, its value parameters' types or its callbacks' results (NEXO4011); and a member whose
     * callback's input writes a parameter whose only source is another callback's result, since callback results do not chain (NEXO4044).
     */
    #validateTypeParameters(module, members, fail, failAt) {
        const parametersOf = (declaration, notation) => NexoRegistry.#typeParametersWrittenBy(this.getDeclaredType(declaration, notation));
        const isReachable = (declaration, name) => {
            const { moduleName, imports } = this.#declaringModules.get(declaration);

            return Vocabulary.ownTypeNames.includes(name) || this.#declaresType(moduleName, name) || imports.some(imported => this.#declaresType(imported, name));
        };

        for (const declaration of [...module.types.filter(type => type.kind === 'extension'), ...members]) {
            const reached = (declaration.typeParameters ?? []).find(name => isReachable(declaration, name));

            if (reached !== undefined) {
                (members.includes(declaration) ? failAt(declaration) : fail)('NEXO4042', `The type parameter '${reached}' is named as a type its declaration reaches unqualified, so a parameter of its name would hide it`, declaration.name, 'name');
            }
        }

        for (const declaration of members) {
            // A receiver binds the parameters its extension's target writes, or those of the generic type the member is declared within.
            const type = this.#containingTypes.get(declaration);
            const fromTarget = type?.kind === 'extension' ? parametersOf(type, type.target) : new Set(type?.typeParameters ?? []);
            const fromValues = new Set(declaration.parameters.filter(parameter => parameter.kind === 'value').flatMap(parameter => [...parametersOf(declaration, parameter.type)]));
            const callbacks = declaration.parameters.filter(parameter => parameter.kind === 'function' || parameter.kind === 'expression');
            const fromCallbacks = new Set(callbacks.flatMap(parameter => [...parametersOf(declaration, parameter.type)]));
            const unbound = declaration.result === undefined ? undefined : [...parametersOf(declaration, declaration.result)].find(name => name !== '@selected' && !fromTarget.has(name) && !fromValues.has(name) && !fromCallbacks.has(name));
            const fail = failAt(declaration);

            if (unbound !== undefined) {
                fail('NEXO4011', `Its result writes the type parameter '${unbound}', which nothing binds: neither its extension's target, its value parameters' types nor its callbacks' results write it`, declaration.name, 'result');
            }

            for (const callback of callbacks.filter(parameter => parameter.kind === 'function')) {
                const chained = callback.parameterTypes.flatMap(notation => [...parametersOf(declaration, notation)]).find(name => !fromTarget.has(name) && !fromValues.has(name));

                if (chained !== undefined) {
                    fail('NEXO4044', `The callback '${callback.name}' is called with the type parameter '${chained}', which only another callback's result binds, and callback results do not chain`, declaration.name, 'parameters');
                }
            }
        }
    }

    /** The names of the type parameters the type writes, anywhere in it: its own, its type arguments' and its object fields'. */
    static #typeParametersWrittenBy(type) {
        if (type.kind === 'typeParameter') {
            return new Set([type.name]);
        }

        const parts = [...type.typeArguments, ...(type.fieldTypes === null ? [] : type.fieldTypes.values())];

        return new Set(parts.flatMap(part => [...NexoRegistry.#typeParametersWrittenBy(part)]));
    }

    /**
     * Refuses an operator its receiver and its destination don't admit: a conversion between types that are not data, as each is named (NEXO4065), from a type to itself (NEXO4066), and between types none of which
     * its module owns (NEXO4028), Nexo's own module alone converting between the language's types; a cast on or to a type that is no reference type (NEXO4027), and one between types of one hierarchy, which the
     * hierarchy decides (NEXO4064); and an operator of a name and a destination its module declares already on its receiver type (NEXO4069).
     */
    #validateOperators(module, members, failAt) {
        const operators = members.filter(declaration => declaration.kind === 'operator');

        operators.forEach((operator, index) => {
            const fail = failAt(operator);
            const [source] = this.getReceiverTypes(operator);
            const destination = this.getOperatorDestination(operator);

            if (operator.name === 'convert') {
                for (const [type, end] of [[source, 'its receiver'], [destination, 'its destination']]) {
                    if (!this.isConvertible(type)) {
                        fail('NEXO4065', `A conversion operator is from a type of data to another, each named as it is declared, Number, String, Boolean or a structured type holding data alone, and ${end}, ${type}, is none of them`, operator.name, type === source ? 'kind' : 'result');
                    }
                }

                if (source.equals(destination)) {
                    fail('NEXO4066', `A value already of ${source} converts to itself, so no conversion operator is declared from a type to itself`, operator.name, 'result');
                }

                if (module !== Vocabulary.module && source.moduleName !== module.name && destination.moduleName !== module.name) {
                    fail('NEXO4028', `A conversion operator converts to or from one of its module's own types, and ${this.formatOperator(operator)} does neither`, operator.name, 'result');
                }
            } else {
                if (!this.isReferenceType(source) || !this.isReferenceType(destination)) {
                    fail('NEXO4027', `A cast operator is declared on a reference type and casts to another, and ${this.formatOperator(operator)} is not`, operator.name, this.isReferenceType(source) ? 'result' : 'kind');
                }

                // A type and its supertypes and the types beneath it are cast through their hierarchy, which needs no operator.
                if (this.#typeChecker.isAssignable(source, destination) || this.#typeChecker.isAssignable(destination, source)) {
                    fail('NEXO4064', `${this.formatOperator(operator)} is a cast within one hierarchy, which the hierarchy decides, so no cast operator is declared for it`, operator.name, 'result');
                }
            }

            const isDeclaredEarlier = operators.slice(0, index).some(other => other.name === operator.name && this.getReceiverTypes(other)[0].equals(source) && this.getOperatorDestination(other).equals(destination));

            if (isDeclaredEarlier) {
                fail('NEXO4069', `The operator ${this.formatOperator(operator)} is declared already on ${source}`, operator.name, 'result');
            }
        });
    }

    /**
     * Whether values of the type are data: Number, String, Boolean, null and never; a list or another generic value type of data; an object type of data; and a structured type whose data shape holds data.
     * It classifies a type, and validates no JavaScript value: whether a value is data of a type is a separate check, as a default's and a supplied value's are. Being data does not make a type a conversion's endpoint,
     * which module creation and `isConvertible` decide apart.
     */
    isData(type) {
        return this.#isData(type, new Set(), false);
    }

    /**
     * Whether the declaration gives a script a value of `Any`, the one way such a value reaches an evaluation: through its result, the arguments a function parameter's callback is called with, and, for a member
     * whose fixed argument selects its result's type, the type of any key its selector maps; each through lists, dictionaries, pairs, objects and a structure's data shape. A parameter's own type gives the script
     * nothing, since the script supplies its argument and the member receives it.
     */
    givesAny(declaration) {
        const notations = [declaration.result, ...(declaration.parameters ?? []).flatMap(parameter => parameter.parameterTypes ?? [])].filter(notation => notation !== undefined);
        const selector = (declaration.parameters ?? []).find(parameter => parameter.selects === 'type')?.selector;
        const selected = selector === undefined ? [] : [...(this.#mappings.get(selector)?.values() ?? [])].map(mapping => this.getDeclaredType(mapping, mapping.type));

        return [...notations.map(notation => this.getDeclaredType(declaration, notation)), ...selected].some(type => this.#holdsAny(type, new Set()));
    }

    /**
     * Whether the type holds a nullable reference type anywhere: itself, a type argument, an object field, or a property of a structure's data shape, a structure already being walked counting as holding none. Capturing
     * a supplied value recognizes it there alone, telling a reference of another type, which is null, from mistyped data.
     */
    holdsNullableReference(type) {
        return this.#holdsNullableReference(type, new Set());
    }

    #holdsNullableReference(type, walking) {
        switch (type.kind) {
            case 'object':
                return [...type.fieldTypes.values()].some(fieldType => this.#holdsNullableReference(fieldType, walking));
            case 'named': {
                if (type.typeArguments.length > 0) {
                    return type.typeArguments.some(typeArgument => this.#holdsNullableReference(typeArgument, walking));
                }

                if (this.isReferenceType(type)) {
                    return type.isNullable;
                }

                const shape = this.getDataShape(type);

                if (shape === null || walking.has(type.identity)) {
                    return false;
                }

                walking.add(type.identity);

                return [...shape.values()].some(propertyType => this.#holdsNullableReference(propertyType, walking));
            }
            default:
                return false;
        }
    }

    /**
     * Whether a value of the type may hold a reference anywhere: the type is a reference type, `Any` or a type parameter, or a type argument, an object field or a property of a structure's data shape is, a structure
     * already being walked counting as holding none. Checking a value of a type that holds none asks no type's membership.
     */
    mayHoldReference(type) {
        return this.#mayHoldReference(type, new Set());
    }

    #mayHoldReference(type, walking) {
        switch (type.kind) {
            case 'any':
            case 'typeParameter':
                return true;
            case 'object':
                return [...type.fieldTypes.values()].some(fieldType => this.#mayHoldReference(fieldType, walking));
            case 'named': {
                if (type.typeArguments.length > 0) {
                    return type.typeArguments.some(typeArgument => this.#mayHoldReference(typeArgument, walking));
                }

                if (this.isReferenceType(type)) {
                    return true;
                }

                const shape = this.getDataShape(type);

                if (shape === null || walking.has(type.identity)) {
                    return false;
                }

                walking.add(type.identity);

                return [...shape.values()].some(propertyType => this.#mayHoldReference(propertyType, walking));
            }
            default:
                return false;
        }
    }

    /** Whether the type holds `Any` anywhere: itself, a type argument, an object field, or a property of a structure's data shape, a structure already being walked counting as holding none, since its properties are walked where it is first met. */
    #holdsAny(type, walking) {
        switch (type.kind) {
            case 'any':
                return true;
            case 'object':
                return [...type.fieldTypes.values()].some(fieldType => this.#holdsAny(fieldType, walking));
            case 'named': {
                if (type.typeArguments.length > 0) {
                    return type.typeArguments.some(typeArgument => this.#holdsAny(typeArgument, walking));
                }

                const shape = this.getDataShape(type);

                if (shape === null || walking.has(type.identity)) {
                    return false;
                }

                walking.add(type.identity);

                return [...shape.values()].some(propertyType => this.#holdsAny(propertyType, walking));
            }
            default:
                return false;
        }
    }

    /** Whether values of the type are data, as `isData` says, or are once each value of `Any` among them is checked as it is evaluated, which a result holding one asks for. */
    isDataOnceChecked(type) {
        return this.#isData(type, new Set(), true);
    }

    /**
     * Whether values of the type are data, as `isData` says, a structure already being checked counting as data where it holds itself, since its other properties are checked where it is first met, and a value of `Any`
     * where its check is to come.
     */
    #isData(type, checking, isAnyChecked) {
        switch (type.kind) {
            case 'null':
            case 'never':
                return true;
            case 'any':
                return isAnyChecked;
            case 'object':
                return [...type.fieldTypes.values()].every(fieldType => this.#isData(fieldType, checking, isAnyChecked));
            case 'named': {
                // A generic value type holds data where each of its type arguments does, as a list of data does.
                if (type.typeArguments.length > 0) {
                    return type.typeArguments.every(typeArgument => this.#isData(typeArgument, checking, isAnyChecked));
                }

                if ((type.moduleName === null && NexoModule.scalarTypeNames.includes(type.name)) || checking.has(type.identity)) {
                    return true;
                }

                if (this.getTypeDeclaration(type)?.kind !== 'structured') {
                    return false;
                }

                checking.add(type.identity);

                return [...this.getDataShape(type).values()].every(propertyType => this.#isData(propertyType, checking, isAnyChecked));
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
            // A type parameter's default is data, whatever the parameter binds to; whether it fits that binding is checked nowhere yet. A default of Any is any data.
            case 'typeParameter':
            case 'any':
                return NexoRegistry.#isDataValue(value);
            case 'named': {
                if (type.isList) {
                    return Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(item => this.#admits(item, type.itemType));
                }

                if (type.moduleName === null && type.name === 'Number') {
                    return Number.isFinite(value);
                }

                // The scalars beside a number, which is finite, are admitted by their JavaScript type.
                if (type.moduleName === null && NexoModule.scalarTypeNames.includes(type.name)) {
                    return typeof value === type.name.toLowerCase();
                }

                return this.getTypeDeclaration(type)?.kind === 'structured' && ObjectUtils.isNonArrayObject(value) && [...this.getDataShape(type)].every(([property, propertyType]) => this.#admits(value[property], propertyType));
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
            return ArrayUtils.findMissingIndex(value) === -1 && value.every(item => NexoRegistry.#isDataValue(item));
        }

        return ObjectUtils.isPlainObject(value) && Object.values(value).every(field => NexoRegistry.#isDataValue(field));
    }

    /**
     * Refuses an observation of a type no module declares; one of a target its observation type's module declares none of, one of a target found from the receiver for a member without one,
     * and a maintained one of a target of several; and a member that reads maintained values without a maintained observation, or any other that has one.
     */
    static #validateObservations(declaration, takesReceiver, observationTypes, getDeclaringModule, fail) {
        const { updates } = declaration;

        if (updates === undefined) {
            return;
        }

        let hasMaintained = false;

        for (const observationDeclaration of updates.observations) {
            const type = observationTypes.get(observationDeclaration.type);

            if (type === undefined) {
                fail('NEXO4060', `The observation type '${observationDeclaration.type}' is declared by no module`, declaration.name, 'updates.observations');
            }

            if (typeof observationDeclaration.of === 'string' && observationDeclaration.of !== 'receiver') {
                NexoRegistry.#validateObservedTarget(declaration, takesReceiver, observationDeclaration, type, getDeclaringModule(type), fail);
            }

            hasMaintained ||= type.contract === 'maintained';
        }

        if ((updates.reads === 'maintained') !== hasMaintained) {
            fail(updates.reads === 'maintained' ? 'NEXO4025' : 'NEXO4062', updates.reads === 'maintained' ? 'It reads maintained values, so it names a maintained observation' : 'It names a maintained observation, so it reads maintained values', declaration.name, 'updates');
        }
    }

    /** Validates an observation's reference to a target, not the target's own declaration, which creating its module validates: refuses a target its observation type's module does not declare, one found from the receiver for a member without one, and one of several for a maintained observation, which gives its member one sample. */
    static #validateObservedTarget(declaration, takesReceiver, observationDeclaration, type, declaringModule, fail) {
        const target = declaringModule.observationTargets.find(candidate => candidate.name === observationDeclaration.of);

        if (target === undefined) {
            fail('NEXO4024', `The observation '${type.name}' observes '${observationDeclaration.of}', and the module '${declaringModule.name}', which declares '${type.name}', declares no target of that name`, declaration.name, 'updates.observations');
        }

        if (target.from === 'receiver' && !takesReceiver) {
            fail('NEXO4057', `The observation '${type.name}' observes '${target.name}', a target found from the receiver, and a module member takes no receiver`, declaration.name, 'updates.observations');
        }

        if (type.contract === 'maintained' && target.count === 'many') {
            fail('NEXO4063', `The maintained observation '${type.name}' gives one sample, so it observes one target, never '${target.name}', a target of several`, declaration.name, 'updates.observations');
        }
    }

    /** The receiver type the one member is read on, as it is written, where the other is read on the same type, or undefined where they are read on different ones; a type and the type beneath it are two receiver types. */
    /**
     * Whether two indexers are signatures of one indexer: declared within one type or one extension, of one name or both unnamed, and taking keys of disjoint types, neither a type parameter nor `Any` and neither
     * assignable to the other, null among them where both admit it.
     */
    #areDisjointSignatures(one, other) {
        if (one.kind !== 'indexer' || other.kind !== 'indexer' || this.#containingTypes.get(one) !== this.#containingTypes.get(other)) {
            return false;
        }

        const [oneKey, otherKey] = [one, other].map(indexer => this.getDeclaredType(indexer, indexer.parameters[0].type));

        if ([oneKey, otherKey].some(key => key.kind === 'any' || key.kind === 'typeParameter') || (oneKey.isNullable && otherKey.isNullable)) {
            return false;
        }

        return !this.#typeChecker.fitsEitherWay(oneKey.toNonNullable(), otherKey.toNonNullable());
    }

    #getSharedReceiver(one, other) {
        const [mine] = this.getReceiverTypes(one);

        return this.getReceiverTypes(other).some(type => mine.equals(type)) ? this.#receiverNotationsOf(one)[0] : undefined;
    }
}
