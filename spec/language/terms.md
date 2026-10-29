# Terms

<a id="terms"></a>

Each term the language contract uses, what it means, and where its authoritative explanation is. A term here defines nothing its linked document does not; a term whose rule the runtime states is defined in [the runtime's glossary](../runtime/terms.md), and stands here briefly, linking it.

In this document:

1. [Scripts, values and results](#expressions-and-results)
2. [Collections](#terms-collections)
3. [Chains and members](#chains-and-members)
4. [Operators, conditionals and strings](#expressions-1)
5. [Vocabulary and host calls](#vocabulary-and-host-calls)

<a id="expressions-and-results"></a>

## Scripts, values and results

| Term | Meaning | Reference |
| --- | --- | --- |
| Script | A standalone piece of Nexo code a host reads, resolves and evaluates, which reads its script parameters and its domain and produces data | [Scripts](scripts.md#scripts) |
| Source | A script's text, which is read into its definition | [Lexical structure](lexical-structure.md#lexical-structure) |
| Expression | A part of a script that has a value, as `room.devices`; a script is a body of expressions | [Expressions](expressions.md#expressions) |
| Result | The data produced by an expression | [Values and types](values.md#values-and-types) |
| Type | The category of a value and the members it supports | [Types](types.md#types) |
| Reference type | A type a module declares whose values have identity, naming at most one supertype, declaring its `isInstance`, and abstract or not | [Reference types](types.md#reference-types) |
| Type identity | A module's type's module and local name together, as `Home.Light`, which two modules' types of one local name tell apart | [Type identity](types.md#types-type-identity) |
| Import | A type's `import`, the modules whose public types its declaration names unqualified, reaching that declaration alone | [Type identity](types.md#types-type-identity) |
| Type parameter | A type a declaration leaves open, declared after its name in angle brackets, as `ListExtensions<T>`'s `T`, standing within the declaration that declares it, and inferred, never written in a script | [Type parameters](types.md#types-type-parameters) |
| `Any` | The type a declaration names where it accepts or answers a value of any type that isn't null, `Any?` where it may be null too, whose members are selected when it is evaluated | [Values of `Any`](types.md#types-any) |
| Deferred member access | An access whose member is selected when its receiver is evaluated, since its receiver's type is unknown before | [Deferred member selection](types.md#types-any-deferred-selection) |
| Reference value | A value of a reference type, compared by identity and never part of a result | [Reference types](types.md#reference-types) |
| Object expression | An expression that names its output object's fields | [Objects](values.md#objects) |
| Object type | A description of an object's fields and their types | [Types](types.md#types) |
| Object field | A named value included in an object, an object expression writing it as its name, `=` and its value | [Objects](values.md#objects) |
| Body | What a script, a do block, a function or a conditional branch holds: an expression alone, or locals and the `return` that gives its result | [Bodies](scripts.md#bodies) |
| Do block | `do … end`, a body evaluated where it stands, giving its result | [Bodies](scripts.md#bodies) |
| Local | A name declared with `let` in a body or an object expression, visible after its declaration through its scope, holding a value or a function | [Locals](scripts.md#locals) |
| Function | A calculation evaluated by a call. A module declares a member function, which a script also passes by reference; an expression declares a regular or arrow function that can be held by a local or passed as an argument value. | [Functions](functions.md#functions), [What a member declares](members.md#what-a-member-declares) |
| Regular function | `function(…) … end`, whose body is a body | [Functions](functions.md#functions-declaring-one) |
| Arrow function | `parameters => expression`, whose body is one simple expression, a local's initializer or an argument | [Functions](functions.md#functions-declaring-one) |
| Function reference | A value that refers to a function together with what calling it needs: a function the script declares, read by its name without a call, an arrow function written as an argument, or a module's function read through its namespace, as `Home.active`, or through its extension, as `device:Device.active`; used within the expression and never part of its result | [Function references](functions.md#functions-references) |
| Reference to a module's function | A function reference to a function a module declares, read through its namespace without a call, as `Home.active`, which takes its receiver first and its own arguments after it | [References to a module's functions](functions.md#functions-module-references) |
| Reference to a script function | A function reference to a function the script declares, holding its captured scope | [Function references](functions.md#functions-references) |
| Captured scope | What a reference to a script function captures where its function is declared: the locals, the implicit parameter and the object root | [What a function sees](functions.md#functions-what-it-sees) |
| Implicit body | An expression reading `it`, given to a function parameter whose callback takes one argument, which is its `it`; the evaluator wraps it in the callback the member receives, evaluating it at each call | [Implicit bodies](functions.md#functions-implicit-bodies) |
| Callback | A callable supplied to an operation for that operation to invoke. Nexo creates callbacks from function references or argument bodies, subject to the receiving member's contract and invocation lifetime | [Functions passed to members](functions.md#functions-passed-to-members) |
| Callback contract | The argument types and the result type a member declares for a function parameter, which the callback given to it is checked against | [Arguments](members.md#arguments) |
| Function parameter | A name a function declares, holding the argument each call gives it | [Functions](functions.md#functions) |
| Script parameter | A name a script reads and does not declare, which its host binds; `~` and its name, as `~room`, selects it whatever local, object field, conditional binding or function parameter hides it | [Script parameters](scripts.md#scripts-script-parameters) |
| Binding | The value a host supplies for a script parameter | [Script parameters](scripts.md#scripts-script-parameters) |
| Identifier | A letter followed by letters and digits, the spelling of every name and every reference to a binding, whose position decides what it means | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Object root | The outermost object being built, which `root`, written inside an object expression, refers to, reading its object fields whose initializers have completed; the language's one root | [The object root](values.md#locals-the-object-root) |
| Line break | LF, CRLF or a lone CR, the one definition every rule about lines follows | [Line breaks](lexical-structure.md#line-structure-line-breaks) |
| Line structure | Where a line may break, must break and cannot, which constrains a layout and never changes a reading | [Line structure](lexical-structure.md#line-structure) |
| Block form | A conditional, a `do` block or a function expression spanning lines, each keyword ending its line and `end` on its own | [Keyword blocks](lexical-structure.md#line-structure-keyword-blocks) |
| Reserved word | A word that keeps its language meaning where a value stands: a literal's word, `root` or a keyword; a module's name is none, though it begins its namespace there in a script importing the module | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Keyword | A reserved word other than the literals' words and `root`, as `let`, `if` and `it` | [Names and reserved words](lexical-structure.md#names-and-reserved-words) |
| Lexical reference | `@` and an identifier, as `@to`, reading the nearest local, object field, conditional binding or function parameter of that name, and otherwise resolving the import binding of that name, needed where the identifier alone means something else | [Lexical references](lexical-structure.md#names-and-reserved-words-lexical-references) |
| Implicit parameter | The value against which the current expression runs, read as `it` | [Names and resolution](scripts.md#names-and-resolution) |
| Structured type | A type of immutable data a module declares, whose value a script reads and constructs, as the runtime's [glossary](../runtime/terms.md#runtime-terms-declarations) defines it | [Constructing a structure](types.md#types-constructing-a-structure) |
| Membership | Whether a value belongs to a reference type, as the runtime's [glossary](../runtime/terms.md#runtime-terms-declarations) defines it | [Reference types](types.md#reference-types) |

<a id="terms-collections"></a>

## Collections

| Term | Meaning | Reference |
| --- | --- | --- |
| Collection | A list or a dictionary, an immutable value whose members Nexo's own module declares | [Collections](collections.md#collections) |
| List | `List<T>`, items of type `T` in order, each at a position | [Lists](collections.md#collections-lists) |
| Dictionary | `Dictionary<K, V>`, entries addressed by key, each key once, ordered by insertion | [Dictionaries and pairs](collections.md#collections-dictionaries-and-pairs) |
| Pair | `Pair<K, V>`, immutable data of a `key` and its `value`, as a dictionary's entries give them | [Dictionaries and pairs](collections.md#collections-dictionaries-and-pairs) |
| Key type | A type whose values one exact equality compares, which a dictionary's keys, grouping, membership and distinctness use | [Dictionaries and pairs](collections.md#collections-dictionaries-and-pairs) |
| Collection expression | `[…]`, a list of its items or a dictionary of its entries written where a value stands, `[]` and `[=]` the empty ones | [Collection expressions](collections.md#collections-collection-expressions) |
| Position | Where a list's item stands: a number, its offset from the start, or an index | [Positions](collections.md#collections-positions) |
| Index | `^n`, an `Index`, a position counted from a list's end, `^1` the last item | [Positions](collections.md#collections-positions) |
| Range | `start..end`, a `Range`, a half-open interval of two positions, either left out, which slices a list or a string | [Positions](collections.md#collections-positions) |
| Variance | How a generic type's arguments relate: `List<T>` covariant, `Dictionary<K, V>` invariant in `K` and covariant in `V`, `Pair<K, V>` covariant in both | [Variance](collections.md#collections-variance) |
| Ordering | `orderBy` and its kin, ordering a list's items by keys stably, `thenBy` refining an order already made | [Ordering](collections.md#collections-list-ordering) |

<a id="chains-and-members"></a>

## Chains and members

| Term | Meaning | Reference |
| --- | --- | --- |
| Chain input | What a chain starts from: the implicit parameter, the object root, a literal, a name, a namespace's member or qualified form, a lexical reference, a script parameter selected with `~`, an object expression, an interpolated string, a function call, a parenthesized expression or an optional enclosed access | [Syntax](grammar.md#syntax) |
| Chain | An input followed by zero or more member accesses and object expressions | [Expression structure and precedence](expressions.md#expression-structure-and-precedence) |
| Receiver | The value before a member access, function call or indexer | [Access and calls](members.md#access-and-calls) |
| Member | A property, a function, an indexer or an operator a module declares on a type, or a property or a function it declares on none | [Vocabulary contracts](vocabulary.md#vocabulary-contracts) |
| Property | A member a script reads without arguments, whether a structured value's data or its implementation gives its value; a definition node's, a record's and a JavaScript object's keys are properties too, in JavaScript's sense, and none is a member | [Members](members.md#members) |
| Property access | The property its receiver's type declares, or an object's field, read by its name after a dot, or by a computed name, `.[name]` | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Computed property access | `.[name]`, the property or the object's field an expression's name gives, settled when the script is resolved | [Computed property access](members.md#computed-property-access) |
| Function call | `name(…)`, written after a receiver to call a function, which the evaluator or the host invokes, after a module's namespace to call a qualified form, or after a local function's name to call it | [Function calls](members.md#property-access-calls-and-indexers-calls) |
| Named indexer | `.name[key]`, an indexer its type declares with a name, invoked with one key | [Named indexers](members.md#property-access-calls-and-indexers-named-indexers) |
| Unnamed indexer | `[key]`, the indexer the receiver's type declares without a name, as its owner's precedence selects | [Unnamed indexers](members.md#property-access-calls-and-indexers-unnamed-indexers) |
| Argument | An expression supplied to a function call, or an indexer's key | [Arguments](members.md#arguments) |
| Argument form | What a member's arguments supply, positional, its parameters in order, or options, one options object whose object fields name them | [Parameters and arguments](members.md#arguments) |
| Options object | The one object expression given to a member that takes options, whose object fields supply its parameters | [Arguments](members.md#arguments-options) |
| Value, expression and predicate arguments | An argument evaluated once where the call is written; one the member evaluates against each implicit parameter its signature declares; and one of those whose truthiness the member receives | [Arguments](members.md#arguments) |
| Fixed argument | A value argument the expression's resolution settles to a string that selects a declaration, as `on`'s does | [Arguments](members.md#arguments) |
| Optional chain | A chain whose optional access stops it with null for a null receiver | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |
| Optional enclosed access | `(? … )`, shorthand making every access in a member chain optional | [Property access, function calls and indexers](members.md#property-access-calls-and-indexers) |

<a id="expressions-1"></a>

## Operators, conditionals and strings

| Term | Meaning | Reference |
| --- | --- | --- |
| Test | A member that answers a Boolean, or a function a member is given to test what it calls it with | [Tests](expressions.md#tests) |
| Equality | `==`, comparing two values; `!=` negates it | [Equalities](expressions.md#equalities) |
| Truthy / falsey | Every value is truthy except null and false | [Truthiness](expressions.md#truthiness) |
| Logical expression | `and` or `or`, returning the operand that decides it | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Negation | `not`, answering whether a value is falsey | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Conditional | An `if` expression selecting a branch by truthiness | [Conditionals](expressions.md#conditionals) |
| Conditional binding | `if let` or `elseif let`, naming and testing a value once | [Conditionals](expressions.md#conditionals) |
| Coalescing operator | `??`, returning its fallback only when its value is null | [Coalescing operators](expressions.md#coalescing-operators) |
| Parenthesized expression | An expression grouped by parentheses | [Logical expressions](expressions.md#logical-expressions-negations-and-groups) |
| Cast | `as`, answering a reference value as a type of its hierarchy, or one a declared cast operator reaches, checked by that type's membership | [Casts](types.md#casts) |
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
| Nexo's own module | The module Nexo creates, which owns the language's types and declares their members, as `count` and `where`, and has no namespace | [Owners and extensions](extensions.md#extensions-owners) |
| Import | A script's declaration that it uses a module's vocabulary, `import Home`, or one type's, `import Home.Sensor`, written at its start or supplied by its host | [Imports](modules.md#scripts-imports) |
| Alias | The local name an import gives in place of its module's or its type's own, `import Measures = Measurements` | [Imports](modules.md#scripts-imports) |
| Namespace | The local name a script's import gives a module, its own or an alias, through which its module members and its qualified forms are reached, and which qualifies its types' and extensions' names | [Namespaces](modules.md#namespaces) |
| Module member | A member a module declares on no type, read through its namespace, as `Home.rooms` | [Module members](modules.md#namespaces-module-members) |
| Owner | The module that declares a type, whose members and indexers on it win over every extension | [Owners and extensions](extensions.md#extensions-owners) |
| Extension | A named group a module declares among its `types`, `kind: 'extension'`, of the members, indexers and operators it adds to its `target`, a type another module owns or a type parameter it declares | [Extensions](extensions.md#extensions) |
| Extension access | An extension's member selected explicitly, `device:Device.usage` | [Extension access](extensions.md#extensions-access) |
| Qualified form | A member of a module's own type called through its namespace, the receiver first, as `Home.device(room, "lamp")` | [Qualified access](modules.md#namespaces-qualified-access) |
| Boolean function | A function whose result is a `Boolean`, the form a module gives a test of its receiver, as `device.active()` | [Boolean functions](vocabulary.md#vocabulary-boolean-functions) |
| Type selector | A module's declaration mapping keys to types, which a fixed argument selects the type of a function's result through | [Type selectors](vocabulary.md#vocabulary-type-selectors) |
| Host call | A call of a function the host invokes, `invokedBy: 'host'`, which ends a script; Nexo resolves and prepares it, and never invokes it | [Host calls](members.md#members-host-calls) |
| Result projection | The object expression following a host call, evaluated against each value its host supplies | [The values a host supplies](members.md#members-host-calls-the-values-a-host-supplies) |
| Host | The application around an implementation of Nexo, which binds a script's values and invokes its host calls, as the runtime's [glossary](../runtime/terms.md#runtime-terms-hosting) defines it | [Host calls](members.md#members-host-calls) |
