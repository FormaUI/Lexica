# Proposal: script imports

**State: accepted.** Specified, and implemented with [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34)'s steps 3 and 4, as [I28](implementation-decisions.md) and [I29](implementation-decisions.md) record. It changes the contract [scripts](../../spec/scripts.md), the [grammar](../../spec/grammar.md), [lexical structure](../../spec/lexical-structure.md#names-and-reserved-words), [modules](../../spec/modules.md#names-and-reserved-words-module-names), [types](../../spec/types.md#types-type-identity), the [definition](../../spec/definition.md) and the [runtime](../../spec/runtime.md) set out, and [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34) of the implementation plan delivers it, as definition version 34.

## The problem

A script resolves against every module registered with its registry. Its unqualified type names are looked up across the whole registry, its members and extensions are chosen among every module's declarations, and a registry's module names decide how its text reads: registering `Home` makes `Home.rooms` a namespace access where it was a script parameter's member.

So a script's meaning depends on what else its host registers. Registering a module that declares another `usage` on `Device` makes `device.usage` ambiguous, and one that declares another `Device` makes `as Device` ambiguous, in scripts that never meant to use it.

## The proposal

**Registering** a module makes it available to scripts. **Importing** it lets a script use it. A script imports the modules whose vocabulary it uses, and only those take part in its resolution:

```lexica
import Home
import Energy

Home.rooms {
    name = it.name,
    usage = it.devices.sum(it.usage)
}
```

`Home` supplies the rooms and devices, and `Energy` the `usage` extension. Registering another module that declares `usage` on `Device` leaves this script as it is, since the script does not import it.

### Writing an import

An import declaration is `import` and a module's name, one module for each, at the start of the script, before its body; each applies to the whole script. Canonical text writes each on a line of its own, though layout is trivia, as it is everywhere:

```text
script                        = { import-declaration } body end-of-input
import-declaration            = "import" module-name
```

`import` becomes a reserved word, a keyword. A member named `import` is still read after `.`, as any keyword is. Import order never decides anything. A module imported twice, once written and once supplied by the host or written twice, is imported once.

Lexica's own module is always available and has no namespace, so a script never imports it, and `import Lexica` is refused.

### What an import makes available

An import makes the module's public vocabulary available to the script:

- **Its namespace:** its module members, its qualified forms and its function references, read through `Home.`; a qualified form needs its module imported, as any use does, so `Energy.usage(device)` needs `import Energy`.
- **Its types by name:** a cast or a conversion names one of its public types, unqualified or qualified.
- **Its declarations:** its members on any receiver, its structured types' properties and its extensions among them, and its type selectors' keys, its conversions and its operators.

A script accesses a declared member only where the module that **declares** it is imported: a property, a function, an indexer and an operator alike. The owner of the receiver's type need not be:

```lexica
import Energy

device.usage
```

With a host binding a `Home.Device`, this script reads `Energy`'s extension on it. The registry knows the device's type; the import makes the extension available. `device.name`, a member `Home` declares, needs `import Home`.

A property of a structured type's data is a member too, so `reading.temperature` needs its declaring module's import whether that module declares `temperature` in its data shape or with `updates`; which one it is never shows in the access, so it never decides whether the access is allowed. A computed property access follows the rule a written name does, so `reading.["temperature"]` needs the import too. An ordinary object's fields, which no module declares, are read without any import.

### Declaration dependencies are not imports

Importing a module exposes its declarations without importing every module whose types they use. A member `Energy` declares may answer a `Garden.Reading`, and a script importing `Energy` alone can read that member, hold its answer, return it whole and pass it on, and use the extensions `Energy` declares on it; naming `Reading` in a cast or a conversion, or reading a member `Garden` declares on it, a property of its data among them, needs `import Garden`. Holding or returning a value never permits naming its members.

The registry still understands every registered module's types: it recognizes a host's values and resolves every declaration's dependencies across all of them. Recognizing a value's type never imports the type's module, and never exposes its members.

### Type names in a script

