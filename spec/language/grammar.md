# Grammar

<a id="syntax"></a>

The grammar gives every form a script's source can take. It says what text is well formed, and nothing of what it means: each production's meaning, and the restrictions no grammar can state, are in the document its group names; where a line may break, which no production states, [line structure](lexical-structure.md#line-structure) sets out.

In this notation, `[...]` means optional, `{...}` means repetition, `|` separates alternatives, and `? ... ?` describes a special sequence. Each production names a written form or the role a position holds. Trivia never stands inside a token: `@total`, `~room`, `(?` and `$"` are each written whole, with nothing between their characters.

In this document:

1. [The productions](#grammar-productions)
2. [The grammar](#grammar-the-grammar)
3. [Grammar terminology](#grammar-terminology)

<a id="grammar-productions"></a>

## The productions

| Group | Productions | Meaning in |
| --- | --- | --- |
| A script and its bodies | `script`, `import-declaration`, `body`, `local`, `local-initializer`, `do-expression` | [Scripts](../scripts.md) |
| Conditionals | `conditional-expression`, `conditional-clause`, `conditional-binding`, `simple-conditional-expression` | [Conditionals](expressions.md#conditionals) |
| Functions | `function-expression`, `function-parameter-list`, `function-parameter`, `arrow-function`, `arrow-parameters`, `function-call` | [Functions](functions.md) |
| Operators | `coalescing`, `disjunction`, `conjunction`, `negation`, `equality`, `comparison`, `additive`, `multiplicative`, `arithmetic-negation` and their operands | [Expressions](expressions.md) |
| Casts, conversions and attempts | `cast`, `cast-target`, `conversion`, `conversion-target`, `attempt`, `attempted-operation`, `type-name` | [Casts](../types.md#casts), [conversions](../values.md#conversions), [attempts](expressions.md#attempts) |
| Chains and members | `chain`, `chain-input`, `input`, `receiver`, `member-chain`, `member-expression`, `dot-property-access`, `computed-property-access`, `member-call`, `indexer-access`, `extension-access`, `extension-name`, `extension-member`, `optional-enclosed-access`, `argument-list`, `argument` | [Members](../members.md) |
| Simple expressions | `simple-expression`, `simple-value-expression` | [Simple expressions](expressions.md#simple-expressions) |
| Names and references | `value`, `identifier`, `local-name`, `object-field-name`, `member-name`, `namespace-name`, `module-name`, `lexical-reference`, `script-parameter`, `namespace-access`, `reserved-word`, `keyword` | [Lexical structure](lexical-structure.md#names-and-reserved-words), [script parameters](../scripts.md#scripts-script-parameters), [namespaces](../modules.md#namespaces) |
| Objects | `object`, `object-content`, `object-field` | [Objects](../values.md#objects) |
| Literals and strings | `literal`, `Number`, `String` and its forms, `interpolated-string` and its parts | [Lexical structure](lexical-structure.md), [interpolated strings](expressions.md#interpolated-strings) |
| Trivia | `trivia`, `whitespace`, `line-comment`, `block-comment` | [Comments](lexical-structure.md#comments) |

<a id="grammar-the-grammar"></a>

## The grammar

```ebnf
script                        = { import-declaration } body end-of-input
import-declaration            = "import" [ import-alias "=" ] import-source
import-alias                  = identifier
import-source                 = module-name [ "." identifier ]
                              (* a registered module, or a type
                                 qualified by its registered module *)
module-name                   = identifier

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
function-parameter            = identifier

simple-value-expression       = range | coalescing | disjunction | or-operand

range                         = [ range-boundary ] ".." [ range-boundary ]
                              (* a range is no range's boundary *)
range-boundary                = arithmetic-negation

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
arithmetic-negation           = "-" arithmetic-negation | from-end-index | equality-operand
from-end-index                = "^" equality-operand

equality-operand              = chain | cast | conversion | attempt
attempt                       = "try" attempted-operation
attempted-operation           = attempted-conversion | cast
                              | "(" ( conversion | cast | attempted-operation ) ")"
attempted-conversion          = chain "to" type-name

conversion                    = conversion-target "to" type-name
conversion-target             = chain | cast | conversion

cast                          = cast-target "as" type-name
cast-target                   = receiver { member-expression } | enclosed-cast-target
enclosed-cast-target          = "(" coalescing ")" | optional-enclosed-access
type-name                     = [ namespace-name "." ] identifier

chain                         = chain-input { member-expression | object }
chain-input                   = input | enclosed-expression

member-chain                  = receiver member-expression { member-expression }
optional-enclosed-access      = "(?" member-chain ")"
receiver                      = input | "(" cast ")"

input                         = value | object | collection-expression
                              | identifier | interpolated-string
                              | lexical-reference | script-parameter
                              | function-call | namespace-access
lexical-reference             = "@" identifier
script-parameter              = "~" identifier
function-call                 = ( identifier | lexical-reference )
                                "(" [ argument-list ] ")"
argument-list                 = argument { "," argument }
argument                      = simple-expression | arrow-function
arrow-function                = arrow-parameters "=>" simple-expression
arrow-parameters              = function-parameter | "(" [ function-parameter-list ] ")"
value                         = "it" | "root" | literal

namespace-access              = namespace-name "." member-name
                                [ "(" [ argument-list ] ")" ]
                              (* no indexer access is written through a namespace *)
namespace-name                = identifier
                              (* a namespace where the script's imports
                                 give a module that name *)

enclosed-expression           = parenthesized-expression | optional-enclosed-access

member-expression             = dot-property-access | computed-property-access
                              | member-call | indexer-access | extension-access
dot-property-access           = ( "." | "?." ) member-name
computed-property-access      = ( "." | "?." ) "[" simple-expression "]"
member-call                   = ( "." | "?." ) member-name
                                "(" [ argument-list ] ")"
indexer-access                = ( "[" | "?[" ) simple-expression "]"
extension-access              = ( ":" | "?:" ) extension-name extension-member
extension-name                = [ namespace-name "." ] identifier
                              (* a namespace-name where the script's imports
                                 give a module that name *)
extension-member              = "." member-name [ "(" [ argument-list ] ")" ]
                              | "[" simple-expression "]"

collection-expression         = list-expression | dictionary-expression
                              (* "[" begins one where an input stands, and an indexer
                                 after a receiver *)
list-expression               = "[" [ list-item { "," list-item } [ "," ] ] "]"
list-item                     = simple-expression
dictionary-expression         = "[" "=" "]"
                              | "[" dictionary-entry { "," dictionary-entry } [ "," ] "]"
dictionary-entry              = dictionary-key "=" simple-expression
dictionary-key                = inline-string | raw-string

object                        = "{" object-content "}"
object-content                = { local "," } object-field { "," object-field } [ "," ]
object-field                  = object-field-name "=" expression

literal                       = string | number | "true" | "false" | "null"

identifier                    = letter { letter | digit }
local-name                    = identifier
object-field-name             = identifier
member-name                   = identifier
reserved-word                 = "true" | "false" | "null" | "root" | keyword
keyword                       = "it" | "not" | "try" | "as" | "to" | "and" | "or"
                              | "if" | "then" | "elseif" | "else" | "let"
                              | "do" | "end" | "return" | "function" | "import"

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
whitespace                    = ? a character matched by ECMAScript \s, except
                                  U+2028 and U+2029 ?

line-comment                  = "//" { line-character } [ line-break ]
line-character                = ? any character except a line break,
                                  U+2028 or U+2029 ?
line-break                    = ? CR LF, or a lone LF or CR ?

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
| `identifier` | An identifier's spelling, every name and every unprefixed reference written with it; which identifiers a position takes, and what one means there, are the [interpretation rules](lexical-structure.md#names-and-reserved-words-what-an-identifier-means), which the grammar's one production leaves to them |
| `lexical-reference` | `@` and an identifier, reading the nearest local, object field, conditional binding or function parameter of that name, whatever its spelling, and otherwise resolving the import binding of that name |
| `script-parameter` | `~` and an identifier, selecting the script parameter of that name explicitly |
| `import-declaration` | An import: its alias and `=` where it gives one, then its source, a registered module's name, and a dot and a type's local name where it imports one type |
| `namespace-name` | An identifier naming a module's namespace where a value stands, or qualifying a type's or an extension's name: the local name the script's imports give a module, its own or an alias |
| `module-name` | An identifier naming a registered module by its own name, as an import's source names the module it imports from |
| `namespace-access` | A module member read, a function reference, or a qualified form called, through a module's namespace; a script importing no module has none |
| `extension-access` | An extension selected explicitly, `:` or `?:` and the extension's name, its local name or one its module qualifies, then the one member operation it supplies; a named indexer's key follows as an `indexer-access`, as after a `dot-property-access` |
| `type-name` | The name of the type a cast or a conversion names, written bare: its local name, any identifier, a reserved word included, as a member's name is after `.`, qualified by the local name the script's imports give its module and a dot where written so; a qualified name parses alike whatever the script imports, and resolution decides whether the script imports the module |
| `input` | What a chain can start from |
| `receiver` | The starting form of a member chain or cast target: an input or a parenthesized cast |
| `indexer-access` | An indexer access: brackets and a key after a value, reaching its type's unnamed indexer, or, after a `dot-property-access`, the named indexer that access names where its receiver's type declares one, which resolution decides, as [named indexers](../members.md#property-access-calls-and-indexers-named-indexers) set out |
| `equality-operand` | A chain, cast, conversion or attempt, used within the arithmetic productions |
| `coalescing-operand` | An arithmetic negation or an equality operand, never binary arithmetic, which stands apart from `??` unless one of them is grouped |

In the prose, **value** means any value an expression has; type resolution determines its type. A member's **argument form** is a separate concept: it declares what the member's arguments supply. See [parameters and arguments](../members.md#arguments).
