# Modules

<a id="modules"></a>

A **module** is a named set of declarations a host registers: the types it owns with their members, the members it adds to other modules' types, its module members, type selectors and their keys, observation types and observation targets, all contributing to a script's [vocabulary](vocabulary.md). A script resolves against the declarations of every module its registry holds, and reaches a module's own names through the module's namespace, as `home.rooms` does.

A module's declarations are data, apart from the code that carries them out, so a tool reads them and checks a script against them without running anything. Here the examples' `home` module declares the type `Room`, with its member `device(name)`, and is registered with a registry of its own:

```js
const home = lexica.createModule('home', {
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
                    updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'placement', of: 'home' }] },
                    impl: ({ receiver, args }) => receiver.find(args.name),
                },
            ],
        },
        /* Device, Light, Thermostat, Sensor, Climate */
    ],
    members: [/* rooms, now */],
    typeSelectors: [{ name: 'event' }],
    selectableTypes: [/* change, motion */],
    observationTypes: [/* placement, state, climate, presence, reading */],
    observationTargets: [{ name: 'home' }],
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

A module is made by `createModule` from its name and its declarations, `{ typeOf, types, extensions, members, typeSelectors, selectableTypes, observationTypes, observationTargets }`, its name the module's and its namespace's. Its declarations are validated when it is created and checked against the registry when it is registered with `registerModule`; a declaration that breaks a contract is a module error, raised when the module is created or when it is registered, naming the module, the declaration and the field, and the type a nested declaration stands in.

Lexica's own module is one Lexica creates itself, the one module every registry holds, which owns the language's types and has no namespace. Every other module, a host's among them, is made with `createModule`, and no factory, name or flag makes one an exception to the rules.

A declaration that runs code carries it as its `impl`: a property, a function, an indexer, an operator and an observation type. Two integration hooks run code too, each named for what it answers: a module's `typeOf` and a reference type's `isInstance`, which Lexica calls and no script names. Every other key is data, and two declarations sharing code refer to one JavaScript function, as DOMQL's `on` is one declaration in each of its three receiver types.

A module is given the capability it exposes, never an instance of it, since instances belong to the callers that start them. A module exposes a capability through Lexica without the capability depending on Lexica: the capability keeps an API of its own, and its module lives beside it or in an integration package for it.

<a id="modules-what-a-module-declares"></a>

## What a module declares

A module declares types of its own, reference and structured, each holding its members: its fields, properties, functions and indexers, for the evaluator or the host to invoke, Boolean functions among them, and its operators. It adds members to types other modules own in its extensions, declares module members with no receiver, and declares type selectors and their keys, observation types and observation targets. It follows these contracts throughout: every member declares its signature, its argument kinds and its result type, every member the evaluator invokes declares how it changes, and evaluating a script stays read-only and synchronous.

| Declaration | What it is | Specified in |
| --- | --- | --- |
| Reference type | A type whose values have identity: its name, at most one supertype, its `isInstance`, whether it is abstract, and its members | [Reference types](types.md#reference-types), [declaring a type](#modules-declaring-a-type) |
| Structured type | A type of data: its name, its stored shape in its fields, and its other members | [Declaring a type](#modules-declaring-a-type) |
| `typeOf` | The module's recognition of a host's value, naming the most specific of its reference types the value is of, or null | [Reference types](types.md#reference-types) |
| Member | A field, a property, a function, an indexer or an operator of a type, or a property or a function of no type | [Members](members.md), [operators](#modules-operators) |
| Extension | The members a module adds to a type another module owns | [Extensions](#extensions) |
| Type selector, selectable type | A mapping from keys to types that a fixed argument selects through, and each key with its type | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Observation type, observation target | What a member names to learn that its result may have changed, and what it may observe | [Observations](vocabulary.md#observations) |

A module declares members on any type, its own in its `types` and another module's in its `extensions`, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out. Any type or member may be [internal](#modules-internal-declarations), available within its module alone.

<a id="modules-declaring-a-type"></a>

## Declaring a type

A module declares each type it owns in its `types`, its `kind` saying which family it is of, and the type's members within it, in its `members`. A member there takes the type as its receiver and names no target, and the order of a module's types is not significant, so one type names another declared after it.

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
        { name: 'temperature', kind: 'field', result: 'Number' },
        { name: 'humidity', kind: 'field', result: 'Number' },
    ],
}
```

