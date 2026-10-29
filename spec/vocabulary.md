# Vocabulary

<a id="vocabulary"></a>
<a id="vocabulary-contracts"></a>

A script's **vocabulary** is everything it can name beyond the language itself: the types, with their members and operators, the extensions, module members, type selectors and observation types of every module the registry it is resolved against holds, internal declarations aside. Nexo's own module is always among them, and every other module contributes by the same contracts, whatever its domain. A module's own specification gives its declarations and what each does in its domain; this document gives the contracts every one keeps, beside [members](members.md) and [types](types.md).

In this document:

1. [Nexo's own vocabulary](#vocabulary-nexos-own)
2. [Boolean functions](#vocabulary-boolean-functions)
3. [Observations](#observations)
4. [Type selectors](#vocabulary-type-selectors)
5. [Conversions](#vocabulary-conversions)

<a id="vocabulary-nexos-own"></a>

## Nexo's own vocabulary

Nexo's own module owns the language's types, `List`, `Dictionary`, `Pair`, `Number`, `String` and `Boolean` among them, and has no namespace. It declares `List<T>`, `Dictionary<K, V>` and `Pair<K, V>`, with their members, which [collections](collections.md) set out, whose type parameters the receiver supplies, so no member of them infers one again, a member declaring its own, as `select<U>` does, inferring it from its arguments as any member's are; an extension of lists of lists, `NestedListExtensions<T>`, whose `flatten` a list of lists alone has; the members of a number, its rounding among them, and of a string, which interpolation alone joins; and the conversions between the language's types of data, as operators of those types.

<a id="vocabulary-number-members"></a>

### Number members

A member following a number is a member of the number itself, and reads and changes as the number does: `rect.width.round` rounds a width.

| Number member | Contract |
| --- | --- |
| `round` | The nearest whole number, a half rounded away from zero, so `2.5.round` is `3` and `(-2.5).round` is `-3` |
| `floor`, `ceiling`, `truncate` | The nearest whole number at or below the number, at or above it, and toward zero |
| `abs` | The number's absolute value |
| `min(other)`, `max(other)` | The lesser and the greater of the number and `other` |
| `clamp(low, high)` | The number within `low` and `high`, inclusive: `low` where it is less, `high` where it is greater; a `low` greater than `high` is refused where it is evaluated (NEXO5039) |
| `sequence(count, step)` | The `List<Number>` of the count's numbers from the number, each the step after the one before, `step` 1 where it is left out; a count that is no nonnegative safe integer is refused (NEXO5035) |

- **Properties and functions.** A member that takes nothing is a property, as a list's `reverse` is, and one that takes a number a function.
- **Rounding.** `round` is symmetric under negation, `(-x).round == -(x.round)`, which offsets and differences that can be negative need, so it rounds a negative half away from zero where ECMAScript's `Math.round` rounds it toward positive infinity. Rounding to a step is written by arithmetic around it, `(x * 2).round / 2`.
- **Zero.** Each member answers `0` where it would answer `-0`, so `(-0.4).round` is `0`.

<a id="vocabulary-string-members"></a>

### String members

A member following a string is a member of the string itself, and reads and changes as the string does. Each counts in UTF-16 code units, as [ordering](collections.md#collections-list-ordering) compares strings and as a host's text holds them, and joining texts is [interpolation](expressions.md#interpolated-strings)'s, `$"{prefix}{name}"`.

| String member | Contract |
| --- | --- |
| `length` | The number of code units, so a character outside the basic plane counts two |
| `trim` | The text without the whitespace at either end: tab, line feed, vertical tab, form feed, carriage return, U+FEFF, U+2028, U+2029 and every space separator |
| `lowercase`, `uppercase` | The text under Unicode's default case conversion, its full mappings, without a locale, so its length can change, as `"ß".uppercase` is `"SS"` |
| `startsWith(text)`, `endsWith(text)`, `contains(text)` | Whether the string begins with, ends with or holds `text`, exactly by code unit |
| `indexOf(text)` | The position of `text`'s first occurrence, a `Number?`, null where it stands nowhere |
| `replace(old, new)` | The string with every occurrence of `old` replaced by `new`, literally, left to right, no two overlapping |
| `split(separator)` | A `List<String>`, the parts between the occurrences of `separator`, in order: an empty part where two occurrences meet or one stands at either end, and the string alone where it holds none |
| The unnamed indexer, `[range]` | A `String`, the code units within the [range](collections.md#collections-positions), applied to its length once; a range whose start stands after its end, or either beyond the string, is refused where it is evaluated (NEXO5033), as a list's slice is |

- **The empty text** stands at every position, so `startsWith("")`, `endsWith("")` and `contains("")` are true and `indexOf("")` is `0`. It has no occurrence to replace or to split at, so `replace("", new)` and `split("")` are refused where they are evaluated (NEXO5040), never inserting between code units or splitting into them.
- **Characters kept whole.** A slice's boundary standing between the two halves of a surrogate pair is refused where it is evaluated (NEXO5041), so slicing never makes a well-formed text ill-formed. The other members compare code units exactly, so a text holding a lone surrogate, which only a host can give, is matched as it is: `split` at one parts a pair it finds.
- **What it doesn't do.** No member reads a regular expression, a locale's case or comparison, or a number's format: a text whose domain gives it a form of its own, as `"120px"`, is read by that domain's members or conversions.
- **Nexo's own.** `String` is Nexo's own type, so its members, and its unnamed indexer, win over a member of the same name, or an unnamed indexer, that a module's extension of `String` declares, as [owners and extensions](modules.md#namespaces-owners-and-extensions) set out.

<a id="vocabulary-boolean-functions"></a>
<a id="predicates"></a>

## Boolean functions

A module declares a test of a receiver as a function whose result is a `Boolean`, as `Home` declares `active` and `offline` on `Device` and `occupied` on `Room`. It is a member as any other: its receivers, its implementation, its `updates`, the changes it misses and the observations that cover it are its declaration's, and its failures name it and its module. A script calls it directly, `device.active()`, through its module, `Home.active(device)`, or passes it by reference to a member that takes a function, `room.devices.where(Home.active)`, and each way reaches the one declaration, so a host's policy for a partly observable test concerns that test however it is reached.

A test is declared as a function, since only a function has a [reference](functions.md#functions-module-functions) a script passes; a property is read where it is written. Boolean functions compose as Booleans do: `device.active() and not device.offline()`.

Nexo declares no member that tests a receiver of any type, since how a test reads is a domain's: a module that wants one declares it for its own domain, a function taking a test of its receiver in an extension of every type, `{ name: 'Checks<T>', kind: 'extension', target: 'T' }`, as [type parameters](types.md#types-type-parameters) set out.

<a id="observations"></a>

## Observations

An **observation** is what a member names to learn that its result may have changed, or to keep the sample it reads. The member declares it, Nexo validates it, and the host starts it where it follows what an evaluation read, and stops it where it no longer does; how a host shares and ends observations is its own.

<a id="observations-types"></a>

### Observation types

An **observation type** is a declaration of a module, named once across every module: its name, conventionally in camelCase, its contract, which is one of two, the arguments that belong to an observation's identity, whether equivalent requests share one, and its implementation.

| Contract | What it reports |
| --- | --- |
| Invalidation | That a result it covers may have changed, so the host evaluates again, as `state` reports a device's new report. |
| Maintained | Each sample it keeps, which the member that names it reads as its latest, as `reading` keeps each temperature a sensor reports. |

<a id="observations-types-the-request"></a>

Its implementation receives the **request** an observation makes, `{ type, target, arguments }`: the observation type's name; the target the observation observes, the receiver, a target its host resolved or the value of the member's argument it names; and the arguments the observation gives its type, by name, each argument reference resolved to the value the call gives it. The host builds the request as it starts the observation, since Nexo starts none.

<a id="observations-targets"></a>

### Observation targets

An **observation target** is what a module declares an observation may observe besides the receiver and an argument, by a name of its own: a target independent of any receiver, as the home is, or one found from the receiver, `from: 'receiver'`; and one target, or several, `count: 'many'`. A target that omits `from` is independent of the receiver, and one that omits `count` is one target.

Nexo does not know any target by name: it validates the declarations and every reference to them, and the host resolves each target when it starts an observation, so a host's module declares the targets its domain needs and the host resolves them itself. `receiver` names the receiver alone, so no module declares a target by that name, and an argument is named as `{ argument }`, never by a bare name, so a target and an argument are never mistaken for each other.

<a id="observations-naming"></a>

### Naming observations

A member names its observations by type, each of its receiver, of an argument, or of an observation target its observation type's module declares, as `placement` is of the home, and gives the arguments its type takes: a literal, a list of values, or an argument of the member, `{ argument }`, which can carry a prefix, a string joined before the argument of a value parameter of type `String`. A target the observation type's module does not declare is refused when the module is registered.

An observable member names observations that cover every change to its result, a partly observable one those it can make, and a member of any other category names none. A member that reads maintained values names a maintained observation, whose sample it reads; no other member does. A maintained observation gives its member one sample, so it observes one target, never a target of several. A module member, which has no receiver, does not observe a target found from one.

<a id="events-and-event-types"></a>

<a id="vocabulary-type-selectors"></a>

## Type selectors

A **type selector** is a declaration of a module that maps keys to types, so a function's fixed argument can choose the type the function answers. The home declares the selector `event`, whose keys are the reports a device makes: `"change"` maps to its structured type `Change`, of `setting` and `value`, and `"motion"` to `Motion`, of `at` and `strength`, so the values a host supplies for `sensor.on("motion")` are `Motion`s.

- **Declaring a selector.** A module declares a selector in its `typeSelectors` by its name alone. A selector is named once across every module, unlike a type, which is named once within its module, so a selector's name identifies the module that declares it, and a module declaring a selector of a name already declared is refused at registration with a module error naming the selector and the module that declared it.
- **Its keys.** A module declares each key in its `mappings`, a **mapping** of the `selector` it belongs to, the `key` and the `type` it maps to, `{ selector: 'event', key: 'motion', type: 'Motion' }`, its key any string, as a fixed argument may give any, and its type a named type of the declaring module or one of Nexo's own written unqualified and a foreign type qualified, as [type identity](types.md#types-type-identity) sets out. A mapping never writes an object's shape in place: a key whose values are objects maps to a named structured type, as `motion` maps to `Motion`, whose properties `at` and `strength` hold a motion's data. A mapping's selector and key together are its identity, and different selectors may share a key. Any module declares keys for any selector, its own or one a module registered before it declares, so one module extends another's selector as it extends another's types, and is registered after the module it extends. A key stands once in its selector across every registered module: a second, from the same module or another, is refused at registration with a module error naming the selector, the key and the module that declared it first, and no key once registered is replaced. A key of a selector no registered module declares is refused too.
- **Its revision.** Registering a module that adds keys advances the registry's revision, as every registration does; a key never replaces another, so the keys a resolution settled stay as they were, and whether it stays current is set out in [reusing a resolution](runtime.md#runtime-reuse).
- **Selecting.** A function's parameter that selects through a selector is fixed and names it, `fixed: true, selects: 'type', selector: 'event'`, and its argument settles as every [fixed argument](members.md#arguments-fixed) does. A function has at most one parameter that selects a type, since its `result` writes one `@selected` where the selected type stands, as `@selected` or `List<@selected>` does; a function with no parameter that selects a type writes none.
- **A key the selector does not map** is a validation error naming the selector and the key.

<a id="vocabulary-conversions"></a>

## Conversions

A **conversion** is a [conversion operator](modules.md#modules-operators) of a type of data, `{ kind: 'operator', name: 'convert', result: 'Number', impl }`, which `to` invokes and nothing else, and none from a type to itself. Several modules may each declare one from a source to a destination: they compete as every operator does, among those a script's imports make available, the owner's winning, the extension's whose target is more specific than every other's resolving where the owner declares none, and several none of which is more specific refused as ambiguous where a script converts so, as [owners and extensions](modules.md#namespaces-owners-and-extensions) set out. A destination written qualified identifies its type and never selects an operator, and an [extension access](members.md#property-access-calls-and-indexers-extension-access) reaches none. Its types are `Number`, `String`, `Boolean` and the structured types that hold data alone: a reference value is left to members, which declare how they change, so a conversion adds no dependency on a host's state. A module declares one in the members of its own source type, and in an extension where the source type is another module's and the destination its own, as `Measurements` declares one from `Number` to `Temperature`.

Its `impl` reads `value`, never null, and nothing else, and answers the converted value, or calls `reject(reason)` with a diagnostic string. `reject` throws a signal private to Nexo and to that attempt, so it never returns and the conversion stops where it calls it, unlike a promise's `reject`. What `to` and `try … to` make of a rejection and of any other failure is set out in [conversions](values.md#conversions) and [attempts](expressions.md#attempts).
