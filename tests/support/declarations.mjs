/**
 * Declarations as a module writes them, raw records a test changes the parts of, so a test of a shape the helpers would never build still builds it; and a host function as a host declares one through the declaration helpers
 */
import { nexo } from '#nexo/nexo.js';

/** A property, constant and fresh, in the declaration shape, with what a test changes: a module member where it stands among a module's members, and a member of its type or its extension's target within either. */
export const propertyDeclaration = (overrides = {}) => ({
    name: 'zoom',
    kind: 'property',
    result: 'Number',
    updates: { changes: 'constant', reads: 'fresh' },
    ...overrides,
});

/** A function taking one value parameter, positional, constant and fresh. */
export const functionDeclaration = (overrides = {}) => propertyDeclaration({ kind: 'function', arguments: 'positional', parameters: [parameterDeclaration()], ...overrides });

/** A value parameter, a required number that propagates null, in the declaration shape, with what a test changes. */
export const parameterDeclaration = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'Number', required: true, nulls: 'propagate', ...overrides });

/** A function the host invokes, declared through the declaration helpers as a host declares one, of the result given. */
export const hostFunctionDeclaration = (name, result, options = {}) => nexo.declarations.createFunctionDeclaration(name, result, { invokedBy: 'host', ...options });

/** The data properties of a structured type's data shape, in the declaration shape, from the type of each property by its name: each a property without updates, which Nexo reads from the data. */
export const dataPropertyDeclarations = shape => Object.entries(shape).map(([name, result]) => ({ name, kind: 'property', result }));

/** An indexer, by default an unnamed one, taking its key, a string, in the declaration shape, with what a test changes: a name makes it a named one. */
export const indexerDeclaration = (overrides = {}) => propertyDeclaration({ kind: 'indexer', name: undefined, result: 'String?', parameters: [parameterDeclaration({ name: 'key', type: 'String' })], ...overrides });

/** An extension, in the declaration shape: its name, which declares the type parameters its target and its members share, its target and the members it adds to it. */
export const extensionDeclaration = (name, target, members) => ({ name, kind: 'extension', target, members });

/** An operator, in the declaration shape: `cast` or `convert`, its destination, and its implementation where it is given one. */
export const operatorDeclaration = (name, result, impl) => ({ kind: 'operator', name, result, ...(impl === undefined ? {} : { impl }) });

/**
 * An extension of every type declaring `is`, a function answering what the test it is given, a function of the receiver's own type, answers of its receiver: a test of any receiver as a host declares one for its domain,
 * since Nexo declares none.
 */
export const receiverTestsDeclaration = () => extensionDeclaration('Checks<T>', 'T', [
    nexo.declarations.createFunctionDeclaration('is', 'Boolean', {
        updates: { changes: 'derived', reads: 'derived' },
        parameters: [nexo.declarations.createFunctionParameterDeclaration('test', 'Boolean', ['T'])],
        impl: ({ receiver, args }) => args.test(receiver),
    }),
]);
