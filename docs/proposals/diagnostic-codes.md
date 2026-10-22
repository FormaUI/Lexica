# Proposal: diagnostic codes

**State: accepted.** Specified in the catalog of [diagnostics and errors](../../spec/diagnostics-and-errors.md#diagnostics-codes), and not implemented; [Unit 0](../features-status.md#unit-0--decisions-and-the-specification)'s third stage codes every existing condition. It changes the contract [diagnostics and errors](../../spec/diagnostics-and-errors.md) sets out, as [settled rules](#settled-rules) record.

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

## Settled rules

1. **Strict operations keep throwing their first error.** The public tooling API collects diagnostics without throwing; accepting codes requires no other tolerant runtime API.
2. **Lexica owns `LEXICA` codes.** A host gives its own conditions codes of a prefix of its own, and preserves a Lexica error's code when it propagates it.
3. **One catalog, assigned in one pass.** The specification assigns a code to every condition it sets out at once, in a code column of its error tables, so each condition keeps one entry, and each new condition takes a new code when it is introduced. A diagnostic keeps its `kind`, `message` and `location`.
4. **A code identifies its condition,** never its wording or where it is raised: a reworded message, or the same condition detected elsewhere, keeps its code, and distinct conditions never share one because their messages resemble each other.
5. **Continuity.** Where a condition splits, the part that keeps its meaning keeps its code and the other parts take new ones; where no part keeps its meaning, its code is retired. A retired code is never reused, and a ledger of retired codes records each one, its condition and the version that retired it.
6. **Strict and tolerant reading** give one condition the same code; a tolerant reading may report further diagnostics, so their lists are not promised to match.
