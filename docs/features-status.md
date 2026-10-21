# Features Status

What this repository implements today, what is being built, and what remains. The [specification](../spec/README.md) is the contract and the [design](lexica-design.md) the architecture; this document tracks how far the implementation has come.

The specification describes language version `1.0.0-alpha.32`, definition version 32 and host calls. **The implementation reads definition version 31** and implements language version `1.0.0-alpha.31`, and the work to reach version 32 is under way, as [definition version 32](#definition-version-32) sets out; [host calls](#host-calls) are planned.

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
| Scripts: parameters, bindings, names, bodies and locals | Partial | The implicit parameter is still `context`, with `~` alone as a second spelling; version 32 writes `it`, and reads module names through a registry | [Scripts](../spec/scripts.md) |
| Lexical structure: tokens, names, strings, comments | Implemented | | [Lexical structure](../spec/lexical-structure.md) |
| Values: objects, the object root, lists, null, results and conversions | Implemented | | [Values](../spec/values.md) |
| Types | Partial | Reference types declared by modules; the DOM's node types are still built into Lexica, and a cast takes only `node` and its kinds | [Types](../spec/types.md) |
| Expressions: operators, conditionals, coalescing, attempts, interpolated strings | Implemented | | [Expressions](../spec/expressions.md) |
| Functions: regular and arrow functions, function values | Implemented | | [Functions](../spec/functions.md) |
| Members: forms, bracket property access, arguments | Implemented | | [Members](../spec/members.md) |
| Host calls: functions the host invokes, where they stand, the values a host supplies | Planned | Members still take the kinds `eventSource`, `action` and `behavior`, and scripts the request kinds | [Host calls](../spec/members.md#members-host-calls) |
| Definition and canonical text | Implemented, version 31 | Version 32's nodes | [Definition](../spec/definition.md), [Grammar](../spec/grammar.md) |
| Diagnostics: kinds, messages and locations | Implemented | Stable codes are [proposed](proposals/diagnostic-codes.md) | [Diagnostics and errors](../spec/diagnostics-and-errors.md) |

### Modules and vocabulary

| Area | Status | What remains | Contract |
| --- | --- | --- | --- |
| Module declarations in one shape, with their implementations | Implemented | | [Creating a module](../spec/modules.md#modules-declarations), [declaring a member](../spec/members.md#members-declaring-a-member) |
| Registries: registration checked whole, revisions | Implemented | Reading text with the registry's module names | [Registries](../spec/modules.md#modules-registries) |
| Lexica's own vocabulary: list members, verbs, conversions | Implemented | | [Lexica's own vocabulary](../spec/vocabulary.md#vocabulary-lexicas-own) |
| Predicates and observation types | Implemented | | [Vocabulary](../spec/vocabulary.md) |
| Type selectors and selectable types | Planned | Event types stand where type selectors will | [Type selectors](../spec/vocabulary.md#vocabulary-type-selectors) |
| Observation targets declared by modules | Planned | Lexica still knows `window`, `document`, `root` and `roots` by name | [Observation targets](../spec/vocabulary.md#observations-targets) |
| Namespaces and module members | Planned | Module members are registered but nothing reads them yet | [Namespaces](../spec/modules.md#namespaces) |
| Qualified access, a null receiver propagating | Planned | | [Qualified access](../spec/modules.md#namespaces-qualified-access) |
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
| Preparing a host call and projecting the values its host supplies | Planned | The evaluator prepares and projects each request kind through an entry point of its own | [Host calls](../spec/runtime.md#runtime-host-calls) |

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
| 2. The version 32 definition | Planned | Observation targets declared by modules; the `it`, `root` and `namespace` nodes; module members read through namespaces; qualified access, whose receiver argument propagates null; a registry reading text with its module names |
| 3. Reference types | Planned | Reference types, classification, declared binding types and casts within a hierarchy; the built-in node types removed; the source of every projected item; owner precedence and extension ambiguity |

**What works.** Everything version 31 defines, and the declaration shape of version 32.

**What is missing.** The definition still has version 31's shape, and Lexica still carries DOM knowledge that version 32 removes:

| Gap | Where the contract differs | Closed by |
| --- | --- | --- |
| The roots `document` and `window` are language nodes the evaluator reads from the environment | Version 32 has no such roots: a module declares what a script reads of its domain, through module members | Slice 2 |
| Observation targets `window`, `document`, `root` and `roots` are built into Lexica | A module declares its targets, and its host resolves them | Slice 2 |
| `node`, `element`, `document`, `documentFragment`, `shadowRoot`, `shadow`, `aria` and `window` are built-in types, recognized by a value's `nodeType` | No type is built in but the language's own: a module declares its reference types, each with its test | Slice 3 |
| A projected item's source is recorded only for a DOM node | Every projected item records its source | Slice 3 |
| Two modules declaring one name on overlapping receivers are refused at registration | Both register, and resolution refuses an ambiguous use | Slice 3 |
| The implementation's own names are version 31's: the syntax tree's root is `source`, its tokens include `caller-binding` and `context`, and its messages say "the caller's binding" | Version 32 names a script, its root `script`, a parameter reference and a script parameter | Slice 2 |

**Dependencies.** Owner precedence waits for slice 3, because a module owns a type only once it declares it as a reference type. A version 32 implementation reads version 32 alone, so the switch from version 31 is one change, which every host follows in the change after it.

**Next steps.**

1. Decide the order of slice 2: observation targets first, at version 31, since they change module contents and not definitions; then the version 32 switch as one change.
2. Build observation targets, declared by modules and resolved by their hosts.
3. Build the version 32 switch: the new nodes, namespaces, qualified access with its null rule, and a registry reading text with its module names; test each qualified form against its receiver form.
4. Build slice 3, the source of every projected item checked against duplicate references, repeated equal data values, null inputs and reordered items.
5. Resolve and evaluate the specification's examples against a module of [the examples' vocabulary](../spec/examples-vocabulary.md); today they are only parsed and formatted.

## Host calls

The specification describes host calls: a function's declaration says who invokes it, and Lexica prepares a host call and projects the values its host supplies, knowing none of the lifecycles a host gives its calls. It changes declarations and the evaluator's API, and no definition, so the definition version stays where it is.

**What is missing.** The implementation still has the member kinds and request kinds host calls replace:

| Gap | Where the contract differs |
| --- | --- |
| Members of the kinds `eventSource`, `action` and `behavior`, each with field rules of its own | A `function` whose declaration says `invokedBy: 'host'`, with no `updates` and no implementation |
| `eventTypes`, the type `event<T>`, and a parameter that selects an event type | Type selectors and their selectable types, a parameter that selects a type through a selector, and `@selected` as a result |
| `resolution.kind`, with the request kinds `value`, `subscription`, `action` and `behavior` | `resolution.hostCall`, null for a script that gives a value |
| The evaluator's `resolveSource`, `resolveAction`, `resolveBehavior`, `projectResult` and `project(event)`, which answer null for a null receiver | `prepareCall()`, whose `skipped` preparation says there is nothing to invoke, and `project(value)` |
| The implementation inputs `deliver`, `signal` and `reportError` | A host call has no implementation Lexica calls |
| Actions and behaviors take expression and predicate parameters | A host call takes value parameters alone |
| A body's result must be a value | A script's body may return a host call, its locals before it |
| A behavior declares a `result` nothing reads | A host call that supplies nothing declares no result, and takes no result projection |

**Dependencies.** Independent of the version 32 slices. Every host follows it in the change that lands it, since the request kinds and the evaluator's entry points it replaces go with it, and the README's list of features moves with it.

**Next steps.**

1. Build `invokedBy` and the host call's place: its declaration's fields, its refusal anywhere but at a script's end, a body returning one, and `resolution.hostCall`.
2. Build type selectors and selectable types: a selector named once, a key once in its selector and never replaced, a key of an unregistered selector refused, at most one parameter selecting a type, the revision advancing with every key registered, and the refusal of a key no selector maps; test each refusal's module error.
3. Build `prepareCall` and `project`, and remove the request kinds, the entry points and the implementation inputs they replace; test each refusal, a skipped preparation and a value of the wrong type.

## Packages

Lexica is released from this repository. One source and one build give the NuGet package `formaui-net.Lexica`, serving `lexica.js` and `lexica.d.ts` at `_content/lexica/`, and the npm package `@formaui/lexica`. Neither is published.

**Remaining.** Publish both; test each as a consumer installs it, the NuGet package in a published application and the npm package installed, bundled and loaded in Chromium. Needs version 32 complete.

## Beta

The beta makes the language and its module API ready for external use: no breaking redesign is planned, the remaining limitations are documented, and a breaking change after it is recorded with migration guidance.

**Done.** The documents and the module API are audited, and a cast inside an optional enclosed access is settled.

**Remaining.** `CHANGELOG.md`, empty until the first change after the beta; the version `1.0.0-beta` wherever a version is written or checked, the package numbered `1.0.0-beta.N`.

## Open decisions

| Decision | State |
| --- | --- |
| The order of slice 2 | Proposed: observation targets at version 31 first, then the version 32 switch as one change. Awaiting the maintainer. |
| How a type annotation is spelled | Open until annotations are designed: whether `name: type = value` writes the type bare while `as` and `to` quote theirs, or every form writes it alike. |

## Deferred

| Work | Why it waits | Reopened by |
| --- | --- | --- |
| A collection model, with ranges such as `slice`, `take` and `drop`, and conversions to and from collections | One native model for arrays, DOM collections, sets, maps and plain objects is designed first; until then a conversion from or to a list is refused at registration | A design task for collections |
| Saying which declaration a null receiver or an empty list means | A cast to a kind of node already says it for a null receiver; nothing says it for declarations on other types, which are refused as ambiguous | An extension whose declarations collide that way in real use; a declared parameter type is the leading candidate |
| Incremental reparsing, specialized tree machinery, a public tree schema shared by C# and JavaScript | No tool needs them yet | A concrete tooling need |
| Expression, predicate and function arguments to a host call | A host call's arguments are prepared as values its host keeps; an argument the evaluator evaluates as its member calls it would need an evaluation context and a lifetime designed for a host call | A host call that must call back into its script, with that context and lifetime designed |
