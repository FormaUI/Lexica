# Decisions

The decisions taken while carrying out work without stopping for a question, each with what it settles, what was decided and why, and what was declined, so their owner can review them and reverse any. A decision that settles a rule of the language or the runtime is stated in the [specification](../spec/README.md) too, where its subject lives; this record keeps the reasoning.

<a id="d1"></a>

## D1 — The language advances to `1.0.0-alpha.39`

*October 30, 2026.*

**What it settles.** Since the implementation followed language `1.0.0-alpha.38`, the specification's contract changed without its version advancing: the host API was renamed, `nexo`, `NexoError` and each type beginning `Nexo` in place of their former names; the host API a host could reach only through the type declarations was specified; and rules settled while implementing were stated, a value's actual type for deferred selection, an imported type's inherited members on a supertype's receiver, a type selector's key needing no import, and the order of a definition's imports. Two builds both reporting `1.0.0-alpha.38` exposed different host APIs.

**Decision.** Advance the language version to `1.0.0-alpha.39`, which the specification, the design, the README, the status overview and the implementation report, the definition format staying at 36 since its contract did not change.

**Why.** A version identifies a contract: a host pins one and expects the contract it names, and DOMQL's checkpoints name the version they migrate to. The specification states that its version advances whenever the language's contract does, and a renamed API is a change of the runtime's contract, which the same version covers.

**Declined.** Counting the rename part of `1.0.0-alpha.38`, as one change made in two commits on one day: it leaves the version naming two contracts, and it would have made every later change that slipped past a version advance a matter of judgment rather than of the record.
