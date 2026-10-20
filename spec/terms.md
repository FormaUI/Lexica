# Terms

<a id="terms"></a>

In this document: [Expressions and results](#expressions-and-results) · [Chains and members](#chains-and-members) · [Expressions](#expressions-1) · [Vocabulary and requests](#vocabulary-and-requests) · [Names for implementations](#names-for-implementations).

<a id="expressions-and-results"></a>

## Expressions and results

| Term | Meaning | Reference |
| --- | --- | --- |
| Source | The text an expression is written in, which is read into its definition | [Syntax](syntax.md#syntax) |
| Expression | What a source writes, a value expression or a body, whose evaluation produces a result | [Requests](requests.md#requests) |
| Expression tree | The nodes of an expression, each with its `kind`, which the definition records with the version of its format | [Definition](definition.md#definition) |
| Result | The data produced by an expression | [Values and types](values-and-types.md#values-and-types) |
| Type | The category of a value and the members it supports | [Types](values-and-types.md#types) |
| Reference type | A type a module declares whose values have identity, naming at most one supertype and declaring the test a value of it passes | [Reference types](values-and-types.md#reference-types) |
| Reference value | A value of a reference type, compared by identity and never part of a result | [Reference types](values-and-types.md#reference-types) |
| Object expression | An expression that names the fields of its output object | [Objects](values-and-types.md#objects) |
| Object type | A description of an object's fields and their types | [Types](values-and-types.md#types) |
| Field | A named value included in an object | [Objects](values-and-types.md#objects) |
| Body | What the root expression, a do block, a function or a conditional branch holds: an expression alone, or locals and the `return` that gives its result | [Bodies](bodies-and-functions.md#bodies) |
| Do block | `do … end`, a body evaluated where it stands, giving its result | [Bodies](bodies-and-functions.md#bodies) |
| Local | A name declared with `let` in a body or an object expression, visible after its declaration through its scope, holding a value or a function | [Locals](bodies-and-functions.md#locals) |
| Function | A calculation evaluated by a call. A module declares a member function; an expression declares a regular or arrow function that can be held by a local or passed as an argument value. | [Functions](bodies-and-functions.md#functions), [What a member declares](vocabulary-contracts.md#what-a-member-declares) |
| Regular function | `function(…) … end`, whose body is a body | [Functions](bodies-and-functions.md#functions-declaring-one) |
| Arrow function | `parameters => expression`, whose body is one simple expression, a local's initializer or an argument | [Functions](bodies-and-functions.md#functions-declaring-one) |
| Function value | A function read by its name without a call, or an arrow function written as an argument, used within the expression and never part of its result | [Functions as values](bodies-and-functions.md#functions-as-values) |
| Callback contract | The argument types and the result type a member declares for a function parameter, which a function given to it is checked against | [Arguments](access-and-calls.md#arguments) |
| Function parameter | A name a function declares, holding the argument each call gives it | [Functions](bodies-and-functions.md#functions) |
| Parameter | A name through which an expression reads a caller-supplied value | [Bindings](values-and-types.md#bindings) |
| Parameter binding, or binding | The value a caller supplies for a parameter | [Bindings](values-and-types.md#bindings) |
| Caller binding | `~name`, reading the caller's binding of the name whatever local or field shares it | [Names and reserved words](names-and-scope.md#names-and-reserved-words-referring-to-the-callers-binding) |
| Object root | The outermost object being built, which `root`, written inside an object expression, refers to, reading the fields whose initializers have completed; the language's one root | [The object root](bodies-and-functions.md#locals-the-object-root) |
| Reserved word | A word that keeps its meaning where an expression stands: a literal's word, `root`, a keyword, and in text read through a registry, a module's name | [Names and reserved words](names-and-scope.md#names-and-reserved-words) |
| Keyword | A reserved word other than the literals' words, `root` and a module's name, as `let`, `if` and `it` | [Names and reserved words](names-and-scope.md#names-and-reserved-words) |
| Reserved reference | `@word`, reading the local or the field a reserved word names | [Names and reserved words](names-and-scope.md#names-and-reserved-words-referring-to-a-reserved-local-or-field) |
| Implicit parameter | The value against which the current expression runs, read as `it` | [Names and resolution](names-and-scope.md#names-and-resolution) |

<a id="chains-and-members"></a>

## Chains and members

| Term | Meaning | Reference |
| --- | --- | --- |
| Chain input | What a chain starts from: the implicit parameter, the object root, a literal, a name, a namespace's member or qualified form, a reserved reference, a caller binding, an object expression, an interpolated string, a function call, a parenthesized expression or an optional enclosed access | [Syntax](syntax.md#syntax) |
| Chain | An input followed by zero or more member accesses and object expressions | [Expression structure and precedence](expressions.md#expression-structure-and-precedence) |
| Receiver | The value before a member access, function call or indexer | [Access and calls](access-and-calls.md#access-and-calls) |
| Member | A property, function or other declared facility of a type | [Vocabulary contracts](vocabulary-contracts.md#vocabulary-contracts) |
| Property access | A property read using a dot or brackets | [Property access, function calls and indexers](access-and-calls.md#property-access-calls-and-indexers) |
| Function call | `name(…)`, written after a receiver to invoke a function, an event source, an action or a behavior, which stay distinct member kinds, after a module's namespace to call a qualified form, or after a local function's name to call it | [Function calls](access-and-calls.md#property-access-calls-and-indexers-calls) |
| Named indexer | A keyed function written after a colon | [Property access, function calls and indexers](access-and-calls.md#property-access-calls-and-indexers) |
| Default indexer | `:[key]`, the named indexer designated as the default for the receiver's type, as its owner's precedence selects | [Property access, function calls and indexers](access-and-calls.md#property-access-calls-and-indexers-default-indexers) |
| Argument | An expression supplied to a function call, or an indexer's key | [Arguments](access-and-calls.md#arguments) |
| Positional and options inputs | What a member's arguments supply: its parameters in order, or one options object whose fields name them | [Arguments](access-and-calls.md#arguments) |
| Options object | The one object expression given to a member that takes options, whose fields supply its parameters | [Arguments](access-and-calls.md#arguments-options) |
| Value, expression and predicate arguments | An argument evaluated once where the call is written; one the member evaluates against each implicit parameter its signature declares; and one of those whose truthiness the member receives | [Arguments](access-and-calls.md#arguments) |
| Fixed argument | A value argument the expression's resolution settles to a string that selects a declaration, as those of `is` and `on` do | [Arguments](access-and-calls.md#arguments) |
| Optional chain | A chain whose optional access stops it with null for a null receiver | [Property access, function calls and indexers](access-and-calls.md#property-access-calls-and-indexers) |
| Optional enclosed access | `(? … )`, shorthand making every access in a member chain optional | [Property access, function calls and indexers](access-and-calls.md#property-access-calls-and-indexers) |

<a id="expressions-1"></a>

## Expressions

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
| Cast | `as`, answering a reference value as a type of its hierarchy, checked by that type's test | [Casts](casts-and-conversions.md#casts) |
| Conversion | `to`, converting data to another declared type | [Conversions](casts-and-conversions.md#conversions) |
| Attempt | `try`, returning null when the one cast or conversion it attempts rejects its value | [Attempts](casts-and-conversions.md#attempts) |
| Arithmetic negation | `-` before a number, negating it | [Arithmetic](expressions.md#arithmetic) |
| Interpolation | An interpolated string's `{…}`, inserting the text of the simple expression it holds | [Interpolated strings](expressions.md#interpolated-strings) |
| String | `"…"`, text whose backslashes begin escapes; also the type every form gives | [Strings and escapes](lexical-structure.md#strings-and-escapes) |
| Raw string | `'…'`, text whose backslashes are text and whose doubled quote is one quote | [Raw strings](lexical-structure.md#strings-and-escapes-raw-strings) |
| Interpolated string | `$"…"`, or `$'…'` for an interpolated raw string, text holding interpolations | [Interpolated strings](expressions.md#interpolated-strings) |
| Block | A string, raw or not and interpolated or not, written on lines of its own between delimiters of three or more quotes, its margin removed | [Blocks](lexical-structure.md#strings-and-escapes-blocks) |
| Simple expression | The restricted expression an argument, an indexer's key, a bracket property name or an interpolation holds | [Simple expressions](access-and-calls.md#simple-expressions) |

<a id="vocabulary-and-requests"></a>

## Vocabulary and requests

| Term | Meaning | Reference |
| --- | --- | --- |
| Vocabulary | A set of types and their declared members | [Vocabulary contracts](vocabulary-contracts.md#vocabulary-contracts) |
| Module | A unit of registration declaring types and their members, made by `createModule`, registered with `registerModule`, and reached in text through its namespace | [Namespaces](modules-and-namespaces.md#namespaces) |
| Lexica's own module | The module Lexica creates, which owns the language's types and declares their members, as `count` and `where`, and has no namespace | [Owners and extensions](modules-and-namespaces.md#namespaces-owners-and-extensions) |
| Namespace | A module's name in text read through its registry, through which its module members and its qualified forms are reached | [Namespaces](modules-and-namespaces.md#namespaces) |
| Module member | A member a module declares on no type, read through its namespace, as `home.rooms` | [Module members](modules-and-namespaces.md#namespaces-module-members) |
| Owner | The module that declares a type, whose members, predicates and indexers on it win over every extension | [Owners and extensions](modules-and-namespaces.md#namespaces-owners-and-extensions) |
| Extension | A member, predicate or indexer a module declares on a type another module owns | [Extensions](modules-and-namespaces.md#extensions) |
| Qualified form | A member or a predicate called through its module's namespace, the receiver first, as `energy.usage(device)` | [Qualified access](modules-and-namespaces.md#namespaces-qualified-access) |
| Predicate | A Boolean question of a receiver under a name of its own, asked with its verb | [Predicates](vocabulary-contracts.md#predicates) |
| Verb | `is`, `has` or `supports`, the call that asks a predicate by its name | [Predicates](vocabulary-contracts.md#predicates) |
| Observation | What a member names to learn that its result may have changed, or to keep the sample it reads | [Observations](vocabulary-contracts.md#observations) |
| Observation type | A module's declaration of an observation, its contract an invalidation or maintained | [Observations](vocabulary-contracts.md#observations) |
| Observation target | What a module declares its observations may observe besides the receiver and an argument, independent of the receiver or found from it, one target or several | [Observations](vocabulary-contracts.md#observations) |
| Watch | A host's value request kept current, evaluated again when an observation reports a change | [Observations](vocabulary-contracts.md#observations) |
| Event source | A member producing a stream of events | [Events](requests.md#events) |
| Event | Something that happened, delivered by a source | [Events](requests.md#events) |
| Event type | A module's declaration of the data an event offers | [Events and event types](vocabulary-contracts.md#events-and-event-types) |
| Event data | What an event source captured of an event | [Events and event types](vocabulary-contracts.md#events-and-event-types) |
| Action | A member kind of its own, which its module carries out once when the caller executes the request | [Requests](requests.md#requests) |
| Behavior | A member kind of its own, which its module starts when the caller applies the request and which runs until updated or disposed | [Requests](requests.md#requests) |
| Request | A value, subscription, action or behavior request | [Requests](requests.md#requests) |
| Definition | The JSON document recording a request's meaning | [Definition](definition.md#definition) |

<a id="names-for-implementations"></a>

## Names for implementations

The specification names concepts, and an implementation names its own code. The names below are suggested wherever they read well, so implementations, and the modules written for them, read alike.

When naming the implicit parameter or concepts associated with it, implementations may use **context**, either on its own or within compound names. This convention does not reserve the word: **context** may also describe other concepts where its meaning is clear.

| Concept | Name in code | As in |
| --- | --- | --- |
| [Implicit parameter](names-and-scope.md#names-and-resolution) | `context` | `context`, `contextType`, `projectionContext`, a parameter declaration's `context: 'item'` |
| A member's code | `implementation` | the function that carries a member out |
| What the host supplies an evaluation | `env` | an implementation's `env` |
| [Receiver](access-and-calls.md#access-and-calls) | `receiver` | an implementation's `receiver` |
| A call's arguments, by parameter name | `args` | an implementation's `args` |
