# Types

<a id="types"></a>

Every value has a type, and every expression is typed before it is evaluated. The language defines the scalar types, lists and object types; a module declares the rest, its reference types and its structured types. A script never declares a type: Lexica infers each expression's type from the types its bindings and its vocabulary give it, and a cast narrows a reference to a type of its hierarchy.

Every member declares the types it accepts and returns, and resolution checks every expression against them before evaluation. A script that cannot be typed fails with a validation error identifying the location, the expected type and the actual type.

```lexica
room {
    floorArea = it.floorArea,                              // A number.
    lamp = (it.device("lamp") as "light")?.brightness,     // A device narrowed to a light: a number, or null.
    lights = it.devices.where(it.supports("dimming")).count
}
```

In this document:

1. [Type families](#types-type-families)
2. [Nullable and empty types](#types-nullable-and-empty-types)
3. [Reference types](#reference-types)
4. [No implicit conversion](#no-implicit-conversion)
5. [Nullability](#nullability)
6. [Receivers of unknown type](#receivers-of-unknown-type)
7. [Casts](#casts)

<a id="types-type-families"></a>

## Type families

| Family | Types and meaning |
| --- | --- |
| Scalar data | `number`, `string`, `boolean` |
| Reference types | Types a module declares whose values have identity, as `room`, `device` and `light` |
| Lists | `list<T>`, a list whose items have type `T` |
| Structured values | Named fields of declared types, as `climate` |
| Object types | The field types inferred from an object expression |

The scalar types, lists and object types are the language's own; every reference type and structured type comes from a module.

<a id="types-nullable-and-empty-types"></a>

## Nullable and empty types

| Notation | Meaning |
| --- | --- |
| `T?` | A value of type `T`, or null |
| `null` | The type of null alone; fits every nullable type |
| `never` | A type with no values; fits every type |
| `list<never>` | The type of an empty list; fits every list type |

`null` and `never` here are type notation. `never` is not an expression-language word, and the expression literal `null` is a value rather than a type declaration.

<a id="reference-types"></a>

## Reference types

A reference type is a type a module declares whose values have identity: a value of it is the same value as another, or a different one, whatever either holds. A reference value has no data form, so an expression reads what it needs of one through its members and never holds one in a result.

- **A supertype.** A reference type may name one supertype, another reference type. A value of a type is a value of its supertype too, and a member declared on the supertype applies to it, so `light.name` reads the `name` `device` declares. A type with no supertype begins a hierarchy of its own: `room` and `device` begin two.
- **A test.** Every reference type declares a test, a function of its module that decides whether a value belongs to the type. A value belongs to a type where it passes the test of the type and of every supertype above it.
- **Classification.** Where a value's type is not declared, classification finds it: it runs the tests of the types with no supertype, then of the types beneath each one whose test passed, and the value takes the unique most specific type that passed, the one beneath every other type that passed, so a dimmable light is a `light`. Where no type that passed is beneath all the others, as with two sibling types or two types of different hierarchies, the value is ambiguous, whatever the depth of either, and refused, with a structure error naming the types.
- **Abstract types.** A type a module declares abstract is never the answer of classification: a value whose most specific type is abstract is unclassified, and refused as an ambiguous one is. Were `device` abstract, a device that is no light, thermostat or sensor could not be bound; the examples' home declares it concrete.
- **A declared type.** A host may declare the type of a binding whose value is a reference, and classification does not run for it. The value must pass the test of the declared type and of every supertype above it, and fails the binding otherwise, with a structure error naming the binding and the type; no type beneath the declared one is tested. The declared type is the binding's static type, an abstract one included, since abstractness only keeps classification from answering it, so a light bound as a `device` exposes `device`'s members alone, as its host chose, until [`as`](#casts) narrows it, running the narrower type's test. Only a reference type can be declared, and only for a reference value; data is typed by its value alone.
- **Identity.** `==` compares two references of one hierarchy by identity, as [equalities](expressions.md#equalities) set out, so `device.room == room` asks whether the device is in that room, never whether two rooms are alike.
- **Narrowing.** A value's static type exposes the members of that type and its supertypes alone. [`as`](#casts) narrows it to a type beneath, checked by that type's test, so `(device as "light")?.brightness` reads a brightness where the device is a light.

<a id="no-implicit-conversion"></a>

## No implicit conversion

Lexica performs no implicit type conversion. Explicit data conversion uses [`to`](values.md#conversions).

A `number` is not a `boolean`, a `string` is not a `number`, and a `device` is not a `string`. `device:[200]`, whose default indexer takes a setting's name, `light.dim({ to = "full" })`, and a device supplied where a list is required are validation errors; a list's default indexer takes a number, so `rooms:[2]` is valid.

[Truthiness](expressions.md#truthiness) tests a value without converting its type. A predicate takes any value, and its member receives the value's truthiness: every number, zero included, is truthy, so `xs.where(it)` keeps every item of a list of numbers.

<a id="nullability"></a>

## Nullability

Nullability is part of a type, and null follows the signature: `T?` is a value of type `T` or null. A nullable receiver is read with optional access, as [required and optional access](members.md#property-access-calls-and-indexers-required-access-and-optional-chains) set out; a null argument follows its parameter's null policy, as [null arguments](members.md#nullability-a-null-argument-follows-the-parameter) set out; and a written or an unavailable null is a value like any other, as [null](values.md#null) sets out.

<a id="receivers-of-unknown-type"></a>

## Receivers of unknown type

A receiver of the type `null`, a null binding or the literal `null`, says nothing of what it would be, and neither does a `never`, the item of an empty list. The concession is to missing type information alone: a receiver whose type is known is checked as always, a nullable one included, so `room.device(name)?.batery` is refused for a room `room` whatever device it names.

A receiver of the type `null` can be null, so it takes `?.`, and a `never`, which no value has, takes `.`. A name applied to a receiver of unknown type resolves without choosing one declaration:

<a id="receivers-of-unknown-type-any-property"></a>

### Any property

A name written as a property is accepted whatever it is, since the fields of a bound object are named by its data, as `row?.id` for a null `row` and `rows { id = it.id }` for empty `rows` are; it is checked once its receiver's type is known.

<a id="receivers-of-unknown-type-known-calls-alone"></a>

### Known calls alone

A name written as a call or an indexer is a member's, written in the form, and given the arguments, that at least one of its declarations takes; a name no member has, one written as a call where every declaration is a property, and one given an argument none takes are validation errors, since data names no function.

<a id="receivers-of-unknown-type-the-call-keeps-who-invokes-it"></a>
<a id="receivers-of-unknown-type-the-request-keeps-its-kind"></a>

### The call keeps who invokes it

The declarations that take the name as it is written agree on who invokes it, the evaluator or the host, so the script gives a value, or ends in a [host call](members.md#members-host-calls), as they say.

Declarations that disagree on who invokes them are refused as ambiguous, and a cast to a reference type says which a null receiver means: `(thing as "light")?.dim({ to = 40 })` takes the light's declaration of `dim` for a null `thing`.

<a id="receivers-of-unknown-type-what-it-answers"></a>

### What it answers

A call the evaluator invokes answers null, and a host call's preparation is skipped, as with any null receiver.

Its type is the result type those declarations share, made nullable for a receiver of the type `null`, which answers null, and as they declare it for a `never`, which is never evaluated, so `rooms { count = it.devices.count }` is valid where `rooms` is bound to an empty list and `rooms { count = it.devices.cuont }` is refused.

Where they share none, or the name is no member's, it is `null` for a `null` and a `never` for a `never`: a `never` fits wherever a value of any type stands, so `rooms { quiet = not it.silent }` is valid where `rooms` is bound to an empty list, and checked once it holds rooms.

<a id="receivers-of-unknown-type-what-is-checked-later"></a>

### What is checked later

Whether the name applies to its receiver is checked once the receiver's type is specific enough, when the binding is bound to a room, a list or another value that reveals its type.

<a id="receivers-of-unknown-type-an-object-expression"></a>

### An object expression

An object expression following such a receiver, or applied to the items of a `list<never>`, resolves its fields against a `never`, so a call in it is still checked; its type is the object type of its fields, made nullable after a null, and a list of it after an empty list, which answers the empty list.

A member read on a `list<never>` runs, as on any list, so it resolves to one declaration as any receiver does: the vocabulary declares a name once for any receiver, and where more than one of its declarations takes a `list<never>`, as only a type holding `never` allows, the call is refused as ambiguous.

<a id="casts"></a>

## Casts

A cast answers a reference value as a type of its hierarchy: `target as "type"` answers its target itself where it is of that type, and null where it is null. A value of another type fails the evaluation, which [an attempt](expressions.md#attempts), `try target as "type"`, answers null for instead.

```lexica
device as "light"
(room.device(name) as "light")?.brightness
(preferred ?? fallback) as "light"
(?(room.device(name) as "light").brightness)
(try room.device(name) as "light")?.brightness
```

The first and the third answer a light, which no result holds, so each stands within a larger expression, as the casts of the others do.

<a id="casts-target-type"></a>

### The type a cast names

The type is the quoted name of a reference type, and the cast is of that type, nullable where its target can be null, so `room.device(name) as "light"` is a `light?` and `device as "light"`, with `device` bound to a device, a `light`; an attempted cast is nullable always.

A name that is no reference type is a validation error naming the types of its target's hierarchy.

<a id="casts-strict"></a>

### Strict casts

A cast states the type the expression expects, and a value of another type fails the evaluation with an evaluation error naming what it is, as `The cast to light rejected its value: it is a thermostat`, so a thermostat where a light is expected is an error, never a silent null.

A cast that probes which type a value is is attempted, `(try device as "light") == light`.

<a id="casts-what-it-narrows"></a>

### What it casts

A cast to a type beneath its target's static type narrows it, checked by that type's test. A cast to the target's own type or to a supertype of it, and a cast of null, are valid, since a binding typed from its value may already be of the type or null, and each answers its target as it is. A cast of a target that can never be of the type, such as `5 as "light"` or `room as "light"`, a type of another hierarchy, is a validation error.

A cast converts nothing and narrows nothing outside itself: its target keeps its type wherever else it is read.

<a id="casts-cast-target"></a>

### Cast target

Its target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access: `room.device(name) as "light"`, `(preferred ?? fallback) as "light"` and `(?room.device(name)) as "light"`. Any other grouped expression is no target, so `(if metered then a else b end) as "light"` is a syntax error, and neither is a chain an object expression continues.

<a id="casts-binding"></a>

### How a cast binds

A cast binds looser than access, so a call receives it only through a group: `(room.device(name) as "light")?.dim({ to = 40 })` dims the cast. A chain continues from a cast only through a group, `(room.device(name) as "light")?.brightness`, and a cast takes another as its target only in one, `(thing as "device") as "light"`, so `device as "light".brightness` and `a as "device" as "light"` are syntax errors.

<a id="casts-in-an-optional-enclosed-access"></a>

### In an optional enclosed access

In an optional enclosed access, a cast in parentheses is a receiver, and the accesses of its own target become optional with the enclosed access's: `(?(room.device(name) as "light").brightness)` is `(room?.device(name) as "light")?.brightness`.

A target that is a coalescing operator in parentheses or an optional enclosed access is cast as it is and keeps its own rules: `(?((preferred ?? fallback) as "light").brightness)` is `((preferred ?? fallback) as "light")?.brightness`.

<a id="casts-evaluation"></a>

### Evaluating a cast

The target is evaluated once, and the cast answers it unchanged where it is of the type.
