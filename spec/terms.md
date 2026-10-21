# Terms

<a id="terms"></a>

Each term the specification uses, what it means, and where its authoritative explanation is. A term here defines nothing its linked document does not.

In this document:

1. [Scripts, values and results](#expressions-and-results)
2. [Chains and members](#chains-and-members)
3. [Operators, conditionals and strings](#expressions-1)
4. [Vocabulary and host calls](#vocabulary-and-host-calls)
5. [Names for implementations](#names-for-implementations)

<a id="expressions-and-results"></a>

## Scripts, values and results

| Term | Meaning | Reference |
| --- | --- | --- |
| Script | A standalone piece of Lexica code a host reads, resolves and evaluates, which reads its script parameters and its domain and produces data | [Scripts](scripts.md#scripts) |
| Source | A script's text, which is read into its definition | [Lexical structure](lexical-structure.md#lexical-structure) |
| Expression | A part of a script that has a value, as `room.devices`; a script is a body of expressions | [Expressions](expressions.md#expressions) |
| Expression tree | The nodes of an expression, each with its `kind`, which the definition records with the version of its format | [Definition](definition.md#definition) |
| Result | The data produced by an expression | [Values and types](values.md#values-and-types) |
| Type | The category of a value and the members it supports | [Types](types.md#types) |
| Reference type | A type a module declares whose values have identity, naming at most one supertype and declaring the test a value of it passes | [Reference types](types.md#reference-types) |
| Reference value | A value of a reference type, compared by identity and never part of a result | [Reference types](types.md#reference-types) |
| Object expression | An expression that names the fields of its output object | [Objects](values.md#objects) |
| Object type | A description of an object's fields and their types | [Types](types.md#types) |
| Field | A named value included in an object | [Objects](values.md#objects) |
| Body | What a script, a do block, a function or a conditional branch holds: an expression alone, or locals and the `return` that gives its result | [Bodies](scripts.md#bodies) |
| Do block | `do … end`, a body evaluated where it stands, giving its result | [Bodies](scripts.md#bodies) |
| Local | A name declared with `let` in a body or an object expression, visible after its declaration through its scope, holding a value or a function | [Locals](scripts.md#locals) |
| Function | A calculation evaluated by a call. A module declares a member function; an expression declares a regular or arrow function that can be held by a local or passed as an argument value. | [Functions](functions.md#functions), [What a member declares](members.md#what-a-member-declares) |
| Regular function | `function(…) … end`, whose body is a body | [Functions](functions.md#functions-declaring-one) |
| Arrow function | `parameters => expression`, whose body is one simple expression, a local's initializer or an argument | [Functions](functions.md#functions-declaring-one) |
| Function value | A function read by its name without a call, or an arrow function written as an argument, used within the expression and never part of its result | [Functions as values](functions.md#functions-as-values) |
| Callback contract | The argument types and the result type a member declares for a function parameter, which a function given to it is checked against | [Arguments](members.md#arguments) |
| Function parameter | A name a function declares, holding the argument each call gives it | [Functions](functions.md#functions) |
| Script parameter | A name a script reads and does not declare, which its host binds | [Script parameters](scripts.md#scripts-script-parameters) |
| Binding | The value a host supplies for a script parameter | [Script parameters](scripts.md#scripts-script-parameters) |
| Parameter reference | `~` and a name, as `~room`, reading the script parameter of that name whatever local, field, conditional binding or function parameter hides it | [Parameter references](scripts.md#scripts-parameter-references) |
| Object root | The outermost object being built, which `root`, written inside an object expression, refers to, reading the fields whose initializers have completed; the language's one root | [The object root](values.md#locals-the-object-root) |
| Reserved word | A word that keeps its meaning where an expression stands: a literal's word, `root`, a keyword, and in text read through a registry, a module's name | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Keyword | A reserved word other than the literals' words, `root` and a module's name, as `let`, `if` and `it` | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Reserved reference | `@word`, reading the local or the field a reserved word names | [Names and reserved words](lexical-structure.md#names-and-reserved-words-referring-to-a-reserved-local-or-field) |
| Implicit parameter | The value against which the current expression runs, read as `it` | [Names and resolution](scripts.md#names-and-resolution) |

<a id="chains-and-members"></a>

## Chains and members

| Term | Meaning | Reference |
| --- | --- | --- |
| Chain input | What a chain starts from: the implicit parameter, the object root, a literal, a name, a namespace's member or qualified form, a reserved reference, a parameter reference, an object expression, an interpolated string, a function call, a parenthesized expression or an optional enclosed access | [Syntax](grammar.md#syntax) |
| Chain | An input followed by zero or more member accesses and object expressions | [Expression structure and precedence](expressions.md#expression-structure-and-precedence) |
| Receiver | The value before a member access, function call or indexer | [Access and calls](members.md#access-and-calls) |
| Member | A property, function or other declared facility of a type | [Vocabulary contracts](vocabulary.md#vocabulary-contracts) |
| Property access | A property read using a dot or brackets | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Function call | `name(…)`, written after a receiver to call a function, which the evaluator or the host invokes, after a module's namespace to call a qualified form, or after a local function's name to call it | [Function calls](members.md#property-access-calls-and-indexers-calls) |
| Named indexer | A keyed function written after a colon | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Default indexer | `:[key]`, the named indexer designated as the default for the receiver's type, as its owner's precedence selects | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers-default-indexers) |
| Argument | An expression supplied to a function call, or an indexer's key | [Arguments](members.md#arguments) |
| Argument form | What a member's arguments supply, positional, its parameters in order, or options, one options object whose fields name them | [Parameters and arguments](members.md#arguments) |
| Options object | The one object expression given to a member that takes options, whose fields supply its parameters | [Arguments](members.md#arguments-options) |
| Value, expression and predicate arguments | An argument evaluated once where the call is written; one the member evaluates against each implicit parameter its signature declares; and one of those whose truthiness the member receives | [Arguments](members.md#arguments) |
| Fixed argument | A value argument the expression's resolution settles to a string that selects a declaration, as those of `is` and `on` do | [Arguments](members.md#arguments) |
| Optional chain | A chain whose optional access stops it with null for a null receiver | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Optional enclosed access | `(? … )`, shorthand making every access in a member chain optional | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |

<a id="expressions-1"></a>

## Operators, conditionals and strings

| Term | Meaning | Reference |
| --- | --- | --- |
| Test | A member that answers a Boolean, or a predicate asked with its verb | [Tests](expressions.md#tests) |
| Equality | `==`, comparing two values; `!=` negates it | [Equalities](expressions.md#equalities) |
| Truthy / falsey | Every value is truthy except null and false | [Truthiness](expressions.md#truthiness) |
| Logical expression | `and` or `or`, returning the operand that decides it | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Negation | `not`, answering whether a value is falsey | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Conditional | An `if` expression selecting a branch by truthiness | [Conditionals](expressions.md#conditionals) |
| Conditional binding | `if let` or `elseif let`, naming and testing a value once | [Conditionals](expressions.md#conditionals) |
| Coalescing operator | `??`, returning its fallback only when its value is null | [Coalescing operators](expressions.md#coalescing-operators) |
| Parenthesized expression | An expression grouped by parentheses | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Cast | `as`, answering a reference value as a type of its hierarchy, checked by that type's test | [Casts](types.md#casts) |
| Conversion | `to`, converting data to another declared type | [Conversions](values.md#conversions) |
| Attempt | `try`, returning null when the one cast or conversion it attempts rejects its value | [Attempts](expressions.md#attempts) |
| Arithmetic negation | `-` before a number, negating it | [Arithmetic](expressions.md#arithmetic) |
| Interpolation | An interpolated string's `{…}`, inserting the text of the simple expression it holds | [Interpolated strings](expressions.md#interpolated-strings) |
| String | `"…"`, text whose backslashes begin escapes; also the type every form gives | [Strings and escapes](lexical-structure.md#strings-and-escapes) |
| Raw string | `'…'`, text whose backslashes are text and whose doubled quote is one quote | [Raw strings](lexical-structure.md#strings-and-escapes-raw-strings) |
| Interpolated string | `$"…"`, or `$'…'` for an interpolated raw string, text holding interpolations | [Interpolated strings](expressions.md#interpolated-strings) |
| Block | A string, raw or not and interpolated or not, written on lines of its own between delimiters of three or more quotes, its margin removed | [Blocks](lexical-structure.md#strings-and-escapes-blocks) |
| Simple expression | The restricted expression an argument, an indexer's key, a bracket property name or an interpolation holds | [Simple expressions](expressions.md#simple-expressions) |

<a id="vocabulary-and-host-calls"></a>
<a id="vocabulary-and-requests"></a>

## Vocabulary and host calls

| Term | Meaning | Reference |
| --- | --- | --- |
| Vocabulary | A set of types and their declared members | [Vocabulary contracts](vocabulary.md#vocabulary-contracts) |
| Module | A unit of registration declaring types and their members, made by `createModule`, registered with `registerModule`, and reached in text through its namespace | [Namespaces](modules.md#namespaces) |
| Lexica's own module | The module Lexica creates, which owns the language's types and declares their members, as `count` and `where`, and has no namespace | [Owners and extensions](modules.md#namespaces-owners-and-extensions) |
| Namespace | A module's name in text read through its registry, through which its module members and its qualified forms are reached | [Namespaces](modules.md#namespaces) |
| Module member | A member a module declares on no type, read through its namespace, as `home.rooms` | [Module members](modules.md#namespaces-module-members) |
| Owner | The module that declares a type, whose members, predicates and indexers on it win over every extension | [Owners and extensions](modules.md#namespaces-owners-and-extensions) |
| Extension | A member, predicate or indexer a module declares on a type another module owns | [Extensions](modules.md#extensions) |
| Qualified form | A member or a predicate called through its module's namespace, the receiver first, as `energy.usage(device)` | [Qualified access](modules.md#namespaces-qualified-access) |
| Predicate | A Boolean question of a receiver under a name of its own, asked with its verb | [Predicates](vocabulary.md#predicates) |
| Verb | `is`, `has` or `supports`, the call that asks a predicate by its name | [Predicates](vocabulary.md#predicates) |
| Observation | What a member names to learn that its result may have changed, or to keep the sample it reads | [Observations](vocabulary.md#observations) |
| Observation type | A module's declaration of an observation, its contract an invalidation or maintained | [Observations](vocabulary.md#observations) |
| Observation target | What a module declares its observations may observe besides the receiver and an argument, independent of the receiver or found from it, one target or several | [Observations](vocabulary.md#observations) |
| Type selector | A module's declaration mapping keys to types, which a fixed argument selects the type of a function's result through | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Selectable type | One key of a type selector and the type it maps to, which any module may declare | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Host call | A call of a function the host invokes, `invokedBy: 'host'`, which ends a script; Lexica resolves and prepares it, and never invokes it | [Host calls](members.md#members-host-calls) |
| Preparation | What preparing a host call answers: its declaration, receiver and arguments, or that it is skipped | [Host calls](runtime.md#runtime-host-calls) |
| Result projection | The object expression following a host call, evaluated against each value its host supplies | [The values a host supplies](members.md#members-host-calls-the-values-a-host-supplies) |
| Definition | The JSON document recording a script's meaning | [Definition](definition.md#definition) |
| Runtime | What carries a script out for a host: reading, resolving and evaluating it | [Runtime](runtime.md#runtime) |
| Host | The application around the runtime, which registers modules, binds values, evaluates, invokes its host calls and decides what to do with each result | [Runtime](runtime.md#runtime) |
| Registry | What holds the modules a host resolves and evaluates against | [Registries](modules.md#modules-registries) |
| Resolution | A script resolved against a registry with bindings of one resolution key: its type and the declarations it uses | [Resolution](runtime.md#runtime-bindings-and-resolution) |
| Diagnostic | A description of one problem, its kind, message and location, which a strict operation throws as an error | [Diagnostics and errors](diagnostics-and-errors.md#diagnostics-and-errors) |

<a id="names-for-implementations"></a>

## Names for implementations

The specification names concepts, and an implementation names its own code. The names below are suggested wherever they read well, so implementations, and the modules written for them, read alike.

When naming the implicit parameter or concepts associated with it, implementations may use **context**, either on its own or within compound names. This convention does not reserve the word: **context** may also describe other concepts where its meaning is clear.

| Concept | Name in code | As in |
| --- | --- | --- |
| [Implicit parameter](scripts.md#names-and-resolution) | `context` | `context`, `contextType`, `projectionContext`, a parameter declaration's `context: 'item'` |
| A member's code | `implementation` | the function that carries a member out |
| What the host supplies an evaluation | `env` | an implementation's `env` |
| [Receiver](members.md#access-and-calls) | `receiver` | an implementation's `receiver` |
| A call's arguments, by parameter name | `args` | an implementation's `args` |
