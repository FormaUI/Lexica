# Evaluation

<a id="runtime-evaluation"></a>

The runtime evaluates a resolved script synchronously, for the host that asks. An evaluator holds one binding set and the **environment** the host owns, and evaluates as often as it is asked, one evaluation at a time, each given the hooks of a host that follows what it reads. The runtime carries the evaluation out and describes its result, and the host keeps everything that spans evaluations.

```js
const evaluator = resolution.createEvaluator(bindings, env);
const { value, metadata, isPending } = evaluator.evaluate({
    beforeInvoke(request) { /* note the read; answer a maintained member's samples */ },
    afterInvoke(request, value) { /* note the value read */ },
    afterEvaluation(outcome) { /* keep or close what the evaluation opened */ },
});
```

- **The evaluator** evaluates each node of the resolution, invokes each member's implementation with the [one object it receives](members.md#members-what-an-implementation-receives), its receiver, its arguments and the environment among them, checks the value it answers against the member's result type, and fails the evaluation at the member's location with an evaluation error where an implementation throws or answers a value not of that type. An implementation that throws fails unexpectedly: Nexo's error carries its own code, kind, message and the member's location, and its `cause` is exactly what the implementation threw, unchanged, any code on it kept and never copied, as a [hook that throws](#runtime-evaluation) does; a rejection a contract defines, as a conversion's or a cast's `reject`, keeps the handling its contract specifies.
- **The environment**, the host's `env`, is whatever the host gives the evaluator that does not belong in the script, which every evaluation of it uses, as a home's host gives the connection its members read the home through. The runtime passes it to every implementation and never reads it.
- **`beforeInvoke(request)`** is called before a member's implementation is invoked, with the request: the member's declaration, its receiver and arguments, where it stands in the definition, a JSON Pointer `getLocation` expands, a call within a script function's body naming the part of the body it is whichever call of the function reached it, and `isDeferred`, true where the member was selected during evaluation and false where resolution selected it, which a host refuses by throwing before anything is invoked, a property's getter included. It reports every invocation an evaluation attempts, whether it then succeeds, fails or is pending, so a host covers a read whose implementation throws. It answers an array of samples, which a member that reads maintained values receives as its `samples`; `{ pending: true }`, so the member is not invoked, reads as null and marks the evaluation pending; or nothing, which gives a maintained member no samples.
- **`afterInvoke(request, value)`** is called only after an implementation answered a value of its result type.
- **`afterEvaluation(outcome)`** is called once, in a `finally`, with a frozen outcome: `{ kind: 'completed', value }`, `{ kind: 'pending', value }` where a sample it read was pending, or `{ kind: 'failed', error }`, the failure the evaluation throws. The evaluation runs to one of the three synchronously, so none is cancelled while it runs.
- **What reaches the hooks.** Only the invocations an evaluation reaches call `beforeInvoke`, so short-circuited operands and unselected branches report nothing, and every function a member is given, an expression or a predicate argument among them, keeps the member's invocation as its lifetime, closed before `afterEvaluation`.
- **Each evaluation its own.** An evaluation's state is its own unless its host shares it, so an evaluation an implementation starts is isolated from the one that called it, and evaluating an evaluator from within its own evaluation is refused.
- **A hook that throws.** A throwing `beforeInvoke` or `afterInvoke` fails the evaluation at that member with an evaluation error of Nexo's own: its code, its kind, its message and the location of the invocation that failed are Nexo's, and its `cause` is exactly what the hook threw, an `Error` or any other value, unchanged. A code the thrown value carries stays on it: Nexo neither replaces it nor copies it into its own, and a thrown value may carry none. An error Nexo has raised for a failure is never wrapped again as it propagates. A `NexoError` a host builds isn't one Nexo raised: thrown from an implementation, a hook or a conversion, it is wrapped as any thrown value is, and becomes the `cause`. A throwing `afterEvaluation` after a failure leaves the original failure thrown, the cleanup failure recorded on it as its `suppressed` where the failure can hold a property, and after a success fails the evaluation itself, as a throwing hook does.
- **Without hooks.** A host with nothing to follow gives the environment alone, and an evaluation without a `beforeInvoke` reads fresh members alone, refusing a script that reads a maintained one.

In this document:

