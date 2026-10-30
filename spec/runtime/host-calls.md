# Host calls

<a id="runtime-host-calls"></a>
<a id="runtime-requests"></a>

A script that ends in a [host call](../language/members.md#members-host-calls) is resolved as any other, and its resolution answers the call: `resolution.hostCall`, its `name` and the `declaration` it resolved to, null while its receiver's type is unknown. The runtime prepares the call and projects each value its host supplies; invoking it, when and how often, and for how long what it starts runs, are the host's. Such a script is prepared, never evaluated: `evaluate` refuses a script that ends in a host call, and `prepareHostCall` one that gives a value, each with an [evaluation error](errors.md#runtime-evaluation-errors).

```js
const call = evaluator.prepareHostCall();

if (call.kind === 'prepared') {
    const brightness = await invokeHostCall(call.declaration, call.receiver, call.args);
    const { value } = call.project(brightness);
}
```

- **`evaluator.prepareHostCall()`** evaluates the locals the script declares before the host call, then the call's receiver and arguments, once, without hooks, as `evaluate` given none evaluates a script, and answers a **prepared call**, `{ kind: 'prepared', declaration, receiver, args, pointer, isDeferred }`, a hook's request in shape, the arguments by parameter name, the call named by its definition pointer, no `receiver` for a module member, and `isDeferred` always false, since resolution selects every host call; or a **skipped call**, `{ kind: 'skipped', pointer }`, where the receiver is null, an argument whose parameter propagates null is null, or the call has no declaration yet, so there is nothing to invoke and nothing to project. A skipped call is never invoked, and what its host answers for one is the host's to say. Preparing a script that gives a value is refused with an evaluation error. An evaluator prepares its call as often as it is asked, and each prepared call is its own, so the prepared calls of one evaluator coexist without affecting one another.
- **`call.project(value, hooks?)`** projects one value the host supplies for the prepared call: it captures the value as the call's declared `result`, as [capturing a supplied value](#runtime-host-calls-capturing) sets out, then evaluates the result projection against it, as `evaluate` evaluates a script with the hooks given, and answers as `evaluate` does, with the value, whether a member it read was pending, and the metadata. A host call followed by no result projection answers the captured value itself in that shape. A call that declares no `result` supplies nothing to project, so its prepared call has no `project`.

<a id="runtime-host-calls-capturing"></a>

**Capturing a supplied value.** A host supplies its values from outside the script, and `project` captures each as the type its call declares before the result projection reads it, at every level of it: the value itself, each property of a structure's data shape, a structure nested in one of them, and each item of a list.

| What is supplied | What is captured |
| --- | --- |
| Nothing, a property missing or `undefined` among them | Null where its type is nullable; the projection fails where it is not |
| Null | Null where its type is nullable; the projection fails where it is not |
| A value its type admits | The value, a structure as its data shape alone, and a list item by item |
| A set, a map, or an object of a `key` and a `value` alone, where a list, a dictionary or a pair is declared | The language's list, dictionary or pair, its items or entries in their traversal order, each captured as its own type declares; a list a set gives keeps no uniqueness |
| A reference of another type, where a nullable reference type is declared | Null, so the value keeps only the reference its type names, as a `Light?` property holding a thermostat is null |
| Data that reaches itself, a list or an object holding one it lies within | The projection fails with an evaluation error naming the call and where the value reaches itself |
| Any other value, data its type does not admit among them | The projection fails with an evaluation error naming the call and the part of the value |

A list never holds a missing item. Narrowing a reference is the one thing capturing turns into null, so mistyped data fails whatever its type's nullability. A supplied value has no type of its own until it is captured, so where it fails its declared type's membership, the registry's `typeOf` tells a reference of another type from mistyped data, as it recognizes a binding. A member's answer is never captured: its implementation answers what its member declares.

A projection reads what the call was prepared with, and evaluates the rest anew:

- **The locals before the call.** Each local the script declares before the host call is evaluated once, by `prepareHostCall`, as every local is, and each projection of that prepared call reads the value it was prepared with, never running its initializer again. A local holding a reference holds the reference, and one holding a computed value holds the value. In the example, each projection reads `room.occupied()` of the room the call was prepared with, as that room is when the motion arrives, while `occupied` keeps whether it was occupied when the call was prepared. Both read one receiver, since reading `sensor.room` again could find another room, a sensor being movable.
- **Its own evaluation.** Each projection is an evaluation of its own, with its own supplied value, host and state; the result projection's own locals are evaluated in each, and projecting a value for one prepared call never changes what another was prepared with.
- **Function references.** A function reference a local before the call holds is called in any projection, as one is anywhere within the script; a callback a projection gives a member lasts while that member's invocation does, as every callback given to a member does. A host call's arguments are values, so no function reference reaches the host.

```nexo
let room = sensor.room
let occupied = room.occupied()
return sensor.on("motion") { at = it.at, isOccupied = room.occupied(), wasOccupied = occupied }
```

Nexo requires no disposal of a prepared call, which starts nothing; the lifetime of whatever its host starts is the host's. A prepared call holds the locals and the references it was prepared with for as long as it is reachable. Each projection goes through the checks every evaluation does, the refusal of a resolution no longer [current](resolution.md#runtime-reuse) among them.

A host projects each value as it arrives, once for a value its call answers once and once for each of several it supplies over time, so the runtime treats them alike. Waiting for samples, cancellation between evaluations, keeping a result current and scheduling it, and the lifetime of whatever a host call starts, are the host's.
