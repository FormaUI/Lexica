# Nexo Specification v1.0.0-alpha.38

Nexo is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its expressions and data are immutable, and evaluation is read-only; changes to the domain are explicit requests carried out by the host. Nexo has no application domain of its own: modules declare the types and members available to a script, and adding them never changes the grammar.

This specification is the authoritative contract for the language and for the host contract its implementations offer. It states what Nexo is, not how far an implementation has come: [the status overview](../docs/features-status.md) says what this repository implements, and [the design](../docs/nexo-design.md) how it is built.

<a id="version"></a>

**Version.** This specification describes language version `1.0.0-alpha.38`, and describes definition version 36. The two change apart: the language specification's version as the language's contract does, and the definition format's version as the serialized definition's contract does, as [the definition](runtime/definition.md#definition) sets out; one change can advance both. An implementation says which of each it follows, as [versions](runtime.md#runtime-versions) set out.

## What it covers

Three layers meet whenever a script runs, and this specification covers the first two:

| Layer | What it owns | Documents |
| --- | --- | --- |
| The language | What a script means: its text, its names and scope, its values and types, its expressions and functions, its members, and the contracts its vocabulary keeps | Every document but the host contract |
| The implementation | Carrying the language's rules out for a host: reading, resolution and evaluation, bindings, results and what it reports | [Host contract](runtime.md) |
| The host | The application around the implementation: which modules it registers, when it evaluates, what it does with each result, and what it does with each host call | The host's own specification |

<a id="reading-this-specification"></a>

## Reading this specification

Start with [scripts](scripts.md), which shows a complete script with its parameters and its result. Examples illustrate the rules. Code containing `…` is a fragment, and examples explicitly described as errors are intentionally invalid. Type notation such as `T?`, `List<T>` and `Never` describes types; it does not declare a type in a script. Every example reads the fictional vocabulary that [the examples' vocabulary](language/examples-vocabulary.md) declares.

## Documents

1. [Scripts](scripts.md): what a script is, its parameters and bindings, names and scope, the implicit parameter, bodies and locals.
2. [Lexical structure](language/lexical-structure.md): tokens, names and reserved words, strings and escapes, comments and case.
3. [Values](values.md): objects and the object root, null, supplied data, results and conversions.
4. [Types](types.md): type families, type parameters, reference types, nullability, receivers of unknown type, values of `Any` and casts.
5. [Collections](language/collections.md): lists, dictionaries and pairs, collection expressions, positions, variance, and the members of lists, dictionaries and pairs.
6. [Expressions](language/expressions.md): precedence, tests, truthiness, equalities, arithmetic, comparisons, logical expressions, conditionals, `do` expressions, coalescing, attempts, interpolated strings and simple expressions.
7. [Functions](language/functions.md): regular and arrow functions declared in a script, their values, references to a module's functions, what they see, what a call reads, and implicit bodies.
8. [Members](members.md): member kinds, writing a member, computed property access, parameters and arguments, declaring a member, how a member reads and changes, and host calls.
9. [Modules](modules.md): creating a module, its declarations, registries and namespaces.
10. [Extensions](extensions.md): declaring an extension, how owners and extensions are selected, extensions on different targets, extension access and an extension's type parameters.
11. [Vocabulary](vocabulary.md): Nexo's own vocabulary of numbers and strings, Boolean functions, observations, type selectors and conversions.
12. [Host contract](runtime.md): bindings, resolution, evaluation, results and their metadata, and preparing and projecting host calls.
13. [Definition](runtime/definition.md): the JSON definition, its nodes, its structural validation and its canonical text.
14. [Diagnostics and errors](diagnostics-and-errors.md): the kinds of failure, where each is located, and tolerant reading.
15. [Grammar](language/grammar.md): the formal grammar, grouped by subject.
16. [Terms](terms.md): the glossary.
17. [The examples' vocabulary](language/examples-vocabulary.md): the fictional `Home` and `Energy` modules every example reads.
