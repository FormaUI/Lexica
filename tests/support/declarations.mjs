/**
 * Declarations as a module writes them, raw records a test changes the parts of, so a test of a shape the helpers would never build still builds it; and a host function as a host declares one through the declaration helpers
 */
import { lexica } from '#lexica/lexica.js';

/** A property of a string, constant and fresh, in the declaration shape, with what a test changes. */
export const propertyDeclaration = (overrides = {}) => ({
    name: 'zoom',
    kind: 'property',
    target: 'String',
    result: 'Number',
    updates: { changes: 'constant', reads: 'fresh' },
    ...overrides,
});

/** A function of a string taking one value parameter, positional, constant and fresh. */
export const functionDeclaration = (overrides = {}) => propertyDeclaration({ kind: 'function', arguments: 'positional', parameters: [parameterDeclaration()], ...overrides });

/** A value parameter, a required number that propagates null, in the declaration shape, with what a test changes. */
export const parameterDeclaration = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'Number', required: true, nulls: 'propagate', ...overrides });

/** A function the host invokes, declared through the declaration helpers as a host declares one, of the receiver and the result given. */
export const hostFunctionDeclaration = (name, target, result, options = {}) => lexica.declarations.function(name, target, result, { invokedBy: 'host', ...options });
