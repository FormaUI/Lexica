# Terms

<a id="runtime-terms"></a>

Each term the runtime contract uses, what it means, and where its authoritative explanation is. A term here defines nothing its linked document does not; a term whose rule the language states is defined in [the language's glossary](../language/terms.md), and stands here briefly, linking it.

In this document:

1. [Hosting and evaluation](#runtime-terms-hosting)
2. [Declarations](#runtime-terms-declarations)
3. [Names for implementations](#names-for-implementations)

<a id="runtime-terms-hosting"></a>

## Hosting and evaluation

| Term | Meaning | Reference |
| --- | --- | --- |
| Expression tree | The nodes of an expression, each with its `kind`, which the definition records with the version of its format | [Definition](definition.md#definition) |
| Prepared call, skipped call | What preparing a host call answers: a prepared call, its declaration, receiver and arguments, which projects each value its host supplies where the call declares a result; or a skipped call, where there is nothing to invoke | [Host calls](host-calls.md#runtime-host-calls) |
| Definition | The JSON document recording a script's meaning | [Definition](definition.md#definition) |
| Implementation of Nexo | A program that carries the language's rules out for a host: its parser reads a script's source into its definition and validates its structure, its resolver resolves the script against a registry, and its runtime evaluates it; the rules are the language's, and an implementation follows them without defining any | [Host contract](hosting.md#runtime) |
| Runtime | The part of an implementation of Nexo that evaluates a resolved script for its host: it holds the script's bindings and its host's environment, evaluates its expressions, invokes its members' implementations, calls its host's hooks and describes each result | [Evaluation](evaluation.md#runtime-evaluation) |
| Host | The application around an implementation of Nexo, which registers modules, binds values, evaluates, invokes its host calls and decides what to do with each result | [Host contract](hosting.md#runtime) |
| Registry | What holds the modules a host resolves and evaluates against | [Registries](modules.md#modules-registries) |
| Resolution | A script resolved against a registry with bindings of one resolution key: its type and the declarations it uses | [Resolution](resolution.md#runtime-bindings-and-resolution) |
| Diagnostic | A description of one problem, its kind, message and location, which a strict operation throws as an error | [Diagnostics and errors](errors.md#diagnostics-and-errors) |
| Binding | The value a host supplies for a script parameter, as the language's [glossary](../language/terms.md#expressions-and-results) defines it | [Bindings](bindings.md) |

<a id="runtime-terms-declarations"></a>

## Declarations

| Term | Meaning | Reference |
| --- | --- | --- |
| Structured type | A type of immutable data a module declares, its data shape the properties it declares directly without `updates` | [Declaring a type](modules.md#modules-declaring-a-type) |
| Data shape | The properties a structured type declares directly without `updates`, each with its type: what a value of the type holds, which Nexo validates, copies and freezes it by, and which no extension changes | [Declaring a type](modules.md#modules-declaring-a-type) |
| Membership | Whether a value belongs to a reference type, which the `isInstance` of the type and of every supertype above it answers | [Reference types](modules.md#runtime-reference-types) |
| Recognition | How a binding's reference value finds its type where none is declared: the type the registered modules' `typeOf` name, the one beneath every other | [Reference types](modules.md#runtime-reference-types) |
| Operator | A member of `kind: 'operator'`, `cast` or `convert`, which `as` or `to` alone invokes | [Operators](modules.md#modules-operators) |
| Declaration key | A key of a declaration's own configuration, as `result`, `impl` or `updates.misses`, which a module error names where one is wrong | [Valid declarations](modules.md#modules-valid-combinations) |
| Module key | A key of a module's contents, as `types`, `members` or `typeOf` | [Creating a module](modules.md#modules-declarations) |
| Internal declaration | A type or a member declared `internal: true`, available within its declaring module alone | [Internal declarations](modules.md#modules-internal-declarations) |
| Observation | What a member names to learn that its result may have changed, or to keep the sample it reads | [Observations](observations.md#observations) |
| Observation type | A module's declaration of an observation, its contract an invalidation or maintained | [Observations](observations.md#observations) |
| Observation target | What a module declares its observations may observe besides the receiver and an argument, independent of the receiver or found from it, one target or several | [Observations](observations.md#observations) |
| Mapping | One key of a type selector and the type it maps to, `{ selector, key, type }`, which any module may declare | [Type selectors](type-selectors.md) |
| Module | A named set of declarations a host creates and registers, as the language's [glossary](../language/terms.md#vocabulary-and-host-calls) defines it | [Modules](modules.md) |

<a id="names-for-implementations"></a>

## Names for implementations

The specification names concepts, and an implementation names its own code. The names below are suggested wherever they read well, so implementations, and the modules written for them, read alike.

When naming the implicit parameter or concepts associated with it, implementations may use **context**, either on its own or within compound names. This convention does not reserve the word: **context** may also describe other concepts where its meaning is clear.

| Concept | Name in code | As in |
| --- | --- | --- |
| [Implicit parameter](../language/scripts.md#names-and-resolution) | `context` | `context`, `contextType`, `projectionContext`, a parameter declaration's `context: 'item'` |
| A member's code | `impl` | the function that carries a member out |
| What the host supplies an evaluation | `env` | an implementation's `env` |
| [Receiver](../language/members.md#access-and-calls) | `receiver` | an implementation's `receiver` |
| A call's arguments, by parameter name | `args` | an implementation's `args` |
