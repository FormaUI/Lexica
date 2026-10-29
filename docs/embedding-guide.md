# Embedding Guide

This guide shows how a host uses Nexo: read text, declare its domain as a module, resolve a script against it, evaluate it, and follow what the evaluation reads. The [specification](../spec/README.md) gives the exact rules, and the [design](nexo-design.md) how each stage works.

## Load it

Nexo is one ES module with its type declarations. Neither package is published yet; `./publish.ps1` packs both into `artifacts/`.

| Package | Import |
| --- | --- |
| npm, `@formaui/nexo` | `import { nexo, NexoError } from '@formaui/nexo';` |
| NuGet, `formaui-net.Nexo` | The bundle is served at `_content/nexo/nexo.js` |

## Read and write text

`nexo.parse` reads text into a definition, the script's frozen JSON form. `nexo.format` writes any definition, or text, back as canonical text, and `nexo.getLocation` finds where a definition node came from:

```js
const definition = nexo.parse('{ total = price  *  quantity }');

nexo.format(definition); // '{ total = price * quantity }'
nexo.getLocation(definition, '/expression/objectFields/0/value'); // { pointer: '/expression/objectFields/0/value', offset: 10, line: 1, column: 11 }
```

None of these needs a domain: reading, checking and formatting know the language and the script's imports alone. A script imports each module whose namespace it reads, at its start, and a host whose scripts all use its module supplies the import instead, which formatting for that host leaves out:

```js
nexo.parse('import Shop\nShop.open').imports;      // [{ module: 'Shop' }]
nexo.parse('Shop.open', { imports: ['Shop'] });    // the same definition
nexo.format('Shop.open', { imports: ['Shop'] });   // 'Shop.open'
nexo.format('import Store = Shop\nStore.open');   // 'import Store = Shop\n\nStore.open'
nexo.quote('{\n    open = Shop.open\n}', { imports: ['Shop'] }); // '{ open = Shop.open }'
```

`nexo.quote` writes the compact text a diagnostic quotes, which reads back as the same definition: on one line, but where a body that uses `return` puts each local and its `return` on a line of its own.

A registry reads no text of its own: `nexo.parse`, `nexo.format` and `nexo.quote` read and write a text alike for every registry, and `registry.resolve(script, bindings, { imports })` reads a text as `nexo.parse` does; registering a module changes how no text reads.

## Declare a domain

A module declares what scripts can read: its types, with their members, and the members it adds to other types in extensions, each with its signature, how its value changes, and the implementation that answers it. The declaration helpers fill in the defaults, and where a member stands gives it its receiver:

```js
const { createPropertyDeclaration, createFunctionDeclaration, createValueParameterDeclaration } = nexo.declarations;

const shop = nexo.createModule('Shop', {
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

An implementation receives one object and reads what it needs by name: its `receiver`, its `args` by parameter name, and the `env` the host supplies. Each kind of declaration, and the declaration keys it takes, is set out in [declarations](../spec/runtime/modules.md#modules-declarations); what `updates` means is in [updates](../spec/runtime/members.md#members-updates).

## Resolve a script

A registry holds the modules a host registers. Resolving a script against it checks every member, argument and type before anything runs, among what the script's imports make available, a module's members through its import and Nexo's own always, so a member of a module no import names is refused, giving the import to write:

```js
const registry = nexo.createRegistry([shop]);
const bindings = registry.createBindings({ product: 'tea', code: 'TEN' });
const resolution = registry.resolve('{ price = product.price, cut = product.discount(code) }', bindings, { imports: ['Shop'] });

resolution.type;                       // '{ price: Price, cut: Number }'
resolution.typeAt(['price', 'amount']); // 'Number'
resolution.usedDeclarations.map(used => used.qualifiedName); // ['String.price', 'String.discount']
```

An access on a value of `Any` selects its member as it is evaluated, so no used declaration names it: `resolution.deferredAccesses` lists each such access by its pointer and the name it accesses, and `resolution.getCandidateDeclarations()` answers every declaration an evaluation could select, marked as an overestimate while a deferred access remains.

`registry.createBindings` asks the registry's modules which values are references, by each module's `typeOf`, keeps each reference as it is and a frozen copy of the data, so later changes to the original data never reach a script; the bindings are that registry's alone. A resolution is reused for bindings of the same types and the same primitive values.

A host's map binds as a dictionary, read by key, and a set as a list in its order; a result exports a dictionary as its entries:

```js
const menu = { prices: new Map([['coffee', 3], ['tea', 2]]) };

nexo.createRegistry([]).resolve('{ tea = prices["tea"], all = prices }', menu).createEvaluator(menu).evaluate().value;
// { tea: 2, all: { entries: [{ key: 'coffee', value: 3 }, { key: 'tea', value: 2 }] } }
```

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

Only the reads an evaluation reaches are reported: a branch not taken reports nothing, and each evaluation reports the branch it took. The [design](nexo-design.md#evaluation) sets out every hook, maintained members' samples among them.

## Handle errors

Every failure is a `NexoError` with the code of its condition, a `kind` and the location it concerns:

```js
try {
    registry.resolve('product.weight', bindings);
} catch (error) {
    error.code;          // 'NEXO3001'
    error.kind;          // 'validation'
    error.location.line; // 1
    error.message;       // "'weight' is no member of the vocabulary (line 1, column 1, at /expression)"
}
```

The code identifies the condition and keeps it whatever the message says, so a host reacts to a condition by its code, never by its message; [the catalog](../spec/diagnostics-and-errors.md#diagnostics-codes) lists every code. A value a hook or a member's implementation throws reaches the host as the `cause` of Nexo's own error, unchanged.

The kinds, `syntax`, `structure`, `validation`, `module` and `evaluation`, and what each reports, are in [diagnostics and errors](../spec/diagnostics-and-errors.md).
