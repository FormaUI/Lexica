# Proposal: line structure

**State: accepted.** Specified in language `1.0.0-alpha.34`, as [line structure](../../spec/lexical-structure.md#line-structure) sets out, and implemented with [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34)'s step 6 of the implementation plan, as [I31](implementation-decisions.md) records.

Related proposals: [script imports](script-imports.md), whose declarations each take a line of their own here.

## The principle

Line structure constrains which layouts are valid. It never decides where an expression ends, and never chooses between different readings. For the same non-trivia tokens, every accepted layout produces the same definition. Strings and comments retain their own lexical rules: changing a block string's lines can change its value, and moving where a line comment ends can expose or hide text.

A line break is trivia today, an expression ending at the first token that cannot continue it, and only inline strings and interpolations stay on one line. That parses safely, but leaves the shape of a script unstated:

```text
let a = room.climate let b = a?.temperature return b ?? 0
```

Nothing on that line shows where one local ends and the next begins. This proposal states, construct by construct, where a line may break, where it must, and where it cannot.

## Line breaks

- **A line break is LF, CRLF or a lone CR.** CRLF is one line break everywhere.
- **One definition serves every rule:** boundaries and one-line constructs, the end of a line comment, block strings, whose content continues to normalize each line break to LF, diagnostics, and source locations, whose line advances once for CRLF while offsets count both characters.
- **Vertical tab and form feed** are whitespace, never line breaks: they satisfy no boundary and end no line comment.
- **U+2028 and U+2029 are refused outside literal string text,** in code, in comments and in an interpolation's expression, which is code although it stands inside a string, with a syntax error naming the character. In literal string text they remain characters of the value, which canonical text writes escaped.
- **A line comment ends at the next line break or at the end of input,** which repairs today's rule that only LF ends one.

## The rules

Every position between two tokens is one of three kinds: inside a one-line construct, where a line break is refused; at a break point, where one is allowed; and at a boundary, where one is required, with no earlier code on that line. A broken rule is a syntax error naming the construct, never a different reading. A comment between two tokens stands for a line break only where it holds one, so a trailing comment after a completed construct is fine. The rules depend on written syntax alone, never on what a name resolves to.

### One-line constructs

| Construct | Example |
| --- | --- |
| A token | `floorArea`, `?.`, `=>`, `40` |
| An inline string, inline raw string, or interpolated string | `"lamp"`, `'C:\temp'`, `$"{name} is on"` |
| An interpolation, its `{`, its expression and its `}` | `{reading ?? 0}` |
| An import declaration | `import Sensor = Home.MotionSensor` |
| A body local's head, `let`, its name and `=` | `let reading =` |
| A conditional binding's head | `if let lamp =` |
| An object local's or a field's head | `let devices =`, `temperature =` |
| A member step, `.`, `?.`, `:` or `?:` with the name after it | `.where`, `?.temperature` |
| A computed property access's opening | `x.[`, `x?.[` |
| A call's `(`, on the line of the name it calls | `device(`, `double(` |
| An indexer's opening bracket, on the line of what it indexes | `setting[`, `rooms[`, `x?[` |
| An extension selector, `:` or `?:` with its extension's name, qualified or not | `:Energy.Device`, `?:Device` |
| A qualified name in a type position, after `as`, `to` or `import` | `as Home.Device`, `to Measures.Temperature` |
| A cast's or a conversion's keyword with its type | `as Light`, `to Number` |
| A prefix operator with the start of its operand | `-padding`, `not it.occupied()`, `try value to Number` |
| An object expression's `{`, on its receiver's line | `room {` |
| `function` with its `(` | `function (` |
| An arrow's parameters with its `=>` | `d =>`, `(a, b) =>` |
| A lexical reference or a script parameter | `@total`, `~home` |

A namespace's member read where a value stands, `Home.rooms`, is a chain, and follows the chain's break points.

### Break points

| Construct | Where it may break |
| --- | --- |
| Arguments, indexer keys, a parenthesized group, a computed property's expression | After `(` or `[`, after a comma, before `)` or `]` |
| A function's parameter list | After its `(`, after a comma, before its `)` |
| An object expression | After `{`, after a comma, before `}` |
| A chain | Before `.`, `?.`, `:` or `?:`, and before an extension access's `.member` |
| A binary operator | Before the operator, where its expression is enclosed, and never after it |
| A local's, a field's or a conditional binding's value | After its `=` |
| An arrow function | After `=>` |
| A conditional, a `do` block or a function expression | As keyword blocks set out |
| A block string or block raw string | Within it, by its own rules |

**Operator expressions.** The gaps around a binary operator, arithmetic, a comparison, an equality, `and`, `or` or `??`, follow their own rule. The gap after an operator never holds a line break, and the gap before one holds a line break only where the operator's expression is enclosed, so each continuation line starts with its operator. A break inside an operand follows that operand's own rules, so a chain breaks before its steps whether or not an operator follows it:

```text
let count = room.devices
    .count + 1
return count
```

An expression is **enclosed** where it stands directly in a parenthesized group, a call's argument, an indexer's key, a computed property's expression, or a condition, from `if` or `elseif` to its `then`. Enclosure belongs to that one position: an object's entry, a conditional's branch, and a body's locals and result, a `do` block's, a function's or an arrow's, start unenclosed again, whatever encloses them, so a line breaks before an operator there only inside parentheses of its own.

```text
gap = it.climate?.temperature
    - outside                    refused: nothing encloses the expression
gap = (it.climate?.temperature -
    outside)                     refused: the line ends with its operator
call({
    value = a
        + b                      refused: the call's parentheses enclose no entry
})
```

**Why.** An enclosure makes a continuation visible where its expression begins, and a line that starts with an operator outside one never continues the line above: `let a = b` followed by a line `-1` is refused, never read as `b - 1`. Breaking before the operator puts what continues a line at its start, as a chain's step does.

**Chains** break before each step without an enclosure, since a line that starts with `.`, `?.` or `:` can begin nothing else.

### Keyword blocks

A conditional, a `do` block and a function expression are each written in one of two shapes:

1. **On one line,** from its first keyword to its `end`: `if it.occupied() then "busy" else "free" end`, `do 1 end`.
2. **In block form,** once it spans lines at all: `if <condition> then` and `elseif <condition> then` each end their lines, `then` closing a condition's last line; `else`, `do` and a function's head each end their lines; each branch's or body's content starts on the line after; and `end` starts a line of its own, on which only closing punctuation, `,`, `)`, `]` or `}`, may follow it.

```text
label = if it.occupied() then
    "busy"
elseif it.reserved()
    or it.closed() then
    "held"
else
    "free"
end
```

A keyword block spans lines when any line break falls between its first keyword and its `end`, one inside a nested object, call, keyword block or block string included, so block form propagates outward through the keyword blocks around it.

What may follow `end` is this layout's limit, never the grammar's: `(do … end) + 2` reads as a sum, but in block form an expression continuing after the closing parenthesis does so on the line after `end`:

```text
return (do
    return 1
end
) + 2
```

Any mixture is refused: `then` on a line after its condition, a branch's content on its keyword's line in block form, `else "free" end` sharing a line, `end` after content on its line, or anything but closing punctuation after `end` on its line, `end) + 2` among them.

### Boundaries

Each of these starts on a line of its own, with no earlier code on that line:

- **Each import declaration.**
- **The script's body,** on a line after its last import.
- **In a body that uses `return`, each local and the `return`,** at every level: scripts, functions, `do` blocks and conditional branches, a body that uses `return` without locals included.

A body of one expression has no boundary, so `if metered then 1 else 2 end` and `do 1 end` stay on one line. Object locals stay comma-separated entries, `room { let devices = it.devices, count = devices.count }`, and a conditional binding belongs to its conditional's clause, `if let reading = sensor.temperature then reading else 0 end`; their heads still follow the one-line head rule. A keyword block holding a body that uses `return` is therefore in block form.

### Precedence

An enclosing one-line construct overrides every break point within it: `(a, b) =>` cannot break after its comma, an interpolation cannot break within an object or a call it holds, an import cannot break before its dot, and `as Home.Device` cannot break within its type name. Outside one-line constructs, a boundary or a keyword block's shape overrides a break point.

## Diagnostics

Each condition below is a syntax error, and takes its diagnostic code when it is introduced:

- A line break inside a one-line construct, naming the construct and what must share its line, and giving the form joined.
- An operator expression spanning lines where nothing encloses it, or a line ending with a binary operator.
- A keyword block that spans lines outside block form, giving the block form.
- An import, a body after its imports, or a local or `return` of a body that uses `return`, sharing its line with earlier code.
- U+2028 or U+2029 outside literal string text, naming the character.

## Canonical text

- **`format`** follows the structural layout alone and never wraps: imports, bodies, objects and conditionals as before, a keyword block in block form wherever it spans lines, an expression continuing after a block's `end` on the line after it, and an operator expression on one line. Formatting discards source parentheses only where the definition can be written without them while preserving its grouping and satisfying the syntax, so `(a + b` followed by `- c) * d` keeps its parentheses, joined.
- **`quote`** writes compact, parseable text, inserting the line breaks required by boundaries and keyword-block rules, including requirements propagated from nested constructs, and keeps a chain or an expression without them on one line.
- **Operator breaks** come before the operator, the only position accepted, as chains continue on the line a step starts.
- **Wrapping by width is deferred.** A specified width could still give deterministic canonical text; it is deferred as additional layout policy and implementation work. Wherever wrapping arrives, one-line constructs stay intact even past the width.

For valid source, the source-preserving formatter of the tooling retains authored line breaks and parentheses. Invalid source receives diagnostics; any automatic repair has its own explicitly defined contract.

## Definitions, versions and placement

Definitions do not change, since they record no layout, so definition version 34 is unaffected. The rules join language `1.0.0-alpha.34` in place. Unit 3 implements them in two stages: first the line-ending repair, the one definition of a line break, comments ending at CR and CRLF, and the refusal of U+2028 and U+2029, which fixes today's comment handling on its own; then the layout rules.

## Acceptance cases

- For the same non-trivia tokens, every accepted layout gives the same definition; adding or removing an allowed break changes nothing.
- One script written with LF, with CRLF and with lone CR gives one definition and the same source lines, offsets counting both characters of CRLF.
- A line comment ends at LF, CRLF, lone CR and the end of input, and vertical tab and form feed end none.
- U+2028 and U+2029 are refused in code, in comments and in an interpolation's expression, and kept in literal string text, inline and block, which canonical text writes escaped.
- A line break inside each one-line construct is refused, naming it: an arrow's parameter list, `function (`, a computed property access's `.[`, a call's `(`, an indexer's bracket, an extension selector, a qualified type name, and `try` with its operand among them.
- A break before a binary operator where nothing encloses its expression is refused for each binary operator, and a break after one is refused everywhere; inside a group, an argument, an indexer key, a computed property's expression and a condition, a break before an operator is accepted; an outer call's parentheses enclose no object entry, branch or body within them, so `call({ value = a` followed by a line `+ b })` is refused; a chain inside an operand breaks before its steps on either side of an operator; `let a = b` followed by a line `-1` is refused.
- Chains break before each step without an enclosure.
- Each keyword block is accepted on one line and in block form, and each mixed shape is refused; a condition spanning lines is accepted, `then` closing its last line; `end` followed on its line by `,`, `)`, `]` or `}` is accepted, and by anything else refused, `end) + 2` among them; a line break nested anywhere inside a keyword block, a block string's included, puts it in block form, and the blocks around it too.
- A local or a `return` sharing its line with earlier code is refused in scripts, functions, `do` blocks and branches, `return` without locals included; an import sharing a line, and a body on its last import's line, are refused.
- Object locals stay comma-separated on one line, a conditional binding's head stays on its clause's line while its value may span lines after `=`, and a body of one expression stays on one line.
- A break point inside a one-line construct is refused.
- `format` satisfies every rule and is stable, and `parse(format(definition))` gives the definition back, for one read from text and for one created directly; `format` drops redundant layout parentheses and keeps those its grouping needs, and the source-preserving formatter keeps them all; `format` writes a sum after a parenthesized `do` block in block form as `return (do`, its body, `end`, then `) + 2`.
- `quote`'s compact text parses back to the same definition, nested bodies that use `return` included, the block form they force on the keyword blocks around them included, and the sum after a parenthesized `do` block written as `format` writes it.
