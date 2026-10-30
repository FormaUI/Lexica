# Features Status

## Current state

**The language and its runtime are implemented as the specification describes them, language `1.0.0-alpha.39` and definition version 36.** What remains is DOMQL's migration to them, the [open decisions](#open-decisions), [tooling](#tooling) and [the release](#release).

| Version | Implementation | Specification |
| --- | --- | --- |
| Language | `1.0.0-alpha.39` | `1.0.0-alpha.39` |
| Definition format | 36 | 36 |

The bundle and type declarations are built. npm and NuGet packages are packed locally but unpublished. Every example the specification and the README give resolves against [the examples' vocabulary](../spec/language/examples-vocabulary.md) and evaluates in the gate, a host call's preparation and projection among them, and each example the specification gives as an error is refused.

The [specification](../spec/README.md) defines the contract; the [design](nexo-design.md) explains the architecture. This file tracks implementation and the remaining work. "Implemented" means built and tested in the gate for the current implementation version; it does not imply that later specification changes are implemented.

<a id="remaining-work"></a>

## Remaining work

| Work | State |
| --- | --- |
| [DOMQL's migration](#domqls-migration) | Its four checkpoints await DOMQL |
| [Tooling](#tooling) | Next |
| [Release](#release) | Planned |

- **A change is a commit,** each passing the gate, and moving each aspect once: a declaration, a test or a document takes its final form the first time the aspect changes.
- **Breaking changes are made directly,** without compatibility layers, migration notes or deprecations, until the beta. The one exception is the checklist each of DOMQL's checkpoints keeps, of the changes it has still to adopt, which is removed once that migration is verified.
- **Documents move with their change.** The specification, the README, the [embedding guide](embedding-guide.md), the type declarations and this file change in the commit that changes what they describe.
- **Every diagnostic has its code,** given when its condition is introduced, and the tests of each condition assert its code, never only its message.

<a id="features"></a>

## Features

Each feature, the contract that states it, its state in the implementation, and the language version the implementation has followed it since, whose changes [the language history](../LANGUAGE-HISTORY.md) records. A state names a gap the implementation keeps from its contract, open until it is decided, and what is deferred.

### The language

| Feature | Contract | State | Since |
| --- | --- | --- | --- |
| Scripts, their parameters, bodies and locals | [Scripts](../spec/language/scripts.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Tokens, names, strings and comments | [Lexical structure](../spec/language/lexical-structure.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Line structure | [Line structure](../spec/language/lexical-structure.md#line-structure) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Objects, the object root and null | [Values](../spec/language/values.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Tests, equality, arithmetic, comparisons, logic, conditionals, coalescing, attempts and interpolated strings | [Expressions](../spec/language/expressions.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Casts and conversions | [Casts](../spec/language/types.md#casts), [conversions](../spec/language/values.md#conversions) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Functions a script declares, and function references | [Functions](../spec/language/functions.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Members, their arguments and their kinds, and host calls in a script | [Members](../spec/language/members.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Indexers and computed property access | [Named indexers](../spec/language/members.md#property-access-calls-and-indexers-named-indexers), [computed property access](../spec/language/members.md#computed-property-access) | Implemented | [`alpha.33`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-33) |
| Types identified by their module | [Type identity](../spec/language/types.md#types-type-identity) | Implemented | [`alpha.33`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-33) |
| Imports, aliases and type imports, a host's among them, namespaces, module members and qualified access | [Imports](../spec/language/modules.md#scripts-imports), [namespaces](../spec/language/modules.md#namespaces) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Extensions, selected by owner and specificity, and extension access | [Extensions](../spec/language/extensions.md) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Type parameters, inferred at each call | [Type parameters](../spec/language/types.md#types-type-parameters) | Implemented; a type parameter's default is an [open decision](#open-decisions) | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| `Any`, its members selected as it is evaluated | [Values of `Any`](../spec/language/types.md#types-any) | Implemented in part: a function given to a deferred call is [deferred](#deferred) | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Reference types in hierarchies, and the casts among them | [Reference types](../spec/language/types.md#reference-types) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Structured values an object expression constructs where they are declared | [Constructing a structure](../spec/language/types.md#types-constructing-a-structure) | Implemented | [`alpha.36`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-36) |
| Lists, dictionaries, pairs and collection expressions, with their members | [Collections](../spec/language/collections.md) | Implemented, with a [gap](#open-decisions): `distinctBy`'s key, and the membership of values key equality doesn't compare | [`alpha.35`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-35) |
| Positions, ranges, slicing and ordering | [Positions](../spec/language/collections.md#collections-positions), [ordering](../spec/language/collections.md#collections-list-ordering) | Implemented | [`alpha.35`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-35) |
| The members of numbers and strings | [Number members](../spec/language/vocabulary.md#vocabulary-number-members), [string members](../spec/language/vocabulary.md#vocabulary-string-members) | Implemented | [`alpha.36`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-36) |
| Boolean functions, the tests a module declares | [Boolean functions](../spec/language/vocabulary.md#vocabulary-boolean-functions) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Type selectors | [Type selectors](../spec/language/vocabulary.md#vocabulary-type-selectors) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| The conditions a script fails on, each with its code | [Errors](../spec/language/errors.md) | Implemented, with a [gap](#open-decisions): NEXO5012 shared by several conditions, and four codes never raised | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |

### The runtime

| Feature | Contract | State | Since |
| --- | --- | --- | --- |
| Bindings, recognition and declared types | [Bindings](../spec/runtime/bindings.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Resolution, its reports, result paths and locations | [Resolution](../spec/runtime/resolution.md) | Implemented, with a [gap](#open-decisions): a path validated by `nexo.paths.validate` alone | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Resolutions that stay current across registrations | [Reusing a resolution](../spec/runtime/resolution.md#runtime-reuse) | Implemented | [`alpha.36`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-36) |
| Evaluation, its hooks, and results with their metadata | [Evaluation](../spec/runtime/evaluation.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| The lineage of projected items | [Provenance](../spec/runtime/evaluation.md#runtime-results-provenance) | Implemented, with a [gap](#open-decisions): a dictionary's metadata | [`alpha.35`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-35) |
| Values in a host's forms | [A value in a host's form](../spec/runtime/evaluation.md#runtime-host-forms) | Implemented | [`alpha.35`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-35) |
| Preparing host calls and projecting what their host supplies | [Host calls](../spec/runtime/host-calls.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Modules: their declarations, operators, internal declarations, duplicates and registries | [Modules](../spec/runtime/modules.md) | Implemented, with a [gap](#open-decisions): a type's copy keeps a key holding `undefined` | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Declaring members, their parameter keys and the declaration helpers | [Members](../spec/runtime/members.md) | Implemented, with a [gap](#open-decisions): parameter defaults, options the helpers drop, and a value parameter's `context` left unchecked | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Extensions a module declares | [Extensions](../spec/runtime/extensions.md) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| Observation types and targets | [Observations](../spec/runtime/observations.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| Type selectors' keys as mappings | [Type selectors](../spec/runtime/type-selectors.md) | Implemented | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| The definition, its structural validation and canonical text | [Definition](../spec/runtime/definition.md) | Implemented | [before `alpha.33`](../LANGUAGE-HISTORY.md#before-v1-0-0-alpha-33) |
| The error object, its factories and locations | [Errors](../spec/runtime/errors.md) | Implemented, with a [gap](#open-decisions): `NexoError`'s undeclared methods | [`alpha.34`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-34) |
| The host API named for Nexo | [Hosting Nexo](../spec/runtime/hosting.md) | Implemented | [`alpha.39`](../LANGUAGE-HISTORY.md#v1-0-0-alpha-39) |
| A tolerant reading that collects diagnostics without throwing | [Tooling](#tooling) | Planned | — |
| Formatting that keeps a text's source form | [Tooling](#tooling) | Planned | — |
| Editor diagnostics and completion | [Tooling](#tooling) | Planned | — |
| Published packages, and the beta | [Release](#release) | Planned | — |

The bundle and type declarations are built, as [the build](../README.md#build) sets out.

<a id="domqls-migration"></a>

## DOMQL's migration

DOMQL, Nexo's first host, builds against Nexo `0e98b3e`, pinned in its `lexica.commit`, and migrates in four checkpoints, in order. Each table is a working checklist of the changes it has still to adopt, each line naming where DOMQL, at its `7406eb4`, uses what changed, and is removed once that migration is verified.

**The first checkpoint: declarations and their runtime use.** DOMQL adopts every change below in its declarations and in how it resolves and evaluates.

| Owner | At `0e98b3e` | Now | Host change |
| --- | --- | --- | --- |
| Module | Built-in DOM types | Reference types a module declares, `{ kind: 'reference', isInstance, supertype?, abstract? }`, and the module's `typeOf` | Declare the DOM's types and recognize its values: DOMQL declares no `isInstance` or `typeOf` |
| `nexo` | `bind(values)` | `registry.createBindings(values, options)` | Bind with the registry the script resolves against: `DomqlQuery.mjs:47`, `domql.js:116`, `domql.js:127` |
| Bindings | `get(name)`, `typeOf(name)` | `readValue(name)`, `getType(name)` | Rename where read; DOMQL reads neither |
| `nexo`, resolution | `locate(…)` | `getLocation(…)` | Rename: `domql.js:445`, `domql.js:557` and `domql.d.ts:270` |
| `nexo.paths` | `check(path)` | `validate(path)` | Rename: `DomqlQuery.mjs:57`, `DomqlQuery.mjs:107`, `Watch.mjs:152` |
| Evaluator | `prepareCall()`, `evaluate(host)`, `NexoHost` | `prepareHostCall()`, `evaluate(hooks)`, `NexoEvaluationHooks` | Rename the calls, `EventListener.mjs:66`, `QueryEvaluator.mjs:100`, `domql.js:338`, `domql.js:406`, and the hooks' type |
| Prepared and skipped call | `location` | `pointer`, a definition pointer, the prepared call extending the invocation request | Locate through `resolution.getLocation(call.pointer)` where a location is needed: `domql.js:347`, `domql.js:416` |
| Invocation request | `pointer`, a body copy's within a script function's body | `pointer`, the definition's, whichever call reached it | Key nothing by the pointer that two calls of one function must tell apart: DOMQL reads none |
| Used declarations | A use within a script function's body at a body copy's pointer, which `getLocation` refuses, once for each call | At the definition's pointer, a declaration once at each pointer | None: `domql.js:486` and `:494` locate a refused use's pointer, which now always expands |
| Reporting | `usedDeclarations`, members alone, and an internal `usedConversions`; NEXO4001 for a member located without its type | Operators among the used declarations, named `convert` or `cast` and qualified by their syntax, as `String to Number`; `deferredAccesses`, `{ name, pointer }`; `getCandidateDeclarations()`, `{ declarations, isOverestimate }`; NEXO4001 located at the `type` a member stands in | None: `#checkWatch` (`domql.js:482`) reads an operator's `updates` as absent, which no observation needs, and DOMQL reads no deferred access, since it declares no `Any` |
| Registry | `getOwner(declaration)` | `getDeclaringModuleName(declaration)` | Rename: `Observations.mjs:445` |
| Declarations that run code | `implementation`, on members, observation types and conversions | `impl`; `implementation` is refused with NEXO4030 at that key, and NEXO4001, NEXO4030 and NEXO4505 are located at `impl`; `registry.getImplementation` keeps its name | Attach each function as `impl`: `BrowserVocabularyDeclarations.mjs:44`. `DispatchTable`'s `#createDescriptor` reads the host call's `impl`, validates it and keeps the function as the descriptor's `implementation`, and `#createDeclaration` strips `impl` before the declaration reaches Nexo, which refuses one on a host call; an invalid one is located at `impl`. The descriptor's `implementation` and its read at `domql.js:546` keep their names |
| Reference types | Members declared flat, each naming its `target` | A reference type's own members within it, `members`, each taking the type as its receiver and naming no target; a nested declaration's error located at its `type` | None until DOMQL declares reference types: it declares none |
| Extensions | Members on another module's types declared flat with their `target`, one of several targets or `'any'`, a single capital letter a type parameter | Extensions among a module's `types`, `{ name, kind: 'extension', target, members }`, one target each, never `Any` or nullable, its name declaring the parameters its members share, `ListExtensions<T>`, and a parameter it targets extending every type, `VerbExtensions<T>`; a member's own declared in its name, `identity<T>`; a member among a module's `members` a module member, and `target` refused on any member with NEXO4030. A namespace reaches a module's own types' members and its module members alone, never an extension's, so a qualified form or a reference of an extension's member is refused | Declare in extensions every member of `BrowserVocabularyDeclarations.mjs` that names a target, a member of several targets once in each target's extension and one of `'any'` in an extension of its own parameter; and read none of them through `dom.` |
| Internal declarations | No `internal` key | `internal: true` on a type or a member, a Boolean (NEXO4031); a member within an internal type internal whatever it says; another module's internal type named by a declaration refused (NEXO4018), and an internal type of its own module exposed by a public declaration (NEXO4052); a `typeOf` naming an internal type a fault (NEXO5002) | None: DOMQL declares no internal declaration |
| Function parameters | A function parameter's `parameters`, the types of the arguments its function is called with; `functionParameter(name, type, parameters)` | `parameterTypes`, beside a member's `parameters`, which are declarations; `parameters` on a parameter refused with NEXO4030; `createFunctionParameterDeclaration(name, type, parameterTypes)` | None: DOMQL declares no function parameter |
| Type selections | `selectableTypes`, each `{ name, selector, type }`, its key written as a letter followed by letters, digits, colons and hyphens; `registry.getSelectableType(selector, key)` | `mappings`, each `{ selector, key, type }`, its key any string, a key that is no string refused with NEXO4008, NEXO4038 located at `key`; `registry.getMapping(selector, key)`; `NexoMappingDeclaration` | Declare DOMQL's keys as mappings: `BrowserVocabularyDeclarations.mjs`, its three `selectableTypes` |
| Indexers | A function with `syntax: 'indexer'`, `default: true` for a type's default indexer, which `[…]` invokes; the helpers' `syntax` and `isDefault` options | `kind: 'indexer'`, named, `x.name[key]`, or, without a name, its type's unnamed indexer, `x[key]`; `syntax`, `default` and an indexer's `arguments` refused with NEXO4030; `nexo.declarations.createIndexerDeclaration(name, result, options)`, its name null for an unnamed one; Nexo's own `item` is List's unnamed indexer, so `list.item[0]` reads nothing; a used unnamed indexer's `name` is null and its `qualifiedName` `List[]` | Declare DOMQL's five indexers by kind, its two default ones unnamed: `BrowserVocabularyDeclarations.mjs`, each `syntax: 'indexer'` and `isDefault` |
| Structured types | `{ name, fields }`, a type declared without a kind | `{ name, kind: 'structured', members }`, its data shape the properties it declares without `updates`, each `{ name, kind: 'property', result }`, which take no `impl`; `fields` refused with NEXO4030, a type without a kind with NEXO4554, and a property without `updates` anywhere else with NEXO4032. A data property read is a used declaration, which a host call's hooks never hear of | Declare `Size` and DOMQL's other structured types so: `BrowserVocabularyDeclarations.mjs:50` and its ten other `fields`. The definition's object-expression `fields`, and result metadata's `objectFields`, are other things and stay. `#checkWatch`'s reading of `use.declaration.updates?.changes` (`domql.js:483`) finds none for a data property, which no observation needs |
| Host calls within types | Every host call flat in `members` | A host call may stand within its type's `members` | `DispatchTable.createModule` reads `contents.members` alone, and pairs each dispatch descriptor with `module.members` by position: follow host calls declared within types, and pair each with its declaration by identity, apart from the declaration-key renames |
| Nexo's own module | Named in lower case; the members of lists and the verbs declared flat, with the targets `List<T>` and `T` | Named `Nexo`, as `moduleNames` and `getDeclaringModuleName` answer it; a module named `nexo` is still refused, its message naming `Nexo`. It owns `List<T>`, with the members of lists, and declared the verbs in `VerbExtensions<T>` until language `1.0.0-alpha.37` removed them; `List` is one of Nexo's own type names, so a binding declared `List` alone, which writes no type, is refused (NEXO2044) | None: DOMQL compares no module's name with Nexo's, reads none of its declarations, and declares no binding `List` |
| Resolution | `usedDeclarations[i].name`, qualified | `name`, the declared name, and `qualifiedName` | Read `qualifiedName` where a message names the use: `domql.js:486`, `domql.d.ts:266` |
| Qualified name | Qualified by the first concrete receiver type that matches, `any` and a type parameter skipped | Qualified by the one receiver type a member takes, its type's or its extension's target, the declared name alone where that is a type parameter | None: DOMQL declares no member of several receiver types, so every name it reads is unchanged |
| Selection | The most specific declaration of a name across every module, members of one name on overlapping receivers in two modules refused at registration (NEXO4551), and another module's unnamed indexer of one (NEXO4550) | The owner of a receiver's type first, its members within the types it owns winning, a supertype's it owns among them; otherwise the most specific applicable extension, a member another module declares within a supertype among them; competing extensions registering, an access none of them is more specific for refused with NEXO3024, naming the modules and the extension accesses to write; an internal declaration no candidate, and one that alone applies refused with NEXO3023, through any form, a cast's or a conversion's type among them | None: DOMQL registers one module beside Nexo's, whose own members of lists and verbs keep their names apart from DOMQL's |
| Conversions and casts | A module's `conversions`, each `{ from, to, impl }`, found by its source and destination; a cast within a hierarchy alone | Operators among a type's or an extension's `members`, `{ kind: 'operator', name: 'convert' or 'cast', result, impl }`, the result their destination, selected by their receiver's type and their destination as members are, an internal one no candidate; `conversions` refused with NEXO4502; Nexo's own conversions operators of its scalar types; a declared cast reaching across hierarchies, its `impl` optional and its `reject` making an attempt null; NEXO4022, NEXO4027, NEXO4028, NEXO4064 to NEXO4066, NEXO4069, NEXO4560 and NEXO4561 refusing what an operator can't be; `NexoOperatorImplementationInput`, `NexoMemberImplementationInput` and `NexoObservationTypeImplementationInput` in place of the conversion's, the member's and the observation's inputs | None: DOMQL declares no conversion, and reads none of the renamed types |
| Type parameters | A single capital letter in a member's notations a type parameter, bound by its receiver alone | A member's own parameters, declared in its name, bound by its value arguments and its callbacks' results, a `T?` binding a type without null; candidates of different types refused with NEXO3064 | None: DOMQL declares no type parameter |
| Declaration helpers | `nexo.declarations.property(name, target, result, options)`, `.function`, `.indexer`, `.valueParameter`, `.expressionParameter`, `.predicateParameter` and `.functionParameter` | `createPropertyDeclaration(name, result, options)`, `createFunctionDeclaration`, `createIndexerDeclaration`, `createValueParameterDeclaration`, `createExpressionParameterDeclaration`, `createPredicateParameterDeclaration` and `createFunctionParameterDeclaration`, a member helper taking no target, since where the member stands gives it its receiver | Rename and drop the target where `BrowserVocabularyDeclarations.mjs` calls them: `:8`, `:46`, and each call from `:94` to `:160` |
| Metadata | `fields`; `sources`, the projected values | `objectFields`; `sources`, each `{ kind, value }` or `{ kind: 'null' }` | Rename the reads, `SnapshotComparer.mjs:27`, `:63`, `:71`, `SnapshotPatcher.mjs:171`, and read each source's `value`, `SnapshotComparer.mjs:106`, `SnapshotPatcher.mjs:245` |
| `NexoError` | `structure(message, location)`, `validation(…)`, `evaluation(…)`; `location.field` | `structure(code, message, location)`, and so on, with `error.code`; `location.declarationKey`, a message ending "at 'x'" | Give every error DOMQL builds a code of its own prefix: `domql.js:160`, `:167`, `:347`, `:486`, `:494`, `:538`, `:549`, `ExecutionHandle.mjs:83`, `:104`, `Observations.mjs:445` |
| `nexo.info` | `versions.runtime` | `versions.implementation` | Rename where read; DOMQL reads `versions.language` alone |
| Types | `NexoErrorLocation`, `NexoBindOptions`, `NexoObservationValue`, a `source` parameter | `NexoLocation`, `NexoBindingsOptions`, `NexoObservationArgument`, `NexoScript` | Rename in `domql.d.ts`: `:270`, `:274`, `:292` |
| `Any` | Refused in a declaration | A declaration's result, a parameter and a default of `Any` or `Any?`, a member on a value of `Any` selected as it is evaluated; an invocation request's `isDeferred`, and a prepared call's, always false | None: DOMQL declares no `Any`, and reads no request's `isDeferred` |
| Module creation and registration | Duplicate types, module members and mapping keys refused at registration; any default accepted for a type parameter, and `Infinity`, `NaN` or a list with a hole for a number or a list | Refused when the module is created, as a declaration holding a value that reaches itself is; a default is data, finite, and a list holding a value at every index | Correct any declaration these now refuse |

Contracts: [Owners and extensions](../spec/language/extensions.md#extensions-owners), [operators](../spec/runtime/modules.md#modules-operators), [internal declarations](../spec/runtime/modules.md#modules-internal-declarations), [values of `Any`](../spec/language/types.md#types-any), [resolution](../spec/runtime/resolution.md#runtime-bindings-and-resolution).

**The second checkpoint: scripts.** DOMQL migrates its scripts, adopting every change below in the text it writes.

| Owner | Before | Now | Host change |
| --- | --- | --- | --- |
| Script text | U+2028 and U+2029 taken as whitespace in code and in comments; a lone CR beginning no line in a location | Refused outside a string's literal text, NEXO1002; a lone CR a line break wherever a line is read | None: DOMQL writes either separator only in a string's literal text, `tests/Domql.test.js:4675`, which reads it as before |
| Reserved words | `import` a name | `import` a keyword, refused where a value stands, NEXO1010, and anywhere but a script's start, NEXO1045, its parameter read as `~import` and a member of its name after a dot | None: no DOMQL script names anything `import` |
| Definitions | Version 33: `parameter`, `member`, `call` with `target`, `name` and `optional`, `functionCall`, `indexer`, `object` with `fields` and `target`, `negate`, and `target` on `cast`, `conversion`, `try` and `optionalChain` | Version 34, `{ version, imports, expression }`: `scriptParameter`, `memberAccess` with `receiver`, `{ kind: 'call', callee, arguments }` with the callee a `memberAccess` or a `local`, `indexerAccess` with `receiver`, `object` with `objectFields` and `context`, `arithmeticNegation`, `operand` on `cast`, `conversion` and `try`, and `chain` on `optionalChain`; pointers follow, as `/expression/objectFields/0/value` and `/expression/callee/receiver` | Follow the node names and properties in `domql.d.ts:158` to `:199`, `DomqlDefinition` gaining `imports`, and in every definition and pointer DOMQL's tests write |
| Namespaces | A registry's module names begin namespaces in the text it reads and writes, `registry.parse`, `format`, `quote` and `resolve` reading `domql.window` | A script's imports, and those its host supplies, decide its namespaces, whatever reads it; `parse`, `format`, `quote` and `resolve` take `{ imports }`, which formatting leaves out; a registered module's name no import gives is refused, NEXO3003 | Supply DOMQL's module as an import wherever its registry reads or writes a query, `domql.js:116`, `:138`, `:145`, `:466` and `:512`, or have its queries write `import domql` |
| Registry | `registry.parse`, `registry.format` and `registry.quote` | Gone: `nexo.parse`, `nexo.format` and `nexo.quote` read and write a text for every registry, each taking `{ imports }` | Call `nexo`'s in place of the registry's: `domql.js:116` parses, `:138` and `:145` format and `:512` quotes |
| Language version | `nexo.info.versions.language`, `1.0.0-alpha.33` | `1.0.0-alpha.34` | Name it in DOMQL's status table, which `tests/Alignment.test.js:31` compares with `domql.info.versions.language`, `src/Versions.mjs:15`'s |
| Extension access | A colon in a chain refused, NEXO1500, and a definition's `extension` refused, NEXO3501 | `receiver:Extension.member` and `?:`, the extension's members alone, a function read without a call a reference bound to its receiver | None: DOMQL writes no colon in a chain, which alpha.33 refused, and no definition selecting an extension |
| Line structure | Any layout of a script's tokens read alike | One-line constructs, break points, enclosed operator expressions, keyword blocks and boundaries, NEXO1041 to NEXO1044 and NEXO1064: a body that uses `return` with each local and its `return` on a line of its own, a keyword block that spans lines in block form, nothing but closing punctuation after its `end` | Lay out each script so: `tests/Domql.test.js:3321`, `:3344`, `:3399`, `:3401`, `:3403`, `:3510`, `:3511`, `:3973` and `:4230`, and `tests/language/SyntaxTree.test.js:94`, write a body that uses `return` on one line or a block's `end` before an operator; check the expected messages of `:3349`, `:3359` to `:3362` and `:3575` to `:3588`, whose scripts do so as well, and the canonical texts `:3399` to `:3403` and `:3510` expect |
| Canonical text | `quote` writing everything on one line, and `format` writing a call's next argument after a block's `end` on its line, which line structure refuses | `quote` compact and parseable, breaking lines only where boundaries and keyword blocks require, a body that uses `return` on lines of its own; `format` breaking after the comma that follows a block's `end` | Expect the quoted query in `domql.js:512`'s message to span lines where it holds a body that uses `return`, and the texts `domql.js:138` and `:145` format to change only where they held that layout; check the tests asserting them |
| Resolution | Every registered module's members, indexers, operators and unqualified types reached by every script | Only what a script's imports, written or supplied, make available, Nexo's own always: a member no import makes available refused with NEXO3005, and a type no import names with NEXO3019 giving the import | Supply the `domql` import to every resolution, `domql.js:116`, `:138` and `:145`, as the namespace row asks: its queries read `domql`'s members on the window, its elements and its events, which no other import makes available |

Contracts: [Scripts](../spec/language/scripts.md), [the grammar](../spec/language/grammar.md), [line structure](../spec/language/lexical-structure.md#line-structure), [the definition](../spec/runtime/definition.md), [extension access](../spec/language/extensions.md#extensions-access).

**The third checkpoint: collections in results.** DOMQL adopts the changes below in its handling of collections in results.

| Owner | Before | Now | Host change |
| --- | --- | --- | --- |
| Result metadata | A projected list's `sources`, its immediate inputs alone | `provenance` beside `sources`, each item's source at the earliest projection it descends from, so a projection of a projection names the first projection's references | Match a projected list's items by `provenance` where they are projected from another projection's items, and by `sources` otherwise: `SnapshotComparer.mjs:106`, `SnapshotPatcher.mjs:245`, which read `sources` alone |
| Result metadata | A filter's result described by its expression record alone, its items' sources and provenance lost | `where`'s record carries its kept items' records, `sources` and `provenance`, realigned in its order | Match a filtered list's items by its `sources` and `provenance` as a projection's: `SnapshotComparer.mjs:106`, `SnapshotPatcher.mjs:245` |
| Result metadata | Lineage carried through `where` alone | Every list member answering its receiver's items, `take`, `drop`, `takeWhile`, `dropWhile`, `distinct`, `distinctBy`, `reverse`, `orderBy`, `orderByDescending`, `thenBy` and `thenByDescending` beside `where`, a slice by a range and `pick`, carries their records, `sources` and `provenance` realigned by each occurrence's position, a position `pick` repeats repeating its entries, and `select` records `sources` and `provenance` as a projection does; `concat`, `flatten`, `selectMany`, `toDictionary` and `groupBy` record none | Match those lists' items as a projection's or a filter's are, where `SnapshotComparer.mjs:106` and `SnapshotPatcher.mjs:245` read `sources` |
| Declarations | An expression or a predicate parameter's `nulls` read by no rule | Its body's policy for a null item: `'propagate'`, the helpers' default, answering null without evaluating the body, and `'accept'` evaluating it against every item, its `it` of the item's type | None: DOMQL declares no expression or predicate parameter |
| Result values | No dictionary or pair | A dictionary exported as `{ entries: [{ key, value }, …] }` and a pair as `{ key, value }`, frozen data | None while DOMQL declares no dictionary or pair: a result holding one compares and patches as any data |
| Bindings | A `Map` or a `Set` refused, NEXO2034 | A map bound as a dictionary, a set as a list in its order | None: DOMQL binds no map or set |
| Definitions | Version 34, no collection expression, a `[` where a value stands refused | Version 35, its `list` node, `{ kind: 'list', items }`, and its `dictionary` node, `{ kind: 'dictionary', entries: [{ key, value }] }`, which `[…]` and `["key" = …]` write | Name version 35's nodes in the definition types `domql.d.ts:160` to `:177` describe; DOMQL's scripts write no `[` where a value stands, so none reads otherwise |
| Language version | `nexo.info.versions.language`, `1.0.0-alpha.34` | `1.0.0-alpha.35` | Name it in DOMQL's status table, which `tests/Alignment.test.js:31` compares with `domql.info.versions.language`, `src/Versions.mjs:15`'s |
| Positions and indexers | No `^` or `..`; one unnamed indexer for a receiver type of one module, and one named indexer of a name | `^n` and `start..end`, version 35's `fromEndIndex` and `range` nodes; an indexer's signatures, indexers of one name, or unnamed, within one type taking keys of disjoint types, NEXO4068 and NEXO4029 refusing overlapping ones alone | Name version 35's `fromEndIndex` and `range` nodes in DOMQL's definition types beside its other nodes, `domql.d.ts:160` to `:177`; DOMQL's indexers take one key type each, `BrowserVocabularyDeclarations.mjs:142` to `:146`, and declare no `Index` or `Range` type, so its declarations stand |

Contract: [Collections](../spec/language/collections.md).

**The fourth checkpoint: host additions and the rename.** DOMQL adopts the changes below once it has passed the third, and confirms there that its watches and subscriptions continue across a registration.

| Owner | Before | Now | Host change |
| --- | --- | --- | --- |
| Resolution | Every registration made every resolution stale, its evaluators and its prepared calls refusing with NEXO2040 | A resolution stays current unless it may recognize values, given a value of `Any` or supplying a type that holds a nullable reference, and a module declaring a `typeOf` registers since; `resolution.isCurrent` says which | Keep a resolution while it is current rather than while the revision stands, `domql.js:453` to `:460`; and add an integration test that a watch and a subscription running when a module registers, one without a `typeOf`, keep evaluating and delivering. A subscription supplying events whose `target` is a nullable element still goes stale when a module declaring a `typeOf` registers, as recognition may change what it captures |
| Arguments | An object expression an object, which no structured parameter takes | An object expression written where a structured type is declared constructs it, references among its properties | None: DOMQL declares no structured parameter; an execution can now take nested options, as `buttons = { container = root }`, by declaring them a structured type |
| Bindings | `options.types` a reference type alone, any other refused with NEXO2023 | A type notation: a reference type checked as before, any other capturing its data as a supplied value is; NEXO2023 retired, NEXO2044 and NEXO2045 new | None: DOMQL declares no binding's type; its C# half can bind a typed request's records by declaring their types |
| Numbers | No member of `Number` but `sequence` | `round`, `floor`, `ceiling`, `truncate`, `abs`, `min`, `max` and `clamp`, Nexo's own, which a member a module's extension of `Number` declares of one of those names loses to, its owner's winning | None: DOMQL extends no `Number`; its scripts round a measurement where they compare it |
| Positions | No member telling where an item stands | `indexOf(value)` and `indexWhere(predicate)`, each a `Number?` | None: DOMQL declares no list member of those names |
| Strings | No member of `String`, and no unnamed indexer of it | `length`, `trim`, `lowercase`, `uppercase`, `startsWith`, `endsWith`, `contains`, `indexOf`, `replace`, `split` and the slice `[range]`, Nexo's own, which a member or an unnamed indexer a module's extension of `String` declares loses to | None: DOMQL extends no `String` |
| Verbs | `is`, `has` and `supports`, Nexo's own on every receiver | None: a module declares a test of any receiver for its own domain, in an extension of every type | Drop the verbs wherever DOMQL documents them as another way to call a Boolean function: `spec/vocabulary.md:18`, the section `:402` to `:408`, whose links to Nexo's `#vocabulary-verbs` no longer resolve, `:526`, and `nuget/README.md:528`; DOMQL's queries call none, and its Boolean functions are called or passed by reference as before |
| Name | The language Lexica, its codes `LEXICA` and four digits, its own module `lexica` | Nexo, its codes `NEXO` and the same four digits, its own module `Nexo`, which no script imports and no module is named, in any case | Call the language Nexo where DOMQL names it, 242 times at `7406eb4`, most in `docs/features-status.md`, `spec/vocabulary.md`, `CLAUDE.md`, `docs/domql-design.md` and `build.ps1`; expect `['Nexo', 'domql']` of `moduleNames` at `tests/dom/BrowserVocabularyDeclarations.test.js:34`; and assert `NEXO` codes, since DOMQL asserts none of Lexica's yet |
| API | `lexica`, `LexicaError` and each type whose name begins `Lexica`, from the files `lexica.js`, `LexicaError.mjs`, `LexicaModule.mjs` and `LexicaRegistry.mjs` | `nexo`, `NexoError` and each type beginning `Nexo`, from `nexo.js`, `NexoError.mjs`, `NexoModule.mjs` and `NexoRegistry.mjs`; the earlier checkpoints' lines name the API so | Import `nexo` and `NexoError` where DOMQL imports `lexica` and `LexicaError`, in `src/domql.js:15`, nine more of its sources and six of its tests; rename `LexicaErrorLocation` and `LexicaEvaluator` in `src/domql.d.ts` and `src/dom/QueryEvaluator.mjs`; and reach the renamed files where its tests import them through `#lexica/`, as `tests/language/LanguageResolver.test.js:4` to `:9` does |
| Package | The npm package `@formaui/lexica`, the NuGet package `formaui-net.Lexica` serving `_content/lexica/lexica.js`, from the repository `FormaUI/Lexica` checked out as `formaui-net.Lexica` | `@formaui/nexo`, `formaui-net.Nexo` serving `_content/nexo/nexo.js`, from `FormaUI/Nexo` checked out as `formaui-net.Nexo` | Depend on `@formaui/nexo` where `package.json:12` depends on `@formaui/lexica`, and import it by that name in the sources and tests the API line names, `tests/Boundary.test.js:16`, `build.ps1:121` and the `#lexica/` alias of `tests/vitest.config.js:12` and its three siblings; take the checkout from `formaui-net.Nexo` in `build.ps1:35`, and from `FormaUI/Nexo` in `.github/workflows/ci.yml:45` to `:47` and `:96` to `:98` |
| Specification | One folder, `spec/`, each document holding the language's rules and the runtime's alike | `spec/language/` and `spec/runtime/`, the language's contract of what a script means apart from the runtime's of what a host provides: a mixed document split by contract, `diagnostics-and-errors.md` into each contract's `errors.md`, `terms.md` into each one's glossary and `runtime.md` into the runtime's documents, each section keeping its anchor in the document it moved to | Point DOMQL's 40 links into Nexo's specification at their new documents, each found by its anchor, but `#vocabulary-list-members`, now `language/collections.md#collections-list-members`, and `#vocabulary-verbs`, which the verbs line drops: to `vocabulary.md`, 10 in `spec/vocabulary.md` and 1 in `spec/events.md`; to `members.md`, 9 across `spec/evaluation.md`, `events.md`, `executions.md`, `queries.md`, `terms.md`, `vocabulary.md` and `watches.md`; to `runtime.md`, 8 across `docs/domql-design.md`, `spec/README.md`, `evaluation.md`, `events.md`, `executions.md`, `queries.md` and `results.md`; to `modules.md`, 7 in `spec/vocabulary.md`, `evaluation.md` and `nuget/README.md`; and one each to `scripts.md`, `types.md`, `terms.md`, `definition.md` and `diagnostics-and-errors.md`, from `spec/queries.md`, `nodes-and-shadow-trees.md`, `terms.md` and `api.md`; and replace its links to Nexo's proposals, which are removed once implemented, with the specification's sections they describe: 1 to `collections.md` at `7406eb4`, and 6 to `host-additions.md` its `a66dd77` added to `docs/forma-javascripts-domql-replacement.md` |
| Definition version | 33 | 36, refusing an import of `Nexo` | Write `version: 36` where DOMQL writes a definition, `tests/Domql.test.js:43`, `:211`, `:260`, `:299` and `:342`, and the specification's examples its `tests/DocumentExamples.test.js:85` dates |
| Language version | `nexo.info.versions.language`, `1.0.0-alpha.35` | `1.0.0-alpha.39` | Name it in DOMQL's status table, which `tests/Alignment.test.js:31` compares with `domql.info.versions.language`, `src/Versions.mjs:15`'s |

<a id="tooling"></a>

## Tooling

Built once, on the final syntax and visibility rules:

- Error recovery, and a public tooling API that collects diagnostics without throwing, over the lossless syntax tree and the tolerant tokenizer that are built and internal.
- Formatting that preserves a text's source form; tokens already keep each string's form.
- Editor tooling: diagnostics and completion through the syntax tree, offering only the declarations a script can reach.

References: [Syntax tree](nexo-design.md#the-syntax-tree), [tooling](nexo-design.md#tooling).

<a id="release"></a>

## Release

**Packages.** One source and build produce both packages locally; neither is published. Both carry the implementation version declared by `src/language/Versions.mjs`.

| Package | Contents or delivery |
| --- | --- |
| npm: `@formaui/nexo` | JavaScript bundle and type declarations |
| NuGet: `formaui-net.Nexo` | `nexo.js` and `nexo.d.ts` served at `_content/nexo/` |

Publish both, and test them as consumers install them: NuGet in a published application, and npm installed, bundled, and loaded in Chromium.

**Beta.** The documents and module API have been audited, and the behavior of a cast inside an optional enclosed access is settled. What remains:

- Add `CHANGELOG.md`, empty until the first change after the beta.
- Set the beta version to `1.0.0-beta` wherever the beta version is written or checked; number packages `1.0.0-beta.N`.

Beta means no breaking redesign is planned and remaining limitations are documented. Breaking changes after beta require migration guidance.

<a id="open-decisions"></a>

## Open decisions

The decisions taken while implementing were reviewed together, and the outcome of each is in [decisions](decisions.md#implementation-decisions-reviewed): the rules they settled are stated in the specification, and the questions they left open are below.

Two open decisions are recorded. The first: a module that declares a type spelled as one of Nexo's own, as `Home.Number`, can't name Nexo's own type of that name in its own declarations, since [type name lookup](../spec/language/types.md#types-type-name-lookup) finds the module's own first and Nexo's own types have no qualified spelling. Giving Nexo a permanent namespace for that was declined; the limitation stands until another spelling is chosen.

The second: a type parameter's default is checked at registration to be data, and against what the parameter binds to nowhere, since resolution checks the arguments a call gives and passes a default left out as it is, so `0` reaches an implementation whose `T` is `String`. Whether resolution refuses such a call, or a parameter of a type parameter takes no default, is open.

These gaps between the specification and the code, found by audits and by the review above, are each open until decided:

- **Parameter defaults.** [Null arguments](../spec/language/members.md#nullability-a-null-argument-follows-the-parameter) make propagating null a parameter's default, and a parameter required unless marked optional, while `createModule` requires `required` and `nulls` of every parameter (NEXO4536), and only the [declaration helpers](../spec/runtime/members.md#members-declaration-helpers) supply defaults.
- **`distinctBy`'s key.** [List members](../spec/language/collections.md#collections-list-members) refuse a key of no key type that `distinctBy` gives (NEXO3083), while the resolver refuses one only where a call answers a dictionary, so `xs.distinctBy({ a = it })` is accepted.
- **Membership of other values.** `contains`, `indexOf`, `distinct` and `distinctBy` compare by [key equality](../spec/language/collections.md#collections-dictionaries-and-pairs), which defines none for an object, a list or a structured value, while the evaluator compares those by identity, so `[[1], [1]].distinct.count` is 2.
- **A dictionary's metadata.** [Provenance](../spec/runtime/evaluation.md#runtime-results-provenance) gives a list's lineage through filtering and reordering alone, while the collections proposal's decision 9 keeps a retained entry's metadata too; a dictionary's `where` and `select` record none.
- **Codes.** NEXO5012 is raised for an ambiguous deferred selection and for each argument a selected member can't take, and for a value of `Any` an extension access is given outside the extension's target, conditions its catalogue row doesn't name, against the rule that distinct conditions never share a code; NEXO3045, NEXO3065, NEXO4021 and NEXO4067 are catalogued and never raised.
- **Declarations.** `createPredicateParameterDeclaration` takes no options, which `nexo.d.ts` declares; a member helper drops `internal` and passes `invokedBy` to a property, which `createModule` then refuses; a value parameter's `context` is never checked; and a type's copy keeps a key holding `undefined`, which [valid declarations](../spec/runtime/modules.md#modules-declarations) count as left out.
- **Errors.** `NexoError` exposes `syntax`, `module` and `locate`, beside the three factories `nexo.d.ts` declares, and result paths are validated by `nexo.paths.validate` alone, never by `typeAt` and `valueAt`.
- **A bound extension reference.** A reference such as `let k = words:Words.keep` is called by its member's rules, but takes values alone: `k(it.length > 1)` is refused (NEXO3010). Should it take its member's argument kinds, as a held reference to a module's function does?
- **A space after `:`.** `f(a: B.c)` is refused as a named argument (NEXO1012) while `f(a:B.c)` is an extension access, and `count: it.devices.count` reads as one at the top level. Should a space decide between them, though trivia never matters elsewhere?
- **Collections a host supplies.** A declared binding and a host call's supplied value accept a map and a `{ key, value }` object, but refuse a set (NEXO2045, NEXO5015), which an undeclared binding and a member's answer accept. Should capture accept a set too?
- **An arrow function as a collection item.** `[x => 1]` gives the structure error NEXO2027, where the catalog gives text the syntax error NEXO1057, as `{ a = x => x }` does. Which code is right?

Deferred items below require their stated trigger before design or implementation resumes.

<a id="deferred"></a>

## Deferred

| Work | Why it waits | Reopened by |
| --- | --- | --- |
| Collection conversions, `values to List` and `entries to Dictionary` | Collections are constructed by members; conversions to or from a collection would extend conversion targets and contracts. | A use members do not serve |
| Unions of structured types | One shape of nullable fields, and a field telling which of them a value fills, holds data of several families, its consumer validating each family; a union would need a notation, narrowing and a projection rule of its own. | A host whose data no one shape holds |
| Rounding a number to decimal digits | Rounding a binary value's decimal expansion is a contract of its own; a step is written by arithmetic around `round`. | A host that needs digits a step can't give |
| Explicit application identity, `identifyBy` | Sources and lineage serve the collection foundation; identities apart from keys and sources need scoping rules of their own. | A host that matches by identities its sources cannot give |
| Incremental reparsing, specialized tree machinery, and a public tree schema shared by C# and JavaScript | No tool needs them yet. | A concrete tooling need |
| Expression, predicate, and function arguments to host calls | Prepared arguments are values retained by the host; callbacks need an evaluation context and lifetime. | A host call that must call back into its script, with that context and lifetime designed |
| An extension targeting several types | Each extension has one target, and reusing a declaration in an extension for each target serves current cases. | Many repeated members across unrelated types |
| Selecting a module's operator when several compete | No syntax selects an operator by module; qualified calls cannot reach operators. | Competing operators in real use |
| Structured-data casts, reference/data conversions, and operators beyond `cast` and `convert` | Each needs rules for checking and copying. | A use the two operators do not serve |
| Object-typed parameter defaults, under the ordinary compatibility rules | No parameter can be object-typed while an object type has no notation a declaration writes. | An object type's notation in declarations |
| A value of `Any` a callback contract passes to a function reference whose parameter declares a concrete type, which [assignability](../spec/language/types.md#types-assignability) accepts and checks | Nothing stands between a callback and the reference's implementation to check what it is called with, so such a reference is refused with NEXO3036. | A host whose callback contract passes `Any` to a typed reference |
| A function given to a deferred call, as [deferred member selection](../spec/language/types.md#types-any-deferred-selection) accepts one | A function's reading is the declaration's, chosen only as the call is evaluated, so a deferred call takes values alone. | A host whose deferred call needs one |
| Calling a module's internal declarations through Nexo | JavaScript implementations can reach their own values directly. | An internal-call API with a defined module context |
| Wrapping canonical text by width | `format` follows the structural layout alone and never wraps; a width needs a layout policy of its own that keeps canonical text deterministic and every one-line construct whole past it | A host or a tool that needs text kept within a width |
| Equality of structured values, objects and lists, as keys, members and distinct items | Key equality covers numbers, strings, Booleans, references and null; the equality of the rest needs its hashing, type identity and capture designed together | A host whose keys or distinct items are data of those kinds |

<a id="temporary-implementation-coverage"></a>

## Temporary implementation coverage

Conditions the implementation reports that no catalog holds, each coded so every diagnostic it throws carries a code until the work that removes the condition lands. None remains: the last, conditions of language `1.0.0-alpha.33` alone, retired as their replacements landed. Such a code stays out of the specification's catalogs, retires to the retired codes of its catalog, [the language's](../spec/language/errors.md#diagnostics-retired-codes) or [the runtime's](../spec/runtime/errors.md#runtime-retired-codes), when the work that removes its condition lands, and is never reused.
