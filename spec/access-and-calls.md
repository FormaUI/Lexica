# Access and calls

<a id="access-and-calls"></a>

In this document: [Property access, function calls and indexers](#property-access-calls-and-indexers) · [Bracket property access](#bracket-property-access) · [Arguments](#arguments) · [Simple expressions](#simple-expressions).

<a id="property-access-calls-and-indexers"></a>

## Property access, function calls and indexers

Property access, function calls and indexers are distinct constructs. The vocabulary declares which form a member takes.

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

<a id="property-access-calls-and-indexers-required-access-and-optional-chains"></a>

### Required access and optional chains

Required access needs a receiver whose type cannot be null. A nullable receiver is a validation error that suggests optional access.

Optional access reads or invokes the member only when its receiver is not null. Otherwise it answers null and skips the remainder of that chain, including argument or key evaluation.

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

The enclosed form requires a receiver followed by at least one property access, function call or indexer. Its receiver is an input, `it`, a parameter, `root`, a namespace's member, a literal, an interpolated string, a local, a local function's call or an object expression, or a grouped cast.

Accesses in a grouped cast's target also become optional. A coalescing target in parentheses, an already optional enclosed target, call arguments, indexer keys and bracket property names retain their own rules.

An optional enclosed access written directly as a call's argument is a syntax error, since `(?` is one token: the call writes it in parentheses of its own, `.device((?…))`.

The closing parenthesis ends the enclosed optional chain. `(?x.y.z)?.a.b` is `(x?.y?.z)?.a.b`; `.b` still requires a non-null `a`.

A projection or any other expression beyond that member chain is a syntax error. The definition records the individual accesses as optional. Canonical text writes `?.`, `?[` and `?:` rather than the enclosed shorthand.

<a id="property-access-calls-and-indexers-calls"></a>

### Function calls

A function call takes zero or more positional arguments inside parentheses, separated by commas. Each argument is a [simple expression](#simple-expressions). The chain may continue after the call. Every member written with arguments in parentheses is written as a function call, whatever its kind, an event source, an action and a behavior among them.

Argument count and types come from the signature. `room.device("lamp", "fan")` is a validation error because `device` takes one argument.

Calls do not accept named arguments. `room.device(name = "lamp")` is a syntax error suggesting an options object. A member declared with options takes one object, for example `light.dim({ to = 40 })`.

<a id="property-access-calls-and-indexers-named-indexers"></a>

### Named indexers

A named indexer takes one key, written in brackets after the colon and name. The key is a [simple expression](#simple-expressions).

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

`?:[…]` is the optional form. A module designates at most one default indexer for a receiver type, and [which designation applies](modules-and-namespaces.md#namespaces-indexers) follows the type's owner. If none applies, preparation fails with a validation error asking for an indexer name.

<a id="property-access-calls-and-indexers-member-form-and-parsing"></a>

### Member form and parsing

A property must be read as a property. Functions, event sources, actions and behaviors use function calls, and only a function can be declared an indexer, which is invoked as one.

Using another form is a validation error that gives the required form:

> 'setting' is an indexer: write 'it:setting[…]'

The text alone determines construct boundaries. Parsing does not consult the vocabulary or the number of parameters a member declares; a namespace is recognized by the module names the text is read with, as [Namespaces](modules-and-namespaces.md#namespaces) sets out.

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

Preparation must determine every property name the expression can produce. Only these forms participate, recursively:

| Form | Names considered |
| --- | --- |
| String literal | That string |
| `null` | No string name; null must be removed before the final result |
| Bound parameter | The value settled during preparation |
| Local | Names determined from its value |
| Conditional binding | Names determined from its value's truthy part, without null or false |
| Conditional | Names from its possible branches |
| Coalescing | Its value's names, plus the fallback's if the value may be null |
| `and` | Falsey parts of operands before the last, plus the last operand's values |
| `or` | Truthy parts of operands before the last, plus the last operand's values |

A fixed test or operand can decide the selection during preparation. An unreached branch, fallback or operand contributes no names. A test decided only at evaluation leaves both branches' names possible; evaluation reads the selected property.

Every branch, fallback and operand is still validated for syntax and types. In `it["power" ?? it:["x"]]`, only `power` needs name resolution; the fallback is neither evaluated nor observed.

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

Resolution is retained for the strings supplied by the current bindings. Rebinding a name requires resolving it again.

<a id="bracket-property-access-evaluation-and-observation"></a>

### Evaluation and observation

The name is computed once, then the selected property is read. `[…]` requires a non-null receiver. `?[…]` answers null for a null receiver without evaluating the name.

For an unknown receiver type, preparation still determines the possible names. Whether each names a property is checked when the receiver type becomes known.

A watch follows both what computing the name reads and the selected property's dependencies. Either may cause reevaluation and switch the selection.

<a id="bracket-property-access-one-property-at-a-time"></a>

### One property at a time

A name selects one property. `it["climate.temperature"]` does not follow a path. Functions require function calls; numeric list indexing uses the default indexer, `list:[2]`.

A field is always named, as in `reading = it["power"]`.

When the name is a string literal that is a Lexica name, its definition is the same as dot access: `it["power"]` has the definition of `it.power`.

<a id="arguments"></a>

## Arguments

A function call takes its arguments by position, none or several, and an indexer its one key, each a simple expression, and the member's declaration states what they supply, its **input**:

<a id="arguments-positional"></a>

### Positional

Positional: the arguments supply the member's parameters in order, as `"lamp"` supplies the name in `room.device("lamp")` and `"mode"` the name in `device:setting["mode"]`.

Its required parameters come before its optional ones, so the parameters left out are the last: a required one must be given, a missing optional one takes its default, and more arguments than it has parameters is a validation error, `'device' takes one argument, and is given 2`, which for a member with optional parameters says how many it takes at most, `'…' takes at most 2 arguments, and is given 3`.

<a id="arguments-options"></a>

### Options

Options: the one argument is an object expression written in place, whose fields supply the member's parameters by name, as `{ target = 21, until = home.now + 3600 }` does for `hold`.

Each field follows its parameter's rules; a field the member has no parameter for is a validation error naming those it has, a required parameter must be given, and a missing optional one takes its default. Where every parameter is optional, the argument can be left out, as in `light.dim()`, and a second argument is a validation error.

An object means options only by its member's input: the object a positional member is given is its parameter's value.

An options object follows the ordinary rules of an object expression. Its options are evaluated once each, in the order they are written, whatever order the member declares its parameters in. Each written option is in scope by its name after its initializer, as [a field is](bodies-and-functions.md#locals-fields-as-names), so in `thermostat.hold({ target = 21, until = if target > 20 then home.now + 3600 else null end })` the `until` option reads the `target` written before it. Where no object expression encloses it, an options object builds the [object root](bodies-and-functions.md#locals-the-object-root), each option a field of it after its initializer, of the value and type it was given, a reference value included; inside one, `root` keeps the enclosing object root, whose fields the options never join. A default the member supplies introduces no name and no field. An option the member declares as an expression or a predicate is evaluated by the member, against the implicit parameter it supplies, with the names and the object root of the place it is written; it has no single value, so reading it by its name or through `root` after its initializer is a validation error, which no enclosing name of its spelling escapes.

Every parameter of a member is declared as one of four kinds, and the evaluator treats them differently; a parameter an options object supplies is the same.

- A **value argument** is evaluated once, where the call is written, against the same implicit parameter as the chain it appears in, so its `it` is that implicit parameter. In `room { own = it.device(it.name) }`, the argument's `it.name` is the room's name, not a device's. At the top level, where there is no implicit parameter, a value argument starts from a parameter, `root`, a namespace's member, a local, a literal, an object expression or another input: `room.device(name)`.
- An **expression argument** is evaluated by the member against each item of the list the member follows, which is its `it`. In `room.devices.max(it.power)`, `it` is each device. Lexica's own module's expression parameters are those of `max`, `min` and `sum`.
- A **predicate argument** is an expression argument of any value, and the member receives its truthiness, a Boolean, for each item it evaluates it against: in `room.devices.where(it:["mode"])`, the device's setting is truthy wherever it is present, empty or not. Lexica's own module's predicate parameter is that of `where`.
- A **function argument** is a function value, an arrow function written as the argument or a function passed by its name, which the member calls with arguments of the types its **callback contract** declares, taking a result of the contract's result type. Preparation checks each function the value may be against the contract, and evaluation checks the member's arguments and the function's result. The member calls it only while its own invocation lasts, and a call after that fails. Lexica's own module has no function parameters, so `where`, `max`, `min` and `sum` take expression arguments, and an arrow function given to one is a validation error saying its parameter takes an expression argument, as `room.devices.where(it.is("active"))` is written instead; a module declares them.

A value argument can be declared **fixed**, where it selects something validation needs before evaluation, such as the event type whose members `on` offers or the predicate a verb asks.

A fixed argument is a string the expression's resolution settles, without evaluating any member or depending on an event: a literal, a bound parameter, a local or a conditional binding holding one, a local holding a `do` block whose locals and result all settle, a function parameter within a call's body, which is resolved with its arguments, and an `and`, an `or`, a conditional or a coalescing operator whose result they settle by the rules that evaluate it everywhere, as `device { let state = "active", lit = it.is(state) }` and `device.is(metered and "active" or "offline")` are.

A member's value is known only once it is evaluated, so an expression that needs one to settle is a validation error, as `if device.is("active") then "active" else "active" end` is; the side an expression does not take is validated and selects nothing, so a name only it holds is never looked up.

Because the kind is part of the signature, preparation validates every kind before evaluation, and evaluation records the dependencies of value, expression, predicate and function arguments.

<a id="simple-expressions"></a>

## Simple expressions

A **simple expression** is an expression allowed in a delimited value position:

- A member call's or local function call's argument.
- An indexer's key.
- The name expression in bracket property access.
- An interpolation in an interpolated string.

Simple expressions include values, references, arithmetic, comparisons, logical expressions, property accesses, indexers, function calls, and object expressions or interpolated strings whose contents are also simple. They also include a simple conditional: one `if` branch and one `else` branch, each containing one simple value.

```lexica
let calculate = function(degrees, offset) degrees - offset end
let adjusted = do
    let doubled = (sensor.temperature ?? 0) * 2
    return doubled + 1
end
return calculate(adjusted, if metered then 10 else 20 end)
```

<a id="simple-expressions-excluded-constructs"></a>

### Excluded constructs

A simple expression cannot contain a `do` block, a local declaration, a conditional binding, `return`, a function declaration, or a conditional beyond the simple form.

A function declaration is a syntax error there, as anywhere a function stands other than alone as a local's initializer, and so are a local declaration and `return` written where the value itself stands. The others are structure errors that ask for the value to be bound to a local first:

| Invalid expression | Reason |
| --- | --- |
| `calculate(do return 10 end)` | Contains a `do` block |
| `calculate(if let t = sensor.temperature then t else 0 end)` | Contains a conditional binding |
| `calculate(if metered then return 10 else return 20 end)` | Contains `return` |
| `$"Total: {do return 10 end}"` | Contains a `do` block |

<a id="simple-expressions-recursive-restrictions"></a>

### Recursive restrictions

The restrictions apply through parentheses, conditional tests and branches, nested calls, indexers, bracket property access, object fields and interpolations. Adding parentheses or line breaks does not change them.

`calculate((do return 10 end))` is refused. `calculate((if metered then 10 else 20 end))` is allowed.

A simple conditional cannot contain another conditional anywhere within it. An `elseif`, a nested conditional in a branch, and a conditional inside a call or interpolation within that branch are all refused.

<a id="simple-expressions-calling-a-function"></a>

### Calling a function

The restriction applies to what is written at the argument position. A function called there may use locals, `do` blocks, full conditionals and `return` in its own body.

`calculate(double(degrees))` can therefore be valid. `calculate(double)` passes a function itself and is a validation error.

<a id="simple-expressions-validation"></a>

### Validation

The grammar names these positions with `simple-expression`. Its productions can reach a parenthesized full expression, so structural validation also enforces the restrictions. It applies equally to parsed text and directly created definitions, and identifies the construct that violates them.
