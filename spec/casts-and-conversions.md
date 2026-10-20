# Casts, conversions and attempts

In this document: [Casts](#casts) · [Conversions](#conversions) · [Attempts](#attempts).

<a id="casts"></a>

## Casts

A cast answers a reference value as a type of its hierarchy: `target as "type"` answers its target itself where it is of that type, and null where it is null. A value of another type fails the evaluation, which [an attempt](#attempts), `try target as "type"`, answers null for instead.

```lexica
device as "light"
(room.device(name) as "light")?.brightness
(preferred ?? fallback) as "light"
(?(room.device(name) as "light").brightness)
(try room.device(name) as "light")?.brightness
```

The first and the third answer a light, which no result holds, so each stands within a larger expression, as the casts of the others do.

<a id="casts-target-type"></a>

### Target type

The type is the quoted name of a reference type, and the cast is of that type, nullable where its target can be null, so `room.device(name) as "light"` is a `light?` and `device as "light"`, with `device` bound to a device, a `light`; an attempted cast is nullable always.

A name that is no reference type is a validation error naming the types of its target's hierarchy.

<a id="casts-strict"></a>

### Strict

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

### Binding

A cast binds looser than access, so a call receives it only through a group: `(room.device(name) as "light")?.dim({ to = 40 })` dims the cast. A chain continues from a cast only through a group, `(room.device(name) as "light")?.brightness`, and a cast takes another as its target only in one, `(thing as "device") as "light"`, so `device as "light".brightness` and `a as "device" as "light"` are syntax errors.

<a id="casts-in-an-optional-enclosed-access"></a>

### In an optional enclosed access

In an optional enclosed access, a cast in parentheses is a receiver, and the accesses of its own target become optional with the enclosed access's: `(?(room.device(name) as "light").brightness)` is `(room?.device(name) as "light")?.brightness`.

A target that is a coalescing operator in parentheses or an optional enclosed access is cast as it is and keeps its own rules: `(?((preferred ?? fallback) as "light").brightness)` is `((preferred ?? fallback) as "light")?.brightness`.

<a id="casts-evaluation"></a>

### Evaluation

The target is evaluated once, and the cast answers it unchanged where it is of the type.

<a id="conversions"></a>

## Conversions

A conversion answers a value converted to another type of data: `value to "type"` evaluates its value, carries out the conversion the vocabulary declares from the value's type to the type it names, and answers the converted value. A cast converts nothing, and a conversion casts nothing.

```lexica
device:["level"] to "number"
device:["level"] to "number" ?? 0
device:["night-mode"] to "boolean"
room.devices.count to "string"
```

<a id="conversions-target-type"></a>

### Target type

The type is a quoted type name: `number`, `string`, `boolean`, or a structured type that holds data alone, whatever its fields hold, lists of data among them, as `climate` holds its readings.

A conversion converts data, so a reference value, a structured type that holds one, and an event source are no type it converts between, and what reads a host's state stays a member's, which declares how it changes; a reference value is cast to a type of its hierarchy with `as`.

A list itself is no type a conversion converts between, and neither is a type that can be null. A name no type has is a validation error, as is any other target.

<a id="conversions-one-declared-conversion"></a>

### One declared conversion

A value converts to another type only through the one conversion the vocabulary declares from its type to that type. Conversions never chain on their own: a Boolean converts to a string and a string to a number, and `enabled to "number"` is still a validation error, whose message names the types a Boolean converts to. An expression that means both conversions writes both.

<a id="conversions-a-value-already-of-the-type"></a>

### A value already of the type

A value already of the type answers itself, so `5 to "number"` is 5. This is the language's rule, and no conversion is declared from a type to itself.

<a id="conversions-null"></a>

### Null

A conversion of null answers null without converting, and its type is the type it converts to, made nullable where its value can be null.

A value of the type null, a null binding, converts to any type a conversion can name, however many conversions reach it, since nothing is converted; a value whose type is known is checked by that type without null, so `room.device(name) to "string"` is a validation error, as a conversion from a device is declared nowhere.

<a id="conversions-what-fails"></a>

### What fails

A value its conversion rejects, as `"40%" to "number"`, fails the evaluation with an evaluation error naming the conversion, the reason it gave and where it stands. A conversion that fails otherwise, by throwing or by answering a value not of its type, has a fault, which fails the evaluation too.

A failure never answers null or a default: `?? 0` gives a missing setting a value, and leaves a malformed one an error, for which [an attempt](#attempts) answers null instead. A watch whose conversion fails is failed until its value converts again.

<a id="conversions-evaluation"></a>

### Evaluation

The value is evaluated once, and a conversion reads nothing but that value, so what a watch of a conversion depends on is what its value depends on.

<a id="attempts"></a>

## Attempts

`try` attempts the one conversion or cast written after it, and answers null where that operation rejects its value: `try value to "type"` answers the converted value where the conversion accepts the value, and `try target as "type"` answers its target where it is of the type. Its type is the operation's, made nullable.

It handles a value its operation rejects without failing, as `??` handles a missing one, so the two together give a value either way:

```lexica
device { level = try it:["level"] to "number" ?? 0 }
(try room.device(name) as "light")?.brightness
```

A missing setting is null, which converts to null, and malformed text is rejected, so both give zero, and text that converts gives its number; a device that is no light is rejected, so the brightness is null for it, as it is for a missing device.

A [conditional binding](expressions.md#conditionals) gives the converted value a name where the expression uses it more than once, `if let level = try it:["level"] to "number" then … else … end`.

<a id="attempts-one-operation"></a>

### One operation

`try` attempts the one conversion or cast written after it, and nothing else, so it is no general catch of errors: a failure while its value is evaluated, a rejection by a conversion or a strict cast that value holds among them, fails the evaluation as it would anywhere, so `try (device as "light").room.device(name) as "light"` attempts the outer cast alone.

A conversion of a conversion or of a cast is grouped to say which one is attempted, `try (a to "string") to "number"`, so `try a to "string" to "number"` and `try device as "light" to "string"` are syntax errors, as is `try` before anything that is neither, another `try` among them.

<a id="attempts-one-set-of-rules"></a>

### One set of rules

An attempt resolves as its operation does strictly, so a cast to a name that is no reference type or of a target that can never be of it, a conversion to a target no type has, a pair no conversion is declared for, and a nullable value whose type has no conversion are validation errors for both.

It answers a value already of the type as it is, and null for null.

<a id="attempts-a-rejection-alone-is-null"></a>

### A rejection alone is null

A cast rejects a value of another type, and a conversion the value it calls `reject` for. A conversion that throws, rejects with a reason that is no string, rejects and then answers, or answers a value not of its type has a fault, which fails the evaluation whether or not the conversion is attempted.

<a id="attempts-null-means-a-rejection"></a>

### Null means a rejection

For a non-null input, a successful conversion returns a non-null value of its declared target type. A conversion returning null is a fault, including under `try`. Consequently, for a stable bound value, `value != null and try value to "type" == null` is true exactly when the conversion rejects that value.

A cast answers its target itself, so the same holds for `try target as "type"`. Faults remain errors.

<a id="attempts-evaluation"></a>

### Evaluation

Its value is evaluated once and its operation carried out once, and what a watch of it depends on is what its value depends on.

<a id="attempts-binding"></a>

### Binding

`try` binds tighter than `==`, `!=` and `??`, and looser than the operation it attempts, so `try v to "number" == 5` compares the converted value, `(try device as "light") != null` asks whether the device is a light, and `try v to "number" ?? 0` gives its fallback for both null and a rejection.

It stands where an equality operand stands; a conversion of its result groups it, `(try v to "number") to "string"`, and a cast takes none as its target, so `(try a as "device") as "light"` is a syntax error.

A result that keeps the converted number and tells a missing value from a malformed one says which it is beside the value, reading the setting once through a local:

```lexica
device {
    let level = it:["level"],
    level = if let n = try level to "number" then { status = "valid", value = n }
    elseif level == null then { status = "missing", value = null }
    else { status = "malformed", value = null } end
}
```
