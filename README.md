# Nexo

Nexo lets an application expose its own concepts through a typed scripting language, so people can express rules and produce structured results in those terms.

The application declares what scripts may use: its records, their properties and the operations it implements. Nexo checks each script against those declarations before it runs, and evaluates it into plain, immutable data.

## An example

A billing application keeps customers and their invoices. It gives each script one `customer`, with a name, a credit limit and invoices. It declares what scripts can read: a customer's `invoices`, an invoice's `amount`, whether it is `paid`, and `daysOverdue`, which the application computes from the invoice's due date and today.

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

Northwind Traders has four invoices on November 1, 2026: one paid, one 42 days overdue, one 7 days overdue and one not yet due. Its credit limit is 1,000. The script gives:

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
| The application's own vocabulary | Scripts work with `customer.invoices` and `daysOverdue`, not a generic data model. An application exposes its concepts and its operations, and rules are written in those terms. |
| Checked before it runs | A script is resolved against the vocabulary before anything is evaluated. A misspelt member, a missing import or a comparison of text with a number is refused with its location: writing `it.amout` in the total above gives "'amout' is no member of the vocabulary", at line 5, column 28. |
| Expressions, collections and structured output | Filters, totals, conditions, text and the shape of the result are written together, so one script turns application data into a useful result. |
| Functions and composition | A rule such as `lateFee` is written once and reused wherever it applies, so scripts grow without repeating themselves. |
| An explicit host boundary | A script reads only what the application binds and declares, and changes nothing itself. The application implements every operation it declares, and carries out any call that acts. |
| Definitions as data, with canonical text | A script parses into a JSON definition an application can store, inspect and rewrite, and formats back into one canonical text, so generated and hand-written scripts read alike. |
| Reads reported as it evaluates | An evaluation reports each member it invokes, such as each invoice's `daysOverdue`, and every member declares how its value changes. An integration learns what a result depends on, and when to evaluate it again. |

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
                // Computed by the application, from the date it evaluates on.
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

`summary` is the result shown above. A resolution serves any bindings of the same types, so the script is resolved once and evaluated for each customer. [Embedding Nexo](https://github.com/FormaUI/Nexo/blob/main/docs/embedding-guide.md) goes on to functions a module declares, calls the application carries out, and following what an evaluation reads.

## Availability

> **Alpha.** Neither package is published yet: build them locally, as [Build](#build) shows, to try Nexo. The implementation, `1.0.0-alpha.37`, implements language version `1.0.0-alpha.41`. [The status overview](https://github.com/FormaUI/Nexo/blob/main/docs/features-status.md) says what is implemented and what remains.

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
