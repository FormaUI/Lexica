# Proposal: clarify responsibilities and unify terminology

**State: accepted.** Not implemented. Its [ledger](responsibilities-and-terminology-ledger.md) records each concept's responsibility, the action proposed for it and its compatibility, and which of them are reviewed. It is the prerequisite stage of [unit 1](../features-status.md#unit-1--declarations-and-the-type-model), before the declaration model's dependent work.

## 1. Purpose and priority

Before continuing the planned declaration migration or adding further features, clarify the conceptual boundaries and terminology throughout Lexica.

The current discussion exposed several sources of confusion:

- Module declarations and script constructs are sometimes described as though they were the same thing.
- Declarations, accesses, implementations, and runtime values sometimes share names that conceal their different roles.
- Equivalent operations sometimes receive different names because of their syntax, origin, or implementation path.
- Operations sometimes perform responsibilities their names do not reveal.
- Language terminology, public APIs, grammar, definitions, and implementation identifiers do not consistently describe the same model.

The objective is to establish a coherent model and reflect it throughout the project.

This is prerequisite work. It must not be postponed until after the broader declaration migration.

Where a particular correction requires separating shared code, perform the necessary separation as part of this prerequisite work. Do not require completion of an entire feature stage merely to clarify its responsibilities.

This proposal describes intended work, not completed implementation.

## 2. Governing principle: distinguish what matters and unify what is equivalent

Use one term and one shared contract wherever things represent the same concept.

Introduce separate terms when a difference in meaning, behavior, or responsibility requires someone to treat the things differently. Explain that difference explicitly.

Different syntax, declaration origins, processing stages, or implementation paths do not automatically establish different concepts.

For every distinction, ask:

1. What meaningful difference does it express?
2. Who needs to know about that difference, and why?
3. Can one concept and contract cover both cases?
4. Can the variation be represented as context or attributes?
5. Is the distinction needed only inside one implementation component, or does it belong in the public language model?

Preserve necessary implementation distinctions locally. Do not automatically promote them into separate language concepts, public contracts, or terminology.

Conversely, do not merge things merely because their current representations look alike. A declaration, an access expression, and the resulting value have different responsibilities even if all three happen to be represented by JavaScript objects.

**Clear boundaries and conceptual simplicity are complementary goals: distinguish genuinely different things, and stop naming the same thing several different ways.**

## 3. Scope: the entire codebase

Apply this pattern throughout:

- Module declarations and declaration helpers.
- Registries and declaration lookup.
- Types and type information.
- Script syntax, tokenizing, and parsing.
- Syntax trees and script definitions.
- Scope, bindings, and name resolution.
- Type checking and preparation.
- Compilation and executable representations.
- Evaluation and implementation invocation.
- Runtime values and supported mutation.
- Observation and disposal.
- Errors, diagnostics, and locations.
- Public APIs and type declarations.
- Specification, glossary, guides, examples, comments, and tests.

Properties and function calls are examples that exposed the problem. They do not define the scope of the work.

The namespaces, methods, and representations illustrated below are examples of the naming pattern. They are not instructions to introduce those exact APIs everywhere.

Concrete renames already selected, such as `declarationKey`, remain explicit requirements.

## 4. Clarify the responsibilities

Distinguish these roles where the distinction is relevant:

| Role | Responsibility |
| --- | --- |
| Module declaration | Describes a type, member, or other contract contributed by a module |
| Module implementation | Supplies executable behavior for a declared operation |
| Script syntax | Expresses what the script author writes |
| Script definition | Represents the script in its structured definition format |
| Preparation | Resolves names, types, and operations and establishes information needed for execution |
| Compilation | Transforms a representation into an executable form, such as the evaluator's closures |
| Runtime execution | Evaluates expressions, invokes implementations, manages values and observations |
| Diagnostic metadata | Identifies and explains a problem in the relevant source or configuration |

These roles are not a requirement for one namespace, class, or directory per row.

A single operation may legitimately coordinate several responsibilities. Its contract must make that coordination clear.

Separate responsibilities where doing so improves correctness or clarity. Do not introduce layers solely to mirror this table.

## 5. Modules versus scripts

A module contributes declarations and implementations.

A script uses the language to declare locals and functions, construct values, access members, and invoke operations.

