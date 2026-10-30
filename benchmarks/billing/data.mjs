/**
 * The billing app's data: customers and their invoices, generated from a seed so every run measures the same values
 */

/** The date the app evaluates on, which every overdue count is measured from. */
export const TODAY = Date.parse('2026-11-01');

const DAY = 24 * 60 * 60 * 1000;

/** A generator of numbers in [0, 1) from a seed, mulberry32, so the data is the same on every run and every machine. */
const createRandom = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

/** A date as the app writes it, `YYYY-MM-DD`, the given number of days from the app's date. */
const dateFrom = days => new Date(TODAY + days * DAY).toISOString().slice(0, 10);

/**
 * Creates the customers, each with a name, a credit limit and between 4 and 20 invoices: a whole amount from 50 to 2,000, paid or not, due from 90 days before the app's date to 30 days after it.
 */
export const createCustomers = (count, seed = 1) => {
    const random = createRandom(seed);
    const between = (low, high) => low + Math.floor(random() * (high - low + 1));
    let number = 0;

    return Array.from({ length: count }, (_, index) => ({
        name: `Customer ${String(index + 1).padStart(5, '0')}`,
        creditLimit: between(5, 40) * 100,
        invoices: Array.from({ length: between(4, 20) }, () => ({
            number: `INV-${String(++number).padStart(6, '0')}`,
            amount: between(50, 2000),
            paid: random() < 0.4,
            dueDate: dateFrom(between(-90, 30)),
        })),
    }));
};
