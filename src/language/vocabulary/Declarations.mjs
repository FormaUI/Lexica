/**
 * Declarations — the helpers that write a vocabulary's declarations: its parameters, members and conditions, each with the defaults the declaration contract gives it
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

    /** A required predicate, an expression evaluated against each item whose truthiness its function receives. */
    static predicateParameter() {
        return { name: 'expression', kind: 'predicate', type: 'boolean', context: 'item', required: true, fixed: false, nulls: 'accept' };
    }

    /** A property or an operation; an operation is a call unless it says it is named, and takes its parameters by position unless it says it takes options. */
    static member(kind, name, on, result, { function: implementation = name, parameters = [], changes = 'observable', reads = 'fresh', misses, tolerance, observations, form, input, isDefault = false } = {}) {
        const declaration = { name, function: implementation, kind, on, parameters, result, changes, reads };

        if (kind !== 'property') {
            declaration.form = form ?? 'call';

            if (parameters.length > 0) {
                declaration.input = input ?? 'positional';
            }
        }

        if (isDefault) {
            declaration.default = true;
        }

        if (observations !== undefined) {
            declaration.observations = observations;
        }

        if (implementation === null) {
            delete declaration.function;
        }

        if (misses !== undefined) {
            declaration.misses = misses;
        }

        if (tolerance !== undefined) {
            declaration.tolerance = tolerance;
        }

        return declaration;
    }

    /** A property, a member read without arguments. */
    static property(name, on, result, options) {
        return Declarations.member('property', name, on, result, options);
    }

    /** An operation, a member called or named as an indexer with its arguments. */
    static operation(name, on, result, options) {
        return Declarations.member('operation', name, on, result, options);
    }

    /** A condition: a Boolean of its receivers that its verb, `is` unless it says otherwise, asks by name, carried out by its own function under its own contract, observable unless it says otherwise. */
    static condition(name, on, implementation, { verb = 'is', changes = 'observable', reads = 'fresh', misses, observations = [] } = {}) {
        return {
            name,
            verb,
            function: implementation,
            on,
            changes,
            reads,
            ...(misses === undefined ? {} : { misses }),
            observations,
        };
    }
}
