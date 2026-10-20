# Vocabulary contracts

<a id="vocabulary-contracts"></a>

Every module follows these contracts, whatever its domain: what a member declares, how it reads and how its result changes, the observations it names, its predicates, its events, and the rules an extension of another module's types follows. A module's own specification gives its declarations and what each does in its domain, and these contracts the rules they keep.

In this document: [What a member declares](#what-a-member-declares) · [How a member reads](#how-a-member-reads) · [How a member changes](#how-a-member-changes) · [Observations](#observations) · [Predicates](#predicates) · [Events and event types](#events-and-event-types).

<a id="what-a-member-declares"></a>

## What a member declares

A member declares its kind, its signature and its runtime contract. Its kind is `property`, `function`, `eventSource`, `action` or `behavior`, and the kind of the request a chain ending in it makes follows from it: a property or a function makes a value request, an event source a subscription, an action an action and a behavior a behavior request. The signature supplies enough information to validate a request before evaluation.

<a id="what-a-member-declares-signature"></a>

### Signature

| Declaration | Specifies |
| --- | --- |
| Target | The types whose values have this member, or none for a [module member](modules-and-namespaces.md#namespaces-module-members) |
| Form | Property access, function call or named indexer |
| Input | Positional arguments or one options object |
| Parameters | Order, name, type, argument kind, required status or default, null policy, whether it is fixed and, for a fixed one, what it selects, an event type or a predicate, for an expression or a predicate, its implicit parameter, each item, and for a function, the types of the arguments it is called with, its type being its result's; only a function declares a function parameter, which is required, has no null policy and is given to no observation |
| Result type | The type the member must return |

Optional and nullable are separate. An optional parameter can be omitted; a nullable parameter can receive null. Unless a member's declaration marks a parameter optional, it is required.

Omitting a required argument is a validation error. Supplying null follows the parameter's null policy.

<a id="what-a-member-declares-call-and-indexer-forms"></a>

### Function call and indexer forms

A function, an event source, an action or a behavior is written as a function call. A function may instead declare an indexer with exactly one required value parameter, supplied as its bracketed key. Its input is positional, and its key has the declared parameter type.

An indexer may be designated the default for its receivers, a module designating at most one for a receiver type; which designation an access selects follows the receiver type's owner, as [indexers](modules-and-namespaces.md#namespaces-indexers) set out.

Positional input lists parameters in order, with required parameters before optional ones; creating the module checks this order. Options input takes one object whose fields supply the declared parameters.

Changing a member's input is a breaking change, like renaming it. A function expected to grow uses options from the start.

<a id="what-a-member-declares-evaluation-contract"></a>

### Evaluation contract

In addition to the signature, a member declares [how it reads](#how-a-member-reads), [how its result changes](#how-a-member-changes), the changes it misses, which a partly observable member states, and the [observations](#observations) that cover its changes, which an observable or a partly observable member names and no other does; its request kind follows from its kind.

An expression parameter declares the item type it evaluates against and the result type it requires. A predicate parameter accepts a value expression and receives its truthiness as a Boolean.

| List function | Contract |
| --- | --- |
| `where`, `:[index]`, `first`, `last` | Preserve `T` from a `list<T>` |
| `where` | Evaluate a predicate against each `T`; the predicate may produce any value |
| `max`, `min`, `sum` | Evaluate against each `T` and require `number?` |

Aggregates consume null per item rather than propagating it to the entire call. `max` and `min` skip null values and return null if all items were skipped. `sum` skips null values and returns zero if all were skipped or the list is empty.

Thus `room.devices.max(it.battery)` and `home.rooms.where(it.climate?.temperature).count` are valid even though the expressions can return null.

An object expression following `event<T>` evaluates against event data of type `T`.

<a id="what-a-member-declares-numeric-tolerance"></a>

### Numeric tolerance

A member may declare a tolerance for its numeric result and every number within a structured result. When comparing results, a host that tolerates changes treats an absolute difference no greater than this tolerance as unchanged, as `sensor.temperature` declares `0.5`. This rule applies regardless of the member's form.

<a id="how-a-member-reads"></a>

## How a member reads

An expression is evaluated synchronously, without yielding, and a member's implementation is synchronous. Each member declares how it obtains its value:

| Reading | Meaning |
| --- | --- |
| Fresh | Read as the expression evaluates, as `device.power` reads the power the device reports now. |
| Maintained | Kept by an observation the member holds, and read as that observation's latest sample, as `sensor.temperature` reads the last reading the `reading` observation kept. |
| Captured | A sample taken at a moment the member documents, such as the history a member keeps or what an event carried. |
| Derived | As the items it selects and the expression it evaluates read, such as a list's `count` or `max`. |

Facts that must describe one measurement are fields of one structured value, which is captured once and read by each of its fields, as a `climate`'s temperature and humidity are.

A maintained member's observation starts the first time an evaluation reads it, and the member is **pending** until its first sample arrives. An evaluation that reads a pending member reads it as null and tells its host it is pending, and a host that cannot wait for the sample fails the evaluation instead; when a host waits for first samples is the host's to decide.

Evaluating an expression is read-only for every vocabulary: what changes the host's state is an action, carried out only when its request is executed.

A member whose result depends on what happened before, as well as on the state as it is, is captured: it keeps that history while its host holds the evaluation, and documents what an evaluation once reports without it.

<a id="how-a-member-changes"></a>

## How a member changes

Every member declares how its result changes, for a given receiver and arguments:

| Category | Meaning |
| --- | --- |
| Constant | The result never changes for the receiver and arguments, as a literal's or `room.name`. |
| Observable | The member names observations that cover every change to its result, as `device.power` names `state`. |
| Partly observable | The member names the observations it can make, and states the changes they miss, as `device.battery` misses the drain between the device's reports. |
| Unobserved | The member can be read, and names no observations, as `home.now`. |
| Derived | The result changes as the items it selects and the expression it evaluates do, such as a list's `first` or `where`. |

The categories are facts a host reads: whether a request over an unobserved or a partly observable member may be watched is the host's policy, which Lexica gives the declarations a resolution uses to decide. A literal is constant, so an expression that carries one changes only as its members do.

<a id="observations"></a>

## Observations

An **observation type** is a declaration of a module, named once across every module: its name and its contract, which is one of two.

| Contract | What it reports |
| --- | --- |
| Invalidation | That a result it covers may have changed, so the host evaluates again, as `state` reports a device's new report. |
| Maintained | Each sample it keeps, which the member that names it reads as its latest, as `reading` keeps each temperature a sensor reports. |

An **observation target** is what a module declares an observation may observe besides the receiver and an argument, by a name of its own: a target independent of any receiver, as the home is, or one found from the receiver, `from: 'receiver'`; and one target, or several, `count: 'many'`. A target that omits `from` is independent of the receiver, and one that omits `count` is one target. Lexica validates the declarations and every reference to them, and the host resolves each target when it starts an observation. `receiver` names the receiver alone, so no module declares a target by that name, and an argument is named as `{ argument }`, never by a bare name, so a target and an argument are never mistaken for each other.

A member names its observations by type, each of its receiver, of an argument, or of an observation target its observation type's module declares, as `placement` is of the home; a target the observation type's module does not declare is refused when the module is registered. A module member, which has no receiver, observes no target found from one, and a maintained observation, which gives one sample, observes no target of several. An observable member names observations that cover every change to its result, a partly observable one those it can make, and a member of any other category names none. A member that reads maintained values names a maintained observation, whose sample it reads; no other member does.

An observation is started where an evaluation's host follows what it read, and stopped where the host no longer does; how a host shares and ends observations is its own.

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

### Declarations

Each predicate is a declaration of its own: its name, the verb that asks it, `is` where it names none, the types it applies to, the implementation that tests it, how it reads, how it changes, the changes it misses where it is partly observable, and the observations that cover it. A test of a predicate follows the predicate's contract alone, so a host's policy for one partly observable predicate concerns that predicate, and no other.

<a id="predicates-fixed-names"></a>

### Fixed names

The name is a [fixed argument](access-and-calls.md#arguments): a string the expression's preparation settles without evaluating a member, a literal, a bound parameter, or a local, a conditional binding, a conditional, a `??`, an `and` or an `or` that settles to one, never null, which selects the predicate's declaration when the expression is prepared.

<a id="predicates-receiver-types"></a>

### Receiver types

Each verb is declared on any receiver, which says only that any receiver can be asked: the predicate of the name decides which receivers it applies to. A name no predicate the verb asks has is a validation error naming the predicates the verb asks, and a predicate of other receivers is one naming the predicate, the types it applies to, the receiver and the predicates the verb asks of it. A predicate of a supertype applies to every type beneath it, so `light.is("active")` asks `device`'s.

<a id="predicates-a-function-call-as-any-other"></a>

### A function call as any other

`.` requires a receiver that cannot be null, and `?.is(…)` answers null for a null receiver without testing its predicate; either is validated as written, its name included, whatever its receiver is when it is evaluated. A predicate is also called through its module's namespace, the receiver first and no verb, as [qualified access](modules-and-namespaces.md#namespaces-qualified-access) sets out.

<a id="predicates-boolean-result"></a>

### Boolean result

Its type is a Boolean that cannot be null, made nullable where `?.` reads a receiver that can be. A predicate whose implementation answers anything else, or throws, fails the evaluation with an evaluation error that names the predicate, the verb that selects it and the module that declares it.

Predicates compose as Booleans do: `device.is("active") and not device.is("offline")`.

<a id="events-and-event-types"></a>

## Events and event types

An **event source** is a member that delivers things that happened. It is subscribed to, never read or watched, and the object expression following it is evaluated against each [event](requests.md#events). An event source's fixed argument selects an **event type**, a declaration of a module, named once across every module, that names the structured type of its event data, as `motion` names `{ at: number, strength: number }`; a type no event type of that name declares is a validation error.

An event is captured as the fields its event data declares when it happens. A field the event carries no value of its type for is null where its type is nullable; where it is not, the capture fails, and the subscription reports the failure as it reports a failed object expression.

An event source documents which fields it captured when the event happened, and when it delivers the event relative to what the host does with it; everything else an event's object expression reads is read as it is evaluated.
