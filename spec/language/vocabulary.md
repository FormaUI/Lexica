# Vocabulary

<a id="vocabulary"></a>
<a id="vocabulary-contracts"></a>

A script's **vocabulary** is everything it can name beyond the language itself: the types, with their members and operators, the extensions, module members and type selectors of every module the registry it is resolved against holds, internal declarations aside. Nexo's own module is always among them, and every other module contributes by the same contracts, whatever its domain. A module's own specification gives its declarations and what each does in its domain; this document gives Nexo's own, and what a script makes of a Boolean function and a type selector, beside [members](members.md) and [types](types.md). How a module declares them, and its observations, is the runtime's, as [modules](../runtime/modules.md) and [observations](../runtime/observations.md) set out.

In this document:

1. [Nexo's own vocabulary](#vocabulary-nexos-own)
2. [Boolean functions](#vocabulary-boolean-functions)
3. [Type selectors](#events-and-event-types)

<a id="vocabulary-nexos-own"></a>

## Nexo's own vocabulary

Nexo's own module owns the language's types, `List`, `Dictionary`, `Pair`, `Number`, `String` and `Boolean` among them, and has no namespace. It declares `List<T>`, `Dictionary<K, V>` and `Pair<K, V>`, with their members, which [collections](collections.md) set out, whose type parameters the receiver supplies, so no member of them infers one again, a member declaring its own, as `select<U>` does, inferring it from its arguments as any member's are; `flatten`, which `List<T>` declares as its own for a list of lists, a receiver narrower than its own, so a list of lists alone has it and reads it with `.`; the members of a number, its rounding among them, and of a string, which interpolation alone joins; and the conversions between the language's types of data, as operators of those types. It declares no extension.

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
- **Nexo's own.** `String` is Nexo's own type, so its members, and its unnamed indexer, win over a member of the same name, or an unnamed indexer, that a module's extension of `String` declares, as [owners and extensions](extensions.md#extensions-owners) set out.

<a id="vocabulary-boolean-functions"></a>
<a id="predicates"></a>

## Boolean functions

A module declares a test of a receiver as a function whose result is a `Boolean`, as `Home` declares `active` and `offline` on `Device` and `occupied` on `Room`. It is a member as any other: its receivers, its implementation, its `updates`, the changes it misses and the observations that cover it are its declaration's, and its failures name it and its module. A script calls it directly, `device.active()`, through its module, `Home.active(device)`, or passes it by reference to a member that takes a function, `room.devices.where(Home.active)`, and each way reaches the one declaration, so a host's policy for a partly observable test concerns that test however it is reached.

A test is declared as a function, since only a function has a [reference](functions.md#functions-module-functions) a script passes; a property is read where it is written. Boolean functions compose as Booleans do: `device.active() and not device.offline()`.

Nexo declares no member that tests a receiver of any type, since how a test reads is a domain's: a module that wants one declares it for its own domain, a function taking a test of its receiver in an extension of every type, `{ name: 'Checks<T>', kind: 'extension', target: 'T' }`, as [type parameters](types.md#types-type-parameters) set out.

<a id="events-and-event-types"></a>

<a id="vocabulary-type-selectors"></a>

## Type selectors

A **type selector** is a declaration of a module that maps keys to types, so a function's fixed argument can choose the type the function answers. The home declares the selector `event`, whose keys are the reports a device makes: `"change"` maps to its structured type `Change`, of `setting` and `value`, and `"motion"` to `Motion`, of `at` and `strength`, so the values a host supplies for `sensor.on("motion")` are `Motion`s.

- **Its keys.** A module declares a selector and the keys it maps, as [type selectors](../runtime/type-selectors.md) set out; a key stands once in its selector, and never replaces another.
- **Selecting.** A function that selects through a selector takes the key as a [fixed argument](members.md#arguments-fixed), settled as every fixed argument is, and answers the type that key maps to, so `sensor.on("motion")` supplies `Motion`s; how a function declares the parameter that selects is the runtime's, as [type selectors](../runtime/type-selectors.md) set out.
- **A key the selector does not map** is a validation error naming the selector and the key.
