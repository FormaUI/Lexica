# Language history

Each version of the Nexo language, newest first, with what it changed. A language version names the [specification](spec/README.md)'s whole contract, the [language](spec/README.md#the-language) a script is written in and the [runtime](spec/README.md#the-runtime) a host builds on, so an entry lists the changes to both; the definition format, the JSON a host and its tools exchange, has a version of its own, which each entry names. Each version is dated by the day the specification first described it, and each change stands in the first version whose implementation follows it, named by the section of the specification that states it now.

Until the beta, a version may break what the one before it allowed, and each entry says what it breaks.

<a id="v1-0-0-alpha-40"></a>

## `1.0.0-alpha.40`

*October 30, 2026 · definition format 37*

**Language**

- [Owners and extensions](spec/language/extensions.md#extensions-owners): `.` reads a type's own members and `:` its extension members, so the two never compete. `device.usage` is refused, giving `device:usage` (NEXO3090).
- [Extension access](spec/language/extensions.md#extensions-access): an extension member is read as `receiver:member`, `receiver:Extension.member` or `receiver:Module.Extension.member`, the last name always the member.
- [Extension access](spec/language/extensions.md#extensions-access): each name fills its role, whatever the spacing. Names that fit no form are refused (NEXO1071), never read as a shorter access.
- [Extension access](spec/language/extensions.md#extensions-access): a call or a key closes the access. Ordinary access on a bare member's answer is grouped, `(device:readings).first`.
- [Extension access](spec/language/extensions.md#extensions-access): a function reference bound to its receiver takes its member's argument kinds wherever it is called, a local holding it included.
- [Indexer selection](spec/language/modules.md#namespaces-indexers): `x[key]` reads the unnamed indexer of the receiver's owner alone, and an extension's named indexer is read as `x:name[key]`.
- [Collection expressions](spec/language/collections.md#collections-collection-expressions): an arrow function written as a list's item or a dictionary's value is a syntax error (NEXO1057), and an indexer's key is never a function (NEXO3082).

**Runtime**

- [Extensions](spec/runtime/extensions.md#extensions-declaring): an extension declares no unnamed indexer (NEXO4564).
- [Capturing a supplied value](spec/runtime/host-calls.md#runtime-host-calls-capturing): a set is captured as a list wherever a list is declared, in a declared binding and a host call's supplied value as in a member's answer, its items in their order and each checked.
- [The definition](spec/runtime/definition.md#definition): an extension access's `extension` is empty, `{}`, where the member alone is written, and an `indexerAccess` holds none.

**Breaking:**

- A script reads an extension member with `:`, where it read it with `.`.
- A colon after a name is an extension access wherever an expression stands, so `f(a: b)` is no longer refused as a named argument but read as one.
- A module's extension declares no unnamed indexer, and `x:Extension[key]` is no form.
- A definition is of version 37.

<a id="v1-0-0-alpha-39"></a>

## `1.0.0-alpha.39`

*October 30, 2026 · definition format 36*

**Language**

- [Deferred member selection](spec/language/types.md#types-any-deferred-selection): a value's actual type, by which a member is selected as the value is evaluated, is stated, a reference's by recognition, a structured value's by its declared result, a list's by the type its items share, and an object's by its fields.
- [Imports](spec/language/modules.md#scripts-imports): a member an imported type inherits is read on any receiver it applies to, a supertype's among them, and a type selector's key needs no import of its own.
- [Function references](spec/language/functions.md#functions-references): a function used as a value is a function reference, whatever declares it, and the term *delegate* is retired.

**Runtime**

- [Hosting Nexo](spec/runtime/hosting.md): the host API is named for Nexo, `nexo`, `NexoError` and each type beginning `Nexo`.
- [Resolution](spec/runtime/resolution.md): what a resolution answers, result paths and locations are specified.
- [Evaluation](spec/runtime/evaluation.md#runtime-evaluation): what each hook receives and answers is specified.
- [Members](spec/runtime/members.md#members-declaration-helpers): every parameter declaration key and the declaration helpers are specified.
- [Modules](spec/runtime/modules.md#modules-registries): the module object and the registry's queries are specified.
- [Observations](spec/runtime/observations.md#observations): how a member names its observations, and what an observation type's implementation answers, are specified.
- [Errors](spec/runtime/errors.md): the error object, its factories and its locations are specified.
- [The definition](spec/runtime/definition.md#definition): a definition orders its imports by their local names' UTF-16 code units.

**Specification**

- [The specification](spec/README.md): organized as its two contracts, the language's and the runtime's, each with its glossary and its error catalog, and collections and extensions are each a document of their own.
- [Decisions](docs/decisions.md#implementation-decisions-reviewed): behaviour the implementation already had is stated where the specification was silent, among it where a refused line break stands, compact text's indentation, and where an unnamed indexer's and a mapping's errors stand.

**Breaking:** a host imports `nexo` and `NexoError`, and names each type `Nexo…`, where it imported `lexica` and `LexicaError` and named each type `Lexica…`.

<a id="v1-0-0-alpha-38"></a>

## `1.0.0-alpha.38`

*October 29, 2026 · definition format 36*

**Language**

- [The specification](spec/README.md): the language Lexica is renamed Nexo.
- [Imports](spec/language/modules.md#scripts-imports): the language's own module is `Nexo`, which no script imports.
- [Codes](spec/runtime/errors.md#diagnostics-codes): every diagnostic code is `NEXO` and four digits.

**Runtime**

- [The definition](spec/runtime/definition.md#definition): definition format 36 refuses an import of `Nexo`.

**Breaking:** every diagnostic code begins `NEXO`, where it began `LEXICA`, the language's own module is `Nexo`, where it was `Lexica`, and an implementation reads definitions of format 36 alone.

<a id="v1-0-0-alpha-37"></a>

## `1.0.0-alpha.37`

*October 29, 2026 · definition format 35*

**Language**

- [Boolean functions](spec/language/vocabulary.md#vocabulary-boolean-functions): `is`, `has` and `supports` are removed, and a module declares the tests of a receiver its domain needs, as Boolean functions.
- [A value keeps its identity](spec/language/types.md#types-any-identity): a structured value keeps its type through `Any`.

**Runtime**

- [Bindings](spec/runtime/bindings.md#runtime-bindings): a declared binding type refuses `Any`, `Never` and a position anywhere in its data, and captured data that reaches itself is refused.
- [Reusing a resolution](spec/runtime/resolution.md#runtime-reuse): registering a module that declares `typeOf` makes stale only the resolutions that may recognize values.

**Breaking:** a script that called `is`, `has` or `supports` calls a Boolean function its module declares instead.

<a id="v1-0-0-alpha-36"></a>

## `1.0.0-alpha.36`

*October 29, 2026 · definition format 35*

**Language**

- [Constructing a structure](spec/language/types.md#types-constructing-a-structure): an object expression written where a structured type is declared constructs a value of it.
- [Number members](spec/language/vocabulary.md#vocabulary-number-members): `round`, `floor`, `ceiling`, `truncate`, `abs`, `min`, `max` and `clamp`.
- [String members](spec/language/vocabulary.md#vocabulary-string-members): `length`, `trim`, `lowercase`, `uppercase`, `startsWith`, `endsWith`, `contains`, `indexOf`, `replace`, `split` and the slice `[range]`.
- [List members](spec/language/collections.md#collections-list-members): a list tells where an item stands, `indexOf` and `indexWhere`.

**Runtime**

- [Reusing a resolution](spec/runtime/resolution.md#runtime-reuse): a resolution stays current across every registration that can't change it, and says so, `resolution.isCurrent`.
- [Bindings](spec/runtime/bindings.md#runtime-bindings): a host declares a binding's data type, which captures the data as that type, a structured value among them.

**Breaking:** nothing a script or a host wrote before.

<a id="v1-0-0-alpha-35"></a>

## `1.0.0-alpha.35`

*October 28, 2026 · definition format 35*

**Language**

- [Dictionaries and pairs](spec/language/collections.md#collections-dictionaries-and-pairs): addressed by keys of a key type, compared by one exact equality.
- [Collection expressions](spec/language/collections.md#collections-collection-expressions): a list, `[1, 2]`, or a dictionary, `["coffee" = 3]`, written where a value stands.
- [List members](spec/language/collections.md#collections-list-members): selecting, searching, aggregating, partitioning, joining, grouping and constructing dictionaries.
- [Dictionary and pair members](spec/language/collections.md#collections-dictionary-members): a dictionary's lookups, keys, values and entries, and its own selection.
- [Positions](spec/language/collections.md#collections-positions): an index from the end, `^n`, a range, `start..end`, a list's slice, `pick` and a number's `sequence`.
- [Ordering](spec/language/collections.md#collections-list-ordering): a list ordered by keys, `orderBy` and `thenBy`, stably, each key evaluated once.

**Runtime**

- [Provenance](spec/runtime/evaluation.md#runtime-results-provenance): a result records each projected item's lineage, kept through filtering, reordering, slicing and `pick`.
- [A value in a host's form](spec/runtime/evaluation.md#runtime-host-forms): an implementation receives and gives collections in a host's forms, a set, a map and a key with its value.
- [The definition](spec/runtime/definition.md#definition): definition format 35 records collection expressions, indices and ranges.

**Breaking:** an implementation reads definitions of format 35 alone.

<a id="v1-0-0-alpha-34"></a>

## `1.0.0-alpha.34`

*October 22, 2026 · definition format 34*

**Language**

- [Imports](spec/language/modules.md#scripts-imports): a script imports the modules and the types whose vocabulary it uses, under aliases where it chooses, and resolution reaches only what they make available.
- [Owners and extensions](spec/language/extensions.md#extensions-owners): a member of the type's owner wins over every extension, and the most specific extension otherwise.
- [Extension access](spec/language/extensions.md#extensions-access): selects an extension explicitly, `device:Device.usage`.
- [Type parameters](spec/language/types.md#types-type-parameters): declared by a declaration and inferred at each call.
- [Values of `Any`](spec/language/types.md#types-any): a value whose members are selected as it is evaluated.
- [Reference types](spec/language/types.md#reference-types): types in hierarchies, [cast](spec/language/types.md#casts) within them and across them by declared casts.
- [Conversions](spec/language/values.md#conversions): operators a type declares, competing as members do.
- [Line structure](spec/language/lexical-structure.md#line-structure): where a line may break, must break and can't.
- [Type names](spec/language/types.md#types-type-names): a module's name is unique whatever its case, and the casing of names is a convention, never enforced.

**Runtime**

- [Declaring a type](spec/runtime/modules.md#modules-declaring-a-type): a type holds its members, as a reference or a structured type, beside operators and each member's `impl`.
- [Extensions](spec/runtime/extensions.md#extensions-declaring): a module declares the members it adds to a type another module owns as an extension.
- [Internal declarations](spec/runtime/modules.md#modules-internal-declarations): a declaration its own module alone reaches.
- [Reference types](spec/runtime/modules.md#runtime-reference-types): bindings recognize references by every module's `typeOf` and check membership by `isInstance`.
- [Type selectors](spec/runtime/type-selectors.md#runtime-type-selectors): a selector's keys are mappings any module declares.
- [Resolution](spec/runtime/resolution.md#runtime-bindings-and-resolution): a resolution reports its deferred accesses and its candidate declarations.
- [Codes](spec/runtime/errors.md#diagnostics-codes): every diagnostic has a code.
- [Canonical text](spec/runtime/definition.md#definition-canonical-text): `quote` writes compact, parseable text.
- [The definition](spec/runtime/definition.md#definition): definition format 34 records imports, extension selections and the renamed nodes.

**Breaking:** members declared flat with a target, the built-in DOM types and `bind` are removed, and a declaration takes its new shape; a script imports the modules whose vocabulary it uses; and an implementation reads definitions of format 34 alone.

<a id="v1-0-0-alpha-33"></a>

## `1.0.0-alpha.33`

*October 22, 2026 · definition format 33*

**Language**

- [Named indexers](spec/language/members.md#property-access-calls-and-indexers-named-indexers): an indexer its type declares with a name, `x.name[k]`.
- [Unnamed indexers](spec/language/members.md#property-access-calls-and-indexers-unnamed-indexers): a type's indexer without a name, `x[k]`.
- [Computed property access](spec/language/members.md#computed-property-access): a property read by a name an expression gives, `x.[p]`.
- [Type identity](spec/language/types.md#types-type-identity): a type is identified by its module, and a cast or a conversion names one qualified by it, `device as Home.Light`.

**Runtime**

- [The definition](spec/runtime/definition.md#definition): definition format 33 records indexers, computed property access and qualified type names.

**Breaking:** a property read by a name an expression gives is written `x.[p]`, where it was `x[p]`, which now reads a type's unnamed indexer; and an implementation reads definitions of format 33 alone.

<a id="before-v1-0-0-alpha-33"></a>

## Before `1.0.0-alpha.33`

*October 9 to 21, 2026 · definition formats 1 to 32*

The language began inside DOMQL, and left it to stand alone before its versions were numbered:

- **DOMQL's query language,** October 9, 2026: a language for querying the DOM, read from text into a definition of format 1, which grew within DOMQL to definition format 30.
- **Lexica,** October 19, 2026: ported from DOMQL as an extensible language of its own, named Lexica, at version `1.0.0-alpha`, the modules a host registers declaring its domain, and DOMQL building on it from then.
- **Numbered versions,** October 21, 2026: each language version declared in one place, numbered to match the definition format then current, the specification describing `1.0.0-alpha.32` and the implementation following `1.0.0-alpha.31`.

Together they built the foundation every later version extends:

- [Scripts](spec/language/scripts.md#scripts): their parameters a host binds, bodies and locals.
- [Values](spec/language/values.md): objects and the object root, lists and null.
- [Expressions](spec/language/expressions.md#expressions): tests, truthiness, equality, arithmetic, comparisons, logic, conditionals and conditional bindings, `do` blocks, coalescing, attempts, casts, conversions and interpolated strings.
- [Functions](spec/language/functions.md#functions): regular and arrow functions a script declares, and references to a module's functions.
- [Members](spec/language/members.md): their arguments and their kinds.
- [Host calls](spec/runtime/host-calls.md#runtime-host-calls): calls the host invokes, which Nexo prepares and projects.
- [Modules](spec/runtime/modules.md): modules and their declarations, registries, and type selectors.
- [Hosting Nexo](spec/runtime/hosting.md): bindings, resolution, evaluation with its hooks, and results with their metadata.
- [Observations](spec/runtime/observations.md#observations): what a member names to learn its result may have changed.
- [The definition](spec/runtime/definition.md#definition): the JSON definition and its canonical text.
