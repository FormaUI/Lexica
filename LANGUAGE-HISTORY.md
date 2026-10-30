# Language history

Each version of the Nexo language, newest first, with what it changed. A language version names the [specification](spec/README.md)'s whole contract, the [language](spec/README.md#the-language) a script is written in and the [runtime](spec/README.md#the-runtime) a host builds on, so an entry lists the changes to both; the definition format, the JSON a host and its tools exchange, has a version of its own, which each entry names. Each version is dated by the day the specification first described it, and each change stands in the first version whose implementation follows it, linking the section of the specification that states it now.

Until the beta, a version may break what the one before it allowed, and each entry says what it breaks.

<a id="v1-0-0-alpha-39"></a>

## `1.0.0-alpha.39`

*October 30, 2026 · definition format 36*

**Language**

- A value's actual type, by which a member is selected as the value is evaluated, is stated: a reference's by recognition, a structured value's by its declared result, a list's by the type its items share, and an object's by its fields. [Deferred member selection](spec/language/types.md#types-any-deferred-selection)
- A member an imported type inherits is read on any receiver it applies to, a supertype's among them, and a type selector's key needs no import of its own. [Imports](spec/language/modules.md#scripts-imports)
- A function used as a value is a function reference, whatever declares it; the term *delegate* is retired. [Function references](spec/language/functions.md#functions-references)

**Runtime**

- The host API is named for Nexo: `nexo`, `NexoError`, and each type beginning `Nexo`. [Hosting Nexo](spec/runtime/hosting.md)
- The host API a host reached only through the type declarations is specified: what a resolution answers, result paths, locations, what each hook receives and answers, the module object and the registry's queries, every parameter declaration key and the declaration helpers, how observations are declared, and the error object, its factories and its locations. [Resolution](spec/runtime/resolution.md), [evaluation](spec/runtime/evaluation.md#runtime-evaluation), [members](spec/runtime/members.md#members-declaration-helpers), [errors](spec/runtime/errors.md)
- A definition orders its imports by their local names' UTF-16 code units. [The definition](spec/runtime/definition.md#definition)

**Specification**

- The specification is organized as its two contracts, the language's and the runtime's, each with its glossary and its error catalog, and collections and extensions are each a document of their own.

**Breaking:** a host imports `nexo` and `NexoError`, and names each type `Nexo…`, in place of the API's former names.

<a id="v1-0-0-alpha-38"></a>

## `1.0.0-alpha.38`

*October 29, 2026 · definition format 36*

**Language**

- The language is named Nexo, its diagnostic codes `NEXO` and four digits, and its own module `Nexo`, which no script imports. [Imports](spec/language/modules.md#scripts-imports), [codes](spec/runtime/errors.md#diagnostics-codes)

**Runtime**

- Definition format 36 refuses an import of `Nexo`. [The definition](spec/runtime/definition.md#definition)

**Breaking:** every diagnostic code begins `NEXO`, the language's own module is `Nexo`, and an implementation reads definitions of format 36 alone.

<a id="v1-0-0-alpha-37"></a>

## `1.0.0-alpha.37`

*October 29, 2026 · definition format 35*

**Language**

- `is`, `has` and `supports` are removed: a module declares the tests of a receiver its domain needs, as Boolean functions. [Boolean functions](spec/language/vocabulary.md#vocabulary-boolean-functions)
- A structured value keeps its type through `Any`. [A value keeps its identity](spec/language/types.md#types-any-identity)

**Runtime**

- A declared binding type refuses `Any`, `Never` and a position anywhere in its data, and captured data that reaches itself is refused. [Bindings](spec/runtime/bindings.md#runtime-bindings)
- Registering a module that declares `typeOf` makes stale only the resolutions that may recognize values. [Reusing a resolution](spec/runtime/resolution.md#runtime-reuse)

**Breaking:** a script that called `is`, `has` or `supports` calls a Boolean function its module declares instead.

<a id="v1-0-0-alpha-36"></a>

## `1.0.0-alpha.36`

*October 29, 2026 · definition format 35*

**Language**

- An object expression written where a structured type is declared constructs a value of it. [Constructing a structure](spec/language/types.md#types-constructing-a-structure)
- Numbers have members: `round`, `floor`, `ceiling`, `truncate`, `abs`, `min`, `max` and `clamp`. [Number members](spec/language/vocabulary.md#vocabulary-number-members)
- Strings have members: `length`, `trim`, `lowercase`, `uppercase`, `startsWith`, `endsWith`, `contains`, `indexOf`, `replace`, `split` and the slice `[range]`. [String members](spec/language/vocabulary.md#vocabulary-string-members)
- A list tells where an item stands, `indexOf` and `indexWhere`. [List members](spec/language/collections.md#collections-list-members)

**Runtime**

- A resolution stays current across every registration that can't change it, and says so, `resolution.isCurrent`. [Reusing a resolution](spec/runtime/resolution.md#runtime-reuse)
- A host declares a binding's data type, which captures the data as that type, a structured value among them. [Bindings](spec/runtime/bindings.md#runtime-bindings)

**Breaking:** nothing a script or a host wrote before.

<a id="v1-0-0-alpha-35"></a>

## `1.0.0-alpha.35`

*October 28, 2026 · definition format 35*

**Language**

- Dictionaries and pairs, addressed by keys of a key type compared by one exact equality. [Dictionaries and pairs](spec/language/collections.md#collections-dictionaries-and-pairs)
- Collection expressions write a list, `[1, 2]`, or a dictionary, `["coffee" = 3]`, where a value stands. [Collection expressions](spec/language/collections.md#collections-collection-expressions)
- The members of lists and dictionaries: selecting, searching, aggregating, partitioning, joining, grouping and constructing dictionaries. [List members](spec/language/collections.md#collections-list-members), [dictionary members](spec/language/collections.md#collections-dictionary-members)
- Positions: an index from the end, `^n`, a range, `start..end`, a list's slice, `pick` and a number's `sequence`. [Positions](spec/language/collections.md#collections-positions)
- Ordering a list by keys, `orderBy` and `thenBy`, stably, each key evaluated once. [Ordering](spec/language/collections.md#collections-list-ordering)

**Runtime**

- A result records each projected item's lineage, kept through filtering, reordering, slicing and `pick`. [Results and their metadata](spec/runtime/evaluation.md#runtime-results-provenance)
- An implementation receives and gives collections in a host's forms, a set, a map and a key with its value. [A value in a host's form](spec/runtime/evaluation.md#runtime-host-forms)
- Definition format 35 records collection expressions, indices and ranges. [The definition](spec/runtime/definition.md#definition)

**Breaking:** an implementation reads definitions of format 35 alone.

<a id="v1-0-0-alpha-34"></a>

## `1.0.0-alpha.34`

*October 22, 2026 · definition format 34*

**Language**

- A script imports the modules and the types whose vocabulary it uses, under aliases where it chooses, and resolution reaches only what they make available. [Imports](spec/language/modules.md#scripts-imports)
- Extensions: a member of the type's owner wins over every extension, the most specific extension otherwise, and an extension access selects one explicitly, `device:Device.usage`. [Owners and extensions](spec/language/extensions.md#extensions-owners), [extension access](spec/language/extensions.md#extensions-access)
- Type parameters a declaration declares, inferred at each call. [Type parameters](spec/language/types.md#types-type-parameters)
- `Any`, whose members are selected as the value is evaluated. [Values of `Any`](spec/language/types.md#types-any)
- Reference types in hierarchies, cast within them and across them by declared casts, and conversions as operators that compete as members do. [Reference types](spec/language/types.md#reference-types), [casts](spec/language/types.md#casts), [conversions](spec/language/values.md#conversions)
- Line structure: where a line may break, must break and can't. [Line structure](spec/language/lexical-structure.md#line-structure)
- A module's name is unique whatever its case, and the casing of names is a convention, never enforced. [Type names](spec/language/types.md#types-type-names)

**Runtime**

- The declaration model: a type holds its members, as a reference, a structured type or an extension, beside operators, internal declarations and each member's `impl`. [Declaring a type](spec/runtime/modules.md#modules-declaring-a-type), [extensions](spec/runtime/extensions.md#extensions-declaring), [internal declarations](spec/runtime/modules.md#modules-internal-declarations)
- Bindings recognize references by every module's `typeOf` and check membership by `isInstance`. [Reference types](spec/runtime/modules.md#runtime-reference-types)
- A type selector's keys are mappings any module declares. [Type selectors](spec/runtime/type-selectors.md#runtime-type-selectors)
- A resolution reports its deferred accesses and its candidate declarations. [Resolution](spec/runtime/resolution.md#runtime-bindings-and-resolution)
- Every diagnostic has a code. [Codes](spec/runtime/errors.md#diagnostics-codes)
- `quote` writes compact, parseable text, and definition format 34 records imports, extension selections and the renamed nodes. [Canonical text](spec/runtime/definition.md#definition-canonical-text), [the definition](spec/runtime/definition.md#definition)

**Breaking:** members declared flat with a target, the built-in DOM types and `bind` are removed, and a declaration takes its new shape; a script imports the modules whose vocabulary it uses; and an implementation reads definitions of format 34 alone.

<a id="v1-0-0-alpha-33"></a>

## `1.0.0-alpha.33`

*October 22, 2026 · definition format 33*

**Language**

- Indexers by the type: a named indexer, `x.name[k]`, a type's unnamed indexer, `x[k]`, and a property by a computed name, `x.[p]`. [Named indexers](spec/language/members.md#property-access-calls-and-indexers-named-indexers), [unnamed indexers](spec/language/members.md#property-access-calls-and-indexers-unnamed-indexers), [computed property access](spec/language/members.md#computed-property-access)
- A type is identified by its module, and a cast or a conversion names one qualified by it, `device as Home.Light`. [Type identity](spec/language/types.md#types-type-identity)

**Runtime**

- Definition format 33 records indexers, computed property access and qualified type names. [The definition](spec/runtime/definition.md#definition)

**Breaking:** a property read by a name an expression gives is written `x.[p]`, where it was `x[p]`, which now reads a type's unnamed indexer; and an implementation reads definitions of format 33 alone.

<a id="v1-0-0-alpha-1-to-32"></a>

## `1.0.0-alpha.1` to `1.0.0-alpha.32`

*Through October 21, 2026 · definition formats to 32*

The versions before the specification declared its version in one place, whose boundaries the record does not keep. Together they built the foundation:

- Scripts, their parameters a host binds, bodies and locals, objects and the object root, lists and null. [Scripts](spec/language/scripts.md#scripts), [values](spec/language/values.md)
- Expressions: tests, truthiness, equality, arithmetic, comparisons, logic, conditionals and conditional bindings, `do` blocks, coalescing, attempts, casts, conversions and interpolated strings. [Expressions](spec/language/expressions.md#expressions)
- Functions a script declares, regular and arrow, and references to a module's functions. [Functions](spec/language/functions.md#functions)
- Members, their arguments and their kinds, and host calls, which the host invokes and Nexo prepares and projects. [Members](spec/language/members.md), [host calls](spec/runtime/host-calls.md#runtime-host-calls)
- Modules and registries, type selectors, observations, bindings, resolution, evaluation with its hooks, results with their metadata, and the definition with its canonical text. [Modules](spec/runtime/modules.md), [observations](spec/runtime/observations.md#observations), [the definition](spec/runtime/definition.md#definition)
