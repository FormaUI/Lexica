# Embedding Guide

This guide shows how a host uses Lexica: read text, declare its domain as a module, resolve a script against it, evaluate it, and follow what the evaluation reads. The [specification](../spec/README.md) gives the exact rules, and the [design](lexica-design.md) how each stage works.

## Load it

Lexica is one ES module with its type declarations. Neither package is published yet; `./publish.ps1` packs both into `artifacts/`.

| Package | Import |
| --- | --- |
| npm, `@formaui/lexica` | `import { lexica, LexicaError } from '@formaui/lexica';` |
| NuGet, `formaui-net.Lexica` | The bundle is served at `_content/lexica/lexica.js` |

## Read and write text

`lexica.parse` reads text into a definition, the script's frozen JSON form. `lexica.format` writes any definition, or text, back as canonical text, and `lexica.getLocation` finds where a definition node came from:

```js
const definition = lexica.parse('{ total = price  *  quantity }');

lexica.format(definition); // '{ total = price * quantity }'
lexica.getLocation(definition, '/expression/fields/0/value'); // { pointer: '/expression/fields/0/value', offset: 10, line: 1, column: 11 }
```

None of these needs a domain: reading, checking and formatting know the language alone. A registry reads and writes text the same way with its modules' names, each beginning its module's namespace, through `registry.parse`, `registry.format` and `registry.quote`, and `registry.resolve` reads a text as `registry.parse` does.

## Declare a domain

A module declares what scripts can read: its types, with their members, and the members it adds to other types in extensions, each with its signature, how its value changes, and the implementation that answers it. The declaration helpers fill in the defaults, and where a member stands gives it its receiver:

```js
const { createPropertyDeclaration, createFunctionDeclaration, createValueParameterDeclaration } = lexica.declarations;

const shop = lexica.createModule('Shop', {
    types: [
        { name: 'Price', kind: 'structured', members: [createPropertyDeclaration('amount', 'Number'), createPropertyDeclaration('currency', 'String')] },
        {
            name: 'Products',
            kind: 'extension',
            target: 'String',
            members: [
                createPropertyDeclaration('price', 'Price', {
                    updates: { changes: 'constant', reads: 'fresh', tolerance: 0.01 },
                    impl: ({ receiver, env }) => ({ amount: env.catalog[receiver], currency: 'EUR' }),
                }),
                createFunctionDeclaration('discount', 'Number', {
                    updates: { changes: 'constant', reads: 'fresh' },
                    parameters: [createValueParameterDeclaration('code', 'String')],
                    impl: ({ args }) => (args.code === 'TEN' ? 10 : 0),
                }),
            ],
        },
    ],
});
```

An implementation receives one object and reads what it needs by name: its `receiver`, its `args` by parameter name, and the `env` the host supplies. Each kind of declaration, and the declaration keys it takes, is set out in [declarations](../spec/modules.md#modules-declarations); what `updates` means is in [updates](../spec/members.md#members-updates).

## Resolve a script

A registry holds the modules a host registers. Resolving a script against it checks every member, argument and type before anything runs:

```js
const registry = lexica.createRegistry([shop]);
const bindings = registry.createBindings({ product: 'tea', code: 'TEN' });
const resolution = registry.resolve('{ price = product.price, cut = product.discount(code) }', bindings);

resolution.type;                       // '{ price: Price, cut: Number }'
resolution.typeAt(['price', 'amount']); // 'Number'
resolution.usedDeclarations.map(used => used.qualifiedName); // ['String.price', 'String.discount']
```

`registry.createBindings` asks the registry's modules which values are references, by each module's `typeOf`, keeps each reference as it is and a frozen copy of the data, so later changes to the original data never reach a script; the bindings are that registry's alone. A resolution is reused for bindings of the same types and the same primitive values.

## Evaluate

An evaluator holds one set of bindings and the environment the host owns. Evaluating answers the value and the metadata that describes it:

```js
const evaluator = resolution.createEvaluator(bindings, { catalog: { tea: 4.5 } });
const { value, metadata } = evaluator.evaluate();

value;                           // { price: { amount: 4.5, currency: 'EUR' }, cut: 10 }
metadata.objectFields.price.tolerance; // 0.01
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

Every failure is a `LexicaError` with the code of its condition, a `kind` and the location it concerns:

```js
try {
    registry.resolve('product.weight', bindings);
} catch (error) {
    error.code;          // 'LEXICA3001'
    error.kind;          // 'validation'
    error.location.line; // 1
    error.message;       // "'weight' is no member of the vocabulary (line 1, column 1, at /expression)"
}
```

The code identifies the condition and keeps it whatever the message says, so a host reacts to a condition by its code, never by its message; [the catalog](../spec/diagnostics-and-errors.md#diagnostics-codes) lists every code. A value a hook or a member's implementation throws reaches the host as the `cause` of Lexica's own error, unchanged.

The kinds, `syntax`, `structure`, `validation`, `module` and `evaluation`, and what each reports, are in [diagnostics and errors](../spec/diagnostics-and-errors.md).
