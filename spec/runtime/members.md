# Members

<a id="runtime-members"></a>

A module declares each member a script reads or calls, and gives the implementation that carries it out: its kind, its parameters and their kinds, its result, how it reads and how its value changes, which the evaluator and the host rely on. How a script writes and calls a member is the language's, as [members](../language/members.md) set out.

In this document:

1. [Declaring a member](#members-declaring-a-member)
2. [How a member reads](#how-a-member-reads)
3. [How a member changes](#how-a-member-changes)

<a id="members-declaring-a-member"></a>
<a id="what-a-member-declares-signature"></a>

## Declaring a member

A module declares each member as data, in the `members` of the type it belongs to, of an [extension](../language/extensions.md#extensions) of a type another module owns, or of the module itself for a [module member](../language/modules.md#namespaces-module-members). A member in a type or an extension takes that type as its receiver and names none, and a module member has none. Its declaration keys are its signature, which lets resolution check every use of it before evaluation, and its evaluation contract, which tells a host how the member reads and changes:

| Declaration key | Holds |
| --- | --- |
| `name` | The member's name in the language, an [identifier](../language/lexical-structure.md#names-and-reserved-words), followed by the [type parameters](../language/types.md#types-type-parameters) it declares, `identity<T>`; an operator's names its operation, `cast` or `convert`, and declares none; left out for a type's unnamed indexer |
| `kind` | `property`, `function`, `indexer` or `operator` |
| `invokedBy` | Who invokes a function: `evaluator`, the default, or `host`, as [host calls](../language/members.md#members-host-calls) set out; an indexer takes `evaluator` alone |
| `arguments` | The argument form of a function with parameters: `positional` or `options` |
| `parameters` | Each parameter's name, kind, type, whether it is required and its default where it is not, its null policy, whether it is fixed and what it selects, and its implicit parameter or callback contract by its kind, as [parameter declaration keys](#members-parameter-declaration-keys) set out |
| `result` | The type the member answers, [`Any`](../language/types.md#types-any) for a value of any type: a property's the type of its value, an operator's its destination, and a function the host invokes the type of each value its host supplies, left out where it supplies none, which `Any` never is |
| `updates` | How it reads and changes, as [updates](#members-updates) set out |
| `impl` | The function that carries it out, optional, as [declarations without an implementation](modules.md#modules-declarations-without-an-implementation) set out |
| `internal` | Whether it is available within its declaring module alone, `false` where left out, as [internal declarations](modules.md#modules-internal-declarations) set out |

Each member takes the declaration keys it needs alone; every one takes `kind` and `internal`, and every one but an unnamed indexer takes `name`:

| Member | `invokedBy` | `arguments` | `parameters` | `updates` | `result` | `impl` |
| --- | --- | --- | --- | --- | --- | --- |
| A property declared directly in a structured type without `updates`, part of its data shape | Refused | Refused | Refused | Refused | Required | Refused |
| A property with `updates` | Refused | Refused | Refused | Required | Required | Optional |
| A function the evaluator invokes | `evaluator`, or left out | Required where it has parameters, refused where it has none | Any kind; a function parameter only here | Required | Required | Optional |
| An indexer, named or unnamed | `evaluator`, or left out; `host` refused (NEXO4053) | Refused, since its arguments are positional | One required value parameter, its key, alone | Required | Required | Optional |
| A function the host invokes | `host` | As a function's | Value parameters, of which a fixed one may select a type | Refused | Optional | Refused |
| An operator | Refused | Refused | Refused | Refused | Required | Optional |

`target`, `syntax` and `default` are taken by no member: a member's place gives its receiver, and its kind and its name, or an indexer's lack of one, how it is written.

A function the host invokes takes value parameters alone, a deliberate restriction, which a design giving such arguments an evaluation context and a lifetime could lift: its arguments are prepared as values its host keeps, while an expression, a predicate or a function argument is evaluated by the evaluator as its member calls it, which for a host call would come after preparation ends and need an evaluation context and a lifetime no function the host invokes declares. A value parameter's type holds data and reference values, and a function is never given to one, as [functions as values](../language/functions.md#functions-as-values) sets out, so a prepared argument does not hold a function at any depth, in an object or a list among them.

A module member is a property or a function, and refuses what only a receiver gives: an indexer, and an observation of the receiver or of a target found from it, in its own `updates` and in any observation it names.

<a id="what-a-member-declares-call-and-indexer-forms"></a>

### Function call and indexer forms

A function is written as a function call. An indexer, `kind: 'indexer'`, is written with its name and brackets, `x.name[key]`, where it declares a `name`, and with brackets alone, `x[key]`, where it declares none; each takes its required value parameter as its bracketed key, positionally, the key of the parameter's declared type.

```js
members: [
    { kind: 'indexer', parameters: [/* index */], result: 'T?', updates, impl },                      // rooms[0]
    { kind: 'indexer', name: 'setting', parameters: [/* key */], result: 'String?', updates, impl },  // device.setting["mode"]
]
```

A named indexer's name is a member name, so it collides with a property or a function of that name on the same type, and a type declares as many named indexers as it needs. A module declares one unnamed indexer for a receiver type, of as many signatures as disjoint key types give it, and as many signatures for a named indexer; which one an access selects follows the receiver type's owner, as [indexer selection](../language/modules.md#namespaces-indexers) sets out.

Positional arguments list parameters in order, with required parameters before optional ones; creating the module checks this order. Options take one object whose object fields supply the declared parameters.

Changing a member's argument form is a breaking change, like renaming it. A function expected to grow uses options from the start.

<a id="members-parameter-declaration-keys"></a>

### Parameter declaration keys

A parameter is a value, an expression, a predicate or a function. An expression and a predicate are evaluated against each item of the list the member follows, `context: 'item'`, and an expression declares the type it produces. A parameter declares whether it is required, its default where it is not, and whether a null argument propagates, making the call answer null, or is accepted. A fixed parameter names something the vocabulary resolves before any evaluation, and declares what it selects, a type, `selects: 'type'`, through the type selector its `selector` names.

| Declaration key | Holds |
| --- | --- |
| `name` | The parameter's name, an [identifier](../language/lexical-structure.md#names-and-reserved-words), once among its member's parameters, which an options object's field gives |
| `kind` | `value`, `expression`, `predicate` or `function` |
| `type` | A value's type, the type an expression produces, `Boolean` for a predicate, the truthiness its implementation receives (NEXO4540), and a function's result's |
| `required` | Whether its argument must be given, a Boolean |
| `default` | The value a missing optional argument takes; a required parameter declares none (NEXO4538) |
| `nulls` | Its [null policy](../language/members.md#nullability-a-null-argument-follows-the-parameter), `propagate` or `accept`; a function parameter leaves it out (NEXO4054) |
| `fixed` | Whether its argument is [fixed](../language/members.md#arguments-fixed), a Boolean (NEXO4541), which a function parameter leaves out; a fixed parameter is a value parameter of type `String` (NEXO4545) |
| `selects`, `selector` | What a fixed parameter selects, `type`, and the type selector it selects through, which a parameter that is not fixed declares neither of (NEXO4542) |
| `context` | An expression's or a predicate's implicit parameter, `item`, which each declares (NEXO4539) and a function parameter refuses |
| `parameterTypes` | A function parameter's callback contract, the types of the arguments its function is called with, in order, which a function parameter declares (NEXO4537) and any other refuses |
| `omitted` | What the member does where an optional argument is left out, said in words for its documentation, which Nexo never reads |

Creating the module refuses a parameter that leaves out its `name`, its `kind`, its `type` or its `required`, or, but for a function parameter, its `nulls` (NEXO4536), and one declaring a key the table does not name (NEXO4030).

Only a function the evaluator invokes declares a function parameter, which is required, has no null policy and is given to no observation; it declares the types of the arguments it is called with, `parameterTypes`, and its type is its result's. Those types may write a type parameter the type or the extension around the member declares, as `List`'s `T`, or that of an extension on any type `T`, which takes a receiver of any type and binds `T` to it, so a callback takes the receiver as its own type, as a test of any receiver a module declares does.

<a id="types-type-parameters-registration"></a>

### Registration checks that inference is possible

A type parameter must have a supported source from which it can be bound: the receiver, through the target of the extension that declares it, a value parameter's type, or a callback's result contract. A member is refused at registration where a parameter its result writes has none, and where its callback's input writes a parameter whose only source is another callback's result, since callback results do not chain. The receiver binds its extension's parameters before any callback runs, so a callback's input may write one the extension's target supplies, even where the member writes it nowhere else. Registration checks this structurally; a particular call can still be refused where the types it gives are incompatible or insufficient.

<a id="members-declaration-helpers"></a>

### Declaration helpers

`nexo.declarations` holds helpers that each create a member's or a parameter's declaration as a module declares it, with the defaults the helper gives it: each constructs a record and registers nothing, and `createModule` validates what it creates as it validates any declaration.

| Helper | Creates |
| --- | --- |
| `createPropertyDeclaration(name, result, options)` | `{ name, kind: 'property', result }`, never writing the `parameters` or the `arguments` its options give |
| `createFunctionDeclaration(name, result, options)` | `{ name, kind: 'function', result, parameters }`, its `parameters` its options' and none where they give none, and its `arguments` its options' where it has parameters, `positional` where they give none, and left out where it has none; its `result` may be `undefined`, for a function its host invokes that supplies nothing |
| `createIndexerDeclaration(name, result, options)` | `{ name, kind: 'indexer', result, parameters }`, without a `name` where `name` is null, the type's unnamed indexer, its `parameters` its options', and never writing the `arguments` they give |
| `createValueParameterDeclaration(name, type, options)` | `{ name, kind: 'value', type, required, fixed: false, nulls: 'propagate' }`, `required` false where its options give a `default` and true otherwise, every key its options give written over these, and `selects` and `selector` left out where the parameter is not fixed |
| `createExpressionParameterDeclaration(type, options)` | `{ name: 'expression', kind: 'expression', type, context: 'item', required: true, fixed: false, nulls }`, `nulls` its options' `nulls` and `propagate` where they give none |
| `createPredicateParameterDeclaration()` | `{ name: 'expression', kind: 'predicate', type: 'Boolean', context: 'item', required: true, fixed: false, nulls: 'propagate' }` |
| `createFunctionParameterDeclaration(name, type, parameterTypes)` | `{ name, kind: 'function', type, parameterTypes, required: true }` |

A member helper takes no receiver, since where its declaration stands gives it one, and reads `impl`, `parameters`, `updates`, `arguments` and `invokedBy` from its options and nothing else: it writes `invokedBy`, `updates` and `impl` where they are given, `updates` never for `invokedBy: 'host'`, and leaves every other option out, `internal` among them.

<a id="what-a-member-declares-evaluation-contract"></a>
<a id="members-updates"></a>

### Updates

A member's evaluation contract is grouped under `updates`: how it reads, `reads`, as [how a member reads](#how-a-member-reads) sets out; how its result changes, `changes`, as [how a member changes](#how-a-member-changes) sets out; the changes it misses, `misses`; the `tolerance` it declares; and the `observations` that cover its changes, as [observations](observations.md#observations) set out. A host call is never evaluated, so a function the host invokes leaves `updates` out. A property declared directly in a structured type without `updates` contributes to its data shape and refuses `impl`; one with `updates` contributes nothing to that shape, its implementation optional for a resolution-only use; and one declared anywhere else requires them. They remain one member kind, `property`, read by the same access forms.

`changes` and `reads` are required: `changes` is `constant`, `observable`, `partly-observable`, `unobserved` or `derived`, the [categories](#how-a-member-changes) in order, and `reads` is `fresh`, `maintained`, `captured` or `derived`, the [readings](#how-a-member-reads) in order. `misses` is required where `changes` is `partly-observable`, and refused otherwise. `observations` are required where `changes` is `observable` or `partly-observable`, and refused otherwise, each observation checked for its type, what it observes and the arguments it gives.

<a id="what-a-member-declares-numeric-tolerance"></a>

### Numeric tolerance

A member may declare a tolerance for its numeric result and every number within a structured result, as `sensor.temperature` declares `0.5`. A result's [metadata](evaluation.md#runtime-results) carries it, and a host that compares results treats an absolute difference no greater than it as unchanged, and compares exactly where the member declares none. The rule applies regardless of the member's form. `tolerance` is taken by a member whose result is a `Number`, a `Number?` or a structured type, nullable or not, where it applies to every number the structure holds, and refused by any other, a list among them.

<a id="members-what-an-implementation-receives"></a>

### What an implementation receives

An `impl` is called with one object and takes what it needs from it by name, never by position, so none accepts what it ignores to reach what it reads, and a property added later moves nothing. A member's holds `receiver`, the value it is read from, which a module member has none of; `args`, the script's arguments by parameter name, `args` since strict mode refuses `arguments` as a name; and `env`, the environment the host supplies; and, for a member reading maintained values, `samples`, its observations' latest, in the order its declaration names them. A function the host invokes gives Nexo no implementation, and what its host invokes it with is the host's own. An observation type's holds the [`request`](observations.md#observations-types-the-request), `notify` and `env`, and an operator's `value` and `reject`. A property of a structured type's data shape has none, since Nexo reads it from the data, and the hooks `typeOf` and `isInstance` are given the value alone. The contract is JavaScript's alone, and no script is written differently for it.

<a id="how-a-member-reads"></a>

## How a member reads

A script is evaluated synchronously, without yielding, and a member's implementation is synchronous. Each member declares how it obtains its value:

| Reading | Meaning |
| --- | --- |
| Fresh | Read as the script evaluates, as `device.power` reads the power the device reports now. |
| Maintained | Kept by an observation the member holds, and read as that observation's latest sample, as `sensor.temperature` reads the last reading the `reading` observation kept. |
| Captured | Kept from what happened before as well as read from the state as it is, as `room.highestTemperature` keeps the highest temperature the room has reported since its host began to hold the evaluation. |
| Derived | As the items it selects and the expression it evaluates read, such as a list's `count` or `max`. |

Facts that must describe one measurement are properties of one structured value's data, which is captured once and read by each of them, as a `Climate`'s temperature and humidity are.

A maintained member's observation starts the first time an evaluation reads it, and the member is **pending** until its first sample arrives. An evaluation that reads a pending member reads it as null and tells its host it is pending, and a host that cannot wait for the sample fails the evaluation instead, by throwing from its `beforeInvoke`, as [a hook that throws](evaluation.md#runtime-evaluation) does. What the host throws is the host's own diagnostic, under a code of the host's own prefix where it carries one, and Nexo raises the evaluation's failure at that member, under [its code](../diagnostics-and-errors.md#evaluation-errors) for a throwing hook, with what the host threw as its cause; when a host waits for first samples is the host's to decide.

Evaluating a script is read-only for every vocabulary: what changes the host's state is a host call, which the evaluator never invokes.

A member whose result depends on what happened before, as well as on the state as it is, is captured: it keeps that history while its host holds the evaluation, as a host keeping a result current does, and documents what an evaluation once reports without it, as `room.highestTemperature` reports the temperature as it is, the only one it has seen.

<a id="how-a-member-changes"></a>

## How a member changes

Every member declares how its result changes, for a given receiver and arguments:

| Category | Meaning |
| --- | --- |
| Constant | The result never changes for the receiver and arguments, as a literal's or `room.name`. |
| Observable | The member names observations that cover every change to its result, as `device.power` names `state`. |
| Partly observable | The member names the observations it can make, and states the changes they miss, as `device.battery` misses the drain between the device's reports. |
| Unobserved | The member can be read, and does not name an observation, as `Home.now`. |
| Derived | The result changes as the items it selects and the expression it evaluates do, such as a list's `first` or `where`. |

The categories are facts a host reads: whether a host keeps a result current over an unobserved or a partly observable member is its own policy, which Nexo gives it the declarations a resolution uses to decide. A literal is constant, so a script that carries one changes only as its members do.
