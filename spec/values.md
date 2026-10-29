# Values

<a id="values"></a>
<a id="values-and-types"></a>

A value is a number, a string, a Boolean, null, a list, a dictionary, a pair, an object, a structured value such as a `Climate`, a reference value such as a `Light` or a `Room`, or a function. A script's values enter it through its bindings and its members, and leave it through its result, which holds data alone.

Values are immutable. No expression changes a value once it exists, and none assigns a name twice; a binding is a frozen copy of the data its host gives, and each evaluation produces a new result.

```nexo
room {
    name = it.name,                                 // A string.
    warmth = it.climate?.temperature ?? 0,          // A number, a fallback where there is none.
    devices = it.devices { name = it.name },        // A list of objects, one for each device.
    level = it.device("lamp")?["level"] to Number   // A setting's text, converted.
}
```

In this document:

1. [Objects](#objects)
2. [Null](#null)
3. [Supplied data](#values-supplied-data)
4. [Results](#values-results)
5. [Conversions](#conversions)

<a id="objects"></a>

## Objects

An **object expression** names the fields of the object it builds, `{ name = value, … }`, and following a value or a list, `room { … }` or `rooms { … }`, it builds one for the value or for each item, which is its implicit parameter.

- An object field is written with its name before its `=`, `warmth = it.climate?.temperature`, whatever its value is, and the language does not infer a name: an object field without one is a syntax error, as is an object expression without an object field.
- Two object fields of one object expression with the same name are an error when the definition is checked.
- A result keeps its object fields in the order the object expression names them.
- An object expression following null is null.
- An object expression written where a structured type is declared, as a value argument of that type, constructs the structure, as [constructing a structure](types.md#types-constructing-a-structure) sets out; anywhere else it builds an object.

<a id="locals-object-fields-as-names"></a>

### Object fields as names

An object field's name becomes visible after its value, throughout later object fields and expressions nested in them. Its own initializer reads the enclosing name.

After `let count = 10`, the object `{ before = count, count = count + 1, after = count }` gives 10, 11 and 11.

An object field reference reuses the value already obtained, and evaluates nothing again. Each application of a projection, including each list item, has its own object fields. Outside the object expression, the name resumes its enclosing meaning.

<a id="locals-the-object-root"></a>

### The object root

Written inside an object expression, `root` refers to the outermost object being built, the **object root**. A nested object reads the object root's fields through it, even where a nearer object field has the same name:

```nexo
{
    bar = 4,
    inner = {
        bar = 2,
        nearest = bar,        // 2
        outermost = root.bar  // 4
    }
}
```

`root` is the language's one root, and requires no value from the host. A host can still bind a script parameter named `root`, which a script reads as `~root`.

- **Where it exists.** `root` must be written inside an object expression, and elsewhere is a structure error; a function declared outside every object expression cannot use it, even when it is called inside one. Each evaluation, and each result projection of a value a host supplies, builds a new object root. When `rows { … }` has no enclosing object expression, each item gets its own object root. Nested objects and projections retain the enclosing object root, and an options object follows the same rules, as [options](members.md#arguments-options) describe.
- **Which object fields it has.** At each reference, only the object root's fields whose initializers have already completed in the declared object field order are accessible. The object field currently being initialized and later object fields are unavailable:

```nexo
{
    inner = {
        value = root.inner // Error: inner is still being built.
    }
}
```

- **Aliases and functions.** An alias, as `let r = root`, retains the set of object fields available where it was declared, even when used later. A function that uses `root` itself captures the object fields available where the function is declared, while a function parameter given `root` receives those available where the call passes it.
- **No extra work.** `root.bar` reuses the value already computed for `bar`, and nothing is evaluated again; its metadata is that object field's.
- **Not part of a result.** A reference to the object root may be held in a local, passed to a function and returned from one, but cannot itself be included in the script's result data: `{ copy = root }` is a validation error. Read an object field instead, as `root.bar`.

<a id="locals-object-root-references"></a>

### Object root references

A function's result keeps the object fields of the reference it returns. After `let identity = function(value) value end`, `identity(root).a` reads `a` wherever `a` is available where the call passes `root`, and `{ copy = identity(root) }` is refused as `{ copy = root }` is.

Where a conditional or `??` can give either of two references, both must refer to the same object root with the same object fields available; nullability combines as usual, so `if wide then root else null end` gives a reference that can be null, whose object fields are read with `?.`. Any other pair is a validation error, as branches of different types are.

<a id="null"></a>

## Null

Null answers both "there is no such value", as when `room.device(name)` finds no device, and "the value is unavailable", as when a sensor has reported no temperature yet. One null for both keeps results simple, at the cost of telling the two apart; a member whose consumers need the difference offers it separately, as `device.offline()` says whether a device has stopped reporting.

A member's signature declares its result type, as [types](types.md) set out, and a result marked `?` can be null by itself; an optional access answers null where its receiver is null, and any member answers null where an argument is null and its parameter propagates null. An optional access of null answers null and ends its chain. `??` supplies a fallback for null. Errors fail the result rather than becoming null; see [diagnostics and errors](diagnostics-and-errors.md).

<a id="nullability-a-written-null-is-an-expression-that-produces-null"></a>

### A written null is an expression that produces null

`null` as a literal has no special treatment, and the signature and the evaluation rules decide what a call does with it.

<a id="nullability-null-is-unavailable-too"></a>

### Null is unavailable too

A device is a valid receiver of `battery`; a wired one answers null, as an unavailable value does. A receiver of the wrong type, a number for `battery`, is a validation error, and a module that returns a value of a type other than the one it declared has broken its contract, which is an evaluation error and never a quiet null.

<a id="values-supplied-data"></a>
<a id="names-and-reserved-words-names-in-strings-and-supplied-data"></a>

## Supplied data

The name restrictions apply to declarations in a script. Supplied data keeps all its own keys: bound objects and objects returned by members retain every object field, including `__proto__`, as an ordinary own object field in results.

<a id="values-results"></a>

## Results

A **result** is data: numbers, strings, Booleans, null, lists, dictionaries, pairs, structured values and objects. A reference value has no data form, so a script whose result would contain one is a validation error; a script reads the facts it needs of a reference value through an object expression. A value of [`Any`](types.md#types-any) a result holds is data or not as it is evaluated, so the result is checked then, and one that holds a reference or a function fails the evaluation (`NEXO5028`). A delegate is never part of a result either, as [delegates](functions.md#functions-delegates) set out.

Each evaluation produces a new result, immutable throughout: its lists and objects, and every structured value in them, never change once produced, whatever the host's state does afterwards.

A result exports the language's collections as data: a list as an array of its exported items; a pair as `{ key, value }`; and a dictionary as `{ entries: [{ key, value }, …] }`, its entries in their order, each key's type preserved, so a number's key stays a number. A dictionary or a pair is data where every key and every value is, recursively, so one holding a reference, as a key or a value, has no data form and is refused where a result would hold it, as any reference is; a script projects it to data first. Exported data never turns back into a dictionary or a pair when it is bound again.

A member's implementation gives the language's collections in a host's forms where its declaration says so: a set where a list is declared, its items in their order, a map where a dictionary is, its entries in their order, and an object of a `key` and a `value` alone where a pair is, each item, key and value as its own type declares it. It receives a dictionary as the language's, which answers `count`, `has(key)`, `get(key)`, `getEntry(key)`, `keys`, `values` and `entries`, and a pair as one of `key` and `value`.

<a id="conversions"></a>

## Conversions

A conversion answers a value converted to another type of data: `value to Type` evaluates its value, carries out the [conversion operator](modules.md#modules-operators) the vocabulary declares from the value's type to the type it names, and answers the converted value. A [cast](types.md#casts) converts nothing, and a conversion casts nothing.

```nexo
device["level"] to Number
device["level"] to Number ?? 0
device["night-mode"] to Boolean
room.devices.count to String
```

<a id="conversions-target-type"></a>

### The type a conversion names

The type is a type's name, written bare, as `to Number` writes it, its local name or qualified by its module, `to Measurements.Temperature`, and found as [type identity](types.md#types-type-identity) sets out; a string in its place, `to "Number"`, is a syntax error giving the bare name. It is `Number`, `String`, `Boolean`, or a structured type that holds data alone, whatever its properties hold, lists of data among them, as `Climate` holds its readings.

A conversion converts data, so a reference value and a structured type that holds one are not types it converts between, and what reads a host's state stays a member's, which declares how it changes; a reference value is cast to a type of its hierarchy with `as`.

A list itself is not a type a conversion converts between, and neither is a type that can be null. A name no type has is a validation error, as is any other target.

<a id="conversions-one-declared-conversion"></a>

### One declared conversion

A value converts to another type only through a conversion operator from its type to that type, as [conversions](vocabulary.md#vocabulary-conversions) declare them, selected among those its script's imports make available as [owners and extensions](modules.md#namespaces-owners-and-extensions) set out. Conversions never chain on their own: a Boolean converts to a string and a string to a number, and `enabled to Number` is still a validation error, whose message names the types a Boolean converts to. A script that means both conversions writes both.

<a id="conversions-a-value-already-of-the-type"></a>

### A value already of the type

A value already of the type answers itself, so `5 to Number` is 5. This is the language's rule, and no conversion is declared from a type to itself.

<a id="conversions-null"></a>

### Converting null

A conversion of null answers null without converting, and its type is the type it converts to, made nullable where its value can be null.

A value of the type null, a null binding, converts to any type a conversion can name, however many conversions reach it, since nothing is converted; a value whose type is known is checked by that type without null, so `room.device(name) to String` is a validation error, as a conversion from a device is declared nowhere.

<a id="conversions-what-fails"></a>

### What fails

A value its conversion rejects, as `"40%" to Number`, fails the evaluation with an evaluation error naming the conversion, the reason it gave and where it stands. A conversion that fails otherwise, by throwing or by answering a value not of its type, has a fault, which fails the evaluation too.

A failure never answers null or a default: `?? 0` gives a missing setting a value, and leaves a malformed one an error, for which [an attempt](expressions.md#attempts) answers null instead.

<a id="conversions-evaluation"></a>

### Evaluating a conversion

The value is evaluated once, and a conversion reads nothing but that value, so it reads what its value reads.
