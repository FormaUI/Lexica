# Names and scope

<a id="names-and-scope"></a>

In this document: [Names and resolution](#names-and-resolution) · [Names and reserved words](#names-and-reserved-words).

<a id="names-and-resolution"></a>

## Names and resolution

A name at the start of a chain reads the nearest visible local or field of that name. If none is in scope, it reads the parameter of that name, the caller's binding. A bare name read before a local of that name declared later in the same scope is a structure error, since it reads no binding there; a field of that name written later leaves it reading the binding. `it` reads the implicit parameter, and in text read through a registry, the name of a module registered with it begins that module's [namespace](modules-and-namespaces.md#namespaces).

Members always have an explicit receiver. Equality always has both operands. The reader does not need vocabulary knowledge to decide what a name applies to.

<a id="names-and-resolution-implicit-parameter-by-position"></a>

### Implicit parameter by position

| Position | What `it` means |
| --- | --- |
| Outermost expression | No implicit parameter is available |
| Object expression following a value | The value it follows |
| Object expression following a list | The current item |
| Object expression following no value | The surrounding implicit parameter, if one exists |
| Value argument | The implicit parameter where the call is written |
| Expression or predicate argument | The one the member declares |

In `room { warmth = it.climate?.temperature }`, `it` is the room.

In `room { climate = { warmth = it.climate?.temperature, humidity = it.climate?.humidity } }`, both nested fields still read the room. The nested object groups fields without changing the implicit parameter.

At the top level, `{ level = light.brightness, active = light.is("active") }` has no implicit parameter. Each field reads a binding, a literal or another expression that does not require one.

`it.name`, `{ name = it.name }` and `light.dim({ to = it })` at the top level are errors because there is no implicit parameter.

<a id="names-and-resolution-explicit-receivers"></a>

### Explicit receivers

Writing a member without its receiver is an error. If the implicit parameter has that member, the diagnostic suggests the form with `it`:

| Written | Suggested form |
| --- | --- |
| `climate.temperature` | `it.climate` |
| `device("lamp")` | `it.device(…)` |

An equality without its left operand is an error as well; write both values, for example `it == null`.

<a id="names-and-resolution-parameters-and-roots"></a>

### Parameters and the object root

Parameters resolve the same way inside object expressions and arguments as elsewhere. Their bindings may be reference values or data: numbers, strings, Booleans, null, lists or objects. Lists and objects may contain reference values.

`root` is the language's one root, and requires no value from the caller. Written inside an object expression, it denotes the [object root](bodies-and-functions.md#locals-the-object-root): the object the outermost object expression around the reference builds, in the evaluation building it, whose fields completed where `root` is written it reads. Written outside every object expression, it is a structure error. A caller can still pass a value named `root`; read it as `~root`.

<a id="names-and-resolution-projection-example"></a>

### Projection example

```lexica
room {
    // The room's name, whether it is occupied, and each of its devices.
    name = it.name,
    occupied = it.is("occupied"),
    devices = it.devices { name = it.name, active = it.is("active") }
}
```

<a id="names-and-reserved-words"></a>

## Names and reserved words

A name starts with an ASCII letter and continues with ASCII letters or digits. For example, `floorArea` is a name. Names contain no hyphens and are also valid JavaScript identifiers.

An **identifier** is a name that is not reserved. Reserved words are:

| Category | Words |
| --- | --- |
| Literals | `true`, `false`, `null` |
| The object root | `root` |
| The implicit parameter and operators | `it`, `not`, `try`, `as`, `to`, `and`, `or` |
| Control flow and declarations | `if`, `then`, `elseif`, `else`, `let`, `do`, `end`, `return`, `function` |

Reserved words match whole names, exactly. `isVisible` and `nullable` are identifiers. All names are case-sensitive, so `TRUE` and `It` are identifiers too.

The **keywords** are the reserved words other than the literals' words and `root`: `it` and the words of operators, control flow and declarations.

<a id="names-and-reserved-words-module-names"></a>

### Module names

In text read through a registry, the name of every module registered with it is reserved as well, as `home` and `energy` are in the examples, and its members' names are reserved nowhere: `home.rooms` reads the module's member, `@home` the nearest local or field named `home`, and `~home` the caller's binding. No module is named by a word the language reserves. Text read without a registry knows no module's name, so `home` is an identifier there, read as any name is.

<a id="names-and-reserved-words-declaring-and-accessing-a-reserved-name"></a>

### Declaring and accessing a reserved name

A declaration accepts any name, including a reserved word. This applies to fields, locals, functions, function parameters and conditional bindings. Write the name without `@`:

```lexica
light { true = true, it = it.is("active") }
```

The same rule applies to member and indexer names after `.`, `?.`, `:` and `?:`. For example, `value.null` reads a member named `null`, and `device:end["key"]` invokes an indexer named `end`.

`let @to = 1`, `{ @true = 1 }` and `value.@null` are syntax errors.

<a id="names-and-reserved-words-referring-to-a-reserved-local-or-field"></a>

### Referring to a reserved local or field

In an expression, a reserved word retains its language meaning regardless of scope. After `let it = 1`, an unprefixed `it` still reads the implicit parameter, and after `let home = 1`, an unprefixed `home` still begins the module's namespace.

Write `@` directly before a reserved word to read the nearest local or field of that name:

```lexica
{ let to = "3", value = @to to "number" }
```

A reserved reference with no such local or field is a structure error:

> No local or field named 'it' is in scope. Use '~it' to read the caller's binding.

`@` is valid only directly before a reserved word, and a keyword alone reads no local or field. These are syntax errors:

| Form | Diagnostic guidance |
| --- | --- |
| `@room` | Use `room`; the name is not reserved, and a module's name is reserved only in text read with its registry. |
| `@ it` or `@` | A reserved word must follow `@` directly. |
| `to` in a value position | `Found 'to', a keyword: write '@to' for the local or field of that name`. |

<a id="names-and-reserved-words-referring-to-the-callers-binding"></a>

### Referring to the caller's binding

`~name` reads the caller's binding regardless of any local or field with the same name. Reserved names are allowed: `~as` and `~home` read the bindings `as` and `home`.

The name must follow `~` directly, and `~` alone reads nothing, so it is a syntax error.

<a id="names-and-reserved-words-names-in-strings-and-supplied-data"></a>

### Names in strings and supplied data

A string containing a reserved word remains an ordinary string:

- `device:["null"]` reads a setting named `null`.
- `value["null"]` is bracket property access and resolves the member `value.null`.

The name restrictions apply to declarations in an expression. Supplied data keeps all its own keys. Bound objects and objects returned by members retain every field, including `__proto__`, as an ordinary own field in results, snapshots and live state.

<a id="names-and-reserved-words-canonical-spelling-of-names"></a>

### Canonical spelling of names

| Name position | Canonical text |
| --- | --- |
| Declaration, field name or member name | The name as written, without a prefix |
| Reference to a local or field | Its name; `@name` if reserved |
| Reference to a caller's binding | Its name if not reserved or hidden; `~name` otherwise |
| The object root | `root` |
| The implicit parameter | `it` |
| A namespace | The module's name |

These rules also apply to extension declarations and definitions created directly. A definition stores names without `@` or `~`; its node kind distinguishes a local reference from a parameter, and `it` produces an `it` node.
