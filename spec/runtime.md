# Host contract

<a id="runtime"></a>

An **implementation** of Lexica carries the language's rules out for a host: its parser reads a script's source into its definition and validates its structure, its resolver resolves it against a registry, and its **runtime** evaluates it, reporting each read to the host. This document specifies the contract a host builds on, which every implementation of Lexica offers.

Three layers meet in every evaluation, and each owns its part:

| Layer | Owns | Specified in |
| --- | --- | --- |
| The language | The rules of what a script means: its syntax, its names and scope, its types, its expressions, and the contracts its vocabulary keeps | Every document of this specification but this one |
| The implementation | Carrying those rules out for a host: its parser reads a script, its resolver resolves it against a registry, and its runtime evaluates it, holding its bindings, describing its results and reporting to its host | This document |
| The host | The application around the implementation: which modules it registers, when it evaluates, what it does with each result, what it does with each host call, and anything that spans evaluations, as keeping a result current | The host's own specification |

A host uses an implementation in four steps: it binds its values, resolves the script against its registry, creates an evaluator, and evaluates it as often as it needs.

```js
const bindings = registry.createBindings({ room: livingRoom });
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

`registry.createBindings(values, options)` binds a host's values to a script's parameters by name, against the registry, since its modules' `typeOf` decide which values are references: it asks them of each value before copying it, keeps each reference value as it is, by its identity, a reference nested in data among them, neither copied nor frozen, and copies and freezes the rest of the data recursively. It refuses an unsupported value and a cycle. How each binding is typed is set out in [script parameters and bindings](scripts.md#scripts-script-parameters).

- **Declared types.** `options.types` declares the reference type of a top-level binding by its name, unqualified or qualified, as `registry.createBindings({ device }, { types: { device: 'Device' } })` and `{ device: 'Home.Device' }` bind a light as a `Device`. The name resolves against the registry when the binding is made, never a script's imports, as [type identity](types.md#types-type-identity) sets out, and the binding keeps the type it resolved to; the value must belong to the type, and no `typeOf` is asked for it, as [a declared type](types.md#reference-types) sets out. No other binding, and no value nested in one, takes a declared type.
- **Captured once.** A binding set captures its values and their types when it is made. Registering a module afterwards invalidates the registry's resolutions, which a host resolves again, and leaves a binding set as it was: its values and their types stay those it captured, and a binding set made afterwards uses the registry's recognition as it then is.
- **Its registry.** A binding set is the registry's that made it, and resolving or evaluating against another registry is refused, saying to bind with that one. Plain values given to `registry.resolve` or to an evaluator are bound by that registry, as `registry.createBindings` binds them.
- **What it answers.** It answers whether it holds a binding of a name, `has`, the value, `readValue`, and the type, `getType`, of each, and its resolution key, as soon as it is made.

A binding set has a **resolution key**: each binding's type, and each primitive binding's value, since a string a script reads can select what a member reads, as a computed property access's name does.

<a id="runtime-bindings-and-resolution"></a>

## Resolution

`registry.resolve(script, bindings, options)` resolves a script: it reads its text as `registry.parse` does, with the imports `options.imports` supplies, or takes its definition, which records its imports, resolves every member against Lexica's own module and the modules the script imports, types the result and records what each member resolved to, without a host and without evaluating anything. A resolution answers its definition, its host call, null for a script that gives a value, its result type, null for a host call that declares no result, the type at any path of its result, the location of any of its nodes, its **used declarations**, every declaration it has selected, one only an unreached branch uses included; its **deferred accesses**, each access whose member is selected during evaluation, as [deferred member selection](types.md#types-any-deferred-selection) sets out, by its location and the name it accesses; and, asked for them, its **candidate declarations**, a conservative analysis that includes every declaration evaluation could select for a deferred access through the lookup rules, inherited members and visible extensions among them, and reports itself as an overestimate. Where a deferred access remains, the used declarations are never presented as everything an evaluation might use.

All branches and operands are validated even when evaluation will not reach them, so a host's policy over the used declarations, as whether it keeps a result current over a partly observable member, concerns them all before anything is evaluated. A host that needs every declaration before evaluation either requires a script without deferred accesses, its receivers known or its extensions selected explicitly, or reads the candidate declarations and accepts their overestimate.

<a id="validation-vocabulary-and-types"></a>

### What resolution checks

Resolution's checks are its semantic validation, each failure a `validation` error; a definition's structure is validated before them, as [structural validation](definition.md#validation) sets out, its failures `structure` errors.

| Area | Required contract |
| --- | --- |
| Member resolution | Every member exists and uses its declared form, every extension an access selects is one and declares the member, and an access on a value of `Any` is checked when that value is evaluated. |
| Arguments | Positional arguments match the signature's order and count; options use one object whose object fields name the member's parameters; every required parameter is supplied. |
| Types and kinds | Receivers, arguments, expressions and bindings fit their declared types; each argument uses its declared argument kind. |
| Required access | Access written with `.` has a receiver that cannot be null. Other required access forms follow the same nullability rule. |
| Fixed arguments | Resolution settles each to a non-null string without evaluating a member, as [fixed arguments](members.md#arguments-fixed) set out. |
| Computed property access | Resolution determines every possible property name; each names a property of the receiver and their types merge. |
| Local use | Each reference is in scope; a value local is used as a value, a function local as a call. |
| Casts | The target type is a reference type, and the operand can be of that type. |
| Conversions and attempts | The target type and conversion pair are valid; an attempt follows the same validation rules as its strict operation. |
| Equality | Operand types fit in at least one direction. Values other than strings, numbers, Booleans and reference values compare only with null. |
| Arithmetic and comparisons | Every operand is a non-null number. |
| Interpolation | Every interpolation gives a non-null string or number. |
| Function arguments | Each is a delegate, a function reference's among them, or an implicit body, whose argument types and result fit its parameter's callback contract; a function reference names one declaration. |
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

- **The evaluator** evaluates each node of the resolution, invokes each member's implementation with the [one object it receives](members.md#members-what-an-implementation-receives), its receiver, its arguments and the environment among them, checks the value it answers against the member's result type, and fails the evaluation at the member's location with an evaluation error where an implementation throws or answers a value not of that type. An implementation that throws fails unexpectedly: Lexica's error carries its own code, kind, message and the member's location, and its `cause` is exactly what the implementation threw, unchanged, any code on it kept and never copied, as a [hook that throws](#runtime-evaluation) does; a rejection a contract defines, as a conversion's or a cast's `reject`, keeps the handling its contract specifies.
- **The environment**, the host's `env`, is whatever the host gives the evaluator that does not belong in the script, which every evaluation of it uses, as a home's host gives the connection its members read the home through. The runtime passes it to every implementation and never reads it.
- **`beforeInvoke(request)`** is called before a member's implementation is invoked, with the request: the member's declaration, its receiver and arguments, where it stands in the definition, a JSON Pointer `getLocation` expands, a call within a script function's body naming the part of the body it is whichever call of the function reached it, and `deferred`, true where the member was selected during evaluation, which a host refuses by throwing before anything is invoked, a property's getter included. It reports every invocation an evaluation attempts, whether it then succeeds, fails or is pending, so a host covers a read whose implementation throws. For a member that reads maintained values it answers their samples, or that one is pending, and a member whose sample is pending is not invoked and reads as null.
- **`afterInvoke(request, value)`** is called only after an implementation answered a value of its result type.
- **`afterEvaluation(outcome)`** is called once, in a `finally`, with the evaluation completed, pending where a sample it read was pending, or failed. The evaluation runs to one of the three synchronously, so none is cancelled while it runs.
- **What reaches the hooks.** Only the invocations an evaluation reaches call `beforeInvoke`, so short-circuited operands and unselected branches report nothing, and every function a member is given, an expression or a predicate argument among them, keeps the member's invocation as its lifetime, closed before `afterEvaluation`.
- **Each evaluation its own.** An evaluation's state is its own unless its host shares it, so an evaluation an implementation starts is isolated from the one that called it, and evaluating an evaluator from within its own evaluation is refused.
- **A hook that throws.** A throwing `beforeInvoke` or `afterInvoke` fails the evaluation at that member with an evaluation error of Lexica's own: its code, its kind, its message and the location of the invocation that failed are Lexica's, and its `cause` is exactly what the hook threw, an `Error` or any other value, unchanged. A code the thrown value carries stays on it: Lexica neither replaces it nor copies it into its own, and a thrown value may carry none. An error Lexica has raised for a failure is never wrapped again as it propagates. A `LexicaError` a host builds isn't one Lexica raised: thrown from an implementation, a hook or a conversion, it is wrapped as any thrown value is, and becomes the `cause`. A throwing `afterEvaluation` after a failure leaves the original failure thrown, the cleanup failure recorded on it, and after a success fails the evaluation itself, as a throwing hook does.
- **Without hooks.** A host with nothing to follow gives the environment alone, and an evaluation without a `beforeInvoke` reads fresh members alone, refusing a script that reads a maintained one.

<a id="runtime-results"></a>

## Results and their metadata

An evaluation answers its **value**, whether a member it read was **pending**, and its **metadata**, frozen throughout: the value, every list and structure in it, the metadata and the result that holds them, all but the host objects its sources hold, which Lexica never freezes. What an evaluation produced never changes, whatever the host's state does afterwards, but for those host objects, which stay the host's own, and each result and its metadata stay valid after later evaluations. A result is data and does not hold a reference value, as [results](values.md#values-results) require.

The metadata describes the value, never part of it: frozen records of `{ origin, tolerance, objectFields?, items?, sources? }`.

- **Origins.** An origin is an opaque token for the expression that produced a value, the same token exactly where one expression of one resolution, with one candidate selected, produced both values. It lives as long as the resolution, and is comparable across every evaluation of the evaluators made from it, never across resolutions. The runtime follows locals, bodies, `do` blocks, function calls, the object root's fields, the branch or operand a conditional, a coalescing, an `and` or an `or` selected, and the property a computed property access selected.
- **Tolerance.** A value's tolerance is the one its producing member declares. An expression that selects part of an existing value takes that part's metadata, inherited where it is, so `{ let climate = room.climate, warmth = climate?.temperature }` keeps the tolerance `temperature` declares; an expression that computes a new value, as arithmetic does, has an origin of its own and no tolerance unless a member declares one. A part with no record of its own inherits its parent's, and a record's `tolerance: null` overrides an inherited one.
- **Object fields and items.** `objectFields` holds the record of each object field of an object an object expression built, by its name in the order written, and `items` the record of each item of a list a projection built.
- **Sources.** The record of a list a projection built holds `sources`, one entry for each item: `sources[i]` describes the input that made item `i`, before its object fields are evaluated, a null input included.

  | Entry | Its input | Its `value` |
  | --- | --- | --- |
  | `{ kind: 'reference', value }` | A reference value | The host's object as held, its identity kept, never frozen, copied or otherwise changed by being recorded, so it may change afterwards |
  | `{ kind: 'data', value }` | A scalar, a structured value or any other data | Lexica's own frozen copy, as the evaluator holds it, which never changes |
  | `{ kind: 'null' }` | Null | None |

  An entry's kind follows its input's established type, a value carried through `Any` included, never a check of the value itself. The array and its entries are frozen, and nothing beneath a reference's `value`. A list no projection built has no `sources` property at all, the one way metadata says no sources were recorded, so a null source and absent sources stay apart, and a projection of no items records `sources: []`. Lexica reports each source's kind and identity, and a host decides how it matches by them. A source is not a key: equal values and one reference can each stand more than once, and recording them promises neither uniqueness nor a correspondence between evaluations.

The runtime gives the facts, and a host its policy, as comparing one result with the next or patching a copy of it.

<a id="runtime-host-calls"></a>
<a id="runtime-requests"></a>

## Host calls

A script that ends in a [host call](members.md#members-host-calls) is resolved as any other, and its resolution answers the call: `resolution.hostCall`, its `name` and the `declaration` it resolved to, null while its receiver's type is unknown. The runtime prepares the call and projects each value its host supplies; invoking it, when and how often, and for how long what it starts runs, are the host's. Such a script is prepared, never evaluated: `evaluate` refuses a script that ends in a host call, and `prepareHostCall` one that gives a value, each with an [evaluation error](diagnostics-and-errors.md#evaluation-errors).

```js
const call = evaluator.prepareHostCall();

