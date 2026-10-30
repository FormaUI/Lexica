/**
 * The billing app in Nexo: the vocabulary its module declares, as the README declares it, and the scripts that give the account summary and the portfolio report
 */

const DAY = 24 * 60 * 60 * 1000;

/** The account summary, the README's script. */
export const ACCOUNT_SUMMARY = `import Billing

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
}`;

/** The portfolio report over every customer. */
export const PORTFOLIO_REPORT = `import Billing

let lateFee = invoice => if invoice.daysOverdue > 30 then invoice.amount * 0.05 else 0 end
let accounts = customers {
    name = it.name,
    owed = it.invoices.where(not it.paid).sum(it.amount + lateFee(it)),
    limit = it.creditLimit
}
return {
    accountCount = accounts.count,
    totalOwed = accounts.sum(it.owed),
    onHold = accounts.where(it.owed > it.limit).count,
    largest = accounts.orderByDescending(it.owed).thenBy(it.name).take(10) {
        name = it.name,
        owed = it.owed
    },
    lateInvoices = customers.select(it.invoices).flatten.where(not it.paid and it.daysOverdue > 30).count
}`;

/** Creates the billing app's module, as the README declares it. */
export const createBillingModule = nexo => {
    const { createPropertyDeclaration: property } = nexo.declarations;

    return nexo.createModule('Billing', {
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
                    property('daysOverdue', 'Number', {
                        updates: { changes: 'unobserved', reads: 'fresh' },
                        impl: ({ receiver, env }) => Math.max(0, Math.round((env.today - Date.parse(receiver.dueDate)) / DAY)),
                    }),
                ],
            },
        ],
    });
};
