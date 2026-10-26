import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// The package's folder, from which Node resolves `@formaui/lexica` through the package's own exports, as a consumer that installed it does.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** What a module run in the package's folder prints, run by Node. */
const run = source => {
    const { stdout, stderr, status } = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: root, encoding: 'utf8' });

    return { output: stdout.trim(), error: stderr, status };
};

describe('the package', () => {
    it('serves a plain host by its name, through its entry point alone', () => {
        const { output, status, error } = run(`
            import { lexica } from '@formaui/lexica';

            const resolution = lexica.createRegistry().resolve('{ total = price * quantity }', { price: 2, quantity: 3 });
            const { value, metadata } = resolution.createEvaluator({ price: 2, quantity: 3 }).evaluate();

            console.log(JSON.stringify({ value, type: resolution.type, tolerance: metadata.objectFields.total.tolerance }));
        `);

        expect(error).toBe('');
        expect(status).toBe(0);
        expect(JSON.parse(output)).toEqual({ value: { total: 6 }, type: '{ total: Number }', tolerance: null });
    });

    it('exports its entry point alone, refusing a module of its sources', () => {
        const { output } = run(`
            try {
                await import('@formaui/lexica/language/Evaluator.mjs');
                console.log('imported');
            } catch (error) {
                console.log(error.code);
            }
        `);

        expect(output).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
    });
});
