# Features Status

What this repository implements today, what is being built, and what remains. The [specification](../spec/README.md) is the contract and the [design](lexica-design.md) the architecture; this document tracks how far the implementation has come.

The specification describes language version `1.0.0-alpha.33` and definition version 33. **The implementation reads definition version 32** and implements language version `1.0.0-alpha.32`, without the types and members that language version `1.0.0-alpha.33` describes and version 32's third slice builds, as [definition version 32](#definition-version-32) sets out; [host calls](#host-calls) are implemented.

| Status | Meaning |
| --- | --- |
| Implemented | Built, tested in the gate, and as the specification states |
| Partial | Usable, with the parts named in its row still missing |
| In progress | Being built now |
| Planned | Accepted and not started |
| Deferred | Not planned until the need its row names appears |

## Overview

### The language

| Area | Status | What remains | Contract |
| --- | --- | --- | --- |
| Scripts: parameters, bindings, names, bodies and locals | Implemented | | [Scripts](../spec/scripts.md) |
| Lexical structure: tokens, names, strings, comments | Implemented | | [Lexical structure](../spec/lexical-structure.md) |
| Values: objects, the object root, lists, null, results and conversions | Implemented | | [Values](../spec/values.md) |
| Types | Partial | Types declared with their members, in PascalCase; reference types recognized by `typeOf` and checked by `isInstance`; type parameters by scope; casts by hierarchy or a declared cast; the DOM's node types are still built into Lexica, and a cast takes only `node` and its kinds | [Types](../spec/types.md) |
| Expressions: operators, conditionals, coalescing, attempts, interpolated strings | Implemented | | [Expressions](../spec/expressions.md) |
| Functions: regular and arrow functions, function values, function references, implicit bodies | Implemented | | [Functions](../spec/functions.md) |
| Members: forms, bracket property access, arguments | Implemented | | [Members](../spec/members.md) |
| Host calls: functions the host invokes, where they stand, the values a host supplies | Implemented | | [Host calls](../spec/members.md#members-host-calls) |
| Definition and canonical text | Implemented | | [Definition](../spec/definition.md), [Grammar](../spec/grammar.md) |
| Diagnostics: kinds, messages and locations | Implemented | Stable codes are [proposed](proposals/diagnostic-codes.md) | [Diagnostics and errors](../spec/diagnostics-and-errors.md) |

### Modules and vocabulary

| Area | Status | What remains | Contract |
| --- | --- | --- | --- |
| Module declarations in one shape, with their implementations | Implemented | | [Creating a module](../spec/modules.md#modules-declarations), [declaring a member](../spec/members.md#members-declaring-a-member) |
| Registries: registration checked whole, revisions, their own text | Implemented | | [Registries](../spec/modules.md#modules-registries) |
| Lexica's own vocabulary: list members, verbs, conversions | Implemented | | [Lexica's own vocabulary](../spec/vocabulary.md#vocabulary-lexicas-own) |
| Boolean functions | Implemented | | [Boolean functions](../spec/vocabulary.md#vocabulary-boolean-functions) |
| Observation types | Implemented | | [Observations](../spec/vocabulary.md#observations) |
| Type selectors and selectable types | Implemented | | [Type selectors](../spec/vocabulary.md#vocabulary-type-selectors) |
| Observation targets declared by modules | Implemented | | [Observation targets](../spec/vocabulary.md#observations-targets) |
| Namespaces and module members | Implemented | | [Namespaces](../spec/modules.md#namespaces) |
| Qualified access, a null receiver propagating | Implemented | | [Qualified access](../spec/modules.md#namespaces-qualified-access) |
| A module's own collisions | Implemented | | [A module's own collisions](../spec/modules.md#namespaces-a-modules-own-collisions) |
| Types declaring their members, fields, indexer kinds and operators; extension blocks | Planned | Members are declared flat, with `target`, `syntax` and `default`, structured types with `fields`, and conversions at module level | [Declaring a type](../spec/modules.md#modules-declaring-a-type), [operators](../spec/modules.md#modules-operators) |
| Internal declarations | Planned | | [Internal declarations](../spec/modules.md#modules-internal-declarations) |
| Owner precedence and extension ambiguity | Planned | Two modules declaring one name on overlapping receivers are refused at registration until it lands | [Owners and extensions](../spec/modules.md#namespaces-owners-and-extensions) |
| Reference types, recognition, membership and declared binding types | Planned | Bindings are typed without a registry, by `lexica.bind` | [Reference types](../spec/types.md#reference-types), [bindings](../spec/runtime.md#runtime-bindings) |
| Qualified extension indexers | Deferred | Beyond version 32, until a use needs one | [Indexer selection](../spec/modules.md#namespaces-indexers) |

### The runtime

| Area | Status | What remains | Contract |
| --- | --- | --- | --- |
| Parse, validate, format, quote and locate | Implemented | | [Definition](../spec/definition.md) |
| Bindings, resolution and reuse by resolution key | Implemented | | [Runtime](../spec/runtime.md#runtime-bindings) |
| Evaluation for any host, with its hooks | Implemented | | [Evaluation](../spec/runtime.md#runtime-evaluation) |
| Frozen results and result metadata | Partial | A projected item's source is recorded only where the item is a DOM node, until reference types land | [Results and their metadata](../spec/runtime.md#runtime-results) |
| Preparing a host call and projecting the values its host supplies | Implemented | | [Host calls](../spec/runtime.md#runtime-host-calls) |

### Delivery and tooling

| Area | Status | What remains | Contract |
| --- | --- | --- | --- |
| The bundle and its declarations | Implemented | | [README](../README.md#build) |
| npm and NuGet packages | Planned | Both are packed locally and neither is published; both carry the runtime version `src/language/Versions.mjs` declares | [Packages](#packages) |
| Beta | Partial | The documents and the module API are audited; the changelog and the beta version remain | [Beta](#beta) |
| Syntax tree for tooling | Partial | The lossless tree and the tolerant tokenizer are built and internal; error recovery and a public tooling API remain | [Design](lexica-design.md#the-syntax-tree) |
| Formatting that keeps a script's source | Planned | Tokens keep each string's form for it; the operation itself is not built | [Design](lexica-design.md#the-syntax-tree) |
| Editor tooling | Planned | Diagnostics and completion through the syntax tree, without running a capability | [Design](lexica-design.md#tooling) |
| Diagnostic codes | Proposed | Not accepted; the questions it lists are open | [Proposal](proposals/diagnostic-codes.md) |

## Definition version 32

Version 32 removes the DOM from the language: Lexica knows no domain, and a host declares its own as a module like any other. It is built in three slices, each with semantic tests of its own.

| Slice | Status | What it delivers |
| --- | --- | --- |
| 1. The declaration shape | Implemented | One shape for every declaration, with valid combinations for each kind; implementations carried in their declarations and called with one object; an evaluator refused for a resolution that uses a declaration or conversion without an implementation |
| 2. The version 32 definition | Implemented | Observation targets declared by modules, which are built; the `it`, `root` and `namespace` nodes; module members read through namespaces; qualified access, whose null receiver argument skips the member and its arguments; a registry parsing, formatting and quoting text with its module names; function references and implicit bodies; expression and predicate arguments taking a function of the item beside their body; the verbs given a test, and Boolean functions in place of predicates; a cast's and a conversion's type written bare; a version 31 definition refused |
| 3. Types and their members | Planned | Types declaring their members, fields, indexer kinds and operators, named in PascalCase; extension blocks, generic `List<T>` and the verbs' extension on `T`; reference types recognized by `typeOf` and checked by `isInstance`, abstract types, and registry-aware bindings with declared types; casts by hierarchy or a declared cast, and conversions as operators; owner precedence through inheritance and ambiguity at resolution; internal declarations; the built-in DOM types removed; the source of every projected item |

**What works.** The declaration shape and the version 32 definition: its `it`, `root` and `namespace` nodes, a version 31 definition refused; a registry parsing, formatting and quoting text with its module names, and refusing a definition read without them; module members, qualified forms and function references, a null receiver argument skipping the member and its own arguments wherever a reference is held, passed or chosen; the verbs given a test, an implicit body recognized by its own `it` among its forms, and Boolean functions in place of predicates; an expression or a predicate argument given an arrow function, a function a name holds or a function reference, under its own result policy; a cast's and a conversion's type written bare; and the observation targets modules declare. Six of the specification's examples resolve and evaluate.

**What is missing.** The model slice 3 builds is specified and not implemented:

| Gap | Where the contract differs | Closed by |
| --- | --- | --- |
| Members are declared flat with `target`, `syntax` and `default`; structured types with `fields`; conversions at module level; code under `implementation` | A type holds its members, fields among them, the indexer kinds and the operators; extensions hold the members a module adds to another's types; code is `impl` | Step 1 |
| Type names are lowercase, unique across the registry, and every single capital letter is a type parameter | Types are named in PascalCase, a capital letter first, identified by their module and local name, imported per type and named qualified elsewhere, Lexica's own names reserved; a type parameter is one where its declaration declares it | Step 1 |
| A cast's and a conversion's type is a local name, and the definition is of version 32 | A script names a type unqualified, where one public type has the name, or qualified by its module, and the definition is of version 33 | Step 1 |
| `node`, `element`, `document`, `documentFragment`, `shadowRoot`, `shadow`, `aria` and `window` are built-in types, recognized by a value's `nodeType`, and `lexica.bind` types bindings without a registry | No type is built in but the language's own: a module declares its reference types with their `isInstance`, recognizes its values by `typeOf`, and a registry binds | Step 2 |
| A cast takes only `node` and its kinds | A cast reaches its hierarchy and the casts modules declare | Steps 2 and 3 |
| Two modules declaring one name on overlapping receivers are refused at registration | Both register, the owner's member wins, and resolution refuses an ambiguous use | Step 4 |
| No declaration is internal | A type or a member is available within its declaring module alone where it says so | Step 5 |
| A projected item's source is recorded only for a DOM node | Every projected item records its source | Step 6 |

**Steps.** Each step lands in Lexica and DOMQL together and passes both repositories' gates:

1. **The declaration shape.** Types identified by their module and local name, with type-local `import`, qualified references, registration resolving every reference to its identity, and Lexica's own names reserved; scripts and declared bindings naming a type unqualified or qualified, and definition version 33 for a qualified cast or conversion type; types holding their members; fields in place of `fields`; `indexer` and `default-indexer` in place of `syntax` and `default`; `impl` in place of `implementation`; extension blocks; Lexica's `List`, `typeParameters: ['T']`, and the verbs as an extension on `T`; type parameters recognized by their declaration's scope; PascalCase type names, with the initial-capital rule at registration; and the declaration helpers without receivers, with `field` and indexer helpers. DOMQL's vocabulary moves to the shape, `on` one declaration in each of `Element`, `Document` and `Window`.
2. **Reference types.** `typeOf`, `isInstance` and `abstract`; `registry.bind` with declared types, its bindings captured once, and resolutions invalidated by registering; hierarchies in assignability, list supertypes, applicability, result checks and hierarchy casts; Lexica's built-in DOM types removed, and DOMQL declaring `Node`, `Element`, `Document`, `DocumentFragment`, `ShadowRoot`, `Window`, `Aria` and `Shadow`. Binding and repeated evaluation are measured with DOMQL's scale workloads before any membership answer is cached, and a cache comes with its validity defined.
3. **Operators.** Declared casts, their `impl` optional, and conversions as operators of their source types, a foreign source type's in an extension; DOMQL's cast from `Aria` to `Element`.
4. **Ownership.** Owner precedence through inheritance, internal candidates left out, extensions that compete both registering, and ambiguity refused at resolution, for members, indexers and operators.
5. **Internal declarations.** Registration's checks, including public signatures exposing public types alone; resolution's refusals through every access form; and tooling's filtering, together.
6. **Sources.** Every projected item's source, checked against reordered and duplicate references, repeated equal data, distinct data values, null inputs, empty projections and successive projections, together with DOMQL's comparer matching by identity only where both lists give a unique, non-null reference source for every item.
7. **Examples.** The specification's 28 remaining examples resolved and evaluated against a module of [the examples' vocabulary](../spec/examples-vocabulary.md), once step 2 gives their bindings a type.

**Dependencies.** Extension blocks, in step 1, precede conversions on foreign source types, in step 3; reference types, in step 2, precede the examples, in step 7; internal declarations' registration checks, resolution rules and tooling filtering arrive together, in step 5; and the general sources arrive with DOMQL's comparer, in step 6. A qualified cast or conversion type widens the values a definition's `type` takes, so it advances the definition to version 33 in step 1; PascalCase, nesting and imports alone change no definition, while the language and the runtime change incompatibly.

## Host calls

Host calls are implemented as the specification describes them: a function's declaration says who invokes it, and Lexica prepares a host call and projects the values its host supplies, knowing none of the lifecycles a host gives its calls. They changed declarations and the evaluator's API, and no definition, so the definition version stays where it was.

**What works.** A function its declaration says the host invokes, `invokedBy: 'host'`, with value parameters alone and no updates or implementation; its call resolved in the script's terminal position alone, a body there returning it after its locals and a `do` block there holding it, and refused anywhere else by a validation error; a fixed argument selecting the type of the values its host supplies through a type selector, whose keys any module declares once; `resolution.hostCall`, with a result type that is null where its host supplies none; `prepareCall`, which evaluates the locals before the call once, into the frame the prepared call keeps, and answers a skipped call where there is nothing to invoke; and each prepared call's `project`, which captures a supplied value as the declared result and evaluates the result projection against it, apart from every other prepared call of its evaluator, a call whose host supplies nothing having none. Event sources, actions, behaviors, event types and the request kinds they made are gone.

**Hosts.** A host follows host calls in a change of its own, since the request kinds and the evaluator's entry points they replace are gone.

## Packages

Lexica is released from this repository. One source and one build give the NuGet package `formaui-net.Lexica`, serving `lexica.js` and `lexica.d.ts` at `_content/lexica/`, and the npm package `@formaui/lexica`. Neither is published.

**Remaining.** Publish both; test each as a consumer installs it, the NuGet package in a published application and the npm package installed, bundled and loaded in Chromium. Needs version 32 complete.

## Beta

The beta makes the language and its module API ready for external use: no breaking redesign is planned, the remaining limitations are documented, and a breaking change after it is recorded with migration guidance.

**Done.** The documents and the module API are audited, and a cast inside an optional enclosed access is settled.

**Remaining.** `CHANGELOG.md`, empty until the first change after the beta; the version `1.0.0-beta` wherever a version is written or checked, the package numbered `1.0.0-beta.N`.

## Open decisions

No decision is open.

## Deferred

| Work | Why it waits | Reopened by |
| --- | --- | --- |
| A collection model, with ranges such as `slice`, `take` and `drop`, and conversions to and from collections | One native model for arrays, DOM collections, sets, maps and plain objects is designed first; until then a conversion from or to a list is refused at registration | A design task for collections |
| Saying which declaration a null receiver or an empty list means | A cast to a kind of node already says it for a null receiver; nothing says it for declarations on other types, which are refused as ambiguous | An extension whose declarations collide that way in real use; a declared parameter type is the leading candidate |
| Incremental reparsing, specialized tree machinery, a public tree schema shared by C# and JavaScript | No tool needs them yet | A concrete tooling need |
| Expression, predicate and function arguments to a host call | A host call's arguments are prepared as values its host keeps; an argument the evaluator evaluates as its member calls it would need an evaluation context and a lifetime designed for a host call | A host call that must call back into its script, with that context and lifetime designed |
| An extension block naming several types | A convenience: one declaration reused in each type serves the cases today | A vocabulary repeating many members across unrelated types |
| Selecting one module's operator where several compete | No syntax selects an operator by module, and a qualified call reaches none | Competing operators in real use |
| Casts of structured data, conversions between references and data, and operators beyond `cast` and `convert` | Each needs its own definition of what is checked and what is copied | A use the two operators do not serve |
| A call into a module's internal declarations through Lexica | Implementations are JavaScript and reach their own values directly | An internal-call API, with the module context it carries |
