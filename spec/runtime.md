# Runtime

<a id="runtime"></a>

The **runtime** is what carries a script out for a host: it reads the script's source into its definition, checks it, resolves it against a registry and evaluates it, reporting each read to the host. It is the contract a host builds on, and any implementation of Lexica offers it.

Three layers meet in every evaluation, and each owns its part:

| Layer | Owns | Specified in |
| --- | --- | --- |
| The language | What a script means: its syntax, its names and scope, its types, its expressions, and the contracts its vocabulary keeps | Every document of this specification but this one |
| The runtime | Carrying a script out: reading, resolving and evaluating it, its bindings and results, and what it reports to its host | This document |
| The host | The application around the runtime: which modules it registers, when it evaluates, what it does with each result, what it does with each host call, and anything that spans evaluations, as keeping a result current | The host's own specification |

A host uses the runtime in four steps: it binds its values, resolves the script against its registry, creates an evaluator, and evaluates it as often as it needs.

```js
const bindings = lexica.bind({ room: livingRoom });
const resolution = registry.resolve('{ name = room.name, total = room.devices.count }', bindings);
const evaluator = resolution.createEvaluator(bindings, env);
const { value, metadata } = evaluator.evaluate();
```

In this document:

1. [Bindings](#runtime-bindings)
2. [Resolution](#runtime-bindings-and-resolution)
3. [Evaluation](#runtime-evaluation)
4. [Results and their metadata](#runtime-results)
5. [Host calls](#runtime-host-calls)
6. [Versions](#runtime-versions)

<a id="runtime-bindings"></a>

## Bindings

`lexica.bind(values)` binds a host's values to a script's parameters by name. It copies and freezes their data recursively and keeps each reference value as it is, by its identity, a reference nested in data among them, neither copied nor frozen. It refuses an unsupported value and a cycle. How each binding is typed is set out in [script parameters and bindings](scripts.md#scripts-script-parameters).

A binding set has a **resolution key**: each binding's type, and each primitive binding's value, since a string a script reads can select what a member reads, as a bracket property access's name does.

<a id="runtime-bindings-and-resolution"></a>

## Resolution

`registry.resolve(source, bindings)` resolves a script: it reads its text with the registry's module names, or takes its definition, resolves every member against the registry, types the result and records what each member resolved to, without a host and without evaluating anything. A resolution answers its definition, its host call, null for a script that gives a value, its result type, null for a host call that declares no result, the type at any path of its result, the location of any of its nodes, and its **used declarations**, every declaration the script may use, one only an unreached branch uses included.

All branches and operands are validated even when evaluation will not reach them, so a host's policy over the used declarations, as whether it keeps a result current over a partly observable member, concerns them all before anything is evaluated.

<a id="validation-vocabulary-and-types"></a>

### What resolution checks

| Area | Required contract |
| --- | --- |
| Member resolution | Every member and extension exists and uses its declared form. |
| Arguments | Positional arguments match the signature's order and count; options use one object whose fields name the member's parameters; every required parameter is supplied. |
| Types and kinds | Receivers, arguments, expressions and bindings fit their declared types; each argument uses its declared argument kind. |
| Required access | Access written with `.` has a receiver that cannot be null. Other required access forms follow the same nullability rule. |
| Fixed arguments | Resolution settles each to a non-null string without evaluating a member, as [fixed arguments](members.md#arguments-fixed) set out. |
| Bracket property access | Resolution determines every possible property name; each names a property of the receiver and their types merge. |
| Local use | Each reference is in scope; a value local is used as a value, a function local as a call. |
| Casts | The target type is a reference type, and the operand can be of that type. |
| Conversions and attempts | The target type and conversion pair are valid; an attempt follows the same validation rules as its strict operation. |
| Equality | Operand types fit in at least one direction. Values other than strings, numbers, Booleans and reference values compare only with null. |
| Arithmetic and comparisons | Every operand is a non-null number. |
| Interpolation | Every interpolation gives a non-null string or number. |
| Function calls | The local or function parameter holds a function, never null; the argument count matches each function it may be, whose body resolves against that call's argument types, their results merging; no call reaches a function within its own call. |
| Conditions and logical operands | Each is a value. Truthiness determines the branch; a host call cannot be used as that value. |
| Coalescing | Value and fallback have compatible types. |
| Conditionals | Branch result types are compatible. |
| Implicit parameter | Each expression is valid with the implicit parameter its member declares. |
| Host calls | A host call is the script's terminal operation, and takes a result projection only where it declares a result; a fixed argument that selects a type names a key its selector maps. |
| Output | A result contains data alone. |

<a id="runtime-reuse"></a>

### Reusing a resolution

A resolution is reused with bindings of its resolution key, against its registry at the revision it was resolved at. Creating an evaluator refuses bindings of another key, and each evaluator entry point refuses a registry whose revision has moved, each with a structure error saying to resolve again, so an evaluator never evaluates a stale resolution.

<a id="runtime-evaluation"></a>

## Evaluation

The runtime evaluates a resolved script synchronously, for the host that asks. An evaluator holds one binding set and the **environment** the host owns, and evaluates as often as it is asked, one evaluation at a time, each given the hooks of a host that follows what it reads. The runtime carries the evaluation out and describes its result, and the host keeps everything that spans evaluations.

```js
const evaluator = resolution.createEvaluator(bindings, env);
const { value, metadata, isPending } = evaluator.evaluate({
    beforeInvoke(request) { /* note the read; answer a maintained member's samples */ },
    afterInvoke(request, value) { /* note the value read */ },
    afterEvaluation(outcome) { /* keep or close what the evaluation opened */ },
});
```

- **The evaluator** evaluates each node of the resolution, invokes each member's implementation with the [one object it receives](members.md#members-what-an-implementation-receives), its receiver, its arguments and the environment among them, checks the value it answers against the member's result type, and fails the evaluation at the member's location with an evaluation error where an implementation throws or answers a value not of that type.
- **The environment**, the host's `env`, is whatever the host gives the evaluator that does not belong in the script, which every evaluation of it uses, as a home's host gives the connection its members read the home through. The runtime passes it to every implementation and never reads it.
- **`beforeInvoke(request)`** is called before a member's implementation is invoked, with the request: the member's declaration, its receiver and arguments, and where it stands. It reports every invocation an evaluation attempts, whether it then succeeds, fails or is pending, so a host covers a read whose implementation throws. For a member that reads maintained values it answers their samples, or that one is pending, and a member whose sample is pending is not invoked and reads as null.
- **`afterInvoke(request, value)`** is called only after an implementation answered a value of its result type.
- **`afterEvaluation(outcome)`** is called once, in a `finally`, with the evaluation completed, pending where a sample it read was pending, or failed. The evaluation runs to one of the three synchronously, so none is cancelled while it runs.
- **What reaches the hooks.** Only the invocations an evaluation reaches call `beforeInvoke`, so short-circuited operands and unselected branches report nothing, and a function the script passes to a member keeps the member's invocation as its lifetime, closed before `afterEvaluation`.
- **Each evaluation its own.** An evaluation's state is its own unless its host shares it, so an evaluation an implementation starts is isolated from the one that called it, and evaluating an evaluator from within its own evaluation is refused.
- **A hook that throws.** A throwing `beforeInvoke` or `afterInvoke` fails the evaluation at that member. A throwing `afterEvaluation` after a failure leaves the original failure thrown, the cleanup failure recorded on it, and after a success fails the evaluation itself.
- **Without hooks.** A host with nothing to follow gives the environment alone, and an evaluation without a `beforeInvoke` reads fresh members alone, refusing a script that reads a maintained one.

<a id="runtime-results"></a>

## Results and their metadata

An evaluation answers its **value**, whether a member it read was **pending**, and its **metadata**, frozen throughout: the value, every list and structure in it, the metadata and the result that holds them. What an evaluation produced never changes, whatever the host's state does afterwards, and each result and its metadata stay valid after later evaluations. A result is data and holds no reference value, as [results](values.md#values-results) require.

The metadata describes the value, never part of it: frozen records of `{ origin, tolerance, fields?, items?, sources? }`.

- **Origins.** An origin is an opaque token for the expression that produced a value, the same token exactly where one expression of one resolution, with one candidate selected, produced both values. It lives as long as the resolution, and is comparable across every evaluation of the evaluators made from it, never across resolutions. The runtime follows locals, bodies, `do` blocks, function calls, object-root fields, the branch or operand a conditional, a coalescing, an `and` or an `or` selected, and the property a bracket property access selected.
- **Tolerance.** A value's tolerance is the one its producing member declares. An expression that selects part of an existing value takes that part's metadata, inherited where it is, so `{ let climate = room.climate, warmth = climate?.temperature }` keeps the tolerance `temperature` declares; an expression that computes a new value, as arithmetic does, has an origin of its own and no tolerance unless a member declares one. A part with no record of its own inherits its parent's, and a record's `tolerance: null` overrides an inherited one.
- **Fields and items.** `fields` holds the record of each field of an object an object expression built, by its name in the order written, and `items` the record of each item of a list a projection built.
- **Sources.** The record of a list a projection built holds `sources`, each item's input to that projection, before its fields are evaluated: a reference value as itself, its identity kept, a scalar, a structured value or another input as the evaluator holds it, and null where the input was null. A list no projection built has no `sources`, so a null source and absent sources stay apart. A source is no key: equal values and one reference can each stand more than once, and recording them promises neither uniqueness nor a correspondence between evaluations.

The runtime gives the facts, and a host its policy, as comparing one result with the next or patching a copy of it.

<a id="runtime-host-calls"></a>
<a id="runtime-requests"></a>

## Host calls

A script that ends in a [host call](members.md#members-host-calls) is resolved as any other, and its resolution answers the call: `resolution.hostCall`, its `name` and the `declaration` it resolved to, null while its receiver's type is unknown. The runtime prepares the call and projects each value its host supplies; invoking it, when and how often, and for how long what it starts runs, are the host's.

```js
const preparation = evaluator.prepareCall();

if (preparation.kind === 'prepared') {
    const brightness = await invokeHostCall(preparation.declaration, preparation.receiver, preparation.args);
    const { value } = evaluator.project(brightness);
}
```

- **`evaluator.prepareCall()`** evaluates the host call's receiver and arguments once, as `evaluate` evaluates a script without a host, and answers its **preparation**: `{ kind: 'prepared', declaration, receiver, args, location }`, the arguments by parameter name; or `{ kind: 'skipped', location }` where the receiver is null, an argument whose parameter propagates null is null, or the call has no declaration yet, so there is nothing to invoke. A skipped call is never invoked, and what its host answers for one is the host's to say. Preparing a script that gives a value is refused with an evaluation error.
- **`evaluator.project(value, host?)`** projects one value the host supplies: it checks the value against the call's declared `result` and takes it as the evaluator takes any member's answer, then evaluates the result projection against it, as `evaluate` evaluates a script for the host given, and answers as `evaluate` does. A host call followed by no result projection answers the value itself. A value of another type fails with an evaluation error naming the call, and projecting for a call that declares no result is refused.

A host projects each value as it arrives, once for a value its call answers once and once for each of several it supplies over time, so the runtime treats them alike. Waiting for samples, cancellation between evaluations, keeping a result current and scheduling it, and the lifetime of whatever a host call starts, are the host's.

<a id="runtime-versions"></a>

## Versions

A runtime says which it is, and what it follows, in `lexica.info.versions`, three versions that change apart:

| Field | What it is |
| --- | --- |
| `runtime` | The runtime release version, which its packages carry, as `1.0.0-alpha.37`; its sources and every build of them report the same |
| `language` | The language specification version the runtime follows |
| `definition` | The definition format version the runtime supports |

Each is declared, never computed, and advances for its own reason: the runtime's version with each release of the runtime, the specification version as the language's contract changes, and the definition version as the serialized definition's does. Their numbers may coincide, and neither determines another, so one specification version is followed by many runtime releases, and a specification can describe a version ahead of the one a runtime follows.
