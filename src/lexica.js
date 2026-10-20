/**
 * Lexica — an extensible expression language: reads a text into its definition, checks a definition's structure, writes its canonical text, creates the modules that declare a vocabulary
 * and the registries a host resolves expressions against, and says which build it is and which specification it follows
 */

import { DefinitionValidator } from './language/DefinitionValidator.mjs';
import { DefinitionWriter } from './language/DefinitionWriter.mjs';
import { LanguageResolver } from './language/LanguageResolver.mjs';
import { LexicaError } from './language/LexicaError.mjs';
import { ParameterBindings } from './language/ParameterBindings.mjs';
import { ParsedTexts } from './language/ParsedTexts.mjs';
import { Specification } from './language/Specification.mjs';
import { LexicaModule } from './language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from './language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from './language/vocabulary/Vocabulary.mjs';

/**
 * The version of this build of the library: the package's version, which bundling sets, or, where Lexica runs from its sources, the library's version marked as source by its build metadata.
 * @type {string}
 */
const LIBRARY_VERSION = typeof LEXICA_VERSION === 'string' ? LEXICA_VERSION : '1.0.0-alpha+source';

/** The definition a text or a definition gives: the text read and checked, or the definition checked, each the same frozen definition the text's canonical form would give. */
const definitionOf = source => (typeof source === 'string' ? ParsedTexts.parse(source) : new DefinitionValidator().validate(source));

/**
 * A registry a host resolves expressions against: Lexica's built-in vocabulary and the modules the host registers, each module's vocabulary in effect for every expression resolved after it.
 * No registry is shared, so two hosts never see each other's modules.
 */
const registryOf = modules => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);

    return Object.freeze({
        registerModule: module => registry.registerModule(module),
        get moduleNames() {
            return registry.moduleNames;
        },
        resolve: (source, bindings = {}) => {
            const definition = definitionOf(source);
            const resolved = new LanguageResolver(registry, new ParameterBindings(bindings), ParsedTexts.locationsOf(definition), {}).resolveDefinition(definition);

            return Object.freeze({ kind: resolved.kind, type: String(resolved.type) });
        },
    });
};

/** Lexica: reads, checks and writes definitions, creates modules and registries, and says which build it is and which specification it follows. */
export const lexica = Object.freeze({
    parse: text => {
        if (typeof text !== 'string') {
            throw LexicaError.structure('What parse reads is a text', {});
        }

        return ParsedTexts.parse(text);
    },
    validate: definition => new DefinitionValidator().validate(definition),
    format: source => DefinitionWriter.format(definitionOf(source).expression),
    createModule: (name, contents, functions = null) => new LexicaModule(name, contents, functions),
    createRegistry: (modules = []) => registryOf(modules),
    info: Object.freeze({ version: LIBRARY_VERSION, specificationVersion: Specification.version, definitionVersion: Specification.definitionVersion }),
});

export { LexicaError };
