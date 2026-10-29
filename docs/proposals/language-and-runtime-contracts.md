# Proposal: the language contract and the runtime contract

**State: accepted.** Not implemented. It reorganizes the [specification](../../spec/README.md) and changes no rule, so neither the language's version nor the definition format's advances.

The specification holds two contracts for two readers, and today it interleaves them. Someone learning the language reads a script's meaning and meets `createModule`, declaration keys and hook answers on the way; someone integrating Nexo reads the host API and meets grammar, truthiness and precedence on the way. This proposal separates the **language contract**, what a script means, from the **runtime contract**, how a host prepares, evaluates and supplies what a script reads. Each is readable on its own, and explicit links stand where the two meet.

The change is in the content, not the folders: each document's sections go to the contract they state, and a document that holds both is split, rather than moved whole into one folder.

<a id="the-boundary"></a>

## The boundary

| `spec/language/` | `spec/runtime/` |
| --- | --- |
| Expressions, syntax, names and scope | Preparing and evaluating scripts through the API |
| Values, types, collections and equality | Representing and supplying values and types from host code |
| Functions, calls and member selection | Declaring members and providing their implementations |
| Imports, and how a script refers to modules | Creating, registering and exposing modules |
| The conditions on what a script may express | Error objects, their factories and locations, the conditions on declarations and on the API's use, and handling them through the API |

Two rules decide the cases the table leaves open:

- **A concept may belong to both, as two contracts.** Modules are the clearest: how a script imports a module and how its members are selected is the language's; how a host defines and registers that module is the runtime's. Extensions, host calls, type selectors, conversions, Boolean functions and observations divide the same way. The boundary runs between the two contracts, never between documents that mention a concept and documents that don't.
- **Semantics are the language's, though the runtime carries them out.** What equality means, which values are falsy, how a member is selected, what a conversion of null answers and which failures a script raises are language rules, written in the language contract; the runtime contract says how a host reaches and observes them.

<a id="links-and-examples"></a>

## Links and examples

- **Each document states its own contract completely,** and each rule has one authoritative statement, where its contract places it.
- **Context from the other contract is a short explanation and a link,** never a second statement of the rule: a runtime document says what a conversion operator's implementation answers, and that `to` decides what becomes of it, linking the language's conversions rather than restating them. The aim is that each contract reads on its own, not that no reader ever follows a link.
- **An example explains the contract of the document holding it.** Language documents show scripts; runtime documents show host code, and a short script where it makes the API's effect clear, as what a registered member exposes, how a type selector shapes a result or how an extension is selected, without becoming a tutorial of the language.

<a id="the-structure"></a>

## The structure

```
spec/
  README.md          the two reading paths and their indexes
  language/          what a script means
  runtime/           how a host prepares, evaluates and supplies it
```

`spec/README.md` keeps the version line and explains the two paths in a few lines: a script author or a language implementer starts in `language/`, a host integrator in `runtime/`, and each folder's index lists its documents in reading order.

<a id="language-documents"></a>

### The language contract

