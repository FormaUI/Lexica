# Definition

<a id="definition"></a>

An expression's **definition** is a JSON document recording its meaning, its **expression tree** with the version of its format: every expression, read from its source or created directly, is one definition, and validation, resolution and evaluation work on the definition alone. It records what the text means, never its punctuation, and comments, commas and layout leave no trace in it.

A document holds the definition's `version` and the `expression` node, the root of its expression tree. The version changes whenever the definition's shape or meaning does, and a definition of a version other than the one an implementation reads is a structure error. Each node is an object whose `kind` says what it is:

| Kind | Properties | Records |
| --- | --- | --- |
| `literal` | `value`, a JSON string, a finite number, a Boolean or null | A literal |
| `parameter` | `name` | A parameter, the caller's binding of the name; text writes it alone where its name is no reserved word, no local, field or function parameter of its name is in scope and no local of its name is declared later in its scope, and after `~` otherwise |
| `it` | None | The implicit parameter |
| `root` | None | The object root |
| `namespace` | `name`, the module's name | A module's namespace, the target of a `member` or a `call` node that reads one of the module's members or calls a qualified form through it |
| `local` | `name` | A use of a local, a function parameter or a field, one in scope where it stands |
| `member` | `name`, the member's name, or for a bracket property access whose expression is no string literal that is a name, that expression's node; `target`, the receiver; and `optional`, true, where it is written with `?.` or `?[` | A property access, or a bracket property access |
| `call` | `name`; `arguments`, its arguments in order, empty where it is given none; `target`, the receiver; and `optional`, true, where it is written with `?.` | A function call |
| `indexer` | `name`, left out for the default indexer; `argument`, its key; `target`, the receiver; and `optional`, true, where it is written with `?:` | A named indexer, or the receiver's default indexer |
| `object` | `fields`; `locals`, where it has any; and `target`, the node the object expression follows | An object expression; without a target, one keeping the implicit parameter around it, which at the top level is absent |
| `equality` | `left` and `right`, the two expressions it compares | An equality; `!=` is a `not` holding one |
| `body` | `locals`, each its `name` and its `value`, in order, and `result`, the value the body gives | A body: the root expression's, a `do` block's, a function's or a conditional branch's, and nowhere else |
| `do` | `body`, an expression alone or a `body` node | A do block |
| `function` | `parameters`, the names it declares, and `body`, the body a call evaluates | A function, a local's initializer alone |
| `functionCall` | `name`, the local function's name, and `arguments`, as many as its parameters | A call of a local function |
| `interpolatedString` | `parts`, its text and its interpolations in order: each `{ "kind": "text", "value": … }`, the characters the text stands for, or `{ "kind": "expression", "expression": … }` | An interpolated string; adjacent text is one part and empty text none, and a diagnostic names a part by the index the definition it was created from gave it |
| `comparison` | `operands`, two or more expressions, and `operators`, one of `<`, `<=`, `>` and `>=` between each two | A comparison, or a chain of them |
| `conditional` | `condition`, the expression it tests, or `binding`, the `name` it binds and the `value` it binds to it, one of them; and `consequent` and `alternative`, two expressions | A conditional, `if let` holding a binding; an `elseif` is a conditional nested in the alternative before it |
| `coalescing` | `value` and `fallback`, two expressions | A coalescing operator |
| `cast` | `type`, the name of the reference type it casts to, and `target`, the expression it casts | A cast |
| `conversion` | `type`, the name of the type it converts to, and `target`, the expression it converts | A conversion |
| `try` | `target`, the conversion or the cast it attempts | An attempt |
| `optionalChain` | `target`, the chain it holds | An optional chain: the chain of property accesses, calls, indexers and object expressions whose optional accesses end at it, holding at least one |
| `and`, `or` | `operands`, two or more expressions | A logical expression |
| `not` | `operand`, the expression it negates | A negation |
| `arithmetic` | `operator`, one of `+`, `-`, `*`, `/` and `%`, and `left` and `right`, its operands | An arithmetic operation |
| `negate` | `operand`, the number it negates | An arithmetic negation of a number; a numeric literal negated is the negative literal |

