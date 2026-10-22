# Types

<a id="types"></a>

Every value has a type, and every expression is typed before it is evaluated. The language defines the scalar types, lists and object types; a module declares the rest, its reference types and its structured types. A script never declares a type: Lexica infers each expression's type from the types its bindings and its vocabulary give it. Every type a script names already exists, the language's own or one a module declares, and a script names one in two places alone: a [cast](#casts), which answers a reference as another type the hierarchy or a declared cast permits, and a [conversion](values.md#conversions), which converts data to another type of data. `device as Light` and `value to Number` each name an existing type, written bare as a member's name is.

Every member declares the types it accepts and returns, and resolution checks every expression against them before evaluation. A script that cannot be typed fails with a validation error identifying the location, the expected type and the actual type.

```lexica
room {
    floorArea = it.floorArea,                         // A number.
    lamp = (it.device("lamp") as Light)?.brightness,  // A device narrowed to a light: a number, or null.
    lights = it.devices.where(it.dimmable()).count
}
```

In this document:

1. [Type families](#types-type-families)
2. [Nullable and empty types](#types-nullable-and-empty-types)
3. [Type identity](#types-type-identity)
4. [Type parameters](#types-type-parameters)
5. [Reference types](#reference-types)
6. [No implicit conversion](#no-implicit-conversion)
7. [Nullability](#nullability)
8. [Receivers of unknown type](#receivers-of-unknown-type)
9. [Casts](#casts)

<a id="types-type-families"></a>

## Type families

| Family | Types and meaning |
| --- | --- |
| Scalar data | `Number`, `String`, `Boolean` |
| Reference types | Types a module declares whose values have identity, as `Room`, `Device` and `Light` |
| Lists | `List<T>`, a list whose items have type `T` |
| Structured values | Data a module declares, its stored shape its fields, as `Climate` |
| Object types | The field types inferred from an object expression, as `{ name: String, count: Number }` |

The scalar types, lists and object types are the language's own, which Lexica's own module owns; every reference type and structured type comes from a module, which [declares it](modules.md#modules-declaring-a-type) with its members.

<a id="types-type-names"></a>

A type is named in PascalCase, beginning with a capital letter, Lexica's own and every module's alike, and a module whose type's name begins otherwise is refused at registration. Its name is an identifier, matched exactly as every identifier is, so `Light` names a type and `light` does not, and is unique within its module, as [type identity](#types-type-identity) sets out; members, modules, bindings and locals are named in lowerCamelCase. The literals `true`, `false` and `null` are values, and stay lowercase.

<a id="types-nullable-and-empty-types"></a>

## Nullable and empty types

| Notation | Meaning |
| --- | --- |
| `T?` | A value of type `T`, or null |
| `null` | The type whose only value is null, the type of the literal `null` and of a null binding; fits every nullable type |
| `Never` | A type with no values; fits every type |
| `List<Never>` | The type of an empty list; fits every list type |

`null` is the language's intrinsic type, written as the literal is, in a declaration, an inferred type and a diagnostic alike; no type is named `Null`, and a module declares none of that name. `Boolean?` admits `true`, `false` and `null`. `Never` is the name of a type, and no word of the expression language.

| Type | Values |
| --- | --- |
| `Boolean` | `true`, `false` |
| `Number` | `0`, `42`, … |
| `String` | `"hello"`, … |
| `Never` | None |
| `Boolean?` | `true`, `false`, `null` |

<a id="types-type-identity"></a>

## Type identity

A type a module declares is identified by its module and its local name, so `home.Sensor` and `garden.Sensor` are two types. A local name is unique within its module, and two modules may each declare a type of one name. Lexica's own types keep their names: no module declares a type named `Number`, `String`, `Boolean`, `List` or `Never`, and none declares one named `Null`, since the type whose only value is null is the intrinsic `null`.

- **In a type's declaration.** A type reference resolves, without a qualifier, to a type parameter the declaration declares, one of Lexica's own types, a type of the declaring module, or a type of a module the type's `import` names, `import: ['home']`. An import covers that type's declaration whole: its supertype, its fields, its members' parameters, callbacks and results, and its operators' destinations. It reaches no other type, no module member, no extension and no script, a type beneath it inherits none, and naming the type passes none on. A type of the declaring module wins over an imported one of its name, and no import replaces one of Lexica's own types. Two imported modules declaring a type of one name make an unqualified reference to it ambiguous, unless the declaring module declares one, and import order never decides.
- **Qualified, anywhere in a declaration.** A reference may name a foreign type qualified by its module, `home.Device`, `home.Light?` or `List<garden.Sensor>`, whether or not its module is imported, and an unqualified reference does not search a module outside the scopes above.
- **In an extension, a module member and a selectable type.** None imports: the declaring module's types and Lexica's own resolve unqualified, and a foreign type is written qualified. An extension does not inherit an import of the type it extends.
- **At registration.** Registration resolves every reference to its module-qualified identity, and refuses an `import` that does not name a registered module, a reference that resolves to no type or to several, naming the qualified candidates, and a reference to another module's [internal](modules.md#modules-internal-declarations) declaration. Neither import order nor registration order decides a reference.
- **In a script.** A script resolves against its registry's whole public vocabulary, so it names a type unqualified or qualified: `device as Light`, or `device as home.Light`. A qualified name identifies the public type of that local name in that registered module. An unqualified name resolves to the one public type of its name across the registry: none is an unknown type, and several are an ambiguous one, refused with their qualified names given. Internal types take no part. The name is resolved first, and whether the cast or the conversion is permitted is checked after it, so no cast's success chooses a type. A qualified name fixes which type is named; it does not make a cast valid, and leaves a member or an operator the script selects as open to an ambiguity a later registration brings as any.
- **In a declared binding.** A host's [declared binding type](runtime.md#runtime-bindings), `'Device'` or `'home.Device'`, resolves by a script's rule when it binds, and the binding keeps the type it resolved to: a `Device` registered afterwards does not reinterpret a binding, and can make only a later unqualified request ambiguous.
- **In a diagnostic.** A diagnostic writes a type by its local name, `Light?`, and both qualified names where it involves two types of one local name: `Expected home.Sensor; found garden.Sensor`. That is display alone: identity, equality, a resolution key and operator selection use the qualified identity, and [canonical text](definition.md#definition) writes a cast's or a conversion's type as its definition holds it, qualified where it was written qualified.

<a id="types-type-parameters"></a>

## Type parameters

A type parameter stands for a type its declaration leaves open, and is one where a declaration declares it, within that declaration alone. `List` declares `T`, so its members' `T` is the type of the list's items: `rooms.first` is a `Room?` for a `List<Room>`. A generic extension declares its own, as Lexica's verbs are declared on any type `T`, so a test given to `light.is(…)` takes a `Light`. A name no declaration around it declares as a type parameter is the name of a type, so a module may name a type `X`.

<a id="reference-types"></a>

## Reference types

A reference type is a type a module declares whose values have identity: a value of it is the same value as another, or a different one, whatever either holds. A reference value has no data form, so an expression reads what it needs of one through its members and never holds one in a result. A module declares it in its `types` as `kind: 'reference'`, with its members within it, as [declaring a type](modules.md#modules-declaring-a-type) sets out.

- **A supertype.** A reference type may name one supertype, another reference type. A value of a type is a value of its supertype too, and a member declared on the supertype applies to it, so `light.name` reads the `name` `Device` declares. A type with no supertype begins a hierarchy of its own: `Room` and `Device` begin two.
- **Membership.** Every reference type declares `isInstance(value)`, which answers whether the value belongs to the type, `true` or `false`. A value belongs to a type where the `isInstance` of the type and of every supertype above it answers `true`. It is synchronous and changes nothing; an answer that is no Boolean, and an exception it throws, are faults, whose error names the type and the operation that asked.
- **Recognition.** A module may declare `typeOf(value)`, which names the type of a host's value its module recognizes, the most specific of the module's own reference types the value is of, or answers null where the module recognizes none. Where a binding's type is not declared, Lexica asks every registered module's `typeOf`. A name that is not a reference type of that module, an abstract type, and a type whose membership the value fails are faults of the module. Where several modules name a type, the value takes the one beneath every other, and is refused as ambiguous, with a structure error naming the types, where none is beneath the others; registration order never decides. A value no module recognizes is typed as data where it is data, and refused otherwise. Recognition never runs every type's `isInstance` to find one, since several types can accept one value: `energy`'s `Meter` accepts every device, as `Device` does.
- **Abstract types.** A type a module declares `abstract: true`, `false` where left out, is never what recognition answers, so a module's `typeOf` naming one is a fault. A declared binding may be of an abstract type.
- **A declared type.** A host may declare the type of a binding whose value is a reference, as [registry-aware bindings](runtime.md#runtime-bindings) set out, and no `typeOf` is asked for it. The value must belong to the declared type, by its `isInstance` and its supertypes', and fails the binding otherwise, with a structure error naming the binding and the type; no type beneath the declared one is asked. The declared type is the binding's static type, an abstract one included, so a light bound as a `Device` exposes `Device`'s members alone, as its host chose, until [`as`](#casts) narrows it, asking the narrower type's `isInstance`. Only a reference type can be declared, and only for a reference value; data is typed by its value alone.
- **Checked, never recognized again.** A value whose type is known is checked by membership and keeps that type: a member's answer, a cast's result, a callback's argument and result, and a value a host supplies to a host call's projection. None is recognized again, so a member's declared result gives its value the type a script sees, as `device.meter` answers a device as a `Meter`.
- **Identity.** `==` compares two references of one hierarchy by identity, as [equalities](expressions.md#equalities) set out, so `device.room == room` asks whether the device is in that room, never whether two rooms are alike.
- **Narrowing.** A value's static type exposes the members of that type and its supertypes alone. [`as`](#casts) narrows it to a type beneath, checked by that type's membership, so `(device as Light)?.brightness` reads a brightness where the device is a light.

<a id="no-implicit-conversion"></a>

## No implicit conversion

Lexica performs no implicit type conversion. Explicit data conversion uses [`to`](values.md#conversions).

A `Number` is not a `Boolean`, a `String` is not a `Number`, and a `Device` is not a `String`. `device[200]`, whose unnamed indexer takes a setting's name, `light.dim({ to = "full" })`, and a device supplied where a list is required are validation errors; a list's unnamed indexer takes a number, so `rooms[2]` is valid.

[Truthiness](expressions.md#truthiness) tests a value without converting its type. A predicate takes any value, and its member receives the value's truthiness: every number, zero included, is truthy, so `xs.where(it)` keeps every item of a list of numbers.

<a id="nullability"></a>

## Nullability

Nullability is part of a type, and null follows the signature: `T?` is a value of type `T` or null. A nullable receiver is read with optional access, as [required and optional access](members.md#property-access-calls-and-indexers-required-access-and-optional-chains) set out; a null argument follows its parameter's null policy, as [null arguments](members.md#nullability-a-null-argument-follows-the-parameter) set out; and a written or an unavailable null is a value like any other, as [null](values.md#null) sets out.

<a id="receivers-of-unknown-type"></a>

## Receivers of unknown type

A receiver of the type `null`, a null binding or the literal `null`, says nothing of what it would be, and neither does a `Never`, the item of an empty list. The concession is to missing type information alone: a receiver whose type is known is checked as always, a nullable one included, so `room.device(name)?.batery` is refused for a room `room` whatever device it names.

A receiver of the type `null` can be null, so it takes `?.`, and a `Never`, which no value has, takes `.`. A name applied to a receiver of unknown type resolves without choosing one declaration:

<a id="receivers-of-unknown-type-any-property"></a>

### Any property

A name written as a property is accepted whatever it is, since the fields of a bound object are named by its data, as `row?.id` for a null `row` and `rows { id = it.id }` for empty `rows` are; it is checked once its receiver's type is known.

<a id="receivers-of-unknown-type-known-calls-alone"></a>

### Known calls alone

A name written as a call or an indexer is a member's, written in the form, and given the arguments, that at least one of its declarations takes; a name no member has, one written as a call where every declaration is a property, and one given an argument none takes are validation errors, since data does not name a function.

<a id="receivers-of-unknown-type-the-call-keeps-who-invokes-it"></a>
<a id="receivers-of-unknown-type-the-request-keeps-its-kind"></a>

### The call keeps who invokes it

The declarations that take the name as it is written agree on who invokes it, the evaluator or the host, so the script gives a value, or ends in a [host call](members.md#members-host-calls), as they say.

Declarations that disagree on who invokes them are refused as ambiguous, and a cast to a reference type says which a null receiver means: `(thing as Light)?.dim({ to = 40 })` takes the light's declaration of `dim` for a null `thing`.

<a id="receivers-of-unknown-type-what-it-answers"></a>

### What it answers

A call the evaluator invokes answers null, and preparing a host call answers a skipped call, as with any null receiver.

Its type is the result type those declarations share, made nullable for a receiver of the type `null`, which answers null, and as they declare it for a `Never`, which is never evaluated, so `rooms { count = it.devices.count }` is valid where `rooms` is bound to an empty list and `rooms { count = it.devices.cuont }` is refused.

Where they share none, or the name is not any member's, it is `null` for a `null` and a `Never` for a `Never`: a `Never` fits wherever a value of any type stands, so `rooms { quiet = not it.silent }` is valid where `rooms` is bound to an empty list, and checked once it holds rooms.

<a id="receivers-of-unknown-type-what-is-checked-later"></a>

### What is checked later

Whether the name applies to its receiver is checked once the receiver's type is specific enough, when the binding is bound to a room, a list or another value that reveals its type.

<a id="receivers-of-unknown-type-an-object-expression"></a>

### An object expression

An object expression following such a receiver, or applied to the items of a `List<Never>`, resolves its fields against a `Never`, so a call in it is still checked; its type is the object type of its fields, made nullable after a null, and a list of it after an empty list, which answers the empty list.

A member read on a `List<Never>` runs, as on any list, so it resolves to one declaration as any receiver does: the vocabulary declares a name once for any receiver, and where more than one of its declarations takes a `List<Never>`, as only a type holding `Never` allows, the call is refused as ambiguous.

<a id="casts"></a>

## Casts

A cast answers a reference value as another type: `target as Type` answers its target itself where it belongs to that type, and null where it is null. A value that does not belong to it fails the evaluation, which [an attempt](expressions.md#attempts), `try target as Type`, answers null for instead.

```lexica
device as Light
(room.device(name) as Light)?.brightness
(preferred ?? fallback) as Light
(?(room.device(name) as Light).brightness)
(try room.device(name) as Light)?.brightness
```

The first and the third answer a light, which no result holds, so each stands within a larger expression, as the casts of the others do.

<a id="casts-target-type"></a>

### The type a cast names

The type is the name of a reference type the registry knows, written bare, its local name or qualified by its module, `device as Light` or `device as home.Light`, and found as [type identity](#types-type-identity) sets out; a string in its place, `device as "Light"`, is a syntax error giving `device as Light`. The name identifies the type directly: it does not read a local, field or script parameter of its spelling, and does not declare or infer a type. The cast is of that type, nullable where its target can be null, so `room.device(name) as Light` is a `Light?` and `device as Light`, with `device` bound to a device, a `Light`; an attempted cast is nullable always.

A name that is not a public type, or that several types share, is a validation error, the second giving the qualified names; a type that is not a reference type is a validation error naming the types its target can be cast to.

<a id="casts-strict"></a>

### Strict casts

A cast states the type the expression expects, and a value that does not belong to it fails the evaluation with an evaluation error naming what it is, as `The cast to Light rejected its value: it is a Thermostat`, so a thermostat where a light is expected is an error, never a silent null.

A cast that probes which type a value is is attempted, `(try device as Light) == light`.

<a id="casts-what-it-narrows"></a>

### What it casts

A cast reaches the types its target's static type is related to, and no other:

- **Within its hierarchy.** A cast to a type beneath its target's static type narrows it, checked by that type's membership. A cast to the target's own type or to a supertype of it, and a cast of null, are valid, since a binding may already be of the type or null, and each answers its target as it is. A hierarchy cast needs no declaration.
- **By a declared cast.** A [cast operator](modules.md#modules-operators) a module declares on a reference type permits a cast from it to the one other reference type its `result` names, as `energy` declares one from `Meter` to `home.Device`. It permits that direction alone: no cast back, no assignability, no equality across the two, and no cast through a chain of them. A declared cast between a type and itself, its supertype or a type beneath it is refused at registration, since the hierarchy decides those.
- **Nothing else.** Two types whose memberships accept the same values aren't related by that alone: `device as Meter` is refused, though `Meter` accepts every device. A cast of a target that can never be of the type, as `5 as Light` or `room as Light`, a type of another hierarchy that no declared cast reaches, is a validation error.

A declared cast with no `impl` answers its target itself, checked by the destination type's membership. One with an `impl` answers what it gives, the target itself, since a cast never constructs, wraps or replaces a reference, checked by the destination's membership, and rejects a value with `reject(reason)`, which a strict cast reports as an evaluation error and an attempted cast answers null for; any other failure of it is a fault, which an attempt does not catch. A cast of null answers null without calling it.

A cast converts nothing and narrows nothing outside itself: its target keeps its type wherever else it is read.

<a id="casts-cast-target"></a>

### Cast target

Its target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access: `room.device(name) as Light`, `(preferred ?? fallback) as Light` and `(?room.device(name)) as Light`. Any other grouped expression is not a target, so `(if metered then a else b end) as Light` is a syntax error, and neither is a chain an object expression continues.

<a id="casts-binding"></a>

### How a cast binds

A cast binds looser than access, so a call receives it only through a group: `(room.device(name) as Light)?.dim({ to = 40 })` dims the cast. A chain continues from a cast only through a group, `(room.device(name) as Light)?.brightness`, and a cast takes another as its target only in one, `(thing as Device) as Light`, so `device as Light.brightness` and `a as Device as Light` are syntax errors.

<a id="casts-in-an-optional-enclosed-access"></a>

### In an optional enclosed access

In an optional enclosed access, a cast in parentheses is a receiver, and the accesses of its own target become optional with the enclosed access's: `(?(room.device(name) as Light).brightness)` is `(room?.device(name) as Light)?.brightness`.

A target that is a coalescing operator in parentheses or an optional enclosed access is cast as it is and keeps its own rules: `(?((preferred ?? fallback) as Light).brightness)` is `((preferred ?? fallback) as Light)?.brightness`.

<a id="casts-evaluation"></a>

### Evaluating a cast

The target is evaluated once, and the cast answers it unchanged where it belongs to the type.
