# Proposal: explicit extension access with `:`

**State: accepted.** Specified, and implemented with [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34)'s step 5, as [I30](implementation-decisions.md) records. This document specifies the extension access operator discussed on October 22, 2026, and the rules settled after it, which [settled rules](#settled-rules) records.

Related proposals: [named extension types](named-extension-types.md), which declares the extensions this operator selects, [contract generics](contract-generics.md), whose inference a selected extension's target follows, and [`Any` and deferred selection](any-and-deferred-selection.md), whose rules apply where a receiver's type is known only during evaluation.

## Settled rules

1. **Optional access is `?:`.** `device?:DeviceExtensions.usage`, `device?:DeviceExtensions.reset(3)` and `device?:DeviceExtensions.setting["mode"]` follow the existing optional-chain rules: the receiver is evaluated once, and where it is null the access short-circuits without evaluating the member's arguments or keys. Extension-name resolution and declaration validation happen as for `:`.
2. **`:` requires an extension type.** The parser reads a type-name reference after `:`, as `device:DeviceExtensions.usage`, `device:Energy.DeviceExtensions.usage` and `list:ListExtensions[0]`, and resolution verifies that it identifies an accessible declaration of `kind: 'extension'`; naming an ordinary type is insufficient. The selector resolves among the script's accessible extensions, ordinary types taking no part, as [capitalized module namespaces](capitalized-module-namespaces.md#settled-rules) settle: an unqualified name resolves uniquely, and module qualification selects the intended declaration, respecting imports and visibility.
3. **An extension's name follows a type's.** Its local name begins with a capital letter, as any type's does, and the suffix `Extensions` is a convention its author may follow or leave, as `NumericList` leaves it: the `:` operator identifies explicit extension access, `kind: 'extension'` establishes the declaration's semantics, and a name's spelling never makes a declaration an extension.
4. **Indexer syntax remains as specified.** The colon indexer forms removed in part 1 stay removed: `device.setting["mode"]` is a named indexer, `list[0]` an unnamed one, and `device.[name]` computed property access. `device:setting["mode"]` cannot select the receiver's `setting` member, since the position after `:` requires an extension-type reference; a diagnostic may suggest `device.setting["mode"]`. `it:[name]` remains invalid, and its hint distinguishes the indexer `it[name]` from computed property access `it.[name]`.
5. **A function accessed without invocation is a bound reference.** Resolution determines the selected member's kind: accessing a property reads it, `device:DeviceExtensions.active()` invokes a function, and `device:DeviceExtensions.active` is a function reference bound to the receiver, evaluated and captured once when the reference is created, under the existing function-reference restrictions, those concerning host calls among them. Where the receiver is supplied later, an arrow function expresses the operation: `d => d:DeviceExtensions.active()`.
6. **Lexica's own extension names are reserved,** under the rule for its own type names, by their local names independently of their parameters, whatever their suffix.

The definition representation stands: a `member`, `call` or `indexer` node keeps its receiver and gains the optional selector `extension: { name, module? }`, within the definition 34 revision.

## Purpose

The extension access operator selects a particular extension declaration for a particular receiver:

```text
<value>:<ExtensionType>.<member>
```

For example:

```text
device:DeviceExtensions.usage
device:DeviceExtensions.reset(3)
device:DeviceExtensions.setting["mode"]
```

The value to the left of `:` is the receiver. The extension type to its right identifies the declaration that supplies the member. The member retains its ordinary property, function, or indexer syntax.

Explicit extension access is valid whenever its receiver and member satisfy the selected declaration. It is especially useful when ordinary lookup encounters competing extensions or selects a different declaration.

## Declaration model

An extension is declared in a module's `types` collection with `kind: 'extension'`, a `target`, and `members`.

```javascript
{
    name: 'DeviceExtensions',
    kind: 'extension',
    target: 'Home.Device',
    members: [
        // Property, function, and indexer declarations.
    ]
}
```

The `extension` kind determines the declaration's layout and semantics:

| Field | Meaning |
| --- | --- |
| `name` | Identifies the extension declaration and declares any contract parameters. |
| `kind: 'extension'` | Identifies a group of extension members. |
| `target` | Describes the receiver accepted by those members. |
| `members` | Contains the member declarations available through this extension. |

The declaration's identity is its module and local name. The suffix `Extensions` is a naming convention.

## Access forms

