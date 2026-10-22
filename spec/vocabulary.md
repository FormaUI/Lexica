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

Lexica's own module owns the language's types, `List`, `Number`, `String` and `Boolean` among them, and has no namespace. It declares `List<T>`, with the members of lists; the three verbs that test a receiver, in `VerbExtensions<T>`, an extension targeting its parameter `T`, so on any type; and the conversions between the language's types of data, as operators of those types.

<a id="vocabulary-list-members"></a>

### List members

A member following a list is a member of the list itself: `room.devices.count` counts the room's devices. Lexica's own module declares `count`, `first`, `last`, `max`, `min`, `sum` and `where`, and its unnamed indexer, and each reads and changes as the items it selects and the expression it evaluates do.

| List member | Contract |
| --- | --- |
| `count` | The number of items, 0 for an empty list |
| `first`, `last` | The first or the last item, null for an empty list |
| The unnamed indexer, `[index]` | The item at the index counted from zero, and null for an index past the end, for a negative one, which never counts from the end, and for a fractional one; `-0` is `0` |
| `where` | The items its predicate is truthy for, in the list's order, leaving out an item whose predicate is null or false; the predicate may produce any value |
| `max`, `min`, `sum` | Evaluate a number expression against each item and require `Number?` |

`where`, `first`, `last` and the unnamed indexer preserve `T` from a `List<T>`, the type parameter `List` declares, so `rooms.first` is a `Room?` for a `List<Room>`.

Aggregates consume null per item rather than propagating it to the entire call. `max` and `min` skip items whose expression is null, and answer null where every item was skipped or the list is empty. `sum` skips null values and answers 0 where every item was skipped or the list is empty. Thus `room.devices.max(it.battery)` and `Home.rooms.where(it.climate?.temperature).count` are valid even though the expressions can return null.

An expression parameter declares the item type it evaluates against and the result type it requires. A predicate parameter accepts a value expression and receives its truthiness as a Boolean. Either takes a function of the item in place of its body, `room.devices.max(d => d.power)`, as [argument kinds](members.md#arguments-kinds) set out.

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
- **A function value a name holds**, `light.is(lit)` after `let lit = (l) => l.brightness > 0`, read as every name is: `device.is(active)` reads a local, a field, a function parameter or a script parameter named `active`, and no bare name reaches a module's function.
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

An **observation type** is a declaration of a module, named once across every module: its camelCase name, its contract, which is one of two, the arguments that belong to an observation's identity, whether equivalent requests share one, and its implementation.

| Contract | What it reports |
| --- | --- |
| Invalidation | That a result it covers may have changed, so the host evaluates again, as `state` reports a device's new report. |
| Maintained | Each sample it keeps, which the member that names it reads as its latest, as `reading` keeps each temperature a sensor reports. |

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

A **type selector** is a declaration of a module that maps keys to types, so a function's fixed argument can choose the type the function answers. The home declares the selector `event`, whose keys are the reports a device makes: `"change"` maps to `{ setting: String, value: String? }` and `"motion"` to `{ at: Number, strength: Number }`, so the values a host supplies for `sensor.on("motion")` are of the second.

- **Declaring a selector.** A module declares a selector in its `typeSelectors` by its name alone. A selector is named once across every module, unlike a type, which is named once within its module, so a selector's name identifies the module that declares it, and a module declaring a selector of a name already declared is refused at registration with a module error naming the selector and the module that declared it.
- **Its keys.** A module declares each key in its `selectableTypes`, a declaration named by the key, with the `selector` it belongs to and the `type` it maps to, a type of the declaring module or one of Lexica's own written unqualified and a foreign type qualified, as [type identity](types.md#types-type-identity) sets out. Any module declares keys for any selector, its own or one a module registered before it declares, so one module extends another's selector as it extends another's types, and is registered after the module it extends. A key stands once in its selector: a second, from the same module or another, is refused at registration with a module error naming the selector, the key and the module that declared it first, and no key once registered is replaced. A key of a selector no registered module declares is refused too.
- **Its revision.** Registering a module that adds keys advances the registry's revision, as every registration does, so a resolution made before them is resolved again, as [reusing a resolution](runtime.md#runtime-reuse) sets out.
- **Selecting.** A function's parameter that selects through a selector is fixed and names it, `fixed: true, selects: 'type', selector: 'event'`, and its argument settles as every [fixed argument](members.md#arguments-fixed) does. A function has at most one parameter that selects a type, since its `result` writes one `@selected` where the selected type stands, as `@selected` or `List<@selected>` does; a function with no parameter that selects a type writes none.
- **A key the selector does not map** is a validation error naming the selector and the key.

<a id="vocabulary-conversions"></a>

## Conversions

A **conversion** is a [conversion operator](modules.md#modules-operators) of a type of data, `{ kind: 'operator', name: 'convert', result: 'Number', impl }`, which `to` invokes and nothing else, and none from a type to itself. Several modules may each declare one from a source to a destination: they compete as every operator does, among those a script's imports make available, the owner's winning, one extension's resolving where the owner declares none, and several refused as ambiguous where a script converts so, as [owners and extensions](modules.md#namespaces-owners-and-extensions) set out. A destination written qualified identifies its type and never selects an operator, and an [extension access](members.md#property-access-calls-and-indexers-extension-access) reaches none. Its types are `Number`, `String`, `Boolean` and the structured types that hold data alone: a reference value is left to members, which declare how they change, so a conversion adds no dependency on a host's state. A module declares one in the members of its own source type, and in an extension where the source type is another module's and the destination its own, as `Measurements` declares one from `Number` to `Temperature`.

Its `impl` reads `value`, never null, and nothing else, and answers the converted value, or calls `reject(reason)` with a diagnostic string. `reject` throws a signal private to Lexica and to that attempt, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. What `to` and `try … to` make of a rejection and of any other failure is set out in [conversions](values.md#conversions) and [attempts](expressions.md#attempts).
