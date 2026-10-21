# Members

<a id="members"></a>

A **member** is what a module declares on a type, or on no type for a [module member](modules.md#namespaces-module-members): a property or a function. A script reaches a member through its receiver, and the member's declaration says how the member is written, what it takes, what it answers, who invokes it, how it reads and how its value changes. Lexica checks every use of a member against its declaration before anything runs.

```lexica
room.devices.count                    // A property, then another: the room's devices, counted.
room.device("lamp")?.battery          // A function, then a property of what it found, if anything.
device:setting["mode"]                // A named indexer, given its key.
light.dim({ to = 40 })                // A function the host invokes, given its options.
sensor.on("motion") { at = it.at }    // A function the host invokes, each value it supplies shaped by the object after it.
```

In this document:

1. [Member kinds and host calls](#members-member-kinds-and-host-calls)
2. [Writing a member](#property-access-calls-and-indexers)
3. [Bracket property access](#bracket-property-access)
4. [Parameters and arguments](#arguments)
5. [Declaring a member](#members-declaring-a-member)
6. [How a member reads](#how-a-member-reads)
7. [How a member changes](#how-a-member-changes)
8. [Host calls](#members-host-calls)

<a id="members-member-kinds-and-host-calls"></a>
<a id="members-member-kinds-and-requests"></a>
<a id="what-a-member-declares"></a>
<a id="requests"></a>

## Member kinds and host calls

A member's kind is `property` or `function`. A property is read, and a function called, by the evaluator as it evaluates a script, or, for a function whose declaration says so, `invokedBy: 'host'`, by the host. A script gives a value, or ends in a **host call**, a call of a function the host invokes; the last member of its chain, before any object expression following it, decides which:

| A script whose chain ends in | Gives |
| --- | --- |
| A property, a function the evaluator invokes, or no member | A value: it reads, and answers data |
| A function the host invokes | A host call: Lexica prepares its receiver and arguments, the host invokes it, and the object expression following it shapes each value the host supplies |

Evaluating a script only reads, and the evaluator never invokes a host call, so no evaluation changes the host's state. What a host call does, and when, is the host's own; Lexica's part is set out in [host calls](#members-host-calls) and the [runtime](runtime.md#runtime-host-calls).

<a id="property-access-calls-and-indexers"></a>
<a id="access-and-calls"></a>

## Writing a member

Property access, function calls and indexers are distinct constructs. A member's declaration says which form it takes.

| Construct | Required form | Optional form | Example |
| --- | --- | --- | --- |
| Dot property access | `receiver.property` | `receiver?.property` | `room.devices.count` |
| Bracket property access | `receiver[name]` | `receiver?[name]` | `device[name]` |
| Function call | `receiver.function(…)` | `receiver?.function(…)` | `room.device("lamp")` |
| Named indexer | `receiver:indexer[key]` | `receiver?:indexer[key]` | `device:setting["mode"]` |
| Default indexer | `receiver:[key]` | `receiver?:[key]` | `device:["mode"]` |

```lexica
room.devices.count                                // A dot property access.
room.device("lamp")?.battery                      // A function call, then optional access.
device:setting["mode"]                            // A named indexer.
rooms:item[0]                                     // Another named indexer, a list's.
room.device("lamp")?.is("active") ?? false
```

<a id="property-access-calls-and-indexers-property-access"></a>

### Property access

A dot property access reads a property and takes no arguments. Whitespace cannot replace the dot: `it climate temperature` is an error suggesting `it.climate`.

Bracket property access chooses a property by name. It follows the same member contract as dot access; see [Bracket property access](#bracket-property-access).

<a id="names-and-resolution-explicit-receivers"></a>

### Explicit receivers

Members always have an explicit receiver. Writing a member without its receiver is an error. If the implicit parameter has that member, the diagnostic suggests the form with `it`:

| Written | Suggested form |
| --- | --- |
| `climate.temperature` | `it.climate` |
| `device("lamp")` | `it.device(…)` |

An equality without its left operand is an error as well; write both values, for example `it == null`.

<a id="property-access-calls-and-indexers-required-access-and-optional-chains"></a>
<a id="nullability-receiver-nullability"></a>

### Required access and optional chains

Required access needs a receiver whose type cannot be null. A nullable receiver is a validation error that suggests optional access: `room.device(name).battery` is a validation error, since `device` answers a `device?`.

Optional access reads or invokes the member only when its receiver is not null. Otherwise it answers null and skips the remainder of that chain, including argument or key evaluation. `room.device(name)?.battery` answers null without invoking `battery` where the room has no device of that name; its type is `number?`, since an optional chain is nullable where an optional access of it can meet null. A member written with `?.` or `?:`, a predicate among them, answers null for a null receiver, so `room.device(name)?.is("active")` is a `boolean?` that is null where there is no such device.

For example, `room.device(name)?.room.devices.count` answers null when the room has no device of that name. Otherwise `.count` counts the devices of the device's room.

A group ends the optional chain. In `(room.device(name)?.room.devices).count`, `.count` receives a `list<device>?`, so this is a validation error.

Optional access is also valid on a receiver whose current type cannot be null. A parameter typed by one binding may be nullable under another.

<a id="property-access-calls-and-indexers-optional-enclosed-access"></a>

### Optional enclosed access

`(? … )` makes every member access in its enclosed member chain optional:

| Written | Equivalent accesses |
| --- | --- |
| `(?room.device(name).room.climate.temperature)` | `room?.device(name)?.room?.climate?.temperature` |
| `(?(room.device(name) as "light").brightness)` | `(room?.device(name) as "light")?.brightness` |
| `(?((a.x ?? b) as "light").brightness)` | `((a.x ?? b) as "light")?.brightness` |

The enclosed form requires a receiver followed by at least one property access, function call or indexer. Its receiver is an input, `it`, a script parameter, `root`, a namespace's member, a literal, an interpolated string, a local, a local function's call or an object expression, or a grouped cast.

Accesses in a grouped cast's target also become optional. A coalescing target in parentheses, an already optional enclosed target, call arguments, indexer keys and bracket property names retain their own rules.

An optional enclosed access written directly as a call's argument is a syntax error, since `(?` is one token: the call writes it in parentheses of its own, `.device((?…))`.

The closing parenthesis ends the enclosed optional chain. `(?x.y.z)?.a.b` is `(x?.y?.z)?.a.b`; `.b` still requires a non-null `a`.

A projection or any other expression beyond that member chain is a syntax error. The definition records the individual accesses as optional, and the [canonical text](definition.md#definition-canonical-text) writes `?.`, `?[` and `?:` rather than the enclosed shorthand.

<a id="property-access-calls-and-indexers-calls"></a>

### Function calls

A function call takes zero or more positional arguments inside parentheses, separated by commas. Each argument is a [simple expression](expressions.md#simple-expressions). The chain may continue after the call. Every member written with arguments in parentheses is written as a function call, whoever invokes it.

Argument count and types come from the signature. `room.device("lamp", "fan")` is a validation error because `device` takes one argument.

Calls do not accept named arguments. `room.device(name = "lamp")` is a syntax error suggesting an options object. A member declared with options takes one object, for example `light.dim({ to = 40 })`.

<a id="property-access-calls-and-indexers-named-indexers"></a>

### Named indexers

A named indexer takes one key, written in brackets after the colon and name. The key is a [simple expression](expressions.md#simple-expressions).

| Form | Meaning |
| --- | --- |
| `device:setting["mode"]` | Invoke `setting` with one key |
| `device:setting[name]` | Compute the key and invoke `setting` |
| `x:lookup["a"]["b"]` | Invoke `lookup`, then read property `b` of its result |
| `room.climate?["temperature"]` | Read property `temperature` of `climate` |

The indexer's brackets are required. `device:setting`, `device:setting[]` and `device:setting["a", "b"]` are syntax errors.

`?:` is the optional form. For a null receiver it answers null without evaluating the key.

A colon after a complete value can only begin an indexer. In `{ mode = it:setting["mode"] }`, the `=` introduces the field value, and the colon invokes its indexer.

<a id="property-access-calls-and-indexers-default-indexers"></a>

### Default indexers

Omitting the indexer name selects the receiver type's default indexer, a named indexer its module designates as the default:

| Form | Equivalent named indexer |
| --- | --- |
| `it:["mode"]` on a device | `it:setting["mode"]` |
| `list:[2]` | `list:item[2]`, the third item |

`?:[…]` is the optional form. A module designates at most one default indexer for a receiver type, and [which designation applies](modules.md#namespaces-indexers) follows the type's owner. If none applies, resolution fails with a validation error asking for an indexer name.

<a id="property-access-calls-and-indexers-member-form-and-parsing"></a>

### Member form and parsing

A property must be read as a property. A function uses a function call, and only a function the evaluator invokes can be declared an indexer, which is invoked as one.

Using another form is a validation error that gives the required form:

> 'setting' is an indexer: write 'it:setting[…]'

The text alone determines construct boundaries. Parsing does not consult the vocabulary or the number of parameters a member declares; a namespace is recognized by the module names the text is read with, as [module names in text](modules.md#names-and-reserved-words-module-names) sets out.

<a id="bracket-property-access"></a>

## Bracket property access

Bracket property access chooses a property by name. `it["climate"]` and `it.climate` resolve the same member, with the same implementation, type, null behavior and observations.

```lexica
device {
    let name = if metered then "power" else "battery" end,

    reading = it["power"],
    chosen = it[name],
    named = it[property ?? "power"]
}
```

<a id="bracket-property-access-determining-possible-names"></a>

### Determining possible names

Resolution must determine every property name the expression can produce, since the name selects a declaration and its result type. Only these forms participate, recursively:

| Form | Names considered |
| --- | --- |
| String literal | That string |
| `null` | No string name; null must be removed before the final result |
| Script parameter | The value its binding gives |
| Local | Names determined from its value |
| Conditional binding | Names determined from its value's truthy part, without null or false |
| Conditional | Names from its possible branches |
| Coalescing | Its value's names, plus the fallback's if the value may be null |
| `and` | Falsey parts of operands before the last, plus the last operand's values |
| `or` | Truthy parts of operands before the last, plus the last operand's values |

A fixed test or operand can decide the selection during resolution. An unreached branch, fallback or operand contributes no names. A test decided only at evaluation leaves both branches' names possible; evaluation reads the selected property.

Every branch, fallback and operand is still validated for syntax and types. In `it["power" ?? it:["x"]]`, only `power` needs name resolution; the fallback is neither evaluated nor read.

A bracket property access is refused where an outcome can be null or false or names no property; a binding is typed by its value, so `device[name]` is a validation error where `name` is bound to null.

<a id="bracket-property-access-name-expression-types"></a>

### Name expression types

The complete expression must produce a string. Null is allowed within it only where removed, as `property ?? "power"` removes a null binding. A possible false or other non-string value is a validation error.

Logical expressions participate only when their types fit. `it[metered and "power" or "battery"]` can select either string when its fixed operands settle it.

The falsey part can also be known from a nullable non-Boolean operand: `it.room.device("lamp") and "power"` gives null or a name. The final bracket expression must still remove the possible null.

`it[it.is("active") and "power" or "battery"]` is refused because no type holds both false and a string. Write the choice as a conditional:

`it[if it.is("active") then "power" else "battery" end]`.

An expression outside the permitted forms, such as `it[it:["mode"]]`, is a validation error saying its names cannot be determined.

<a id="bracket-property-access-validation-and-result-type"></a>

### Validation and result type

Every possible name must be a property of the receiver. Their result types must merge as conditional branches do. In the example above, `it[name]` is a `number?`.

A resolution is kept for the strings the current bindings supply. Binding another string to a name requires resolving again.

<a id="bracket-property-access-evaluation-and-observation"></a>

### Evaluating a bracket property access

The name is computed once, then the selected property is read. `[…]` requires a non-null receiver. `?[…]` answers null for a null receiver without evaluating the name.

For an unknown receiver type, resolution still determines the possible names. Whether each names a property is checked when the receiver type becomes known.

An evaluation reads both what computing the name reads and the selected property, and a later evaluation may select another property where what computes the name changed.

<a id="bracket-property-access-one-property-at-a-time"></a>

### One property at a time

A name selects one property. `it["climate.temperature"]` does not follow a path. Functions require function calls; numeric list indexing uses the default indexer, `list:[2]`.

A field is always named, as in `reading = it["power"]`.

When the name is a string literal that is a Lexica name, its definition is the same as dot access: `it["power"]` has the definition of `it.power`.

<a id="arguments"></a>

## Parameters and arguments

A member declares its **parameters**, and a script gives it **arguments**. A function call takes its arguments by position, none or several, and an indexer its one key, each a simple expression; the member's declaration states the form those arguments take, its **argument form**, positional or options. A member *has parameters* where it declares one or more, an optional one included.

<a id="arguments-positional"></a>

### Positional arguments

The arguments supply the member's parameters in order, as `"lamp"` supplies the name in `room.device("lamp")` and `"mode"` the name in `device:setting["mode"]`. An indexer's one argument is its bracketed key, so its form is positional.

Its required parameters come before its optional ones, so the parameters left out are the last: a required one must be given, a missing optional one takes its default, and more arguments than it has parameters is a validation error, `'device' takes one argument, and is given 2`, which for a member with optional parameters says how many it takes at most, `'…' takes at most 2 arguments, and is given 3`.

<a id="arguments-options"></a>

### Options

The one argument is an object expression written in place, whose fields supply the member's parameters by name, as `{ target = 21, until = home.now + 3600 }` does for `hold`.

Each field follows its parameter's rules; a field the member has no parameter for is a validation error naming those it has, a required parameter must be given, and a missing optional one takes its default. Where every parameter is optional, the argument can be left out, as in `light.dim()`, and a second argument is a validation error.

An object means options only by its member's argument form: the object a positional member is given is its parameter's value.

An options object follows the ordinary rules of an object expression. Its options are evaluated once each, in the order they are written, whatever order the member declares its parameters in. Each written option is in scope by its name after its initializer, as [a field is](values.md#locals-fields-as-names), so in `thermostat.hold({ target = 21, until = if target > 20 then home.now + 3600 else null end })` the `until` option reads the `target` written before it. Where no object expression encloses it, an options object builds the [object root](values.md#locals-the-object-root), each option a field of it after its initializer, of the value and type it was given, a reference value included; inside one, `root` keeps the enclosing object root, whose fields the options never join. A default the member supplies introduces no name and no field. An option the member declares as an expression or a predicate is evaluated by the member, against the implicit parameter it supplies, with the names and the object root of the place it is written; it has no single value, so reading it by its name or through `root` after its initializer is a validation error, which no enclosing name of its spelling escapes.

<a id="arguments-kinds"></a>

### Argument kinds

Every parameter of a member is declared as one of four kinds, and the evaluator treats them differently; a parameter an options object supplies is the same.

- A **value argument** is evaluated once, where the call is written, against the same implicit parameter as the chain it appears in, so its `it` is that implicit parameter. In `room { own = it.device(it.name) }`, the argument's `it.name` is the room's name, not a device's. At the top level, where there is no implicit parameter, a value argument starts from a script parameter, `root`, a namespace's member, a local, a literal, an object expression or another input: `room.device(name)`.
- An **expression argument** is evaluated by the member against each item of the list the member follows, which is its `it`. In `room.devices.max(it.power)`, `it` is each device. Lexica's own module's expression parameters are those of `max`, `min` and `sum`.
- A **predicate argument** is an expression argument of any value, and the member receives its truthiness, a Boolean, for each item it evaluates it against: in `room.devices.where(it:["mode"])`, the device's setting is truthy wherever it is present, empty or not. Lexica's own module's predicate parameter is that of `where`.
- A **function argument** is a function value, an arrow function written as the argument or a function passed by its name, which the member calls with arguments of the types its **callback contract** declares, taking a result of the contract's result type. Resolution checks each function the value may be against the contract, and evaluation checks the member's arguments and the function's result. The member calls it only while its own invocation lasts, and a call after that fails. Lexica's own module has no function parameters, so `where`, `max`, `min` and `sum` take expression arguments, and an arrow function given to one is a validation error saying its parameter takes an expression argument, as `room.devices.where(it.is("active"))` is written instead; a module declares them.

Because the kind is part of the signature, resolution validates every kind before evaluation, and evaluation reports the reads of value, expression, predicate and function arguments.

<a id="nullability-a-null-argument-follows-the-parameter"></a>

### Null arguments

A parameter is declared either to propagate null, which is the default and makes the call answer null without running, or to accept null with a meaning of its own, as `hold` accepts a null `until` to mean until it is disposed. Resolution never rejects an evaluated argument for being nullable; it rejects a type that cannot match.

Optional and nullable are separate. An optional parameter can be omitted; a nullable parameter can receive null. Unless a member's declaration marks a parameter optional, it is required. Omitting a required argument is a validation error, and supplying null follows the parameter's null policy.

<a id="arguments-fixed"></a>
<a id="bodies-fixed-arguments"></a>

### Fixed arguments

A value argument can be declared **fixed**, where it selects something validation needs before evaluation, such as the type a [type selector](vocabulary.md#vocabulary-type-selectors) maps it to, as `on`'s does, or the predicate a verb asks. A fixed argument names a declaration, which cannot be looked up from null, so it must resolve to a non-null string during resolution.

A fixed argument is a string the script's resolution settles, without evaluating any member or depending on a value its host supplies: a literal, a script parameter, a local or a conditional binding holding one, a local holding a `do` block whose locals and result all settle, a function parameter within a call's body, which is resolved with its arguments, and an `and`, an `or`, a conditional or a coalescing operator whose result they settle by the rules that evaluate it everywhere, as `device { let state = "active", lit = it.is(state) }` and `device.is(metered and "active" or "offline")` are. A fixed argument whose outcome can be null or names no declaration is refused, so `sensor.on(name)` is a validation error where `name` is bound to null.

A local holding a `do` block settles a fixed argument only if every local evaluated in that block and its result can settle it, since reads made by unused body locals cannot be discarded. `let state = do let chosen = "active" return chosen end` may supply `device.is(state)`; a body local whose value cannot settle a fixed argument, as one that reads a member or holds an interpolated string, prevents the block from settling one.

A member's value is known only once it is evaluated, so an expression that needs one to settle is a validation error, as `if device.is("active") then "active" else "active" end` is; the side an expression does not take is validated and selects nothing, so a name only it holds is never looked up.

<a id="members-declaring-a-member"></a>
<a id="what-a-member-declares-signature"></a>

## Declaring a member

A module declares each member as data. Its fields are its signature, which lets resolution check every use of it before evaluation, and its evaluation contract, which tells a host how the member reads and changes:

| Field | Holds |
| --- | --- |
| `name` | The member's name in the language |
| `kind` | `property` or `function` |
| `invokedBy` | Who invokes a function: `evaluator`, the default, or `host`, as [host calls](#members-host-calls) set out |
| `target` | The types whose values have the member, a type, a list of types or `any`; left out for a [module member](modules.md#namespaces-module-members), whose implementation is given no receiver |
| `syntax` | How a member that is no property is written: `function-call`, or `indexer` for a function whose one required value parameter is its key |
| `default` | For an indexer, whether it is the default of its receivers |
| `arguments` | The argument form, where the member has parameters: `positional` or `options` |
| `parameters` | Each parameter's name, kind, type, whether it is required and its default where it is not, its null policy, whether it is fixed and what it selects, and its implicit parameter or callback contract by its kind, as [parameter fields](#members-parameter-fields) set out |
| `result` | The type the member must return; for a host call, the type of each value its host supplies, left out where it supplies none |
| `updates` | How it reads and changes, as [updates](#members-updates) set out |
| `implementation` | The function that carries it out, optional, as [declarations without an implementation](modules.md#modules-declarations-without-an-implementation) set out; a host call takes none |

Each member takes the fields it needs alone:

| Member | `target` | `syntax` | `arguments` | `parameters` | `updates` | `result` | `implementation` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A property | Optional | Refused | Refused | Refused | Required | Required | Optional |
| A function the evaluator invokes | Optional | `function-call`, the default, or `indexer` | Required where it has parameters, refused where it has none; `positional` for an indexer | Any kind; a function parameter only here | Required | Required | Optional |
| A function the host invokes | Optional | `function-call` | As a function's | Value parameters, of which a fixed one may select a type | Refused | Optional | Refused |

A host call takes value parameters alone, a deliberate restriction, which a design giving such arguments an evaluation context and a lifetime could lift: its arguments are prepared as values its host keeps, while an expression, a predicate or a function argument is evaluated by the evaluator as its member calls it, which for a host call would come after preparation ends and need an evaluation context and a lifetime no host call declares. A value parameter's type holds data and reference values, and a function is never given to one, as [functions as values](functions.md#functions-as-values) sets out, so a prepared argument holds no function at any depth, in an object or a list among them.

A member without a target, a module member, refuses what only a receiver gives: the `indexer` syntax, being a default indexer, and an observation of the receiver or of a target found from it, in its own `updates` and in any observation it names.

<a id="what-a-member-declares-call-and-indexer-forms"></a>

### Function call and indexer forms

A function is written as a function call. A function the evaluator invokes may instead declare an indexer with exactly one required value parameter, supplied as its bracketed key. Its argument form is positional, and its key has the declared parameter type.

An indexer may be designated the default for its receivers, a module designating at most one for a receiver type; which designation an access selects follows the receiver type's owner, as [indexer selection](modules.md#namespaces-indexers) sets out.

Positional arguments list parameters in order, with required parameters before optional ones; creating the module checks this order. Options take one object whose fields supply the declared parameters.

Changing a member's argument form is a breaking change, like renaming it. A function expected to grow uses options from the start.

<a id="members-parameter-fields"></a>

### Parameter fields

A parameter is a value, an expression, a predicate or a function. An expression and a predicate are evaluated against each item of the list the member follows, `context: 'item'`, and an expression declares the type it produces. A parameter declares whether it is required, its default where it is not, and whether a null argument propagates, making the call answer null, or is accepted. A fixed parameter names something the vocabulary resolves before any evaluation, and declares what it selects: a type, `selects: 'type'`, through the type selector its `selector` names, or a predicate.

Only a function the evaluator invokes declares a function parameter, which is required, has no null policy and is given to no observation; it declares the types of the arguments it is called with, and its type is its result's.

<a id="what-a-member-declares-evaluation-contract"></a>
<a id="members-updates"></a>

### Updates

A member's evaluation contract is grouped under `updates`: how it reads, `reads`, as [how a member reads](#how-a-member-reads) sets out; how its result changes, `changes`, as [how a member changes](#how-a-member-changes) sets out; the changes it misses, `misses`; the `tolerance` it declares; and the `observations` that cover its changes, as [observations](vocabulary.md#observations) set out. A host call is never evaluated, and leaves `updates` out.

`changes` and `reads` are required. `misses` is required where `changes` is `partly-observable`, and refused otherwise. `observations` are required where `changes` is `observable` or `partly-observable`, and refused otherwise, each observation checked for its type, what it observes and the arguments it gives.

<a id="what-a-member-declares-numeric-tolerance"></a>

### Numeric tolerance

A member may declare a tolerance for its numeric result and every number within a structured result, as `sensor.temperature` declares `0.5`. A result's [metadata](runtime.md#runtime-results) carries it, and a host that compares results treats an absolute difference no greater than it as unchanged, and compares exactly where the member declares none. The rule applies regardless of the member's form. `tolerance` is taken by a member whose result is a `number`, a `number?` or a structured type, nullable or not, where it applies to every number the structure holds, and refused by any other, a list among them.

<a id="members-what-an-implementation-receives"></a>

### What an implementation receives

An implementation is called with one object and takes what it needs from it by name, never by position, so none accepts what it ignores to reach what it reads, and a field added later moves nothing. A member's or a predicate's holds `receiver`, the value it is read from, which a module member has none of; `args`, the script's arguments by parameter name, `args` since strict mode refuses `arguments` as a name; and `env`, the environment the host supplies; and, for a member reading maintained values, `samples`, its observations' latest, in the order its declaration names them. Lexica calls no implementation of a host call, and what its host calls one with is the host's own. An observation type's holds `request`, `notify` and `env`, and a conversion's `value` and `reject`. The contract is JavaScript's alone, and no script is written differently for it.

<a id="how-a-member-reads"></a>

## How a member reads

A script is evaluated synchronously, without yielding, and a member's implementation is synchronous. Each member declares how it obtains its value:

| Reading | Meaning |
| --- | --- |
| Fresh | Read as the script evaluates, as `device.power` reads the power the device reports now. |
| Maintained | Kept by an observation the member holds, and read as that observation's latest sample, as `sensor.temperature` reads the last reading the `reading` observation kept. |
| Captured | Kept from what happened before as well as read from the state as it is, as `room.highestTemperature` keeps the highest temperature the room has reported since its host began to hold the evaluation. |
| Derived | As the items it selects and the expression it evaluates read, such as a list's `count` or `max`. |

Facts that must describe one measurement are fields of one structured value, which is captured once and read by each of its fields, as a `climate`'s temperature and humidity are.

A maintained member's observation starts the first time an evaluation reads it, and the member is **pending** until its first sample arrives. An evaluation that reads a pending member reads it as null and tells its host it is pending, and a host that cannot wait for the sample fails the evaluation instead; when a host waits for first samples is the host's to decide.

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
| Unobserved | The member can be read, and names no observations, as `home.now`. |
| Derived | The result changes as the items it selects and the expression it evaluates do, such as a list's `first` or `where`. |

The categories are facts a host reads: whether a host keeps a result current over an unobserved or a partly observable member is its own policy, which Lexica gives it the declarations a resolution uses to decide. A literal is constant, so a script that carries one changes only as its members do.

<a id="members-host-calls"></a>
<a id="members-actions-and-behaviors"></a>
<a id="members-event-sources"></a>
<a id="events"></a>

## Host calls

A **host call** is a call of a function whose declaration says the host invokes it, `invokedBy: 'host'`. Lexica resolves it as it resolves any call, checking its receiver, its arguments and their types against the declaration, and prepares it for the host by evaluating its receiver and arguments; it never invokes it, and its module gives Lexica no implementation of it. What the host does with it, and when, is the host's own.

```lexica
light.dim({ to = 40 })                                                                   // The host invokes dim, and supplies the brightness the light reached.
thermostat.hold({ target = 21 })                                                         // The host invokes hold, and supplies nothing.
sensor.on("motion") { at = it.at, strong = it.strength > 0.8, room = sensor.room.name }  // The host invokes on, and supplies each motion the sensor reports.
```

<a id="members-host-calls-where-a-host-call-stands"></a>

### Where a host call stands

A host call is a script's terminal operation: the script ends in it, or in it followed by its result projection, and it gives no value to any expression around it. One in a field, an argument, a condition, an operand, a function's body or another call's result projection is therefore a validation error, which resolution reports from the declaration the call resolves to. Locals may come before it, so a body whose `return` is a host call is one: `let target = 21 return thermostat.hold({ target = target })`.

The declarations that take a name as it is written agree on who invokes it, as [the call keeps who invokes it](types.md#receivers-of-unknown-type-the-call-keeps-who-invokes-it) sets out, so a call on a receiver of unknown type is a host call where they do, and has no declaration until a binding gives its receiver a type.

<a id="members-host-calls-the-values-a-host-supplies"></a>

### The values a host supplies

A host call's `result` is the type of each value its host supplies for projection: the one value it answers, or each of several it supplies over time; a host call that declares no `result` supplies none. Lexica checks a supplied value against that type and takes it as the evaluator takes any member's answer, so it treats a value alike whether it arrived at once, later or repeatedly, as [projecting a supplied value](runtime.md#runtime-host-calls) sets out.

The object expression following a host call is its **result projection**, evaluated against each value its host supplies, which is its implicit parameter. It reads that value's own data, the locals the script declares before the call, with the values the call was [prepared](runtime.md#runtime-host-calls) with, and anything a script parameter reaches; its members are read once for each value and never evaluated again for it, so an unobserved member is allowed in it. A host call that declares no `result` takes no result projection, and one written is a validation error.

A fixed argument can choose the type of the values its host supplies, as `on`'s `"motion"` does through the home's `event` [type selector](vocabulary.md#vocabulary-type-selectors), so the result projection following `sensor.on("motion")` evaluates against a `{ at: number, strength: number }`.
