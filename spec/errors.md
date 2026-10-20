# Errors and diagnostics

<a id="errors-and-diagnostics"></a>

An absent or unavailable value is null. Invalid syntax, an invalid definition or binding, an invalid request, an invalid module and an evaluation failure are errors, of the kinds `syntax`, `structure`, `validation`, `module` and `evaluation`. `try` handles only a cast or conversion rejecting its value.

In this document: [Absence and unavailable values](#absence-and-unavailable-values) · [Syntax errors](#syntax-errors) · [Structure errors](#structure-errors) · [Preparation and type errors](#preparation-and-type-errors) · [Evaluation errors](#evaluation-errors).

<a id="absence-and-unavailable-values"></a>

## Absence and unavailable values

| Situation | Result |
| --- | --- |
| A member finds nothing of what it looks for, as `room.device(name)` finds no device | null, or an empty list for a member that answers a list, as the member documents |
| A value a member reads is unavailable, as `sensor.temperature` before a first reading | null, as the member documents |

<a id="syntax-errors"></a>

## Syntax errors

| Situation | Result |
| --- | --- |
| Text that does not follow the syntax | A syntax error, with its position |
| An argument written as a named one, as `relativeTo = other` | A syntax error, giving a member call the form of an options object |
| A comparison chain whose operators point two ways | A syntax error at the operator that turns it |
| `@` in a declaration or before a field's or a member's name, `@` before a name that is no reserved word, or `@` before no word | A syntax error giving the form to write |
| A keyword where a value stands | A syntax error giving the reserved reference; `then`, `elseif`, `else` and `end` give the value expected instead: `Expected a value, found 'then'` |
| A conditional without its `end`, a conditional whose branches give their results in two styles, anything after a body's result, or a `return` with no value | A syntax error |
| Locals whose body's result has no `return` | A syntax error: `Introduce the body's result with return.` |
| An expression no local holds before a body's `return` | A syntax error: `Only locals may precede a body's result.` |
| A function that is no local's initializer, or an arrow function that is neither that nor an argument | A syntax error in text, and a structure error in a definition |
| A regular function written directly as an argument | A syntax error in text, and a structure error in a definition: `A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.` |
| An arrow function whose body is no simple expression | A syntax error in text, and a structure error in a definition, saying its body is a simple expression |
| A conditional or a `do` block that is the receiver of a chain | A syntax error, or a structure error in a definition, saying to bind its value first |
| An interpolated string with a space after its `$`, an interpolation with no expression, or a lone `}` in its text | A syntax error at what is written so |
| A line break written in an inline string, raw or not and interpolated or not | A syntax error at the line break, suggesting `\n` or a block |
| A block whose opening delimiter has anything after it on its line, that is never closed, whose closing run is longer than its delimiter, whose text holds a run of quotes as long as its delimiter, or one of whose lines lacks its margin | A syntax error naming the delimiter, the run or the line, a run suggesting a longer delimiter |
| An interpolation holding a line break, a line comment or a block, or one beginning with an object expression | A syntax error, saying an interpolation stands on one line or suggesting the group `{({ … })}` |

<a id="structure-errors"></a>

## Structure errors

| Situation | Result |
| --- | --- |
| A definition that does not follow its structure | A structure error, with its node's location |
| A do block, a local, a conditional binding, a `return`, or a conditional beyond an if branch and an else branch of simple values, within an argument, an indexer's key, a bracket property access or an interpolation | A structure error naming the part, which a local holds first |
| A reserved reference, or a definition's local, that no local or field in scope answers | A structure error: `No local or field named 'it' is in scope. Use '~it' to read the caller's binding.` |
| A function calling itself or one declared after it, or two parameters of one name | A structure error |
| A body anywhere but the root expression's, a do block's, a function's or a conditional branch's | A structure error: `A body is the root expression's, a do block's, a function's or a conditional branch's, and stands nowhere else` |
| A cast in a definition whose target is none text could write | A structure error at the target |
| A `root` written outside every object expression | A structure error: `'root' refers to the outermost object being built, and no object expression encloses it here` |
| A numeric literal no finite number holds, as `1e999`, in text or in a definition | A structure error: `A literal is a string, a finite number, a Boolean or null` |
| Bindings that are no plain object, a binding not named by a letter followed by letters and digits, or one that is no node or data | A structure error naming the binding, as `A binding is named by a letter followed by letters and digits` |

A module whose declarations break the declaration contract, or whose names registration finds taken, fails with an error of its own kind, `module`, when it is created or registered, naming the module and the declaration.

<a id="preparation-and-type-errors"></a>

## Preparation and type errors

| Situation | Result |
| --- | --- |
| A misspelled member or extension, or a parameter the caller did not bind | A validation error, with its location |
| A fixed argument preparation cannot settle | A validation error: `The argument 'name' of 'is' selects from the vocabulary, so it is a string the expression's resolution settles without evaluating a member, …` |
| An access or a call written with `.` whose receiver can be null | A validation error giving the form with `?.` |
| A name no local or field in scope has | A validation error, giving the form with `it` where the implicit parameter has a member of that name |
| A member written in a form its declaration does not take, an argument that does not supply its input, or more arguments than it takes | A validation error giving the form, the input or the number of arguments it takes |
| A cast to a type that is no node, or of a target that can never be of its type | A validation error naming the types |
| An equality of two values whose types fit neither way, or of a value that is no string, number, Boolean or node with one that is not null | A validation error naming the types, and the test to write where a value is compared with the name of one of its Boolean members |
| An operand of `and`, `or` or `not`, a condition or a conditional binding of what is no value | A validation error naming what it is |
| An arithmetic operand that can be null, or that is no number | A validation error naming the operand, and the fallback to give it |
| A call no local function answers, a call of a local holding a value or a function that may be null, a call given the wrong number of arguments, or one whose functions give no one type | A validation error naming the function |
| A call that reaches a function within its own call, through a function passed to it | A validation error |
| A field or a result that would hold a function, or a function given to a member's value parameter | A validation error |
| A function given to a function parameter of another number of parameters, of a result of another type, or that may be null, or an arrow function given to an expression parameter | A validation error naming the parameter |
| An interpolation of a value that can be null, or of no string or number | A validation error naming the interpolation, and the fallback or the conversion to give it |
| A comparison operand that can be null, or that is no number | A validation error naming the operand, and the fallback to give it |
| An `and` or an `or` whose operands give values no one type holds | A validation error naming them, and the conditional to write where null is an acceptable alternative |
| Branches of different types | A validation error naming the types |
| A receiver, an argument, an expression or a binding of the wrong type, an argument of the wrong kind, or a missing required one | A validation error naming where, the expected type and the type found |
| A result that would contain a node or an event source | A validation error |
| A field read through `root` whose initializer has not completed where `root` is written | A validation error naming the fields completed there |
| A read, by its name or through `root`, of an option its member declares as an expression or a predicate | A validation error: `Option 'by' is an expression evaluated by the member against the implicit parameter it supplies; it has no single value to read here` |
| A field or a result that would hold `root` | A validation error: `The field 'copy' would hold root, the object being built, which no result holds; read its fields, as root.name` |
| A request used as another kind: reading or watching an event source, subscribing to a value, executing a value request, or reading an action or a behavior | A validation error |
| An action or a behavior inside a value request, an argument or another request's object expression | A validation error |

<a id="evaluation-errors"></a>

## Evaluation errors

| Situation | Result |
| --- | --- |
| A value a strict cast rejects, or a value a conversion rejects | An evaluation error naming what was rejected; null under `try` |
| A division or a remainder by zero, or an arithmetic result no finite number holds | An evaluation error at the operation |
| A module returning a value of a type other than the one it declared | An evaluation error |
| A member failing unexpectedly while it evaluates | An evaluation error |

An expression is validated before any evaluation, as the section on validation sets out. An evaluation error fails the whole result, and the caller receives the error in its place.
