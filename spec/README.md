# Lexica Specification v1.0.0-alpha

Lexica is a general-purpose, embeddable language that lets applications define their own domain as an integral part of the language. Its expressions and data are immutable, and evaluation is read-only; changes to the domain are explicit requests carried out by the host. Lexica knows no application domain of its own: modules declare the types and members available to an expression, and adding them never changes the grammar.

This specification is the authoritative contract for the language, its vocabulary contracts and its JSON definition format. It states what the language is, not how far an implementation has come: [the status overview](../docs/status.md) says what this repository implements, and [the design](../docs/lexica-design.md) how it is built.

<a id="version"></a>

**Version.** This specification describes definition version 32.

<a id="reading-this-specification"></a>

## Reading this specification

Examples illustrate the rules. Code containing `…` is a fragment, and examples explicitly described as errors are intentionally invalid. Type notation such as `T?`, `list<T>` and `never` describes types; it does not declare a type in an expression. Every example reads the fictional vocabulary that [the examples' vocabulary](examples-vocabulary.md) declares.

The [syntax](syntax.md) and the [terms](terms.md) are appendices, so the language can be read before its notation.

## Documents

| Document | What it specifies |
| --- | --- |
| [The examples' vocabulary](examples-vocabulary.md) | The fictional `home` and `energy` modules every example reads |
| [Values and types](values-and-types.md) | Values, objects, lists, types, reference types, nullability, bindings and receivers of unknown type |
| [Names and scope](names-and-scope.md) | How a name resolves, the implicit parameter, reserved words and the caller's bindings |
| [Lexical structure](lexical-structure.md) | Tokens, whitespace, strings and their escapes, comments and case |
| [Access and calls](access-and-calls.md) | Property access, function calls, indexers, optional chains, bracket property access, arguments and simple expressions |
| [Modules and namespaces](modules-and-namespaces.md) | Module members, owners and extensions, qualified access and a module's collisions |
| [Expressions](expressions.md) | Precedence, tests, truthiness, equalities, arithmetic, comparisons, logical expressions, conditionals, coalescing and interpolated strings |
| [Casts, conversions and attempts](casts-and-conversions.md) | `as`, `to` and `try` |
| [Bodies, locals and functions](bodies-and-functions.md) | Bodies, locals, the object root and functions |
| [Requests](requests.md) | The four kinds of request, and events |
| [Vocabulary contracts](vocabulary-contracts.md) | What a member declares, how it reads and changes, observations, predicates, and events and event types |
| [Definition](definition.md) | The JSON definition format and its validation |
| [Errors and diagnostics](errors.md) | Absence, and the kinds of error and what each reports |
| [Syntax](syntax.md) | The formal grammar |
| [Terms](terms.md) | The glossary |

The [DOMQL specification](https://github.com/FormaUI/DOMQL/blob/main/spec/README.md) builds the DOM's vocabulary on this one; it adds no language rule.
