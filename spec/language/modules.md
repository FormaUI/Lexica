# Modules

<a id="modules-in-scripts"></a>

A **module** is a named set of declarations, the types, members, extensions and type selectors a script's vocabulary holds. A script reaches a module's declarations by importing the module, through the namespace its import gives it, as this document sets out, and its members are selected by their receivers' types, the owner's first, as [owners and extensions](extensions.md#extensions-owners) set out. How a host creates and registers a module is the runtime's, as [modules](../runtime/modules.md) set out.

In this document:

1. [Imports](#scripts-imports)
2. [Namespaces](#namespaces)

<a id="scripts-imports"></a>

## Imports

**Registering** a module with a registry makes it available to scripts, and **importing** it lets a script use it. A script imports each module whose vocabulary it uses in an import declaration, `import` and the module's name, before its body: a script that reads the home's rooms and `Energy`'s `usage` of their devices begins `import Home` and `import Energy`, and its body follows, as `Home.rooms { name = it.name, usage = it.devices.sum(it.usage) }`. Only the modules it imports, and Nexo's own, which every script has and none imports, take part in resolving it, so registering another module that declares `usage` on `Device` leaves that script as it is.

- **Where they stand.** Each import declaration names one module or one type, at the start of the script, before the first local or expression of its body, and applies to the whole script, its nested bodies and functions included. Import order decides nothing. Nexo's own module is always available and has no namespace, so neither it nor its types are imported, and `import Nexo` is refused.
- **A module or a type.** `import Home` imports a module, and `import Home.Sensor` one of its public types, an ordinary type or an extension alike, `import Measurements.NumericList`. A source names a registered module by its registered name and a type by its local name in that module, never another import's local name, so no import depends on another.
- **Local names.** An import gives its module or its type one local name in the script. Without an alias, that is its own name: `import Measurements` gives `Measurements`, and `import Home.Sensor` gives `Sensor`.
- **Aliases.** An **alias** is a local name written before `=`, and the import's source after it: `import Measures = Measurements` gives the module `Measurements` the local name `Measures`, so the script writes `Measures.Temperature`. The alias replaces the own name: after `import Measures = Measurements` alone, `Measurements.Temperature` is refused, and a script writing both `import Measurements` and `import Measures = Measurements` reaches the one module by either name. After `import HomeSensor = Home.Sensor`, the script names that type `HomeSensor`, and neither `Sensor` nor the namespace `Home` is bound. An alias may be spelled as another registered module: after `import Home = Garden`, `Home` in that script is the module `Garden`, and the module registered as `Home` is reached under another local name, `import House = Home`, since a source always names a registered module.
- **Their spelling.** A local name is any identifier, conventionally in PascalCase, which is not enforced, a reserved word, `Nexo` and the name of one of Nexo's own types among them. A reserved word keeps its language meaning where a value stands, so a local name it spells is read with `@`, `@if.rooms`; after `import Nexo = Home`, `Nexo.rooms` and `@Nexo.rooms` read `Home.rooms`; and after `import Number = Home.Sensor`, `Number` names `Home.Sensor`, the script's declaration found before Nexo's own `Number`. It renames nothing outside its script, and keeps its declaration's identity, kind, members, inheritance and contracts.
- **One scope of local names.** Modules and types share it. One local name given to two declarations is refused at the imports, whatever their kinds or order: `import Measures = Measurements` beside `import Measures = Home.Sensor`, or `import Home.Sensor` beside `import Sensor = Garden.Sensor`; distinct aliases resolve it, `import HomeSensor = Home.Sensor` and `import GardenSensor = Garden.Sensor`. One declaration under one local name, written twice or supplied by a host too, counts once, and one declaration under several local names makes no ambiguity, since lookup compares declarations by identity.
- **What a module import makes available.** A module's public vocabulary: its namespace, through which its module members, its qualified forms and its function references are read; its public types, by their names, in a cast or a conversion, and its extensions, by theirs, in an [extension access](extensions.md#extensions-access); and the members it declares, its structured types' properties and its extensions among them, with its conversions and its operators. A type selector's key needs no import of its own: the member that selects by it does, and a mapping any module declares extends that member's selector.
- **What a type import makes available.** The type, by its local name, in a cast or a conversion, or, for an extension, in an extension access, and its public members: a type's own and those it inherits, its indexers, conversions and operators among them, and an extension's members, which take part in ordinary lookup as a module import's do. What it makes available is the declaration, read on any receiver it applies to: a member an imported `Light` inherits from `Device` is read on a `Device` too. It makes neither its module's namespace nor its module's other declarations available, and an extension another module declares on the type needs its own import. A name a script imports explicitly wins over a type its module imports expose, as [type identity](types.md#types-type-identity) sets out.
- **Members by their declaring module.** A script accesses a declared member only where it imports the module that declares it, or the type or the extension that declares it, a property, a function, an indexer and an operator alike. An extension is its declaring module's, so it needs that module's import, while the owner of the receiver's type need not be imported: with only `Energy` imported, `device.usage` reads `Energy`'s extension on a `Home.Device` a host binds, while `device.name`, a member `Home` declares, needs `import Home`. A computed property access follows the rule a written name does, and an object's fields, which no module declares, are read without any import.
- **Dependencies are not imports.** A module's declarations may use another module's types: a script importing `Energy` alone reads a member of it that answers a `Garden.Reading`, holds the answer, returns it whole and passes it on, while naming `Reading` or reading a member `Garden` declares on it, a property of its data among them, needs `import Garden`. The registry understands every registered module's types, and recognizing a value's type never imports its module, nor does resolving the type a host declares for a binding against the registry: a script reading a `Home.Device` its host binds imports `Home` to read the device's members, as it does for any value.
- **A host's imports.** A host may supply imports of its own through the API, as [the host contract](../runtime/resolution.md#runtime-bindings-and-resolution) sets out, so a host whose scripts all use its module supplies it, and a script writes its import only where it chooses to, writing it as well being harmless. A host writes each as a definition records it, `{ module: 'Measurements', alias: 'Measures' }` or `{ module: 'Home', type: 'Sensor', alias: 'HomeSensor' }`, and a module's name alone, `'Home'`, for `{ module: 'Home' }`; its imports follow the rules a written import does, its local names sharing the script's scope.
- **Diagnostics name both.** A diagnostic about a name an import gives writes the local name and the declaration it denotes, `HomeSensor`, `Home.Sensor`, and a resolution records the declarations themselves.
- **Parameters keep their names.** A bound script parameter named after a module is read as that parameter wherever no import of the script gives that name, so a missing import never turns a parameter into a namespace; a script reading a registered module's name that none of its imports gives, where no parameter of that name is bound, is refused, giving the import to write.

The examples are read as their host reads them, which supplies imports of `Home` and `Energy` to every script, as [the examples' vocabulary](examples-vocabulary.md) sets out.

<a id="namespaces"></a>

## Namespaces

A module's namespace is how a script reaches what the module declares: in a script [importing](#scripts-imports) the module, the local name its import gives it, a dot and the name of one of its declarations, as `Home.rooms` and `Home.device(room, "lamp")` are, and the qualifier of one of its extensions' names, as `device:Energy.Device.usage` writes it.

<a id="namespaces-module-members"></a>

### Module members

A member a module declares in its own `members`, with no type it applies to, is a **module member**, read through the namespace alone: `Home.rooms` reads the home's rooms, and `Home.now` the time. Its implementation is given no receiver. Two modules may each declare a module member of one name, since each is read through its own namespace. Reading a member through a namespace says nothing of how its value changes: `Home.now` is unobserved, and changes between evaluations.

<a id="namespaces-qualified-access"></a>

### Qualified access

Every member a module declares on one of its own types is also reached through the module's namespace, the receiver its first argument and the member's own arguments after it: `Home.device(room, "lamp")` and `Home.active(device)`. The qualified form selects that module's declaration and reuses its implementation and its contract, and the unqualified form stays available beside it, so no module declares a second implementation to make a member addressable. An extension's member is selected explicitly through its extension instead, `device:Device.usage`, as [extension access](extensions.md#extensions-access) sets out, and no namespace reaches it.

In a qualified call to a receiver member, the receiver argument propagates null. If it is null, the member's implementation is not invoked and the call produces null. The result type includes null whenever the receiver argument's type includes null, so each qualified form is a receiver form selecting that module's declaration:

| Qualified form | Equivalent receiver form |
| --- | --- |
| `Home.device(room, "lamp")`, `room` not nullable | `room.device("lamp")`, selecting `Home`'s declaration |
| `Home.device(room, "lamp")`, `room` nullable | `room?.device("lamp")`, selecting `Home`'s declaration |

The rule belongs to the receiver argument alone: the member's own arguments keep their declared null policies, and a module member has no receiver argument for it to apply to. A qualified call evaluates its receiver argument first, and a null one skips the member's own arguments as `?.` does, so `Home.device(room, name)` evaluates `name` only where `room` is not null. A null receiver argument skips the member and its arguments, never what the receiver argument reads, so an evaluation still reports every read its receiver argument makes.

A module's function written through its namespace without a call is a [function reference](functions.md#functions-module-functions), which a function parameter, or an expression or a predicate parameter, takes, as `room.devices.where(Home.active)` does, and which the qualified form's rules govern when it is called.

<a id="namespaces-indexers"></a>

### Indexer selection

An indexer is selected by the owner of its receiver's type, as a member is, and keeps its key, its receiver and its contract however it is selected:

- **A named indexer**, `x.name[key]`, resolves as an unqualified member does: the owner's indexer of that name wins over every extension's, the applicable extension's whose target is more specific than every other's resolves, and several none of which is more specific are refused as ambiguous when the script is resolved, the error naming the indexer, its receiver's type and the competing modules.
- **An unnamed indexer**, `x[key]`, selects the indexer declared without a name for its receiver's type: the owner's wins, the applicable extension's whose target is more specific than every other's resolves where the owner declares none, and several none of which is more specific are refused as ambiguous, as named ones are. So `device["mode"]` reads `Home`'s, whatever an extension declares, and `rooms[0]` reads `List`'s.

No qualified form reaches an indexer, and an extension's indexer is selected explicitly through its extension, `device:Device.setting["mode"]` and `device:Device["mode"]`, as [extension access](extensions.md#extensions-access) sets out, so one that the owner's indexer of its name outranks, or that another extension's competes with, is still reached that way.

<a id="namespaces-a-modules-own-collisions"></a>

### A module's own collisions

Declarations of one name within one module whose receivers overlap both register, as [duplicates](../runtime/modules.md#runtime-duplicates) set out: `Home` may declare `active` on `Device` and on `Light`, two declarations though a light satisfies both. An access, an indexer or an operator resolves through its receiver's type: select the applicable declaration whose receiver type is more specific than every other applicable declaration's receiver type. If there is no unique such declaration, the access is ambiguous. Specificity follows the type relationships: `Light` is more specific than `Device`, `List<Light>` than `List<Device>` by list covariance, and a receiver of any type is the least specific, so a member on a type hides one of its name on a supertype, `light.active` reading `Light`'s and `device.active` of a `Device` reading `Device`'s. The receiver's static type selects, so a light held as a `Device` reads `Device`'s. Where both `List<Number>.active` and `List<String>.active` are registered, an empty list, a `List<Never>`, satisfies both receiver types, and neither is more specific than the other, so that access is ambiguous, the diagnostic naming the competing declarations; with one applicable declaration, or a uniquely most specific one, it resolves as any access does. A module member competing with a receiver's member in a qualified call is a separate rule, set out below. Members of one name on unrelated receivers never meet, since the receiver selects one, written unqualified or qualified, and a [function reference](functions.md#functions-module-functions) selects one by the callback contract it is passed to, refusing one that several take.

A module member, which has no receiver, and a member of its name on a receiver both register, and both are reached through the module's namespace: `Home.rooms` reads or references the module member, and `Home.rooms(room)` is the qualified form of the receiver's member as well as a call of the module member. Resolution and type checking decide which reading a qualified call takes, nothing being evaluated: one reading applies, and is selected; both apply, and the call is refused as ambiguous, the receiver form, `room.rooms`, reaching the receiver's member. A module member and an extension of its name never meet, since an extension's function is never reached through a namespace. Owner precedence and ambiguity between modules are set out in [owners and extensions](extensions.md#extensions-owners).

<a id="names-and-reserved-words-module-names"></a>
<a id="namespaces-text-and-registries"></a>

### Module names in text

A module's name decides how a text reads, so a script's [imports](#scripts-imports) decide which of its names are namespaces, and a text reads alike wherever it is read: `nexo.parse` gives one text one definition, which every registry resolves, and registering a module never changes how a text reads.

A module's name is an identifier, conventionally written in PascalCase, `Home` and `SmartHome`, so a qualified name reads alike for a type, `Home.Device`, a module member, `Home.rooms`, and an extension, `device:Energy.Device.usage`. In a script importing the module, the local name its import gives it, its own or an [alias](#scripts-imports), `Measures`, begins that module's namespace where it stands unprefixed in place of a value, as `Home` and `Energy` do in the examples. It is a contextual name, never a reserved word of the language: `Home.rooms` reads the module's member, `@Home` the nearest local, object field, conditional binding or function parameter named `Home`, and otherwise the import binding `Home`, and `~Home` the script parameter `Home`, and a position that expects a name reads it in that role, so a member, an object field, a local or a function parameter named `Home` is declared and read as any is, importing the module invalidating none of them. A module may be named by a word the language reserves, and imported under one: the bare word keeps its language meaning where a value stands, so the import binding is read with `@`, as `@if.rooms`. In a script that does not import `Home`, `Home` is an identifier, read as any name is, and resolution refuses it as a missing import where the registry holds a module of its name and no script parameter of its name is bound.

Text is written by the same names: formatting writes a namespace as the local name the script's imports give the module, `Home` or `Measures`, a local or an object field named as a namespace the script's imports give as a lexical reference, `@Home`, and a script parameter named after one with `~`, `~Home`. Canonical text writes every import its definition records, so it reads back as the same definition wherever it is parsed; a caller may name the imports its destination supplies, `format(source, { imports: ['Home'] })`, which the text leaves out, and that text reads back as the same definition where it is parsed with them supplied.

Parsing reads an import and its namespace without asking a registry, so whether the module is registered is checked when the script is resolved, which refuses an import of a module the registry does not hold. A definition's namespace naming a module its imports leave out is a structure error. Parsed texts are kept by their text and the imports supplied to them.
