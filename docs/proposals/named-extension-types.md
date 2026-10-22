# Proposal: named extension types without generics

**State: accepted.** Not specified, and not implemented. It supersedes the [type parameters](../../spec/types.md#types-type-parameters) and the extension blocks the specification sets out, and changes the plan of step 1 in [the status overview](../features-status.md#next-type-and-member-declarations).

**Decision:** remove generics from Lexica's language and module declaration model. Keep typed values, concrete module contracts, and named extension containers.

This revision supersedes the earlier generic-parameter and type-first lookup proposals. The direction was agreed on October 22, 2026; this document does not claim that the specifications or implementation have been changed.

## Language model

Lexica evaluates operations against typed values. A string is a string, a number is a number, and a list is a list. Modules can declare concrete types and describe which receivers and arguments their operations accept.

Lexica does not require a generic type system to express relationships between collection contents and operation results. A list operation can return an actual element, and subsequent operations can use that value's runtime type.

Use information available before execution to resolve names and identify errors where possible. When a result's type is not known in advance, defer the relevant member selection and type checks until its value is available. Lack of a statically known result type is not, by itself, an invalid script.

Record the decision to describe Lexica as a **dynamic language** in a later update to its public description. That wording update is separate from this proposal.

## What is removed

Remove generic parameters and arguments from type, extension, function, and member declarations and their type references. This includes:

- Angle-bracket generic forms such as `List<T>`, `List<Number>`, `Map<String,T>`, and `identity<T>`.
- Parameter declaration scopes, generic arity, substitution, and generic argument inference.
- Type-first fallback that treats an unknown type name as a parameter.
- Universal targets represented by a parameter such as `T`.
- Extension specialization based on generic arguments.

A type reference denotes a concrete declared or built-in type under the ordinary lookup rules. An unknown or ambiguous type name is an error; it does not create a parameter.

Removing generics does not remove concrete types, module qualification, argument validation, result validation, or ordinary value inference.

## Parsing and implementation simplification

Declaration names and type references no longer need a generic type-expression grammar. There are no nested angle-bracket arguments to parse, parameter lists to bind, or constructed generic types to represent. A reference such as `Map<String,List<Number>>` is removed from the contract rather than supported by an additional parser.

Ordinary name and module-qualification parsing remains. Concrete references still require lookup and validation, and dynamic calls still require runtime member selection and contract checks. The saving is the removal of generic syntax and its supporting machinery, not the removal of parsing or resolution altogether.

## Named extension types

Place extension containers in the module's `types` collection. Each has a name, `kind: 'extension'`, a concrete `target`, and `members`.

```javascript
{
    name: 'collections',
    types: [
        {
            name: 'ListExtensions',
            kind: 'extension',
            target: 'List',
            members: [
                // Member declarations.
            ]
        }
    ]
}
```

| Field | Meaning |
| --- | --- |
| `name` | The extension container's name. |
| `kind: 'extension'` | Identifies an extension container. |
| `target` | The concrete receiver type its members extend. |
| `members` | The operations contributed to that receiver type. |

Replace the separate module-level `extensions` collection with these containers. The suffix `Extensions` is a naming convention, not a language requirement.

Each container has one target. A module can declare multiple named containers for related groups of operations on the same or different targets.

An extension container owns its declarations and is addressable for member access. It is not an instantiable value type, does not wrap receivers, and does not change their type identities. Its target is not an inheritance relationship.

Existing restrictions on extension members remain applicable. Moving them into `types` does not permit stored instance properties or attach new state to receivers.

## Identity

A declaration's identity is its module and local name. A module cannot declare the same type name twice, including extension container names.

There is no generic arity dimension. A form such as `ListExtensions<T>` is invalid generic syntax, not another declaration that can coexist with `ListExtensions`.

Different modules may use the same local name. Existing qualification and visibility rules distinguish their declarations.

## Calls through a container

A callable extension member can be invoked with its receiver supplied explicitly:

```text
ListExtensions.someMember(receiver, ...)
```

The first argument is the receiver and must satisfy the container's target contract. Remaining arguments correspond to the member's declared arguments. The receiver contract comes from `target`; the member does not redundantly declare it as an ordinary parameter.

For a callable member available through extension access:

```text
receiver.someMember(...)
ListExtensions.someMember(receiver, ...)
```

Receiver access uses normal extension lookup. Container access explicitly selects the declaring container. When both resolve to the same member, they use the same receiver, argument, and result checks. The receiver is evaluated once per call.

“Static access” here means access through the named container. It does not introduce static type declarations or generic arguments into scripts.

This call syntax applies to callable members. It does not automatically convert properties or indexers into functions. Their explicit container-access syntax, if needed, must be specified separately.

## Collections and operation-specific requirements

A list's type is `List`. Its elements remain values with their own types. The list type does not encode a shared element type.

For a `first` operation, the answer is the actual selected value. The next operation uses that value's type; no parameter substitution is required. Existing behavior for an empty list remains part of the operation's contract.

An operation such as a numeric total can target `List` and validate the elements it consumes. Its requirement for numbers is an operation requirement, rather than a distinct constructed type `List<Number>`. A container name such as `NumericListExtensions` is descriptive; it does not establish that requirement by itself.

Similarly, if a module provides a `Map` type, an extension can use:

```javascript
{
    name: 'StringMapExtensions',
    kind: 'extension',
    target: 'Map',
    members: [
        // Operations that validate their string-key requirements.
    ]
}
```

Its name does not imply a `Map<String,T>` receiver contract. If a member requires string keys, that condition must be defined and checked by the operation. Alternatively, a module may expose a meaningful concrete domain type with its own validation; this proposal does not require one.

Removing generic specialization also removes dispatch distinctions that depended on it. Two operations cannot be distinguished merely by their former `List<Number>` and `List<String>` targets. Migrate those cases to distinct operation or container names, or one operation that handles its supported values explicitly. Preserve the existing ambiguity rules.

This example does not add a built-in map type.

## Module contracts and dynamic results

Modules retain concrete receiver, argument, and result contracts where those contracts are meaningful. An operation declared to return a number must still satisfy that contract.

Some operations may return a value of any supported runtime type. The declaration contract must represent that explicitly and distinguish it from an operation that returns no result. Preserve an existing unrestricted-value form if available; otherwise specify that form during the contract update. Do not silently change an omitted result into an unrestricted result.

Universal extension targets, if supported, likewise need an explicit unrestricted-value target rather than a generic placeholder. This proposal does not invent the spelling of that target or make an unresolved name a wildcard.

Dynamic evaluation does not imply automatic coercion, duck typing for every host object, or new collection conversion rules. Keep the existing value and concrete-type semantics except where generic removal explicitly changes them.

## Resolver and evaluator consequences

This is more than deleting angle brackets from declaration strings.

Registration continues to validate declaration names, concrete type references, member contracts, and container structure. It rejects unresolved types and obsolete generic syntax.

Resolution can retain known type information and detect errors that are already certain. It must also represent accesses whose receiver type becomes known only after evaluating another operation.

Execution selects or validates those accesses using the actual value's Lexica type. Missing members, incompatible receivers, and invalid arguments remain errors. They occur when the relevant information is available rather than being rejected solely because that information was unavailable before execution.

Any caching of a dynamically selected member must account for the receiver's actual type. Separate evaluations must not reuse a selection that is incompatible with a new receiver.

Retain existing ownership, visibility, ambiguity, and execution-position restrictions. Dynamic member selection must enforce them and must not run a restricted operation merely to discover whether it was allowed.

## Migration

1. Replace module-level extension blocks with named extension types using `target`.
2. Replace generic collection declarations and references with their concrete collection type names.
3. Remove parameter scopes, substitutions, generic inference, and the type-first parameter fallback.
4. Review every contract that used a parameter. Preserve concrete restrictions where known; use an explicit unrestricted-value contract where the result or argument may vary.
5. Replace generic specialization with explicit operation validation and unambiguous naming.
6. Support dynamic member selection where the receiver's type is not known before execution.
7. Support explicit container calls with the receiver as the first argument.
8. Update Lexica's declarations, documentation, tooling, and tests, and a host's migration, together.

Review the effects on grammar, serialized definitions, resolution metadata, and runtime behavior before assigning version changes. Do not assume this is only a declaration-format edit.

The public wording change to “dynamic language” is recorded for later.

## Validation

Verify that:

- Generic declarations and references are rejected.
- Unknown type names are errors rather than implicit parameters.
- Concrete receiver, argument, and result checks still apply.
- Extensions are registered through named containers under `types`.
- Duplicate names in one module are rejected; identical names in different modules retain distinct identities.
- Explicit container calls require a compatible receiver.
- Receiver access and container access agree when they select the same member.
- An operation can return a value whose type was not known before execution, and subsequent member access uses its actual type.
- A missing member on that value produces an appropriate runtime error.
- Different evaluations with different result types do not reuse an incompatible member selection.
- Numeric or string-key requirements are enforced by the relevant operations.
- An unrestricted result remains distinct from no result.
- Empty-collection behavior and existing ownership, ambiguity, and execution restrictions remain correct.

## Settled for the specification

- **Inheritance remains.** Removing generics leaves the relationships between concrete module types, a reference type's supertype among them, as they are.
- **Casts, conversions and named type references are kept separately.** This proposal neither removes nor extends them; the specification keeps their treatment apart from it.
- **An unrestricted value is not the absence of one.** An operation that answers a value of any type and one that answers no value stay distinct once a result of `T` is gone.

## Outcome

The extension-container design remains. Generic machinery is removed from both scripts and module contracts. Modules describe operations over typed values, and Lexica uses those values to perform the checks that cannot be completed before execution.
