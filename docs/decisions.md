# Decisions

Decisions taken without stopping to ask, kept here so they can be reviewed and reversed.

- Each entry says what was decided, why, and what was declined.
- A rule a decision settles is stated in the [specification](../spec/README.md) too.
- Questions not yet decided are in the status overview's [open decisions](features-status.md#open-decisions).

Each entry is one of four kinds:

| Kind | Meaning |
| --- | --- |
| Approved rule | A rule of the language or the runtime the owner approved, which the specification states |
| Current restriction | Something the contract deliberately leaves unsupported for now, refused explicitly, which a later design may lift |
| Implementation limitation | Where the implementation falls short of the contract, recorded in the status overview until it closes |
| Process | How versions, records and releases are kept |

<a id="d1"></a>

## D1 — The language advances to `1.0.0-alpha.39`

*October 30, 2026*

- **Kind:** Process.
- **Decision:** the language version is `1.0.0-alpha.39`. The definition format stays at 36.
- **Why:** after the implementation followed `1.0.0-alpha.38`, the host API was renamed and more of the contract was specified, with no version change. Two builds both reporting `1.0.0-alpha.38` had different APIs. A version must name one contract.
- **Declined:** counting the rename as part of `1.0.0-alpha.38`.

<a id="d2"></a>

## D2 — The history's earliest entry covers everything before `1.0.0-alpha.33`

*October 30, 2026*

- **Kind:** Process.
- **Decision:** one entry, *Before `1.0.0-alpha.33`*, tells the language's origin: DOMQL's query language, its port as Lexica, and the numbering of its versions. Every version from `1.0.0-alpha.33` on has its own entry.
- **Why:** versions were first numbered on October 21, 2026, to match the definition format. No version was ever called `1.0.0-alpha.1` to `.30`. From `.33` on, the record shows each version's boundaries exactly.
- **Declined:** a heading of `1.0.0-alpha.1` to `.32`, which names versions that never existed.

<a id="d3"></a>

## D3 — A change belongs to the first version whose implementation has it

*October 30, 2026*

- **Kind:** Process.
- **Decision:** a change is listed under the first version whose implementation follows it. So lineage is in `.35`, the verbs' removal in `.37`, and the briefly enforced capital letter in no version.
- **Why:** a host reads the history to learn what an implementation reporting a version does. Some specification changes landed after the implementation had followed a version, without a version change.
- **Declined:** placing a change by the version the specification carried when it was written. That would put the verbs' removal in a version whose implementation still has them.

<a id="d4"></a>

## D4 — A history entry covers both contracts, and what breaks

*October 30, 2026*

- **Kind:** Process.
- **Decision:** each entry lists the language's changes and the runtime's separately, then what the version breaks.
- **Why:** a language version names the whole specification, so a host needs the runtime's changes too. Until the beta any version may break the one before.
- **Declined:** a language-only history, which would record the renamed API nowhere.

<a id="d5"></a>

## D5 — A test and a rule keep the history current

*October 30, 2026*

- **Kind:** Process.
- **Decision:** the alignment test requires the history's newest entry to match the specification's version. The working instructions require a version advance to add its entry.
- **Why:** a history kept by hand falls behind. The gate already holds the README, the design and the status overview to the version.

<a id="d6"></a>

## D6 — Feature status lives in the status overview

*October 30, 2026*

- **Kind:** Process.
- **Decision:** the status overview takes Roslyn's feature-table shape. No separate runtime status document is added. Roslyn's people columns are left out.
- **Why:** Nexo has one implementation, so its runtime status and its implementation status are one subject, and each subject has one home.
- **Declined:** a second document under `docs/`.

<a id="d7"></a>

## D7 — A feature is dated by language version

*October 30, 2026*

- **Kind:** Process.
- **Decision:** each feature names the language version the implementation has followed it since.
- **Why:** the implementation's own version is a package version. It has stayed at `1.0.0-alpha.37` because nothing is published, so it would date every feature alike.

<a id="d8"></a>

## D8 — A feature's state names its gaps

*October 30, 2026*

- **Kind:** Process.
- **Decision:** a feature's state is *Implemented*, *Implemented, with a gap*, *Implemented in part* or *Planned*, and names the gap or deferral it links to.
- **Why:** a host deciding whether to rely on a feature needs its gaps beside it.

<a id="d9"></a>

