# Modules

<a id="modules"></a>

A **module** is a named set of declarations a host registers: the types it owns with their members, the members it adds to other modules' types, its module members, type selectors and their keys, observation types and observation targets, all contributing to a script's [vocabulary](vocabulary.md). A script resolves against the declarations of every module its registry holds, and reaches a module's own names through the module's namespace, as `Home.rooms` does.

A module's declarations are data, apart from the code that carries them out, so a tool reads them and checks a script against them without running anything. Here the examples' `Home` module declares the type `Room`, with its member `device(name)`, and is registered with a registry of its own:

```js
const home = lexica.createModule('Home', {
    typeOf: value => homeTypeOf(value),
    types: [
        {
            name: 'Room',
            kind: 'reference',
            isInstance: value => value instanceof HomeRoom,
            members: [
                {
                    name: 'device',
                    kind: 'function',
                    arguments: 'positional',
                    result: 'Device?',
                    parameters: [{ name: 'name', kind: 'value', type: 'String', required: true, fixed: false, nulls: 'propagate' }],
                    updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'placement', of: 'Home' }] },
                    impl: ({ receiver, args }) => receiver.find(args.name),
                },
            ],
        },
        /* Device, Light, Thermostat, Sensor, Climate, Change, Motion */
    ],
    members: [/* rooms, now */],
    typeSelectors: [{ name: 'event' }],
    mappings: [/* change, motion */],
    observationTypes: [/* placement, state, climate, presence, reading */],
    observationTargets: [{ name: 'Home' }],
});
const registry = lexica.createRegistry([home]);
```

In this document:

