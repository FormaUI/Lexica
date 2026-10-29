# Proposal: host additions

**State: accepted and implemented.** Each part is specified and implemented, in turn, by [unit 6](../features-status.md#unit-6--host-additions) of the implementation plan, the implementation following language `1.0.0-alpha.36`, and, with a review's corrections and the verbs' removal, `1.0.0-alpha.37`.

A host's first consumer, replacing a component library's browser scripts with a host's requests, needs five things of the language that no host can give itself: resolutions that survive a registration they can't be changed by, structured values a script writes or a host binds, and the members of numbers, strings and positions every host would otherwise declare alike. Each is Lexica's because only the language can make it, or because two hosts making it apart would compete for one name on one type. What stays with a host, and why, is set out under [what stays with the host](#what-stays-with-the-host).

| Part | What it adds |
| --- | --- |
| [Current resolutions](#current-resolutions) | A registration that can't change a resolution leaves it current, its evaluators and prepared calls among it |
| [Structured values](#structured-values) | An object expression written where a structured type is declared constructs a value of it, and a host declares a data binding's type |
| [Numbers](#numbers) | Rounding, the absolute value, the lesser and the greater of two, and clamping |
| [Positions](#positions) | A list's position of a value, and of the first item a predicate holds for |
| [Strings](#strings) | Length, trimming, case, searching, replacement, splitting and slicing |

Every part is an intended addition, never a redesign: each accepts what was refused or names what was unnamed. None is promised compatible on that ground alone, since accepting an argument can change which candidate a selection chooses, and a member Lexica's own type declares wins over a module's extension of that type; each part states what it changes and tests it.

<a id="current-resolutions"></a>

## Current resolutions

**The gap.** Every registration advances the registry's revision, and every evaluator entry point, a prepared call's projection among them, refuses a registry that has moved past its resolution (LEXICA2040), whether or not the module registered could reach the script. The specification asks exactly that, so it is a limitation of the contract, not of the implementation. A host that keeps an evaluator for each result it keeps current, and a prepared call for each host call that delivers over time, loses every one of them the moment it registers a module, and a host that registers modules as its pages first need them registers them while requests run. Resolving again repairs nothing: a new evaluator compiles again and loses what captured members hold, and a host call can't be prepared again without evaluating its locals again, which preparing a call does once.

**What a later module can change.** Resolution reaches only what a script's imports make available, Lexica's own always; a type selector's key, once registered, is never replaced; and a registration changes no type's membership, hierarchy or data shape. So a module registered after a resolution changes it through one path alone: **recognition**, the `typeOf` every module answers of a value, asked as it is evaluated. Evaluation asks it in these places:

- a deferred access, which selects by its receiver's actual type;
- an extension access on a receiver of `Any`, which checks the receiver is of the extension's target;
- a type argument inferred from a value of `Any`;
- an equality of a value of `Any`;
- the check that a result holding `Any` is data;
- capturing a value its host supplies, where a reference of another type stands where a nullable reference type is declared.

**The rule.** A resolution **may recognize** values as it is evaluated where a declaration it uses, in any branch, reached or not, gives it a value of `Any`, through its result, the arguments a callback is called with or a key its fixed argument selects, or where it ends in a host call whose supplied type holds a nullable reference type: those are the only ways a value of `Any` reaches an evaluation, and the only supplied values capturing recognizes. A parameter's own type of `Any` gives the script nothing, and a supplied value of data is captured without recognition, so neither makes a resolution stale. Evaluation also recognizes on an extension access whose receiver is a value of `Any`, which only such a declaration gives. A registration of a module that declares a `typeOf` makes stale every resolution that may recognize; any other registration leaves every resolution current. The test is the resolution's own, answered from what it resolved, so it never depends on which paths an evaluation has taken so far: `resolution.isCurrent` answers it, an evaluator and a prepared call made from a current resolution keep working across the registration, and one made from a stale resolution is refused as today (LEXICA2040). The registry's revision stays, for a host that keys anything else by it.

**Refused alternatives.** Resolving every request again after each registration loses what an evaluator holds, as above. A registry for each set of modules splits one recognition of a host's values across registries. Recording whether an evaluation has recognized anything so far misses a branch it hasn't taken yet.

**Acceptance.** One evaluator and one prepared call, kept across the registration of an unrelated module, keep evaluating and projecting: the prepared call's locals keep the values they were prepared with, and the metadata's origins stay the tokens they were, comparable with those before. A resolution that may recognize, through a branch an evaluation never takes among them, goes stale when a module declaring a `typeOf` registers, and stays current for one that declares none. A host confirms its own requests continue at its migration checkpoint.

<a id="structured-values"></a>

## Structured values

**The gap.** A structured type is nominal, an object expression's type is an object type, and no object type is assignable to a named type, so a script can't construct a structured value: given a member taking a `Point`, `board.place({ x = 1 })` is refused (LEXICA3042), and so is data bound as `point`, whose type is an object type too, and declaring `point`'s type is refused (LEXICA2023), since only a reference type can be declared. A member can already answer a structured value that another member accepts; what is missing is constructing one in place, and a host supplying one through a binding. A structured type holds references as well as data, so a nested option holding an element, a router's routes, and every record a host's typed request passes as an argument wait on it.

**Written in place.** An object expression written where a value parameter declares a structured type constructs a value of that type: checked against its data shape as an options object is checked against its member's parameters, each object field's value assignable to its property's type, a property left out null where its type is nullable and refused where it isn't, and an object field the shape lacks refused. The expected type reaches an object expression written:

- as a value argument, or an option, of that type, nullable or not;
- as an object field of an object expression so constructed, whose property is of a structured type;
- as an item of a collection expression written where a list of a structured type is expected, so constructed;
- as a branch of a conditional, or an operand of a coalescing, written in one of those places, since such an expression's value is one of its operands';

parentheses changing nothing, as they change no definition. It reaches nothing else. A local's value is typed where it is written, so `let point = { x = 1 }` holds an object, and `board.place(point)` is refused as today, where `board.place({ x = 1 })` constructs; a function's body is typed by its own expressions, so a function answering `{ x = 1 }` answers an object too, and so does an expression, a predicate or a function argument's body, which is no value argument. The boundary is where a type is written into a value: a value that has a type of its own keeps it, and a host or a script that means a structured value writes it where the type is declared. A parameter whose type is a type parameter takes no expected type from it unless its receiver has bound it, so `identity({ x = 1 })` infers an object as before, and `points.concat([{ x = 1 }])`, on a `List<Point>`, constructs a `Point`. A deferred call's parameters are known only as it is evaluated, so its arguments construct nothing, and an object it is given is checked as any argument of a value of `Any` is.

**Selection.** An unnamed or a named indexer's signatures are selected by their key's type; a key written in a form the type reaches, an object expression, a list, a conditional or a coalescing, constructs the one structured type among them it fits, and where it fits several, as `{ x = 1 }` fits both a `Point` and a `Vector` of an `x`, the access is refused as ambiguous, naming them. No other selection reads an argument's type: a member is selected by its receiver.

**Bound.** A host declares a binding's type by a type's notation, `registry.createBindings({ routes }, { types: { routes: 'List<Input.Route>' } })`, read as a declared binding's type is, against the registry; a type that holds `Any`, `Never` or a position at any depth of its data, and a dictionary keyed by no key type, are no type a binding holds (LEXICA2044). A declared reference type keeps its contract: the value must belong to it, null admitted where the type is nullable, or the binding is refused. Any other declared type captures the value, as [capturing a supplied value](../../spec/runtime.md#runtime-host-calls-capturing) captures what a host supplies, since a binding is a value a host supplies: a structure keeps its declared data shape alone, a property the data leaves out is null where its type is nullable, a reference of another type standing where a nullable reference type is declared is null, and data the type doesn't admit refuses the binding, naming the binding and the part of its value, as data that reaches itself does (LEXICA2022). The captured value is the binding's, frozen, its references kept as they are, and its declared type is its static type and part of the resolution key.

**Declined: unions.** One shape of nullable fields, and a field telling which of them a value fills, serves data of several families, its consumer validating what each family needs. A union would need a notation, narrowing and a projection rule of its own for data one shape holds; it waits for a host whose data no one shape holds. A host's supplied values need nothing new: capture already makes a property a record leaves out null.

**Acceptance.** Each place the expected type reaches constructs, and each it doesn't, a local, a function's answer, a body and a deferred call, is refused or infers as before; a property left out, nullable and not, an object field the shape lacks, a nested structure, a list of structures and a structure holding a reference are each tested; an ambiguous key is refused; and a declared binding captures its data shape alone, nulls a reference of another type and refuses mistyped data.

<a id="numbers"></a>

## Numbers

Lexica's `Number` declares no member but `sequence`, so a script can't round a measurement it compares, and a host that declares rounding declares it for itself alone. Number's own:

| Member | Answers |
| --- | --- |
| `round` | The nearest whole number, a half rounded away from zero, so `2.5.round` is `3` and `(-2.5).round` is `-3` |
| `floor`, `ceiling`, `truncate` | The nearest whole number at or below, at or above, and toward zero |
| `abs` | The absolute value |
| `min(other)`, `max(other)` | The lesser and the greater of the number and `other` |
| `clamp(low, high)` | The number within `low` and `high`, inclusive; a `low` above `high` refused where it is evaluated |

- **Properties and functions.** A member taking nothing is a property, as `reverse` and `distinct` are; one taking a number is a function.
- **Half away from zero.** Rounding is symmetric under negation, `(-x).round == -(x.round)`, which offsets and differences that can be negative need. It differs from ECMAScript's `Math.round` at a negative half alone, which rounds toward positive infinity.
- **Zero.** Each answers `0` where it would answer `-0`, so `(-0.4).round` is `0`.
- **Declined.** Rounding to decimal digits is out of this scope, its rounding of a binary value's decimal expansion a contract of its own, reopened by a host that needs it; a step is written `(x * 2).round / 2`. A tolerance a script writes, and a tolerance carried through arithmetic, are declined: a member declares its measurement's tolerance, a script that wants coarser numbers rounds them, and a bound carries through addition and subtraction alone, so a rule for some operators would be a rule with exceptions.

<a id="positions"></a>

## Positions

A list's own members find items, never where they stand, so a script can't tell a host where an item is:

| Member | Answers |
| --- | --- |
| `indexOf(value)` | The position of the value's first occurrence, by [key equality](../../spec/types.md#types-dictionaries-and-pairs), a reference's by its identity, a `Number?` null where none stands |
| `indexWhere(predicate)` | The position of the first item its predicate is truthy for, a `Number?` null where none is, evaluating it against no item after that one |

Null rather than `-1`, as a lookup by an index answers null where no item stands. `indexOf` compares as `contains` does, null equal to a null item; `indexWhere` reads its items as `where` does, a null item falsy.

<a id="strings"></a>

## Strings

Text is joined by interpolation already, `$"{prefix}{name}"`, but Lexica's `String` declares no member, so a script can't trim, compare by case or search a text. String's own, each counting in UTF-16 code units, as ordering compares strings and as a host's text holds them:

| Member | Answers |
| --- | --- |
| `length` | The number of code units |
| `trim` | The text without the whitespace at either end: tab, line feed, vertical tab, form feed, carriage return, U+FEFF, U+2028, U+2029 and every space separator |
| `lowercase`, `uppercase` | The text under Unicode's default case conversion, its full mappings, without a locale, so its length can change, as `"ß".uppercase` is `"SS"` |
| `startsWith(text)`, `endsWith(text)`, `contains(text)` | Whether the text begins with, ends with or holds `text`, exactly by code unit |
| `indexOf(text)` | The position of `text`'s first occurrence, a `Number?` null where it stands nowhere |
| `replace(old, new)` | The text with every occurrence of `old` replaced by `new`, literally, left to right, none overlapping |
| `split(separator)` | A `List<String>`, the parts between each occurrence of `separator`, in order, an empty part where two occurrences meet or one stands at either end, and the text alone where it holds none |
| The unnamed indexer, `[range]` | The code units within the [range](../../spec/types.md#types-positions), strict as a list's slice |

- **The empty text.** It stands at every position, so `startsWith("")`, `endsWith("")` and `contains("")` are true and `indexOf("")` is `0`. It has no occurrence to replace or split at, so `replace("", …)` and `split("")` are refused where they are evaluated, each saying so, never inserting between, or splitting into, code units.
- **Code units, kept whole.** A boundary of a slice standing between the two halves of a surrogate pair is refused where it is evaluated, so slicing never makes a well-formed text ill-formed; the other members compare code units exactly, so a text holding a lone surrogate, which only a host can give, is found and split where it stands; a position past the text, or a start after the end, is refused as a list's slice refuses it.
- **Declined.** Regular expressions, which would bring an engine's dialect into the language; a locale's case and comparison; and the formatting and parsing of numbers beyond the conversions, a length written `"120px"` being its domain's to read, through a member or a conversion of its own.

<a id="what-stays-with-the-host"></a>

## What stays with the host

| Need | Stays | Why |
| --- | --- | --- |
| A running operation's occurrences, state and commands, and the owner that started it | The host's | Lexica knows who invokes a function and nothing of its lifecycle, as [host calls](../lexica-design.md#host-calls) set out. An operation and its occurrences are two host calls, each a script; an operation's state is a maintained member whose observation the running operation feeds |
| Reacting to an occurrence in the host, and several host calls in one crossing | The host's | Two scripts: the occurrence bound to the reaction's script, which is prepared synchronously, as evaluation is. A host call stays one per script, at its end, so each one's preparation and result type stay its own |
| A function a host call keeps | Deferred | It waits for a host call that must call back into its script, with that context and lifetime designed, as [the status overview](../features-status.md#deferred) records |
| Captured history | The host's | A captured member keeps its history while its host holds the evaluation, so the holder owns it: a host gives each evaluator an environment of its own, which a module keys its history by. Current resolutions keep the evaluator across every registration that can't change its resolution |
| A null argument that runs its call | Nothing to add | A call is skipped only where a null argument's parameter propagates null, so a parameter that accepts null runs |
| State of a whole document or page | Nothing to add | A member of the host's type for it, observing its receiver |
| Change sets, and the host's objects a result came from | Nothing to add | A result's metadata stays valid after later evaluations, and its sources hold references; matching is the host's, by sources or by a key it projects, so explicit identity stays deferred |
| Modules loaded as a script needs them | Nothing beyond current resolutions | `lexica.parse` gives a definition's imports without a registry, so a host loads and registers what a script imports before resolving it |
| A test of any receiver, as `is`, `has` and `supports` were | The host's | Lexica's verbs are removed: each was a second spelling of the Boolean function it was given, and choosing that a state reads `is` and a capability `supports` is an English reading no domain-free language makes. A module that wants one declares it for its own domain, in an extension of every type |
| A host call and a test of one name on one type | Nothing to add | Two members of one name on one type are refused, and who invokes a member can't tell them apart, since a call reads as a value and as a host call alike |
