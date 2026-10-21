# Modules

<a id="modules"></a>

A **module** is a named set of declarations a host registers: the types, members, predicates, type selectors and their keys, observation types, observation targets and conversions it contributes to a script's [vocabulary](vocabulary.md). A script resolves against the declarations of every module its registry holds, and reaches a module's own names through the module's namespace, as `home.rooms` does.

A module's declarations are data, apart from the implementations that carry them out, so a tool reads them and checks a script against them without running anything. Here the examples' `home` module declares `room.device(name)` and is registered with a registry of its own:

```js
const home = lexica.createModule('home', {
    types: [/* room, device, light, thermostat, sensor, climate */],
    members: [
        {
            name: 'device',
            target: 'room',
            kind: 'function',
            syntax: 'function-call',
            arguments: 'positional',
            result: 'device?',
            parameters: [{ name: 'name', kind: 'value', type: 'string', required: true, fixed: false, nulls: 'propagate' }],
            updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'placement', of: 'home' }] },
            implementation: ({ receiver, args }) => receiver.find(args.name),
        },
    ],
    predicates: [/* occupied, active, offline, battery, dimming */],
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
3. [Valid declarations](#modules-valid-combinations)
4. [Registries](#modules-registries)
5. [Namespaces](#namespaces)
6. [Extensions](#extensions)

<a id="modules-declarations"></a>

## Creating a module

A module is made by `createModule` from its name and its declarations, `{ name, types, members, predicates, typeSelectors, selectableTypes, observationTypes, observationTargets, conversions }`, its `name` the module's and its namespace's. Its declarations are validated when it is created and checked against the registry when it is registered with `registerModule`; a declaration that breaks a contract is a module error, raised when the module is created or when it is registered, naming the module, the declaration and the field.

Lexica's own module is one Lexica creates itself, the one module every registry holds, which owns the language's types and has no namespace. Every other module, a host's among them, is made with `createModule`, and no factory, name or flag makes one an exception to the rules.

Each declaration that runs code carries it as its `implementation`: members, predicates, observation types and conversions. A member's name is written once, and two members sharing code refer to one JavaScript function. Every key but `implementation` is data.

A module is given the capability it exposes, never an instance of it, since instances belong to the callers that start them. A module exposes a capability through Lexica without the capability depending on Lexica: the capability keeps an API of its own, and its module lives beside it or in an integration package for it.

<a id="modules-what-a-module-declares"></a>

## What a module declares

A module can declare types of its own, reference and structured, properties, functions written as function calls or as named indexers, for the evaluator or the host to invoke, predicates, type selectors and their keys, observation types, observation targets, and conversions to and from its own types, one for each source type and target. It follows these contracts throughout: every member declares its signature, its argument kinds and its result type, every member the evaluator invokes declares how it changes, and evaluating a script stays read-only and synchronous.

| Declaration | What it is | Specified in |
| --- | --- | --- |
| Reference type | A type whose values have identity: its name, at most one supertype, the test a value of it passes and whether it is abstract | [Reference types](types.md#reference-types) |
| Structured type | A type of data: its name and the types of its fields | [Type families](types.md#types-type-families) |
| Member | A property or a function, for the evaluator or the host to invoke, of a type or of no type | [Members](members.md) |
| Predicate | A Boolean question of a receiver, asked with its verb | [Predicates](vocabulary.md#predicates) |
| Type selector, selectable type | A mapping from keys to types that a fixed argument selects through, and each key with its type | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Observation type, observation target | What a member names to learn that its result may have changed, and what it may observe | [Observations](vocabulary.md#observations) |
| Conversion | How a value of one type of data converts to another | [Conversions](vocabulary.md#vocabulary-conversions) |

A module declares members and predicates of any name on any type, its own or another module's, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out. It declares conversions to or from its own types alone, a rule Lexica's own module alone is exempt from, for the conversions between the language's types.

<a id="modules-valid-combinations"></a>

## Valid declarations

One shape serves every declaration, and each kind accepts the fields it needs alone: a field a declaration's kind does not take is refused when the module is created, with a module error whose location names the module, the declaration and the field. A field holding `undefined` counts as left out.

`name` is common to every declaration. `implementation` is taken by the declarations that run code, members, predicates, observation types and conversions, and is optional there; a structured type, a type selector, a selectable type and an observation target run nothing, and refuse it. A member's fields, by its kind, are set out in [declaring a member](members.md#members-declaring-a-member); every other declaration takes these:

| Declaration | Takes | Refuses |
| --- | --- | --- |
| Predicate | `target`, required; `verb`, `is` where it names none; `updates`, as a member's; `implementation` | `kind`, `syntax`, `arguments`, `parameters`, `result` |
| Structured type | `fields` | Any other field, `implementation` among them |
| Type selector | Its name alone | Any other field, `implementation` among them |
| Selectable type | `selector` and `type`, both required, its name being its key | Any other field, `implementation` among them |
| Observation type | `contract`, `identity`, `shared`; `implementation` | Any other field |
| Observation target | `from`, which is `receiver` where given; `count`, which is `many` where given | Any other field, `implementation` among them, and the name `receiver` |
| Conversion | `from`, `to`; `implementation` | Any other field |

<a id="modules-declarations-without-an-implementation"></a>

### Declarations without an implementation

A declaration without an implementation is resolved against as any other, so a tool reads and checks every script that uses it. It is never invoked: creating an evaluator for a resolution any of whose used declarations the evaluator invokes, or any of the conversions it uses, has no implementation is refused, with a module error naming the declaration and its module. The used declarations include those an unreached branch uses, so whether a script can be evaluated is decided before anything is evaluated, whatever branch its evaluation takes, and a script of a module only some of whose declarations are implemented is evaluated where it uses those alone.

<a id="modules-registries"></a>

## Registries

A **registry** holds the modules a host resolves and evaluates against. `lexica.createRegistry(modules)` creates one holding Lexica's own module and the modules given; no registry is shared, so two hosts never see each other's modules.

- **The registry holds definitions.** A registry holds the declarations of every module registered with it, shared by all the host's callers. What a host's callers start through host calls, and the state it keeps, is scoped to those callers, never to the registry.
- **Registering checks the module whole.** `registerModule` checks every declaration against the registry before it registers any, so a module refused leaves nothing of itself registered; a module's name is registered once, and no module is named by a word the language reserves. Types, type selectors and observation types are each named once across every module, Lexica's own included, a selectable type once in its selector, and a name already declared is refused.
- **Its revision.** A registry answers a revision that changes whenever its vocabulary does, so a host that keeps resolutions knows when to resolve again.
- **It reads its own text.** A registry reads and writes text with its own module names, as [module names in text](#names-and-reserved-words-module-names) sets out.
- **Registering is not invoking.** Registering a module makes its capability understood; a host invoking one of its host calls starts what that call starts, for its caller, and ending it leaves the module registered.
- **Registering comes first.** A module is registered before a script naming it is resolved, and a member no registered module declares is a validation error naming it.

<a id="namespaces"></a>

## Namespaces

A module's namespace is how a script reaches what the module declares: in text read through a registry, the module's name, a dot and the name of one of its declarations, as `home.rooms` and `energy.usage(device)` are.

<a id="namespaces-module-members"></a>

### Module members

A member a module declares with no type it applies to is a **module member**, read through the namespace alone: `home.rooms` reads the home's rooms, and `home.now` the time. Its implementation is given no receiver. Two modules may each declare a module member of one name, since each is read through its own namespace. Reading a member through a namespace says nothing of how its value changes: `home.now` is unobserved, and changes between evaluations.

<a id="namespaces-owners-and-extensions"></a>

### Owners and extensions

A module may declare members on any type, its own or another module's. The module that declares a type **owns** it, and a member another module declares on it is an **extension**, as `energy`'s `device.usage` is. An unqualified member resolves by the owner of its receiver's type:

- An applicable member the owner declares wins over every extension, so `device.power` reads `home`'s, whatever `energy` declares.
- Otherwise one applicable extension resolves as any member does, so `device.usage` reads `energy`'s.
- Several applicable extensions are refused as ambiguous when the script is resolved, before anything is evaluated, and both still register, since refusing one would leave its qualified form unusable. Were a module `solar` to declare `usage` on `device` too, `device.usage` is refused:

> Member 'usage' on 'device' is ambiguous between modules 'energy' and 'solar'. Use 'energy.usage(device)' or 'solar.usage(device)' to select one.

Applicability follows the receiver's type and the access form, so one name on unrelated types is never ambiguous. Lexica's own module owns the language's types, `list`, `number`, `string` and `boolean` among them, so `rooms.count` reads Lexica's whatever an extension declares; that module has no namespace, and its name is reserved nowhere. Predicates follow the same precedence, so `device.is("active")` reads `home`'s, and indexers follow it as [indexer selection](#namespaces-indexers) sets out.

<a id="namespaces-qualified-access"></a>

### Qualified access

Every member a module declares on a type is also reached through the module's namespace, the receiver its first argument and the member's own arguments after it: `energy.usage(device)`, `energy.power(device)` and `home.device(room, "lamp")`. The qualified form selects that module's declaration and reuses its implementation and its contract, and the unqualified form stays available beside it, so no module declares a second implementation to make an extension addressable.

In a qualified call to a receiver member, the receiver argument propagates null. If it is null, the member's implementation is not invoked and the call produces null. The result type includes null whenever the receiver argument's type includes null, so each qualified form is a receiver form selecting that module's declaration:

| Qualified form | Equivalent receiver form |
| --- | --- |
| `energy.usage(device)`, `device` not nullable | `device.usage`, selecting `energy`'s declaration |
| `energy.usage(device)`, `device` nullable | `device?.usage`, selecting `energy`'s declaration |

The rule belongs to the receiver argument alone: the member's own arguments keep their declared null policies, and a module member has no receiver argument for it to apply to. A null receiver argument skips the member, never what the argument reads, so an evaluation still reports every read its receiver argument makes.

A predicate is called through its module directly, the receiver first and no verb, as `home.active(device)` and `home.occupied(room)` are, selecting that predicate; the verb belongs to unqualified access alone. Its receiver argument propagates null as a member's does, so a null receiver produces null, never false.

<a id="namespaces-indexers"></a>

### Indexer selection

An indexer is selected by the owner of its receiver's type, as a member is, and keeps its key, its receiver and its contract however it is selected:

- **A named indexer**, `x:name[key]`, resolves as an unqualified member does: the owner's indexer of that name wins over every extension's, one applicable extension's indexer resolves, and several are refused as ambiguous when the script is resolved, the error naming the indexer, its receiver's type and the competing modules.
- **A default indexer**, `x:[key]`, selects the named indexer designated as the default for its receiver's type: the owner's designated indexer wins, one extension's resolves where the owner designates none, and several are refused as ambiguous, as named ones are. So `device:["mode"]` reads `home`'s `setting`, whatever an extension declares.

Version 32 has no qualified form of an indexer, and selecting an extension's indexer explicitly is deferred beyond it. An extension's indexer is reached only where unqualified selection gives it: one that the owner's indexer of its name outranks is never reached, and one that another extension's competes with is refused as ambiguous wherever it is written.

<a id="namespaces-a-modules-own-collisions"></a>

### A module's own collisions

Within one module, a name declared twice for overlapping receivers, a type and its supertype among them, is refused at registration. A module's members, the qualified forms of the members it declares on types, and its predicates' qualified forms all take part in its collision checks, so a module whose own declarations would make one of its qualified forms ambiguous is refused when it is registered. Were `home` to declare a predicate `on`, its qualified form `home.on(device)` would collide with the event source's, `home.on(device, "change")`, and `home` would be refused.

<a id="names-and-reserved-words-module-names"></a>
<a id="namespaces-text-and-registries"></a>

### Module names in text

A module's name decides how a text reads, so a registry reads and writes text with its own module names, and `lexica.parse` and `lexica.format`, which read text without a registry, know the language's names alone.

In text read through a registry, the name of every module registered with it is reserved, as `home` and `energy` are in the examples, and its members' names are reserved nowhere: `home.rooms` reads the module's member, `@home` the nearest local or field named `home`, and `~home` the script parameter `home`. No module is named by a word the language reserves. Text read without a registry knows no module's name, so `home` is an identifier there, read as any name is.

Nothing reads a text otherwise unannounced: a registry refuses a definition read without its module names that names one of them, saying to read the text with the registry; a namespace naming no module the registry holds is refused as one it lacks; and registering a module whose name a definition read earlier uses refuses that definition as one read without the registry's module names, never reading it again silently. Parsed texts are kept by their text and the module names they were read with.

<a id="extensions"></a>

## Extensions

An **extension** is a module's member, predicate or indexer declared on a type another module owns, as `energy`'s `device.usage` is. Every module may declare them, on its own types and on any other's, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out, so extensions that compete both register and are told apart by their qualified forms. A target the module's own types declare is its own, a target another module declares makes the member an extension, and a target no module declares is refused when the module is registered, so a misspelled type never becomes an extension.
