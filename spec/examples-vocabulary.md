# The examples' vocabulary

<a id="the-examples-vocabulary"></a>

Every example reads one fictional smart home, through the vocabulary of two modules a host registers, `home` and `energy`, and supplies to every script as its imports, so no example writes them. They are not part of the language, nor part of [Lexica's own vocabulary](vocabulary.md#vocabulary-lexicas-own): Lexica ships neither; they exist so the examples share one model whose types, names and relationships build on each other. A section that needs a declaration this table lacks adds it to the same home.

An example's bindings are supplied parameters, each bound by the host to a value of the type its name suggests: `room` is a `Room`, `device` a `Device`, `light` a `Light`, `thermostat` a `Thermostat`, `sensor` a `Sensor`, `rooms` a `List<Room>`, `name` a `String`, `property` a `String?`, `metered` a `Boolean` and `limit` a `Number`; any other name an example reads without declaring it is a binding of the type its use requires, as `preferred` and `fallback` are devices, `lamp` a light, and `living` and `bedroom` rooms. Declaring a type does not supply a value of it, so an example that reads `room` reads the room its host bound. The examples' home holds those values as fixtures, among them a device whose `level` setting is `"40"`.

**Types.** `home` declares five reference types, whose values have identity, and one structured type, whose values are data, each holding its members. Its `typeOf` recognizes each of the home's values as the most specific of its types, and each reference type's `isInstance` accepts the home's values of that type; `Device` is concrete, so a device that is not a light, thermostat or sensor is bound as a `Device`:

| Type | Kind | Supertype | What it is |
| --- | --- | --- | --- |
| `Room` | Reference | None | A room of the home |
| `Device` | Reference | None | Anything installed in a room |
| `Light` | Reference | `Device` | A dimmable light |
| `Thermostat` | Reference | `Device` | A heating controller |
| `Sensor` | Reference | `Device` | A temperature and motion sensor |
| `Climate` | Structured | | Its stored properties `temperature: Number` and `humidity: Number`, a room's climate |

**Members.** Each member's result type, how it changes and what it reads:

| Member | Signature | Changes | Reads | Tolerance |
| --- | --- | --- | --- | --- |
| `home.rooms` | `List<Room>` | Observable: `placement` | Fresh | |
| `home.now` | `Number`, the time in seconds | Unobserved | Fresh | |
| `room.name` | `String` | Constant | Fresh | |
| `room.devices` | `List<Device>` | Observable: `placement` | Fresh | |
| `room.floorArea` | `Number`, in square meters | Constant | Fresh | |
| `room.climate` | `Climate?`, null where the room has no sensor | Observable: `Climate` | Fresh | |
| `room.highestTemperature` | `Number?`, in degrees, the highest temperature the room has reported since its host began to hold the evaluation, null where the room has no sensor | Observable: `Climate` | Captured | `0.5` |
| `room.device(name)` | `name`: `String` → `Device?` | Observable: `placement` | Fresh | |
| `device.name` | `String` | Constant | Fresh | |
| `device.room` | `Room` | Observable: `placement` | Fresh | |
| `device.power` | `Number`, in watts | Observable: `state` | Fresh | `1` |
| `device.battery` | `Number?`, a percentage, null for a wired device | Partly observable: `state`, missing the drain between the device's reports | Fresh | `1` |
| `device.setting[name]`, and the unnamed indexer `device[name]`, which reads the same setting | `name`: `String` → `String?` | Observable: `state` | Fresh | |
| `light.brightness` | `Number`, from 0 to 100 | Observable: `state` | Fresh | `1` |
| `thermostat.target` | `Number`, in degrees | Observable: `state` | Fresh | |
| `sensor.temperature` | `Number?`, in degrees, null before the first reading | Observable: `reading` | Maintained | `0.5` |

A setting is a string, so an example that needs a number converts it, as `device["level"] to Number` does.

**Boolean functions.** The home's tests, each a function of its receiver that takes no arguments and answers a `Boolean`, called as `device.active()` or passed to a verb as `device.is(home.active)`:

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
| `device.on(type)` | `type`, a fixed `String` that selects through the selector `event` → `@selected` | Listens to the device's reports of that type, and supplies each as it arrives: `change`, `{ setting: String, value: String? }`, the setting that changed and its new value; `motion`, `{ at: Number, strength: Number }`, when and how strongly it sensed motion, which a sensor alone reports |
| `light.dim({ to })` | `to`: `Number`, optional, `0` by default → `Number` | Dims the light once, and supplies the brightness reached |
| `thermostat.hold({ target, until })` | `target`: `Number`, `until`: `Number?`, no result | Holds the target until `until`, or until the host ends it, and supplies nothing |

`home` declares the type selector `event`, whose keys `change` and `motion` map to the two types above.

**The `energy` module** extends `home`'s `Device`, in an extension of that type, with what an energy meter knows:

| Member | Signature | Changes | Tolerance |
| --- | --- | --- | --- |
| `device.usage` | `Number`, in kilowatt-hours today | Observable: `meter` | `0.1` |
| `device.power` | `Number`, in watts, as the meter measured it | Observable: `meter` | `1` |
| `device.meter` | `Meter`, the device itself, as its meter sees it | Constant | |

Its observation type `meter`, of the receiver, is an invalidation, reporting each new meter reading.

`energy` also declares the reference type `Meter`, the meter's view of a device: `device.meter`, a constant `Meter`, answers the device itself, which `Meter`'s `isInstance` accepts, since it accepts every device, and a declared cast from `Meter` to `home.Device`, with no `impl`, answers it as a device again. `device as Meter` is refused, because the declared cast goes from `Meter` to `Device` only; `Meter` accepting every device doesn't make the two types related.

`device.usage` is an extension, read as `device.usage` or in its qualified form, `energy.usage(device)`. `device.power` is declared both by `home`, which owns `Device`, and by `energy`: written `device.power`, it reads `home`'s, since the owner's member wins, and `energy.power(device)` reads the meter's.