- **A reference type** is `kind: 'reference'`. It declares its `isInstance`, may name a `supertype` and be `abstract`, and holds its members, as [reference types](types.md#reference-types) set out.
- **A structured type** is `kind: 'structured'`, a type of immutable data. Its stored shape is its fields, members of `kind: 'field'`, each naming the type of its value in `result` and taking no `impl`; Lexica reads the field of each name from the data, and validates, copies and freezes a structured value by them. A field is read as a property is, `room.climate?.temperature`, and its other members compute what they answer through their `impl`. A field and another member of its name collide.
- **A type's name** is unique across the registry and written in PascalCase, as [type names](types.md#types-type-names) set out.

Lexica's own `List` is the one generic type: it declares `typeParameters: ['T']`, the type of its items, which its members' declarations write, as [type parameters](types.md#types-type-parameters) set out.

<a id="modules-operators"></a>

## Operators

A type's members may hold **operators**, `kind: 'operator'`, which the language's own syntax invokes and nothing else: `name: 'cast'`, which `as` invokes, and `name: 'convert'`, which `to` invokes, each naming its destination type in `result`.

```js
{ kind: 'operator', name: 'cast', result: 'Element' }
{ kind: 'operator', name: 'convert', result: 'Temperature', impl: ({ value }) => ({ value, unit: 'C' }) }
```

- **Only through their syntax.** An operator is no member a script calls: `value.convert(…)`, a qualified form such as `measurements.convert(value)`, and a function reference reach none, and a function a module declares named `convert` is an ordinary member of its own. Operators and ordinary members are looked up apart, so a `cast` beside a property of that name is no collision.
- **Selected by their destination.** An operator is selected by its receiver's type, its name and its result together, so a type declares several of each, one for each destination type, and two for one destination collide.
- **A cast operator** is declared on a reference type, and its result is another reference type, outside its hierarchy: it permits that one directed cast, and its `impl` is optional, as [casts](types.md#casts-what-it-narrows) set out.
- **A conversion operator** is declared on a type of data, and its result is another type of data: `Number`, `String`, `Boolean` or a structured type holding data alone. Its `impl` reads `{ value, reject }` and answers the converted value, as [conversions](vocabulary.md#vocabulary-conversions) set out. A module declares a conversion whose source or destination is one of its own types, a rule Lexica's own module alone is exempt from, for the conversions between the language's types, and declares one on a type it does not own in an extension, as `measurements` declares one from `Number` to its `Temperature`.

<a id="modules-internal-declarations"></a>

## Internal declarations

A type or a member declares `internal: true` to be available within its declaring module alone. `internal` is a Boolean, `false` where left out, and any other value, a string among them, is refused when the module is created. The declaring module of a member is the one whose `types`, `extensions` or `members` hold it, so an internal extension member belongs to the module that declares the extension, never to the owner of the type it extends.

- **Its type bounds it.** A member of an internal type is internal however its own flag is written, and `internal: false` on it widens nothing, as a member's accessibility is bounded by its containing type in .NET. A public type holds public and internal members alike, and stays usable and extensible by every module: another module extends `Reading`, and cannot use `Reading.source` where that field is internal.
- **At registration.** A declaration of another module that names an internal type, as a supertype, an extension's type, or a parameter's, a field's or a result's type, and one that names an internal member explicitly, is refused. A public declaration exposes public types alone: every type its signature writes, its parameters', its callbacks' arguments' and results', its result's and, for a public field, its value's, through list items and nullable types, is public, and one that is not is refused. Declarations within one module name each other's internal declarations freely.

  | Declaration | At registration |
  | --- | --- |
  | A public member returning the internal `ReadingState` | Refused |
  | A public member taking a `List<ReadingState>` | Refused |
  | An internal member using its module's `ReadingState` | Registered |
  | The public `Reading` holding an internal field of type `ReadingState` | Registered |

- **At resolution.** A script reaches no internal declaration through any form: a member read or called, a field read by name or by bracket property access, a qualified form, a function reference, an indexer, and a cast or a conversion naming an internal type or selecting an internal operator. An internal declaration is no candidate where [owner precedence](#namespaces-owners-and-extensions) chooses, so an accessible extension resolves where the owner's member of its name is internal.
- **In tooling.** Completion and every listing a script's author reads leave internal declarations out.

`internal` decides what scripts and other modules' declarations name, and nothing else: an implementation is JavaScript, and works with its values and its helpers as it always does, and a value a result holds keeps what it holds, an internal field among them, since what a script can name and what its host receives are separate.

<a id="modules-valid-combinations"></a>

## Valid declarations

One shape serves every declaration, and each kind accepts the fields it needs alone: a field a declaration's kind does not take is refused when the module is created, with a module error whose location names the module, the type a nested declaration stands in, the declaration and the field. A field holding `undefined` counts as left out.

`name` is common to every declaration but an extension, which names the `type` it extends; an operator's names its operation, `cast` or `convert`. A type, a member, a type selector, an observation type and an observation target are named by an [identifier](lexical-structure.md#names-and-reserved-words), as a script writes them, and any other is a module error when the module is created, so a member cannot be named `focus-within`, and is named `focusWithin`; a selectable type is named by its key, which a fixed argument gives as a string. A member's fields, by its kind, are set out in [declaring a member](members.md#members-declaring-a-member); every other declaration takes these:

| Declaration | Takes | Refuses |
| --- | --- | --- |
| Reference type | `kind: 'reference'` and `isInstance`, both required; `supertype`, `abstract`, `members`, `internal` | Any other field, `impl` among them |
| Structured type | `kind: 'structured'`; `members`, of which its fields are its stored shape, and `internal` | Any other field, a `fields` collection, `isInstance`, `supertype` and `impl` among them |
| Extension | `type`, required, the type its members extend; `typeParameters`, for an extension on any type; `members` | Any other field, `name` among them |
| Type selector | Its name alone | Any other field, `impl` among them |
| Selectable type | `selector` and `type`, both required, its name being its key | Any other field, `impl` among them |
| Observation type | `contract`, `identity`, `shared`; `impl` | Any other field |
| Observation target | `from`, which is `receiver` where given; `count`, which is `many` where given | Any other field, `impl` among them, and the name `receiver` |

`typeOf` and `isInstance` are functions, checked as functions when the module is created and never called until a value needs them. A reference type declares its `isInstance` whether or not its module's `typeOf` ever names it, since a member's answer, a cast and a declared binding check membership by it.

<a id="modules-declarations-without-an-implementation"></a>

### Declarations without an implementation

A declaration without an `impl` is resolved against as any other, so a tool reads and checks every script that uses it. It is never invoked: creating an evaluator for a resolution any of whose used declarations the evaluator invokes, or any of the conversion operators it uses, has no `impl` is refused, with a module error naming the declaration and its module. A field takes none, since Lexica reads it from the data, and a cast operator needs none, as [operators](#modules-operators) set out. The used declarations include those an unreached branch uses, so whether a script can be evaluated is decided before anything is evaluated, whatever branch its evaluation takes, and a script of a module only some of whose declarations are implemented is evaluated where it uses those alone.

<a id="modules-registries"></a>

## Registries

A **registry** holds the modules a host resolves and evaluates against. `lexica.createRegistry(modules)` creates one holding Lexica's own module and the modules given; no registry is shared, so two hosts never see each other's modules.

- **The registry holds definitions.** A registry holds the declarations of every module registered with it, shared by all the host's callers. What a host's callers start through host calls, and the state it keeps, is scoped to those callers, never to the registry.
- **Registering checks the module whole.** `registerModule` indexes every type the module declares, then checks every declaration against them and the registry before it registers any, so a module refused leaves nothing of itself registered and advances no revision. A module's name is registered once, and no module is named by a word the language reserves. Types, type selectors and observation types are each named once across every module, Lexica's own included, a selectable type once in its selector, and a name already declared is refused; a type's name begins with a capital letter. A type a declaration names is one the module declares or a module registered before it declares; a supertype is a reference type, and no hierarchy is a cycle; a declaration names no other module's [internal](#modules-internal-declarations) declaration, and a public one exposes no internal type.
- **Its revision.** A registry answers a revision that changes whenever its vocabulary does, so a host that keeps resolutions knows when to resolve again.
- **It reads and writes its own text.** `registry.parse(text)`, `registry.format(source)` and `registry.quote(source)` read and write text with the registry's module names, as `lexica.parse`, `lexica.format` and `lexica.quote` do without any, and `registry.resolve` reads a text as `registry.parse` does; [module names in text](#names-and-reserved-words-module-names) sets out how a name reads.
- **Registering is not invoking.** Registering a module makes its capability understood; a host invoking one of its host calls starts what that call starts, for its caller, and ending it leaves the module registered.
- **Registering comes first.** A module is registered before a script naming it is resolved, and a member no registered module declares is a validation error naming it.

<a id="namespaces"></a>

## Namespaces

A module's namespace is how a script reaches what the module declares: in text read through a registry, the module's name, a dot and the name of one of its declarations, as `home.rooms` and `energy.usage(device)` are.

<a id="namespaces-module-members"></a>

### Module members

A member a module declares in its own `members`, with no type it applies to, is a **module member**, read through the namespace alone: `home.rooms` reads the home's rooms, and `home.now` the time. Its implementation is given no receiver. Two modules may each declare a module member of one name, since each is read through its own namespace. Reading a member through a namespace says nothing of how its value changes: `home.now` is unobserved, and changes between evaluations.

<a id="namespaces-owners-and-extensions"></a>

### Owners and extensions

A module may declare members on any type, its own in its `types` or another module's in its `extensions`. The module that declares a type **owns** it, and a member another module declares on it is an **extension**, as `energy`'s `device.usage` is. An unqualified member resolves by the owner of its receiver's static type, among the declarations applicable to the receiver and accessible to the script:

- An applicable member the owner declares wins over every extension, so `device.power` reads `home`'s, whatever `energy` declares. A member the owner declares on a supertype it also owns takes part with the owner's priority, while one another module declares on a supertype is applicable with no priority over other extensions. An extension on a more specific receiver never defeats an applicable member of the owner.
- Otherwise one applicable extension resolves as any member does, so `device.usage` reads `energy`'s.
- Several applicable extensions are refused as ambiguous when the script is resolved, before anything is evaluated, and both still register, since refusing one would leave its qualified form unusable. Were a module `solar` to declare `usage` on `Device` too, `device.usage` is refused:

> Member 'usage' on 'Device' is ambiguous between modules 'energy' and 'solar'. Use 'energy.usage(device)' or 'solar.usage(device)' to select one.

Applicability follows the receiver's type and the access form, so one name on unrelated types is never ambiguous, and an [internal](#modules-internal-declarations) declaration is no candidate, so an accessible extension resolves where the owner's member of its name is internal. Registration order never decides. Lexica's own module owns the language's types, `List`, `Number`, `String` and `Boolean` among them, so `rooms.count` reads Lexica's whatever an extension declares; that module has no namespace, and its name is reserved nowhere. Indexers follow the same precedence, as [indexer selection](#namespaces-indexers) sets out, and so do [operators](#modules-operators): a cast or a conversion is selected among the operators of its name and destination applicable to its receiver, the owner's winning, one extension's resolving where the owner declares none, and several refused as ambiguous, since no syntax selects one module's operator.

<a id="namespaces-qualified-access"></a>

### Qualified access

Every member a module declares on a type is also reached through the module's namespace, the receiver its first argument and the member's own arguments after it: `energy.usage(device)`, `energy.power(device)` and `home.device(room, "lamp")`. The qualified form selects that module's declaration and reuses its implementation and its contract, and the unqualified form stays available beside it, so no module declares a second implementation to make an extension addressable.

In a qualified call to a receiver member, the receiver argument propagates null. If it is null, the member's implementation is not invoked and the call produces null. The result type includes null whenever the receiver argument's type includes null, so each qualified form is a receiver form selecting that module's declaration:

| Qualified form | Equivalent receiver form |
| --- | --- |
| `energy.usage(device)`, `device` not nullable | `device.usage`, selecting `energy`'s declaration |
| `energy.usage(device)`, `device` nullable | `device?.usage`, selecting `energy`'s declaration |

The rule belongs to the receiver argument alone: the member's own arguments keep their declared null policies, and a module member has no receiver argument for it to apply to. A qualified call evaluates its receiver argument first, and a null one skips the member's own arguments as `?.` does, so `home.device(room, name)` evaluates `name` only where `room` is not null. A null receiver argument skips the member and its arguments, never what the receiver argument reads, so an evaluation still reports every read its receiver argument makes.

A module's function written through its namespace without a call is a [function reference](functions.md#functions-module-functions), which a verb or any function parameter takes, as `device.is(home.active)` does, and which the qualified form's rules govern when it is called.

<a id="namespaces-indexers"></a>

### Indexer selection

An indexer is selected by the owner of its receiver's type, as a member is, and keeps its key, its receiver and its contract however it is selected:

- **A named indexer**, `x:name[key]`, resolves as an unqualified member does: the owner's indexer of that name, of `kind: 'indexer'` or `kind: 'default-indexer'`, wins over every extension's, one applicable extension's indexer resolves, and several are refused as ambiguous when the script is resolved, the error naming the indexer, its receiver's type and the competing modules.
- **A default indexer**, `x:[key]`, selects the indexer declared `kind: 'default-indexer'` for its receiver's type, which keeps its name, so `x:name[key]` reads it too: the owner's wins, one extension's resolves where the owner declares none, and several are refused as ambiguous, as named ones are. So `device:["mode"]` reads `home`'s `setting`, whatever an extension declares.

Version 32 has no qualified form of an indexer, and selecting an extension's indexer explicitly is deferred beyond it. An extension's indexer is reached only where unqualified selection gives it: one that the owner's indexer of its name outranks is never reached, and one that another extension's competes with is refused as ambiguous wherever it is written.

<a id="namespaces-a-modules-own-collisions"></a>

### A module's own collisions

Within one module, members of one name collide where their receivers overlap, a type and its supertype among them, and a module declaring them is refused at registration: were `home` to declare `active` on `Light` beside the one on `Device`, a light would have two, and `home` would be refused. A field and another member of its name collide too, and so do two default indexers whose receivers overlap, whatever their names, and two operators of one name and destination whose receivers overlap. Members of one name on unrelated receivers do not collide, since the receiver selects one, written unqualified or qualified, and a [function reference](functions.md#functions-module-functions) selects one by the callback contract it is passed to, refusing one that several take.

A module member, which has no receiver, reserves its name in the module's namespace: a member of that name on a receiver is refused beside it, since `home.rooms` would read the one and call or reference the other. Owner precedence and ambiguity between modules are set out in [owners and extensions](#namespaces-owners-and-extensions).

<a id="names-and-reserved-words-module-names"></a>
<a id="namespaces-text-and-registries"></a>

### Module names in text

A module's name decides how a text reads, so a registry reads and writes text with its own module names, and `lexica.parse` and `lexica.format`, which read text without a registry, know the language's names alone.

A module's name is an identifier, and in text read through a registry, the name of every module registered with it begins that module's namespace where it stands unprefixed in place of a value, as `home` and `energy` do in the examples. It is a contextual name, no reserved word of the language: `home.rooms` reads the module's member, `@home` the nearest local, field, conditional binding or function parameter named `home`, and `~home` the script parameter `home`, and a position that expects a name reads it in that role, so a member, a field, a local or a function parameter named `home` is declared and read as any is, registering the module invalidating none of them. No module is named by a word the language reserves. Text read without a registry knows no module's name, so `home` is an identifier there, read as any name is.

A registry writes text by the same names: `registry.format` writes a namespace as the module's name, `home`, a local or a field named after a module as a lexical reference, `@home`, and a script parameter named after one with `~`, `~home`. Canonical text reads back as the same definition when parsed with the same set of module names used to format it: text a registry writes, read by a registry holding the same module names, and text `lexica.format` writes, read by `lexica.parse`.

Nothing reads a text otherwise unannounced: a registry refuses a definition read without its module names that names one of them, saying to read the text with the registry; a namespace naming no module the registry holds is refused as one it lacks; `lexica.format` and `lexica.quote` refuse a definition holding a namespace, which text read without module names cannot write, saying to write it with a registry; and registering a module whose name a definition read earlier uses refuses that definition as one read without the registry's module names, never reading it again silently. Parsed texts are kept by their text and the module names they were read with.

<a id="extensions"></a>

## Extensions

An **extension** is a module's member or indexer declared on a type another module owns, as `energy`'s `device.usage` is. A module declares its extensions in its `extensions`, each block naming the `type` its members extend, which take that type as their receiver as a type's own members do:

```js
const energy = lexica.createModule('energy', {
    extensions: [
        {
            type: 'Device',
            members: [/* usage, power */],
        },
    ],
});
```

Every module may declare them, on any type another module owns, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out, so extensions that compete both register and are told apart by their qualified forms. A type that the module itself owns takes its members in its own declaration, and a type no module declares is refused when the module is registered, so a misspelled type never becomes an extension. An extension adds members alone: it changes no type's `isInstance`, fields, hierarchy, abstractness or `internal` flag, and no module's `typeOf`.

An extension on any type declares its type parameter, `{ type: 'T', typeParameters: ['T'], members }`, as Lexica's verbs are declared, so each of its members takes a receiver of any type and binds `T` to it.