1. [Creating a module](#modules-declarations)
2. [What a module declares](#modules-what-a-module-declares)
3. [Declaring a type](#modules-declaring-a-type)
4. [Operators](#modules-operators)
5. [Internal declarations](#modules-internal-declarations)
6. [Valid declarations](#modules-valid-combinations)
7. [Registries](#modules-registries)
8. [Namespaces](#namespaces)
9. [Extensions](#extensions)

<a id="modules-declarations"></a>

## Creating a module

A module is made by `createModule` from its name and its declarations, `{ typeOf, types, members, typeSelectors, mappings, observationTypes, observationTargets }`, its name the module's and its namespace's. Its declarations are validated when it is created and checked against the registry when it is registered with `registerModule`; a declaration that breaks a contract is a module error, raised when the module is created or when it is registered, naming the module, the declaration and the field, and the type a nested declaration stands in.

Lexica's own module is one Lexica creates itself, the one module every registry holds, which owns the language's types and has no namespace. It declares the language's value types through a declaration form internal to Lexica, so it declares `List<T>`, a generic type holding the members of lists, where a module's reference and structured types declare no [type parameters](types.md#types-type-parameters). Every other module, a host's among them, is made with `createModule` and keeps every restriction its declarations carry, and no factory, name or flag makes one an exception to the rules.

A declaration that runs code carries it as its `impl`: a property, a function, an indexer, an operator and an observation type. Two integration hooks run code too, each named for what it answers: a module's `typeOf` and a reference type's `isInstance`, which Lexica calls and no script names. Every other key is data, and two declarations sharing code refer to one JavaScript function, as one member a module gives several of its types is.

A module is given the capability it exposes, never an instance of it, since instances belong to the callers that start them. A module exposes a capability through Lexica without the capability depending on Lexica: the capability keeps an API of its own, and its module lives beside it or in an integration package for it.

<a id="modules-what-a-module-declares"></a>

## What a module declares

A module declares types of its own, reference and structured, each holding its members: its properties, a structured type's stored data among them, functions and indexers, for the evaluator or the host to invoke, Boolean functions among them, and its operators. It adds members to types other modules own in its [extensions](#extensions), declared among its `types`, declares module members with no receiver, and declares type selectors and their keys, observation types and observation targets. It follows these contracts throughout: every member declares its signature, its argument kinds and its result type, every member the evaluator invokes declares how it changes, aside from a structured type's stored properties, which are its data, and operators, whose answer depends on their operand alone, and evaluating a script stays read-only and synchronous.

| Declaration | What it is | Specified in |
| --- | --- | --- |
| Reference type | A type whose values have identity: its name, at most one supertype, its `isInstance`, whether it is abstract, and its members | [Reference types](types.md#reference-types), [declaring a type](#modules-declaring-a-type) |
| Structured type | A type of data: its name, its stored shape in its stored properties, and its other members | [Declaring a type](#modules-declaring-a-type) |
| `typeOf` | The module's recognition of a host's value, naming the most specific of its reference types the value is of, or null | [Reference types](types.md#reference-types) |
| Member | A property, a function, an indexer or an operator of a type, or a property or a function of no type | [Members](members.md), [operators](#modules-operators) |
| Extension | A named group of the members a module adds to a type another module owns, its `target` | [Extensions](#extensions) |
| Type selector, mapping | A selector a fixed argument chooses a type through, and a mapping of one of its keys to a type | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Observation type, observation target | What a member names to learn that its result may have changed, and what it may observe | [Observations](vocabulary.md#observations) |

A module declares members on any type, its own in their declarations and another module's in its extensions, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out. Any type or member may be [internal](#modules-internal-declarations), available within its module alone.

<a id="modules-declaring-a-type"></a>

## Declaring a type

A module declares each type it owns in its `types`, its `kind` saying which family it is of, and the type's members within it, in its `members`. A member there takes the type as its receiver and does not name a target, and the order of a module's types is not significant, so one type names another declared after it.

```js
{
    name: 'Light',
    kind: 'reference',
    supertype: 'Device',
    isInstance: value => value instanceof HomeLight,
    members: [/* brightness, dim */],
}

{
    name: 'Climate',
    kind: 'structured',
    members: [
        { name: 'temperature', kind: 'property', result: 'Number' },
        { name: 'humidity', kind: 'property', result: 'Number' },
    ],
}
```

- **A reference type** is `kind: 'reference'`. It declares its `isInstance`, may name a `supertype` and be `abstract`, and holds its members, as [reference types](types.md#reference-types) set out.
- **A structured type** is `kind: 'structured'`, a type of immutable data. Its stored shape is its stored properties, the properties it declares directly without `updates`, each naming the type of its value in `result` and taking no `impl`; Lexica reads the stored property of each name from the data, and validates, copies and freezes a structured value by them, never invoking a computed property to do so. A stored property is read as any property is, `room.climate?.temperature`, and its computed properties, which declare `updates`, and its other members compute what they answer through their `impl`, which a tool may leave out without changing the stored shape. An extension adds no stored property to a type, and a property declared without `updates` anywhere but directly in a structured type is refused.
- **An extension** is `kind: 'extension'`, holding the members it adds to its `target`, as [extensions](#extensions) set out, and never a value's type.
- **A type's name** is unique within its module, conventionally in PascalCase, as [type names](types.md#types-type-names) set out, and the type is identified by its module and that name.
- **Its imports.** A reference type and a structured type may declare `import`, the names of modules whose public types its declaration names unqualified, `import: ['Home']`; every other foreign type it names is qualified, `Home.Device`, as [type identity](types.md#types-type-identity) sets out.

Lexica's own `List<T>` is the one generic value type, its parameter `T` the type of its items, which its members' declarations write. A module's own reference and structured types don't declare type parameters, and an extension and a member declare their own, as [type parameters](types.md#types-type-parameters) set out.

<a id="modules-operators"></a>

## Operators

A type's members may hold **operators**, `kind: 'operator'`, which the language's own syntax invokes and nothing else: `name: 'cast'`, which `as` invokes, and `name: 'convert'`, which `to` invokes, each naming its destination type in `result`.

```js
{ kind: 'operator', name: 'cast', result: 'Home.Device' }
{ kind: 'operator', name: 'convert', result: 'Temperature', impl: ({ value }) => ({ value, unit: 'C' }) }
```

- **Only through their syntax.** An operator is not a member a script calls: `value.convert(…)`, a qualified form such as `Measurements.convert(value)`, an extension access and a function reference reach none, and a function a module declares named `convert` is an ordinary member of its own. Operators and ordinary members are looked up apart, so a `cast` beside a property of that name is not a collision.
- **Selected by their destination.** An operator is selected by its receiver's type, its name and its result together, so a type declares several of each, one for each destination type, and two for one destination collide.
- **A cast operator** is declared on a reference type, and its result is another reference type, outside its hierarchy: it permits that one directed cast, and its `impl` is optional, as [casts](types.md#casts-what-it-narrows) set out.
- **A conversion operator** is declared on a type of data, and its result is another type of data: `Number`, `String`, `Boolean` or a structured type holding data alone. Its `impl` reads `{ value, reject }` and answers the converted value, as [conversions](vocabulary.md#vocabulary-conversions) set out. A module declares a conversion whose source or destination is one of its own types, a rule Lexica's own module alone is exempt from, for the conversions between the language's types, and declares one on a type it does not own in an extension, as `Measurements` declares one from `Number` to its `Temperature` in its `NumberExtensions`.

<a id="modules-internal-declarations"></a>

## Internal declarations

A type or a member declares `internal: true` to be available within its declaring module alone. `internal` is a Boolean, `false` where left out, and any other value, a string among them, is refused when the module is created. The declaring module of a member is the one whose `types` or `members` hold it, an extension among its types, so an internal extension member belongs to the module that declares the extension, never to the owner of the type it extends. A member of an internal extension is internal, as a member of an internal type is.

- **Its type bounds it.** A member of an internal type is internal however its own flag is written, and `internal: false` on it widens nothing, as a member's accessibility is bounded by its containing type in .NET. A public type holds public and internal members alike, and stays usable and extensible by every module: another module extends `Reading`, and cannot use `Reading.source` where that field is internal.
- **At registration.** A declaration of another module that names an internal type, as a supertype, an extension's target, or a parameter's, a field's or a result's type, and one that names an internal member explicitly, is refused. A public declaration exposes public types alone: every type its signature writes, its parameters', its callbacks' arguments' and results', its result's and, for a public field, its value's, through list items and nullable types, is public, and so are a public type's supertype and the type a mapping gives a fixed argument; one that is not is refused. Declarations within one module name each other's internal declarations freely.

  | Declaration | At registration |
  | --- | --- |
  | A public member returning the internal `ReadingState` | Refused |
  | A public member taking a `List<ReadingState>` | Refused |
  | An internal member using its module's `ReadingState` | Registered |
  | The public `Reading` holding an internal field of type `ReadingState` | Registered |
  | A public reference type declaring an internal supertype | Refused |
  | A mapping of a key to the internal `ReadingState` | Refused |

- **At resolution.** A script does not reach an internal declaration through any form: a member read or called, a field read by name or by computed property access, a qualified form, an extension access, a function reference, an indexer, and a cast or a conversion naming an internal type or selecting an internal operator. An internal declaration is not a candidate where [owner precedence](#namespaces-owners-and-extensions) chooses, so an accessible extension resolves where the owner's member of its name is internal.
- **In tooling.** Completion and every listing a script's author reads leave internal declarations out.

`internal` decides what scripts and other modules' declarations name, and nothing else: an implementation is JavaScript, and works with its values and its helpers as it always does, and a value a result holds keeps what it holds, an internal field among them, since what a script can name and what its host receives are separate.

<a id="modules-valid-combinations"></a>

## Valid declarations

One shape serves every declaration, and each kind accepts the fields it needs alone: a field a declaration's kind does not take is refused when the module is created, with a module error whose location names the module, the type a nested declaration stands in, the declaration and the field. A field holding `undefined` counts as left out.

`name` is common to every declaration; an operator's names its operation, `cast` or `convert`. A type, an extension, a member, a type selector, an observation type and an observation target are named by an [identifier](lexical-structure.md#names-and-reserved-words), as a script writes them, an extension and a member following it with the [type parameters](types.md#types-type-parameters) they declare, `ListExtensions<T>` and `identity<T>`, and any other is a module error when the module is created, so a member cannot be named `focus-within`, and is named `focusWithin`; a mapping is named by no identifier, its `key` being the string a fixed argument gives. A member's fields, by its kind, are set out in [declaring a member](members.md#members-declaring-a-member); every other declaration takes these:

| Declaration | Takes | Refuses |
| --- | --- | --- |
| Reference type | `kind: 'reference'` and `isInstance`, both required; `supertype`, `abstract`, `import`, `members`, `internal` | Any other field, `impl` among them |
| Structured type | `kind: 'structured'`; `import`, `members`, of which its stored properties are its stored shape, and `internal` | Any other field, a `fields` collection, `isInstance`, `supertype` and `impl` among them |
| Extension | `kind: 'extension'` and `target`, both required; `members` and `internal` | Any other field, `import`, `isInstance`, `supertype`, `type`, `typeParameters` and `impl` among them |
| Type selector | Its name alone | Any other field, `impl` among them |
| Mapping | `selector`, `key` and `type`, all required | Any other field, `name` and `impl` among them |
| Observation type | `contract`, `identity`, `shared`; `impl` | Any other field |
| Observation target | `from`, which is `receiver` where given; `count`, which is `many` where given | Any other field, `impl` among them, and the name `receiver` |

`typeOf` and `isInstance` are functions, checked as functions when the module is created and never called until a value needs them. A reference type declares its `isInstance` whether or not its module's `typeOf` ever names it, since a member's answer, a cast and a declared binding check membership by it.

<a id="modules-declarations-without-an-implementation"></a>

### Declarations without an implementation

A declaration without an `impl` is resolved against as any other, so a tool reads and checks every script that uses it. It is never invoked: creating an evaluator for a resolution any of whose used declarations the evaluator invokes, or any of the conversion operators it uses, has no `impl` is refused, with a module error naming the declaration and its module. A stored property takes none, since Lexica reads it from the data, and a cast operator needs none, as [operators](#modules-operators) set out. The used declarations include those an unreached branch uses, so whether a script can be evaluated is decided before anything is evaluated, whatever branch its evaluation takes, and a script of a module only some of whose declarations are implemented is evaluated where it uses those alone.

<a id="modules-registries"></a>

## Registries

A **registry** holds the modules a host resolves and evaluates against. `lexica.createRegistry(modules)` creates one holding Lexica's own module and the modules given, registered in the order given, as `registerModule` registers each, so a module names the types of those before it; no registry is shared, so two hosts never see each other's modules.

- **The registry holds definitions.** A registry holds the declarations of every module registered with it, shared by all the host's callers. What a host's callers start through host calls, and the state it keeps, is scoped to those callers, never to the registry.
- **Registering checks the module whole.** `registerModule` indexes every type the module declares, then checks every declaration against them and the registry before it registers any, so a module refused leaves nothing of itself registered and advances no revision. Module names conventionally use PascalCase, but casing is not enforced. At registration, module names are compared case-insensitively for uniqueness. A registration is refused if an existing module has the same name under that comparison. The original spelling is preserved, so `Lexica`, the built-in module's name, refuses `lexica` as any registered name refuses another spelling of itself. A type is named once within its module; type selectors and observation types are each named once across every module, Lexica's own included, a mapping's key stands once in its selector, and a name or a key already declared is refused. A type a declaration names resolves to one the module declares or a module registered before it declares, as [type identity](types.md#types-type-identity) sets out, and an `import` that does not name a registered module, a reference that resolves to no type or to several, and a foreign type named unqualified outside its import are refused; a supertype is a reference type, and no hierarchy is a cycle; a declaration names no other module's [internal](#modules-internal-declarations) declaration, and a public one exposes no internal type.
- **Ambiguity at a reference.** Ambiguity is checked when resolving a reference, against the declarations applicable at that location. Declarations are not refused merely because their names could become ambiguous in another context.
- **Its revision.** A registry answers a revision that changes whenever its vocabulary does, so a host that keeps resolutions knows when to resolve again.
- **It reads and writes text as Lexica does.** `registry.parse(text, options)`, `registry.format(source, options)` and `registry.quote(source, options)` read and write a text as `lexica.parse`, `lexica.format` and `lexica.quote` do, its [imports](scripts.md#scripts-imports) deciding which of its names are namespaces, and `registry.resolve` reads a text as `registry.parse` does; [module names in text](#names-and-reserved-words-module-names) sets out how a name reads.
- **Registering is not invoking.** Registering a module makes its capability understood; a host invoking one of its host calls starts what that call starts, for its caller, and ending it leaves the module registered.
- **Registering comes first.** A module is registered before a script importing it is resolved, and an import naming a module the registry does not hold is a validation error naming it, as is a member no module the script imports declares, which gives the import where a registered module declares it.

<a id="namespaces"></a>

## Namespaces

A module's namespace is how a script reaches what the module declares: in a script [importing](scripts.md#scripts-imports) the module, the local name its import gives it, a dot and the name of one of its declarations, as `Home.rooms` and `Home.device(room, "lamp")` are, and the qualifier of one of its extensions' names, as `device:Energy.Device.usage` writes it.

<a id="namespaces-module-members"></a>

### Module members

A member a module declares in its own `members`, with no type it applies to, is a **module member**, read through the namespace alone: `Home.rooms` reads the home's rooms, and `Home.now` the time. Its implementation is given no receiver. Two modules may each declare a module member of one name, since each is read through its own namespace. Reading a member through a namespace says nothing of how its value changes: `Home.now` is unobserved, and changes between evaluations.

<a id="namespaces-owners-and-extensions"></a>

### Owners and extensions

A module may declare members on any type, its own in their declarations or another module's in its [extensions](#extensions). The module that declares a type **owns** it, and a member another module declares on it is an **extension**, as `Energy`'s `device.usage` is. An unqualified member resolves by the owner of its receiver's static type, among the declarations applicable to the receiver and accessible to the script, those of Lexica's own module and of the modules the script [imports](scripts.md#scripts-imports):

- An applicable member the owner declares wins over every extension, so `device.power` reads `Home`'s, whatever `Energy` declares. A member the owner declares on a supertype it also owns takes part with the owner's priority, while one another module declares on a supertype is applicable with no priority over other extensions. An extension on a more specific receiver never defeats an applicable member of the owner.
- Otherwise the applicable extension whose target is more specific than every other applicable extension's target is selected, by the specificity [a module's own collisions](#namespaces-a-modules-own-collisions) follow. One applicable extension resolves as any member does, so `device.usage` reads `Energy`'s; and were a module `Solar` to declare `usage` in an extension on `Light`, `light.usage` reads `Solar`'s and `thermostat.usage` `Energy`'s, whatever order the two modules registered in.
- Where no applicable extension's target is more specific than every other's, the access is refused as ambiguous when the script is resolved, before anything is evaluated: two extensions targeting the same type, and applicable targets neither of which is more specific than the other. Each still registers, since refusing one would leave it unreachable where explicit access selects it. Were `Solar` to declare `usage` on `Device` instead, in an extension also named `Device`, `device.usage` is refused in a script importing both, and reads `Energy`'s in one importing `Energy` alone:

> Member 'usage' on 'Device' is ambiguous between modules 'Energy' and 'Solar'. Use 'device:Energy.Device.usage' or 'device:Solar.Device.usage' to select one.

Applicability follows the receiver's type and the access form, so one name on unrelated types is never ambiguous, and an [internal](#modules-internal-declarations) declaration is not a candidate, so an accessible extension resolves where the owner's member of its name is internal. Registration order never decides. Lexica's own module owns the language's types, `List`, `Number`, `String` and `Boolean` among them, so `rooms.count` reads Lexica's whatever an extension declares; that module has no namespace, and its name is reserved nowhere. Indexers follow the same precedence, as [indexer selection](#namespaces-indexers) sets out, and so do [operators](#modules-operators): a cast or a conversion is selected among the operators of its name and destination applicable to its receiver, the owner's winning, the extension's whose target is more specific than every other's resolving where the owner declares none, and several none of which is more specific refused as ambiguous, since no syntax selects one module's operator, extension access among them.

<a id="namespaces-qualified-access"></a>

### Qualified access

Every member a module declares on one of its own types is also reached through the module's namespace, the receiver its first argument and the member's own arguments after it: `Home.device(room, "lamp")` and `Home.active(device)`. The qualified form selects that module's declaration and reuses its implementation and its contract, and the unqualified form stays available beside it, so no module declares a second implementation to make a member addressable. An extension's member is selected explicitly through its extension instead, `device:Device.usage`, as [extension access](members.md#property-access-calls-and-indexers-extension-access) sets out, and no namespace reaches it.

In a qualified call to a receiver member, the receiver argument propagates null. If it is null, the member's implementation is not invoked and the call produces null. The result type includes null whenever the receiver argument's type includes null, so each qualified form is a receiver form selecting that module's declaration:

| Qualified form | Equivalent receiver form |
| --- | --- |
| `Home.device(room, "lamp")`, `room` not nullable | `room.device("lamp")`, selecting `Home`'s declaration |
| `Home.device(room, "lamp")`, `room` nullable | `room?.device("lamp")`, selecting `Home`'s declaration |

The rule belongs to the receiver argument alone: the member's own arguments keep their declared null policies, and a module member has no receiver argument for it to apply to. A qualified call evaluates its receiver argument first, and a null one skips the member's own arguments as `?.` does, so `Home.device(room, name)` evaluates `name` only where `room` is not null. A null receiver argument skips the member and its arguments, never what the receiver argument reads, so an evaluation still reports every read its receiver argument makes.

A module's function written through its namespace without a call is a [function reference](functions.md#functions-module-functions), which a verb or any function parameter takes, as `device.is(Home.active)` does, and which the qualified form's rules govern when it is called.

<a id="namespaces-indexers"></a>

### Indexer selection

An indexer is selected by the owner of its receiver's type, as a member is, and keeps its key, its receiver and its contract however it is selected:

- **A named indexer**, `x.name[key]`, resolves as an unqualified member does: the owner's indexer of that name wins over every extension's, the applicable extension's whose target is more specific than every other's resolves, and several none of which is more specific are refused as ambiguous when the script is resolved, the error naming the indexer, its receiver's type and the competing modules.
- **An unnamed indexer**, `x[key]`, selects the indexer declared without a name for its receiver's type: the owner's wins, the applicable extension's whose target is more specific than every other's resolves where the owner declares none, and several none of which is more specific are refused as ambiguous, as named ones are. So `device["mode"]` reads `Home`'s, whatever an extension declares, and `rooms[0]` reads `List`'s.

No qualified form reaches an indexer, and an extension's indexer is selected explicitly through its extension, `device:Device.setting["mode"]` and `device:Device["mode"]`, as [extension access](members.md#property-access-calls-and-indexers-extension-access) sets out, so one that the owner's indexer of its name outranks, or that another extension's competes with, is still reached that way.

<a id="namespaces-a-modules-own-collisions"></a>

### A module's own collisions

Within one module, an exact duplicate is refused at registration: two members of one name declared on one receiver type, two unnamed indexers for one receiver type, and two operators of one name and destination on one receiver type. Declarations whose receivers only overlap are not duplicates, and both register: `Home` may declare `active` on `Device` and on `Light`, two declarations though a light satisfies both, and so may a `List<Light>` and a `List<Device>` each take a member of one name. An access, an indexer or an operator resolves through its receiver's type: select the applicable declaration whose receiver type is more specific than every other applicable declaration's receiver type. If there is no unique such declaration, the access is ambiguous. Specificity follows the type relationships: `Light` is more specific than `Device`, `List<Light>` than `List<Device>` by list covariance, and a receiver of any type is the least specific, so a member on a type hides one of its name on a supertype, `light.active` reading `Light`'s and `device.active` of a `Device` reading `Device`'s. The receiver's static type selects, so a light held as a `Device` reads `Device`'s. Where both `List<Number>.active` and `List<String>.active` are registered, an empty list, a `List<Never>`, satisfies both receiver types, and neither is more specific than the other, so that access is ambiguous, the diagnostic naming the competing declarations; with one applicable declaration, or a uniquely most specific one, it resolves as any access does. A module member competing with a receiver's member in a qualified call is a separate rule, set out below. Members of one name on unrelated receivers never meet, since the receiver selects one, written unqualified or qualified, and a [function reference](functions.md#functions-module-functions) selects one by the callback contract it is passed to, refusing one that several take.

A module member, which has no receiver, and a member of its name on a receiver both register, and both are reached through the module's namespace: `Home.rooms` reads or references the module member, and `Home.rooms(room)` is the qualified form of the receiver's member as well as a call of the module member. Resolution and type checking decide which reading a qualified call takes, nothing being evaluated: one reading applies, and is selected; both apply, and the call is refused as ambiguous, the receiver form, `room.rooms`, reaching the receiver's member. A module member and an extension of its name never meet, since an extension's function is never reached through a namespace. Owner precedence and ambiguity between modules are set out in [owners and extensions](#namespaces-owners-and-extensions).

<a id="names-and-reserved-words-module-names"></a>
<a id="namespaces-text-and-registries"></a>

### Module names in text

A module's name decides how a text reads, so a script's [imports](scripts.md#scripts-imports) decide which of its names are namespaces, and every reader reads a text alike: `lexica.parse` and `registry.parse` give one text one definition, and registering a module never changes how a text reads.

A module's name is an identifier, conventionally written in PascalCase, `Home` and `SmartHome`, so a qualified name reads alike for a type, `Home.Device`, a module member, `Home.rooms`, and an extension, `device:Energy.Device.usage`. In a script importing the module, the local name its import gives it, its own or an [alias](scripts.md#scripts-imports), `Measures`, begins that module's namespace where it stands unprefixed in place of a value, as `Home` and `Energy` do in the examples. It is a contextual name, never a reserved word of the language: `Home.rooms` reads the module's member, `@Home` the nearest local, field, conditional binding or function parameter named `Home`, and otherwise the import binding `Home`, and `~Home` the script parameter `Home`, and a position that expects a name reads it in that role, so a member, a field, a local or a function parameter named `Home` is declared and read as any is, importing the module invalidating none of them. A module may be named by a word the language reserves, and imported under one: the bare word keeps its language meaning where a value stands, so the import binding is read with `@`, as `@if.rooms`. In a script that does not import `Home`, `Home` is an identifier, read as any name is, and resolution refuses it as a missing import where the registry holds a module of its name and no script parameter of its name is bound.

Text is written by the same names: formatting writes a namespace as the local name the script's imports give the module, `Home` or `Measures`, a local or a field named as a namespace the script's imports give as a lexical reference, `@Home`, and a script parameter named after one with `~`, `~Home`. Canonical text writes every import its definition records, so it reads back as the same definition wherever it is parsed; a caller may name the imports its destination supplies, `format(source, { imports: ['Home'] })`, which the text leaves out, and that text reads back as the same definition where it is parsed with them supplied.

Parsing reads an import and its namespace without asking a registry, so whether the module is registered is checked when the script is resolved, which refuses an import of a module the registry does not hold. A definition's namespace naming a module its imports leave out is a structure error. Parsed texts are kept by their text and the imports supplied to them.

<a id="extensions"></a>

## Extensions

An **extension** is a named group of the members and indexers a module declares on a type another module owns, as `Energy`'s `Device` adds `device.usage` to `Home`'s `Device`. A module declares each among its `types`, of `kind: 'extension'`, naming the `target` its members extend, which take that type as their receiver as a type's own members do:

```js
const energy = lexica.createModule('Energy', {
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

- **Its name.** An extension is a declaration of its module, identified by its module and its local name as a type is, so a module declares a name once among its types, and an ordinary type and an extension never share one. Its local name is conventionally in PascalCase, as a type's is, which is not enforced, and a suffix such as `Extensions` is its author's choice: `kind: 'extension'` makes a declaration an extension, and its spelling never does. Its name may declare [type parameters](types.md#types-type-parameters) its target and its members share, `ListExtensions<T>`, which the receiver binds at each access.
- **Its target.** An extension has one target, and a module declares as many extensions as it groups its members into, on one target or several. A target names a foreign type qualified, `Home.Device`, one of Lexica's own types as it is, `List<Number>`, or a parameter its extension declares, `{ name: 'VerbExtensions<T>', kind: 'extension', target: 'T' }`, which extends a receiver of any type, as Lexica's verbs are declared; a parameter is no type its module owns, so Lexica's own module declares `VerbExtensions<T>` though it owns the language's types. A target is never `Any`, since a parameter extends every type and binds the receiver's, and never nullable, since a member is read on a value and an [optional access](members.md#property-access-calls-and-indexers-required-access-and-optional-chains) skips a null receiver. An extension declares no `import`: within it, its own module's types and Lexica's resolve unqualified, a foreign type is written qualified, and it does not inherit an import of the type it extends.
- **What it is.** An extension owns its members and is addressable for [extension access](members.md#property-access-calls-and-indexers-extension-access), `device:Device.usage`. It is never a value's type: it never wraps a receiver or changes a type's identity, and its target is never its supertype.
- **What it adds.** Members alone: it changes no type's `isInstance`, stored properties, hierarchy, abstractness or `internal` flag, and no module's `typeOf`. A property it declares is computed, never stored, and it never attaches state to a receiver.

Every module may declare them, on any type another module owns, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out, so extensions that compete both register and are told apart by extension access. A type that the module itself owns takes its members in its own declaration, and a target no module declares is refused when the module is registered, so a misspelled type never becomes an extension.

<a id="extensions-different-targets"></a>

### Extensions on different targets

Extensions whose targets differ may declare members of one name, in one module or in several, each extension a declaration with its own identity:

```js
{ name: 'NumericList', kind: 'extension', target: 'List<Number>', members: [/* total */] }
{ name: 'StringList', kind: 'extension', target: 'List<String>', members: [/* total */] }
```

Ordinary lookup first takes the extensions whose targets the receiver satisfies, by the [assignability rules](types.md#types-assignability), and then applies ownership and specificity, as [owners and extensions](#namespaces-owners-and-extensions) set out: `values.total` reads `NumericList`'s for a `List<Number>`, and `StringList`'s for a `List<String>`. An empty list, a `List<Never>`, satisfies both targets through list covariance, and neither target is more specific than the other, so `values.total` is refused as ambiguous, and an [extension access](members.md#property-access-calls-and-indexers-extension-access) resolves it: `values:NumericList.total`, `values:StringList.total`, or one its module qualifies, `values:Measurements.NumericList.total`. The selected extension's target still accepts the receiver, since selecting one never bypasses type checking.