A parenthesized expression adds no node, the expression it holds standing in its place, and neither does an optional enclosed access, whose accesses are recorded as optional and its optional chain where it ends, so `device.is("active") and (device.has("battery"))` is an `and` of two function calls:

```json
{
  "kind": "and",
  "operands": [
    { "kind": "call", "target": { "kind": "parameter", "name": "device" }, "name": "is", "arguments": [{ "kind": "literal", "value": "active" }] },
    { "kind": "call", "target": { "kind": "parameter", "name": "device" }, "name": "has", "arguments": [{ "kind": "literal", "value": "battery" }] }
  ]
}
```

Every property access, call and indexer holds its receiver as its `target`, and every equality its `left` and its `right`, required, and an omitted target never stands for `it`, so `it.power` and `device.power` are distinct definitions. A member read or a qualified form called through a namespace holds a `namespace` node as its target, so `home.rooms` is a `member` whose target is `{ "kind": "namespace", "name": "home" }`, and `energy.usage(device)` a `call` whose target is `energy`'s namespace and whose first argument is the receiver.

A call's `arguments` are its argument nodes in order, and an indexer's `argument` its key's node, each recorded as written; where a call's member takes options, its one argument is an object node whose fields resolution maps onto the member's parameters.

A field is an object holding its `name` and its `value` node, both required; an object expression's fields keep their order, and an object expression holds at least one. A local is an object of the same two properties, and an object expression's locals keep their order, its definition leaving `locals` out where it has none.

`room { name = it.name, occupied = it.is("occupied") }` has this definition:

```json
{
  "version": 32,
  "expression": {
    "kind": "object",
    "target": { "kind": "parameter", "name": "room" },
    "fields": [
      { "name": "name", "value": { "kind": "member", "target": { "kind": "it" }, "name": "name" } },
      {
        "name": "occupied",
        "value": {
          "kind": "call",
          "target": { "kind": "it" },
          "name": "is",
          "arguments": [{ "kind": "literal", "value": "occupied" }]
        }
      }
    ]
  }
}
```

A chain is recorded as a succession of targets: in `room.device("lamp").power`, `power` is a property access whose target is the call `device`, whose target is the parameter `room`. A chain that holds an optional access is the target of an `optionalChain` node, which records where its short-circuit ends, so `room.device(name)?.room.devices.count`, one optional chain, and `(room.device(name)?.room.devices).count`, a property access of one, are distinct definitions.

A definition names its parameters and never holds their values. A value is bound to its name by the host, through whatever mechanism its environment offers, so the same definition serves every binding.

<a id="validation"></a>

## Validation

Validation happens before evaluation. Structure is checked when the request is created; vocabulary and types are checked when it is prepared.

<a id="validation-syntax-and-structure"></a>

### Syntax and structure

Text must follow the syntax. A directly created definition must follow the same node structures and structural rules.

| Area | Required structure |
| --- | --- |
| Fields | Every field has a name and value; names are unique within an object expression; an object expression has at least one field. |
| Locals | Each has a name and value; names are unique within a body or object expression; references name an in-scope local or field. |
| Declaration order | No reference uses a local before its declaration or within its own initializer. A name written alone cannot fall back to a caller binding when that local is declared later in the same scope. |
| Explicit parameters | A definition's `parameter` node, written as `~name` when necessary, reads the caller's binding regardless of local declarations. |
| Simple expressions | Arguments, indexer keys, bracket property names and interpolations obey the restrictions recursively; an object expression within one, as an options object, declares no locals, though it may use those in scope. |
| Members | Every property access, call and indexer has a receiver. |
| Equality | Both operands are present. |
| Comparisons | At least two operands; exactly one operator between each pair; every operator is one of `<`, `<=`, `>`, `>=` and points in the same direction. |
| Interpolated strings | Every part is text containing a string, or an expression part. |
| Bodies | Locals and one result are present; local names are unique and are not used before declaration; a body stands only as the root expression's, a do block's, a function's or a conditional branch's. |
| Chain receivers | A conditional or body cannot be a chain receiver. |
| Functions | Each is a local initializer, or an arrow function that is also an argument, with unique parameter names; an arrow function's body is a simple expression; a function cannot be called before its local is declared. |
| Optional access | Each optional access is within an optional chain, following the targets of property accesses, calls, indexers and object expressions; each optional chain contains an optional access. |
| `it` | `it` cannot appear where no implicit parameter is available, including a top-level object's unqualified fields. |
| Logical expressions | `and` and `or` have at least two operands; `not` has its operand. |
| Arithmetic | An arithmetic node has a supported operator and both operands; a `negate` node has its operand. |
| Coalescing | Both value and fallback are present. |
| Casts | The type is a string and the whole target has the form text writes a cast's target in. |
| Literals | A literal is a string, a finite number, a Boolean or null, so a number no finite number holds, as `1e999`, is refused in text as in a definition. |