## D9 — A clarification keeps the version

*October 30, 2026, narrowed the same day*

- **Kind:** Process, approved.
- **Decision:** a clarification of the agreed contract keeps the version. A change to the contract, new syntax or new semantics, advances it. Making the implementation follow a rule the specification already states is a fix, which keeps it too.
- **Why:** a version names a contract, not an implementation. What an implementation happens to do establishes no contract by itself.
- **Declined:** a new version for each rule written down, which would date the specification's text rather than the language; and treating the implementation's behaviour as the contract wherever the specification was silent.

<a id="d10"></a>

## D10 — Extension members are read with `:` alone

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** `.` reads a type's own members and `:` reads extension members. `device.usage` is refused, giving `device:usage` (NEXO3090). The language advances to `1.0.0-alpha.40`.
- **The definition format, 37:** its serialized form changed. A `memberAccess`'s `extension` became `{}` for an access naming no extension, where it had always held a `name`, and an `indexerAccess` no longer held one, since an extension's unnamed indexer has no form. A behaviour change alone would have kept the format.
- **Why:** the owner agreed that extension members are reached through `:` exclusively, so where a member comes from is always visible, and an owner and an extension never compete.
- **Declined:** keeping `.` for extension members beside `:`, which keeps the competition the owner rule had to settle.

<a id="d11"></a>

## D11 — The last name of the extension reference is the member

*October 30, 2026, revised the same day*

- **Kind:** Approved rule.
- **Decision:** an extension reference writes one to three names: the member, its extension's name before it, and that extension's module's before that. Each name fills its role, whatever the spacing. The rule applies to the reference, not to every name that follows it.
- **Revised:** the first version read every dotted name after the colon as part of the reference, refusing more than three (NEXO1071). The owner sent it back: that was a decision of its own, not a consequence of the three forms.
- **Declined:** reading `count: it.devices.count` as a named argument.

<a id="d12"></a>

## D12 — An access's names are read by the declarations they name

*October 30, 2026, revised the same day*

- **Kind:** Approved rule.
- **Decision:** resolution reads the names after the colon the ways their declarations allow: the first an extension member; the first an extension declaring the second; or the first a module whose extension the second is, declaring the third. Names after the member are ordinary access of its answer. One way that fits is taken, several are refused as ambiguous (NEXO3091), and a group or a named extension writes one.
- **Why:** the owner's review. `name:size.width` should read as the extension member `size` and its answer's `width`, and a group is useful only where the names really read two ways. A name still fills a role only where it names what the role needs, never a local or a parameter.
- **Revised:** the first version required a group after every bare member, `(device:readings).first`, because it read the dotted names greedily.
- **Declined:** resolving the rest of the chain to choose among ways, which would make a typo in a later name change how the first ones read; the roles of the names decide alone.

<a id="d13"></a>

## D13 — A member's declaration decides how it is read

*October 30, 2026, revised the same day*

- **Kind:** Approved rule.
- **Decision:** a member declared within a type is read with `.`, and one declared within an extension with `:`, whichever module declares it and whichever type it extends. `flatten` is declared among `List<T>`'s own members, for a list of lists, a receiver narrower than `List`'s, so `lists.flatten` reads it. Nexo's module declares no extension.
- **Why:** the owner's review. Access syntax should follow the declaration, not how the declaring module relates to the receiver's type. `flatten` is a list operation like every other list member, so it is declared as one.
- **Revised:** the first version read with `.` the members a module declared in an extension of its own type, which `flatten`, then declared through an extension, relied on.
- **Declined:** reading `flatten` with `:`, which would make one list member unlike the others.

<a id="d14"></a>

## D14 — An extension's indexers are named

*October 30, 2026, revised the same day*

- **Kind:** Approved rule.
- **Decision:** an extension declares indexers, each named, read `device:setting["mode"]`, through its extension and its module as any extension member is, with its signatures. Brackets after the member are its key where the member the access selects for the receiver is a named indexer, and otherwise index the member's answer. An extension declaring an indexer without a name is refused (NEXO4564), giving the named form.
- **Why:** the owner's decision. Brackets after a value alone write no name, so they can't show where the indexer comes from, which reading extension members with `:` exists to show; they read the receiver's owner's unnamed indexer.
- **Revised:** the first version recorded an unnamed extension indexer as a current restriction, which a later design might lift. It is a rule: an extension indexes by name.
- **Declined:** a colon indexer form, `x:[key]`, which the owner ruled out.

