import { describe, it, expect } from 'vitest';
import { Evaluator } from '#lexica/language/Evaluator.mjs';
import { LanguageResolver } from '#lexica/language/LanguageResolver.mjs';
import { ParameterBindings } from '#lexica/language/ParameterBindings.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { Light, withHome } from '../support/home.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration } from '../support/declarations.mjs';
import { parseImporting } from '../support/pipeline.mjs';

const { createPropertyDeclaration } = Declarations;

/** The references a plain host's member answers, lights of the home. */
const parts = [new Light('a'), new Light('b')];

/** Three references, the first two labelled alike, so a projection of their labels gives equal values that stand for different references. */
const twins = [new Light('a'), new Light('a'), new Light('b')];

/** A plain host's module on names: a size measured within half a unit, a length, a list of references, a crowd holding one of them twice, twins labelled alike, and each reference's label. */
const shapes = new LexicaModule('shapes', withHome({
    types: [
        { name: 'Size', kind: 'structured', members: dataPropertyDeclarations({ width: 'Number', height: 'Number' }) },
        extensionDeclaration('Names', 'String', [
            createPropertyDeclaration('size', 'Size', { updates: { ...constantUpdates, tolerance: 0.5 }, impl: ({ receiver }) => ({ width: receiver.length, height: 1 }) }),
            createPropertyDeclaration('length', 'Number', { updates: constantUpdates, impl: ({ receiver }) => receiver.length }),
            createPropertyDeclaration('parts', 'List<Light?>', { updates: constantUpdates, impl: () => parts }),
            createPropertyDeclaration('crowd', 'List<Light>', { updates: constantUpdates, impl: () => [parts[0], parts[1], parts[0]] }),
            createPropertyDeclaration('twins', 'List<Light>', { updates: constantUpdates, impl: () => twins }),
            createPropertyDeclaration('sizes', 'List<Size?>', { updates: constantUpdates, impl: () => [{ width: 1, height: 2 }, null] }),
        ]),
    ],
}, {
    Light: [createPropertyDeclaration('label', 'String', { updates: constantUpdates, impl: ({ receiver }) => receiver.name })],
}));

/** The resolution of the text against a registry of Lexica's own module and the shapes, and an evaluation of it with the bindings given. */
const resolve = (text, values = { name: 'tea' }) => {
    const registry = new LexicaRegistry([Vocabulary.module, shapes]);
    const definition = parseImporting(registry, text);
    const bindings = new ParameterBindings(registry, values);
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, bindings, locations).resolveDefinition(definition);

    return { evaluate: (evaluatedValues = values) => new Evaluator(registry, resolved, new ParameterBindings(registry, evaluatedValues), {}, locations).evaluate() };
};

const metadataOf = (text, values) => resolve(text, values).evaluate().metadata;

