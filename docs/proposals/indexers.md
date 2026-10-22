# Proposal: indexers and computed properties

**State: accepted.** Specified, and not implemented. It changes the contract [members](../../spec/members.md), [modules](../../spec/modules.md#namespaces-indexers), the [grammar](../../spec/grammar.md) and the [definition](../../spec/definition.md) set out, and joins step 1 of [the status overview](../features-status.md#indexers-and-computed-properties), beside definition version 33.

## The problem

Brackets after a value read a property by a computed name, `it["climate"]`, so an indexer needs a syntax of its own: `device:setting["mode"]` for a named indexer and `rooms:[0]` for the default one. The colon is a form no reader expects, and the two most common uses read oddly: indexing a list, `rooms:[0]`, and reading a keyed member, `device:setting["mode"]`.

C# has one syntax for an indexer, `x[k]`, and what it does depends on `x`'s type. Lexica can do the same, and keep both named indexers and properties by a computed name, by giving each form one job.

## The proposal

| Form | Meaning | Declared as | Example |
| --- | --- | --- | --- |
| `x.name` | A property | `kind: 'property'` or `kind: 'field'` | `room.name` |
| `x.name(args)` | A function | `kind: 'function'` | `room.device("lamp")` |
| `x.name[k]` | A named indexer of `x`'s type, or the indexer of what the property `name` answers | `kind: 'indexer'` with a `name` | `device.setting["mode"]` |
| `x[k]` | The indexer of `x`'s type | `kind: 'indexer'` without a `name` | `rooms[0]`, `device["mode"]` |
| `x.[p]` | A property by a computed name | Nothing: it reads the property `x.p` names | `it.["climate"]`, `it.[p]` |

The optional forms follow the same pattern: `x?.name`, `x?.name[k]`, `x?[k]` and `x?.[p]`.

### Declaring an indexer

Every indexer is a member of kind `indexer` in a type's or an extension's `members`. Its one required value parameter is its key, its arguments are positional, and it declares its `result`, `updates` and `impl` as any member does.

```js
members: [
    { kind: 'indexer', parameters: [/* index */], result: 'T?', updates, impl },               // rooms[0]
    { kind: 'indexer', name: 'setting', parameters: [/* key */], result: 'String?', updates, impl }, // device.setting["mode"]
]
```

- **Without a `name`,** it is its type's indexer, written `x[k]`. A type has one: two unnamed indexers on overlapping receivers in one module collide, as two default indexers do today.
- **With a `name`,** it is a named indexer, written `x.name[k]`. Its name is a member name, so it collides with a property or a function of that name on the same type, and a type declares as many named indexers as it needs.
- **The `default-indexer` kind goes,** and so do `syntax` and `default`: a name, or its absence, says how an indexer is written.

A type whose keyed values belong together may still give them a view instead, a property answering the receiver as a type with an unnamed indexer, as `Energy`'s `Meter` view is reached through `device.meter`. A reader writes the same `x.name[k]` either way; whether a module declares a named indexer or a view is its own choice.

### Reading `x.name[k]`

The text parses as it reads, the member `name` and then brackets, and resolution decides what it is, by the receiver's type:

- Where the receiver's type has a named indexer `name`, accessible to the script, `x.name[k]` calls it with the key `k`.
- Otherwise `name` is a property, and the brackets call the unnamed indexer of the type it answers.

The two readings never both apply, since a named indexer and a property of one name on one type collide, and [owner precedence](../../spec/modules.md#namespaces-owners-and-extensions) chooses one declaration of a name. A named indexer written without brackets, `device.setting`, is refused, giving `device.setting[…]`, and a named indexer written as a call, `device.setting("mode")`, is refused, giving the same form.

Resolution reads the pair together. Where an indexer's target is a member access, it first asks whether that access names a named indexer of its receiver's type; where it does, the member access supplies the receiver and the indexer's name, and is not evaluated on its own, so nothing is evaluated between the receiver and its key. Only where it does not is the member access a property read, whose answer the brackets index.

A group does not add a node to the definition, so `(device.setting)["mode"]` is `device.setting["mode"]`.

This follows the precedent of [implicit bodies](../../spec/functions.md#functions-implicit-bodies): the definition records what was written, and the resolution records what it means, so the text alone still decides every construct's boundaries, and the vocabulary only what a name stands for.

### Optional forms

An optional access skips the rest of its chain where its receiver is null, its keys and arguments unevaluated and nothing invoked, as [optional chains](../../spec/members.md#property-access-calls-and-indexers-required-access-and-optional-chains) set out, and indexers keep that rule:

| Written | Where `name` is a named indexer | Where `name` is a property |
| --- | --- | --- |
| `x?.name[k]` | Null where `x` is null, `k` unevaluated; otherwise the indexer called with `k` | Null where `x` is null, `k` unevaluated; otherwise the property read and its answer indexed, which must not be null |
| `x.name?[k]` | The indexer called with `k`; the brackets' marker adds no protection against a null `x`, since a named indexer has no value between its name and its key | The property read, and null where it answers null, `k` unevaluated |
| `x?.name?[k]` | As `x?.name[k]` | As above, and null where `x` is null |

`x?[k]` answers null where `x` is null, `k` unevaluated, and otherwise calls `x`'s indexer with `k`. A group ends an optional chain, as everywhere: in `(device?.setting)["mode"]` the group holds a named indexer written without its key, which is refused.

### Computed names select properties alone

`x.[p]` reads a property, and nothing else. A computed name never selects a named indexer: in `device.[p][k]`, `device.[p]` reads the property `p` names and `[k]` indexes its answer, so where `p` settles to `"setting"`, a named indexer of that name isn't a candidate, and the computed name is refused, since no property has that name. Each form keeps its one job, though the definition records an ordinary and a computed property access alike as `member` nodes: the named-indexer reading applies only to a member access whose name is written, never to one whose name is an expression.

### The indexer of a type

`x[k]` calls the unnamed indexer of `x`'s static type, selected by owner precedence as a member is: the owner's indexer wins, one extension's applies where the owner declares none, and several are refused as ambiguous. A type with none refuses `x[k]`, and, where `k` is a string and `x` has a property it could name, the refusal gives the computed-property form, `x.[k]`.

Lexica's own `List` declares its unnamed indexer, the item at an index counted from zero, so `rooms[0]` is the first room and `rooms?[i]` answers null for a null list; the named indexer `item` goes.

### Properties by a computed name

`x.[p]` is today's bracket property access, written after a dot, as JavaScript's optional form `x?.[p]` is: it reads the property its name names, resolving to exactly the member `x.p` would, with its type, its null behavior and its observations. The rules that settle its possible names when the script is resolved stay as they are, so a literal, a script parameter, a local or a conditional binding holding one, and a conditional, `??`, `and` or `or` of them give its name, and a name that can be null, or that reads the host's state to settle, is refused.

### The definition

- **A computed property** stays a `member` node whose `name` is an expression node; only its text changes, from `x[p]` to `x.[p]`.
- **An indexer** is an `indexer` node of `target` and `argument`, and no `name`: `x[k]` holds `x` as its target, and `x.name[k]` holds the `member` node of `name` as its target, which the resolution reads as a named indexer where the receiver's type declares one.
- **Canonical text** writes each as it was written, so text and definition round-trip without a vocabulary.

The definition already moves to version 33 in step 1; these changes join it, and need no version of their own.

### Diagnostics

A form these rules leave without a meaning is refused with the form that has one:

| Written | Refused, giving |
| --- | --- |
| `device:setting["mode"]`, a name after a colon | `device.setting["mode"]` |
| `rooms.[0]`, a number where a computed property's name stands | `rooms[0]` |
| `room["name"]` on a type with no indexer | `room.["name"]` |

## Settled

1. **A named indexer's optional form.** Optional brackets after a named indexer's name are accepted and add nothing, as [optional forms](#optional-forms) set out, so an optional enclosed access holding one expands as it does any other. The definition keeps the marker as written, since where the name resolves to a property, it skips indexing that property's null answer.
2. **An unnamed indexer an extension declares.** An extension declares a type's unnamed indexer, selected by owner precedence as any member is, the owner's winning where it declares one; no other selection rule applies.
3. **Several unnamed indexers told apart by their key's type,** as C# allows, are deferred. A type has one unnamed indexer, and Lexica has no union types, so one indexer accepting keys of two types waits with them.
