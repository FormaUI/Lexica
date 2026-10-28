/**
 * MemberFailure — a failure one of Lexica's own members reports of the values it is given, which the evaluator raises at the call with the code it carries
 */

export class MemberFailure extends Error {
    #code;

    /**
     * @param {string} code The code of the condition the values break.
     * @param {string} message What the call is refused for.
     */
    constructor(code, message) {
        super(message);
        this.#code = code;
    }

    /** The code of the condition the values break. */
    get code() {
        return this.#code;
    }
}
