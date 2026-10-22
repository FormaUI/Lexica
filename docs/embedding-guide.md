# Embedding Guide

This guide shows how a host uses Lexica: read text, declare its domain as a module, resolve an expression against it, evaluate it, and follow what the evaluation reads. The [specification](../spec/README.md) gives the exact rules, and the [design](lexica-design.md) how each stage works.

## Load it

Lexica is one ES module with its type declarations. Neither package is published yet; `./publish.ps1` packs both into `artifacts/`.

| Package | Import |
| --- | --- |
| npm, `@formaui/lexica` | `import { lexica, LexicaError } from '@formaui/lexica';` |
| NuGet, `formaui-net.Lexica` | The bundle is served at `_content/lexica/lexica.js` |

## Read and write text

`lexica.parse` reads text into a definition, the expression's frozen JSON form. `lexica.format` writes any definition, or text, back as canonical text, and `lexica.locate` finds where a definition node came from:

```js
const definition = lexica.parse('{ total = price  *  quantity }');

lexica.format(definition); // '{ total = price * quantity }'
lexica.locate(definition, '/expression/fields/0/value'); // { pointer: '/expression/fields/0/value', offset: 10, line: 1, column: 11 }
```

None of these needs a domain: reading, checking and formatting know the language alone. A registry reads and writes text the same way with its modules' names, each beginning its module's namespace, through `registry.parse`, `registry.format` and `registry.quote`, and `registry.resolve` reads a text as `registry.parse` does.

## Declare a domain

A module declares what expressions can read: its types, and the members it adds to them, each with its signature, how its value changes, and the implementation that answers it. The declaration helpers fill in the defaults:

```js
const { property, function: fn, valueParameter } = lexica.declarations;

const shop = lexica.createModule('shop', {
    types: [{ name: 'Price', fields: { amount: 'Number', currency: 'String' } }],
    members: [
        property('price', 'String', 'Price', {
            updates: { changes: 'constant', reads: 'fresh', tolerance: 0.01 },
            implementation: ({ receiver, env }) => ({ amount: env.catalog[receiver], currency: 'EUR' }),
        }),
        fn('discount', 'String', 'Number', {
            updates: { changes: 'constant', reads: 'fresh' },
            parameters: [valueParameter('code', 'String')],
            implementation: ({ args }) => (args.code === 'TEN' ? 10 : 0),
        }),
    ],
});
```

An implementation receives one object and reads what it needs by name: its `receiver`, its `args` by parameter name, and the `env` the host supplies. Each kind of declaration, and the fields it takes, is set out in [declarations](../spec/modules.md#modules-declarations); what `updates` means is in [updates](../spec/members.md#members-updates).

## Resolve an expression

A registry holds the modules a host registers. Resolving an expression against it checks every member, argument and type before anything runs:

```js
const registry = lexica.createRegistry([shop]);
const bindings = lexica.bind({ product: 'tea', code: 'TEN' });
const resolution = registry.resolve('{ price = product.price, cut = product.discount(code) }', bindings);

resolution.type;                       // '{ price: Price, cut: Number }'
resolution.typeAt(['price', 'amount']); // 'Number'
resolution.usedDeclarations.map(used => used.name); // ['String.price', 'String.discount']
```

`lexica.bind` keeps a frozen copy of the data it is given, so later changes to the original never reach an expression. A resolution is reused for bindings of the same types and the same primitive values.

## Evaluate

An evaluator holds one set of bindings and the environment the host owns. Evaluating answers the value and the metadata that describes it:

```js
const evaluator = resolution.createEvaluator(bindings, { catalog: { tea: 4.5 } });
const { value, metadata } = evaluator.evaluate();

value;                           // { price: { amount: 4.5, currency: 'EUR' }, cut: 10 }
metadata.fields.price.tolerance; // 0.01
```

The result is frozen throughout and holds only data. Evaluate again whenever the host's state may have changed; each evaluation answers a new result and leaves earlier ones as they were.

## Follow what an evaluation reads

A host that keeps a result current gives the evaluation hooks. `beforeInvoke` is called before each member's implementation, `afterInvoke` after each one that answered, and `afterEvaluation` once as the evaluation ends:

```js
const reads = [];

evaluator.evaluate({
    beforeInvoke: request => { reads.push(request.declaration.name); },
    afterEvaluation: outcome => { reads.push(outcome.kind); },
});

reads; // ['price', 'discount', 'completed']
```

Only the reads an evaluation reaches are reported: a branch not taken reports nothing, and each evaluation reports the branch it took. The [design](lexica-design.md#evaluation) sets out every hook, maintained members' samples among them.

## Handle errors

Every failure is a `LexicaError` with a `kind` and the location it concerns:

```js
try {
    registry.resolve('product.weight', bindings);
} catch (error) {
    error.kind;          // 'validation'
    error.location.line; // 1
    error.message;       // "'weight' is no member of the vocabulary (line 1, column 1, at /expression)"
}
```

The kinds, `syntax`, `structure`, `validation`, `module` and `evaluation`, and what each reports, are in [diagnostics and errors](../spec/diagnostics-and-errors.md).
