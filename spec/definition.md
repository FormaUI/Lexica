# Definition

<a id="definition"></a>

A script's **definition** is a JSON document recording its meaning, its **expression tree** with the version of its format: every script, read from its source or created directly, has one definition, and validation, resolution and evaluation work on the definition alone. It records what the text means, never its punctuation, and comments, commas and layout leave no trace in it.

A document holds the definition's `version`, its `imports` and the `expression` node, the root of its expression tree. Its imports are the names of the modules the script [imports](scripts.md#scripts-imports), those its text writes and those its host supplies alike, each once and in order of name, and an empty list where it imports none; which ones a host supplied is not recorded, since that does not change what the script means. The version is the definition format's, and changes whenever the serialized definition's contract does, the nodes it holds, their fields and the values those take; a change to the language that leaves that contract as it was advances the language specification's version alone. A definition of a version other than the one an implementation reads is a structure error naming both, so an implementation of version 34 refuses a definition of version 33, though every node one holds is one a version 34 definition may hold: no implementation reads two versions or converts one into another. Version 34 records a script's imports.

In this document:

1. [Nodes](#definition-nodes)
2. [Structural validation](#validation)
3. [Canonical text](#definition-canonical-text)

<a id="definition-nodes"></a>
<a id="functions-definition"></a>

## Nodes

Each node is an object whose `kind` says what it is:

| Kind | Properties | Records |
| --- | --- | --- |
| `literal` | `value`, a JSON string, a finite number, a Boolean or null | A literal |
| `parameter` | `name` | A script parameter; text writes it alone where its name is not a reserved word, nor the name of a module the definition imports, no local, field or function parameter of its name is in scope and no local of its name is declared later in its scope, and with `~` before its name otherwise |
| `it` | None | The implicit parameter |
| `root` | None | The object root |
| `namespace` | `name`, the module's name | A module's namespace, the target of a `member` or a `call` node that reads one of the module's members or calls a qualified form through it |
| `local` | `name` | A use of a local, a function parameter or a field, one in scope where it stands |
| `member` | `name`, the member's name, or for a computed property access whose expression is not a string literal that is a name, that expression's node; `target`, the receiver; and `optional`, true, where it is written with `?.` | A property access, or a computed property access |
| `call` | `name`; `arguments`, its arguments in order, empty where it is given none; `target`, the receiver; and `optional`, true, where it is written with `?.` | A function call |
| `indexer` | `argument`, its key; `target`, the receiver, or for a named indexer the `member` node of its name, which [resolution reads](members.md#property-access-calls-and-indexers-named-indexers) as one where the receiver's type declares it; and `optional`, true, where it is written with `?[` | An indexer: the receiver's unnamed indexer, a named indexer, or the unnamed indexer of a property's answer |
| `object` | `fields`; `locals`, where it has any; and `target`, the node the object expression follows | An object expression; without a target, one keeping the implicit parameter around it, which at the top level is absent |
| `equality` | `left` and `right`, the two expressions it compares | An equality; `!=` is a `not` holding one |
| `body` | `locals`, each its `name` and its `value`, in order, and `result`, the value the body gives | A body: the root expression's, a `do` block's, a function's or a conditional branch's, and nowhere else |
| `do` | `body`, an expression alone or a `body` node | A do block |
| `function` | `parameters`, the names it declares; `body`, the body a call evaluates; and `arrow`, true, for an arrow function, whose body is its one expression, validated as a simple expression | A function: a local's initializer, or an arrow function written as an argument |
| `functionCall` | `name`, the local function's name, and `arguments`, as many as its parameters | A call of a local function |
| `interpolatedString` | `parts`, its text and its interpolations in order: each `{ "kind": "text", "value": … }`, the characters the text stands for, or `{ "kind": "expression", "expression": … }` | An interpolated string; adjacent text is one part and empty text none, and a diagnostic names a part by the index the definition it was created from gave it |
| `comparison` | `operands`, two or more expressions, and `operators`, one of `<`, `<=`, `>` and `>=` between each two | A comparison, or a chain of them |
| `conditional` | `condition`, the expression it tests, or `binding`, the `name` it binds and the `value` it binds to it, one of them; and `consequent` and `alternative`, two expressions | A conditional, `if let` holding a binding; an `elseif` is a conditional nested in the alternative before it |
| `coalescing` | `value` and `fallback`, two expressions | A coalescing operator |
| `cast` | `type`, the name of the reference type it casts to, its local name, `Light`, or qualified by its module, `home.Light`, as written; and `target`, the expression it casts | A cast |
| `conversion` | `type`, the name of the type it converts to, its local name or qualified by its module, as written; and `target`, the expression it converts | A conversion |
| `try` | `target`, the conversion or the cast it attempts | An attempt |
| `optionalChain` | `target`, the chain it holds | An optional chain: the chain of property accesses, calls, indexers and object expressions whose optional accesses end at it, holding at least one |
| `and`, `or` | `operands`, two or more expressions | A logical expression |
| `not` | `operand`, the expression it negates | A negation |
| `arithmetic` | `operator`, one of `+`, `-`, `*`, `/` and `%`, and `left` and `right`, its operands | An arithmetic operation |
| `negate` | `operand`, the number it negates | An arithmetic negation of a number; a numeric literal negated is the negative literal |

A parenthesized expression does not add a node, the expression it holds standing in its place, and neither does an optional enclosed access, whose accesses are recorded as optional and its optional chain where it ends, so `device.active() and (device.batteryPowered())` is an `and` of two function calls:

```json
{
  "kind": "and",
  "operands": [
    { "kind": "call", "target": { "kind": "parameter", "name": "device" }, "name": "active", "arguments": [] },
    { "kind": "call", "target": { "kind": "parameter", "name": "device" }, "name": "batteryPowered", "arguments": [] }
  ]
}
```

Every property access, call and indexer holds its receiver as its `target`, and every equality its `left` and its `right`, required, and an omitted target never stands for `it`, so `it.power` and `device.power` are distinct definitions. A member read or a qualified form called through a namespace holds a `namespace` node as its target, so `home.rooms` is a `member` whose target is `{ "kind": "namespace", "name": "home" }`, and `energy.usage(device)` a `call` whose target is `energy`'s namespace and whose first argument is the receiver. A [function reference](functions.md#functions-module-functions) is a `member` node through a namespace, `home.active` as `home.rooms` is, which resolution tells apart by the declaration it names, and an [implicit body](functions.md#functions-implicit-bodies) is an argument node as it is written. An indexer after a property access holds that `member` node as its target, so `device.setting["mode"]` and `room.devices[0]` have one shape, and resolution tells a named indexer from a property's answer indexed by the declaration the name gives.

A call's `arguments` are its argument nodes in order, and an indexer's `argument` its key's node, each recorded as written; where a call's member takes options, its one argument is an object node whose fields resolution maps onto the member's parameters.

A field is an object holding its `name` and its `value` node, both required; an object expression's fields keep their order, and an object expression holds at least one. A local is an object of the same two properties, and an object expression's locals keep their order, its definition leaving `locals` out where it has none.

`room { name = it.name, occupied = it.occupied() }` has this definition:

```json
{
  "version": 34,
  "imports": ["energy", "home"],
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
          "name": "occupied",
          "arguments": []
        }
      }
    ]
  }
}
```

A chain is recorded as a succession of targets: in `room.device("lamp").power`, `power` is a property access whose target is the call `device`, whose target is the parameter `room`. A chain that holds an optional access is the target of an `optionalChain` node, which records where its short-circuit ends, so `room.device(name)?.room.devices.count`, one optional chain, and `(room.device(name)?.room.devices).count`, a property access of one, are distinct definitions.

A definition names its parameters and never holds their values. A value is bound to its name by the host, through whatever mechanism its environment offers, so the same definition serves every binding.

<a id="definition-bodies"></a>

### Bodies and conditionals

A body with explicit `return` is a `body` node containing ordered `locals` and a `result`. A body containing just an expression is that expression's own node, except a `do` block's: a `do` block is always a `do` node holding its body, so `do 7 end` is a `do` node whose body is the literal's node. A `body` node stands only as the script's, a `do` block's, a function's or a conditional branch's body.

Within one conditional, branches are all `body` nodes or none are; a branch that is a `do` block is an implicit branch, whose result is its `do` node. The alternative may itself be a conditional: after branches that use `return`, one whose branches use `return` too, as an `elseif` gives; after expression branches, one of either style.

<a id="validation"></a>

## Structural validation

Validation happens before evaluation. Structure is checked when a script is read or its definition created, by these rules; vocabulary and types are checked when it is resolved, as [what resolution checks](runtime.md#validation-vocabulary-and-types) sets out.

<a id="validation-syntax-and-structure"></a>

### Syntax and structure

Text must follow the syntax. A directly created definition must follow the same node structures and structural rules.

| Area | Required structure |
| --- | --- |
| Imports | Each names a module, by a name that is not a reserved word and not `lexica`, once and in order of name; every `namespace` node names one of them. |
| Fields | Every field has a name and value; names are unique within an object expression; an object expression has at least one field. |
| Locals | Each has a name and value; names are unique within a body or object expression; references name an in-scope local or field. |
| Declaration order | No reference uses a local before its declaration or within its own initializer. A name written alone cannot fall back to a script parameter when that local is declared later in the same scope. |
| Script parameters | A definition's `parameter` node, written with `~` when necessary, reads the script parameter regardless of local declarations. |
| Simple expressions | Arguments, indexer keys, computed property names and interpolations obey the restrictions recursively; an object expression within one, as an options object, declares no locals, though it may use those in scope. |
| Members | Every property access, call and indexer has a receiver. |
| Equality | Both operands are present. |
| Comparisons | At least two operands; exactly one operator between each pair; every operator is one of `<`, `<=`, `>`, `>=` and points in the same direction. |
| Interpolated strings | Every part is text containing a string, or an expression part. |
| Bodies | Locals and one result are present; local names are unique and are not used before declaration; a body stands only as the script's, a do block's, a function's or a conditional branch's. |
| Chain receivers | A conditional or body cannot be a chain receiver. |
| Functions | Each is a local initializer, or an arrow function that is also an argument, with unique parameter names; an arrow function's body is a simple expression; a function cannot be called before its local is declared. |
| Optional access | Each optional access is within an optional chain, following the targets of property accesses, calls, indexers and object expressions; each optional chain contains an optional access. |
| `it` | `it` cannot appear where no implicit parameter is available, including a top-level object's unqualified fields. Within an argument of a member call or of a local function call, the function called says whether the argument has one, so resolution decides there, and refuses an `it` the function does not give a value. |
| Logical expressions | `and` and `or` have at least two operands; `not` has its operand. |
| Arithmetic | An arithmetic node has a supported operator and both operands; a `negate` node has its operand. |
| Coalescing | Both value and fallback are present. |
| Casts and conversions | The type is a name; a cast's whole target has the form text writes a cast's target in. |
| Literals | A literal is a string, a finite number, a Boolean or null, so a number no finite number holds, as `1e999`, is refused in text as in a definition. |

A cast's target is checked whole: a receiver, which is the implicit parameter, a script parameter, `root`, a namespace's member, a local, a literal, an interpolated string, a function call, an untargeted object expression or a grouped cast, and the property accesses, calls and indexers after it, an optional chain of them included; or a coalescing operator or a cast as it is, grouped, as the [cast rules](types.md#casts) set out. A definition whose cast target is otherwise is a structure error, so every definition accepted writes text that parses.

A script parameter may be named `it`, `root` or a module's name, as any name can, and a script reads it as `~it`, `~root`, or `~home` where the script imports `home`.

<a id="definition-canonical-text"></a>

## Canonical text

Every definition has one canonical text, which `lexica.format` and `lexica.quote` write, and a registry's `format` and `quote` alike: text that writes every import the definition records, so it reads back as the same definition wherever it is parsed, whether the definition came from text or was created directly. A comment and the layout a source was written in leave no trace in it.

`lexica.format(source)` takes a text or a definition, and both give the same canonical text.

- **What it keeps.** The definition's meaning, and the order of its locals and fields as declared; comments and the original layout are discarded, as a definition holds neither.
- **What it needs.** Neither bindings, nor a vocabulary, nor a registry: it parses and checks structure as `lexica.parse` does, and resolves nothing, the definition's imports deciding which names it writes as namespaces, as [module names in text](modules.md#names-and-reserved-words-module-names) sets out.
- **The imports a destination supplies.** `format(source, { imports })` names the imports the text's destination supplies: it reads a text with them supplied, and leaves them out of the text it writes, which reads back as the same definition only where it is parsed with them supplied.
- **The layout.** Each import on a line of its own, in order of name, and an empty line between the last and the body; four spaces of indentation for each level of an object expression; an object expression of one field and no locals on one line where its value is, `{ name = it.name }`, and any other with one line for each entry; a conditional with an `elseif`, or whose branches give their results with `return`, on one line for each clause and one for its `end`, each branch's locals and result a level within it; a body's locals and result each on a line of their own, a `do` block's a level within its `do` and its `end`; a string's line feed, carriage return, tab and escape character as `\n`, `\r`, `\t` and `\e`, and every other control, format or separator character in it but the space as `\u{…}`; an interpolated string's text as a string's with each brace doubled, and each interpolation's expression on one line, grouped in parentheses where it begins with one; one space on each side of `and`, `or`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `??`, `+`, `-`, `*`, `/`, `%`, `as` and `to`, and none between a negation's `-` and what it negates; and no trailing comma.
- **It is stable.** Formatting text already formatted gives the same text.

<a id="names-and-reserved-words-canonical-spelling-of-names"></a>

### Canonical names

| Name position | Canonical text |
| --- | --- |
| Declaration, field name or member name | The name as written, without a prefix |
| Reference to a local or field | Its name; `@name` if reserved |
| Reference to a script parameter | Its name if it needs no prefix and is not hidden; `~` and its name otherwise |
| The object root | `root` |
| The implicit parameter | `it` |
| A namespace | The module's name |
| A cast's or a conversion's type | Its name |

These rules also apply to extension declarations and definitions created directly. A definition stores names without `@` or `~`; its node kind distinguishes a local reference from a parameter, and `it` produces an `it` node.

<a id="strings-and-escapes-canonical-spelling-of-strings"></a>

### Canonical strings

Canonical text writes every string as an inline string, `"…"`, and every interpolated one as `$"…"`, whatever form it was written in, escaping what it must: a raw string and a block give the same value written so.

It writes a double quote and a backslash as `\"` and `\\`, and line feed, carriage return, tab and escape as `\n`, `\r`, `\t` and `\e`.

Other invisible characters use `\u{…}` with uppercase hexadecimal digits and no leading zeros:

| Unicode category | Characters escaped | Examples |
| --- | --- | --- |
| Cc | Control characters | `\u{0}`, `\u{7F}` |
| Cf | Format characters | `\u{200B}` |
| Zl, Zp | Line and paragraph separators | Unicode line and paragraph separators |
| Zs | Space separators other than U+0020 | No-break space, `\u{A0}` |

All other characters appear as themselves, including accented letters and emoji. A zero-width joiner is still escaped, so the joined emoji is written `"👩\u{200D}💻"`. Its value is unchanged, and its composition is visible.

<a id="interpolated-strings-canonical-text"></a>

### Canonical interpolated strings

Canonical text always uses `$"…"`, with text escaped as an ordinary string and braces doubled. Each interpolation's expression is on one line, with no padding inside the braces, and one that begins with an object expression is grouped in parentheses.

<a id="bodies-definition-and-canonical-text"></a>

### Canonical bodies and conditionals

Canonical text places each body local and its result on separate lines. A conditional with implicit results and no `elseif` stays on one line, and a `do` block as its branch is written without parentheses: `if w then do 1 end else 2 end`. Explicit-return branches are indented within their clauses, and `end` stands on its own line.