| Document | What it states | From |
| --- | --- | --- |
| `scripts.md` | What a script is, its parameters as a script reads them, names and scope, the implicit parameter, bodies and locals | `scripts.md`, but the typing of a host's bindings |
| `lexical-structure.md` | Tokens, names and reserved words, strings, comments, line structure and case | `lexical-structure.md`, whole |
| `values.md` | Objects and the object root, null, results as data, and conversions as a script writes them | `values.md`, but supplied data and a result's host forms |
| `types.md` | Type families, nullability, identity, type parameters as inference binds them, reference types as a script sees their hierarchy, assignability, `Any` and casts | `types.md`, but declaring a reference type's membership and registration's checks |
| `collections.md` | Lists, dictionaries and pairs, collection expressions, positions, variance and their members | `collections.md`, whole |
| `expressions.md` | Precedence, tests, truthiness, equality, arithmetic, comparisons, logic, conditionals, coalescing, attempts and interpolation | `expressions.md`, whole |
| `functions.md` | Script functions, delegates, function references, what a call reads and implicit bodies | `functions.md`, whole |
| `members.md` | Writing a member, computed property access, arguments and their kinds, a host call's place in a script and its result projection | `members.md`, but declaring a member, how it reads and changes, and preparing a host call |
| `modules.md` | Imports, namespaces, module members, qualified access, owners and extensions, indexer and operator selection, and module names in text | `scripts.md`'s imports, `modules.md`'s namespaces but the duplicates registration refuses, and `extensions.md` but declaring an extension |
| `vocabulary.md` | Nexo's own members of numbers and strings, Boolean functions as a script calls and passes them, and a type selector as a fixed argument selects a result | `vocabulary.md`'s script-facing parts |
| `errors.md` | The conditions on what a script may express, each with its kind and code | `diagnostics-and-errors.md`'s condition tables, as [the error catalog](#the-error-catalog) assigns them |
| `grammar.md` | The formal grammar | `grammar.md`, whole |
| `terms.md` | The language's glossary | `terms.md`'s language terms |
| `examples-vocabulary.md` | The `Home` and `Energy` vocabulary every example reads, described through its visible types and members | `examples-vocabulary.md` |

<a id="runtime-documents"></a>

### The runtime contract

These documents are a starting point: a document stays separate where it explains a coherent subject, and none is split only to match the language's grain.

