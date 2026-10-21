/**
 * Names — Lexica's identifiers: how one is spelled, the words the language reserves, and which identifiers a reference to a binding writes with a prefix
 */

/** A letter followed by letters and digits, which is also a JavaScript identifier. */
const PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const LITERALS = new Map([['true', true], ['false', false], ['null', null]]);
const KEYWORDS = new Set(['it', 'not', 'try', 'as', 'to', 'and', 'or', 'if', 'then', 'elseif', 'else', 'let', 'do', 'end', 'return', 'function']);

/** The object root's word, which stands for a reference to the outermost object being built where an expression stands. */
const ROOT = 'root';

/** The module names of text read without a registry, which knows no module's name. */
const NO_MODULE_NAMES = Object.freeze(new Set());

export class Names {
    /** The words the language reserves, which keep their meaning where an expression stands and which a reference to a local or a field of their name writes after `@`: those that write a literal, the keywords and `root`. */
    static reservedWords = Object.freeze([...LITERALS.keys(), ...KEYWORDS, ROOT]);

    /** The module names of text read without a registry: none. */
    static noModuleNames = NO_MODULE_NAMES;

    /** Whether the text is spelled as an identifier: a letter followed by letters and digits, a reserved word among them, since a position that expects a name tells it from the word. */
    static isIdentifier(text) {
        return typeof text === 'string' && PATTERN.test(text);
    }

    /** Whether the word is one the language reserves, which keeps its meaning where an expression stands: a literal's word, a keyword or `root`. */
    static isReservedWord(word) {
        return LITERALS.has(word) || KEYWORDS.has(word) || word === ROOT;
    }

    /**
     * Whether an identifier written alone where a value stands means something other than a binding of its name, so a reference to the local, the field or the script parameter writes it with `@` or `~`: a word the language
     * reserves, or, in text read through a registry, the name of one of its modules, which begins its namespace there.
     * @param {string} word
     * @param {ReadonlySet<string>} [moduleNames] The module names the text is read with.
     */
    static needsPrefix(word, moduleNames = NO_MODULE_NAMES) {
        return Names.isReservedWord(word) || moduleNames.has(word);
    }

    /** Whether the word is a keyword. */
    static isKeyword(word) {
        return KEYWORDS.has(word);
    }

    /** Whether the word is the object root's. */
    static isRoot(word) {
        return word === ROOT;
    }

    /** Whether the word writes a literal. */
    static isLiteral(word) {
        return LITERALS.has(word);
    }

    /** The value of the literal the word writes. */
    static literalValueOf(word) {
        return LITERALS.get(word);
    }
}
