# Working on Lexica

Lexica is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its grammar, definitions, types, resolution, functions and vocabulary contracts are the language's, and a host registers the vocabulary its expressions read. It knows no domain of its own: a host's modules declare one. Source ES modules live in `src/`; the build produces one minified bundle, distributed by the `formaui-net.Lexica` NuGet package, and the npm package `@formaui/lexica` ships the sources.

## Before making a change

Read the documents that govern the affected contract:

| Document | Authority |
| --- | --- |
| [Specification](spec/README.md) | Language syntax, resolution, values, requests, vocabulary contracts, definitions and diagnostics, one document per subject |
| [Design](docs/lexica-design.md) | Architecture: the stages, modules and their registration, evaluation and tooling |
| [Status](docs/status.md) | What is implemented, what is in progress, what remains, open decisions and the gaps between the design and the code |
| [Guide](docs/guide.md) | Embedding Lexica, by example |
| `.editorconfig` | Code style; read it before writing C# |

Update the specification before implementing a language change, and the design before changing a module or tooling contract. Each subject has one home: state a rule where it belongs and link to it elsewhere. Record a gap between the design and the code in the status overview until it closes, and update a row's status as soon as its work lands.

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
| `spec/` | The specification, one document per subject, indexed by `spec/README.md` |
| `docs/` | The design, the guide and the status overview |
| `.local/` | Personal experiments, spikes and notes; ignored by Git |

Nothing in `src/` imports from outside it or reads a browser global; a test enforces the imports, and the tests run in Node.

## Implementation conventions

- Express one concept per module as a class. Supply collaborators through its constructor and use `#`-private implementation details. A family of pure helpers is a class with static members.
- Keep the entry point responsible for composition rather than re-exporting internal modules.
- Use native modern JavaScript in `src/`, with no external runtime libraries or polyfills. Scripts are ES modules.
- Report failures at their origin as an error with a location. Never swallow a rejection.
- State each cache's validity and release conditions. Measure the work it saves.

## Tests and verification

Add or update a test for every source module changed, asserting exact definitions, error kinds and locations. Run `./build.ps1`, the gate: the tests, the bundle, the package project's build with no warnings, and the format check.
