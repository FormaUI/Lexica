# Bodies, locals and functions

<a id="calculations-and-reuse"></a>

In this document: [Bodies](#bodies) · [Locals](#locals) · [Functions](#functions).

<a id="bodies"></a>

## Bodies

A **body** produces one value. It is either a single expression, or an ordered sequence of locals followed by `return` and the result expression.

The expression a source writes is a body. So is a `do … end` block, a conditional branch, and a local function's body.

```lexica
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

Line breaks do not end an initializer. `let available = width` followed on the next line by `- padding * 2` is still one local declaration.

Bodies place local declarations one after another. Object expressions use the same local construct but separate entries with commas.

<a id="bodies-one-result-at-the-end"></a>

### One result at the end

The result must be a value. An event source, action or behavior is a validation error here.

Nothing follows the result. A later local, a second `return`, or a `return` without a value is a syntax error. A result may itself be a conditional or `do` block, each of which produces its own body's value.

<a id="bodies-return-belongs-to-its-body"></a>

### Return belongs to its body

`return` completes the body it ends, never an enclosing body.

In `let x = if wide then let n = 3 return n * 2 else return 0 end`, the truthy branch returns 6 to the initializer. The expression `return x + 1` then gives 7.

A `do` block's `return` similarly gives the block's value, and evaluation continues outside the block.

<a id="bodies-conditional-branch-style"></a>

### Conditional branch style

Within one conditional, either every branch uses `return` or none does. If one branch declares locals, all its sibling branches must use `return`.

Mixing the styles is a syntax error:

> All branches of this conditional must give their results with return, or none of them

A nested conditional chooses its own style. An `else` whose expression is a conditional, `else if … end`, may follow branches of expressions with a conditional of either style, and may follow branches that use `return` with one whose branches use `return` too, the definition an `elseif` gives, which the canonical text writes as `elseif`. After branches that use `return`, an `else if … end` of expression branches is a syntax error.

<a id="bodies-positions-and-scope"></a>

### Positions and scope

`return` stands at the end of the root expression's body, a `do` body, a function body or a conditional branch. It cannot appear among object fields.

A body's local is visible after its initializer, through later locals, the result and everything nested in them. It cannot read itself or a later local. `let a = b let b = 1 return a` is a structure error rather than a read of the caller's `b`.

Two locals in one body cannot share a name. A nested body may hide an enclosing name. A local accepts any name, including a reserved word, and is never reassigned.

<a id="bodies-ordered-evaluation"></a>

### Ordered evaluation

Every local runs once in declaration order each time its body runs, including unused locals. The result runs after them.

A failed local fails the body even if nothing uses it. A watch follows every evaluated local's dependencies.

Object-expression locals instead run at first use; an unused object local does not run. See [Locals](#locals).

<a id="bodies-using-a-bodys-value"></a>

### Using a body's value

A `do` block or conditional must be grouped when used as an operand. Neither can be a chain receiver, grouped or not. Bind its value to a local before continuing a chain.

A [simple expression](access-and-calls.md#simple-expressions) cannot contain a `do` block or a full conditional. An argument that needs such a calculation uses a local holding its value.

<a id="bodies-fixed-arguments"></a>

### Fixed arguments

A local holding a `do` block can settle a fixed argument only if every local evaluated in that block and its result can settle it. Reads made by unused body locals cannot be discarded.

For example, `let state = do let chosen = "active" return chosen end` may supply `device.is(state)`. A body local whose value cannot settle a fixed argument, as one that reads a member or holds an interpolated string, prevents the block from settling one.

<a id="bodies-definition-and-canonical-text"></a>

### Definition and canonical text

A body with explicit `return` is a `body` node containing ordered `locals` and a `result`. A body containing just an expression is that expression's own node, except a `do` block's: a `do` block is always a `do` node holding its body, so `do 7 end` is a `do` node whose body is the literal's node. A `body` node stands only as the root expression's, a `do` block's, a function's or a conditional branch's body.

Within one conditional, branches are all `body` nodes or none are; a branch that is a `do` block is an implicit branch, whose result is its `do` node. The alternative may itself be a conditional: after branches that use `return`, one whose branches use `return` too, as an `elseif` gives; after expression branches, one of either style.

Canonical text places each body local and its result on separate lines. A conditional with implicit results and no `elseif` stays on one line, and a `do` block as its branch is written without parentheses: `if w then do 1 end else 2 end`. Explicit-return branches are indented within their clauses, and `end` stands on its own line.

<a id="locals"></a>

## Locals

A local names an intermediate value with `let`. Later entries use that name, so the value is written and evaluated once.

```lexica
room {
    let devices = it.devices,

    name = it.name,
    rows = devices {
        name = it.name,
        sameRoom = it.room == room
    },
    hungriest = devices.max(it.power),
    occupied = it.is("occupied")
}
```

<a id="locals-declaration-and-use"></a>

### Declaration and use

An object expression writes its locals before its first field. Each local is `let name = initializer`, followed by a comma. The object must still have at least one field: `{ let x = 1 }` is a syntax error.

A local name can start a chain, take a projection, or supply an argument. A reserved local name uses `@name` when referenced. A local holding a value cannot be called: `items(…)` is a validation error.

Locals occur only in bodies and object expressions. A [simple expression](access-and-calls.md#simple-expressions) holds no body, and an object expression inside one, a member's options object among them, declares no locals.

<a id="locals-sequential-scope"></a>

### Sequential scope

A local is visible after its initializer, through later locals, fields and everything nested in them, including arguments. It is not visible in its own initializer or before its declaration.

If a name is declared as a local later in the same scope, an earlier bare reference is a structure error. It never falls back to the caller's binding. Both of these are refused regardless of caller bindings:

- `{ let a = b, let b = 1, c = a }`
- `{ let n = n, a = 1 }`

Use `~name` to read the caller's binding explicitly, even before or beneath a same-named local. `{ let n = ~n + 1, value = n }` reads the supplied `n`. A missing explicit caller binding is a validation error.

A local in a sibling or unrelated scope does not hide a caller binding. In `{ a = room { let n = 1, v = n }, b = n }`, field `b` reads the caller's `n`.

<a id="locals-resolution-and-diagnostics"></a>

### Resolution and diagnostics

An [identifier](names-and-scope.md#names-and-reserved-words) reads the nearest visible local, field, conditional binding or function parameter of that name. If none is visible, it reads the value the caller passed under that name, and preparation fails if the caller passed none; a reference before a local of its name declared later in the same scope is refused instead, as [sequential scope](#locals-sequential-scope) sets out.

When the implicit parameter has a member of that name, the diagnostic suggests its receiver:

> No local in scope or binding is named 'climate'; write 'it.climate' for the member of the implicit parameter

<a id="locals-duplicate-names-and-shadowing"></a>

### Duplicate names and shadowing

Two locals in one object expression cannot share a name. Neither can two fields. Both are structure errors.

A local or field can hide a name from an outer scope: a local, field, conditional binding or caller binding. The nearest visible declaration wins; `~name` still reads the caller binding. Reserved names are allowed.

A field may reuse a local's name. Its initializer reads the local, then the field hides it:

`room { let devices = it.devices, devices = devices.count, more = devices + 1 }`.

Here `items` in `more` is the count field.

<a id="locals-fields-as-names"></a>

### Fields as names

A field's name becomes visible after its value, throughout later fields and expressions nested in them. Its own initializer reads the enclosing name.

After `let count = 10`, the object `{ before = count, count = count + 1, after = count }` gives 10, 11 and 11.

A field reference reuses the value and dependencies already obtained; it evaluates nothing again. Each application of a projection, including each list item, has its own fields. Outside the object expression, the name resumes its enclosing meaning.

<a id="locals-the-object-root"></a>

### The object root

Written inside an object expression, `root` refers to the outermost object being built, the object root. A nested object reads the object root's fields through it, even where a nearer field has the same name:

```lexica
{
    bar = 4,
    inner = {
        bar = 2,
        nearest = bar,        // 2
        outermost = root.bar  // 4
    }
}
```

- **Where it exists.** `root` must be written inside an object expression, and elsewhere is a structure error; a function declared outside every object expression cannot use it, even when it is called inside one. Each evaluation and each event builds a new object root. When `rows { … }` has no enclosing object expression, each item gets its own object root. Nested objects and projections retain the enclosing object root, and an options object follows the same rules, as [Options](access-and-calls.md#arguments-options) describes.
- **Which fields it has.** At each reference, only fields of the object root whose initializers have already completed in the declared field order are accessible. The field currently being initialized and later fields are unavailable:

```lexica
{
    inner = {
        value = root.inner // Error: inner is still being built.
    }
}
```

- **Aliases and functions.** An alias, as `let r = root`, retains the set of fields available where it was declared, even when used later. A function that uses `root` itself captures the fields available where the function is declared, while a function parameter given `root` receives those available where the call passes it.
- **No extra work.** `root.bar` reuses the value already computed for `bar`, and nothing is evaluated again; a watch treats it as that field.
- **Not part of a result.** A reference to the object root may be held in a local, passed to a function and returned from one, but cannot itself be included in the expression's result data: `{ copy = root }` is a validation error. Read a field instead, as `root.bar`.

<a id="locals-object-root-references"></a>

### Object root references

A function's result keeps the fields of the reference it returns. After `let identity = function(value) value end`, `identity(root).a` reads `a` wherever `a` is available where the call passes `root`, and `{ copy = identity(root) }` is refused as `{ copy = root }` is.

Where a conditional or `??` can give either of two references, both must refer to the same object root with the same fields available; nullability combines as usual, so `if wide then root else null end` gives a reference that can be null, whose fields are read with `?.`. Any other pair is a validation error, as branches of different types are.

<a id="locals-captured-implicit-parameter"></a>

### Captured implicit parameter

A local's `it` is the implicit parameter of the object expression declaring it, regardless of where the local is used. In the example, `it` inside `rows` is the current device, while `devices` remains the room's list.

<a id="locals-lazy-evaluation-in-objects"></a>

### Lazy evaluation in objects

Each evaluation of each object-expression application has its own locals. A local runs at most once, at its first use. An unused local never runs and contributes no observation dependencies.

In `room.devices { let p = it.power, … }`, each device has its own `p`. The next evaluation creates fresh locals.

A [body's](#bodies) locals differ: they run in order, even when unused. All locals are still resolved and validated before evaluation.

<a id="locals-output"></a>

### Output

A local is not a field and is never included in the result. It may hold values that a result cannot contain, such as a device or a list of devices.

<a id="functions"></a>

## Functions

A **function** names a calculation an expression repeats. It is declared in one of two forms, held by a local, called by that local's name with its **arguments**, and passed, held and returned as a value within the expression.

```lexica
let shortfall = function(place, wanted)
    let warmth = place.climate?.temperature ?? 0
    return wanted - warmth
end
return {
    living = shortfall(living, 21),
    bedroom = shortfall(bedroom, 18)
}
```

<a id="functions-declaring-one"></a>

### Declaring one

A **regular function** is `function`, its **function parameters** in parentheses and its body, closed by `end`. Its body follows the rules of a [body](#bodies): an expression alone, as `function(x) x * 2 end`, or locals and a `return`, which completes the body and gives the call its value.

An **arrow function** is its parameters, `=>` and one simple expression, whose value is its result:

```lexica
let answer = () => 42
let isActive = device => device.is("active")
let isLit = (light) => light.brightness > 0
let byPower = (left, right) => left.power - right.power
return answer()
```

Parentheses are optional for exactly one parameter and required for none or several. An arrow function declares no locals and holds no body, so `x => let y = …` and `x => do … end` are refused, and so is `x => y => x + y`, whose body is no simple expression; a function that holds more is a regular function bound to a local and passed by its name. Laying the expression out across lines changes nothing.

Either form is a local's initializer, of a body or of an object expression, and an arrow function is also an argument, as `apply(device => device.is("active"), lamp)` is. Neither stands anywhere else: a field, an operand, a conditional's branch and a result hold neither, and a regular function written directly as an argument is a syntax error:

> A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.

A definition holding either where text could not write it is a structure error. An object expression's function local is in scope within it, as any local is, and is no field.

Its function parameters are names of the function, two of one function never the same, visible in its body alone, where each hides an outer local, field or caller binding of its name; `~name` still reads the caller's binding.

<a id="functions-calling-one"></a>

### Calling one

`name(argument, …)` calls the function a local or a function parameter of that name holds, with as many arguments as it declares function parameters, `seven()` with none, each a [simple expression](access-and-calls.md#simple-expressions) or an arrow function; each argument is evaluated once, from left to right, in the caller's scope, and the body then evaluates with each function parameter holding its argument. A call is a value a chain continues from, as `first(room).devices.count` does.

A function of a vocabulary keeps its own form, `it.device("lamp")`, with the arguments its signature takes. A name no local function has is a validation error, which gives the form with `it` where the implicit parameter has a member of that name, and so is a call of a local that holds a value, and a call given the wrong number of arguments.

<a id="functions-as-values"></a>

### Functions as values

A function's name read without a call is a **function value**, held by a local, passed as an argument and returned by a function, as either form is:

```lexica
let isActive = device => device.is("active")
let shown = isActive
let apply = function(test, device) test(device) end
let getTest = () => shown
let test = getTest()
return apply(test, lamp)
```

A conditional or a coalescing operator may choose between functions, as `let pick = if metered then shortfall else surplus end` does: a call of `pick` is checked against each function it may be, and their results merge by the rules [branches](expressions.md#conditionals) follow, a call whose functions give no one type a validation error. A value that may be null is never called; bind a function to call in its place first, as `let call = pick ?? surplus` does.

A function value is used within the expression, and the expression's result holds data alone: a field or a result that would hold a function is a validation error, and a function is never compared, interpolated, converted or given to a member's value parameter.

<a id="functions-what-it-sees"></a>

### What it sees

A function captures the locals, the implicit parameter and the object root where it is declared: its body reads them, its function parameters and its own locals, and never the caller's locals, so in `let a = 1`, `let f = function() a end` and a `do` block whose local `a` is 2 and that calls `f()`, the call gives 1. Its function parameters are ordinary ones, so an argument never replaces the implicit parameter or the object root it captured. A watch's evaluation captures them anew each time.

<a id="functions-never-recursive"></a>

### Never recursive

No function calls itself, directly, through another or through a function passed to it. A local's value sees neither its own local nor the locals after it, and preparation follows each call into the functions it may reach, so `let invoke = function(f) f(f) end` with `invoke(invoke)` is a validation error.

<a id="functions-resolved-for-each-call"></a>

### Resolved for each call

The declaration is checked for what no argument decides, its names, its scope and its function parameters; each call resolves the body of each function it may call against that call's argument types, so one function serves arguments of different types, and a function nothing calls is never resolved further. A call settles no fixed argument.

<a id="functions-watching"></a>

### Watching

A call reads what its arguments and the branches its body selects read, and a branch it does not select reads nothing. A call of a value that may be one of several functions reads what chose the function and what the one it called reads.

<a id="functions-definition"></a>

### Definition

A function is a `function` node of its function parameters and its body, and an arrow function one marked `arrow: true`, whose body is its expression and is validated as a simple expression; a call is a `functionCall` node of the name and its arguments.
