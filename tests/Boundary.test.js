import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Lexica's sources, which DOMQL depends on and which depend on nothing of DOMQL's.
const lexica = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** Every module under the folder, by its path. */
const modulesOf = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? modulesOf(join(folder, entry.name)) : entry.name.endsWith('.mjs') ? [join(folder, entry.name)] : []));

describe('Lexica\'s boundary', () => {
    it('imports nothing from outside its own folder, so nothing of DOMQL\'s', () => {
        const outside = modulesOf(lexica).flatMap(path => [...readFileSync(path, 'utf8').matchAll(/^import [^;]* from '([^']+)';$/gm)]
            .map(([, specifier]) => ({ module: relative(lexica, path), specifier, target: resolve(dirname(path), specifier) }))
            .filter(({ target }) => !target.startsWith(`${lexica}${sep}`)));

        expect(outside).toEqual([]);
        expect(modulesOf(lexica).length).toBeGreaterThan(0);
    });
});
