/**
 * Imports — a script's imports in a definition's shape: the local name each gives, the imports a host supplies, checked as a definition's are, and the imports a definition records, each once, in order of the local name it gives
 */

import { LexicaErrors } from './LexicaError.mjs';
import { Names } from './Names.mjs';

/** The keys an import holds: its module, its type where it imports one, and its alias where it gives a local name other than its own. */
const IMPORT_KEYS = Object.freeze(['module', 'type', 'alias']);

export class Imports {
    /** The local name the import gives in its script: its alias, or else its type's name, or else its module's. */
    static localNameOf(entry) {
        return entry.alias ?? entry.type ?? entry.module;
    }

    /** Whether the import imports a module, whose local name begins its namespace, rather than one of its types. */
    static isModuleImport(entry) {
        return entry.type === undefined;
    }

    /** The local names the imports give modules, each beginning its module's namespace where it stands in place of a value. */
    static namespaceNamesOf(imports) {
        return new Set(imports.filter(entry => Imports.isModuleImport(entry)).map(entry => Imports.localNameOf(entry)));
    }

    /** Whether two imports import one declaration under one local name, which counts once. */
    static isSameImport(one, other) {
        return one.module === other.module && one.type === other.type && Imports.localNameOf(one) === Imports.localNameOf(other);
    }

    /** The import as text writes it: `import`, its alias and `=` where it has one, its module and, where it imports a type, a dot and the type's name, as `import Measures = Measurements`. */
    static quote(entry) {
        const source = entry.type === undefined ? entry.module : `${entry.module}.${entry.type}`;

        return entry.alias === undefined ? `import ${source}` : `import ${entry.alias} = ${source}`;
    }

    /** The imports, each once, in order of the local name it gives, the order a definition records them in, so the order they were written or supplied in decides nothing. */
    static mergeImports(...lists) {
        const merged = [];

        for (const entry of lists.flat()) {
            if (!merged.some(other => Imports.isSameImport(entry, other))) {
                merged.push(entry);
            }
        }

        return merged.sort((one, other) => Imports.#compareLocalNames(Imports.localNameOf(one), Imports.localNameOf(other)));
    }

    /** The two imports that give one local name to different declarations, the first such pair in order, or null where none do. */
    static findConflict(imports) {
        for (let index = 0; index < imports.length; index++) {
            const other = imports.slice(0, index).find(earlier => Imports.localNameOf(earlier) === Imports.localNameOf(imports[index]) && !Imports.isSameImport(earlier, imports[index]));

            if (other !== undefined) {
                return [other, imports[index]];
            }
        }

        return null;
    }

    /**
     * The imports a host supplies, each a module's name or an import in a definition's shape, as definition-shaped imports, each once, in order of the local name it gives. Each is checked as a definition's import is,
     * and two giving one local name to different declarations are refused, each with NEXO2008.
     * @param {unknown} supplied
     */
    static createSuppliedImports(supplied) {
        if (supplied === undefined) {
            return [];
        }

        if (!Array.isArray(supplied)) {
            throw LexicaErrors.structure('NEXO2008', "A host's imports are a list, each a module's name or an import, as { module: 'Home' }", {});
        }

        const imports = supplied.map(item => {
            const entry = typeof item === 'string' ? { module: item } : item;

            Imports.validateImport(entry, message => {
                throw LexicaErrors.structure('NEXO2008', `${message}, and the host supplies ${Imports.#describe(item)}`, {});
            });

            return Object.freeze(Object.fromEntries(IMPORT_KEYS.filter(key => entry[key] !== undefined).map(key => [key, entry[key]])));
        });
        const conflict = Imports.findConflict(imports);

        if (conflict !== null) {
            throw LexicaErrors.structure('NEXO2008', Imports.describeConflict(conflict), {});
        }

        return Imports.mergeImports(imports);
    }

    /**
     * Checks one import's shape, calling `fail` with why it breaks it: an object holding a module, an identifier other than Nexo's, a type where it imports one and an alias only where it differs from the local name the
     * import gives without one, each an identifier.
     */
    static validateImport(entry, fail) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !IMPORT_KEYS.includes(key))) {
            fail("An import holds its module, its type where it imports one, and its alias where it gives a local name other than its own");
        }

        if (!Names.isIdentifier(entry.module)) {
            fail("An import's module is a registered module's name, a letter followed by letters and digits");
        }

        if (entry.module === Names.lexicaModuleName) {
            fail("Nexo's own vocabulary is always available, so no script imports it or one of its types");
        }

        if (entry.type !== undefined && !Names.isIdentifier(entry.type)) {
            fail("An import's type is the local name of a type its module declares, a letter followed by letters and digits");
        }

        if (entry.alias !== undefined && !Names.isIdentifier(entry.alias)) {
            fail("An import's alias is a local name, a letter followed by letters and digits");
        }

        if (entry.alias !== undefined && entry.alias === (entry.type ?? entry.module)) {
            fail(`'${entry.alias}' is the local name the import gives without an alias, so it holds none`);
        }
    }

    /** Why two imports conflict: the local name they share, and each as text writes it. */
    static describeConflict([one, other]) {
        return `'${Imports.localNameOf(one)}' is the local name both '${Imports.quote(one)}' and '${Imports.quote(other)}' give, to different declarations; give one of them an alias of its own`;
    }

    /** An item a host supplied, as a message quotes it. */
    static #describe(item) {
        return typeof item === 'string' ? `'${item}'` : JSON.stringify(item) ?? String(item);
    }

    /** The order of two local names, by their characters' code units, so every reader orders a definition's imports alike. */
    static #compareLocalNames(one, other) {
        return one < other ? -1 : one > other ? 1 : 0;
    }
}
