# Vocabulary

<a id="vocabulary"></a>
<a id="vocabulary-contracts"></a>

A script's **vocabulary** is everything it can name beyond the language itself: the types, members, predicates, event types, observation types and conversions of every module the registry it is resolved against holds. Lexica's own module is always among them, and every other module contributes by the same contracts, whatever its domain. A module's own specification gives its declarations and what each does in its domain; this document gives the contracts every one keeps, beside [members](members.md) and [types](types.md).

In this document:

1. [Lexica's own vocabulary](#vocabulary-lexicas-own)
2. [Predicates](#predicates)
3. [Observations](#observations)
4. [Events and event types](#events-and-event-types)
5. [Conversions](#vocabulary-conversions)

<a id="vocabulary-lexicas-own"></a>

## Lexica's own vocabulary

Lexica's own module owns the language's types, `list`, `number`, `string` and `boolean` among them, and has no namespace. It declares the members of lists, the three verbs that ask predicates, and the conversions between the language's types of data.

<a id="vocabulary-list-members"></a>

### List members

A member following a list is a member of the list itself: `room.devices.count` counts the room's devices. Lexica's own module declares `count`, `first`, `last`, `item`, `max`, `min`, `sum` and `where`, and each reads and changes as the items it selects and the expression it evaluates do.

| List member | Contract |
| --- | --- |
| `count` | The number of items, 0 for an empty list |
| `first`, `last` | The first or the last item, null for an empty list |
| `item`, the default indexer `:[index]` | The item at the index counted from zero, and null for an index past the end, for a negative one, which never counts from the end, and for a fractional one; `-0` is `0` |
| `where` | The items its predicate is truthy for, in the list's order, leaving out an item whose predicate is null or false; the predicate may produce any value |
| `max`, `min`, `sum` | Evaluate a number expression against each item and require `number?` |

`where`, `item`, `first` and `last` preserve `T` from a `list<T>`.

Aggregates consume null per item rather than propagating it to the entire call. `max` and `min` skip items whose expression is null, and answer null where every item was skipped or the list is empty. `sum` skips null values and answers 0 where every item was skipped or the list is empty. Thus `room.devices.max(it.battery)` and `home.rooms.where(it.climate?.temperature).count` are valid even though the expressions can return null.

An expression parameter declares the item type it evaluates against and the result type it requires. A predicate parameter accepts a value expression and receives its truthiness as a Boolean.

<a id="vocabulary-verbs"></a>

### The verbs

`is`, `has` and `supports` are Lexica's own functions of any receiver, each asking a [predicate](#predicates) by its name.

<a id="predicates"></a>

## Predicates

A **predicate** is a Boolean question of its receiver, under a name of its own, asked with one of Lexica's three verbs, each an ordinary function call of any receiver:

| Verb | Asks | As in |
| --- | --- | --- |
| `is` | A state its receiver enters and leaves | `room.is("occupied")` |
| `has` | A possession or a presence | `device.has("battery")` |
| `supports` | A capability | `device.supports("dimming")` |

Each predicate is asked with its one verb, so none stands in for another, and asking it with another is a validation error giving the verb to write, as `device.is("battery")` is. A Boolean that follows from another member's value is a property, never a predicate.

<a id="predicates-declarations"></a>

### Declaring a predicate

Each predicate is a declaration of its own: its name, the verb that asks it, `is` where it names none, the types it applies to, the implementation that tests it, and its `updates`, as a member's: how it reads, how it changes, the changes it misses where it is partly observable, and the observations that cover it. A test of a predicate follows the predicate's contract alone, so a host's policy for one partly observable predicate concerns that predicate, and no other.

A predicate is selected by the fixed argument of its verb, which the resolution keeps beside the verb's call, so its contract, never the verb's, is the one a host checks and the evaluation follows. A predicate's failures name it, the verb that selected it and its module.

<a id="predicates-fixed-names"></a>

### Fixed names

The name is a [fixed argument](members.md#arguments-fixed): a string the script's resolution settles without evaluating a member, a literal, a script parameter, or a local, a conditional binding, a conditional, a `??`, an `and` or an `or` that settles to one, never null, which selects the predicate's declaration when the script is resolved.

<a id="predicates-receiver-types"></a>

### Receiver types

Each verb is declared on any receiver, which says only that any receiver can be asked: the predicate of the name decides which receivers it applies to. A name no predicate the verb asks has is a validation error naming the predicates the verb asks, and a predicate of other receivers is one naming the predicate, the types it applies to, the receiver and the predicates the verb asks of it. A predicate of a supertype applies to every type beneath it, so `light.is("active")` asks `device`'s.

<a id="predicates-a-function-call-as-any-other"></a>

### A function call as any other

`.` requires a receiver that cannot be null, and `?.is(…)` answers null for a null receiver without testing its predicate; either is validated as written, its name included, whatever its receiver is when it is evaluated. A predicate is also called through its module's namespace, the receiver first and no verb, as [qualified access](modules.md#namespaces-qualified-access) sets out.

<a id="predicates-boolean-result"></a>

### Boolean result

Its type is a Boolean that cannot be null, made nullable where `?.` reads a receiver that can be. A predicate whose implementation answers anything else, or throws, fails the evaluation with an evaluation error that names the predicate, the verb that selects it and the module that declares it.

Predicates compose as Booleans do: `device.is("active") and not device.is("offline")`.

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

Lexica knows no target by name: it validates the declarations and every reference to them, and the host resolves each target when it starts an observation, so a host's module declares the targets its domain needs and the host resolves them itself. `receiver` names the receiver alone, so no module declares a target by that name, and an argument is named as `{ argument }`, never by a bare name, so a target and an argument are never mistaken for each other.

<a id="observations-naming"></a>

### Naming observations

A member names its observations by type, each of its receiver, of an argument, or of an observation target its observation type's module declares, as `placement` is of the home, and gives the arguments its type takes: a literal, a list of values, or an argument of the member, `{ argument }`, which can carry a prefix, a string joined before the argument of a value parameter of type `string`. A target the observation type's module does not declare is refused when the module is registered.

An observable member names observations that cover every change to its result, a partly observable one those it can make, and a member of any other category names none. A member that reads maintained values names a maintained observation, whose sample it reads; no other member does. A maintained observation gives its member one sample, so it observes one target, never a target of several. A module member, which has no receiver, observes no target found from one.

<a id="events-and-event-types"></a>

## Events and event types

An [event source](members.md#members-event-sources)'s fixed argument selects an **event type**, a declaration of a module, named once across every module, that names the structured type of its event data, as `motion` names `{ at: number, strength: number }`; a type no event type of that name declares is a validation error.

An event is captured as the fields its event data declares when it happens. A field the event carries no value of its type for is null where its type is nullable; where it is not, the capture fails, and the subscription reports the failure as it reports a failed object expression.

An event source documents which fields it captured when the event happened, and when it delivers the event relative to what the host does with it; everything else an event's object expression reads is read as it is evaluated.

<a id="vocabulary-conversions"></a>

## Conversions

A **conversion** is a declaration of a module: the type of data it converts from, the one it converts to and its implementation, one for each source type and target across every module registered, and none from a type to itself. Its types are `number`, `string`, `boolean` and the structured types that hold data alone: a reference value and an event source are left to members, which declare how they change, so a conversion adds no dependency on a host's state.

Its implementation reads `value`, never null, and nothing else, and answers the converted value, or calls `reject(reason)` with a diagnostic string. `reject` throws a signal private to Lexica and to that attempt, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. What `to` and `try … to` make of a rejection and of any other failure is set out in [conversions](values.md#conversions) and [attempts](expressions.md#attempts).