An unqualified type name resolves to the one public type of its name among Lexica's own and the imported modules'; none is an unknown type, and several are ambiguous, refused with their qualified names given. A qualified name, `Home.Light`, identifies the public type of that local name in that module, which the script imports. A type of a module the script does not import is not named by it, so registering another module's `Device` changes no script that does not import that module.

A type a host declares for a binding is resolved against the registry, never the script's imports, since a binding set is the host's and may serve scripts with different imports, and its type has one identity whichever script reads it: `types: { device: 'Home.Device' }` names it qualified, and `types: { device: 'Device' }` where exactly one public type in the registry has that name, as Lexica's own types are named; where several do, it is refused, giving the qualified names. A script's imports neither resolve nor disambiguate it.

This replaces the registry-wide lookup [type identity](../../spec/types.md#types-type-identity) sets out for scripts, and leaves its rules for declarations, a type's own `import` among them, as they are. A type's `import` and a script's are one idea at two scopes: the type's names the modules whose types its own declarations name unqualified, and the script's the modules whose vocabulary the script uses.

### Reading text

A script's imports decide which names are namespaces: a name is a module's namespace where it stands unprefixed in place of a value and an import names that module. The registry's inventory no longer affects how text reads, so `lexica.parse` and `registry.parse` read a text alike, and registering a module never changes how an earlier text reads.

A host supplies imports of its own through the API, in place of prepending text, so source positions stay as written and a definition created directly or fluently takes them alike: `parse(text, { imports: ['Home'] })`, and the same option to `resolve` and to a host's own entry points. A host whose scripts all use its module supplies it to every script this way, so a script writes `import Home` only where it chooses to, and writing it as well is harmless.

### The definition

A definition records its complete import set, the written imports and those the host supplied, deduplicated and in order of name, in a top-level `imports`, beside `version` and `expression`:

```json
{ "version": 34, "imports": ["Energy", "Home"], "expression": { "kind": "member", "target": { "kind": "namespace", "name": "Home" }, "name": "rooms" } }
```

It does not record which imports came from the author and which from the host, since that does not change the script's meaning. A `namespace` node naming a module the imports leave out is refused as a structure error. The new field changes the definition's contract, so it is version 34.

### Formatting

Standalone formatting writes every import, so canonical text is self-contained and reads back as the same definition. A caller may name the imports its destination supplies, `format(source, { imports: ['Home'] })`, and those are left out of the text: a host that supplies `Home` to every script leaves it out of the text it writes, and parsing that text through the host, which supplies it, gives the same definition again. Text formatted so reads back as the same definition only where it is parsed with those imports supplied.

### Diagnostics

| Written | Refused, giving |
| --- | --- |
| `Home.rooms`, where `Home` names a registered module the script does not import, unless a script parameter of that name is bound | A validation error giving `import Home` |
| `device.name`, where only a module the script does not import declares `name` | A validation error naming the module and giving its import |
| `as Device`, where only a module the script does not import declares a public `Device` | A validation error giving the import, or the qualified name where several modules declare one |
| `import Garden`, where the registry does not hold a module of that name | A validation error naming the module, when the script is resolved; parsing reads `import Garden` and its namespace without asking a registry |
| `import` after a body's first local or expression | A syntax error saying imports stand at the start of the script |
| `import Lexica` | A syntax error saying Lexica's own vocabulary is always available |

A bound script parameter named `Home` is read as that parameter, as today, so a missing import never turns a parameter into a namespace.

## Settled

1. **Properties of a structured type's data, from a module the script does not import,** need their declaring module's import, as every declared member does: a script can access a declared member only where its declaring module is imported. Exempting the properties of a type's data would make whether `reading.temperature` works depend on how its module declares `temperature`, which the access never shows.
2. **A declared binding's type** is resolved against the registry, qualified or, where exactly one public type has the name, unqualified; the script's imports take no part in it.
3. **An import of a module the registry does not hold** fails when the script is resolved; parsing reads the import and its namespace without a registry.