1. [Results and their metadata](#runtime-results)
2. [A value in a host's form](#runtime-host-forms)

<a id="runtime-results"></a>

## Results and their metadata

An evaluation answers its **value**, whether a member it read was **pending**, and its **metadata**, frozen throughout: the value, every list and structure in it, the metadata and the result that holds them, all but the host objects its sources hold, which Nexo never freezes. What an evaluation produced never changes, whatever the host's state does afterwards, but for those host objects, which stay the host's own, and each result and its metadata stay valid after later evaluations. A result is data and does not hold a reference value, as [results](../language/values.md#values-results) require.

The metadata describes the value, never part of it: frozen records of `{ origin, tolerance, objectFields?, items?, sources?, provenance? }`.

- **Origins.** An origin is an opaque token for the expression that produced a value, the same token exactly where one expression of one resolution, with one candidate selected, produced both values. It lives as long as the resolution, and is comparable across every evaluation of the evaluators made from it, never across resolutions. The runtime follows locals, bodies, `do` blocks, function calls, the object root's fields, the branch or operand a conditional, a coalescing, an `and` or an `or` selected, and the property a computed property access selected.
- **Tolerance.** A value's tolerance is the one its producing member declares. An expression that selects part of an existing value takes that part's metadata, inherited where it is, so `{ let climate = room.climate, warmth = climate?.temperature }` keeps the tolerance `temperature` declares; an expression that computes a new value, as arithmetic does, has an origin of its own and no tolerance unless a member declares one. A part with no record of its own inherits its parent's, and a record's `tolerance: null` overrides an inherited one.
- **Object fields and items.** `objectFields` holds the record of each object field of an object an object expression built, by its name in the order written, and `items` the record of each item of a list a projection built.
- **Sources.** The record of a list a projection built holds `sources`, one entry for each item: `sources[i]` describes the input that made item `i`, before its object fields are evaluated, a null input included.

  | Entry | Its input | Its `value` |
  | --- | --- | --- |
  | `{ kind: 'reference', value }` | A reference value | The host's object as held, its identity kept, never frozen, copied or otherwise changed by being recorded, so it may change afterwards |
  | `{ kind: 'data', value }` | A scalar, a structured value or any other data | Nexo's own frozen copy, as the evaluator holds it, which never changes |
  | `{ kind: 'null' }` | Null | None |

  An entry's kind follows its input's established type, a value carried through `Any` included, never a check of the value itself. The array and its entries are frozen, and nothing beneath a reference's `value`. A list no projection built has no `sources` property at all, the one way metadata says no sources were recorded, so a null source and absent sources stay apart, and a projection of no items records `sources: []`. Nexo reports each source's kind and identity, and a host decides how it matches by them. A source is not a key: equal values and one reference can each stand more than once, and recording them promises neither uniqueness nor a correspondence between evaluations.

<a id="runtime-results-provenance"></a>

- **Provenance.** Beside `sources`, the record of a list a projection built holds `provenance`, one entry for each item, of the kinds a source's entry has: `provenance[i]` is the source the earliest projection item `i` descends from recorded for it. A projection of a list no projection built records its own sources as its provenance; a projection of a list a projection built, read where it stands, through a local or as an object field, records for each item the provenance of the input it projected, so `people { name = it.name } { label = it.name }` keeps in its `provenance` the people its first projection read, while its `sources` hold the objects of names it projected, its actual immediate input. Lineage keeps that earliest source alone, never every list an item passed through. A list's `select` projects as an object projection does: its answer records each item it read as that item's source, and the provenance the item inherits.

  Provenance follows an occurrence, never a value: an input standing twice gives two entries, each naming the input its own occurrence descends from, and a null input a `{ kind: 'null' }` entry. A list no projection built has no `provenance` property at all, so missing provenance and a recorded null source stay apart, and a projection of no items records `provenance: []`. An entry's kind is the source's, its input's established type, so a reference's identity comes from the vocabulary's classification, never from a host's own check. Like a source, an entry is not a key and promises no unique correspondence: a host decides how it matches by it.

  An operation that filters, reorders or repeats the items of a list carries each occurrence's item record, source and provenance into its result, realigned in the result's own order, as [list members](../language/collections.md#collections-list-members) set out, so the result has records of its own and never reuses the original list's whole record: `where`, `take`, `drop`, `takeWhile`, `dropWhile`, `distinct`, `distinctBy`, `reverse`, `orderBy`, `orderByDescending`, `thenBy` and `thenByDescending` among a list's members, a slice by a range and `pick`, which gives an occurrence once for each time its position is given, each answered item carrying the lineage of the occurrence it is, by the position it stood at in the receiver, so items equal to each other never stand for each other: of three inputs projected to `1`, `1` and `2`, `.drop(1)` keeps the provenance of the second and the third. An ordering records nothing of its keys: its result's record is a reordered list's, as [ordering](../language/collections.md#collections-list-ordering) sets out. An operation that joins lists or answers values of its own, as `concat`, `flatten`, `selectMany`, `toDictionary` and `groupBy` do, records no lineage of its items.

The runtime gives the facts, and a host its policy, as comparing one result with the next or patching a copy of it.

<a id="runtime-host-forms"></a>

## A value in a host's form

A result exports the language's collections as data: a list as an array of its exported items; a pair as `{ key, value }`; and a dictionary as `{ entries: [{ key, value }, …] }`, its entries in their order, each key's type preserved, so a number's key stays a number. A dictionary or a pair is data where every key and every value is, recursively, so one holding a reference, as a key or a value, has no data form and is refused where a result would hold it, as any reference is; a script projects it to data first. Exported data never turns back into a dictionary or a pair when it is bound again.

A member's implementation gives the language's collections in a host's forms where its declaration says so: a set where a list is declared, a map where a dictionary is, and an object of a `key` and a `value` alone where a pair is, captured and validated as [capturing a supplied value](host-calls.md#runtime-host-calls-capturing) sets out, so a set gives a list of its items in its iteration order, keeping none of its uniqueness. It receives a dictionary as the language's, which answers `count`, `has(key)`, `get(key)`, `getEntry(key)`, `keys`, `values` and `entries`, and a pair as one of `key` and `value`. It receives an index as one of its `offset`, and a range as one of its `start` and its `end`, each a number, an index or null where the range leaves it out; each applies itself to a length with `resolveIn(length)`, an index answering the offset from the start it stands at, and a range its `start` and its `end` from the start, a start left out `0` and an end left out the length.
