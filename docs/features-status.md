# Features Status

What this repository implements today, what is being built, and what remains. The [specification](../spec/README.md) is the contract and the [design](lexica-design.md) the architecture; this document tracks how far the implementation has come.

The specification describes language version `1.0.0-alpha.32` and definition version 32. **The implementation reads definition version 32** and implements language version `1.0.0-alpha.32`, save for the reference types of its third slice, as [definition version 32](#definition-version-32) sets out; [host calls](#host-calls) are implemented.

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
| Types | Partial | Reference types declared by modules; the DOM's node types are still built into Lexica, and a cast takes only `node` and its kinds | [Types](../spec/types.md) |
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
| Owner precedence and extension ambiguity | Planned | Two modules declaring one name on overlapping receivers are refused at registration until it lands | [Owners and extensions](../spec/modules.md#namespaces-owners-and-extensions) |
| Reference types, classification and declared binding types | Planned | | [Reference types](../spec/types.md#reference-types) |
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
| 3. Reference types | Planned | Reference types, classification, declared binding types and casts within a hierarchy; the built-in node types removed; the source of every projected item; owner precedence and extension ambiguity |

**What works.** The declaration shape and the version 32 definition: its `it`, `root` and `namespace` nodes, a version 31 definition refused; a registry parsing, formatting and quoting text with its module names, and refusing a definition read without them; module members, qualified forms and function references, a null receiver argument skipping the member and its own arguments wherever a reference is held, passed or chosen; the verbs given a test, an implicit body recognized by its own `it` among its forms, and Boolean functions in place of predicates; an expression or a predicate argument given an arrow function, a function a name holds or a function reference, under its own result policy; a cast's and a conversion's type written bare; and the observation targets modules declare. Six of the specification's examples resolve and evaluate.

**What is missing.** Lexica still carries DOM knowledge that slice 3 removes:

| Gap | Where the contract differs | Closed by |
| --- | --- | --- |
| `node`, `element`, `document`, `documentFragment`, `shadowRoot`, `shadow`, `aria` and `window` are built-in types, recognized by a value's `nodeType` | No type is built in but the language's own: a module declares its reference types, each with its test | Slice 3 |
| A projected item's source is recorded only for a DOM node | Every projected item records its source | Slice 3 |
| Two modules declaring one name on overlapping receivers are refused at registration | Both register, and resolution refuses an ambiguous use | Slice 3 |

**Dependencies.** Owner precedence waits for slice 3, because a module owns a type only once it declares it as a reference type. The implementation reads version 32 alone, so the switch from version 31 was one change, which every host follows in a change of its own.

**Next steps.**

1. Build slice 3, the source of every projected item checked against duplicate references, repeated equal data values, null inputs and reordered items.
2. Resolve and evaluate the specification's other 28 examples against a module of [the examples' vocabulary](../spec/examples-vocabulary.md), which read the home's rooms, devices, lights, thermostats or sensors and are parsed and formatted until reference types and declared binding types give their bindings a type.

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
