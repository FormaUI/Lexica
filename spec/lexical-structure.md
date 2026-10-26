# Lexical structure

<a id="lexical-structure"></a>

A script's source is text, which the tokenizer reads into tokens: names, numbers, strings and punctuation, with whitespace and comments between them. This document gives the tokens and how each is spelled; [the grammar](grammar.md) gives how they combine.

In this document:

1. [Tokens and whitespace](#tokens-and-whitespace)
2. [Names and reserved words](#names-and-reserved-words)
3. [Strings and escapes](#strings-and-escapes)
4. [Comments](#comments)
5. [Line structure](#line-structure)
6. [Case-sensitive names](#case-sensitive-names)

<a id="tokens-and-whitespace"></a>

## Tokens and whitespace

Tokens are names, numbers, strings and the punctuation shown in the [grammar](grammar.md#syntax). The tokenizer uses the longest match.

The following forms are each one token and cannot contain whitespace:

| Token | Invalid separated form |
| --- | --- |
| `?.` | `? .` |
| `?[` | `? [` |
| `?:` | `? :` |
| `??` | `? ?` |
| `(?` | `( ?` |
| `<=` | `< =` |
| `>=` | `> =` |
| `=>` | `= >` |
| `==` | `= =` |
| `!=` | `! =` |

Whitespace, including [line breaks](#line-structure-line-breaks), and comments are **trivia**, whose lines [line structure](#line-structure) constrains. Trivia may appear between tokens, never inside a token. No rule requires trivia between tokens that are already distinguishable: `it.power>0` means `it.power > 0`.

<a id="tokens-and-whitespace-assignment-and-member-punctuation"></a>

### Assignment and member punctuation

Object fields, locals and conditional bindings put `=` between a name and its value. A colon in a member chain begins an [extension access](members.md#property-access-calls-and-indexers-extension-access), `device:Device.usage`, and anywhere else belongs only inside strings and comments.

- `count: it.devices.count` is a syntax error that suggests `count = …`.
- `=` in another position is a syntax error that explains that `==` compares values.
- Computed property access is written after a dot. `it:[name]` and `it?:[name]`, which don't name an extension, are syntax errors that suggest `it[name]` for an unnamed indexer or `it.[name]` for a computed property access, and their optional forms.

<a id="tokens-and-whitespace-numbers-and-the-minus-sign"></a>

### Numbers and the minus sign

A number token has no sign. `-` is always an operator: arithmetic negation or subtraction.

| Text | Meaning |
| --- | --- |
| `-5` or `- 5` | Negate 5 |
| `a-b` | Subtract `b` from `a` |
| `floor-area` | Subtract `area` from `floor` |

In a property access such as `it.floor-area`, where the receiver has no member `floor` and has the corresponding camelCase member, the diagnostic suggests `it.floorArea`. A bare `floor-area` reads `floor` and `area` as names, with no such suggestion.

A name containing a hyphen is written as a string: `device["night-mode"]`.

`/` divides unless it begins a comment: `a / b` divides, while `a //b` begins a line comment.

<a id="tokens-and-whitespace-interpolated-string-prefix"></a>

### Interpolated-string prefix

`$"` begins an [interpolated string](expressions.md#interpolated-strings). The dollar sign must be directly before the quote. `$` elsewhere is a syntax error; `$ "…"` specifically reports that no space may separate them.

<a id="names-and-reserved-words"></a>

## Names and reserved words

An **identifier** starts with an ASCII letter and continues with ASCII letters or digits. For example, `floorArea` is an identifier. Identifiers contain no hyphens and are also valid JavaScript identifiers. Every name a script writes is an identifier, a local's, an object field's, a member's, a type's, a module's or a function parameter's, and so is every reference to a binding.

The language reserves some words, which keep its own meaning where a value stands. Reserved words are:

| Category | Words |
| --- | --- |
| Literals | `true`, `false`, `null` |
| The object root | `root` |
| The implicit parameter and operators | `it`, `not`, `try`, `as`, `to`, `and`, `or` |
| Control flow and declarations | `if`, `then`, `elseif`, `else`, `let`, `do`, `end`, `return`, `function`, `import` |

Reserved words match whole identifiers, exactly, so `isVisible` and `nullable` are reserved by no word they hold. Identifiers are case-sensitive, so `TRUE` and `It` are not reserved words either.

The **keywords** are the reserved words other than the literals' words and `root`: `it` and the words of operators, control flow and declarations.

<a id="names-and-reserved-words-what-an-identifier-means"></a>

### What an identifier means

An identifier's spelling decides no meaning; where it stands does:

- **Unprefixed, where a value stands,** a reserved word keeps its language meaning, and any other identifier reads the nearest local, object field, conditional binding or function parameter of its name, and otherwise the script parameter.
- **After `@`,** a [lexical reference](#names-and-reserved-words-lexical-references) reads the nearest local, object field, conditional binding or function parameter of its name, the spelling of a reserved word among them: `@to`; and otherwise the import binding of its name, the local name an import gives a module or a type: after `import Lexica = Home`, `@Lexica.rooms` reads `Home.rooms`. An import binding read with `@` begins its namespace or names its type, as its bare name does, and is never a value.
- **After `~`,** the [script parameter](scripts.md#scripts-parameter-references) of its name is selected explicitly: `~to`.
- **Where the position expects a name,** after `.` or `?.`, after `as` or `to`, after an [extension access](members.md#property-access-calls-and-indexers-extension-access)'s `:` or `?:`, and where a declaration names what it declares, the identifier is read in that role, whatever its spelling: `node.root` reads the member `root`, and `{ Home = 1 }` declares the object field `Home`.
- **Where the script imports a module,** the [local name](modules.md#names-and-reserved-words-module-names) its import gives the module, its own or an alias, written unprefixed where a value stands begins its namespace. It is not a reserved word, but an identifier the script's imports give that meaning in that position alone, so `@Home` reads the nearest local of its name, and the import binding only where none is in scope, `~Home` the script parameter of its name, and a member, an object field or any other name it spells keeps its role. A name no import gives that meaning is read as any identifier is.

Declarations keep their own restrictions besides: module names are unique, compared case-insensitively, and a type is named once within its module, as [registering a module](modules.md#modules-registries) sets out. Ambiguity is checked when resolving a reference, against the declarations applicable at that location. Declarations are not refused merely because their names could become ambiguous in another context. These rules supplement the grammar, whose one `identifier` production does not make an identifier valid in every position.

<a id="names-and-reserved-words-declaring-and-accessing-a-reserved-name"></a>

### Declaring a reserved name

A declaration accepts any identifier, a reserved word among them. This applies to object fields, locals, functions, function parameters and conditional bindings. Write the name without `@`:

```lexica
light { true = true, it = it.active() }
```

The same rule applies to member and indexer names after `.` and `?.`. For example, `value.null` reads a member named `null`, and `device.end["key"]` invokes an indexer named `end`.

`let @to = 1`, `{ @true = 1 }` and `value.@null` are syntax errors.

<a id="names-and-reserved-words-lexical-references"></a>
<a id="names-and-reserved-words-referring-to-a-reserved-local-or-object-field"></a>

### Lexical references

In a script, a reserved word retains its language meaning regardless of scope. After `let it = 1`, an unprefixed `it` still reads the implicit parameter, and in a script importing `Home`, after `let Home = 1`, an unprefixed `Home` still begins the module's namespace.

A **lexical reference**, `@` directly before an identifier, reads the nearest local, object field, conditional binding or function parameter of that name; otherwise, it resolves the import binding of that name:

```lexica
{ let to = "3", value = @to to Number }
```

It is needed where the identifier alone means something else, a reserved word or, in a script importing it, a module's name, and allowed before any identifier: after `let total = 2`, `@total` reads the local as `total` does. Canonical text writes `@` only where it is needed.

A lexical reference that no local, object field, conditional binding or function parameter in scope, and no import binding, answers is a structure error:

> No local, object field, conditional binding or function parameter named 'it' is in scope. Use '~it' to read the script parameter.

An identifier must follow `@` directly, and a keyword alone does not read a local or object field. These are syntax errors:

| Form | Diagnostic guidance |
| --- | --- |
| `@ it` or `@` | An identifier must follow `@` directly. |
| `to` in a value position | `Found 'to', a keyword: write '@to' for the local or field of that name`. |

<a id="names-and-reserved-words-reserved-words-in-strings"></a>

### Reserved words in strings

A string containing a reserved word remains an ordinary string:

- `device["null"]` reads a setting named `null`.
- `value.["null"]` is computed property access and resolves the member `value.null`.

<a id="strings-and-escapes"></a>

## Strings and escapes

Strings come in two families: a **string**, written in double quotes, whose backslashes begin escapes, and a **raw string**, written in single quotes, whose backslashes are text. Each is written inline, on one line, or as a **block**, on lines of its own, and `$` before either makes it interpolated, as [Interpolated strings](expressions.md#interpolated-strings) describes. Every form gives an ordinary `String`:

| Form | Name |
| --- | --- |
| `"…"` | String |
| `'…'` | Raw string |
| `$"…"` | Interpolated string |
| `$'…'` | Interpolated raw string |
| `"""…"""` | String block |
| `'''…'''` | Raw block |
| `$"""…"""` | Interpolated string block |
| `$'''…'''` | Interpolated raw block |

```lexica
let path = 'C:\Users\Eyal\'
return {
    path = path,
    pattern = '\d{3}-\d{2}',
    message = $"""
        Saved to {path}

        Done.
        """
}
```

<a id="strings-and-escapes-escapes"></a>

### Escapes

A string and a string block take these escape sequences:

| Escape | Character |
| --- | --- |
| `\"` | Double quote |
| `\\` | Backslash |
| `\n` | Line feed |
| `\r` | Carriage return |
| `\t` | Tab |
| `\e` | Escape, U+001B |
| `\u{…}` | Unicode scalar value written with one to six hexadecimal digits |

Examples of Unicode escapes are `\u{A0}` for a no-break space, `\u{200B}` for a zero-width space and `\u{1F600}` for 😀.

A surrogate value from D800 through DFFF, a value above 10FFFF, or any unrecognized escape is a syntax error.

Characters other than a line break may also appear literally, tabs included. `"😀"` and `"\u{1F600}"` have the same value, as do `"\e"` and `"\u{1B}"`.

<a id="strings-and-escapes-raw-strings"></a>

### Raw strings

A raw string's backslashes are text, a trailing one included, so `'C:\Users\Eyal\'`, `'\d{3}-\d{2}'` and `'mode = "eco"'` hold exactly what they show. Its one convention is its quote doubled: `'It''s ready'` is `It's ready`, as `"It's ready"` is, and `''` is the empty string. A raw string has no escapes, so a character it cannot show, an invisible one among them, is written in a string instead.

<a id="strings-and-escapes-one-line"></a>

### One line

An inline string, `"…"`, `'…'`, `$"…"` or `$'…'`, does not hold a line break between its delimiters; one written there is a syntax error suggesting `\n` or a block. An escape or an inserted value may still give its value a line break, as `"First\nSecond"` and `$"Content: {text}"` do.

<a id="strings-and-escapes-blocks"></a>

### Blocks

A block is opened by three or more matching quotes, `$` directly before them where it is interpolated, followed directly by a line break, and closed by as many of the same quote, the first text after the indentation of a later line. The source continues after the closing delimiter on its line, a call, an access, a comma or a comment:

```lexica
{
    label = '''
        Ready
        ''',
    count = 3
}
```

- **The margin.** The closing delimiter's indentation is the margin removed from each line of the block's text. Each line that is not blank begins with exactly that whitespace, tabs and spaces alike, and one that does not is a syntax error. A blank line shorter than the margin is empty, and whitespace beyond the margin is kept.
- **The boundaries.** The line break after the opening delimiter and the one before the closing delimiter are not part of the text; blank lines within it are kept. LF, CRLF and a lone CR each break a line, and the text holds each as LF; an escape writes any other line ending.
- **Before anything else.** The margin is removed from the source text before escapes are read and before interpolation, so no inserted value is trimmed or reindented.
- **Quotes within.** A run of the delimiter's quote at least as long as the delimiter in a block's text is a syntax error unless it is the closing delimiter, and the diagnostic suggests a longer one, as four quotes hold `'''`. A closing run has exactly the delimiter's length. A string block's escaped quote is in no run, a raw block has no escape and doubles no quote, and the strings within an interpolation follow their own rules, so their quotes are in no run either.
- **Malformed delimiters.** An opening delimiter with anything after it on its line, a block never closed and a closing run longer than its delimiter each have a diagnostic of their own.

<a id="strings-and-escapes-where-a-string-literal-is-required"></a>

### Where a string literal is required

No production requires a string literal: a cast's and a conversion's type is a name written bare, `device as Light` and `value to Number`, and a string in its place, whatever its form, is a syntax error giving the bare name, so `device as "light"` and `device as 'light'` are refused alike. Every form that does not interpolate is a literal wherever a literal stands, and an interpolated form is an expression, even with text alone.

<a id="comments"></a>

## Comments

A line comment begins with `//` and continues to the next [line break](#line-structure-line-breaks) or the end of input.

A block comment begins with `/*` and ends at the first `*/`. Block comments do not nest. An unclosed block comment is a syntax error.

Comment markers inside a string are text: `"https://example.com"` and `"/* */"` retain those characters.

<a id="line-structure"></a>

## Line structure

Line structure constrains which layouts of a script are valid. It never decides where an expression ends, and never chooses between readings: for the same tokens, every accepted layout gives the same definition. Strings and comments keep their own rules, by which a block string's lines are its value and a line comment ends at a line break.

<a id="line-structure-line-breaks"></a>

### Line breaks

A **line break** is LF, CRLF or a lone CR, CRLF being one line break wherever it stands. Every rule that speaks of a line follows this one definition: line comments, block strings, which give each line break as LF in their value, diagnostics, and source locations, whose line advances once for CRLF and whose offset counts both its characters. Vertical tab and form feed are whitespace, never line breaks. U+2028 and U+2029 are refused outside a string's literal text, in code, in comments and in an interpolation's expression alike, with a syntax error naming the character; in literal text they are characters of the value, which canonical text writes escaped.

<a id="line-structure-where-a-line-breaks"></a>

### Where a line breaks

Every position between two tokens is one of three kinds: inside a one-line construct, where a line break is refused; at a break point, where one is allowed; or at a boundary, where one is required, with no earlier code on its line. A broken rule is a syntax error naming the construct, never another reading. A comment between two tokens stands for a line break only where it holds one, so a line comment after a completed construct is allowed. Every rule follows the written syntax alone, never what a name resolves to.

**One-line constructs** never hold a line break:

| Construct | Example |
| --- | --- |
| A token | `floorArea`, `?.`, `=>`, `40` |
| An inline string, inline raw string, or interpolated string | `"lamp"`, `'C:\temp'`, `$"{name} is on"` |
| An interpolation, its `{`, its expression and its `}` | `{reading ?? 0}` |
| An import declaration | `import Sensor = Home.MotionSensor` |
| A body local's head, `let`, its name and `=` | `let reading =` |
| A conditional binding's head | `if let lamp =` |
| An object local's or an object field's head | `let devices =`, `temperature =` |
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

**Break points** allow a line break, unless a one-line construct around them refuses it:

| Construct | Where it may break |
| --- | --- |
| Arguments, indexer keys, a parenthesized group, a computed property's expression | After `(` or `[`, after a comma, before `)` or `]` |
| A function's parameter list | After its `(`, after a comma, before its `)` |
| An object expression | After `{`, after a comma, before `}` |
| A chain | Before `.`, `?.`, `:` or `?:`, and before an extension access's `.member` |
| A binary operator | Before the operator, where its expression is [enclosed](#line-structure-operator-expressions), and never after it |
| A local's, an object field's or a conditional binding's value | After its `=` |
| An arrow function | After `=>` |
| A conditional, a `do` block or a function expression | As [keyword blocks](#line-structure-keyword-blocks) set out |
| A block string or block raw string | Within it, by its own rules |

```lexica
room {
    lit = it.devices
        .where(it.active())
        .count,
    gap = (it.climate?.temperature
        - outside),
    label = if it.occupied()
        and not it.reserved() then
        "busy"
    elseif it.reserved() then
        "held"
    else
        "free"
    end
}
```

<a id="line-structure-operator-expressions"></a>

### Operator expressions

The gaps around a binary operator, arithmetic, a comparison, an equality, `and`, `or` or `??`, follow their own rule. The gap after an operator never holds a line break, and the gap before one holds a line break only where the operator's expression is enclosed, so each continuation line starts with its operator. A break inside an operand follows that operand's own rules, so a chain breaks before its steps whether or not an operator follows it:

```lexica
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

A chain breaks before each step without an enclosure, since a line that starts with `.`, `?.` or `:` begins nothing else.

<a id="line-structure-keyword-blocks"></a>

### Keyword blocks

A conditional, a `do` block and a function expression are each written in one of two shapes:

1. **On one line,** from its first keyword to its `end`: `if it.occupied() then "busy" else "free" end`, `do 1 end`.
2. **In block form,** once it spans lines at all: `if <condition> then` and `elseif <condition> then` each end their lines, `then` closing a condition's last line; `else`, `do` and a function's head each end their lines; each branch's or body's content starts on the line after; and `end` starts a line of its own, on which only closing punctuation, `,`, `)`, `]` or `}`, may follow it.

A keyword block spans lines when any line break falls between its first keyword and its `end`, one inside a nested object, call, keyword block or block string included, so block form propagates outward through the keyword blocks around it.

What may follow `end` is this layout's limit, never the grammar's: `(do … end) + 2` reads as a sum, but in block form an expression continuing after the closing parenthesis does so on the line after `end`:

```lexica
return (do
    return 1
end
) + 2
```

Any mixture is refused: `then` on a line after its condition, a branch's content on its keyword's line in block form, `else "free" end` sharing a line, `end` after content on its line, or anything but closing punctuation after `end` on its line, `end) + 2` among them.

<a id="line-structure-boundaries"></a>

### Boundaries

Each of these starts on a line of its own, with no earlier code on that line:

- **Each import declaration.**
- **The script's body,** on a line after its last import.
- **In a [body](scripts.md#bodies) that uses `return`, each local and the `return`,** at every level, a script's, a function's, a `do` block's and a conditional branch's alike, a body that uses `return` without locals included.

```lexica
let fallback = 0
let level = if metered then
    let reading = sensor.temperature
    return reading ?? fallback
else
    return fallback
end
return level
```

A body of one expression has no boundary, so `if metered then 1 else 2 end` and `do 1 end` stay on one line, and a keyword block holding a body that uses `return` is in block form. An object's locals stay comma-separated entries, `room { let devices = it.devices, count = devices.count }`, and a conditional binding belongs to its conditional's clause, `if let reading = sensor.temperature then reading else 0 end`; their heads follow the one-line rule.

<a id="line-structure-precedence"></a>

### Precedence

An enclosing one-line construct overrides every break point within it: `(a, b) =>` cannot break after its comma, an interpolation cannot break within an object or a call it holds, an import cannot break before its dot, and `as Home.Device` cannot break within its type name. Outside one-line constructs, a boundary or a keyword block's shape overrides a break point.

<a id="case-sensitive-names"></a>

## Case-sensitive names

Every name in Lexica is case-sensitive, and nothing normalizes one: `name` and `Name` are different names, and so are `room` and `Room`. Module names are compared case-insensitively for uniqueness at registration, with their original spelling preserved. All name resolution in scripts remains case-sensitive. A name is resolved exactly as it is written, and each kind of name is spelled by its own convention:

<a id="case-sensitive-names-members"></a>

### Member names

Members are conventionally named in camelCase, properties and functions alike: `name`, `floorArea`, `brightness`, `device`. A member has one name, the same in a text and a definition. `it.["floorArea"]` reads that property by the same name.

<a id="case-sensitive-names-object-field-names-and-bindings"></a>

### Object field names and script parameters

Object field names and script parameters keep the exact spelling their author gave them, so `isOn` and `ison` are two object fields, and a script parameter `room` is not a parameter `Room`.

<a id="case-sensitive-names-strings"></a>

### Strings are preserved

Strings are preserved exactly: `kind = "List"` answers `List`. A string names a member or object field only in a computed property access, which reads the one its string names, exactly, an object field whose key is no Lexica name among them, as `o.["night-mode"]` reads a bound object's field `night-mode`. A string a module's function receives, as a setting's name or a type selector's key, follows that module's own case rules.

An object field answers the key its name is written as, and how a consumer matches keys to its own members is its own: a consumer that cannot tell `isOn` from `ison` reports the ambiguity, and the language is unaffected. How a module names a member, and which JavaScript function carries it out, is the module's declaration.
