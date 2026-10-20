# Modules and namespaces

In this document: [Namespaces](#namespaces) · [Extensions](#extensions).

<a id="namespaces"></a>

## Namespaces

A module's namespace is how text reaches what the module declares: in text read through a registry, the module's name, a dot and the name of one of its declarations, as `home.rooms` and `energy.usage(device)` are. The name is reserved there, as [module names](names-and-scope.md#names-and-reserved-words-module-names) sets out.

<a id="namespaces-module-members"></a>

### Module members

A member a module declares with no type it applies to is a **module member**, read through the namespace alone: `home.rooms` reads the home's rooms, and `home.now` the time. Its implementation is given no receiver. Two modules may each declare a module member of one name, since each is read through its own namespace. Reading a member through a namespace says nothing of how its value changes: `home.now` is unobserved, and changes between evaluations.

<a id="namespaces-owners-and-extensions"></a>

### Owners and extensions

A module may declare members on any type, its own or another module's. The module that declares a type **owns** it, and a member another module declares on it is an **extension**, as `energy`'s `device.usage` is. An unqualified member resolves by the owner of its receiver's type:

- An applicable member the owner declares wins over every extension, so `device.power` reads `home`'s, whatever `energy` declares.
- Otherwise one applicable extension resolves as any member does, so `device.usage` reads `energy`'s.
- Several applicable extensions are refused as ambiguous when the expression is resolved, before anything is evaluated, and both still register, since refusing one would leave its qualified form unusable. Were a module `solar` to declare `usage` on `device` too, `device.usage` is refused:

> Member 'usage' on 'device' is ambiguous between modules 'energy' and 'solar'. Use 'energy.usage(device)' or 'solar.usage(device)' to select one.

Applicability follows the receiver's type and the access form, so one name on unrelated types is never ambiguous. Lexica's own module owns the language's types, `list`, `number`, `string` and `boolean` among them, so `rooms.count` reads Lexica's whatever an extension declares; that module has no namespace, and its name is reserved nowhere. Predicates follow the same precedence, so `device.is("active")` reads `home`'s, and indexers follow it as [indexers](#namespaces-indexers) set out.

<a id="namespaces-qualified-access"></a>

### Qualified access

Every member a module declares on a type is also reached through the module's namespace, the receiver its first argument and the member's own arguments after it: `energy.usage(device)`, `energy.power(device)` and `home.device(room, "lamp")`. The qualified form selects that module's declaration and reuses its implementation and its contract, and the unqualified form stays available beside it, so no module declares a second implementation to make an extension addressable.

In a qualified call to a receiver member, the receiver argument propagates null. If it is null, the member's implementation is not invoked and the call produces null. The result type includes null whenever the receiver argument's type includes null, so each qualified form is a receiver form selecting that module's declaration:

| Qualified form | Equivalent receiver form |
| --- | --- |
| `energy.usage(device)`, `device` not nullable | `device.usage`, selecting `energy`'s declaration |
| `energy.usage(device)`, `device` nullable | `device?.usage`, selecting `energy`'s declaration |

The rule belongs to the receiver argument alone: the member's own arguments keep their declared null policies, and a module member has no receiver argument for it to apply to. A null receiver argument skips the member, never what the argument reads, so an expression a host follows keeps every dependency its receiver argument reads, and answers anew once the receiver is no longer null.

A predicate is called through its module directly, the receiver first and no verb, as `home.active(device)` and `home.occupied(room)` are, selecting that predicate; the verb belongs to unqualified access alone. Its receiver argument propagates null as a member's does, so a null receiver produces null, never false.

<a id="namespaces-indexers"></a>

### Indexers

An indexer is selected by the owner of its receiver's type, as a member is, and keeps its key, its receiver and its contract however it is selected:

- **A named indexer**, `x:name[key]`, resolves as an unqualified member does: the owner's indexer of that name wins over every extension's, one applicable extension's indexer resolves, and several are refused as ambiguous when the expression is resolved, the error naming the indexer, its receiver's type and the competing modules.
- **A default indexer**, `x:[key]`, selects the named indexer designated as the default for its receiver's type: the owner's designated indexer wins, one extension's resolves where the owner designates none, and several are refused as ambiguous, as named ones are. So `device:["mode"]` reads `home`'s `setting`, whatever an extension declares.

Version 32 has no qualified form of an indexer, and selecting an extension's indexer explicitly is deferred beyond it. An extension's indexer is reached only where unqualified selection gives it: one that the owner's indexer of its name outranks is never reached, and one that another extension's competes with is refused as ambiguous wherever it is written.

<a id="namespaces-a-modules-own-collisions"></a>

### A module's own collisions

A module's members, the qualified forms of the members it declares on types, and its predicates' qualified forms all take part in its collision checks, so a module whose own declarations would make one of its qualified forms ambiguous is refused when it is registered. Were `home` to declare a predicate `on`, its qualified form `home.on(device)` would collide with the event source's, `home.on(device, "change")`, and `home` would be refused.

<a id="namespaces-text-and-registries"></a>

### Text and registries

A module's name decides how a text reads, so a registry reads and writes text with its own module names, and text read without a registry knows the language's names alone. Nothing reads a text otherwise unannounced: a registry refuses a definition read without its module names that names one of them, saying to read the text with the registry; a namespace naming no module the registry holds is refused as one it lacks; and registering a module whose name a definition read earlier uses refuses that definition as one read without the registry's module names, never reading it again silently.

<a id="extensions"></a>

## Extensions

An **extension** is a module's member, predicate or indexer declared on a type another module owns, as `energy`'s `device.usage` is. Every module may declare them, on its own types and on any other's, and an unqualified access resolves by the owner of its receiver's type, as [owners and extensions](#namespaces-owners-and-extensions) set out, so extensions that compete both register and are told apart by their qualified forms.

Within one module, a name declared twice for overlapping receivers, a type and its supertype among them, is refused at registration, and so is a qualified form two of its declarations would share, as [a module's own collisions](#namespaces-a-modules-own-collisions) sets out. Types, event types and observation types are each named once across every module, Lexica's own included, and a name already declared is refused at registration too.

An extension is a module, made by `createModule` from its name and its declarations, and registered with `registerModule`; a declaration that breaks a contract is a module error, raised when the module is created or when it is registered.

A module can declare types of its own, reference and structured, properties, functions written as function calls or as named indexers, predicates, event sources, event types, observation types, observation targets, actions and behaviors, and conversions to and from its own types, one for each source type and target, and follows these contracts throughout: every member declares its signature, its argument kinds, its result type and how it changes, and evaluating an expression stays read-only and synchronous.
