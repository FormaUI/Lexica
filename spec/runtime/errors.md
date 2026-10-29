# Errors

<a id="diagnostics-and-errors"></a>

<a id="errors-and-diagnostics"></a>

A **diagnostic** describes one problem with a script, a definition, a binding or a module: what is wrong, and where. An **error** is how a strict operation reports one: it throws a `NexoError`, whose `code` identifies the condition, as [codes](#diagnostics-codes) set out, whose `kind` is the category of the failure and whose `location` says where it stands, and stops there. Every public operation of an implementation is strict: reading text, validating a definition, binding, registering a module, resolving and evaluating each throw their first diagnostic as an error. Tooling reads text tolerantly instead, and keeps every diagnostic without throwing, as [tolerant reading](#diagnostics-tolerant-reading) sets out.

Invalid syntax, an invalid definition or binding, an invalid script, an invalid module and an evaluation failure are errors, of the kinds `syntax`, `structure`, `validation`, `module` and `evaluation`, each raised at its stage:

| Kind | Raised by | For |
| --- | --- | --- |
| `syntax` | Reading text | Text that does not follow the grammar |
| `structure` | Reading text, validating a definition, binding, and resolving, creating an evaluator or entering one with bindings or a registry that no longer fit | A definition or a binding that breaks the language's structural rules; validating a definition, `nexo.validate`, checks these alone, with no registry |
| `validation` | Resolution | A script that does not fit its vocabulary or its types: the semantic validation resolution performs against a registry |
| `module` | Creating and registering a module, creating an evaluator | A declaration that breaks a declaration contract, or a used declaration without an implementation |
| `evaluation` | Evaluation, its hooks and its prepared calls | A failure while the script is evaluated |

Structural validation checks a definition against the definition format wherever one is read or given, `nexo.validate` among them, and reports a `structure` error. Semantic validation checks a script against its vocabulary and its types, which resolution alone can, and reports a `validation` error, so `nexo.validate` never raises one.

A **fault** is an evaluation error no attempt catches, as a declaration's `impl` failing otherwise than by its `reject`.

A `NexoError` is an `Error` whose `name` is `NexoError`, holding its `code`, its `kind`, its `location`, as [where a failure is located](#validation-diagnostics) sets out, and its `message`, which says what is wrong followed, in parentheses, by where, wherever its location holds anything; an evaluation error something caused, an implementation or a hook throwing among them, holds that as its `cause`. Its constructor is not public: a host builds an error of its own with the class's factories, `NexoError.structure(code, message, location)`, `NexoError.validation(code, message, location)` and `NexoError.evaluation(code, message, location, { cause })`, each of the kind it names, and an error a host builds is never taken for one Nexo raised, as [a hook that throws](evaluation.md#runtime-evaluation) sets out.

The conditions a script itself breaks, of what it may express, are the language's, as [errors](../language/errors.md) set out; this catalog gives those of the definition a host exchanges, its bindings, its declarations, its code and its use of the API.

In this document:

1. [Codes](#diagnostics-codes)
2. [Where a failure is located](#validation-diagnostics)
3. [Structure errors](#runtime-structure-errors)
4. [Module errors](#module-errors)
5. [Validation errors](#runtime-validation-errors)
6. [Evaluation errors](#runtime-evaluation-errors)
7. [Tolerant reading](#diagnostics-tolerant-reading)
8. [Retired codes](#runtime-retired-codes)

<a id="diagnostics-codes"></a>

## Codes

Each condition a diagnostic reports has a stable **code**, `NEXO` and four digits, as `NEXO1004`, which each error table below gives beside its condition: the tables are the catalog, one row for each condition the specification sets out. A diagnostic is `{ code, kind, message, location }`, as a `NexoError` is.

| Codes | Kind |
| --- | --- |
| `NEXO1000` to `NEXO1999` | `syntax` |
| `NEXO2000` to `NEXO2999` | `structure` |
| `NEXO3000` to `NEXO3999` | `validation` |
| `NEXO4000` to `NEXO4999` | `module` |
| `NEXO5000` to `NEXO5999` | `evaluation` |

- **A code identifies its condition,** never its wording or where it is raised: a message reworded, or the same condition detected somewhere else, keeps its code, and distinct conditions never share one because their messages resemble each other. The kind still names the stage, so neither stands in for the other, and a condition reported as two kinds, in text and in a definition, has a code of each.
- **A code is stable once assigned.** A new condition takes a new code when it is introduced. Where a condition splits, the part that keeps its meaning keeps its code and the other parts take new ones, and where no part keeps its meaning, its code is retired. A retired code is never reused, and is recorded among the retired codes of its catalog, [the language's](../language/errors.md#diagnostics-retired-codes) or [the runtime's](#runtime-retired-codes), when its row leaves its table.
- **A code stands in its kind's range.** An error built with a code beginning `NEXO` outside its kind's range, or with a code that is no string or is empty, throws a `TypeError` instead, a mistake in the code raising it.
- **A host's conditions** take codes of a prefix of the host's own, never `NEXO`, and a host keeps a Nexo error's code when it passes the error on.
- **Strict and tolerant reading** give one condition the same code. A tolerant reading may go on to report further diagnostics, so the two readings' lists of diagnostics are not promised to match.

<a id="validation-diagnostics"></a>

## Where a failure is located

A **location** says where a failure stands by one group of fields, never two, the group its subject gives:

| Group | Fields | Locates |
| --- | --- | --- |
| Script | `pointer`, the node's JSON Pointer into the definition, with `offset`, `line` and `column`, its position in the text, where the definition was read from text | A structure, validation or evaluation error in a script or a definition; `getLocation` answers this group |
| Text | `offset`, `line` and `column` alone | A syntax error, which stands in text no definition holds yet |
| Binding | `binding`, the binding's name | An error in a binding |
| Module | `module`, the module's name; `type`, the type a nested declaration, a member a type declares among them, stands in; `declaration`, the declaration's name; and `declarationKey`, the key the failure concerns, a declaration's, as `updates.misses`, or, with no declaration, the module's own; each but `module` only where the failure concerns it | A module error |

- **A position counts from the text's start.** `offset` counts the text's UTF-16 code units from 0, and `line` and `column` count from 1. Each line break, LF, CRLF or a lone CR, begins a line, so CRLF begins one, its two characters both counted in the offset.
- **A node without text of its own** is positioned at the nearest node enclosing it that has some, its `pointer` still its own.
- **A failure of the API's use that stands nowhere** carries an empty location, `{}`: imports a host supplies that are refused, `NEXO2008`, bindings or their options that are not a plain object, `NEXO2020`, bindings another registry made, `NEXO2024`, bindings of another resolution key, `NEXO2025`, a resolution no longer current, `NEXO2040`, a pointer that is no JSON Pointer, `NEXO2643`, reading what is not a script's source, `NEXO2645`, a result path of another shape, `NEXO2646`, and evaluating an evaluator from within its own evaluation, `NEXO5010`.

An evaluation error fails the entire result and is delivered to the host in its place.

<a id="runtime-structure-errors"></a>

## Structure errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO2000` | A definition that does not follow its structure | A structure error, with its node's location |
| `NEXO2007` | A definition of a version other than the one the implementation reads, as a version 33 definition is for version 34 | A structure error naming both versions |
| `NEXO2008` | A definition's imports that break the rules [the definition](definition.md#definition) sets for them, or imports a host supplies that are no list, break an import's rules or conflict with each other | A structure error located at a definition's import, the later of two that conflict or stand out of order, and with an empty location for a host's, whose list has no text |
| `NEXO2028` | A `namespace` node or an extension selection's `module` naming a module its imports give no local name | A structure error located at the namespace |
| `NEXO2009` | In a definition, an object node with no object field | A structure error at the node |
| `NEXO2029` | In a definition, a comparison node of fewer than two operands | A structure error at the node |
| `NEXO2010` | In a definition, an optional access outside an optional chain | A structure error at the node |
| `NEXO2030` | In a definition, an `optionalChain` node holding no optional access | A structure error at the node |
| `NEXO2020` | Bindings that are not a plain object, or binding options, or the `types` they declare, that are not one | A structure error with an empty location |
| `NEXO2033` | A binding not named by a letter followed by letters and digits | A structure error naming the binding: `A binding is named by a letter followed by letters and digits` |
| `NEXO2034` | A binding that is not data and that no module recognizes | A structure error naming the binding |
| `NEXO2035` | A binding modules recognize as unrelated types | A structure error naming the binding and the types |
| `NEXO2036` | A binding whose declared type the value does not belong to, or that no public type is | A structure error naming the binding and the type |
| `NEXO2037` | A binding whose declared type several types share unqualified | A structure error naming the binding and the qualified names |
| `NEXO2021` | A bound list whose items share no type, as `[1, "two"]` | A structure error naming the binding |
| `NEXO2041` | A bound map holding a key that is no key type, a list, an object, a structured value, a dictionary or a pair | A structure error naming the binding and the key's type |
| `NEXO2042` | A bound map whose keys, or whose values, share no type | A structure error naming the binding and which of them |
| `NEXO2022` | A bound value holding a cycle, a declared type's data among them | A structure error of its own naming the binding, and where it reaches itself in data a declared type captures |
| `NEXO2038` | A reference type declared for a value that is not a reference, null aside where the type is nullable | A structure error naming the binding |
| `NEXO2044` | A declared binding type no binding holds: a notation that writes no type, `Any`, `Never`, a position, a type holding one at any depth, a structure's data shape among it, or a dictionary keyed by no key type | A structure error naming the binding and the type |
| `NEXO2045` | A value its binding's declared data type, or a part of it, doesn't admit, as [declared types](bindings.md#runtime-bindings) set out | A structure error naming the binding, the part and the type |
| `NEXO2039` | A type declared for anything but a top-level binding | A structure error naming the binding |
| `NEXO2024` | Resolving or evaluating with a binding set another registry made | A structure error saying to bind with that registry |
| `NEXO2025` | Creating an evaluator with bindings of another resolution key | A structure error saying to resolve again |
| `NEXO2040` | Creating or entering an evaluator, or projecting a prepared call, once its resolution is no longer current | A structure error saying to resolve again |
| `NEXO2520` | A `namespace` node anywhere but as the target of a member read or a call, an indexer's among them | A structure error at the node |
| `NEXO2521` | A namespace's member named by a computed property access | A structure error at the node |
| `NEXO2522` | An optional access through a namespace | A structure error saying a namespace is never null |
| `NEXO2525` | An `and` or an `or` of fewer than two operands | A structure error at the node |
| `NEXO2526` | A comparison whose operators are not one fewer than its operands | A structure error at the node |
| `NEXO2528` | A script parameter a text writes alone where a local or an object field of its name is in scope | A structure error naming the parameter |
| `NEXO2643` | A location asked for by a pointer that is not a JSON Pointer | A structure error |
| `NEXO2644` | A location asked for at a pointer the definition holds nothing at | A structure error naming the pointer |
| `NEXO2645` | Reading what is not a script's source | A structure error |
| `NEXO2646` | A result path holding an item that is neither a name nor a whole number that is not negative | A structure error naming the item |

<a id="module-errors"></a>

## Module errors

A module whose declarations break the declaration contract, a type or a member named by what is not an identifier among them, or whose names registration finds taken or colliding within the module, fails with an error of its own kind, `module`, when it is created or registered, naming the module, the type a nested declaration stands in, and the declaration. Among them:

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO4001` | Creating an evaluator for a resolution whose used declarations the evaluator invokes, conversion operators among them, have no `impl` | A module error naming the declaration and its module |
| `NEXO4002` | A member other than an indexer declared without a `name` | A module error naming the member |
| `NEXO4030` | A declaration key a declaration's kind does not take, a type-level `fields` collection, and `target`, `syntax` or `default` on a member among them | A module error naming the declaration key |
| `NEXO4031` | An `internal` that is no Boolean | A module error naming the declaration |
| `NEXO4003` | A member without a declaration key its kind requires, `result`, `updates`, or `arguments` where it has parameters | A module error naming the declaration key |
| `NEXO4032` | A property declared without `updates` anywhere but directly in a structured type | A module error naming the property |
| `NEXO4033` | A type of a name its module already declares | A module error naming the type |
| `NEXO4035` | A module whose name, compared case-insensitively, is already registered | A module error naming the module and the one registered |
| `NEXO4006` | A type selector, an observation type or an observation target named by what is not an identifier | A module error naming the declaration |
| `NEXO4037` | An observation target named `receiver` | A module error naming the target |
| `NEXO4007` | A type selector or an observation type named as one any module already declares | A module error naming it and the module that declared it |
| `NEXO4008` | A mapping without its `selector`, `key` or `type` | A module error naming the declaration key |
| `NEXO4038` | A mapping whose key already stands in its selector | A module error naming the selector, the key and the module that declared it first |
| `NEXO4039` | A mapping of a selector no registered module declares | A module error naming the selector |
| `NEXO4009` | A function with more than one parameter that selects a type | A module error naming the function |
| `NEXO4040` | A `result` writing `@selected` without a parameter that selects a type | A module error naming the function |
| `NEXO4010` | Empty angle brackets after a declaration's name, or a type parameter without a name | A module error naming the declaration |
| `NEXO4041` | A type parameter declared twice | A module error naming the declaration and the parameter |
| `NEXO4042` | A type parameter named as a type its declaration reaches unqualified, one of Nexo's own, `Any` and `Never` among them, or an imported one | A module error naming the declaration and the parameter |
| `NEXO4043` | A member declaring a parameter its extension declares | A module error naming the member and the parameter |
| `NEXO4011` | A member whose result writes a type parameter with no supported source to bind it from: its extension's target, its value parameters' types or its callbacks' results | A module error naming the member and the parameter |
| `NEXO4044` | A member whose callback's input writes a type parameter whose only source is another callback's result | A module error naming the member and the callbacks |
| `NEXO4012` | An extension that names no `target` | A module error naming the extension |
| `NEXO4045` | An extension whose target its own module owns | A module error naming the extension |
| `NEXO4015` | A type's `import` that does not name a registered module | A module error naming the declaration |
| `NEXO4047` | A type reference resolving to no type | A module error naming the declaration |
| `NEXO4048` | A type reference resolving to several types | A module error naming the declaration and the qualified candidates |
| `NEXO4049` | A foreign type named unqualified outside its import | A module error naming the declaration |
| `NEXO4016` | A supertype that is not a reference type | A module error naming the types |
| `NEXO4050` | A type hierarchy that is a cycle | A module error naming the types |
| `NEXO4017` | A reference type without `isInstance` | A module error naming the declaration |
| `NEXO4051` | A `typeOf` or an `isInstance` that is not a function | A module error naming the declaration |
| `NEXO4018` | A declaration naming another module's internal type or member | A module error naming the declaration and the internal type or member |
| `NEXO4052` | A public declaration exposing an internal type: through its signature, as a public type's supertype, or as a mapping's type | A module error naming the declaration and the internal type |
| `NEXO4019` | Positional parameters with a required one after an optional one | A module error naming the parameter |
| `NEXO4020` | An indexer whose parameters are other than one required value parameter, its key | A module error naming the indexer |
| `NEXO4053` | An indexer the host invokes | A module error naming the indexer |
| `NEXO4021` | A function parameter on anything but a function the evaluator invokes | A module error naming the parameter |
| `NEXO4054` | A function parameter that is optional or has a null policy | A module error naming the parameter |
| `NEXO4055` | A function parameter an observation is given | A module error naming the parameter |
| `NEXO4056` | A function the host invokes taking a parameter other than a value parameter | A module error naming the parameter |
| `NEXO4022` | A module member that is an indexer or an operator | A module error naming the member |
| `NEXO4057` | A module member that observes its receiver or a target found from one | A module error naming the member |
| `NEXO4023` | `updates` without `changes` or `reads` | A module error naming the member and the declaration key |
| `NEXO4058` | `misses` missing where the member is partly observable, or present otherwise | A module error naming the member and the declaration key |
| `NEXO4059` | `observations` missing where the member is observable or partly observable, or present otherwise | A module error naming the member and the declaration key |
| `NEXO4060` | An observation of the wrong type, target or arguments | A module error naming the member and the observation |
| `NEXO4024` | An observation naming a target its observation type's module does not declare | A module error naming the observation |
| `NEXO4061` | A prefix on an argument that is not a `String` value parameter | A module error naming the argument |
| `NEXO4025` | A member reading maintained samples without a maintained observation | A module error naming the member |
| `NEXO4062` | A member naming a maintained observation without reading maintained samples | A module error naming the member |
| `NEXO4063` | A maintained observation of a target of many | A module error naming the member |
| `NEXO4026` | A `tolerance` on a member whose result is neither a `Number`, a `Number?` nor a structured type | A module error naming the member |
| `NEXO4027` | A cast operator not declared on a reference type, or not casting to one | A module error naming the operator |
| `NEXO4064` | A cast to its own type, its supertype or a type beneath it | A module error naming the operator |
| `NEXO4028` | A conversion operator neither of whose types is its module's | A module error naming the operator |
| `NEXO4065` | A conversion operator on a type that is not data, or to a destination that is not data | A module error naming the operator |
| `NEXO4066` | A conversion operator from a type to itself | A module error naming the operator |
| `NEXO4067` | A conversion operator on a foreign source outside an extension | A module error naming the operator |
| `NEXO4029` | Two members of one name on one receiver type of one module, two indexers among them only where their key types overlap, as signatures of one indexer never do | A module error naming both |
| `NEXO4068` | Two unnamed indexers for one receiver type of one module whose key types overlap, as signatures of one indexer never do | A module error naming both |
| `NEXO4069` | Two operators of one name and destination on one receiver type of one module | A module error naming both |
| `NEXO4500` | A module whose name is not an identifier | A module error naming the module |
| `NEXO4501` | A module's contents that are not an object | A module error naming what a module declares |
| `NEXO4502` | A module's contents declaring what a module does not declare | A module error naming what a module declares |
| `NEXO4503` | A module's declarations of one kind that are not a list | A module error naming the kind |
| `NEXO4504` | A declaration, its `updates`, a parameter or an observation that is not an object | A module error naming the declaration keys it takes |
| `NEXO4505` | An `impl` that is not a function | A module error naming the declaration |
| `NEXO4507` | A type's `import` that is not a list of modules' names | A module error naming the type |
| `NEXO4508` | A type importing one module twice | A module error naming the module |
| `NEXO4512` | A type that does not parse where a declaration names one, a result, a parameter's, a callback's, a mapping's or a supertype | A module error naming the declaration |
| `NEXO4514` | `updates` whose `changes` or `reads` is none of its values | A module error giving the values |
| `NEXO4515` | A `tolerance` that is not a number, or is negative | A module error naming the member |
| `NEXO4516` | `observations` that are not a list | A module error naming the member |
| `NEXO4517` | An observation target its module declares twice | A module error naming the target |
| `NEXO4518` | An observation target whose `from` is not `receiver` | A module error naming the target |
| `NEXO4519` | An observation target whose `count` is not `many` | A module error naming the target |
| `NEXO4520` | An observation type whose contract is neither of its two | A module error giving the contracts |
| `NEXO4521` | An observation type's `identity` that is not a list of its arguments' names | A module error naming the observation type |
| `NEXO4522` | An observation type's `shared` that is not a Boolean | A module error naming the observation type |
| `NEXO4523` | A member whose name is not an identifier | A module error naming the member |
| `NEXO4524` | A member of a kind that is none of a member's kinds | A module error giving the kinds |
| `NEXO4525` | An `invokedBy` that is neither `evaluator` nor `host` | A module error naming the function |
| `NEXO4526` | A member's `parameters` that are not a list | A module error naming the member |
| `NEXO4527` | A member declaring a parameter twice | A module error naming the parameter |
| `NEXO4529` | A function whose parameter selects a type and whose `result` writes no `@selected` | A module error naming the parameter |
| `NEXO4534` | `arguments` on a function without parameters | A module error naming the function |
| `NEXO4535` | `arguments` that are neither `positional` nor `options` | A module error naming the function |
| `NEXO4536` | A parameter without its name, its kind, its type, its `required` or its null policy, or with a value none of them takes | A module error naming the parameter |
| `NEXO4537` | A function parameter whose `parameterTypes` are not a list | A module error naming the parameter |
| `NEXO4538` | A required parameter with a default | A module error naming the parameter |
| `NEXO4539` | An expression or a predicate parameter whose `context` is not `item` | A module error naming the parameter |
| `NEXO4540` | A predicate parameter whose type is not `Boolean` | A module error naming the parameter |
| `NEXO4541` | A `fixed` that is not a Boolean | A module error naming the parameter |
| `NEXO4542` | `selects` or `selector` on a parameter that is not fixed | A module error naming the parameter |
| `NEXO4543` | A fixed parameter selecting anything but a type | A module error naming the parameter |
| `NEXO4544` | A fixed parameter that selects a type and names no selector | A module error naming the parameter |
| `NEXO4545` | A fixed parameter that is not a `String` value parameter | A module error naming the parameter |
| `NEXO4546` | Registering what `createModule` did not make | A module error |
| `NEXO4547` | A parameter selecting through a selector no registered module declares | A module error naming the parameter and the selector |
| `NEXO4548` | A parameter's default its type does not admit, a number that is not finite and a list with a hole at any depth among them | A module error naming the parameter |
| `NEXO4549` | Two module members of one name in one module | A module error naming the member |
| `NEXO4552` | A type whose name is not an identifier | A module error naming the type |
| `NEXO4554` | A type of a kind that is none of a type's kinds | A module error giving the kinds |
| `NEXO4555` | An `abstract` that isn't a Boolean | A module error naming the type |
| `NEXO4558` | A reference or structured type declaring type parameters | A module error naming the type |
| `NEXO4559` | An extension whose target is `Any` or nullable | A module error naming the extension |
| `NEXO4560` | An operator named other than `cast` or `convert` | A module error naming the operator |
| `NEXO4561` | An operator declaring type parameters | A module error naming the operator |
| `NEXO4562` | A declaration holding a value that reaches itself through its lists and objects | A module error naming the declaration and the declaration key |
| `NEXO4563` | A declared dictionary whose key type is no key type, as `Dictionary<List<Number>, String>` | A module error naming the declaration and the key type |

<a id="runtime-validation-errors"></a>

## Validation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO3051` | A script parameter the host did not bind | A validation error naming the parameter |
| `NEXO3600` | A result path into a script that ends in a host call supplying no value | A validation error naming the host call |
| `NEXO3601` | A result path indexing what is not a list | A validation error naming the type |
| `NEXO3602` | A result path naming an object field or a property its type does not hold | A validation error naming it and the type |

<a id="runtime-evaluation-errors"></a>

## Evaluation errors

| Code | Situation | Result |
| --- | --- | --- |
| `NEXO5002` | A `typeOf` that does not name a reference type of its module, an abstract one, an internal one, or one the value does not belong to | A fault naming the module and what asked |
| `NEXO5026` | A `typeOf` that throws | A fault naming the module and what asked, its `cause` exactly what `typeOf` threw |
| `NEXO5017` | An `isInstance` answering what isn't a Boolean | A fault naming the type and what asked |
| `NEXO5027` | An `isInstance` that throws | A fault naming the type and what asked, its `cause` exactly what `isInstance` threw |
| `NEXO5003` | A conversion that throws | A fault naming the conversion |
| `NEXO5018` | A conversion that rejects with a reason that is not a string, or rejects and then answers | A fault naming the conversion |
| `NEXO5019` | A conversion that answers null or a value not of its type | A fault naming the conversion |
| `NEXO5004` | A cast operator's `impl` failing other than by its `reject` | A fault naming the operator |
| `NEXO5006` | A module returning a value of a type other than the one it declared | An evaluation error naming the member and its module |
| `NEXO5007` | A member failing unexpectedly while it evaluates, its implementation throwing | An evaluation error at the member, its `cause` exactly what the implementation threw, as [the evaluator](evaluation.md#runtime-evaluation) sets out |
| `NEXO5008` | A function given to a member called after that member's invocation has ended | An evaluation error |
| `NEXO5009` | A hook that throws: `beforeInvoke`, a host refusing a member among them, `afterInvoke`, or `afterEvaluation` after a completed evaluation | An evaluation error at that member, its `cause` exactly what the hook threw, as [a hook that throws](evaluation.md#runtime-evaluation) sets out; after a failed evaluation, the cleanup's failure is recorded on the original error |
| `NEXO5010` | Evaluating an evaluator from within its own evaluation | An evaluation error |
| `NEXO5011` | Evaluating without `beforeInvoke` a script that reads a maintained member | An evaluation error |
| `NEXO5014` | Preparing a script that ends in no host call | An evaluation error, as [host calls](host-calls.md#runtime-host-calls) set out |
| `NEXO5023` | Evaluating a script that ends in a host call | An evaluation error, as [host calls](host-calls.md#runtime-host-calls) set out |
| `NEXO5015` | A value a host supplies, or a part of it, that its host call's declared result does not admit, or that reaches itself, as [capturing a supplied value](host-calls.md#runtime-host-calls-capturing) sets out | An evaluation error naming the call and the part |
| `NEXO5503` | A function a member calls with arguments other than its callback contract declares, in number or in type | An evaluation error naming the function and the member |

<a id="diagnostics-tolerant-reading"></a>

## Tolerant reading

Tooling reads text that is still being written, so it reads tolerantly: text that is not a token becomes an invalid token holding its diagnostic, `{ code, message, offset }`, and reading goes on after it, so the tokens cover the whole text whatever it holds. A strict reading meets the same diagnostic and throws it as a syntax error. One reader serves both, so a diagnostic says the same thing whichever way it is reached; the [design](../../docs/nexo-design.md#the-syntax-tree) sets out how the syntax tree builds on it.

<a id="runtime-retired-codes"></a>

## Retired codes

A code of the runtime's conditions leaves its table only by being retired here, with the condition it identified and the version that retired it, so the evidence of its use survives; no code listed here, or among [the language's](../language/errors.md#diagnostics-retired-codes), is assigned again.

| Code | Condition | Retired in |
| --- | --- | --- |
| `NEXO2023` | A declared binding type that is not a reference type, which a declared data type, captured, now is | `1.0.0-alpha.36` |
| `NEXO4004` | A type whose name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO4005` | A module whose name begins with no capital letter, a casing that is a convention and never enforced | `1.0.0-alpha.34` |
| `NEXO4034` | A type named as one of Nexo's own types or `Null`, a name a type of another module may share | `1.0.0-alpha.34` |
| `NEXO4013` | A module member named as one of the module's extensions, the two never reached in one position | `1.0.0-alpha.34` |
| `NEXO4509` | A structured type whose `fields` were empty, a code of language `1.0.0-alpha.33` alone: a structured type declares its data shape as its properties, and may declare none | `1.0.0-alpha.34` |
| `NEXO4510` | A `fields` entry that was not a name with a type, a code of language `1.0.0-alpha.33` alone: a data property is a member, refused as any member is | `1.0.0-alpha.34` |
| `NEXO4511` | A selectable type's key not written as a letter followed by letters, digits, colons and hyphens, a code of language `1.0.0-alpha.33` alone: a mapping's key is any string | `1.0.0-alpha.34` |
| `NEXO4556` | A type of the kind `structured` or `extension`, a code of language `1.0.0-alpha.33` alone, which read neither | `1.0.0-alpha.34` |
| `NEXO4528` | An indexer declared without a name, a code of language `1.0.0-alpha.33` alone: an indexer without one is its type's unnamed indexer | `1.0.0-alpha.34` |
| `NEXO4530` | `default` on a member that was not an indexer, a code of language `1.0.0-alpha.33` alone: `default` is a key no member takes | `1.0.0-alpha.34` |
| `NEXO4531` | A `syntax` that was neither `function-call` nor `indexer`, a code of language `1.0.0-alpha.33` alone: a member's kind says how it is written | `1.0.0-alpha.34` |
| `NEXO4532` | An indexer whose `arguments` were not positional, a code of language `1.0.0-alpha.33` alone: an indexer takes no `arguments` | `1.0.0-alpha.34` |
| `NEXO4533` | A `default` that was not a Boolean, a code of language `1.0.0-alpha.33` alone: `default` is a key no member takes | `1.0.0-alpha.34` |
| `NEXO4014` | A module member and a member of its name on one of the module's own types, a qualified call both take refused as ambiguous where it is resolved | `1.0.0-alpha.34` |
| `NEXO4553` | A module member and a member of its name on a type its module does not declare, which alpha.33 refused; a qualified call both take is refused as ambiguous where it is resolved | `1.0.0-alpha.34` |
| `NEXO4036` | A module named by a reserved word, `Nexo`, or one of Nexo's own types or extensions, `Nexo` refused as any registered name is and the rest names a module may share | `1.0.0-alpha.34` |
| `NEXO4046` | A type named as one of Nexo's own extensions, a name another module's declaration may share, ambiguity checked where a reference resolves | `1.0.0-alpha.34` |
| `NEXO5502` | A definition node no evaluation existed for, a code of language `1.0.0-alpha.33` alone: every node a definition holds is evaluated by its kind, a namespace, an interpolation's text and its expressions by the node that holds them | `1.0.0-alpha.34` |
| `NEXO2640` | `nexo.format` or `nexo.quote` given a definition reading through a namespace, which text read without a registry's module names could not write, a code of language `1.0.0-alpha.33` alone: a definition's imports give every namespace it reads, and canonical text writes them | `1.0.0-alpha.34` |
| `NEXO2641` | A definition read without a registry's module names that wrote one of them alone, which the registry read as that module's namespace, a code of language `1.0.0-alpha.33` alone: a text reads alike whatever reads it, its imports deciding its namespaces | `1.0.0-alpha.34` |
| `NEXO2642` | A namespace naming no module the registry held, a code of language `1.0.0-alpha.33` alone: a namespace names a local name its imports give, `NEXO2028`, and an import of a module the registry doesn't hold is `NEXO3002` | `1.0.0-alpha.34` |
| `NEXO4557` | A module named by a reserved word, which text reached only through an import binding, a code of language `1.0.0-alpha.33` alone: the script imports it and reads its namespace with `@` | `1.0.0-alpha.34` |
| `NEXO3501` | An access a definition wrote selecting an extension explicitly, refused before text wrote extension access, a code of language `1.0.0-alpha.33` alone: an extension access is resolved through its extension | `1.0.0-alpha.34` |
