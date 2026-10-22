# Features Status

## Current state

**The core language, host calls and definition version 33 are implemented. The next task is the rest of the new type and member declaration model.** Reference types, general casts and conversions, ownership, internal declarations, and general projection sources follow it.

| Version | Implementation | Specification |
| --- | --- | --- |
| Language | `1.0.0-alpha.33` | `1.0.0-alpha.34` |
| Definition format | 33 | 34 |

The implementation reads definition version 33, the language's indexers, computed properties and qualified type names, its types' names in PascalCase, and each type identified by its module, but still uses flat member declarations, implicit type parameters and built-in DOM types. Until the declaration model replaces them, an internal bridge reads a named indexer as a flat member of indexer syntax and an unnamed one as a flat default indexer. Removing the built-in DOM types follows in step 2.

The bundle and type declarations are built. npm and NuGet packages are packed locally but unpublished. Six specification examples resolve and evaluate; 28 remain.

**Next:** [Step 1 — Type and member declarations](#next-type-and-member-declarations). No open design decision is recorded as blocking this work. Diagnostic codes remain a separate, unaccepted proposal.

The [specification](../spec/README.md) defines the contract; the [design](lexica-design.md) explains the architecture. This file tracks implementation and the remaining work. “Implemented” means built and tested in the gate for the current implementation version; it does not imply that later specification changes are implemented.

## Next: type and member declarations

**Step 1 — In progress.** Replace the current declaration model and advance the definition format to 33. This is the first step of the types and members work, formerly called the third slice of the version 32 plan.

It lands in four parts. Each part is a checkpoint: Lexica's change and DOMQL's matching migration are prepared together, both gates run, and then each repository commits, DOMQL's status naming the Lexica commit it requires.

| Part | Work | State |
| --- | --- | --- |
| 1 | Parser and definition format: [indexers and computed properties](#indexers-and-computed-properties) and qualified type names in casts and conversions, in [definition version 33](#definition-version-33) | Implemented |
| 2 | [Type identity and names](#type-identity-and-names), so extension targets resolve before declarations move: names in PascalCase first, then identity, imports and qualified references, with [script imports](../spec/scripts.md#scripts-imports) in definition version 34 | In progress: names in PascalCase and type identity implemented |
| 3 | [Declaration structure](#declaration-structure) and registration | Planned |
| 4 | Built-in declarations and integration: `List<T>` and its unnamed indexer, and the verbs as an extension on any type, `<T>` | Planned; joins part 3 where part 3 alone cannot leave a working runtime |

### Type identity and names

- **Implemented:** type names in PascalCase, Lexica's own and the built-in DOM types' among them, `Number`, `List<T>` and `Element`, and a module's type checked for its initial capital when the module is created. Lexica's own names are reserved, and the built-in DOM types' are not, since a module's `Element` is its own.
- **Implemented:** a type identified by its module and local name, so different modules declare the same local name; a structured type's `import` and qualified type references, every reference resolved to its identity at registration; and an argument's diagnostic writing the type it expects and the one it finds by their qualified names where they share a local name. Until script imports, a script's type names resolve across the registry, unqualified where one type has the name.
- **Revised model:** four accepted proposals, specified in language `1.0.0-alpha.34` and definition 34 and not implemented, replace the decision to remove generics: [named extension types](proposals/named-extension-types.md) declare extensions as named types in a module's `types`; [contract generics](proposals/contract-generics.md) keep type parameters in declaration contracts alone; [`Any` and deferred selection](proposals/any-and-deferred-selection.md) handle values whose type is known only during evaluation; and [explicit extension access](proposals/extension-access.md) selects an extension's member with `:` and `?:`. The implementation plan is revised next, before script imports and parts 3 and 4 are implemented, since the revised model changes them.
- **Temporary limitation:** until generics are removed, the implementation reads every single capital letter in a declaration's types, as `T`, as an implicit type parameter, and refuses a type named by one letter. The final rule differs: `T` may be an ordinary declared type, and a name that resolves to no type is an unknown type, whatever its length, never a parameter.
- Read a script's [imports](../spec/scripts.md#scripts-imports), written or supplied by its host, and record them in definition version 34; resolve a script's namespaces, members and type names among the modules it imports.
- Let a script name a type unqualified where exactly one public type of its imports has that name, or qualified by its module. Resolve declared binding types against the registry, unqualified or qualified; registry-aware binding itself arrives in step 2.

### Declaration structure

| Current implementation | Replacement |
| --- | --- |
| Flat members with `target` | Members within their declaring type; extension blocks for members added to other types |
| Structured types with `fields` | [Stored properties](../spec/modules.md#modules-declaring-a-type) among a type's members, properties declared without `updates` |
| `syntax` and `default` | The `indexer` kind, with a `name` for a named indexer and without one for a type's unnamed indexer |
| `implementation` | `impl` |
| Declaration helpers with receivers | Helpers without receivers, plus stored property and indexer helpers |

Declare Lexica's generic `List<T>`, with its unnamed indexer in place of `item`, and the verbs as an extension on `T`. Establish the type and extension structure for operators; their behavior is implemented in step 3. The bridge from indexers to flat declarations goes with the flat declarations.

### Indexers and computed properties

**Implemented.** A named indexer is written `x.name[k]`, a type's unnamed indexer `x[k]`, and a property by a computed name `x.[p]`, each optional as `x?.name[k]`, `x?[k]` and `x?.[p]`. Resolution reads `x.name[k]` as the named indexer wherever the receiver's type declares one, a key it refuses being its own error, and reads the property and indexes its answer only where none is declared. The colon forms are refused with the form to write.

### Definition version 33

**Implemented.** Casts and conversions name a type qualified by its module, as `to home.Climate`, and an indexer is recorded without a `name`, a named indexer's target being the `member` node of its name. A qualified name resolves to the type its registered module declares; identifying every type by its module follows in part 2.

PascalCase names, nested declarations, and a type's `import` alone do not change the definition format; a script's imports do, in version 34. The declaration redesign still makes incompatible changes to the language and runtime API.

**Completion:** the declaration changes and definition version 33 pass the gate. A host follows with its corresponding migration.

Contracts: [Types](../spec/types.md), [declaring a type](../spec/modules.md#modules-declaring-a-type), [writing a member](../spec/members.md#property-access-calls-and-indexers), [declaring a member](../spec/members.md#members-declaring-a-member), [Definition](../spec/definition.md), [Grammar](../spec/grammar.md).

## Remaining implementation sequence

All steps below are **planned, not started**. Each step passes the gate, and a host follows each applicable change in a separate migration. This file tracks Lexica; it does not establish whether those host migrations are complete.

| Step | Work | Outcome |
| --- | --- | --- |
| 2 | Reference types and bindings | Modules recognize and check their own reference types; Lexica's built-in DOM types are removed |
| 3 | Cast and conversion operators | Modules declare casts and conversions on source types or in extensions |
| 4 | Ownership and ambiguity | Owner members take precedence; competing extensions can register, with ambiguous uses refused at resolution |
| 5 | Internal declarations | Visibility is enforced across registration, resolution, and tooling |
| 6 | Projection sources | Every projected item records its source |
| 7 | Specification examples | The remaining 28 examples resolve and evaluate |

### Step 2 — Reference types and bindings

Implement `typeOf`, `isInstance`, and `abstract`, plus `registry.bind` with declared types. Capture bindings once and invalidate resolutions when registration changes.

Apply type hierarchies to assignability, list supertypes, member applicability, result checks, and hierarchy casts. The current implementation only allows casts to `node` and its kinds; declared casts follow in step 3.

Remove the built-in domain types: `node`, `element`, `document`, `documentFragment`, `shadowRoot`, `shadow`, `aria`, and `window`. Replace Lexica's built-in recognition through `nodeType` and its registry-independent `lexica.bind` typing with module declarations and registry-aware binding. Only the language's own types remain built in; hosts declare their domain types.

Measure binding and repeated evaluation at scale before caching membership answers. Any cache must have defined validity rules.

Contracts: [Reference types](../spec/types.md#reference-types), [bindings](../spec/runtime.md#runtime-bindings).

### Step 3 — Cast and conversion operators

Implement declared casts with optional `impl`. Move conversions from module-level declarations to operators of their source types. Declare conversions for a foreign source type in an extension block, using the structure introduced in step 1.

Contract: [Operators](../spec/modules.md#modules-operators).

### Step 4 — Ownership and ambiguity

Implement owner precedence through inheritance for members, indexers, and operators. Exclude internal candidates from access outside their module; full visibility enforcement arrives in step 5.

Allow competing extensions to register. Refuse ambiguous uses at resolution, replacing the current registration-time refusal of matching names on overlapping receivers.

Contract: [Owners and extensions](../spec/modules.md#namespaces-owners-and-extensions).

### Step 5 — Internal declarations

Deliver visibility enforcement together across:

- Registration, including the rule that public signatures expose only public types.
- Resolution, rejecting inaccessible declarations through every access form.
- Tooling, filtering declarations that are not accessible.

Contract: [Internal declarations](../spec/modules.md#modules-internal-declarations).

### Step 6 — Projection sources

Record the source of every projected item. Currently, source metadata is recorded only for DOM nodes.

Check reordered and duplicate references, repeated equal data, distinct data values, null inputs, empty projections, and successive projections. Hosts that compare results follow this change in their own migration.

Contract: [Results and their metadata](../spec/runtime.md#runtime-results).

### Step 7 — Specification examples

Resolve and evaluate the remaining 28 specification examples against a module implementing [the examples' vocabulary](../spec/examples-vocabulary.md). Six examples already work. Step 2 supplies the binding types required by the remaining examples; their other features are covered by the preceding steps.

## Release work

Complete the types and members work before publishing packages. This replaces the old release prerequisite described as “version 32 complete”: the remaining work now includes the transition to definition version 33.

### Packages

**Current:** one source and build produce both packages locally; neither is published. Both carry the runtime version declared by `src/language/Versions.mjs`.

| Package | Contents or delivery |
| --- | --- |
| npm: `@formaui/lexica` | JavaScript bundle and type declarations |
| NuGet: `formaui-net.Lexica` | `lexica.js` and `lexica.d.ts` served at `_content/lexica/` |

**Remaining:** publish both and test them as consumers install them: NuGet in a published application, and npm installed, bundled, and loaded in Chromium.

### Beta

**Current:** the documents and module API have been audited. The behavior of a cast inside an optional enclosed access is settled.

**Remaining:**

- Add `CHANGELOG.md`, empty until the first change after the beta.
- Set the beta version to `1.0.0-beta` wherever the beta version is written or checked; number packages `1.0.0-beta.N`.

Beta means no breaking redesign is planned and remaining limitations are documented. Breaking changes after beta require migration guidance.

## Tooling backlog

This work is separate from the implementation sequence above. No order is assigned here.

| Work | Status | Remaining |
| --- | --- | --- |
| Syntax tree for tooling | Partial | The lossless tree and tolerant tokenizer are built and internal; error recovery and a public tooling API remain |
| Formatting that preserves source form | Planned | Tokens retain each string's form; the formatting operation is not built |
| Editor tooling | Planned | Diagnostics and completion through the syntax tree, without running a capability |
| Diagnostic codes | Proposed, not accepted | Resolve the questions in the proposal before implementation |

References: [Syntax tree](lexica-design.md#the-syntax-tree), [tooling](lexica-design.md#tooling), [diagnostic-codes proposal](proposals/diagnostic-codes.md).

## Implemented capabilities

These capabilities work in the current implementation. The planned replacements and remaining limitations are described above.

| Area | Implemented | Contract |
| --- | --- | --- |
| Scripts | Parameters, bindings, names, bodies, and locals | [Scripts](../spec/scripts.md) |
| Lexical structure | Tokens, names, strings, and comments | [Lexical structure](../spec/lexical-structure.md) |
| Values | Objects, the object root, lists, null, results, and existing conversions | [Values](../spec/values.md) |
| Expressions | Operators, conditionals, coalescing, attempts, and interpolated strings | [Expressions](../spec/expressions.md) |
| Functions | Regular and arrow functions, function values, references, and implicit bodies | [Functions](../spec/functions.md) |
| Member access | Member forms, bracket property access, and arguments | [Members](../spec/members.md) |
| Module registration | Unified declarations with implementations; whole-registration checks, revisions, and module-local collision checks | [Declarations](../spec/modules.md#modules-declarations), [registries](../spec/modules.md#modules-registries), [collisions](../spec/modules.md#namespaces-a-modules-own-collisions) |
| Vocabulary | List members, verbs, existing conversions, and Boolean functions | [Lexica's vocabulary](../spec/vocabulary.md#vocabulary-lexicas-own), [Boolean functions](../spec/vocabulary.md#vocabulary-boolean-functions) |
| Observations | Observation types and module-declared observation targets | [Observations](../spec/vocabulary.md#observations), [targets](../spec/vocabulary.md#observations-targets) |
| Type selection | Type selectors and selectable types | [Type selectors](../spec/vocabulary.md#vocabulary-type-selectors) |
| Namespaces | Module members, qualified access, and null propagation | [Namespaces](../spec/modules.md#namespaces), [qualified access](../spec/modules.md#namespaces-qualified-access) |
| Text and definitions | Parse, validate, format, quote, and locate; canonical text for definition version 33 | [Definition](../spec/definition.md) |
| Runtime | Bindings, resolution, reuse by resolution key, evaluation with host hooks, and frozen results | [Bindings](../spec/runtime.md#runtime-bindings), [evaluation](../spec/runtime.md#runtime-evaluation), [results](../spec/runtime.md#runtime-results) |
| Diagnostics | Error kinds, messages, and locations | [Diagnostics](../spec/diagnostics-and-errors.md) |
| Build | Bundle and type declarations | [Build](../README.md#build) |

### Definition version 32

The first two slices of the original version 32 plan are complete. The unfinished third slice is now the [types and members sequence](#next-type-and-member-declarations), which starts by advancing the definition to 33.

Completed declaration work established one shape with valid combinations for each kind. Implementations are carried in declarations and receive one object. Creating an evaluator is refused when its resolution uses a declaration or conversion without an implementation, where one is required.

Completed definition and resolution work includes:

- `it`, `root`, and `namespace` nodes; version 31 definitions are refused.
- Registry parsing, formatting, and quoting with its module names; definitions read without those names are refused.
- Qualified forms and function references. A null receiver argument skips the member and its arguments, including when a reference is held, passed, or chosen.
- Verbs taking a test and Boolean functions replacing predicates.
- Implicit bodies recognized by their own `it`; expression and predicate arguments accepting arrows, functions held by names, or function references under their own result policy.
- Cast and conversion types written bare. Qualified type names remain part of step 1.

### Host calls

**Implemented.** Lexica prepares calls and projects host-supplied values; the host owns their lifecycle.

- `invokedBy: 'host'` declarations accept value parameters only, with no updates or implementation.
- Calls are allowed only in terminal position, including a body returning the call after locals or a terminal `do` block. Other positions are refused at resolution with a validation error.
- A fixed argument can select the result type through a type selector. Modules may add keys to an existing type selector, but registration rejects a key already declared in that selector.
- `resolution.hostCall` describes the call, with a null result type when the host supplies no result.
- `prepareCall` evaluates preceding locals once and retains their frame in the prepared call. It reports a skipped call when there is nothing to invoke.
- Each prepared call's `project` captures a supplied value as the declared result and evaluates its projection independently of other preparations from the same evaluator. Calls that supply no result have no projection.

Event sources, actions, behaviors, event types, and their request kinds have been removed. Hosts must migrate from the replaced request kinds and evaluator entry points. These changes affected declarations and evaluator APIs, not the definition format.

Contracts: [Host-call declarations](../spec/members.md#members-host-calls), [host-call runtime](../spec/runtime.md#runtime-host-calls).

## Open decisions

No open decision is recorded for the types and members implementation sequence. The [diagnostic-codes proposal](proposals/diagnostic-codes.md) remains unaccepted and has open questions. Deferred items below require their stated trigger before design or implementation resumes.

## Deferred

| Work | Why it waits | Reopened by |
| --- | --- | --- |
| Collection model, including `slice`, `take`, `drop`, and collection conversions | Arrays, DOM collections, sets, maps, and plain objects need one native model first. Conversions from or to a list are currently refused at registration. | A collection-model design task |
| Selecting a declaration for a null receiver or empty list | A node cast currently disambiguates a null receiver; other ambiguous declarations are refused. | A real extension collision; a declared parameter type is the leading candidate |
| Qualified extension indexers | No current use requires them. See [indexer selection](../spec/modules.md#namespaces-indexers). | A concrete use |
| Incremental reparsing, specialized tree machinery, and a public tree schema shared by C# and JavaScript | No tool needs them yet. | A concrete tooling need |
| Expression, predicate, and function arguments to host calls | Prepared arguments are values retained by the host; callbacks need an evaluation context and lifetime. | A host call that must call back into its script, with that context and lifetime designed |
| An extension block targeting several types | Reusing a declaration for each type serves current cases. | Many repeated members across unrelated types |
| Selecting a module's operator when several compete | No syntax selects an operator by module; qualified calls cannot reach operators. | Competing operators in real use |
| Structured-data casts, reference/data conversions, and operators beyond `cast` and `convert` | Each needs rules for checking and copying. | A use the two operators do not serve |
| Calling a module's internal declarations through Lexica | JavaScript implementations can reach their own values directly. | An internal-call API with a defined module context |
