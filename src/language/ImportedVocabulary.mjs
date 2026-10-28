/**
 * ImportedVocabulary — what a script's imports make available: the namespaces their local names begin, the types a script names, and the declarations it may select, Lexica's own always among them
 */

import { Imports } from './Imports.mjs';
import { Type } from './Type.mjs';
import { TypeNameScope } from './vocabulary/TypeNameScope.mjs';
import { Vocabulary } from './vocabulary/Vocabulary.mjs';

export class ImportedVocabulary {
    /** The registry the imports name modules, types and extensions of. */
    #registry;

    /** The module each local name a module import gives names, by that local name. @type {Map<string, string>} */
    #namespaceModules = new Map();

    /** The names of the modules the script imports whole, under whichever local names. @type {Set<string>} */
    #importedModules = new Set();

    /** The scope the script's type names are read in, which its imports give. @type {TypeNameScope} */
    #typeNameScope;

    /** The types and the extensions the script imports by name, each a declaration whose members the import makes available. @type {Set<object>} */
    #importedDeclarations = new Set();

    /** The ordinary types the script imports by name and every supertype above each, whose members an imported type has as its own or inherits. @type {Set<object>} */
    #typeLineages = new Set();

    /** The extension each local name a type import of an extension gives names, by that local name, which an extension access names it by first. @type {Map<string, object>} */
    #importedExtensions = new Map();

    /** The first local name a type import gives each type or extension it imports, by the declaration. @type {Map<object, string>} */
    #declarationLocalNames = new Map();

    /**
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} registry The registry the imports name declarations of.
     * @param {readonly object[]} imports The script's imports, in a definition's shape, each naming a module the registry holds and, for a type import, a public type or extension it declares.
     */
    constructor(registry, imports) {
        this.#registry = registry;
        this.#typeNameScope = TypeNameScope.createScriptScope(imports);

        for (const entry of imports) {
            const localName = Imports.localNameOf(entry);

            if (Imports.isModuleImport(entry)) {
                this.#namespaceModules.set(localName, entry.module);
                this.#importedModules.add(entry.module);

                continue;
            }

            const declaration = registry.getModuleType(entry.module, entry.type);

            this.#importedDeclarations.add(declaration);

            if (!this.#declarationLocalNames.has(declaration)) {
                this.#declarationLocalNames.set(declaration, localName);
            }

            if (declaration.kind === 'extension') {
                this.#importedExtensions.set(localName, declaration);
            }

            if (declaration.kind !== 'extension') {
                for (let reached = Type.createNamedType(entry.type, false, entry.module); reached !== null; reached = registry.getSupertype(reached)) {
                    this.#typeLineages.add(registry.getTypeDeclaration(reached));
                }
            }
        }
    }

    /** The local names the module imports give, each beginning its module's namespace where it stands in place of a value. */
    get namespaceNames() {
        return new Set(this.#namespaceModules.keys());
    }

    /** The name of the module the local name a module import gives names, or undefined where no module import gives it. */
    getNamespaceModule(localName) {
        return this.#namespaceModules.get(localName);
    }

    /** The local name the module imports give the module first, which a name the script writes qualified by it begins with, or undefined where the script imports it under none. */
    getNamespaceName(moduleName) {
        return [...this.#namespaceModules].find(([, module]) => module === moduleName)?.[0];
    }

    /** The names of the modules the script imports whole, whose public extensions an extension access names unqualified beside Lexica's own. */
    get importedModuleNames() {
        return [...this.#importedModules];
    }

    /** The extension the local name a type import gives names, which an extension access names it by before any module's of its name; undefined where no import of an extension gives it. */
    getImportedExtension(localName) {
        return this.#importedExtensions.get(localName);
    }

    /** The local name a type import gives the type or the extension, the first where several do, or undefined where none imports it by name. */
    getLocalNameOf(declaration) {
        return this.#declarationLocalNames.get(declaration);
    }

    /** Whether the script imports the module whole, which makes its public vocabulary available. */
    importsModule(moduleName) {
        return this.#importedModules.has(moduleName);
    }

    /** The scope the script's type names are read in: its type imports' names first, then Lexica's own types, then its imported modules', qualified by the local names its module imports give. */
    get typeNameScope() {
        return this.#typeNameScope;
    }

    /**
     * Whether the script's imports make the declaration available to select: one of Lexica's own, which every script has; one its declaring module's import makes available; one an imported extension declares; or one an
     * imported type declares within it, or a supertype above it does, which the imported type inherits. A module member is reached through its module's import alone.
     */
    makesAvailable(declaration) {
        const moduleName = this.#registry.getDeclaringModuleName(declaration);

        if (moduleName === Vocabulary.moduleName || this.#importedModules.has(moduleName)) {
            return true;
        }

        const containing = this.#registry.getContainingType(declaration);

        if (containing === undefined) {
            return false;
        }

        return containing.kind === 'extension' ? this.#importedDeclarations.has(containing) : this.#typeLineages.has(containing);
    }

    /** The declarations the script's imports make available, in the order given. */
    getAvailable(declarations) {
        return declarations.filter(declaration => this.makesAvailable(declaration));
    }
}
