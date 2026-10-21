# Lexical structure

<a id="lexical-structure"></a>

A script's source is text, which the tokenizer reads into tokens: names, numbers, strings and punctuation, with whitespace and comments between them. This document gives the tokens and how each is spelled; [the grammar](grammar.md) gives how they combine.

In this document:

1. [Tokens and whitespace](#tokens-and-whitespace)
2. [Names and reserved words](#names-and-reserved-words)
3. [Strings and escapes](#strings-and-escapes)
4. [Comments](#comments)
5. [Case-sensitive names](#case-sensitive-names)

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

Whitespace, including line breaks, and comments are **trivia**. Trivia may appear between tokens, never inside a token. No rule requires trivia between tokens that are already distinguishable: `a to"number"` means `a to "number"`.

<a id="tokens-and-whitespace-assignment-and-member-punctuation"></a>

### Assignment and member punctuation

Fields, locals and conditional bindings put `=` between a name and its value. A colon after a name begins an indexer.

- `count: it.devices.count` is a syntax error that suggests `count = …`.
- `=` in another position is a syntax error that explains that `==` compares values.
- Bracket property access has no preceding dot. `it.[name]` and `it?.[name]` are syntax errors that suggest `it[name]` and `it?[name]`.

<a id="tokens-and-whitespace-numbers-and-the-minus-sign"></a>

### Numbers and the minus sign

A number token has no sign. `-` is always an operator: arithmetic negation or subtraction.

| Text | Meaning |
| --- | --- |
| `-5` or `- 5` | Negate 5 |
| `a-b` | Subtract `b` from `a` |
| `floor-area` | Subtract `area` from `floor` |

In a property access such as `it.floor-area`, where the receiver has no member `floor` and has the corresponding camelCase member, the diagnostic suggests `it.floorArea`. A bare `floor-area` reads `floor` and `area` as names, with no such suggestion.

A name containing a hyphen is written as a string: `device:["night-mode"]`.

`/` divides unless it begins a comment: `a / b` divides, while `a //b` begins a line comment.

<a id="tokens-and-whitespace-interpolated-string-prefix"></a>

### Interpolated-string prefix

`$"` begins an [interpolated string](expressions.md#interpolated-strings). The dollar sign must be directly before the quote. `$` elsewhere is a syntax error; `$ "…"` specifically reports that no space may separate them.

<a id="names-and-reserved-words"></a>

## Names and reserved words

A name starts with an ASCII letter and continues with ASCII letters or digits. For example, `floorArea` is a name. Names contain no hyphens and are also valid JavaScript identifiers.

An **identifier** is a name that is not reserved. Reserved words are:

| Category | Words |
| --- | --- |
| Literals | `true`, `false`, `null` |
| The object root | `root` |
| The implicit parameter and operators | `it`, `not`, `try`, `as`, `to`, `and`, `or` |
| Control flow and declarations | `if`, `then`, `elseif`, `else`, `let`, `do`, `end`, `return`, `function` |

Reserved words match whole names, exactly. `isVisible` and `nullable` are identifiers. All names are case-sensitive, so `TRUE` and `It` are identifiers too.

The **keywords** are the reserved words other than the literals' words and `root`: `it` and the words of operators, control flow and declarations.

In text read through a registry, the name of each module registered with it is reserved as well, as [module names in text](modules.md#names-and-reserved-words-module-names) sets out; text read without a registry reserves no module's name.

<a id="names-and-reserved-words-declaring-and-accessing-a-reserved-name"></a>

### Declaring a reserved name

A declaration accepts any name, including a reserved word. This applies to fields, locals, functions, function parameters and conditional bindings. Write the name without `@`:

```lexica
light { true = true, it = it.is("active") }
```

The same rule applies to member and indexer names after `.`, `?.`, `:` and `?:`. For example, `value.null` reads a member named `null`, and `device:end["key"]` invokes an indexer named `end`.

`let @to = 1`, `{ @true = 1 }` and `value.@null` are syntax errors.

<a id="names-and-reserved-words-referring-to-a-reserved-local-or-field"></a>

### Reserved references

In a script, a reserved word retains its language meaning regardless of scope. After `let it = 1`, an unprefixed `it` still reads the implicit parameter, and after `let home = 1`, an unprefixed `home` still begins the module's namespace.

Write `@` directly before a reserved word to read the nearest local or field of that name:

```lexica
{ let to = "3", value = @to to "number" }
```

A reserved reference with no such local or field is a structure error:

> No local or field named 'it' is in scope. Use '~it' to read the script parameter.

`@` is valid only directly before a reserved word, and a keyword alone reads no local or field. These are syntax errors:

| Form | Diagnostic guidance |
| --- | --- |
| `@room` | Use `room`; the name is not reserved, and a module's name is reserved only in text read with its registry. |
| `@ it` or `@` | A reserved word must follow `@` directly. |
| `to` in a value position | `Found 'to', a keyword: write '@to' for the local or field of that name`. |

<a id="names-and-reserved-words-reserved-words-in-strings"></a>

### Reserved words in strings

A string containing a reserved word remains an ordinary string:

- `device:["null"]` reads a setting named `null`.
- `value["null"]` is bracket property access and resolves the member `value.null`.

<a id="strings-and-escapes"></a>

## Strings and escapes

Strings come in two families: a **string**, written in double quotes, whose backslashes begin escapes, and a **raw string**, written in single quotes, whose backslashes are text. Each is written inline, on one line, or as a **block**, on lines of its own, and `$` before either makes it interpolated, as [Interpolated strings](expressions.md#interpolated-strings) describes. Every form gives an ordinary `string`:

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

An inline string, `"…"`, `'…'`, `$"…"` or `$'…'`, holds no line break between its delimiters; one written there is a syntax error suggesting `\n` or a block. An escape or an inserted value may still give its value a line break, as `"First\nSecond"` and `$"Content: {text}"` do.

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
- **The boundaries.** The line break after the opening delimiter and the one before the closing delimiter are no part of the text; blank lines within it are kept. LF, CRLF and a lone CR each break a line, and the text holds each as LF; an escape writes any other line ending.
- **Before anything else.** The margin is removed from the source text before escapes are read and before interpolation, so no inserted value is trimmed or reindented.
- **Quotes within.** A run of the delimiter's quote at least as long as the delimiter in a block's text is a syntax error unless it is the closing delimiter, and the diagnostic suggests a longer one, as four quotes hold `'''`. A closing run has exactly the delimiter's length. A string block's escaped quote is in no run, a raw block has no escape and doubles no quote, and the strings within an interpolation follow their own rules, so their quotes are in no run either.
- **Malformed delimiters.** An opening delimiter with anything after it on its line, a block never closed and a closing run longer than its delimiter each have a diagnostic of their own.

<a id="strings-and-escapes-where-a-string-literal-is-required"></a>

### Where a string literal is required

Every form that does not interpolate stands wherever the grammar requires a string literal, a cast's or a conversion's type name among them, so `device as 'light'` is `device as "light"`. An interpolated form is an expression and stands in none of them, even with text alone.

<a id="comments"></a>

## Comments

A line comment begins with `//` and continues to the next LF or the end of input.

A block comment begins with `/*` and ends at the first `*/`. Block comments do not nest. An unclosed block comment is a syntax error.

Comment markers inside a string are text: `"https://example.com"` and `"/* */"` retain those characters.

<a id="case-sensitive-names"></a>

## Case-sensitive names

Every name in Lexica is case-sensitive, and nothing normalizes one: `name` and `Name` are different names, and so are `room` and `Room`. A name is resolved exactly as it is written, and each kind of name is spelled by its own convention:

<a id="case-sensitive-names-members"></a>

### Member names

Members are named in camelCase, properties and functions alike: `name`, `floorArea`, `brightness`, `device`. A member has one name, the same in a text and a definition. `it["floorArea"]` reads that property by the same name.

<a id="case-sensitive-names-field-names-and-bindings"></a>

### Field names and script parameters

Field names and script parameters keep the exact spelling their author gave them, so `isOn` and `ison` are two fields, and a script parameter `room` is not a parameter `Room`.

<a id="case-sensitive-names-strings"></a>

### Strings are preserved

Strings are preserved exactly: `kind = "List"` answers `List`. A string names a member or field only in a bracket property access, which reads the one its string names, exactly, a data field whose key is no Lexica name among them, as `o["night-mode"]` reads a bound object's field `night-mode`. A string a module's function receives, as a setting's name or a type selector's key, follows that module's own case rules.

A field answers the key its name is written as, and how a consumer matches keys to its own members is its own: a consumer that cannot tell `isOn` from `ison` reports the ambiguity, and the language is unaffected. How a module names a member, and which JavaScript function carries it out, is the module's declaration.