if (call.kind === 'prepared') {
    const brightness = await invokeHostCall(call.declaration, call.receiver, call.args);
    const { value } = call.project(brightness);
}
```

- **`evaluator.prepareHostCall()`** evaluates the locals the script declares before the host call, then the call's receiver and arguments, once, without hooks, as `evaluate` given none evaluates a script, and answers a **prepared call**, `{ kind: 'prepared', declaration, receiver, args, pointer }`, the arguments by parameter name and the call named by its definition pointer, as a hook's request names one; or a **skipped call**, `{ kind: 'skipped', pointer }`, where the receiver is null, an argument whose parameter propagates null is null, or the call has no declaration yet, so there is nothing to invoke and nothing to project. A skipped call is never invoked, and what its host answers for one is the host's to say. Preparing a script that gives a value is refused with an evaluation error. An evaluator prepares its call as often as it is asked, and each prepared call is its own, so the prepared calls of one evaluator coexist without affecting one another.
- **`call.project(value, hooks?)`** projects one value the host supplies for the prepared call: it captures the value as the call's declared `result`, as [capturing a supplied value](#runtime-host-calls-capturing) sets out, then evaluates the result projection against it, as `evaluate` evaluates a script with the hooks given, and answers as `evaluate` does, with the value, whether a member it read was pending, and the metadata. A host call followed by no result projection answers the captured value itself in that shape. A call that declares no `result` supplies nothing to project, so its prepared call has no `project`.

<a id="runtime-host-calls-capturing"></a>

**Capturing a supplied value.** A host supplies its values from outside the script, and `project` captures each as the type its call declares before the result projection reads it, at every level of it: the value itself, each property of a structure's data shape, a structure nested in one of them, and each item of a list.

| What is supplied | What is captured |
| --- | --- |
| Nothing, a property missing or `undefined` among them | Null where its type is nullable; the projection fails where it is not |
| Null | Null where its type is nullable; the projection fails where it is not |
| A value its type admits | The value, a structure as its data shape alone, and a list item by item |
| A reference of another type, where a nullable reference type is declared | Null, so the value keeps only the reference its type names, as a `Light?` property holding a thermostat is null |
| Any other value, data its type does not admit among them | The projection fails with an evaluation error naming the call and the part of the value |

A list never holds a missing item. Narrowing a reference is the one thing capturing turns into null, so mistyped data fails whatever its type's nullability. A supplied value has no type of its own until it is captured, so where it fails its declared type's membership, the registry's `typeOf` tells a reference of another type from mistyped data, as it recognizes a binding. A member's answer is never captured: its implementation answers what its member declares.

A projection reads what the call was prepared with, and evaluates the rest anew:

- **The locals before the call.** Each local the script declares before the host call is evaluated once, by `prepareHostCall`, as every local is, and each projection of that prepared call reads the value it was prepared with, never running its initializer again. A local holding a reference holds the reference, and one holding a computed value holds the value. In the example, each projection reads `room.occupied()` of the room the call was prepared with, as that room is when the motion arrives, while `occupied` keeps whether it was occupied when the call was prepared. Both read one receiver, since reading `sensor.room` again could find another room, a sensor being movable.
- **Its own evaluation.** Each projection is an evaluation of its own, with its own supplied value, host and state; the result projection's own locals are evaluated in each, and projecting a value for one prepared call never changes what another was prepared with.
- **Delegates.** A delegate a local before the call holds is called in any projection, as a delegate is anywhere within the script; a callback a projection gives a member lasts while that member's invocation does, as every callback given to a member does. A host call's arguments are values, so no delegate reaches the host.

```lexica
let room = sensor.room
let occupied = room.occupied()
return sensor.on("motion") { at = it.at, isOccupied = room.occupied(), wasOccupied = occupied }
```

Lexica requires no disposal of a prepared call, which starts nothing; the lifetime of whatever its host starts is the host's. A prepared call holds the locals and the references it was prepared with for as long as it is reachable. Each projection goes through the checks every evaluation does, the refusal of a registry that has moved since the resolution among them.

A host projects each value as it arrives, once for a value its call answers once and once for each of several it supplies over time, so the runtime treats them alike. Waiting for samples, cancellation between evaluations, keeping a result current and scheduling it, and the lifetime of whatever a host call starts, are the host's.

<a id="runtime-versions"></a>

## Versions

An implementation says which it is, and what it follows, in `lexica.info.versions`, three versions that change apart:

| Property | What it is |
| --- | --- |
| `implementation` | The implementation's release version, which its packages carry, as `1.0.0-alpha.37`; its sources and every build of them report the same |
| `language` | The language specification version the implementation follows |
| `definition` | The definition format version the implementation supports |

Each is declared, never computed, and advances for its own reason: the implementation's version with each of its releases, the specification version as the language's contract changes, and the definition version as the serialized definition's does. Their numbers may coincide, and neither determines another, so one specification version is followed by many releases of an implementation, and a specification can describe a version ahead of the one an implementation follows.
