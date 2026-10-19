# Working on Lexica

Lexica is an extensible expression language: its grammar, definitions, types, resolution, functions and vocabulary contracts are the language's, and a host registers the vocabulary its expressions read. It knows no domain; [DOMQL](https://github.com/FormaUI/DOMQL), its first host, adds the DOM. Source ES modules live in `src/`; the build produces one minified bundle, distributed by the `formaui-net.Lexica` NuGet package, and the npm package `@formaui/lexica` ships the sources.

## Before making a change

Read the documents that govern the affected contract:

| Document | Authority |
| --- | --- |
| [Specification](docs/lexica-specification.md) | Language syntax, resolution, values, requests, vocabulary contracts, definitions and diagnostics |
| [Design](docs/lexica-design.md) | Modules, their declarations and registration, and tooling |
| [Implementation plan](docs/lexica-implementation-plan.md) | Unfinished work, its status and open decisions |
| `.editorconfig` | Code style; read it before writing C# |

Update the specification before implementing a language change, and the design before changing a module or tooling contract. Record a departure from the design in the plan until the design is aligned. When planned work is complete, remove its unfinished-work entry and update Built to describe what exists.

## Repository structure

| Path | Responsibility |
| --- | --- |
| `src/lexica.js` | Entry point that composes the library's modules, declared in `src/lexica.d.ts` |
| `src/language/` | Text, definitions, types, resolution, errors and locations |
| `src/language/vocabulary/` | Modules, their registry, and Lexica's built-in vocabulary |
| `src/common/` | Object and array operations independent of the language |
| `tests/` | Tests mirroring the source folders, run in Node |
| `scripts/` | Bundling scripts |
| `nuget/` | The package project, which distributes the bundle |
| `.local/` | Personal experiments, spikes and notes; ignored by Git |

Nothing in `src/` imports from outside it or reads a browser global; a test enforces the imports, and the tests run in Node. A change DOMQL depends on is made in both repositories together.

## Implementation conventions

- Express one concept per module as a class. Supply collaborators through its constructor and use `#`-private implementation details. A family of pure helpers is a class with static members.
- Keep the entry point responsible for composition rather than re-exporting internal modules.
- Use native modern JavaScript in `src/`, with no external runtime libraries or polyfills. Scripts are ES modules.
- Report failures at their origin as an error with a location. Never swallow a rejection.
- State each cache's validity and release conditions. Measure the work it saves.

## Tests and verification

Add or update a test for every source module changed, asserting exact definitions, error kinds and locations. Run `./build.ps1`, the gate: the tests, the bundle, the package project's build with no warnings, and the format check.
