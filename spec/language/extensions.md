# Extensions

<a id="extensions"></a>

An **extension** is a named group of the members and operators a module adds to a type another module owns. It lets a module give a domain's types what that domain knows of them, as `Energy` gives `Home`'s devices their energy use, without owning them.

A script reads a type's own members with `.` and its extension members with `:`, so where a member comes from is always visible:

```nexo
{
    usage = device:usage,           // Energy's extension member.
    power = device.power,           // Home's own member.
    metered = device:Device.power   // Energy's, through its extension Device.
}
```

In this document:

1. [Owners and extensions](#extensions-owners)
2. [Extensions on different targets](#extensions-different-targets)
3. [Extension access](#extensions-access)
4. [Reading an access's names](#extensions-reading-names)
5. [Type parameters](#extensions-type-parameters)

<a id="extensions-owners"></a>

## Owners and extensions

The module that declares a type **owns** it. A member another module declares on the type, in one of its [extensions](../runtime/extensions.md#extensions-declaring), is an **extension member**, as `Energy`'s `usage` is on `Home`'s `Device`.

- **`.` reads the owner's members.** `device.power` reads the `power` `Home` declares. A member the owner declares on a supertype it owns takes part too. The owner's members include those it declares in an extension of its own types, as Nexo's own `flatten` is on a list of lists.
- **`:` reads extension members.** `device:usage` reads `Energy`'s `usage`. An extension member is never read with `.`: `device.usage` is refused, giving `device:usage` (NEXO3090).
- **The two never compete.** A type's owner and an extension may each declare a member of one name, as `Home` and `Energy` each declare `power`: `device.power` reads `Home`'s and `device:power` reads `Energy`'s.

The declarations an access considers are those of Nexo's own module and of the modules the script [imports](modules.md#scripts-imports). An [internal](../runtime/modules.md#modules-internal-declarations) declaration is never a candidate, and registration order never decides.

Among the extensions a `:` access applies to, the one whose target is the most specific is selected, by the specificity [a module's own collisions](modules.md#namespaces-a-modules-own-collisions) follow. Were `Solar` to declare `usage` in an extension on `Light`, `light:usage` reads `Solar`'s and `thermostat:usage` reads `Energy`'s.

Where no applicable extension's target is more specific than every other's, the access is refused as ambiguous when the script is resolved (NEXO3024), and naming the extension resolves it. Were `Solar` to declare `usage` on `Device` too, in an extension also named `Device`:

> Member 'usage' on 'Device' is ambiguous between modules 'Energy' and 'Solar'. Use 'device:Energy.Device.usage' or 'device:Solar.Device.usage' to select one.

Each still registers, since naming the extension reaches it.

**Operators.** A cast or a conversion is written with `as` or `to`, never with `.` or `:`, so it is selected among every applicable [operator](../runtime/modules.md#modules-operators): the owner's first, then the extension's whose target is the most specific, several none of which is more specific being refused as ambiguous.

<a id="extensions-different-targets"></a>

## Extensions on different targets

Extensions whose targets differ may declare members of one name, in one module or in several, each extension a declaration with its own identity:

```js
{ name: 'NumericList', kind: 'extension', target: 'List<Number>', members: [/* total */] }
{ name: 'StringList', kind: 'extension', target: 'List<String>', members: [/* total */] }
```

A `:` access first takes the extensions whose targets the receiver satisfies, by the [assignability rules](types.md#types-assignability), and then the most specific of them: `values:total` reads `NumericList`'s for a `List<Number>`, and `StringList`'s for a `List<String>`.

An empty list, a `List<Never>`, satisfies both targets through list covariance, and neither is more specific, so `values:total` is refused as ambiguous. Naming the extension resolves it: `values:NumericList.total`, `values:StringList.total`, or `values:Measurements.NumericList.total` qualified by its module. The named extension's target still accepts the receiver, since naming one never bypasses type checking.

<a id="extensions-access"></a>

## Extension access

An **extension access** reads an extension member with `:`. It names the member alone, or through its extension, which its module may qualify:

| Form | Example | What it names |
| --- | --- | --- |
| `receiver:member` | `device:usage` | The member, among the extensions that apply to the receiver |
| `receiver:Extension.member` | `device:Device.usage` | The member of that extension |
| `receiver:Module.Extension.member` | `device:Energy.Device.usage` | The member of that extension, the extension qualified by its module |

Ordinary access continues after the member, on what it answers, in each form:

```nexo
{
    unnamed = device:power.round,                 // Energy's power, then its answer's round.
    named = device:Device.power.round,            // Through Energy's extension Device.
    qualified = device:Energy.Device.power.round  // Device qualified by its module.
}
```

Which names are the extension's and which are ordinary access is read by the declarations they name, as [reading an access's names](#extensions-reading-names) sets out.

The member keeps its own form, a property, a function or a named indexer, and `?:` is the optional form:

| Member form | Required form | Optional form |
| --- | --- | --- |
| Property | `device:usage` | `device?:usage` |
| Function | `device:reset(3)` | `device?:reset(3)` |
| Named indexer | `device:setting["mode"]` | `device?:setting["mode"]` |

- **The extension's name** is read as a script's [type name](types.md#types-type-identity) is: an extension the script imports by name first, `values:Numeric.total` after `import Numeric = Measurements.NumericList`, then the public extensions of Nexo's own module and of the modules the script imports. Ordinary types take no part, so beside `Home`'s type `Device`, `device:Device.usage` names `Energy`'s extension. A name no extension has, several extensions share unqualified, or a namespace stands before is refused (NEXO3026, NEXO3061).
- **Its members alone.** A named extension's lookup is limited to its members, so a member it does not declare is refused (NEXO3062), never falling through to another extension or to the owner's members.
- **A postfix of its receiver.** It binds as a member access does, so in `left + right:description` it belongs to `right`, and in `(left + right):description` to the sum.
- **Null.** `:` takes a receiver that cannot be null, and one that can is refused with the form `?:` (NEXO3063), as `.` is with `?.`. `?:` evaluates its receiver once and, where it is null, answers null without evaluating the member's arguments or keys. The items of a `List<Device?>` don't make the list null.
- **A function without a call** is a function reference bound to its receiver: `device:active` evaluates and captures `device` once, when the reference is created. It takes the member's own arguments, of every kind the member takes, wherever it is called from, a local holding it included, under the restrictions every [reference to a module's function](functions.md#functions-module-functions) follows, so a function the host invokes has none. Where the receiver is supplied later, an arrow function writes it: `d => d:active()`.
- **A receiver of `Any`.** The member is selected when the receiver is evaluated, among the extensions that apply to its actual type, as [values of `Any`](types.md#types-any) set out; a named extension's target is checked against it then.
- **Evaluation.** The receiver is evaluated once and checked against the target, and a failed check invokes nothing. The arguments or keys follow the member's contract, the host's `beforeInvoke` decides before the member is invoked, and the answer is checked as any member's is. A host call reached this way keeps its terminal position, its preparation and its projection.

<a id="extensions-reading-names"></a>

## Reading an access's names

The names after an access's colon, up to anything but a dot and a name, are read by the declarations they name. They read up to three ways:

| Way | The first names | Then |
| --- | --- | --- |
| 1 | An extension member that applies to the receiver | Its answer's members |
| 2 | An extension the script reaches, which declares the second | The second's answer's members |
| 3 | A module the script's imports name, whose public extension the second is, declaring the third | The third's answer's members |

A call or a key after the last name applies to it, whichever way the names read.

- **Roles.** A name fills a role only where it names what the role needs. A local or a parameter never names an extension or a module, so `count:it.devices.count` reads `it` as an extension member of `count`, or is refused.
- **One way.** Where exactly one way fits, the access reads that way: `name:size.width` reads `size` as an extension member where no extension is named `size`.
- **Several ways.** Where more than one fits, the access is refused as ambiguous (NEXO3091), giving the text that writes each. Where `size` is both an extension member and an extension:
  - a group, `(name:size).width`, or the member's own extension, `name:Metrics.size.width`, reads `size` as the member;
  - the extension named through its module, `name:Measurements.size.width`, reads `width` as the member of the extension `size`.
- **No way.** Where none fits, the access is refused as the way its first name comes closest to reads it: a module's name as way 3, an extension's anywhere as way 2, and any other first name followed by more names as naming neither an extension nor an extension member of the receiver (NEXO3026).
- **Spacing and lines never decide.** `name: size.width` reads as `name:size.width`. A line may break before each later dot, as before any step of a chain, and the names continue.
- **A group ends the names.** `(name:size).width` reads `size` as the access's member and `width` as an ordinary access, whatever an extension is named.

<a id="extensions-type-parameters"></a>

## Type parameters

An extension's name may declare [type parameters](types.md#types-type-parameters), `ListExtensions<T>`, which its target and every one of its members share, and which the receiver binds afresh at each access, as [binding a call's parameters](types.md#types-type-parameters-binding) sets out. An extension that targets its own parameter, `Checks<T>` targeting `T`, extends a receiver of any type. Within an extension, its own module's types and Nexo's resolve unqualified and a foreign type is written qualified, as [type name lookup](types.md#types-type-name-lookup) sets out.
