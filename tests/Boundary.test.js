import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it, expect } from 'vitest';
import { repositoryRoot } from './support/paths.mjs';

// Nexo's sources, which depend on nothing outside them.
const nexo = resolve(repositoryRoot, 'src');

/** Every module under the folder, by its path. */
const modulesOf = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? modulesOf(join(folder, entry.name)) : entry.name.endsWith('.mjs') ? [join(folder, entry.name)] : []));

describe('Nexo\'s boundary', () => {
    it('imports nothing from outside its own folder', () => {
        const outside = modulesOf(nexo).flatMap(path => [...readFileSync(path, 'utf8').matchAll(/^import [^;]* from '([^']+)';$/gm)]
            .map(([, specifier]) => ({ module: relative(nexo, path), specifier, target: resolve(dirname(path), specifier) }))
            .filter(({ target }) => !target.startsWith(`${nexo}${sep}`)));

        expect(outside).toEqual([]);
        expect(modulesOf(nexo).length).toBeGreaterThan(0);
    });
});
