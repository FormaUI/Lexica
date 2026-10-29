/**
 * TypeNameScope — where a type name is read, which decides the types it names: a declaration's, a declared binding's or a script's, each its declaring module, its imports and whether it reaches every module
 */

export class TypeNameScope {
    /** The module whose own types the scope's unqualified names find before any other but a type import's, or null where none declares the name being read. @type {string | null} */
    #declaringModule;

    /** The scope's imports, in a definition's shape, whose local names qualify a type name and whose types an unqualified one finds. @type {readonly object[]} */
    #imports;

    /** Whether an unqualified name finds every registered module's types alike, Nexo's own among them, as a declared binding's does. */
    #reachesEveryModule;

    /**
     * @param {string | null} declaringModule The module declaring the name being read, for a declaration's scope.
     * @param {readonly object[]} imports The scope's imports, in a definition's shape.
     * @param {boolean} reachesEveryModule Whether an unqualified name finds every registered module's types alike.
     */
    constructor(declaringModule, imports, reachesEveryModule) {
        this.#declaringModule = declaringModule;
        this.#imports = Object.freeze([...imports]);
        this.#reachesEveryModule = reachesEveryModule;
    }

    /** The scope of a declaration's notation: its module's own types, Nexo's, and those of the modules a structured type imports, a name qualified by any registered module's own name. */
    static createDeclarationScope(moduleName, importedModuleNames) {
        return new TypeNameScope(moduleName, importedModuleNames.map(module => Object.freeze({ module })), false);
    }

    /** The scope of a script's type names: its type imports' names first, then Nexo's own types, then its imported modules', a name qualified by the local name an import gives a module alone. */
    static createScriptScope(imports) {
        return new TypeNameScope(null, imports, false);
    }

    /** @type {TypeNameScope | undefined} */
    static #bindingScope;

    /** The scope of a binding's declared type: every registered module's public types alike, Nexo's own among them, a name qualified by any registered module's own name; a script's imports never take part. */
    static get bindingScope() {
        return TypeNameScope.#bindingScope ??= new TypeNameScope(null, [], true);
    }

    /** The module the scope's own types are read in, or null where the scope has none. */
    get declaringModule() {
        return this.#declaringModule;
    }

    /** The scope's imports, in a definition's shape. */
    get imports() {
        return this.#imports;
    }

    /** Whether an unqualified name finds every registered module's types alike. */
    get reachesEveryModule() {
        return this.#reachesEveryModule;
    }

    /** Whether a name qualified by a registered module's own name reaches that module where no import gives it, as a declaration's and a binding's scope do, and a script's, whose imports alone qualify, never does. */
    get namesModulesByOwnName() {
        return this.#declaringModule !== null || this.#reachesEveryModule;
    }
}