<a id="d15"></a>

## D15 — The codes of the new access

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** NEXO3090 refuses an extension member read with `.`. NEXO3091 refuses names that read more than one way, and NEXO3026 a first name that names neither an extension nor an extension member. NEXO1014 keeps a colon no name follows, now `f(a: 5)` and `a ?: 0` among it. NEXO3062 covers a member no applicable extension declares as well as one a named extension does not. NEXO4564 refuses an extension's unnamed indexer. NEXO1071, which the first reading of the names used, is retired.
- **Why:** each condition has one code. A colon no name follows is one condition however it is spaced or followed, so NEXO1014 stays rather than being retired.
- **Declined:** retiring NEXO1014 for a new code, which would split one condition.

<a id="d16"></a>

## D16 — A bound extension reference keeps its argument kinds

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** `let keep = words:keep` then `keep(it.length > 1)` reads its argument as `words:keep(it.length > 1)` does. The receiver is still captured once, as the reference is created.
- **Why:** the owner decided it, as a held reference to a module's function already does. It clarifies the agreed contract, so it keeps `1.0.0-alpha.40`, by [D9](#d9).
- **Revised:** a local that may hold one of several functions first gave each of them values alone. That was this implementation's limitation, not a rule: the specification already made a held reference's call its qualified form's, wherever it was chosen. [D22](#d22) settles it.

<a id="d17"></a>

