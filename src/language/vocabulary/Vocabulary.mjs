/**
 * Vocabulary — Lexica's built-in vocabulary, what every expression has whatever its host: the language's value types, the members of lists, the conversion operators of strings, numbers and Booleans,
 * and the verbs that test a receiver, each carrying its implementation
 */

import { Dictionary } from '../Dictionary.mjs';
import { Names } from '../Names.mjs';
import { Pair } from '../Pair.mjs';
import { Declarations } from './Declarations.mjs';
import { LexicaModule } from './LexicaModule.mjs';
import { ListOrdering } from './ListOrdering.mjs';
import { MemberFailure } from './MemberFailure.mjs';

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
     * in both; and its position types, of kind `position`, `Index`, an offset from a list's end, and `Range`, two boundaries, which declare no members. Created once, frozen, and read by identity: the registry
     * registers their members with Lexica's own module.
     */
    static get valueTypes() {
        return Vocabulary.#valueTypes ??= Object.freeze([
            ...LexicaModule.scalarTypeNames.map(name => Object.freeze({ name, kind: 'scalar', members: Vocabulary.#createMembers(name, name, [...Vocabulary.#createConversions(name), ...(name === 'Number' ? Vocabulary.#createNumberMembers() : [])]) })),
            Object.freeze({ name: 'List', kind: 'generic', typeParameters: Object.freeze(['T']), variances: Object.freeze(['covariant']), members: Vocabulary.#createMembers('List<T>', 'List<T>', Vocabulary.#createListMembers()) }),
            Object.freeze({ name: 'Dictionary', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['invariant', 'covariant']), members: Vocabulary.#createMembers('Dictionary<K, V>', 'Dictionary<K, V>', Vocabulary.#createDictionaryMembers()) }),
            ...['Index', 'Range'].map(name => Object.freeze({ name, kind: 'position', members: Object.freeze([]) })),
            Object.freeze({ name: 'Pair', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['covariant', 'covariant']), members: Vocabulary.#createMembers('Pair<K, V>', 'Pair<K, V>', Vocabulary.#createPairMembers()) }),
        ]);
    }

    /** @type {readonly string[] | undefined} */
    static #builtInTypeNames;

    /** The names of the value types Lexica's own module owns, which a declaration or a script names unqualified with no module declaring them, derived from those types: `Number`, `String`, `Boolean`, `List`, `Dictionary`, `Index`, `Range` and `Pair`. */
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
    static #itemKeepingMembers;

    /** @type {ReadonlySet<object> | undefined} */
    static #projectingMembers;

    /**
     * Whether the member is one of Lexica's own lists' that answers items of its receiver, as they stand there, kept, left out, reordered or taken once each, so its answer carries each answered item's lineage:
     * `where`, `take`, `drop`, `takeWhile`, `dropWhile`, `distinct`, `distinctBy`, `reverse`, and the members that order, `orderBy`, `orderByDescending`, `thenBy` and `thenByDescending`.
     */
    static answersReceiverItems(declaration) {
        Vocabulary.#itemKeepingMembers ??= Vocabulary.#listMembersNamed(['where', 'take', 'drop', 'takeWhile', 'dropWhile', 'distinct', 'distinctBy', 'reverse', 'orderBy', 'orderByDescending', 'thenBy', 'thenByDescending']);

        return Vocabulary.#itemKeepingMembers.has(declaration);
    }

    /** Whether the member is one of Lexica's own lists' that answers one value for each of its receiver's items, in their order, as an object projection does, so its answer records each item as its source: `select` alone. */
    static projectsItems(declaration) {
        Vocabulary.#projectingMembers ??= Vocabulary.#listMembersNamed(['select']);

        return Vocabulary.#projectingMembers.has(declaration);
    }

    /** The members of Lexica's own lists of the names, by identity. */
    static #listMembersNamed(names) {
        return new Set(Vocabulary.getTypeDeclaration('List').members.filter(member => names.includes(member.name)));
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
            types: [
                { name: 'VerbExtensions<T>', kind: 'extension', target: 'T', members: ['is', 'has', 'supports'].map(verb) },
                // A list of lists flattens to their items, each inner list's in order; an inner list that can be null is no list of lists, so none is ever treated as empty.
                { name: 'NestedListExtensions<T>', kind: 'extension', target: 'List<List<T>>', members: [Declarations.createPropertyDeclaration('flatten', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.flat() })] },
            ],
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

    /** The members of a number beside its conversions: `sequence`, the numbers from it, generated apart from any range. */
    static #createNumberMembers() {
        return [
            // The count's numbers from the receiver, each the step after the one before, the step 1 where it is left out; a count that is no nonnegative safe integer is refused.
            Declarations.createFunctionDeclaration('sequence', 'List<Number>', {
                updates: DERIVED_UPDATES,
                parameters: [Declarations.createValueParameterDeclaration('count', 'Number'), Declarations.createValueParameterDeclaration('step', 'Number', { default: 1 })],
                impl: ({ receiver, args }) => {
                    if (!Number.isSafeInteger(args.count) || args.count < 0) {
                        throw new MemberFailure('LEXICA5035', `'sequence' takes a count that is a nonnegative whole number, and is given ${args.count}`);
                    }

                    return Array.from({ length: args.count }, (_, index) => receiver + index * args.step);
                },
            }),
        ];
    }

    /** The item at the offset from the start, null for one the list has no item at. */
    static #itemAt(list, offset) {
        return offset >= 0 && offset < list.length ? list[offset] : null;
    }

    /** The items within the range, applied to the list's length once, its start at or before its end and both within the list, or refused. */
    static #slice(list, range) {
        const { start, end } = range.resolveIn(list.length);

        if (start < 0 || end > list.length || start > end) {
            throw new MemberFailure('LEXICA5033', `The range ${range} is applied to a list of ${list.length} items, and gives ${start}..${end}, which ${start > end ? 'starts after it ends' : 'stands beyond the list'}; a slice is strict, as take and drop are not`);
        }

        return list.slice(start, end);
    }

    /** The item a position `pick` is given stands at, a whole offset from the start of the list, or refused. */
    static #pickAt(list, position) {
        if (!Number.isInteger(position) || position < 0 || position >= list.length) {
            throw new MemberFailure('LEXICA5034', `'pick' is given the position ${position}, and a list of ${list.length} items has no item there`);
        }

        return list[position];
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
            // The item at an index from the end, `^1` the last, null for `^0` and for one before the start.
            Declarations.createIndexerDeclaration(null, 'T?', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('index', 'Index')], impl: ({ receiver, args }) => Vocabulary.#itemAt(receiver, args.index.resolveIn(receiver.length)) }),
            // The items within a range, applied to the length once, strictly: a reversed range, or one beyond the list, is refused, never trimmed.
            Declarations.createIndexerDeclaration(null, 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('range', 'Range')], impl: ({ receiver, args }) => Vocabulary.#slice(receiver, args.range) }),
            Declarations.createFunctionDeclaration('max', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.max) }),
            Declarations.createFunctionDeclaration('min', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#extreme(receiver, args.expression, Math.min) }),
            Declarations.createFunctionDeclaration('sum', 'Number', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')], impl: ({ receiver, args }) => Vocabulary.#numbers(receiver, args.expression).reduce((total, number) => total + number, 0) }),
            Declarations.createFunctionDeclaration('where', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.filter(item => args.expression(item) === true) }),
            // Every item's value, null items included, its expression's `it` of the item's type, so `select(it)` keeps the list and `select(it ?? 0)` replaces its nulls.
            Declarations.createFunctionDeclaration('select<U>', 'List<U>', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('U', { nulls: 'accept' })], impl: ({ receiver, args }) => receiver.map(item => args.expression(item)) }),
            // Each item's list, in order, joined; a null item's, whose body answers null, and a null list are refused, never treated as empty.
            Declarations.createFunctionDeclaration('selectMany<U>', 'List<U>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('List<U>')],
                impl: ({ receiver, args }) => receiver.flatMap(item => {
                    const items = args.expression(item);

                    if (items === null) {
                        throw new MemberFailure('LEXICA5031', "'selectMany' joins the list each item gives, and an item gave null, which is no list: give an empty list for an item that has none");
                    }

                    return [items];
                }).flat(),
            }),
            Declarations.createFunctionDeclaration('concat', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('other', 'List<T>')], impl: ({ receiver, args }) => [...receiver, ...args.other] }),
            // The items at an index less than the count, or at one the count or past it, whatever the count: a count past the end takes or leaves every item, and one of zero or less none.
            Declarations.createFunctionDeclaration('take', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl: ({ receiver, args }) => receiver.filter((_, index) => index < args.count) }),
            Declarations.createFunctionDeclaration('drop', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl: ({ receiver, args }) => receiver.filter((_, index) => index >= args.count) }),
            // The items before the first its predicate is falsy for, which it is evaluated against last, or the items from it on, the predicate evaluated against none after it.
            Declarations.createFunctionDeclaration('takeWhile', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.slice(0, Vocabulary.#firstIndex(receiver, item => args.expression(item) !== true)) }),
            Declarations.createFunctionDeclaration('dropWhile', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.slice(Vocabulary.#firstIndex(receiver, item => args.expression(item) !== true)) }),
            // Whether some item's predicate is truthy, stopping at the first that is, false for no items; whether every item's is, stopping at the first that is not, true for no items.
            Declarations.createFunctionDeclaration('any', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.some(item => args.expression(item) === true) }),
            Declarations.createFunctionDeclaration('all', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.every(item => args.expression(item) === true) }),
            // Whether an item equals the value by the language's key equality, stopping at the first that does; null equals a null item.
            Declarations.createFunctionDeclaration('contains', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('value', 'T?', { nulls: 'accept' })], impl: ({ receiver, args }) => receiver.includes(args.value) }),
            // The one item, null for none, and refused where the list holds several, which no one item stands for.
            Declarations.createPropertyDeclaration('single', 'T?', {
                updates: DERIVED_UPDATES,
                impl: ({ receiver }) => {
                    if (receiver.length > 1) {
                        throw new MemberFailure('LEXICA5030', `'single' answers the one item of a list, and the list holds ${receiver.length}`);
                    }

                    return receiver.at(0) ?? null;
                },
            }),
            Declarations.createFunctionDeclaration('average', 'Number?', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('Number?')],
                impl: ({ receiver, args }) => {
                    const numbers = Vocabulary.#numbers(receiver, args.expression);

                    return numbers.length === 0 ? null : numbers.reduce((total, number) => total + number, 0) / numbers.length;
                },
            }),
            // The first item whose key is the least or the greatest, ordered as `orderBy` orders, items whose key is null skipped, and null where none has one.
            Declarations.createFunctionDeclaration('minBy<K>', 'T?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => ListOrdering.findExtreme(receiver, args.expression, false, 'minBy') }),
            Declarations.createFunctionDeclaration('maxBy<K>', 'T?', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => ListOrdering.findExtreme(receiver, args.expression, true, 'maxBy') }),
            // The items ordered by the key each gives, stable, a null key last in either direction; and each run of items equal so far refined by another key, the list ordered once and never again.
            ...[['orderBy', false], ['orderByDescending', true]].map(([name, isDescending]) => Declarations.createFunctionDeclaration(`${name}<K>`, 'List<T>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => ListOrdering.orderBy(receiver, args.expression, isDescending, name),
            })),
            ...[['thenBy', false], ['thenByDescending', true]].map(([name, isDescending]) => Declarations.createFunctionDeclaration(`${name}<K>`, 'List<T>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => ListOrdering.thenBy(receiver, args.expression, isDescending, name),
            })),
            // Each value's first occurrence, in order, values compared by the language's key equality; and each key's first item, its key the expression's value, keys compared alike.
            Declarations.createPropertyDeclaration('distinct', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => [...new Set(receiver)] }),
            Declarations.createFunctionDeclaration('distinctBy<K>', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => [...Vocabulary.#groupsOf(receiver, args.expression).values()].map(group => group[0]) }),
            Declarations.createPropertyDeclaration('reverse', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => [...receiver].reverse() }),
            // A dictionary of the items by the key each gives, in the items' order, two items of one key refused, which grouping collects instead.
            Declarations.createFunctionDeclaration('toDictionary<K>', 'Dictionary<K, T>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')],
                impl: ({ receiver, args }) => {
                    const entries = new Map();

                    for (const item of receiver) {
                        const key = args.expression(item);

                        if (entries.has(key)) {
                            throw new MemberFailure('LEXICA5029', `'toDictionary' keys each item once, and two items give the key ${Vocabulary.#describeKey(key)}: group them with groupBy`);
                        }

                        entries.set(key, item);
                    }

                    return new Dictionary(entries);
                },
            }),
            // A dictionary of the items by the key each gives, each key's items in their order, the keys in the order their first items stand.
            Declarations.createFunctionDeclaration('groupBy<K>', 'Dictionary<K, List<T>>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')],
                impl: ({ receiver, args }) => new Dictionary([...Vocabulary.#groupsOf(receiver, args.expression)].map(([key, group]) => [key, Object.freeze(group)])),
            }),
            // The item at a whole index from zero as a pair of its index and itself, null for any other index, as the list's unnamed indexer reads it.
            Declarations.createIndexerDeclaration('entry', 'Pair<Number, T>?', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('index', 'Number')],
                impl: ({ receiver, args }) => (Number.isInteger(args.index) && args.index >= 0 && args.index < receiver.length ? new Pair(args.index, receiver[args.index]) : null),
            }),
            // The item at an index from the end as a pair of its index from the start and itself, null where the unnamed indexer answers null.
            Declarations.createIndexerDeclaration('entry', 'Pair<Number, T>?', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('index', 'Index')],
                impl: ({ receiver, args }) => {
                    const offset = args.index.resolveIn(receiver.length);

                    return offset >= 0 && offset < receiver.length ? new Pair(offset, receiver[offset]) : null;
                },
            }),
            // The item at each position, in the positions' order, one given twice giving its item twice; a position no item stands at is refused.
            Declarations.createFunctionDeclaration('pick', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('positions', 'List<Number>')], impl: ({ receiver, args }) => args.positions.map(position => Vocabulary.#pickAt(receiver, position)) }),
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
            // The entries whose value's predicate is truthy, and each entry's value replaced by its expression's, every value null included, each keeping its key and its place; an operation needing the key reads the entries.
            Declarations.createFunctionDeclaration('where', 'Dictionary<K, V>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => new Dictionary(receiver.entries.filter(entry => args.expression(entry.value) === true).map(entry => [entry.key, entry.value])) }),
            Declarations.createFunctionDeclaration('select<U>', 'Dictionary<K, U>', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('U', { nulls: 'accept' })], impl: ({ receiver, args }) => new Dictionary(receiver.entries.map(entry => [entry.key, args.expression(entry.value)])) }),
        ];
    }

    /** The members of pairs: its key and its value, each reading as the pair does. */
    static #createPairMembers() {
        return [
            Declarations.createPropertyDeclaration('key', 'K', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.key }),
            Declarations.createPropertyDeclaration('value', 'V', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.value }),
        ];
    }

    /** The index of the first item the test holds for, the list's length where it holds for none, testing no item after it. */
    static #firstIndex(items, test) {
        const index = items.findIndex(test);

        return index === -1 ? items.length : index;
    }

    /** The items grouped by the key the expression gives each, keys compared by the language's key equality, each group in the items' order, the groups in the order their first items stand. */
    static #groupsOf(items, expression) {
        const groups = new Map();

        for (const item of items) {
            const key = expression(item);

            groups.has(key) ? groups.get(key).push(item) : groups.set(key, [item]);
        }

        return groups;
    }

    /** A key as a message writes it: a string quoted, and any other value as its text. */
    static #describeKey(key) {
        return typeof key === 'string' ? JSON.stringify(key) : String(key);
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
