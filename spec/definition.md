# Definition

<a id="definition"></a>

A script's **definition** is a JSON document recording its meaning, its **expression tree** with the version of its format: every script, read from its source or created directly, has one definition, and validation, resolution and evaluation work on the definition alone. It records what the text means, never its punctuation, and comments, commas and layout leave no trace in it.

A document holds the definition's `version`, its `imports` and the `expression` node, the root of its expression tree. Its imports are the script's [imports](scripts.md#scripts-imports), those its text writes and those its host supplies alike, each an object of its `module`, the registered module's name, its `type`, the local name of the type it imports where it imports one, and its `alias`, where it gives a local name other than its own, `{ "module": "Home", "type": "Sensor", "alias": "HomeSensor" }`, each once and in order of the local name it gives, and an empty list where it imports none; which ones a host supplied is not recorded, since that does not change what the script means. The version is the definition format's, and changes whenever the serialized definition's contract does, the nodes it holds, their properties and the values those take; a change to the language that leaves that contract as it was advances the language specification's version alone. A definition of a version other than the one an implementation reads is a structure error naming both, so an implementation of version 35 refuses a definition of version 34, though every node one holds is one a version 35 definition may hold: no implementation reads two versions or converts one into another. Version 34 records a script's imports, aliases among them, and an extension an access selects explicitly, and version 35 the collection expressions, lists and dictionaries, a script writes.

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
| `scriptParameter` | `name` | A script parameter; text writes it alone where its name is not a reserved word, nor a local name the definition's imports give a module, no local, object field or function parameter of its name is in scope and no local of its name is declared later in its scope, and with `~` before its name otherwise |
| `it` | None | The implicit parameter |
| `root` | None | The object root |
| `namespace` | `name`, the local name the script's imports give the module | A module's namespace, the receiver of a `memberAccess` node that reads one of the module's members, or names one a call calls, a qualified form among them, through it |
| `local` | `name` | A use of a local, a function parameter or an object field, one in scope where it stands |
| `memberAccess` | `name`, the member's name, or for a computed property access whose expression is not a string literal that is a name, that expression's node; `receiver`, the value it accesses; `optional`, true, where it is written with `?.` or `?:`; and `extension`, where an extension is selected explicitly, its `name` and, where its module qualifies it, its `module` | A property access, a computed property access, an extension's property or named indexer selected explicitly, or the member a call calls |
| `call` | `callee`, what it calls: a `memberAccess` node, the member, its receiver, whether it is optional and the extension it selects, or a `local` node, the local, the function parameter or the conditional binding holding the function; and `arguments`, its arguments in order, empty where it is given none | A function call: a member's, a qualified form's through a namespace, or of the function a name holds |
| `indexerAccess` | `argument`, its key; `receiver`, the value it indexes, or for a named indexer the `memberAccess` node of its name, which [resolution reads](members.md#property-access-calls-and-indexers-named-indexers) as one where the receiver's type declares it; `optional`, true, where it is written with `?[` or `?:`; and `extension`, as a `memberAccess` node holds it, for an extension's unnamed indexer selected explicitly | An indexer: the receiver's unnamed indexer, a named indexer, the unnamed indexer of a property's answer, or an extension's unnamed indexer |
| `list` | `items`, its items in order, each a node, empty where it holds none | A list a [collection expression](values.md#lists-collection-expressions) writes |
| `dictionary` | `entries`, its entries in the order written, each an object of its `key`, the string its key writes, and its `value` node, empty where it holds none | A dictionary a collection expression writes |
| `object` | `objectFields`; `locals`, where it has any; and `context`, the node the object expression follows | An object expression; without a context, one keeping the implicit parameter around it, which at the top level is absent |
| `equality` | `left` and `right`, the two expressions it compares | An equality; `!=` is a `not` holding one |
| `body` | `locals`, each its `name` and its `value`, in order, and `result`, the value the body gives | A body: the root expression's, a `do` block's, a function's or a conditional branch's, and nowhere else |
| `do` | `body`, an expression alone or a `body` node | A do block |
| `function` | `parameters`, the names it declares; `body`, the body a call evaluates; and `arrow`, true, for an arrow function, whose body is its one expression, validated as a simple expression | A function: a local's initializer, or an arrow function written as an argument |
| `interpolatedString` | `parts`, its text and its interpolations in order: each `{ "kind": "text", "value": … }`, the characters the text stands for, or `{ "kind": "expression", "expression": … }` | An interpolated string; adjacent text is one part and empty text none, and a diagnostic names a part by the index the definition it was created from gave it |
| `comparison` | `operands`, two or more expressions, and `operators`, one of `<`, `<=`, `>` and `>=` between each two | A comparison, or a chain of them |
| `conditional` | `condition`, the expression it tests, or `binding`, the `name` it binds and the `value` it binds to it, one of them; and `consequent` and `alternative`, two expressions | A conditional, `if let` holding a binding; an `elseif` is a conditional nested in the alternative before it |
| `coalescing` | `value` and `fallback`, two expressions | A coalescing operator |
| `cast` | `type`, the name of the reference type it casts to, its local name, `Light`, or qualified by its module, `Home.Light`, as written; and `operand`, the expression it casts | A cast |
| `conversion` | `type`, the name of the type it converts to, its local name or qualified by its module, as written; and `operand`, the expression it converts | A conversion |
| `try` | `operand`, the conversion or the cast it attempts | An attempt |
| `optionalChain` | `chain`, the chain it holds | An optional chain: the chain of property accesses, calls, indexers and object expressions whose optional accesses end at it, holding at least one |
| `and`, `or` | `operands`, two or more expressions | A logical expression |
| `not` | `operand`, the expression it negates | A negation |
| `arithmetic` | `operator`, one of `+`, `-`, `*`, `/` and `%`, and `left` and `right`, its operands | An arithmetic operation |
| `arithmeticNegation` | `operand`, the number it negates | An arithmetic negation of a number; a numeric literal negated is the negative literal |
| `fromEndIndex` | `offset`, the expression giving its offset from the end | An index from the end, `^n` |
| `range` | `start` and `end`, each the expression of a boundary, left out where the range leaves it out | A range, `start..end` |

A parenthesized expression does not add a node, the expression it holds standing in its place, and neither does an optional enclosed access, whose accesses are recorded as optional and its optional chain where it ends, so `device.active() and (device.batteryPowered())` is an `and` of two function calls:

```json
{
  "kind": "and",
  "operands": [
    { "kind": "call", "callee": { "kind": "memberAccess", "receiver": { "kind": "scriptParameter", "name": "device" }, "name": "active" }, "arguments": [] },
    { "kind": "call", "callee": { "kind": "memberAccess", "receiver": { "kind": "scriptParameter", "name": "device" }, "name": "batteryPowered" }, "arguments": [] }
  ]
}
```

Every property access and indexer holds its `receiver`, every call its `callee`, and every equality its `left` and its `right`, required, and an omitted receiver never stands for `it`, so `it.power` and `device.power` are distinct definitions. A member read through a namespace, or named there by a call, holds a `namespace` node as its receiver, so `Home.rooms` is a `memberAccess` whose receiver is `{ "kind": "namespace", "name": "Home" }`, and `Energy.usage(device)` a `call` whose callee is the `memberAccess` of `usage` on `Energy`'s namespace and whose first argument is the receiver. A call of the function a name holds has a `local` node as its callee, so `pick(rooms)` calls `{ "kind": "local", "name": "pick" }`. A [function reference](functions.md#functions-module-functions) is a `memberAccess` node through a namespace no call holds, `Home.active` as `Home.rooms` is, which resolution tells apart by the declaration it names, and an [implicit body](functions.md#functions-implicit-bodies) is an argument node as it is written. An indexer after a property access holds that `memberAccess` node as its receiver, so `device.setting["mode"]` and `room.devices[0]` have one shape, and resolution tells a named indexer from a property's answer indexed by the declaration the name gives.

A call's `arguments` are its argument nodes in order, and an indexer's `argument` its key's node, each recorded as written; where a call's member takes options, its one argument is an object node whose object fields resolution maps onto the member's parameters.

An object field is an object holding its `name` and its `value` node, both required; an object expression's `objectFields` keep their order, and an object expression holds at least one. A local is an object of the same two properties, and an object expression's locals keep their order, its definition leaving `locals` out where it has none.

`room { name = it.name, occupied = it.occupied() }` has this definition:

```json
{
  "version": 36,
  "imports": [{ "module": "Energy" }, { "module": "Home" }],
  "expression": {
    "kind": "object",
    "context": { "kind": "scriptParameter", "name": "room" },
    "objectFields": [
      { "name": "name", "value": { "kind": "memberAccess", "receiver": { "kind": "it" }, "name": "name" } },
      {
        "name": "occupied",
        "value": {
          "kind": "call",
          "callee": { "kind": "memberAccess", "receiver": { "kind": "it" }, "name": "occupied" },
          "arguments": []
        }
      }
    ]
  }
}
```

A chain is recorded as a succession of receivers: in `room.device("lamp").power`, `power` is a property access whose receiver is the call of `device`, whose callee's receiver is the script parameter `room`. A chain that holds an optional access is the `chain` of an `optionalChain` node, which records where its short-circuit ends, so `room.device(name)?.room.devices.count`, one optional chain, and `(room.device(name)?.room.devices).count`, a property access of one, are distinct definitions.

A definition names its parameters and never holds their values. A value is bound to its name by the host, through whatever mechanism its environment offers, so the same definition serves every binding.

<a id="definition-bodies"></a>

### Bodies and conditionals

A body with explicit `return` is a `body` node containing ordered `locals` and a `result`. A body containing just an expression is that expression's own node, except a `do` block's: a `do` block is always a `do` node holding its body, so `do 7 end` is a `do` node whose body is the literal's node. A `body` node stands only as the script's, a `do` block's, a function's or a conditional branch's body.

Within one conditional, branches are all `body` nodes or none are; a branch that is a `do` block is an implicit branch, whose result is its `do` node. The alternative may itself be a conditional: after branches that use `return`, one whose branches use `return` too, as an `elseif` gives; after expression branches, one of either style.

<a id="validation"></a>

## Structural validation

Structural validation checks a definition against these rules when a script is read, when a definition given directly is validated, as `lexica.validate` does, and when one is resolved, and reports a `structure` error. Semantic validation, of vocabulary and types, follows it, which resolution alone performs and reports as `validation` errors, as [what resolution checks](runtime.md#validation-vocabulary-and-types) sets out.

<a id="validation-syntax-and-structure"></a>

### Syntax and structure

Text must follow the syntax. A directly created definition must follow the same node structures and structural rules.

| Area | Required structure |
| --- | --- |
| Imports | Each holds a `module`, an identifier other than `Nexo`; a `type`, an identifier, where it imports one type; and an `alias` only where it differs from the name the import gives without one, its `type` or else its `module`. The local name each gives is any identifier, as [imports](scripts.md#scripts-imports) set out; they are in order of it, each once, so two imports giving one local name to different declarations conflict; and every `namespace` node, and every extension selection's `module`, names a module one of them gives. |
| Object fields | Every object field has a name and value; names are unique within an object expression; an object expression has at least one object field. |
| Locals | Each has a name and value; names are unique within a body or object expression; references name an in-scope local or object field. |
| Declaration order | No reference uses a local before its declaration or within its own initializer. A name written alone cannot fall back to a script parameter when that local is declared later in the same scope. |
| Script parameters | A definition's `scriptParameter` node, written with `~` when necessary, reads the script parameter regardless of local declarations. |
| Simple expressions | Arguments, indexer keys, computed property names and interpolations obey the restrictions recursively; an object expression within one, as an options object, declares no locals, though it may use those in scope. |
| Members | Every property access and indexer has a receiver, and every call a callee, a `memberAccess` or a `local` node. |
| Extension selections | An `extension` holds a `name`, an identifier, as written, and a `module` only where its module qualifies it, a local name the definition's imports give a module; a computed property access holds none, and a named indexer's holds it on the `memberAccess` node of its name. |
| Collection expressions | A list's `items` and a dictionary's `entries` are lists; each entry holds its `key`, a string, and its `value`, a node, and no two entries of one dictionary share a key, compared exactly; each item and each value obeys the simple-expression restrictions, and none is a function. |
| Equality | Both operands are present. |
| Comparisons | At least two operands; exactly one operator between each pair; every operator is one of `<`, `<=`, `>`, `>=` and points in the same direction. |
| Interpolated strings | Every part is text containing a string, or an expression part. |
| Bodies | Locals and one result are present; local names are unique and are not used before declaration; a body stands only as the script's, a do block's, a function's or a conditional branch's. |
| Chain receivers | A conditional or body cannot be a chain receiver. |
| Functions | Each is a local initializer, or an arrow function that is also an argument, with unique parameter names; an arrow function's body is a simple expression; a function cannot be called before its local is declared. |
| Optional access | Each optional access is within an optional chain, following the receivers of property accesses and indexers, the callees of calls and the contexts of object expressions; each optional chain contains an optional access. |
| `it` | `it` cannot appear where no implicit parameter is available, including a top-level object's unqualified fields. Within an argument of a member call or of a function call, the function called says whether the argument has one, so resolution decides there, and refuses an `it` the function does not give a value. |
| Logical expressions | `and` and `or` have at least two operands; `not` has its operand. |
| Arithmetic | An arithmetic node has a supported operator and both operands; an `arithmeticNegation` node has its operand. |
| Positions | A `fromEndIndex` node has its `offset`, and a `range` node holds a `start`, an `end`, both or neither, each a simple expression. |
| Coalescing | Both value and fallback are present. |
| Casts and conversions | The type is a name; a cast's whole operand has the form text writes a cast's operand in. |
| Literals | A literal is a string, a finite number, a Boolean or null, so a number no finite number holds, as `1e999`, is refused in text as in a definition. |

A cast's operand is checked whole: a receiver, which is the implicit parameter, a script parameter, `root`, a namespace's member, a local, a literal, an interpolated string, a function call, an object expression following no value or a grouped cast, and the property accesses, calls and indexers after it, an optional chain of them included; or a coalescing operator or a cast as it is, grouped, as the [cast rules](types.md#casts) set out. A definition whose cast operand is otherwise is a structure error, so every definition accepted writes text that parses.

A script parameter may be named `it`, `root` or a module's name, as any name can, and a script reads it as `~it`, `~root`, or `~Home` where the script imports `Home`.

<a id="definition-canonical-text"></a>

## Canonical text

Every definition has one canonical text, which `lexica.format` writes, and `lexica.quote` writes compactly, whichever registry resolves it: text that writes every import the definition records, so it reads back as the same definition wherever it is parsed, whether the definition came from text or was created directly. A comment and the layout a source was written in leave no trace in it.

`lexica.format(script)` takes a script's source or its definition, and both give the same canonical text.

- **What it keeps.** The definition's meaning, and the order of its locals and object fields as declared; comments and the original layout are discarded, as a definition holds neither.
- **What it needs.** Neither bindings, nor a vocabulary, nor a registry: it parses and checks structure as `lexica.parse` does, and resolves nothing, the definition's imports deciding which names it writes as namespaces, as [module names in text](modules.md#names-and-reserved-words-module-names) sets out.
- **The imports a destination supplies.** `format(script, { imports })` names the imports the text's destination supplies: it reads a text with them supplied, and leaves them out of the text it writes, which reads back as the same definition only where it is parsed with them supplied.
- **The layout.** Each import on a line of its own, in order of the local name it gives, its alias and `=` before its source where it has one, a space on each side of the `=`, `import Measures = Measurements`, and an empty line between the last and the body; four spaces of indentation for each level of an object expression; an object expression of one object field and no locals on one line where its value is, `{ name = it.name }`, and any other with one line for each entry; a list's items on one line as a call's arguments are, `[10, 20, 30]`, an item after one ending in a block's `end` on the next line; a dictionary as an object expression is laid out, `[=]`, an entry alone on one line where its value is, `["coffee" = 3]`, and any other with one line for each entry, its key written as a string is; a conditional with an `elseif`, whose branches give their results with `return`, or one of whose branches spans lines, in [block form](lexical-structure.md#line-structure-keyword-blocks), each clause on a line of its own ending in `then` or `else`, each branch's locals and result a level within it, and `end` on a line of its own; a `do` block or a function expression whose body uses `return` or spans lines, in block form too; an expression continuing after a block's `end` on the line after it, as `) + 2`; an operator expression on one line, a source's parentheses discarded only where the definition can be written without them while keeping its grouping and satisfying the syntax; a body's locals and result each on a line of their own, a `do` block's a level within its `do` and its `end`; a string's line feed, carriage return, tab and escape character as `\n`, `\r`, `\t` and `\e`, and every other control, format or separator character in it but the space as `\u{…}`; an interpolated string's text as a string's with each brace doubled, and each interpolation's expression on one line, grouped in parentheses where it begins with one; one space on each side of `and`, `or`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `??`, `+`, `-`, `*`, `/`, `%`, `as` and `to`, none around a range's `..` nor after an index's `^`, as `1..^1`, `..4` and `..`, a boundary or an offset that is an operator expression grouped in parentheses, and none between a negation's `-` and what it negates, nor around an extension access's `:` or `?:`, whose extension's name it writes as the definition holds it, qualified where it is; and no trailing comma.
- **Compact.** `quote(script, options)` writes compact, parseable text, as a diagnostic quotes it, inserting the line breaks [boundaries](lexical-structure.md#line-structure-boundaries) and [keyword blocks](lexical-structure.md#line-structure-keyword-blocks) require, including those propagated from nested constructs, so a chain or an expression without them stands on one line, and `quote(source, { imports })` leaves out the imports a destination supplies, as `format` does.
- **It is stable.** Formatting text already formatted gives the same text.

<a id="names-and-reserved-words-canonical-spelling-of-names"></a>

### Canonical names

| Name position | Canonical text |
| --- | --- |
| Declaration, object field name or member name | The name as written, without a prefix |
| Reference to a local or object field | Its name; `@name` if reserved |
| Reference to a script parameter | Its name if it needs no prefix and is not hidden; `~` and its name otherwise |
| The object root | `root` |
| The implicit parameter | `it` |
| An import | Its alias, `=` and its source, or its source alone |
| A namespace | The local name the script's imports give the module |
| A cast's or a conversion's type | Its name |

These rules also apply to extension declarations and definitions created directly. A definition stores names without `@` or `~`; its node kind distinguishes a local reference from a script parameter, and `it` produces an `it` node.

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

Canonical text places each body local and its result on separate lines. A conditional with implicit results, no `elseif` and no branch that spans lines stays on one line, and a `do` block as its branch is written without parentheses: `if w then do 1 end else 2 end`. Explicit-return branches are indented within their clauses, and `end` starts a line of its own, only closing punctuation following it there.
