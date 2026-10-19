import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';

const here = dirname(fileURLToPath(import.meta.url));

/** The `lexica` blocks of a document, in order, each with the line its fence opens on. */
const blocksOf = file => {
    const lines = readFileSync(resolve(here, '..', file), 'utf8').split('\n');
    const blocks = [];
    let block = null;

    lines.forEach((line, index) => {
        if (block === null && line === '```lexica') {
            block = { line: index + 1, lines: [] };
        } else if (block !== null && line === '```') {
            blocks.push(block);
            block = null;
        } else if (block !== null) {
            block.lines.push(line);
        }
    });

    return blocks;
};

/** The texts a block holds: the whole block, or, for an entry that says `each`, each line, a comment after it and a line of comment alone aside. */
const textsOf = (block, entry) => {
    if (entry.each !== true) {
        return [block.lines.join('\n')];
    }

    return block.lines.map(line => line.replace(/\s+\/\/.*$/, '').trim()).filter(line => line !== '' && !line.startsWith('//'));
};

// An example a context holds, written in its place, as one testing a value is compared with null.
const COMPARED = '(%) != null';

/**
 * Each document's examples, in order: what each is about, whether each of its lines is an example of its own, and the context it is written in.
 * Every example reads as a definition and gives its canonical text again; the examples read the DOM through DOMQL's vocabulary, which DOMQL's tests evaluate them against,
 * until Lexica has a vocabulary of its own to evaluate them with.
 */
const DOCUMENTS = {
    'docs/lexica-specification.md': [
        { about: 'an object expression' },
        { about: 'fields named by reserved words' },
        { about: 'a reserved reference' },
        { about: 'strings of each family' },
        { about: 'a block the query continues after' },
        { about: 'the forms of a member', each: true, context: 'cell { value = % }' },
        { about: 'bracket property access' },
        { about: 'a simple expression' },
        { about: 'tests', each: true },
        { about: 'equalities', each: true },
        { about: 'arithmetic' },
        { about: 'comparisons' },
        { about: 'logical expressions', each: true },
        { about: 'conditionals', each: true, context: COMPARED },
        { about: 'coalescing operators', each: true },
        { about: 'casts', each: true, context: COMPARED },
        { about: 'conversions', each: true },
        { about: 'attempts', each: true },
        { about: 'a result that tells missing from malformed' },
        { about: 'interpolated strings' },
        { about: 'a body' },
        { about: 'locals' },
        { about: 'the object root' },
        { about: 'a field of the object root still being built' },
        { about: 'a function' },
        { about: 'arrow functions' },
        { about: 'functions as values' },
        { about: 'an action and a behavior request', each: true },
        { about: 'a subscription' },
    ],
    'docs/lexica-design.md': [],
    'docs/lexica-implementation-plan.md': [],
};

describe('the examples of the documents', () => {
    describe.each(Object.entries(DOCUMENTS))('in %s', (file, entries) => {
        const blocks = blocksOf(file);

        it('have an entry for each lexica block', () => {
            expect(blocks.length).toBe(entries.length);
        });

        it.each(entries.map((entry, index) => [`${entry.about}, the block at line ${blocks[index]?.line}`, entry, blocks[index]]))('%s', (_, entry, block) => {
            textsOf(block, entry).forEach(text => {
                const written = (entry.context ?? '%').replace('%', () => text);
                const formatted = lexica.format(written);

                expect(lexica.format(formatted), text).toBe(formatted);
                expect(lexica.parse(formatted), text).toEqual(lexica.parse(written));
            });
        });
    });
});
