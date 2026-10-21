import { describe, it, expect } from 'vitest';
import { Evaluator } from '#lexica/language/Evaluator.mjs';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

const { property } = Declarations;

/** A reference a plain host's member answers: a value of a reference type, recognized by its kind until reference types land. */
const createPart = id => ({ nodeType: 1, id });
const parts = [createPart('a'), createPart('b')];

/** A plain host's module on names: a size measured within half a unit, a length, a list of references and each reference's label. */
const constant = { changes: 'constant', reads: 'fresh' };
const shapes = new LexicaModule('shapes', {
    types: [{ name: 'size', fields: { width: 'number', height: 'number' } }],
    members: [
        property('size', 'string', 'size', { updates: { ...constant, tolerance: 0.5 }, implementation: ({ receiver }) => ({ width: receiver.length, height: 1 }) }),
        property('length', 'string', 'number', { updates: constant, implementation: ({ receiver }) => receiver.length }),
        property('parts', 'string', 'list<element>', { updates: constant, implementation: () => parts }),
        property('label', 'element', 'string', { updates: constant, implementation: ({ receiver }) => receiver.id }),
    ],
});

/** The resolution of the text against a registry of Lexica's own module and the shapes, and an evaluation of it with the bindings given. */
const resolve = (text, values = { name: 'tea' }) => {
    const registry = new LexicaRegistry([Vocabulary.module, shapes]);
    const definition = ParsedTexts.parse(text);
    const bindings = new ParameterBindings(values);
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, bindings, locations).resolveDefinition(definition);

    return { evaluate: (evaluatedValues = values) => new Evaluator(registry, resolved, new ParameterBindings(evaluatedValues), {}, locations).evaluate() };
};

const metadataOf = (text, values) => resolve(text, values).evaluate().metadata;

describe('result metadata', () => {
    it('describes a member\'s result by its origin and the tolerance its declaration gives, a part with no record inheriting both', () => {
        const { fields } = metadataOf('{ size = name.size, length = name.length }');

        expect(fields.size).toEqual({ origin: expect.any(Object), tolerance: 0.5 });
        expect(fields.length).toEqual({ origin: expect.any(Object), tolerance: null });
        expect(fields.size.origin).not.toBe(fields.length.origin);
        expect(Object.isFrozen(fields.size) && Object.isFrozen(fields)).toBe(true);
    });

    it('keeps the metadata of the part an access selects: a field of a member\'s result, and one of an object a local holds', () => {
        const { fields } = metadataOf('let dimensions = { width = name.size.width } return { direct = name.size.width, held = dimensions.width, measured = name.size { width = it.width } }');

        expect(fields.direct.tolerance).toBe(0.5);
        expect(fields.held.tolerance).toBe(0.5);
        expect(fields.measured.fields.width.tolerance).toBe(0.5);
    });

    it('follows locals, bodies, function calls and the object root to the expression that produced the value', () => {
        const { fields } = metadataOf('let measure = () => name.size\nreturn { let measured = name.size, kept = measured, done = do measured end, called = measure(), base = name.size, again = root.base }');

        expect([fields.kept, fields.done, fields.called, fields.again].map(field => field.tolerance)).toEqual([0.5, 0.5, 0.5, 0.5]);
        expect(fields.kept.origin).toBe(fields.done.origin);
        expect(fields.again.origin).toBe(fields.base.origin);
        expect(fields.called.origin).not.toBe(fields.base.origin);
    });

    it('gives a computed value an origin and a null tolerance of its own, which overrides the tolerance it would inherit', () => {
        const { fields } = metadataOf('name.size { exact = it.width + 0, measured = it.width }');

        expect(fields.exact.tolerance).toBeNull();
        expect(fields.measured.tolerance).toBe(0.5);
        expect(fields.exact.origin).not.toBe(fields.measured.origin);
    });

    it('gives a selected branch\'s origin, the same across evaluations of one resolution and different for each branch', () => {
        const resolution = resolve('{ chosen = if wide then name.size.width else name.length end }', { name: 'tea', wide: true });
        const first = resolution.evaluate().metadata.fields.chosen;
        const again = resolution.evaluate().metadata.fields.chosen;
        const other = resolution.evaluate({ name: 'tea', wide: false }).metadata.fields.chosen;

        expect(again.origin).toBe(first.origin);
        expect(first.tolerance).toBe(0.5);
        expect(other.origin).not.toBe(first.origin);
        expect(other.tolerance).toBeNull();
    });

    it('never compares origins across resolutions', () => {
        expect(metadataOf('{ size = name.size }').fields.size.origin).not.toBe(metadataOf('{ size = name.size }').fields.size.origin);
    });

    it('describes each item of a projection and the reference it came from, which the value never holds', () => {
        const { value, metadata } = resolve('name.parts { label = it.label }').evaluate();

        expect(value).toEqual([{ label: 'a' }, { label: 'b' }]);
        expect(metadata.sources).toEqual(parts);
        expect(metadata.sources[0]).toBe(parts[0]);
        expect(Object.isFrozen(parts[0])).toBe(false);
        expect(metadata.items).toHaveLength(2);
        expect(metadata.items[0].fields.label.origin).toBe(metadata.items[1].fields.label.origin);
    });

    it('records each field by its name in the order written', () => {
        const { fields } = metadataOf('{ b = 1, c = 2, a = 3 }');

        expect(Object.keys(fields)).toEqual(['b', 'c', 'a']);
    });
});
