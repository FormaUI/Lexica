# Proposal: capitalized module namespaces

**State: accepted.** Specified in language `1.0.0-alpha.34`, and not implemented. Require Lexica module names to begin with a capital letter, using the same initial-letter rule as type names. Use PascalCase as the naming convention for multiword module names.

Related proposals: [explicit extension access](extension-access.md), whose selector this proposal qualifies, and [script imports](script-imports.md), which decide the names a script reads as namespaces.

## Settled rules

1. **An imported module's name wins.** After `:`, a name the script imports as a module, followed by a dot, is the qualifier, as a namespace already wins over a local of its name. An extension named as an imported module is written qualified, `device:Solar.Energy.usage`. Since Lexica's own extensions are never qualified, registration refuses a module named `Lexica` or named as one of Lexica's own types or extensions, `List` or `VerbExtensions`.
2. **Each position counts the declarations that can stand there.** An extension access resolves among extensions alone and a type reference among types alone, since no value is of an extension. Beside `Home.Device`, `device:Device.usage` selects `Energy`'s extension `Device`, and `device as Device` names `Home`'s type. Within `Energy`, `Device` names no type of its own, so its declarations write their target `Home.Device`.
3. **Lexica's own module is `Lexica`,** always available and never imported, so `import Lexica` is refused.
4. **Versions.** The rule joins language `1.0.0-alpha.34` and definition 34 in place: a definition records module names as it did, and only the names a registry accepts change.

## Purpose

Module qualification should read consistently across types, module members, and explicit extension access:

```text
Home.Device
Home.device(room, "lamp")
Home.rooms

device:Energy.Device.usage
device:Energy.Device.reset(3)
device?:Energy.Device.setting["mode"]
```

The module and type names identify declarations; the member name identifies the operation being accessed. Capitalized module names make qualified forms visually consistent:

```text
Module.Type
Module.member
receiver:Module.ExtensionType.member
```

## Naming rule

A module's declared name must:

1. Satisfy the existing identifier and reserved-name rules.
2. Begin with a capital letter, using the same character classification and initial-letter validation as type names.
3. Satisfy the existing module-name uniqueness rules.

PascalCase is the convention for names containing several words:

| Example | Treatment |
| --- | --- |
| `Home` | Valid. |
| `Energy` | Valid. |
| `SmartHome` | Valid and follows the multiword convention. |
| `home` | Refused at registration: the initial letter is lowercase. |
| `smartHome` | Refused at registration: the initial letter is lowercase. |

Registration enforces the initial capital. It does not attempt to infer word boundaries or validate dictionary spelling. Other identifier characters continue to follow the existing lexical rules.

Acronym styling after the initial letter is the author's choice. Both `GraphQl` and `GraphQL`, for example, satisfy the initial-capital rule. PascalCase is guidance for readability, not a requirement that registration determine how an acronym should be spelled.

## Module declarations

The rule applies to the name under which a module registers its vocabulary:

```javascript
{
    name: 'Energy',
    types: [
        {
            name: 'Device',
            kind: 'extension',
            target: 'Home.Device',
            members: [
                // Extension member declarations.
            ]
        }
    ]
}
```

The declaration uses the ordinary qualification rules to reference a type in another module. Required imports and visibility checks continue to apply.

Registration validates the supplied name and reports an invalid initial letter rather than silently rewriting the name. A diagnostic should identify the declaration and explain the required initial capital.

Example diagnostic:

> Module name 'energy' must begin with a capital letter.

## Qualification

Use each module's declared spelling in canonical script text, declaration references, diagnostics, documentation, and completion suggestions.

| Context | Example |
| --- | --- |
| Concrete type reference | `Home.Device` |
| Module property | `Home.rooms` |
| Module function | `Home.device(room, "lamp")` |
| Extension property | `device:Energy.Device.usage` |
| Extension function | `device:Energy.Device.reset(3)` |
| Extension named indexer | `device:Energy.Device.setting["mode"]` |
| Extension unnamed indexer | `values:Collections.NumericList[0]` |

The examples assume the corresponding declarations are accessible.

The selector in an explicit extension access must resolve to a declaration with `kind: 'extension'`. Extension names follow the same initial-capital rule as other type names. The `Extensions` suffix is optional; declaration kind establishes the extension's semantics.

## Identity and name matching

Module qualification continues to participate in declaration identity: `Home.Device` and `Garden.Device` identify different declarations. An ordinary type `Home.Device` and an extension type `Energy.Device` likewise have distinct identities.

Within a module, declaration names remain unique across type kinds. A module cannot declare both an ordinary type and an extension type with the same local name.

This proposal changes the required spelling of declared module names. It does not introduce a new case-sensitivity policy or change the existing name-comparison rules. Validate the declaration's initial letter separately from comparing names during lookup.

Migration must account for those existing comparison rules. Where a case-only rename changes identity, dependent identities and references must be migrated. Where lookup already treats those spellings alike, update the declaration and canonical spelling without creating duplicate registrations.

## Parsing and resolution

Module names and type names can both begin with a capital letter. The parser and resolver must therefore use the established syntax, scope, and qualification rules to identify their roles.

Audit assumptions that module names begin lowercase. Cover both ordinary module access and extension selectors:

```text
Home.rooms
device:Device.usage
device:Energy.Device.usage
device:Energy.Device.details.name
```

In the final example, the extension selector is `Energy.Device`, the selected member is `details`, and `name` is an access on its result.

Parsing must remain independent of registered vocabulary. The grammar and syntactic context must provide the required boundaries; resolution checks the resulting names against imports and declarations. Capitalization alone cannot establish whether a declaration is a module, a type, or an extension.

This naming proposal does not change member access, invocation, indexing, or extension-access semantics.

## Scope

The rule concerns Lexica module namespaces. Package identifiers, JavaScript import specifiers, assembly names, filesystem paths, and external product branding retain their own naming rules.

The rule does not impose a new naming requirement on script locals, fields, parameters, or ordinary members. Type names, including extension names, retain their initial-capital requirement. Authors choose whether an extension name includes the optional `Extensions` suffix.

## Migration

For each affected module:

1. Select its capitalized declared name, using PascalCase for multiword names.
2. Update the registration and module-name validation.
3. Update imports, qualified type references, module-member references, and qualified extension selectors.
4. Update host configuration, lookup keys, and persisted references where they store the affected module name, respecting existing identity and comparison behavior.
5. Update examples, diagnostics, canonical text, completion output, and tests.
6. Check that parsing handles capitalized module names without relying on registry contents.

Keep each module and its consumers consistent during migration. Determine the language-version and definition-format consequences from the actual changes to accepted names and serialized references; a naming change alone does not imply a new definition node.

## Acceptance cases

- A module with a valid capitalized name registers.
- A lowercase initial produces a located registration error.
- Existing identifier restrictions and module-name uniqueness checks still apply.
- Qualified type, module-member, and extension references use the capitalized module names correctly.
- Extension selectors require declarations with `kind: 'extension'`, whether or not their names end with `Extensions`.
- An ordinary type and an extension type cannot share a local name within one module.
- Unqualified extension references retain their existing visibility and ambiguity rules.
- Capitalized module qualification and following member chains parse independently of registered vocabulary.
- Diagnostics and canonical output use the module's declared spelling.
- External package and file naming remain governed by their existing rules.

