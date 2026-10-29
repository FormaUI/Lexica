# Diagnostics and errors

<a id="diagnostics-and-errors"></a>

<a id="errors-and-diagnostics"></a>

A **diagnostic** describes one problem with a script, a definition, a binding or a module: what is wrong, and where. An **error** is how a strict operation reports one: it throws a `NexoError`, whose `code` identifies the condition, as [codes](#diagnostics-codes) set out, whose `kind` is the category of the failure and whose `location` says where it stands, and stops there. Every public operation of an implementation is strict: reading text, validating a definition, binding, registering a module, resolving and evaluating each throw their first diagnostic as an error. Tooling reads text tolerantly instead, and keeps every diagnostic without throwing, as [tolerant reading](#diagnostics-tolerant-reading) sets out.

An absent or unavailable value is not a failure: it is null. Invalid syntax, an invalid definition or binding, an invalid script, an invalid module and an evaluation failure are errors, of the kinds `syntax`, `structure`, `validation`, `module` and `evaluation`, each raised at its stage:

| Kind | Raised by | For |
| --- | --- | --- |
| `syntax` | Reading text | Text that does not follow the grammar |
| `structure` | Reading text, validating a definition, binding, and resolving, creating an evaluator or entering one with bindings or a registry that no longer fit | A definition or a binding that breaks the language's structural rules; validating a definition, `nexo.validate`, checks these alone, with no registry |
| `validation` | Resolution | A script that does not fit its vocabulary or its types: the semantic validation resolution performs against a registry |
| `module` | Creating and registering a module, creating an evaluator | A declaration that breaks a declaration contract, or a used declaration without an implementation |
| `evaluation` | Evaluation, its hooks and its prepared calls | A failure while the script is evaluated |

Structural validation checks a definition against the definition format wherever one is read or given, `nexo.validate` among them, and reports a `structure` error. Semantic validation checks a script against its vocabulary and its types, which resolution alone can, and reports a `validation` error, so `nexo.validate` never raises one.

`try` handles only a cast or conversion rejecting its value; every other error fails the operation. A **fault** is an evaluation error no attempt catches, as a declaration's `impl` failing otherwise than by its `reject`.

A `NexoError` is an `Error` whose `name` is `NexoError`, holding its `code`, its `kind`, its `location`, as [where a failure is located](#validation-diagnostics) sets out, and its `message`, which says what is wrong followed, in parentheses, by where, wherever its location holds anything; an evaluation error something caused, an implementation or a hook throwing among them, holds that as its `cause`. Its constructor is not public: a host builds an error of its own with the class's factories, `NexoError.structure(code, message, location)`, `NexoError.validation(code, message, location)` and `NexoError.evaluation(code, message, location, { cause })`, each of the kind it names, and an error a host builds is never taken for one Nexo raised, as [a hook that throws](runtime/evaluation.md#runtime-evaluation) sets out.

In this document:

1. [Codes](#diagnostics-codes)
2. [Where a failure is located](#validation-diagnostics)
3. [Absence and unavailable values](#absence-and-unavailable-values)
4. [Syntax errors](#syntax-errors)
5. [Structure errors](#structure-errors)
6. [Module errors](#module-errors)
7. [Validation errors](#preparation-and-type-errors)
8. [Evaluation errors](#evaluation-errors)
9. [Tolerant reading](#diagnostics-tolerant-reading)
10. [Retired codes](#diagnostics-retired-codes)

<a id="diagnostics-codes"></a>

## Codes

Each condition a diagnostic reports has a stable **code**, `NEXO` and four digits, as `NEXO1004`, which each error table below gives beside its condition: the tables are the catalog, one row for each condition the specification sets out. A diagnostic is `{ code, kind, message, location }`, as a `NexoError` is.

| Codes | Kind |
| --- | --- |
| `NEXO1000` to `NEXO1999` | `syntax` |
| `NEXO2000` to `NEXO2999` | `structure` |
| `NEXO3000` to `NEXO3999` | `validation` |
| `NEXO4000` to `NEXO4999` | `module` |
| `NEXO5000` to `NEXO5999` | `evaluation` |

- **A code identifies its condition,** never its wording or where it is raised: a message reworded, or the same condition detected somewhere else, keeps its code, and distinct conditions never share one because their messages resemble each other. The kind still names the stage, so neither stands in for the other, and a condition reported as two kinds, in text and in a definition, has a code of each.
- **A code is stable once assigned.** A new condition takes a new code when it is introduced. Where a condition splits, the part that keeps its meaning keeps its code and the other parts take new ones, and where no part keeps its meaning, its code is retired. A retired code is never reused, and is recorded among [retired codes](#diagnostics-retired-codes) when its row leaves its table.
- **A code stands in its kind's range.** An error built with a code beginning `NEXO` outside its kind's range, or with a code that is no string or is empty, throws a `TypeError` instead, a mistake in the code raising it.
- **A host's conditions** take codes of a prefix of the host's own, never `NEXO`, and a host keeps a Nexo error's code when it passes the error on.
- **Strict and tolerant reading** give one condition the same code. A tolerant reading may go on to report further diagnostics, so the two readings' lists of diagnostics are not promised to match.

<a id="validation-diagnostics"></a>

## Where a failure is located

A **location** says where a failure stands by one group of fields, never two, the group its subject gives:

| Group | Fields | Locates |
| --- | --- | --- |
| Script | `pointer`, the node's JSON Pointer into the definition, with `offset`, `line` and `column`, its position in the text, where the definition was read from text | A structure, validation or evaluation error in a script or a definition; `getLocation` answers this group |
| Text | `offset`, `line` and `column` alone | A syntax error, which stands in text no definition holds yet |
| Binding | `binding`, the binding's name | An error in a binding |
| Module | `module`, the module's name; `type`, the type a nested declaration, a member a type declares among them, stands in; `declaration`, the declaration's name; and `declarationKey`, the key the failure concerns, a declaration's, as `updates.misses`, or, with no declaration, the module's own; each but `module` only where the failure concerns it | A module error |

- **A position counts from the text's start.** `offset` counts the text's UTF-16 code units from 0, and `line` and `column` count from 1. Each line break, LF, CRLF or a lone CR, begins a line, so CRLF begins one, its two characters both counted in the offset.
- **A node without text of its own** is positioned at the nearest node enclosing it that has some, its `pointer` still its own.
- **A failure of the API's use that stands nowhere** carries an empty location, `{}`: imports a host supplies that are refused, `NEXO2008`, bindings or their options that are not a plain object, `NEXO2020`, bindings another registry made, `NEXO2024`, bindings of another resolution key, `NEXO2025`, a resolution no longer current, `NEXO2040`, a pointer that is no JSON Pointer, `NEXO2643`, reading what is not a script's source, `NEXO2645`, a result path of another shape, `NEXO2646`, and evaluating an evaluator from within its own evaluation, `NEXO5010`.

An evaluation error fails the entire result and is delivered to the host in its place.

<a id="absence-and-unavailable-values"></a>

## Absence and unavailable values

| Situation | Result |
| --- | --- |
| A member finds nothing of what it looks for, as `room.device(name)` finds no device | null, or an empty list for a member that answers a list, as the member documents |
| A value a member reads is unavailable, as `sensor.temperature` before a first reading | null, as the member documents |

<a id="syntax-errors"></a>

## Syntax errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO1000` | Text that does not follow the syntax | A syntax error, with its position |
| `NEXO1001` | A token of several characters written with whitespace inside it, as `? .`, `= =` or `< =` | A syntax error at the token |
| `NEXO1002` | U+2028 or U+2029 outside a string's literal text | A syntax error naming the character |
| `NEXO1003` | A colon after an object field's, a local's or a conditional binding's name, as `count: …` | A syntax error giving `count = …` |
| `NEXO1004` | `=` anywhere but between an object field's, a local's or a conditional binding's name and its value | A syntax error saying `==` compares values |
| `NEXO1005` | `$` anywhere but directly before a quote | A syntax error; with a space before the quote, `$ "…"`, saying no space may separate them |
| `NEXO1006` | An escape no string takes, as `\{` | A syntax error at the escape |
| `NEXO1049` | A `\u{…}` naming a surrogate or a value above `10FFFF` | A syntax error at the escape |
| `NEXO1007` | An unclosed block comment | A syntax error |
| `NEXO1008` | `@` in a declaration or before an object field's or a member's name | A syntax error giving the form to write |
| `NEXO1050` | `@` with no identifier directly after it | A syntax error saying an identifier must follow `@` directly |
| `NEXO1009` | `~` with no identifier directly after it | A syntax error saying a script parameter is named directly after `~` |
| `NEXO1010` | A keyword where a value stands | A syntax error giving the lexical reference; `then`, `elseif`, `else` and `end` give the value expected instead: `Expected a value, found 'then'` |
| `NEXO1011` | A member's name after a value without its punctuation, as `device active` | A syntax error giving `device.active` |
| `NEXO1012` | An argument written as a named one, as `relativeTo = other` | A syntax error, giving a member call the form of an options object |
| `NEXO1013` | An equality or a comparison written without its left operand | A syntax error saying to write both values, as `it == null` |
| `NEXO1014` | A colon in a member chain that doesn't name an extension, as `it:[name]` or `it?:[name]` | A syntax error giving the unnamed indexer `it[name]` or the computed property access `it.[name]`, and their optional forms |
| `NEXO1015` | An optional enclosed access written directly as a call's argument | A syntax error giving the argument grouped, `.device((?…))` |
| `NEXO1016` | An optional enclosed access holding no member access after its receiver, or anything beyond its member chain | A syntax error |
| `NEXO1017` | A named indexer written with empty brackets or several keys, as `device.setting[]` or `device.setting["a", "b"]` | A syntax error |
| `NEXO1018` | An object expression with no object field | A syntax error |
| `NEXO1051` | An object field, a local or a conditional binding written without its name | A syntax error |
| `NEXO1019` as syntax, `NEXO2001` as structure | A comparison chain whose operators point two ways | A syntax error at the operator that turns it in text, and a structure error in a definition |
| `NEXO1020` | An equality chained, as `a == b == c` | A syntax error giving the grouped form, `(a == b) == c` |
| `NEXO1052` | A comparison beside an equality without a group, as `a < b == c` | A syntax error giving the grouped form, `(a < b) == c` |
| `NEXO1021` | `??` without a group beside arithmetic, an equality, a comparison, `not`, `and` or `or`, as `a ?? b + 1` | A syntax error giving the grouped forms, `(a ?? b) + 1` and `a ?? (b + 1)` |
| `NEXO1022` as syntax, `NEXO2523` as structure | `try` before anything but one cast or one conversion, before two of them, as `try a to String to Number`, or before another `try` | A syntax error giving the grouped form, `try (a to String) to Number`, in text, and a structure error in a definition |
| `NEXO1023` | An attempt as a cast's target, as `(try a as Device) as Light` | A syntax error |
| `NEXO1024` | Casts chained without a group, as `a as Device as Light` | A syntax error giving the grouped form, `(thing as Device) as Light` |
| `NEXO1053` | A chain continuing a cast without a group, as `device as Light.brightness` | A syntax error giving the grouped form, `(device as Light).brightness` |
| `NEXO1025` as syntax, `NEXO2002` as structure | A cast whose target is none text could write: a group other than a coalescing operator or an optional enclosed access, or a chain an object expression continues | A syntax error in text, and a structure error at the target in a definition |
| `NEXO1026` | A string where a cast or a conversion names its type, as `device as "Light"` | A syntax error giving the type's name written bare, `device as Light` |
| `NEXO1027` | A conditional or a `do` block used as a condition or an operand without a group | A syntax error giving the grouped form |
| `NEXO1028` as syntax, `NEXO2003` as structure | A conditional or a `do` block that is the receiver of a chain | A syntax error, or a structure error in a definition, saying to bind its value first |
| `NEXO1029` | A conditional, a function or a `do` block without its `end` | A syntax error |
| `NEXO1054` as syntax, `NEXO2524` as structure | A conditional whose branches give their results in two styles | A syntax error in text, and a structure error in a definition: `All branches of this conditional must give their results with return, or none of them` |
| `NEXO1055` | Anything after a body's result | A syntax error |
| `NEXO1056` | A `return` with no value | A syntax error |
| `NEXO1030` | Locals whose body's result has no `return` | A syntax error: `Introduce the body's result with return.` |
| `NEXO1031` | An expression no local holds before a body's `return` | A syntax error: `Only locals may precede a body's result.` |
| `NEXO1032` | A local declaration or a `return` written where a simple expression's value stands, as in an argument | A syntax error |
| `NEXO1033` | `return` among an object's fields | A syntax error |
| `NEXO1034` as syntax, `NEXO2004` as structure | A function that is not a local's initializer | A syntax error in text, and a structure error in a definition |
| `NEXO1057` as syntax, `NEXO2027` as structure | An arrow function that is neither a local's initializer nor an argument | A syntax error in text, and a structure error in a definition |
| `NEXO1035` as syntax, `NEXO2005` as structure | A regular function written directly as an argument | A syntax error in text, and a structure error in a definition: `A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.` |
| `NEXO1036` as syntax, `NEXO2006` as structure | An arrow function whose body is not a simple expression | A syntax error in text, and a structure error in a definition, saying its body is a simple expression |
| `NEXO1037` | A line break written in an inline string, raw or not and interpolated or not | A syntax error at the line break, suggesting `\n` or a block |
| `NEXO1038` | A block whose opening delimiter has anything after it on its line | A syntax error naming the delimiter |
| `NEXO1058` | A block that is never closed | A syntax error naming the delimiter |
| `NEXO1059` | A block whose closing run is longer than its delimiter | A syntax error naming the run |
| `NEXO1060` | A block whose text holds a run of quotes as long as its delimiter | A syntax error naming the run, suggesting a longer delimiter |
| `NEXO1061` | A block one of whose lines lacks its margin | A syntax error naming the line |
| `NEXO1039` | An interpolation with no expression | A syntax error at the interpolation |
| `NEXO1062` | A lone `}` in an interpolated string's text | A syntax error at the brace |
| `NEXO1040` | An interpolation holding a line break, a line comment or a block | A syntax error saying an interpolation stands on one line |
| `NEXO1063` | An interpolation beginning with an object expression | A syntax error suggesting the group `{({ … })}` |
| `NEXO1041` | A line break inside a one-line construct, as between `.` and a member's name, or between `let` and its local's name | A syntax error naming the construct and what must share its line, and giving the form joined |
| `NEXO1042` | A line break before a binary operator whose expression is not enclosed | A syntax error saying a line breaks before an operator only inside parentheses, brackets or a condition |
| `NEXO1064` | A line break after a binary operator | A syntax error saying a line breaks before an operator, never after it |
| `NEXO1066` | A dictionary key that is no inline string literal, as `[name = 1]`, an interpolated string or a block string | A syntax error at the key, giving the literal key for a name and `toDictionary` for a computed key |
| `NEXO1067` | Keyed and unkeyed entries mixed in one collection expression | A syntax error at the first entry of the other kind |
| `NEXO1068` | An item left out between the commas of a collection expression, as `[1, , 2]` | A syntax error at the comma |
| `NEXO1069` | A range's boundary written as an operator expression, as `a + 1..b` | A syntax error at the boundary, giving the grouped form |
| `NEXO1070` | A range written as another range's boundary, as `1..2..3` | A syntax error saying a range has two boundaries |
| `NEXO1043` | A conditional, a `do` block or a function expression spanning lines outside block form, or followed on its `end`'s line by anything but closing punctuation | A syntax error giving its block form |
| `NEXO1044` | An import, a script's body after its imports, or a local or `return` of a body that uses `return`, sharing its line with earlier code | A syntax error saying it starts on a line of its own |
| `NEXO1045` | `import` anywhere but a script's start, as after its first local or expression | A syntax error saying imports stand at the start of the script |
| `NEXO1046` | An import of `Nexo` or of one of its types, as `import Nexo` or `import Items = Nexo.List` | A syntax error saying Nexo's own vocabulary is always available, so no script imports it |
| `NEXO1048` | Two imports giving one local name to different declarations, as `import Measures = Measurements` and `import Measures = Home.Sensor` | A syntax error naming both imports |
| `NEXO1501` | A chain continuing a conversion without a group, as `a to Number[0]` | A syntax error saying a conversion ends its chain, giving the grouped form |
| `NEXO1502` | An optional enclosed access whose receiver is neither an input nor a grouped cast, as `(?(?a.b).c)` | A syntax error naming what its receiver is |
| `NEXO1503` | A member written without its receiver, a name followed by an argument after a space, as `count "x"` | A syntax error giving `it.count(…)` |
| `NEXO1504` | A local written after a field of its object expression | A syntax error saying an object's locals come before its object fields |
| `NEXO1505` | A conditional without its `else` | A syntax error |
| `NEXO1506` | A module's name standing alone, or followed by `?.` | A syntax error giving `@` for the local or object field and `~` for the script parameter of that name |
| `NEXO1507` | A `?` written after the dot of a computed property access, as `a.?[p]` | A syntax error giving `?.[…]` |
| `NEXO1508` | A member's argument written after its name without parentheses, as `.name "x"` | A syntax error giving `.name(…)` |
| `NEXO1509` | A `!` not followed by `=` | A syntax error giving `!=` for an inequality and `not` for a negation |
| `NEXO1510` | A string never closed | A syntax error |
| `NEXO1511` | A function or a `do` block with an empty body | A syntax error giving the body to write |

<a id="structure-errors"></a>

## Structure errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO2000` | A definition that does not follow its structure | A structure error, with its node's location |
| `NEXO2007` | A definition of a version other than the one the implementation reads, as a version 33 definition is for version 34 | A structure error naming both versions |
| `NEXO2008` | A definition's imports that break the rules [the definition](runtime/definition.md#definition) sets for them, or imports a host supplies that are no list, break an import's rules or conflict with each other | A structure error located at a definition's import, the later of two that conflict or stand out of order, and with an empty location for a host's, whose list has no text |
| `NEXO2028` | A `namespace` node or an extension selection's `module` naming a module its imports give no local name | A structure error located at the namespace |
| `NEXO2009` | In a definition, an object node with no object field | A structure error at the node |
| `NEXO2029` | In a definition, a comparison node of fewer than two operands | A structure error at the node |
| `NEXO2010` | In a definition, an optional access outside an optional chain | A structure error at the node |
| `NEXO2030` | In a definition, an `optionalChain` node holding no optional access | A structure error at the node |
| `NEXO2011` | A `do` block, a conditional binding, or a conditional beyond an if branch and an else branch of simple values, within an argument, an indexer's key, a computed property access or an interpolation | A structure error naming the part, which a local holds first |
| `NEXO2012` | A lexical reference, or a definition's local, that no local, object field, conditional binding or function parameter in scope answers | A structure error: `No local, object field, conditional binding or function parameter named 'it' is in scope. Use '~it' to read the script parameter.` |
| `NEXO2013` | A name read before a local of its name declared later in its scope, or a local's initializer reading the local itself, as `{ let n = n }` | A structure error, never a read of the script parameter of that name |
| `NEXO2014` | A conditional binding's initializer reading the binding's own name, as `if let k = k`, where nothing else of that name is in scope | A structure error suggesting `~k` |
| `NEXO2015` | Two locals of one name in a body or an object expression | A structure error |
| `NEXO2031` | Two object fields of one name | A structure error |
| `NEXO2016` | A function calling itself or one declared after it | A structure error |
| `NEXO2032` | Two parameters of one name | A structure error |
| `NEXO2017` | A body anywhere but the script's, a do block's, a function's or a conditional branch's | A structure error: `A body is the script's, a do block's, a function's or a conditional branch's, and stands nowhere else` |
| `NEXO2018` | A `root` written outside every object expression | A structure error: `'root' refers to the outermost object being built, and no object expression encloses it here` |
| `NEXO2019` | A numeric literal no finite number holds, as `1e999`, in text or in a definition | A structure error: `A literal is a string, a finite number, a Boolean or null` |
| `NEXO2020` | Bindings that are not a plain object, or binding options, or the `types` they declare, that are not one | A structure error with an empty location |
| `NEXO2033` | A binding not named by a letter followed by letters and digits | A structure error naming the binding: `A binding is named by a letter followed by letters and digits` |
| `NEXO2034` | A binding that is not data and that no module recognizes | A structure error naming the binding |
| `NEXO2035` | A binding modules recognize as unrelated types | A structure error naming the binding and the types |
| `NEXO2036` | A binding whose declared type the value does not belong to, or that no public type is | A structure error naming the binding and the type |
| `NEXO2037` | A binding whose declared type several types share unqualified | A structure error naming the binding and the qualified names |
| `NEXO2021` | A bound list whose items share no type, as `[1, "two"]` | A structure error naming the binding |
| `NEXO2041` | A bound map holding a key that is no key type, a list, an object, a structured value, a dictionary or a pair | A structure error naming the binding and the key's type |
| `NEXO2042` | A bound map whose keys, or whose values, share no type | A structure error naming the binding and which of them |
| `NEXO2043` | Two entries of one dictionary a collection expression writes sharing a key, compared exactly | A structure error at the later entry, naming the key |
| `NEXO2022` | A bound value holding a cycle, a declared type's data among them | A structure error of its own naming the binding, and where it reaches itself in data a declared type captures |
| `NEXO2038` | A reference type declared for a value that is not a reference, null aside where the type is nullable | A structure error naming the binding |
| `NEXO2044` | A declared binding type no binding holds: a notation that writes no type, `Any`, `Never`, a position, a type holding one at any depth, a structure's data shape among it, or a dictionary keyed by no key type | A structure error naming the binding and the type |
| `NEXO2045` | A value its binding's declared data type, or a part of it, doesn't admit, as [declared types](runtime/bindings.md#runtime-bindings) set out | A structure error naming the binding, the part and the type |
| `NEXO2039` | A type declared for anything but a top-level binding | A structure error naming the binding |
| `NEXO2024` | Resolving or evaluating with a binding set another registry made | A structure error saying to bind with that registry |
| `NEXO2025` | Creating an evaluator with bindings of another resolution key | A structure error saying to resolve again |
| `NEXO2040` | Creating or entering an evaluator, or projecting a prepared call, once its resolution is no longer current | A structure error saying to resolve again |
| `NEXO2520` | A `namespace` node anywhere but as the target of a member read or a call, an indexer's among them | A structure error at the node |
| `NEXO2521` | A namespace's member named by a computed property access | A structure error at the node |
| `NEXO2522` | An optional access through a namespace | A structure error saying a namespace is never null |
| `NEXO2525` | An `and` or an `or` of fewer than two operands | A structure error at the node |
| `NEXO2526` | A comparison whose operators are not one fewer than its operands | A structure error at the node |
| `NEXO2527` | An object expression holding locals within a simple expression | A structure error naming the part, which a local holds first |
| `NEXO2528` | A script parameter a text writes alone where a local or an object field of its name is in scope | A structure error naming the parameter |
| `NEXO2643` | A location asked for by a pointer that is not a JSON Pointer | A structure error |
| `NEXO2644` | A location asked for at a pointer the definition holds nothing at | A structure error naming the pointer |
| `NEXO2645` | Reading what is not a script's source | A structure error |
| `NEXO2646` | A result path holding an item that is neither a name nor a whole number that is not negative | A structure error naming the item |

<a id="module-errors"></a>

## Module errors

A module whose declarations break the declaration contract, a type or a member named by what is not an identifier among them, or whose names registration finds taken or colliding within the module, fails with an error of its own kind, `module`, when it is created or registered, naming the module, the type a nested declaration stands in, and the declaration. Among them:

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO4001` | Creating an evaluator for a resolution whose used declarations the evaluator invokes, conversion operators among them, have no `impl` | A module error naming the declaration and its module |
| `NEXO4002` | A member other than an indexer declared without a `name` | A module error naming the member |
| `NEXO4030` | A declaration key a declaration's kind does not take, a type-level `fields` collection, and `target`, `syntax` or `default` on a member among them | A module error naming the declaration key |
| `NEXO4031` | An `internal` that is no Boolean | A module error naming the declaration |
| `NEXO4003` | A member without a declaration key its kind requires, `result`, `updates`, or `arguments` where it has parameters | A module error naming the declaration key |
| `NEXO4032` | A property declared without `updates` anywhere but directly in a structured type | A module error naming the property |
| `NEXO4033` | A type of a name its module already declares | A module error naming the type |
| `NEXO4035` | A module whose name, compared case-insensitively, is already registered | A module error naming the module and the one registered |
| `NEXO4006` | A type selector, an observation type or an observation target named by what is not an identifier | A module error naming the declaration |
| `NEXO4037` | An observation target named `receiver` | A module error naming the target |
| `NEXO4007` | A type selector or an observation type named as one any module already declares | A module error naming it and the module that declared it |
| `NEXO4008` | A mapping without its `selector`, `key` or `type` | A module error naming the declaration key |
| `NEXO4038` | A mapping whose key already stands in its selector | A module error naming the selector, the key and the module that declared it first |
| `NEXO4039` | A mapping of a selector no registered module declares | A module error naming the selector |
| `NEXO4009` | A function with more than one parameter that selects a type | A module error naming the function |
| `NEXO4040` | A `result` writing `@selected` without a parameter that selects a type | A module error naming the function |
| `NEXO4010` | Empty angle brackets after a declaration's name, or a type parameter without a name | A module error naming the declaration |
| `NEXO4041` | A type parameter declared twice | A module error naming the declaration and the parameter |
| `NEXO4042` | A type parameter named as a type its declaration reaches unqualified, one of Nexo's own, `Any` and `Never` among them, or an imported one | A module error naming the declaration and the parameter |
| `NEXO4043` | A member declaring a parameter its extension declares | A module error naming the member and the parameter |
| `NEXO4011` | A member whose result writes a type parameter with no supported source to bind it from: its extension's target, its value parameters' types or its callbacks' results | A module error naming the member and the parameter |
| `NEXO4044` | A member whose callback's input writes a type parameter whose only source is another callback's result | A module error naming the member and the callbacks |
| `NEXO4012` | An extension that names no `target` | A module error naming the extension |
| `NEXO4045` | An extension whose target its own module owns | A module error naming the extension |
| `NEXO4015` | A type's `import` that does not name a registered module | A module error naming the declaration |
| `NEXO4047` | A type reference resolving to no type | A module error naming the declaration |
| `NEXO4048` | A type reference resolving to several types | A module error naming the declaration and the qualified candidates |
| `NEXO4049` | A foreign type named unqualified outside its import | A module error naming the declaration |
| `NEXO4016` | A supertype that is not a reference type | A module error naming the types |
| `NEXO4050` | A type hierarchy that is a cycle | A module error naming the types |
| `NEXO4017` | A reference type without `isInstance` | A module error naming the declaration |
| `NEXO4051` | A `typeOf` or an `isInstance` that is not a function | A module error naming the declaration |
| `NEXO4018` | A declaration naming another module's internal type or member | A module error naming the declaration and the internal type or member |
| `NEXO4052` | A public declaration exposing an internal type: through its signature, as a public type's supertype, or as a mapping's type | A module error naming the declaration and the internal type |
| `NEXO4019` | Positional parameters with a required one after an optional one | A module error naming the parameter |
| `NEXO4020` | An indexer whose parameters are other than one required value parameter, its key | A module error naming the indexer |
| `NEXO4053` | An indexer the host invokes | A module error naming the indexer |
| `NEXO4021` | A function parameter on anything but a function the evaluator invokes | A module error naming the parameter |
| `NEXO4054` | A function parameter that is optional or has a null policy | A module error naming the parameter |
| `NEXO4055` | A function parameter an observation is given | A module error naming the parameter |
| `NEXO4056` | A function the host invokes taking a parameter other than a value parameter | A module error naming the parameter |
| `NEXO4022` | A module member that is an indexer or an operator | A module error naming the member |
| `NEXO4057` | A module member that observes its receiver or a target found from one | A module error naming the member |
| `NEXO4023` | `updates` without `changes` or `reads` | A module error naming the member and the declaration key |
| `NEXO4058` | `misses` missing where the member is partly observable, or present otherwise | A module error naming the member and the declaration key |
| `NEXO4059` | `observations` missing where the member is observable or partly observable, or present otherwise | A module error naming the member and the declaration key |
| `NEXO4060` | An observation of the wrong type, target or arguments | A module error naming the member and the observation |
| `NEXO4024` | An observation naming a target its observation type's module does not declare | A module error naming the observation |
| `NEXO4061` | A prefix on an argument that is not a `String` value parameter | A module error naming the argument |
| `NEXO4025` | A member reading maintained samples without a maintained observation | A module error naming the member |
| `NEXO4062` | A member naming a maintained observation without reading maintained samples | A module error naming the member |
| `NEXO4063` | A maintained observation of a target of many | A module error naming the member |
| `NEXO4026` | A `tolerance` on a member whose result is neither a `Number`, a `Number?` nor a structured type | A module error naming the member |
| `NEXO4027` | A cast operator not declared on a reference type, or not casting to one | A module error naming the operator |
| `NEXO4064` | A cast to its own type, its supertype or a type beneath it | A module error naming the operator |
| `NEXO4028` | A conversion operator neither of whose types is its module's | A module error naming the operator |
| `NEXO4065` | A conversion operator on a type that is not data, or to a destination that is not data | A module error naming the operator |
| `NEXO4066` | A conversion operator from a type to itself | A module error naming the operator |
| `NEXO4067` | A conversion operator on a foreign source outside an extension | A module error naming the operator |
| `NEXO4029` | Two members of one name on one receiver type of one module, two indexers among them only where their key types overlap, as signatures of one indexer never do | A module error naming both |
| `NEXO4068` | Two unnamed indexers for one receiver type of one module whose key types overlap, as signatures of one indexer never do | A module error naming both |
| `NEXO4069` | Two operators of one name and destination on one receiver type of one module | A module error naming both |
| `NEXO4500` | A module whose name is not an identifier | A module error naming the module |
| `NEXO4501` | A module's contents that are not an object | A module error naming what a module declares |
| `NEXO4502` | A module's contents declaring what a module does not declare | A module error naming what a module declares |
| `NEXO4503` | A module's declarations of one kind that are not a list | A module error naming the kind |
| `NEXO4504` | A declaration, its `updates`, a parameter or an observation that is not an object | A module error naming the declaration keys it takes |
| `NEXO4505` | An `impl` that is not a function | A module error naming the declaration |
| `NEXO4507` | A type's `import` that is not a list of modules' names | A module error naming the type |
| `NEXO4508` | A type importing one module twice | A module error naming the module |
| `NEXO4512` | A type that does not parse where a declaration names one, a result, a parameter's, a callback's, a mapping's or a supertype | A module error naming the declaration |
| `NEXO4514` | `updates` whose `changes` or `reads` is none of its values | A module error giving the values |
| `NEXO4515` | A `tolerance` that is not a number, or is negative | A module error naming the member |
| `NEXO4516` | `observations` that are not a list | A module error naming the member |
| `NEXO4517` | An observation target its module declares twice | A module error naming the target |
| `NEXO4518` | An observation target whose `from` is not `receiver` | A module error naming the target |
| `NEXO4519` | An observation target whose `count` is not `many` | A module error naming the target |
| `NEXO4520` | An observation type whose contract is neither of its two | A module error giving the contracts |
| `NEXO4521` | An observation type's `identity` that is not a list of its arguments' names | A module error naming the observation type |
| `NEXO4522` | An observation type's `shared` that is not a Boolean | A module error naming the observation type |
| `NEXO4523` | A member whose name is not an identifier | A module error naming the member |
| `NEXO4524` | A member of a kind that is none of a member's kinds | A module error giving the kinds |
| `NEXO4525` | An `invokedBy` that is neither `evaluator` nor `host` | A module error naming the function |
| `NEXO4526` | A member's `parameters` that are not a list | A module error naming the member |
| `NEXO4527` | A member declaring a parameter twice | A module error naming the parameter |
| `NEXO4529` | A function whose parameter selects a type and whose `result` writes no `@selected` | A module error naming the parameter |
| `NEXO4534` | `arguments` on a function without parameters | A module error naming the function |
| `NEXO4535` | `arguments` that are neither `positional` nor `options` | A module error naming the function |
| `NEXO4536` | A parameter without its name, its kind, its type, its `required` or its null policy, or with a value none of them takes | A module error naming the parameter |
| `NEXO4537` | A function parameter whose `parameterTypes` are not a list | A module error naming the parameter |
| `NEXO4538` | A required parameter with a default | A module error naming the parameter |
| `NEXO4539` | An expression or a predicate parameter whose `context` is not `item` | A module error naming the parameter |
| `NEXO4540` | A predicate parameter whose type is not `Boolean` | A module error naming the parameter |
| `NEXO4541` | A `fixed` that is not a Boolean | A module error naming the parameter |
| `NEXO4542` | `selects` or `selector` on a parameter that is not fixed | A module error naming the parameter |
| `NEXO4543` | A fixed parameter selecting anything but a type | A module error naming the parameter |
| `NEXO4544` | A fixed parameter that selects a type and names no selector | A module error naming the parameter |
| `NEXO4545` | A fixed parameter that is not a `String` value parameter | A module error naming the parameter |
| `NEXO4546` | Registering what `createModule` did not make | A module error |
| `NEXO4547` | A parameter selecting through a selector no registered module declares | A module error naming the parameter and the selector |
| `NEXO4548` | A parameter's default its type does not admit, a number that is not finite and a list with a hole at any depth among them | A module error naming the parameter |
| `NEXO4549` | Two module members of one name in one module | A module error naming the member |
| `NEXO4552` | A type whose name is not an identifier | A module error naming the type |
| `NEXO4554` | A type of a kind that is none of a type's kinds | A module error giving the kinds |
| `NEXO4555` | An `abstract` that isn't a Boolean | A module error naming the type |
| `NEXO4558` | A reference or structured type declaring type parameters | A module error naming the type |
| `NEXO4559` | An extension whose target is `Any` or nullable | A module error naming the extension |
| `NEXO4560` | An operator named other than `cast` or `convert` | A module error naming the operator |
| `NEXO4561` | An operator declaring type parameters | A module error naming the operator |
| `NEXO4562` | A declaration holding a value that reaches itself through its lists and objects | A module error naming the declaration and the declaration key |
| `NEXO4563` | A declared dictionary whose key type is no key type, as `Dictionary<List<Number>, String>` | A module error naming the declaration and the key type |

<a id="preparation-and-type-errors"></a>

## Validation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO3001` | A misspelled member or extension | A validation error, with its location; a property access with a hyphen, as `it.floor-area`, giving the camelCase member, `it.floorArea` |
| `NEXO3051` | A script parameter the host did not bind | A validation error naming the parameter |
| `NEXO3002` | A script's import naming a module the registry does not hold | A validation error naming the module |
| `NEXO3052` | A script's import naming a type its module does not declare | A validation error naming the type by its qualified name |
| `NEXO3053` | A script's import naming an internal type | A validation error naming the type by its qualified name |
| `NEXO3003` | A module's name read where a value stands in a script whose imports give no module that name, where the registry holds the module and no script parameter of its name is bound | A validation error giving the import, `import Home` |
| `NEXO3004` | A type named qualified by a module no import gives that name, as `Measurements.Temperature` where the script imports `Measures = Measurements` alone | A validation error giving the import |
| `NEXO3005` | A member declared on its receiver only by modules, types or extensions the script does not import | A validation error naming the modules and giving the import |
| `NEXO3006` | A fixed argument resolution cannot settle | A validation error: `The argument 'type' of 'on' selects from the vocabulary, so it is a string the expression's resolution settles without evaluating a member, …` |
| `NEXO3007` | A fixed argument whose settled value can be null, as `sensor.on(name)` with `name` bound to null | A validation error naming the argument |
| `NEXO3008` | An access or a call written with `.` whose receiver can be null | A validation error giving the form with `?.` |
| `NEXO3009` | A name no local or object field in scope has | A validation error, giving the form with `it` where the implicit parameter has a member of that name |
| `NEXO2026` as structure, `NEXO3010` as validation | `it` where nothing gives it a value | A structure error where the text alone shows it, as outside every argument at the top level; a validation error within an argument of a member call or of a local function call, whose function decides |
| `NEXO3011` | A named indexer written without its key or as a call | A validation error giving its form, `x.setting[…]` |
| `NEXO3054` | A function written with its argument in brackets | A validation error giving the call |
| `NEXO3012` | An unnamed indexer on a type that declares none | A validation error, giving `room.["name"]` where the key is a string the receiver has a property of |
| `NEXO3055` | A number where a computed property's name stands, as `rooms.[0]` | A validation error giving `rooms[0]` |
| `NEXO3013` | A computed property's name that can be null, false or not a string | A validation error naming the access |
| `NEXO3056` | A computed property's name that names no property of the receiver | A validation error naming the access and the name |
| `NEXO3014` | A computed property's name written in a form whose names resolution cannot determine, as `it.[it["mode"]]` | A validation error saying its names cannot be determined |
| `NEXO3015` | A computed property access whose possible names give results no one type holds | A validation error naming the names and their types |
| `NEXO3016` | A computed property's name settling to a named indexer's name, as `device.[p][k]` with `p` settling to `"setting"` | A validation error saying it names an indexer, not a property |
| `NEXO3017` | A member written in a form its declaration does not take | A validation error giving the form |
| `NEXO3057` | An argument that does not supply its input | A validation error giving the input |
| `NEXO3058` | More arguments than a member takes | A validation error giving the number of arguments it takes |
| `NEXO3018` | An options object's field the member has no parameter for | A validation error naming the parameters it has |
| `NEXO3019` | A cast or a conversion naming a type that neither Nexo, nor the script's imports by name, nor a module the script imports declares publicly | A validation error, giving the import where a module the script does not import declares it |
| `NEXO3059` | A cast or a conversion naming a type several imported modules share unqualified | A validation error giving the qualified names where each selects one alone |
| `NEXO3020` | A cast to a name that is not a reference type | A validation error naming the types |
| `NEXO3060` | A cast of a target that can never be of its type, its hierarchy and its declared casts reaching none | A validation error naming the types |
| `NEXO3021` | A conversion to a type that is not data: a reference type, a list, a nullable type, or a structured type holding a reference | A validation error naming the type |
| `NEXO3022` | A conversion between types no conversion operator joins, as `enabled to Number` | A validation error naming the types its source converts to |
| `NEXO3023` | A script reaching an internal declaration of any module, through any form | A validation error naming the declaration, as if no declaration of its name were accessible |
| `NEXO3024` | Several applicable declarations a reference can't choose among: applicable extensions, or applicable operators of one destination, none of them the owner's, none of whose targets is more specific than every other's, two on one target among them; one module's members, unnamed indexers or operators applicable to a receiver, none of whose receiver types is more specific than every other's, as unrelated ones a `List<Never>` satisfies; and a qualified call a module member and a receiver's member of its name both take | A validation error naming the modules, and the extension accesses to write where they are members and each has a spelling that selects it alone |
| `NEXO3025` | A receiver of unknown type whose candidate declarations disagree on who invokes them | A validation error saying a cast names which is meant |
| `NEXO3026` | An extension access naming no extension | A validation error giving the written name, saying so where only an ordinary type has it; `device:setting["mode"]` gives `device.setting["mode"]` where the receiver has that member |
| `NEXO3061` | An extension access naming one several extensions share unqualified | A validation error giving the qualified names where each selects one alone |
| `NEXO3062` | An extension access naming a member the extension does not declare | A validation error giving the extension and the member |
| `NEXO3027` | An extension access whose receiver does not satisfy the extension's target | A validation error naming the target and the receiver's type |
| `NEXO3063` | An extension access written with `:` whose receiver can be null | A validation error giving `?:` |
| `NEXO3028` | A call's type parameter its arguments bind ambiguously or not at all | A validation error naming the parameter |
| `NEXO3064` | A call's type parameter given candidates of different types | A validation error naming the parameter and each candidate |
| `NEXO3065` | An argument that does not satisfy a binding its receiver established | A validation error naming the argument and the binding |
| `NEXO3029` | A deferred call given an argument whose reading depends on the declaration it selects, an implicit body or a predicate | A validation error giving the arrow function to write, or saying to make the receiver known or to select its extension explicitly |
| `NEXO3030` | An equality of two values whose types fit neither way | A validation error naming the types, and the test to write where a value is compared with the name of one of its Boolean members |
| `NEXO3066` | An equality of a value that is not a string, number, Boolean or reference value with one that is not null | A validation error naming the types |
| `NEXO3032` | An arithmetic operand that can be null | A validation error naming the operand, and the fallback to give it |
| `NEXO3067` | An arithmetic operand that is not a number | A validation error naming the operand |
| `NEXO3033` | A call that no local, function parameter or conditional binding holding a function answers | A validation error naming the function |
| `NEXO3068` | A call of a local holding a value, or a function that may be null | A validation error naming the function |
| `NEXO3069` | A call of the function a local, a function parameter or a conditional binding holds, given the wrong number of arguments | A validation error naming the function |
| `NEXO3070` | A call whose functions give no one type | A validation error naming the function |
| `NEXO3034` | A call that reaches a function within its own call, through a function passed to it | A validation error |
| `NEXO3035` | An object field or a result that would hold a function | A validation error |
| `NEXO3071` | A function given to a member's value parameter | A validation error |
| `NEXO3036` | A function given to a function parameter of another number of parameters, of parameters that do not take the callback contract's arguments, or of a result of another type | A validation error naming the parameter |
| `NEXO3072` | A function that may be null given to a function parameter | A validation error naming the parameter |
| `NEXO3073` | A value that is not a function given to a function parameter, as a Boolean local | A validation error naming the parameter |
| `NEXO3074` | An expression or a predicate argument that reads `it` and gives a function | A validation error naming the parameter |
| `NEXO3037` | A function reference that no declaration of its name takes | A validation error naming the module's declarations of its name |
| `NEXO3075` | A function reference that several declarations take | A validation error naming the module's declarations of its name |
| `NEXO3076` | A function reference naming a property, a host call or no function of its module | A validation error giving the form to write |
| `NEXO3038` | An interpolation of a value that can be null | A validation error naming the interpolation, and the fallback to give it |
| `NEXO3077` | An interpolation of no string or number | A validation error naming the interpolation, and the conversion to give it |
| `NEXO3039` | A comparison operand that can be null | A validation error naming the operand, and the fallback to give it |
| `NEXO3078` | A comparison operand that is not a number | A validation error naming the operand |
| `NEXO3040` | An `and` or an `or` whose operands give values no one type holds | A validation error naming them, and the conditional to write where null is an acceptable alternative |
| `NEXO3041` | Branches of different types | A validation error naming the types |
| `NEXO3042` | A receiver, an argument, an expression or a binding of the wrong type | A validation error naming where, the expected type and the type found |
| `NEXO3079` | An argument of the wrong kind | A validation error naming the argument and the kind it takes |
| `NEXO3080` | A missing required argument | A validation error naming the argument |
| `NEXO3081` | A collection expression whose items, or whose dictionary's values, share no type | A validation error naming the types |
| `NEXO3083` | A dictionary a call answers keyed by a type no key is of, as `toDictionary` and `groupBy` given a key expression of an object type | A validation error at the call, naming the key type |
| `NEXO3084` | An indexer's key no signature takes, or one of `Any` where several signatures stand | A validation error naming the indexer and its signatures' key types |
| `NEXO3085` | An index's offset that isn't a `Number`, or a range's boundary that is neither a `Number` nor an `Index`, either nullable among them | A validation error naming the boundary and its type |
| `NEXO3086` | An object expression constructing a structure that writes an object field the structure's data shape lacks | A validation error at the object field, naming the structure and its properties |
| `NEXO3087` | An object expression constructing a structure that leaves out a property whose type isn't nullable | A validation error at the object expression, naming the property and its type |
| `NEXO3088` | An object expression constructing a structure that gives a property a value its type doesn't take | A validation error at the value, naming the property, its type and the value's |
| `NEXO3089` | An object expression given as an indexer's key that constructs the keys of two or more of its signatures alike | A validation error at the key, naming the structures |
| `NEXO3082` | A function as a collection expression's item or value | A validation error at the item, saying a collection holds data and references |
| `NEXO3043` | A result that would contain a reference value | A validation error |
| `NEXO3044` | An object field read through `root` whose initializer has not completed where `root` is written | A validation error naming the object fields completed there |
| `NEXO3045` | A conditional or a coalescing operator choosing between `root` references of different object roots or object field sets | A validation error naming them |
| `NEXO3046` | A read, by its name or through `root`, of an option its member declares as an expression or a predicate, or of one given an implicit body | A validation error: `Option 'by' is an expression evaluated by the member against the implicit parameter it supplies; it has no single value to read here` |
| `NEXO3047` | An object field or a result that would hold `root` | A validation error: `The field 'copy' would hold root, the object being built, which no result holds; read its fields, as root.name` |
| `NEXO3048` | A host call anywhere but the script's terminal operation: in an object field, an argument, a condition, a conditional binding, an operand, a function's body or another call's result projection | A validation error |
| `NEXO3049` | A result projection following a host call that declares no result | A validation error |
| `NEXO3050` | A type selector's key the selector does not map to a type | A validation error naming the selector and the key |
| `NEXO3500` | An expression or a predicate argument given to a member that follows no list, a module member or a member of a receiver that is not a list | A validation error naming the member |
| `NEXO3600` | A result path into a script that ends in a host call supplying no value | A validation error naming the host call |
| `NEXO3601` | A result path indexing what is not a list | A validation error naming the type |
| `NEXO3602` | A result path naming an object field or a property its type does not hold | A validation error naming it and the type |

<a id="evaluation-errors"></a>

## Evaluation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO5001` | A value a strict cast rejects, by its destination's membership or by its operator's `reject` | An evaluation error naming the cast, the reason it gave and where it stands, as `The cast to Light rejected its value: it is a Thermostat`; null under `try` |
| `NEXO5016` | A value a conversion rejects | An evaluation error naming the conversion, the reason it gave and where it stands; null under `try` |
| `NEXO5002` | A `typeOf` that does not name a reference type of its module, an abstract one, an internal one, or one the value does not belong to | A fault naming the module and what asked |
| `NEXO5026` | A `typeOf` that throws | A fault naming the module and what asked, its `cause` exactly what `typeOf` threw |
| `NEXO5017` | An `isInstance` answering what isn't a Boolean | A fault naming the type and what asked |
| `NEXO5027` | An `isInstance` that throws | A fault naming the type and what asked, its `cause` exactly what `isInstance` threw |
| `NEXO5003` | A conversion that throws | A fault naming the conversion |
| `NEXO5018` | A conversion that rejects with a reason that is not a string, or rejects and then answers | A fault naming the conversion |
| `NEXO5019` | A conversion that answers null or a value not of its type | A fault naming the conversion |
| `NEXO5004` | A cast operator's `impl` failing other than by its `reject` | A fault naming the operator |
| `NEXO5005` | A division or a remainder by zero | An evaluation error at the operation |
| `NEXO5020` | An arithmetic result no finite number holds | An evaluation error at the operation |
| `NEXO5006` | A module returning a value of a type other than the one it declared | An evaluation error naming the member and its module |
| `NEXO5007` | A member failing unexpectedly while it evaluates, its implementation throwing | An evaluation error at the member, its `cause` exactly what the implementation threw, as [the evaluator](runtime/evaluation.md#runtime-evaluation) sets out |
| `NEXO5008` | A function given to a member called after that member's invocation has ended | An evaluation error |
| `NEXO5009` | A hook that throws: `beforeInvoke`, a host refusing a member among them, `afterInvoke`, or `afterEvaluation` after a completed evaluation | An evaluation error at that member, its `cause` exactly what the hook threw, as [a hook that throws](runtime/evaluation.md#runtime-evaluation) sets out; after a failed evaluation, the cleanup's failure is recorded on the original error |
| `NEXO5010` | Evaluating an evaluator from within its own evaluation | An evaluation error |
| `NEXO5011` | Evaluating without `beforeInvoke` a script that reads a maintained member | An evaluation error |
| `NEXO5012` | A deferred access whose receiver's actual type lacks the member, or doesn't satisfy it | An evaluation error naming the access and the actual type |
| `NEXO5500` | An interpolation given what is neither a string nor a number when it is evaluated, as an operand of `Any` can be | An evaluation error naming the interpolation and the value |
| `NEXO5501` | An ordering given what is not a number when it is evaluated, as an operand of `Any` can be | An evaluation error naming the operator and the value |
| `NEXO5505` | An arithmetic operand or a negated value that is not a number when it is evaluated, as an operand of `Any` can be | An evaluation error naming the operator and the value |
| `NEXO5024` | An equality whose operands are found, when they are evaluated, of types that fit neither way, as an operand of `Any` can be | An evaluation error naming both types |
| `NEXO5025` | An equality of a structured value, a list or an object, found when it is evaluated, with a value that isn't null, as an operand of `Any` can be | An evaluation error naming the type |
| `NEXO5021` | An `Any` argument that does not satisfy its parameter | An evaluation error naming the argument and the actual type |
| `NEXO5022` | A direct access on null at a deferred access, through `.` or `:` | An evaluation error naming the access, and giving `?.` or `?:` |
| `NEXO5029` | `toDictionary` given two items of one key | An evaluation error at the call, naming the key and giving `groupBy` |
| `NEXO5030` | `single` of a list of several items | An evaluation error at the access, naming how many |
| `NEXO5031` | `selectMany` given null for an item's list | An evaluation error at the call |
| `NEXO5032` | An index's offset or a range's boundary that is no nonnegative safe integer, nor an index for a boundary, when it is evaluated, as `^1.5` and a value of `Any` of another kind | An evaluation error at the index or the range |
| `NEXO5033` | A range sliced from a list or a string whose start stands after its end, or either beyond the list or the string | An evaluation error at the indexer, naming the range and the length |
| `NEXO5034` | `pick` given a position no item stands at | An evaluation error at the call, naming the position |
| `NEXO5035` | `sequence` given a count that is no nonnegative safe integer | An evaluation error at the call, naming the count |
| `NEXO5036` | An ordering key that is no number, string, Boolean or null, or keys of two of those domains in one criterion, of `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `minBy` or `maxBy` | An evaluation error at the call, naming the member and the key's kind or the two domains |
| `NEXO5037` | `thenBy` or `thenByDescending` of a list no `orderBy` ordered | An evaluation error at the call, giving `orderBy` |
| `NEXO5039` | `clamp` given a low greater than its high | An evaluation error at the call, naming both |
| `NEXO5040` | `replace` or `split` given the empty text, which stands at every position | An evaluation error at the call, naming the member |
| `NEXO5041` | A string's slice by a range whose start or end stands between the two halves of a surrogate pair | An evaluation error at the indexer, naming the range and the boundary |
| `NEXO5038` | A value of `Any` an object expression gives a structure's property that is found, when it is evaluated, not to be of the property's type | An evaluation error at the object expression, naming the property, its type and the value |
| `NEXO5028` | A result holding a value of `Any` that is found, when it is evaluated, to be no data, a reference or a function | An evaluation error at the result |
| `NEXO5013` | A deferred access whose selection would be a host call | An evaluation error, before anything is invoked, saying to make the receiver known or to select its extension explicitly |
| `NEXO5014` | Preparing a script that ends in no host call | An evaluation error, as [host calls](runtime/host-calls.md#runtime-host-calls) set out |
| `NEXO5023` | Evaluating a script that ends in a host call | An evaluation error, as [host calls](runtime/host-calls.md#runtime-host-calls) set out |
| `NEXO5015` | A value a host supplies, or a part of it, that its host call's declared result does not admit, or that reaches itself, as [capturing a supplied value](runtime/host-calls.md#runtime-host-calls-capturing) sets out | An evaluation error naming the call and the part |
| `NEXO5503` | A function a member calls with arguments other than its callback contract declares, in number or in type | An evaluation error naming the function and the member |
| `NEXO5504` | A function or a body given to a member that answers, when it is evaluated, a value its callback contract's result type does not admit, as an answer of `Any` can be | An evaluation error naming the function, the member and the value |

A script is validated before any evaluation, as [what resolution checks](runtime/resolution.md#validation-vocabulary-and-types) sets out. An evaluation error fails the whole result, and the host receives the error in its place.

<a id="diagnostics-tolerant-reading"></a>

## Tolerant reading

Tooling reads text that is still being written, so it reads tolerantly: text that is not a token becomes an invalid token holding its diagnostic, `{ code, message, offset }`, and reading goes on after it, so the tokens cover the whole text whatever it holds. A strict reading meets the same diagnostic and throws it as a syntax error. One reader serves both, so a diagnostic says the same thing whichever way it is reached; the [design](../docs/nexo-design.md#the-syntax-tree) sets out how the syntax tree builds on it.

<a id="diagnostics-retired-codes"></a>

## Retired codes

A code leaves its table only by being retired here, with the condition it identified and the version that retired it, so the evidence of its use survives; no code listed here is assigned again.

| Code | Condition | Retired in |
| --- | --- | --- |
| `NEXO2023` | A declared binding type that is not a reference type, which a declared data type, captured, now is | `1.0.0-alpha.36` |
| `NEXO3031` | An operand of `and`, `or` or `not`, a condition or a conditional binding of what is not a value, which a host call alone is and `NEXO3048` identifies | `1.0.0-alpha.34` |
| `NEXO1047` | An import whose local name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO1065` | An import whose local name is a reserved word, `Nexo` or the name of one of Nexo's own types or extensions, each a name `@` or the import's own declaration distinguishes | `1.0.0-alpha.34` |
| `NEXO4004` | A type whose name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO4005` | A module whose name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO4034` | A type named as one of Nexo's own types or `Null`, a name a type of another module may share | `1.0.0-alpha.34` |
| `NEXO4013` | A module member named as one of the module's extensions, the two never reached in one position | `1.0.0-alpha.34` |
| `NEXO4509` | A structured type whose `fields` were empty, a code of language `1.0.0-alpha.33` alone: a structured type declares its data shape as its properties, and may declare none | `1.0.0-alpha.34` |
| `NEXO4510` | A `fields` entry that was not a name with a type, a code of language `1.0.0-alpha.33` alone: a data property is a member, refused as any member is | `1.0.0-alpha.34` |
| `NEXO4511` | A selectable type's key not written as a letter followed by letters, digits, colons and hyphens, a code of language `1.0.0-alpha.33` alone: a mapping's key is any string | `1.0.0-alpha.34` |
| `NEXO4556` | A type of the kind `structured` or `extension`, a code of language `1.0.0-alpha.33` alone, which read neither | `1.0.0-alpha.34` |
| `NEXO4528` | An indexer declared without a name, a code of language `1.0.0-alpha.33` alone: an indexer without one is its type's unnamed indexer | `1.0.0-alpha.34` |
| `NEXO4530` | `default` on a member that was not an indexer, a code of language `1.0.0-alpha.33` alone: `default` is a key no member takes | `1.0.0-alpha.34` |
| `NEXO4531` | A `syntax` that was neither `function-call` nor `indexer`, a code of language `1.0.0-alpha.33` alone: a member's kind says how it is written | `1.0.0-alpha.34` |
| `NEXO4532` | An indexer whose `arguments` were not positional, a code of language `1.0.0-alpha.33` alone: an indexer takes no `arguments` | `1.0.0-alpha.34` |
| `NEXO4533` | A `default` that was not a Boolean, a code of language `1.0.0-alpha.33` alone: `default` is a key no member takes | `1.0.0-alpha.34` |
| `NEXO4014` | A module member and a member of its name on one of the module's own types, a qualified call both take refused as ambiguous where it is resolved | `1.0.0-alpha.34` |
| `NEXO4553` | A module member and a member of its name on a type its module does not declare, which alpha.33 refused; a qualified call both take is refused as ambiguous where it is resolved | `1.0.0-alpha.34` |
| `NEXO4036` | A module named by a reserved word, `Nexo`, or one of Nexo's own types or extensions, `Nexo` refused as any registered name is and the rest names a module may share | `1.0.0-alpha.34` |
| `NEXO4046` | A type named as one of Nexo's own extensions, a name another module's declaration may share, ambiguity checked where a reference resolves | `1.0.0-alpha.34` |
| `NEXO5502` | A definition node no evaluation existed for, a code of language `1.0.0-alpha.33` alone: every node a definition holds is evaluated by its kind, a namespace, an interpolation's text and its expressions by the node that holds them | `1.0.0-alpha.34` |
| `NEXO2640` | `nexo.format` or `nexo.quote` given a definition reading through a namespace, which text read without a registry's module names could not write, a code of language `1.0.0-alpha.33` alone: a definition's imports give every namespace it reads, and canonical text writes them | `1.0.0-alpha.34` |
| `NEXO2641` | A definition read without a registry's module names that wrote one of them alone, which the registry read as that module's namespace, a code of language `1.0.0-alpha.33` alone: a text reads alike whatever reads it, its imports deciding its namespaces | `1.0.0-alpha.34` |
| `NEXO2642` | A namespace naming no module the registry held, a code of language `1.0.0-alpha.33` alone: a namespace names a local name its imports give, `NEXO2028`, and an import of a module the registry doesn't hold is `NEXO3002` | `1.0.0-alpha.34` |
| `NEXO4557` | A module named by a reserved word, which text reached only through an import binding, a code of language `1.0.0-alpha.33` alone: the script imports it and reads its namespace with `@` | `1.0.0-alpha.34` |
| `NEXO1500` | A colon or `?:` in a chain followed by a name, which language `1.0.0-alpha.33` refused, a code of that language alone: it begins an extension access, and one brackets follow directly is `NEXO1014` | `1.0.0-alpha.34` |
| `NEXO3501` | An access a definition wrote selecting an extension explicitly, refused before text wrote extension access, a code of language `1.0.0-alpha.33` alone: an extension access is resolved through its extension | `1.0.0-alpha.34` |
