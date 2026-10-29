# Proposal: import aliases

**State: accepted.** Specified in language `1.0.0-alpha.34` and definition 34, and implemented with [unit 3](../features-status.md#unit-3--script-text-imports-and-definition-version-34)'s steps 3 and 4, as [I28](implementation-decisions.md) and [I29](implementation-decisions.md) record. Its rules that a local name begins with a capital letter and that an alias can't be `Nexo`, a reserved word or a name of Nexo's own were retired in the same version: a local name is any identifier, as [imports](../../spec/scripts.md#scripts-imports) set out. Allow scripts to import modules and individual types under local names. Type imports include ordinary types and extension types.

Related proposals: [script imports](script-imports.md), which this proposal extends, [capitalized module namespaces](capitalized-module-namespaces.md), whose initial-capital rule local names follow, and [explicit extension access](extension-access.md), whose selector an alias may name.

## Settled rules

1. **A type import makes the type's public members usable.** Importing `Home.MotionSensor` makes the type and its public member surface available, its inherited members included under the existing inheritance rules. It imports neither `Home`'s other members nor extensions declared elsewhere, which need their own type import or an import of their declaring module. A member is usable where the script imports its declaring module, or the type or extension that declares it. Knowing a type through a member's signature still imports nothing.
2. **An explicitly imported name wins over lookup through module imports.** Given `import Sensor = Home.MotionSensor` and `import Garden`, `Sensor` means `Home.MotionSensor`, and `Garden`'s type stays reachable as `Garden.Sensor`. The same holds for a type import without an alias. Lookup resolves an explicit import binding first, then searches the declarations imported modules expose, and refuses an ambiguity among those fallback candidates. Two different declarations explicitly bound to one name remain an import collision; a type merely exposed through `import Garden` creates no explicit binding.
3. **Definition 34 records structured imports.**

    ```javascript
    imports: [
        { module: 'Home' },
        { module: 'Measurements', alias: 'Measures' },
        { module: 'Home', type: 'MotionSensor', alias: 'Sensor' },
        { module: 'Measurements', type: 'NumericList', alias: 'Numeric' }
    ]
    ```

    `module` identifies the registered module; `type`, when present, selects one type; `alias`, when present, supplies the local name. Without `alias`, the local name is `type`, or otherwise `module`. Resolution determines whether an imported type is an extension, so the serialized import does not repeat its declaration kind.
4. **A host supplies imports as the same objects.** A string is shorthand for `{ module }` at the host API boundary, normalized into the structured definition form: `imports: ['Home', { module: 'Measurements', alias: 'Measures' }, { module: 'Home', type: 'MotionSensor', alias: 'Sensor' }]`. Written and supplied imports follow the same binding, visibility and collision rules.
5. **Duplicates compare the local name and the resolved declaration.** Different declarations under one local name conflict; repeated paths to the same declaration don't.
6. **Defaults.** An alias can't be `Nexo`, a reserved word, or the name of one of Nexo's own types or extensions. Nexo's own declarations stay available through their existing mechanism and are never imported. `import Home = Garden` gives the module `Garden` the local name `Home` within that script: registered names don't occupy a script's import scope by themselves, and the module registered as `Home` is imported under another local name, `import House = Home`.

## Purpose

An imported declaration’s registered name identifies it. A script may use a shorter or more suitable local name without changing that identity.

```text
import Measures = Measurements
import Sensor = Home.MotionSensor
import Numeric = Measurements.NumericList
```

These establish:

| Local name | Refers to |
| --- | --- |
| `Measures` | The module `Measurements`. |
| `Sensor` | The type `Home.MotionSensor`. |
| `Numeric` | The extension type `Measurements.NumericList`. |

The script can then write:

```text
Measures.Temperature
Sensor
values:Numeric.total
```

## Syntax

Support imports with and without aliases:

```text
import <Source>
import <LocalName> = <Source>
```

A source identifies either a registered module or a type qualified by its registered module:

```text
import Measurements
import Home.MotionSensor

import Measures = Measurements
import Sensor = Home.MotionSensor
```

Without an alias, the imported declaration’s local name becomes available:

| Import | Name established |
| --- | --- |
| `import Measurements` | `Measurements` |
| `import Home.MotionSensor` | `MotionSensor` |
| `import Measures = Measurements` | `Measures` |
| `import Sensor = Home.MotionSensor` | `Sensor` |

Imports follow the existing import-placement rules.

## Naming and scope

Imported local names must begin with a capital letter. PascalCase is the convention for multiword names; acronym styling remains the author’s choice.

The name applies throughout the importing script, including its nested expressions and functions. It does not rename the declaration globally or affect other scripts.

An aliased import establishes only its supplied local name:

```text
import Sensor = Home.MotionSensor
```

This import establishes `Sensor`. It does not additionally establish `MotionSensor` or the namespace `Home`.

Likewise:

```text
import Measures = Measurements
```

establishes `Measures` as the module namespace, without additionally establishing `Measurements`.

## Module imports

A module import establishes a namespace through which the script can qualify references:

```text
import Measures = Measurements
```

```text
Measures.Temperature
```

Resolution maps the namespace to the registered module, then resolves the remaining name under the normal visibility rules.

The module’s declarations participate in unqualified lookup according to the existing module-import rules.

## Type imports

A type import establishes a direct name for one selected declaration:

```text
import Sensor = Home.MotionSensor
```

Where the script requires a type name, `Sensor` denotes `Home.MotionSensor`.

Importing a type does not import the module’s other declarations or establish its module namespace. The registry must still contain the dependencies needed to resolve that declaration.

An alias preserves the type’s kind, members, inheritance relationships, and contracts. It introduces no new type.

## Extension-type imports

An extension type is imported using the same syntax as another type:

```text
import Numeric = Measurements.NumericList
```

It can then be selected explicitly:

```text
values:Numeric.total
```

Its members participate in ordinary extension lookup under the existing visibility, applicability, ownership, and ambiguity rules.

The alias preserves `kind: 'extension'`. Resolution still validates the receiver against the extension’s target and checks the selected member’s contract.

Module qualification remains available when the module itself is imported:

```text
import Measures = Measurements
```

```text
values:Measures.NumericList.total
```

Both forms can identify the same extension declaration.

## Import-source resolution

Import sources resolve against registered module identities.

```text
import Sensor = Home.MotionSensor
```

Here, `Home` identifies the registered module, and `MotionSensor` identifies its type.

A source does not refer to a previously established import alias. This keeps import interpretation independent of declaration order.

An unknown module, unknown type, or inaccessible declaration produces an import error.

The import aliases a declaration. It does not introduce a new generic declaration or supply generic arguments; contract parameters continue to follow the existing inference rules.

## Identity

Aliases affect source-level names, not declaration identity.

```text
import Sensor = Home.MotionSensor
```

`Sensor` retains the identity of `Home.MotionSensor`.

Different scripts may import that declaration under different names and still refer to the same type. Multiple import paths to the same declaration must not create artificial ambiguity: lookup candidates are distinguished by their resolved identities.

Canonical script text preserves the aliases the script declares. Resolution metadata records the underlying module and declaration identities.

## Collisions

Modules and types share the script’s import-name scope. Every imported local name must be unique within that scope.

These imports conflict:

```text
import Measures = Measurements
import Measures = Home.MotionSensor
```

A default imported name can also conflict with an alias:

```text
import Home.MotionSensor
import MotionSensor = Garden.Sensor
```

Reject duplicate local bindings at the imports rather than choosing one based on declaration kind or order. Existing reserved-name rules also apply.

A collision can be resolved by assigning distinct local names:

```text
import HomeSensor = Home.Sensor
import GardenSensor = Garden.Sensor
```

```text
HomeSensor
GardenSensor
```

Aliasing one declaration does not change the identity or visibility of another.

## Parsing and representation

Parsing recognizes the import source and optional alias from the written syntax, without consulting registered vocabulary.

The import representation records:

- The registered module name.
- The selected type name, when importing a type.
- The optional local alias.
- Source locations for these names.

Resolution determines whether the selected type is an ordinary type or an extension type and retains that declaration kind.

Later references retain the local names written in the script. Resolution maps those names to their registered identities.

The exact definition-schema changes and version impact should be recorded with the implementation of script imports.

## Diagnostics

Diagnostics should distinguish the local name from the declaration it denotes:

- An unknown source identifies the missing module or type.
- An inaccessible source identifies the declaration that cannot be imported.
- A duplicate local name identifies both conflicting imports.
- An invalid initial letter identifies the alias or source name concerned.
- An invalid use of an alias reports the resolved declaration’s kind—for example, selecting an ordinary type where extension access requires an extension type.

Where useful, diagnostics include both the script’s alias and the underlying qualified declaration name.

## Acceptance cases

- A module import establishes its namespace, using an alias when supplied.
- A type import establishes a direct local name for the selected type.
- Extension types use the same import and alias syntax as ordinary types.
- An aliased import establishes only its chosen local name.
- Importing one type does not expose unrelated declarations from its module.
- Aliases preserve declaration identities, kinds, inheritance, and contracts.
- Module and type aliases share collision checking.
- Unknown, inaccessible, reserved, and conflicting names are rejected appropriately.
- Import-source interpretation is independent of import order.
- Multiple paths to the same declaration do not create artificial ambiguity.
- Extension access through an alias enforces the selected extension’s target and member contracts.
- Canonical text preserves aliases, and resolution records their underlying identities.
