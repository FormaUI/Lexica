# Expressions

<a id="expressions"></a>

Expressions read values, compute new values and choose which values to read. All expressions are typed before evaluation. A branch that is not reached is still validated, but is not evaluated or observed.

In this document: [Expression structure and precedence](#expression-structure-and-precedence) · [Tests](#tests) · [Truthiness](#truthiness) · [Equalities](#equalities) · [Arithmetic](#arithmetic) · [Comparisons](#comparisons) · [Logical expressions, negations and groups](#logical-expressions-negations-and-groups) · [Conditionals](#conditionals) · [Coalescing operators](#coalescing-operators) · [Interpolated strings](#interpolated-strings).

<a id="expression-structure-and-precedence"></a>

## Expression structure and precedence

An operator is present only when its token is written. A value alone is not implicitly an equality, a test, a cast or a conversion.

The following table gives the relative binding of operators. Restrictions below still apply: sharing a row or appearing in the table does not make every combination legal.

| From tighter to looser | Forms |
| --- | --- |
| Member chains and projection | `.`, `?.`, `[…]`, `?[…]`, `:name[…]`, `?:name[…]`, `{ … }` |
| Casts and conversions | `as`, `to`; `try` applies to one cast or conversion |
| Arithmetic negation | Unary `-` |
| Multiplication and division | `*`, `/`, `%` |
| Addition and subtraction | `+`, `-` |
| Equality or numeric comparison | `==`, `!=`; `<`, `<=`, `>`, `>=` |
| Logical negation | `not` |
| Conjunction | `and` |
| Disjunction | `or` |

`??` has its own grouping rules. It must be separated by parentheses from binary arithmetic, equality, comparisons, `not`, `and` and `or`. See [Coalescing operators](#coalescing-operators).

<a id="expression-structure-and-precedence-equality-and-comparison-boundaries"></a>

### Equality and comparison boundaries

Equality does not chain: `a == b == c` is a syntax error. Group an equality when comparing its Boolean result: `(a == b) == c`.

Numeric comparisons may form a chain only when every operator points the same way. Group a comparison beside an equality: `(a < b) == c`.

<a id="expression-structure-and-precedence-cast-and-conversion-boundaries"></a>

### Cast and conversion boundaries

`as` begins a cast. Casts do not chain without parentheses, and a member chain continues from a cast only through a group.

`to` converts the value before it. Conversions written in succession run from left to right. A member chain continues from a conversion only through a group.

`to` remains usable as a declared name or member name:

| Use | Example |
| --- | --- |
| Field | `{ from = 1, to = 2 }` |
| Local | `{ let to = "3", value = @to to "number" }` |
| Caller binding | `~to` |
| Property | `range.to` |
| Call | `range.to()` |
| Indexer | `range:to[1]` |

<a id="expression-structure-and-precedence-attempt-boundaries"></a>

### Attempt boundaries

`try` must precede one conversion or cast. Group an inner operation to make clear which operation is attempted:

- `try (a to "string") to "number"` attempts the outer conversion.
- `try a to "string" to "number"` is a syntax error.
- `try device as "light" to "string"` is a syntax error.

<a id="expression-structure-and-precedence-conditional-bindings"></a>

### Conditional bindings

A conditional binding exists only where `let` follows `if` or `elseif`. It binds the whole condition after `=`. See [Conditionals](#conditionals).

<a id="expression-structure-and-precedence-members-require-their-punctuation"></a>

### Members require their punctuation

A name after a complete value cannot invoke a member without its punctuation. `device is "active"` is a syntax error that suggests `device.is(…)`.

A chain consists of its input and the member accesses and object expressions that continue it. `42` and `room` are chains with no continuation.

Conditions and the operands of `not`, `and` and `or` accept values and test their [truthiness](#truthiness), rather than requiring Boolean values.

<a id="tests"></a>

## Tests

A test answers a Boolean: a member that answers one, read as every member is, or a predicate asked with its verb.

```lexica
room.is("occupied")
room.device("lamp")?.is("active")
device.has("battery")
device.is(state)
```

<a id="tests-members"></a>

### Members

A test is a property or a function whose result is a `boolean` or a `boolean?`, or a predicate, asked with its verb: `it.is("occupied")` asks whether a room is occupied, and `it.has("battery")` whether a device has a battery. A test of presence is asked with `has`, and a state with `is`.

A test follows the access rules as every member does, so one of a receiver that can be null is read with `?.` and is a `boolean?`, and a bracket property access reads a Boolean property a binding names as it reads any other. A module declares a test as it declares any member or predicate.

<a id="tests-no-test-by-name-after-"></a>

### No test by name after `==`

`==` compares values, so `device == "active"` compares a device with a string, a validation error that gives the test to write, `device.is("active")`.

<a id="truthiness"></a>

## Truthiness

Only null and false are **falsey**. Every other value is **truthy**.

| Falsey | Truthy examples |
| --- | --- |
| `null`, `false` | `true`, `0`, `""`, `"false"`, empty lists, empty objects |

Conditions, conditional bindings, `and`, `or`, `not` and predicate arguments test truthiness. Testing truthiness converts nothing and invokes no conversion.

<a id="truthiness-declared-boolean-results"></a>

### Declared Boolean results

A member declared to return `boolean` must return a Boolean. Truthiness does not relax its contract: another result type is an evaluation error wherever the value is used.

<a id="truthiness-stable-references-and-narrowing"></a>

### Stable references and narrowing

A condition or a logical operand can establish facts about a stable reference: a local, conditional binding, parameter or implicit parameter. Each is tracked by identity, not spelling. A local in one object expression says nothing about a same-named local in another, and each nested implicit parameter has its own identity.

| Outcome | Guaranteed fact |
| --- | --- |
| A reference is truthy | It is not null |
| A reference is falsey | It is null or false |
| `ref == null` is true | `ref` is null |
| `ref != null` is true | `ref` is not null |
| `not e` | Reverses the guarantees of `e` |
| An `and` is truthy | Every operand was truthy; all their guarantees hold |
| An `or` is falsey | Every operand was falsey; all their guarantees hold |

When several paths can produce an outcome, only guarantees shared by all paths survive. A falsey `and` or truthy `or` may have stopped at different operands. `a != null or b != null` therefore guarantees neither value individually is non-null.

A member is read anew at each occurrence and is never narrowed. Bind its value to a local to test it once and reuse it.

<a id="truthiness-where-narrowing-applies"></a>

### Where narrowing applies

The right operand of `and` sees its left operand as truthy. The right operand of `or` sees its left operand as falsey.

A conditional's consequent sees its condition as truthy. Its alternative and later `elseif` clauses see that condition as falsey.

A narrowed Boolean remains a Boolean; the type system does not distinguish literal true from literal false.

<a id="truthiness-validation-and-evaluation"></a>

### Validation and evaluation

Narrowing changes neither evaluation nor the requirement to validate every operand and branch. Unreached operands and branches are not evaluated or observed and cannot cause runtime failures.

<a id="equalities"></a>

## Equalities

`a == b` compares two values, and `a != b` is its negation.

```lexica
mode == "eco"
room.device(name) == null
left:["mode"] == right:["mode"]
(try device as "light") == light
count != 0
```

<a id="equalities-comparison"></a>

### Comparison

Strings compare exactly, by code unit; numbers numerically, so `-0 == 0` is true; Booleans by value; and reference values by identity, so `a == b` asks whether they are the same value. Nothing is converted.

<a id="equalities-null"></a>

### Null

Null equals only null, and a value of any type is compared with null, one that cannot be null included, so `room.device(name) == null` asks whether the room has a device of that name.

<a id="equalities-types"></a>

### Types

Two values whose types fit neither way, as `"1" == 1` or a `room` with a `device`, reference types of two hierarchies, are a validation error naming both; a `light` and a `device` fit, as do a `number` and a `number?`. A structured value, a list and an object are compared with null alone, and an event source, an action or a behavior is no operand of `==` or `!=`.

<a id="equalities-results"></a>

### Results

An equality answers a `boolean`, never null, evaluating both operands once, from left to right, and a watch follows what both read. Where it decides a path, a comparison with null [narrows](#truthiness) a stable reference, so `a != null and a.battery` reads a local `a` that is not null; it narrows no member, which is read anew wherever it is written.

<a id="equalities-"></a>

### `!=`

`!=` has the definition of `not` around `==`, and the canonical text writes it so: `not (a == b)` and `not a == b` are both written `a != b`.

<a id="equalities-binding"></a>

### Binding

A dot binds tighter than `==`, and so do an indexer, a cast, a conversion, an attempt and arithmetic, so `device:["mode"] == null` tests the setting and `device.is("active") == false` tests the predicate.

An equality takes an additive expression on either side, including a chain, cast, conversion, attempt or arithmetic expression, and does not chain, so `a == b == c` is a syntax error and `(a == b) == c` compares the first's result; it stands beside a coalescing operator or a [comparison](#comparisons) only where a group holds one of them, `(count ?? 0) == 0` and `(a < b) == c`.

For a nullable Boolean `x`, comparing and negating answer differently where `x` is null:

| Expression | Where `x` is null | Same as |
| --- | --- | --- |
| `x == true` | false | `x ?? false` |
| `x == false` | false | `not (x ?? true)` |
| `x != true` | true | `not (x ?? false)` |
| `x != false` | true | `x ?? true` |

<a id="arithmetic"></a>

## Arithmetic

`+`, `-`, `*`, `/` and `%` compute with numbers, and `-` before a value negates it, so an expression derives the values it needs from the ones it reads: the gap to a target, a share of a total, a margin.

```lexica
thermostat {
    gap = it.target - (it.room.climate?.temperature ?? 0),
    half = it.power / 2,
    padded = it.target + 0.5
}
```

<a id="arithmetic-numbers-alone"></a>

### Numbers alone

Both operands are numbers, and nothing converts to one but `to`, so `"2" + 1` is a validation error and `+` joins no text. An operand that can be null is a validation error too, so missing data never becomes zero: give it a fallback, `(… ?? 0)`, or test it first.

<a id="arithmetic-precedence"></a>

### Precedence

An arithmetic negation binds tightest of them, then `*`, `/` and `%`, then `+` and `-`; operators of one level associate to the left, so `10 - 3 - 2` is 5, and parentheses group as they do anywhere.

Arithmetic binds tighter than an equality and a comparison and looser than a conversion, so `device:["level"] to "number" + 1` converts the setting and then adds one, a validation error since the setting can be missing, written `(device:["level"] to "number" ?? 0) + 1` to give it a fallback first, and `(a + b) to "string"` converts the sum. `-x to "number"` negates the converted value, and `(-x) to "number"` converts the negated one.

<a id="arithmetic-attempts"></a>

### Attempts

`try` applies to the conversion or the cast written after it, and that attempt is an operand of arithmetic, so `try x to "number" + 1` is `(try x to "number") + 1`, a validation error since its left operand can be null; `(try x to "number" ?? 0) + 1` gives its fallback first.

<a id="arithmetic-beside-"></a>

### Beside `??`

`??` and binary arithmetic stand apart, one of them grouped, as it stands apart from `and`, `or`, an equality and a comparison: `a ?? b + 1` is a syntax error, written `(a ?? b) + 1` or `a ?? (b + 1)`. An arithmetic negation is no binary arithmetic, so `value ?? -1` stands.

<a id="arithmetic-literals"></a>

### Literals

An arithmetic negation of a numeric literal is that negative literal in a definition, `-0` included, as the parsed text holds it, so `-5 to "string"` negates a conversion, a validation error since what `-` negates is a number, and `(-5) to "string"` converts the literal `-5`, giving `"-5"`.

<a id="arithmetic-evaluation"></a>

### Evaluation

The left operand is evaluated, then the right; arithmetic does not short-circuit, and an operand that fails fails it. Numbers are IEEE 754 doubles, so `0.1 + 0.2` is `0.30000000000000004`, and `%` is the remainder with the sign of the dividend, so `-5 % 3` is `-2`.

A division or a remainder by zero, and a result no finite number holds, are evaluation errors at the operation, so neither infinity nor NaN reaches a result.

<a id="arithmetic-watching"></a>

### Watching

Arithmetic reads what its operands read, and observes nothing of its own. A computed number is compared exactly, whatever tolerance a member it reads declares, since a product or a quotient changes the scale a tolerance was set for.

<a id="comparisons"></a>

## Comparisons

`<`, `<=`, `>` and `>=` order two numbers, and a chain of them pointing one way orders several, so an expression tests a value it reads or calculates against a bound or a range.

```lexica
room {
    isLarge = it.floorArea >= 20,
    comfortable = 19 < (it.climate?.temperature ?? 0) <= 23
}
```

<a id="comparisons-numbers-alone"></a>

### Numbers alone

Every operand is a number, as arithmetic's are, and nothing converts to one but `to`, so `"a" < "b"` is a validation error and text is ordered by no comparison. An operand that can be null is a validation error too: give it a fallback, `(w ?? 0) < 600`, or test it first. A comparison answers a `boolean`, never null.

<a id="comparisons-chains"></a>

### Chains

`0 < width <= 600` is `0 < width and width <= 600`, its middle operand evaluated once.

Every operator of a chain points one way, `<` and `<=` or `>` and `>=`, strict and inclusive mixed, so `a < b <= c` and `a >= b > c` are chains, and `a < b > c` is a syntax error at the `>` that turns it; a peak or a valley is written with `and`, as `b > a and b > c`.

A comparison in parentheses is a Boolean, so `(a < b) < c` is a validation error, never a chain.

<a id="comparisons-binding"></a>

### Binding

Arithmetic binds tighter than a comparison, and a comparison tighter than `not`, `and` and `or`, so `0 < width - padding * 2 <= 600 and enabled` reads as written and `not a < b` is `not (a < b)`.

A comparison stands at an equality's level and apart from it, one of them grouped, so `a < b == c` is a syntax error written `(a < b) == c`, and apart from a coalescing operator, so `w ?? 0 < 600` is written `(w ?? 0) < 600`.

<a id="comparisons-evaluation"></a>

### Evaluation

Operands are evaluated from left to right, each at most once, and the first comparison that is false answers false without evaluating the operands after it, as an `and` stops at a falsey operand.

Numbers compare as IEEE 754 doubles, so `-0 < 0` is false; every number an expression holds is finite, since a literal, a binding, a member's result, a conversion and arithmetic each give a finite number or none.

<a id="comparisons-watching"></a>

### Watching

A watch follows what the operands it evaluated read, and an operand a false comparison left unevaluated contributes nothing. A comparison answers a Boolean, which a snapshot compares exactly, so a member's tolerance does not soften its boundary: `width >= 600` changes each time a width crosses 600, and a boundary that should hold until a value moves further is the vocabulary's to declare.

<a id="logical-expressions-negations-and-groups"></a>

## Logical expressions, negations and groups

`and` and `or` answer the operand that decides them, `not` answers whether a value is falsey, and parentheses group any expression.

```lexica
light.is("active") and metered
device.is("offline") or (device.has("battery") and (device.battery ?? 0) < 10)
room { free = not it.is("occupied") and not busy }
room { let lamp = it.device("lamp"), power = lamp and lamp.power }
device:["label"] or "untitled"
```

<a id="logical-expressions-negations-and-groups-operands"></a>

### Operands

An operand of `and` and `or`, and what `not` negates, is any value, an event source, an action or a behavior being a validation error; each later operand sees what the operands before it guarantee where it is reached, as [narrowing](#truthiness) sets out.

<a id="logical-expressions-negations-and-groups-binding"></a>

### Binding

An equality binds tighter than `not`, `not` tighter than `and`, and `and` tighter than `or`, so `device.is("active") or not lamp == null and enabled` combines the negation of the lamp's equality and `enabled` before the device's test. `not` associates to the right, so `not not a` negates `a` twice, and `and not` and `or not` are `and` and `or` of a negation.

<a id="logical-expressions-negations-and-groups-results"></a>

### Results

`and` answers its first falsey operand, or its last where every one before it is truthy, and `or` its first truthy operand, or its last where every one before it is falsey, each as it is, never copied or converted: `null and "value"` is null, `0 or 10` is 0 and `"" or "fallback"` is the empty string.

`not` answers a `boolean`, true where its operand is falsey. Of Booleans, they answer what Boolean logic does.

<a id="logical-expressions-negations-and-groups-type"></a>

### Type

`and` is of the falsey part of each operand before its last, merged with its last, and `or` of the truthy part, merged with its last: a value that can be null has null for its falsey part and itself without null for its truthy part, a Boolean is a Boolean in both, and any other value is truthy only.

So `room.device(name) and 5` is a `number?`, `name or "untitled"` a `string` where `name` is a string, and Booleans give a `boolean`. Where fixed operands, literals and bound parameters, decide it, it is of the one that does, so `true and "value"` is a `string`.

Values no one type holds are a validation error, as `it.is("active") and it` in an object expression following a device, which gives false or a device: unlike Lua, Lexica types every expression, and offers no type for false or true beside another, so a conditional chooses between values of one type, `if it.is("active") then it else null end`, where null is an acceptable alternative.

<a id="logical-expressions-negations-and-groups-not-a-conditional"></a>

### Not a conditional

`and` and `or` choose a value only where the value that decides them is the one wanted: `true and false or "fallback"` is "fallback", since false is falsey, so a choice whose chosen value can be false or null is a conditional, `if condition then value else fallback end`.

<a id="logical-expressions-negations-and-groups-evaluation"></a>

### Evaluation

Operands are evaluated from left to right, each once, and evaluation stops at the first that decides the result, a falsey one for `and` and a truthy one for `or`, so the operands after it are unreached: they are still validated, but are not evaluated or observed and cannot produce runtime failures.

A watch follows the operands evaluation reached, so it holds what an operand reads only while evaluation reaches it.

<a id="logical-expressions-negations-and-groups-groups"></a>

### Groups

A parenthesized expression holds an expression and adds nothing of its own, so `((room))` is `room`, and as a chain input it can start a chain: `(room).devices.count`.

<a id="conditionals"></a>

## Conditionals

A conditional chooses a branch by truthiness. It starts with `if`, has a `then` branch and an `else` branch, and closes with `end`. Optional `elseif` clauses are tested in order.

Each branch is a [body](bodies-and-functions.md#bodies): one expression, or locals followed by `return`. Every branch of one conditional must use the same result style.

```lexica
if metered then light else thermostat end
if let lamp = room.device("lamp") then { name = lamp.name, power = lamp.power } else null end
if room.device("lamp")?.is("offline") then "lost" elseif room.device("lamp") == null then "none" else "ok" end
room { state = if it.is("occupied") then "busy" else "free" end }
{ let target = if metered then light else thermostat end, power = target.power }
```

The first answers a device, which no result holds, so it stands within a larger expression, as the conditional of the last does.

<a id="conditionals-conditions-and-selection"></a>

### Conditions and selection

A condition may be any value. An event source, action or behavior is not a condition and causes a validation error.

A truthy condition selects its consequent. A falsey condition continues to the next clause. If no condition is truthy, the `else` branch is selected.

The branches see the facts guaranteed by each condition's outcome; see [Truthiness](#truthiness). An always-truthy condition is valid, including a list. To test whether a list has items, use `items.count != 0`.

<a id="conditionals-conditional-bindings"></a>

### Conditional bindings

`if let name = value then … else … end` evaluates `value` once, binds it, and tests its truthiness.

| Bound value | Selected path |
| --- | --- |
| null or false | The next clause or `else` |
| Zero, empty text, empty list or any other truthy value | The consequent |

The name has the value's type without null. A Boolean remains a Boolean. A value that cannot be null can still select the alternative if it is false.

The name is visible throughout its consequent, including nested expressions. It is absent from its own initializer, the alternative and later `elseif` clauses.

Where no local, field or function parameter of that name is in scope, using the name in its own initializer is a structure error rather than a caller-binding reference: `if let k = k then …` is refused, and `if let k = ~k then …` reads the caller's binding. Where one is in scope, the initializer reads it. In the alternative and later clauses, the name again reads what it reads outside the conditional.

The name follows local naming rules, and may hide an outer local, field or caller binding. Event sources, actions and behaviors cannot be bound as conditional values. `elseif let` follows the same rules.

<a id="conditionals-branch-types"></a>

### Branch types

All branches are required. Their types must merge, with object types compared structurally and reference types of one hierarchy merging to the nearest supertype they share, as a list's items do. Nullability may differ.

| Branch types | Conditional type |
| --- | --- |
| `number`, `number?` | `number?` |
| `number`, `null` | `number?` |
| `light`, `thermostat` | `device` |
| `number`, `string` | Validation error naming both types |
| `room`, `device` | Validation error naming both types |

<a id="conditionals-evaluation-and-watching"></a>

### Evaluation and watching

Only the selected branch is evaluated. Its value is returned unchanged, including false or null. Every other branch is validated, but not evaluated or observed.

A watch follows each tested condition or bound value through the selected clause, then the selected branch.

<a id="conditionals-grouping-and-chain-receivers"></a>

### Grouping and chain receivers

A branch takes a whole body, including an ungrouped conditional. In `if a then b else c and d end`, the `and` belongs to the alternative.

A conditional used as a condition or as an operand of any operator, arithmetic, a comparison, `??` and `not` among them, must be grouped. For example: `if (if a then b else c end) then 1 else 2 end`.

A conditional cannot be a chain receiver, even when grouped. `(if metered then light else thermostat end).power` is a syntax error. Bind the conditional to a local first, then continue from the local.

There is no `?:` conditional form. Each `elseif` writes its entire condition or binding; it inherits nothing from the previous clause.

<a id="coalescing-operators"></a>

## Coalescing operators

A coalescing operator answers its value where it is not null, and otherwise its fallback: `value ?? fallback`.

```lexica
sensor.temperature ?? 0
device:["label"] ?? device:["name"] ?? "untitled"
room.device("lamp")?.is("active") ?? true
```

<a id="coalescing-operators-evaluation"></a>

### Evaluation

The value is evaluated once, and the fallback only where the value is null, so a watch follows what the fallback reads while the value is null alone. False, zero and the empty string are values, which the fallback never replaces.

A fallback that evaluation does not reach is still validated, but is not evaluated or observed and cannot produce runtime failures, and a failure of either side that evaluation does reach stays a failure.

<a id="coalescing-operators-null-alone"></a>

### Null alone

`??` falls back for null and `or` for null and false: `false ?? true` is false, and `false or true` is true. `try value to "number" ?? 0` gives a default for null alone, which an attempt's rejection is.

<a id="coalescing-operators-type"></a>

### Type

The value and the fallback are of one type, compared as a conditional's branches are, and the whole is of the value's type made non-null where the fallback's is, so `sensor.temperature ?? 0` is a `number`.

A value of the type `null` gives the fallback's type, and `??` after a value that cannot be null is valid, since a binding typed from its value may be one that can.

<a id="coalescing-operators-association"></a>

### Association

`??` associates to the right, so `a ?? b ?? 0` is `a ?? (b ?? 0)`, and each side is a chain, a cast, a conversion, an attempt or an arithmetic negation, or binary arithmetic only in a group, as arithmetic sets out.

<a id="coalescing-operators-grouping"></a>

### Grouping

A coalescing operator stands beside `not`, `and`, `or`, an equality and a comparison only where a group holds one of them, so `enabled ?? false and ready` and `a ?? b == null` are syntax errors, while `(enabled ?? false) and ready` and `enabled ?? (ready and visible)` each say what they mean.

<a id="interpolated-strings"></a>

## Interpolated strings

`$"…"` joins text and inserted values, and so do `$'…'` and the interpolated blocks, `$"""…"""` and `$'''…'''`. Each interpolation is `{`, one [simple expression](access-and-calls.md#simple-expressions), then `}`. Arithmetic `+` does not join text.

```lexica
room {
    label = $"{it.device("lamp")?:["level"] ?? "no"} level across {it.devices.count} devices",
    title = $"{{room}} {it.name}"
}
```

<a id="interpolated-strings-text-and-braces"></a>

### Text and braces

Text follows its family's rules: an interpolated string's and its block's escapes, consumed whole, so `\u{7B}` inserts a brace without opening an interpolation, and an interpolated raw string's literal backslashes and doubled quote, as `$'C:\Users\{name}\Documents\'` and `$'It''s {name}'` show.

Double a brace to include it as text, `{{` or `}}`, in both families. For a binding `name` equal to `Eyal`, `$"{{{name}}}"` produces `{Eyal}`, as `$'{{{name}}}'` does.

A lone `}` is a syntax error. `\{` is not an escape. Without `$`, every brace is text: `"Use {name}"` and `'Use {name}'` have no interpolation.

<a id="interpolated-strings-interpolation-expressions"></a>

### Interpolation expressions

An interpolation uses the scope and implicit parameter where the interpolated string appears. It may contain its own strings, objects, comments and interpolated strings, subject to the simple-expression restrictions.

An interpolation stands on one source line, its `{`, its expression and its `}`, in a block as inline: a line break in the expression, its comments or its strings is a syntax error, so no block stands in an interpolation, and a longer calculation belongs in a local whose name is interpolated.

An interpolation that begins with an object expression groups it in parentheses: `$"{({ x = 1 }.x)}"` inserts 1, and `$"{ { x = 1 }.x}"` is a syntax error suggesting the group, whatever whitespace or comment stands before the object expression; `{{` is always a literal brace in text. An empty interpolation is a syntax error.

<a id="interpolated-strings-accepted-values"></a>

### Accepted values

| Interpolation value | Inserted text |
| --- | --- |
| Non-null string | The string itself |
| Non-null number | The built-in number-to-string representation |
| Nullable value | Validation error; supply a fallback or test it first |
| Boolean, list, object, reference value or other value | Validation error; explicitly convert or choose text |

Negative zero inserts `0`, and `1e21` inserts `1e+21`. A nullable name can use `{name ?? "Unknown"}`. A Boolean can use `to "string"` or a conditional, such as `{if done then "Done" else "Pending" end}`.

Interpolation calls no module-registered conversion. The result is plain text, escaped for no other language.

<a id="interpolated-strings-result-and-evaluation"></a>

### Result and evaluation

An interpolated string returns a non-null `string` and can start a chain, like a string literal.

It cannot settle a fixed argument or a bracket property's possible names, even if it contains text alone. It also cannot replace a string literal required by the grammar, such as a cast or conversion type name.

Interpolations evaluate once each, from left to right. A shared local is evaluated once under the local's rules. A failed interpolation fails the entire string; no partial text is returned.

A watch follows the interpolations' dependencies and compares the resulting text exactly. A member's numeric tolerance does not carry into a number inserted as text.

<a id="interpolated-strings-canonical-text"></a>

### Canonical text

Canonical text always uses `$"…"`, with text escaped as an ordinary string and braces doubled. Each interpolation's expression is on one line, with no padding inside the braces, and one that begins with an object expression is grouped in parentheses.
