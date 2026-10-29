# Types

<a id="types"></a>

Every value has a type, and every expression is typed before it is evaluated. The language defines the scalar types, lists and object types; a module declares the rest, its reference types and its structured types. A script never declares a type: Lexica infers each expression's type from the types its bindings and its vocabulary give it. Every type a script names already exists, the language's own or one a module declares, and a script names one in two places alone: a [cast](#casts), which answers a reference as another type the hierarchy or a declared cast permits, and a [conversion](values.md#conversions), which converts data to another type of data. `device as Light` and `value to Number` each name an existing type, written bare as a member's name is.

Every member declares the types it accepts and returns, and resolution checks every expression against them before evaluation, an access on a [value of `Any`](#types-any) waiting for the value to be known. A script that cannot be typed fails with a validation error identifying the location, the expected type and the actual type.

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
8. [Assignability and merging](#types-assignability-and-merging)
9. [Receivers of unknown type](#receivers-of-unknown-type)
10. [Values of `Any`](#types-any)
11. [Casts](#casts)

<a id="types-type-families"></a>

## Type families

| Family | Types and meaning |
| --- | --- |
| Scalar data | `Number`, `String`, `Boolean` |
| Reference types | Types a module declares whose values have identity, as `Room`, `Device` and `Light` |
| Lists | `List<T>`, a list whose items have type `T` |
| Dictionaries | `Dictionary<K, V>`, a dictionary whose keys have type `K` and whose values have type `V` |
| Pairs | `Pair<K, V>`, a key of type `K` and its value of type `V`, as a dictionary's entries give them |
| Positions | `Index`, an offset from a list's end, and `Range`, a half-open interval of two boundaries, as [positions](#types-positions) set out |
| Structured values | Data a module declares, its data shape the properties its type declares directly without `updates`, as `Climate` |
| Object types | The object field types inferred from an object expression, as `{ name: String, count: Number }` |
| `Any` | A value of any type that isn't null, its concrete type known when it is evaluated, as [values of `Any`](#types-any) set out |

The scalar types, lists, dictionaries, pairs, positions and object types are the language's own, which Lexica's own module owns; every reference type and structured type comes from a module, which [declares it](modules.md#modules-declaring-a-type) with its members.

<a id="types-type-names"></a>

Module, namespace, and type names conventionally use PascalCase. This convention is not enforced. Names remain subject to the ordinary identifier, uniqueness, and name-resolution rules. A type's name is an identifier, matched exactly as every identifier is, so `Light` names a type and `light` does not, and is unique within its module, as [type identity](#types-type-identity) sets out; members, bindings and locals conventionally use lowerCamelCase. The literals `true`, `false` and `null` are values, and stay lowercase.

<a id="types-nullable-and-empty-types"></a>

## Nullable and empty types

| Notation | Meaning |
| --- | --- |
| `T?` | A value of type `T`, or null |
| `null` | The type whose only value is null, the type of the literal `null` and of a null binding; fits every nullable type |
| `Never` | A type with no values; fits every type |
| `List<Never>` | The type of an empty list; fits every list type |
| `Any` | A value of any type that isn't null, whose members are selected when it is evaluated; distinct from a result left out |
| `Any?` | A value of any type, or null |

`null` is the language's intrinsic type, written as the literal is, in a declaration, an inferred type and a diagnostic alike. `Boolean?` admits `true`, `false` and `null`. `Never` is the name of a type, and no word of the expression language.

| Type | Values |
| --- | --- |
| `Boolean` | `true`, `false` |
| `Number` | `0`, `42`, … |
| `String` | `"hello"`, … |
| `Never` | None |
| `Boolean?` | `true`, `false`, `null` |

<a id="types-type-identity"></a>

## Type identity

A type a module declares is identified by its module and its local name, so `Home.Sensor` and `Garden.Sensor` are two types. A local name is unique within its module, and two modules may each declare a type of one name. A module may declare a type whose name one of Lexica's own types or extensions spells, as `Home.Number`, `Home.Null` or `Home.VerbExtensions`: a name is not invalid because something elsewhere has the same name. An unqualified reference resolves by the lookup its position sets out below. Ambiguity is checked when resolving a reference, against the declarations applicable at that location. Declarations are not refused merely because their names could become ambiguous in another context.

- **In a type's declaration.** A type reference resolves, without a qualifier, to the nearest of these that has a type of its name: a type parameter the declaration declares; a type of the declaring module, a declaration of its own; one of Lexica's own types; and a type of a module the type's `import` names, `import: ['Home']`. An import covers that type's declaration whole: its supertype, its data shape, its members' parameters, callbacks and results, and its operators' destinations. It reaches no other type, no module member, no extension and no script, a type beneath it inherits none, and naming the type passes none on. So a type of the declaring module wins over Lexica's own of its name and over an imported one, and no import replaces one of Lexica's own types. Two imported modules declaring a type of one name make an unqualified reference to it ambiguous, unless a nearer one has it, and import order never decides.
- **Qualified, anywhere in a declaration.** A reference may name a foreign type qualified by its module, `Home.Device`, `Home.Light?` or `List<Garden.Sensor>`, whether or not its module is imported, and an unqualified reference does not search a module outside the scopes above.
- **In an extension, a module member and a mapping.** None imports: the declaring module's types and Lexica's own resolve unqualified, and a foreign type is written qualified. An extension does not inherit an import of the type it extends.
- **Never an extension.** A type reference, in a declaration, a script or a declared binding, counts types alone, since no value is of an extension: within `Energy`, whose extension `Device` targets `Home.Device`, `Device` names no type of its own module, and in a script importing both, `device as Device` names `Home`'s.
- **At registration.** Registration resolves every reference to its module-qualified identity, and refuses an `import` that does not name a registered module, a reference that resolves to no type or to several, naming the qualified candidates, and a reference to another module's [internal](modules.md#modules-internal-declarations) declaration. Neither import order nor registration order decides a reference.
- **In a script.** A script names a type unqualified or qualified, `device as Light` or `device as Home.Light`, among Lexica's own types, the types it [imports](scripts.md#scripts-imports) by name, and the public types of the modules it imports. A qualified name identifies the public type of that local name in the module its qualifier names, a name one of the script's imports gives the module, its own or an alias, `Measures.Temperature`. An unqualified name, extensions taking no part, resolves first to a type the script imports by name, under the local name its import gives, since an import is a declaration of the script; then to one of Lexica's own types; and only otherwise to the one public type of its name among the imported modules': with `import Home.Sensor` and `import Garden`, `Sensor` names `Home`'s, and `Garden`'s stays reachable as `Garden.Sensor`; after `import Number = Home.Sensor`, `Number` names `Home.Sensor`, and with `import Home` alone, `Number` names Lexica's own while `Home.Number` names `Home`'s. None is an unknown type, and several from the imported modules are an ambiguous one, refused with their qualified names given. A type of a module the script does not import is never named by it, so registering another module's `Device` changes no script that does not import that module. Internal types take no part. The name is resolved first, and whether the cast or the conversion is permitted is checked after it, so no cast's success chooses a type. A qualified name fixes which type is named; it does not make a cast valid, and leaves a member or an operator the script selects as open to an ambiguity among its imported modules as any.
- **In a declared binding.** A host's [declared binding type](runtime.md#runtime-bindings), `'Device'` or `'Home.Device'`, resolves against the registry when it binds, never a script's imports, since a binding set is the host's and may serve scripts of different imports, and its type has one identity whichever script reads it, resolving it importing its module into no script: a qualified name identifies the public type of that local name in that registered module, and an unqualified name the one public type of its name across the registry, Lexica's own among them, none being an unknown type and several an ambiguous one, refused with their qualified names given. The binding keeps the type it resolved to: a `Device` registered afterwards does not reinterpret a binding, and can make only a later unqualified request ambiguous.
- **Lookup.** An unqualified type name resolves by the rules of [type name lookup](#types-type-name-lookup).
- **In a diagnostic.** A diagnostic writes a type by its local name, `Light?`, and both qualified names where it involves two types of one local name: `Expected Home.Sensor; found Garden.Sensor`. That is display alone: identity, equality, a resolution key and operator selection use the qualified identity, and [canonical text](definition.md#definition) writes a cast's or a conversion's type as its definition holds it, qualified where it was written qualified.

<a id="types-type-name-lookup"></a>

### Type name lookup

An unqualified type name is looked up through the tiers its position sets out, nearest first. The first tier that holds a type of its name decides; two types of its name in that one tier make the reference ambiguous, refused where it is written, the diagnostic giving the qualified names where each selects one alone. These tiers are resolution rules of their own, so a tier settles a reference only where this table sets it out, and two types of one name the table puts in one tier are always ambiguous.

| Position | Tiers, nearest first |
| --- | --- |
| A type's declaration | The type parameters the declaration declares; the declaring module's own types; Lexica's own types; the types of the modules its `import` names |
| An extension, a module member and a mapping | The type parameters the declaration declares; the declaring module's own types; Lexica's own types |
| A script | The types the script imports by name; Lexica's own types; the public types of the modules the script imports |
| A declared binding | Lexica's own types and the public types of every registered module, in one tier |

A module's own type comes before Lexica's own of its name in its declarations, so where `Home` declares `Number`, `Number` in `Home`'s declarations names `Home.Number`. Lexica's own types have no qualified spelling, so `Home`'s declarations can't name Lexica's `Number` then, a limitation the language leaves open.

<a id="types-type-parameters"></a>

## Type parameters

A type parameter stands for a type a declaration leaves open, so that a member's result and arguments follow the types its receiver and its arguments give it. Type parameters belong to module contracts alone: a script never writes one, and Lexica infers each from what a call gives it.

```js
{
    name: 'ListExtensions<T>',
    kind: 'extension',
    target: 'List<T>',
    members: [
        { name: 'middle', kind: 'property', result: 'T?', /* … */ },
    ],
}
```

- **Where they are declared.** A declaration's name declares its parameters, bare, in angle brackets after its local name: a member's own, `identity<T>`, whoever declares the member, a type, an extension or the module itself; and an [extension](modules.md#extensions)'s, `ListExtensions<T>`, which its target and its members share. An operator declares none, since its destination selects it and no rule binds a parameter from a destination, so `convert<T>` and `cast<T>` are refused; it uses its extension's, which the receiver binds. Lexica's own `List<T>` is the one generic value type, declared through the declaration form [Lexica's own module](modules.md#modules-declarations) alone uses. Reference and structured types can't declare type parameters, so a type's data is never generic, and a type that declares any is refused at registration.
- **Declaring and referring positions.** A declaration's name declares, and every other position refers: an extension's `target`, a member's `result`, a parameter's type and a callback's types. A name in a referring position that a declaration around it declares is that parameter, and any other names a type, an unknown type where none exists, whatever its length, so a module may name a type `T`, and `T` there is that type. Whether a name is a parameter is never decided by whether a type of its name happens to exist.
- **Scope.** An extension's parameters stand within it and every one of its members, and `List<T>`'s within its members, the receiver binding them at each access, so no member infers them again; a member's own stand within that member alone.
- **Its local name.** Registration separates a declaration's local name from the parameters it declares: `ListExtensions<T>` is named `ListExtensions`, identified by its module and that name as every declaration is, its parameters never taking part, so a module declares that name once.
- **A receiver of any type.** An extension that declares a parameter and targets it, `{ name: 'VerbExtensions<T>', kind: 'extension', target: 'T' }`, extends every type, and its `T` is bound afresh at each call to that call's receiver.
- **Conflicts are refused.** Empty brackets, `ListExtensions<>`; a parameter without a name, `ListExtensions<T,>`; a parameter declared twice, `ListExtensions<T,T>`; a parameter named as a type its declaration reaches unqualified, one of Lexica's own, `Any` and `Never` among them, one of its module's, or one of a module it imports; and a member declaring a parameter its extension declares are refused, with a module error naming the declaration and the parameter. A conflicting declaration is never given another meaning.

<a id="types-type-parameters-nullability"></a>

### Nullable parameters

`?` applies in referring positions, to a parameter as to a concrete type, and means that the value may also be null: `T?` is whatever type `T` stands for, plus null. It doesn't make a generic argument optional, or introduce a separate parameter.

| Contract | Meaning |
| --- | --- |
| `List<T>` | A list of values of type `T` |
| `List<T?>` | A list whose items may also be null |
| `List<T>?` | The list itself may be null |
| `List<T?>?` | Both the list and its items may be null |

The same notation serves concrete types: `Number?`, `Device?` and `List<Device?>`.

<a id="types-type-parameters-binding"></a>

### Binding a call's parameters

Inference satisfies the whole call, so the order of a call's arguments never decides whether it is valid. Extracting a binding and checking compatibility against an established one are separate steps.

- **The receiver establishes an extension's parameters.** The extension's target is matched against the receiver's non-null branch, which strips the receiver's outer nullability alone, so the items of a `List<Device?>` keep theirs. A null receiver is never silently accepted: an access with `.` on a receiver that can be null is refused as [nullability](#nullability) sets out, and an optional access answers null without invoking the member.
- **Extracting a binding is exact.** Matching `T` against a type gives `T` that type as a candidate, nullable or not; matching `T?` against a type gives it that type without null; and matching `List<P>` against `List<Y>` matches `P` against `Y`. Matching `List<Device>` against `List<T>` establishes `T` as `Device`.
- **Checking compatibility follows the type rules.** A later argument satisfies an established binding without changing it: where a receiver binds `T` to `Device`, a `Device?` given for a parameter of type `T` is checked by that parameter's null policy, and never makes `T` a `Device?`. A concrete part is checked as any type is, so a `List<Light>` given where a `List<Device>` is declared is accepted, by [list covariance](#types-type-parameters-list-covariance), however exact extraction is.
- **A member's own parameters come from its value arguments and its callbacks' results.** Every value argument's binding is collected before any callback is resolved, whatever the order of the arguments.
- **Nullable candidates combine, different types do not.** A member's own parameter whose candidates are one type differing only in nullability takes the nullable type, so a `Device` and a `Device?` give `Device?`. Candidates of different types are refused as inconsistent, whichever comes first: a member taking two arguments of `T`, given a `Device` and a `Light`, is refused, and a common base type is never inferred.
- **Null and `Never` are different evidence.** `Never`, the item of an empty list, isn't evidence of any type. A null argument given for an occurrence written `T` is evidence that the occurrence accepts null, which inference keeps even where it cannot determine an underlying type; one given for an occurrence written `T?` adds no constraint, since that occurrence accepts null already.

  | Occurrence and evidence | Binding |
  | --- | --- |
  | `T` receives only null | `T` is `null` |
  | `T` receives null and another source | The other source's type, made nullable |
  | `T` receives only `Never` | `T` is `Never` |
  | `T?` receives null and another source | The other source's type |
  | `T?` receives only null | `T` is `Never`, so `T?` is `null` |

  So `identity<T>` given null answers a value of the type `null`, never an impossible result. Binding `T` to `Never` where `T?` receives only null is never a fallback for a parameter without a source, which registration refuses.
- **A callback's result is a source.** A callback's inputs are established from the bindings its extension's target and the member's value arguments give; the callback, a function argument or an expression argument evaluated against each item, is resolved against them; and its result then establishes the parameters its result contract writes. A member taking a list's items, `List<T>`, and a projection of each, `(T) => U`, answers a `List<U>`: the receiver establishes `T`, and the projection's result `U`. This is the one path through a function's signature inference takes, and a callback's result never establishes another callback's inputs. An expression parameter keeps its scope and its evaluation rules.
- **Every occurrence satisfies the binding.** Each argument, each callback's types and the result are checked against it, and an inconsistent, ambiguous or insufficient binding is refused.
- **A contract decides what a member answers.** `first` of an empty list answers null because its contract, `T?`, and its implementation say so; inferring a parameter never determines a member's runtime behavior.

<a id="types-type-parameters-registration"></a>

### Registration checks that inference is possible

A type parameter must have a supported source from which it can be bound: the receiver, through the target of the extension that declares it, a value parameter's type, or a callback's result contract. A member is refused at registration where a parameter its result writes has none, and where its callback's input writes a parameter whose only source is another callback's result, since callback results do not chain. The receiver binds its extension's parameters before any callback runs, so a callback's input may write one the extension's target supplies, even where the member writes it nowhere else. Registration checks this structurally; a particular call can still be refused where the types it gives are incompatible or insufficient.

<a id="types-type-parameters-list-covariance"></a>

<a id="types-collection-variance"></a>

### Collection variance

Collections are immutable values, so each of Lexica's own generic types declares how its type arguments relate, its **variance**, and no module declares a generic type:

| Type | Variance |
| --- | --- |
| `List<T>` | Covariant in `T`: a `List<Light>` stands where a `List<Device>` is declared, its items checked by their own types |
| `Dictionary<K, V>` | Invariant in `K`, which a lookup takes, and covariant in `V`: a `Dictionary<String, Light>` stands where a `Dictionary<String, Device>` is declared, never where a `Dictionary<String?, Light>` is |
| `Pair<K, V>` | Covariant in both |

A covariant argument relates by assignability and merges as types merge; an invariant one relates by equality and merges where the two are equal. An invariant argument of `Never` fits any and merges to the other, since the one invariant argument, a dictionary's key, is `Never` only for a dictionary of no entries, which no lookup can mistake.

<a id="types-dictionaries-and-pairs"></a>

## Dictionaries and pairs

A **dictionary** is addressed by key, its keys unique and its values free to repeat, and a **pair** is immutable data of a `key` and its `value`, which a dictionary's entries give: `dictionary.entries` is a `List<Pair<K, V>>`, and `dictionary.entry[key]` a `Pair<K, V>?`. A dictionary becomes neither a list nor an object implicitly, and an object becomes no dictionary.

- **Its keys** are of a **key type**, a type whose values one exact equality compares: `Number`, `String`, `Boolean`, a reference type and `null`, nullable or not, a type parameter, which a dictionary binds to its own key type, and `Never`, an empty dictionary's. A list, an object, a structured value, a dictionary, a pair and a value of `Any` are no key: a declaration naming a dictionary of another key type is a module error (LEXICA4563), and a bound map holding one a structure error (LEXICA2041).
- **Key equality** is exact: a number by its value, `-0` equal to `0`, a string by its code units, a Boolean by its value, a reference by its established identity, and null as one key of its own, a real key where `K` admits null. No host language's own equality takes part, and a snapshot's tolerance never does.
- **Insertion order.** A dictionary's entries are ordered by insertion, the order its source gave them; order never addresses one, so `dictionary[2]` reads the key `2`, never the third entry, and a dictionary is not sorted.
- **Duplicate keys.** A dictionary holds each key once; constructing one from duplicate keys fails with a located evaluation error, never keeping the first or the last.
- **Positions address no dictionary.** A dictionary is addressed by key alone, so an index or a range is no key of one, refused as any key of another type is.
- **Lookup and presence.** `dictionary[key]` answers the key's value or null, so a key whose value is null reads as an absent key does; `containsKey(key)` tells them apart, and `entry[key]` answers the pair, null where the key is absent, so a missing pair and a pair whose value is null are told apart too. A lookup's key may be null, which reads the null key where `K` admits one and an absent key otherwise, so a key's parameter consumes null, never propagating it.

<a id="types-positions"></a>

## Positions

A list's item stands at a **position**: a `Number`, its offset from the list's start, `0` the first item, or an **index**, an `Index`, written `^n`, its offset from the list's end, `^1` the last item and `^0` the end past it. A **range**, a `Range`, is a half-open interval of two boundaries, each a position or left out, written `start..end`: `items[1..4]`, `items[..4]`, `items[4..]`, `items[^3..]`, `items[..^1]` and `items[..]`, a start left out the list's start and an end left out its end. An index and a range are values, so `let middle = 1..^1` serves any list, and neither holds a collection nor generates numbers.

- **Offsets** are nonnegative safe integers, never rounded: an index's offset and a range's boundary that is a number of any other value fails where it is evaluated (LEXICA5032), so `^1.5` and `-1..2` are refused, while a lookup by a number stays tolerant, as [a list's members](vocabulary.md#vocabulary-lexicas-own) set out.
- **Against a list.** A range is applied to one length, captured once: a start or an end that is a number stands at its offset, an index at the length less its offset, so `..^1` is every item but the last.
- **Not data.** Neither is data, so a result holding one is refused (LEXICA3043); neither is a dictionary's key, and no equality compares them.
- **Their operands.** `^` takes a `Number`, and a range's boundaries are each a `Number` or an `Index`, none nullable (LEXICA3085). A range's boundary is a position, never an operator expression unless grouped, and never another range, as [the grammar](grammar.md#grammar-the-grammar) sets out.

<a id="reference-types"></a>

## Reference types

A reference type is a type a module declares whose values have identity: a value of it is the same value as another, or a different one, whatever either holds. A reference value has no data form, so an expression reads what it needs of one through its members and never holds one in a result. A module declares it in its `types` as `kind: 'reference'`, with its members within it, as [declaring a type](modules.md#modules-declaring-a-type) sets out.

- **A supertype.** A reference type may name one supertype, another reference type. A value of a type is a value of its supertype too, and a member declared on the supertype applies to it, so `light.name` reads the `name` `Device` declares. A type with no supertype begins a hierarchy of its own: `Room` and `Device` begin two.
- **Membership.** Every reference type declares `isInstance(value)`, which answers whether the value belongs to the type, `true` or `false`. A value belongs to a type where the `isInstance` of the type and of every supertype above it answers `true`. It is synchronous and changes nothing; an answer that isn't a Boolean is a fault, and so is an exception it throws, each with its own error naming the type and the operation that asked, the second's `cause` exactly what it threw. Binding, a member's answer, a captured value and a cast check membership by this one rule.
- **Recognition.** A module may declare `typeOf(value)`, its contract for the type a host's value is exposed to scripts as: the most specific of the module's own public reference types the value is of, or null where the module recognizes none. Lexica takes the type it names as given, never substituting a supertype for it. Where a binding's type is not declared, Lexica asks every registered module's `typeOf`. Only objects are eligible for reference-type recognition; strings, numbers, Booleans and null are data, and no `typeOf` is asked of one. A name that is not a reference type of that module, an abstract type, an [internal](modules.md#modules-internal-declarations) type, and a type whose membership the value fails are faults of the module, and so is an exception `typeOf` throws, with its own error, its `cause` exactly what it threw. Where several modules name a type, the value takes the one beneath every other, and is refused as ambiguous, with a structure error naming the types, where none is beneath the others; registration order never decides. A value no module recognizes is typed as data where it is data, and refused otherwise. Recognition never runs every type's `isInstance` to find one, since several types can accept one value: `Energy`'s `Meter` accepts every device, as `Device` does.
- **Abstract types.** A type a module declares `abstract: true`, `false` where left out, is never what recognition answers, so a module's `typeOf` naming one is a fault. A declared binding may be of an abstract type.
- **A declared type.** A host may declare the type of a binding whose value is a reference, as [registry-aware bindings](runtime.md#runtime-bindings) set out, and no `typeOf` is asked for it. The value must belong to the declared type, by its `isInstance` and its supertypes', and fails the binding otherwise, with a structure error naming the binding and the type; no type beneath the declared one is asked. The declared type is the binding's static type, an abstract one included, so a light bound as a `Device` exposes `Device`'s members alone, as its host chose, until [`as`](#casts) narrows it, asking the narrower type's `isInstance`. Only a reference type can be declared, and only for a reference value; data is typed by its value alone.
- **Checked, never recognized again.** A value whose type is known is checked by membership and keeps that type: a member's answer, a cast's result, a callback's argument and result, and a value a host supplies to a host call's projection. None is recognized again, to name it in a message among them, so a member's declared result gives its value the type a script sees, as `device.meter` answers a device as a `Meter`, and a cast that rejects a value names that type.
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

<a id="types-assignability-and-merging"></a>

## Assignability and merging

A value stands where a type is declared, a parameter's, a callback's or a result contract's, where its type is assignable to the declared one. Where two types meet, a conditional's branches, a coalescing operator's sides or a list's items, the value is of the type they merge to. Lexica applies the same rules wherever it relates two types.

<a id="types-assignability"></a>

### Assignability

| A value of | Is assignable to |
| --- | --- |
| `Never` | Every type |
| `null` | Every nullable type |
| A nullable type, `T?` | A nullable type `U?` that `T` is assignable to |
| A named type | The same type, by its [identity](#types-type-identity), and each supertype above it, as [reference types](#reference-types) set out |
| `List<T>` | `List<U>`, where `T` is assignable to `U`, by [collection variance](#types-collection-variance) |
| `Dictionary<K, V>` | `Dictionary<K, W>`, where `V` is assignable to `W`, and `Dictionary<J, W>` for any `J` where `K` is `Never` |
| `Pair<K, V>` | `Pair<J, W>`, where `K` is assignable to `J` and `V` to `W` |
| An object type | An object type of the same object field names, each object field's type assignable to the type of the object field of its name; an object field more or an object field fewer is refused |
| A type that isn't nullable | `Any` |
| Any type | `Any?` |

So `{ name: String }` is assignable to `{ name: String? }`, and neither `{ name: String? }` nor `{ name: String, age: Number }` is assignable to `{ name: String }`.

A value of `Any` is assignable to another type once its value is known: given where a concrete type is declared, it is accepted when it is resolved and checked against that type when it is evaluated, and one of `Any?` the same, the check refusing null where the declared type isn't nullable. Only what is unknown waits: a violation resolution can prove is refused then, as [values of `Any`](#types-any) set out.

<a id="types-type-equality"></a>

### Equal types

Two types are equal where they are one type: one named type, by its identity, or two values of one of Lexica's generic types whose type arguments are equal, or two object types of the same object field names whose object fields' types are equal, each of one nullability. Equal types are assignable to each other; assignable types need not be equal, as `String` and `String?` are not.

<a id="types-merging"></a>

### Merging

Two types merge to the least type that holds a value of either, made nullable where either can be null:

| Types | Merge to |
| --- | --- |
| `Never` and a type | The type |
| `null` and a type | The type, made nullable |
| A type and itself, either nullable | The type, nullable where either is |
| Two reference types of one hierarchy | The nearest supertype they share |
| `List<T>` and `List<U>` | A list of the type `T` and `U` merge to |
| `Dictionary<K, V>` and `Dictionary<K, W>` | A dictionary of `K` and of the type `V` and `W` merge to, `K` either's where the other's is `Never` |
| `Pair<K, V>` and `Pair<J, W>` | A pair of the types `K` and `J` and `V` and `W` merge to |
| Two object types of the same object field names | The object type of those names, each object field of the type the two object fields of its name merge to |
| `Any` and a type | `Any`, made nullable where either can be null, so `Any` and `Number` merge to `Any`, and `Any` and `Number?`, or `Any` and `null`, to `Any?` |

Any other two types don't merge, two object types of different object field names, two lists whose items don't merge and two reference types of different hierarchies among them, and where a conditional's branches, a coalescing operator's sides or a list's items are of such types, the expression is a validation error naming both.

<a id="receivers-of-unknown-type"></a>

## Receivers of unknown type

A receiver of the type `null`, a null binding or the literal `null`, says nothing of what it would be, and neither does a `Never`, the item of an empty list. The concession is to missing type information alone: a receiver whose type is known is checked as always, a nullable one included, so `room.device(name)?.batery` is refused for a room `room` whatever device it names.

A receiver of the type `null` can be null, so it takes `?.`, and a `Never`, which no value has, takes `.`. A name applied to a receiver of unknown type resolves without choosing one declaration:

<a id="receivers-of-unknown-type-any-property"></a>

### Any property

A name written as a property is accepted whatever it is, since a bound object's fields are named by its data, as `row?.id` for a null `row` and `rows { id = it.id }` for empty `rows` are; it is checked once its receiver's type is known.

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

An object expression following such a receiver, or applied to the items of a `List<Never>`, resolves its object fields against a `Never`, so a call in it is still checked; its type is the object type of its object fields, made nullable after a null, and a list of it after an empty list, which answers the empty list.

A member read on a `List<Never>` runs, as on any list, so it resolves to one declaration as any receiver does, the applicable declaration whose receiver type is more specific than every other's, as [a module's own collisions](modules.md#namespaces-a-modules-own-collisions) set out. A `List<Never>` satisfies every list type, so it can expose an ambiguity: where several unrelated declarations apply and none is more specific than the others, the access is refused, naming them.

<a id="types-any"></a>

## Values of `Any`

`Any` is a reserved type that a parameter or a result declares where it accepts or answers a value without restricting its concrete type. It is distinct from a result left out, which doesn't answer a value, as a host call that supplies nothing does, and an omitted result never becomes `Any`. A receiver of any type is an extension targeting a parameter, as [type parameters](#types-type-parameters) set out, never `target: 'Any'`, which keeps the relationship between a receiver and a result where a member needs it.

| Concept | Meaning |
| --- | --- |
| `Any` | A declaration accepts or answers a value without restricting its concrete type |
| `null` | An actual null value, and its type |
| `Never` | No possible value, as the item of an empty list |
| Deferred member access | Member selection waits for the receiver's value |

That a type is unknown before evaluation is a fact of resolution, never another type. `null` and `Never` keep their own rules, as [receivers of unknown type](#receivers-of-unknown-type) set them out: a null receiver is known to be null, and `Never` describes the absence of a value, never one whose type remains to be discovered.

A value of `Any?` is read as any nullable value is: `?.` answers null for a null receiver, and a value that isn't null has its member selected by its actual type, as for a value of `Any`.

<a id="types-any-operands"></a>

### Operands of `Any`

An operand of `Any` is accepted when it is resolved, and checked by its operation's own rules when it is evaluated: arithmetic and ordering take numbers, an interpolation a string or a number, and an equality two values of types that fit one way or the other, a structured value, a list and an object compared with null alone, as [equalities](expressions.md#equalities) set out. Truthiness takes any value, so a condition and the operands of `and`, `or` and `not` check nothing. Only what is unknown waits: an operand of `Any?` can be null, which arithmetic, ordering and an interpolation refuse when it is resolved, as they refuse any operand that can be null, and an equality with a value of a type that is known applies its rules to what is known.

<a id="types-any-deferred-selection"></a>

### Deferred member selection

A member is selected by one lookup at one of two moments:

- **During resolution,** where its receiver's type is known.
- **During evaluation,** where it is not, as for a value of `Any`: the receiver expression and the access are kept, and the member is selected when the receiver is evaluated, by the actual value's type.

Both apply the same visibility, inheritance, ownership and ambiguity rules, and an `Any` argument never defers a call its receiver selects. A missing member, an incompatible receiver and an invalid argument stay errors, raised when the facts are known, never refused only because they were unknown before evaluation. A direct access on null fails, its error naming the access, and an optional one answers null without invoking anything.

- **Its arguments are read without the declaration.** A deferred call never takes an argument whose reading depends on the declaration it selects: a value and an explicitly written function, an arrow function, a local function or a function reference, have one meaning and are accepted, and an implicit body or a predicate is refused, saying to make the receiver known or to select its extension explicitly with [extension access](members.md#property-access-calls-and-indexers-extension-access).
- **Host calls are selected during resolution.** A deferred access whose selection would be a host call is refused before anything is invoked, saying to make its receiver known or to select its extension explicitly.
- **An `Any` argument of a selected call** is checked against that call's contract when its value is known.
- **The host is asked first.** Before a member selected during evaluation is invoked, a property's getter included, the host's `beforeInvoke` decides whether it is permitted, as [the evaluator's hooks](runtime.md#runtime-evaluation) set out, and ownership, visibility, ambiguity and execution-position rules are applied without running a restricted member to learn whether it was allowed.
- **A selection is kept for one type.** A selection is kept by its node and the receiver's actual type within one resolution, which a registration that makes it stale discards, as [reusing a resolution](runtime.md#runtime-reuse) sets out, so an evaluation never reuses a selection made for a receiver of another type. A plain structured object's fields are looked up on each object, since objects of one general type need not hold the same object fields.

<a id="types-any-identity"></a>

### A value keeps its identity

`Any` neither establishes a value's concrete identity nor erases it. A typed value keeps its identity through an unrestricted contract, so a `Climate` returned through `Any` remains a `Climate`; an untyped object arriving without one is plain structured data; and a concrete result declaration establishes a checked identity at its boundary. A reference value's type is what its modules recognize it as, as [reference types](#reference-types) set out.

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

The type is the name of a reference type the registry knows, written bare, its local name or qualified by its module, `device as Light` or `device as Home.Light`, and found as [type identity](#types-type-identity) sets out; a string in its place, `device as "Light"`, is a syntax error giving `device as Light`. The name identifies the type directly: it does not read a local, object field or script parameter of its spelling, and does not declare or infer a type. The cast is of that type, nullable where its target can be null, so `room.device(name) as Light` is a `Light?` and `device as Light`, with `device` bound to a device, a `Light`; an attempted cast is nullable always.

A name that is not a public type, or that several types share, is a validation error, the second giving the qualified names; a type that is not a reference type is a validation error naming the types its target can be cast to.

<a id="casts-strict"></a>

### Strict casts

A cast states the type the expression expects, and a value that does not belong to it fails the evaluation with an evaluation error naming what it is, as `The cast to Light rejected its value: it is a Thermostat`, so a thermostat where a light is expected is an error, never a silent null.

A cast that probes which type a value is is attempted, `(try device as Light) == light`.

<a id="casts-what-it-narrows"></a>

### What it casts

A cast reaches the types its target's static type is related to, and no other:

- **Within its hierarchy.** A cast to a type beneath its target's static type narrows it, checked by that type's membership. A cast to the target's own type or to a supertype of it, and a cast of null, are valid, since a binding may already be of the type or null, and each answers its target as it is. A hierarchy cast needs no declaration.
- **By a declared cast.** A [cast operator](modules.md#modules-operators) a module declares on a reference type permits a cast from it to the one other reference type its `result` names, as `Energy` declares one from `Meter` to `Home.Device`. It permits that direction alone: no cast back, no assignability, no equality across the two, and no cast through a chain of them. A declared cast between a type and itself, its supertype or a type beneath it is refused at registration, since the hierarchy decides those.
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