A module declaration does not become a script declaration because a script can use it.

For example, this JavaScript declaration helper describes a property belonging to a structured type:

```javascript
lexica.declarations.createStoredPropertyDeclaration('temperature', 'Number')
```

This Lexica expression constructs an object:

```lexica
{
    temperature = 25,
    humidity = 60
}
```

The first describes a data contract. The second supplies object-field values.

The object expression does not itself declare a structured type named `Climate`. Its compatibility with a declared type follows the existing construction, compatibility, and conversion rules.

Use script-related names for actual script constructs and their representations. Use module-related names for declarations and implementations contributed by modules.

Do not invent a separate conceptual category for every way a script obtains a value contributed by a module.

## 6. Language versus runtime

The language defines:

- Syntax.
- Names and scope.
- Types and compatibility.
- Resolution rules.
- Evaluation semantics.
- Required errors.

The implementation includes the parser, resolver, type checker, evaluator, and other components that implement those rules.

The runtime carries out execution, including value handling, implementation invocation, observations, and execution lifecycle management.

The parser and resolver are not “the language” itself. They implement language rules.

Likewise, a check performed during evaluation can still enforce a language rule.

Keep these distinctions clear without making them artificial walls. Module implementations execute through the runtime, and scripts depend on declarations during preparation and execution.

Use a version name that identifies what is actually versioned. If `versions.runtime` identifies the release of the entire implementation, `versions.implementation` is the more accurate name.

## 7. Naming pattern: owner, operation, subject

An operation's owner and name should together communicate:

> Who owns this responsibility, what operation occurs, and what it concerns.

Illustrative examples:

```javascript
moduleDeclarations.getPropertyDeclaration(...)
moduleDeclarations.getPropertyType(...)
moduleDeclarations.defineProperty(...)
moduleDeclarations.createProperty(...)

runtime.readProperty(...)
runtime.writeProperty(...)
```

These examples distinguish declaration lookup, type-information lookup, declaration construction, and runtime value access.

They do not require:

- A universal `runtime` object.
- Combining factories and registry lookups in one namespace.
- Introducing write operations where mutation is unsupported.
- Creating every operation shown in the examples.

The actual owner follows the code's responsibility. A registry lookup belongs to the registry if that is where the responsibility resides.

Present related examples consistently with their owners. Do not qualify one operation while presenting another as an unexplained global function.

Names may rely on meaningful enclosing context without repeating every qualifier. Explicit object-field naming remains a specific requirement.

## 8. Operation verbs

| Verb | Intended meaning |
| --- | --- |
| `define` | Establish or describe a contract |
| `create` | Construct a representation or instance |
| `get` | Retrieve an existing declaration, descriptor, or specifically named information |
| `read` | Obtain a value from its source |
| `write` | Assign a value where supported |
| `parse` | Interpret source syntax into a representation |
| `scan` | Scan source into tokens or identify lexical structure |
| `resolve` | Determine which name, type, or declaration applies |
| `validate` | Check compliance with a contract |
| `prepare` | Establish what is needed for execution |
| `compile` | Transform a representation into an executable form |
| `evaluate` | Execute an expression to obtain its result |
| `invoke` | Call a selected implementation |
| `register` | Add an item to a registry |
| `observe` | Establish change tracking |
| `dispose` | Release resources or end a lifecycle |
| `quote` / `format` | Produce the corresponding textual representation |

This table guides consistent usage. It is not a whitelist, and it does not prohibit ordinary terms such as reading source text.

For property operations, the intended distinction is:

- `getPropertyDeclaration`: retrieves the declaration.
- `getPropertyType`: retrieves specific type information.
- `readProperty`: obtains the property's value.
- `writeProperty`: assigns the property's value where permitted.
- Declaration helpers produce declarations rather than reading or assigning runtime values.

Apply this distinction to equivalent operations elsewhere.

Do not offer ambiguous names such as `getProperty` as interchangeable alternatives for declaration lookup and runtime value reading.

Do not introduce paired operations simply because their names form a familiar pair.

## 9. Review behavior as well as names

A naming pass cannot resolve unclear responsibilities by attaching narrower names to unchanged mixed behavior.

For example:

