import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { createCustomers, TODAY } from '../benchmarks/billing/data.mjs';
import { ACCOUNT_SUMMARY, PORTFOLIO_REPORT, createBillingModule } from '../benchmarks/billing/nexo.mjs';
import { reportPortfolio, summarizeAccount } from '../benchmarks/billing/plain.mjs';

// The benchmark compares the billing app's two forms, so they must do the same work: these keep them equal.
describe('the benchmark\'s billing app', () => {
    const customers = createCustomers(200);
    const registry = nexo.createRegistry([createBillingModule(nexo)]);
    const env = { today: TODAY };
    const bindCustomer = customer => registry.createBindings({ customer }, { types: { customer: 'Billing.Customer' } });

    it('generates the same customers from the same seed, and others from another', () => {
        expect(createCustomers(200)).toEqual(customers);
        expect(createCustomers(200, 2)).not.toEqual(customers);
        expect(customers.flatMap(customer => customer.invoices).length).toBeGreaterThan(200 * 4);
    });

    it('writes its scripts in canonical text', () => {
        expect(nexo.format(ACCOUNT_SUMMARY)).toBe(ACCOUNT_SUMMARY);
        expect(nexo.format(PORTFOLIO_REPORT)).toBe(PORTFOLIO_REPORT);
    });

    it('gives each customer the account summary its JavaScript gives', () => {
        const summary = registry.resolve(ACCOUNT_SUMMARY, bindCustomer(customers[0]));

        customers.forEach(customer => expect(summary.createEvaluator(bindCustomer(customer), env).evaluate().value).toEqual(summarizeAccount(customer, TODAY)));
    });

    it('gives the portfolio report its JavaScript gives, every part of it holding something', () => {
        const bindings = registry.createBindings({ customers }, { types: { customers: 'List<Billing.Customer>' } });
        const report = registry.resolve(PORTFOLIO_REPORT, bindings).createEvaluator(bindings, env).evaluate().value;

        expect(report).toEqual(reportPortfolio(customers, TODAY));
        expect(report.onHold).toBeGreaterThan(0);
        expect(report.onHold).toBeLessThan(200);
        expect(report.largest).toHaveLength(10);
        expect(report.lateInvoices).toBeGreaterThan(0);
    });
});
