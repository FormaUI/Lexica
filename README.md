# Nexo

Nexo is a general-purpose, embeddable language that evaluates scripts against what a host binds, through a vocabulary its modules declare for the domain, and produces immutable data.

```nexo
let shown = rows.where(it.visible)
return {
    count = shown.count,
    label = $"{shown.count} of {rows.count} shown"
}
```

> **Alpha.** Nexo implements language version `1.0.0-alpha.40` in part: definition version 37, its imports and extension access, its declarations, types and member selection, its collections, dictionaries, pairs, collection expressions, positions and ordering among them, structured values a script constructs or a host binds, the members of numbers and strings, resolutions that stay current across registrations, and its line structure and canonical text. Neither package is published yet. See [the status overview](https://github.com/FormaUI/Nexo/blob/main/docs/features-status.md).

## Features

### Language (`1.0.0-alpha.40`)

- Typed vocabulary modules, declared as data, imported by the scripts that use them and reached through their namespaces
- Object expressions and list projections that shape data, and construct a module's structured values where they are declared
- Optional access, fallbacks and conditionals
- Arithmetic, comparisons and logical expressions, and the members of numbers and strings
- Casts, conversions and attempts
- Locals, bodies, functions, arrow functions and references to a module's functions
- Raw, block and interpolated strings
- Host calls, typed by the language and invoked by the host
- Definitions as JSON, with canonical text

### Implementation (`1.0.0-alpha.37`)

The implementation's version is declared in its sources and carried by its packages, and it implements language version `1.0.0-alpha.40` in part.

- Parse scripts into definitions, their imports and those a host supplies deciding their namespaces, validate definitions, and format either as canonical text
- Locate any part of a definition in the text it was read from
- Create modules from their declarations, and registries that hold them
- Bind a host's values to a script's parameters
- Resolve a script against a registry, typing and checking it before it runs
- Evaluate it, reporting every read through hooks, into a frozen result with metadata for comparing results
- Prepare the calls a host carries out, and project the values it supplies

## Use it

```js
import { nexo } from '@formaui/nexo';

const definition = nexo.parse('{ total = price * quantity }');
const registry = nexo.createRegistry();
const bindings = registry.createBindings({ price: 4, quantity: 3 });
const resolution = registry.resolve(definition, bindings);

resolution.type; // '{ total: Number }'
resolution.createEvaluator(bindings).evaluate().value; // { total: 12 }
```

[Embedding Nexo](https://github.com/FormaUI/Nexo/blob/main/docs/embedding-guide.md) goes on to declaring a domain, evaluating against it and following what an evaluation reads.

## Documents

| Document | What it holds |
| --- | --- |
| [Specification](https://github.com/FormaUI/Nexo/blob/main/spec/README.md) | The contract, in two parts: the language, what a script means, and the runtime, what a host provides to run it |
| [Guide](https://github.com/FormaUI/Nexo/blob/main/docs/embedding-guide.md) | Embedding Nexo in a host, by example |
| [Design](https://github.com/FormaUI/Nexo/blob/main/docs/nexo-design.md) | How Nexo is built: its stages, modules, evaluation and tooling |
| [Language history](https://github.com/FormaUI/Nexo/blob/main/LANGUAGE-HISTORY.md) | Each language version and what it changed |
| [Status](https://github.com/FormaUI/Nexo/blob/main/docs/features-status.md) | What is implemented, what is being built, and what remains |
| [Contributing](https://github.com/FormaUI/Nexo/blob/main/CONTRIBUTING.md) | Report a bug, develop a change and run the checks |

## Build

```powershell
./build.ps1
```

The gate runs the tests, bundles Nexo, builds the NuGet package project with no warnings and checks its formatting. `./publish.ps1` runs it, then packs the npm and NuGet packages into `artifacts/`.

## License

Apache License 2.0; see [LICENSE](https://github.com/FormaUI/Nexo/blob/main/LICENSE) and [NOTICE](https://github.com/FormaUI/Nexo/blob/main/NOTICE).
