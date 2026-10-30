import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { repositoryRoot } from './support/paths.mjs';

const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');

/** The README's blocks fenced as the language, in order. */
const blocksOf = language => [...readme.matchAll(new RegExp(`^\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\`$`, 'gm'))].map(([, block]) => block);

/**
 * Runs the README's JavaScript as its reader would, `script` holding the README's script and its import of Nexo given as `nexo`, answering what it creates: the registry, the bindings, the resolution and the summary.
 */
const run = (code, script) => new Function('nexo', 'script', `${code.replace(/^import .*;$/gm, '')}\nreturn { registry, bindings, resolution, summary };`)(nexo, script);

describe('the README', () => {
    const [script] = blocksOf('nexo');
    const [code] = blocksOf('js');
    const [result] = blocksOf('json');

    it('has one script, the JavaScript that runs it and the result it gives', () => {
        expect(blocksOf('nexo')).toHaveLength(1);
        expect(blocksOf('js')).toHaveLength(1);
        expect(blocksOf('json')).toHaveLength(1);
    });

    it('writes its script in canonical text, which its definition, as JSON, formats back into', () => {
        const definition = JSON.parse(JSON.stringify(nexo.parse(script)));

        expect(nexo.format(script)).toBe(script);
        expect(nexo.format(definition)).toBe(script);
    });

    it('gives the result it shows, of the type it states, running its JavaScript against its script', () => {
        const { resolution, summary } = run(code, script);
        const [, type] = code.match(/^resolution\.type; \/\/ '(.+)'$/m);

        expect(resolution.type).toBe(type);
        expect(summary).toEqual(JSON.parse(result));
        expect(Object.isFrozen(summary)).toBe(true);
    });

    it('refuses the misspelt member it quotes where it says, and a missing import and text compared with a number, each with its location', () => {
        const { registry, bindings } = run(code, script);
        const [, misspelt, message, line, column] = readme.match(/writing `it\.(\w+)` in the total above gives "([^"]+)", at line (\d+), column (\d+)/);
        const refusalOf = written => {
            try {
                registry.resolve(written, bindings);
            } catch (error) {
                return error;
            }

            throw new Error(`'${written}' resolved`);
        };

        const misspelling = refusalOf(script.replace('it.amount + lateFee', `it.${misspelt} + lateFee`));
        expect(misspelling).toMatchObject({ kind: 'validation', code: 'NEXO3001', location: { line: Number(line), column: Number(column) } });
        expect(misspelling.message).toContain(message);

        expect(refusalOf(script.replace('import Billing\n\n', ''))).toMatchObject({ kind: 'validation', code: 'NEXO3005', location: { line: 1, column: 19 } });
        expect(refusalOf(script.replace('owed > customer.creditLimit', 'customer.name > customer.creditLimit'))).toMatchObject({
            kind: 'validation',
            code: 'NEXO3078',
            location: { line: 9, column: 17 },
        });
    });

    it('evaluates its resolution for another customer, and reports the members an evaluation invokes', () => {
        const { registry, bindings, resolution } = run(code, script);
        const today = Date.parse('2026-11-01');
        const other = registry.createBindings({ customer: { name: 'Contoso', creditLimit: 5000, invoices: [] } }, { types: { customer: 'Billing.Customer' } });
        const invoked = [];
        const hooks = { afterInvoke: (request, value) => invoked.push([request.declaration.name, request.receiver?.number, value]) };

        expect(resolution.createEvaluator(other, { today }).evaluate().value).toEqual({
            account: 'Contoso',
            amountDue: 0,
            status: 'in good standing',
            overdue: [],
            summary: '0 of 0 invoices outstanding',
        });

        resolution.createEvaluator(bindings, { today }).evaluate(hooks);
        expect(invoked).toContainEqual(['daysOverdue', 'INV-102', 42]);
        expect(invoked).toContainEqual(['sum', undefined, 1015]);
    });
});
