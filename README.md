# Lexica

Lexica is a general-purpose, embeddable language that evaluates scripts against what a host binds, through a vocabulary its modules declare for the domain, and produces immutable data.

```lexica
let shown = rows.where(it.visible)
return {
    count = shown.count,
    label = $"{shown.count} of {rows.count} shown"
}
```

> **Alpha.** Lexica's runtime implements language version `1.0.0-alpha.32`; the specification describes `1.0.0-alpha.33`, whose types declare their members and whose reference types modules declare in place of the DOM's built-in ones. Neither package is published yet. See [the status overview](https://github.com/FormaUI/Lexica/blob/main/docs/features-status.md).

## Features

### Language (`1.0.0-alpha.33`)

- Typed vocabulary modules, declared as data and reached through their namespaces
- Object expressions and list projections that shape data
- Optional access, fallbacks and conditionals
- Arithmetic, comparisons and logical expressions
- Casts, conversions and attempts
- Locals, bodies, functions, arrow functions and references to a module's functions
- Raw, block and interpolated strings
- Host calls, typed by the language and invoked by the host
- Definitions as JSON, with canonical text

### Runtime (`1.0.0-alpha.37`)

The runtime's version is declared in its sources and carried by its packages, and it implements language version `1.0.0-alpha.32`.

- Parse scripts into definitions, validate definitions, and format either as canonical text, with a registry's module names or without
- Locate any part of a definition in the text it was read from
- Create modules from their declarations, and registries that hold them
- Bind a host's values to a script's parameters
- Resolve a script against a registry, typing and checking it before it runs
- Evaluate it, reporting every read through hooks, into a frozen result with metadata for comparing results
- Prepare the calls a host carries out, and project the values it supplies

## Use it

```js
import { lexica } from '@formaui/lexica';

const definition = lexica.parse('{ total = price * quantity }');
const registry = lexica.createRegistry();
const bindings = lexica.bind({ price: 4, quantity: 3 });
const resolution = registry.resolve(definition, bindings);

resolution.type; // '{ total: number }'
resolution.createEvaluator(bindings).evaluate().value; // { total: 12 }
```

[Embedding Lexica](https://github.com/FormaUI/Lexica/blob/main/docs/embedding-guide.md) goes on to declaring a domain, evaluating against it and following what an evaluation reads.

## Documents

| Document | What it holds |
| --- | --- |
| [Specification](https://github.com/FormaUI/Lexica/blob/main/spec/README.md) | The language, its vocabulary contracts and its definition format: the contract |
| [Guide](https://github.com/FormaUI/Lexica/blob/main/docs/embedding-guide.md) | Embedding Lexica in a host, by example |
| [Design](https://github.com/FormaUI/Lexica/blob/main/docs/lexica-design.md) | How Lexica is built: its stages, modules, evaluation and tooling |
| [Status](https://github.com/FormaUI/Lexica/blob/main/docs/features-status.md) | What is implemented, what is being built, and what remains |
| [Contributing](https://github.com/FormaUI/Lexica/blob/main/CONTRIBUTING.md) | Report a bug, develop a change and run the checks |

## Build

```powershell
./build.ps1
```

The gate runs the tests, bundles Lexica, builds the NuGet package project with no warnings and checks its formatting. `./publish.ps1` runs it, then packs the npm and NuGet packages into `artifacts/`.

## License

Apache License 2.0; see [LICENSE](https://github.com/FormaUI/Lexica/blob/main/LICENSE) and [NOTICE](https://github.com/FormaUI/Lexica/blob/main/NOTICE).
