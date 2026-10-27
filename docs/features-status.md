# Features Status

## Current state

**The core language, host calls, definition version 33 and the diagnostic codes are implemented. [Unit 0](#unit-0--decisions-and-the-specification) of the [implementation plan](#implementation-plan) is done. In [unit 1](#unit-1--declarations-and-the-type-model), steps 1 to 4 are complete; steps 1 to 5 are complete, step 5 the declaration model, its S1 and S2 done; step 6, the inference of type parameters, is next.**

| Version | Implementation | Specification |
| --- | --- | --- |
| Language | `1.0.0-alpha.33` | `1.0.0-alpha.34` |
| Definition format | 33 | 34 |

The implementation reads definition version 33, the language's indexers, computed properties and qualified type names, its types' names in PascalCase, and each type identified by its module. It declares reference types, with their hierarchy, membership and recognition, beside structured types of fields, and still uses flat member declarations, module-level conversions, and implicit type parameters, which read every single capital letter as one and refuse a type named by one letter; an internal bridge reads a named indexer as a flat member of indexer syntax and an unnamed one as a flat default indexer. The specification describes their replacement, which the plan's units deliver.

The bundle and type declarations are built. npm and NuGet packages are packed locally but unpublished. Six specification examples resolve and evaluate; 28 remain.

The [specification](../spec/README.md) defines the contract; the [design](lexica-design.md) explains the architecture. This file tracks implementation and the remaining work. "Implemented" means built and tested in the gate for the current implementation version; it does not imply that later specification changes are implemented.

## Implementation plan

The remaining work is grouped by the code it rewrites, so each mechanism is rewritten once: the declaration model and the registry, the type relation, the member selector, argument binding, the text pipeline, and the evaluator's member selection. The units are ordered by what each needs from the one before it.

- **A stage is a commit.** Each stage passes the gate, and moves each aspect once: a declaration, a test or a document takes its final form the first time the aspect changes, never an intermediate one a later stage replaces.
- **Breaking changes are made directly,** without compatibility layers, migration notes or deprecations, until the beta. The one exception is the working checklist each host migration checkpoint keeps, of the changes its host has still to adopt, which is removed once that migration is verified.
- **Three host migration checkpoints.** A host building on Lexica builds against a pinned commit, and migrates its declarations and its runtime use once at the end of unit 2, its scripts once at the end of unit 3, and its handling of collections in results once at the end of unit 4. The release then changes how it consumes Lexica, through the published packages.
- **Documents move with their stage.** The README, the [embedding guide](embedding-guide.md), the type declarations and this file change in the stage that changes what they describe.
- **Every diagnostic has its code.** Unit 0's third stage gives a [code](proposals/diagnostic-codes.md) to every existing condition, and every later stage gives each condition it introduces its code at once; the tests of each condition assert its code, never only its message.

| Unit | Work | State |
| --- | --- | --- |
| 0 | [Decisions and the specification](#unit-0--decisions-and-the-specification) | ✅ Done |
| 1 | [Declarations and the type model](#unit-1--declarations-and-the-type-model) | In progress: steps 1 to 5 done; step 6 next |
| 2 | [Member selection and deferred evaluation](#unit-2--member-selection-and-deferred-evaluation) | Planned |
| 3 | [Script text, imports and definition version 34](#unit-3--script-text-imports-and-definition-version-34) | Planned |
| 4 | [Collections](#unit-4--collections) | Accepted in part; the lineage contract first |
| 5 | [Specification examples](#unit-5--specification-examples) | Planned |
| 6 | [Tooling](#unit-6--tooling) | Planned |
| 7 | [Release](#unit-7--release) | Planned |

### Unit 0 — Decisions and the specification

✅ Done. Its seven decisions are specified, and each is implemented, or listed in the step that implements it: competing conversions in [unit 2](#unit-2--member-selection-and-deferred-evaluation)'s step 2; mappings in [unit 1](#unit-1--declarations-and-the-type-model)'s step 5; line structure and the two gaps in the text's specification, `import` a keyword and how `quote` writes a definition's imports, in [unit 3](#unit-3--script-text-imports-and-definition-version-34)'s steps 1, 2, 6 and 7. Diagnostic codes, the classified projection sources, and the wrapping of a hook's or an implementation's failure with what it threw as its cause are implemented. The [diagnostic codes](proposals/diagnostic-codes.md) and [line structure](proposals/line-structure.md) proposals keep the reasoning.

### Unit 1 — Declarations and the type model

Every declaration takes its final shape, and the types those declarations make relate as the specification sets out. Resolution keeps selecting members as it does today, through registry queries whose answers the new declarations give; unit 2 replaces the selection itself.

1. ✅ **Registry queries.** The resolver, the evaluator, result paths and the entry point read declarations only through registry queries, never a declaration's `target`, `syntax` or `fields` directly, so the declarations' storage can change behind them. Nothing a script sees changes.
2. ✅ **One type relation.** A registry-aware checker replaces the static assignability, merging, comparability and node checks of `Type`, and the resolver's receiver matching, at every call site. It brings `Any`, distinct from a result left out, into the type model and the checker, registration refusing it in a declaration until [unit 2](#unit-2--member-selection-and-deferred-evaluation) selects and checks its values end to end; the rules of `null` and `Never`; [assignability, equal types and merging](../spec/types.md#types-assignability-and-merging), object types by their fields; and takes a generic value type by its declaration, never `List` by name, so [collections](proposals/collections.md)' `Dictionary` and `Pair` join it in unit 4 without replacing it; neither is public before then.
3. ✅ **Reference types and binding,** in the current flat member shape:
   - `typeOf`, `isInstance`, `abstract` and `supertype`, a hierarchy refused where it cycles; the hierarchy in assignability, list covariance, merging to the nearest shared supertype, and identity equality of references.
   - `registry.createBindings`, recognizing values by every module's `typeOf`, with declared binding types resolved against the registry, a binding set captured once and belonging to its registry, and a cycle refused with its own error. Binding and repeated evaluation are measured at scale before any membership answer is cached, and any cache has defined validity rules.
   - Hierarchy casts; results, captures, declared bindings and casts checked by one membership rule, the destination's `isInstance` and every supertype's; a failed cast naming its value's established type, never recognized again.
   - Projection sources for every projected item, in the representation unit 0 specifies, replacing the sources recorded for elements alone.
   - The resolution key written by qualified identity, so two modules' `Device` no longer share one.
   - Removed: the built-in DOM types and every `nodeType` path, in binding, evaluation, captures, casts and messages, and `lexica.bind`.
4. ✅ **Responsibilities and terminology,** the prerequisite stage, as [its proposal](proposals/responsibilities-and-terminology.md) sets out: the model and its terms recorded, the boundaries reviewed, the mixed responsibilities resolved, and the separations, consolidations and renames its [ledger](proposals/responsibilities-and-terminology-ledger.md) reviews applied, with the part of a later step a change depends on brought forward. Serialized changes wait for definition version 34. Every reviewed entry it carries is implemented and verified. The ledger is the detailed record; an entry's ✅ can cover part of it, the rest carried by the later stage listed for it below.
   - ✅ **The model and its terms,** [T1 to T7](proposals/responsibilities-and-terminology-ledger.md#4-the-model-and-its-terms), and the specification's prose, [§9](proposals/responsibilities-and-terminology-ledger.md#9-prose), but for the namespace paragraphs, which wait for unit 3.
   - ✅ **Defects,** [D1 to D19](proposals/responsibilities-and-terminology-ledger.md#3-defects), each fixed in its own commit with a test that failed first.
   - ✅ **Renames by owner,** [§7](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner): module declarations and the registry, M2 to M5, M7 to M14 and M16; the script text, S1 to S12; preparation and types, P1 to P15; evaluation and values, E1 to E8; and the public contracts, C1 to C7, C9, C10 and C12 to C15, whose public names and shapes [unit 2](#unit-2--member-selection-and-deferred-evaluation)'s checkpoint lists for its host.
   - ✅ **Unifications,** [§5](proposals/responsibilities-and-terminology-ledger.md#5-unifications): U1, U1d, U3 to U5, U8, U12 to U28, U30 to U32, U34, U37 to U39, U42 and U43. Among them: one rollback for speculative resolution; one test for a type that is null or Never; one resolution of the receiver type a member applies by; the object root's type held in the scope; one stored-value read, the object-field and data-shape type lookups apart; one throwing `#fail` in the validator, the resolver and the evaluator, and the Parser's error factories named for what they create; the registry named `registry` wherever a component holds it; and the tests' shared helpers in `tests/support/`, the setups that differ kept local.
   - ✅ **Dispositions of combined responsibilities,** [§6](proposals/responsibilities-and-terminology-ledger.md#6-combined-responsibilities-dispositions): R1 to R13 and R15 to R34. Among them: type resolution before the rules that read resolved types; validation apart from the copies a module keeps; uniqueness checked where its key is known; each access's resolution stored by the access; bindings looked up apart from their creation.
   - **Carried by later stages,** each listed where it lands: S1's and S2's entries in [step 5](#unit-1--declarations-and-the-type-model), R14 with U33 at S1; [unit 2](#unit-2--member-selection-and-deferred-evaluation)'s in its step 5; and [unit 3](#unit-3--script-text-imports-and-definition-version-34)'s, with [definition version 34](proposals/responsibilities-and-terminology-ledger.md#8-definition-version-34), in its step 9.
5. ✅ **The declaration model,** in two stages, which the ledger names *S1* and *S2*. Members a module adds to a type it does not own, Lexica's list members and verbs among them, stand flat with a `target` until S2 gives them an extension type and their type parameters a declared scope, so S1 keeps the flat form beside the nested one, both through the same collision checks, and S2 removes it.
   - **S1, the declarations' shapes:**
     - ✅ Module names unique case-insensitively at registration, their spelling kept; casing a convention for modules, namespaces and types, never enforced.
     - ✅ Lexica's own module spelled `Lexica`.
     - ✅ `impl` in place of `implementation`, on members, observation types and the module-level conversions.
     - ✅ **Nested declarations and their context,** in two commits, as [I2](proposals/implementation-decisions.md) records: a reference type's own members within it, beside the flat form, the registry indexing and validating them with their type as their receiver, a type's `import` covering them, and an error located at their type; and type kinds; `kind: 'structured'`, its data shape the properties it declares directly without `updates`, in place of `fields`; a reference or structured type's own members within it, beside the flat form, a member declared once each way refused as any duplicate is; the registry indexing and validating nested members, a type's `import` covering its whole declaration, and an error located at the type a nested declaration stands in; one key validation, the types' keys by kind ([U33](proposals/responsibilities-and-terminology-ledger.md#5-unifications), [R14](proposals/responsibilities-and-terminology-ledger.md#6-combined-responsibilities-dispositions)); [U41](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s `LexicaTypeDeclaration`; and [U3](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s data read named `'objectField'` once a structured type's data resolves and evaluates through its declarations. It retires LEXICA4509 and LEXICA4510, and LEXICA4556 for `structured`, a property without `updates` anywhere else refused with LEXICA4032, a data property resolving as I5 sets out, and a structured type of no data property taken (I6); DOMQL's checkpoint has a row for host calls declared within types, whose dispatch follows them, apart from its renames.
     - ✅ **The `indexer` kind,** named or unnamed, in place of `syntax`, `default` and the indexer bridge, List's `item` its unnamed indexer: [U9](proposals/responsibilities-and-terminology-ledger.md#5-unifications), with [P8](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)'s `#syntaxNamedBy`; [M15](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)'s `getUnnamedIndexers`; [D7](proposals/responsibilities-and-terminology-ledger.md#3-defects)'s "unnamed indexer"; [R9](proposals/responsibilities-and-terminology-ledger.md#6-combined-responsibilities-dispositions)'s `#validateIndexer` validating `kind: 'indexer'`. It retires LEXICA4528 and LEXICA4530 to LEXICA4533; `Declarations.indexer` declares one ([I8](proposals/implementation-decisions.md)), and a used unnamed indexer is named as [I7](proposals/implementation-decisions.md) sets out.
     - ✅ **Mappings** in place of selectable types ([M17](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)), each `{ selector, key, type }`: a key any string, unique within its selector across the registered modules; a type its module declares, a foreign one qualified, or one of Lexica's own, a named structured type where it gives an object's shape. It retires LEXICA4511; a key that is no string is refused with LEXICA4008 ([I10](proposals/implementation-decisions.md)).
     - ✅ **A function parameter's `parameterTypes`** ([M18](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)), with the specification's parameter declaration keys and LEXICA4537 written for it.
     - ✅ **`internal`:** a member's accessibility bounded by its containing type's; the registration checks that no declaration names another module's internal one and no public one exposes an internal type, a public type's supertype and a mapping's type among them; and a `typeOf` naming an internal type a fault, LEXICA5002; a flat member's target counts among what it writes ([I11](proposals/implementation-decisions.md)). What a script reaches is filtered in [unit 2](#unit-2--member-selection-and-deferred-evaluation)'s selector.
     - ✅ **The scalar type names** owned once ([U7](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s scalar part), `LexicaModule.scalarTypeNames`, beside the built-in type names a name resolves to; `Type` keeps its `typeof` map, which a test keeps to them ([I12](proposals/implementation-decisions.md)). Observation types are named in camelCase by convention, never validated.
   - **S2, named extension types and their receivers,** in the four commits [I13](proposals/implementation-decisions.md) records, the duplicate checks in one of their own before the last ([I16](proposals/implementation-decisions.md)):
     - ✅ Named extension types, `kind: 'extension'`, each with one target, never `Any` or nullable, in place of the `'any'` target and lists of targets; a module member and an extension member of its name declared side by side, the `'any'` target and lists of targets going with the flat form, in S2's last commit.
     - ✅ Declared type parameters: a member's own, an extension's scope, their names read in it ([I14](proposals/implementation-decisions.md)), and the conflicts a name declares, LEXICA4010, LEXICA4041, LEXICA4043 and LEXICA4558; the conflicts with types reached, LEXICA4042, and the registration checks, LEXICA4011 and LEXICA4044, each bound from a supported source, in place of the implicit single capitals, which lifts the refusal of a type named by one letter; reference and structured types and operators declaring none, an operator using its extension's; [R11](proposals/responsibilities-and-terminology-ledger.md#6-combined-responsibilities-dispositions)'s LEXICA4041 with them. It retires LEXICA4506.
     - ✅ Lexica's own `List<T>`, declared through a form internal to Lexica, as [I15](proposals/implementation-decisions.md) records, and owning the members of lists, which the receiver gives its `T`, and `VerbExtensions<T>`; [U6](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s one `getTypeDeclaration` answering every value type's declaration, Lexica's own included, its type parameters under `typeParameters`; and [U7](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s built-in type names derived from Lexica's own module.
     - ✅ The declaration helpers without receivers, [M1](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)'s `create…` names, with `createIndexerDeclaration` and one property helper whose declaration follows the contract of where it stands; [M6](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)'s `takesReceiver` and [M15](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner)'s `getReceiverTypes`, one type for a member that takes a receiver and none for a module member ([I18](proposals/implementation-decisions.md)).
     - ✅ Removed: flat members, a member among a module's `members` a module member, `target` refused on every member with LEXICA4030, the `'any'` target and lists of targets, the implicit single capitals, and the migration hint for `predicates`; the duplicate tolerance and identifier checks, as [I16](proposals/implementation-decisions.md) reads them. Every test declares in the final shape, a test that reached a receiver's member through a namespace reading a module's own type or a module member ([I17](proposals/implementation-decisions.md)). It retires LEXICA4513 and LEXICA4506; LEXICA4556 retired with the first commit, which reads extensions.
   - In [unit 2](#unit-2--member-selection-and-deferred-evaluation), with the selector: LEXICA4550, another module's unnamed indexer of an overlapping receiver, retired with LEXICA4551.
6. **Inference of type parameters:** a receiver binding its extension's parameters by its non-null branch, with exact extraction; value arguments binding before callbacks; nullable candidates combining and different candidates refused; the evidence of `null` and `Never`; and a callback's result binding a parameter, without chaining. A held reference to a generic module member, its answer checked against each specialization it is called with, is tested again once value arguments bind ([I17](proposals/implementation-decisions.md)). *Next.*

Module-level conversions, and the registration's refusal of members of one name on overlapping receivers across modules, stay as they are until unit 2 replaces them.

**Completion:** every declaration in Lexica, its tests and its documents is in the final shape, every value a host binds is typed by the registry, and the gate passes.

Contracts: [Types](../spec/types.md), [Modules](../spec/modules.md), [declaring a member](../spec/members.md#members-declaring-a-member), [Lexica's vocabulary](../spec/vocabulary.md), [bindings](../spec/runtime.md#runtime-bindings), [results](../spec/runtime.md#runtime-results).

### Unit 2 — Member selection and deferred evaluation

One selector chooses every member, indexer and operator, at resolution and during evaluation alike.

1. **The selector** replaces the three selection paths and the path for receivers of unknown type: owner precedence through inheritance; competing extensions registering, in place of the registration's refusal, and selected by the most specific target; ambiguity refused at resolution, giving the extension accesses to write; internal declarations excluded at resolution; and an empty list or a null receiver selecting as [the types](../spec/types.md) set out.
2. **Operators:** casts and conversions declared on types and in extensions, in place of module-level conversions, competing as operators do, an applicable owner's winning and otherwise the most specific extension's; Lexica's own conversions moved onto its types; declared casts, an `impl` optional, `reject` making an attempt null; and operators chosen by the selector.
3. **`Any` and deferred selection:** a member selected when its receiver is evaluated, through the same selector; the selection cached by node and actual type within one registry, plain objects read by their own fields; identity kept through `Any`; a selection that would be a host call refused before anything is invoked; `beforeInvoke` told the selection was deferred; an `Any` argument checked against its parameter, and an operand of `Any` by its operation's rules; and a deferred access failing with the access and the actual type named.
4. **Reporting:** used declarations including operators, in place of the separate used conversions; deferred accesses; and candidate declarations, reported as an overestimate.
5. **From the ledger:** [U1](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s candidate handling; [U10](proposals/responsibilities-and-terminology-ledger.md#5-unifications), conversions as operators; [U11](proposals/responsibilities-and-terminology-ledger.md#5-unifications), used declarations and used conversions unified; [U40](proposals/responsibilities-and-terminology-ledger.md#5-unifications), an implementation's input; [U41](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s conversion and member declaration types; and [C11](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner), `request.isDeferred`.

**Completion:** the gate passes, and a host can move its declarations and its runtime use in one migration.

**The first host checkpoint.** DOMQL builds against Lexica `0e98b3e`, pinned in its `lexica.commit`, and adopts at this checkpoint every change below, made since. The list is a working checklist, kept until that migration is verified and then removed; each line names where DOMQL, at its `7406eb4`, uses what changed.

| Owner | At `0e98b3e` | Now | Host change |
| --- | --- | --- | --- |
| Module | Built-in DOM types | Reference types a module declares, `{ kind: 'reference', isInstance, supertype?, abstract? }`, and the module's `typeOf` | Declare the DOM's types and recognize its values: DOMQL declares no `isInstance` or `typeOf` |
| `lexica` | `bind(values)` | `registry.createBindings(values, options)` | Bind with the registry the script resolves against: `DomqlQuery.mjs:47`, `domql.js:116`, `domql.js:127` |
| Bindings | `get(name)`, `typeOf(name)` | `readValue(name)`, `getType(name)` | Rename where read; DOMQL reads neither |
| `lexica`, resolution | `locate(…)` | `getLocation(…)` | Rename: `domql.js:445`, `domql.js:557` and `domql.d.ts:270` |
| `lexica.paths` | `check(path)` | `validate(path)` | Rename: `DomqlQuery.mjs:57`, `DomqlQuery.mjs:107`, `Watch.mjs:152` |
| Evaluator | `prepareCall()`, `evaluate(host)`, `LexicaHost` | `prepareHostCall()`, `evaluate(hooks)`, `LexicaEvaluationHooks` | Rename the calls, `EventListener.mjs:66`, `QueryEvaluator.mjs:100`, `domql.js:338`, `domql.js:406`, and the hooks' type |
| Prepared and skipped call | `location` | `pointer`, a definition pointer, the prepared call extending the invocation request | Locate through `resolution.getLocation(call.pointer)` where a location is needed: `domql.js:347`, `domql.js:416` |
| Invocation request | `pointer`, a body copy's within a script function's body | `pointer`, the definition's, whichever call reached it | Key nothing by the pointer that two calls of one function must tell apart: DOMQL reads none |
| Registry | `getOwner(declaration)` | `getDeclaringModuleName(declaration)` | Rename: `Observations.mjs:445` |
| Declarations that run code | `implementation`, on members, observation types and conversions | `impl`; `implementation` is refused with LEXICA4030 at that key, and LEXICA4001, LEXICA4030 and LEXICA4505 are located at `impl`; `registry.getImplementation` keeps its name | Attach each function as `impl`: `BrowserVocabularyDeclarations.mjs:44`. `DispatchTable`'s `#createDescriptor` reads the host call's `impl`, validates it and keeps the function as the descriptor's `implementation`, and `#createDeclaration` strips `impl` before the declaration reaches Lexica, which refuses one on a host call; an invalid one is located at `impl`. The descriptor's `implementation` and its read at `domql.js:546` keep their names |
| Reference types | Members declared flat, each naming its `target` | A reference type's own members within it, `members`, each taking the type as its receiver and naming no target; a nested declaration's error located at its `type` | None until DOMQL declares reference types: it declares none |
| Extensions | Members on another module's types declared flat with their `target`, one of several targets or `'any'`, a single capital letter a type parameter | Extensions among a module's `types`, `{ name, kind: 'extension', target, members }`, one target each, never `Any` or nullable, its name declaring the parameters its members share, `ListExtensions<T>`, and a parameter it targets extending every type, `VerbExtensions<T>`; a member's own declared in its name, `identity<T>`; a member among a module's `members` a module member, and `target` refused on any member with LEXICA4030. A namespace reaches a module's own types' members and its module members alone, never an extension's, so a qualified form or a reference of an extension's member is refused | Declare in extensions every member of `BrowserVocabularyDeclarations.mjs` that names a target, a member of several targets once in each target's extension and one of `'any'` in an extension of its own parameter; and read none of them through `dom.` |
| Internal declarations | No `internal` key | `internal: true` on a type or a member, a Boolean (LEXICA4031); a member within an internal type internal whatever it says; another module's internal type named by a declaration refused (LEXICA4018), and an internal type of its own module exposed by a public declaration (LEXICA4052); a `typeOf` naming an internal type a fault (LEXICA5002) | None: DOMQL declares no internal declaration |
| Function parameters | A function parameter's `parameters`, the types of the arguments its function is called with; `functionParameter(name, type, parameters)` | `parameterTypes`, beside a member's `parameters`, which are declarations; `parameters` on a parameter refused with LEXICA4030; `createFunctionParameterDeclaration(name, type, parameterTypes)` | None: DOMQL declares no function parameter |
| Type selections | `selectableTypes`, each `{ name, selector, type }`, its key written as a letter followed by letters, digits, colons and hyphens; `registry.getSelectableType(selector, key)` | `mappings`, each `{ selector, key, type }`, its key any string, a key that is no string refused with LEXICA4008, LEXICA4038 located at `key`; `registry.getMapping(selector, key)`; `LexicaMappingDeclaration` | Declare DOMQL's keys as mappings: `BrowserVocabularyDeclarations.mjs`, its three `selectableTypes` |
| Indexers | A function with `syntax: 'indexer'`, `default: true` for a type's default indexer, which `[…]` invokes; the helpers' `syntax` and `isDefault` options | `kind: 'indexer'`, named, `x.name[key]`, or, without a name, its type's unnamed indexer, `x[key]`; `syntax`, `default` and an indexer's `arguments` refused with LEXICA4030; `lexica.declarations.createIndexerDeclaration(name, result, options)`, its name null for an unnamed one; Lexica's own `item` is List's unnamed indexer, so `list.item[0]` reads nothing; a used unnamed indexer's `name` is null and its `qualifiedName` `List[]` | Declare DOMQL's five indexers by kind, its two default ones unnamed: `BrowserVocabularyDeclarations.mjs`, each `syntax: 'indexer'` and `isDefault` |
| Structured types | `{ name, fields }`, a type declared without a kind | `{ name, kind: 'structured', members }`, its data shape the properties it declares without `updates`, each `{ name, kind: 'property', result }`, which take no `impl`; `fields` refused with LEXICA4030, a type without a kind with LEXICA4554, and a property without `updates` anywhere else with LEXICA4032. A data property read is a used declaration, which a host call's hooks never hear of | Declare `Size` and DOMQL's other structured types so: `BrowserVocabularyDeclarations.mjs:50` and its ten other `fields`. The definition's object-expression `fields`, and result metadata's `objectFields`, are other things and stay. `#checkWatch`'s reading of `use.declaration.updates?.changes` (`domql.js:483`) finds none for a data property, which no observation needs |
| Host calls within types | Every host call flat in `members` | A host call may stand within its type's `members` | `DispatchTable.createModule` reads `contents.members` alone, and pairs each dispatch descriptor with `module.members` by position: follow host calls declared within types, and pair each with its declaration by identity, apart from the declaration-key renames |
| Lexica's own module | Named `lexica`; the members of lists and the verbs declared flat, with the targets `List<T>` and `T` | Named `Lexica`, as `moduleNames` and `getDeclaringModuleName` answer it; a module named `lexica` is still refused, its message naming `Lexica`. It owns `List<T>`, with the members of lists, and declares the verbs in `VerbExtensions<T>`; `List` is one of Lexica's own type names, so a binding declared `List` is refused as no reference type (LEXICA2023) | None: DOMQL compares no module's name with Lexica's, reads none of its declarations, and declares no binding `List` |
| Resolution | `usedDeclarations[i].name`, qualified | `name`, the declared name, and `qualifiedName` | Read `qualifiedName` where a message names the use: `domql.js:486`, `domql.d.ts:266` |
| Qualified name | Qualified by the first concrete receiver type that matches, `any` and a type parameter skipped | Qualified by the one receiver type a member takes, its type's or its extension's target, the declared name alone where that is a type parameter | None: DOMQL declares no member of several receiver types, so every name it reads is unchanged |
| Declaration helpers | `lexica.declarations.property(name, target, result, options)`, `.function`, `.indexer`, `.valueParameter`, `.expressionParameter`, `.predicateParameter` and `.functionParameter` | `createPropertyDeclaration(name, result, options)`, `createFunctionDeclaration`, `createIndexerDeclaration`, `createValueParameterDeclaration`, `createExpressionParameterDeclaration`, `createPredicateParameterDeclaration` and `createFunctionParameterDeclaration`, a member helper taking no target, since where the member stands gives it its receiver | Rename and drop the target where `BrowserVocabularyDeclarations.mjs` calls them: `:8`, `:46`, and each call from `:94` to `:160` |
| Metadata | `fields`; `sources`, the projected values | `objectFields`; `sources`, each `{ kind, value }` or `{ kind: 'null' }` | Rename the reads, `SnapshotComparer.mjs:27`, `:63`, `:71`, `SnapshotPatcher.mjs:171`, and read each source's `value`, `SnapshotComparer.mjs:106`, `SnapshotPatcher.mjs:245` |
| `LexicaError` | `structure(message, location)`, `validation(…)`, `evaluation(…)`; `location.field` | `structure(code, message, location)`, and so on, with `error.code`; `location.declarationKey`, a message ending "at 'x'" | Give every error DOMQL builds a code of its own prefix: `domql.js:160`, `:167`, `:347`, `:486`, `:494`, `:538`, `:549`, `ExecutionHandle.mjs:83`, `:104`, `Observations.mjs:445` |
| `lexica.info` | `versions.runtime` | `versions.implementation` | Rename where read; DOMQL reads `versions.language` alone |
| Types | `LexicaErrorLocation`, `LexicaBindOptions`, `LexicaObservationValue`, a `source` parameter | `LexicaLocation`, `LexicaBindingsOptions`, `LexicaObservationArgument`, `LexicaScript` | Rename in `domql.d.ts`: `:270`, `:274`, `:292` |
| Module creation and registration | Duplicate types, module members and mapping keys refused at registration; any default accepted for a type parameter, and `Infinity`, `NaN` or a list with a hole for a number or a list | Refused when the module is created, as a declaration holding a value that reaches itself is; a default is data, finite, and a list holding a value at every index | Correct any declaration these now refuse |

Contracts: [Owners and extensions](../spec/modules.md#namespaces-owners-and-extensions), [operators](../spec/modules.md#modules-operators), [internal declarations](../spec/modules.md#modules-internal-declarations), [values of `Any`](../spec/types.md#types-any), [resolution](../spec/runtime.md#runtime-bindings-and-resolution).

### Unit 3 — Script text, imports and definition version 34

Scripts write imports and extension access, and the definition records both; a script's lines follow line structure. Collection syntax, collection expressions `[…]`, ranges `..` and from-end indices `^`, is built in unit 4, as [its proposal](proposals/collections.md) designs it: unit 3 builds no placeholder for it, and leaves its tokenizer and chain parser to extend cleanly.

1. **Line endings:** one definition of a line break, LF, CRLF or a lone CR, for comments, block strings, diagnostics and locations; line comments ending at CR and CRLF; and U+2028 and U+2029 refused outside literal string text. It repairs today's comment handling on its own, before any layout rule.
2. **The definition's contract:** `import` a keyword; one shared list of Lexica's own names; version 34, structured imports and the `extension` property, validated, with a namespace or an extension's module checked against the imports.
3. **Imports:** imports, aliases and type imports parsed, a local name of any identifier, and an import binding read with `@`, the diagnostics of a lexical reference nothing in scope answers, LEXICA1010, LEXICA1032, LEXICA1506, LEXICA2012 and LEXICA3051, then naming the import binding it falls back to; namespaces recognized by the script's imports, in place of the registry's module names, so parsing never consults a registry; imports a host supplies to parsing, formatting, quoting and resolution; and parsed texts kept by their text and their imports.
4. **Resolution by imports:** one lookup context giving the namespaces, the type names, an explicitly imported name first and extensions taking no part, the members the imports make available, and what qualified access reaches; the diagnostics of a missing import; and the imports in the resolution key.
5. **Extension access:** `:` and `?:` through the chain parser, the lowering and the writer, with the colon diagnostics and named arguments told apart; resolution through the selector, evaluation, bound function references, and host calls reached through an extension.
6. **Line structure:** one-line constructs, break points, enclosed operator expressions, keyword blocks and boundaries, refused where broken in the parser and the syntax tree, never changing a reading.
7. **Canonical text:** the imports' layout; keyword blocks in block form wherever they span lines; `quote` compact, a definition's imports written on one line, breaking lines only where boundaries require; `format` given the imports a destination supplies; and the syntax tree's node kinds for imports and extension access.
8. **Versions:** language `1.0.0-alpha.34` and definition version 34, once every part of them is in.
9. **From the ledger:** [U1](proposals/responsibilities-and-terminology-ledger.md#5-unifications)'s call node, `{ kind: 'call', callee, arguments }`, and [U2](proposals/responsibilities-and-terminology-ledger.md#5-unifications), with the [definition version 34](proposals/responsibilities-and-terminology-ledger.md#8-definition-version-34) entries; [U29](proposals/responsibilities-and-terminology-ledger.md#5-unifications), the optional-access tokens; [U35](proposals/responsibilities-and-terminology-ledger.md#5-unifications), type names resolved in their scopes; [U36](proposals/responsibilities-and-terminology-ledger.md#5-unifications), reading and writing text once; and [C8](proposals/responsibilities-and-terminology-ledger.md#7-renames-by-owner), the namespace checks, gone with imports.

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

**Packages.** One source and build produce both packages locally; neither is published. Both carry the implementation version declared by `src/language/Versions.mjs`.

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
| `LEXICA4550` | module | Another module's default indexer of an overlapping receiver, which alpha.33 has no owner to select | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA4551` | module | Members of one name on overlapping receivers in two modules, refused at registration | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA4557` | module | A module named by a reserved word, which text reaches only through an import binding read with `@` | [Unit 3](#unit-3--script-text-imports-and-definition-version-34) |
| `LEXICA5502` | evaluation | A definition node no evaluation exists for | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |
| `LEXICA5504` | evaluation | A function's result its callback contract does not declare, when it is evaluated | [Unit 2](#unit-2--member-selection-and-deferred-evaluation) |

## Implemented capabilities

These capabilities work in the current implementation. The planned replacements and remaining limitations are described above.

| Area | Implemented | Contract |
| --- | --- | --- |
| Scripts | Parameters, bindings, names, bodies, and locals | [Scripts](../spec/scripts.md) |
| Lexical structure | Tokens, names, strings, and comments | [Lexical structure](../spec/lexical-structure.md) |
| Values | Objects, the object root, lists, null, results, and existing conversions | [Values](../spec/values.md) |
| Expressions | Operators, conditionals, coalescing, attempts, and interpolated strings | [Expressions](../spec/expressions.md) |
| Functions | Regular and arrow functions, delegates, references, and implicit bodies | [Functions](../spec/functions.md) |
| Member access | Member forms, bracket property access, and arguments | [Members](../spec/members.md) |
| Module registration | Unified declarations with implementations; whole-registration checks, revisions, and module-local collision checks | [Declarations](../spec/modules.md#modules-declarations), [registries](../spec/modules.md#modules-registries), [collisions](../spec/modules.md#namespaces-a-modules-own-collisions) |
| Vocabulary | List members, verbs, existing conversions, and Boolean functions | [Lexica's vocabulary](../spec/vocabulary.md#vocabulary-lexicas-own), [Boolean functions](../spec/vocabulary.md#vocabulary-boolean-functions) |
| Observations | Observation types and module-declared observation targets | [Observations](../spec/vocabulary.md#observations), [targets](../spec/vocabulary.md#observations-targets) |
| Type selection | Type selectors and selectable types | [Type selectors](../spec/vocabulary.md#vocabulary-type-selectors) |
| Namespaces | Module members, qualified access, and null propagation | [Namespaces](../spec/modules.md#namespaces), [qualified access](../spec/modules.md#namespaces-qualified-access) |
| Text and definitions | Parse, validate, format, quote, and get a location; canonical text for definition version 33 | [Definition](../spec/definition.md) |
| Types | Reference types with their hierarchy, membership and recognition, structured types, one type relation, and casts within a hierarchy | [Types](../spec/types.md) |
| Runtime | Bindings a registry makes, recognizing references, resolution, reuse by resolution key, evaluation with host hooks, and frozen results with every projected item's source | [Bindings](../spec/runtime.md#runtime-bindings), [evaluation](../spec/runtime.md#runtime-evaluation), [results](../spec/runtime.md#runtime-results) |
| Diagnostics | Error codes, kinds, messages and locations; a hook's or an implementation's failure wrapped with what it threw as its cause | [Diagnostics](../spec/diagnostics-and-errors.md) |
| Build | Bundle and type declarations | [Build](../README.md#build) |

### Type identity and names

**Implemented.**

- Type names in PascalCase, Lexica's own among them, `Number` and `List<T>`, and a module's type checked for its initial capital when the module is created. Lexica's own names are reserved.
- A type identified by its module and local name, so different modules declare the same local name; a structured type's `import` and qualified type references, every reference resolved to its identity at registration; and an argument's diagnostic writing the type it expects and the one it finds by their qualified names where they share a local name. Until unit 3 brings imports, a script's type names resolve across the registry, unqualified where one type has the name.

### Indexers and computed properties

**Implemented.** A named indexer is written `x.name[k]`, a type's unnamed indexer `x[k]`, and a property by a computed name `x.[p]`, each optional as `x?.name[k]`, `x?[k]` and `x?.[p]`. Resolution reads `x.name[k]` as the named indexer wherever the receiver's type declares one, a key it refuses being its own error, and reads the property and indexes its answer only where none is declared. The colon forms are refused with the form to write.

### Definition version 33

**Implemented.** Casts and conversions name a type qualified by its module, as `to Home.Climate`, and an indexer is recorded without a `name`, a named indexer's target being the `member` node of its name. A qualified name resolves to the type its registered module declares, identified by its module as [type identity and names](#type-identity-and-names) sets out.

Definition version 34, which records a script's imports and the extensions its accesses select, arrives in [unit 3](#unit-3--script-text-imports-and-definition-version-34).

### Host calls

**Implemented.** Lexica prepares calls and projects host-supplied values; the host owns their lifecycle.

- `invokedBy: 'host'` declarations accept value parameters only, with no updates or implementation.
- Calls are allowed only in terminal position, including a body returning the call after locals or a terminal `do` block. Other positions are refused at resolution with a validation error.
- A fixed argument can select the result type through a type selector. Modules may add keys to an existing type selector, but registration rejects a key already declared in that selector.
- `resolution.hostCall` describes the call, with a null result type when the host supplies no result.
- `prepareHostCall` evaluates preceding locals once and retains their frame in the prepared call. It reports a skipped call when there is nothing to invoke.
- Each prepared call's `project` captures a supplied value as the declared result and evaluates its projection independently of other preparations from the same evaluator. Calls that supply no result have no projection.

Contracts: [Host-call declarations](../spec/members.md#members-host-calls), [host calls in the host contract](../spec/runtime.md#runtime-host-calls).

## Open decisions

The decisions taken while implementing step 5 of unit 1 through unit 5, each without its own review, are recorded in [implementation decisions](proposals/implementation-decisions.md), and reviewed together before unit 6.

Two open decisions are recorded. The first: a module that declares a type spelled as one of Lexica's own, as `Home.Number`, can't name Lexica's own type of that name in its own declarations, since [type name lookup](../spec/types.md#types-type-name-lookup) finds the module's own first and Lexica's own types have no qualified spelling. Giving Lexica a permanent namespace for that was declined; the limitation stands until another spelling is chosen.

The second: a type parameter's default is checked at registration to be data, and against what the parameter binds to nowhere, since resolution checks the arguments a call gives and passes a default left out as it is, so `0` reaches an implementation whose `T` is `String`. Whether resolution refuses such a call, or a parameter of a type parameter takes no default, is open.

Unit 0's decisions are taken, and unit 4 settles the collections proposal's open contracts, the lineage representation first. Deferred items below require their stated trigger before design or implementation resumes.

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
| Object-typed parameter defaults, under the ordinary compatibility rules ([R13](proposals/responsibilities-and-terminology-ledger.md#6-combined-responsibilities-dispositions)) | No parameter can be object-typed while an object type has no notation a declaration writes. | An object type's notation in declarations |
| Calling a module's internal declarations through Lexica | JavaScript implementations can reach their own values directly. | An internal-call API with a defined module context |
