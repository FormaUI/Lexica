# Nexo

Nexo lets an application expose its own concepts through a typed scripting language, so people can express rules and produce structured results in those terms.

The application declares what scripts may use: its records, their properties and the operations it implements. Nexo checks each script against those declarations before it runs, and evaluates it into plain, immutable data.

## An example

A billing application keeps customers and their invoices. It gives each script one `customer`, with a name, a credit limit and invoices. It declares what scripts can read: a customer's `invoices`, an invoice's `amount`, whether it is `paid`, and `daysOverdue`, which the application computes from the invoice's due date and the date it gives the evaluation.

This script summarizes what a customer owes, charging a 5% late fee on any invoice more than 30 days overdue:

```nexo
import Billing

let outstanding = customer.invoices.where(not it.paid)
let lateFee = invoice => if invoice.daysOverdue > 30 then invoice.amount * 0.05 else 0 end
let owed = outstanding.sum(it.amount + lateFee(it))
return {
    account = customer.name,
    amountDue = owed,
    status = if owed > customer.creditLimit then "on hold" else "in good standing" end,
    overdue = outstanding.where(it.daysOverdue > 0) {
        number = it.number,
        daysOverdue = it.daysOverdue,
        fee = lateFee(it)
    },
    summary = $"{outstanding.count} of {customer.invoices.count} invoices outstanding"
}
```

The application evaluates the script on November 1, 2026. Northwind Traders then has four invoices: one paid, one 42 days overdue, one 7 days overdue and one not yet due. Its credit limit is 1,000. The script gives:

```json
{
    "account": "Northwind Traders",
    "amountDue": 1015,
    "status": "on hold",
    "overdue": [
        { "number": "INV-102", "daysOverdue": 42, "fee": 15 },
        { "number": "INV-103", "daysOverdue": 7, "fee": 0 }
    ],
    "summary": "3 of 4 invoices outstanding"
}
```

What the example shows:

- **The application's terms.** `customer.invoices` and `invoice.daysOverdue` are the billing application's concepts. `daysOverdue` runs the application's own code, and the script reads it as it reads any property.
- **A rule stated once.** `lateFee` is written once, and both the amount due and each overdue line apply it.
- **One readable place.** Filtering, the total, the credit check and the shape of the result are in one script, rather than spread through application code.
- **Plain data out.** The result has the shape the script writes, ready to send, store or compare.

## Why embed Nexo

| Strength | Why it matters |
| --- | --- |
| The application's own vocabulary | The script works with `customer.invoices` and `daysOverdue`, the billing application's concepts, not a generic data model. `daysOverdue` is an operation the application implements. |
| Checked before it runs | Writing `it.amout` in the total is refused before anything runs: "'amout' is no member of the vocabulary", at line 5, column 28. Leaving out `import Billing`, or comparing `customer.name` with a number, is refused the same way, with its location. |
| Expressions, collections and structured output | One script filters the invoices, totals them, checks the credit limit, writes the summary's text and shapes the result. |
| Functions and composition | `lateFee` is written once, and both the total and each overdue line apply it, so the fee changes in one place. |
| An explicit host boundary | The script reads only the `customer` the application binds, as a frozen copy, through members `Billing` and Nexo declare. `daysOverdue` runs the application's code, and nothing the script does changes the application's data. |
| Definitions as data, with canonical text | `nexo.parse` gives the script as a JSON definition to store or inspect, and `nexo.format` gives the text above back from it, so a definition a tool generates reads as a script written by hand. |
| Reads reported as it evaluates | Hooks the application gives an evaluation are told of each member it invokes, `daysOverdue` among them, so the application knows what the summary read. Each member also declares how it changes: `daysOverdue` is `unobserved`, since nothing signals that a day has passed, so when to evaluate again is the application's choice. |

## Run it

The application declares its vocabulary as a module, binds its data and evaluates the script. `script` holds the script's text above:

