# Nexo Specification v1.0.0-alpha.38

Nexo is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its expressions and data are immutable, and evaluation is read-only; changes to the domain are explicit requests carried out by the host. Nexo has no application domain of its own: modules declare the types and members available to a script, and adding them never changes the grammar.

This specification is the authoritative contract for the language and for the host contract its implementations offer. It states what Nexo is, not how far an implementation has come: [the status overview](../docs/features-status.md) says what this repository implements, and [the design](../docs/nexo-design.md) how it is built.

<a id="version"></a>

**Version.** This specification describes language version `1.0.0-alpha.38`, and describes definition version 36. The two change apart: the language specification's version as the language's contract does, and the definition format's version as the serialized definition's contract does, as [the definition](runtime/definition.md#definition) sets out; one change can advance both. An implementation says which of each it follows, as [versions](runtime/versions.md#runtime-versions) set out.

## What it covers

Three layers meet whenever a script runs, and this specification covers the first two:

| Layer | What it owns | Documents |
| --- | --- | --- |
| The language | What a script means: its text, its names and scope, its values and types, its expressions and functions, its members, and the contracts its vocabulary keeps | [The language](#the-language) |
| The implementation | Carrying the language's rules out for a host: reading, resolution and evaluation, bindings, results and what it reports | [The runtime](#the-runtime) |
| The host | The application around the implementation: which modules it registers, when it evaluates, what it does with each result, and what it does with each host call | The host's own specification |

<a id="reading-this-specification"></a>

## Reading this specification

The specification holds two contracts, each readable on its own, and a reader starts with the one that answers their question:

- **What a script means.** A script's author, or anyone implementing the language, reads [the language](#the-language), starting with [scripts](language/scripts.md), which shows a complete script with its parameters and its result. It sets out the language's grammar, names, values, types, expressions and functions, how a script reaches a module's vocabulary, and the conditions a script fails on, without the API that carries them out.
- **What a host provides.** A host integrating Nexo reads [the runtime](#the-runtime), starting with [hosting Nexo](runtime/hosting.md), which shows the steps from a host's values to a result. It sets out binding, resolving and evaluating a script, declaring and registering modules and their implementations, the definition a host exchanges, and errors as a host handles them, without restating the language's rules.

Where the two meet, a document explains the other contract's part briefly and links it. Examples illustrate the rules of the document holding them: scripts in the language, and host code in the runtime. Code containing `…` is a fragment, and examples explicitly described as errors are intentionally invalid. Type notation such as `T?`, `List<T>` and `Never` describes types; it does not declare a type in a script. Every example reads the fictional vocabulary that [the examples' vocabulary](language/examples-vocabulary.md) declares.

## Documents

<a id="the-language"></a>

### The language

1. [Scripts](language/scripts.md): what a script is, its parameters, names and scope, the implicit parameter, bodies and locals.
2. [Lexical structure](language/lexical-structure.md): tokens, names and reserved words, strings and escapes, comments and case.
3. [Values](language/values.md): objects and the object root, null, results and conversions.
4. [Types](language/types.md): type families, type parameters, reference types, nullability, receivers of unknown type, values of `Any` and casts.
5. [Collections](language/collections.md): lists, dictionaries and pairs, collection expressions, positions, variance, and the members of lists, dictionaries and pairs.
6. [Expressions](language/expressions.md): precedence, tests, truthiness, equalities, arithmetic, comparisons, logical expressions, conditionals, `do` expressions, coalescing, attempts, interpolated strings and simple expressions.
7. [Functions](language/functions.md): regular and arrow functions declared in a script, their values, references to a module's functions, what they see, what a call reads, and implicit bodies.
8. [Members](language/members.md): member kinds, writing a member, computed property access, parameters and arguments, and host calls.
9. [Modules](language/modules.md): imports, namespaces, module members, qualified access, indexer selection, a module's own collisions and module names in text.
10. [Extensions](language/extensions.md): how owners and extensions are selected, extensions on different targets, extension access and an extension's type parameters.
11. [Vocabulary](language/vocabulary.md): Nexo's own vocabulary of numbers and strings, Boolean functions and type selectors.
12. [Errors](language/errors.md): the conditions a script fails on, each with its kind and code.
13. [Grammar](language/grammar.md): the formal grammar, grouped by subject.
14. [Terms](language/terms.md): the language's glossary.
15. [The examples' vocabulary](language/examples-vocabulary.md): the fictional `Home` and `Energy` modules every example reads.

<a id="the-runtime"></a>

### The runtime

1. [Hosting Nexo](runtime/hosting.md): the layers, the steps a host takes and the runtime's documents.
2. [Bindings](runtime/bindings.md): binding a host's values, how each is typed, and supplied data.
3. [Resolution](runtime/resolution.md): resolving a script, what resolution checks, result paths, locations and reusing a resolution.
4. [Evaluation](runtime/evaluation.md): evaluators and their hooks, results and their metadata, and a value in a host's form.
5. [Host calls](runtime/host-calls.md): preparing a host call and projecting what its host supplies.
6. [Modules](runtime/modules.md): creating a module, its declarations, reference types' membership and recognition, operators and conversions, internal declarations, duplicates and registries.
7. [Members](runtime/members.md): declaring a member, its parameter keys, the declaration helpers, updates, tolerance, what an implementation receives, and how a member reads and changes.
8. [Extensions](runtime/extensions.md): declaring an extension.
9. [Observations](runtime/observations.md): observation types, targets and the observations a member names.
10. [Type selectors](runtime/type-selectors.md): declaring type selectors and their keys.
11. [Definition](runtime/definition.md): the JSON definition, its nodes, its structural validation and its canonical text.
12. [Versions](runtime/versions.md): the versions an implementation reports.
13. [Errors](runtime/errors.md): the error object, codes, locations, the conditions of definitions, bindings, declarations, host code and the API's use, and tolerant reading.
14. [Terms](runtime/terms.md): the runtime's glossary.
