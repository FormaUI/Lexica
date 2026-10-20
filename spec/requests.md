# Requests

<a id="requests"></a>

A request is one of four kinds, and the last member of its chain, before any object expression following it, decides which:

| Kind | Its chain ends in | Its caller |
| --- | --- | --- |
| Value | A value | Evaluates it once or watches it |
| Subscription | An event source | Subscribes to it |
| Action | An action | Executes it once, receiving its result |
| Behavior request | A behavior | Applies it, updates it with new bindings, and disposes it |

An action is a member its module carries out once when the caller executes the request, and a behavior one its module starts when the caller applies the request and runs until it is updated or disposed; each is a member kind of its own, which an extension declares, with signatures as every member has. An object expression can follow an action to shape its result.

An action or a behavior ends its request's chain, so one inside a value request, an argument or another request's object expression is a validation error.

Evaluating or watching a value request never performs an action or configures a behavior: a value request only reads, and an action or a behavior request acts only when its caller executes or applies it. A behavior belongs to the caller that applied it.

```lexica
// An action: dim the light to 40, answering the brightness it reached.
light.dim({ to = 40 })

// A behavior request: hold the thermostat at 21 degrees until it is disposed.
thermostat.hold({ target = 21 })
```

<a id="events"></a>

## Events

A chain that ends in an event source is subscribed to, in two stages. The source hands each event to the evaluator, which evaluates the object expression following it at once, in the task the source delivers it in, with that event as its implicit parameter.

The result is immutable data, and that result, never the host's own event object or the object expression still to evaluate, is what reaches the caller, by the caller's own delivery. An event is what its source delivers, read through the event data it captured; a host's own event object is never a value of the language.

Here the event source is a sensor's motion:

```lexica
sensor.on("motion") { at = it.at, strong = it.strength > 0.8, room = sensor.room.name }
```

The object expression reads the event's own data, such as its time, and anything else a parameter reaches. Its members are read once per event, never watched, so an unobserved member is allowed in it.

An event source documents its members, which of them it captured when the event happened, and when it delivers the event, such as before or after the host carries out what it reports; everything else it reads is read as it is evaluated.

Each subscription starts its event source with its own delivery, so two callers subscribed on one sensor each receive their own events.
