# Lexica Specification v1.0.0-alpha

Lexica is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its expressions and data are immutable, and evaluation is read-only; changes to the domain are explicit requests carried out by the host. Lexica knows no application domain of its own: modules declare the types and members available to a script, and adding them never changes the grammar.

This specification is the authoritative contract for the language and for the runtime a host builds on. It states what Lexica is, not how far an implementation has come: [the status overview](../docs/status.md) says what this repository implements, and [the design](../docs/lexica-design.md) how it is built.

<a id="version"></a>

**Version.** This specification describes definition version 32.

## What it covers

Three layers meet whenever a script runs, and this specification covers the first two:

| Layer | What it owns | Documents |
| --- | --- | --- |
| The language | What a script means: its text, its names and scope, its values and types, its expressions and functions, its members, and the contracts its vocabulary keeps | Every document but the runtime |
| The runtime | Carrying a script out for a host: bindings, resolution, evaluation, results and what it reports | [Runtime](runtime.md) |
| The host | The application around the runtime: which modules it registers, when it evaluates, and what it does with each result | The host's own specification, as [DOMQL's](https://github.com/FormaUI/DOMQL/blob/main/spec/README.md) |

<a id="reading-this-specification"></a>

## Reading this specification

Start with [scripts](scripts.md), which shows a complete script with its parameters and its result. Examples illustrate the rules. Code containing `…` is a fragment, and examples explicitly described as errors are intentionally invalid. Type notation such as `T?`, `list<T>` and `never` describes types; it does not declare a type in a script. Every example reads the fictional vocabulary that [the examples' vocabulary](examples-vocabulary.md) declares.

## Documents

1. [Scripts](scripts.md): what a script is, its parameters and bindings, names and scope, the implicit parameter, bodies and locals.
2. [Lexical structure](lexical-structure.md): tokens, names and reserved words, strings and escapes, comments and case.
3. [Values](values.md): objects and the object root, lists, null, supplied data, results and conversions.
4. [Types](types.md): type families, reference types, nullability, receivers of unknown type and casts.
5. [Expressions](expressions.md): precedence, tests, truthiness, equalities, arithmetic, comparisons, logical expressions, conditionals, `do` expressions, coalescing, attempts, interpolated strings and simple expressions.
6. [Functions](functions.md): regular and arrow functions declared in a script, their values, what they see and what a call reads.
7. [Members](members.md): member kinds and requests, writing a member, bracket property access, parameters and arguments, declaring a member, how a member reads and changes, actions, behaviors and event sources.
8. [Modules](modules.md): creating a module, its declarations, registries, namespaces and extensions.
9. [Vocabulary](vocabulary.md): Lexica's own vocabulary, predicates, observations, event types and conversions.
10. [Runtime](runtime.md): bindings, resolution, evaluation, results and their metadata, and carrying out each kind of request.
11. [Definition](definition.md): the JSON definition, its nodes, its structural validation and its canonical text.
12. [Diagnostics and errors](diagnostics-and-errors.md): the kinds of failure, where each is located, and tolerant reading.
13. [Grammar](grammar.md): the formal grammar, grouped by subject.
14. [Terms](terms.md): the glossary.
15. [The examples' vocabulary](examples-vocabulary.md): the fictional `home` and `energy` modules every example reads.

The [DOMQL specification](https://github.com/FormaUI/DOMQL/blob/main/spec/README.md) builds the DOM's vocabulary on this one; it adds no language rule.
