/**
 * Declarations — the helpers that write a vocabulary's declarations: its parameters and members, each in the declaration shape with the defaults its contract gives it, constructing a record and registering nothing
 */

export class Declarations {
    /** A value parameter, required unless it is given a default. */
    static createValueParameterDeclaration(name, type, options = {}) {
        const parameter = { name, kind: 'value', type, required: !('default' in options), fixed: false, nulls: 'propagate', ...options };

        if (parameter.fixed === false) {
            delete parameter.selects;
            delete parameter.selector;
        }

        return parameter;
    }

    /** An expression parameter, evaluated against each item of the list it follows and producing the type. */
    static createExpressionParameterDeclaration(type) {
        return { name: 'expression', kind: 'expression', type, context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A required predicate parameter, an expression evaluated against each item whose truthiness its implementation receives. */
    static createPredicateParameterDeclaration() {
        return { name: 'expression', kind: 'predicate', type: 'Boolean', context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A function parameter, always required: its callback contract, the types of the arguments the member calls the function with, in order, and the type of the result it takes from it. */
    static createFunctionParameterDeclaration(name, type, parameterTypes) {
        return { name, kind: 'function', type, parameterTypes, required: true };
    }

    /**
     * A property, a member read without arguments: one with updates, which the evaluator invokes, or, without them, a property of a structured type's data where it stands directly in that type, as the contract of
     * where it stands decides.
     */
    static createPropertyDeclaration(name, result, options) {
        return Declarations.#createMemberDeclaration('property', name, result, options);
    }

    /** A function, a member called with its arguments, positional unless it says they are options, or, with `invokedBy: 'host'`, one its host invokes, its result left out where its host supplies nothing. */
    static createFunctionDeclaration(name, result, options) {
        return Declarations.#createMemberDeclaration('function', name, result, options);
    }

    /** An indexer, given its one key in brackets: a named one, `x.name[key]`, or, where its name is null, the unnamed one of its receivers, `x[key]`. */
    static createIndexerDeclaration(name, result, options) {
        return Declarations.#createMemberDeclaration('indexer', name, result, options);
    }

    /**
     * A member of the kind, named unless its name is null, with no receiver of its own: where it stands gives it one, the type or the extension it is declared within, and a module member, among a module's `members`,
     * takes none. Its updates are those it is given, which every member the evaluator invokes declares; a function the host invokes, `invokedBy: 'host'`, has none.
     */
    static #createMemberDeclaration(kind, name, result, { impl, parameters = [], updates, arguments: argumentForm, invokedBy } = {}) {
        const declaration = { ...(name === null ? {} : { name }), kind, ...(invokedBy === undefined ? {} : { invokedBy }), result };

        if (kind !== 'property') {
            declaration.parameters = parameters;

            if (kind === 'function' && parameters.length > 0) {
                declaration.arguments = argumentForm ?? 'positional';
            }
        }

        if (invokedBy !== 'host' && updates !== undefined) {
            declaration.updates = updates;
        }

        if (impl !== undefined) {
            declaration.impl = impl;
        }

        return declaration;
    }
}
