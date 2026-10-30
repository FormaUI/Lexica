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

*Revised by [D9](#d9): no version was ever numbered `1.0.0-alpha.1` to `1.0.0-alpha.30`, so the entry is the one before `1.0.0-alpha.33`.*

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

<a id="d6"></a>

## D6 — The runtime's feature status reshapes the status overview rather than adding a document

*October 30, 2026.*

**What it settles.** A feature status for the runtime, as Roslyn keeps one for its compiler, was to be added under `docs/`, beside the status overview that already tracks what the implementation implements.

**Decision.** The status overview takes Roslyn's shape: a table of features, each with the contract that states it, its state and the language version the implementation follows it since, the language's and the runtime's apart. Roslyn's columns for branches, developers, reviewers and IDE buddies are left out, and the sections a table cannot hold, DOMQL's migration, tooling, the release, the open decisions and the deferred work, stay below it.

**Why.** Nexo has one implementation, so the runtime's feature status and the implementation's status are one subject, and the working instructions give each subject one home; a second document would split it and drift from the first. The columns left out name the people of a team this project does not have.

**Declined.** A separate `docs/` document beside the status overview.

<a id="d7"></a>

## D7 — A feature's version is the language version the implementation follows, not the implementation's own

*October 30, 2026.*

**What it settles.** Roslyn records the version a feature merged into, and Nexo carries two versions: the implementation's, its packages' release version, and the language's, the specification it follows.

**Decision.** Each feature names the language version the implementation has followed it since, linking that version's entry in the language history.

**Why.** The implementation's version has stood at `1.0.0-alpha.37` throughout, since no package has been published, so every feature would name it; the language version is the one that moved with each feature, and the one a host pins.

**Declined.** The implementation's version, which says nothing until a release advances it.

<a id="d8"></a>

## D8 — A feature's state names the gap or the deferral it keeps

*October 30, 2026.*

**What it settles.** The status overview recorded the gaps between the specification and the code, and the deferred work, apart from the capabilities they affect, so a reader of a capability could not see them.

**Decision.** A feature's state says *Implemented*, *Implemented, with a gap*, naming the gap and linking the open decisions, *Implemented in part*, linking what is deferred, or *Planned*.

**Why.** A host choosing whether to rely on a feature needs its gaps beside it, and the open decisions and the deferred work stay where their reasoning is kept.

<a id="d9"></a>

## D9 — The earliest entry tells the language's origin, and names no versions that never existed

*October 30, 2026.*

**What it settles.** The language history's earliest entry was headed `1.0.0-alpha.1` to `1.0.0-alpha.32`, and the history was to record the language's departure from DOMQL, its name Lexica and its renaming to Nexo, though the documents had been cleared of the former name.

**Decision.** The earliest entry is headed *Before `1.0.0-alpha.33`*, spans definition formats 1 to 32, and tells the language's origin in order: DOMQL's query language, its port as Lexica at version `1.0.0-alpha`, and the numbering of its versions. `1.0.0-alpha.38` records that Lexica was renamed Nexo. The history names Lexica as part of the language's past; elsewhere the former name stands only where DOMQL's checkpoints describe what DOMQL still uses.

**Why.** The record shows that no version was numbered before October 21, 2026, when the versions were declared in one place and numbered to match the definition format then current, which began at 1 in DOMQL; a heading naming `1.0.0-alpha.1` invents versions a reader would look for in vain. A history that hides a former name leaves a reader of DOMQL's or of git's history unable to connect it to the language.

**Declined.** Keeping the `1.0.0-alpha.1` heading, which reads as a version range and is not one.
