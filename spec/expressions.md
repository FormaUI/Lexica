# Expressions

<a id="expressions"></a>

Expressions read values, compute new values and choose which values to read. All expressions are typed before evaluation. A branch that is not reached is still validated, but is not evaluated or observed.

In this document:

1. [Expression structure and precedence](#expression-structure-and-precedence)
2. [Tests](#tests)
3. [Truthiness](#truthiness)
4. [Equalities](#equalities)
5. [Arithmetic](#arithmetic)
6. [Comparisons](#comparisons)
7. [Logical expressions, negations and groups](#logical-expressions-negations-and-groups)
8. [Conditionals](#conditionals)
9. [Do expressions](#do-expressions)
10. [Coalescing operators](#coalescing-operators)
11. [Attempts](#attempts)
12. [Interpolated strings](#interpolated-strings)
13. [Simple expressions](#simple-expressions)

<a id="expression-structure-and-precedence"></a>

## Expression structure and precedence

An operator is present only when its token is written. A value alone is not implicitly an equality, a test, a cast or a conversion.

The following table gives the relative binding of operators. Restrictions below still apply: sharing a row or appearing in the table does not make every combination legal.

| From tighter to looser | Forms |
| --- | --- |
| Member chains and projection | `.`, `?.`, `[…]`, `?[…]`, `.[…]`, `?.[…]`, `{ … }` |
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
| Object field | `{ from = 1, to = 2 }` |
| Local | `{ let to = "3", value = @to to Number }` |
| Script parameter | `~to` |
| Property | `range.to` |
| Call | `range.to()` |
| Indexer | `range.to[1]` |

<a id="expression-structure-and-precedence-attempt-boundaries"></a>

### Attempt boundaries

`try` must precede one conversion or cast. Group an inner operation to make clear which operation is attempted:

- `try (a to String) to Number` attempts the outer conversion.
- `try a to String to Number` is a syntax error.
- `try device as Light to String` is a syntax error.

<a id="expression-structure-and-precedence-conditional-bindings"></a>

### Where a conditional binding stands

A conditional binding exists only where `let` follows `if` or `elseif`. It binds the whole condition after `=`. See [Conditionals](#conditionals).

<a id="expression-structure-and-precedence-members-require-their-punctuation"></a>

### Members require their punctuation

A name after a complete value cannot invoke a member without its punctuation. `device active` is a syntax error that suggests `device.active`.

A chain consists of its input and the member accesses and object expressions that continue it. `42` and `room` are chains with no continuation.

Conditions and the operands of `not`, `and` and `or` accept values and test their [truthiness](#truthiness), rather than requiring Boolean values.

<a id="tests"></a>

## Tests

A test answers a Boolean: a member that answers one, read as every member is.

```nexo
room.occupied()
room.device("lamp")?.active()
device.batteryPowered()
room.anyDevice(it.battery != null)
```

<a id="tests-members"></a>

### Tests are members

A test is a property or a function whose result is a `Boolean` or a `Boolean?`: `it.occupied()` asks whether a room is occupied, and `it.batteryPowered()` whether a device runs on a battery. A member that takes a test calls the one it is given, as the home's `room.anyDevice(Home.active)` and `room.anyDevice(it.battery != null)` do, a module declaring such a member for its own domain.

A test follows the access rules as every member does, so one of a receiver that can be null is read with `?.` and is a `Boolean?`, and a computed property access reads a Boolean property a binding names as it reads any other. A module declares a test as it declares any member, a [Boolean function](vocabulary.md#vocabulary-boolean-functions).

<a id="tests-no-test-by-name-after-"></a>

### No test by name after `==`

`==` compares values, so `device == "active"` compares a device with a string, a validation error that gives the test to write, `device.active()`.

<a id="truthiness"></a>

## Truthiness

Only null and false are **falsey**. Every other value is **truthy**.

| Falsey | Truthy examples |
| --- | --- |
| `null`, `false` | `true`, `0`, `""`, `"false"`, empty lists, empty objects |

Conditions, conditional bindings, `and`, `or`, `not` and predicate arguments test truthiness. Testing truthiness converts nothing and invokes no conversion.

<a id="truthiness-declared-boolean-results"></a>

### Declared Boolean results

A member declared to return `Boolean` must return a Boolean. Truthiness does not relax its contract: another result type is an evaluation error wherever the value is used.

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

```nexo
mode == "eco"
room.device(name) == null
left["mode"] == right["mode"]
(try device as Light) == light
count != 0
```

<a id="equalities-comparison"></a>

### How values compare

Strings compare exactly, by code unit; numbers numerically, so `-0 == 0` is true; Booleans by value; and reference values by identity, so `a == b` asks whether they are the same value. Nothing is converted.

<a id="equalities-null"></a>

### Equality with null

Null equals only null, and a value of any type is compared with null, one that cannot be null included, so `room.device(name) == null` asks whether the room has a device of that name.

<a id="equalities-types"></a>

### Types an equality compares

Two values whose types fit neither way, as `"1" == 1` or a `Room` with a `Device`, reference types of two hierarchies, are a validation error naming both; a `Light` and a `Device` fit, as do a `Number` and a `Number?`. A structured value, a list and an object are compared with null alone, and a host call is not an operand of `==` or `!=`.

<a id="equalities-results"></a>

### What an equality answers

An equality answers a `Boolean`, never null, evaluating both operands once, from left to right, and reading what both read. Where it decides a path, a comparison with null [narrows](#truthiness) a stable reference, so `a != null and a.battery` reads a local `a` that is not null; it does not narrow a member, which is read anew wherever it is written.

<a id="equalities-"></a>

### `!=`

`!=` has the definition of `not` around `==`, and the canonical text writes it so: `not (a == b)` and `not a == b` are both written `a != b`.

<a id="equalities-binding"></a>

### How an equality binds

A dot binds tighter than `==`, and so do an indexer, a cast, a conversion, an attempt and arithmetic, so `device["mode"] == null` tests the setting and `device.active() == false` tests the function's answer.

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

```nexo
thermostat {
    gap = it.target - (it.room.climate?.temperature ?? 0),
    half = it.power / 2,
    padded = it.target + 0.5
}
```

<a id="arithmetic-numbers-alone"></a>

### Arithmetic takes numbers alone

Both operands are numbers, and nothing converts to one but `to`, so `"2" + 1` is a validation error and `+` joins no text. An operand that can be null is a validation error too, so missing data never becomes zero: give it a fallback, `(… ?? 0)`, or test it first.

<a id="arithmetic-precedence"></a>

### Arithmetic precedence

An arithmetic negation binds tightest of them, then `*`, `/` and `%`, then `+` and `-`; operators of one level associate to the left, so `10 - 3 - 2` is 5, and parentheses group as they do anywhere.

Arithmetic binds tighter than an equality and a comparison and looser than a conversion, so `device["level"] to Number + 1` converts the setting and then adds one, a validation error since the setting can be missing, written `(device["level"] to Number ?? 0) + 1` to give it a fallback first, and `(a + b) to String` converts the sum. `-x to Number` negates the converted value, and `(-x) to Number` converts the negated one.

<a id="arithmetic-attempts"></a>

### Attempts in arithmetic

`try` applies to the conversion or the cast written after it, and that attempt is an operand of arithmetic, so `try x to Number + 1` is `(try x to Number) + 1`, a validation error since its left operand can be null; `(try x to Number ?? 0) + 1` gives its fallback first.

<a id="arithmetic-beside-"></a>

### Beside `??`

`??` and binary arithmetic stand apart, one of them grouped, as it stands apart from `and`, `or`, an equality and a comparison: `a ?? b + 1` is a syntax error, written `(a ?? b) + 1` or `a ?? (b + 1)`. An arithmetic negation is not binary arithmetic, so `value ?? -1` stands.

<a id="arithmetic-literals"></a>

### Negative literals

An arithmetic negation of a numeric literal is that negative literal in a definition, `-0` included, as the parsed text holds it, so `-5 to String` negates a conversion, a validation error since what `-` negates is a number, and `(-5) to String` converts the literal `-5`, giving `"-5"`.

<a id="arithmetic-evaluation"></a>

### Evaluating arithmetic

The left operand is evaluated, then the right; arithmetic does not short-circuit, and an operand that fails fails it. Numbers are IEEE 754 doubles, so `0.1 + 0.2` is `0.30000000000000004`, and `%` is the remainder with the sign of the dividend, so `-5 % 3` is `-2`.

A division or a remainder by zero, and a result no finite number holds, are evaluation errors at the operation, so neither infinity nor NaN reaches a result.

<a id="arithmetic-watching"></a>

### What arithmetic reads

Arithmetic reads what its operands read, and does not name an observation of its own. A computed number has no tolerance of its own, whatever tolerance a member it reads declares, since a product or a quotient changes the scale a tolerance was set for.

<a id="comparisons"></a>

## Comparisons

`<`, `<=`, `>` and `>=` order two numbers, and a chain of them pointing one way orders several, so an expression tests a value it reads or calculates against a bound or a range.

```nexo
room {
    isLarge = it.floorArea >= 20,
    comfortable = 19 < (it.climate?.temperature ?? 0) <= 23
}
```

<a id="comparisons-numbers-alone"></a>

### Comparisons take numbers alone

Every operand is a number, as arithmetic's are, and nothing converts to one but `to`, so `"a" < "b"` is a validation error and text is ordered by no comparison. An operand that can be null is a validation error too: give it a fallback, `(w ?? 0) < 600`, or test it first. A comparison answers a `Boolean`, never null.

<a id="comparisons-chains"></a>

### Comparison chains

`0 < width <= 600` is `0 < width and width <= 600`, its middle operand evaluated once.

Every operator of a chain points one way, `<` and `<=` or `>` and `>=`, strict and inclusive mixed, so `a < b <= c` and `a >= b > c` are chains, and `a < b > c` is a syntax error at the `>` that turns it; a peak or a valley is written with `and`, as `b > a and b > c`.

A comparison in parentheses is a Boolean, so `(a < b) < c` is a validation error, never a chain.

<a id="comparisons-binding"></a>

### How a comparison binds

Arithmetic binds tighter than a comparison, and a comparison tighter than `not`, `and` and `or`, so `0 < width - padding * 2 <= 600 and enabled` reads as written and `not a < b` is `not (a < b)`.

A comparison stands at an equality's level and apart from it, one of them grouped, so `a < b == c` is a syntax error written `(a < b) == c`, and apart from a coalescing operator, so `w ?? 0 < 600` is written `(w ?? 0) < 600`.

<a id="comparisons-evaluation"></a>

### Evaluating a comparison

Operands are evaluated from left to right, each at most once, and the first comparison that is false answers false without evaluating the operands after it, as an `and` stops at a falsey operand.

Numbers compare as IEEE 754 doubles, so `-0 < 0` is false; every number an expression holds is finite, since a literal, a binding, a member's result, a conversion and arithmetic each give a finite number or none.

<a id="comparisons-watching"></a>

### What a comparison reads

An evaluation reads what the operands it evaluated read, and an operand a false comparison left unevaluated reads nothing. A comparison answers a Boolean, which carries no tolerance, so a member's tolerance does not soften its boundary: `(sensor.temperature ?? 0) >= 21` changes each time the temperature crosses 21, and a boundary that should hold until a value moves further is the vocabulary's to declare.

<a id="logical-expressions-negations-and-groups"></a>

## Logical expressions, negations and groups

`and` and `or` answer the operand that decides them, `not` answers whether a value is falsey, and parentheses group any expression.

```nexo
light.active() and metered
device.offline() or (device.batteryPowered() and (device.battery ?? 0) < 10)
room { free = not it.occupied() and not busy }
room { let lamp = it.device("lamp"), power = lamp and lamp.power }
device["label"] or "untitled"
```

<a id="logical-expressions-negations-and-groups-operands"></a>

### Logical operands

An operand of `and` and `or`, and what `not` negates, is any value, a host call being a validation error; each later operand sees what the operands before it guarantee where it is reached, as [narrowing](#truthiness) sets out.

<a id="logical-expressions-negations-and-groups-binding"></a>

### How logical expressions bind

An equality binds tighter than `not`, `not` tighter than `and`, and `and` tighter than `or`, so `device.active() or not lamp == null and enabled` combines the negation of the lamp's equality and `enabled` before the device's test. `not` associates to the right, so `not not a` negates `a` twice, and `and not` and `or not` are `and` and `or` of a negation.

<a id="logical-expressions-negations-and-groups-results"></a>

### What a logical expression answers

`and` answers its first falsey operand, or its last where every one before it is truthy, and `or` its first truthy operand, or its last where every one before it is falsey, each as it is, never copied or converted: `null and "value"` is null, `0 or 10` is 0 and `"" or "fallback"` is the empty string.

`not` answers a `Boolean`, true where its operand is falsey. Of Booleans, they answer what Boolean logic does.

<a id="logical-expressions-negations-and-groups-type"></a>

### The type of a logical expression

`and` is of the falsey part of each operand before its last, merged with its last, and `or` of the truthy part, merged with its last: a value that can be null has null for its falsey part and itself without null for its truthy part, a Boolean is a Boolean in both, and any other value is truthy only.

So `room.device(name) and 5` is a `Number?`, `name or "untitled"` a `String` where `name` is a string, and Booleans give a `Boolean`. Where fixed operands, literals and bound parameters, decide it, it is of the one that does, so `true and "value"` is a `String`.

Values no one type holds are a validation error, as `it.active() and it` in an object expression following a device, which gives false or a device: unlike Lua, Nexo types every expression, and does not offer a type for false or true beside another, so a conditional chooses between values of one type, `if it.active() then it else null end`, where null is an acceptable alternative.

<a id="logical-expressions-negations-and-groups-not-a-conditional"></a>

### Not a conditional

`and` and `or` choose a value only where the value that decides them is the one wanted: `true and false or "fallback"` is "fallback", since false is falsey, so a choice whose chosen value can be false or null is a conditional, `if condition then value else fallback end`.

<a id="logical-expressions-negations-and-groups-evaluation"></a>

### Evaluating a logical expression

Operands are evaluated from left to right, each once, and evaluation stops at the first that decides the result, a falsey one for `and` and a truthy one for `or`, so the operands after it are unreached: they are still validated, but are not evaluated or observed and cannot produce runtime failures.

An evaluation reads what the operands it reaches read, and nothing of the others.

<a id="logical-expressions-negations-and-groups-groups"></a>

### Parenthesized expressions

A parenthesized expression holds an expression and adds nothing of its own, so `((room))` is `room`, and as a chain input it can start a chain: `(room).devices.count`.

<a id="conditionals"></a>

## Conditionals

A conditional chooses a branch by truthiness. It starts with `if`, has a `then` branch and an `else` branch, and closes with `end`. Optional `elseif` clauses are tested in order.

Each branch is a [body](scripts.md#bodies): one expression, or locals followed by `return`. Every branch of one conditional must use the same result style. A conditional stands on one line, or in [block form](lexical-structure.md#line-structure-keyword-blocks).

```nexo
if metered then light else thermostat end
if let lamp = room.device("lamp") then { name = lamp.name, power = lamp.power } else null end
if room.device("lamp")?.offline() then "lost" elseif room.device("lamp") == null then "none" else "ok" end
room { state = if it.occupied() then "busy" else "free" end }
{ let target = if metered then light else thermostat end, power = target.power }
```

The first answers a device, which no result holds, so it stands within a larger expression, as the conditional of the last does.

<a id="conditionals-conditions-and-selection"></a>

### Conditions and selection

A condition may be any value. A host call is not a condition and causes a validation error.

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

Where no local, object field or function parameter of that name is in scope, using the name in its own initializer is a structure error rather than a read of the script parameter: `if let k = k then …` is refused, and `if let k = ~k then …` reads the script parameter. Where one is in scope, the initializer reads it. In the alternative and later clauses, the name again reads what it reads outside the conditional.

The name follows local naming rules, and may hide an outer local, object field or script parameter. A host call cannot be bound as a conditional value. `elseif let` follows the same rules.

<a id="conditionals-branch-types"></a>

### Branch types

All branches are required. Their types must [merge](types.md#types-merging), with object types merged by their object fields and reference types of one hierarchy merging to the nearest supertype they share, as a list's items do. Nullability may differ.

| Branch types | Conditional type |
| --- | --- |
| `Number`, `Number?` | `Number?` |
| `Number`, `null` | `Number?` |
| `Light`, `Thermostat` | `Device` |
| `Number`, `String` | Validation error naming both types |
| `Room`, `Device` | Validation error naming both types |

<a id="conditionals-evaluation-and-watching"></a>

### Evaluating a conditional

Only the selected branch is evaluated. Its value is returned unchanged, including false or null. Every other branch is validated, but not evaluated or observed.

An evaluation reads each tested condition or bound value through the selected clause, then the selected branch.

<a id="conditionals-grouping-and-chain-receivers"></a>

### Grouping and chain receivers

A branch takes a whole body, including an ungrouped conditional. In `if a then b else c and d end`, the `and` belongs to the alternative.

A conditional used as a condition or as an operand of any operator, arithmetic, a comparison, `??` and `not` among them, must be grouped. For example: `if (if a then b else c end) then 1 else 2 end`.

A conditional cannot be a chain receiver, even when grouped. `(if metered then light else thermostat end).power` is a syntax error. Bind the conditional to a local first, then continue from the local.

There is no `?:` conditional form. Each `elseif` writes its entire condition or binding; it inherits nothing from the previous clause.

<a id="bodies-conditional-branch-style"></a>

### Conditional branch style

Within one conditional, either every branch uses `return` or none does. If one branch declares locals, all its sibling branches must use `return`.

Mixing the styles is a syntax error:

> All branches of this conditional must give their results with return, or none of them

A nested conditional chooses its own style. An `else` whose expression is a conditional, `else if … end`, may follow branches of expressions with a conditional of either style, and may follow branches that use `return` with one whose branches use `return` too, the definition an `elseif` gives, which the canonical text writes as `elseif`. After branches that use `return`, an `else if … end` of expression branches is a syntax error.

<a id="do-expressions"></a>
<a id="bodies-using-a-bodys-value"></a>

## Do expressions

`do … end` is a [body](scripts.md#bodies) evaluated where it stands, giving its result: `doubled = do warmth * 2 end`, or a body of locals and `return`, written in [block form](lexical-structure.md#line-structure-keyword-blocks).

A `do` block or conditional must be grouped when used as an operand. Neither can be a chain receiver, grouped or not. Bind its value to a local before continuing a chain.

A [simple expression](#simple-expressions) cannot contain a `do` block or a full conditional. An argument that needs such a calculation uses a local holding its value.

<a id="coalescing-operators"></a>

## Coalescing operators

A coalescing operator answers its value where it is not null, and otherwise its fallback: `value ?? fallback`.

```nexo
sensor.temperature ?? 0
device["label"] ?? device["name"] ?? "untitled"
room.device("lamp")?.active() ?? true
```

<a id="coalescing-operators-evaluation"></a>

### Evaluating a coalescing operator

The value is evaluated once, and the fallback only where the value is null, so the fallback's reads are made only while the value is null. False, zero and the empty string are values, which the fallback never replaces.

A fallback that evaluation does not reach is still validated, but is not evaluated or observed and cannot produce runtime failures, and a failure of either side that evaluation does reach stays a failure.

<a id="coalescing-operators-null-alone"></a>

### Null alone

`??` falls back for null and `or` for null and false: `false ?? true` is false, and `false or true` is true. `try value to Number ?? 0` gives a default for null alone, which an attempt's rejection is.

<a id="coalescing-operators-type"></a>

### The type of a coalescing operator

The value and the fallback are of one type, compared as a conditional's branches are, and the whole is of the value's type made non-null where the fallback's is, so `sensor.temperature ?? 0` is a `Number`.

A value of the type `null` gives the fallback's type, and `??` after a value that cannot be null is valid, since a binding typed from its value may be one that can.

<a id="coalescing-operators-association"></a>

### Association

`??` associates to the right, so `a ?? b ?? 0` is `a ?? (b ?? 0)`, and each side is a chain, a cast, a conversion, an attempt or an arithmetic negation, or binary arithmetic only in a group, as arithmetic sets out.

<a id="coalescing-operators-grouping"></a>

### Grouping a coalescing operator

A coalescing operator stands beside `not`, `and`, `or`, an equality and a comparison only where a group holds one of them, so `enabled ?? false and ready` and `a ?? b == null` are syntax errors, while `(enabled ?? false) and ready` and `enabled ?? (ready and visible)` each say what they mean.

<a id="attempts"></a>

## Attempts

`try` attempts the one conversion or cast written after it, and answers null where that operation rejects its value: `try value to type` answers the converted value where the conversion accepts the value, and `try target as type` answers its target where it is of the type. Its type is the operation's, made nullable.

It handles a value its operation rejects without failing, as `??` handles a missing one, so the two together give a value either way:

```nexo
device { level = try it["level"] to Number ?? 0 }
(try room.device(name) as Light)?.brightness
```

A missing setting is null, which converts to null, and malformed text is rejected, so both give zero, and text that converts gives its number; a device that is not a light is rejected, so the brightness is null for it, as it is for a missing device.

A [conditional binding](#conditionals) gives the converted value a name where a script uses it more than once, `if let level = try it["level"] to Number then … else … end`.

<a id="attempts-one-operation"></a>

### One operation

`try` attempts the one conversion or cast written after it, and nothing else, so it is not a general catch of errors: a failure while its value is evaluated, a rejection by a conversion or a strict cast that value holds among them, fails the evaluation as it would anywhere, so `try (device as Light).room.device(name) as Light` attempts the outer cast alone.

A conversion of a conversion or of a cast is grouped to say which one is attempted, `try (a to String) to Number`, so `try a to String to Number` and `try device as Light to String` are syntax errors, as is `try` before anything that is neither, another `try` among them.

<a id="attempts-one-set-of-rules"></a>

### One set of rules

An attempt resolves as its operation does strictly, so a cast to a name that is not a reference type or of a target that can never be of it, a conversion to a target no type has, a pair no conversion is declared for, and a nullable value whose type has no conversion are validation errors for both.

It answers a value already of the type as it is, and null for null.

<a id="attempts-a-rejection-alone-is-null"></a>

### A rejection alone is null

A cast rejects a value of another type, and a conversion the value it calls `reject` for. A conversion that throws, rejects with a reason that is not a string, rejects and then answers, or answers a value not of its type has a fault, which fails the evaluation whether or not the conversion is attempted.

<a id="attempts-null-means-a-rejection"></a>

### Null means a rejection

For a non-null input, a successful conversion returns a non-null value of its declared target type. A conversion returning null is a fault, including under `try`. Consequently, for a stable bound value, `value != null and try value to type == null` is true exactly when the conversion rejects that value.

A cast answers its target itself, so the same holds for `try target as type`. Faults remain errors.

<a id="attempts-evaluation"></a>

### Evaluating an attempt

Its value is evaluated once and its operation carried out once, so it reads what its value reads.

<a id="attempts-binding"></a>

### How an attempt binds

`try` binds tighter than `==`, `!=` and `??`, and looser than the operation it attempts, so `try v to Number == 5` compares the converted value, `(try device as Light) != null` asks whether the device is a light, and `try v to Number ?? 0` gives its fallback for both null and a rejection.

It stands where an equality operand stands; a conversion of its result groups it, `(try v to Number) to String`, and a cast takes none as its target, so `(try a as Device) as Light` is a syntax error.

A result that keeps the converted number and tells a missing value from a malformed one says which it is beside the value, reading the setting once through a local:

```nexo
device {
    let level = it["level"],
    level = if let n = try level to Number then
        { status = "valid", value = n }
    elseif level == null then
        { status = "missing", value = null }
    else
        { status = "malformed", value = null }
    end
}
```

<a id="interpolated-strings"></a>

## Interpolated strings

`$"…"` joins text and inserted values, and so do `$'…'` and the interpolated blocks, `$"""…"""` and `$'''…'''`. Each interpolation is `{`, one [simple expression](#simple-expressions), then `}`. Arithmetic `+` does not join text.

```nexo
room {
    label = $"{it.device("lamp")?["level"] ?? "no"} level across {it.devices.count} devices",
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

Negative zero inserts `0`, and `1e21` inserts `1e+21`. A nullable name can use `{name ?? "Unknown"}`. A Boolean can use `to String` or a conditional, such as `{if done then "Done" else "Pending" end}`.

Interpolation does not call a module-registered conversion. The result is plain text, escaped for no other language.

<a id="interpolated-strings-result-and-evaluation"></a>

### Result and evaluation

An interpolated string returns a non-null `String` and can start a chain, like a string literal.

It cannot settle a fixed argument or a computed property's possible names, even if it contains text alone. It also cannot replace a string literal required by the grammar, such as a cast or conversion type name.

Interpolations evaluate once each, from left to right. A shared local is evaluated once under the local's rules. A failed interpolation fails the entire string; no partial text is returned.

An evaluation reads what its interpolations read. The string has no tolerance: a member's numeric tolerance does not carry into a number inserted as text.

<a id="simple-expressions"></a>

## Simple expressions

A **simple expression** is an expression allowed in a delimited value position:

- A member call's or local function call's argument.
- An indexer's key.
- The name expression in computed property access.
- An interpolation in an interpolated string.
- A collection expression's item, or a dictionary entry's value.

Simple expressions include values, references, arithmetic, comparisons, logical expressions, property accesses, indexers, function calls, and object expressions or interpolated strings whose contents are also simple. They also include a simple conditional: one `if` branch and one `else` branch, each containing one simple value.

```nexo
let calculate = function(degrees, offset) degrees - offset end
let adjusted = do
    let doubled = (sensor.temperature ?? 0) * 2
    return doubled + 1
end
return calculate(adjusted, if metered then 10 else 20 end)
```

<a id="simple-expressions-excluded-constructs"></a>

### Excluded constructs

A simple expression cannot contain a `do` block, a local declaration, a conditional binding, `return`, a function declaration, or a conditional beyond the simple form.

A function declaration is a syntax error there, as anywhere a function stands other than alone as a local's initializer, and so are a local declaration and `return` written where the value itself stands. The others are structure errors that ask for the value to be bound to a local first:

| Invalid expression | Reason |
| --- | --- |
| `calculate(do 10 end)` | Contains a `do` block |
| `calculate(if let t = sensor.temperature then t else 0 end)` | Contains a conditional binding |
| `calculate(…)` holding a conditional whose branches use `return`, in block form | Contains `return` |
| `$"Total: {do 10 end}"` | Contains a `do` block |

<a id="simple-expressions-recursive-restrictions"></a>

### Recursive restrictions

The restrictions apply through parentheses, conditional tests and branches, nested calls, indexers, computed property access, object fields, collection expressions and interpolations. Adding parentheses or line breaks does not change them.

`calculate((do 10 end))` is refused. `calculate((if metered then 10 else 20 end))` is allowed.

A simple conditional cannot contain another conditional anywhere within it. An `elseif`, a nested conditional in a branch, and a conditional inside a call or interpolation within that branch are all refused.

<a id="simple-expressions-calling-a-function"></a>

### Calling a function in an argument

The restriction applies to what is written at the argument position. A function called there may use locals, `do` blocks, full conditionals and `return` in its own body.

`calculate(double(degrees))` can therefore be valid. `calculate(double)` passes a function itself and is a validation error.

<a id="simple-expressions-validation"></a>

### Validating simple expressions

The grammar names these positions with `simple-expression`. Its productions can reach a parenthesized full expression, so structural validation also enforces the restrictions. It applies equally to parsed text and directly created definitions, and identifies the construct that violates them.
