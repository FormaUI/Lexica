# Modules

<a id="modules"></a>

A **module** is a named set of declarations a host registers: the types it owns with their members, the members it adds to other modules' types, its module members, type selectors and their keys, observation types and observation targets, all contributing to a script's [vocabulary](../language/vocabulary.md). A script resolves against the declarations of every module its registry holds, and reaches a module's own names through the module's namespace, as `Home.rooms` does, which [modules](../language/modules.md) set out in the language contract.

A module's declarations are data, apart from the code that carries them out, so a tool reads them and checks a script against them without running anything. Here the examples' `Home` module declares the type `Room`, with its member `device(name)`, and is registered with a registry of its own:

```js
const home = nexo.createModule('Home', {
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
const registry = nexo.createRegistry([home]);
```

In this document:

1. [Creating a module](#modules-declarations)
2. [What a module declares](#modules-what-a-module-declares)
3. [Declaring a type](#modules-declaring-a-type)
4. [Reference types](#runtime-reference-types)
5. [Operators](#modules-operators)
6. [Conversion operators](#vocabulary-conversions)
7. [Internal declarations](#modules-internal-declarations)
8. [Valid declarations](#modules-valid-combinations)
9. [Duplicates](#runtime-duplicates)
10. [Registries](#modules-registries)

<a id="modules-declarations"></a>

## Creating a module

A module is made by `createModule` from its name and its declarations, `{ typeOf, types, members, typeSelectors, mappings, observationTypes, observationTargets }`, its name the module's and its namespace's. Its declarations are validated when it is created and checked against the registry when it is registered with `registerModule`; a declaration that breaks a contract is a module error, raised when the module is created or when it is registered, naming the module, the declaration and the declaration key, and the type a nested declaration stands in.

`nexo.createModule(name, contents)` answers the module, whose read-only properties are its `name` and its declarations as it validated them: `typeOf`, undefined where it declares none, and `types`, `members`, `typeSelectors`, `mappings`, `observationTypes` and `observationTargets`, each a list, empty where it declares none. Each list and each declaration in it is a frozen copy of what was given, its data copied and each function in it, an `impl` or a hook, kept as the function given, so changing what a host gave changes nothing registered. A copy writes what its contract leaves implicit: a type or a member whose name declares [type parameters](../language/types.md#types-type-parameters) is named by its local name, with `typeParameters` beside it; a member leaves out each key that held `undefined`, and holds `parameters`, empty where it takes none, and its `updates` hold `observations`, empty where it names none; and an observation type holds `identity`, empty, and `shared`, `true`, where it declares neither. A declaration is identified by its copy, which a resolution's used declarations and a [registry](#modules-registries)'s queries give and take, never by the object a host gave. A registry registers a module `createModule` made, and refuses anything else (NEXO4546).

Nexo's own module is one Nexo creates itself, the one module every registry holds, which owns the language's types and has no namespace. It declares the language's value types through a declaration form internal to Nexo, so it declares `List<T>`, a generic type holding the members of lists, where a module's reference and structured types declare no [type parameters](../language/types.md#types-type-parameters). Every other module, a host's among them, is made with `createModule` and keeps every restriction its declarations carry, and no factory, name or flag makes one an exception to the rules.

A declaration that runs code carries it as its `impl`: a property, a function, an indexer, an operator and an observation type. Two integration hooks run code too, each named for what it answers: a module's `typeOf` and a reference type's `isInstance`, which Nexo calls and no script names. Every other key is data, and two declarations sharing code refer to one JavaScript function, as one member a module gives several of its types is.

A module is given the capability it exposes, never an instance of it, since instances belong to the callers that start them. A module exposes a capability through Nexo without the capability depending on Nexo: the capability keeps an API of its own, and its module lives beside it or in an integration package for it.

<a id="modules-what-a-module-declares"></a>

## What a module declares

A module declares types of its own, reference and structured, each holding its members: its properties, a structured type's data among them, functions and indexers, for the evaluator or the host to invoke, Boolean functions among them, and its operators. It adds members to types other modules own in its [extensions](../language/extensions.md#extensions), declared among its `types`, declares module members with no receiver, and declares type selectors and their keys, observation types and observation targets. It follows these contracts throughout: every member declares its signature, its argument kinds and its result type, every member the evaluator invokes declares how it changes, aside from the properties a structured type declares directly without `updates`, which are its data, and operators, whose answer depends on their operand alone, and evaluating a script stays read-only and synchronous.

| Declaration | What it is | Specified in |
| --- | --- | --- |
| Reference type | A type whose values have identity: its name, at most one supertype, its `isInstance`, whether it is abstract, and its members | [Reference types](../language/types.md#reference-types), [declaring a type](#modules-declaring-a-type) |
| Structured type | A type of data: its name, its data shape in the properties it declares directly without `updates`, and its other members | [Declaring a type](#modules-declaring-a-type) |
| `typeOf` | The module's recognition of a host's value, naming the most specific of its reference types the value is of, or null | [Reference types](../language/types.md#reference-types) |
| Member | A property, a function, an indexer or an operator of a type, or a property or a function of no type | [Members](../language/members.md), [operators](#modules-operators) |
| Extension | A named group of the members a module adds to a type another module owns, its `target` | [Extensions](../language/extensions.md#extensions) |
| Type selector, mapping | A selector a fixed argument chooses a type through, and a mapping of one of its keys to a type | [Type selectors](../language/vocabulary.md#vocabulary-type-selectors) |
| Observation type, observation target | What a member names to learn that its result may have changed, and what it may observe | [Observations](observations.md#observations) |

A module declares members on any type, its own in their declarations and another module's in its extensions, and `.` reads the owner's members while `:` reads the extensions', as [owners and extensions](../language/extensions.md#extensions-owners) set out. Any type or member may be [internal](#modules-internal-declarations), available within its module alone.

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

- **A reference type** is `kind: 'reference'`. It declares its `isInstance`, may name a `supertype` and be `abstract`, and holds its members, as [reference types](../language/types.md#reference-types) set out.
- **A structured type** is `kind: 'structured'`, a type of immutable data. Its data shape is the properties it declares directly without `updates`, each naming the type of its value in `result` and taking no `impl`: Nexo reads each from the data, and validates, copies and freezes a structured value by them, never invoking an implementation to do so. Each is read as any property is, `room.climate?.temperature`. Its properties with `updates`, and its other members, answer through their `impl`, which a tool may leave out without changing the data shape. An extension adds nothing to a type's data shape, and a property declared without `updates` anywhere but directly in a structured type is refused.
- **An extension** is `kind: 'extension'`, holding the members it adds to its `target`, as [extensions](../language/extensions.md#extensions) set out, and never a value's type.
- **A type's name** is unique within its module, conventionally in PascalCase, as [type names](../language/types.md#types-type-names) set out, and the type is identified by its module and that name.
- **Its imports.** A reference type and a structured type may declare `import`, the names of modules whose public types its declaration names unqualified, `import: ['Home']`; every other foreign type it names is qualified, `Home.Device`, as [type identity](../language/types.md#types-type-identity) sets out.

Nexo's own `List<T>`, `Dictionary<K, V>` and `Pair<K, V>` are the generic value types, their parameters the types of their items, keys and values, which their members' declarations write, as [collections](../language/collections.md) set out. A module's own reference and structured types don't declare type parameters, and an extension and a member declare their own, as [type parameters](../language/types.md#types-type-parameters) set out.

<a id="runtime-reference-types"></a>

## Reference types

A reference type's declaration decides which values belong to it, and a module may say which of its types a host's value is exposed as; what a reference type is to a script, its hierarchy, identity and narrowing, is the language's, as [reference types](../language/types.md#reference-types) set out.

- **Membership.** Every reference type declares `isInstance(value)`, which answers whether the value belongs to the type, `true` or `false`. A value belongs to a type where the `isInstance` of the type and of every supertype above it answers `true`. It is synchronous and changes nothing; an answer that isn't a Boolean is a fault, and so is an exception it throws, each with its own error naming the type and the operation that asked, the second's `cause` exactly what it threw. Binding, a member's answer, a captured value and a cast check membership by this one rule.
- **Recognition.** A module may declare `typeOf(value)`, its contract for the type a host's value is exposed to scripts as: the most specific of the module's own public reference types the value is of, or null where the module recognizes none. Nexo takes the type it names as given, never substituting a supertype for it. Where a binding's type is not declared, Nexo asks every registered module's `typeOf`. Only objects are eligible for reference-type recognition; strings, numbers, Booleans and null are data, and no `typeOf` is asked of one. A name that is not a reference type of that module, an abstract type, an [internal](#modules-internal-declarations) type, and a type whose membership the value fails are faults of the module, and so is an exception `typeOf` throws, with its own error, its `cause` exactly what it threw. Where several modules name a type, the value takes the one beneath every other, and is refused as ambiguous, with a structure error naming the types, where none is beneath the others; registration order never decides. A value no module recognizes is typed as data where it is data, and refused otherwise. Recognition never runs every type's `isInstance` to find one, since several types can accept one value: `Energy`'s `Meter` accepts every device, as `Device` does.
- **Abstract types.** A type a module declares `abstract: true`, `false` where left out, is never what recognition answers, so a module's `typeOf` naming one is a fault. A declared binding may be of an abstract type.
- **A declared type.** A host may declare the type of a binding whose value is a reference, as [registry-aware bindings](bindings.md#runtime-bindings) set out, and no `typeOf` is asked for it. The value must belong to the declared type, by its `isInstance` and its supertypes', and fails the binding otherwise, with a structure error naming the binding and the type; no type beneath the declared one is asked. The declared type is the binding's static type, an abstract one included, so a light bound as a `Device` exposes `Device`'s members alone, as its host chose, until [`as`](../language/types.md#casts) narrows it, asking the narrower type's `isInstance`. A declared reference type is declared for a reference value, or for null where it is nullable; a binding of data takes a declared data type instead, which captures it, as [declared types](bindings.md#runtime-bindings) set out.

<a id="modules-operators"></a>

## Operators

A type's members may hold **operators**, `kind: 'operator'`, which the language's own syntax invokes and nothing else: `name: 'cast'`, which `as` invokes, and `name: 'convert'`, which `to` invokes, each naming its destination type in `result`.

```js
{ kind: 'operator', name: 'cast', result: 'Home.Device' }
{ kind: 'operator', name: 'convert', result: 'Temperature', impl: ({ value }) => ({ value, unit: 'C' }) }
```

- **Only through their syntax.** An operator is not a member a script calls: `value.convert(…)`, a qualified form such as `Measurements.convert(value)`, an extension access and a reference to a module's function reach none, and a function a module declares named `convert` is an ordinary member of its own. Operators and ordinary members are looked up apart, so a `cast` beside a property of that name is not a collision.
- **Selected by their destination.** An operator is selected by its receiver's type, its name and its result together, so a type declares several of each, one for each destination type, and two for one destination collide.
- **A cast operator** is declared on a reference type, and its result is another reference type, outside its hierarchy: it permits that one directed cast, and its `impl` is optional, as [casts](../language/types.md#casts-what-it-narrows) set out.
- **A conversion operator** is declared on a type of data, and its result is another type of data: `Number`, `String`, `Boolean` or a structured type holding data alone. Its `impl` reads `{ value, reject }` and answers the converted value, as [conversions](#vocabulary-conversions) set out. A module declares a conversion whose source or destination is one of its own types, a rule Nexo's own module alone is exempt from, for the conversions between the language's types, and declares one on a type it does not own in an extension, as `Measurements` declares one from `Number` to its `Temperature` in its `NumberExtensions`.

<a id="vocabulary-conversions"></a>

## Conversion operators

A **conversion** is a [conversion operator](#modules-operators) of a type of data, `{ kind: 'operator', name: 'convert', result: 'Number', impl }`, which `to` invokes and nothing else, and none from a type to itself. Several modules may each declare one from a source to a destination: they compete as every operator does, among those a script's imports make available, the owner's winning, the extension's whose target is more specific than every other's resolving where the owner declares none, and several none of which is more specific refused as ambiguous where a script converts so, as [owners and extensions](../language/extensions.md#extensions-owners) set out. A destination written qualified identifies its type and never selects an operator, and an [extension access](../language/extensions.md#extensions-access) reaches none. Its types are `Number`, `String`, `Boolean` and the structured types that hold data alone: a reference value is left to members, which declare how they change, so a conversion adds no dependency on a host's state. A module declares one in the members of its own source type, and in an extension where the source type is another module's and the destination its own, as `Measurements` declares one from `Number` to `Temperature`.

Its `impl` reads `value`, never null, and nothing else, and answers the converted value, or calls `reject(reason)` with a diagnostic string. `reject` throws a signal private to Nexo and to that attempt, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. What `to` and `try … to` make of a rejection and of any other failure is set out in [conversions](../language/values.md#conversions) and [attempts](../language/expressions.md#attempts).

<a id="modules-internal-declarations"></a>

## Internal declarations

A type or a member declares `internal: true` to be available within its declaring module alone. `internal` is a Boolean, `false` where left out, and any other value, a string among them, is refused when the module is created. The declaring module of a member is the one whose `types` or `members` hold it, an extension among its types, so an internal extension member belongs to the module that declares the extension, never to the owner of the type it extends. A member of an internal extension is internal, as a member of an internal type is.

- **Its type bounds it.** A member of an internal type is internal however its own flag is written, and `internal: false` on it widens nothing, as a member's accessibility is bounded by its containing type in .NET. A public type holds public and internal members alike, and stays usable and extensible by every module: another module extends `Reading`, and cannot use `Reading.source` where that property is internal.
- **At registration.** A declaration of another module that names an internal type, as a supertype, an extension's target, or a parameter's, a property's or a result's type, and one that names an internal member explicitly, is refused. A public declaration exposes public types alone: every type its signature writes, its parameters', its callbacks' arguments' and results', its result's and, for a public property of a data shape, its value's, through list items and nullable types, is public, and so are a public type's supertype and the type a mapping gives a fixed argument; one that is not is refused. Declarations within one module name each other's internal declarations freely.

  | Declaration | At registration |
  | --- | --- |
  | A public member returning the internal `ReadingState` | Refused |
  | A public member taking a `List<ReadingState>` | Refused |
  | An internal member using its module's `ReadingState` | Registered |
  | The public `Reading` holding an internal property of type `ReadingState` | Registered |
  | A public reference type declaring an internal supertype | Refused |
  | A mapping of a key to the internal `ReadingState` | Refused |

- **At resolution.** A script does not reach an internal declaration through any form: a member read or called, a data shape's property read by name or by computed property access, a qualified form, an extension access, a reference to a module's function, an indexer, and a cast or a conversion naming an internal type or selecting an internal operator. An internal declaration is never a candidate, so `.` refuses a member whose only applicable declaration is internal, whatever an extension declares of its name, which `:` reads.
- **In tooling.** Completion and every listing a script's author reads leave internal declarations out.

`internal` decides what scripts and other modules' declarations name, and nothing else: an implementation is JavaScript, and works with its values and its helpers as it always does, and a value a result holds keeps what it holds, an internal property among them, since what a script can name and what its host receives are separate.

<a id="modules-valid-combinations"></a>

## Valid declarations

One shape serves every declaration, and each kind accepts the declaration keys it needs alone: a declaration key its kind does not take is refused when the module is created, with a module error whose location names the module, the type a nested declaration stands in, the declaration and the declaration key. A declaration key holding `undefined` counts as left out.

`name` is common to every declaration; an operator's names its operation, `cast` or `convert`. A type, an extension, a member, a type selector, an observation type and an observation target are named by an [identifier](../language/lexical-structure.md#names-and-reserved-words), as a script writes them, an extension and a member following it with the [type parameters](../language/types.md#types-type-parameters) they declare, `ListExtensions<T>` and `identity<T>`, and any other is a module error when the module is created, so a member cannot be named `focus-within`, and is named `focusWithin`; a mapping is named by no identifier, its `key` being the string a fixed argument gives. A member's declaration keys, by its kind, are set out in [declaring a member](members.md#members-declaring-a-member); every other declaration takes these:

| Declaration | Takes | Refuses |
| --- | --- | --- |
| Reference type | `kind: 'reference'` and `isInstance`, both required; `supertype`, `abstract`, `import`, `members`, `internal` | Any other declaration key, `impl` among them |
| Structured type | `kind: 'structured'`; `import`, `members`, of which the properties without `updates` are its data shape, and `internal` | Any other declaration key, a `fields` collection, `isInstance`, `supertype` and `impl` among them |
| Extension | `kind: 'extension'` and `target`, both required; `members` and `internal` | Any other declaration key, `import`, `isInstance`, `supertype`, `type`, `typeParameters` and `impl` among them |
| Type selector | Its name alone | Any other declaration key, `impl` among them |
| Mapping | `selector`, `key` and `type`, all required | Any other declaration key, `name` and `impl` among them |
| Observation type | `contract`, `identity`, `shared`; `impl` | Any other declaration key |
| Observation target | `from`, which is `receiver` where given; `count`, which is `many` where given | Any other declaration key, `impl` among them, and the name `receiver` |

`typeOf` and `isInstance` are functions, checked as functions when the module is created and never called until a value needs them. A reference type declares its `isInstance` whether or not its module's `typeOf` ever names it, since a member's answer, a cast and a declared binding check membership by it.

<a id="modules-declarations-without-an-implementation"></a>

### Declarations without an implementation

A declaration without an `impl` is resolved against as any other, so a tool reads and checks every script that uses it. It is never invoked: creating an evaluator for a resolution any of whose used declarations the evaluator invokes, a conversion operator among them, has no `impl` is refused, with a module error naming the declaration and its module. A property of a structured type's data shape takes none, since Nexo reads it from the data, and a cast operator needs none, as [operators](#modules-operators) set out. The used declarations include those an unreached branch uses, so whether a script can be evaluated is decided before anything is evaluated, whatever branch its evaluation takes, and a script of a module only some of whose declarations are implemented is evaluated where it uses those alone.

<a id="runtime-duplicates"></a>

## Duplicates

Within one module, an exact duplicate is refused at registration: two members of one name declared on one receiver type, two unnamed indexers for one receiver type, and two operators of one name and destination on one receiver type. Declarations whose receivers only overlap are not duplicates, and both register: `Home` may declare `active` on `Device` and on `Light`, two declarations though a light satisfies both, and so may a `List<Light>` and a `List<Device>` each take a member of one name. A module member, which has no receiver, and a member of its name on a receiver both register. Which of several declarations an access selects is the language's, as [a module's own collisions](../language/modules.md#namespaces-a-modules-own-collisions) set out.

<a id="modules-registries"></a>

## Registries

A **registry** holds the modules a host resolves and evaluates against. `nexo.createRegistry(modules)` creates one holding Nexo's own module and the modules given, registered in the order given, as `registerModule` registers each, so a module names the types of those before it; no registry is shared, so two hosts never see each other's modules.

- **The registry holds definitions.** A registry holds the declarations of every module registered with it, shared by all the host's callers. What a host's callers start through host calls, and the state it keeps, is scoped to those callers, never to the registry.
- **Registering checks the module whole.** `registerModule` indexes every type the module declares, then checks every declaration against them and the registry before it registers any, so a module refused leaves nothing of itself registered and advances no revision. Module names conventionally use PascalCase, but casing is not enforced. At registration, module names are compared case-insensitively for uniqueness. A registration is refused if an existing module has the same name under that comparison. The original spelling is preserved, so `Nexo`, the built-in module's name, refuses `nexo` as any registered name refuses another spelling of itself. A type is named once within its module; type selectors and observation types are each named once across every module, Nexo's own included, a mapping's key stands once in its selector, and a name or a key already declared is refused. A type a declaration names resolves to one the module declares or a module registered before it declares, as [type identity](../language/types.md#types-type-identity) sets out, and an `import` that does not name a registered module, a reference that resolves to no type or to several, and a foreign type named unqualified outside its import are refused; a supertype is a reference type, and no hierarchy is a cycle; a declaration names no other module's [internal](#modules-internal-declarations) declaration, and a public one exposes no internal type.
- **Ambiguity at a reference.** Ambiguity is checked when resolving a reference, against the declarations applicable at that location. Declarations are not refused merely because their names could become ambiguous in another context.
- **Its revision.** A registry answers a revision that changes whenever its vocabulary does; whether a resolution made before a registration is still current is the resolution's own to say, as [reusing a resolution](resolution.md#runtime-reuse) sets out.
- **What it answers of its modules.** `registry.moduleNames` is the names of the modules it holds, in the order registered, `Nexo` first. `registry.getObservationType(name)` answers the observation type of that name as its module holds it, and undefined where no module declares one. `registry.getDeclaringModuleName(declaration)` answers the name of the module that declares a type, an extension, a member, an operator among them, a type selector, a mapping or an observation type, and undefined for any other object, an observation target and a declaration no module registered with it holds among them. `registry.getImplementation(declaration)` answers its `impl`, and undefined where its module gives none. Each takes a declaration as its module holds it, as [creating a module](#modules-declarations) sets out, and calls no host code.
- **It reads no text of its own.** A script's [imports](../language/modules.md#scripts-imports) decide which of its names are namespaces, so a text reads alike whatever registry resolves it: `nexo.parse(source, options)`, `nexo.format(script, options)` and `nexo.quote(script, options)` read and write it for every registry, and `registry.resolve` reads a text as `nexo.parse` does; [module names in text](../language/modules.md#names-and-reserved-words-module-names) sets out how a name reads.
- **Registering is not invoking.** Registering a module makes its capability understood; a host invoking one of its host calls starts what that call starts, for its caller, and ending it leaves the module registered.
- **Registering comes first.** A module is registered before a script importing it is resolved, and an import naming a module the registry does not hold is a validation error naming it, as is a member no module the script imports declares, which gives the import where a registered module declares it.
