/** A property of a string, constant and fresh, in the declaration shape, with what a test changes. */
export const declaration = (overrides = {}) => ({
    name: 'zoom',
    kind: 'property',
    target: 'String',
    result: 'Number',
    updates: { changes: 'constant', reads: 'fresh' },
    ...overrides,
});

/** A function of a string taking one value parameter, positional, constant and fresh. */
export const functionDeclaration = (overrides = {}) => declaration({ kind: 'function', arguments: 'positional', parameters: [parameter()], ...overrides });

export const parameter = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'Number', required: true, nulls: 'propagate', ...overrides });
