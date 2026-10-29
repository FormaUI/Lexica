# Observations

<a id="observations"></a>

An **observation** is what a member names to learn that its result may have changed, or to keep the sample it reads. The member declares it, Nexo validates it, and the host starts it where it follows what an evaluation read, and stops it where it no longer does; how a host shares and ends observations is its own.

In this document:

1. [Observation types](#observations-types)
2. [Observation targets](#observations-targets)
3. [Naming observations](#observations-naming)

<a id="observations-types"></a>

## Observation types

An **observation type** is a declaration of a module, named once across every module: its name, conventionally in camelCase, its contract, which is one of two, the arguments that belong to an observation's identity, whether equivalent requests share one, and its implementation.

| Contract | What it reports |
| --- | --- |
| Invalidation | That a result it covers may have changed, so the host evaluates again, as `state` reports a device's new report. |
| Maintained | Each sample it keeps, which the member that names it reads as its latest, as `reading` keeps each temperature a sensor reports. |

It is declared in its module's `observationTypes` as `{ name, contract, identity, shared, impl }`: `contract` is `invalidation` or `maintained` (NEXO4520); `identity` lists the names of the arguments that belong to an observation's identity, none where it is left out (NEXO4521); and `shared`, a Boolean, says whether equivalent requests share one observation, `true` where it is left out (NEXO4522).

<a id="observations-types-the-request"></a>

Its implementation receives the **request** an observation makes, `{ type, target, arguments }`: the observation type's name; the target the observation observes, the receiver, a target its host resolved or the value of the member's argument it names; and the arguments the observation gives its type, by name, each argument reference resolved to the value the call gives it. The host builds the request as it starts the observation, since Nexo starts none.

Beside the request, it receives `notify`, which it calls when a result the observation covers may have changed, and `env`, as [what an implementation receives](members.md#members-what-an-implementation-receives) sets out. It starts the observation and answers an object whose `stop()` ends it and, for a maintained observation, whose `sample()` answers its latest sample as `{ pending, value }`, `pending` true and no `value` until the first arrives. The host calls the implementation and what it answers, and Nexo calls and checks neither: the host gives a maintained member its samples through its `beforeInvoke`, as [evaluation](evaluation.md#runtime-evaluation) sets out.

<a id="observations-targets"></a>

## Observation targets

An **observation target** is what a module declares an observation may observe besides the receiver and an argument, by a name of its own: a target independent of any receiver, as the home is, or one found from the receiver, `from: 'receiver'`; and one target, or several, `count: 'many'`. A target that omits `from` is independent of the receiver, and one that omits `count` is one target.

Nexo does not know any target by name: it validates the declarations and every reference to them, and the host resolves each target when it starts an observation, so a host's module declares the targets its domain needs and the host resolves them itself. `receiver` names the receiver alone, so no module declares a target by that name, and an argument is named as `{ argument }`, never by a bare name, so a target and an argument are never mistaken for each other.

<a id="observations-naming"></a>

## Naming observations

A member names its observations by type, each of its receiver, of an argument, or of an observation target its observation type's module declares, as `placement` is of the home, and gives the arguments its type takes: a literal, a list of values, or an argument of the member, `{ argument }`, which can carry a prefix, a string joined before the argument of a value parameter of type `String`. A target the observation type's module does not declare is refused when the module is registered.

Each is declared among its member's `updates.observations` as `{ type, of, … }`. `type` names its observation type, which some registered module declares, and `of` what it observes: `'receiver'`, a target by its name, as `{ type: 'placement', of: 'Home' }` does, or an argument of the member, `{ argument: 'name' }`. Every other key is an argument its type takes, by that name: a literal, a string, a number, a Boolean or null; `{ argument }`, the argument the call gives the member's parameter of that name; `{ argument, prefix }`, a string that is not empty joined before the argument of a value parameter of type `String` (NEXO4061); or a list of these. An observation of any other form is refused when the module is created (NEXO4060), and so is one given a function parameter, as `of` or as an argument (NEXO4055), since a function lasts only while its member's invocation does.

An observable member names observations that cover every change to its result, a partly observable one those it can make, and a member of any other category names none. A member that reads maintained values names a maintained observation, whose sample it reads; no other member does. A maintained observation gives its member one sample, so it observes one target, never a target of several. A module member, which has no receiver, does not observe a target found from one.
