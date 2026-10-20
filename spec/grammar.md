# Grammar

<a id="syntax"></a>

The grammar gives every form a script's source can take. It says what text is well formed, and nothing of what it means: each production's meaning, and the restrictions no grammar can state, are in the document its group names.

In this notation, `[...]` means optional, `{...}` means repetition, `|` separates alternatives, `-` means exclusion, and `? ... ?` describes a special sequence. Each name describes a written form or the category a position holds. Trivia never stands inside a token: `@word`, `~name`, `(?` and `$"` are each written whole, with nothing between their characters.

In this document:

1. [The productions](#grammar-productions)
2. [The grammar](#grammar-the-grammar)
3. [Grammar terminology](#grammar-terminology)

<a id="grammar-productions"></a>

## The productions

| Group | Productions | Meaning in |
| --- | --- | --- |
| A script and its bodies | `script`, `body`, `local`, `local-initializer`, `do-expression` | [Scripts](scripts.md) |
| Conditionals | `conditional-expression`, `conditional-clause`, `conditional-binding`, `simple-conditional-expression` | [Conditionals](expressions.md#conditionals) |
| Functions | `function-expression`, `function-parameter-list`, `function-parameter`, `arrow-function`, `arrow-parameters`, `function-call` | [Functions](functions.md) |
| Operators | `coalescing`, `disjunction`, `conjunction`, `negation`, `equality`, `comparison`, `additive`, `multiplicative`, `arithmetic-negation` and their operands | [Expressions](expressions.md) |
| Casts, conversions and attempts | `cast`, `cast-target`, `conversion`, `conversion-target`, `attempt`, `attempted-operation` | [Casts](types.md#casts), [conversions](values.md#conversions), [attempts](expressions.md#attempts) |
| Chains and members | `chain`, `chain-input`, `input`, `receiver`, `member-chain`, `member-expression`, `dot-property-access`, `bracket-property-access`, `member-call`, `indexer`, `optional-enclosed-access`, `argument-list`, `argument` | [Members](members.md) |
| Simple expressions | `simple-expression`, `simple-value-expression` | [Simple expressions](expressions.md#simple-expressions) |
| Names and references | `value`, `identifier`, `reserved-reference`, `parameter-reference`, `namespace-access`, `module-name`, `name`, `reserved-word`, `keyword` | [Lexical structure](lexical-structure.md#names-and-reserved-words), [script parameters](scripts.md#scripts-script-parameters), [namespaces](modules.md#namespaces) |
| Objects | `object`, `object-content`, `field` | [Objects](values.md#objects) |
| Literals and strings | `literal`, `number`, `string` and its forms, `interpolated-string` and its parts | [Lexical structure](lexical-structure.md), [interpolated strings](expressions.md#interpolated-strings) |
| Trivia | `trivia`, `whitespace`, `line-comment`, `block-comment` | [Comments](lexical-structure.md#comments) |

<a id="grammar-the-grammar"></a>

## The grammar

```ebnf
script                        = body end-of-input

body                          = { local } "return" expression
                              | expression

expression                    = conditional-expression | do-expression
                              | simple-value-expression
parenthesized-expression      = "(" expression ")"

conditional-expression        = "if" conditional-clause "then" body
                                { "elseif" conditional-clause "then" body }
                                "else" body "end"
do-expression                 = "do" body "end"
conditional-clause            = conditional-binding | simple-value-expression
conditional-binding           = "let" local-name "=" simple-value-expression

simple-expression             = simple-value-expression
                              | simple-conditional-expression
simple-conditional-expression = "if" simple-value-expression "then" simple-value-expression
                                "else" simple-value-expression "end"

local                         = "let" local-name "=" local-initializer
local-initializer             = expression | function-expression | arrow-function

function-expression           = "function" "(" [ function-parameter-list ] ")"
                                body "end"
function-parameter-list       = function-parameter { "," function-parameter }
function-parameter            = local-name

simple-value-expression       = coalescing | disjunction | or-operand

coalescing                    = coalescing-operand "??"
                                ( coalescing-operand | coalescing )
coalescing-operand            = arithmetic-negation

disjunction                   = or-operand "or" or-operand
                                { "or" or-operand }
or-operand                    = conjunction | and-operand

conjunction                   = and-operand "and" and-operand
                                { "and" and-operand }
and-operand                   = negation | equality | comparison | additive

negation                      = "not"
                                ( negation | equality | comparison | additive )

equality                      = additive
                                ( "==" | "!=" )
                                additive

comparison                    = additive ( "<" | "<=" ) additive
                                { ( "<" | "<=" ) additive }
                              | additive ( ">" | ">=" ) additive
                                { ( ">" | ">=" ) additive }

additive                      = multiplicative
                                { ( "+" | "-" ) multiplicative }
multiplicative                = arithmetic-negation
                                { ( "*" | "/" | "%" ) arithmetic-negation }
arithmetic-negation           = "-" arithmetic-negation | equality-operand

equality-operand              = chain | cast | conversion | attempt
attempt                       = "try" attempted-operation
attempted-operation           = attempted-conversion | cast
                              | "(" ( conversion | cast | attempted-operation ) ")"
attempted-conversion          = chain "to" string

conversion                    = conversion-target "to" string
conversion-target             = chain | cast | conversion

cast                          = cast-target "as" string
cast-target                   = receiver { member-expression } | enclosed-cast-target
enclosed-cast-target          = "(" coalescing ")" | optional-enclosed-access

chain                         = chain-input { member-expression | object }
chain-input                   = input | enclosed-expression

member-chain                  = receiver member-expression { member-expression }
optional-enclosed-access      = "(?" member-chain ")"
receiver                      = input | "(" cast ")"

input                         = value | object | identifier | interpolated-string
                              | reserved-reference | parameter-reference
                              | function-call | namespace-access
reserved-reference            = "@" reserved-word
parameter-reference           = "~" name
function-call                 = ( identifier | reserved-reference )
                                "(" [ argument-list ] ")"
argument-list                 = argument { "," argument }
argument                      = simple-expression | arrow-function
arrow-function                = arrow-parameters "=>" simple-expression
arrow-parameters              = function-parameter | "(" [ function-parameter-list ] ")"
value                         = "it" | "root" | literal

namespace-access              = module-name "." member-name
                                [ "(" [ argument-list ] ")" ]
                              (* no indexer is written through a namespace *)
module-name                   = ? the name of a module registered with the registry
                                  the text is read with ?

enclosed-expression           = parenthesized-expression | optional-enclosed-access

member-expression             = dot-property-access | bracket-property-access
                              | member-call | indexer
dot-property-access           = ( "." | "?." ) member-name
bracket-property-access       = ( "[" | "?[" ) simple-expression "]"
member-call                   = ( "." | "?." ) member-name
                                "(" [ argument-list ] ")"
indexer                       = ( ":" | "?:" ) [ member-name ]
                                "[" simple-expression "]"

object                        = "{" object-content "}"
object-content                = { local "," } field { "," field } [ "," ]
field                         = field-name "=" expression

literal                       = string | number | "true" | "false" | "null"

identifier                    = name - reserved-word
local-name                    = name
field-name                    = name
member-name                   = name
name                          = letter { letter | digit }
reserved-word                 = "true" | "false" | "null" | "root" | keyword
                              | module-name
keyword                       = "it" | "not" | "try" | "as" | "to" | "and" | "or"
                              | "if" | "then" | "elseif" | "else" | "let"
                              | "do" | "end" | "return" | "function"

number                        = integer [ fraction ] [ exponent ]
integer                       = "0" | nonzero-digit { digit }
fraction                      = "." digit { digit }
exponent                      = ( "e" | "E" ) [ "+" | "-" ] digit { digit }

string                        = inline-string | raw-string | string-block | raw-block
inline-string                 = '"' { string-character | string-escape } '"'
string-character              = ? any character except double quote, backslash
                                  or a line break ?
raw-string                    = "'" { raw-character | "''" } "'"
raw-character                 = ? any character except single quote or a line break ?
string-block                  = ? three or more double quotes and a line break, the
                                  block's lines and its closing delimiter, as Blocks
                                  describes, its text of string-character,
                                  string-escape and line breaks ?
raw-block                     = ? three or more single quotes and a line break, the
                                  block's lines and its closing delimiter, as Blocks
                                  describes, its text any characters ?
string-escape                 = '\' ( '"' | '\' | "n" | "r" | "t" | "e" | unicode-escape )
unicode-escape                = "u{" hex-digit [ hex-digit [ hex-digit
                                [ hex-digit [ hex-digit [ hex-digit ] ] ] ] ] "}"
hex-digit                     = digit | "A" | "B" | "C" | "D" | "E" | "F"
                              | "a" | "b" | "c" | "d" | "e" | "f"

interpolated-string           = "$" ( '"' { interpolated-part } '"'
                                    | "'" { raw-interpolated-part } "'"
                                    | ? a string block or a raw block whose text
                                        holds interpolated parts or
                                        raw-interpolated parts ? )
interpolated-part             = interpolated-character | string-escape
                              | "{{" | "}}" | interpolation
raw-interpolated-part         = raw-interpolated-character | "''"
                              | "{{" | "}}" | interpolation
interpolation                 = "{" simple-expression "}"
                              (* on one line, beginning with no object expression *)
interpolated-character        = ? any character except double quote, backslash,
                                  a brace or a line break ?
raw-interpolated-character    = ? any character except single quote, a brace
                                  or a line break ?

letter                        = ? ASCII A–Z or a–z ?
digit                         = "0" | nonzero-digit
nonzero-digit                 = "1" | "2" | "3" | "4" | "5"
                              | "6" | "7" | "8" | "9"

trivia                        = whitespace | line-comment | block-comment
whitespace                    = ? a character matched by ECMAScript \s ?

line-comment                  = "//" { line-character } [ line-feed ]
line-character                = ? any character except LF ?
line-feed                     = ? LF ?

block-comment                 = "/*" block-content "*/"
block-content                 = ? characters up to, but excluding, the first closing */ ?

end-of-input                  = ? end of input ?
```

<a id="grammar-terminology"></a>

## Grammar terminology

The grammar uses several terms more narrowly than the prose:

| Grammar rule | Meaning |
| --- | --- |
| `value` | The forms listed by that production: the implicit parameter, the object root or a literal |
| `namespace-access` | A module member read, or a qualified form called, through a module's namespace; text read without a registry has no module names, so it has none |
| `input` | What a chain can start from |
| `receiver` | The starting form of a member chain or cast target: an input or a parenthesized cast |
| `equality-operand` | A chain, cast, conversion or attempt, used within the arithmetic productions |
| `coalescing-operand` | An arithmetic negation or an equality operand, never binary arithmetic, which stands apart from `??` unless one of them is grouped |

In the prose, **value** means any value an expression has; type resolution determines its type. A member's **argument form** is a separate concept: it declares what the member's arguments supply. See [parameters and arguments](members.md#arguments).
