# Lexica Design v1.0.0-alpha

The [Lexica specification](lexica-specification.md) defines the language. This design sets out how its modules are declared and registered, how it evaluates an expression for the host that asks, and how tooling reads its text; the [DOMQL design](https://github.com/FormaUI/DOMQL/blob/main/docs/domql-design.md) sets out how DOMQL, a host, observes, watches and carries out the queries written in it.

## Modules

An extension is registered as a module, which declares under its name the types, members, predicates, event types, observation types and conversions it contributes, each declaration that runs code carrying its implementation; requests resolve against those declarations. The declarations are data but their implementations, each member's name in the language, signature, result type, argument types and kinds and the request kind it makes, so a tool reads them without running anything. A module registers under a name of its own, which is its namespace in text read through its registry, and registering a name twice is an error. This design describes version 32, as the [specification](lexica-specification.md#version) does.

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
    eventTypes: [/* change, motion */],
    observationTypes: [/* placement, state, climate, presence, reading */],
    observationTargets: [{ name: 'home' }],
});
const registry = lexica.createRegistry([home]);
```

### Declarations

A module is created from its name and its declarations; declarations are validated when the module is created and checked against the registry when it is registered. Lexica's own module is one Lexica creates itself, the one module every registry holds, which owns the language's types and has no namespace; every other module, a host's as DOMQL's `domql` is, is made with `createModule`, and no factory, name or flag makes one an exception to the rules. A module declares members and predicates of any name on any type, its own or another module's, and an unqualified access resolves by the owner of its receiver's type, so competing extensions both register; a name a module declares twice for overlapping receivers, a type and its supertype among them, is refused. It declares conversions to or from its own types alone, a rule Lexica's own module alone is exempt from, for the conversions between the language's types.

- **The module.** A module is `{ name, types, members, predicates, eventTypes, observationTypes, observationTargets, conversions }`, its `name` the module's and its namespace's.
- **A type** is a reference type, its name, at most one supertype, the test a value of it passes and whether it is abstract, or a structured type, its name and the types of its fields.
- **A member** names its `name` in the language and its `target`, a type, a list of types or `any`; a member without a target is a module member, read through the namespace, and its implementation is given no receiver. A target the module's own types declare is its own, a target another module declares makes the member an extension, and a target no module declares is refused when the module is registered, so a misspelled type never becomes an extension. Its `kind` is `property`, `function`, `eventSource`, `action` or `behavior`; its `syntax`, for a member that is no property, `function-call` or `indexer`, an indexer a function whose one required value parameter is its key, which can be designated the default for its receivers; its `arguments`, where it has parameters, `positional` or `options`; its `parameters`; and its `result`.
- **A parameter** is a value, an expression, a predicate or a function. An expression and a predicate are evaluated against each item of the list the member follows, `context: 'item'`, and an expression declares the type it produces. A parameter declares whether it is required, its default where it is not, and whether a null argument propagates, making the call answer null, or is accepted.
- **A fixed parameter** names something the vocabulary resolves before any evaluation, and declares what it selects: an event type or a predicate.
- **Updates.** A member's or a predicate's change contract is grouped under `updates`: `changes`, `misses`, `reads`, `tolerance` and `observations`, by the categories the specification's [vocabulary contracts](lexica-specification.md#vocabulary-contracts) define. A member that reads no value, an action or a behavior, leaves it out. A member that answers a number or a structured value holding numbers may declare the `tolerance` within which a host compares each of them, exactly where it declares none.
- **A predicate** names the yes-or-no state it asks, its `target`, its `verb`, `is`, `has` or `supports`, its `updates` and its `implementation`. A predicate is selected by the fixed argument of its verb, which the resolution keeps beside the verb's call, so its contract, never the verb's, is the one a host checks and the evaluation follows, and one predicate's observability is no other's. A predicate's failures name it, the verb that selected it and its module, and it is also called through its module's namespace, the receiver first and no verb.
- **Observations.** A member that changes observably or partly observably names the observations that cover its changes. An observation is of a type, observes the receiver, an argument of the member, or an observation target its observation type's module declares, by its name, and gives the arguments its type takes: a literal, a list of values, or an argument of the member, `{ argument }`, which can carry a prefix, a string joined before the argument of a value parameter of type `string`. A module declares an observation type by a camelCase name, its contract, invalidation or maintained, the arguments that belong to an observation's identity, whether equivalent requests share one, and its implementation; a maintained observation gives its member one sample, and observes one target.
- **Observation targets.** A module declares each target its observations may observe besides the receiver and an argument by its `name`, with `from: 'receiver'` where it is found from the receiver and `count: 'many'` where it is several targets; one that omits `from` is independent of any receiver, and one that omits `count` is one target. Lexica knows no target by name: it validates the declarations and every observation's reference to one, refusing a target its observation type's module does not declare when the module is registered, and the host resolves each target when it starts an observation, so DOMQL declares `window`, `document`, `root` and `roots` and resolves them itself. `receiver` is the receiver's alone and no target's name, and an argument is always `{ argument }`, so neither is mistaken for a target.
- **Implementations.** Each declaration that runs code carries it as `implementation`: members, predicates, observation types and conversions. A member's name is written once, and two members sharing code refer to one JavaScript function. `implementation` is optional, and a declaration that leaves it out is resolved against and never invoked, as [valid combinations](#valid-combinations) set out; every key but `implementation` is data, so tooling reads a declaration without running it.
- **What an implementation receives.** An implementation is called with one object and takes what it needs from it by name, never by position, so none accepts what it ignores to reach what it reads, and a field added later moves nothing. A member's or a predicate's holds `receiver`, the value it is read from, which a module member has none of; `args`, the expression's arguments by parameter name, `args` since strict mode refuses `arguments` as a name; and `env`, the environment the host supplies; and, for an event source, `deliver`, which each event is handed to, its answer an object whose `stop` ends the listening; for a member reading maintained values, `samples`, its observations' latest, in the order its declaration names them; for an action, `signal`, its answer its result or a promise of it; and for a behavior, `reportError`, its answer an object whose `update(receiver, args)` applies new arguments and whose `dispose` ends it, started before it returns. An observation type's holds `request`, `notify` and `env`, and a conversion's `value` and `reject`. The contract is JavaScript's alone, and no expression is written differently for it.
- **A conversion** names the type of data it converts from, the one it converts to and its implementation, one for each source type and target across every module registered, and none from a type to itself, which a value already of it converts to by the language's rule. Its types are `number`, `string`, `boolean` and the structured types that hold data alone, lists of data among their fields: a reference value and an event source are left to members, which declare how they change, so a conversion adds no dependency on a host's state, and a list itself is no type a conversion converts between. A conversion reads its `value`, never null, and nothing else, and answers the converted value, which is checked against the type it converts to, or calls `reject(reason)` where the value has none, with a reason that is a diagnostic string. `reject` throws a signal private to Lexica and to that attempt at the conversion, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. A rejection is the one failure a conversion expects: `to` fails the evaluation for it and `try … to "type"` answers null, carrying the conversion out by one path, and any other exception, and a value not of the type, is a fault, which fails the evaluation for either. `to` takes one declared conversion and never chains them.
- **Types and events** are contributed by modules as data: reference and structured types and event types with the type of their event data; a test is a member that answers a Boolean or a predicate asked with its verb, and a capability a predicate `supports` asks.

#### Valid combinations

One shape serves every declaration, and each kind accepts the fields it needs alone: a field a declaration's kind does not take is refused when the module is created, with a module error whose location names the module, the declaration and the field.

**Parameters and arguments.** A member declares its **parameters**, and an expression gives it **arguments**: `arguments` names the form those arguments take, `positional`, one argument for each parameter in order, or `options`, one object whose fields supply them. A member *has parameters* where it declares one or more, an optional one included. An indexer's one argument is its bracketed key, so its form is positional.

**Fields every declaration takes.** `name` is common to every declaration. `implementation` is taken by the declarations that run code, members, predicates, observation types and conversions, and is optional there; a structured type, an event type and an observation target run nothing, and refuse it.

| Member kind | `target` | `syntax` | `arguments` | `parameters` | `updates` | `result` |
| --- | --- | --- | --- | --- | --- | --- |
| `property` | Optional | Refused | Refused | Refused | Required | Required |
| `function` | Optional | `function-call`, the default, or `indexer` | Required where it has parameters, refused where it has none; `positional` for an indexer | Any kind; a function parameter only here | Required | Required |
| `eventSource` | Optional | `function-call` | As a function's | One designated fixed parameter selects the event type; any other is a value parameter that selects nothing | Required, reading `captured` | `event<T>` |
| `action` | Optional | `function-call` | As a function's | Value, expression and predicate parameters | Refused | Required |
| `behavior` | Optional | `function-call` | As a function's | Value, expression and predicate parameters | Refused | Required |

- **A member without a target**, a module member, refuses what only a receiver gives: the `indexer` syntax, being a default indexer, and an observation of the receiver or of a target found from it, in its own `updates` and in any observation it names.
- **Updates.** `changes` and `reads` are required. `misses` is required where `changes` is `partly-observable`, and refused otherwise. `observations` are required where `changes` is `observable` or `partly-observable`, and refused otherwise, each observation checked for its type, what it observes and the arguments it gives. `tolerance` is taken by a member whose result is a `number`, a `number?` or a structured type, nullable or not, where it applies to every number the structure holds, and refused by any other, a list among them.

| Declaration | Takes | Refuses |
| --- | --- | --- |
| Predicate | `target`, required; `verb`, `is` where it names none; `updates`, as a member's; `implementation` | `kind`, `syntax`, `arguments`, `parameters`, `result` |
| Structured type | `fields` | Any other field, `implementation` among them |
| Event type | `data` | Any other field, `implementation` among them |
| Observation type | `contract`, `identity`, `shared`; `implementation` | Any other field |
| Observation target | `from`, which is `receiver` where given; `count`, which is `many` where given | Any other field, `implementation` among them, and the name `receiver` |
| Conversion | `from`, `to`; `implementation` | Any other field |

**A declaration without an implementation** is resolved against as any other, so a tool reads and checks every expression of it. It is never invoked: creating an evaluator for a resolution any of whose used declarations, or any of the conversions it uses, has no implementation is refused, with a module error naming the declaration and its module. The used declarations include those an unreached branch uses, so whether an expression can be evaluated is decided before anything is evaluated, whatever branch its evaluation takes, and an expression of a module only some of whose declarations are implemented is evaluated where it uses those alone.

`registry.resolve(source, bindings)` resolves a request: it resolves every member against the registry, types the result and records what each member resolved to, without a host and without evaluating anything. What may be watched is the host's to decide from the change categories of the declarations a resolution uses: DOMQL refuses a watch over a member that is unobserved, and one over a partly observable member unless it accepts partial observation.

A module is given the capability it exposes, never an instance of it, since instances belong to the callers that apply them. A module exposes a capability through Lexica without the capability depending on Lexica: the capability keeps an API of its own, and its module lives beside it or in an integration package for it.

### Registries

A host resolves and evaluates against a registry of its own, which `lexica.createRegistry(modules)` creates holding Lexica's own module and the modules given; no registry is shared, so two hosts never see each other's modules. Bindings are made with `lexica.bind(values)`, which copies and freezes their data recursively and keeps each reference value as it is.

- **The registry holds definitions.** A registry holds the declarations of every module registered with it, shared by all the host's callers. The instances behaviors create, the event listeners subscribed to them and the state of whoever applied them are scoped to their callers, never to the registry.
- **Registering checks the module whole.** `registerModule` checks every declaration against the registry before it registers any, so a module refused leaves nothing of itself registered; a module's name is registered once, and no module is named by a word the language reserves.
- **Its revision.** A registry answers a revision that changes whenever its vocabulary does, so a host that keeps resolutions knows when to resolve again.
- **It reads its own text.** A module's name decides how a text reads, so a registry reads and writes text with its own module names, and `lexica.parse` and `lexica.format` know the language's alone. A registry refuses a definition read without its module names that names one of them, saying to read the text with the registry; a namespace naming no module it holds is refused as one it lacks; and registering a module whose name a definition read earlier uses refuses that definition, which is never read again silently. Parsed texts are kept by their text and the module names they were read with.
- **Registering is not applying.** Registering a module makes its capability understood; applying one of its behaviors creates an instance for its caller and target. Disposing that instance leaves the module registered.
- **Registering comes first.** A module is registered before a request naming it is resolved, and a member no registered module declares is a validation error naming it.

## Evaluation

Lexica evaluates an expression it has resolved against a registry, synchronously, for the host that asks. A resolution is reused with compatible bindings; an evaluator holds one binding set and the environment the host owns, and evaluates as often as it is asked, one evaluation at a time, each given the hooks of a host that observes what it reads. Lexica carries the evaluation out and describes its result, and the host keeps everything that spans evaluations.

```js
const resolution = registry.resolve(source, bindings);
const evaluator = resolution.createEvaluator(bindings, env);
const { value, metadata, isPending } = evaluator.evaluate({
    beforeInvoke(request) { /* observe the read; answer a maintained member's samples */ },
    afterInvoke(request, value) { /* note the value read */ },
    afterEvaluation(outcome) { /* keep or close what the evaluation opened */ },
});
```

- **The evaluator.** Lexica evaluates each node of the resolution, invokes each member's implementation with the one object it receives, its receiver, its arguments and the environment among them, checks the value it answers against the member's result type, and fails the evaluation at the member's location with an evaluation error where an implementation throws or answers a value not of that type.
- **The environment**, the host's `env`, is whatever the host gives the evaluator that does not belong in the expression, which every evaluation of it uses, as DOMQL gives the window and the document a query runs against. Lexica passes it to every implementation and never reads it.
- **`beforeInvoke(request)`** is called before a member's implementation is invoked, with the request: the member's declaration, its receiver and arguments, and where it stands. It reports every invocation an evaluation attempts, whether it then succeeds, fails or is pending, so an observation covers a read whose implementation throws. For a member that reads maintained values it answers their samples, or that one is pending, and a member whose sample is pending is not invoked and reads as null.
- **`afterInvoke(request, value)`** is called only after an implementation answered a value of its result type.
- **`afterEvaluation(outcome)`** is called once, in a `finally`, with the evaluation completed, pending where a sample it read was pending, or failed. The evaluation runs to one of the three synchronously, so none is cancelled while it runs.
- **What reaches the hooks.** Only the invocations an evaluation reaches call `beforeInvoke`, so short-circuited operands and unselected branches record nothing, and a function the expression passes to a member keeps the member's invocation as its lifetime, closed before `afterEvaluation`.
- **Each evaluation its own.** An evaluation's state is its own unless its host shares it, as a watch shares its observations across evaluations, so an evaluation an implementation starts is isolated from the one that called it.
- **A hook that throws.** A throwing `beforeInvoke` or `afterInvoke` fails the evaluation at that member. A throwing `afterEvaluation` after a failure leaves the original failure thrown, the cleanup failure recorded on it, and after a success fails the evaluation itself.
- **Without hooks.** A host with nothing to observe gives the environment alone, and an evaluation without a `beforeInvoke` reads fresh members alone, refusing an expression that reads a maintained one.
- **Reuse and staleness.** A resolution is reused with bindings of its resolution key, each binding's type and each primitive binding's value, against its registry at the revision it was resolved at. Creating an evaluator refuses bindings of another key, and each evaluator entry point refuses a registry whose revision has moved, so an evaluator never evaluates a stale resolution; evaluating an evaluator from within its own evaluation is refused, and each result and its metadata stay valid after later evaluations.
- **Result metadata.** Beside its value, an evaluation answers frozen records describing it, never part of it: each value's `origin`, an opaque token for the expression that produced it, the same token exactly where one expression of one resolution with one candidate selected produced both values, living as long as the resolution; its `tolerance`, the one the producing member declares; and, where an object expression or a projection built the value, `fields` and `items`, and `sources`, the input of each item a projection built, before its fields are evaluated, a reference value as itself and data as the evaluator holds it. A source is no key, since equal values and one reference can each stand more than once, and a list no projection built has no `sources`, so a null source stays apart from none. Lexica follows locals, bodies, function calls, object-root fields, selected branches and properties, and the part an access selects, which keeps its whole's metadata; a computed value has its own, and a part without a record inherits its parent's, an explicit null tolerance overriding. Consumers apply their own policy to these facts: DOMQL compares and patches its snapshots with them.
- **What stays with the host.** Waiting for samples, cancellation between evaluations, watches and their scheduling, snapshots and live state, and subscriptions, actions and behaviors stay the host's: DOMQL carries them out as the observing host over Lexica's evaluation.

## Tooling

Preparation is authoritative: it validates every request against the vocabulary available before the request runs, whether text or a definition produced it. Three properties keep validation open to editor tooling, such as analyzers and completion, which can follow without changing the language:

- **Locations.** Text positions and definition-node locations are kept, so a diagnostic names the member, argument or object expression that failed; the mapping from text to definition can be kept apart from the definition.
- **Declarative metadata.** A module's declarations are data, so a tool understands them without running a capability's implementation.
- **Independent validation.** Structural and vocabulary validation run without a host, given the metadata and the bindings' types.

A tool can check a source text known when the code is written against the metadata available to its project; text built at run time, modules registered at run time and checks that depend on bound values remain preparation's.

### Formatting

`lexica.format(source)` takes a text or a definition, and both give the same canonical text, which the definition writer writes; DOMQL's `domql.format` also takes a query object, which it formats from its definition.

- **What it keeps.** The definition's meaning, and the order of its locals and fields as declared; comments and the original layout are discarded, as a definition holds neither.
- **What it needs.** Neither bindings nor a registered vocabulary: it parses and checks structure as `lexica.parse` does, and resolves nothing.
- **The layout.** Four spaces of indentation for each level of an object expression; an object expression of one field and no locals on one line where its value is, `{ name = it.name }`, and any other with one line for each entry; a conditional with an `elseif`, or whose branches give their results with `return`, on one line for each clause and one for its `end`, each branch's locals and result a level within it; a body's locals and result each on a line of their own, a `do` block's a level within its `do` and its `end`; a string's line feed, carriage return, tab and escape character as `\n`, `\r`, `\t` and `\e`, and every other control, format or separator character in it but the space as `\u{…}`; an interpolated string's text as a string's with each brace doubled, and each interpolation's expression on one line, grouped in parentheses where it begins with one; one space on each side of `and`, `or`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `??`, `+`, `-`, `*`, `/`, `%`, `as` and `to`, and none between a negation's `-` and what it negates; and no trailing comma.
- **It is stable.** Formatting text already formatted gives the same text.
