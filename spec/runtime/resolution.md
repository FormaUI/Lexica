# Resolution

<a id="runtime-bindings-and-resolution"></a>

`registry.resolve(script, bindings, options)` resolves a script: it reads its text as `nexo.parse` does, with the imports `options.imports` supplies, or takes its definition, which records its imports, resolves every member against Nexo's own module and the modules the script imports, types the result and records what each member resolved to, without a host and without evaluating anything. A resolution answers:

- **`resolution.definition`**, the definition it resolved, and **`resolution.hostCall`**, the [host call](host-calls.md#runtime-host-calls) it ends in, null for a script that gives a value.
- **`resolution.type`**, its result type in type notation, as `{ total: Number }`, null for a host call that declares no result.
- **`resolution.usedDeclarations`**, its **used declarations**: every declaration it has selected, the operator a cast or a conversion selects among them, one only an unreached branch uses included, each once at each place it is used, so a declaration a script function's body uses is used once at its place in the body, whichever calls reach it. Each is `{ declaration, name, qualifiedName, pointer }`: the declaration as its module declared it; its declared name, an operator's `convert` or `cast`, null for an unnamed indexer; the name a message gives it, qualified by the first of its declaration's receiver types the receiver applies to it by, as `String.length`, or by its module for a module member or a function referenced through its namespace, its declared name alone where that receiver type is any receiver or a type parameter, an unnamed indexer as its brackets after its type, `List[]`, and an operator by the syntax that invokes it, as `String to Number` and `Meter as Device`; and the definition pointer where it is used. A use an extension access selects is qualified by the extension as the access writes it, as `NumericList.total` or `Measurements.NumericList.total`.
- **`resolution.deferredAccesses`**, its **deferred accesses**: each access whose member is selected during evaluation, as [deferred member selection](../language/types.md#types-any-deferred-selection) sets out, as `{ name, pointer }`, the name it accesses, null for an unnamed indexer, and where it stands, in the order they were resolved, an access in a script function's body once, whichever calls reach it. It is empty where resolution selected every member.
- **`resolution.getCandidateDeclarations()`**, its **candidate declarations**, `{ declarations, isOverestimate }`: a conservative analysis whose `declarations`, of the used declarations' shape, are the used declarations and, at each deferred access's pointer, every accessible declaration of the name and the form it accesses that evaluation could select through the lookup rules, inherited members and visible extensions among them, each qualified by the type it is declared for, its type's or its extension's target. `isOverestimate` is true wherever a deferred access remains, and false where the declarations are the used ones alone. Where a deferred access remains, the used declarations are never presented as everything an evaluation might use.
- **`resolution.typeAt(path)`**, the type a [result path](#runtime-result-paths) reaches, and **`resolution.getLocation(pointer)`**, where a pointer stands, as [locations](#runtime-locations) set out.
- **`resolution.isCurrent`** and **`resolution.createEvaluator(bindings, env)`**, as [reusing a resolution](#runtime-reuse) and [evaluation](evaluation.md#runtime-evaluation) set out.

All branches and operands are validated even when evaluation will not reach them, so a host's policy over the used declarations, as whether it keeps a result current over a partly observable member, concerns them all before anything is evaluated. A host that needs every declaration before evaluation either requires a script without deferred accesses, its receivers known or its extensions selected explicitly, or reads the candidate declarations and accepts their overestimate.

In this document:

1. [What resolution checks](#validation-vocabulary-and-types)
2. [Result paths](#runtime-result-paths)
3. [Locations](#runtime-locations)
4. [Reusing a resolution](#runtime-reuse)

<a id="validation-vocabulary-and-types"></a>

## What resolution checks

Resolution's checks are its semantic validation, each failure a `validation` error; a definition's structure is validated before them, as [structural validation](definition.md#validation) sets out, its failures `structure` errors.

| Area | Required contract |
| --- | --- |
| Member resolution | Every member exists and uses its declared form, every extension an access selects is one and declares the member, and an access on a value of `Any` is checked when that value is evaluated. |
| Arguments | Positional arguments match the signature's order and count; options use one object whose object fields name the member's parameters; every required parameter is supplied. |
| Types and kinds | Receivers, arguments, expressions and bindings fit their declared types, an object expression written where a structured type is declared constructing it, as [constructing a structure](../language/types.md#types-constructing-a-structure) sets out; each argument uses its declared argument kind. |
| Required access | Access written with `.` has a receiver that cannot be null. Other required access forms follow the same nullability rule. |
| Fixed arguments | Resolution settles each to a non-null string without evaluating a member, as [fixed arguments](../language/members.md#arguments-fixed) set out. |
| Computed property access | Resolution determines every possible property name; each names a property of the receiver and their types merge. |
| Local use | Each reference is in scope; a value local is used as a value, a function local as a call. |
| Casts | The target type is a reference type, and the operand can be of that type. |
| Conversions and attempts | The target type and conversion pair are valid; an attempt follows the same validation rules as its strict operation. |
| Equality | Operand types fit in at least one direction. Values other than strings, numbers, Booleans and reference values compare only with null. |
| Arithmetic and comparisons | Every operand is a non-null number. |
| Interpolation | Every interpolation gives a non-null string or number. |
| Function arguments | Each is a function reference or an implicit body, whose argument types and result fit its parameter's callback contract; a function reference names one declaration. |
| Function calls | The local or function parameter holds a function, never null; the argument count matches each function it may be, whose body resolves against that call's argument types, their results merging; no call reaches a function within its own call. |
| Conditions and logical operands | Each is a value. Truthiness determines the branch; a host call cannot be used as that value. |
| Coalescing | Value and fallback have compatible types. |
| Conditionals | Branch result types are compatible. |
| Implicit parameter | Each expression is valid with the implicit parameter its member declares. |
| Host calls | A host call is the script's terminal operation, and takes a result projection only where it declares a result; a fixed argument that selects a type names a key its selector maps. |
| Output | A result contains data alone. |

<a id="runtime-result-paths"></a>

## Result paths

A **result path** names a part of a script's result as an array of steps, each an object field's name, any word, a reserved word among them, or a list index, a whole number that is not negative, as `['rooms', 0, 'name']`; the empty path names the result itself.

- **`nexo.paths.validate(path)`** checks a path's shape alone, with no script or registry, and answers nothing, refusing a step that is neither a name nor such an index with a structure error (`NEXO2646`) of an empty location.
- **`resolution.typeAt(path)`** answers the type the path reaches in the result type, in type notation: a name steps to an object field's type, or to the type of a property of a structured type's data shape, and an index to a list's item type. The type is nullable where a step it passes is, and after any index, since an index out of range reaches null, and a path that passes a step of the type `null` reaches `null`. It refuses a path into a script whose host call supplies no value (`NEXO3600`), an index into what is no list (`NEXO3601`) and a name its type does not hold (`NEXO3602`), each a validation error located at the script's expression, `/expression`.
- **`nexo.paths.valueAt(value, path)`** answers the value the path reaches in a result's value, null where a step it passes is null or holds nothing at the step, an object field the value does not hold and an index out of range among them. It checks nothing, so it reads any value it is given.

Neither `typeAt` nor `valueAt` checks a path's shape: a host checks a path it did not build with `nexo.paths.validate` first.

<a id="runtime-locations"></a>

## Locations

`nexo.getLocation(definition, pointer)` answers where a definition pointer stands, a frozen location of the script group [a location](errors.md#validation-diagnostics) sets out: for a definition read from text, the pointer with the position in the text of its node, or of the nearest node enclosing it that has text of its own; for a definition given directly, `{ pointer }` alone. `resolution.getLocation(pointer)` answers as `nexo.getLocation` does given the resolution's definition. Each refuses a pointer that is no JSON Pointer (`NEXO2643`) and one the definition holds nothing at (`NEXO2644`), as structure errors. Every pointer a resolution, a hook's request or a prepared call gives is one they expand.

<a id="runtime-reuse"></a>

## Reusing a resolution

A resolution is reused with bindings of its resolution key, against its registry, for as long as it is **current**. Creating an evaluator refuses bindings of another key, and creating one and each evaluator entry point, a prepared call's projection among them, refuse a resolution that is no longer current, each with a structure error saying to resolve again, so an evaluator never evaluates a stale resolution.

A registration can change a resolution made before it through recognition alone: resolution reaches only what a script's imports make available, Nexo's own always, a type selector's key once registered is never replaced, and a registration changes no type's membership, hierarchy or data shape, while a module registered later adds its `typeOf` to what recognizes a value. Evaluation recognizes a value where it finds the actual type of a value of `Any`, and where it captures a supplied value:

- a deferred access, which selects by its receiver's actual type, and binds the type arguments its arguments' actual types give;
- an extension access on a receiver of `Any`, which checks that the receiver is of the extension's target;
- an equality of a value of `Any`;
- the check that a result holding `Any` is data;
- capturing a value a host supplies, where a reference of another type stands where a nullable reference type is declared, which it tells from mistyped data.

A value of `Any` reaches a script only from a declaration that gives it one: its result, the arguments a function parameter's callback is called with, or a key its fixed argument selects, each through lists, dictionaries, pairs, objects and a structure's data shape; a parameter's own type gives the script nothing, since the script supplies its argument. A resolution therefore **may recognize** values as it is evaluated where a declaration it uses, in any branch, reached or not, gives it a value of `Any`, or where it ends in a host call whose supplied type holds a nullable reference type at any depth.

- **What stays current.** Registering a module that declares a `typeOf` makes every resolution that may recognize values stale; every other registration, and every registration for a resolution that may not, leaves it current, with its evaluators and the calls they prepared, whose locals keep the values they were prepared with and whose results' origins stay comparable with those before.
- **`resolution.isCurrent`** answers whether the resolution is current, from what it resolved, so it never depends on which paths an evaluation has taken. A host that keeps resolutions asks it, rather than comparing revisions.
- **The revision.** A registry's `revision` still advances with every registration, for a host that keys anything else by its vocabulary.
