/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the language's value types, the members of lists, the conversion operators of strings, numbers and Booleans,
 * and the verbs that test a receiver, each carrying its implementation
 */

import { Names } from '../Names.mjs';
import { Pair } from '../Pair.mjs';
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
    static moduleName = Names.lexicaModuleName;

    /** @type {readonly object[] | undefined} */
    static #valueTypes;

    /**
     * The value types Lexica's own module owns, each declared through a form internal to Lexica, which no other module declares through: its scalar types, of kind `scalar`, each holding its conversion operators to
     * the others, and its generic collections, of kind `generic`, their type parameters under `typeParameters` and the variance of each, in order, under `variances`, with their members within them, whose receiver
     * gives them its parameters: `List<T>`, covariant in its items, since a list is immutable; `Dictionary<K, V>`, invariant in its keys, which a lookup takes, and covariant in its values; and `Pair<K, V>`, covariant
     * in both. Created once, frozen, and read by identity: the registry registers their members with Lexica's own module.
     */
    static get valueTypes() {
        return Vocabulary.#valueTypes ??= Object.freeze([
            ...LexicaModule.scalarTypeNames.map(name => Object.freeze({ name, kind: 'scalar', members: Vocabulary.#createMembers(name, name, Vocabulary.#createConversions(name)) })),
            Object.freeze({ name: 'List', kind: 'generic', typeParameters: Object.freeze(['T']), variances: Object.freeze(['covariant']), members: Vocabulary.#createMembers('List<T>', 'List<T>', Vocabulary.#createListMembers()) }),
            Object.freeze({ name: 'Dictionary', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['invariant', 'covariant']), members: Vocabulary.#createMembers('Dictionary<K, V>', 'Dictionary<K, V>', Vocabulary.#createDictionaryMembers()) }),
            Object.freeze({ name: 'Pair', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['covariant', 'covariant']), members: Vocabulary.#createMembers('Pair<K, V>', 'Pair<K, V>', Vocabulary.#createPairMembers()) }),
        ]);
    }

    /** @type {readonly string[] | undefined} */
    static #builtInTypeNames;

    /** The names of the value types Lexica's own module owns, which a declaration or a script names unqualified with no module declaring them, derived from those types: `Number`, `String`, `Boolean`, `List`, `Dictionary` and `Pair`. */
    static get builtInTypeNames() {
        return Vocabulary.#builtInTypeNames ??= Object.freeze(Vocabulary.valueTypes.map(type => type.name));
    }

    /** @type {readonly string[] | undefined} */
    static #ownTypeNames;

    /** Every type name Lexica's own vocabulary gives, unqualified, wherever a type is named: its value types' and the reserved types', `Any` and `Never`. */
    static get ownTypeNames() {
        return Vocabulary.#ownTypeNames ??= Object.freeze([...Vocabulary.builtInTypeNames, 'Any', 'Never']);
    }

    /** @type {ReadonlySet<object> | undefined} */
    static #orderKeepingMembers;

    /** Whether the member is one of Lexica's own that answers some of its receiver's items in their order, as a filter does, so its answer carries each kept item's lineage: `where` alone. */
    static keepsItemsInOrder(declaration) {
        Vocabulary.#orderKeepingMembers ??= new Set(Vocabulary.getTypeDeclaration('List').members.filter(member => member.name === 'where'));

        return Vocabulary.#orderKeepingMembers.has(declaration);
    }

    /** The declaration of the value type Lexica's own module owns under the name, or undefined for a name it owns none of. */
    static getTypeDeclaration(name) {
        return Vocabulary.valueTypes.find(type => type.name === name);
    }

    /** @type {LexicaModule | undefined} */
    static #module;

    /**
     * Lexica's own module, each member and operator carrying its implementation: one module, created here alone, which every registry `lexica.createRegistry` makes holds and whose conversions between the language's
     * types no other module may declare. It declares the verbs in `VerbExtensions<T>`, an extension targeting its parameter, so on any type, and owns the value types, whose members and operators the registry registers
     * with it. A module of its name made elsewhere is an ordinary module, so the exception belongs to this one alone.
     */
    static get module() {
        // The verbs, each answering what its test answers of its receiver, a function of the receiver's own type that answers a Boolean, so each reads and changes as its test does.
        const verb = name => Declarations.createFunctionDeclaration(name, 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createFunctionParameterDeclaration('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) });

        return Vocabulary.#module ??= new LexicaModule(Vocabulary.moduleName, {
            types: [{ name: 'VerbExtensions<T>', kind: 'extension', target: 'T', members: ['is', 'has', 'supports'].map(verb) }],
        });
    }

    /**
     * The members of one of Lexica's own value types, validated, copied and frozen as a module's are, by a module created for that alone and never registered: an extension of the type gives them the receiver and the
     * scope its members read, a list's `T` among them, and no module declares Lexica's value types, whose form is Lexica's alone.
     */
    static #createMembers(name, target, members) {
        return new LexicaModule(Vocabulary.moduleName, { types: [{ name, kind: 'extension', target, members }] }).types[0].members;
    }

    /**
     * The conversion operators of the scalar type, each taking the value, never null, and `reject`, which stops it for a value it does not convert: a string to a number, as HTML's valid floating-point number, and to a
     * Boolean, written "true" or "false"; and a number and a Boolean to a string.
     */
    static #createConversions(name) {
        const convert = (result, impl) => ({ kind: 'operator', name: 'convert', result, impl });

        switch (name) {
            case 'String':
                return [
                    convert('Number', ({ value, reject }) => {
                        const trimmed = value.replace(SURROUNDING_ASCII_WHITESPACE, '');

                        if (!VALID_FLOATING_POINT_NUMBER.test(trimmed)) {
                            reject(`${JSON.stringify(value)} is no number, which is written as HTML's valid floating-point number, as -12, 3.5, .5 or 1e3 are`);
                        }

                        const number = Number(trimmed);

                        if (!Number.isFinite(number)) {
                            reject(`${JSON.stringify(value)} is too large a number to be finite`);
                        }

                        return number;
                    }),
                    convert('Boolean', ({ value, reject }) => {
                        if (value !== 'true' && value !== 'false') {
                            reject(`${JSON.stringify(value)} is no Boolean, which is written "true" or "false"`);
                        }

                        return value === 'true';
                    }),
                ];
            // The shortest text that reads back as the same number, as ECMAScript writes it, and negative zero as "0".
            case 'Number':
                return [convert('String', ({ value }) => String(value))];
            // A Boolean's text, "true" or "false".
            default:
                return [convert('String', ({ value }) => String(value))];
        }
    }

    /** The members of lists, each reading and changing as the items it selects and the expression it evaluates do. */
    static #createListMembers() {
        return [
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
            // The item at a whole index from zero as a pair of its index and itself, null for any other index, as the list's unnamed indexer reads it.
            Declarations.createIndexerDeclaration('entry', 'Pair<Number, T>?', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('index', 'Number')],
                impl: ({ receiver, args }) => (Number.isInteger(args.index) && args.index >= 0 && args.index < receiver.length ? new Pair(args.index, receiver[args.index]) : null),
            }),
        ];
    }

    /**
     * The members of dictionaries, each reading and changing as the entries it reads do. A key a lookup is given may be null, which reads the null key where the dictionary's keys admit one, and an absent key otherwise,
     * so a key's parameter consumes null rather than propagating it; a lookup answers null for an absent key, `containsKey` and `entry` telling it from a key whose value is null.
     */
    static #createDictionaryMembers() {
        const key = () => Declarations.createValueParameterDeclaration('key', 'K?', { nulls: 'accept' });

        return [
            Declarations.createPropertyDeclaration('count', 'Number', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.count }),
            Declarations.createIndexerDeclaration(null, 'V?', { updates: DERIVED_UPDATES, parameters: [key()], impl: ({ receiver, args }) => receiver.get(args.key) }),
            Declarations.createIndexerDeclaration('entry', 'Pair<K, V>?', { updates: DERIVED_UPDATES, parameters: [key()], impl: ({ receiver, args }) => receiver.getEntry(args.key) }),
            Declarations.createFunctionDeclaration('containsKey', 'Boolean', { updates: DERIVED_UPDATES, parameters: [key()], impl: ({ receiver, args }) => receiver.has(args.key) }),
            Declarations.createPropertyDeclaration('keys', 'List<K>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.keys }),
            Declarations.createPropertyDeclaration('values', 'List<V>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.values }),
            Declarations.createPropertyDeclaration('entries', 'List<Pair<K, V>>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.entries }),
        ];
    }

    /** The members of pairs: its key and its value, each reading as the pair does. */
    static #createPairMembers() {
        return [
            Declarations.createPropertyDeclaration('key', 'K', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.key }),
            Declarations.createPropertyDeclaration('value', 'V', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.value }),
        ];
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
