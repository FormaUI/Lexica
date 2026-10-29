# Proposal: collections

**State: accepted in part.** The direction and the decisions under [accepted decisions](#accepted-decisions) are accepted; the contracts under [open contracts](#open-contracts) are proposed and not settled, but the lineage representation, the foundation, construction and operations, positional operations and ordering, which are settled, implemented and specified in [collections](../../spec/language/collections.md). Explicit identity, which the foundation does not require, is deferred, as [the status overview](../features-status.md#deferred) records; [unit 4](../features-status.md#unit-4--collections) of the implementation plan settles the open contracts, specifies each part and implements it.

Related proposals: [contract generics](contract-generics.md), whose inference collection members follow, [`Any` and deferred selection](any-and-deferred-selection.md), whose identity rules values in collections keep, and [line structure](line-structure.md), which collection syntax extends.

## The design

Collections belong to Nexo: their values, types, syntax, construction, operations, equality, capture, evaluation and metadata. A host owns what happens around evaluation: obtaining domain values, observing changes, scheduling evaluations, comparing results and delivering updates. No collection rule depends on a particular host, its values or its result formats, and host containers never become collection systems of their own.

Positions and keys support different operations and guarantees, and Nexo states those contracts directly: a **list** is addressed by position, a **dictionary** by key, and an object, as before, by its named fields. One native model serves both kinds: shared collection machinery and consistent semantics, without requiring identical physical storage. A dictionary becomes neither a list nor an object implicitly, and an object becomes a dictionary only through an explicit operation.

The design comes in four parts, each settled, specified and implemented in turn:

| Part | Covers |
| --- | --- |
| Collection foundation | Types, capture, keys, equality, order, nulls, result representation and metadata |
| Construction and operations | Collection expressions, dictionary construction, filtering, projection, grouping and aggregation |
| Positional operations | Indices, ranges, slicing and repeated selection |
| Ordering | Sorting, secondary criteria and ordering metadata |

<a id="accepted-decisions"></a>

## Accepted decisions

1. **Two collection kinds.** `List<T>`, ordered, dense and finite, its duplicate values allowed, and `Dictionary<K, V>`, its keys unique and its values free to repeat. A collection expression's written form decides which it constructs, as decision 12 sets out; an array is no further public type.
2. **Key-first type parameters,** for familiarity and so dictionaries and their pairs agree: `Dictionary<K, V>` and `Pair<K, V>`.
3. **`Pair<K, V>`,** immutable data of `key: K` and `value: V`, names the value a dictionary's entries give: `dictionary.entries` is a `List<Pair<K, V>>`, and `dictionary.entry[key]` a `Pair<K, V>?`. The member names describe a dictionary's entries; `Pair` names the value they return.
4. **Insertion order.** A dictionary's iteration is ordered by insertion: construction follows its source's traversal, filtering keeps the remaining entries' relative order, value projection keeps keys and order, and grouping orders groups by each key's first occurrence. Order never changes addressing, `dictionary[2]` reading the key `2`, never the third entry, and an ordered dictionary is not sorted.
5. **Key equality.** Dictionary keys, grouping, membership and distinctness use one exact equality: `Number`, `-0` equal to `0`; `String`, exact by code unit; `Boolean`; reference values, by established reference identity; and one null key, a real key, where `K` admits null. Structured values, objects and lists take no part as keys until a separate equality extension designs their equality, hashing, type identity and capture together, and `Any` never permits a host language's own equality. Snapshot tolerances never take part in equality.
6. **Duplicate keys.** Constructing a dictionary from duplicate keys fails with a located evaluation error, never keeping the first or the last; grouping is the deliberate way to collect duplicates.
7. **Both projection forms.**
   - `items { … }` projects each item into an object, and preserves a null item as null without evaluating its fields.
   - `items.select(expression)` is a general transformation, `people.select(it.name)` giving strings and `numbers.select(it * 2)` numbers. It invokes its expression for every item, null included, its callback's input type including null where the item type does.
   - An identity selection preserves the collection, its null items included, `items.select(it)`, and a selection can normalize them explicitly, `items.select(it ?? 0)`.
8. **Native and exported representations.** Native values are `List<T>` and `Dictionary<K, V>` with their established types. Exported, a list is an array of its exported items, a pair `{ key, value }`, and a dictionary `{ entries: [{ key, value }, …] }` in its order, preserving its keys' types. Export succeeds only where every key and every value, recursively, has a data form, so reference keys and reference values alike prevent a dictionary's direct export; a caller projects them to data first. Exported data never turns back into a dictionary implicitly when it is bound again.
9. **Metadata through filtering and projection.**
   - Filtering preserves each retained item's metadata, realigned in the result's own order: the result has aligned items, sources and provenance records of its own, never the original collection's whole record reused.
   - A projection records its immediate input in `sources`, as [results](../../spec/runtime.md#runtime-results) already specify, and `sources` never changes meaning to carry anything else.
   - A second projection preserves the provenance of the values it selects, while values it computes follow the existing origin and tolerance rules. A collection's ancestry and a projected field's numeric tolerance are related metadata, never interchangeable.
10. **Provenance requirements.** Whatever represents lineage satisfies:
    - filtering and reordering preserve each occurrence's provenance;
    - a projection records its immediate sources apart from the provenance it inherits;
    - repeating an item preserves its origin without implying that its occurrences are unique;
    - missing provenance stays distinguishable from a recorded null source;
    - reference identity comes from Nexo's established classification, never from a host's own check;
    - hosts decide matching, and lineage promises no unique correspondence.

    The requirement it must meet:

    ```text
    people
        .where(it.active)
        .select({ name = it.name })
        .select({ label = it.name })
    ```

    Each final item retains enough provenance for a host to recognize its original reference source, while each projection's `sources` still records its actual immediate input. Lineage need not retain every intermediate object or the whole history of every transformation.
11. **Full scope, staged.** Collection expressions, ranges and slicing are planned work, delivered in the parts above, never dropped.
12. **Collection expressions.** ✅ Specified in [collection expressions](../../spec/language/collections.md#collections-collection-expressions) and implemented as definition version 35, as [I36](implementation-decisions.md) records. The written form decides the kind a collection expression constructs, and its context never changes what it constructs:

    ```text
    [10, 20, 30]                 // List<Number>
    ["coffee" = 3, "tea" = 2]    // Dictionary<String, Number>
    []                           // List<Never>
    [=]                          // Dictionary<String, Never>
    ```

    - **A list** holds unkeyed items, `T` inferred from them under the common-type rules; one of `Pair<K, V>` values is a `List<Pair<K, V>>`, never a dictionary and never bound to unique keys.
    - **A dictionary** holds entries of a key, `=` and a value, extending the language's convention that `=` introduces a value, as fields and locals write it; a string extension access in a list, `["coffee":Lookup.value]`, keeps its own reading. It is a `Dictionary<String, V>`, `V` inferred from its values under the same rules, values of no common type refused, never widened to `Any`.
    - **Its keys** are inline string literals, ordinary or raw, `["coffee" = 3]` and `['coffee' = 3]`; an interpolated string or a block string is refused as a key, and a key's contents follow their string's ordinary rules, `["first\nsecond" = value]` among them. Computed keys and keys of other types come from `toDictionary` and `groupBy`.
    - **Keyed and unkeyed entries** never mix in one collection expression.
    - **Evaluation:** values are evaluated once, left to right, and a dictionary keeps its entries' written order.
    - **Duplicate keys** are refused when the definition is validated, compared exactly after their escapes are decoded; a dictionary built from evaluated keys refuses duplicates when it is evaluated, as decision 6 sets out.
    - **Line structure** applies as it does throughout the language: an entry's key and its `=` stay on one line, its value may start on the next, and neither a list's item nor a dictionary's value is an enclosure, so a line breaks before an operator there only inside parentheses of its own.
    - **A key that is not an inline string literal,** as `[name = 1]`, is a syntax error located at the key that assumes neither intention: "A dictionary key must be an inline string literal. Write `["name" = 1]` for the literal key "name". For a computed key, construct the dictionary with `toDictionary`."
    - **Canonical layout** follows an object's: `[=]`; one entry on one line where its value is, `["coffee" = 3]`; and any other with each entry starting a line of its own, without a trailing comma.
13. **Variance.** `Dictionary<K, V>` is invariant in `K` and covariant in `V`, and `Pair<K, V>` covariant in both; `List<T>` stays covariant. So `[=]` fits a dictionary of string keys and any permitted value type, never one of another key type. Before the collection type contract is declared finished, the complete collection API is checked against these directions, members taking a value as `contains` does and callback parameters among them: a covariant view stays usable through its declared type, and a runtime check never enforces the narrower original type.

<a id="open-contracts"></a>

## Open contracts

Each contract below is proposed; the stage that depends on it settles it first.

### The lineage representation

✅ **Settled,** as [provenance](../../spec/runtime.md#runtime-results-provenance) specifies and [I34](implementation-decisions.md) reasons out against each requirement: beside `sources`, a projected list's record holds `provenance`, one entry for each item, of a source's kinds, naming the source the earliest projection the item descends from recorded for it. A projection of a list no projection built records its own sources there, one of a list a projection built inherits each input's entry, and an operation that filters, reorders or repeats items carries each occurrence's entries realigned.

### Foundation

✅ **Settled,** as [dictionaries and pairs](../../spec/language/collections.md#collections-dictionaries-and-pairs), [how a binding is typed](../../spec/scripts.md#bindings) and [results](../../spec/values.md#values-results) specify and [I35](implementation-decisions.md) records, with the choices below as proposed; duplicate keys at construction, and a list's typing from a collection expression, land with construction.


- **Host capture:** a dense array as a `List<T>`; a `Map` as a `Dictionary<K, V>`; a `Set` as a `List<T>` in its traversal order, its uniqueness not making later projections sets; a plain record as an object; a domain member's collection as its declared native type; and a general iterable only through an explicit finite materialization. Recognition keeps its precedence, a value recognized as a module's reference staying a reference, and a captured binding is never a live view.
- **Typing:** collection expressions and captured arrays inferring their item type by the common-type relation, `[]` a `List<Never>`, `[null, null]` a `List<null>`, `[1, 2, null]` a `List<Number?>`, and `[1, "two"]` refused, never widened to `List<Any>`; variance as decision 13 sets out; and a receiver's established parameters never widened by a later argument, as `concat` on `List<T>` shows.
- **Lookup and presence:** `dictionary[key]` answering the value or null; `dictionary.entry[key]` answering a `Pair<K, V>?`, null where the key is absent; `containsKey` telling an absent key from a present null value; a list's `entry[index]` answering a `Pair<Number, T>?`; and a dictionary's key parameters consuming null under their contract rather than propagating it.

### Construction and operations

✅ **Settled,** as [Nexo's vocabulary](../../spec/language/collections.md#collections-list-members), [null arguments](../../spec/members.md#nullability-a-null-argument-follows-the-parameter) and [provenance](../../spec/runtime.md#runtime-results-provenance) specify and [I37](implementation-decisions.md) records, but `pick`, which positional operations settle.

- **Collection expressions,** beyond decision 12: a list dense and immutable, a trailing comma allowed in source, holes refused, no spread, items as simple expressions under the existing recursive restrictions, and delegates kept out of collection data.
- **Dictionary construction:** `people.toDictionary(it.id)`, a dictionary of the people by their ids; `.select(…)` giving other values; and `groupBy`, a `Dictionary<K, List<T>>`.
- **The member surface:** `count`, `where`, `select`, object projection, `concat`, `flatten`, `selectMany`, `take`, `drop`, `takeWhile`, `dropWhile`, `any`, `all`, `contains`, `first`, `last`, `single`, `sum`, `min`, `max`, `average`, `minBy`, `maxBy`, `distinct`, `distinctBy`, `groupBy`, `toDictionary`, `reverse`, `pick`, `keys`, `values`, `entries` and `containsKey`, with the null, empty-input and short-circuiting rules the draft gave them: `sum` of nothing `0`, `min`, `max`, `average`, `first`, `last`, `single`, `minBy` and `maxBy` of nothing null, `any` false and `all` true; `any`, `all` and `contains` stopping at the first decisive item; numeric aggregates skipping null results; and flattening refusing null inner lists rather than treating them as empty.
- **Dictionary item context:** a dictionary's value operations giving `it` the entry's value, with operations needing the key using `entries`.
- **Evaluation:** a predicate or a selected expression running at most once for each occurrence an operation visits, collection evaluation finite, short-circuiting reading only the expressions reached, and collection failures located errors that never become null; `try` keeping its meaning for casts and conversions alone.

### Positional operations

✅ **Settled,** as [positions](../../spec/language/collections.md#collections-positions), [Nexo's vocabulary](../../spec/language/collections.md#collections-list-members) and [an indexer's signatures](../../spec/members.md#property-access-calls-and-indexers-unnamed-indexers) specify and [I38](implementation-decisions.md) records: an `Index` counts from the end alone, a number from the start.

- **Indices and ranges:** an `Index`, an offset from the beginning or, written `^n`, from the end, and a `Range`, two boundaries of a half-open interval, `items[1..4]`, `items[..4]`, `items[4..]`, `items[^3..]`, `items[..^1]` and `items[..]`, reusable as values, `let middle = 1..^1`, capturing no collection and generating no numbers; offsets nonnegative safe integers, never rounded.
- **Lookup and slicing:** scalar lookup tolerant as today, a missing, negative or fractional position giving null and `items[^0]` null; slicing strict, `0 <= start <= end <= L` against one captured length, a reversed or out-of-bounds range a located error, equal boundaries an empty list; and `take` and `drop` the tolerant partitions.
- **Typed indexer signatures:** one indexer declaration declaring disjoint signatures by key type, a `Number` or an `Index` giving `T?` and a `Range` giving `List<T>` on a list, overlapping signatures refused at registration, and a failure never falling through to another member; a range never positional on a dictionary.
- **Selection and sequences:** `items.pick([2, 0, 2])`, in selector order with repetitions, an unavailable position failing; and numeric generation kept apart from `Range`, as a member such as `start.sequence(count, step)`.
- **Syntax:** `[` a collection expression where an input stands and an indexer after a receiver; `..` one token; `^` a from-end index, never exponentiation; a range non-associative; boundary operands simple; and line rules for arrays, `^` and `..`.

### Ordering

✅ **Settled,** as [ordering](../../spec/language/collections.md#collections-list-ordering) specifies and [I39](implementation-decisions.md) records: a descending variant of each member states direction, and a script orders nulls first by ordering by whether a key is null first.

`orderBy` and `thenBy`, nonmutating and stable; numbers numerically, strings by code unit without a host's locale, Booleans false before true, nulls last by default with their placement independent of direction, and unsupported key domains refused; each key evaluated once per item and criterion; `thenBy` refining ties without re-sorting; and ordering information that survives a local alias and another `thenBy`, retained as evaluated keys, never as callbacks. String ordering is a collection operation's contract, never making `"a" < "b"` valid in expressions.

### Explicit identity

An operation such as `people.identifyBy(it.id)`, recording application identities apart from keys and sources, unique and non-null within its result scope. Not required for the foundation.

## Acceptance cases

Each part's stage adds its own cases when it settles its contracts; the accepted decisions already require:

- Dictionary filtering and value projection keep keys and insertion order.
- Duplicate keys at construction are a located error; grouping collects them.
- A null key and a missing key are distinguishable, and so are a missing pair and a pair whose value is null.
- `dictionary[2]` reads the key `2`, never a position.
- `items { … }` preserves null items without evaluating fields, while `items.select(…)` invokes for each item, `items.select(it)` preserving the collection and `items.select(it ?? 0)` normalizing it.
- A dictionary exports as `{ entries: [{ key, value }, …] }` in its order, keys' types preserved, and one holding a reference key or a reference value is refused for direct export.
- Filtering realigns each retained item's metadata in the result's order.
- `[10, 20, 30]` is a `List<Number>`, `["coffee" = 3, "tea" = 2]` a `Dictionary<String, Number>`, `[]` a `List<Never>` and `[=]` a `Dictionary<String, Never>`, which fits a dictionary of string keys and any value type, never one of another key type.
- A list of pairs stays a list; keyed and unkeyed entries mixed are refused; values of no common type are refused.
- An interpolated or block string as a key is refused, `["first\nsecond" = value]` is accepted, and duplicate literal keys, `"a"` and `"\u{61}"` among them, are refused at validation.
- `["coffee":Lookup.value]` is a list holding an extension access.
- A list item or a dictionary value breaking before an operator is refused unless it is in parentheses of its own, and a key on a line apart from its `=` is refused.
- `[name = 1]` is refused at `name` with the diagnostic decision 12 gives.
- `format` writes `[=]`, `["coffee" = 3]`, and each entry of a longer dictionary on a line of its own without a trailing comma.
- The four-step chain under [provenance requirements](#accepted-decisions) keeps each projection's immediate `sources` truthful while its final items' provenance lets a host recognize their original references.
