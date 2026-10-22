# Proposal: contract generics

**State: accepted.** Specified, and not implemented. It answers how declarations express relationships between types. It supersedes the decision of October 22, 2026, to remove generics, and the [type parameters](../../spec/types.md#types-type-parameters) the specification sets out, and changes the plan of step 1 in [the status overview](../features-status.md#next-type-and-member-declarations).

Related proposals: [named extension types](named-extension-types.md), whose containers declare parameters as any declaration does, and [`Any` and deferred selection](any-and-deferred-selection.md), which sets out what happens where a value's type is not known before evaluation.

## Accepted

### Generics in contracts alone

Keep a small generic system in module contracts, with no generic programming in scripts. A script author supplies a list and calls an operation, and never writes a type parameter; modules do the descriptive work once.

Removing generics would have simplified the module contract and moved the cost elsewhere: implicit predicate arguments, host-call preparation, declaration reporting and host policy would each need machinery for accesses whose receiver type is unknown. The useful part of generics is small. It preserves relationships such as a result having the type of a list's items:

```javascript
{
    name: 'ListExtensions<T>',
    kind: 'extension',
    target: 'List<T>',
    members: [
        { name: 'first', result: 'T?', /* ... */ }
    ]
}
```

| Keep | Leave out |
| --- | --- |
| Parameters in module declarations | Explicit generic arguments in script calls |
| Relationships between receiver, arguments and result | Generic constraints, and variance beyond lists' |
| Inference from known inputs | Guessing parameters from unresolved names |
| Module and local name identity | Overloading container names by generic arity |
| The existing ambiguity rules | Specialization precedence rules |

Parsing nested type references, matching arguments and substituting result types remain real work; it is bounded to the contracts Lexica needs.

### Where parameters are declared

Parameters belong to declaration contracts generally. A member declares its own, whoever declares it: a type's own member, a module member, or a member of an extension container, as `identity<T>`. An extension container declares parameters shared by its target and its members, as [named extension types](named-extension-types.md#targets) sets out.

Lexica's own `List<T>` is the one generic value type. A module's own reference and structured types don't declare parameters, so stored data is never generic. Other generic value types, a map among them, are outside this scope.

### Declaring and referring positions

A position either declares type parameters or refers to them, never both:

```javascript
name: 'ListExtensions<T>' // Declares T.
target: 'List<T>'         // Refers to T.
```

- **Declaring positions.** A declaration's name declares its parameters, in angle brackets after its local name. A parameter is declared bare, as `T`.
- **Referring positions.** Every other position refers: a container's `target`, a member's `result`, a parameter's type, and a callback's types.
- **What a referring name is.** A name a declaration around it declares is that parameter. Any other name is a type's, and an unknown type where none exists, whatever its length: `T` may be an ordinary declared type. Whether a parameter is a parameter is never decided by whether a type of its name happens to exist.
- **Scope.** A container's parameters stand within the container and every one of its members; a member's own stand within that member.
- **Conflicts are refused.** Empty and duplicate parameter names are refused, and so is a parameter named as any type its declaration reaches unqualified: one of Lexica's own types, one of its module's, or one of a module it imports. A member declaring a parameter its container declares is refused too, since shadowing would add nothing. A conflicting declaration is never silently given another meaning.

### Nullability

`?` applies in referring positions, to a parameter as to a concrete type, and means "this value may also be null". It does not make a generic argument optional, and introduces no separate parameter.

| Contract | Meaning |
| --- | --- |
| `List<T>` | A list of values of type `T` |
| `List<T?>` | A list whose items may also be null |
| `List<T>?` | The list itself may be null |
| `List<T?>?` | Both the list and its items may be null |

`T?` is whatever type `T` stands for, plus null. The same notation serves concrete types: `Number?`, `Device?` and `List<Device?>`.

### Binding a call's parameters

Parameters are inferred, never written in a script, and inference must satisfy the whole call, so the order of the arguments never decides whether a call is valid. Extracting a binding and checking compatibility against one are separate steps.

- **The receiver establishes the container's parameters.** The container's target is matched against the receiver's non-null branch, stripping the receiver's outer nullability alone, so the items of a `List<Device?>` keep theirs. A null receiver is never silently accepted: a direct access on null fails, and an optional access answers null without invoking the member.
- **Extracting a binding is exact.** Matching `T` against a type gives `T` that type as a candidate, nullable or not; matching `T?` against a type gives it that type without null; and matching `List<P>` against `List<Y>` matches `P` against `Y`. So matching `List<Device>` against `List<T>` establishes `T` as `Device`.
- **Checking compatibility follows the type rules.** A later argument must satisfy an established binding without changing it: where a receiver binds `T` to `Device`, a `Device?` given for a parameter of type `T` is checked by that parameter's null policy, and never makes `T` a `Device?`. A concrete part is checked as any type is, so a `List<Light>` given where a concrete `List<Device>` is declared is accepted by [list covariance](#list-covariance); exact extraction never disables covariance during compatibility checking.
- **A member's own parameters are inferred from the supported sources:** its value arguments, and the results of its callbacks.
- **Nullable candidates combine, different types do not.** Inferring a member's own parameter, candidates of one type that differ only in nullability combine into the nullable type, so a `Device` and a `Device?` give `Device?`. Candidates of different types are refused as inconsistent, whichever comes first: a member taking two arguments of `T`, given a `Device` and a `Light`, is refused, and a common base type is never inferred.
- **Null and `Never` are different evidence.** `Never`, the item of an empty list, supplies no evidence about a type. A null argument given for an occurrence written `T` supplies evidence that the occurrence must accept null, which inference retains even where it cannot determine an underlying non-null type; one given for an occurrence written `T?` adds no constraint, since that occurrence accepts null already.

  | Occurrence and evidence | Binding |
  | --- | --- |
  | `T` receives only null | `T` is `null` |
  | `T` receives null alongside another source | The other source's type, made nullable |
  | `T` receives only `Never` evidence | `T` is `Never` |
  | `T?` receives null alongside another source | The other source's type; null adds no constraint |
  | `T?` receives only null | `T` is `Never`, so `T?` reduces to null |

  So `identity<T>` given null answers a value of the type `null`, never an impossible result. Binding `T` to `Never` where `T?` receives only null gives a deterministic result without inventing a non-null type; it is never a fallback for a parameter without an inference source, which registration refuses.
- **A callback's result is a source.** A callback's inputs are established from the bindings of the container's target and the member's value arguments, every value argument's binding collected before any callback is resolved, whatever the order of the arguments; the callback is resolved and checked against them; and its known result then establishes the parameters its result contract writes. A projection of a list's items into another type is the case it serves:

  ```text
  receiver:   List<T>
  projection: (T) => U
  result:     List<U>
  ```

  The receiver establishes `T`, and the projection's result establishes `U`. This is the one path through a function's signature that inference takes; it does not infer from every part of one. A callback's result never establishes another callback's inputs.
- **Expression parameters are callbacks.** An expression parameter, evaluated against each item, is a callback of the item for inference, and its declared result establishes the parameters it writes, as a function parameter's does; its scope and evaluation rules stay as they are.
- **Every occurrence satisfies the binding.** Each argument, each callback's types and the result are checked against it, and inconsistent, ambiguous or insufficient bindings are refused.
- **A contract decides what a member answers.** `first` of an empty list answers null because its contract, `T?`, and its implementation say so; inferring a parameter never determines a member's runtime behavior.

### Registration checks that inference is possible

A member is refused at registration where a parameter its result writes has no possible source: neither its container's target, nor any of its value parameters' types, nor any of its callbacks' result contracts writes it. A member whose callback's input writes a parameter that only another callback's result could establish is refused too, saying that callback results do not chain. Registration checks this structurally; a particular call can still be refused where the types it supplies are incompatible or insufficient.

### List covariance

Lists are immutable values, so a `List<Light>` stands where a `List<Device>` is declared, its items checked by their own types. This is a supported rule, the one variance the model has.

### What stays as it is

- **Inheritance remains.** The relationships between concrete module types, a reference type's supertype among them, stay as they are.
- **Casts, conversions and named type references are kept separately.** This proposal neither removes nor extends them.

## Migration

1. Move type parameters to declaring positions: a container's or a member's name declares them, and every other position refers to them.
2. Replace a receiver of any type, `<T>`, by a container declaring `T` and targeting it.
3. Replace the implicit type parameters, every single capital letter, with declared ones, so an undeclared name is a type's.
4. Update Lexica's declarations, documentation, tooling, and tests, and a host's migration, together.

Review the effects on grammar, serialized definitions, resolution metadata, and runtime behavior before assigning version changes.

## Validation

Verify that:

- A container's or a member's name declares its parameters, and every other position refers to them.
- An undeclared name in a referring position is a type's, an unknown type where none exists, whatever its length.
- Empty and duplicate parameter names, a parameter named as a type its declaration reaches unqualified, an imported one included, and a member re-declaring its container's parameter are refused.
- A receiver binds its container's parameters from its non-null branch, its items keeping their nullability, and a later argument is checked against that binding without widening it.
- A direct access on a null receiver fails, and an optional one answers null without invoking the member.
- A `List<Light>` given where a concrete `List<Device>` is declared is accepted, while matching `List<Device>` against `List<T>` binds `T` to `Device` exactly.
- `first` of a `List<Room>` answers a `Room?`.
- Candidates differing only in nullability combine into the nullable type; candidates of different types are refused whatever the argument order.
- An empty list supplies no evidence, and null evidence binds as its table sets out.
- A projection's callback result, or an expression parameter's, establishes the parameter of the list it answers, whatever the order of the arguments.
- A member whose callback's input needs another callback's result is refused at registration.
- A member whose result writes a parameter that nothing could establish is refused at registration.
- `T?`, `List<T?>`, `List<T>?` and `List<T?>?` read as their positions say, as do `Number?`, `Device?` and `List<Device?>`.
- A `List<Light>` stands where a `List<Device>` is declared.
- Inheritance, casts and conversions behave as before.
