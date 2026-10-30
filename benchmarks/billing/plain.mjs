/**
 * The billing app in plain JavaScript: the same account summary and portfolio report as its Nexo scripts, computed in the same order, so the two give equal results
 */

const DAY = 24 * 60 * 60 * 1000;

const daysOverdue = (invoice, today) => Math.max(0, Math.round((today - Date.parse(invoice.dueDate)) / DAY));

const lateFee = (invoice, today) => (daysOverdue(invoice, today) > 30 ? invoice.amount * 0.05 : 0);

/** What a customer owes: each outstanding invoice's amount and late fee, added in order. */
const owedBy = (outstanding, today) => outstanding.reduce((total, invoice) => total + (invoice.amount + lateFee(invoice, today)), 0);

/** One customer's account summary, as the README's script gives it. */
export const summarizeAccount = (customer, today) => {
    const outstanding = customer.invoices.filter(invoice => !invoice.paid);
    const owed = owedBy(outstanding, today);

    return {
        account: customer.name,
        amountDue: owed,
        status: owed > customer.creditLimit ? 'on hold' : 'in good standing',
        overdue: outstanding
            .filter(invoice => daysOverdue(invoice, today) > 0)
            .map(invoice => ({ number: invoice.number, daysOverdue: daysOverdue(invoice, today), fee: lateFee(invoice, today) })),
        summary: `${outstanding.length} of ${customer.invoices.length} invoices outstanding`,
    };
};

/** The portfolio report over every customer: what each owes, the ten who owe most, and the invoices more than 30 days overdue. */
export const reportPortfolio = (customers, today) => {
    const accounts = customers.map(customer => ({
        name: customer.name,
        owed: owedBy(customer.invoices.filter(invoice => !invoice.paid), today),
        limit: customer.creditLimit,
    }));
    const largest = [...accounts].sort((left, right) => right.owed - left.owed || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)).slice(0, 10);

    return {
        accountCount: accounts.length,
        totalOwed: accounts.reduce((total, account) => total + account.owed, 0),
        onHold: accounts.filter(account => account.owed > account.limit).length,
        largest: largest.map(account => ({ name: account.name, owed: account.owed })),
        lateInvoices: customers.flatMap(customer => customer.invoices).filter(invoice => !invoice.paid && daysOverdue(invoice, today) > 30).length,
    };
};
