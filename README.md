# Lexica

Lexica is an extensible expression language. Its expressions, names, types, functions and result shapes are the language's; a vocabulary a host registers says what those expressions can read or request. Adding vocabulary never changes the grammar.

Lexica is a FormaUI product. [DOMQL](https://github.com/FormaUI/DOMQL) uses it to query the DOM and observe the results.

```lexica
let shown = rows.where(context.visible)
return {
    count = shown.count,
    label = $"{shown.count} of {rows.count} shown"
}
```

## What it offers

- **Expressions that shape data.** Object expressions name the fields of a result, a list's projection shapes each item, and every result is plain data.
- **Absence made explicit.** Optional access, `??` fallbacks and conditionals say what a missing value means; a value that can be missing is never used as one that cannot.
- **Names and functions.** Locals, bodies that `return` their result, regular and arrow functions passed as values, and the object root, `root`, reading the object being built.
- **Text.** Strings with escapes, raw strings whose backslashes are text, blocks on lines of their own, and interpolated strings of each.
- **Types checked before anything runs.** Every member a vocabulary declares has a typed signature, and an expression is resolved against it before it is evaluated.
- **Definitions as JSON.** Every expression has a definition, its canonical JSON form, which can be stored, exchanged and written back as canonical text.

## Status

Lexica is in alpha: its specification is `1.0.0-alpha`, and it is being separated from DOMQL, where it began, as the [implementation plan](docs/lexica-implementation-plan.md) records. The [specification](docs/lexica-specification.md) describes definition version 32, the separation's target; this implementation, and the examples here, still read version 31, which writes the implicit parameter `context` where version 32 writes `it`; version 32's namespaces and qualified access, its reference types, and owner precedence and extension ambiguity are still to come. It reads text into definitions, checks definitions, writes canonical text, creates modules, binds values, resolves an expression against a registry of its built-in vocabulary and the modules a host registers, and evaluates it for any host, describing the result beside its value.

## Use it

```js
import { lexica } from '@formaui/lexica';

const source = lexica.parse('{ total = price * quantity }');

lexica.format(source); // '{ total = price * quantity }'
lexica.info.version; // the version of the language

const registry = lexica.createRegistry();
const bindings = lexica.bind({ price: 4, quantity: 3 });
const resolution = registry.resolve(source, bindings);

resolution.type; // '{ total: number }'
resolution.createEvaluator(bindings).evaluate().value; // { total: 12 }
```

Lexica ships as the npm package `@formaui/lexica` and the NuGet package `formaui-net.Lexica`, which serves the bundle as `_content/lexica/lexica.js`. Neither is published yet.

## Documents

- [Specification](docs/lexica-specification.md): the language, its vocabulary contracts and its definition format.
- [Design](docs/lexica-design.md): how modules are declared and registered, and how tooling reads Lexica's text.
- [Implementation plan](docs/lexica-implementation-plan.md): what is built, what remains and the open decisions.

## Build

```powershell
./build.ps1
```

The gate runs the tests, bundles Lexica, builds the NuGet package project with no warnings and checks its formatting. `./publish.ps1` runs it, then packs both packages into `artifacts/`.

## License

Apache License 2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE).