| Document | What it states | From |
| --- | --- | --- |
| `hosting.md` | The entry point, reading and writing text, and the lifecycle from bindings to a result | New overview, from `runtime.md`'s introduction |
| `bindings.md` | Binding a host's values, how each is typed, declared types, supplied data and the resolution key | `runtime.md`'s bindings, `scripts.md`'s binding typing, `values.md`'s supplied data |
| `resolution.md` | Resolving a script, what a resolution answers, result paths, locations and reusing a resolution | `runtime.md`'s resolution |
| `evaluation.md` | Evaluators, hooks, results and their metadata, a result's and a collection's host forms, and how positions reach an implementation | `runtime.md`'s evaluation and results, `values.md`'s host forms |
| `host-calls.md` | Preparing a host call, the prepared and skipped call, and projecting what a host supplies | `runtime.md`'s host calls |
| `modules.md` | Creating a module, declaring types, reference types' membership and recognition, operators and a conversion operator's `impl` and `reject`, internal declarations, valid declarations, registries and the duplicates registration refuses | `modules.md`'s declarations, operators and registries, the duplicates its own collisions refuse at registration, `types.md`'s membership, and `vocabulary.md`'s conversion operators as declared |
| `members.md` | Declaring a member, its parameter keys, the declaration helpers, updates, tolerance, how a member reads and changes, and what an implementation receives | `members.md`'s declarations, and `types.md`'s registration checks that a member's type parameters can be inferred |
| `extensions.md` | Declaring an extension and its target | `extensions.md`'s declaring an extension |
| `observations.md` | Observation types, targets and naming observations | `vocabulary.md`'s observations |
| `type-selectors.md` | Declaring type selectors and their mappings | `vocabulary.md`'s type selectors as declared |
| `definition.md` | The JSON definition, its structural validation and its canonical text | `definition.md`, whole |
| `errors.md` | `NexoError`, its factories, locations, the conditions on declarations and on the API's use, and tolerant reading | `diagnostics-and-errors.md`'s error object and locations, its condition tables as [the error catalog](#the-error-catalog) assigns them, and tolerant reading |
| `versions.md` | The implementation's, the language's and the definition format's versions | `runtime.md`'s versions |
| `terms.md` | The runtime's glossary | `terms.md`'s runtime terms and names for implementations |

<a id="hard-cases"></a>

## Cases that divide

| Concept | Language contract | Runtime contract |
| --- | --- | --- |
| Modules | Importing one, its namespace, reading its members, qualified access | `createModule`, its declarations, registries and collisions at registration |
| Extensions | Selection by owner and specificity, extensions on different targets, extension access | Declaring an extension and its target |
| Reference types | A hierarchy: a value of a type is a value of its supertype, casts within it | `isInstance`, `typeOf` and recognition |
| Host calls | A chain ends in one, and its result projection reads what the host supplies | `prepareHostCall`, the prepared call and `project` |
| How a member reads and changes | Evaluation is synchronous and read-only | `updates`, readings, observations and tolerance |
| Conversions | `to`, `try … to`, null and what fails | A conversion operator's `impl` and `reject` |
| Type selectors | A fixed argument selects a result's type | `typeSelectors` and `mappings` |
| Errors | The conditions on what a script may express | The error object, its location, and the conditions on declarations and on the API's use |
| The definition | The semantics the runtime applies when it interprets one | The representation hosts and tools exchange: its JSON, its structural validation and its canonical text |

The definition format belongs to the runtime contract because it specifies a representation that hosts and tools exchange. The language contract defines the semantics that the runtime applies when interpreting that representation.

<a id="the-error-catalog"></a>

### The error catalog

Each condition goes to the contract it describes, decided by examining the condition rather than by its kind: a condition about an invalid declaration is the runtime's, and one about what a script may express is the language's. Most syntax, validation and evaluation conditions are likely the language's, and most module and structure conditions the runtime's, but that is the outcome to verify condition by condition, never the rule that assigns them; a condition of the API's own use, as bindings of another registry, is the runtime's whatever its kind. Every kind and every code stays as it is, and the tests verify the two catalogs together as one: every code catalogued once, none raised that neither catalogs.

<a id="glossaries"></a>

### The glossaries

Each contract has its own glossary. A meaning shared by both has one authoritative definition, in the glossary of the contract whose rule it names; the other glossary gives a short entry that links to it.

<a id="examples-vocabulary"></a>

### The examples' vocabulary

It stays in `language/`, described through the types and members a script sees. Runtime documents demonstrate how those declarations are provided, the `Home` module's declaration among them, where they declare one.

<a id="what-changes-with-it"></a>

## What changes with it

- **Links.** Every link moves to its new path. A link that crossed contracts to finish a paragraph keeps its link, beside a short explanation of the context it gives.
- **Anchors.** A section keeps its anchor where it moves whole; a split section gives each half an anchor of its own document.
- **Tests.** `DocumentExamples` maps examples by document and moves with them, `Alignment` reads the version from `spec/README.md` and the example definition from the runtime's `definition.md`, and `DiagnosticCodes` reads both catalogs as one.
- **Documents beside the specification.** The design, the guide, the status overview and the proposals link to the new paths; the guide, a runtime reader's tutorial, links into `runtime/` first.
- **DOMQL.** Its documents link to Nexo's specification by path, so its next host checkpoint gains a line naming the links to update.

<a id="steps"></a>

## Steps

Each step passes the gate, so a step that moves a file changes, in the same step, every test, index and link that depends on its path, the documents beside the specification among them.

1. **The whole documents.** Create both folders and move the documents each contract holds whole, keeping their anchors, with `spec/README.md`'s index, the tests' paths and every link to them.
2. **The mixed documents.** Split each, section by section, as the tables above set out, writing each half to state its contract completely, with the links into each half and the examples each test maps.
3. **The error catalog.** Assign each condition as [the error catalog](#the-error-catalog) sets out, with `DiagnosticCodes` reading both catalogs.
4. **The glossaries and the reading paths.** Split the glossary as [the glossaries](#glossaries) set out, and write `spec/README.md`'s two reading paths and each folder's index in reading order.
5. **The record.** The status overview's contracts table and its references, and the line DOMQL's next host checkpoint gains.

The moved text is checked at each step to lose no rule, as the moves of collections and extensions were.