- A predicate may also record inferred type arguments.
- A validator may also normalize or copy its input.
- A callback factory may also register lifecycle state.
- An operation may either evaluate a script function body or invoke a module implementation.

For each case, choose an explicit disposition:

1. Keep the combined operation and give it an accurate name and contract.
2. Separate the responsibilities where the distinction matters.
3. Unify the paths under a common concept where they implement the same contract.

Do not assume every combined operation must be split. Do not leave every difficult operation as “recorded, not redesigned.”

Predicates that mutate inference state deserve particular attention. Merely changing `matchType` to `matchesType` does not explain the state change.

## 10. Function calls illustrate conceptual unification

A function call invokes a function.

These expressions obtain the function differently:

```lexica
find()
Home.device()
room.find()
```

The function may come from a binding, a namespace member, or a receiver's member. A receiver may need to be supplied.

Those differences matter to resolution and execution, but they do not automatically justify separate function-call concepts or duplicated invocation contracts.

The common contract should describe a function call and carry whatever information execution requires, including arguments and an applicable receiver.

The review must examine whether currently separate representations and paths can share that contract.

Different grammar productions may still be useful for parsing the written forms. That does not require a separate public semantic category for each production.

Likewise, the origin of a function does not determine a new kind of call. A function held by a local may have originated in the script or in a module.

**This is an example of the general rule. If it looks like a duck, walks like a duck, and quacks like a duck, it's a duck. Apply the same examination to every comparable distinction found in the codebase.**

## 11. Properties illustrate a meaningful contract distinction

Stored properties and properties backed by implementations are both properties.

They share the member kind `property`, and scripts access them through the same property-access forms.

Their declaration contracts differ meaningfully:

| Rule | Stored property | Property backed by an implementation |
| --- | --- | --- |
| Value source | Data held by the structured value | Its implementation |
| `impl` | Refused | Optional; omission supports resolution-only use |
| `updates` | Refused | Required |
| Declaration location | Directly in a structured type | On a type or in an extension, where permitted |
| Contributes to stored shape | Yes | No |

This distinction matters when declaring, validating, copying, and freezing structured values. It need not create different property-access concepts for script authors.

Under the supplied declaration contract:

- A property directly in a structured type is stored when `updates` is absent.
- Presence of `updates` identifies the implementation-backed form.
- The stored form refuses `impl`.
- A property declared elsewhere requires `updates`.
- Missing `impl` alone does not identify a stored property.

The declaration helpers are:

```javascript
lexica.declarations.createStoredPropertyDeclaration(name, type)
lexica.declarations.createPropertyDeclaration(name, result, options)
```

Both produce property declarations. Neither immediately obtains or assigns a property's runtime value.

Structured-value immutability remains unchanged. An illustrative `writeProperty` operation does not introduce mutation where none is supported.

Extensions may add implementation-backed properties, but not stored properties that alter the required data shape of another type.

## 12. Declared members and access expressions

A declared member and an expression accessing that member have different roles.

Keep the grammar terms:

- `dot-property-access`
- `computed-property-access`
- `member-call`
- `extension-access`

Rename the grammar production `indexer` to `indexer-access`.

The declaration kind remains `indexer`.

Retaining a parsing production such as `member-call` does not settle whether the definition and evaluator need a distinct call concept. That question follows the common-contract review.

### Current access syntax

| Access | Syntax | Optional syntax |
| --- | --- | --- |
| Dot property access | `value.temperature` | `value?.temperature` |
| Computed property access | `value.[name]` | `value?.[name]` |
| Indexer access | `value[key]` | `value?[key]` |
| Extension property access | `value:Extension.temperature` | `value?:Extension.temperature` |
| Extension indexer access | `value:Extension[key]` | `value?:Extension[key]` |

The dot before `[` distinguishes computed property access from indexer access. The colon introduces extension access.

“Computed” in `computed-property-access` describes the property name coming from an expression. It does not describe the source of the property's value.

### Shared access representations

The surveyed definition node `member` currently covers several uses, including property access and references to other members.

Do not rename it `propertyAccess` while it still represents non-property selections.

Determine whether these uses share one member-access contract or require distinct representations. Use a common name where the responsibility is common.

Do not split a representation solely to obtain narrower names, or retain a misleading name solely to avoid examining its responsibility.

