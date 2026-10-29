# Scripts

<a id="scripts"></a>

A **script** is a standalone piece of Nexo code: what a host reads, resolves against its vocabulary and evaluates. It reads its script parameters and its domain, and produces data. Each script stands alone, as a PowerShell script does: scripts never combine into one program, and no script calls another or shares its names.

Here a host binds the living room as the script parameter `room`, and the script reads it:

```nexo
let devices = room.devices
return {
    name = room.name,
    active = devices.where(it.active()).count,
    total = devices.count
}
```

Against the examples' home, where the living room holds a lamp that is on and a thermostat that is off, it gives:

```json
{ "name": "Living room", "active": 1, "total": 2 }
```

In this document:

1. [What a script is](#scripts-what-a-script-is)
2. [Script parameters and bindings](#scripts-script-parameters)
3. [Names and scope](#scripts-names-and-scope)
4. [The implicit parameter](#names-and-resolution-implicit-parameter-by-position)
5. [Bodies](#bodies)
6. [Locals](#locals)

<a id="scripts-what-a-script-is"></a>

## What a script is

A script is its [imports](modules.md#scripts-imports) and a [body](#bodies): one expression, or locals and the `return` that gives its result. Its text is its source, which [the lexical structure](lexical-structure.md) and [the grammar](grammar.md) read, and its JSON form is its [definition](../runtime/definition.md). The last member of its chain decides [what it gives](members.md#members-member-kinds-and-host-calls): most scripts give a value, which a host evaluates, and a script whose chain ends in a function the host invokes ends in a host call, which the host carries out.

A script reads three kinds of names: its script parameters, which its host binds; the names it declares itself, its locals, object fields, conditional bindings and function parameters; and its vocabulary's, the members, types and module namespaces of the modules it imports. How a host resolves and evaluates a script, the [host contract](../runtime/hosting.md) sets out.

<a id="scripts-script-parameters"></a>
<a id="names-and-resolution-parameters-and-roots"></a>

## Script parameters and bindings

A **script parameter** is a name a script reads and does not declare: `room` in `room.devices.count`. The host binds a value to each, its **binding**, and the script reads it wherever no name the script declares hides it, the same way inside object expressions and arguments as elsewhere. A binding may be a reference value or data: a number, a string, a Boolean, null, a list or an object, and a list or an object may hold reference values.

A script names its parameters and never holds their values, so one script serves every binding its host gives it. A script parameter is named by an identifier, a reserved word among them, which the script [selects with `~`](#names-and-reserved-words-referring-to-the-callers-binding), as `~as` and `~it`.

<a id="names-and-reserved-words-referring-to-the-callers-binding"></a>
<a id="scripts-parameter-references"></a>

### Selecting a script parameter

`~` directly before an identifier, a `script-parameter` in the [grammar](grammar.md#grammar-the-grammar), selects the script parameter of that name explicitly, whatever local, object field, conditional binding or function parameter of that name hides it. In `{ room = room.name, devices = ~room.devices.count }`, the object field `room` hides the parameter after it, and `~room` still reads the room the host bound.

`~` also selects a parameter named by a reserved word: `~as` and `~Home` read the parameters `as` and `Home`, which written alone would read the keyword and, in a script importing `Home`, the module's namespace. A parameter the host did not bind is a validation error.

The name must follow `~` directly, and `~` alone reads nothing, so it is a syntax error.

<a id="scripts-names-and-scope"></a>
<a id="names-and-scope"></a>
<a id="names-and-resolution"></a>
<a id="locals-resolution-and-diagnostics"></a>

## Names and scope

A name at the start of a chain, an **identifier**, reads the nearest visible local, object field, conditional binding or function parameter of that name. If none is visible, it reads the script parameter of that name, and resolution fails if the host bound none. A name read before a local of that name declared later in the same scope is a structure error, since it does not read a parameter there; an object field of that name written later leaves it reading the parameter.

`it` reads the [implicit parameter](#names-and-resolution-implicit-parameter-by-position), and the name of a module the script [imports](modules.md#scripts-imports) begins that module's [namespace](modules.md#namespaces). Members always have an explicit receiver, and equality always has both operands, so a reader needs no vocabulary knowledge to decide what a name applies to.

When the implicit parameter has a member of the name, the diagnostic suggests its receiver:

> No local in scope or binding is named 'climate'; write 'it.climate' for the member of the implicit parameter

<a id="names-and-resolution-implicit-parameter-by-position"></a>

## The implicit parameter

The **implicit parameter**, read as `it`, is the value the current expression is evaluated against. Where it stands decides what it is:

| Position | What `it` means |
| --- | --- |
| Outermost expression | No implicit parameter is available |
| Object expression following a value | The value it follows |
| Object expression following a list | The current item |
| Object expression following no value | The surrounding implicit parameter, if one exists |
| Value argument | The implicit parameter where the call is written |
| Expression or predicate argument | The item the member evaluates it against |
| Implicit body, a function argument written as an expression | The argument the member calls it with |
| Result projection of a host call | Each value its host supplies |
| Arrow function or function declared with `function` | The implicit parameter where it is written, which it captures |

In `room { warmth = it.climate?.temperature }`, `it` is the room.

In `room { climate = { warmth = it.climate?.temperature, humidity = it.climate?.humidity } }`, both nested object fields still read the room. The nested object groups object fields without changing the implicit parameter.

At the top level, `{ level = light.brightness, active = light.active() }` has no implicit parameter. Each object field reads a script parameter, a literal or another expression that does not require one.

`it.name`, `{ name = it.name }` and `light.dim({ to = it })` at the top level are errors because there is no implicit parameter.

<a id="names-and-resolution-one-parameter-model"></a>

### One parameter model

`it` is the name of the one parameter a body receives, and refers to that input value alone: never the object being built, which is `root`, the script's bindings, or a context of evaluation. A body is a projection, the object expression following a value or a list, or a host call's result projection; an expression or a predicate argument; or an implicit body. Each reads its input as a function of one parameter reads its parameter, and every other name where it is written, so these bodies follow one set of rules:

- **A body gives its own `it`.** A projection, an expression or a predicate argument, and an implicit body each give `it` the value it receives.
- **A nested body shadows it.** In `rooms { count = it.devices.where(it.active()).count }`, the `it` of `where`'s argument is each device, the room's out of its reach.
- **A plain object keeps it.** An object expression that follows no value does not receive an input, so its object fields read the `it` around it.
- **A function captures it.** An arrow function or a function declared with `function` gives names to its own parameters alone, and captures the `it` where it is written as it captures every name, so `rooms { larger = Home.rooms.where(r => r.floorArea > it.floorArea).count }` compares each room with the projected one.
- **A value argument reads it.** A value argument is evaluated where the call is written, against the `it` already there.
- **None is not a value.** `it` where no body gives one is an error.

Which arguments are bodies is the parameter's to say, by its kind, and lexical scope decides where `it` within one is its own, as [implicit bodies](functions.md#functions-implicit-bodies) set out. A body's result policy is its contract's own: an expression argument requires its declared type, a predicate argument gives its truthiness, and a function argument requires its callback contract's result type. These are three contracts, and `it` means the same in each. A projection stays an object expression, and is not a delegate.

<a id="names-and-resolution-projection-example"></a>

### A projection

An object expression following a list projects each item, which becomes `it` within it:

```nexo
room {
    // The room's name, whether it is occupied, and each of its devices.
    name = it.name,
    occupied = it.occupied(),
    devices = it.devices { name = it.name, active = it.active() }
}
```

<a id="bodies"></a>
<a id="calculations-and-reuse"></a>

## Bodies

A **body** produces one value. It is either a single expression, or an ordered sequence of locals followed by `return` and the result expression.

A script is a body. So is a `do … end` block, a conditional branch, and a local function's body.

```nexo
let warmth = sensor.temperature ?? 0
let margin = 1.5
return {
    cold = warmth + margin < 19,
    doubled = do
        let half = warmth / 2
        return half * 4
    end
}
```

<a id="bodies-result-forms"></a>

### Result forms

A single-expression body needs no `return`: `sensor.temperature` and each branch of `if metered then 1 else 2 end` are examples.

A body with locals must introduce its result with `return`. A body may also use `return` without locals, as in `return 0`.

Only locals may precede the result. An unused standalone calculation, such as `light.brightness` before `return 42`, is a syntax error:

> Only locals may precede a body's result.

A line break never ends an initializer and never continues one by itself, as [line structure](lexical-structure.md#line-structure) sets out: `let available = width` followed on the next line by `- padding * 2` is refused, since nothing encloses the subtraction, and `let available = (width` followed by `- padding * 2)` is one local declaration.

Bodies place local declarations one after another, each and the `return` on a line of its own, as [boundaries](lexical-structure.md#line-structure-boundaries) set out. Object expressions use the same local construct but separate entries with commas.

<a id="bodies-one-result-at-the-end"></a>

### One result at the end

The result must be a value, except the script's own body, whose result may be a [host call](members.md#members-host-calls-where-a-host-call-stands); a host call as the result of any other body is a validation error.

Nothing follows the result. A later local, a second `return`, or a `return` without a value is a syntax error. A result may itself be a conditional or `do` block, each of which produces its own body's value.

<a id="bodies-return-belongs-to-its-body"></a>

### Return belongs to its body

`return` completes the body it ends, never an enclosing body.

Where `let x` holds a conditional whose truthy branch declares `let n = 3` and gives `return n * 2`, and whose other branch gives `return 0`, the truthy branch returns 6 to the initializer, and a later `return x + 1` gives 7.

A `do` block's `return` similarly gives the block's value, and evaluation continues outside the block.

<a id="bodies-positions-and-scope"></a>

### Positions and scope

`return` stands at the end of a script's body, a `do` body, a function body or a conditional branch. It cannot appear among object fields.

A body's local is visible after its initializer, through later locals, the result and everything nested in them. It cannot read itself or a later local. `let a = b`, followed by `let b = 1` and `return a`, is a structure error rather than a read of the script parameter `b`.

Two locals in one body cannot share a name. A nested body may hide an enclosing name. A local accepts any name, including a reserved word, and is never reassigned.

<a id="bodies-ordered-evaluation"></a>

### Ordered evaluation

Every local runs once in declaration order each time its body runs, including unused locals. The result runs after them.

A failed local fails the body even if nothing uses it, and an evaluation reports the reads of every local it evaluated.

Object-expression locals instead run at first use; an unused object local does not run. See [Locals](#locals).

<a id="locals"></a>

## Locals

A local names an intermediate value with `let`. Later entries use that name, so the value is written and evaluated once.

```nexo
room {
    let devices = it.devices,

    name = it.name,
    rows = devices {
        name = it.name,
        sameRoom = it.room == room
    },
    hungriest = devices.max(it.power),
    occupied = it.occupied()
}
```

<a id="locals-declaration-and-use"></a>

### Declaration and use

An object expression writes its locals before its first object field. Each local is `let name = initializer`, followed by a comma. The object must still have at least one object field: `{ let x = 1 }` is a syntax error.

A local name can start a chain, take a projection, or supply an argument. A reserved local name uses `@name` when referenced. A local holding a value cannot be called: `items(…)` is a validation error.

Locals occur only in bodies and object expressions. A [simple expression](expressions.md#simple-expressions) does not hold a body, and an object expression inside one, a member's options object among them, declares no locals.

<a id="locals-sequential-scope"></a>

### Sequential scope

A local is visible after its initializer, through later locals, object fields and everything nested in them, including arguments. It is not visible in its own initializer or before its declaration.

If a name is declared as a local later in the same scope, an earlier bare reference is a structure error. It never falls back to the script parameter. Both of these are refused whatever the host binds:

- `{ let a = b, let b = 1, c = a }`
- `{ let n = n, a = 1 }`

`~` reads the script parameter explicitly, even before or beneath a same-named local: `{ let n = ~n + 1, value = n }` reads the bound `n`.

A local in a sibling or unrelated scope does not hide a script parameter. In `{ a = room { let n = 1, v = n }, b = n }`, object field `b` reads the script parameter `n`.

<a id="locals-duplicate-names-and-shadowing"></a>

### Duplicate names and shadowing

Two locals in one object expression cannot share a name. Neither can two object fields. Both are structure errors.

A local or object field can hide a name from an outer scope: a local, object field, conditional binding or script parameter. The nearest visible declaration wins; `~` still selects the script parameter. Reserved names are allowed.

An object field may reuse a local's name. Its initializer reads the local, then the object field hides it:

`room { let devices = it.devices, devices = devices.count, more = devices + 1 }`.

Here `devices` in `more` is the count object field.

<a id="locals-captured-implicit-parameter"></a>

### Captured implicit parameter

A local's `it` is the implicit parameter of the object expression declaring it, regardless of where the local is used. In the example, `it` inside `rows` is the current device, while `devices` remains the room's list.

<a id="locals-lazy-evaluation-in-objects"></a>

### Lazy evaluation in objects

Each evaluation of each object-expression application has its own locals. A local runs at most once, at its first use. An unused local never runs and reads nothing.

In `room.devices { let p = it.power, … }`, each device has its own `p`. The next evaluation creates fresh locals.

A [body's](#bodies) locals differ: they run in order, even when unused. All locals are still resolved and validated before evaluation.

<a id="locals-output"></a>

### Output

A local is not an object field and is never included in the result. It may hold values that a result cannot contain, such as a device or a list of devices.
