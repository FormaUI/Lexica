# Vocabulary

<a id="vocabulary"></a>
<a id="vocabulary-contracts"></a>

A script's **vocabulary** is everything it can name beyond the language itself: the types, with their members and operators, the extensions, module members, type selectors and observation types of every module the registry it is resolved against holds, internal declarations aside. Lexica's own module is always among them, and every other module contributes by the same contracts, whatever its domain. A module's own specification gives its declarations and what each does in its domain; this document gives the contracts every one keeps, beside [members](members.md) and [types](types.md).

In this document:

1. [Lexica's own vocabulary](#vocabulary-lexicas-own)
2. [Boolean functions](#vocabulary-boolean-functions)
3. [Observations](#observations)
4. [Type selectors](#vocabulary-type-selectors)
5. [Conversions](#vocabulary-conversions)

<a id="vocabulary-lexicas-own"></a>

## Lexica's own vocabulary

Lexica's own module owns the language's types, `List`, `Dictionary`, `Pair`, `Number`, `String` and `Boolean` among them, and has no namespace. It declares `List<T>`, `Dictionary<K, V>` and `Pair<K, V>`, with their members, whose type parameters the receiver supplies, so no member of them infers one again, a member declaring its own, as `select<U>` does, inferring it from its arguments as any member's are; an extension of lists of lists, `NestedListExtensions<T>`, whose `flatten` a list of lists alone has; the three verbs that test a receiver, in `VerbExtensions<T>`, an extension targeting its parameter `T`, so on any type; and the conversions between the language's types of data, as operators of those types.

<a id="vocabulary-list-members"></a>

### List members

A member following a list is a member of the list itself: `room.devices.count` counts the room's devices. Lexica's own module declares the members below, and its unnamed indexer, and each reads and changes as the items it selects and the expression it evaluates do.

| List member | Contract |
| --- | --- |
| `count` | The number of items, 0 for an empty list |
| `first`, `last` | The first or the last item, null for an empty list |
| The unnamed indexer, `[index]` | The item at the index counted from zero, and null for an index past the end, for a negative one, which never counts from the end, and for a fractional one; `-0` is `0` |
| The unnamed indexer, `[^n]` | The item at the [index](types.md#types-positions) counted from the end, `^1` the last, and null for `^0` and for an index before the start |
| The unnamed indexer, `[range]` | A `List<T>`, the items within the [range](types.md#types-positions), applied to the list's length once, in order; a range whose start stands after its end, or either beyond the list, is refused where it is evaluated (LEXICA5033), never trimmed, and equal boundaries give an empty list, so `take` and `drop` are the tolerant partitions |
| `where` | The items its predicate is truthy for, in the list's order, leaving out an item whose predicate is null or false; the predicate may produce any value |
| `max`, `min`, `sum`, `average` | Evaluate a number expression against each item and require `Number?`; `average` the mean of the numbers |
| `entry[index]`, `entry[^n]` | The item at the index as a `Pair<Number, T>`, its index from the start and the item, null wherever the unnamed indexer answers null for an index the list has no item at |
| `pick(positions)` | A `List<T>`, the item at each of the positions, a `List<Number>`, in the positions' order, a position given twice giving its item twice; a position no item stands at, a fractional or negative one among them, is refused (LEXICA5034) |
| `select(expression)` | A `List<U>`, the expression's value for every item in order, a null item among them, the expression's `it` of the item's type, so `items.select(it)` keeps the list and `items.select(it ?? 0)` replaces its nulls |
| `selectMany(expression)` | A `List<U>`, the lists the expression gives the items joined in order; an item's list that is null, a null item's among them, is refused (LEXICA5031), never treated as empty |
| `concat(other)` | The items, then those of `other`, a `List<T>` of the receiver's `T`, which a later argument never widens |
| `flatten` | On a `List<List<T>>`, the items of each inner list in order, a list whose inner lists can be null having none |
| `take(count)`, `drop(count)` | The items at an index less than the count, and those at the count or past it, whatever number the count is: one past the end takes or leaves every item, and one of zero or less none |
| `takeWhile`, `dropWhile` | The items before the first its predicate is falsy for, and the items from that one on, the predicate evaluated against none after it |
| `any`, `all` | Whether its predicate is truthy for some item, false for none and stopping at the first it is truthy for, and whether for every item, true for none and stopping at the first it is not |
| `contains(value)` | Whether an item equals the value by [key equality](types.md#types-dictionaries-and-pairs), stopping at the first that does, null equal to a null item |
| `single` | The one item, null for an empty list, and refused for a list of several (LEXICA5030) |
| `minBy`, `maxBy` | The first item whose key is the least or the greatest, keys compared as [ordering](#vocabulary-list-ordering) compares them, items whose key is null skipped, null where none gives one |
| `orderBy(key)`, `orderByDescending(key)` | The items ordered by their keys, ascending or descending, as [ordering](#vocabulary-list-ordering) sets out |
| `thenBy(key)`, `thenByDescending(key)` | The items of a list `orderBy` ordered, each run of items whose keys so far are equal ordered within itself by another key, as [ordering](#vocabulary-list-ordering) sets out |
| `distinct`, `distinctBy(expression)` | Each item's first occurrence, in order, items compared by key equality; and each key's first item, its key the expression's value, keys compared alike |
| `reverse` | The items in the opposite order |
| `toDictionary(expression)` | A `Dictionary<K, T>` of the items by the key the expression gives each, in the items' order, two items of one key refused (LEXICA5029), which `groupBy` collects instead |
| `groupBy(expression)` | A `Dictionary<K, List<T>>` of the items by their keys, each key's items in their order, the keys in the order their first items stand |

Each signature of the unnamed indexer and of `entry` is one of an [indexer's signatures](members.md#property-access-calls-and-indexers-unnamed-indexers), selected by its key's type: a number and an index are looked up tolerantly, and a range slices strictly.

A number generates numbers apart from any range: `start.sequence(count, step)`, `step` 1 where it is left out, is the `List<Number>` of the count's numbers from the start, each the step after the one before, a count that is no nonnegative safe integer refused (LEXICA5035).

`where`, `first`, `last` and the unnamed indexer preserve `T` from a `List<T>`, the type parameter `List` declares, so `rooms.first` is a `Room?` for a `List<Room>`. A key `toDictionary`, `groupBy` or `distinctBy` gives is of a key type, `K` its expression's type, so keys of another type are refused where they are resolved (LEXICA3083).

An item's body reads the item as a value that is not null, as an object projection reads it, so a null item answers null and the body is never evaluated against it: `where`, `takeWhile`, `dropWhile`, `any` and `all` find null falsy, the aggregates skip it, and `toDictionary` and `groupBy` key it by null. `select` alone evaluates its body against every item, its `it` the item's type, null included. A function of the item is called with each item as it is, whichever member it is given to.

Aggregates consume null per item rather than propagating it to the entire call. `max`, `min` and `average` skip items whose expression is null, and answer null where every item was skipped or the list is empty. `sum` skips null values and answers 0 where every item was skipped or the list is empty. Each member evaluates its expression or its predicate at most once for each item it visits, and a member that stops at a decisive item evaluates none after it. Thus `room.devices.max(it.battery)` and `Home.rooms.where(it.climate?.temperature).count` are valid even though the expressions can return null.

<a id="vocabulary-list-ordering"></a>

#### Ordering

`orderBy` and `orderByDescending` order a list's items by the key their expression gives each, and `thenBy` and `thenByDescending` refine that order by another key. Each answers a new `List<T>`, its receiver unchanged.

- **Keys.** A key is a number, a string, a Boolean or null, and every key of one criterion that isn't null is of one of those domains: numbers compare numerically, `-0` equal to `0`; strings by their code units, without any locale; and Booleans false before true. A key of another kind, a list, an object or a reference, and keys of two domains in one criterion, are refused where the call is evaluated (LEXICA5036), as a key of `Any` is checked as it is evaluated. Comparing strings is the members' contract alone, so `"a" < "b"` stays refused in an expression.
- **Nulls.** A null key, a null item's among them, orders after every other key in either direction. A script orders nulls first by ordering by whether its key is null first, `items.orderBy(it.date != null).thenBy(it.date)`. A body's key is null for a null item, which an item's body never reads, so that ordering puts null items last; a list whose items can be null orders them first by a function, which reads each item as it is: `items.orderBy(item => item != null).thenBy(it)`.
- **Stability.** Items of equal keys keep their order, in either direction.
- **Each key once.** A criterion evaluates its expression once for each item, whichever direction, and never again.
- **Refinement.** `thenBy` takes a list `orderBy` or `thenBy` answered, which a local holding it keeps, and orders each run of items whose keys so far are equal by its own key, leaving every run where the order before it put it, so it refines and never sorts again. Its answer keeps the keys of every criterion, so another `thenBy` refines it further. A list no `orderBy` ordered, one another member answered of an ordered list among them, is refused (LEXICA5037), so `items.orderBy(it.a).where(it.b).thenBy(it.c)` orders by `c` within `where`'s answer only after `orderBy` again.
- **What it keeps.** The keys are the evaluation's, kept with the list they ordered, never as the expressions that gave them, and no result records them: an ordered list's record realigns its items' lineage as any reordering does, as [provenance](runtime.md#runtime-results-provenance) sets out.

An expression parameter declares the item type it evaluates against and the result type it requires. A predicate parameter accepts a value expression and receives its truthiness as a Boolean. Either takes a function of the item in place of its body, `room.devices.max(d => d.power)`, as [argument kinds](members.md#arguments-kinds) set out.

<a id="vocabulary-dictionary-members"></a>

### Dictionary and pair members

A member following a dictionary is a member of the dictionary itself, and each reads and changes as the entries it reads do; a lookup's key consumes null, as [dictionaries](types.md#types-dictionaries-and-pairs) set out.

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

<a id="vocabulary-verbs"></a>

### The verbs

`is`, `has` and `supports` are Lexica's own functions of a receiver of any type, each answering whether its receiver passes a test. Each declares one [function parameter](members.md#arguments-kinds), its **test**, whose callback contract takes the receiver and answers a `Boolean`, and answers what the test answers of its receiver: Lexica declares the three in an extension on any type, `{ name: 'VerbExtensions<T>', kind: 'extension', target: 'T' }`, whose `T` each call binds to its receiver, and its test's callback on that receiver's type, `parameters: ['T']`, so the test takes the receiver as its static type, `(T) => Boolean`, made non-null where `?.` reads the verb: a `Light` receiver gives its test a `Light`. The three read differently and do the same:

| Verb | Reads as a test of | As in |
| --- | --- | --- |
| `is` | A state its receiver enters and leaves | `room.is(Home.occupied)` |
| `has` | A possession or a presence | `device.has(it.battery != null)` |
| `supports` | A capability | `device.supports(Home.dimmable)` |

No verb is tied to a test, and no test to a verb: a module declares its tests as [Boolean functions](#vocabulary-boolean-functions), and a script asks any of them with any verb, or calls it directly.

<a id="vocabulary-verbs-the-test"></a>

#### The test

The test takes any form a function argument takes, as [functions passed to members](functions.md#functions-passed-to-members) set out:

- **An arrow function**, `device.is(d => d.power > 0)`, which keeps the implicit parameter of the place it is written, as every arrow function does.
- **A delegate a name holds**, `light.is(lit)` after `let lit = (l) => l.brightness > 0`, read as every name is: `device.is(active)` reads a local, an object field, a function parameter or a script parameter named `active`, and no bare name reaches a module's function.
- **A module's function by [reference](functions.md#functions-module-functions)**, `device.is(Home.active)`, which tests the receiver with that declaration, as `device.active()` does.
- **An [implicit body](functions.md#functions-implicit-bodies)**, `device.has(it.battery != null)`, an expression whose `it` is the receiver.

A name that does not hold a function is a validation error saying the verb takes a test, as `device.is(metered)` is for a Boolean `metered`, and so is a test that does not take the receiver's type or that answers anything but a `Boolean`.

<a id="vocabulary-verbs-what-a-verb-answers"></a>

#### What a verb answers

A verb answers its test's result, a Boolean that cannot be null, and converts no truthiness: a test answering a `Boolean?`, or any other type, is a validation error, and a module's function whose implementation answers anything but a Boolean fails the evaluation with an evaluation error naming the function and its module. `.` requires a receiver that cannot be null, and `?.is(…)` answers null for a null receiver without evaluating its test or calling it, so `room.device(name)?.is(Home.active)` is a `Boolean?`.

A verb reads what its test reads: a module's function, what its declaration's `updates` say, its observations included; an arrow function or an implicit body, the reads it makes. Creating the test reads nothing, and the verb calls it once, while its own call lasts.

<a id="vocabulary-boolean-functions"></a>
<a id="predicates"></a>

## Boolean functions

A module declares a test of a receiver as a function whose result is a `Boolean`, as `Home` declares `active` and `offline` on `Device` and `occupied` on `Room`. It is a member as any other: its receivers, its implementation, its `updates`, the changes it misses and the observations that cover it are its declaration's, and its failures name it and its module. A script calls it directly, `device.active()`, through its module, `Home.active(device)`, or passes it to a verb by reference, `device.is(Home.active)`, and each way reaches the one declaration, so a host's policy for a partly observable test concerns that test however it is reached.

A test is declared as a function, since only a function has a [reference](functions.md#functions-module-functions) a script passes; a property is read where it is written. Boolean functions compose as Booleans do: `device.active() and not device.offline()`.

<a id="observations"></a>

## Observations

An **observation** is what a member names to learn that its result may have changed, or to keep the sample it reads. The member declares it, Lexica validates it, and the host starts it where it follows what an evaluation read, and stops it where it no longer does; how a host shares and ends observations is its own.

<a id="observations-types"></a>

### Observation types

An **observation type** is a declaration of a module, named once across every module: its name, conventionally in camelCase, its contract, which is one of two, the arguments that belong to an observation's identity, whether equivalent requests share one, and its implementation.

| Contract | What it reports |
| --- | --- |
| Invalidation | That a result it covers may have changed, so the host evaluates again, as `state` reports a device's new report. |
| Maintained | Each sample it keeps, which the member that names it reads as its latest, as `reading` keeps each temperature a sensor reports. |

<a id="observations-types-the-request"></a>

Its implementation receives the **request** an observation makes, `{ type, target, arguments }`: the observation type's name; the target the observation observes, the receiver, a target its host resolved or the value of the member's argument it names; and the arguments the observation gives its type, by name, each argument reference resolved to the value the call gives it. The host builds the request as it starts the observation, since Lexica starts none.

<a id="observations-targets"></a>

### Observation targets

An **observation target** is what a module declares an observation may observe besides the receiver and an argument, by a name of its own: a target independent of any receiver, as the home is, or one found from the receiver, `from: 'receiver'`; and one target, or several, `count: 'many'`. A target that omits `from` is independent of the receiver, and one that omits `count` is one target.

Lexica does not know any target by name: it validates the declarations and every reference to them, and the host resolves each target when it starts an observation, so a host's module declares the targets its domain needs and the host resolves them itself. `receiver` names the receiver alone, so no module declares a target by that name, and an argument is named as `{ argument }`, never by a bare name, so a target and an argument are never mistaken for each other.

<a id="observations-naming"></a>

### Naming observations

A member names its observations by type, each of its receiver, of an argument, or of an observation target its observation type's module declares, as `placement` is of the home, and gives the arguments its type takes: a literal, a list of values, or an argument of the member, `{ argument }`, which can carry a prefix, a string joined before the argument of a value parameter of type `String`. A target the observation type's module does not declare is refused when the module is registered.

An observable member names observations that cover every change to its result, a partly observable one those it can make, and a member of any other category names none. A member that reads maintained values names a maintained observation, whose sample it reads; no other member does. A maintained observation gives its member one sample, so it observes one target, never a target of several. A module member, which has no receiver, does not observe a target found from one.

<a id="events-and-event-types"></a>

<a id="vocabulary-type-selectors"></a>

## Type selectors

A **type selector** is a declaration of a module that maps keys to types, so a function's fixed argument can choose the type the function answers. The home declares the selector `event`, whose keys are the reports a device makes: `"change"` maps to its structured type `Change`, of `setting` and `value`, and `"motion"` to `Motion`, of `at` and `strength`, so the values a host supplies for `sensor.on("motion")` are `Motion`s.

- **Declaring a selector.** A module declares a selector in its `typeSelectors` by its name alone. A selector is named once across every module, unlike a type, which is named once within its module, so a selector's name identifies the module that declares it, and a module declaring a selector of a name already declared is refused at registration with a module error naming the selector and the module that declared it.
- **Its keys.** A module declares each key in its `mappings`, a **mapping** of the `selector` it belongs to, the `key` and the `type` it maps to, `{ selector: 'event', key: 'motion', type: 'Motion' }`, its key any string, as a fixed argument may give any, and its type a named type of the declaring module or one of Lexica's own written unqualified and a foreign type qualified, as [type identity](types.md#types-type-identity) sets out. A mapping never writes an object's shape in place: a key whose values are objects maps to a named structured type, as `motion` maps to `Motion`, whose properties `at` and `strength` hold a motion's data. A mapping's selector and key together are its identity, and different selectors may share a key. Any module declares keys for any selector, its own or one a module registered before it declares, so one module extends another's selector as it extends another's types, and is registered after the module it extends. A key stands once in its selector across every registered module: a second, from the same module or another, is refused at registration with a module error naming the selector, the key and the module that declared it first, and no key once registered is replaced. A key of a selector no registered module declares is refused too.
- **Its revision.** Registering a module that adds keys advances the registry's revision, as every registration does, so a resolution made before them is resolved again, as [reusing a resolution](runtime.md#runtime-reuse) sets out.
- **Selecting.** A function's parameter that selects through a selector is fixed and names it, `fixed: true, selects: 'type', selector: 'event'`, and its argument settles as every [fixed argument](members.md#arguments-fixed) does. A function has at most one parameter that selects a type, since its `result` writes one `@selected` where the selected type stands, as `@selected` or `List<@selected>` does; a function with no parameter that selects a type writes none.
- **A key the selector does not map** is a validation error naming the selector and the key.

<a id="vocabulary-conversions"></a>

## Conversions

A **conversion** is a [conversion operator](modules.md#modules-operators) of a type of data, `{ kind: 'operator', name: 'convert', result: 'Number', impl }`, which `to` invokes and nothing else, and none from a type to itself. Several modules may each declare one from a source to a destination: they compete as every operator does, among those a script's imports make available, the owner's winning, the extension's whose target is more specific than every other's resolving where the owner declares none, and several none of which is more specific refused as ambiguous where a script converts so, as [owners and extensions](modules.md#namespaces-owners-and-extensions) set out. A destination written qualified identifies its type and never selects an operator, and an [extension access](members.md#property-access-calls-and-indexers-extension-access) reaches none. Its types are `Number`, `String`, `Boolean` and the structured types that hold data alone: a reference value is left to members, which declare how they change, so a conversion adds no dependency on a host's state. A module declares one in the members of its own source type, and in an extension where the source type is another module's and the destination its own, as `Measurements` declares one from `Number` to `Temperature`.

Its `impl` reads `value`, never null, and nothing else, and answers the converted value, or calls `reject(reason)` with a diagnostic string. `reject` throws a signal private to Lexica and to that attempt, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. What `to` and `try … to` make of a rejection and of any other failure is set out in [conversions](values.md#conversions) and [attempts](expressions.md#attempts).
