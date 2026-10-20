# Functions

<a id="functions"></a>

A **function** names a calculation a script repeats. A script declares its own in one of two forms, holds each by a local, calls it by that local's name with its **arguments**, and passes, holds and returns it as a value within the script; none outlives the evaluation that made it. A member a module declares with arguments, as `room.device(name)`, is a **member function** instead, written after its receiver and specified by [members](members.md).

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

In this document:

1. [Declaring a function](#functions-declaring-one)
2. [Calling a function](#functions-calling-one)
3. [Function values](#functions-as-values)
4. [What a function sees](#functions-what-it-sees)
5. [Never recursive](#functions-never-recursive)
6. [Resolved for each call](#functions-resolved-for-each-call)
7. [What a call reads](#functions-watching)
8. [Functions passed to members](#functions-passed-to-members)

<a id="functions-declaring-one"></a>

## Declaring a function

A **regular function** is `function`, its **function parameters** in parentheses and its body, closed by `end`. Its body follows the rules of a [body](scripts.md#bodies): an expression alone, as `function(x) x * 2 end`, or locals and a `return`, which completes the body and gives the call its value.

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

Its function parameters are names of the function, two of one function never the same, visible in its body alone, where each hides an outer local, field or script parameter of its name; a [parameter reference](scripts.md#scripts-parameter-references) still reads the script parameter.

<a id="functions-calling-one"></a>

## Calling a function

`name(argument, …)` calls the function a local or a function parameter of that name holds, with as many arguments as it declares function parameters, `seven()` with none, each a [simple expression](expressions.md#simple-expressions) or an arrow function; each argument is evaluated once, from left to right, in the caller's scope, and the body then evaluates with each function parameter holding its argument. A call is a value a chain continues from, as `first(room).devices.count` does.

A function of a vocabulary keeps its own form, `it.device("lamp")`, with the arguments its signature takes. A name no local function has is a validation error, which gives the form with `it` where the implicit parameter has a member of that name, and so is a call of a local that holds a value, and a call given the wrong number of arguments.

<a id="functions-as-values"></a>

## Function values

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

## What a function sees

A function captures the locals, the implicit parameter and the object root where it is declared: its body reads them, its function parameters and its own locals, and never the caller's locals, so in `let a = 1`, `let f = function() a end` and a `do` block whose local `a` is 2 and that calls `f()`, the call gives 1. Its function parameters are ordinary ones, so an argument never replaces the implicit parameter or the object root it captured. Each evaluation captures them anew.

<a id="functions-never-recursive"></a>

## Never recursive

No function calls itself, directly, through another or through a function passed to it. A local's value sees neither its own local nor the locals after it, and resolution follows each call into the functions it may reach, so `let invoke = function(f) f(f) end` with `invoke(invoke)` is a validation error.

<a id="functions-resolved-for-each-call"></a>

## Resolved for each call

The declaration is checked for what no argument decides, its names, its scope and its function parameters; each call resolves the body of each function it may call against that call's argument types, so one function serves arguments of different types, and a function nothing calls is never resolved further. A call settles no fixed argument.

<a id="functions-watching"></a>

## What a call reads

A call reads what its arguments and the branches its body selects read, and a branch it does not select reads nothing. A call of a value that may be one of several functions reads what chose the function and what the one it called reads.

<a id="functions-passed-to-members"></a>

## Functions passed to members

A member function may declare a **function parameter**, whose argument is a function value: an arrow function written as the argument, or a function passed by its name. The member calls it only while its own invocation lasts, with the arguments its [callback contract](members.md#arguments) declares, as [arguments](members.md#arguments) set out.
