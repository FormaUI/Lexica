# Values and types

<a id="values"></a>
<a id="values-and-types"></a>

A value is a number, a string, a Boolean, null, a list, a structured value such as a `climate`, a reference value such as a `light` or a `room`, or an event source. A member's signature declares its result type, as the section on types sets out, and a result marked `?` can be null by itself; an optional access answers null where its receiver is null, and any member answers null where an argument is null and its parameter propagates null.

A result is data: numbers, strings, Booleans, null, lists and objects. A reference value and an event source have no data form, so an expression whose result would contain one is a validation error; an expression reads the facts it needs of a reference value through an object expression.

In this document: [Objects](#objects) · [Lists](#lists) · [Types](#types) · [Reference types](#reference-types) · [No implicit conversion](#no-implicit-conversion) · [Nullability](#nullability) · [Bindings](#bindings) · [Receivers of unknown type](#receivers-of-unknown-type) · [Null](#null).

<a id="objects"></a>

## Objects

- A field is written with its name before its `=`, `warmth = it.climate?.temperature`, whatever its value is, and the language infers no name: a field without one is a syntax error, as is an object expression without a field.
- Two fields of one object expression with the same name are an error when the definition is checked.
- A result keeps its fields in the order the object expression names them.
- An object expression following null is null.

<a id="lists"></a>

## Lists

- A list keeps the order of its source: a member that makes a list says where its order comes from, and a bound list keeps the caller's; `where`, and an object expression following a list, keep its items in that order.
- An object expression following a list applies to each item and answers a list of the same length, in the same order; an item that is null answers null at its position, so over a list whose items can be null it answers a list of objects that can be null: `xs { a = 1 }` over a `list<device?>` is a `list<{ a: number }?>`.
- A member following a list is a member of the list itself: `room.devices.count` counts the room's devices.
- `count` of an empty list is 0, and `sum` is 0. `max` and `min` of an empty list are null.
- `max`, `min` and `sum` take a number expression, skip items whose expression is null, and answer null for `max` and `min`, and 0 for `sum`, when every item was skipped.
- `where` takes a predicate and keeps the items it is truthy for, leaving out an item whose predicate is null or false.
- `first`, `last` and the list's default indexer, `:[index]`, answer null when the list has no such item.
- The default indexer is the list's `:item[index]`, which answers the item at the index counted from zero, and null for an index past the end, for a negative one, which never counts from the end, and for a fractional one; `-0` is `0`.
- These members, `count`, `first`, `last`, `item`, `max`, `min`, `sum` and `where`, are Lexica's own module's, which owns lists, and each reads and changes as the items it selects and the expression it evaluates do.

<a id="types"></a>

## Types

Every value has a type. Every member declares the types it accepts and returns. Type checking happens during preparation, before evaluation.

A request that cannot be typed fails with a validation error identifying the location, expected type and actual type. Lexica infers types from expressions and caller bindings.

<a id="types-type-families"></a>

### Type families

| Family | Types and meaning |
| --- | --- |
| Scalar data | `number`, `string`, `boolean` |
| Reference types | Types a module declares whose values have identity, as `room`, `device` and `light` |
| Lists | `list<T>`, a list whose items have type `T` |
| Structured values | Named fields of declared types, as `climate` |
| Object types | The field types inferred from an object expression |
| Event sources | `event<T>`, a source whose event data has type `T` |

The scalar types, lists, object types and event sources are the language's own; every reference type and structured type comes from a module.

<a id="types-nullable-and-empty-types"></a>

### Nullable and empty types

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
- **A declared type.** A host may declare the type of a binding whose value is a reference, and classification does not run for it. The value must pass the test of the declared type and of every supertype above it, and fails the binding otherwise, with a structure error naming the binding and the type; no type beneath the declared one is tested. The declared type is the binding's static type, an abstract one included, since abstractness only keeps classification from answering it, so a light bound as a `device` exposes `device`'s members alone, as its host chose, until [`as`](casts-and-conversions.md#casts) narrows it, running the narrower type's test. Only a reference type can be declared, and only for a reference value; data is typed by its value alone.
- **Identity.** `==` compares two references of one hierarchy by identity, as [equalities](expressions.md#equalities) set out, so `device.room == room` asks whether the device is in that room, never whether two rooms are alike.
- **Narrowing.** A value's static type exposes the members of that type and its supertypes alone. [`as`](casts-and-conversions.md#casts) narrows it to a type beneath, checked by that type's test, so `(device as "light")?.brightness` reads a brightness where the device is a light.

<a id="no-implicit-conversion"></a>

## No implicit conversion

Lexica performs no implicit type conversion. Explicit data conversion uses [`to`](casts-and-conversions.md#conversions).

A `number` is not a `boolean`, a `string` is not a `number`, and a `device` is not a `string`. `device:[200]`, whose default indexer takes a setting's name, `light.dim({ to = "full" })`, and a device supplied where a list is required are validation errors; a list's default indexer takes a number, so `rooms:[2]` is valid.

[Truthiness](expressions.md#truthiness) tests a value without converting its type. A predicate takes any value, and its member receives the value's truthiness: every number, zero included, is truthy, so `xs.where(it)` keeps every item of a list of numbers.

<a id="nullability"></a>

## Nullability

Nullability is part of a type, and null follows the signature.

<a id="nullability-receiver-nullability"></a>

### Receiver nullability

`room.device(name).battery` is a validation error, since `device` answers a `device?`, and `room.device(name)?.battery` answers null without invoking `battery` where the room has no device of that name; its type is `number?`, since an optional chain is nullable where an optional access of it can meet null.

A member written with `?.` or `?:`, a predicate among them, answers null for a null receiver, so `room.device(name)?.is("active")` is a `boolean?` that is null where there is no such device.

<a id="nullability-a-null-argument-follows-the-parameter"></a>

### A null argument follows the parameter

A parameter is declared either to propagate null, which is the default and makes the call answer null without running, or to accept null with a meaning of its own, as `hold` accepts a null `until` to mean until it is disposed. Preparation never rejects an evaluated argument for being nullable; it rejects a type that cannot match.

A fixed argument that names a declaration, the event type of `on` and the predicate a verb asks, is different, and so is the name of a bracket property access: each must resolve to a non-null string during preparation, because a declaration cannot be looked up from null, and a bracket property access could not determine its result type.

Preparation determines every name such an expression can give, from literals, bound values, locals, conditional bindings, conditionals, `??`, `and` and `or`. A bracket property access is refused where an outcome can be null or false or names no property, and a fixed argument where one can be null or names no declaration; a binding is typed by its value, so `device[name]` and `sensor.on(name)` are validation errors alike where `name` is bound to null.

<a id="nullability-a-written-null-is-an-expression-that-produces-null"></a>

### A written null is an expression that produces null

`null` as a literal has no special treatment, and the signature and the evaluation rules decide what a call does with it.

<a id="nullability-null-is-unavailable-too"></a>

### Null is unavailable too

A device is a valid receiver of `battery`; a wired one answers null, as an unavailable value does. A receiver of the wrong type, a number for `battery`, is a validation error, and a module that returns a value of a type other than the one it declared has broken its contract, which is an evaluation error and never a quiet null.

<a id="bindings"></a>

## Bindings

A binding takes its type from its value, unless the host declares it. It is named by a letter followed by letters and digits, a reserved word among them, which an expression reads as `~` and the name, as `~as` and `~it` do.

- A reference value is of the type [classification](#reference-types) gives it, so a light is a `light`, or of the type its host declares for it, as [a declared type](#reference-types) sets out; a value no reference type's test accepts, and that is no data, is no binding, and one classification finds ambiguous is refused.
- A number, a string and a Boolean are `number`, `string` and `boolean`.
- Null is a `null`.
- A list is a `list<T>`, `T` the type its items share, the nearest supertype they share for references of different types, made nullable where one of them is null: `[light, thermostat]` is a `list<device>` and `[light, null]` a `list<light?>`. A list of nulls alone, `[null]` or `[null, null]`, is a `list<null>`, whose items can only be null, and the empty list is a `list<never>`, which holds no item.
- An object is of the object type of its fields' types, each typed as a binding is.
- A list whose items share no type has no type, because Lexica has no union types and a list holds items of one type, so binding `[1, "two"]`, or a room and a light together, is a structure error.

Binding keeps a frozen copy of the data it is given, through its lists and objects, and each reference value as itself, never copied or frozen, a reference within data among them. A caller that changes its data afterwards changes nothing bound, and binds anew to supply new data.

A tool that checks an expression without running it takes the same values, or values of the same types, for the bindings, since vocabulary declarations alone cannot establish the type of `room`.

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

<a id="receivers-of-unknown-type-the-request-keeps-its-kind"></a>

### The request keeps its kind

The declarations that take the name as it is written agree on the request kind they make, and the request is of that kind, so it takes the operations of its kind and is refused the others.

Declarations that disagree on their kind are refused as ambiguous, and a cast to a reference type says which a null receiver means: `(thing as "light")?.dim({ to = 40 })` takes the light's declaration of `dim` for a null `thing`.

<a id="receivers-of-unknown-type-what-it-answers"></a>

### What it answers

A value request answers null, a subscription listens to nothing, an action is not executed and answers null, and a behavior is applied with nothing started, as with any null receiver.

Its type is the result type those declarations share, made nullable for a receiver of the type `null`, which answers null, and as they declare it for a `never`, which is never evaluated, so `rooms { count = it.devices.count }` is valid where `rooms` is bound to an empty list and `rooms { count = it.devices.cuont }` is refused.

Where they share none, or the name is no member's, it is `null` for a `null` and a `never` for a `never`: a `never` fits wherever a value of any type stands, so `rooms { quiet = not it.silent }` is valid where `rooms` is bound to an empty list, and checked once it holds rooms.

<a id="receivers-of-unknown-type-what-is-checked-later"></a>

### What is checked later

Whether the name applies to its receiver is checked once the receiver's type is specific enough, when the binding is bound to a room, a list or another value that reveals its type.

<a id="receivers-of-unknown-type-an-object-expression"></a>

### An object expression

An object expression following such a receiver, or applied to the items of a `list<never>`, resolves its fields against a `never`, so a call in it is still checked; its type is the object type of its fields, made nullable after a null, and a list of it after an empty list, which answers the empty list.

A member read on a `list<never>` runs, as on any list, so it resolves to one declaration as any receiver does: the vocabulary declares a name once for any receiver, and where more than one of its declarations takes a `list<never>`, as only a type holding `never` allows, the request is refused as ambiguous.

<a id="null"></a>

## Null

Null answers both "there is no such value", as when `room.device(name)` finds no device, and "the value is unavailable", as when a sensor has reported no temperature yet. One null for both keeps results simple, at the cost of telling the two apart; a member whose consumers need the difference offers it separately, as `is("offline")` says whether a device has stopped reporting.

An optional access of null answers null and ends its chain. `??` supplies a fallback for null. Errors fail the result rather than becoming null; see [Errors and diagnostics](errors.md#errors-and-diagnostics).
