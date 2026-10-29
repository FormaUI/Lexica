# Collections

<a id="collections"></a>

A **collection** is a list or a dictionary. A list holds items in order, each at a position; a dictionary holds entries addressed by key, each entry a pair of its key and its value. Collections are values, immutable as every value is: a member that selects, reorders or constructs answers a new collection, its receiver unchanged. Nexo's own module owns `List<T>`, `Dictionary<K, V>` and `Pair<K, V>`, with the members this document sets out, and the positions that address a list, `Index` and `Range`.

```nexo
room {
    names = it.devices.select(it.name),
    lastTwo = it.devices[^2..] { name = it.name },
    strongest = it.devices.maxBy(it.power)?.name,
    byPower = it.devices.orderByDescending(it.power).thenBy(it.name) { name = it.name },
    inStock = ["coffee" = 3, "tea" = 0].where(it > 0).keys
}
```

In this document:

1. [Lists](#collections-lists)
2. [Dictionaries and pairs](#collections-dictionaries-and-pairs)
3. [Collection expressions](#collections-collection-expressions)
4. [Positions](#collections-positions)
5. [Variance](#collections-variance)
6. [List members](#collections-list-members)
7. [Dictionary and pair members](#collections-dictionary-members)

<a id="collections-lists"></a>

## Lists

A **list**, a `List<T>`, holds items of type `T` in order.

- A list keeps the order of its source: a member that makes a list says where its order comes from, and a bound list keeps its host's; `where`, and an object expression following a list, keep its items in that order.
- An object expression following a list applies to each item and answers a list of the same length, in the same order; an item that is null answers null at its position, so over a list whose items can be null it answers a list of objects that can be null: `xs { a = 1 }` over a `List<Device?>` is a `List<{ a: Number }?>`.
- A member following a list is a member of the list itself, as [list members](#collections-list-members) set out: `room.devices.count` counts the room's devices.

<a id="collections-dictionaries-and-pairs"></a>

## Dictionaries and pairs

A **dictionary**, a `Dictionary<K, V>`, is addressed by key, its keys unique and its values free to repeat, and a **pair**, a `Pair<K, V>`, is immutable data of a `key` and its `value`, which a dictionary's entries give: `dictionary.entries` is a `List<Pair<K, V>>`, and `dictionary.entry[key]` a `Pair<K, V>?`. A dictionary becomes neither a list nor an object implicitly, and an object becomes no dictionary.

- **Its keys** are of a **key type**, a type whose values one exact equality compares: `Number`, `String`, `Boolean`, a reference type and `null`, nullable or not, a type parameter, which a dictionary binds to its own key type, and `Never`, an empty dictionary's. A list, an object, a structured value, a dictionary, a pair and a value of `Any` are no key: a declaration naming a dictionary of another key type is a module error (NEXO4563), and a bound map holding one a structure error (NEXO2041).
- **Key equality** is exact: a number by its value, `-0` equal to `0`, a string by its code units, a Boolean by its value, a reference by its established identity, and null as one key of its own, a real key where `K` admits null. No host language's own equality takes part, and a snapshot's tolerance never does.
- **Insertion order.** A dictionary's entries are ordered by insertion, the order its source gave them; order never addresses one, so `dictionary[2]` reads the key `2`, never the third entry, and a dictionary is not sorted.
- **Duplicate keys.** A dictionary holds each key once; constructing one from duplicate keys fails with a located evaluation error, never keeping the first or the last.
- **Positions address no dictionary.** A dictionary is addressed by key alone, so an index or a range is no key of one, refused as any key of another type is.
- **Lookup and presence.** `dictionary[key]` answers the key's value or null, so a key whose value is null reads as an absent key does; `containsKey(key)` tells them apart, and `entry[key]` answers the pair, null where the key is absent, so a missing pair and a pair whose value is null are told apart too. A lookup's key may be null, which reads the null key where `K` admits one and an absent key otherwise, so a key's parameter consumes null, never propagating it.

<a id="collections-collection-expressions"></a>

## Collection expressions

A **collection expression** writes a list or a dictionary in brackets where a value stands, its written form deciding which it constructs, whatever context it stands in:

```nexo
{
    sizes = [10, 20, 30],
    stock = ["coffee" = 3, "tea" = 2],
    none = [],
    empty = [=]
}
```

`sizes` is a `List<Number>`, `stock` a `Dictionary<String, Number>`, `none` a `List<Never>` and `empty` a `Dictionary<String, Never>`.

- **A list** holds items, each a [simple expression](expressions.md#simple-expressions), its `T` the type its items merge to, as [merging](types.md#types-assignability-and-merging) sets out: `[1, 2, null]` is a `List<Number?>`, `[null, null]` a `List<null>` and `[]` a `List<Never>`. Items of no common type, `[1, "two"]`, are refused, never widened to `Any`, and a list of pairs stays a list, never a dictionary.
- **A dictionary** holds entries, each a key, `=` and its value, a simple expression, and is a `Dictionary<String, V>`, `V` its values' merged type, values of no common type refused as a list's items are. A key is an inline string literal, ordinary or raw, `["coffee" = 3]` and `['coffee' = 3]`, its key its string's value, `["first\nsecond" = value]` among them; an interpolated string, a block string and any other expression are refused as keys, a computed key and a key of another type coming from a member that constructs a dictionary. Two entries of one key, compared exactly once their escapes are read, `"a"` and `"\u{61}"` among them, are refused when the definition is validated.
- **Its form.** Keyed and unkeyed entries never mix in one collection expression; a trailing comma is allowed, and an item is never left out between commas; no item spreads another collection into it; and a function is neither an item nor a value, since a collection holds data and references.
- **Its evaluation.** Each item or value is evaluated once, left to right, and a dictionary keeps its entries in the order written; what it constructs is immutable.

A string an extension access follows is a list's item, so `["coffee":Lookup.value]` is a list of that access's value.

<a id="collections-positions"></a>

## Positions

A list's item stands at a **position**: a `Number`, its offset from the list's start, `0` the first item, or an **index**, an `Index`, written `^n`, its offset from the list's end, `^1` the last item and `^0` the end past it. A **range**, a `Range`, is a half-open interval of two boundaries, each a position or left out, written `start..end`: `items[1..4]`, `items[..4]`, `items[4..]`, `items[^3..]`, `items[..^1]` and `items[..]`, a start left out the list's start and an end left out its end. An index and a range are values, so `let middle = 1..^1` serves any list, and neither holds a collection nor generates numbers.

- **Offsets** are nonnegative safe integers, never rounded: an index's offset and a range's boundary that is a number of any other value fails where it is evaluated (NEXO5032), so `^1.5` and `-1..2` are refused, while a lookup by a number stays tolerant, as [list members](#collections-list-members) set out.
- **Against a list.** A range is applied to one length, captured once: a start or an end that is a number stands at its offset, an index at the length less its offset, so `..^1` is every item but the last.
- **Not data.** Neither is data, so a result holding one is refused (NEXO3043); neither is a dictionary's key, and no equality compares them.
- **Their operands.** `^` takes a `Number`, and a range's boundaries are each a `Number` or an `Index`, none nullable (NEXO3085). A range's boundary is a position, never an operator expression unless grouped, and never another range, as [the grammar](grammar.md#grammar-the-grammar) sets out.

A string is sliced by a range as a list is, as [string members](vocabulary.md#vocabulary-string-members) set out.

<a id="collections-variance"></a>

## Variance

Collections are immutable values, so each of Nexo's own generic types declares how its type arguments relate, its **variance**, and no module declares a generic type:

| Type | Variance |
| --- | --- |
| `List<T>` | Covariant in `T`: a `List<Light>` stands where a `List<Device>` is declared, its items checked by their own types |
| `Dictionary<K, V>` | Invariant in `K`, which a lookup takes, and covariant in `V`: a `Dictionary<String, Light>` stands where a `Dictionary<String, Device>` is declared, never where a `Dictionary<String?, Light>` is |
| `Pair<K, V>` | Covariant in both |

A covariant argument relates by assignability and merges as types merge; an invariant one relates by equality and merges where the two are equal. An invariant argument of `Never` fits any and merges to the other, since the one invariant argument, a dictionary's key, is `Never` only for a dictionary of no entries, which no lookup can mistake.

A covariant view stays usable through the type it is declared as: a member taking a value, as `contains` does, and a callback's parameter take the declared item type, so `contains` given a `Device` is valid on a `List<Light>` seen as a `List<Device>`, and no evaluation checks a value against the narrower type the collection was made with.

<a id="collections-list-members"></a>

## List members

A member following a list is a member of the list itself: `room.devices.count` counts the room's devices. Nexo's own module declares the members below, and its unnamed indexer, and each reads and changes as the items it selects and the expression it evaluates do.

| List member | Contract |
| --- | --- |
| `count` | The number of items, 0 for an empty list |
| `first`, `last` | The first or the last item, null for an empty list |
| The unnamed indexer, `[index]` | The item at the index counted from zero, and null for an index past the end, for a negative one, which never counts from the end, and for a fractional one; `-0` is `0` |
| The unnamed indexer, `[^n]` | The item at the [index](#collections-positions) counted from the end, `^1` the last, and null for `^0` and for an index before the start |
| The unnamed indexer, `[range]` | A `List<T>`, the items within the [range](#collections-positions), applied to the list's length once, in order; a range whose start stands after its end, or either beyond the list, is refused where it is evaluated (NEXO5033), never trimmed, and equal boundaries give an empty list, so `take` and `drop` are the tolerant partitions |
| `where` | The items its predicate is truthy for, in the list's order, leaving out an item whose predicate is null or false; the predicate may produce any value |
| `max`, `min`, `sum`, `average` | Evaluate a number expression against each item and require `Number?`; `average` the mean of the numbers |
| `entry[index]`, `entry[^n]` | The item at the index as a `Pair<Number, T>`, its index from the start and the item, null wherever the unnamed indexer answers null for an index the list has no item at |
| `pick(positions)` | A `List<T>`, the item at each of the positions, a `List<Number>`, in the positions' order, a position given twice giving its item twice; a position no item stands at, a fractional or negative one among them, is refused (NEXO5034) |
| `select(expression)` | A `List<U>`, the expression's value for every item in order, a null item among them, the expression's `it` of the item's type, so `items.select(it)` keeps the list and `items.select(it ?? 0)` replaces its nulls |
| `selectMany(expression)` | A `List<U>`, the lists the expression gives the items joined in order; an item's list that is null, a null item's among them, is refused (NEXO5031), never treated as empty |
| `concat(other)` | The items, then those of `other`, a `List<T>` of the receiver's `T`, which a later argument never widens |
| `flatten` | On a `List<List<T>>`, the items of each inner list in order, a list whose inner lists can be null having none |
| `take(count)`, `drop(count)` | The items at an index less than the count, and those at the count or past it, whatever number the count is: one past the end takes or leaves every item, and one of zero or less none |
| `takeWhile`, `dropWhile` | The items before the first its predicate is falsy for, and the items from that one on, the predicate evaluated against none after it |
| `any`, `all` | Whether its predicate is truthy for some item, false for none and stopping at the first it is truthy for, and whether for every item, true for none and stopping at the first it is not |
| `contains(value)` | Whether an item equals the value by [key equality](#collections-dictionaries-and-pairs), stopping at the first that does, null equal to a null item |
| `indexOf(value)` | The position of the value's first occurrence, a `Number?`, compared as `contains` compares, null equal to a null item, and null where no item equals it |
| `indexWhere(predicate)` | The position of the first item its predicate is truthy for, a `Number?`, null where none is, evaluating it against no item after that one |
| `single` | The one item, null for an empty list, and refused for a list of several (NEXO5030) |
| `minBy`, `maxBy` | The first item whose key is the least or the greatest, keys compared as [ordering](#collections-list-ordering) compares them, items whose key is null skipped, null where none gives one |
| `orderBy(key)`, `orderByDescending(key)` | The items ordered by their keys, ascending or descending, as [ordering](#collections-list-ordering) sets out |
| `thenBy(key)`, `thenByDescending(key)` | The items of a list `orderBy` ordered, each run of items whose keys so far are equal ordered within itself by another key, as [ordering](#collections-list-ordering) sets out |
| `distinct`, `distinctBy(expression)` | Each item's first occurrence, in order, items compared by key equality; and each key's first item, its key the expression's value, keys compared alike |
| `reverse` | The items in the opposite order |
| `toDictionary(expression)` | A `Dictionary<K, T>` of the items by the key the expression gives each, in the items' order, two items of one key refused (NEXO5029), which `groupBy` collects instead |
| `groupBy(expression)` | A `Dictionary<K, List<T>>` of the items by their keys, each key's items in their order, the keys in the order their first items stand |

Each signature of the unnamed indexer and of `entry` is one of an [indexer's signatures](members.md#property-access-calls-and-indexers-unnamed-indexers), selected by its key's type: a number and an index are looked up tolerantly, and a range slices strictly.

A number generates numbers apart from any range, as [number members](vocabulary.md#vocabulary-number-members) set out.

`where`, `first`, `last` and the unnamed indexer preserve `T` from a `List<T>`, the type parameter `List` declares, so `rooms.first` is a `Room?` for a `List<Room>`. A key `toDictionary`, `groupBy` or `distinctBy` gives is of a key type, `K` its expression's type, so keys of another type are refused where they are resolved (NEXO3083).

An item's body reads the item as a value that is not null, as an object projection reads it, so a null item answers null and the body is never evaluated against it: `where`, `takeWhile`, `dropWhile`, `any`, `all` and `indexWhere` find null falsy, the aggregates skip it, and `toDictionary` and `groupBy` key it by null. `select` alone evaluates its body against every item, its `it` the item's type, null included. A function of the item is called with each item as it is, whichever member it is given to.

A search answers null where it finds nothing, never `-1`, as a lookup by an index answers null where no item stands. Aggregates consume null per item rather than propagating it to the entire call. `max`, `min` and `average` skip items whose expression is null, and answer null where every item was skipped or the list is empty. `sum` skips null values and answers 0 where every item was skipped or the list is empty. Each member evaluates its expression or its predicate at most once for each item it visits, and a member that stops at a decisive item evaluates none after it. Thus `room.devices.max(it.battery)` and `Home.rooms.where(it.climate?.temperature).count` are valid even though the expressions can return null.

An expression parameter declares the item type it evaluates against and the result type it requires. A predicate parameter accepts a value expression and receives its truthiness as a Boolean. Either takes a function of the item in place of its body, `room.devices.max(d => d.power)`, as [argument kinds](members.md#arguments-kinds) set out.

<a id="collections-list-ordering"></a>

### Ordering

`orderBy` and `orderByDescending` order a list's items by the key their expression gives each, and `thenBy` and `thenByDescending` refine that order by another key. Each answers a new `List<T>`, its receiver unchanged.

- **Keys.** A key is a number, a string, a Boolean or null, and every key of one criterion that isn't null is of one of those domains: numbers compare numerically, `-0` equal to `0`; strings by their code units, without any locale; and Booleans false before true. A key of another kind, a list, an object or a reference, and keys of two domains in one criterion, are refused where the call is evaluated (NEXO5036), as a key of `Any` is checked as it is evaluated. Comparing strings is the members' contract alone, so `"a" < "b"` stays refused in an expression.
- **Nulls.** A null key, a null item's among them, orders after every other key in either direction. A script orders nulls first by ordering by whether its key is null first, `items.orderBy(it.date != null).thenBy(it.date)`. A body's key is null for a null item, which an item's body never reads, so that ordering puts null items last; a list whose items can be null orders them first by a function, which reads each item as it is: `items.orderBy(item => item != null).thenBy(it)`.
- **Stability.** Items of equal keys keep their order, in either direction.
- **Each key once.** A criterion evaluates its expression once for each item, whichever direction, and never again.
- **Refinement.** `thenBy` takes a list `orderBy` or `thenBy` answered, which a local holding it keeps, and orders each run of items whose keys so far are equal by its own key, leaving every run where the order before it put it, so it refines and never sorts again. Its answer keeps the keys of every criterion, so another `thenBy` refines it further. A list no `orderBy` ordered, one another member answered of an ordered list among them, is refused (NEXO5037), so `items.orderBy(it.a).where(it.b).thenBy(it.c)` orders by `c` within `where`'s answer only after `orderBy` again.
- **What it keeps.** The keys are the evaluation's, kept with the list they ordered, never as the expressions that gave them, and no result records them: an ordered list's record realigns its items' lineage as any reordering does, as [provenance](../runtime/evaluation.md#runtime-results-provenance) sets out.

<a id="collections-dictionary-members"></a>

## Dictionary and pair members

A member following a dictionary is a member of the dictionary itself, and each reads and changes as the entries it reads do; a lookup's key consumes null, as [dictionaries](#collections-dictionaries-and-pairs) set out.

| Dictionary member | Contract |
| --- | --- |
| `count` | The number of entries, 0 for an empty dictionary |
| The unnamed indexer, `[key]` | The key's value, a `V?`, null for an absent key and for a key whose value is null |
| `entry[key]` | The key's entry, a `Pair<K, V>?`, null for an absent key alone |
| `containsKey(key)` | Whether the dictionary holds the key, a key whose value is null among them |
| `keys`, `values` | The keys, a `List<K>`, and the values, a `List<V>`, in the entries' order |
| `entries` | The entries, a `List<Pair<K, V>>`, in their order |
| `where` | The entries whose value its predicate is truthy for, a `Dictionary<K, V>`, each keeping its key and its place |
| `select(expression)` | A `Dictionary<K, U>`, each entry's value replaced by the expression's, every value null included, each keeping its key and its place |

A dictionary's value operations read each entry's value as their `it`, so `prices.where(it > 2)` keeps the entries of prices above 2; an operation needing the key reads the `entries`, as `prices.entries.where(it.key != "tea")` does.

A pair's `key` and `value` read its two parts, of its `K` and its `V`.
