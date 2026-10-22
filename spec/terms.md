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
| Reference type | A type a module declares whose values have identity, naming at most one supertype, declaring its `isInstance`, and abstract or not | [Reference types](types.md#reference-types) |
| Structured type | A type of immutable data a module declares, its stored shape its stored properties | [Declaring a type](modules.md#modules-declaring-a-type) |
| Membership | Whether a value belongs to a reference type, which the `isInstance` of the type and of every supertype above it answers | [Reference types](types.md#reference-types) |
| Recognition | How a binding's reference value finds its type where none is declared: the type the registered modules' `typeOf` name, the one beneath every other | [Reference types](types.md#reference-types) |
| Type identity | A module's type's module and local name together, as `home.Light`, which two modules' types of one local name tell apart | [Type identity](types.md#types-type-identity) |
| Import | A type's `import`, the modules whose public types its declaration names unqualified, reaching that declaration alone | [Type identity](types.md#types-type-identity) |
| Type parameter | A type a declaration leaves open, declared after its name in angle brackets, as `ListExtensions<T>`'s `T`, standing within the declaration that declares it, and inferred, never written in a script | [Type parameters](types.md#types-type-parameters) |
| `Any` | The type a declaration names where it accepts or answers a value of any type, whose members are selected when it is evaluated | [Values of `Any`](types.md#types-any) |
| Deferred member access | An access whose member is selected when its receiver is evaluated, since its receiver's type is unknown before | [Deferred member selection](types.md#types-any-deferred-selection) |
| Reference value | A value of a reference type, compared by identity and never part of a result | [Reference types](types.md#reference-types) |
| Object expression | An expression that names the fields of its output object | [Objects](values.md#objects) |
| Object type | A description of an object's fields and their types | [Types](types.md#types) |
| Field | A named value included in an object | [Objects](values.md#objects), [declaring a type](modules.md#modules-declaring-a-type) |
| Body | What a script, a do block, a function or a conditional branch holds: an expression alone, or locals and the `return` that gives its result | [Bodies](scripts.md#bodies) |
| Do block | `do … end`, a body evaluated where it stands, giving its result | [Bodies](scripts.md#bodies) |
| Local | A name declared with `let` in a body or an object expression, visible after its declaration through its scope, holding a value or a function | [Locals](scripts.md#locals) |
| Function | A calculation evaluated by a call. A module declares a member function, which a script also passes by reference; an expression declares a regular or arrow function that can be held by a local or passed as an argument value. | [Functions](functions.md#functions), [What a member declares](members.md#what-a-member-declares) |
| Regular function | `function(…) … end`, whose body is a body | [Functions](functions.md#functions-declaring-one) |
| Arrow function | `parameters => expression`, whose body is one simple expression, a local's initializer or an argument | [Functions](functions.md#functions-declaring-one) |
| Function value | A function read by its name without a call, an arrow function written as an argument, a function reference or an implicit body, used within the expression and never part of its result | [Functions as values](functions.md#functions-as-values) |
| Function reference | A module's function read through its namespace without a call, as `home.active`, taking its receiver first and its own arguments after it | [Module functions as values](functions.md#functions-module-functions) |
| Implicit body | An expression reading `it`, given to a function parameter whose callback takes one argument, which is its `it` | [Implicit bodies](functions.md#functions-implicit-bodies) |
| Callback contract | The argument types and the result type a member declares for a function parameter, which a function given to it is checked against | [Arguments](members.md#arguments) |
| Function parameter | A name a function declares, holding the argument each call gives it | [Functions](functions.md#functions) |
| Script parameter | A name a script reads and does not declare, which its host binds; `~` and its name, as `~room`, selects it whatever local, field, conditional binding or function parameter hides it | [Script parameters](scripts.md#scripts-script-parameters) |
| Binding | The value a host supplies for a script parameter | [Script parameters](scripts.md#scripts-script-parameters) |
| Identifier | A letter followed by letters and digits, the spelling of every name and every reference to a binding, whose position decides what it means | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Object root | The outermost object being built, which `root`, written inside an object expression, refers to, reading the fields whose initializers have completed; the language's one root | [The object root](values.md#locals-the-object-root) |
| Reserved word | A word that keeps its language meaning where a value stands: a literal's word, `root` or a keyword; a module's name is none, though it begins its namespace there in a script importing the module | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Keyword | A reserved word other than the literals' words and `root`, as `let`, `if` and `it` | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Lexical reference | `@` and an identifier, as `@to`, reading the nearest local, field, conditional binding or function parameter of that name, needed where the identifier alone means something else | [Lexical references](lexical-structure.md#names-and-reserved-words-lexical-references) |
| Implicit parameter | The value against which the current expression runs, read as `it` | [Names and resolution](scripts.md#names-and-resolution) |

<a id="chains-and-members"></a>

## Chains and members

| Term | Meaning | Reference |
| --- | --- | --- |
| Chain input | What a chain starts from: the implicit parameter, the object root, a literal, a name, a namespace's member or qualified form, a lexical reference, a script parameter selected with `~`, an object expression, an interpolated string, a function call, a parenthesized expression or an optional enclosed access | [Syntax](grammar.md#syntax) |
| Chain | An input followed by zero or more member accesses and object expressions | [Expression structure and precedence](expressions.md#expression-structure-and-precedence) |
| Receiver | The value before a member access, function call or indexer | [Access and calls](members.md#access-and-calls) |
| Member | A property, function or other declared facility of a type | [Vocabulary contracts](vocabulary.md#vocabulary-contracts) |
| Property access | A property read by its name after a dot, or by a computed name, `.[name]` | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Computed property access | `.[name]`, a property read by the name an expression gives, settled when the script is resolved | [Computed property access](members.md#computed-property-access) |
| Function call | `name(…)`, written after a receiver to call a function, which the evaluator or the host invokes, after a module's namespace to call a qualified form, or after a local function's name to call it | [Function calls](members.md#property-access-calls-and-indexers-calls) |
| Named indexer | `.name[key]`, an indexer its type declares with a name, invoked with one key | [Named indexers](members.md#property-access-calls-and-indexers-named-indexers) |
| Unnamed indexer | `[key]`, the indexer the receiver's type declares without a name, as its owner's precedence selects | [Unnamed indexers](members.md#property-access-calls-and-indexers-unnamed-indexers) |
| Argument | An expression supplied to a function call, or an indexer's key | [Arguments](members.md#arguments) |
| Argument form | What a member's arguments supply, positional, its parameters in order, or options, one options object whose fields name them | [Parameters and arguments](members.md#arguments) |
| Options object | The one object expression given to a member that takes options, whose fields supply its parameters | [Arguments](members.md#arguments-options) |
| Value, expression and predicate arguments | An argument evaluated once where the call is written; one the member evaluates against each implicit parameter its signature declares; and one of those whose truthiness the member receives | [Arguments](members.md#arguments) |
| Fixed argument | A value argument the expression's resolution settles to a string that selects a declaration, as `on`'s does | [Arguments](members.md#arguments) |
| Optional chain | A chain whose optional access stops it with null for a null receiver | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Optional enclosed access | `(? … )`, shorthand making every access in a member chain optional | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |

<a id="expressions-1"></a>

## Operators, conditionals and strings

| Term | Meaning | Reference |
| --- | --- | --- |
| Test | A member that answers a Boolean, or the function a verb is given to test its receiver | [Tests](expressions.md#tests) |
| Equality | `==`, comparing two values; `!=` negates it | [Equalities](expressions.md#equalities) |
| Truthy / falsey | Every value is truthy except null and false | [Truthiness](expressions.md#truthiness) |
| Logical expression | `and` or `or`, returning the operand that decides it | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Negation | `not`, answering whether a value is falsey | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Conditional | An `if` expression selecting a branch by truthiness | [Conditionals](expressions.md#conditionals) |
| Conditional binding | `if let` or `elseif let`, naming and testing a value once | [Conditionals](expressions.md#conditionals) |
| Coalescing operator | `??`, returning its fallback only when its value is null | [Coalescing operators](expressions.md#coalescing-operators) |
| Parenthesized expression | An expression grouped by parentheses | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Cast | `as`, answering a reference value as a type of its hierarchy, or one a declared cast operator reaches, checked by that type's membership | [Casts](types.md#casts) |
| Operator | A member of `kind: 'operator'`, `cast` or `convert`, which `as` or `to` alone invokes | [Operators](modules.md#modules-operators) |
| Conversion | `to`, converting data to another declared type | [Conversions](values.md#conversions) |
| Attempt | `try`, returning null when the one cast or conversion it attempts rejects its value | [Attempts](expressions.md#attempts) |
| Arithmetic negation | `-` before a number, negating it | [Arithmetic](expressions.md#arithmetic) |
| Interpolation | An interpolated string's `{…}`, inserting the text of the simple expression it holds | [Interpolated strings](expressions.md#interpolated-strings) |
| String | `"…"`, text whose backslashes begin escapes; also the type every form gives | [Strings and escapes](lexical-structure.md#strings-and-escapes) |
| Raw string | `'…'`, text whose backslashes are text and whose doubled quote is one quote | [Raw strings](lexical-structure.md#strings-and-escapes-raw-strings) |
| Interpolated string | `$"…"`, or `$'…'` for an interpolated raw string, text holding interpolations | [Interpolated strings](expressions.md#interpolated-strings) |
| Block | A string, raw or not and interpolated or not, written on lines of its own between delimiters of three or more quotes, its margin removed | [Blocks](lexical-structure.md#strings-and-escapes-blocks) |
| Simple expression | The restricted expression an argument, an indexer's key, a computed property name or an interpolation holds | [Simple expressions](expressions.md#simple-expressions) |

<a id="vocabulary-and-host-calls"></a>
<a id="vocabulary-and-requests"></a>

## Vocabulary and host calls

| Term | Meaning | Reference |
| --- | --- | --- |
| Vocabulary | A set of types and their declared members | [Vocabulary contracts](vocabulary.md#vocabulary-contracts) |
| Module | A unit of registration declaring types and their members, made by `createModule`, registered with `registerModule`, and reached in text through its namespace | [Namespaces](modules.md#namespaces) |
| Internal declaration | A type or a member declared `internal: true`, available within its declaring module alone | [Internal declarations](modules.md#modules-internal-declarations) |
| Lexica's own module | The module Lexica creates, which owns the language's types and declares their members, as `count` and `where`, and has no namespace | [Owners and extensions](modules.md#namespaces-owners-and-extensions) |
| Import | A script's declaration that it uses a module's vocabulary, `import home`, written at its start or supplied by its host | [Imports](scripts.md#scripts-imports) |
| Namespace | A module's name in a script importing the module, through which its module members and its qualified forms are reached, and which qualifies its types' and extensions' names | [Namespaces](modules.md#namespaces) |
| Module member | A member a module declares on no type, read through its namespace, as `home.rooms` | [Module members](modules.md#namespaces-module-members) |
| Owner | The module that declares a type, whose members and indexers on it win over every extension | [Owners and extensions](modules.md#namespaces-owners-and-extensions) |
| Extension | A named group a module declares among its `types`, `kind: 'extension'`, of the members, indexers and operators it adds to its `target`, a type another module owns | [Extensions](modules.md#extensions) |
| Extension access | An extension's member selected explicitly, `device:DeviceExtensions.usage` | [Extension access](members.md#property-access-calls-and-indexers-extension-access) |
| Qualified form | A member of a module's own type called through its namespace, the receiver first, as `home.device(room, "lamp")` | [Qualified access](modules.md#namespaces-qualified-access) |
| Boolean function | A function whose result is a `Boolean`, the form a module gives a test of its receiver, as `device.active()` | [Boolean functions](vocabulary.md#vocabulary-boolean-functions) |
| Verb | `is`, `has` or `supports`, Lexica's function answering whether its receiver passes the test it is given | [The verbs](vocabulary.md#vocabulary-verbs) |
| Observation | What a member names to learn that its result may have changed, or to keep the sample it reads | [Observations](vocabulary.md#observations) |
| Observation type | A module's declaration of an observation, its contract an invalidation or maintained | [Observations](vocabulary.md#observations) |
| Observation target | What a module declares its observations may observe besides the receiver and an argument, independent of the receiver or found from it, one target or several | [Observations](vocabulary.md#observations) |
| Type selector | A module's declaration mapping keys to types, which a fixed argument selects the type of a function's result through | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Selectable type | One key of a type selector and the type it maps to, which any module may declare | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Host call | A call of a function the host invokes, `invokedBy: 'host'`, which ends a script; Lexica resolves and prepares it, and never invokes it | [Host calls](members.md#members-host-calls) |
| Prepared call, skipped call | What preparing a host call answers: a prepared call, its declaration, receiver and arguments, which projects each value its host supplies where the call declares a result; or a skipped call, where there is nothing to invoke | [Host calls](runtime.md#runtime-host-calls) |
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
| A member's code | `impl` | the function that carries a member out |
| What the host supplies an evaluation | `env` | an implementation's `env` |
| [Receiver](members.md#access-and-calls) | `receiver` | an implementation's `receiver` |
| A call's arguments, by parameter name | `args` | an implementation's `args` |
