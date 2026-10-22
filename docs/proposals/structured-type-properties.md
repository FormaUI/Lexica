# Proposal: structured types declare properties instead of fields

**State: accepted.** Specified, and not implemented. It changes the contract [members](../../spec/members.md#members-declaring-a-member), [modules](../../spec/modules.md#modules-declaring-a-type) and [terms](../../spec/terms.md) set out, and joins the declaration structure of step 1 in [the status overview](../features-status.md#declaration-structure), without a definition version of its own.

## The change

Remove `field` as a module member kind. A structured type declares its stored data through properties without `updates`:

```js
{
    name: 'Reading',
    kind: 'structured',
    members: [
        { name: 'temperature', kind: 'property', result: 'Number' },
        { name: 'humidity', kind: 'property', result: 'Number' },
    ],
}
```

Lexica needs a declaration of a structured type's data shape to validate, copy and freeze its values. A separate member kind is unnecessary: the properties above provide that shape directly.

## Stored and computed properties

A property declared directly in a structured type is stored where it declares no `updates`, and computed where it declares them. Both are declared with `kind: 'property'` and read through ordinary property access.

| Declared | `updates` | Meaning | `impl` |
| --- | --- | --- | --- |
| Directly in a structured type | Left out | A stored property: Lexica reads the stored value by the property's name, and it is part of the stored data shape | Refused |
| Directly in a structured type | Given | A computed property: Lexica invokes its implementation, and it is not part of the stored data shape | Optional |
| In a reference type, an extension or a module | Required | A computed property | Optional |

The location matters: leaving out `updates` anywhere else is still an invalid declaration, never a stored property.

The stored properties replace the fields in every operation that validates, copies or freezes a structured value. Their `result` declares the type of each stored value. Computed properties are not evaluated or materialized merely to copy or freeze the value.

Stored properties take `name`, `kind`, `result` and `internal`. They take no arguments, parameters, `updates` or `impl`: their read behavior follows from the structured value's immutable-data contract. Computed properties keep the property contract, `updates` among it.

The rules for stored values, missing values, nullability and nested values among them, carry over unchanged. This proposal changes how the data shape is declared.

## Where the rule applies

The stored-property rule applies only to properties declared directly within their owning structured type. An extension cannot add stored data to another type.

A stored property and a computed property of one name on one type collide, as any two members of one name on overlapping receivers do. Both take part in the same accessibility and member-resolution rules, and how a property is stored introduces no separate script access form.

Private JavaScript state a module's implementation uses needs no Lexica declaration.

## Declarations without an implementation

A computed property without an `impl` still takes part in resolution, so a tool reads and checks every script that uses it, and creating an evaluator that needs it is refused, as [declarations without an implementation](../../spec/modules.md#modules-declarations-without-an-implementation) set out. Since `updates`, never `impl`, tells a stored property from a computed one, removing implementations for tooling never changes a type's stored shape. No new marker is needed.

## Scope and migration

Each structured member declared as `kind: 'field'` becomes `kind: 'property'`, keeping its name, result type and accessibility. The declaration validator and the structured-value machinery recognize stored properties, and `field` leaves the accepted member kinds: a member of `kind: 'field'` is refused, with a diagnostic directing its author to `property`.

Object expressions still declare fields, as in `{ temperature = 23 }`. Their syntax, lexical scope and definition nodes are unaffected. This proposal removes the module declaration kind, not the concept of an object field.

Neither script syntax nor the serialized definition changes, so the proposal needs no definition version of its own.

## Acceptance checks

- The `Reading` declaration above validates, and its stored values are checked, copied and frozen as the fields were.
- Stored and computed properties are read with the same property-access syntax.
- Copying a structured value does not invoke its computed properties.
- A property without `updates` in an extension, a reference type or a module is refused, and an extension cannot introduce a stored property.
- A stored property with an `impl` is refused.
- A computed property without an `impl` resolves, and an evaluator that needs it is refused.
- Stored and computed properties of one name collide.
- A member of `kind: 'field'` is refused, directing its author to `property`.
- Object-expression fields keep their behavior.