## 13. Object-field terminology

Use **object field**, or **an object's field** where possession reads naturally, for object-expression entries and corresponding object-field data.

Use explicit `objectField` terminology in code.

| Concept | Term |
| --- | --- |
| Object expression entry or corresponding object data | object field |
| Configuration key in a declaration | declaration key |
| Configuration key in module contents | module key |
| Stored member of a structured type | stored property |
| Property of a definition or metadata record | property |
| JavaScript object's property | property |

Classify each occurrence by meaning.

A JavaScript representation of a structured value does not make its stored properties Lexica object fields.

Preserve established naming conventions for different representations:

- Grammar production: `object-field`.
- Syntax-node kind: `object-field`, consistent with the surveyed syntax tree.
- Definition key: `objectFields`.
- Internal object-field resolution kind: `objectField`, once it exclusively represents object fields.

## 14. Module-error locations

Rename:

```text
location.field → location.declarationKey
```

Example JavaScript location record:

```javascript
{
    module: 'home',
    declaration: 'brightness',
    declarationKey: 'result'
}
```

`declarationKey` is an optional string identifying the configuration associated with the error.

It can identify:

- A direct key.
- An expected but missing key.
- An unsupported supplied key.
- An existing dotted location.
- A module-level key when `declaration` is absent.

Examples include `result`, `impl`, `updates.misses`, `parameters.default`, `colour`, and `types`.

It is not a closed enumeration, because invalid keys must remain representable.

Preserve existing dotted locations during the rename. A precise indexed and escaped path format remains a separate proposal.

Use direct wording:

> In module 'home', declaration 'brightness': 'result' must name a valid type.

A generic suffix may say:

> at 'updates.misses'

Terminology-only changes preserve diagnostic conditions and codes.

## 15. Concrete mappings already identified

The following are concrete applications rather than illustrative namespace designs:

| Current | Proposed |
| --- | --- |
| Definition object node `fields` | `objectFields` |
| `LexicaDefinitionField` | `LexicaDefinitionObjectField` |
| Result metadata `fields` | `objectFields` |
| `/expression/fields/0/value` | `/expression/objectFields/0/value` |
| Module-error `location.field` | `location.declarationKey` |
| Object-field syntax-node kind `field` | `object-field` |
| Grammar `field`, `field-name` | `object-field`, `object-field-name` |
| Grammar and syntax-node `indexer` | `indexer-access` |
| Parser `#parseIndexer` | `#parseIndexerAccess` |

The survey also identified corrections that follow actual responsibilities:

- Use `objectFieldValue` when a variable holds a value rather than an object-field representation.
- Use `isObjectRootField` where the flag specifically concerns participation in the object root.
- Use `#objectRecordCache` where the collection caches object records.
- Use `getDeclaringModuleName` when the result is the name of the declaring module.
- Use declaration-returning names such as `getStructuredTypeDeclaration` where the result is a declaration rather than a type object.

Object-field names must not be assigned to operations that still handle structured properties.

Where one lookup serves different type contracts, separate it by them: ResultPath's name-based type lookup becomes an object field's type lookup and a stored property's, though their runtime reads share an implementation.

Keep already explicit names such as:

- `objectRootField`
- `objectRootFields`
- `resolveObjectRootField`
- `readObjectRootField`

The full ledger must preserve these distinctions and extend the pattern to all relevant uses.

## 16. Public API and definition changes

Public names should identify actual results and responsibilities.

Examples from the survey include:

- `createBindings` for constructing bindings.
- `bindings.readValue` for reading a bound value.
- `bindings.getType` for obtaining its type.
- `getLocation` for retrieving location information.
- `paths.validate` for validation.
- `prepareHostCall` for preparing the host invocation.
- `LexicaEvaluationHooks` for the hooks supplied to an evaluation.

These recommendations must be checked against their complete contracts, including side effects.

Do not assume that every serialized node needs its own new concept because the current implementation has a distinct code path. Settle the common model before selecting serialized names.

Result metadata is a public execution API, not part of the serialized definition. Its `objectFields` rename should land with its producers, consumers, public types, documentation, and tests.

Serialized definition changes land together at an explicit version boundary. For the surveyed version plan:

