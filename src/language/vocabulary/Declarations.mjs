/**
 * Declarations — the helpers that write a vocabulary's declarations: its parameters and members, each in the declaration shape with the defaults its contract gives it
 */

export class Declarations {
    /** A value parameter, required unless it is given a default. */
    static valueParameter(name, type, options = {}) {
        const parameter = { name, kind: 'value', type, required: !('default' in options), fixed: false, nulls: 'propagate', ...options };

        if (parameter.fixed === false) {
            delete parameter.selects;
            delete parameter.selector;
        }

        return parameter;
    }

    /** An expression parameter, evaluated against each item of the list it follows and producing the type. */
    static expressionParameter(type) {
        return { name: 'expression', kind: 'expression', type, context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A required predicate parameter, an expression evaluated against each item whose truthiness its implementation receives. */
    static predicateParameter() {
        return { name: 'expression', kind: 'predicate', type: 'Boolean', context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A function parameter, always required: its callback contract, the types of the arguments the member calls the function with, in order, and the type of the result it takes from it. */
    static functionParameter(name, type, parameters) {
        return { name, kind: 'function', type, parameters, required: true };
    }

    /**
     * A member of the kind: a property, or a member written with arguments, a function call unless it says it is an indexer, whose arguments are positional unless it says they are options.
     * Its updates are observable and fresh unless it says otherwise, and a member without a target, which a null target gives, is a module member. A function the host invokes, `invokedBy: 'host'`, has no updates.
     */
    static member(kind, name, target, result, { implementation, parameters = [], updates = { changes: 'observable', reads: 'fresh' }, syntax, arguments: argumentForm, isDefault = false, invokedBy } = {}) {
        const declaration = { name, kind, ...(invokedBy === undefined ? {} : { invokedBy }), ...(target === null ? {} : { target }), result };

        if (kind !== 'property') {
            declaration.syntax = syntax ?? 'function-call';
            declaration.parameters = parameters;

            if (parameters.length > 0) {
                declaration.arguments = argumentForm ?? 'positional';
            }
        }

        if (isDefault) {
            declaration.default = true;
        }

        if (invokedBy !== 'host') {
            declaration.updates = updates;
        }

        if (implementation !== undefined) {
            declaration.implementation = implementation;
        }

        return declaration;
    }

    /** A property, a member read without arguments. */
    static property(name, target, result, options) {
        return Declarations.member('property', name, target, result, options);
    }

    /** A function, a member called or named as an indexer with its arguments. */
    static function(name, target, result, options) {
        return Declarations.member('function', name, target, result, options);
    }
}
