/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the language's value types, the members of lists, the conversions between strings, numbers and Booleans,
 * and the verbs that test a receiver, each carrying its implementation
 */

import { Declarations } from './Declarations.mjs';
import { LexicaModule } from './LexicaModule.mjs';

/** The text a conversion to a number takes: HTML's valid floating-point number, an optional minus, digits with an optional fraction or a fraction alone, and an optional exponent whose sign is optional. */
const VALID_FLOATING_POINT_NUMBER = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;

/** The ASCII whitespace a text converted to a number is trimmed of at either end: tab, line feed, form feed, carriage return and space. */
const SURROUNDING_ASCII_WHITESPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/** The updates of a member that reads and changes as what it selects and evaluates does. */
const DERIVED_UPDATES = Object.freeze({ changes: 'derived', reads: 'derived' });

export class Vocabulary {
    /** The name of Lexica's own module, spelled as the specification spells it. */
    static moduleName = 'Lexica';

    /** @type {readonly object[] | undefined} */
    static #valueTypes;

    /**
     * The value types Lexica's own module owns, each declared through a form internal to Lexica, which no other module declares through: its scalar types, of kind `scalar`, and `List<T>`, of kind `generic`, its type
     * parameters under `typeParameters` and the variance of each, in order, under `variances`, covariant in its items, since a list is immutable, and the members of lists within it, whose receiver gives them its `T`.
     * Created once, frozen, and read by identity: the registry registers their members with Lexica's own module.
     */
    static get valueTypes() {
        return Vocabulary.#valueTypes ??= Object.freeze([
            ...LexicaModule.scalarTypeNames.map(name => Object.freeze({ name, kind: 'scalar' })),
            Object.freeze({ name: 'List', kind: 'generic', typeParameters: Object.freeze(['T']), variances: Object.freeze(['covariant']), members: Vocabulary.#createListMembers() }),
        ]);
    }

    /** @type {readonly string[] | undefined} */
    static #builtInTypeNames;

    /** The names of the value types Lexica's own module owns, which a declaration or a script names unqualified with no module declaring them, derived from those types: `Number`, `String`, `Boolean` and `List`. */
    static get builtInTypeNames() {
        return Vocabulary.#builtInTypeNames ??= Object.freeze(Vocabulary.valueTypes.map(type => type.name));
    }

    /** The declaration of the value type Lexica's own module owns under the name, or undefined for a name it owns none of. */
    static getTypeDeclaration(name) {
        return Vocabulary.valueTypes.find(type => type.name === name);
    }

    /** @type {LexicaModule | undefined} */
    static #module;

    /**
     * Lexica's own module, each member and conversion carrying its implementation: one module, created here alone, which every registry `lexica.createRegistry` makes holds and whose conversions between the language's types no other module may declare.
     * It declares the verbs in `VerbExtensions<T>`, an extension targeting its parameter, so on any type, and owns the value types, whose members the registry registers with it. A module of its name made elsewhere
     * is an ordinary module, so the exception belongs to this one alone.
     */
    static get module() {
        // The verbs, each answering what its test answers of its receiver, a function of the receiver's own type that answers a Boolean, so each reads and changes as its test does.
        const verb = name => Declarations.createFunctionDeclaration(name, 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createFunctionParameterDeclaration('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) });

        return Vocabulary.#module ??= new LexicaModule(Vocabulary.moduleName, {
            types: [{ name: 'VerbExtensions<T>', kind: 'extension', target: 'T', members: ['is', 'has', 'supports'].map(verb) }],

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

    /**
     * The members of lists, validated, copied and frozen as a module's are, by a module created for that alone and never registered: an extension of `List<T>` gives them the scope a list's members read, its `T`,
     * and no module declares a generic type, whose form is Lexica's alone.
     */
    static #createListMembers() {
        const members = [
            Declarations.createPropertyDeclaration('count', 'Number', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.length }),
            Declarations.createPropertyDeclaration('first', 'T?', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.at(0) ?? null }),
            Declarations.createPropertyDeclaration('last', 'T?', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.at(-1) ?? null }),
            // The item at a whole index from zero, null for any other index, a negative one included, which never counts from the end.
            Declarations.createIndexerDeclaration(null, 'T?', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('index', 'Number')],
                impl: ({ receiver, args }) => (Number.isInteger(args.index) && args.index >= 0 && args.index < receiver.length ? receiver[args.index] : null),
            }),
            Declarations.createFunctionDeclaration('max', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.max) }),
            Declarations.createFunctionDeclaration('min', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.min) }),
            Declarations.createFunctionDeclaration('sum', 'Number', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#numbers(receiver, args.expression).reduce((total, number) => total + number, 0) }),
            Declarations.createFunctionDeclaration('where', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.filter(item => args.expression(item) === true) }),
        ];

        return new LexicaModule(Vocabulary.moduleName, { types: [{ name: 'List<T>', kind: 'extension', target: 'List<T>', members }] }).types[0].members;
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
