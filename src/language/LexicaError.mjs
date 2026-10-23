/**
 * LexicaError — a Lexica failure, the code of its condition and its location
 */

/** The first code of each kind's range of Lexica's own codes, which runs a thousand codes. */
const RANGES = { syntax: 1000, structure: 2000, validation: 3000, module: 4000, evaluation: 5000 };

/**
 * @typedef {object} Location
 * @property {string} [pointer] The failing node's JSON Pointer into the definition.
 * @property {number} [offset] The failing text's offset into the source text.
 * @property {number} [line] The failing text's line, from 1.
 * @property {number} [column] The failing text's column, from 1.
 * @property {string} [binding] The failing binding's name.
 * @property {string} [module] The failing module's name.
 * @property {string} [declaration] The failing declaration's name.
 */

export class LexicaError extends Error {
    /** The code of the condition that failed: `LEXICA` and four digits for Lexica's own, a host's own prefix for a host's. */
    code;

    /** @type {'syntax' | 'structure' | 'validation' | 'module' | 'evaluation'} */
    kind;

    /** @type {Location} */
    location;

    /**
     * @param {'syntax' | 'structure' | 'validation' | 'module' | 'evaluation'} kind The stage the request failed in.
     * @param {string} code The code of the condition that failed.
     * @param {string} message What is wrong.
     * @param {Location} location Where it is wrong.
     * @param {{ cause?: unknown }} [options] What caused it.
     */
    constructor(kind, code, message, location, options = undefined) {
        LexicaError.#requireCode(kind, code);
        const place = LexicaError.#describe(location);
        super(place === '' ? message : `${message} (${place})`, options);
        this.name = 'LexicaError';
        this.code = code;
        this.kind = kind;
        this.location = location;
    }

    /** A text that does not follow the syntax, failing at the offset. */
    static syntax(code, message, text, offset) {
        return new LexicaError('syntax', code, message, LexicaError.locate(text, offset));
    }

    /** A definition, or a binding, that does not follow the structure, failing at the location. */
    static structure(code, message, location) {
        return new LexicaError('structure', code, message, location);
    }

    /** A request that does not follow the vocabulary, failing at the location. */
    static validation(code, message, location) {
        return new LexicaError('validation', code, message, location);
    }

    /** A request that fails as it is carried out, at the location of the part that failed. */
    static evaluation(code, message, location, options) {
        return new LexicaError('evaluation', code, message, location, options);
    }

    /** A module whose declarations do not follow the declaration contract, failing at the location. */
    static module(code, message, location) {
        return new LexicaError('module', code, message, location);
    }

    /** Refuses a code that is not one, or one of Lexica's own outside its kind's range, which is a mistake in the code raising it. */
    static #requireCode(kind, code) {
        if (typeof code !== 'string' || code === '') {
            throw new TypeError(`A ${kind} error is raised with the code of its condition, and is given ${String(code)}`);
        }

        const own = /^LEXICA(\d{4})$/.exec(code);
        if (code.startsWith('LEXICA') && (own === null || Math.floor(Number(own[1]) / 1000) * 1000 !== RANGES[kind])) {
            throw new TypeError(`The code ${code} is outside the range of Lexica's ${kind} codes, ${RANGES[kind]} to ${RANGES[kind] + 999}`);
        }
    }

    /** The offset's line and column in the text. */
    static locate(text, offset) {
        let line = 1;
        let lineStart = 0;

        for (let index = text.indexOf('\n'); index !== -1 && index < offset; index = text.indexOf('\n', index + 1)) {
            line++;
            lineStart = index + 1;
        }

        return { offset, line, column: offset - lineStart + 1 };
    }

    static #describe(location) {
        const parts = [];

        if (location.line !== undefined) {
            parts.push(`line ${location.line}, column ${location.column}`);
        }

        if (location.pointer !== undefined) {
            parts.push(`at ${location.pointer === '' ? 'the definition' : location.pointer}`);
        }

        if (location.binding !== undefined) {
            parts.push(`in the binding '${location.binding}'`);
        }

        if (location.module !== undefined) {
            parts.push(`in the module '${location.module}'`);
        }

        if (location.declaration !== undefined) {
            parts.push(`in the declaration '${location.declaration}'`);
        }

        if (location.field !== undefined) {
            parts.push(`at its field '${location.field}'`);
        }

        return parts.join(', ');
    }
}

/** The errors Lexica's own code raised, each made by LexicaErrors; one a host builds with the class's factories is not among them. @type {WeakSet<LexicaError>} */
const raisedErrors = new WeakSet();

/** The error, marked as one Lexica raised. */
const raise = error => {
    raisedErrors.add(error);

    return error;
};

/**
 * The factories Lexica's own code raises its errors with, each marking the error as one Lexica raised, and whether Lexica raised an error, which a failure passing through a host's code keeps as it is.
 * The package exports the class alone, whose factories a host builds its own errors with, so a host's error is never taken for Lexica's.
 */
export const LexicaErrors = Object.freeze({
    syntax: (code, message, text, offset) => raise(LexicaError.syntax(code, message, text, offset)),
    structure: (code, message, location) => raise(LexicaError.structure(code, message, location)),
    validation: (code, message, location) => raise(LexicaError.validation(code, message, location)),
    evaluation: (code, message, location, options) => raise(LexicaError.evaluation(code, message, location, options)),
    module: (code, message, location) => raise(LexicaError.module(code, message, location)),
    has: error => raisedErrors.has(error),
});
