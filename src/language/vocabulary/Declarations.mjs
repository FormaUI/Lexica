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
    static functionParameter(name, type, parameterTypes) {
        return { name, kind: 'function', type, parameterTypes, required: true };
    }

    /**
     * A member of the kind: a property; a function, whose arguments are positional unless it says they are options; or an indexer, whose one key is positional, named unless its name is null.
     * Its updates are those it is given, which every member the evaluator invokes declares, and a member without a target, which a null target gives, is a module member. A function the host invokes, `invokedBy: 'host'`, has no updates.
     */
    static member(kind, name, target, result, { impl, parameters = [], updates, arguments: argumentForm, invokedBy } = {}) {
        const declaration = { ...(name === null ? {} : { name }), kind, ...(invokedBy === undefined ? {} : { invokedBy }), ...(target === null ? {} : { target }), result };

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

    /** A property, a member read without arguments. */
    static property(name, target, result, options) {
        return Declarations.member('property', name, target, result, options);
    }

    /** A function, a member called with its arguments. */
    static function(name, target, result, options) {
        return Declarations.member('function', name, target, result, options);
    }

    /** An indexer, given its key in brackets: a named one, `x.name[key]`, or, where its name is null, the unnamed one of its receivers, `x[key]`. */
    static indexer(name, target, result, options) {
        return Declarations.member('indexer', name, target, result, options);
    }
}
