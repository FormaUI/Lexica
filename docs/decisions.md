# Decisions

The decisions taken while carrying out work without stopping for a question, each with what it settles, what was decided and why, and what was declined, so their owner can review them and reverse any. A decision that settles a rule of the language or the runtime is stated in the [specification](../spec/README.md) too, where its subject lives; this record keeps the reasoning.

<a id="d1"></a>

## D1 — The language advances to `1.0.0-alpha.39`

*October 30, 2026.*

**What it settles.** Since the implementation followed language `1.0.0-alpha.38`, the specification's contract changed without its version advancing: the host API was renamed, `nexo`, `NexoError` and each type beginning `Nexo` in place of their former names; the host API a host could reach only through the type declarations was specified; and rules settled while implementing were stated, a value's actual type for deferred selection, an imported type's inherited members on a supertype's receiver, a type selector's key needing no import, and the order of a definition's imports. Two builds both reporting `1.0.0-alpha.38` exposed different host APIs.

**Decision.** Advance the language version to `1.0.0-alpha.39`, which the specification, the design, the README, the status overview and the implementation report, the definition format staying at 36 since its contract did not change.

**Why.** A version identifies a contract: a host pins one and expects the contract it names, and DOMQL's checkpoints name the version they migrate to. The specification states that its version advances whenever the language's contract does, and a renamed API is a change of the runtime's contract, which the same version covers.

**Declined.** Counting the rename part of `1.0.0-alpha.38`, as one change made in two commits on one day: it leaves the version naming two contracts, and it would have made every later change that slipped past a version advance a matter of judgment rather than of the record.

<a id="d2"></a>

## D2 — The language history summarizes `1.0.0-alpha.1` to `1.0.0-alpha.32` in one entry

*October 30, 2026.*

**What it settles.** The [language history](../LANGUAGE-HISTORY.md) was to summarize the early versions, up to `1.0.0-alpha.33`, in one entry, since the record keeps no boundaries between them.

**Decision.** One entry covers `1.0.0-alpha.1` to `1.0.0-alpha.32`, and `1.0.0-alpha.33` has an entry of its own.

**Why.** The specification first declared its version in one place at `1.0.0-alpha.32`, on October 21, 2026, and every version from `1.0.0-alpha.33` on has a commit that advanced it and a commit in which the implementation followed it, so its changes can be told apart from its neighbours' exactly. Summarizing a version whose boundaries are known would give up precision the record has.

**Declined.** Ending the summary at `1.0.0-alpha.33`, as first estimated, before the record was read.

<a id="d3"></a>

## D3 — A change stands in the first version whose implementation follows it

*October 30, 2026.*

**What it settles.** The specification sometimes changed after the implementation had declared that it followed a version, without the version advancing, so a change's version was ambiguous: lineage was specified after the implementation followed `1.0.0-alpha.34`, the verbs were removed after it followed `1.0.0-alpha.36`, and type names were required to begin with a capital after it followed `1.0.0-alpha.33`, then made a convention before it followed `1.0.0-alpha.34`.

**Decision.** Each change stands in the first version whose implementation follows it: lineage in `1.0.0-alpha.35`, the verbs' removal in `1.0.0-alpha.37`, and the enforced capital in none, since no implementation following a version ever enforced it. Each version is dated by the day the specification first described it.

**Why.** A host reads the history to learn what an implementation reporting a version does, and the implementation's following a version is what fixes that. The version the specification's title carried when a change was written would put the verbs' removal in a version whose implementation still has the verbs.

**Declined.** Placing a change by the version the specification carried when it was written, which is quicker to read off the record and wrong for the history's readers.

<a id="d4"></a>

## D4 — An entry covers both contracts and states what it breaks

*October 30, 2026.*

**What it settles.** C#'s version history, which this one follows, lists a compiler-independent language; Nexo's version names the specification's whole contract, the language and the runtime a host builds on.

**Decision.** Each entry lists the language's changes and the runtime's apart, a change to the specification's organization apart again, and ends with what it breaks, a version that breaks nothing saying so.

**Why.** A host migrating between versions needs the runtime's changes as much as a script's author needs the language's, and until the beta every version may break what the one before allowed, so what breaks is the line a reader looks for first.

**Declined.** A language-only history, which would leave a host's changes, the renamed API among them, recorded nowhere.

<a id="d5"></a>

## D5 — The history is held to the specification's version by a test and a rule

*October 30, 2026.*

**What it settles.** A history kept by hand falls behind the version it records.

**Decision.** The alignment test requires the history's newest entry to be the language version the specification describes, with its definition format, and the working instructions require a commit that advances the version to add its entry.

**Why.** The gate then refuses a version advance that leaves the history behind, as it already refuses one that leaves the README, the design or the status overview behind.
