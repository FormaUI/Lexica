import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { repositoryRoot } from './support/paths.mjs';

/** The codes a document's table rows begin with, each row's first cell holding them, the table of ranges aside. */
const codesOfTable = (file, section) => {
    const text = readFileSync(join(repositoryRoot, file), 'utf8');
    const start = section === undefined ? 0 : text.indexOf(section);
    const end = section === undefined ? text.length : text.indexOf('\n## ', start + section.length);
    return text
        .slice(start, end === -1 ? text.length : end)
        .split('\n')
        .filter(line => line.startsWith('| `NEXO') && !line.includes(' to `NEXO'))
        .flatMap(line => [...line.split('|')[1].matchAll(/NEXO\d{4}/g)].map(match => match[0]));
};

/** Every file of the sources, read whole. */
const sourcesOf = folder =>
    readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const path = join(folder, entry.name);
        return entry.isDirectory() ? sourcesOf(path) : /\.m?js$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
    });

/** The two catalogs, the language's conditions and the runtime's, which together catalog every code once. */
const CATALOGS = ['spec/language/errors.md', 'spec/runtime/errors.md'];

const retired = new Set(CATALOGS.flatMap(file => codesOfTable(file, '## Retired codes')));
const catalogued = CATALOGS.flatMap(file => codesOfTable(file));
const catalog = new Set(catalogued.filter(code => !retired.has(code)));
const temporary = new Set(codesOfTable('docs/features-status.md', '## Temporary implementation coverage'));
const used = new Set(sourcesOf(join(repositoryRoot, 'src')).flatMap(source => [...source.matchAll(/'(NEXO\d{4})'/g)].map(match => match[1])));

describe('the diagnostic codes', () => {
    it('catalogs each code once, in the catalog of the language or of the runtime', () => {
        expect(catalogued.filter((code, index) => catalogued.indexOf(code) !== index)).toEqual([]);
    });

    it('each code the sources raise is in the catalog or among the temporary codes', () => {
        expect([...used].filter(code => !catalog.has(code) && !temporary.has(code))).toEqual([]);
    });

    it('no temporary code is in the catalog', () => {
        expect([...temporary].filter(code => catalog.has(code))).toEqual([]);
    });

    it('each temporary code is one the sources raise', () => {
        expect([...temporary].filter(code => !used.has(code))).toEqual([]);
    });

    it('no retired code is raised or catalogued again', () => {
        expect([...retired].filter(code => used.has(code) || temporary.has(code))).toEqual([]);
    });
});