## D17 — A set is captured wherever a list is declared

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** a host's set is accepted wherever a value is declared `List<T>`: a declared binding, a member's answer and a host call's supplied value. Its items are captured in traversal order and checked against `T`, at every depth. The list keeps no uniqueness.
- **Why:** the owner decided it. A member's answer and an undeclared binding already took a set, so capture now treats a host's collections one way wherever a type is declared. It clarifies the contract, so it keeps `1.0.0-alpha.40`, by [D9](#d9).
- **Declined:** a set type in the language, which no script needs to tell from a list.

<a id="d18"></a>

## D18 — A function is never a collection's item, value or key

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** a function, an arrow function, a script's function or a reference, is never a list's item, a dictionary's value or an indexer's key. Each is reported where it is found: an arrow function in text as a syntax error (NEXO1057), one in a definition as a structure error (NEXO2027), and one resolution finds as a validation error (NEXO3082). A call answering a valid item stays allowed.
- **Why:** the owner decided it. The catalog already gave text NEXO1057 for an arrow function outside a local or an argument, so `[x => 1]` follows it; an indexer's key is data as an item is, so it shares NEXO3082 rather than taking a code of its own.
- **Declined:** a new code for a function as a key, which would split one condition.

<a id="d19"></a>

## D19 — The revised reading is `1.0.0-alpha.41`, definition format 38

*October 30, 2026*

- **Kind:** Process.
- **Decision:** reading an access's names by their declarations advances the language to `1.0.0-alpha.41` and the definition format to 38. A definition records each name as written, its first holding `extension: true` and each later one `continues: true`, and resolution assigns their roles.
- **The definition format, 38:** its serialized form changed again. A definition can no longer hold an access's extension and module as an object, since the text alone can't say which names they are, so each name is a node of its own, marked.
- **Why:** a build already reports `1.0.0-alpha.40` with the greedy reading, and a version names one contract, as [D1](#d1) decided. The text alone can't say which names are the reference's, so the definition keeps every name, and a group, which ends the names, stays distinct from a dot that continues them.
- **Declined:** revising `1.0.0-alpha.40` in place; and a definition holding the names as one list, which would leave the ordinary accesses after the member without a place of their own for their resolutions and their errors.

<a id="implementation-decisions-reviewed"></a>

## The implementation decisions, reviewed

Forty decisions were taken while implementing the declarations, member selection, script text and collections, and reviewed together on October 30, 2026. Each went one of four ways:

- **Specified:** the specification already states it.
- **Now specified:** behaviour the implementation had, stated in the specification by the review.
- **Internal:** how the work landed, private code or test fixtures, with nothing a script or a host sees.
- **Open:** a question no one has decided, moved to the status overview's [open decisions](features-status.md#open-decisions).

| ID | What it settled | Outcome |
| --- | --- | --- |
| I1 | Where a module error stands | Specified: [locations](../spec/runtime/errors.md#validation-diagnostics) |
| I2 | How nested declarations landed | Internal |
| I3 | Where a nested member's collision stands | Specified: [locations](../spec/runtime/errors.md#validation-diagnostics) |
| I4 | A type's `members` that are not a list | Now specified: [NEXO4503](../spec/runtime/errors.md#module-errors) |
| I5 | A data property, read and never invoked | Specified: [what an implementation receives](../spec/runtime/members.md#members-what-an-implementation-receives) |
| I6 | A structured type with no data property | Specified: [retired codes](../spec/runtime/errors.md#runtime-retired-codes) |
| I7 | An unnamed indexer's use, `List[]` | Specified: [resolution](../spec/runtime/resolution.md#runtime-bindings-and-resolution) |
| I8 | The indexer helper | Specified: [declaration helpers](../spec/runtime/members.md#members-declaration-helpers) |
| I9 | Where an unnamed indexer stands | Now specified: [locations](../spec/runtime/errors.md#validation-diagnostics) |
| I10 | A mapping's key | Now specified: [NEXO4008 and locations](../spec/runtime/errors.md#validation-diagnostics) |
| I11 | An internal type as an extension's target | Specified: [internal declarations](../spec/runtime/modules.md#modules-internal-declarations) |
| I12 | Where the scalar type names live | Internal |
| I13 | How named extension types landed | Internal |
| I14 | Implicit type parameters of the flat form | Internal: the flat form is gone |
| I15 | How Nexo declares its own value types | Internal |
| I16 | When a tolerance is checked | Now specified: [numeric tolerance](../spec/runtime/members.md#what-a-member-declares-numeric-tolerance) |
| I17 | How the tests moved | Internal |
| I18 | `target` refused, and a parameter as receiver | Specified: [collisions](../spec/language/modules.md#namespaces-a-modules-own-collisions) |
| I19 | The order of inference | Specified: [binding a call's parameters](../spec/language/types.md#types-type-parameters-binding) |
| I20 | Owner first, then specificity | Specified: [owners and extensions](../spec/language/extensions.md#extensions-owners) |
| I21 | A cast operator's rejection | Now specified: [NEXO5004](../spec/runtime/errors.md#runtime-evaluation-errors) |
| I22 | Deferred calls, and a value's actual type | Specified: [deferred member selection](../spec/language/types.md#types-any-deferred-selection) |
| I23 | The shapes of a resolution's reports | Specified: [resolution](../spec/runtime/resolution.md#runtime-bindings-and-resolution) |
| I24 | A receiver of unknown type, evaluated | Specified: [what it answers](../spec/language/types.md#receivers-of-unknown-type-what-it-answers) |
| I25 | A callback answering `Any` | Specified: [functions passed to members](../spec/language/functions.md#functions-passed-to-members) |
| I26 | Line endings | Specified: [line breaks](../spec/language/lexical-structure.md#line-structure-line-breaks) |
| I27 | `import` as a keyword | Specified: [names and reserved words](../spec/language/lexical-structure.md#names-and-reserved-words) |
| I28 | The order and conflicts of imports | Specified: [the definition](../spec/runtime/definition.md#definition) |
| I29 | What an import makes available | Specified: [imports](../spec/language/modules.md#scripts-imports) |
| I30 | Extension access | Now specified: [NEXO3026 and used declarations](../spec/runtime/resolution.md#runtime-bindings-and-resolution); two questions [open](features-status.md#open-decisions) |
| I31 | Line structure's refusals | Now specified: [where a line breaks](../spec/language/lexical-structure.md#line-structure-where-a-line-breaks) |
| I32 | Compact text's layout | Now specified: [canonical text](../spec/runtime/definition.md#definition-canonical-text) |
| I33 | The order a message lists types in | Now specified: [type name lookup](../spec/language/types.md#types-type-name-lookup) |
| I34 | Lineage | Specified: [provenance](../spec/runtime/evaluation.md#runtime-results-provenance) |
| I35 | The collection foundation | Now specified: [parameter defaults](../spec/runtime/members.md#members-parameter-declaration-keys); one question [open](features-status.md#open-decisions) |
| I36 | Collection expressions | Now specified: [one-line constructs](../spec/language/lexical-structure.md#line-structure-where-a-line-breaks); one question [open](features-status.md#open-decisions) |
| I37 | The members of collections | Specified: [list members](../spec/language/collections.md#collections-list-members) |
| I38 | Indexer signatures | Now specified: [unnamed indexers](../spec/language/members.md#property-access-calls-and-indexers-unnamed-indexers) |
| I39 | Ordering | Specified: [ordering](../spec/language/collections.md#collections-list-ordering) |
| I40 | The examples' fixtures | Internal |

<a id="d20"></a>

## D20 — Whitespace never changes an access

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** spaces and tabs between an access expression's tokens change nothing, in a property access, a computed one and an extension access, qualified or not, and decide no name's role. Whitespace never splits a token, so `? .` is no `?.`. Line breaks follow the line structure: an extension access's colon and dots are member steps, with no continuation rule of their own.
- **Consequences:** `f(a:b)`, `f(a: b)` and `f(a : b)` each pass what `a:b` answers, never a named argument. An object field's `count: 1` stays NEXO1003, since the parser knows it reads a field's name there.
- **Why:** the owner's rule. The parser already read whitespace so; the specification now says it.

<a id="d21"></a>

## D21 — A computed name reads a type's own members

*October 30, 2026*

- **Kind:** Approved rule.
- **Decision:** `x.[name]` reads the members `.` reads, never an extension member. A computed extension access, if one is introduced, needs a design of its own.
- **Why:** otherwise a computed name would be a second route to extension members, undoing their separation.

<a id="d22"></a>

## D22 — A chosen function's call reads the contract the functions share

*October 30, 2026*

- **Kind:** Approved rule, closing an implementation limitation.
- **Decision:** a call of a local that may hold several functions reads its arguments by the contract they share, and invokes the one the local holds. They share one where every one is a reference to a module's function, bound alike, agreeing on the argument form and each parameter's kind, type, requirement, null policy and default once their receivers bind what their types write. Where they read the arguments differently, the call is refused naming where they part (NEXO3079).
- **Why:** the owner's review: a restriction should follow from the callables' contracts, not from there being several. The specification already made a held reference's call its qualified form's, wherever it was chosen; giving each function values alone was this implementation's limitation.
- **What still can't share one:** a script's function beside one taking a callback, since a script's function takes values alone; references bound and unbound, which place the receiver differently; and declarations with type parameters of their own, which their own arguments bind, unless they are one declaration.

<a id="d23"></a>

## D23 — The package version waits for publication

*October 30, 2026*

- **Kind:** Process.
- **Decision:** the package keeps `1.0.0-alpha.37` while nothing is published. The next published package takes the version due then. Its README names it and the language version it implements, and `nexo.info.versions` names the language and definition versions.
- **Why:** a package version names what was published, and an unpublished working tree need not track every language revision.

<a id="d24"></a>

## D24 — The README's example runs as it is written

*October 30, 2026*

- **Kind:** Process, approved.
- **Decision:** the README's example declares a vocabulary of its own, a billing module, rather than the examples' vocabulary the specification shares. A test runs the README's JavaScript against its script, and checks the result, the type and the refusals the README states.
- **Reference date:** the example's date is one the application gives the evaluation, which the README's text names, never the clock. The test runs under a clock set years later, so the result it shows stays right.
- **Why:** a reader meets a use case they recognize, and the integration they would write. Running the README's own code keeps all of it true.
- **Declined:** adding billing types to the examples' vocabulary, which would grow a domain the specification's examples do not use; and checking the script alone, which would leave the JavaScript untested.

<a id="d25"></a>

## D25 — A performance change keeps every behaviour

*October 30, 2026, narrowed October 31 after its review*

- **Kind:** Process.
- **Decision:** a change made for speed or memory keeps every behaviour the contract states, errors and their paths, hook requests, metadata and the checks among them. Each change is measured alone against the commit before it, and kept only where the benchmark shows it helps. A test pins any behaviour a change reimplements, run against the code before and after it.
- **Measured in pairs:** a gain is established by paired runs against the commit before it, every round agreeing and the median beyond what a run against an unchanged copy shows. A single run's change can't be told from noise of the same size. Paired runs confirmed the pass, and showed the account summary's evaluation 16% faster, which single runs had put within noise.
- **Why:** the user asked for safe improvements. A faster Nexo that answers differently is a different Nexo.
- **Declined:**
  - Skipping the checks of Nexo's own members' answers. One run measured it at about a tenth of an evaluation, no more than runs vary, so the gain is not established. It relied on no implementation changing a value it is given, which the contract didn't state. It was adopted after D26, below.
  - Collecting a text's locations at its first error, about a tenth of a parse. A kept script would hold its lowered definition beside its validated one.
  - A structure-type table for each registry, and one empty list shared by every type without type arguments. Neither measured beyond noise.
  - Freezing a filter's positions in place. `pick` gives the script's own list as its positions.
  - Keeping an answer's list as its own copy where its structures each stand as they are and it carries no lineage, and a flat structure already recorded as its type standing without its keys checked again. A profile put copying at about a sixth of the portfolio report. Paired runs measured no gain in time, −0.3% with rounds from −10% to +10%, and 9% more allocation.
  - Calling a function of one argument without collecting its arguments in a list. Paired runs measured the portfolio report from 5% faster to 18% slower.
  - Comparing a structure's record by type equality, so a copy never records an equal type again. Paired runs measured no change in time or allocation.
  - Holding an object's field selections in a private field of the object, as a structure's type is held. Paired runs measured every case 5% slower, the field changing each object's shape after it is built.
  - Indexing a resolved definition by the pointer strings resolution stored its resolutions by, rather than strings built again, which a profile put at a sixth of resolving. Paired runs measured resolving 4% faster, one round of nine disagreeing, so the gain is not established.
  - Fusing a chain of Nexo's own list members into one loop. It interleaves what the members evaluate, which changes the order of host calls, the first failure and what hooks hear.
- **Adopted after [D26](#d26):**
  - A list member of Nexo's own that answers its receiver's items relies on the check those items had, where resolution selected it, the answer keeps the receiver's item type, and that type may hold no reference, as the [design](nexo-design.md#relying-on-a-check-of-data) sets out. Paired runs measured the account summary's evaluation 6% faster in every round. The portfolio report measured between 2% and 7% faster across four runs, with slower rounds in three, so that gain is not established. These paired runs replace the single run's tenth.
  - Every answer of Nexo's own whose type may hold neither a reference nor a value of `Any` is neither captured nor checked, where resolution selected the member, rather than the answers of its receiver's items alone. Paired runs measured the portfolio report's evaluation 15% faster, every round agreeing, and the account summary's unchanged.
  - A function given to one of Nexo's own members relies on the check its argument had, an item of the member's receiver, under the same conditions. Paired runs measured the portfolio report's evaluation 17% faster and the account summary's 8%, every round agreeing.
- **The second pass:** the changes kept after these, each measured alone, are listed in the [design](nexo-design.md#the-second-performance-pass). Together they made the portfolio report's evaluation 52% faster, binding its customers 61%, and the account summary's evaluation 39%.
- **Correction:** the commit that keeps a structure's unchanged record says it saves a quarter of the portfolio report's allocation. Measured alone, it saves 9%.

<a id="d26"></a>

## D26 — Data is read-only once it passes between Nexo and its host

*October 31, 2026*

- **Kind:** Approved rule, as the review of the first performance pass proposed it.
- **Decision:** data that passes between Nexo and its host, in either direction, is read-only from then on, nested data included. A host changes neither the data it is given nor the data it gave, through any alias it keeps. The rule is stated in [data shared with a host](../spec/runtime/evaluation.md#runtime-shared-data). The language advances to `1.0.0-alpha.42`, and the definition format stays 38.
- **References:** a reference is no data. The host object it identifies changes as its type's contract allows, and the rule lets Nexo rely on an earlier check of data alone, never on one of a reference's membership.
- **The boundary:** Nexo copies a binding and a value a host call projects, so the host's own data stays its own. It doesn't copy an answer, so the rule covers what a host gave as well as what it was given.
- **Why:** the language holds every value immutable, while the runtime left a host free to change data it shares. The rule closes that gap, whatever it saves. A check of data then holds for as long as the data does.
- **Declined:**
  - "An implementation may never change a value Nexo gives it", the first wording. It forbids changing the host object a reference identifies too.
  - Forbidding changes to what an implementation is given alone. An answer the host keeps would stay open to change.
  - Copying or freezing each answer. It costs what the checks cost, and freezing changes objects the host keeps.
  - Detecting a change made against the rule. It needs the work the rule saves.
