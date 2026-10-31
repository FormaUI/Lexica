/**
 * Vocabulary — Nexo's built-in vocabulary, what every expression has whatever its host: the language's value types, the members of lists, numbers and strings, and the conversion operators of strings,
 * numbers and Booleans, each carrying its implementation
 */

import { Dictionary } from '../Dictionary.mjs';
import { Names } from '../Names.mjs';
import { Pair } from '../Pair.mjs';
import { Declarations } from './Declarations.mjs';
import { ItemPositions } from './ItemPositions.mjs';
import { NexoModule } from './NexoModule.mjs';
import { ListOrdering } from './ListOrdering.mjs';
import { MemberFailure } from './MemberFailure.mjs';

/** The text a conversion to a number takes: HTML's valid floating-point number, an optional minus, digits with an optional fraction or a fraction alone, and an optional exponent whose sign is optional. */
const VALID_FLOATING_POINT_NUMBER = /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;

/** The ASCII whitespace a text converted to a number is trimmed of at either end: tab, line feed, form feed, carriage return and space. */
const SURROUNDING_ASCII_WHITESPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/** The updates of a member that reads and changes as what it selects and evaluates does. */
const DERIVED_UPDATES = Object.freeze({ changes: 'derived', reads: 'derived' });

export class Vocabulary {
    /** The name of Nexo's own module, spelled as the specification spells it. */
    static moduleName = Names.nexoModuleName;

    /** @type {readonly object[] | undefined} */
    static #valueTypes;

