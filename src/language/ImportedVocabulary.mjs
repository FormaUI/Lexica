/**
 * ImportedVocabulary — what a script's imports make available: the namespaces their local names begin, the types a script names, and the declarations it may select, Lexica's own always among them
 */

import { Imports } from './Imports.mjs';
import { Type } from './Type.mjs';
import { Vocabulary } from './vocabulary/Vocabulary.mjs';

export class ImportedVocabulary {
    /** The registry the imports name modules, types and extensions of. */
    #registry;

    /** The module each local name a module import gives names, by that local name. @type {Map<string, string>} */
    #namespaceModules = new Map();

    /** The names of the modules the script imports whole, under whichever local names. @type {Set<string>} */
    #importedModules = new Set();

    /** The type each local name a type import of an ordinary type gives names, by that local name; an extension's local name names no type. @type {Map<string, Type>} */
    #importedTypes = new Map();

    /** The types and the extensions the script imports by name, each a declaration whose members the import makes available. @type {Set<object>} */
    #importedDeclarations = new Set();

    /** The ordinary types the script imports by name and every supertype above each, whose members an imported type has as its own or inherits. @type {Set<object>} */
    #typeLineages = new Set();

    /**
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} registry The registry the imports name declarations of.
     * @param {readonly object[]} imports The script's imports, in a definition's shape, each naming a module the registry holds and, for a type import, a public type or extension it declares.
     */
    constructor(registry, imports) {
        this.#registry = registry;

        for (const entry of imports) {
            const localName = Imports.localNameOf(entry);

            if (Imports.isModuleImport(entry)) {
                this.#namespaceModules.set(localName, entry.module);
                this.#importedModules.add(entry.module);

                continue;
            }

            const declaration = registry.getModuleType(entry.module, entry.type);

            this.#importedDeclarations.add(declaration);

            if (declaration.kind !== 'extension') {
                const type = Type.createNamedType(entry.type, false, entry.module);

                this.#importedTypes.set(localName, type);

                for (let reached = type; reached !== null; reached = registry.getSupertype(reached)) {
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

    /** Whether the script imports the module whole, which makes its public vocabulary available. */
    importsModule(moduleName) {
        return this.#importedModules.has(moduleName);
    }

    /** The type the local name a type import gives names, its first tier; undefined where no type import gives it, an extension's import naming no type. */
    getImportedType(localName) {
        return this.#importedTypes.get(localName);
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
