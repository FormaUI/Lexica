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
 * Every example reads as a definition and gives its canonical text again; the examples read the examples' vocabulary, which no module implements yet,
 * so they are read and formatted, and resolved once a module of that vocabulary is.
 */
const DOCUMENTS = {
    'spec/README.md': [],
    'spec/scripts.md': [
        { about: 'a script reading its parameter' },
        { about: 'an object expression' },
        { about: 'a body' },
        { about: 'locals' },
    ],
    'spec/lexical-structure.md': [
        { about: 'fields named by reserved words' },
        { about: 'a reserved reference' },
        { about: 'strings of each family' },
        { about: 'a block the source continues after' },
    ],
    'spec/values.md': [
        { about: 'values of each kind' },
        { about: 'the object root' },
        { about: 'a field of the object root still being built' },
        { about: 'conversions', each: true },
    ],
    'spec/types.md': [
        { about: 'types a script infers' },
        { about: 'casts', each: true, context: COMPARED },
    ],
    'spec/expressions.md': [
        { about: 'tests', each: true },
        { about: 'equalities', each: true },
        { about: 'arithmetic' },
        { about: 'comparisons' },
        { about: 'logical expressions', each: true },
        { about: 'conditionals', each: true, context: COMPARED },
        { about: 'coalescing operators', each: true },
        { about: 'attempts', each: true },
        { about: 'a result that tells missing from malformed' },
        { about: 'interpolated strings' },
        { about: 'a simple expression' },
    ],
    'spec/functions.md': [
        { about: 'a function' },
        { about: 'arrow functions' },
        { about: 'functions as values' },
    ],
    'spec/members.md': [
        { about: 'a member of each kind', each: true },
        { about: 'the forms of a member', each: true, context: 'cell { value = % }' },
        { about: 'bracket property access' },
        { about: 'an action and a behavior request', each: true },
        { about: 'a subscription' },
    ],
    'spec/modules.md': [],
    'spec/vocabulary.md': [],
    'spec/runtime.md': [],
    'spec/definition.md': [],
    'spec/diagnostics-and-errors.md': [],
    'spec/grammar.md': [],
    'spec/terms.md': [],
    'spec/examples-vocabulary.md': [],
    'docs/lexica-design.md': [],
    'docs/guide.md': [],
    'docs/status.md': [],
    'README.md': [
        { about: 'a body that counts the rows shown' },
    ],
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