- Definition 33 retains its existing meaning while supported.
- Definition 34 introduces its revised shape with readers, writers, types, fixtures, and pointers.
- If the boundary moves, move the complete change together.

Never give one definition version two different meanings.

## 17. Review process and ledger

For each relevant concept or operation, record:

1. Current name and location.
2. Actual owner and responsibility.
3. Inputs, outputs, and side effects.
4. Relationship to existing concepts.
5. Whether a distinction is meaningful or incidental.
6. Proposed action.
7. Public or serialized compatibility impact.
8. Dependencies and validation needed.

The action may be:

- Keep the existing name.
- Rename it.
- Unify terminology or contracts.
- Consolidate equivalent behavior.
- Separate genuinely different responsibilities.
- Document a legitimate combined operation.
- Remove verified unused internal code.
- Fix a defect separately.

Do not treat a rename as the default answer to every finding.

Do not consider the work complete merely because all rows in the initial naming ledger have been changed.

Unreviewed proposals remain unreviewed; absence of an objection is not a substitute for resolving an unclear contract.

## 18. Defects and unrelated semantic decisions

The survey identified actual defects alongside terminology problems, including incorrect parser diagnostic text and obsolete access syntax in messages.

Fix those as defects, preserving the distinction between behavioral corrections and renames.

Verify that apparently unused code is not part of a public or dynamically accessed contract before removing it.

Keep unrelated semantic decisions explicit, including:

- Extension specificity.
- Built-in generic type ownership.
- Internal type exposure.
- Operator type parameters.
- Intentional hiding and its acknowledgment mechanism.

This prerequisite work should clarify the concepts those decisions depend on. It must not silently decide them through naming changes.

## 19. Documentation and repository conventions

Record the governing principles, roles, and operation naming conventions in the repository's contributor instructions.

Record language concepts and their meanings in the specification and glossary.

Maintain the review ledger as a tracked proposal so that responsibilities, decisions, and outstanding questions remain reviewable.

Use the same vocabulary across code and documentation.

Examples must identify their language and use current syntax:

- JavaScript configuration uses JavaScript object syntax.
- Lexica object fields use `=`.
- Lexica computed property access uses `.[expression]`.
- Lexica indexer access uses `[expression]`.
- Lexica extension access begins with `:`.

Update headings, anchors, and references with the terminology changes. Preserve historical literal spellings where necessary to explain retired formats.

## 20. Implementation order

This work is the prerequisite stage:

1. Establish the conceptual model and shared terminology.
2. Review existing boundaries and distinctions throughout the codebase.
3. Resolve the responsibilities currently recorded as unclear or mixed.
4. Produce the concrete change ledger.
5. Perform prerequisite separations or consolidations.
6. Apply coherent naming and contract changes.
7. Update public types, diagnostics, documentation, examples, and tests alongside each change.
8. Land serialized changes at their version boundary.
9. Complete the consistency review and required checks.
10. Resume dependent declaration and feature implementation.

Do not postpone the responsibility review until after stage 1.

Where a change depends on work previously assigned to stage 1, bring the necessary part into the prerequisite stage rather than making the entire stage a prerequisite.

Each implementation unit should be coherent, reviewable, and validated.

## 21. Completion criteria

The work is complete when:

- Module contributions and script constructs have clear responsibilities.
- Language rules and runtime execution are described accurately.
- Equivalent concepts use shared terminology and contracts.
- Separate terms express meaningful differences.
- Syntax and implementation details do not unnecessarily multiply semantic categories.
- Declarations, accesses, implementations, and values remain distinguishable where necessary.
- Operations' owners, outputs, and side effects are clear.
- Difficult mixed-responsibility operations have an explicit resolution.
- Naming examples have been applied as a pattern throughout the codebase.
- No illustrative API has caused unsupported operations or abstractions to be invented.
- Object fields, declaration keys, and member accesses use the agreed terminology.
- Public and serialized changes have coherent compatibility boundaries.
- Renames preserve behavior and diagnostic identities unless a separate change explicitly says otherwise.
- Specification, code, public types, examples, and tests describe the same model.
- Required formatting, unit, and applicable browser checks pass.

The goal is a codebase with fewer ambiguous boundaries and fewer unnecessary distinctions—not simply more descriptive names.