    /**
     * The value types Nexo's own module owns, each declared through a form internal to Nexo, which no other module declares through: its scalar types, of kind `scalar`, each holding its conversion operators to
     * the others, and its generic collections, of kind `generic`, their type parameters under `typeParameters` and the variance of each, in order, under `variances`, with their members within them, whose receiver
     * gives them its parameters: `List<T>`, covariant in its items, since a list is immutable; `Dictionary<K, V>`, invariant in its keys, which a lookup takes, and covariant in its values; and `Pair<K, V>`, covariant
     * in both; and its position types, of kind `position`, `Index`, an offset from a list's end, and `Range`, two boundaries, which declare no members. Created once, frozen, and read by identity: the registry
     * registers their members with Nexo's own module.
     */
    static get valueTypes() {
        return Vocabulary.#valueTypes ??= Object.freeze([
            ...NexoModule.scalarTypeNames.map(name => Object.freeze({ name, kind: 'scalar', members: Vocabulary.#createMembers(name, name, [...Vocabulary.#createConversions(name), ...Vocabulary.#createScalarMembers(name)]) })),
            Vocabulary.#createListType(),
            Object.freeze({ name: 'Dictionary', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['invariant', 'covariant']), members: Vocabulary.#createMembers('Dictionary<K, V>', 'Dictionary<K, V>', Vocabulary.#createDictionaryMembers()) }),
            ...['Index', 'Range'].map(name => Object.freeze({ name, kind: 'position', members: Object.freeze([]) })),
            Object.freeze({ name: 'Pair', kind: 'generic', typeParameters: Object.freeze(['K', 'V']), variances: Object.freeze(['covariant', 'covariant']), members: Vocabulary.#createMembers('Pair<K, V>', 'Pair<K, V>', Vocabulary.#createPairMembers()) }),
        ]);
    }

    /** @type {readonly string[] | undefined} */
    static #builtInTypeNames;

    /** The names of the value types Nexo's own module owns, which a declaration or a script names unqualified with no module declaring them, derived from those types: `Number`, `String`, `Boolean`, `List`, `Dictionary`, `Index`, `Range` and `Pair`. */
    static get builtInTypeNames() {
        return Vocabulary.#builtInTypeNames ??= Object.freeze(Vocabulary.valueTypes.map(type => type.name));
    }

    /** @type {readonly string[] | undefined} */
    static #ownTypeNames;

    /** Every type name Nexo's own vocabulary gives, unqualified, wherever a type is named: its value types' and the reserved types', `Any` and `Never`. */
    static get ownTypeNames() {
        return Vocabulary.#ownTypeNames ??= Object.freeze([...Vocabulary.builtInTypeNames, 'Any', 'Never']);
    }

    /** @type {ReadonlySet<object> | undefined} */
    static #itemKeepingMembers;

    /** @type {ReadonlySet<object> | undefined} */
    static #projectingMembers;

    /** @type {ReadonlySet<object> | undefined} */
    static #itemGivingMembers;

    /**
     * Whether the member is one of Nexo's own lists' that answers items of its receiver, as they stand there, kept, left out, reordered, taken once each or repeated, so its answer carries each answered item's
     * lineage, which the position it stood at, kept by `ItemPositions` with the answer, says: `where`, `take`, `drop`, `takeWhile`, `dropWhile`, `distinct`, `distinctBy`, `reverse`, the members that order,
     * `orderBy`, `orderByDescending`, `thenBy` and `thenByDescending`, the unnamed indexer's signature that slices by a range, and `pick`.
     */
    static answersReceiverItems(declaration) {
        Vocabulary.#itemKeepingMembers ??= new Set(Vocabulary.getTypeDeclaration('List').members.filter(member =>
            ['where', 'take', 'drop', 'takeWhile', 'dropWhile', 'distinct', 'distinctBy', 'reverse', 'orderBy', 'orderByDescending', 'thenBy', 'thenByDescending', 'pick'].includes(member.name)
            || (member.kind === 'indexer' && member.name === undefined && member.parameters[0].type === 'Range')));

        return Vocabulary.#itemKeepingMembers.has(declaration);
    }

    /** Whether the member is one of Nexo's own lists' that answers one value for each of its receiver's items, in their order, as an object projection does, so its answer records each item as its source: `select` alone. */
    static projectsItems(declaration) {
        Vocabulary.#projectingMembers ??= Vocabulary.#listMembersNamed(['select']);

        return Vocabulary.#projectingMembers.has(declaration);
    }

    /**
     * Whether the member is one of Nexo's own that calls each function it is given with one argument alone, an item of its receiver as it stands there: every member of a list that takes an expression or a predicate,
     * and a dictionary's `where` and `select`, which give each of its values.
     */
    static givesReceiverItems(declaration) {
        Vocabulary.#itemGivingMembers ??= new Set(['List', 'Dictionary'].flatMap(name => Vocabulary.getTypeDeclaration(name).members).filter(member => member.parameters?.some(parameter => parameter.kind === 'expression' || parameter.kind === 'predicate')));

        return Vocabulary.#itemGivingMembers.has(declaration);
    }

    /** The members of Nexo's own lists of the names, by identity. */
    static #listMembersNamed(names) {
        return new Set(Vocabulary.getTypeDeclaration('List').members.filter(member => names.includes(member.name)));
    }

    /** The declaration of the value type Nexo's own module owns under the name, or undefined for a name it owns none of. */
    static getTypeDeclaration(name) {
        return Vocabulary.valueTypes.find(type => type.name === name);
    }

    /** @type {NexoModule | undefined} */
    static #module;

    /**
     * Nexo's own module, each member and operator carrying its implementation: one module, created here alone, which every registry `nexo.createRegistry` makes holds and whose conversions between the language's
     * types no other module may declare. It owns the value types, whose members and operators the registry registers with it, and declares no extension. A module of its name made elsewhere is an ordinary module,
     * so the exception belongs to this one alone.
     */
    static get module() {
        return Vocabulary.#module ??= new NexoModule(Vocabulary.moduleName, {});
    }

    /**
     * `List<T>`, its members and those it declares as its own for a list of lists, a receiver narrower than its own, which `receivers` gives each of them by its declaration: `flatten`, the items of each inner list
     * in order. An inner list that can be null is no list of lists, so none is ever treated as empty.
     */
    static #createListType() {
        const nested = Vocabulary.#createMembers('List<T>', 'List<List<T>>', [Declarations.createPropertyDeclaration('flatten', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => receiver.flat() })]);

        return Object.freeze({
            name: 'List',
            kind: 'generic',
            typeParameters: Object.freeze(['T']),
            variances: Object.freeze(['covariant']),
            members: Object.freeze([...Vocabulary.#createMembers('List<T>', 'List<T>', Vocabulary.#createListMembers()), ...nested]),
            receivers: new Map(nested.map(member => [member, 'List<List<T>>'])),
        });
    }

    /**
     * The members of one of Nexo's own value types, validated, copied and frozen as a module's are, by a module created for that alone and never registered: an extension of the type gives them the receiver and the
     * scope its members read, a list's `T` among them, and no module declares Nexo's value types, whose form is Nexo's alone.
     */
    static #createMembers(name, target, members) {
        return new NexoModule(Vocabulary.moduleName, { types: [{ name, kind: 'extension', target, members }] }).types[0].members;
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

    /** The members of the scalar type beside its conversions: a number's and a string's, and none of a Boolean. */
    static #createScalarMembers(name) {
        switch (name) {
            case 'Number':
                return Vocabulary.#createNumberMembers();
            case 'String':
                return Vocabulary.#createStringMembers();
            default:
                return [];
        }
    }

    /**
     * The members of a string, each counting UTF-16 code units, as ordering compares strings: its length; the text trimmed of whitespace and in either case, without a locale; whether it begins with, ends with or
     * holds a text, and where it first does; the text with a text replaced, and split at a separator, each refusing the empty text, which stands at every position; and its slice by a range, strict as a list's, which
     * never parts a surrogate pair.
     */
    static #createStringMembers() {
        const of = (name, result, compute) => Declarations.createPropertyDeclaration(name, result, { updates: DERIVED_UPDATES, impl: ({ receiver }) => compute(receiver) });
        const textParameter = name => Declarations.createValueParameterDeclaration(name, 'String');
        const testing = (name, test) => Declarations.createFunctionDeclaration(name, 'Boolean', { updates: DERIVED_UPDATES, parameters: [textParameter('text')], impl: ({ receiver, args }) => test(receiver, args.text) });
        // The empty text stands at every position, so it has no occurrence to replace or to split at.
        const requireOccurrence = (member, text) => {
            if (text === '') {
                throw new MemberFailure('NEXO5040', `'${member}' is given the empty text, which stands at every position and has no occurrence to ${member === 'replace' ? 'replace' : 'split at'}`);
            }
        };

        return [
            of('length', 'Number', text => text.length),
            // Tab, line feed, vertical tab, form feed, carriage return, U+FEFF, U+2028, U+2029 and every space separator, at either end.
            of('trim', 'String', text => text.trim()),
            of('lowercase', 'String', text => text.toLowerCase()),
            of('uppercase', 'String', text => text.toUpperCase()),
            testing('startsWith', (text, prefix) => text.startsWith(prefix)),
            testing('endsWith', (text, suffix) => text.endsWith(suffix)),
            testing('contains', (text, part) => text.includes(part)),
            Declarations.createFunctionDeclaration('indexOf', 'Number?', { updates: DERIVED_UPDATES, parameters: [textParameter('text')], impl: ({ receiver, args }) => Vocabulary.#positionOrNull(receiver.indexOf(args.text)) }),
            Declarations.createFunctionDeclaration('replace', 'String', {
                updates: DERIVED_UPDATES,
                parameters: [textParameter('old'), textParameter('new')],
                impl: ({ receiver, args }) => (requireOccurrence('replace', args.old), receiver.split(args.old).join(args.new)),
            }),
            Declarations.createFunctionDeclaration('split', 'List<String>', { updates: DERIVED_UPDATES, parameters: [textParameter('separator')], impl: ({ receiver, args }) => (requireOccurrence('split', args.separator), receiver.split(args.separator)) }),
            Declarations.createIndexerDeclaration(null, 'String', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('range', 'Range')], impl: ({ receiver, args }) => Vocabulary.#sliceText(receiver, args.range) }),
        ];
    }

    /** The code units within the range, applied to the text's length once, its start at or before its end and both within the text, neither parting a surrogate pair, or refused. */
    static #sliceText(text, range) {
        const { start, end } = range.resolveIn(text.length);

        if (start < 0 || end > text.length || start > end) {
            throw new MemberFailure('NEXO5033', `The range ${range} is applied to a text of ${text.length} code units, and gives ${start}..${end}, which ${start > end ? 'starts after it ends' : 'stands beyond the text'}`);
        }

        // A boundary between a high and a low surrogate would leave half a character on either side.
        const parts = boundary => boundary > 0 && boundary < text.length && /[\uD800-\uDBFF]/.test(text[boundary - 1]) && /[\uDC00-\uDFFF]/.test(text[boundary]);

        if (parts(start) || parts(end)) {
            throw new MemberFailure('NEXO5041', `The range ${range} gives ${start}..${end}, which parts the surrogate pair at ${parts(start) ? start : end}, so the slice would hold half a character`);
        }

        return text.slice(start, end);
    }

    /**
     * The members of a number beside its conversions: its rounding, `round` a half away from zero, `floor`, `ceiling` and `truncate`; its absolute value; the lesser and the greater of it and another, and it clamped
     * within two, a low above the high refused; each answering 0 where it would answer -0; and `sequence`, the numbers from it, generated apart from any range.
     */
    static #createNumberMembers() {
        // A number a member answers is never -0, which no script tells from 0 but a host's division could.
        const unsigned = number => (number === 0 ? 0 : number);
        const of = (name, compute) => Declarations.createPropertyDeclaration(name, 'Number', { updates: DERIVED_UPDATES, impl: ({ receiver }) => unsigned(compute(receiver)) });
        const against = (name, compute) => Declarations.createFunctionDeclaration(name, 'Number', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('other', 'Number')], impl: ({ receiver, args }) => unsigned(compute(receiver, args.other)) });

        return [
            // Half away from zero, so a number and its negation round to a number and its negation.
            of('round', number => Math.sign(number) * Math.round(Math.abs(number))),
            of('floor', Math.floor),
            of('ceiling', Math.ceil),
            of('truncate', Math.trunc),
            of('abs', Math.abs),
            against('min', Math.min),
            against('max', Math.max),
            Declarations.createFunctionDeclaration('clamp', 'Number', {
                updates: DERIVED_UPDATES,
                parameters: [Declarations.createValueParameterDeclaration('low', 'Number'), Declarations.createValueParameterDeclaration('high', 'Number')],
                impl: ({ receiver, args: { low, high } }) => {
                    if (low > high) {
                        throw new MemberFailure('NEXO5039', `'clamp' takes a low no greater than its high, and is given ${low} and ${high}`);
                    }

                    return unsigned(Math.min(Math.max(receiver, low), high));
                },
            }),
            // The count's numbers from the receiver, each the step after the one before, the step 1 where it is left out; a count that is no nonnegative safe integer is refused.
            Declarations.createFunctionDeclaration('sequence', 'List<Number>', {
                updates: DERIVED_UPDATES,
                parameters: [Declarations.createValueParameterDeclaration('count', 'Number'), Declarations.createValueParameterDeclaration('step', 'Number', { default: 1 })],
                impl: ({ receiver, args }) => {
                    if (!Number.isSafeInteger(args.count) || args.count < 0) {
                        throw new MemberFailure('NEXO5035', `'sequence' takes a count that is a nonnegative whole number, and is given ${args.count}`);
                    }

                    return Array.from({ length: args.count }, (_, index) => receiver + index * args.step);
                },
            }),
        ];
    }

    /** A position a search found, null for the -1 of one it didn't. */
    static #positionOrNull(position) {
        return position === -1 ? null : position;
    }

    /** The item at the offset from the start, null for one the list has no item at. */
    static #itemAt(list, offset) {
        return offset >= 0 && offset < list.length ? list[offset] : null;
    }

    /** The items within the range, applied to the list's length once, its start at or before its end and both within the list, or refused. */
    static #slice(list, range) {
        const { start, end } = range.resolveIn(list.length);

        if (start < 0 || end > list.length || start > end) {
            throw new MemberFailure('NEXO5033', `The range ${range} is applied to a list of ${list.length} items, and gives ${start}..${end}, which ${start > end ? 'starts after it ends' : 'stands beyond the list'}; a slice is strict, as take and drop are not`);
        }

        return ItemPositions.createAnswer(list, ItemPositions.createSpan(start, end));
    }

    /** The item at each position `pick` is given, in the positions' order, each a whole offset from the start of the list, the first that is none refused. */
    static #pick(list, positions) {
        for (const position of positions) {
            if (!Number.isInteger(position) || position < 0 || position >= list.length) {
                throw new MemberFailure('NEXO5034', `'pick' is given the position ${position}, and a list of ${list.length} items has no item there`);
            }
        }

        return ItemPositions.createAnswer(list, positions);
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
            Declarations.createFunctionDeclaration('where', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, Vocabulary.#positionsWhere(receiver, item => args.expression(item) === true)) }),
            // Every item's value, null items included, its expression's `it` of the item's type, so `select(it)` keeps the list and `select(it ?? 0)` replaces its nulls.
            Declarations.createFunctionDeclaration('select<U>', 'List<U>', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('U', { nulls: 'accept' })], impl: ({ receiver, args }) => receiver.map(item => args.expression(item)) }),
            // Each item's list, in order, joined; a null item's, whose body answers null, and a null list are refused, never treated as empty.
            Declarations.createFunctionDeclaration('selectMany<U>', 'List<U>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('List<U>')],
                impl: ({ receiver, args }) => receiver.flatMap(item => {
                    const items = args.expression(item);

                    if (items === null) {
                        throw new MemberFailure('NEXO5031', "'selectMany' joins the list each item gives, and an item gave null, which is no list: give an empty list for an item that has none");
                    }

                    return [items];
                }).flat(),
            }),
            Declarations.createFunctionDeclaration('concat', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('other', 'List<T>')], impl: ({ receiver, args }) => [...receiver, ...args.other] }),
            // The items at an index less than the count, or at one the count or past it, whatever the count: a count past the end takes or leaves every item, and one of zero or less none.
            Declarations.createFunctionDeclaration('take', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, Vocabulary.#positionsWhere(receiver, (_, position) => position < args.count)) }),
            Declarations.createFunctionDeclaration('drop', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('count', 'Number')], impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, Vocabulary.#positionsWhere(receiver, (_, position) => position >= args.count)) }),
            // The items before the first its predicate is falsy for, which it is evaluated against last, or the items from it on, the predicate evaluated against none after it.
            Declarations.createFunctionDeclaration('takeWhile', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, ItemPositions.createSpan(0, Vocabulary.#firstIndex(receiver, item => args.expression(item) !== true))) }),
            Declarations.createFunctionDeclaration('dropWhile', 'List<T>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()],
                impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, ItemPositions.createSpan(Vocabulary.#firstIndex(receiver, item => args.expression(item) !== true), receiver.length)),
            }),
            // Whether some item's predicate is truthy, stopping at the first that is, false for no items; whether every item's is, stopping at the first that is not, true for no items.
            Declarations.createFunctionDeclaration('any', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.some(item => args.expression(item) === true) }),
            Declarations.createFunctionDeclaration('all', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => receiver.every(item => args.expression(item) === true) }),
            // Whether an item equals the value by the language's key equality, stopping at the first that does; null equals a null item.
            Declarations.createFunctionDeclaration('contains', 'Boolean', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('value', 'T?', { nulls: 'accept' })], impl: ({ receiver, args }) => receiver.includes(args.value) }),
            // The position of the value's first occurrence, compared as `contains` compares, and of the first item the predicate is truthy for, evaluating it against none after; null where none stands.
            Declarations.createFunctionDeclaration('indexOf', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('value', 'T?', { nulls: 'accept' })], impl: ({ receiver, args }) => Vocabulary.#positionOrNull(receiver.indexOf(args.value)) }),
            Declarations.createFunctionDeclaration('indexWhere', 'Number?', { updates: DERIVED_UPDATES, parameters: [Declarations.createPredicateParameterDeclaration()], impl: ({ receiver, args }) => Vocabulary.#positionOrNull(receiver.findIndex(item => args.expression(item) === true)) }),
            // The one item, null for none, and refused where the list holds several, which no one item stands for.
            Declarations.createPropertyDeclaration('single', 'T?', {
                updates: DERIVED_UPDATES,
                impl: ({ receiver }) => {
                    if (receiver.length > 1) {
                        throw new MemberFailure('NEXO5030', `'single' answers the one item of a list, and the list holds ${receiver.length}`);
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
            Declarations.createPropertyDeclaration('distinct', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => ItemPositions.createAnswer(receiver, Vocabulary.#firstPositions(receiver, item => item)) }),
            Declarations.createFunctionDeclaration('distinctBy<K>', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')], impl: ({ receiver, args }) => ItemPositions.createAnswer(receiver, Vocabulary.#firstPositions(receiver, item => args.expression(item))) }),
            Declarations.createPropertyDeclaration('reverse', 'List<T>', { updates: DERIVED_UPDATES, impl: ({ receiver }) => ItemPositions.createAnswer(receiver, ItemPositions.createSpan(0, receiver.length).reverse()) }),
            // A dictionary of the items by the key each gives, in the items' order, two items of one key refused, which grouping collects instead.
            Declarations.createFunctionDeclaration('toDictionary<K>', 'Dictionary<K, T>', {
                updates: DERIVED_UPDATES, parameters: [Declarations.createExpressionParameterDeclaration('K')],
                impl: ({ receiver, args }) => {
                    const entries = new Map();

                    for (const item of receiver) {
                        const key = args.expression(item);

                        if (entries.has(key)) {
                            throw new MemberFailure('NEXO5029', `'toDictionary' keys each item once, and two items give the key ${Vocabulary.#describeKey(key)}: group them with groupBy`);
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
            Declarations.createFunctionDeclaration('pick', 'List<T>', { updates: DERIVED_UPDATES, parameters: [Declarations.createValueParameterDeclaration('positions', 'List<Number>')], impl: ({ receiver, args }) => Vocabulary.#pick(receiver, args.positions) }),
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

    /** The position of each item the test holds for, in order, the test given each item and its position once. */
    static #positionsWhere(items, test) {
        const positions = [];

        items.forEach((item, position) => {
            if (test(item, position)) {
                positions.push(position);
            }
        });

        return positions;
    }

    /** The position of each key's first item, in the items' order, the key the expression gives each item, evaluated once for each, keys compared by the language's key equality. */
    static #firstPositions(items, keyOf) {
        const firsts = new Map();

        items.forEach((item, position) => {
            const key = keyOf(item);

            if (!firsts.has(key)) {
                firsts.set(key, position);
            }
        });

        return [...firsts.values()];
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
