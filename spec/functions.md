# Functions

<a id="functions"></a>

A **function** names a calculation a script repeats. A script declares its own in one of two forms, holds each by a local, calls it by that local's name with its **arguments**, and passes, holds and returns it as a value within the script; none outlives the evaluation that made it. A member a module declares with arguments, as `room.device(name)`, is a **member function** instead, written after its receiver and specified by [members](members.md), and a script passes a module's function as a value by its [reference](#functions-module-delegates).

```nexo
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
3. [Delegates](#functions-delegates)
4. [Module delegates](#functions-module-delegates)
5. [What a function sees](#functions-what-it-sees)
6. [Never recursive](#functions-never-recursive)
7. [Resolved for each call](#functions-resolved-for-each-call)
8. [What a call reads](#functions-watching)
9. [Functions passed to members](#functions-passed-to-members)
10. [Implicit bodies](#functions-implicit-bodies)

<a id="functions-declaring-one"></a>

## Declaring a function

A **regular function** is `function`, its **function parameters** in parentheses and its body, closed by `end`. Its body follows the rules of a [body](scripts.md#bodies): an expression alone, as `function(x) x * 2 end`, or locals and a `return`, which completes the body and gives the call its value.

An **arrow function** is its parameters, `=>` and one simple expression, whose value is its result:

```nexo
let answer = () => 42
let isActive = device => device.active()
let isLit = (light) => light.brightness > 0
let byPower = (left, right) => left.power - right.power
return answer()
```

Parentheses are optional for exactly one parameter and required for none or several. An arrow function declares no locals and does not hold a body, so `x => let y = …` and `x => do … end` are refused, and so is `x => y => x + y`, whose body is not a simple expression; a function that holds more is a regular function bound to a local and passed by its name. Laying the expression out across lines changes nothing.

Either form is a local's initializer, of a body or of an object expression, and an arrow function is also an argument, as `apply(device => device.active(), lamp)` is. Neither stands anywhere else: an object field, an operand, a conditional's branch and a result hold neither, and a regular function written directly as an argument is a syntax error:

> A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.

A definition holding either where text could not write it is a structure error. An object expression's function local is in scope within it, as any local is, and is not an object field.

Its function parameters are names of the function, two of one function never the same, visible in its body alone, where each hides an outer local, object field or script parameter of its name; [`~`](scripts.md#scripts-parameter-references) still selects the script parameter.

<a id="functions-calling-one"></a>

## Calling a function

`name(argument, …)` calls the function a local or a function parameter of that name holds, with as many arguments as it declares function parameters, `seven()` with none, each a [simple expression](expressions.md#simple-expressions) or an arrow function; each argument is evaluated once, from left to right, in the caller's scope, and the body then evaluates with each function parameter holding its argument; a call of a [function reference](#functions-module-functions) evaluates its arguments as the reference's qualified form does, so after `let keep = pantry.keep`, `keep(word, it.size > 2)` passes the implicit body `pantry.keep(word, it.size > 2)` passes, and a reference held in a local is called by the rules of the member it names. A call is a value a chain continues from, as `first(room).devices.count` does.

A function of a vocabulary keeps its own form, `it.device("lamp")`, with the arguments its signature takes. A name that no local function has is a validation error, which gives the form with `it` where the implicit parameter has a member of that name, and so is a call of a local that holds a value, and a call given the wrong number of arguments.

<a id="functions-as-values"></a>
<a id="functions-delegates"></a>

## Delegates

A function's name read without a call is a **delegate**, a callable value representing the function together with what invoking it needs, held by a local, passed as an argument and returned by a function, as either form is:

```nexo
let isActive = device => device.active()
let shown = isActive
let apply = function(test, device) test(device) end
let getTest = () => shown
let test = getTest()
return apply(test, lamp)
```

A delegate of a function the script declares is a **script delegate**, which holds the function's [captured scope](#functions-what-it-sees); one of a module's function is a **module delegate**, which its [function reference](#functions-module-delegates) produces. Every rule in this section holds for both alike.

A conditional or a coalescing operator may choose between delegates, as `let pick = if metered then shortfall else surplus end` does: a call of `pick` is checked against each function it may be, and their results merge by the rules [branches](expressions.md#conditionals) follow, a call whose functions give no one type a validation error. A value that may be null is never called; bind a delegate to call in its place first, as `let call = pick ?? surplus` does.

A delegate is used within the expression, and the expression's result holds data alone: an object field or a result that would hold a delegate is a validation error, and a delegate is never compared, interpolated, converted or given to a member's value parameter.

<a id="functions-module-functions"></a>
<a id="functions-module-delegates"></a>

## Module delegates

A function a module declares, read through the module's [namespace](modules.md#namespaces) without a call, is a **function reference**, which produces a module delegate, a delegate as any other. It takes the arguments its [qualified form](modules.md#namespaces-qualified-access) takes, its receiver first where it has one and its own arguments after it, so `Home.active` is the function `device.active()` calls, taking a device, and `Home.device` the one `room.device(name)` calls, taking a room and a name:

```nexo
let find = Home.device
return {
    lit = room.anyDevice(Home.active),
    active = room.devices.where(Home.active).count,
    found = find(room, "lamp")?.name
}
```

- **The declaration it names.** A reference names one declaration, whose implementation, result type, `updates` and observations every call of it follows, as its qualified form's call does, and it names it where it is written, from what that place gives it alone. Passed to a member's function parameter, it names the declaration of its name whose receiver and parameters take the arguments the parameter's callback contract declares, so `room.anyDevice(Home.active)` names `Device`'s `active`, the one a function of a device takes; anywhere else, a local's initializer among them, it names the module's one function of its name, and no later use of the local selects it. So `let test = Home.active` and `room.anyDevice(test)` name the same declaration as `room.anyDevice(Home.active)` where `Home` declares one `active`, and where it declares `active` on unrelated receivers too, the initializer is refused as ambiguous while `room.anyDevice(Home.active)` still names `Device`'s. A reference no declaration takes is a validation error naming the module's declarations of its name, and one that several take is refused as ambiguous where it is written, the error giving an arrow function or an implicit body, whose receiver's type selects one, in its place.
- **Its calls.** A call of a reference is its qualified form's call, wherever the reference was held, passed or chosen, so `find(room, "lamp")` after `let find = Home.device` is `Home.device(room, "lamp")`: its receiver argument is evaluated first, and a null one answers null without evaluating the function's own arguments or invoking it, so `find(nothing, readName())` never calls the local function `readName` where `nothing` is null. A call of a delegate that may be a module delegate or a script delegate evaluates its receiver argument first either way and skips the rest only where it is the module delegate. Its type is nullable where its receiver argument's is.
- **A function the evaluator invokes.** A property has no reference, since it is read where it is written, so `Home.name` written without a call is a validation error giving its qualified form, `Home.name(device)`; a module member that is a property is read, as `Home.rooms` is. A host call has none, since the evaluator never invokes one, and neither does a function of Nexo's own module, which has no namespace.
- **Read where it is written.** A reference is resolved where it is written, and creating one reads nothing and invokes nothing; each call of it reads what its declaration says, as [what a call reads](#functions-watching) sets out.
- **Never a bare name.** A name alone reads the local, object field, function parameter or script parameter of its name, as every name does, so `room.anyDevice(active)` reads a local named `active`, and a module's function is reached through its namespace alone.
- **An extension's function.** A function an extension declares is never reached through a namespace. Accessed through its extension without a call, `device:Device.active` is a reference bound to its receiver, which is evaluated and captured once when the reference is created, and takes the function's own arguments alone, as [extension access](extensions.md#extensions-access) sets out; where the receiver is supplied later, an arrow function writes it, `d => d:Device.active()`.

<a id="functions-what-it-sees"></a>

## What a function sees

A script delegate captures the locals, the implicit parameter and the object root where its function is declared, all three its **captured scope**: its body reads them, its function parameters and its own locals, and never the caller's locals, so in `let a = 1`, `let f = function() a end` and a `do` block whose local `a` is 2 and that calls `f()`, the call gives 1. Its function parameters are ordinary ones, so an argument never replaces the implicit parameter or the object root it captured. Each evaluation captures them anew.

<a id="functions-never-recursive"></a>

## Never recursive

No function calls itself, directly, through another or through a function passed to it. A local's value sees neither its own local nor the locals after it, and resolution follows each call into the functions it may reach, so `let invoke = function(f) f(f) end` with `invoke(invoke)` is a validation error.

<a id="functions-resolved-for-each-call"></a>

## Resolved for each call

The declaration is checked for what no argument decides, its names, its scope and its function parameters; each call resolves the body of each function it may call against that call's argument types, so one function serves arguments of different types, and a function nothing calls is never resolved further. A call never settles a fixed argument.

<a id="functions-watching"></a>

## What a call reads

A call reads what its arguments and the branches its body selects read, and a branch it does not select reads nothing. A call of a value that may be one of several functions reads what chose the function and what the one it called reads. A call of a function reference reads what its declaration's `updates` say, its observations included, as a call of its qualified form does. Creating a delegate, a function reference's among them, or the callback of an implicit body reads nothing.

<a id="functions-passed-to-members"></a>

## Functions passed to members

A member function may declare a **function parameter**, whose argument is a function: an arrow function written as the argument, a delegate a name holds, a [function reference](#functions-module-delegates), or, where its callback contract takes one argument, an [implicit body](#functions-implicit-bodies). An expression or a predicate argument takes the same delegates, of the item, beside its body, as [argument kinds](members.md#arguments-kinds) set out. The member receives each as a **callback**, a callable supplied to it for it to invoke, which the evaluator creates from the delegate or the argument's body, subject to the member's contract and invocation lifetime: the member calls it only while its own invocation lasts, with the arguments its [callback contract](members.md#arguments-kinds) declares, as [argument kinds](members.md#arguments-kinds) set out. Nexo's own module declares none, so a module declares the members that take one for its own domain, as the home's `room.anyDevice(test)` takes a test of a device. A function or a body answering a value of `Any`, a reference whose declaration answers one among them, is accepted where the contract declares its result's type, and each value it answers is checked against that type when it is evaluated, as [assignability](types.md#types-assignability) sets out.

<a id="functions-implicit-bodies"></a>

## Implicit bodies

A function parameter whose callback contract takes one argument also takes an **implicit body**: an argument written as an expression that reads `it`, which the evaluator evaluates against the one argument the callback is called with, its `it`. The member receives the callback the evaluator wraps around it, never the expression, so `room.anyDevice(it.battery != null)` answers as `room.anyDevice(d => d.battery != null)` does.

- **How it is recognized.** Resolution decides it by lexical scope, for an argument given to a function parameter whose callback contract takes exactly one argument:
  - An arrow function is passed as it is, and keeps the implicit parameter of the place it is written, as every arrow function does.
  - Any other argument is an implicit body where `it` occurs in the argument's own scope: outside every scope within it that gives `it` a value of its own, an object expression following a value or a list, an expression or a predicate argument, and another implicit body. An `it` within an arrow function the argument holds is in the argument's scope, since the arrow function keeps the `it` of the place it is written.
  - An argument with no `it` in its own scope is passed as it is, so it is a delegate, and a name holding anything else is a validation error, as `room.anyDevice(metered)` is for a Boolean `metered`.
- **What it sees.** Its `it` is the argument the member calls its callback with, and every other name it reads, a local, an object field, a function parameter, a script parameter or `root`, is read where it is written, as a script delegate captures its scope where its function is declared. It is one simple expression, as every argument is, so it declares no locals.
- **When it is evaluated.** Each call evaluates it anew against that call's argument, while the member's invocation lasts, and a member that never calls it never evaluates it, so it reads only what the calls the member makes read.
- **Its type.** It resolves as an arrow function's body does, its `it` of the type the callback contract gives its argument, and its result is checked against the contract's result type.
- **In the definition.** It is recorded as written, one of its call's argument nodes, with no node of its own, and its canonical text is its expression: whether an argument is an implicit body is the vocabulary's to say, and a definition does not know any vocabulary. The resolution records which arguments are implicit bodies, so an evaluator and a tool read the interpretation from it.

An arrow function given to the same parameter follows the rules of every arrow function: its `it` is the implicit parameter where it is written, so `room.anyDevice(d => it.active())` at the top level, which has none, is an error.
