# Proposal: `Any` and deferred selection

**State: accepted.** Specified, and not implemented. It answers what happens when a receiver's concrete type is not known yet. It adds deferred selection beside the [receivers of unknown type](../../spec/types.md#receivers-of-unknown-type) the specification sets out, which keep their own rules, changes the [resolution](../../spec/runtime.md#runtime-bindings-and-resolution) it sets out, and [unit 2](../features-status.md#unit-2--member-selection-and-deferred-evaluation) of the implementation plan delivers it.

Related proposals: [contract generics](contract-generics.md), which keeps the types that resolution can know before evaluation, and [explicit extension access](extension-access.md), which selects an extension's member explicitly.

## Accepted

### Distinct concepts

| Concept | Meaning |
| --- | --- |
| `Any` | A declaration accepts or answers a value without restricting its concrete type |
| `null` | An actual null value, and its type |
| `Never` | No possible value, as the item of an empty list |
| Deferred member access | Member selection waits for the receiver's value |

"Unknown before execution" is information about resolution, not another value type.

- **`Any`** is a reserved type a parameter or a result declares, distinct from a result left out, which doesn't answer a value, as a host call that supplies nothing does. An omitted result never becomes `Any`. A receiver of any type is a container declaring a parameter and targeting it, as [named extension types](named-extension-types.md#targets) sets out, never `target: 'Any'`, which also keeps the relationship between a receiver and a result where a member needs it.
- **`null` and `Never`** keep their own rules. A known null receiver is known to be null, and `Never` describes the absence of a possible value, not a value whose type remains to be discovered. They may share machinery with deferred access, and `List<Never>` keeps serving empty-list inference.
- **Deferred access** applies to a member access whose receiver's concrete type is unavailable during resolution, as a value of `Any` is. An `Any` argument does not defer a call that is otherwise selected.

### One lookup at two moments

- If the receiver's type is known during resolution, its member is selected then.
- Otherwise the receiver expression and the member access are kept, and the member is selected when the receiver is evaluated, by the actual value's Lexica type.
- In both cases the same visibility, inheritance, ownership and ambiguity rules apply.

Missing members, incompatible receivers and invalid arguments remain errors, raised when the information is available rather than refused solely because it was unavailable before execution.

### Caching a selection

Any caching of a selection accounts for the receiver's actual type, so separate evaluations never reuse a selection that is incompatible with a new receiver. A nominal selection is kept by its node and the receiver's actual type within one registry context, and a change to the registry's contents invalidates it, or is part of its key. A plain structured object is looked up by its own fields each time, since objects of one general type need not hold the same fields.

### A value keeps its identity

`Any` neither establishes nor erases a value's concrete identity. A typed value keeps its identity through an unrestricted contract, so a `Climate` returned through `Any` remains a `Climate`. An untyped object arriving without metadata remains plain structured data, and a concrete result declaration establishes a checked identity at its boundary.

### Arguments and host calls

- **Arguments are read without the declaration.** A deferred call cannot require declaration-dependent interpretation of its argument expressions. Explicitly written function values have one meaning and are accepted; implicit-body and predicate interpretation is selected early.
- **Host calls are selected early,** since their special invocation behavior needs an unambiguous contract before anything is evaluated. [Explicit extension access](extension-access.md) provides that where necessary. A deferred access whose selection would be a host call is refused before anything is invoked, saying to make its receiver known or to select its extension explicitly.
- **An `Any` argument of a selected call** is checked against the selected contract when its value becomes available.
- **Null at a deferred access.** A direct access on null fails, its error naming the access; an optional access answers null without invoking anything.

### Host policy at the point of selection

Before invoking a member selected during evaluation, a property's getter included, Lexica checks that the host permits that declaration. Ownership, visibility, ambiguity and execution-position restrictions apply to deferred selection, which never runs a restricted operation to discover whether it was allowed.

### What a resolution reports

A resolution reports the declarations it has already selected and, separately, where deferred accesses remain; it never presents the selected declarations as an exhaustive list of everything execution might use. A host that requires a complete declaration list before execution has two options:

- Require those accesses to be resolved in advance, through known receiver types or explicit extension access.
- Request a conservative candidate analysis, and accept its possible overestimation.

A conservative analysis includes every declaration runtime selection could choose, through the actual lookup rules: the applicable members of the access's name, inherited members and the visible extensions reachable from the script among them. Extra candidates are acceptable, and the analysis reports itself as an overestimate.

### Deferred for later

Whether "dynamic language" is the right description of Lexica stays undecided until its checking and execution behavior is settled; generics in module contracts do not settle it.

## Migration

1. Declare `Any` where a result or an argument may be of any type, keeping an omitted result for no value.
2. Support deferred member selection where a receiver's concrete type is unavailable, with the host-policy check before invocation.
3. Keep each value's concrete identity through `Any`.
4. Report selected declarations and deferred accesses apart.
5. Update Lexica's documentation, tooling, and tests, and a host's migration, together.

Review the effects on resolution metadata and runtime behavior before assigning version changes.

## Validation

Verify that:

- `Any` remains distinct from a result left out, and `null` and `Never` keep their own rules.
- A member access whose receiver is a value of `Any` defers its selection to the actual type; a missing member is an evaluation error; and evaluations of different actual types reuse no selection.
- An `Any` argument leaves a selected call selected.
- A typed value returned through `Any` keeps its identity, and an untyped object stays plain data.
- A deferred call refuses an argument whose reading depends on the declaration, and accepts an explicit function value.
- A host call is never selected late, and one a deferred access would select is refused before anything is invoked.
- A direct access on null at a deferred access fails, and an optional one answers null.
- An `Any` argument of a selected call is checked against its contract when its value is available.
- A cached selection is never reused across a change to the registry, and a plain object's fields are looked up on each object.
- The host's policy is checked before a deferred selection is invoked, a getter included.
- A resolution reports selected declarations and deferred accesses apart, and a conservative analysis includes every declaration runtime selection could choose, inherited members and visible extensions among them.