A cast's target is checked whole: a receiver, which is the implicit parameter, a parameter, `root`, a namespace's member, a local, a literal, an interpolated string, a function call, an untargeted object expression or a grouped cast, and the property accesses, calls and indexers after it, an optional chain of them included; or a coalescing operator or a cast as it is, grouped, as the [cast rules](casts-and-conversions.md#casts) set out. A definition whose cast target is otherwise is a structure error, so every definition accepted writes text that parses.

A binding may be named `it`, `root` or a module's name, as any name can, and an expression reads it as `~it`, `~root` or `~home`.

<a id="validation-vocabulary-and-types"></a>

### Vocabulary and types

Preparation checks the following contracts:

| Area | Required contract |
| --- | --- |
| Member resolution | Every member and extension exists and uses its declared form. |
| Arguments | Positional arguments match the signature's order and count; options use one object whose fields name the member's parameters; every required parameter is supplied. |
| Types and kinds | Receivers, arguments, expressions and bindings fit their declared types; each argument uses its declared argument kind. |
| Required access | Access written with `.` has a receiver that cannot be null. Other required access forms follow the same nullability rule. |
| Fixed arguments | Preparation settles each to a non-null string without evaluating a member: a literal, a bound parameter, or a local, a conditional binding, a conditional, a `??`, an `and` or an `or` that settles to one, a function parameter within a call's body where the call's argument settles, and a `do` block whose locals and result settle, as [Arguments](access-and-calls.md#arguments) and [Bodies](bodies-and-functions.md#bodies-fixed-arguments) set out. |
| Bracket property access | Preparation determines every possible property name; each names a property of the receiver and their types merge. |
| Local use | Each reference is in scope; a value local is used as a value, a function local as a call. |
| Casts | The target type is `node` or a node kind, and the operand can be of that type. |
| Conversions and attempts | The target type and conversion pair are valid; an attempt follows the same validation rules as its strict operation. |
| Equality | Operand types fit in at least one direction. Values other than strings, numbers, Booleans and nodes compare only with null. |
| Arithmetic and comparisons | Every operand is a non-null number. |
| Interpolation | Every interpolation gives a non-null string or number. |
| Function calls | The local or function parameter holds a function, never null; the argument count matches each function it may be, whose body resolves against that call's argument types, their results merging; no call reaches a function within its own call. |
| Conditions and logical operands | Each is a value. Truthiness determines the branch; an event source, action or behavior cannot be used as that value. |
| Coalescing | Value and fallback have compatible types. |
| Conditionals | Branch result types are compatible. |
| Implicit parameter | Each expression is valid with the implicit parameter its member declares. |
| Request kind | The caller uses the request as its declared kind. |
| Output | A result contains data alone. |

All branches and operands are validated even when evaluation will not reach them, and a resolution lists every declaration the expression may use, one only an unreached branch uses included, so a host's policy over them, as whether a request may be watched, concerns them all before anything is evaluated.

<a id="validation-diagnostics"></a>

### Diagnostics

A syntax error identifies its position in the text, its offset, line and column. A structure, validation or evaluation error identifies its node in the definition, expressed as a JSON Pointer, and, where the request was made from text, its position in the text as well. An error in a binding names the binding, and a module error the module and the declaration, located by neither.

An evaluation error fails the entire result and is delivered to the caller in its place. See [Errors and diagnostics](errors.md#errors-and-diagnostics).
