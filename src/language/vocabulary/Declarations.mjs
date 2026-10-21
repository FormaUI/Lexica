/**
 * Declarations — the helpers that write a vocabulary's declarations: its parameters, members and predicates, each in the declaration shape with the defaults its contract gives it
 */

export class Declarations {
    /** A value parameter, required unless it is given a default. */
    static valueParameter(name, type, options = {}) {
        const parameter = { name, kind: 'value', type, required: !('default' in options), fixed: false, nulls: 'propagate', ...options };

        if (parameter.fixed === false) {
            delete parameter.selects;
        }

        return parameter;
    }

    /** An expression parameter, evaluated against each item of the list it follows and producing the type. */
    static expressionParameter(type) {
        return { name: 'expression', kind: 'expression', type, context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A required predicate parameter, an expression evaluated against each item whose truthiness its implementation receives. */
    static predicateParameter() {
        return { name: 'expression', kind: 'predicate', type: 'boolean', context: 'item', required: true, fixed: false, nulls: 'accept' };
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

        if (kind !== 'action' && kind !== 'behavior' && invokedBy !== 'host') {
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

    /** A predicate: a Boolean of its receivers that its verb, `is` unless it says otherwise, asks by name, carried out by its own implementation under its own updates, observable unless it says otherwise. */
    static predicate(name, target, implementation, { verb = 'is', updates = { changes: 'observable', reads: 'fresh' } } = {}) {
        return { name, verb, target, updates, ...(implementation === undefined ? {} : { implementation }) };
    }
}
