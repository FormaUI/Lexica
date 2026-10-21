# Proposal: diagnostic codes

**State: proposed.** Not accepted, and not implemented. Accepting it changes the contract [diagnostics and errors](../../spec/diagnostics-and-errors.md) sets out; [the status overview](../features-status.md) tracks it.

## The problem

Every diagnostic has a kind, a message and a location. The kind says which stage failed, and the message what is wrong, but nothing identifies the particular condition apart from its message. A host or a tool that reacts to one condition, an editor that offers a fix for a misspelled member, a test that expects a fixed argument refused, matches message text, which changes whenever its wording improves.

## The proposal

Each condition a diagnostic reports gets a stable **code**, `LEXICA` and four digits, as `LEXICA3001`. A code identifies the condition; the kind still identifies the category, so the two never stand in for each other.

| Range | Kind |
| --- | --- |
| `LEXICA1000` to `LEXICA1999` | `syntax` |
| `LEXICA2000` to `LEXICA2999` | `structure` |
| `LEXICA3000` to `LEXICA3999` | `validation` |
| `LEXICA4000` to `LEXICA4999` | `module` |
| `LEXICA5000` to `LEXICA5999` | `evaluation` |

- **A diagnostic** is `{ code, kind, message, location }`. Its message may change; its code never does.
- **A code is stable once assigned.** A condition that is removed retires its code, which is never reused; a condition split in two keeps its code for one part and assigns a new one to the other.
- **An error carries its code.** `LexicaError` gains `code`, beside `kind` and `location`.
- **One catalog.** Every code is assigned in one table of the specification's diagnostics document, each with its condition and its kind, and each error table there names the code of each row.
- **Tolerant reading collects them.** A tolerant reading, which tooling uses, answers every diagnostic with its code; a strict operation throws the first, as it throws its error today.

## Questions to settle before acceptance

- Whether a public API collects diagnostics without throwing, a tolerant `parse` or `resolve`, or tooling alone reads them.
- Whether a host's own conditions take codes of a prefix of their own, or share Lexica's ranges.
- Whether the codes are assigned in one pass for every existing condition, or as each condition's message is next touched.
