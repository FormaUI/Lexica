# Errors

<a id="language-errors"></a>

A script that breaks a rule of the language fails with an error, and this catalog gives each condition it can break, with its code and its kind: `syntax`, text that does not follow the grammar; `structure`, a script that breaks a structural rule, of scope, of naming or of where a construct may stand; `validation`, a script that does not fit its vocabulary or its types; and `evaluation`, a failure only evaluating the script finds. Each code is `NEXO` and four digits, stable once assigned, as [codes](../runtime/errors.md#diagnostics-codes) set out, and how an error reaches a host, its object and where it is located, is the runtime's, as [errors](../runtime/errors.md) set out; the conditions a host's declarations, bindings and use of the API break are catalogued there too.

`try` handles only a cast or a conversion rejecting its value; every other error fails the operation.

In this document:

1. [Absence and unavailable values](#absence-and-unavailable-values)
2. [Syntax errors](#syntax-errors)
3. [Structure errors](#structure-errors)
4. [Validation errors](#preparation-and-type-errors)
5. [Evaluation errors](#evaluation-errors)
6. [Retired codes](#diagnostics-retired-codes)

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
| `NEXO1014` | A colon in a chain that no member's name follows, as `it:[name]`, `it?:[name]` or `f(count: 5)` | A syntax error; brackets after it give the unnamed indexer `it[name]` or the computed property access `it.[name]`, and their optional forms |
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
| `NEXO1057` as syntax, `NEXO2027` as structure | An arrow function that is neither a local's initializer nor an argument, a list's item, a dictionary's value and an indexer's key among them | A syntax error in text, saying an item, a value or a key is data where one stands there, and a structure error in a definition |
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
| `NEXO2043` | Two entries of one dictionary a collection expression writes sharing a key, compared exactly | A structure error at the later entry, naming the key |
| `NEXO2527` | An object expression holding locals within a simple expression | A structure error naming the part, which a local holds first |

<a id="preparation-and-type-errors"></a>

## Validation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO3001` | A misspelled member or extension | A validation error, with its location; a property access with a hyphen, as `it.floor-area`, giving the camelCase member, `it.floorArea` |
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
| `NEXO3024` | Several applicable declarations a reference can't choose among: applicable extensions, or applicable operators of one destination, none of them the owner's, none of whose targets is more specific than every other's, two on one target among them; one module's members, unnamed indexers or operators applicable to a receiver, none of whose receiver types is more specific than every other's, as unrelated ones a `List<Never>` satisfies; and a qualified call a module member and a receiver's member of its name both take | A validation error naming the modules, and the extension accesses to write where they are extension members and each has a spelling that selects it alone |
| `NEXO3025` | A receiver of unknown type whose candidate declarations disagree on who invokes them | A validation error saying a cast names which is meant |
| `NEXO3026` | An extension access whose first name, followed by others, names neither an extension nor an extension member of its receiver, a name that names no extension where the access reads it as one, or an access on a namespace, which no extension extends | A validation error at the name, saying where only an ordinary type has it |
| `NEXO3061` | An extension access naming one several extensions share unqualified | A validation error giving the qualified names where each selects one alone |
| `NEXO3062` | An extension access whose member no applicable extension declares, or the extension it names does not | A validation error giving the member, and the extension where it names one; `device:power` on a type no extension extends gives `device.power` where the owner declares it |
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
| `NEXO3090` | An extension member read with `.`, as `device.usage` | A validation error giving `device:usage` |
| `NEXO3091` | An extension access whose names read more than one way, as `name:size.width` where `size` is an extension member and an extension declaring `width` | A validation error giving the text that writes each way: a group, `(name:size).width`, and the extension named through its module |
| `NEXO3082` | A function resolution finds as a collection expression's item or value, or as an indexer's key: a script's function, a reference or a local holding one | A validation error at the item, the value or the key, saying it is data |
| `NEXO3043` | A result that would contain a reference value | A validation error |
| `NEXO3044` | An object field read through `root` whose initializer has not completed where `root` is written | A validation error naming the object fields completed there |
| `NEXO3045` | A conditional or a coalescing operator choosing between `root` references of different object roots or object field sets | A validation error naming them |
| `NEXO3046` | A read, by its name or through `root`, of an option its member declares as an expression or a predicate, or of one given an implicit body | A validation error: `Option 'by' is an expression evaluated by the member against the implicit parameter it supplies; it has no single value to read here` |
| `NEXO3047` | An object field or a result that would hold `root` | A validation error: `The field 'copy' would hold root, the object being built, which no result holds; read its fields, as root.name` |
| `NEXO3048` | A host call anywhere but the script's terminal operation: in an object field, an argument, a condition, a conditional binding, an operand, a function's body or another call's result projection | A validation error |
| `NEXO3049` | A result projection following a host call that declares no result | A validation error |
| `NEXO3050` | A type selector's key the selector does not map to a type | A validation error naming the selector and the key |
| `NEXO3500` | An expression or a predicate argument given to a member that follows no list, a module member or a member of a receiver that is not a list | A validation error naming the member |

<a id="evaluation-errors"></a>

## Evaluation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO5001` | A value a strict cast rejects, by its destination's membership or by its operator's `reject` | An evaluation error naming the cast, the reason it gave and where it stands, as `The cast to Light rejected its value: it is a Thermostat`; null under `try` |
| `NEXO5016` | A value a conversion rejects | An evaluation error naming the conversion, the reason it gave and where it stands; null under `try` |
| `NEXO5005` | A division or a remainder by zero | An evaluation error at the operation |
| `NEXO5020` | An arithmetic result no finite number holds | An evaluation error at the operation |
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
| `NEXO5504` | A function or a body given to a member that answers, when it is evaluated, a value its callback contract's result type does not admit, as an answer of `Any` can be | An evaluation error naming the function, the member and the value |

A script is validated before any evaluation, as [what resolution checks](../runtime/resolution.md#validation-vocabulary-and-types) sets out, so an evaluation error is one only evaluation finds.

<a id="diagnostics-retired-codes"></a>

## Retired codes

A code of the language's conditions leaves its table only by being retired here, with the condition it identified and the version that retired it, never assigned again, as [codes](../runtime/errors.md#diagnostics-codes) set out.

| Code | Condition | Retired in |
| --- | --- | --- |
| `NEXO3031` | An operand of `and`, `or` or `not`, a condition or a conditional binding of what is not a value, which a host call alone is and `NEXO3048` identifies | `1.0.0-alpha.34` |
| `NEXO1047` | An import whose local name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO1065` | An import whose local name is a reserved word, `Nexo` or the name of one of Nexo's own types or extensions, each a name `@` or the import's own declaration distinguishes | `1.0.0-alpha.34` |
| `NEXO1500` | A colon or `?:` in a chain followed by a name, which language `1.0.0-alpha.33` refused, a code of that language alone: it begins an extension access, and one brackets follow directly is `NEXO1014` | `1.0.0-alpha.34` |
| `NEXO1071` | An extension access whose names fitted none of its forms, more than three or three whose first named no module, which language `1.0.0-alpha.40` refused as it read them, a code of that language alone: the declarations its names name decide how they read | `1.0.0-alpha.41` |
