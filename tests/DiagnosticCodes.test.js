import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The codes a document's table rows begin with, each row's first cell holding them, the table of ranges aside. */
const codesOfTable = (file, section) => {
    const text = readFileSync(join(root, file), 'utf8');
    const start = section === undefined ? 0 : text.indexOf(section);
    const end = section === undefined ? text.length : text.indexOf('\n## ', start + section.length);
    return text
        .slice(start, end === -1 ? text.length : end)
        .split('\n')
        .filter(line => line.startsWith('| `LEXICA') && !line.includes(' to `LEXICA'))
        .flatMap(line => [...line.split('|')[1].matchAll(/LEXICA\d{4}/g)].map(match => match[0]));
};

/** Every file of the sources, read whole. */
const sourcesOf = folder =>
    readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const path = join(folder, entry.name);
        return entry.isDirectory() ? sourcesOf(path) : /\.m?js$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
    });

const retired = new Set(codesOfTable('spec/diagnostics-and-errors.md', '## Retired codes'));
const catalog = new Set(codesOfTable('spec/diagnostics-and-errors.md').filter(code => !retired.has(code)));
const temporary = new Set(codesOfTable('docs/features-status.md', '## Temporary implementation coverage'));
const used = new Set(sourcesOf(join(root, 'src')).flatMap(source => [...source.matchAll(/'(LEXICA\d{4})'/g)].map(match => match[1])));

describe('the diagnostic codes', () => {
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
