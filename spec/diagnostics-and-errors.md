# Diagnostics and errors

<a id="diagnostics-and-errors"></a>

<a id="errors-and-diagnostics"></a>

A **diagnostic** describes one problem with a script, a definition, a binding or a module: what is wrong, and where. An **error** is how a strict operation reports one: it throws a `LexicaError`, whose `kind` is the category of the failure and whose `location` says where it stands, and stops there. Every public operation of the runtime is strict: reading text, validating a definition, binding, registering a module, resolving and evaluating each throw their first diagnostic as an error. Tooling reads text tolerantly instead, and keeps every diagnostic without throwing, as [tolerant reading](#diagnostics-tolerant-reading) sets out.

An absent or unavailable value is not a failure: it is null. Invalid syntax, an invalid definition or binding, an invalid script, an invalid module and an evaluation failure are errors, of the kinds `syntax`, `structure`, `validation`, `module` and `evaluation`, each raised at its stage:

| Kind | Raised by | For |
| --- | --- | --- |
| `syntax` | Reading text | Text that does not follow the grammar |
| `structure` | Reading text, validating a definition, binding | A definition or a binding that breaks the language's structural rules |
| `validation` | Resolution | A script that does not fit its vocabulary or its types |
| `module` | Creating and registering a module, creating an evaluator | A declaration that breaks a declaration contract, or a used declaration without an implementation |
| `evaluation` | Evaluation | A failure while the script is evaluated |

`try` handles only a cast or conversion rejecting its value; every other error fails the operation.

In this document:

1. [Where a failure is located](#validation-diagnostics)
2. [Absence and unavailable values](#absence-and-unavailable-values)
3. [Syntax errors](#syntax-errors)
4. [Structure errors](#structure-errors)
5. [Validation errors](#preparation-and-type-errors)
6. [Evaluation errors](#evaluation-errors)
7. [Tolerant reading](#diagnostics-tolerant-reading)

<a id="validation-diagnostics"></a>

## Where a failure is located

A syntax error identifies its position in the text, its offset, line and column. A structure, validation or evaluation error identifies its node in the definition, expressed as a JSON Pointer, and, where the script was read from text, its position in the text as well. An error in a binding names the binding, and a module error the module and the declaration, located by neither.

An evaluation error fails the entire result and is delivered to the host in its place.

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
| `@` in a declaration or before a field's or a member's name, or `@` with no identifier directly after it | A syntax error giving the form to write |
| `~` with no identifier directly after it | A syntax error saying a script parameter is named directly after `~` |
| A colon in a member chain that doesn't name an extension, as `it:[name]` or `it?:[name]` | A syntax error giving the unnamed indexer `it[name]` or the computed property access `it.[name]`, and their optional forms |
| A string where a cast or a conversion names its type, as `device as "Light"` | A syntax error giving the type's name written bare, `device as Light` |
| `import` anywhere but a script's start, as after its first local or expression | A syntax error saying imports stand at the start of the script |
| A line break inside a one-line construct, as between `.` and a member's name, or between `let` and its local's name | A syntax error naming the construct and what must share its line, and giving the form joined |
| A line break before a binary operator whose expression is not enclosed, or after a binary operator | A syntax error saying a line breaks only before an operator, and only inside parentheses, brackets or a condition |
| A conditional, a `do` block or a function expression spanning lines outside block form, or followed on its `end`'s line by anything but closing punctuation | A syntax error giving its block form |
| An import, a script's body after its imports, or a local or `return` of a body that uses `return`, sharing its line with earlier code | A syntax error saying it starts on a line of its own |
| U+2028 or U+2029 outside a string's literal text | A syntax error naming the character |
| An import of `Lexica` or of one of its types, as `import Lexica` or `import Items = Lexica.List` | A syntax error saying Lexica's own vocabulary is always available, so no script imports it |
| An import whose local name begins with no capital letter, or is a reserved word, `Lexica` or the name of one of Lexica's own types or extensions | A syntax error naming the local name |
| Two imports giving one local name to different declarations, as `import Measures = Measurements` and `import Measures = Home.Sensor` | A syntax error naming both imports |
| A keyword where a value stands | A syntax error giving the lexical reference; `then`, `elseif`, `else` and `end` give the value expected instead: `Expected a value, found 'then'` |
| A conditional without its `end`, a conditional whose branches give their results in two styles, anything after a body's result, or a `return` with no value | A syntax error |
| Locals whose body's result has no `return` | A syntax error: `Introduce the body's result with return.` |
| An expression no local holds before a body's `return` | A syntax error: `Only locals may precede a body's result.` |
| A function that is not a local's initializer, or an arrow function that is neither that nor an argument | A syntax error in text, and a structure error in a definition |
| A regular function written directly as an argument | A syntax error in text, and a structure error in a definition: `A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.` |
| An arrow function whose body is not a simple expression | A syntax error in text, and a structure error in a definition, saying its body is a simple expression |
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
| A definition of a version other than the one the implementation reads, as a version 33 definition is for version 34 | A structure error naming both versions |
| A definition's imports that break the rules [the definition](definition.md#definition) sets for them, or a `namespace` node or an extension selection's `module` naming a module its imports give no local name | A structure error located at the import or the namespace |
| A do block, a local, a conditional binding, a `return`, or a conditional beyond an if branch and an else branch of simple values, within an argument, an indexer's key, a computed property access or an interpolation | A structure error naming the part, which a local holds first |
| A lexical reference, or a definition's local, that no local, field, conditional binding or function parameter in scope answers | A structure error: `No local or field named 'it' is in scope. Use '~it' to read the script parameter.` |
| A function calling itself or one declared after it, or two parameters of one name | A structure error |
| A body anywhere but the script's, a do block's, a function's or a conditional branch's | A structure error: `A body is the script's, a do block's, a function's or a conditional branch's, and stands nowhere else` |
| A cast in a definition whose target is none text could write | A structure error at the target |
| A `root` written outside every object expression | A structure error: `'root' refers to the outermost object being built, and no object expression encloses it here` |
| A numeric literal no finite number holds, as `1e999`, in text or in a definition | A structure error: `A literal is a string, a finite number, a Boolean or null` |
| Bindings that are not a plain object, a binding not named by a letter followed by letters and digits, one that is not data and that no module recognizes, one modules recognize as unrelated types, a declared type the value does not belong to or no public type is, one several types share unqualified, or bindings made by another registry | A structure error naming the binding, as `A binding is named by a letter followed by letters and digits` |

A module whose declarations break the declaration contract, a type or a member named by what is not an identifier among them, or whose names registration finds taken or colliding within the module, fails with an error of its own kind, `module`, when it is created or registered, naming the module, the type a nested declaration stands in, and the declaration. Among them:

| Situation | Result |
| --- | --- |
| A member other than an indexer declared without a `name`, a field a declaration's kind does not take, a type-level `fields` collection, `target`, `syntax` or `default` on a member, or an `internal` that is no Boolean | A module error naming the field |
| A type whose name begins with no capital letter, a name its module already declares, or a name of Lexica's own types or `Null` | A module error naming the type |
| A module whose name begins with no capital letter, is already registered, is a reserved word or `Lexica`, or names one of Lexica's own types or extensions | A module error naming the module, `Module name 'energy' must begin with a capital letter.` |
| Empty angle brackets after a declaration's name, a type parameter without a name, one declared twice, one named as a type its declaration reaches unqualified, an imported one included, or a member declaring a parameter its extension declares | A module error naming the declaration and the parameter |
| A member whose result writes a type parameter that neither its extension's target, nor its value parameters, nor its callbacks' results could establish, or whose callback's input needs another callback's result | A module error naming the member and the parameter |
| An extension that names no `target`, or whose target its own module owns | A module error naming the extension |
| A module member named as one of the module's extensions, or a type named as one of Lexica's own extensions | A module error naming both |
| An `import` that does not name a registered module, a type reference resolving to no type or to several, or a foreign type named unqualified outside its import | A module error naming the declaration and, where several match, the qualified candidates |
| A supertype that is not a reference type, or a hierarchy that is a cycle | A module error naming the types |
| A reference type without `isInstance`, or a `typeOf` or an `isInstance` that is not a function | A module error naming the declaration |
| A declaration naming another module's internal type or member, or a public one exposing an internal type through its signature | A module error naming the declaration and the internal type or member |
| A declared cast to its own type, its supertype or a type beneath it; a conversion operator neither of whose types is its module's | A module error naming the operator |
| Two members of one name, two unnamed indexers, or two operators of one name and destination, on overlapping receivers of one module | A module error naming both |

<a id="preparation-and-type-errors"></a>

## Validation errors

| Situation | Result |
| --- | --- |
| A misspelled member or extension, or a script parameter the host did not bind | A validation error, with its location |
| An import naming a module the registry does not hold, a type its module does not declare, or an internal type | A validation error naming the module, or the type by its qualified name |
| A module's name read where a value stands in a script whose imports give no module that name, where the registry holds the module and no script parameter of its name is bound | A validation error giving the import, `import Home` |
| A member declared on its receiver only by modules, types or extensions the script does not import | A validation error naming the modules and giving the import |
| A fixed argument resolution cannot settle | A validation error: `The argument 'type' of 'on' selects from the vocabulary, so it is a string the expression's resolution settles without evaluating a member, …` |
| An access or a call written with `.` whose receiver can be null | A validation error giving the form with `?.` |
| A name no local or field in scope has | A validation error, giving the form with `it` where the implicit parameter has a member of that name |
| `it` where nothing gives it a value | A structure error where the text alone shows it, as outside every argument at the top level; a validation error within an argument of a member call or of a local function call, whose function decides |
| A named indexer written without its key or as a call; a function written with its argument in brackets | A validation error giving its form, `x.setting[…]`, or the call |
| An unnamed indexer on a type that declares none, or a number where a computed property's name stands, as `rooms.[0]` | A validation error, giving `room.["name"]` where the key is a string the receiver has a property of, and `rooms[0]` for the number |
| A member written in a form its declaration does not take, an argument that does not supply its input, or more arguments than it takes | A validation error giving the form, the input or the number of arguments it takes |
| A cast or a conversion naming a type that neither Lexica, nor the script's imports by name, nor a module the script imports declares publicly, or one several imported modules share unqualified | A validation error, giving the import where a module the script does not import declares it, and the qualified names where several share it |
| A cast to a name that is not a reference type, or of a target that can never be of its type, its hierarchy and its declared casts reaching none | A validation error naming the types |
| A script reaching an internal declaration of any module, through any form | A validation error naming the declaration, as if no declaration of its name were accessible |
| Several applicable extensions, or several applicable operators of one destination, none of them the owner's | A validation error naming the modules, and the extension accesses to write where they are members |
| An extension access naming no extension, one several extensions share unqualified, or a member the extension does not declare | A validation error giving the written name, saying so where only an ordinary type has it, the qualified names where several share it, or the extension and the member; `device:setting["mode"]` gives `device.setting["mode"]` where the receiver has that member |
| An extension access whose receiver does not satisfy the extension's target, or can be null where it is written with `:` | A validation error naming the target and the receiver's type, giving `?:` for a nullable receiver |
| A call's type parameter given candidates of different types, or an argument that does not satisfy a binding its receiver established | A validation error naming the parameter and each candidate, or the argument and the binding |
| A deferred call given an argument whose reading depends on the declaration it selects, an implicit body or a predicate | A validation error giving the arrow function to write, or saying to make the receiver known or to select its extension explicitly |
| An equality of two values whose types fit neither way, or of a value that is not a string, number, Boolean or reference value with one that is not null | A validation error naming the types, and the test to write where a value is compared with the name of one of its Boolean members |
| An operand of `and`, `or` or `not`, a condition or a conditional binding of what is not a value | A validation error naming what it is |
| An arithmetic operand that can be null, or that is not a number | A validation error naming the operand, and the fallback to give it |
| A call no local function answers, a call of a local holding a value or a function that may be null, a call given the wrong number of arguments, or one whose functions give no one type | A validation error naming the function |
| A call that reaches a function within its own call, through a function passed to it | A validation error |
| A field or a result that would hold a function, or a function given to a member's value parameter | A validation error |
| A function given to a function parameter of another number of parameters, of parameters that do not take the callback contract's arguments, of a result of another type, or that may be null; or a value that is not a function given to one, as a Boolean local; and an expression or a predicate argument that reads `it` and gives a function | A validation error naming the parameter |
| A function reference that no declaration of its name takes, or that several take; one naming a property, a host call or no function of its module | A validation error naming the module's declarations of its name, or giving the form to write |
| An interpolation of a value that can be null, or of no string or number | A validation error naming the interpolation, and the fallback or the conversion to give it |
| A comparison operand that can be null, or that is not a number | A validation error naming the operand, and the fallback to give it |
| An `and` or an `or` whose operands give values no one type holds | A validation error naming them, and the conditional to write where null is an acceptable alternative |
| Branches of different types | A validation error naming the types |
| A receiver, an argument, an expression or a binding of the wrong type, an argument of the wrong kind, or a missing required one | A validation error naming where, the expected type and the type found |
| A result that would contain a reference value | A validation error |
| A field read through `root` whose initializer has not completed where `root` is written | A validation error naming the fields completed there |
| A read, by its name or through `root`, of an option its member declares as an expression or a predicate, or of one given an implicit body | A validation error: `Option 'by' is an expression evaluated by the member against the implicit parameter it supplies; it has no single value to read here` |
| A field or a result that would hold `root` | A validation error: `The field 'copy' would hold root, the object being built, which no result holds; read its fields, as root.name` |
| A host call anywhere but the script's terminal operation: in a field, an argument, a condition, an operand, a function's body or another call's result projection | A validation error |
| A result projection following a host call that declares no result | A validation error |
| A type selector's key the selector does not map to a type | A validation error naming the selector and the key |
| Preparing a script that ends in no host call, or evaluating one that ends in a host call | An evaluation error |
| A value a host supplies, or a part of it, that its host call's declared result does not admit, as [capturing a supplied value](runtime.md#runtime-host-calls-capturing) sets out | An evaluation error naming the call and the part |

<a id="evaluation-errors"></a>

## Evaluation errors

| Situation | Result |
| --- | --- |
| A value a strict cast rejects, by its destination's membership or by its operator's `reject`, or a value a conversion rejects | An evaluation error naming what was rejected; null under `try` |
| A `typeOf` that does not name a reference type of its module, an abstract one, or one the value does not belong to; an `isInstance` answering no Boolean or throwing | A fault naming the module or the type and what asked; no attempt catches it |
| A division or a remainder by zero, or an arithmetic result no finite number holds | An evaluation error at the operation |
| A module returning a value of a type other than the one it declared | An evaluation error |
| A member failing unexpectedly while it evaluates | An evaluation error |
| A deferred access whose receiver's actual type lacks the member, or doesn't satisfy it, an `Any` argument that does not satisfy its parameter, or a direct access on null, `.` or `:` | An evaluation error naming the access and the actual type, and giving `?.` or `?:` for null |
| A deferred access whose selection would be a host call | An evaluation error, before anything is invoked, saying to make the receiver known or to select its extension explicitly |

A script is validated before any evaluation, as [what resolution checks](runtime.md#validation-vocabulary-and-types) sets out. An evaluation error fails the whole result, and the host receives the error in its place.

<a id="diagnostics-tolerant-reading"></a>

## Tolerant reading

Tooling reads text that is still being written, so it reads tolerantly: text that is not a token becomes an invalid token holding its diagnostic, `{ message, offset }`, and reading goes on after it, so the tokens cover the whole text whatever it holds. A strict reading meets the same diagnostic and throws it as a syntax error. One reader serves both, so a diagnostic says the same thing whichever way it is reached; the [design](../docs/lexica-design.md#the-syntax-tree) sets out how the syntax tree builds on it.

Every diagnostic today has its kind, its message and its location. Stable codes identifying each condition, apart from its message, are [proposed](../docs/proposals/diagnostic-codes.md), and not part of this contract.
