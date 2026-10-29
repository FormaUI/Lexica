/**
 * NexoError — a Nexo failure, the code of its condition and its location
 */

/** The first code of each kind's range of Nexo's own codes, which runs a thousand codes. */
const CODE_RANGE_STARTS = { syntax: 1000, structure: 2000, validation: 3000, module: 4000, evaluation: 5000 };

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

export class NexoError extends Error {
    /** The code of the condition that failed: `NEXO` and four digits for Nexo's own, a host's own prefix for a host's. */
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
        NexoError.#requireCode(kind, code);
        const place = NexoError.#describe(location);
        super(place === '' ? message : `${message} (${place})`, options);
        this.name = 'NexoError';
        this.code = code;
        this.kind = kind;
        this.location = location;
    }

    /** A text that does not follow the syntax, failing at the offset. */
    static syntax(code, message, text, offset) {
        return new NexoError('syntax', code, message, NexoError.locate(text, offset));
    }

    /** A definition, or a binding, that does not follow the structure, failing at the location. */
    static structure(code, message, location) {
        return new NexoError('structure', code, message, location);
    }

    /** A request that does not follow the vocabulary, failing at the location. */
    static validation(code, message, location) {
        return new NexoError('validation', code, message, location);
    }

    /** A request that fails as it is carried out, at the location of the part that failed. */
    static evaluation(code, message, location, options) {
        return new NexoError('evaluation', code, message, location, options);
    }

    /** A module whose declarations do not follow the declaration contract, failing at the location. */
    static module(code, message, location) {
        return new NexoError('module', code, message, location);
    }

    /** Refuses a code that is not one, or one of Nexo's own outside its kind's range, which is a mistake in the code raising it. */
    static #requireCode(kind, code) {
        if (typeof code !== 'string' || code === '') {
            throw new TypeError(`A ${kind} error is raised with the code of its condition, and is given ${String(code)}`);
        }

        const own = /^NEXO(\d{4})$/.exec(code);
        if (code.startsWith('NEXO') && (own === null || Math.floor(Number(own[1]) / 1000) * 1000 !== CODE_RANGE_STARTS[kind])) {
            throw new TypeError(`The code ${code} is outside the range of Nexo's ${kind} codes, ${CODE_RANGE_STARTS[kind]} to ${CODE_RANGE_STARTS[kind] + 999}`);
        }
    }

    /** The offset's line and column in the text, each line break, LF, CRLF or a lone CR, beginning a line, so CRLF advances it once and its two characters count toward the offset. */
    static locate(text, offset) {
        let line = 1;
        let lineStart = 0;

        for (let index = 0; index < offset; index++) {
            const character = text[index];

            // A carriage return before a line feed is one line break with it, which the line feed ends.
            if (character === '\n' || (character === '\r' && text[index + 1] !== '\n')) {
                line++;
                lineStart = index + 1;
            }
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

        if (location.type !== undefined) {
            parts.push(`in the type '${location.type}'`);
        }

        if (location.declaration !== undefined) {
            parts.push(`in the declaration '${location.declaration}'`);
        }

        if (location.declarationKey !== undefined) {
            parts.push(`at '${location.declarationKey}'`);
        }

        return parts.join(', ');
    }
}

/** The errors Nexo's own code raised, each made by NexoErrors; one a host builds with the class's factories is not among them. @type {WeakSet<NexoError>} */
const raisedErrors = new WeakSet();

/** The error, marked as one Nexo raised. */
const raise = error => {
    raisedErrors.add(error);

    return error;
};

/**
 * The factories Nexo's own code raises its errors with, each marking the error as one Nexo raised, and `isRaisedByNexo`, whether that marker is on an error, which a failure passing through a host's code keeps as it
 * is: a NexoError a host builds with the exported class carries none, so it stays apart from Nexo's own.
 * The package exports the class alone, whose factories a host builds its own errors with, so a host's error is never taken for Nexo's.
 */
export const NexoErrors = Object.freeze({
    syntax: (code, message, text, offset) => raise(NexoError.syntax(code, message, text, offset)),
    structure: (code, message, location) => raise(NexoError.structure(code, message, location)),
    validation: (code, message, location) => raise(NexoError.validation(code, message, location)),
    evaluation: (code, message, location, options) => raise(NexoError.evaluation(code, message, location, options)),
    module: (code, message, location) => raise(NexoError.module(code, message, location)),
    isRaisedByNexo: error => raisedErrors.has(error),
});
