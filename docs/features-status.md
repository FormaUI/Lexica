# Features Status

## Current state

**The core language, host calls, definition version 33 and the diagnostic codes are implemented. [Unit 0](#unit-0--decisions-and-the-specification) of the [implementation plan](#implementation-plan) is done; the next work is [unit 1](#unit-1--declarations-and-the-type-model), the declarations and the type model.**

| Version | Implementation | Specification |
| --- | --- | --- |
| Language | `1.0.0-alpha.33` | `1.0.0-alpha.34` |
| Definition format | 33 | 34 |

The implementation reads definition version 33, the language's indexers, computed properties and qualified type names, its types' names in PascalCase, and each type identified by its module. It still uses flat member declarations, module-level conversions, implicit type parameters, which read every single capital letter as one and refuse a type named by one letter, and built-in DOM types; an internal bridge reads a named indexer as a flat member of indexer syntax and an unnamed one as a flat default indexer. The specification describes their replacement, which the plan's units deliver.

The bundle and type declarations are built. npm and NuGet packages are packed locally but unpublished. Six specification examples resolve and evaluate; 28 remain.

The [specification](../spec/README.md) defines the contract; the [design](lexica-design.md) explains the architecture. This file tracks implementation and the remaining work. "Implemented" means built and tested in the gate for the current implementation version; it does not imply that later specification changes are implemented.

## Implementation plan

The remaining work is grouped by the code it rewrites, so each mechanism is rewritten once: the declaration model and the registry, the type relation, the member selector, argument binding, the text pipeline, and the evaluator's member selection. The units are ordered by what each needs from the one before it.

- **A stage is a commit.** Each stage passes the gate, and moves each aspect once: a declaration, a test or a document takes its final form the first time the aspect changes, never an intermediate one a later stage replaces.
- **Breaking changes are made directly,** without compatibility layers, migration notes or deprecations, until the beta.
- **Three host migration checkpoints.** A host building on Lexica builds against a pinned commit, and migrates its declarations and its runtime use once at the end of unit 2, its scripts once at the end of unit 3, and its handling of collections in results once at the end of unit 4. The release then changes how it consumes Lexica, through the published packages.
- **Documents move with their stage.** The README, the [embedding guide](embedding-guide.md), the type declarations and this file change in the stage that changes what they describe.
- **Every diagnostic has its code.** Unit 0's third stage gives a [code](proposals/diagnostic-codes.md) to every existing condition, and every later stage gives each condition it introduces its code at once; the tests of each condition assert its code, never only its message.

| Unit | Work | State |
| --- | --- | --- |
| 0 | [Decisions and the specification](#unit-0--decisions-and-the-specification) | ✅ Done |
| 1 | [Declarations and the type model](#unit-1--declarations-and-the-type-model) | Planned |
| 2 | [Member selection and deferred evaluation](#unit-2--member-selection-and-deferred-evaluation) | Planned |
| 3 | [Script text, imports and definition version 34](#unit-3--script-text-imports-and-definition-version-34) | Planned |
| 4 | [Collections](#unit-4--collections) | Accepted in part; the lineage contract first |
| 5 | [Specification examples](#unit-5--specification-examples) | Planned |
| 6 | [Tooling](#unit-6--tooling) | Planned |
| 7 | [Release](#unit-7--release) | Planned |

### Unit 0 — Decisions and the specification

Unit 0 lands in three stages: the specification takes the seven decisions below ✅, then the diagnostics catalog ✅, and then the implementation codes every existing condition and wraps a hook's or an implementation's failure as decision 6 sets out ✅.

1. ✅ **Competing conversions register.** *Specified; [unit 2](#unit-2--member-selection-and-deferred-evaluation) implements it.* The rule of one conversion per source and destination across the registry, in [Lexica's conversions](../spec/vocabulary.md#vocabulary-conversions), is removed. Conversions compete as [operators](../spec/modules.md#modules-operators) do, among the operators a script's imports make available: an applicable owner's operator wins, otherwise one extension's resolves, and several are ambiguous where a script uses them. A module's own operators still collide under its collision rules, and a module still owns a conversion's source or its destination. A qualified destination identifies a type, never an operator, and an extension access reaches none.
2. ✅ **Mappings.** *Specified; [unit 1](#unit-1--declarations-and-the-type-model) implements it.* A module's `selectableTypes` become its `mappings`, each `{ selector, key, type }`, its `name` renamed `key`, and a key maps to a named structured type whose properties are stored, as `Home`'s `motion` maps to `Motion`. A key is unique within its selector across the registered modules, its selector and key together its identity, and different selectors may share a key. "Mapping" replaces "selectable type" throughout the specification, the declarations, the helpers, the diagnostics and the tests, and the examples' vocabulary names its payload types. A declaration contract gains no object-type notation.
3. ✅ **Diagnostic codes are accepted,** *catalog specified, and implemented in stage 3,* as [their proposal](proposals/diagnostic-codes.md) settles them. The second stage gives the specification's diagnostics document the catalog and the contract: a code for each condition it sets out, and each error table naming the code of each row. The third stage gives `LexicaError` its `code` and every condition the implementation reports today its code, in one pass, before unit 1, and the tests assert each condition's code. A condition only language `1.0.0-alpha.33` has takes an unused code of its kind's range, listed under [temporary implementation coverage](#temporary-implementation-coverage) with its condition and its kind and kept out of the specification, and the unit that removes the condition retires its code to the specification's ledger; no code is reused.
4. ✅ **A projection source says what it is.** *Specified; [unit 1](#unit-1--declarations-and-the-type-model) implements it.* Each source records whether it is a reference or data, by its established type, a value carried through `Any` included; null is a recorded source that is neither, distinct from absent source metadata. Sources stay aligned with the projected items, the metadata's containers are frozen, and a referenced host object is kept as it is, never frozen through. Lexica reports each source's classification and identity, and a host decides how to match by them. The metadata's representation is specified here, so unit 1 implements one defined contract.
5. ✅ **Line structure,** *specified, which [unit 3](#unit-3--script-text-imports-and-definition-version-34) implements,* as [its proposal](proposals/line-structure.md) sets out: line structure constrains which layouts are valid and never changes a reading. A line break is LF, CRLF or a lone CR, U+2028 and U+2029 are refused outside literal string text, and every position between two tokens is inside a one-line construct, at a break point or at a boundary. A line breaks before a binary operator only where parentheses, brackets or a condition enclose its expression, and never after one; a chain breaks before each step; a conditional, a `do` block and a function expression stand on one line or in block form; and each import, and each local and `return` of a body that uses `return`, starts a line of its own.
6. ✅ **A hook's or an implementation's failure is Lexica's error, what it threw its cause.** *Specified, and implemented in stage 3.* A throwing hook, and an implementation failing unexpectedly, fail the evaluation with an evaluation error of Lexica's own, its code, kind, message and the failing invocation's location, whose `cause` is exactly what the hook threw, unchanged, any code on it kept and never copied into Lexica's; an error Lexica has raised is never wrapped again as it propagates, as [a hook that throws](../spec/runtime.md#runtime-evaluation) sets out; a rejection a contract defines keeps its specified handling.
7. ✅ **Two gaps in the text's specification close.** *Specified; [unit 3](#unit-3--script-text-imports-and-definition-version-34) implements them.* `import` joins [the grammar](../spec/grammar.md)'s keywords, as [lexical structure](../spec/lexical-structure.md) already reserves it, and [the definition](../spec/definition.md#definition) sets how `quote` writes a definition's imports on one line.

**Completion:** the specification, its proposals and this file state each decision, the catalog codes every condition the specification sets out, every diagnostic the implementation reports carries its code, and the gate passes.

### Unit 1 — Declarations and the type model

Every declaration takes its final shape, and the types those declarations make relate as the specification sets out. Resolution keeps selecting members as it does today, through registry queries whose answers the new declarations give; unit 2 replaces the selection itself.

1. **Registry queries.** The resolver, the evaluator, result paths and the entry point read declarations only through registry queries, never a declaration's `target`, `syntax` or `fields` directly, so the declarations' storage can change behind them. Nothing a script sees changes.
2. **One type relation.** A registry-aware checker replaces the static assignability, merging, comparability and node checks of `Type`, and the resolver's receiver matching, at every call site. It brings `Any`, distinct from a result left out, and the rules of `null` and `Never`, and takes a generic value type by its declaration, never `List` by name, so [collections](proposals/collections.md)' `Dictionary` and `Pair` join it in unit 4 without replacing it; neither is public before then.
3. **Reference types and binding,** in the current flat member shape:
   - `typeOf`, `isInstance`, `abstract` and `supertype`, a hierarchy refused where it cycles; the hierarchy in assignability, list covariance, merging to the nearest shared supertype, and identity equality of references.
   - `registry.bind`, recognizing values by every module's `typeOf`, with declared binding types resolved against the registry, a binding set captured once and belonging to its registry, and a cycle refused with its own error. Binding and repeated evaluation are measured at scale before any membership answer is cached, and any cache has defined validity rules.
   - Hierarchy casts, checked by the destination's `isInstance`; results and captures checked by `isInstance` and supertypes; a failed cast naming the recognized type.
   - Projection sources for every projected item, in the representation unit 0 specifies, replacing the sources recorded for elements alone.
   - The resolution key written by qualified identity, so two modules' `Device` no longer share one.
   - Removed: the built-in DOM types and every `nodeType` path, in binding, evaluation, captures, casts and messages, and `lexica.bind`.
4. **The declaration model:**
   - A module's name in PascalCase, Lexica's own module named `Lexica`, and a module refused under `Lexica`, a reserved word, or one of Lexica's own types' or extensions' names.
   - Type kinds, members within their types, stored properties in place of `fields`, the `indexer` kind, named or unnamed, in place of the indexer bridge, and `impl` in place of `implementation`.
   - Named extension types, each with one target, in place of the `'any'` target and lists of targets; a module member refused under one of its module's extensions' names, and reserving its name against members of its module's own types alone.
   - Declared type parameters, their scopes and their registration checks, in place of the implicit single capitals, which lifts the refusal of a type named by one letter.
   - `internal`, and the registration checks that no declaration names another module's internal one and no public one exposes an internal type.
   - A type's `import` covering its whole declaration; an error located at the type a nested declaration stands in; observation types named in camelCase; the mappings unit 0 specifies.
   - The declaration helpers without receivers, with stored property and indexer helpers.
   - Lexica's own `List<T>`, with its unnamed indexer in place of `item`, and `VerbExtensions<T>`.
   - Removed: flat members, `target`, `syntax`, `default`, `fields`, `selectableTypes`, the migration hints for `predicates`, and the duplicate tolerance and identifier checks.
5. **Inference of type parameters:** a receiver binding its extension's parameters by its non-null branch, with exact extraction; value arguments binding before callbacks; nullable candidates combining and different candidates refused; the evidence of `null` and `Never`; and a callback's result binding a parameter, without chaining.

Module-level conversions, and the registration's refusal of members of one name on overlapping receivers across modules, stay as they are until unit 2 replaces them.

**Completion:** every declaration in Lexica, its tests and its documents is in the final shape, every value a host binds is typed by the registry, and the gate passes.

Contracts: [Types](../spec/types.md), [Modules](../spec/modules.md), [declaring a member](../spec/members.md#members-declaring-a-member), [Lexica's vocabulary](../spec/vocabulary.md), [bindings](../spec/runtime.md#runtime-bindings), [results](../spec/runtime.md#runtime-results).

### Unit 2 — Member selection and deferred evaluation

One selector chooses every member, indexer and operator, at resolution and during evaluation alike.

1. **The selector** replaces the three selection paths and the path for receivers of unknown type: owner precedence through inheritance; competing extensions registering, in place of the registration's refusal; ambiguity refused at resolution, giving the extension accesses to write; internal declarations excluded at resolution; and an empty list or a null receiver selecting as [the types](../spec/types.md) set out.
2. **Operators:** casts and conversions declared on types and in extensions, in place of module-level conversions; Lexica's own conversions moved onto its types; declared casts, an `impl` optional, `reject` making an attempt null; and operators chosen by the selector.
3. **`Any` and deferred selection:** a member selected when its receiver is evaluated, through the same selector; the selection cached by node and actual type within one registry, plain objects read by their own fields; identity kept through `Any`; a selection that would be a host call refused before anything is invoked; `beforeInvoke` told the selection was deferred; an `Any` argument checked against its parameter; and a deferred access failing with the access and the actual type named.
4. **Reporting:** used declarations including operators, in place of the separate used conversions; deferred accesses; and candidate declarations, reported as an overestimate.

**Completion:** the gate passes, and a host can move its declarations and its runtime use in one migration.

Contracts: [Owners and extensions](../spec/modules.md#namespaces-owners-and-extensions), [operators](../spec/modules.md#modules-operators), [internal declarations](../spec/modules.md#modules-internal-declarations), [values of `Any`](../spec/types.md#types-any), [resolution](../spec/runtime.md#runtime-bindings-and-resolution).

### Unit 3 — Script text, imports and definition version 34

Scripts write imports and extension access, and the definition records both; a script's lines follow line structure. Collection syntax, collection expressions `[…]`, ranges `..` and from-end indices `^`, is built in unit 4, as [its proposal](proposals/collections.md) designs it: unit 3 builds no placeholder for it, and leaves its tokenizer and chain parser to extend cleanly.

1. **Line endings:** one definition of a line break, LF, CRLF or a lone CR, for comments, block strings, diagnostics and locations; line comments ending at CR and CRLF; and U+2028 and U+2029 refused outside literal string text. It repairs today's comment handling on its own, before any layout rule.
2. **The definition's contract:** `import` a keyword; one shared list of Lexica's own names; version 34, structured imports and the `extension` field, validated, with a namespace or an extension's module checked against the imports.
3. **Imports:** imports, aliases and type imports parsed; namespaces recognized by the script's imports, in place of the registry's module names, so parsing never consults a registry; imports a host supplies to parsing, formatting, quoting and resolution; and parsed texts kept by their text and their imports.
4. **Resolution by imports:** one lookup context giving the namespaces, the type names, an explicitly imported name first and extensions taking no part, the members the imports make available, and what qualified access reaches; the diagnostics of a missing import; and the imports in the resolution key.
5. **Extension access:** `:` and `?:` through the chain parser, the lowering and the writer, with the colon diagnostics and named arguments told apart; resolution through the selector, evaluation, bound function references, and host calls reached through an extension.
6. **Line structure:** one-line constructs, break points, enclosed operator expressions, keyword blocks and boundaries, refused where broken in the parser and the syntax tree, never changing a reading.
7. **Canonical text:** the imports' layout; keyword blocks in block form wherever they span lines; `quote` compact, breaking lines only where boundaries require; `format` given the imports a destination supplies; and the syntax tree's node kinds for imports and extension access.
8. **Versions:** language `1.0.0-alpha.34` and definition version 34, once every part of them is in.

**Completion:** the implementation follows language `1.0.0-alpha.34` and reads definition version 34, and the gate passes.

Contracts: [Scripts](../spec/scripts.md), [the grammar](../spec/grammar.md), [line structure](../spec/lexical-structure.md#line-structure), [the definition](../spec/definition.md), [extension access](../spec/members.md#property-access-calls-and-indexers-extension-access).

### Unit 4 — Collections

The [collections proposal](proposals/collections.md)'s four parts, each settled, specified and implemented in turn. Its accepted decisions stand; each of its open contracts is settled by the stage that depends on it, before that stage implements anything.

1. **The lineage contract:** the smallest representation of provenance that satisfies the proposal's requirements, specified before any transformation propagates provenance, so no temporary representation is built. It is the foundation's first remaining task.
2. **The foundation:** `Dictionary<K, V>` and `Pair<K, V>`, public from this stage with their checking and capture complete; capture of arrays, maps and sets; typing; key equality; insertion order; null keys; duplicate keys refused; lookup and presence; the exported forms; and metadata realigned through filtering, with lineage through projection.
3. **Construction and operations:** collection expressions, through the parser, the definition, line structure and canonical text; dictionary construction and grouping; and the member surface, `select` beside object projection.
4. **Positional operations:** `Index` and `Range`, `..` and `^`, strict slicing beside tolerant lookup, typed indexer signatures, and `pick`.
5. **Ordering:** `orderBy` and `thenBy`, stable, with their key domains and null placement.

A stage that changes the definition's contract advances its version, as [the definition](../spec/definition.md#definition) sets out.

**Completion:** each accepted decision and each settled contract is specified and implemented, and the gate passes; a host follows at its third checkpoint.

Contract: [Collections](proposals/collections.md).

### Unit 5 — Specification examples

A module implementing [the examples' vocabulary](../spec/examples-vocabulary.md), written once, and a harness giving each example its fixtures, a host, and prepared calls with their projections. Every example the specification gives resolves and evaluates in the gate.

### Unit 6 — Tooling

Built once, on the final syntax and visibility rules:

- Error recovery, and a public tooling API that collects diagnostics without throwing, over the lossless syntax tree and the tolerant tokenizer that are built and internal.
- Formatting that preserves a text's source form; tokens already keep each string's form.
- Editor tooling: diagnostics and completion through the syntax tree, offering only the declarations a script can reach.

References: [Syntax tree](lexica-design.md#the-syntax-tree), [tooling](lexica-design.md#tooling).

### Unit 7 — Release

**Packages.** One source and build produce both packages locally; neither is published. Both carry the runtime version declared by `src/language/Versions.mjs`.

| Package | Contents or delivery |
| --- | --- |
| npm: `@formaui/lexica` | JavaScript bundle and type declarations |
| NuGet: `formaui-net.Lexica` | `lexica.js` and `lexica.d.ts` served at `_content/lexica/` |

Publish both, and test them as consumers install them: NuGet in a published application, and npm installed, bundled, and loaded in Chromium.

**Beta.** The documents and module API have been audited, and the behavior of a cast inside an optional enclosed access is settled. What remains:

- Add `CHANGELOG.md`, empty until the first change after the beta.
- Set the beta version to `1.0.0-beta` wherever the beta version is written or checked; number packages `1.0.0-beta.N`.

Beta means no breaking redesign is planned and remaining limitations are documented. Breaking changes after beta require migration guidance.

<a id="temporary-implementation-coverage"></a>

## Temporary implementation coverage

Conditions the implementation reports that only language `1.0.0-alpha.33` has, coded so every diagnostic it throws carries a code while units 1 to 3 remove them. They stay out of the specification's catalog; each code retires to its [ledger](../spec/diagnostics-and-errors.md#diagnostics-retired-codes) when its condition's unit lands, and is never reused.

| Code | Kind | Condition | Removed by |
| --- | --- | --- | --- |
| `LEXICA1500` | syntax | A colon or `?:` in a chain followed by a name, which alpha.34 reads as an extension access | [Unit 3](#unit-3--script-text-imports-and-definition-version-34) |
| `LEXICA2640` | structure | `lexica.format` or `lexica.quote` given a definition reading through a namespace that text read without module names cannot write | [Unit 3](#unit-3--script-text-imports-and-definition-version-34) |
| `LEXICA2641` | structure | A definition read without a registry's module names that writes one of them alone | [Unit 3](#unit-3--script-text-imports-and-definition-version-34) |
| `LEXICA2642` | structure | A namespace naming no module the registry holds, which imports replace | [Unit 3](#unit-3--script-text-imports-and-definition-version-34) |
| `LEXICA4506` | module | A type named by one capital letter, which implicit type parameters reserve | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4509` | module | A structured type whose `fields` are empty | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4510` | module | A `fields` entry that is not a name with a type | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4511` | module | A selectable type's key not written as a letter followed by letters, digits, colons and hyphens | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4513` | module | A member's `target` that is not a type, a list of them or `'any'` | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4528` | module | An indexer declared without a `name` | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4530` | module | `default` on a member that is not an indexer | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4531` | module | A `syntax` that is neither `function-call` nor `indexer` | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4532` | module | An indexer whose `arguments` are not positional | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4533` | module | A `default` that is not a Boolean | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4550` | module | A second default indexer of a receiver, across the registry | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA4551` | module | Members of one name on overlapping receivers in two modules, refused at registration | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA4553` | module | A module member and a member of its name on a type its module does not declare | [Unit 1](#unit-1--declarations-and-the-type-model) |
| `LEXICA5500` | evaluation | An interpolation given what is neither a string nor a number when it is evaluated | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA5501` | evaluation | A comparison given what is not a number when it is evaluated | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA5502` | evaluation | A definition node no evaluation exists for | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA5504` | evaluation | A function's result its callback contract does not declare, when it is evaluated | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA5505` | evaluation | An arithmetic operand or a negated value that is not a number when it is evaluated | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |

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
| Diagnostics | Error codes, kinds, messages and locations; a hook's or an implementation's failure wrapped with what it threw as its cause | [Diagnostics](../spec/diagnostics-and-errors.md) |
| Build | Bundle and type declarations | [Build](../README.md#build) |

### Type identity and names

**Implemented.**

- Type names in PascalCase, Lexica's own and the built-in DOM types' among them, `Number`, `List<T>` and `Element`, and a module's type checked for its initial capital when the module is created. Lexica's own names are reserved, and the built-in DOM types' are not, since a module's `Element` is its own.
- A type identified by its module and local name, so different modules declare the same local name; a structured type's `import` and qualified type references, every reference resolved to its identity at registration; and an argument's diagnostic writing the type it expects and the one it finds by their qualified names where they share a local name. Until unit 3 brings imports, a script's type names resolve across the registry, unqualified where one type has the name.

### Indexers and computed properties

**Implemented.** A named indexer is written `x.name[k]`, a type's unnamed indexer `x[k]`, and a property by a computed name `x.[p]`, each optional as `x?.name[k]`, `x?[k]` and `x?.[p]`. Resolution reads `x.name[k]` as the named indexer wherever the receiver's type declares one, a key it refuses being its own error, and reads the property and indexes its answer only where none is declared. The colon forms are refused with the form to write.

### Definition version 33

**Implemented.** Casts and conversions name a type qualified by its module, as `to Home.Climate`, and an indexer is recorded without a `name`, a named indexer's target being the `member` node of its name. A qualified name resolves to the type its registered module declares, identified by its module as [type identity and names](#type-identity-and-names) sets out.

Definition version 34, which records a script's imports and the extensions its accesses select, arrives in [unit 3](#unit-3--script-text-imports-and-definition-version-34).

### Definition version 32

The first two slices of the original version 32 plan are complete. The unfinished third slice became the [implementation plan](#implementation-plan), whose first part advanced the definition to 33.

Completed declaration work established one shape with valid combinations for each kind. Implementations are carried in declarations and receive one object. Creating an evaluator is refused when its resolution uses a declaration or conversion without an implementation, where one is required.

Completed definition and resolution work includes:

- `it`, `root`, and `namespace` nodes; version 31 definitions are refused.
- Registry parsing, formatting, and quoting with its module names; definitions read without those names are refused.
- Qualified forms and function references. A null receiver argument skips the member and its arguments, including when a reference is held, passed, or chosen.
- Verbs taking a test and Boolean functions replacing predicates.
- Implicit bodies recognized by their own `it`; expression and predicate arguments accepting arrows, functions held by names, or function references under their own result policy.
- Cast and conversion types written bare. Qualified type names followed in [definition version 33](#definition-version-33).

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

No open decision is recorded for the implementation plan: Unit 0's decisions are taken, and unit 4 settles the collections proposal's open contracts, the lineage representation first. Deferred items below require their stated trigger before design or implementation resumes.

## Deferred

| Work | Why it waits | Reopened by |
| --- | --- | --- |
| Collection conversions, `values to List` and `entries to Dictionary` | Collections are constructed by members; conversions to or from a collection would extend conversion targets and contracts. | A use members do not serve |
| Explicit application identity, `identifyBy` | Sources and lineage serve the collection foundation; identities apart from keys and sources need scoping rules of their own. | A host that matches by identities its sources cannot give |
| Incremental reparsing, specialized tree machinery, and a public tree schema shared by C# and JavaScript | No tool needs them yet. | A concrete tooling need |
| Expression, predicate, and function arguments to host calls | Prepared arguments are values retained by the host; callbacks need an evaluation context and lifetime. | A host call that must call back into its script, with that context and lifetime designed |
| An extension targeting several types | Each extension has one target, and reusing a declaration in an extension for each target serves current cases. | Many repeated members across unrelated types |
| Selecting a module's operator when several compete | No syntax selects an operator by module; qualified calls cannot reach operators. | Competing operators in real use |
| Structured-data casts, reference/data conversions, and operators beyond `cast` and `convert` | Each needs rules for checking and copying. | A use the two operators do not serve |
| Calling a module's internal declarations through Lexica | JavaScript implementations can reach their own values directly. | An internal-call API with a defined module context |
