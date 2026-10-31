# Nexo Design v1.0.0-alpha.42

The [Nexo specification](../spec/README.md) is the contract: the [language](../spec/README.md#the-language), and the [runtime](../spec/README.md#the-runtime) its implementations offer a host. This design sets out how this implementation is built to meet it, and the reasons behind the choices that shape it. It describes language version `1.0.0-alpha.42` and definition version 38, as the specification does; [the status overview](features-status.md) says where the implementation still differs.

In this document:

1. [Architecture](#architecture)
2. [Modules and registries](#modules-and-registries)
3. [Types and their relations](#types-and-their-relations)
4. [Evaluation](#evaluation)
5. [Host calls](#host-calls)
6. [Tooling](#tooling)

## Architecture

A script passes through five stages. Each stage's output is the next one's input, and only the last runs a host's code.

| Stage | What it produces | Source |
| --- | --- | --- |
| Reading | A lossless syntax tree of the text, every token and its trivia kept | `Tokenizer`, `Parser`, `SyntaxTree` |
| Lowering | The definition, the script's JSON form, with the text location of each node | `Lowering`, `TextLocations` |
| Validation | The definition checked and frozen, whether text or a host produced it | `DefinitionValidator` |
| Resolution | Every member resolved against a registry, or deferred to evaluation on a value of `Any`, the result typed, the used declarations and the deferred accesses recorded | `LanguageResolver`, `ResolvedDefinition` |
| Evaluation | The value and its metadata, each read reported to the host | `Evaluator` |

The domain enters as late as it can. Reading knows the language and the script's imports alone, which the parser reads, since an import decides whether a module's name written where a value stands begins a namespace; the tokenizer reads an identifier by its spelling alone, and reading asks no registry and knows nothing else of any module. Lowering and validation know the language alone, so a text is checked, stored and formatted without a vocabulary: a collection expression's written form decides whether it is a list or a dictionary, and validation refuses its duplicate keys, before any type is known. Resolution reads a module's declarations as data and runs none of its code; evaluation is the one stage that invokes implementations. That split is what lets a tool check a script before running it, and a host know what an evaluation will depend on before it starts.

`src/nexo.js`, the entry point, composes these stages into the public API and re-exports nothing internal. Nothing in `src/` imports from outside it or reads a browser global, so the implementation runs in any JavaScript host.

## Modules and registries

A module validates its declarations once, as it is created, and freezes them: every declaration is data but its implementation, which is kept by reference and never frozen. One shape serves every kind of declaration, so the same validation covers all of them and a field one kind does not take is refused, never ignored. Keeping implementations in the declarations they carry out means a member's name is written once, and a tool reading the declarations reads exactly what resolution reads.

A script reaches what its imports make available, which `ImportedVocabulary` answers for the resolver from the definition's imports and the registry: the module a namespace's local name names, the scope its type names are read in, and whether a declaration is one the script may select, Nexo's own always. A type name is read in one of three scopes, a declaration's, a declared binding's or a script's, each a `TypeNameScope` of its declaring module, its imports and whether it reaches every module, through one path, the registry's `resolveTypeName`: the scopes differ as the specification has them differ, and their tiers are written once, each scope's reader keeping the refusals its contract gives. The resolver selects only among those, so the registry's selector knows no script, and registering a module changes no script that does not import it.

A registry indexes what its modules declare, and owns the selection among them, `MemberSelector`, which every access reads, an indexer's signatures, the indexers one type declares of one name taking keys of disjoint types, competing as one candidate that the key's type then chooses among: an access with `.` gives it the members a type declares and those an owner declares in an extension of its own type, the owner of the receiver's type first, and an extension access, its names read by the declarations they name before it is resolved, gives it the extension members alone, or one extension's where it names one, the most specific applicable winning, an internal declaration no candidate in either. It indexes members by name, each name holding one declaration for each set of receivers; observation types by name; operators by their operation, `cast` or `convert`, apart from the members, each selected by its receiver and its destination; the owner of every declaration; and the type or the extension each member is declared within, so a member's receiver is its type, or its extension's target, and a member among its module's `members` is a module member, which takes none; a notation reads the type parameters its declaration's name and its extension's declare. Extensions are kept apart from the value types, since no notation names one. Nexo's own value types, its scalars and `List<T>`, are declared through a form internal to Nexo, and the registry registers their members, those of lists, dictionaries, pairs, numbers and strings, with Nexo's own module; one lookup answers every value type's declaration, a module's or Nexo's own, its kind an attribute. Registering checks a module whole against those indexes before it adds anything, so a refused module leaves no trace, and every registration advances the registry's revision. A registration changes a resolution made before it through recognition alone, since a script reaches only what its imports make available and a later module adds only its `typeOf` to what a value is recognized as; so a resolution records, as it is made, whether evaluating it may ever recognize a value, a declaration it uses giving it a value of `Any`, or its host call supplying a type that holds a nullable reference, and its evaluators refuse it only once a module declaring a `typeOf` has registered since. No evaluation reads a vocabulary its resolution did not, and an evaluator a host keeps, with the calls it prepared, outlives every registration that can't change it, which a test made from the resolution's own record never confuses with the paths an evaluation happened to take.

A test of a receiver is a member, a Boolean function, and a member that takes a test takes it as a function argument, so a module's function passed by reference, a script's arrow function and an implicit body are one mechanism, and what every member has, its qualified form, its observations and its failures, serves a test as it is. Nexo itself declares no member that takes a test, since how a test reads is a domain's: a module declares one for its own.

`ParsedTexts` keeps the definitions of the 256 texts parsed most recently, with the imports supplied to each, so reading the same text again, as a host does at every evaluation of the same script, costs a lookup.

## Types and their relations

A `Type` is a value and nothing more: what kind of type it is, its name and its module, its type arguments, its fields and its nullability, its equality to another and how a message writes it. It knows no relation to another type, since every relation the specification sets out, [assignability, equal types and merging](../spec/language/types.md#types-assignability-and-merging), depends on declarations only a registry holds: a type's supertypes, and a generic type's parameters and their variance.

`TypeChecker` holds every relation, made with what declares types, a registry or, for bindings made without one, Nexo's own vocabulary. It answers whether a value of one type is assignable to another, the type two types merge to, whether two types fit one way or the other where an equality compares them, which types an equality compares with more than null, whether a receiver matches a member's receiver types, the type arguments it binds recorded as it matches, and the evidence an argument gives a type parameter, which it resolves to the one type its sources agree on. Each of the resolver's checks asks it, and none asks a `Type`, so a rule is written once and every expression is held to it alike.

- **Three answers to assignability.** A value of a type is assignable, refused, or assignable once its value is checked when it is evaluated, which only `Any` asks for: `Number` is assignable to `Any`, and `Any` to `Number` only once its value is checked, a check against `Number` refusing null as `Number` does. An answer that waits for evaluation carries the obligation to check, so a caller either records the check or refuses the value, and never treats it as proven.
- **Generic types by their declaration.** A generic value type is a named type with its type arguments, and its declaration gives each of its parameters a variance. Two types of one generic declaration relate argument by argument: a covariant one by assignability, an invariant one by equality, and their merge merges each argument. Nexo's own vocabulary declares the three generic value types, `List<T>`, covariant in `T`, `Dictionary<K, V>`, invariant in its keys and covariant in its values, and `Pair<K, V>`, covariant in both, so each relates through its own variances without the checker knowing which it is; an invariant argument of `Never` fits any, since a dictionary's keys are `Never` only where it holds no entry. A dictionary's keys are of a type one exact equality compares, a scalar, a reference or null, and a dictionary is a JavaScript map's entries frozen in a class of the language's, since a map's key equality is Nexo's for those keys.
- **Object types by their fields.** Two object types relate where they hold the same field names, field by field, so a field more or a field fewer refuses both assignability and merging.
- **Structures by their declaration.** No object type is assignable to a named type, so a structure is constructed where its type is declared rather than recognized by its fields: the resolver gives an object expression written as a value argument the structured type its parameter declares, passing it on to an object field, a list's items and the operands of a conditional or a coalescing, and holds its fields to the data shape, recording the construction, which the evaluator makes into the structure, every property of its shape held. The expected type travels with the nodes it applies to, never with the scope every child inherits, so nothing beyond those forms is typed by a use.
- **Reference types by their hierarchy.** A reference type is assignable to each supertype above it, and two of one hierarchy merge to the nearest supertype they share, so the hierarchy a registry's modules declare is the one every relation follows.

Membership is asked anew at every check, a value's type and every supertype's `isInstance` in turn, and no answer is kept: a host's object can change what it is, and an answer kept past that change would be wrong. Asking costs little: ten thousand references, each a member's answer checked through a hierarchy twelve types deep, evaluate in about 45 milliseconds, each type of the hierarchy adding about a fifth of a microsecond to a check, so a cache would save little and need validity rules no host's object can promise.

## Evaluation

The evaluator compiles each node of a resolved definition once, into a function that holds what no evaluation changes, and keeps those functions by the definition and the registry they were compiled against; each evaluation then runs the functions with the state that is its own. A resolution can be reused by any evaluator with bindings of its key, so a host evaluating one script for many values pays for its resolution and its compilation once.

An access on a value of `Any` is the one place the evaluator selects: resolution keeps its receiver, its arguments and the candidates of its name, and its compiled function types the receiver's value as binding types one, asks the registry's selector, and keeps the selection by the actual type it met, so a list whose items differ selects once for each type, never once for each item. A structured value keeps the type its declaration gave it through `Any`: `StructureTypes` records it by the value wherever Nexo makes one, a member's answer the evaluator copies, an object expression it constructs and a value a host binds or supplies, which capture builds, so no path that makes a structure loses its identity. Nexo's own collection members are implementations of its own vocabulary like any module's; a member answering items of its receiver realigns their lineage, each answered item standing for the first occurrence of it its receiver holds, and `select` records its own as a projection does, so lineage has one place in the evaluator whichever member carries it.

The hooks a host gives an evaluation are called around each member's implementation, never inside the language's own operators, so what a host learns is exactly what the evaluation read of its domain. An evaluation's state, its pending members and the records of what it read, belongs to it alone, which is why an implementation that evaluates another script never disturbs the one that called it.

A host gives the language's collections in its own forms, a set where a list is declared, a map where a dictionary is, an object of a key and a value where a pair is, and the evaluator captures each as the declaration names it before checking it, compiled once for the type; a filter of Nexo's own describes the items it kept as its receiver described them, their sources and provenance realigned in its order by the position each stood at in the receiver, which the member keeps with the list it answers, through `ItemPositions`, and the evaluator reads before a capture can replace that list, as an ordering does the items it reordered, whose evaluated keys stay with the list it answered, carried to the capture and the copy the evaluation keeps, so a `thenBy` refines them without evaluating them again. A result is detached from everything the evaluation touched: the evaluator copies the data a member answers through the data shape its type declares, and freezes the copy, so neither a host's later changes nor an implementation that keeps a reference can alter a result once produced. A projection records, beside each item's source, its provenance, the source the earliest projection of its input recorded, inherited from a projected input list by position, so lineage costs one array a projection and keeps no list it passed through. The metadata beside the value is recorded as the value is built, from the same compiled functions, so describing a result costs nothing until a host reads its metadata.

## Host calls

Nexo resolves and evaluates the scripts a host gives it; when they run, and what a host call does, are the host's. A host's calls differ in their lifecycles, one answering once, one delivering values over time, one running until it is ended, and each lifecycle is a contract of the host with its callers, never a rule of the language. Nexo therefore knows a single fact of a function, who invokes it, and none of the lifecycles: building them into the language as kinds of member and of request would tie every host to one host's operations, and leave each new lifecycle a change to Nexo.

What a host call needs of Nexo is what every call needs: its receiver, its arguments and their types checked, and the values it gives back typed and shaped. Resolution checks a host call as it checks any call, and refuses one anywhere but at a script's end, so no evaluation can reach it. Preparing it evaluates the locals before it, then its receiver and its arguments, with the compiled functions evaluation uses, and the prepared call it answers keeps the frame those locals were evaluated into. Projecting a supplied value through that prepared call captures it as the type the call declares, through `ValueCapture`, which a binding of a declared data type captures through too, since both are values a host gives from outside a script: it keeps a structure's declared fields, narrows a reference to the type its field names, refuses data that reaches itself, and records each structure's type so it keeps it through `Any`. A projection then runs the result projection as an evaluation of its own within that frame, so the locals are evaluated once for every value, the prepared calls of one evaluator stay apart, and a host that supplies many values pays for the projection's compilation once. A host call takes value arguments alone, since an expression argument is evaluated by its member while the member's invocation lasts, which a host call's never does within an evaluation.

A type selector is the general form of choosing a call's result type by a fixed argument. A host's reports or commands of many kinds, each with data of its own, are one function whose fixed argument selects the type, and another module extends the selector with keys of its own as it extends another's types; scoping each mapping to its selector keeps one host's keys from colliding with another's.

## Tooling

Resolution is authoritative: it validates every script against the vocabulary available before the script runs, whether text or a definition produced it. Three properties keep validation open to editor tooling, such as analyzers and completion, which can follow without changing the language:

- **Locations.** Text positions and definition-node locations are kept, so a diagnostic names the member, argument or object expression that failed; the mapping from text to definition can be kept apart from the definition.
- **Declarative metadata.** A module's declarations are data, so a tool understands them without running a capability's implementation.
- **Independent validation.** Structural and vocabulary validation run without a host, given the metadata and the bindings' types.

A tool can check a source text known when the code is written against the metadata available to its project; text built at run time, modules registered at run time and checks that depend on bound values remain resolution's.

### The syntax tree

One parser serves resolution and tooling alike. It reads a text into a lossless syntax tree, and the definition is lowered from that tree, so there is one grammar and one parser, and the definition stays the only contract resolution and the runtime act on.

- **Nodes for constructs.** A node stands for a construct written, named after the grammar rule that produces it, as `equality`, `conjunction` and `dot-property-access` are. A rule that only passes an operand on, a level of precedence or a repetition, does not produce a node of its own. Tokens and their trivia, comments among them, carry the complete text, so the tree gives the text back character for character.
- **Errors in one place.** Every syntax error the parser reports passes through one place, which a strict parse throws from. Line structure is checked there too, once a text is read, over its tree: each gap between two of a node's children is a one-line construct's, a break point or a boundary by the node's kind, so a layout is refused without the grammar reading it otherwise. That is the foundation for recovery: a parser that records a missing token and skips an unexpected one, so a text being written gives a tree and useful diagnostics without cascades. Recovery serves the editor alone; reading a script from text still refuses any syntax error, and a missing token is never permission to guess what the text meant.
- **Tooling apart from resolution.** Token types and node kinds are listed for tooling, and the tokenizer reads any text tolerantly, an invalid token holding its diagnostic, so a highlighter reads tokens, trivia, ranges and structure without resolving anything. An editor's parser is this one, never a copy of the grammar.
- **From syntax to meaning.** Lowering records the syntax node each definition node comes from, and a resolution maps each definition node to its declarations and types, so a tool joins a position in the text to what resolution knows of it: completion after `room.` reads the receiver's type, and renaming a local follows the scope resolution records for it.
- **What the implementation keeps.** A kept script holds its text, never its tree, so its memory is what it was before the tree existed; a tool that needs the tree reads the text again. A script created from a definition has no text, and its tree is the one read from its canonical text, marked generated.
- **Formatting that keeps the source.** `nexo.format` writes canonical text, which keeps no comment and no layout, and `nexo.quote` its compact form, one line but where line structure requires a break, each read back as the same definition. Formatting that keeps comments and each string's written form is a tooling operation over the syntax tree, whose tokens keep each string's quote and delimiter length for it.
- **What it cost.** The tree was measured against the parser before it, before it was kept: the documents' scripts parse 7% slower and malformed texts 8% faster, a 60-field script within 3% with two-thirds more transient allocation, what a kept script retains is unchanged, and the bundle is 3% larger.

The tree is internal until a public tooling API stabilizes it; [the status overview](features-status.md) tracks recovery, that API, source-keeping formatting and editor tooling.

## Performance

The benchmark measures Nexo against the work a script stands for. It is a billing app written twice, as plain JavaScript and as Nexo scripts over the README's vocabulary, and a test keeps the two giving equal results.

| Group | What it measures |
| --- | --- |
| Account summary | The README's script for one customer of 1,000: evaluating it, evaluating it with hooks reporting reads, and binding the customer and evaluating |
| Portfolio report | One script over all 1,000 customers and their nearly 12,000 invoices: evaluating it, and binding the customers |
| Preparing the account summary | Parsing a text no parse has kept, resolving it, and creating an evaluator |

Each case reports two figures:

- **Time:** the median time of one operation, warmed up, with a full collection before each sample.
- **Allocation:** the bytes one operation allocates, whether a collection reclaims them or not. V8's GC profiler records the heap before and after each collection, and the heap's growth between collections adds up to them. It doesn't measure the heap an operation retains, which the benchmark leaves unmeasured.

A case's figures depend on the cases run before it in the same process, since V8 optimizes the code they share by what it has run. Binding the portfolio's customers allocates 10 MB after the evaluation case, and up to 18 MB measured alone. Runs compare only where they measure the same cases in the same order.

A change is measured in pairs, against the commit before it. `--baseline` loads that commit's Nexo beside this one, in one process, and each round measures both, alternating which runs first. A case's change is the median of the rounds' own changes, with their range beside it. A gain is established where every round agrees and the median lies beyond what a run against an unchanged copy shows. [Contributing](../CONTRIBUTING.md#measure-performance) sets out the commands, and `--save` and `--compare` compare single runs.

### The first performance pass

Measured on October 31, 2026, on Node 24 and an Intel Core i7-10700F, in five paired rounds against the commit before the pass. Each change gives the median of the rounds and, in brackets, their range.

| Case | JavaScript | Nexo before | Nexo after | Time | Allocation |
| --- | --- | --- | --- | --- | --- |
| Account summary: evaluate | 2.7 µs, 1.4 KB | 38 µs, 32 KB | 32 µs, 22 KB | −16% (−23% to −15%) | −29% |
| Account summary: evaluate, reporting reads | | 71 µs, 45 KB | 34 µs, 25 KB | −53% (−55% to −52%) | −44% |
| Account summary: bind and evaluate | | 95 µs, 81 KB | 67 µs, 40 KB | −33% (−68% to −3%) | −50% |
| Portfolio report: evaluate | 2.1 ms, 1.3 MB | 32 ms, 23 MB | 29 ms, 11 MB | −13% (−15% to −8%) | −51% |
| Portfolio report: bind | | 45 ms, 40 MB | 18 ms, 10 MB | −58% (−63% to −15%) | −74% |
| Preparing: parse | | 0.34 ms, 215 KB | 0.33 ms, 215 KB | −2% (−22% to +4%) | 0% |
| Preparing: resolve | | 0.29 ms, 292 KB | 0.30 ms, 293 KB | +1% (0% to +2%) | 0% |

A run of the same commit against an unchanged copy of itself shows the noise:

- **Medians** lay within 3% for every case but one.
- **Reporting reads** was the exception: its rounds ran from −34% to +126%, and its median was +26%.
- **Resolve** measured +1% in that run as well, so its +1% above is no change.

What changed, each change measured alone and kept where it helped:

- **A type's identity** is written once, when first read, rather than joined at every registry lookup.
- **Capture** writes a part's path only when the part fails, and builds a structure field by field.
- **A request's pointer** is resolved once for each pointer, so reporting reads costs little more than not reporting.
- **Answer checks** run as the type's own check where null and nothing refuse themselves, a scalar's check is chosen once, and fields are checked in a loop.
- **A structure's record** is kept where it is recorded again as the same type.
- **Callbacks** are closed through an index of those still open, rather than a weak map of every one.
- **A call's parameters** are bound without temporary arrays.

### Relying on a check of data

Data shared with a host is [read-only once it passes](../spec/runtime/evaluation.md#runtime-shared-data), so a check of data holds for as long as the data does. A list member of Nexo's own that answers items of its receiver, as `where`, `orderBy` and `take` do, relies on the check those items had where all of these hold:

- **Resolution selected the member,** so the receiver's type is established, never a value of `Any`'s.
- **The answer's item type is the receiver's.**
- **That type may hold no reference.** A reference's membership is its type's to answer, so an answer that may hold one is checked again.
- **The member's own positions show** that its answer holds its receiver's items.

The answer is still captured, copied, recorded and reported as before, and every other member's answer is checked. Measured in paired runs against the commit before it:

| Case | Time | Allocation |
| --- | --- | --- |
| Account summary: evaluate | −6% (−13% to −1%), all nine rounds faster | unchanged |
| Portfolio report: evaluate | −2% to −7% across four runs, some rounds slower in three of them, so not established | unchanged |

A function given to one of Nexo's own members relies on the same check. Every member of a list that takes an expression or a predicate, and a dictionary's `where` and `select`, calls each function it is given with one argument alone, an item of its receiver. A test holds each of them to that. The function skips its argument's check where:

- **Resolution selected the member,** so the receiver's type is established.
- **The function takes one argument, of the receiver's item type.**
- **That type may hold no reference.**

The function's result is checked as before. Measured in seven paired rounds against the commit before it:

| Case | Time | Allocation |
| --- | --- | --- |
| Account summary: evaluate | −8% (−10% to −4%), all rounds faster | unchanged |
| Portfolio report: evaluate | −17% (−24% to −14%), all rounds faster | −5% |

A profile's share is not what removing the work saves: copies a profile put at a sixth of the portfolio report saved nothing measurable once removed, as [decisions](decisions.md#d25) records.

Where the remaining time goes, as profiling found it. The contract requires the guarantees this work gives, not this way of giving them, so a cheaper way that keeps each guarantee may exist:

- **Every answer is checked** against its declared type, a list item by item and a structure field by field, but where [a check of data is relied on](#relying-on-a-check-of-data).
- **Every value a host's member gives a callback is checked** against the callback's contract, a structure field by field, and so is a reference one of Nexo's own members gives.
- **Every structured value Nexo makes is recorded** by the value in a weak map, so a value of `Any` keeps its type. Recording is about a third of binding, and a table for each registry measured no saving beyond noise.
- **Each object an expression builds** records the selections its fields made, in a weak map by the object, for its metadata.
- **Parsing and resolution** each map every node of the definition by its pointer as they finish, parsing to the text it came from and resolution to what it resolved. A kept script holds its locations rather than the definition it lowered, so collecting them at the first error would hold more.
