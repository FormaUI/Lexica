# Bindings

<a id="runtime-bindings"></a>

`registry.createBindings(values, options)` binds a host's values to a script's parameters by name, against the registry, since its modules' `typeOf` decide which values are references: it asks them of each value before copying it, keeps each reference value as it is, by its identity, a reference nested in data among them, neither copied nor frozen, and copies and freezes the rest of the data recursively. It refuses an unsupported value and a cycle. How each binding is typed is set out in [script parameters and bindings](../language/scripts.md#scripts-script-parameters).

- **Declared types.** `options.types` declares the type of a top-level binding by its notation, each name in it unqualified or qualified, as `registry.createBindings({ device }, { types: { device: 'Device' } })` and `{ device: 'Home.Device' }` bind a light as a `Device`, and `{ routes: 'List<Input.Route>' }` binds data as a list of routes. The notation resolves against the registry when the binding is made, never a script's imports, as [type identity](../language/types.md#types-type-identity) sets out, and the binding keeps the type it resolved to, its static type and part of its resolution key. A reference type keeps its contract: the value must belong to the type, null where it is nullable, and no `typeOf` is asked for it, as [a declared type](../language/types.md#reference-types) sets out. Any other type captures the value as [a value a host supplies](host-calls.md#runtime-host-calls-capturing) is captured, since a binding is a value its host supplies: a structure keeps its declared data shape alone, a property the data leaves out is null where its type is nullable, a reference of another type standing where a nullable reference type is declared is null, and data the type doesn't admit refuses the binding (NEXO2045), naming the binding and the part of its value. The captured value is frozen as bound data is, its references kept as they are. `Any`, `Never` and a position are no type a binding holds, nor a type holding one at any depth, a structure's data shape among it (NEXO2044), and data that reaches itself is refused as any bound cycle is (NEXO2022). No other binding, and no value nested in one, takes a declared type.
- **Captured once.** A binding set captures its values and their types when it is made. Registering a module afterwards leaves a binding set as it was: its values and their types stay those it captured, and a binding set made afterwards uses the registry's recognition as it then is.
- **Its registry.** A binding set is the registry's that made it, and resolving or evaluating against another registry is refused, saying to bind with that one. Plain values given to `registry.resolve` or to an evaluator are bound by that registry, as `registry.createBindings` binds them.
- **What it answers.** It answers whether it holds a binding of a name, `has`, the value, `readValue`, and the type, `getType`, of each, in type notation and undefined for a name it does not bind, and its resolution key, `resolutionKey`, a string, as soon as it is made.

A binding set has a **resolution key**: each binding's type, and each primitive binding's value, since a string a script reads can select what a member reads, as a computed property access's name does.

In this document:

1. [How a binding is typed](#bindings)
2. [Supplied data](#values-supplied-data)

<a id="bindings"></a>

## How a binding is typed

A binding takes its type from its value, unless the host declares it.

- A value its host declares a type for is of that type, a reference checked by its membership, as [a declared type](../language/types.md#reference-types) sets out, and data captured as the type, as [declared types](#runtime-bindings) set out, a structure among them.
- A reference value is of the type its registry's modules [recognize](../language/types.md#reference-types) it as, so a light is a `Light`; a value no module recognizes, and that is not data, is not a binding, and one several modules recognize as unrelated types is refused as ambiguous. A reference nested in data is recognized as one bound alone is.
- A number, a string and a Boolean are `Number`, `String` and `Boolean`.
- Null is of the type `null`.
- A list is a `List<T>`, `T` the type its items share, the nearest supertype they share for references of different types, made nullable where one of them is null: `[light, thermostat]` is a `List<Device>` and `[light, null]` a `List<Light?>`. A declared cast between two types gives them no type to share. A list of nulls alone, `[null]` or `[null, null]`, is a `List<null>`, whose items can only be null, and the empty list is a `List<Never>`, which does not hold an item.
- A set is a `List<T>` of its items in its iteration order, which follows list semantics and keeps none of the set's uniqueness. A declared `List<T>` captures one as [capturing a supplied value](host-calls.md#runtime-host-calls-capturing) sets out.
- A map is a `Dictionary<K, V>`, its entries in their order, `K` the type its keys share and `V` the type its values share, each merging as a list's items do, so an empty map is a `Dictionary<Never, Never>`. A key that is no key type, as a list or an object, is a structure error (NEXO2041), and keys or values that share no type are too (NEXO2042). A dictionary and a pair the language gave, bound again, are bound as they are.
- An object is of the object type of its object fields' types, each typed as a binding is, an object of a `key` and a `value` among them, which never becomes a pair, and one of `entries` never a dictionary.
- Any other iterable, a generator among them, is no binding: a host materializes it, finite, as an array, a set or a map first.
- A list whose items share no type has no type, because Nexo has no union types and a list holds items of one type, so binding `[1, "two"]`, or a room and a light together, is a structure error.

Binding keeps a frozen copy of the data it is given, through its lists, sets, maps and objects, never a live view of a set or a map, and each reference value as itself, never copied or frozen, a reference within data among them. A host that changes its data afterwards changes nothing bound, and binds anew to supply new data.

A tool that checks a script without running it takes the same values, or values of the same types, for the bindings, since vocabulary declarations alone cannot establish the type of `room`.

<a id="values-supplied-data"></a>
<a id="names-and-reserved-words-names-in-strings-and-supplied-data"></a>

## Supplied data

The name restrictions apply to declarations in a script. Supplied data keeps all its own keys: bound objects and objects returned by members retain every object field, including `__proto__`, as an ordinary own object field in results.
