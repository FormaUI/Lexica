# The examples' vocabulary

<a id="the-examples-vocabulary"></a>

Every example reads one fictional smart home, through the vocabulary of two modules a host registers, `home` and `energy`. They are no part of the language, and no part of [Lexica's own vocabulary](vocabulary.md#vocabulary-lexicas-own): Lexica ships neither; they exist so the examples share one model whose types, names and relationships build on each other. A section that needs a declaration this table lacks adds it to the same home.

An example's bindings are supplied parameters, each bound by the host to a value of the type its name suggests: `room` is a `room`, `device` a `device`, `light` a `light`, `thermostat` a `thermostat`, `sensor` a `sensor`, `rooms` a `list<room>`, `name` a `string`, `property` a `string?`, `metered` a `boolean` and `limit` a `number`; any other name an example reads without declaring it is a binding of the type its use requires, as `preferred` and `fallback` are devices, `lamp` a light, and `living` and `bedroom` rooms. Declaring a type supplies no value of it, so an example that reads `room` reads the room its host bound. The examples' home holds those values as fixtures, among them a device whose `level` setting is `"40"`.

**Types.** `home` declares five reference types, whose values have identity, and one structured type, whose values are data:

| Type | Kind | Supertype | What it is |
| --- | --- | --- | --- |
| `room` | Reference | None | A room of the home |
| `device` | Reference | None | Anything installed in a room |
| `light` | Reference | `device` | A dimmable light |
| `thermostat` | Reference | `device` | A heating controller |
| `sensor` | Reference | `device` | A temperature and motion sensor |
| `climate` | Structured | | `{ temperature: number, humidity: number }`, a room's climate |

**Members.** Each member's result type, how it changes and what it reads:

| Member | Signature | Changes | Reads | Tolerance |
| --- | --- | --- | --- | --- |
| `home.rooms` | `list<room>` | Observable: `placement` | Fresh | |
| `home.now` | `number`, the time in seconds | Unobserved | Fresh | |
| `room.name` | `string` | Constant | Fresh | |
| `room.devices` | `list<device>` | Observable: `placement` | Fresh | |
| `room.floorArea` | `number`, in square meters | Constant | Fresh | |
| `room.climate` | `climate?`, null where the room has no sensor | Observable: `climate` | Fresh | |
| `room.highestTemperature` | `number?`, in degrees, the highest temperature the room has reported since its host began to hold the evaluation, null where the room has no sensor | Observable: `climate` | Captured | `0.5` |
| `room.device(name)` | `name`: `string` → `device?` | Observable: `placement` | Fresh | |
| `device.name` | `string` | Constant | Fresh | |
| `device.room` | `room` | Observable: `placement` | Fresh | |
| `device.power` | `number`, in watts | Observable: `state` | Fresh | `1` |
| `device.battery` | `number?`, a percentage, null for a wired device | Partly observable: `state`, missing the drain between the device's reports | Fresh | `1` |
| `device:setting[name]`, the default indexer `device:[name]` | `name`: `string` → `string?` | Observable: `state` | Fresh | |
| `light.brightness` | `number`, from 0 to 100 | Observable: `state` | Fresh | `1` |
| `thermostat.target` | `number`, in degrees | Observable: `state` | Fresh | |
| `sensor.temperature` | `number?`, in degrees, null before the first reading | Observable: `reading` | Maintained | `0.5` |

A setting is a string, so an example that needs a number converts it, as `device:["level"] to number` does.

**Boolean functions.** The home's tests, each a function of its receiver that takes no arguments and answers a `boolean`, called as `device.active()` or passed to a verb as `device.is(home.active)`:

| Function | Answers | Changes |
| --- | --- | --- |
| `device.active()` | Whether the device is switched on | Observable: `state` |
| `device.offline()` | Whether the device has stopped reporting | Partly observable: `state`, missing a device that stops reporting before its timeout |
| `device.batteryPowered()` | Whether the device runs on a battery | Constant |
| `device.dimmable()` | Whether the device can be dimmed | Constant |
| `room.occupied()` | Whether someone is in the room | Observable: `presence` |

**Observation types.** What a member names to learn that its result may have changed:

| Observation type | Of | Contract | Reports |
| --- | --- | --- | --- |
| `placement` | The home | Invalidation | A room added or removed, or a device installed in a room, removed from it or moved to another |
| `state` | The receiver | Invalidation | A device's state, settings, power or battery report |
| `climate` | The receiver | Invalidation | A new reading from a sensor in the room |
| `presence` | The receiver | Invalidation | A room becoming occupied or empty |
| `reading` | The receiver | Maintained | Each temperature a sensor reports, kept as its sample |

`home` declares the observation target `home`, the home itself, which `placement` observes.

**Host calls.** Functions the host invokes, and the values it supplies for each:

| Member | Signature | What the host does, and the values it supplies |
| --- | --- | --- |
| `device.on(type)` | `type`, a fixed `string` that selects through the selector `event` → `@selected` | Listens to the device's reports of that type, and supplies each as it arrives: `change`, `{ setting: string, value: string? }`, the setting that changed and its new value; `motion`, `{ at: number, strength: number }`, when and how strongly it sensed motion, which a sensor alone reports |
| `light.dim({ to })` | `to`: `number`, optional, `0` by default → `number` | Dims the light once, and supplies the brightness reached |
| `thermostat.hold({ target, until })` | `target`: `number`, `until`: `number?`, no result | Holds the target until `until`, or until the host ends it, and supplies nothing |

`home` declares the type selector `event`, whose keys `change` and `motion` map to the two types above.

**The `energy` module** extends `home`'s `device` with what an energy meter knows:

| Member | Signature | Changes | Tolerance |
| --- | --- | --- | --- |
| `device.usage` | `number`, in kilowatt-hours today | Observable: `meter` | `0.1` |
| `device.power` | `number`, in watts, as the meter measured it | Observable: `meter` | `1` |

Its observation type `meter`, of the receiver, is an invalidation, reporting each new meter reading.

`device.usage` is an extension, read as `device.usage` or in its qualified form, `energy.usage(device)`. `device.power` is declared both by `home`, which owns `device`, and by `energy`: written `device.power`, it reads `home`'s, since the owner's member wins, and `energy.power(device)` reads the meter's.
