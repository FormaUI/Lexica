# Extensions

<a id="runtime-extensions"></a>

A module adds members, indexers and operators to a type another module owns by declaring an extension. How an access selects among extensions, and how a script selects one explicitly, is the language's, as [extensions](../language/extensions.md) set out.

<a id="extensions-declaring"></a>

## Declaring an extension

A module declares its extensions among its `types`, as `Energy`'s `Device` adds `device.usage` to `Home`'s `Device`, each of `kind: 'extension'`, naming the `target` its members extend, which take that type as their receiver as a type's own members do:

```js
const energy = nexo.createModule('Energy', {
    types: [
        {
            name: 'Device',
            kind: 'extension',
            target: 'Home.Device',
            members: [/* usage, power, meter */],
        },
    ],
});
```

- **Its name.** An extension is a declaration of its module, identified by its module and its local name as a type is, so a module declares a name once among its types, and an ordinary type and an extension never share one. Its local name is conventionally in PascalCase, as a type's is, which is not enforced, and a suffix such as `Extensions` is its author's choice: `kind: 'extension'` makes a declaration an extension, and its spelling never does. Its name may declare [type parameters](../language/types.md#types-type-parameters) its target and its members share, `ListExtensions<T>`, which the receiver binds at each access.
- **Its target.** An extension has one target, and a module declares as many extensions as it groups its members into, on one target or several. A target names a foreign type qualified, `Home.Device`, one of Nexo's own types as it is, `List<Number>`, or a parameter its extension declares, `{ name: 'Checks<T>', kind: 'extension', target: 'T' }`, which extends a receiver of any type; a parameter is no type its module owns, so a module declares such an extension whatever types it owns. A target is never `Any`, since a parameter extends every type and binds the receiver's, and never nullable, since a member is read on a value and an [optional access](../language/members.md#property-access-calls-and-indexers-required-access-and-optional-chains) skips a null receiver. An extension declares no `import`: within it, its own module's types and Nexo's resolve unqualified, a foreign type is written qualified, and it does not inherit an import of the type it extends.
- **What it is.** An extension owns its members and is addressable for [extension access](../language/extensions.md#extensions-access), `device:Device.usage`. It is never a value's type: it never wraps a receiver or changes a type's identity, and its target is never its supertype.
- **What it adds.** Members alone: it changes no type's `isInstance`, data shape, hierarchy, abstractness or `internal` flag, and no module's `typeOf`. A property it declares takes `updates`, so it adds nothing to a data shape, and it never attaches state to a receiver.

Every module may declare them, on any type another module owns, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](../language/extensions.md#extensions-owners) set out, so extensions that compete both register and are told apart by extension access. A type that the module itself owns takes its members in its own declaration, and a target no module declares is refused when the module is registered, so a misspelled type never becomes an extension.
