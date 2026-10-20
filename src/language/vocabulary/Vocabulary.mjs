/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the members of lists, the conversions between strings, numbers and Booleans,
 * and the verbs that ask the conditions a host declares, with the functions that carry them out
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
     * Lexica's own module, with the functions that carry its members and conversions out: one module, created here alone, which every registry `lexica.createRegistry` makes holds and whose conversions between the language's types no other module may declare.
     * A module of its name made elsewhere is an ordinary module, so the exception belongs to this one alone.
     */
    static get module() {
        return Vocabulary.#module ??= new LexicaModule(Vocabulary.moduleName, {
            members: [
                property('count', 'list<T>', 'number', { changes: 'derived', reads: 'derived' }),
                property('first', 'list<T>', 'T?', { changes: 'derived', reads: 'derived' }),
                property('last', 'list<T>', 'T?', { changes: 'derived', reads: 'derived' }),
                Declarations.function('item', 'list<T>', 'T?', { form: 'indexer', isDefault: true, changes: 'derived', reads: 'derived', parameters: [valueParameter('index', 'number')] }),
                // The verbs that ask a condition: the condition's own declaration carries it out, its function, how it changes and the observations that cover it, so declaring each on any receiver selects the condition's own receivers.
                Declarations.function('is', 'any', 'boolean', { function: null, changes: 'derived', reads: 'derived', parameters: [valueParameter('name', 'string', { fixed: true, selects: 'condition' })] }),
                Declarations.function('has', 'any', 'boolean', { function: null, changes: 'derived', reads: 'derived', parameters: [valueParameter('name', 'string', { fixed: true, selects: 'condition' })] }),
                Declarations.function('supports', 'any', 'boolean', { function: null, changes: 'derived', reads: 'derived', parameters: [valueParameter('name', 'string', { fixed: true, selects: 'condition' })] }),
                Declarations.function('max', 'list<T>', 'number?', { changes: 'derived', reads: 'derived', parameters: [expressionParameter('number?')] }),
                Declarations.function('min', 'list<T>', 'number?', { changes: 'derived', reads: 'derived', parameters: [expressionParameter('number?')] }),
                Declarations.function('sum', 'list<T>', 'number', { changes: 'derived', reads: 'derived', parameters: [expressionParameter('number?')] }),
                Declarations.function('where', 'list<T>', 'list<T>', { changes: 'derived', reads: 'derived', parameters: [predicateParameter()] }),
            ],

            conversions: [
                { from: 'string', to: 'number', function: 'stringToNumber' },
                { from: 'number', to: 'string', function: 'numberToString' },
                { from: 'boolean', to: 'string', function: 'booleanToString' },
                { from: 'string', to: 'boolean', function: 'stringToBoolean' },
            ],
        }, Vocabulary.functions);
    }

    /**
     * The functions of Lexica's built-in members and conversions: each takes the receiver and the arguments by parameter name; a conversion takes the value, never null, and `reject`, which stops it for a value it does not convert.
     * @type {Record<string, Function>}
     */
    static get functions() {
        return {
            stringToNumber: (text, { reject }) => {
                const trimmed = text.replace(SURROUNDING_ASCII_WHITESPACE, '');

                if (!VALID_FLOATING_POINT_NUMBER.test(trimmed)) {
                    reject(`${JSON.stringify(text)} is no number, which is written as HTML's valid floating-point number, as -12, 3.5, .5 or 1e3 are`);
                }

                const number = Number(trimmed);

                if (!Number.isFinite(number)) {
                    reject(`${JSON.stringify(text)} is too large a number to be finite`);
                }

                return number;
            },
            // The shortest text that reads back as the same number, as ECMAScript writes it, and negative zero as "0".
            numberToString: number => String(number),
            booleanToString: value => String(value),
            stringToBoolean: (text, { reject }) => {
                if (text !== 'true' && text !== 'false') {
                    reject(`${JSON.stringify(text)} is no Boolean, which is written "true" or "false"`);
                }

                return text === 'true';
            },
            count: items => items.length,
            first: items => items.at(0) ?? null,
            last: items => items.at(-1) ?? null,
            // The item at a whole index from zero, null for any other index, a negative one included, which never counts from the end.
            item: (items, { index }) => (Number.isInteger(index) && index >= 0 && index < items.length ? items[index] : null),
            max: (items, { expression }) => Vocabulary.#extreme(items, expression, Math.max),
            min: (items, { expression }) => Vocabulary.#extreme(items, expression, Math.min),
            sum: (items, { expression }) => Vocabulary.#numbers(items, expression).reduce((total, number) => total + number, 0),
            where: (items, { expression }) => items.filter(item => expression(item) === true),
        };
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
