/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the members of lists, the conversions between strings, numbers and Booleans,
 * and the verbs that test a receiver, each carrying its implementation
 */

import { Declarations } from './Declarations.mjs';
import { LexicaModule } from './LexicaModule.mjs';

/** The text a conversion to a number takes: HTML's valid floating-point number, an optional minus, digits with an optional fraction or a fraction alone, and an optional exponent whose sign is optional. */
const VALID_FLOATING_POINT_NUMBER = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;

/** The ASCII whitespace a text converted to a number is trimmed of at either end: tab, line feed, form feed, carriage return and space. */
const SURROUNDING_ASCII_WHITESPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/** The generic value types Lexica declares, by name, each with its parameters in order and the variance of each: `List<T>`, covariant in its items, since a list is immutable. */
const GENERIC_TYPES = new Map([['List', Object.freeze({ name: 'List', parameters: Object.freeze([Object.freeze({ name: 'T', variance: 'covariant' })]) })]]);

export class Vocabulary {
    /** The name of Lexica's own module, spelled as the specification spells it. */
    static moduleName = 'Lexica';

    /** The declaration of the generic value type the type is one of, or undefined for a type of none; Lexica alone declares one. */
    static getGenericType(type) {
        return type.kind === 'named' && type.moduleName === null ? GENERIC_TYPES.get(type.name) : undefined;
    }

    /** @type {LexicaModule | undefined} */
    static #module;

    /**
     * Lexica's own module, each member and conversion carrying its implementation: one module, created here alone, which every registry `lexica.createRegistry` makes holds and whose conversions between the language's types no other module may declare.
     * A module of its name made elsewhere is an ordinary module, so the exception belongs to this one alone.
     */
    static get module() {
        const derivedUpdates = { changes: 'derived', reads: 'derived' };

        return Vocabulary.#module ??= new LexicaModule(Vocabulary.moduleName, {
            members: [
                Declarations.property('count', 'List<T>', 'Number', { updates: derivedUpdates, impl: ({ receiver }) => receiver.length }),
                Declarations.property('first', 'List<T>', 'T?', { updates: derivedUpdates, impl: ({ receiver }) => receiver.at(0) ?? null }),
                Declarations.property('last', 'List<T>', 'T?', { updates: derivedUpdates, impl: ({ receiver }) => receiver.at(-1) ?? null }),
                // The item at a whole index from zero, null for any other index, a negative one included, which never counts from the end.
                Declarations.indexer(null, 'List<T>', 'T?', {
                    updates: derivedUpdates, parameters: [Declarations.valueParameter('index', 'Number')],
                    impl: ({ receiver, args }) => (Number.isInteger(args.index) && args.index >= 0 && args.index < receiver.length ? receiver[args.index] : null),
                }),
                // The verbs, each answering what its test answers of its receiver, a function of the receiver's own type that answers a Boolean, so each reads and changes as its test does.
                Declarations.function('is', 'T', 'Boolean', { updates: derivedUpdates, parameters: [Declarations.functionParameter('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) }),
                Declarations.function('has', 'T', 'Boolean', { updates: derivedUpdates, parameters: [Declarations.functionParameter('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) }),
                Declarations.function('supports', 'T', 'Boolean', { updates: derivedUpdates, parameters: [Declarations.functionParameter('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) }),
                Declarations.function('max', 'List<T>', 'Number?', { updates: derivedUpdates, parameters: [Declarations.expressionParameter('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.max) }),
                Declarations.function('min', 'List<T>', 'Number?', { updates: derivedUpdates, parameters: [Declarations.expressionParameter('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.min) }),
                Declarations.function('sum', 'List<T>', 'Number', { updates: derivedUpdates, parameters: [Declarations.expressionParameter('Number?')], impl: ({ receiver, args }) => Vocabulary.#numbers(receiver, args.expression).reduce((total, number) => total + number, 0) }),
                Declarations.function('where', 'List<T>', 'List<T>', { updates: derivedUpdates, parameters: [Declarations.predicateParameter()], impl: ({ receiver, args }) => receiver.filter(item => args.expression(item) === true) }),
            ],

            // Each conversion takes the value, never null, and `reject`, which stops it for a value it does not convert.
            conversions: [
                {
                    from: 'String',
                    to: 'Number',
                    impl: ({ value, reject }) => {
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
                { from: 'Number', to: 'String', impl: ({ value }) => String(value) },
                { from: 'Boolean', to: 'String', impl: ({ value }) => String(value) },
                {
                    from: 'String',
                    to: 'Boolean',
                    impl: ({ value, reject }) => {
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
