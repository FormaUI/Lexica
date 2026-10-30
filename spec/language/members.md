# Members

<a id="members"></a>

A **member** is what a module declares on a type: a property, a function, an indexer or an [operator](../runtime/modules.md#modules-operators); or on no type, a [module member](modules.md#namespaces-module-members), which is a property or a function. A script reaches a member through its receiver, and the member's declaration says how the member is written, what it takes, what it answers, who invokes it, how it reads and how its value changes. Nexo checks every use of a member against its declaration before anything runs. How a module declares a member and gives its implementation is the runtime's, as [members](../runtime/members.md) set out.

```nexo
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
5. [Host calls](#members-host-calls)

<a id="members-member-kinds-and-host-calls"></a>
<a id="members-member-kinds-and-requests"></a>
<a id="what-a-member-declares"></a>
<a id="requests"></a>

## Member kinds and host calls

A member's kind is `property`, `function`, `indexer` or `operator`. A property is read, a structured type's data among its properties, and a function and an indexer called, by the evaluator as it evaluates a script, or, for a function whose declaration says so, `invokedBy: 'host'`, by the host; and an operator is invoked by `as` or `to` alone, as [operators](../runtime/modules.md#modules-operators) set out. A script gives a value, or ends in a **host call**, a call of a function the host invokes; the last member of its chain, before any object expression following it, decides which:

| A script whose chain ends in | Gives |
| --- | --- |
| A property, a function or an indexer the evaluator invokes, or no member | A value: it reads, and answers data |
| A function the host invokes | A host call: Nexo prepares its receiver and arguments, the host invokes it, and the object expression following it shapes each value the host supplies |

Evaluating a script only reads, and the evaluator never invokes a host call, so no evaluation changes the host's state. What a host call does, and when, is the host's own; Nexo's part is set out in [host calls](#members-host-calls) and the [host contract](../runtime/host-calls.md#runtime-host-calls).

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
| [Extension access](extensions.md#extensions-access) | `receiver:Extension.member` | `receiver?:Extension.member` | `device:Device.usage` |

```nexo
room.devices.count                                // A dot property access.
room.device("lamp")?.battery                      // A function call, then optional access.
device.setting["mode"]                            // A named indexer.
rooms[0]                                          // A list's unnamed indexer: its first room.
room.device("lamp")?.active() ?? false
```

<a id="property-access-calls-and-indexers-property-access"></a>

### Property access

A dot property access reads the property its receiver's type declares, or an object's field, and takes no arguments. Whitespace cannot replace the dot: `it climate temperature` is an error suggesting `it.climate`.

Computed property access chooses that property or object field by a name an expression gives. It follows the same member contract as dot access; see [Computed property access](#computed-property-access).

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

A projection or any other expression beyond that member chain is a syntax error. The definition records the individual accesses as optional, and the [canonical text](../runtime/definition.md#definition-canonical-text) writes `?.` and `?[` rather than the enclosed shorthand.

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

The two readings never both apply, since a named indexer and a property of one name on one type collide, and [owner precedence](extensions.md#extensions-owners) chooses one declaration of a name. Resolution reads the pair together: where the member access names a named indexer of its receiver's type, it supplies the receiver and the indexer's name and is not evaluated on its own, so nothing is evaluated between the receiver and its key. Only where it does not is the member access a property read, whose answer the brackets index. Once a named indexer applies, the brackets are its key whatever they hold: a key it refuses, as `device.setting[3]` for a setting's name, is that indexer's validation error, and never makes the brackets index the answer of a property instead.

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

A computed name never selects a named indexer. In `device.[p][k]`, `device.[p]` reads the property `p` names and `[k]` indexes its answer, so where `p` settles to `"setting"`, the named indexer of that name isn't a candidate, and the computed name is refused, since `setting` names an indexer rather than a property. The named-indexer reading applies only to a member access whose name is written, never to one whose name is an expression. A string literal that is a Nexo name is the name written, as [one property at a time](#bracket-property-access-one-property-at-a-time) sets out, so `device.["setting"]["mode"]` is `device.setting["mode"]`.

<a id="property-access-calls-and-indexers-unnamed-indexers"></a>
<a id="property-access-calls-and-indexers-default-indexers"></a>

### Unnamed indexers

`x[key]` invokes the unnamed indexer of `x`'s type, the indexer declared without a name, of which a type has one, of one or more signatures. Nexo's own `List` declares one, the item at an index counted from zero, so `rooms[0]` is the first room, and `Home`'s `Device` declares one reading a setting, so `device["mode"]` reads the setting `mode`.

| Form | Meaning |
| --- | --- |
| `rooms[0]` | The first room |
| `rooms?[i]` | Null for a null list, `i` unevaluated; otherwise the item at `i` |
| `device["mode"]` | The setting `mode`, as `device.setting["mode"]` reads it |

An indexer's **signatures** are the indexers a type or an extension declares of one name, or unnamed, each taking a key of its own type: Nexo's own `List` declares three, a `Number` and an `Index` looked up and a `Range` sliced. Their key types are disjoint, two whose key types fit one way or the other, both nullable, or either of which takes a type parameter or `Any`, being refused when they are registered (NEXO4068 for unnamed ones, NEXO4029 for named ones). An access selects the indexer as it selects any member, and then the signature whose key type its key's type is assignable to, a key of null or a never the first's; a key no signature takes, and one of `Any` where several signatures stand, is refused (NEXO3084), never falling through to another member. On a value of `Any`, the signature its key's value is of is selected when it is evaluated.

[Which unnamed indexer applies](modules.md#namespaces-indexers) follows the type's owner, as any member's does. A type with none refuses `x[key]`, and where `key` is a string and `x` has a property it could name, the validation error gives the computed form, `x.[key]`.

<a id="property-access-calls-and-indexers-member-form-and-parsing"></a>

### Member form and parsing

A property must be read as a property, a function called, and an indexer given its key in brackets; the evaluator alone invokes an indexer, never the host.

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

Computed property access chooses that property or object field by a name an expression gives. `it.["climate"]` and `it.climate` resolve the same member, with the same implementation, type, null behavior and observations.

```nexo
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

An object field is always named, as in `reading = it.["power"]`.

When the name is a string literal that is a Nexo name, its definition is the same as dot access: `it.["power"]` has the definition of `it.power`.

<a id="arguments"></a>

## Parameters and arguments

A member declares its **parameters**, and a script gives it **arguments**. A function call takes its arguments by position, none or several, and an indexer its one key, each a simple expression; the member's declaration states the form those arguments take, its **argument form**, positional or options. A member *has parameters* where it declares one or more, an optional one included.

<a id="arguments-positional"></a>

### Positional arguments

The arguments supply the member's parameters in order, as `"lamp"` supplies the name in `room.device("lamp")` and `"mode"` the name in `device.setting["mode"]`. An indexer's one argument is its bracketed key, so its form is positional.

Its required parameters come before its optional ones, so the parameters left out are the last: a required one must be given, a missing optional one takes its default, and more arguments than it has parameters is a validation error, `'device' takes one argument, and is given 2`, which for a member with optional parameters says how many it takes at most, `'…' takes at most 2 arguments, and is given 3`.

<a id="arguments-options"></a>

### Options

The one argument is an object expression written in place, whose object fields supply the member's parameters by name, as `{ target = 21, until = Home.now + 3600 }` does for `hold`.

Each object field follows its parameter's rules; an object field the member has no parameter for is a validation error naming those it has, a required parameter must be given, and a missing optional one takes its default. Where every parameter is optional, the argument can be left out, as in `light.dim()`, and a second argument is a validation error.

An object means options only by its member's argument form: the object a positional member is given is its parameter's value.

An options object follows the ordinary rules of an object expression. Its options are evaluated once each, in the order they are written, whatever order the member declares its parameters in. Each written option is in scope by its name after its initializer, as [an object field is](values.md#locals-object-fields-as-names), so in `thermostat.hold({ target = 21, until = if target > 20 then Home.now + 3600 else null end })` the `until` option reads the `target` written before it. Where no object expression encloses it, an options object builds the [object root](values.md#locals-the-object-root), each option an object field of it after its initializer, of the value and type it was given, a reference value included; inside one, `root` keeps the enclosing object root, whose object fields the options never join. A default the member supplies does not introduce a name or an object field. An option the member declares as an expression or a predicate is evaluated by the member, against the implicit parameter it supplies, with the names and the object root of the place it is written; it has no single value, so reading it by its name or through `root` after its initializer is a validation error, which no enclosing name of its spelling escapes.

<a id="arguments-kinds"></a>

### Argument kinds

Every parameter of a member is declared as one of four kinds, and the evaluator treats them differently; a parameter an options object supplies is the same.

- A **value argument** is evaluated once, where the call is written, against the same implicit parameter as the chain it appears in, so its `it` is that implicit parameter. In `room { own = it.device(it.name) }`, the argument's `it.name` is the room's name, not a device's. At the top level, where there is no implicit parameter, a value argument starts from a script parameter, `root`, a namespace's member, a local, a literal, an object expression or another input: `room.device(name)`. An object expression given to a value parameter of a structured type constructs the structure, as [constructing a structure](types.md#types-constructing-a-structure) sets out.
- An **expression argument** is a body of each item of the list the member follows, which is its `it`, and its result must be of the type the parameter declares. In `room.devices.max(it.power)`, `it` is each device. It is written as its body, an expression the member evaluates against each item, or as a function of the item, which the member calls with each: an arrow function, `room.devices.max(d => d.power)`, a function reference a name holds, or [one to a module's function](functions.md#functions-module-references), each checked against the contract of one argument, the item's type, and the parameter's result type, as a function argument is. Whichever form gives it, the member receives a callback of that contract, which it calls only while its own invocation lasts, with one item of the list's item type, and a call after that, or with other arguments, fails. A body that reads no `it` gives each item the same value, so `room.devices.sum(1)` counts them, and one that reads `it` and gives a function reference is a validation error, since a function of the item is written as the argument itself. Nexo's own module's expression parameters are those of `max`, `min` and `sum`.
- A **predicate argument** is an expression argument of any value, and the member receives its truthiness, a Boolean, for each item it evaluates it against or calls it with: in `room.devices.where(it["mode"])`, the device's setting is truthy wherever it is present, empty or not, and `room.devices.where(Home.active)` keeps the active devices. A Boolean name that does not hold a function is its body, the same for every item, so it keeps every item or none. Nexo's own module's predicate parameter is that of `where`.
- A **function argument** is a function, which the member receives as a callback and calls with arguments of the types its **callback contract** declares, taking a result of the contract's result type: an arrow function written as the argument, a function reference a name holds, a [reference to a module's function](functions.md#functions-module-references), as `Home.active` is, or, for a contract of one argument, an [implicit body](functions.md#functions-implicit-bodies), an expression reading `it`, which is that argument. Resolution checks each function the argument may be against the contract, its argument types and its result type, and refuses a name that does not hold a function reference, so `room.anyDevice(metered)` is a validation error for a Boolean `metered`; evaluation checks the result an implementation answers. The member calls it only while its own invocation lasts, and a call after that fails. Nexo's own module declares no function parameter: a module declares the members that take a function for its own domain, as the home's `room.anyDevice(test)` does. Where an expression argument's body that reads no `it` is a value the same for every item, a function argument's is not a function reference, so `room.anyDevice(metered)` is refused where `room.devices.where(metered)` keeps every device or none; `room.anyDevice(d => metered)` writes a test of a Boolean.

Because the kind is part of the signature, resolution validates every kind before evaluation, and evaluation reports the reads of value, expression, predicate and function arguments.

<a id="nullability-a-null-argument-follows-the-parameter"></a>

### Null arguments

A parameter is declared either to propagate null, which is the default and makes the call answer null without running, or to accept null with a meaning of its own, as `hold` accepts a null `until` to mean until it is disposed. An expression or a predicate parameter's policy is its body's of a null item: one that propagates null, the default, reads each item as a value that is not null, a null item answering null without the body being evaluated against it, and one that accepts null, as `select`'s does, evaluates its body against every item, its `it` of the item's type; a function of the item is called with each item as it is, whichever its policy. Resolution never rejects an evaluated argument for being nullable; it rejects a type that cannot match.

Optional and nullable are separate. An optional parameter can be omitted; a nullable parameter can receive null. Unless a member's declaration marks a parameter optional, it is required. Omitting a required argument is a validation error, and supplying null follows the parameter's null policy.

<a id="arguments-fixed"></a>
<a id="bodies-fixed-arguments"></a>

### Fixed arguments

A value argument can be declared **fixed**, where it selects something validation needs before evaluation, the type a [type selector](vocabulary.md#vocabulary-type-selectors) maps it to, as `on`'s does. A fixed argument names a declaration, which cannot be looked up from null, so it must resolve to a non-null string during resolution.

A fixed argument is a string the script's resolution settles, without evaluating any member or depending on a value its host supplies: a literal, a script parameter, a local or a conditional binding holding one, a local holding a `do` block whose locals and result all settle, a function parameter within a call's body, which is resolved with its arguments, and an `and`, an `or`, a conditional or a coalescing operator whose result they settle by the rules that evaluate it everywhere, as `let kind = "motion"` followed by `return sensor.on(kind)`, and `sensor.on(metered and "change" or "motion")`, are. A fixed argument whose outcome can be null or does not name a declaration is refused, so `sensor.on(name)` is a validation error where `name` is bound to null.

A local holding a `do` block settles a fixed argument only if every local evaluated in that block and its result can settle it, since reads made by unused body locals cannot be discarded. A local `kind` holding a `do` block whose local is `let chosen = "motion"` and whose result is `return chosen` may supply `sensor.on(kind)`; a body local whose value cannot settle a fixed argument, as one that reads a member or holds an interpolated string, prevents the block from settling one.

A member's value is known only once it is evaluated, so an expression that needs one to settle is a validation error, as `sensor.on(if sensor.active() then "motion" else "motion" end)` is; the side an expression does not take is validated and selects nothing, so a name only it holds is never looked up.

<a id="members-host-calls"></a>
<a id="members-actions-and-behaviors"></a>
<a id="members-event-sources"></a>
<a id="events"></a>

## Host calls

A **host call** is a call of a function whose declaration says the host invokes it, `invokedBy: 'host'`. Nexo resolves it as it resolves any call, checking its receiver, its arguments and their types against the declaration, and prepares it for the host by evaluating its receiver and arguments; it never invokes it, and its module gives Nexo no implementation of it. What the host does with it, and when, is the host's own.

```nexo
light.dim({ to = 40 })                                                                   // The host invokes dim, and supplies the brightness the light reached.
thermostat.hold({ target = 21 })                                                         // The host invokes hold, and supplies nothing.
sensor.on("motion") { at = it.at, strong = it.strength > 0.8, room = sensor.room.name }  // The host invokes on, and supplies each motion the sensor reports.
```

<a id="members-host-calls-where-a-host-call-stands"></a>

### Where a host call stands

A host call is a script's terminal operation: the script ends in it, or in it followed by its result projection, and it does not give a value to any expression around it. One in an object field, an argument, a condition, an operand, a function's body or another call's result projection is therefore a validation error, which resolution reports from the declaration the call resolves to. Locals may come before it, so a body whose `return` is a host call is one: `let target = 21`, then `return thermostat.hold({ target = target })`.

The declarations that take a name as it is written agree on who invokes it, as [the call keeps who invokes it](types.md#receivers-of-unknown-type-the-call-keeps-who-invokes-it) sets out, so a call on a receiver of unknown type is a host call where they do, and has no declaration until a binding gives its receiver a type.

<a id="members-host-calls-the-values-a-host-supplies"></a>

### The values a host supplies

The `result` of a function the host invokes is the type of each value its host supplies for projection: the one value it answers, or each of several it supplies over time; one that declares no `result` supplies none. Nexo checks a supplied value against that type and takes it as the evaluator takes any member's answer, so it treats a value alike whether it arrived at once, later or repeatedly, as [projecting a supplied value](../runtime/host-calls.md#runtime-host-calls) sets out.

The object expression following a host call is its **result projection**, evaluated against each value its host supplies, which is its implicit parameter. It reads that value's own data, the locals the script declares before the call, with the values the call was [prepared](../runtime/host-calls.md#runtime-host-calls) with, and anything a script parameter reaches; its members are read once for each value and never evaluated again for it, so an unobserved member is allowed in it. A host call whose function declares no `result` takes no result projection, and one written is a validation error.

A fixed argument can choose the type of the values its host supplies, as `on`'s `"motion"` does through the home's `event` [type selector](vocabulary.md#vocabulary-type-selectors), so the result projection following `sensor.on("motion")` evaluates against a `{ at: Number, strength: Number }`.
