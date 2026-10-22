# Proposal: named extension types

**State: accepted, with a point awaiting agreement.** Not specified, and not implemented. It answers where extensions live and how they are called. It keeps the extension containers of the decision of October 22, 2026, whose removal of generics [contract generics](contract-generics.md) supersedes, and it changes the extension blocks the [specification](../../spec/modules.md#extensions) sets out and the plan of step 1 in [the status overview](../features-status.md#next-type-and-member-declarations).

Related proposals: [contract generics](contract-generics.md), which sets out the type parameters a container may declare, and [`Any` and deferred selection](any-and-deferred-selection.md), which sets out how a member is selected where its receiver's type is not known before evaluation.

## Accepted

### Extension containers

Place extension containers in the module's `types` collection. Each has a name, `kind: 'extension'`, a `target`, and `members`.

```javascript
{
    name: 'collections',
    types: [
        {
            name: 'ListExtensions<T>',
            kind: 'extension',
            target: 'List<T>',
            members: [
                // Member declarations.
            ]
        }
    ]
}
```

| Field | Meaning |
| --- | --- |
| `name` | The extension container's name, followed by any type parameters it declares. |
| `kind: 'extension'` | Identifies an extension container. |
| `target` | The receiver type its members extend. |
| `members` | The operations contributed to that receiver type. |

Replace the separate module-level `extensions` collection with these containers. The suffix `Extensions` is a naming convention, not a language requirement.

Each container has one target. A module can declare multiple named containers for related groups of operations on the same or different targets.

An extension container owns its declarations and is addressable for member access. It is not an instantiable value type, does not wrap receivers, and does not change their type identities. Its target is not an inheritance relationship.

Existing restrictions on extension members remain applicable. Moving them into `types` does not permit stored instance properties or attach new state to receivers.

### Targets

A target is concrete, as `{ name: 'NumericListExtensions', kind: 'extension', target: 'List<Number>' }`, or refers to the container's parameters. An extension container may declare parameters shared by its target and members; the receiver establishes their binding for each call. The target may itself be a parameter, which extends a receiver of any type:

```javascript
{
    name: 'Verbs<T>',
    kind: 'extension',
    target: 'T',
    members: [...]
}
```

How parameters are declared, referred to and bound is [contract generics](contract-generics.md)'s.

### Identity

A declaration's identity is its module and local name. A module cannot declare the same type name twice, including extension container names.

There is no generic arity dimension: `ListExtensions<T>` and `ListExtensions` are one name, and a module declares it once.

Different modules may use the same local name. Existing qualification and visibility rules distinguish their declarations.

### Calls through a container

A callable extension member can be invoked with its receiver supplied explicitly:

```text
ListExtensions.someMember(receiver, ...)
```

The first argument is the receiver and must satisfy the container's target contract, binding the container's parameters as a receiver does. Remaining arguments correspond to the member's declared arguments. The receiver contract comes from `target`; the member does not redundantly declare it as an ordinary parameter.

For a callable member available through extension access:

```text
receiver.someMember(...)
ListExtensions.someMember(receiver, ...)
```

Receiver access uses normal extension lookup. Container access explicitly selects the declaring container. When both resolve to the same member, they use the same receiver, argument, and result checks. The receiver is evaluated once per call.

“Static access” here means access through the named container. It does not introduce static type declarations or generic arguments into scripts.

This call syntax applies to callable members. It does not automatically convert properties or indexers into functions. Their explicit container-access syntax, if needed, must be specified separately.

## Awaiting agreement

- **Containers on different instantiations.** Containers targeting `List<Number>` and `List<String>` may each declare a member of one name, since their receivers do not overlap. An empty list, a `List<Never>`, fits both, and is refused as ambiguous by the existing rules.

## Migration

1. Replace module-level extension blocks with named extension types using `target`.
2. Support explicit container calls with the receiver as the first argument.
3. Update Lexica's declarations, documentation, tooling, and tests, and a host's migration, together.

Review the effects on grammar, serialized definitions, resolution metadata, and runtime behavior before assigning version changes.

## Validation

Verify that:

- Extensions are registered through named containers under `types`, one target each, a concrete one among them.
- Duplicate names in one module are refused, extension containers' included, and identical names in different modules keep distinct identities.
- Explicit container calls require a compatible receiver, and agree with receiver access when they select the same member.
- An extension member doesn't declare a stored property or attach state to its receiver.
