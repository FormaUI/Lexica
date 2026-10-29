/**
 * The errors a test's call throws, and the assertions on them that tests share: what a call throws, its message, and whether it is a Nexo error of a code and a kind, a module error among them
 */
import { expect } from 'vitest';
import { NexoError } from '#nexo/language/NexoError.mjs';

/** Runs the call and answers exactly what it threw, null or undefined among them; a call that throws nothing fails the test. */
export const errorThrownBy = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

/** Runs the call and answers the message of what it threw, whatever that is. */
export const messageThrownBy = call => errorThrownBy(call).message;

/** Asserts that the error is a Nexo error of the code and the kind. */
export const expectNexoError = (error, code, kind) => {
    expect(error).toBeInstanceOf(NexoError);
    expect({ code: error.code, kind: error.kind }).toEqual({ code, kind });
};

/** Runs the action, asserts that it throws a module error, and answers its message and where its location says it is. */
export const expectModuleError = action => {
    const error = errorThrownBy(action);

    expect(error).toBeInstanceOf(NexoError);
    expect(error.kind).toBe('module');

    return { message: error.message, ...error.location };
};