describe('result metadata', () => {
    it('describes a member\'s result by its origin and the tolerance its declaration gives, a part with no record inheriting both', () => {
        const { objectFields } = metadataOf('{ size = name.size, length = name.length }');

        expect(objectFields.size).toEqual({ origin: expect.any(Object), tolerance: 0.5 });
        expect(objectFields.length).toEqual({ origin: expect.any(Object), tolerance: null });
        expect(objectFields.size.origin).not.toBe(objectFields.length.origin);
        expect(Object.isFrozen(objectFields.size) && Object.isFrozen(objectFields)).toBe(true);
    });

    it('keeps the metadata of the part an access selects: a field of a member\'s result, and one of an object a local holds', () => {
        const { objectFields } = metadataOf('let dimensions = { width = name.size.width }\nreturn { direct = name.size.width, held = dimensions.width, measured = name.size { width = it.width } }');

        expect(objectFields.direct.tolerance).toBe(0.5);
        expect(objectFields.held.tolerance).toBe(0.5);
        expect(objectFields.measured.objectFields.width.tolerance).toBe(0.5);
    });

    it('follows locals, bodies, function calls and the object root to the expression that produced the value', () => {
        const { objectFields } = metadataOf('let measure = () => name.size\nreturn { let measured = name.size, kept = measured, done = do measured end, called = measure(), base = name.size, again = root.base }');

        expect([objectFields.kept, objectFields.done, objectFields.called, objectFields.again].map(field => field.tolerance)).toEqual([0.5, 0.5, 0.5, 0.5]);
        expect(objectFields.kept.origin).toBe(objectFields.done.origin);
        expect(objectFields.again.origin).toBe(objectFields.base.origin);
        expect(objectFields.called.origin).not.toBe(objectFields.base.origin);
    });

    it('gives a computed value an origin and a null tolerance of its own, which overrides the tolerance it would inherit', () => {
        const { objectFields } = metadataOf('name.size { exact = it.width + 0, measured = it.width }');

        expect(objectFields.exact.tolerance).toBeNull();
        expect(objectFields.measured.tolerance).toBe(0.5);
        expect(objectFields.exact.origin).not.toBe(objectFields.measured.origin);
    });

    it('gives a selected branch\'s origin, the same across evaluations of one resolution and different for each branch', () => {
        const resolution = resolve('{ chosen = if wide then name.size.width else name.length end }', { name: 'tea', wide: true });
        const first = resolution.evaluate().metadata.objectFields.chosen;
        const again = resolution.evaluate().metadata.objectFields.chosen;
        const other = resolution.evaluate({ name: 'tea', wide: false }).metadata.objectFields.chosen;

        expect(again.origin).toBe(first.origin);
        expect(first.tolerance).toBe(0.5);
        expect(other.origin).not.toBe(first.origin);
        expect(other.tolerance).toBeNull();
    });

    it('describes a result\'s nested identities as its own evaluation left them, however many evaluations come before its metadata is read', () => {
        const resolution = resolve('{ rows = name.parts { label = it.label, chosen = if wide then name.size.width else name.length end } }', { name: 'tea', wide: true });
        const first = resolution.evaluate();
        const later = resolution.evaluate({ name: 'tea', wide: false });
        const { rows } = first.metadata.objectFields;

        expect(rows.sources).toEqual([{ kind: 'reference', value: parts[0] }, { kind: 'reference', value: parts[1] }]);
        expect(rows.items.map(item => item.objectFields.chosen.tolerance)).toEqual([0.5, 0.5]);
        expect(later.metadata.objectFields.rows.items.map(item => item.objectFields.chosen.tolerance)).toEqual([null, null]);
        expect(rows.items[0].objectFields.chosen.origin).not.toBe(later.metadata.objectFields.rows.items[0].objectFields.chosen.origin);
    });

    it('never compares origins across resolutions', () => {
        expect(metadataOf('{ size = name.size }').objectFields.size.origin).not.toBe(metadataOf('{ size = name.size }').objectFields.size.origin);
    });

    it('describes each item of a projection and the reference it came from, which the value never holds', () => {
        const { value, metadata } = resolve('name.parts { label = it.label }').evaluate();

        expect(value).toEqual([{ label: 'a' }, { label: 'b' }]);
        expect(metadata.sources).toEqual([{ kind: 'reference', value: parts[0] }, { kind: 'reference', value: parts[1] }]);
        expect(metadata.sources[0].value).toBe(parts[0]);
        expect(Object.isFrozen(metadata.sources)).toBe(true);
        expect(Object.isFrozen(metadata.sources[0])).toBe(true);
        expect(Object.isFrozen(parts[0])).toBe(false);
        expect(metadata.items).toHaveLength(2);
        expect(metadata.items[0].objectFields.label.origin).toBe(metadata.items[1].objectFields.label.origin);
    });

    it('describes the data and the null each item of a projection came from, data as a frozen copy, by the input\'s established type', () => {
        const { metadata } = resolve('name.sizes { width = it.width }').evaluate();

        expect(metadata.sources).toEqual([{ kind: 'data', value: { width: 1, height: 2 } }, { kind: 'null' }]);
        expect(Object.isFrozen(metadata.sources[0].value)).toBe(true);
    });

    it('records sources: [] for a projection of no items, and no sources at all for a list no projection built', () => {
        expect(resolve('items { n = it }', { items: [] }).evaluate().metadata.sources).toEqual([]);
        expect(Object.hasOwn(resolve('items', { items: [1, 2] }).evaluate().metadata, 'sources')).toBe(false);
    });

    it('traces a stored value read through the root and through a value, directly and by a computed name, to the branch its field selected, of an equal value and another tolerance', () => {
        const text = 'let held = { picked = if flag then name.size.width else name.length end }\nreturn { picked = if flag then name.size.width else name.length end, viaRoot = root.picked, viaRootComputed = root.[key], viaValue = held.picked, viaValueComputed = held.[key] }';
        const reads = ['viaRoot', 'viaRootComputed', 'viaValue', 'viaValueComputed'];
        const { evaluate } = resolve(text, { name: 'tea', flag: true, key: 'picked' });

        for (const [flag, tolerance] of [[true, 0.5], [false, null]]) {
            const { value, metadata } = evaluate({ name: 'tea', flag, key: 'picked' });

            expect(reads.map(read => value[read])).toEqual([3, 3, 3, 3]);
            expect(reads.map(read => metadata.objectFields[read].tolerance)).toEqual([tolerance, tolerance, tolerance, tolerance]);
            expect(metadata.objectFields.viaRoot.origin).toBe(metadata.objectFields.picked.origin);
        }
    });

    it('records each field by its name in the order written', () => {
        const { objectFields } = metadataOf('{ b = 1, c = 2, a = 3 }');

        expect(Object.keys(objectFields)).toEqual(['b', 'c', 'a']);
    });
    describe('provenance', () => {
        const references = items => items.map(item => ({ kind: 'reference', value: item }));

        it('records a projection of a list no projection built with its own sources as its provenance, entry for entry', () => {
            const { metadata } = resolve('name.crowd { name = it.label }').evaluate();

            expect(metadata.provenance).toEqual(references([parts[0], parts[1], parts[0]]));
            expect(metadata.provenance.every((entry, index) => entry === metadata.sources[index])).toBe(true);
            expect(Object.isFrozen(metadata.provenance)).toBe(true);
        });

        it("keeps a second projection's sources its immediate input while its provenance names the references the first projection read, an input standing twice twice", () => {
            const { value, metadata } = resolve('name.crowd { name = it.label } { label = it.name }').evaluate();

            expect(value).toEqual([{ label: 'a' }, { label: 'b' }, { label: 'a' }]);
            expect(metadata.sources).toEqual([{ kind: 'data', value: { name: 'a' } }, { kind: 'data', value: { name: 'b' } }, { kind: 'data', value: { name: 'a' } }]);
            expect(metadata.provenance).toEqual(references([parts[0], parts[1], parts[0]]));
            expect(metadata.provenance[0].value).toBe(parts[0]);
            expect(metadata.provenance[2].value).toBe(parts[0]);
        });

        it('meets the four-step chain as object projections write it: a filter, then two projections, the final items naming their original references', () => {
            const { value, metadata } = resolve('name.crowd.where(it.label == "a") { name = it.label } { label = it.name }').evaluate();

            expect(value).toEqual([{ label: 'a' }, { label: 'a' }]);
            expect(metadata.sources).toEqual([{ kind: 'data', value: { name: 'a' } }, { kind: 'data', value: { name: 'a' } }]);
            expect(metadata.provenance).toEqual(references([parts[0], parts[0]]));
        });

        it('meets the four-step chain written with select: each projection keeps its immediate sources, and the final items name their original references', () => {
            const { value, metadata } = resolve('name.crowd.where(it.label == "a").select({ name = it.label }).select({ label = it.name })').evaluate();

            expect(value).toEqual([{ label: 'a' }, { label: 'a' }]);
            expect(metadata.sources).toEqual([{ kind: 'data', value: { name: 'a' } }, { kind: 'data', value: { name: 'a' } }]);
            expect(metadata.provenance).toEqual(references([parts[0], parts[0]]));
            expect(resolve('name.crowd.select(it.label)').evaluate().metadata).toMatchObject({ sources: references([parts[0], parts[1], parts[0]]), provenance: references([parts[0], parts[1], parts[0]]) });
        });

        it("realigns each item's lineage through every member answering its receiver's items, reordered, partitioned or taken once each", () => {
            const lineageOf = text => resolve(text).evaluate().metadata;
            const projected = 'name.crowd { name = it.label }';

            expect(lineageOf(`${projected}.reverse`).provenance).toEqual(references([parts[0], parts[1], parts[0]]));
            expect(lineageOf(`${projected}.reverse`).sources).toEqual(references([parts[0], parts[1], parts[0]]));
            expect(lineageOf('name.crowd { name = it.label } { label = it.name }.reverse').sources).toEqual([{ kind: 'data', value: { name: 'a' } }, { kind: 'data', value: { name: 'b' } }, { kind: 'data', value: { name: 'a' } }]);
            expect(lineageOf(`${projected}.drop(1)`).provenance).toEqual(references([parts[1], parts[0]]));
            expect(lineageOf(`${projected}.takeWhile(it.name == "a")`).provenance).toEqual(references([parts[0]]));
            expect(lineageOf(`${projected}.distinctBy(it.name)`).provenance).toEqual(references([parts[0], parts[1]]));
            expect(lineageOf(`${projected}.concat(${projected})`).provenance).toBeUndefined();
        });

        it("carries each occurrence's own lineage by its position, never an equal item's, so inputs projected to equal values keep their own references through a partition and a reordering", () => {
            // The twins are equal as objects, so each entry is told by the identity of the reference it names, the twin at that index.
            const twinsOf = entries => entries.map(entry => (entry.kind === 'reference' ? twins.indexOf(entry.value) : entry));
            const labels = values => values.map(value => ({ kind: 'data', value }));

            expect(metadataOf('name.twins.select(it.label).drop(1).select(it)').sources).toEqual(labels(['a', 'b']));
            expect(twinsOf(metadataOf('name.twins.select(it.label).drop(1).select(it)').provenance)).toEqual([1, 2]);
            expect(metadataOf('name.twins.select(it.label).reverse.select(it)').sources).toEqual(labels(['b', 'a', 'a']));
            expect(twinsOf(metadataOf('name.twins.select(it.label).reverse.select(it)').provenance)).toEqual([2, 1, 0]);
            expect(twinsOf(metadataOf('name.twins.select(it.label).orderByDescending(it).select(it)').provenance)).toEqual([2, 0, 1]);
            expect(twinsOf(metadataOf('name.twins.select(it.label).distinct.select(it)').provenance)).toEqual([0, 2]);
            expect(metadataOf('name.twins.select(it.label).where(it == "c").select(it)')).toMatchObject({ sources: [], provenance: [] });
            // An object projection's reversal, of a sequence that is no palindrome, and a list of lists, whose answer its capture maps to another list.
            expect([twinsOf(metadataOf('name.twins { n = it.label }.reverse').sources), twinsOf(metadataOf('name.twins { n = it.label }.reverse').provenance)]).toEqual([[2, 1, 0], [2, 1, 0]]);
            expect(twinsOf(metadataOf('name.twins.select([it.label]).reverse.select(it)').provenance)).toEqual([2, 1, 0]);
        });

        it("describes a filter or a reordering of a selection's answer by its own origin and tolerance, with the sources and provenance of the occurrences it kept, though no item has a record", () => {
            const twinsOf = entries => entries.map(entry => twins.indexOf(entry.value));
            const { objectFields } = metadataOf('{ selected = name.twins.select(it.label), kept = name.twins.select(it.label).where(it == "a"), reversed = name.twins.select(it.label).reverse, none = name.twins.select(it.label).where(false) }');

            expect(objectFields.kept).toEqual({ origin: expect.any(Object), tolerance: null, sources: twins.slice(0, 2).map(twin => ({ kind: 'reference', value: twin })), provenance: expect.any(Array) });
            expect([twinsOf(objectFields.kept.sources), twinsOf(objectFields.kept.provenance)]).toEqual([[0, 1], [0, 1]]);
            expect([twinsOf(objectFields.reversed.sources), twinsOf(objectFields.reversed.provenance)]).toEqual([[2, 1, 0], [2, 1, 0]]);
            expect(objectFields.none).toMatchObject({ sources: [], provenance: [] });
            expect(new Set([objectFields.selected.origin, objectFields.kept.origin, objectFields.reversed.origin]).size).toBe(3);
            // A projection after the filter records its actual immediate sources, the labels, and keeps the original references as its provenance.
            const projected = metadataOf('name.twins.select(it.label).drop(1) { n = it }');

            expect(projected.sources).toEqual([{ kind: 'data', value: 'a' }, { kind: 'data', value: 'b' }]);
            expect(twinsOf(projected.provenance)).toEqual([1, 2]);
        });

        it("carries each occurrence's lineage through a slice and through pick, a position picked twice carrying its occurrence's twice", () => {
            const twinsOf = entries => entries.map(entry => twins.indexOf(entry.value));
            const lineageOf = text => {
                const { items, sources, provenance } = metadataOf(text);

                return { items: items?.length, sources: sources === undefined ? undefined : twinsOf(sources), provenance: twinsOf(provenance) };
            };

            expect(lineageOf('name.twins { id = it.label }[1..]')).toEqual({ items: 2, sources: [1, 2], provenance: [1, 2] });
            expect(lineageOf('name.twins { id = it.label }[^2..^0]')).toEqual({ items: 2, sources: [1, 2], provenance: [1, 2] });
            expect(lineageOf('name.twins { id = it.label }[0..0]')).toEqual({ items: 0, sources: [], provenance: [] });
            expect(lineageOf('name.twins { id = it.label }.pick([1, 0, 1])')).toEqual({ items: 3, sources: [1, 0, 1], provenance: [1, 0, 1] });
            expect(lineageOf('name.twins.select(it.label).pick([2, 2])')).toEqual({ items: undefined, sources: [2, 2], provenance: [2, 2] });
            expect(lineageOf('name.twins.select(it.label)[1..].select(it)')).toMatchObject({ provenance: [1, 2] });
            expect(lineageOf('name.twins.select(it.label).pick([1, 1]).select(it)')).toMatchObject({ provenance: [1, 1] });
        });

        it("realigns each item's lineage through an ordering and its refinement, and records nothing of the keys that ordered it", () => {
            const lineageOf = text => resolve(text).evaluate().metadata;
            const projected = 'name.crowd { name = it.label }';

            expect(lineageOf(`${projected}.orderByDescending(it.name)`).provenance).toEqual(references([parts[1], parts[0], parts[0]]));
            expect(lineageOf(`${projected}.orderBy(it.name).thenByDescending(it.name)`).sources).toEqual(references([parts[0], parts[0], parts[1]]));
            expect(Object.keys(lineageOf(`${projected}.orderBy(it.name)`))).not.toContain('ordering');
        });

        it('carries a null source as a recorded provenance entry, apart from absent provenance, data provenance as its frozen copy', () => {
            const { metadata } = resolve('name.sizes { width = it.width } { w = it.width }').evaluate();

            expect(metadata.sources).toEqual([{ kind: 'data', value: { width: 1 } }, { kind: 'null' }]);
            expect(metadata.provenance).toEqual([{ kind: 'data', value: { width: 1, height: 2 } }, { kind: 'null' }]);
            expect(Object.isFrozen(metadata.provenance[0].value)).toBe(true);
            expect(Object.hasOwn(resolve('items', { items: [1, 2] }).evaluate().metadata, 'provenance')).toBe(false);
            expect(resolve('items { n = it }', { items: [] }).evaluate().metadata.provenance).toEqual([]);
        });

        it('follows a projected list through a local and into an object field', () => {
            expect(metadataOf('let named = name.crowd { name = it.label }\nreturn named { label = it.name }').provenance).toEqual(references([parts[0], parts[1], parts[0]]));
            expect(metadataOf('{ rows = name.crowd { n = it.label } { m = it.n } }').objectFields.rows.provenance).toEqual(references([parts[0], parts[1], parts[0]]));
        });

        it("realigns a filter's kept items' sources and provenance in its order, so a projection after it keeps the first projection's references", () => {
            const filtered = metadataOf('name.crowd { name = it.label }.where(it.name == "a")');

            expect(filtered.sources).toEqual(references([parts[0], parts[0]]));
            expect(filtered.provenance).toEqual(references([parts[0], parts[0]]));
            expect(filtered.items).toHaveLength(2);
            expect(metadataOf('name.crowd { name = it.label }.where(it.name == "b") { label = it.name }').provenance).toEqual(references([parts[1]]));

            const unprojected = metadataOf('items.where(it > 1)', { items: [1, 2, 3] });

            expect([Object.hasOwn(unprojected, 'sources'), Object.hasOwn(unprojected, 'provenance')]).toEqual([false, false]);
        });
    });
});
