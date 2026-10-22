import { expect } from 'vitest';
import { LexicaError } from '#lexica/language/LexicaError.mjs';

/** A property of an element, constant and fresh, in the declaration shape, with what a test changes. */
export const declaration = (overrides = {}) => ({
    name: 'zoom',
    kind: 'property',
    target: 'Element',
    result: 'Number',
    updates: { changes: 'constant', reads: 'fresh' },
    ...overrides,
});

/** A function of an element taking one value parameter, positional, constant and fresh. */
export const functionDeclaration = (overrides = {}) => declaration({ kind: 'function', arguments: 'positional', parameters: [parameter()], ...overrides });

export const parameter = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'Number', required: true, nulls: 'propagate', ...overrides });

/** The module error an action throws: its message, and where its location says it is. */
export const refusalOf = action => {
    try {
        action();
    } catch (error) {
        expect(error).toBeInstanceOf(LexicaError);
        expect(error.kind).toBe('module');

        return { message: error.message, ...error.location };
    }

    throw new Error('The action succeeded');
};

export const messageOf = action => refusalOf(action).message;
