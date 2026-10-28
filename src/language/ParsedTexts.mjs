/**
 * ParsedTexts — the definitions of the source texts parsed most recently, each with the imports a host supplied to it
 */

import { DefinitionValidator } from './DefinitionValidator.mjs';
import { Lowering } from './Lowering.mjs';
import { Parser } from './Parser.mjs';
import { TextLocations } from './TextLocations.mjs';

/** The most texts whose definitions are kept. */
const CAPACITY = 256;

export class ParsedTexts {
    /** Each kept text's definition, by the imports supplied to it and the text, the least recently parsed first. @type {Map<string, object>} */
    static #definitionCache = new Map();

    /** @type {WeakMap<object, TextLocations>} */
    static #locations = new WeakMap();

    /** Where each part of the definition came from: in its text, for one parsed from text, or in the definition its caller supplied, where validation moved a part; null otherwise. */
    static locationsOf(definition) {
        return ParsedTexts.#locations.get(definition) ?? DefinitionValidator.locationsOf(definition);
    }

    /** The text the definition was parsed from, or null for a definition not parsed from text. */
    static textOf(definition) {
        return ParsedTexts.#locations.get(definition)?.text ?? null;
    }

    /**
     * The validated, frozen definition the text parses into with the imports a host supplies, kept for the next parse of the same text with the same imports. A definition depends on its text and those imports alone, so a
     * kept one stays valid for good; the 256 asked for most recently are kept, a kept one asked for again counting as the latest, the least recently asked for released as another is kept, and its locations are released
     * with it. A text that fails to parse is kept by none, so parsing it again refuses it again.
     * @param {string} text
     * @param {readonly object[]} [suppliedImports] The imports a host supplies, in a definition's shape, each once and in order of the local name it gives, checked already.
     */
    static parse(text, suppliedImports = []) {
        const key = `${JSON.stringify(suppliedImports)}|${text}`;
        const kept = ParsedTexts.#definitionCache.get(key);

        if (kept) {
            ParsedTexts.#definitionCache.delete(key);
            ParsedTexts.#definitionCache.set(key, kept);

            return kept;
        }

        // The tree is lowered and let go: a kept definition holds its locations, never its tokens or their trivia.
        const { definition, spans, scriptParametersWrittenAlone } = Lowering.lower(new Parser(text, suppliedImports).parse(), suppliedImports);
        const locations = new TextLocations(text, definition, spans);
        const validated = new DefinitionValidator(locations, scriptParametersWrittenAlone).validate(definition);

        ParsedTexts.#locations.set(validated, locations);
        ParsedTexts.#definitionCache.set(key, validated);

        if (ParsedTexts.#definitionCache.size > CAPACITY) {
            ParsedTexts.#definitionCache.delete(ParsedTexts.#definitionCache.keys().next().value);
        }

        return validated;
    }
}
