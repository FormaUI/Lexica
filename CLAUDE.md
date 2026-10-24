# Working on Lexica

Lexica is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its grammar, definitions, types, resolution, functions and vocabulary contracts are the language's, and a host registers the vocabulary its expressions read. It knows no domain of its own: a host's modules declare one. Source ES modules live in `src/`; the build produces one minified bundle, distributed by the `formaui-net.Lexica` NuGet package, and the npm package `@formaui/lexica` ships the sources.

## Before making a change

Read the documents that govern the affected contract:

| Document | Authority |
| --- | --- |
| [Specification](spec/README.md) | Language syntax, resolution, values, requests, vocabulary contracts, definitions and diagnostics, one document per subject |
| [Design](docs/lexica-design.md) | Architecture: the stages, modules and their registration, evaluation and tooling |
| [Status](docs/features-status.md) | What is implemented, what is in progress, what remains, open decisions and the gaps between the design and the code |
| [Guide](docs/embedding-guide.md) | Embedding Lexica, by example |
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

## Names and responsibilities

[Clarify responsibilities and unify terminology](docs/proposals/responsibilities-and-terminology.md) gives the reasoning, and [its ledger](docs/proposals/responsibilities-and-terminology-ledger.md) each concept's review.

- Distinguish what matters, and unify what is equivalent. Give one concept one term and one contract; give two things separate terms only where a difference in meaning, behaviour or responsibility requires treating them differently, and state the difference. Different syntax, origins, stages or code paths make no new concept by themselves, and representations that look alike make no shared one.
- Keep the roles apart where the difference matters: a module's declarations and its implementations, a script's syntax and its definition, preparation, compilation, runtime execution and diagnostic metadata. One operation may coordinate several, its contract saying so; a role needs no class, namespace or layer of its own.
- Let an operation's owner and its name together say who owns it, what it does and what it concerns. The owner is the class whose responsibility it is: never move an operation, or add a namespace or a layer, only to fit a name.
- Name an operation by the verb its behaviour has:

  | Verb | Meaning |
  | --- | --- |
  | `define` | Establish or describe a contract |
  | `create` | Construct a representation or an instance |
  | `get` | Retrieve an existing declaration, descriptor or named piece of information |
  | `read` | Obtain a value from its source |
  | `write` | Assign a value where mutation is supported |
  | `parse` | Interpret source syntax into its representation |
  | `scan` | Scan source into tokens, or identify its lexical structure |
  | `resolve` | Determine which name, type or declaration applies |
  | `validate` | Check compliance with a contract |
  | `prepare` | Establish what execution needs |
  | `compile` | Transform a representation into an executable form |
  | `evaluate` | Execute an expression to obtain its result |
  | `invoke` | Call a selected implementation |
  | `register` | Add an item to a registry |
  | `observe` | Establish tracking of changes |
  | `dispose` | Release resources or end a lifecycle |
  | `quote`, `format` | Produce a textual representation |

- Let a name or a contract reveal every side effect: a predicate writes nothing, and an operation that creates and registers says so in its name or its contract, or the two are separated.
- Read the verbs as a guide, not a whitelist: an ordinary verb that is unambiguous stays, as reading source text does. An operation whose new name would only list its current contents keeps its name, with its contract documented.
- Use the glossary's terms, in code and prose alike: an object field, a declaration key, a module key, a stored property.

## Tests and verification

Add or update a test for every source module changed, asserting exact definitions, error kinds and locations. Run `./build.ps1`, the gate: the tests, the bundle, the package project's build with no warnings, and the format check.
