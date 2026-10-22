# Members

<a id="members"></a>

A **member** is what a module declares on a type, or on no type for a [module member](modules.md#namespaces-module-members): a property or a function. A script reaches a member through its receiver, and the member's declaration says how the member is written, what it takes, what it answers, who invokes it, how it reads and how its value changes. Lexica checks every use of a member against its declaration before anything runs.

```lexica
room.devices.count                    // A property, then another: the room's devices, counted.
room.device("lamp")?.battery          // A function, then a property of what it found, if anything.
device.setting["mode"]                // A named indexer, given its key.
light.dim({ to = 40 })                // A function the host invokes, given its options.
sensor.on("motion") { at = it.at }    // A function the host invokes, each value it supplies shaped by the object after it.
```

In this document:

1. [Member kinds and host calls](#members-member-kinds-and-host-calls)
2. [Writing a member](#property-access-calls-and-indexers)
3. [Computed property access](#computed-property-access)
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

A member's kind is `property`, `function`, `indexer` or `operator`. A property is read, a structured type's stored data among its properties, and a function and an indexer called, by the evaluator as it evaluates a script, or, for a function whose declaration says so, `invokedBy: 'host'`, by the host; and an operator is invoked by `as` or `to` alone, as [operators](modules.md#modules-operators) set out. A script gives a value, or ends in a **host call**, a call of a function the host invokes; the last member of its chain, before any object expression following it, decides which:

| A script whose chain ends in | Gives |
| --- | --- |
| A property, a function or an indexer the evaluator invokes, or no member | A value: it reads, and answers data |
| A function the host invokes | A host call: Lexica prepares its receiver and arguments, the host invokes it, and the object expression following it shapes each value the host supplies |

Evaluating a script only reads, and the evaluator never invokes a host call, so no evaluation changes the host's state. What a host call does, and when, is the host's own; Lexica's part is set out in [host calls](#members-host-calls) and the [runtime](runtime.md#runtime-host-calls).

<a id="property-access-calls-and-indexers"></a>
<a id="access-and-calls"></a>

## Writing a member

Property access, function calls and indexers are distinct constructs. A member's declaration says which form it takes.

| Construct | Required form | Optional form | Example |
| --- | --- | --- | --- |
| Dot property access | `receiver.property` | `receiver?.property` | `room.devices.count` |
| Computed property access | `receiver.[name]` | `receiver?.[name]` | `device.[name]` |
| Function call | `receiver.function(…)` | `receiver?.function(…)` | `room.device("lamp")` |
| Named indexer | `receiver.indexer[key]` | `receiver?.indexer[key]` | `device.setting["mode"]` |
| Unnamed indexer | `receiver[key]` | `receiver?[key]` | `rooms[0]` |
| Extension access | `receiver:Extension.member` | `receiver?:Extension.member` | `device:Device.usage` |

```lexica
room.devices.count                                // A dot property access.
room.device("lamp")?.battery                      // A function call, then optional access.
device.setting["mode"]                            // A named indexer.
rooms[0]                                          // A list's unnamed indexer: its first room.
room.device("lamp")?.active() ?? false
```

<a id="property-access-calls-and-indexers-property-access"></a>

### Property access

A dot property access reads a property and takes no arguments. Whitespace cannot replace the dot: `it climate temperature` is an error suggesting `it.climate`.

Computed property access chooses a property by a name an expression gives. It follows the same member contract as dot access; see [Computed property access](#computed-property-access).

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

Required access needs a receiver whose type cannot be null. A nullable receiver is a validation error that suggests optional access: `room.device(name).battery` is a validation error, since `device` answers a `Device?`.

Optional access reads or invokes the member only when its receiver is not null. Otherwise it answers null and skips the remainder of that chain, including argument or key evaluation. `room.device(name)?.battery` answers null without invoking `battery` where the room has no device of that name; its type is `Number?`, since an optional chain is nullable where an optional access of it can meet null. A member written with `?.` or `?[` answers null for a null receiver, so `room.device(name)?.active()` is a `Boolean?` that is null where there is no such device.

For example, `room.device(name)?.room.devices.count` answers null when the room has no device of that name. Otherwise `.count` counts the devices of the device's room.

A group ends the optional chain. In `(room.device(name)?.room.devices).count`, `.count` receives a `List<Device>?`, so this is a validation error.

Optional access is also valid on a receiver whose current type cannot be null. A parameter typed by one binding may be nullable under another.

<a id="property-access-calls-and-indexers-optional-enclosed-access"></a>

### Optional enclosed access

`(? … )` makes every member access in its enclosed member chain optional:

| Written | Equivalent accesses |
| --- | --- |
| `(?room.device(name).room.climate.temperature)` | `room?.device(name)?.room?.climate?.temperature` |
| `(?(room.device(name) as Light).brightness)` | `(room?.device(name) as Light)?.brightness` |
| `(?((a.x ?? b) as Light).brightness)` | `((a.x ?? b) as Light)?.brightness` |

The enclosed form requires a receiver followed by at least one property access, function call or indexer. Its receiver is an input, `it`, a script parameter, `root`, a namespace's member, a literal, an interpolated string, a local, a local function's call or an object expression, or a grouped cast.

Accesses in a grouped cast's target also become optional. A coalescing target in parentheses, an already optional enclosed target, call arguments, indexer keys and computed property names retain their own rules. A named indexer's brackets become optional too, which [adds nothing](#property-access-calls-and-indexers-named-indexers) to its receiver's optional access, so `(?device.setting["mode"])` answers as `device?.setting["mode"]` does.

An optional enclosed access written directly as a call's argument is a syntax error, since `(?` is one token: the call writes it in parentheses of its own, `.device((?…))`.

The closing parenthesis ends the enclosed optional chain. `(?x.y.z)?.a.b` is `(x?.y?.z)?.a.b`; `.b` still requires a non-null `a`.

A projection or any other expression beyond that member chain is a syntax error. The definition records the individual accesses as optional, and the [canonical text](definition.md#definition-canonical-text) writes `?.` and `?[` rather than the enclosed shorthand.

<a id="property-access-calls-and-indexers-calls"></a>

### Function calls

A function call takes zero or more positional arguments inside parentheses, separated by commas. Each argument is a [simple expression](expressions.md#simple-expressions). The chain may continue after the call. Every member written with arguments in parentheses is written as a function call, whoever invokes it.

Argument count and types come from the signature. `room.device("lamp", "fan")` is a validation error because `device` takes one argument.

Calls do not accept named arguments. `room.device(name = "lamp")` is a syntax error suggesting an options object. A member declared with options takes one object, for example `light.dim({ to = 40 })`.

<a id="property-access-calls-and-indexers-named-indexers"></a>

### Named indexers

A named indexer takes one key, written in brackets after its name. The key is a [simple expression](expressions.md#simple-expressions).

| Form | Meaning |
| --- | --- |
| `device.setting["mode"]` | Invoke `setting` with one key |
| `device.setting[name]` | Compute the key and invoke `setting` |
| `x.lookup["a"].["b"]` | Invoke `lookup`, then read property `b` of its result |
| `room.climate?.["temperature"]` | Read property `temperature` of `climate` |

The text reads `x.name[key]` as it is written, the member `name` and then brackets, and resolution decides what it is by the receiver's type:

- Where the receiver's type has a named indexer `name` the script can reach, `x.name[key]` invokes it with the key.
- Otherwise `name` is a property, and the brackets invoke the [unnamed indexer](#property-access-calls-and-indexers-unnamed-indexers) of the type it answers, as `room.devices[0]` reads the room's first device.

The two readings never both apply, since a named indexer and a property of one name on one type collide, and [owner precedence](modules.md#namespaces-owners-and-extensions) chooses one declaration of a name. Resolution reads the pair together: where the member access names a named indexer of its receiver's type, it supplies the receiver and the indexer's name and is not evaluated on its own, so nothing is evaluated between the receiver and its key. Only where it does not is the member access a property read, whose answer the brackets index. Once a named indexer applies, the brackets are its key whatever they hold: a key it refuses, as `device.setting[3]` for a setting's name, is that indexer's validation error, and never makes the brackets index the answer of a property instead.

A group leaves the definition as it is, so `(device.setting)["mode"]` is `device.setting["mode"]`.

A named indexer takes its key in brackets. Written without them, `device.setting`, or as a call, `device.setting("mode")`, it is a validation error that gives `device.setting[…]`; `device.setting[]` and `device.setting["a", "b"]` are syntax errors.

An optional access skips its operation where its receiver is null, and answers null without evaluating the key. Before the name, `?.` makes the receiver optional. Optional brackets, `?[`, skip the indexing where what is before them is null, and a named indexer has no value between its name and its key, so for one they add nothing. The definition keeps the marker as written, and its effect follows what the name resolves to:

| Written | Where `name` is a named indexer | Where `name` is a property |
| --- | --- | --- |
| `x?.name[k]` | Null where `x` is null; otherwise the indexer invoked with `k` | Null where `x` is null; otherwise the property read and its answer indexed, which must not be null |
| `x.name?[k]` | The indexer invoked with `k`, as `x.name[k]` invokes it; the brackets' marker adds no protection against a null `x` | The property read, and null where it answers null, `k` unevaluated |
| `x?.name?[k]` | As `x?.name[k]` | Null where `x` is null or the property answers null, `k` unevaluated in either case |

So an optional enclosed access, which makes every access and every pair of brackets optional, holds a named indexer as it holds any other.

A group ends an optional chain, as everywhere: in `(device?.setting)["mode"]` the group holds a named indexer written without its key, which is refused.

A computed name never selects a named indexer. In `device.[p][k]`, `device.[p]` reads the property `p` names and `[k]` indexes its answer, so where `p` settles to `"setting"`, the named indexer of that name isn't a candidate, and the computed name is refused, since `setting` names an indexer rather than a property. The named-indexer reading applies only to a member access whose name is written, never to one whose name is an expression. A string literal that is a Lexica name is the name written, as [one property at a time](#bracket-property-access-one-property-at-a-time) sets out, so `device.["setting"]["mode"]` is `device.setting["mode"]`.

<a id="property-access-calls-and-indexers-unnamed-indexers"></a>
<a id="property-access-calls-and-indexers-default-indexers"></a>

### Unnamed indexers

`x[key]` invokes the unnamed indexer of `x`'s type, the indexer declared without a name, of which a type has at most one. Lexica's own `List` declares one, the item at an index counted from zero, so `rooms[0]` is the first room, and `Home`'s `Device` declares one reading a setting, so `device["mode"]` reads the setting `mode`.

| Form | Meaning |
| --- | --- |
| `rooms[0]` | The first room |
| `rooms?[i]` | Null for a null list, `i` unevaluated; otherwise the item at `i` |
| `device["mode"]` | The setting `mode`, as `device.setting["mode"]` reads it |

[Which unnamed indexer applies](modules.md#namespaces-indexers) follows the type's owner, as any member's does. A type with none refuses `x[key]`, and where `key` is a string and `x` has a property it could name, the validation error gives the computed form, `x.[key]`.

<a id="property-access-calls-and-indexers-extension-access"></a>

### Extension access

`receiver:Extension.member` selects an [extension](modules.md#extensions) explicitly: the expression before `:` is the receiver, the name after it identifies the extension that supplies the member, and the member keeps its own form.

| Member form | Required form | Optional form |
| --- | --- | --- |
| Property | `device:Device.usage` | `device?:Device.usage` |
| Function | `device:Device.reset(3)` | `device?:Device.reset(3)` |
| Named indexer | `device:Device.setting["mode"]` | `device?:Device.setting["mode"]` |
| Unnamed indexer | `values:ListExtensions[0]` | `values?:ListExtensions[0]` |

- **The extension's name.** After `:` stands an extension's name, its local name or one its module qualifies, `device:Energy.Device.usage`, where a name the script's [imports](scripts.md#scripts-imports) give a module, its own or an alias, followed by a dot, is the qualifier, so the text alone decides where the name ends, and an extension named as a module the script imports is written qualified, `device:Solar.Energy.usage`. Resolution reads it as a script's [type name](types.md#types-type-identity) is read, an extension the script imports by name first, `values:Numeric.total` after `import Numeric = Measurements.NumericList`, and otherwise the public extensions of Lexica's own and of the modules the script imports, one only, several refused with their qualified names given: ordinary types take no part, so beside `Home`'s type `Device`, `device:Device.usage` selects `Energy`'s extension, and a name only an ordinary type has is refused.
- **Its members alone.** Lookup is limited to the extension's members, so a member it does not declare is an error at that selection, never falling through to another extension or to the receiver's own members, and an extension that ordinary lookup outranks is still reached. The receiver satisfies the extension's target, binding its parameters as [binding a call's parameters](types.md#types-type-parameters-binding) sets out, and visibility and the host's policy apply as to any access.
- **One member operation.** The selection applies to one member operation, and what follows it applies to that operation's answer as usual: `device:Device.details.name` reads the `name` of what `details` answers, and `device:Device.readings[0]` indexes it, unless `readings` is a named indexer, whose declaration decides. A later colon selects another extension for the intermediate value: `device:Device.readings:ListExtensions.first`.
- **A postfix of its receiver.** It binds as a member access does, so in `left + right:NumberExtensions.description` it belongs to `right`, and in `(left + right):NumberExtensions.description` to the sum.
- **Null.** `:` takes a receiver that cannot be null, one that can being refused with the form `?:`, as `.` is with `?.`, and a null found during evaluation failing the access. `?:` evaluates its receiver once and, where it is null, answers null without evaluating the member's arguments or keys, as `?.` does, the extension's name still resolved and its declaration still checked. The items of a `List<Device?>` don't make the list null.
- **A function without a call** is a function reference bound to its receiver: `device:Device.active` evaluates and captures `device` once, when the reference is created, and takes the member's own arguments alone, under the restrictions every [function reference](functions.md#functions-module-functions) follows, so a host call has none. Where the receiver is supplied later, an arrow function writes it: `d => d:Device.active()`.
- **A receiver of `Any`.** The selection names the declaration, so its arguments are read by it, and the receiver is checked against the target when it is evaluated, as [values of `Any`](types.md#types-any) set out; selecting an extension doesn't make an unknown type known, so what inference still needs from the value is refused as for any call.
- **Evaluation.** The receiver is evaluated once and checked against the target, and a failed check invokes nothing; the arguments or keys follow the member's contract, the host's `beforeInvoke` decides before the member is invoked, a property's getter and an indexer included, and the answer is checked as any member's is. A host call selected so keeps its terminal position, its preparation and its projection, and a resolution reports the selected member among its used declarations.

<a id="property-access-calls-and-indexers-member-form-and-parsing"></a>

### Member form and parsing

A property must be read as a property, a function called, and an indexer given its key in brackets; only a function the evaluator invokes can be declared an indexer.

Using another form is a validation error that gives the required form:

> 'setting' is an indexer: write 'it.setting[…]'

A form these rules leave without a meaning is refused with the form that has one:

| Written | Refused, giving |
| --- | --- |
| `device:setting["mode"]`, a member's name where an extension's stands | `device.setting["mode"]`, where an extension of that name isn't reachable |
| `it:[name]` or `it?:[name]`, brackets where an extension's name stands | `it[name]` for an unnamed indexer, or `it.[name]` for a computed property access |
| `rooms.[0]`, a number where a computed property's name stands | `rooms[0]` |
| `room["name"]` on a type without an unnamed indexer | `room.["name"]` |
| `room.device["lamp"]`, a function's argument in brackets | `room.device("lamp")` |

The text alone determines construct boundaries. Parsing does not consult the vocabulary or the number of parameters a member declares; a namespace, and the module qualifying an extension's name, are recognized by the script's imports, as [module names in text](modules.md#names-and-reserved-words-module-names) sets out.

<a id="computed-property-access"></a>
<a id="bracket-property-access"></a>

## Computed property access

Computed property access chooses a property by a name an expression gives. `it.["climate"]` and `it.climate` resolve the same member, with the same implementation, type, null behavior and observations.

```lexica
device {
    let name = if metered then "power" else "battery" end,

    reading = it.["power"],
    chosen = it.[name],
    named = it.[property ?? "power"]
}
```

<a id="computed-property-access-determining-possible-names"></a>
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

A fixed test or operand can decide the selection during resolution. An unreached branch, fallback or operand does not contribute any names. A test decided only at evaluation leaves both branches' names possible; evaluation reads the selected property.

Every branch, fallback and operand is still validated for syntax and types. In `it.["power" ?? it["x"]]`, only `power` needs name resolution; the fallback is neither evaluated nor read.

A computed property access is refused where an outcome can be null or false or does not name a property; a binding is typed by its value, so `device.[name]` is a validation error where `name` is bound to null.

<a id="computed-property-access-name-expression-types"></a>
<a id="bracket-property-access-name-expression-types"></a>

### Name expression types

The complete expression must produce a string. Null is allowed within it only where removed, as `property ?? "power"` removes a null binding. A possible false or other non-string value is a validation error.

Logical expressions participate only when their types fit. `it.[metered and "power" or "battery"]` can select either string when its fixed operands settle it.

The falsey part can also be known from a nullable non-Boolean operand: `it.room.device("lamp") and "power"` gives null or a name. The final name expression must still remove the possible null.

`it.[it.active() and "power" or "battery"]` is refused because no type holds both false and a string. Write the choice as a conditional:

`it.[if it.active() then "power" else "battery" end]`.

An expression outside the permitted forms, such as `it.[it["mode"]]`, is a validation error saying its names cannot be determined.

<a id="computed-property-access-validation-and-result-type"></a>
<a id="bracket-property-access-validation-and-result-type"></a>

### Validation and result type

Every possible name must be a property of the receiver. Their result types must merge as conditional branches do. In the example above, `it.[name]` is a `Number?`.

A resolution is kept for the strings the current bindings supply. Binding another string to a name requires resolving again.

<a id="computed-property-access-evaluation-and-observation"></a>
<a id="bracket-property-access-evaluation-and-observation"></a>

### Evaluating a computed property access

The name is computed once, then the selected property is read. `.[…]` requires a non-null receiver. `?.[…]` answers null for a null receiver without evaluating the name.

For an unknown receiver type, resolution still determines the possible names. Whether each names a property is checked when the receiver type becomes known.

An evaluation reads both what computing the name reads and the selected property, and a later evaluation may select another property where what computes the name changed.

<a id="computed-property-access-one-property-at-a-time"></a>
<a id="bracket-property-access-one-property-at-a-time"></a>

### One property at a time

A name selects one property. `it.["climate.temperature"]` does not follow a path. Functions require function calls; numeric list indexing uses the list's unnamed indexer, `list[2]`, and a number where a computed property's name stands is a validation error that gives that form.

A field is always named, as in `reading = it.["power"]`.

When the name is a string literal that is a Lexica name, its definition is the same as dot access: `it.["power"]` has the definition of `it.power`.

<a id="arguments"></a>

## Parameters and arguments

A member declares its **parameters**, and a script gives it **arguments**. A function call takes its arguments by position, none or several, and an indexer its one key, each a simple expression; the member's declaration states the form those arguments take, its **argument form**, positional or options. A member *has parameters* where it declares one or more, an optional one included.

<a id="arguments-positional"></a>

### Positional arguments

The arguments supply the member's parameters in order, as `"lamp"` supplies the name in `room.device("lamp")` and `"mode"` the name in `device.setting["mode"]`. An indexer's one argument is its bracketed key, so its form is positional.

Its required parameters come before its optional ones, so the parameters left out are the last: a required one must be given, a missing optional one takes its default, and more arguments than it has parameters is a validation error, `'device' takes one argument, and is given 2`, which for a member with optional parameters says how many it takes at most, `'…' takes at most 2 arguments, and is given 3`.

<a id="arguments-options"></a>

### Options

The one argument is an object expression written in place, whose fields supply the member's parameters by name, as `{ target = 21, until = Home.now + 3600 }` does for `hold`.

Each field follows its parameter's rules; a field the member has no parameter for is a validation error naming those it has, a required parameter must be given, and a missing optional one takes its default. Where every parameter is optional, the argument can be left out, as in `light.dim()`, and a second argument is a validation error.

An object means options only by its member's argument form: the object a positional member is given is its parameter's value.

An options object follows the ordinary rules of an object expression. Its options are evaluated once each, in the order they are written, whatever order the member declares its parameters in. Each written option is in scope by its name after its initializer, as [a field is](values.md#locals-fields-as-names), so in `thermostat.hold({ target = 21, until = if target > 20 then Home.now + 3600 else null end })` the `until` option reads the `target` written before it. Where no object expression encloses it, an options object builds the [object root](values.md#locals-the-object-root), each option a field of it after its initializer, of the value and type it was given, a reference value included; inside one, `root` keeps the enclosing object root, whose fields the options never join. A default the member supplies does not introduce a name or a field. An option the member declares as an expression or a predicate is evaluated by the member, against the implicit parameter it supplies, with the names and the object root of the place it is written; it has no single value, so reading it by its name or through `root` after its initializer is a validation error, which no enclosing name of its spelling escapes.

<a id="arguments-kinds"></a>

### Argument kinds

Every parameter of a member is declared as one of four kinds, and the evaluator treats them differently; a parameter an options object supplies is the same.

- A **value argument** is evaluated once, where the call is written, against the same implicit parameter as the chain it appears in, so its `it` is that implicit parameter. In `room { own = it.device(it.name) }`, the argument's `it.name` is the room's name, not a device's. At the top level, where there is no implicit parameter, a value argument starts from a script parameter, `root`, a namespace's member, a local, a literal, an object expression or another input: `room.device(name)`.
- An **expression argument** is a body of each item of the list the member follows, which is its `it`, and its result must be of the type the parameter declares. In `room.devices.max(it.power)`, `it` is each device. It is written as its body, an expression the member evaluates against each item, or as a function of the item, which the member calls with each: an arrow function, `room.devices.max(d => d.power)`, a function value a name holds, or a [function reference](functions.md#functions-module-functions), each checked against the contract of one argument, the item's type, and the parameter's result type, as a function argument is. A body that reads no `it` gives each item the same value, so `room.devices.sum(1)` counts them, and one that reads `it` and gives a function is a validation error, since a function of the item is written as the argument itself. Lexica's own module's expression parameters are those of `max`, `min` and `sum`.
- A **predicate argument** is an expression argument of any value, and the member receives its truthiness, a Boolean, for each item it evaluates it against or calls it with: in `room.devices.where(it["mode"])`, the device's setting is truthy wherever it is present, empty or not, and `room.devices.where(Home.active)` keeps the active devices. A Boolean name that does not hold a function is its body, the same for every item, so it keeps every item or none. Lexica's own module's predicate parameter is that of `where`.
- A **function argument** is a function, which the member calls with arguments of the types its **callback contract** declares, taking a result of the contract's result type: an arrow function written as the argument, a function value a name holds, a [function reference](functions.md#functions-module-functions) to a module's function, as `Home.active` is, or, for a contract of one argument, an [implicit body](functions.md#functions-implicit-bodies), an expression reading `it`, which is that argument. Resolution checks each function the argument may be against the contract, its argument types and its result type, and refuses a name that does not hold a function, so `device.is(metered)` is a validation error for a Boolean `metered`; evaluation checks the result an implementation answers. The member calls it only while its own invocation lasts, and a call after that fails. Lexica's own function parameters are its verbs' tests, `is`, `has` and `supports`. Where an expression argument's body that reads no `it` is a value the same for every item, a function argument's is not a function, so `device.is(metered)` is refused where `room.devices.where(metered)` keeps every device or none; `device.is(d => metered)` writes a test of a Boolean.

Because the kind is part of the signature, resolution validates every kind before evaluation, and evaluation reports the reads of value, expression, predicate and function arguments.

<a id="nullability-a-null-argument-follows-the-parameter"></a>

### Null arguments

A parameter is declared either to propagate null, which is the default and makes the call answer null without running, or to accept null with a meaning of its own, as `hold` accepts a null `until` to mean until it is disposed. Resolution never rejects an evaluated argument for being nullable; it rejects a type that cannot match.

Optional and nullable are separate. An optional parameter can be omitted; a nullable parameter can receive null. Unless a member's declaration marks a parameter optional, it is required. Omitting a required argument is a validation error, and supplying null follows the parameter's null policy.

<a id="arguments-fixed"></a>
<a id="bodies-fixed-arguments"></a>

### Fixed arguments

A value argument can be declared **fixed**, where it selects something validation needs before evaluation, the type a [type selector](vocabulary.md#vocabulary-type-selectors) maps it to, as `on`'s does. A fixed argument names a declaration, which cannot be looked up from null, so it must resolve to a non-null string during resolution.

A fixed argument is a string the script's resolution settles, without evaluating any member or depending on a value its host supplies: a literal, a script parameter, a local or a conditional binding holding one, a local holding a `do` block whose locals and result all settle, a function parameter within a call's body, which is resolved with its arguments, and an `and`, an `or`, a conditional or a coalescing operator whose result they settle by the rules that evaluate it everywhere, as `let kind = "motion" return sensor.on(kind)` and `sensor.on(metered and "change" or "motion")` are. A fixed argument whose outcome can be null or does not name a declaration is refused, so `sensor.on(name)` is a validation error where `name` is bound to null.

A local holding a `do` block settles a fixed argument only if every local evaluated in that block and its result can settle it, since reads made by unused body locals cannot be discarded. `let kind = do let chosen = "motion" return chosen end` may supply `sensor.on(kind)`; a body local whose value cannot settle a fixed argument, as one that reads a member or holds an interpolated string, prevents the block from settling one.

A member's value is known only once it is evaluated, so an expression that needs one to settle is a validation error, as `sensor.on(if sensor.active() then "motion" else "motion" end)` is; the side an expression does not take is validated and selects nothing, so a name only it holds is never looked up.

<a id="members-declaring-a-member"></a>
<a id="what-a-member-declares-signature"></a>

## Declaring a member

A module declares each member as data, in the `members` of the type it belongs to, of an [extension](modules.md#extensions) of a type another module owns, or of the module itself for a [module member](modules.md#namespaces-module-members). A member in a type or an extension takes that type as its receiver and names none, and a module member has none. Its fields are its signature, which lets resolution check every use of it before evaluation, and its evaluation contract, which tells a host how the member reads and changes:

| Field | Holds |
| --- | --- |
| `name` | The member's name in the language, an [identifier](lexical-structure.md#names-and-reserved-words), followed by the [type parameters](types.md#types-type-parameters) it declares, `identity<T>`; an operator's names its operation, `cast` or `convert`; left out for a type's unnamed indexer |
| `kind` | `property`, `function`, `indexer` or `operator` |
| `invokedBy` | Who invokes a function: `evaluator`, the default, or `host`, as [host calls](#members-host-calls) set out |
| `arguments` | The argument form of a function with parameters: `positional` or `options` |
| `parameters` | Each parameter's name, kind, type, whether it is required and its default where it is not, its null policy, whether it is fixed and what it selects, and its implicit parameter or callback contract by its kind, as [parameter fields](#members-parameter-fields) set out |
| `result` | The type the member answers, [`Any`](types.md#types-any) for a value of any type: a field's the type of its value, an operator's its destination, and a host call's the type of each value its host supplies, left out where it supplies none, which `Any` never is |
| `updates` | How it reads and changes, as [updates](#members-updates) set out |
| `impl` | The function that carries it out, optional, as [declarations without an implementation](modules.md#modules-declarations-without-an-implementation) set out |
| `internal` | Whether it is available within its declaring module alone, `false` where left out, as [internal declarations](modules.md#modules-internal-declarations) set out |

Each member takes the fields it needs alone; every one takes `kind` and `internal`, and every one but an unnamed indexer takes `name`:

| Member | `arguments` | `parameters` | `updates` | `result` | `impl` |
| --- | --- | --- | --- | --- | --- |
| A stored property, declared directly in a structured type without `updates` | Refused | Refused | Refused | Required | Refused |
| A computed property | Refused | Refused | Required | Required | Optional |
| A function the evaluator invokes | Required where it has parameters, refused where it has none | Any kind; a function parameter only here | Required | Required | Optional |
| An indexer, named or unnamed | Refused, since its arguments are positional | One required value parameter, its key, and optional ones after it | Required | Required | Optional |
| A function the host invokes | As a function's | Value parameters, of which a fixed one may select a type | Refused | Optional | Refused |
| An operator | Refused | Refused | Refused | Required | Optional |

`target`, `syntax` and `default` are taken by no member: a member's place gives its receiver, and its kind and its name, or an indexer's lack of one, how it is written.

A host call takes value parameters alone, a deliberate restriction, which a design giving such arguments an evaluation context and a lifetime could lift: its arguments are prepared as values its host keeps, while an expression, a predicate or a function argument is evaluated by the evaluator as its member calls it, which for a host call would come after preparation ends and need an evaluation context and a lifetime no host call declares. A value parameter's type holds data and reference values, and a function is never given to one, as [functions as values](functions.md#functions-as-values) sets out, so a prepared argument does not hold a function at any depth, in an object or a list among them.

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

A named indexer's name is a member name, so it collides with a property or a function of that name on the same type, and a type declares as many named indexers as it needs. A module declares at most one unnamed indexer for a receiver type; which one an access selects follows the receiver type's owner, as [indexer selection](modules.md#namespaces-indexers) sets out.

Positional arguments list parameters in order, with required parameters before optional ones; creating the module checks this order. Options take one object whose fields supply the declared parameters.

Changing a member's argument form is a breaking change, like renaming it. A function expected to grow uses options from the start.

<a id="members-parameter-fields"></a>

### Parameter fields

A parameter is a value, an expression, a predicate or a function. An expression and a predicate are evaluated against each item of the list the member follows, `context: 'item'`, and an expression declares the type it produces. A parameter declares whether it is required, its default where it is not, and whether a null argument propagates, making the call answer null, or is accepted. A fixed parameter names something the vocabulary resolves before any evaluation, and declares what it selects, a type, `selects: 'type'`, through the type selector its `selector` names.

Only a function the evaluator invokes declares a function parameter, which is required, has no null policy and is given to no observation; it declares the types of the arguments it is called with, `parameters`, and its type is its result's. Those types may write a type parameter the type or the extension around the member declares, as `List`'s `T`, or that of an extension on any type `T`, which takes a receiver of any type and binds `T` to it, so a callback takes the receiver as its own type, as the verbs' test does.

<a id="what-a-member-declares-evaluation-contract"></a>
<a id="members-updates"></a>

### Updates

A member's evaluation contract is grouped under `updates`: how it reads, `reads`, as [how a member reads](#how-a-member-reads) sets out; how its result changes, `changes`, as [how a member changes](#how-a-member-changes) sets out; the changes it misses, `misses`; the `tolerance` it declares; and the `observations` that cover its changes, as [observations](vocabulary.md#observations) set out. A host call is never evaluated, and leaves `updates` out, and a stored property, its structured type's data, declares none: a property declared directly in a structured type is stored where it leaves `updates` out, and computed where it declares them, while one declared anywhere else requires them.

`changes` and `reads` are required. `misses` is required where `changes` is `partly-observable`, and refused otherwise. `observations` are required where `changes` is `observable` or `partly-observable`, and refused otherwise, each observation checked for its type, what it observes and the arguments it gives.

<a id="what-a-member-declares-numeric-tolerance"></a>

### Numeric tolerance

A member may declare a tolerance for its numeric result and every number within a structured result, as `sensor.temperature` declares `0.5`. A result's [metadata](runtime.md#runtime-results) carries it, and a host that compares results treats an absolute difference no greater than it as unchanged, and compares exactly where the member declares none. The rule applies regardless of the member's form. `tolerance` is taken by a member whose result is a `Number`, a `Number?` or a structured type, nullable or not, where it applies to every number the structure holds, and refused by any other, a list among them.

<a id="members-what-an-implementation-receives"></a>

### What an implementation receives

An `impl` is called with one object and takes what it needs from it by name, never by position, so none accepts what it ignores to reach what it reads, and a field added later moves nothing. A member's holds `receiver`, the value it is read from, which a module member has none of; `args`, the script's arguments by parameter name, `args` since strict mode refuses `arguments` as a name; and `env`, the environment the host supplies; and, for a member reading maintained values, `samples`, its observations' latest, in the order its declaration names them. Lexica does not call an implementation of a host call, and what its host calls one with is the host's own. An observation type's holds `request`, `notify` and `env`, and an operator's `value` and `reject`. A stored property has none, since Lexica reads it from the data, and the hooks `typeOf` and `isInstance` are given the value alone. The contract is JavaScript's alone, and no script is written differently for it.

<a id="how-a-member-reads"></a>

## How a member reads

A script is evaluated synchronously, without yielding, and a member's implementation is synchronous. Each member declares how it obtains its value:

| Reading | Meaning |
| --- | --- |
| Fresh | Read as the script evaluates, as `device.power` reads the power the device reports now. |
| Maintained | Kept by an observation the member holds, and read as that observation's latest sample, as `sensor.temperature` reads the last reading the `reading` observation kept. |
| Captured | Kept from what happened before as well as read from the state as it is, as `room.highestTemperature` keeps the highest temperature the room has reported since its host began to hold the evaluation. |
| Derived | As the items it selects and the expression it evaluates read, such as a list's `count` or `max`. |

Facts that must describe one measurement are stored properties of one structured value, which is captured once and read by each of them, as a `Climate`'s temperature and humidity are.

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
| Unobserved | The member can be read, and does not name an observation, as `Home.now`. |
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

A host call is a script's terminal operation: the script ends in it, or in it followed by its result projection, and it does not give a value to any expression around it. One in a field, an argument, a condition, an operand, a function's body or another call's result projection is therefore a validation error, which resolution reports from the declaration the call resolves to. Locals may come before it, so a body whose `return` is a host call is one: `let target = 21 return thermostat.hold({ target = target })`.

The declarations that take a name as it is written agree on who invokes it, as [the call keeps who invokes it](types.md#receivers-of-unknown-type-the-call-keeps-who-invokes-it) sets out, so a call on a receiver of unknown type is a host call where they do, and has no declaration until a binding gives its receiver a type.

<a id="members-host-calls-the-values-a-host-supplies"></a>

### The values a host supplies

A host call's `result` is the type of each value its host supplies for projection: the one value it answers, or each of several it supplies over time; a host call that declares no `result` supplies none. Lexica checks a supplied value against that type and takes it as the evaluator takes any member's answer, so it treats a value alike whether it arrived at once, later or repeatedly, as [projecting a supplied value](runtime.md#runtime-host-calls) sets out.

The object expression following a host call is its **result projection**, evaluated against each value its host supplies, which is its implicit parameter. It reads that value's own data, the locals the script declares before the call, with the values the call was [prepared](runtime.md#runtime-host-calls) with, and anything a script parameter reaches; its members are read once for each value and never evaluated again for it, so an unobserved member is allowed in it. A host call that declares no `result` takes no result projection, and one written is a validation error.

A fixed argument can choose the type of the values its host supplies, as `on`'s `"motion"` does through the home's `event` [type selector](vocabulary.md#vocabulary-type-selectors), so the result projection following `sensor.on("motion")` evaluates against a `{ at: Number, strength: Number }`.
