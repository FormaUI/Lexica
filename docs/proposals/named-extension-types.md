# Proposal: named extension types

**State: accepted.** Specified, and implemented: declared with [unit 1](../features-status.md#unit-1--declarations-and-the-type-model)'s declaration model, selected by [unit 2](../features-status.md#unit-2--member-selection-and-deferred-evaluation)'s selector, and accessed explicitly with [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34)'s extension access. It answers where extensions live and how they are called. It keeps the extension containers of the decision of October 22, 2026, whose removal of generics [contract generics](contract-generics.md) supersedes, and it changes the extension blocks the [specification](../../spec/extensions.md#extensions) sets out and the [implementation plan](../features-status.md#implementation-plan) delivers it, declared in unit 1 and selected in units 2 and 3.

Related proposals: [contract generics](contract-generics.md), which sets out the type parameters a container may declare, [explicit extension access](extension-access.md), which selects a container's member explicitly, and [`Any` and deferred selection](any-and-deferred-selection.md), which sets out how a member is selected where its receiver's type is not known before evaluation.

## Accepted

### Extension containers

Place extension containers in the module's `types` collection. Each has a name, `kind: 'extension'`, a `target`, and `members`.

```javascript
{
    name: 'Collections',
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

Replace the separate module-level `extensions` collection with these containers. The suffix `Extensions` is a naming convention, not a language requirement: an extension's name begins with a capital letter, as any type's does, and `kind: 'extension'` alone makes it an extension.

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

### Extensions on different targets

Extension types with different concrete targets may declare members of one name, in one module or in several:

```javascript
{
    name: 'NumericList',
    kind: 'extension',
    target: 'List<Number>',
    members: [
        { name: 'total', /* ... */ }
    ]
}

{
    name: 'StringList',
    kind: 'extension',
    target: 'List<String>',
    members: [
        { name: 'total', /* ... */ }
    ]
}
```

Both register. Each extension type has its own identity, and sharing a member name across them is valid. Declaration names stay unique within a module, so an ordinary type and an extension type are never both named `NumericList` there.

Ordinary member lookup first determines which targets the receiver satisfies, by the existing assignability rules, then applies the existing ownership and ambiguity rules:

- `List<Number>` makes the numeric extension applicable.
- `List<String>` makes the string extension applicable.
- An empty list typed `List<Never>` satisfies both targets through list covariance. If the remaining lookup rules do not select one, the access is ambiguous.

Explicit extension access resolves that ambiguity, as `values:NumericList.total` and `values:StringList.total`, and module qualification remains available, as `values:Measurements.NumericList.total`. The selected extension's target must still accept the receiver: explicit selection does not bypass type checking. No specialization-precedence rule is needed; target applicability, the existing lookup rules and explicit extension selection decide.

### Explicit access

A script selects an extension's member explicitly with the [extension access operator](extension-access.md), `device:DeviceExtensions.usage`, whose syntax and rules are that proposal's.

## Migration

1. Replace module-level extension blocks with named extension types using `target`.
2. Update Nexo's declarations, documentation, tooling, and tests, and a host's migration, together.

Review the effects on grammar, serialized definitions, resolution metadata, and runtime behavior before assigning version changes.

## Validation

Verify that:

- Extensions are registered through named containers under `types`, one target each, a concrete one among them.
- Duplicate names in one module are refused, extension containers' included, and identical names in different modules keep distinct identities.
- Extensions targeting `List<Number>` and `List<String>` may each declare `total`, in one module or two; a `List<Number>` and a `List<String>` each select their own, an empty list is ambiguous between them, and explicit extension access selects either.
- An extension member adds nothing to a type's data shape, and attaches no state to its receiver.
