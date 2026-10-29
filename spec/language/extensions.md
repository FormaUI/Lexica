# Extensions

<a id="extensions"></a>

An **extension** is a named group of the members, indexers and operators a module adds to a type another module owns. It lets a module give a domain's types what that domain knows of them, as `Energy` gives `Home`'s devices their energy use, without owning them: an unqualified access reads the owner's member first and an extension's where the owner declares none, and an extension access selects one explicitly.

```nexo
{
    usage = device.usage,           // Energy's extension, the one that applies.
    power = device.power,           // Home's own, since the owner wins.
    metered = device:Device.power   // Energy's, selected explicitly.
}
```

In this document:

1. [Owners and extensions](#extensions-owners)
2. [Extensions on different targets](#extensions-different-targets)
3. [Extension access](#extensions-access)
4. [Type parameters](#extensions-type-parameters)

<a id="extensions-owners"></a>

## Owners and extensions

A module may declare members on any type, its own in their declarations or another module's in its [extensions](../runtime/extensions.md#extensions-declaring). The module that declares a type **owns** it, and a member another module declares on it, in one of its extensions, is an **extension member**, as `Energy`'s `device.usage` is. An unqualified member resolves by the owner of its receiver's static type, among the declarations applicable to the receiver and accessible to the script, those of Nexo's own module and of the modules the script [imports](modules.md#scripts-imports):

- An applicable member the owner declares wins over every extension, so `device.power` reads `Home`'s, whatever `Energy` declares. A member the owner declares on a supertype it also owns takes part with the owner's priority, while one another module declares on a supertype is applicable with no priority over other extensions. An extension on a more specific receiver never defeats an applicable member of the owner.
- Otherwise the applicable extension whose target is more specific than every other applicable extension's target is selected, by the specificity [a module's own collisions](modules.md#namespaces-a-modules-own-collisions) follow. One applicable extension resolves as any member does, so `device.usage` reads `Energy`'s; and were a module `Solar` to declare `usage` in an extension on `Light`, `light.usage` reads `Solar`'s and `thermostat.usage` `Energy`'s, whatever order the two modules registered in.
- Where no applicable extension's target is more specific than every other's, the access is refused as ambiguous when the script is resolved, before anything is evaluated: two extensions targeting the same type, and applicable targets neither of which is more specific than the other. Each still registers, since refusing one would leave it unreachable where explicit access selects it. Were `Solar` to declare `usage` on `Device` instead, in an extension also named `Device`, `device.usage` is refused in a script importing both, and reads `Energy`'s in one importing `Energy` alone:

> Member 'usage' on 'Device' is ambiguous between modules 'Energy' and 'Solar'. Use 'device:Energy.Device.usage' or 'device:Solar.Device.usage' to select one.

Applicability follows the receiver's type and the access form, so one name on unrelated types is never ambiguous, and an [internal](../runtime/modules.md#modules-internal-declarations) declaration is not a candidate, so an accessible extension resolves where the owner's member of its name is internal. Registration order never decides. Nexo's own module owns the language's types, `List`, `Number`, `String` and `Boolean` among them, so `rooms.count` reads Nexo's whatever an extension declares; that module has no namespace, and its name is reserved nowhere. Indexers follow the same precedence, as [indexer selection](modules.md#namespaces-indexers) sets out, and so do [operators](../runtime/modules.md#modules-operators): a cast or a conversion is selected among the operators of its name and destination applicable to its receiver, the owner's winning, the extension's whose target is more specific than every other's resolving where the owner declares none, and several none of which is more specific refused as ambiguous, since no syntax selects one module's operator, extension access among them.

<a id="extensions-different-targets"></a>

## Extensions on different targets

Extensions whose targets differ may declare members of one name, in one module or in several, each extension a declaration with its own identity:

```js
{ name: 'NumericList', kind: 'extension', target: 'List<Number>', members: [/* total */] }
{ name: 'StringList', kind: 'extension', target: 'List<String>', members: [/* total */] }
```

Ordinary lookup first takes the extensions whose targets the receiver satisfies, by the [assignability rules](types.md#types-assignability), and then applies ownership and specificity, as [owners and extensions](#extensions-owners) set out: `values.total` reads `NumericList`'s for a `List<Number>`, and `StringList`'s for a `List<String>`. An empty list, a `List<Never>`, satisfies both targets through list covariance, and neither target is more specific than the other, so `values.total` is refused as ambiguous, and an [extension access](#extensions-access) resolves it: `values:NumericList.total`, `values:StringList.total`, or one its module qualifies, `values:Measurements.NumericList.total`. The selected extension's target still accepts the receiver, since selecting one never bypasses type checking.

<a id="extensions-access"></a>

## Extension access

`receiver:Extension.member` selects an [extension](../runtime/extensions.md#extensions-declaring) explicitly: the expression before `:` is the receiver, the name after it identifies the extension that supplies the member, and the member keeps its own form.

| Member form | Required form | Optional form |
| --- | --- | --- |
| Property | `device:Device.usage` | `device?:Device.usage` |
| Function | `device:Device.reset(3)` | `device?:Device.reset(3)` |
| Named indexer | `device:Device.setting["mode"]` | `device?:Device.setting["mode"]` |
| Unnamed indexer | `device:Device["mode"]` | `device?:Device["mode"]` |

- **The extension's name.** After `:` stands an extension's name, its local name or one its module qualifies, `device:Energy.Device.usage`, where a name the script's [imports](modules.md#scripts-imports) give a module, its own or an alias, followed by a dot, is the qualifier, so the text alone decides where the name ends, and an extension named as a module the script imports is written qualified, `device:Solar.Energy.usage`. Resolution reads it as a script's [type name](types.md#types-type-identity) is read, an extension the script imports by name first, `values:Numeric.total` after `import Numeric = Measurements.NumericList`, and otherwise the public extensions of Nexo's own and of the modules the script imports, one only, several refused with their qualified names given: ordinary types take no part, so beside `Home`'s type `Device`, `device:Device.usage` selects `Energy`'s extension, and a name only an ordinary type has is refused.
- **Its members alone.** Lookup is limited to the extension's members, so a member it does not declare is an error at that selection, never falling through to another extension or to the receiver's own members, and an extension that ordinary lookup outranks is still reached. The receiver satisfies the extension's target, binding its parameters as [binding a call's parameters](types.md#types-type-parameters-binding) sets out, and visibility and the host's policy apply as to any access.
- **One member operation.** The selection applies to one member operation, and what follows it applies to that operation's answer as usual: `device:Device.details.name` reads the `name` of what `details` answers, and `device:Device.readings[0]` indexes it, unless `readings` is a named indexer, whose declaration decides. A later colon selects another extension for the intermediate value: `device:Device.readings:ListExtensions.first`.
- **A postfix of its receiver.** It binds as a member access does, so in `left + right:NumberExtensions.description` it belongs to `right`, and in `(left + right):NumberExtensions.description` to the sum.
- **Null.** `:` takes a receiver that cannot be null, one that can being refused with the form `?:`, as `.` is with `?.`, and a null found during evaluation failing the access. `?:` evaluates its receiver once and, where it is null, answers null without evaluating the member's arguments or keys, as `?.` does, the extension's name still resolved and its declaration still checked. The items of a `List<Device?>` don't make the list null.
- **A function without a call** is a function reference bound to its receiver: `device:Device.active` evaluates and captures `device` once, when the reference is created, and takes the member's own arguments alone, under the restrictions every [function reference](functions.md#functions-module-functions) follows, so a function the host invokes has none. Where the receiver is supplied later, an arrow function writes it: `d => d:Device.active()`.
- **A receiver of `Any`.** The selection names the declaration, so its arguments are read by it, and the receiver is checked against the target when it is evaluated, as [values of `Any`](types.md#types-any) set out; selecting an extension doesn't make an unknown type known, so what inference still needs from the value is refused as for any call.
- **Evaluation.** The receiver is evaluated once and checked against the target, and a failed check invokes nothing; the arguments or keys follow the member's contract, the host's `beforeInvoke` decides before the member is invoked, a property's getter and an indexer included, and the answer is checked as any member's is. A host call selected so keeps its terminal position, its preparation and its projection, and a resolution reports the selected member among its used declarations.

<a id="extensions-type-parameters"></a>

## Type parameters

An extension's name may declare [type parameters](types.md#types-type-parameters), `ListExtensions<T>`, which its target and every one of its members share, and which the receiver binds afresh at each access, as [binding a call's parameters](types.md#types-type-parameters-binding) sets out; an extension that targets its own parameter, `Checks<T>` targeting `T`, extends a receiver of any type. Within an extension, its own module's types and Nexo's resolve unqualified and a foreign type is written qualified, as [type name lookup](types.md#types-type-name-lookup) sets out.