```js
import { nexo } from '@formaui/nexo';

const { createPropertyDeclaration: property } = nexo.declarations;
const DAY = 24 * 60 * 60 * 1000;

const billing = nexo.createModule('Billing', {
    types: [
        {
            name: 'Customer',
            kind: 'structured',
            members: [property('name', 'String'), property('creditLimit', 'Number'), property('invoices', 'List<Invoice>')],
        },
        {
            name: 'Invoice',
            kind: 'structured',
            members: [
                property('number', 'String'),
                property('amount', 'Number'),
                property('paid', 'Boolean'),
                property('dueDate', 'String'),
                // The application's code, reading the date it gives the evaluation. Nothing signals
                // that the date has moved on, so the property is unobserved.
                property('daysOverdue', 'Number', {
                    updates: { changes: 'unobserved', reads: 'fresh' },
                    impl: ({ receiver, env }) => Math.max(0, Math.round((env.today - Date.parse(receiver.dueDate)) / DAY)),
                }),
            ],
        },
    ],
});

const customer = {
    name: 'Northwind Traders',
    creditLimit: 1000,
    invoices: [
        { number: 'INV-101', amount: 450, paid: true, dueDate: '2026-09-15' },
        { number: 'INV-102', amount: 300, paid: false, dueDate: '2026-09-20' },
        { number: 'INV-103', amount: 520, paid: false, dueDate: '2026-10-25' },
        { number: 'INV-104', amount: 180, paid: false, dueDate: '2026-11-20' },
    ],
};

const registry = nexo.createRegistry([billing]);
const bindings = registry.createBindings({ customer }, { types: { customer: 'Billing.Customer' } });

// Resolving checks the script against the vocabulary, before anything runs.
const resolution = registry.resolve(script, bindings);

resolution.type; // '{ account: String, amountDue: Number, status: String, overdue: List<{ number: String, daysOverdue: Number, fee: Number }>, summary: String }'

const summary = resolution.createEvaluator(bindings, { today: Date.parse('2026-11-01') }).evaluate().value;
```

`summary` is the result shown above, on any day, since the date comes from the evaluation and not the clock. A resolution serves any bindings of the same types, so the script is resolved once and evaluated for each customer. [Embedding Nexo](https://github.com/FormaUI/Nexo/blob/main/docs/embedding-guide.md) goes on to functions a module declares, calls the application carries out, and following what an evaluation reads.

## Availability

> **Alpha.** Neither package is published yet: build them locally, as [Build](#build) shows, to try Nexo. The implementation, `1.0.0-alpha.37`, implements language version `1.0.0-alpha.42`. [The status overview](https://github.com/FormaUI/Nexo/blob/main/docs/features-status.md) says what is implemented and what remains.

## Documents

| Document | What it holds |
| --- | --- |
| [Guide](https://github.com/FormaUI/Nexo/blob/main/docs/embedding-guide.md) | Embedding Nexo in an application, by example |
| [Specification](https://github.com/FormaUI/Nexo/blob/main/spec/README.md) | The contract, in two parts: the language, what a script means, and the runtime, what an application provides to run it |
| [Language history](https://github.com/FormaUI/Nexo/blob/main/LANGUAGE-HISTORY.md) | Each language version and what it changed |
| [Status](https://github.com/FormaUI/Nexo/blob/main/docs/features-status.md) | What is implemented, and what remains |
| [Design](https://github.com/FormaUI/Nexo/blob/main/docs/nexo-design.md) | How Nexo is built: its stages, modules, evaluation and tooling |
| [Contributing](https://github.com/FormaUI/Nexo/blob/main/CONTRIBUTING.md) | Report a bug, develop a change and run the checks |

## Build

```powershell
./build.ps1
```

The gate runs the tests, bundles Nexo, builds the NuGet package project with no warnings and checks its formatting. `./publish.ps1` runs it, then packs the npm package `@formaui/nexo` and the NuGet package `formaui-net.Nexo` into `artifacts/`.

## License

Apache License 2.0; see [LICENSE](https://github.com/FormaUI/Nexo/blob/main/LICENSE) and [NOTICE](https://github.com/FormaUI/Nexo/blob/main/NOTICE).