| Member form | Example |
| --- | --- |
| Property | `device:DeviceExtensions.usage` |
| Function | `device:DeviceExtensions.reset(3)` |
| Named indexer | `device:DeviceExtensions.setting["mode"]` |
| Unnamed indexer | `values:ListExtensions[0]` |

A property access invokes the selected property's getter. Function parentheses contain the member's declared arguments. Indexer brackets contain its declared keys.

The receiver is supplied by the expression before `:`, separately from those arguments or keys.

The named and unnamed indexer forms follow the same distinction as ordinary indexing: a named indexer selects a member before the brackets; an unnamed indexer selects the extension's unnamed indexer directly. These examples assume the corresponding members are declared.

An access must include a member operation: a named member, its invocation or indexing form, or an unnamed indexer. The extension selector is part of that access expression, rather than a separately evaluated value.

## Extension names and qualification

The extension selector uses Lexica's type-name syntax and resolves within the script's permitted imports and built-in declarations.

An unqualified name is valid when it identifies one accessible declaration:

```text
device:DeviceExtensions.usage
```

A module-qualified name identifies the declaration in that module:

```text
device:Energy.DeviceExtensions.usage
```

If an unqualified name is ambiguous, resolution reports the matching qualified names. Qualification remains subject to the normal import and visibility rules.

The selected declaration must have `kind: 'extension'`. Its member must be accessible through that declaration.

## Ordinary and explicit lookup

Ordinary access asks Lexica to select a member using its normal lookup rules:

```text
device.usage
```

Explicit extension access identifies which extension supplies the member:

```text
device:DeviceExtensions.usage
```

The extension selector limits member lookup to the selected declaration's members. A missing member is an error at that selection; lookup does not fall through to another extension or to the receiver's own members.

This allows a script to identify a particular accessible extension even when another declaration takes precedence in ordinary member lookup. The receiver must still satisfy the chosen extension's target, and normal visibility and host-policy restrictions still apply.

## Expression binding and chaining

Extension access is a postfix operation on the receiver, at the same expression level as member access, calls, and indexing.

A receiver can be a binding, a member access, a call result, or a parenthesized expression:

```text
device:DeviceExtensions.usage
room.device:DeviceExtensions.usage
Home.device(room, "lamp"):DeviceExtensions.usage
(left + right):NumberExtensions.description
```

The examples assume the receiver expressions and members are otherwise valid under their declarations.

Parentheses establish the receiver when a larger expression is intended. In `left + right:NumberExtensions.description`, the extension access belongs to `right`; in `(left + right):NumberExtensions.description`, it belongs to the sum.

An extension selector applies to one member operation. Subsequent postfix operations apply normally to that operation's result:

```text
device:DeviceExtensions.details.name
device:DeviceExtensions.readings[0]
device:DeviceExtensions.read().name
```

Here, `details` is selected from `DeviceExtensions`, then `name` is read from its result. Likewise, if `readings` is a property returning a list, the brackets index that result using ordinary indexing rules. If it is a named indexer, its declaration determines the indexing operation under the existing named-indexer rules.

A subsequent colon explicitly selects another extension for the intermediate value:

```text
device:DeviceExtensions.readings:ListExtensions.first
```

## Parsing and definition representation

The colon establishes extension access syntactically. Parsing records:

- The receiver expression.
- The extension's local name and optional module qualifier.
- The member name, where applicable.
- The member access form and any arguments or index keys.
- Source locations for diagnostics.

The extension selector uses the established syntactic rules for optionally qualified type names. Its parsing must distinguish the selector from the member and any later access chain without consulting registered declarations.

Resolution subsequently verifies the declaration kind, visibility, target, and member.

The definition representation should retain the existing receiver and member-operation structure and add an explicit extension selector to the relevant access. The selector carries `name` and optional `module`; resolved declaration identities belong to resolution metadata.

The same representation principle applies to property access, function invocation, and indexer access. It records the written selection independently of the registry used to resolve it.

## Receiver contracts and generics

The receiver is checked against the selected extension's `target`. Concrete targets use the existing assignability and inheritance rules.

An extension may declare contract parameters:

```javascript
{
    name: 'ListExtensions<T>',
    kind: 'extension',
    target: 'List<T>',
    members: [
        { name: 'first', result: 'T?', /* remaining metadata */ }
    ]
}
```

A script selects it by its local name:

