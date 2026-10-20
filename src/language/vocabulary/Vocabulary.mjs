/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the members of lists, the conversions between strings, numbers and Booleans,
 * and the verbs that ask the predicates a host declares, each carrying its implementation
 */

import { Declarations } from './Declarations.mjs';
import { LexicaModule } from './LexicaModule.mjs';

const { valueParameter, expressionParameter, predicateParameter, property } = Declarations;

/** The text a conversion to a number takes: HTML's valid floating-point number, an optional minus, digits with an optional fraction or a fraction alone, and an optional exponent whose sign is optional. */
const VALID_FLOATING_POINT_NUMBER = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;

/** The ASCII whitespace a text converted to a number is trimmed of at either end: tab, line feed, form feed, carriage return and space. */
const SURROUNDING_ASCII_WHITESPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

export class Vocabulary {
    /** The name of Lexica's own module. */
    static moduleName = 'lexica';

    /** @type {LexicaModule | undefined} */
    static #module;

    /**
     * Lexica's own module, each member and conversion carrying its implementation: one module, created here alone, which every registry `lexica.createRegistry` makes holds and whose conversions between the language's types no other module may declare.
     * A module of its name made elsewhere is an ordinary module, so the exception belongs to this one alone.
     */
    static get module() {
        const derived = { changes: 'derived', reads: 'derived' };

        return Vocabulary.#module ??= new LexicaModule(Vocabulary.moduleName, {
            members: [
                property('count', 'list<T>', 'number', { updates: derived, implementation: ({ receiver }) => receiver.length }),
                property('first', 'list<T>', 'T?', { updates: derived, implementation: ({ receiver }) => receiver.at(0) ?? null }),
                property('last', 'list<T>', 'T?', { updates: derived, implementation: ({ receiver }) => receiver.at(-1) ?? null }),
                // The item at a whole index from zero, null for any other index, a negative one included, which never counts from the end.
                Declarations.function('item', 'list<T>', 'T?', {
                    syntax: 'indexer', isDefault: true, updates: derived, parameters: [valueParameter('index', 'number')],
                    implementation: ({ receiver, args }) => (Number.isInteger(args.index) && args.index >= 0 && args.index < receiver.length ? receiver[args.index] : null),
                }),
                // The verbs that ask a predicate: the predicate's own declaration carries it out, its implementation, how it changes and the observations that cover it, so declaring each on any receiver selects the predicate's own receivers.
                Declarations.function('is', 'any', 'boolean', { updates: derived, parameters: [valueParameter('name', 'string', { fixed: true, selects: 'predicate' })] }),
                Declarations.function('has', 'any', 'boolean', { updates: derived, parameters: [valueParameter('name', 'string', { fixed: true, selects: 'predicate' })] }),
                Declarations.function('supports', 'any', 'boolean', { updates: derived, parameters: [valueParameter('name', 'string', { fixed: true, selects: 'predicate' })] }),
                Declarations.function('max', 'list<T>', 'number?', { updates: derived, parameters: [expressionParameter('number?')], implementation: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.max) }),
                Declarations.function('min', 'list<T>', 'number?', { updates: derived, parameters: [expressionParameter('number?')], implementation: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.min) }),
                Declarations.function('sum', 'list<T>', 'number', { updates: derived, parameters: [expressionParameter('number?')], implementation: ({ receiver, args }) => Vocabulary.#numbers(receiver, args.expression).reduce((total, number) => total + number, 0) }),
                Declarations.function('where', 'list<T>', 'list<T>', { updates: derived, parameters: [predicateParameter()], implementation: ({ receiver, args }) => receiver.filter(item => args.expression(item) === true) }),
            ],

            // Each conversion takes the value, never null, and `reject`, which stops it for a value it does not convert.
            conversions: [
                {
                    from: 'string',
                    to: 'number',
                    implementation: ({ value, reject }) => {
                        const trimmed = value.replace(SURROUNDING_ASCII_WHITESPACE, '');

                        if (!VALID_FLOATING_POINT_NUMBER.test(trimmed)) {
                            reject(`${JSON.stringify(value)} is no number, which is written as HTML's valid floating-point number, as -12, 3.5, .5 or 1e3 are`);
                        }

                        const number = Number(trimmed);

                        if (!Number.isFinite(number)) {
                            reject(`${JSON.stringify(value)} is too large a number to be finite`);
                        }

                        return number;
                    },
                },
                // The shortest text that reads back as the same number, as ECMAScript writes it, and negative zero as "0".
                { from: 'number', to: 'string', implementation: ({ value }) => String(value) },
                { from: 'boolean', to: 'string', implementation: ({ value }) => String(value) },
                {
                    from: 'string',
                    to: 'boolean',
                    implementation: ({ value, reject }) => {
                        if (value !== 'true' && value !== 'false') {
                            reject(`${JSON.stringify(value)} is no Boolean, which is written "true" or "false"`);
                        }

                        return value === 'true';
                    },
                },
            ],
        });
    }

    /** The greatest or the least of the numbers an expression produces for the items, or null where it produces none. */
    static #extreme(items, expression, choose) {
        const numbers = Vocabulary.#numbers(items, expression);

        return numbers.length === 0 ? null : numbers.reduce((current, number) => choose(current, number));
    }

    /** The numbers an expression produces for the items, leaving out the items it produces null for. */
    static #numbers(items, expression) {
        return items.map(item => expression(item)).filter(number => number !== null);
    }
}
