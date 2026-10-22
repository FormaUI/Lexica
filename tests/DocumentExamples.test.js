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

/** The examples' registry, which reads their text with the names of the examples' two modules, whose namespaces the examples read through. */
const examples = lexica.createRegistry([lexica.createModule('home', {}), lexica.createModule('energy', {})]);

/**
 * Each document's examples, in order: what each is about, whether each of its lines is an example of its own, the context it is written in, and, for an example that reads none of the home's reference values,
 * what resolving and evaluating it gives: its value, or the kind of error that refuses it. Every example reads as a definition and gives its canonical text again, read and written with the examples' module names;
 * those that read the home's rooms, devices, lights, thermostats or sensors are resolved once reference types and declared binding types give their bindings a type.
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
        { about: 'a lexical reference', evaluates: { value: 3 } },
        { about: 'strings of each family', evaluates: { path: 'C:\\Users\\Eyal\\', pattern: '\\d{3}-\\d{2}', message: 'Saved to C:\\Users\\Eyal\\\n\nDone.' } },
        { about: 'a block the source continues after', evaluates: { label: 'Ready', count: 3 } },
        { about: 'a layout breaking at its break points' },
        { about: 'a chain breaking inside an operand' },
        { about: 'an expression continuing after a block\'s end' },
        { about: 'a body that uses return, each local on its own line' },
    ],
    'spec/values.md': [
        { about: 'values of each kind' },
        { about: 'the object root', evaluates: { bar: 4, inner: { bar: 2, nearest: 2, outermost: 4 } } },
        { about: 'a field of the object root still being built', refused: 'validation' },
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
        { about: 'arrow functions', evaluates: 42 },
        { about: 'functions as values' },
        { about: 'function references' },
    ],
    'spec/members.md': [
        { about: 'a member of each kind', each: true },
        { about: 'the forms of a member', each: true, context: 'cell { value = % }' },
        { about: 'computed property access' },
        { about: 'host calls', each: true },
    ],
    'spec/modules.md': [],
    'spec/vocabulary.md': [],
    'spec/runtime.md': [
        { about: 'a result projection reading a local before its host call' },
    ],
    'spec/definition.md': [],
    'spec/diagnostics-and-errors.md': [],
    'spec/grammar.md': [],
    'spec/terms.md': [],
    'spec/examples-vocabulary.md': [],
    'docs/lexica-design.md': [],
    'docs/embedding-guide.md': [],
    'docs/features-status.md': [],
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
                const formatted = examples.format(written);

                expect(examples.format(formatted), text).toBe(formatted);
                expect(examples.parse(formatted), text).toEqual(examples.parse(written));

                if (entry.evaluates !== undefined) {
                    expect(examples.resolve(written).createEvaluator({}).evaluate().value, text).toEqual(entry.evaluates);
                }

                if (entry.refused !== undefined) {
                    expect(() => examples.resolve(written), text).toThrow(expect.objectContaining({ kind: entry.refused }));
                }
            });
        });
    });
});
