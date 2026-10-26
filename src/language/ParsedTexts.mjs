/**
 * ParsedTexts — the definitions of the source texts parsed most recently, each with the module names it was read with
 */

import { DefinitionValidator } from './DefinitionValidator.mjs';
import { Lowering } from './Lowering.mjs';
import { Names } from './Names.mjs';
import { Parser } from './Parser.mjs';
import { TextLocations } from './TextLocations.mjs';

/** The most texts whose definitions are kept. */
const CAPACITY = 256;

/**
 * How a definition was read from text: the module names it was read with, and the names it writes alone where a value stands, each reading a local, a field or a script parameter, by name, each with the span of the part it
 * first stands in, which its text locations locate where a diagnostic needs it.
 * @typedef {{ moduleNames: ReadonlySet<string>, namesWrittenAlone: ReadonlyMap<string, import('./Parser.mjs').Span> }} Reading
 */

export class ParsedTexts {
    /** Each kept text's definition, by the module names it was read with and the text, the least recently parsed first. @type {Map<string, object>} */
    static #definitionCache = new Map();

    /** @type {WeakMap<object, TextLocations>} */
    static #locations = new WeakMap();

    /** @type {WeakMap<object, Reading>} */
    static #readings = new WeakMap();

    /** Where each part of the definition came from: in its text, for one parsed from text, or in the definition its caller supplied, where validation moved a part; null otherwise. */
    static locationsOf(definition) {
        return ParsedTexts.#locations.get(definition) ?? DefinitionValidator.locationsOf(definition);
    }

    /** The text the definition was parsed from, or null for a definition not parsed from text. */
    static textOf(definition) {
        return ParsedTexts.#locations.get(definition)?.text ?? null;
    }

    /** How the definition was read from text, or null for a definition not parsed from text. */
    static readingOf(definition) {
        return ParsedTexts.#readings.get(definition) ?? null;
    }

    /**
     * The validated, frozen definition the text parses into with the module names given, kept for the next parse of the same text with the same names.
     * @param {string} text
     * @param {ReadonlySet<string>} [moduleNames] The module names the text is read with, none for text read without a registry.
     */
    static parse(text, moduleNames = Names.noModuleNames) {
        const key = `${[...moduleNames].sort().join(' ')}|${text}`;
        const kept = ParsedTexts.#definitionCache.get(key);

        if (kept) {
            ParsedTexts.#definitionCache.delete(key);
            ParsedTexts.#definitionCache.set(key, kept);

            return kept;
        }

        // The tree is lowered and let go: a kept definition holds its locations, never its tokens or their trivia.
        const { definition, spans, parameterReferences, namesWrittenAlone } = Lowering.lower(new Parser(text, moduleNames).parse());
        const locations = new TextLocations(text, definition, spans);
        const validated = new DefinitionValidator(locations, parameterReferences).validate(definition);

        ParsedTexts.#locations.set(validated, locations);
        ParsedTexts.#readings.set(validated, Object.freeze({ moduleNames: new Set(moduleNames), namesWrittenAlone }));

        ParsedTexts.#definitionCache.set(key, validated);

        if (ParsedTexts.#definitionCache.size > CAPACITY) {
            ParsedTexts.#definitionCache.delete(ParsedTexts.#definitionCache.keys().next().value);
        }

        return validated;
    }
}