```text
devices:ListExtensions.first
```

If `devices` is known as `List<Device>`, the target establishes `T = Device`, and the member result is `Device?`.

Generic inference, nullable contracts, list covariance, and member-local parameters follow the contract-generics rules. The colon determines the receiver and extension selection; it does not introduce another inference algorithm.

## Resolution and execution

Resolution identifies the named extension and member. It applies the target contract and resolves arguments according to the selected member's declaration.

When the receiver's concrete type is known, target validation and the supported generic inference occur during resolution. When relevant information is available only during evaluation, the remaining checks follow the rules for `Any` and deferred validation. Selecting the extension explicitly does not make unavailable type information known.

The selected declaration establishes the member's argument interpretation. Any information still required to resolve an implicit body or infer its contract remains subject to the ordinary resolution requirements.

Execution follows these rules:

1. Evaluate the receiver expression once.
2. Validate the receiver against the target and apply any checks that were deferred.
3. Process the member's arguments or keys according to its existing evaluation contract.
4. Invoke the selected operation and validate or interpret its result under the normal member contract.

The host's policy must permit the selected declaration before its implementation runs, including a property getter or indexer. Existing checks that can reject a script earlier remain applicable.

Receiver evaluation and argument evaluation retain Lexica's established ordering and lazy-evaluation rules. A failed receiver check prevents invocation of the selected member.

Property observation metadata, function execution rules, indexer behavior, and result projection retain their existing meanings.

## Null receivers

Direct extension access requires a non-null receiver. A known invalid null receiver can be diagnosed during resolution; a null discovered during evaluation produces an access error.

The error identifies the receiver expression and selected extension member. Optional access, `?:`, guards a nullable receiver, as [settled rule 1](#settled-rules) sets out.

Nullability within a receiver's contents remains part of its contract. For example, nullable elements in `List<Device?>` do not make the list receiver itself null.

## Host calls and reporting

An explicit extension selection identifies the member declaration before execution. If it is host-invoked, the existing terminal-position, preparation, and projection rules apply.

Resolution reports the selected extension member as a used declaration and retains the information needed for host policy and observation analysis. Nested expressions are analyzed under their own rules, including reporting deferred accesses where applicable.

The extension access operator changes member selection syntax; it does not change who invokes a member or when a host-invoked operation is permitted.

## Diagnostics

Diagnostics should identify the relevant receiver, extension, and member. The specification should cover:

| Condition | Diagnostic information |
| --- | --- |
| Unknown extension name | The written name and its source location. |
| Ambiguous extension name | The matching qualified names. |
| Selected declaration has another kind | The selected declaration and the required extension kind. |
| Member unavailable in the selected extension | The qualified extension and requested member. |
| Incompatible receiver | The expected target and actual receiver type, qualified where needed. |
| Null receiver | The failing extension access. |
| Invalid invocation or indexer form | The selected member and the form its declaration accepts. |
| Incompatible argument or key | The relevant argument or key and its required contract. |
| Host-policy refusal | The selected declaration under the existing policy diagnostic rules. |

## Specification and implementation work

Integrate extension access into the postfix grammar and definition representation, including source locations.

Resolve the selector using the existing type-name visibility and qualification rules, verify `kind: 'extension'`, and select the requested member from that declaration.

Apply existing target matching, generic inference, member evaluation, observation, and host-policy behavior to the explicitly selected operation.

Update the member, expression, module, grammar, definition, and diagnostic documentation together. Review the definition-format impact against the planned version before implementation.

The parsing work must explicitly cover qualified extension names and chained postfix operations, including their interaction with other uses of `:` in the grammar.

## Acceptance cases

- Property, function, named-indexer, and unnamed-indexer access use the selected extension and written receiver.
- An unqualified extension name resolves uniquely within its allowed scope.
- Module qualification selects the intended declaration and respects visibility.
- Explicit access can select an accessible extension member that ordinary lookup would not choose.
- A missing member in the selected extension produces an error at that selection.
- Target matching supports established concrete inheritance and generic inference rules.
- The receiver is evaluated once.
- A later member access operates on the selected operation's result.
- Parenthesized receivers and chained extension accesses bind as specified.
- Unknown, ambiguous, incompatible, and null cases produce located diagnostics.
- Parsing and definition construction are independent of registered vocabulary.
- Host-call restrictions, host policies, and property observation behavior remain applicable.
