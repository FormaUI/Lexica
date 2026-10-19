import { expect } from 'vitest';
import { LexicaError } from '#lexica/language/LexicaError.mjs';

export const declaration = (overrides = {}) => ({
    name: 'zoom',
    function: 'zoom',
    kind: 'property',
    on: 'element',
    parameters: [],
    result: 'number',
    changes: 'constant',
    reads: 'fresh',
    ...overrides,
});

export const parameter = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'number', required: true, nulls: 'propagate', ...overrides });

export const messageOf = action => {
    try {
        action();
    } catch (error) {
        expect(error).toBeInstanceOf(LexicaError);
        expect(error.kind).toBe('module');

        return error.message;
    }

    throw new Error('The action succeeded');
};
