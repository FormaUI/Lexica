import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { repositoryRoot } from './support/paths.mjs';
import { createExamplesEnergy, createExamplesFixtures, createExamplesHome } from './support/examples.mjs';

/** The `lexica` blocks of a document, in order, each with the line its fence opens on. */
const blocksOf = file => {
    const lines = readFileSync(resolve(repositoryRoot, file), 'utf8').split('\n');
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

/** The examples' home, its modules written once, the registry they are registered with, and the bindings its host gives every example, each of the type the examples' vocabulary gives its name. */
const { home, values, types } = createExamplesFixtures();
const examples = lexica.createRegistry([createExamplesHome(home), createExamplesEnergy()]);
const bindings = examples.createBindings(values, { types });

/** The imports the examples' host supplies every script, so no example writes them. */
const IMPORTS = Object.freeze(['Home', 'Energy']);

/** The hooks the examples' host gives each evaluation: a maintained member's sample, a sensor's temperature as it reported it. */
const HOOKS = Object.freeze({ beforeInvoke: request => (request.declaration.updates?.reads === 'maintained' ? [request.receiver.temperature] : undefined) });

/** The value the examples' host supplies for each host call by its name, which a prepared call projects: the brightness a light reached, and a motion a sensor reported; a held thermostat supplies none. */
const SUPPLIED = Object.freeze({ dim: 40, on: Object.freeze({ at: 12, strength: 0.9 }) });

/**
 * Each document's examples, in order: what each is about, whether each of its lines is an example of its own, the context it is written in, and what resolving and evaluating it against the examples' home gives where its
 * document states it: its value, the kind of error that refuses it, or, for a host call, what its projection gives for the value its host supplies. Every example reads as a definition and gives its canonical text again,
 * and every one resolves against the examples' vocabulary with the host's imports and evaluates, a host call prepared and, where its host supplies values, projected.
 */
const DOCUMENTS = {
    'spec/README.md': [],
    'spec/scripts.md': [
        { about: 'a script reading its parameter', evaluates: { name: 'living', active: 3, total: 3 } },
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
        { about: 'an expression continuing after a block\'s end', evaluates: 3 },
        { about: 'a body that uses return, each local on its own line' },
    ],
    'spec/values.md': [
        { about: 'values of each kind' },
        { about: 'the object root', evaluates: { bar: 4, inner: { bar: 2, nearest: 2, outermost: 4 } } },
        { about: 'a field of the object root still being built', refused: 'validation' },
        {
            about: 'collection expressions',
            evaluates: { sizes: [10, 20, 30], stock: { entries: [{ key: 'coffee', value: 3 }, { key: 'tea', value: 2 }] }, none: [], empty: { entries: [] } },
        },
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
        { about: 'a result that tells missing from malformed', evaluates: { level: { status: 'valid', value: 40 } } },
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
        { about: 'the forms of a member', each: true, context: COMPARED },
        { about: 'computed property access' },
        { about: 'host calls', each: true },
    ],
    'spec/modules.md': [],
    'spec/vocabulary.md': [],
    'spec/runtime.md': [
        { about: 'a result projection reading a local before its host call', projects: { at: 12, isOccupied: true, wasOccupied: true } },
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
        { about: 'a body that counts the rows shown', evaluates: { count: 2, label: '2 of 3 shown' } },
    ],
};

/** What the example gives against the examples' home: its value, or, for a host call, its prepared call and the projection of the value its host supplies, where it supplies values. */
const outcomeOf = written => {
    const resolution = examples.resolve(written, bindings, { imports: IMPORTS });
    const evaluator = resolution.createEvaluator(bindings);

    if (resolution.hostCall === null) {
        return { value: evaluator.evaluate(HOOKS).value };
    }

    const call = evaluator.prepareHostCall();

    expect(call.kind, written).toBe('prepared');

    return { call, projection: call.project === undefined ? undefined : call.project(SUPPLIED[resolution.hostCall.name], HOOKS).value };
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

                if (entry.refused !== undefined) {
                    expect(() => examples.resolve(written, bindings, { imports: IMPORTS }), text).toThrow(expect.objectContaining({ kind: entry.refused }));

                    return;
                }

                const outcome = outcomeOf(written);

                if (entry.evaluates !== undefined) {
                    expect(outcome.value, text).toEqual(entry.evaluates);
                }

                if (entry.projects !== undefined) {
                    expect(outcome.projection, text).toEqual(entry.projects);
                }
            });
        });
    });

    it('resolve against the examples\' vocabulary, its home bound as its document sets out, every example evaluating or, a host call, prepared', () => {
        expect(examples.moduleNames).toEqual(['Lexica', 'Home', 'Energy']);
        expect(bindings.getType('device')).toBe('Device');
        expect(examples.resolve('device["level"] to Number', bindings, { imports: IMPORTS }).createEvaluator(bindings).evaluate(HOOKS).value).toBe(40);
        expect(examples.resolve('device:Device.power', bindings, { imports: IMPORTS }).createEvaluator(bindings).evaluate(HOOKS).value).toBe(60);
        expect(() => examples.resolve('device as Meter', bindings, { imports: IMPORTS })).toThrow(expect.objectContaining({ code: 'LEXICA3060' }));
    });
});
