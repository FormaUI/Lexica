import { describe, it, expect } from 'vitest';
import { Range } from '#lexica/language/Range.mjs';
import { Type } from '#lexica/language/Type.mjs';
import { ItemPositions } from '#lexica/language/vocabulary/ItemPositions.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

describe('Vocabulary', () => {
    const registry = new LexicaRegistry([Vocabulary.module]);
    const { module } = Vocabulary;
    const list = Vocabulary.getTypeDeclaration('List');
    const [nestedLists] = module.types;

    /** What the implementation of a list's member answers for its receiver and its arguments. */
    const read = (name, receiver, args = {}) => list.members.find(member => member.name === name).impl({ receiver, args, env: {} });

    /** How the registry writes each receiver the member is read on, and the member, as a message names it. */
    const writtenOf = member => `${registry.getReceiverTypes(member).join(' or ')}${member.name === undefined ? '[]' : `.${member.name}`}`;

    /** The conversion operators of Nexo's own scalar types, each standing in the type it converts from. */
    const conversions = Vocabulary.valueTypes.filter(type => type.kind === 'scalar').flatMap(type => type.members).filter(member => member.kind === 'operator');

    /** What the implementation of a conversion gives the value, or the reason it rejects it. */
    const convert = (from, to, value) => {
        try {
            return conversions.find(operator => registry.formatOperator(operator) === `${from} to ${to}`).impl({ value, reject: reason => { throw new Error(reason); } });
        } catch (error) {
            return `rejected: ${error.message}`;
        }
    };

    it('is Nexo\'s own module, one module of its own name, each of its members and operators carrying its implementation', () => {
        expect(module.name).toBe('Nexo');
        expect(module).toBe(Vocabulary.module);
        expect(conversions.every(operator => operator.kind === 'operator' && operator.name === 'convert' && typeof operator.impl === 'function')).toBe(true);
        expect([...list.members, ...nestedLists.members].every(member => typeof member.impl === 'function')).toBe(true);
    });

    it('owns the language\'s value types, declared through its internal form: the scalars, List<T>, covariant in its items, Dictionary<K, V>, invariant in its keys, and Pair<K, V>, whose names are the ones written unqualified', () => {
        expect(Vocabulary.valueTypes.map(({ name, kind }) => `${kind} ${name}`)).toEqual(['scalar Number', 'scalar String', 'scalar Boolean', 'generic List', 'generic Dictionary', 'position Index', 'position Range', 'generic Pair']);
        expect(list).toMatchObject({ typeParameters: ['T'], variances: ['covariant'] });
        expect(Vocabulary.getTypeDeclaration('Dictionary')).toMatchObject({ typeParameters: ['K', 'V'], variances: ['invariant', 'covariant'] });
        expect(Vocabulary.getTypeDeclaration('Pair')).toMatchObject({ typeParameters: ['K', 'V'], variances: ['covariant', 'covariant'] });
        expect(Vocabulary.builtInTypeNames).toEqual(['Number', 'String', 'Boolean', 'List', 'Dictionary', 'Index', 'Range', 'Pair']);
        expect(Vocabulary.ownTypeNames).toEqual(['Number', 'String', 'Boolean', 'List', 'Dictionary', 'Index', 'Range', 'Pair', 'Any', 'Never']);
        // Type reads each generic type's arguments by a table of its own, which these declarations' parameters keep.
        expect(Object.fromEntries(Vocabulary.valueTypes.filter(type => type.kind === 'generic').map(type => [type.name, type.typeParameters.length]))).toEqual(Type.genericTypeArities);
        expect(Object.isFrozen(Vocabulary.ownTypeNames)).toBe(true);
        expect([Vocabulary.getTypeDeclaration('Any'), Vocabulary.getTypeDeclaration('NestedListExtensions')]).toEqual([undefined, undefined]);
        expect(Object.isFrozen(list) && Object.isFrozen(list.members[0])).toBe(true);
    });

    it('answers its own value types\' declarations through the registry\'s one lookup, whatever a type\'s arguments and nullability, and none for an extension', () => {
        expect(registry.getTypeDeclaration(Type.createListType(Type.createNamedType('Number'), true))).toBe(list);
        expect(registry.getTypeDeclaration(Type.createNamedType('String', true))).toBe(Vocabulary.getTypeDeclaration('String'));
        expect(registry.getTypeDeclaration(Type.createNamedType('NestedListExtensions', false, 'Nexo'))).toBeUndefined();
    });

    it('declares the members of lists and the conversion operators of strings, numbers and Booleans, and nothing of any domain, a test of any receiver among it', () => {
        // The unnamed indexer has no name, and is written as its access is, brackets after the list; the members of lists read the list's T.
        expect(list.members.map(writtenOf)).toEqual([
            'List<T>.count', 'List<T>.first', 'List<T>.last', 'List<T>[]', 'List<T>[]', 'List<T>[]', 'List<T>.max', 'List<T>.min', 'List<T>.sum', 'List<T>.where', 'List<T>.select', 'List<T>.selectMany', 'List<T>.concat', 'List<T>.take', 'List<T>.drop',
            'List<T>.takeWhile', 'List<T>.dropWhile', 'List<T>.any', 'List<T>.all', 'List<T>.contains', 'List<T>.indexOf', 'List<T>.indexWhere', 'List<T>.single', 'List<T>.average', 'List<T>.minBy', 'List<T>.maxBy', 'List<T>.orderBy', 'List<T>.orderByDescending', 'List<T>.thenBy', 'List<T>.thenByDescending', 'List<T>.distinct', 'List<T>.distinctBy',
            'List<T>.reverse', 'List<T>.toDictionary', 'List<T>.groupBy', 'List<T>.entry', 'List<T>.entry', 'List<T>.pick',
        ]);
        expect(Vocabulary.getTypeDeclaration('Dictionary').members.map(writtenOf)).toEqual(['Dictionary<K, V>.count', 'Dictionary<K, V>[]', 'Dictionary<K, V>.entry', 'Dictionary<K, V>.containsKey', 'Dictionary<K, V>.keys', 'Dictionary<K, V>.values', 'Dictionary<K, V>.entries', 'Dictionary<K, V>.where', 'Dictionary<K, V>.select']);
        // A list of lists alone flattens, through an extension of Nexo's own value type its own declaration's receiver is too wide for.
        expect(nestedLists).toMatchObject({ name: 'NestedListExtensions', kind: 'extension', typeParameters: ['T'], target: 'List<List<T>>' });
        expect(nestedLists.members.map(writtenOf)).toEqual(['List<List<T>>.flatten']);
        expect(Vocabulary.getTypeDeclaration('Pair').members.map(writtenOf)).toEqual(['Pair<K, V>.key', 'Pair<K, V>.value']);
        // A dictionary's key parameter consumes null, which reads the null key or an absent one.
        expect(Vocabulary.getTypeDeclaration('Dictionary').members[1].parameters[0]).toMatchObject({ name: 'key', type: 'K?', nulls: 'accept' });
        // The members answering their receiver's items keep each item's lineage, the unnamed indexer's signature taking a range among them, and select records each item as its source, as a projection does.
        const keeping = ['[Range]', 'where', 'take', 'drop', 'takeWhile', 'dropWhile', 'orderBy', 'orderByDescending', 'thenBy', 'thenByDescending', 'distinct', 'distinctBy', 'reverse', 'pick'];

        expect(list.members.filter(member => Vocabulary.answersReceiverItems(member)).map(member => member.name ?? `[${member.parameters[0].type}]`)).toEqual(keeping);
        expect(list.members.filter(member => Vocabulary.projectsItems(member)).map(member => member.name)).toEqual(['select']);
        expect(conversions.map(operator => registry.formatOperator(operator))).toEqual(['Number to String', 'String to Number', 'String to Boolean', 'Boolean to String']);
        expect([module.types.length, module.members, registry.getReceiverMembers('is')]).toEqual([1, [], []]);
        expect(module.observationTypes).toEqual([]);
        expect([module.typeSelectors, module.mappings]).toEqual([[], []]);
    });

    it("answers each member keeping its receiver's items with the position each stood at, so an item keeps its own occurrence apart from an equal one", () => {
        const receiver = ['a', 'a', 'b'];
        const isA = item => item === 'a';
        const itself = item => item;
        const positionsOf = (name, args, on = receiver) => ItemPositions.getPositions(read(name, on, args));

        expect({
            where: positionsOf('where', { expression: isA }),
            take: positionsOf('take', { count: 2 }),
            drop: positionsOf('drop', { count: 1 }),
            takeWhile: positionsOf('takeWhile', { expression: isA }),
            dropWhile: positionsOf('dropWhile', { expression: isA }),
            distinct: positionsOf('distinct'),
            distinctBy: positionsOf('distinctBy', { expression: isA }),
            reverse: positionsOf('reverse'),
            orderBy: positionsOf('orderBy', { expression: itself }),
            orderByDescending: positionsOf('orderByDescending', { expression: itself }),
            thenBy: positionsOf('thenBy', { expression: itself }, read('orderBy', receiver, { expression: () => 0 })),
            thenByDescending: positionsOf('thenByDescending', { expression: itself }, read('orderBy', receiver, { expression: () => 0 })),
            pick: positionsOf('pick', { positions: [1, 0, 1] }),
        }).toEqual({
            where: [0, 1], take: [0, 1], drop: [1, 2], takeWhile: [0, 1], dropWhile: [2], distinct: [0, 2], distinctBy: [0, 2], reverse: [2, 1, 0],
            orderBy: [0, 1, 2], orderByDescending: [2, 0, 1], thenBy: [0, 1, 2], thenByDescending: [2, 0, 1], pick: [1, 0, 1],
        });

        const slice = list.members.find(member => member.kind === 'indexer' && member.parameters[0].type === 'Range');

        expect(ItemPositions.getPositions(slice.impl({ receiver, args: { range: new Range(1, null) }, env: {} }))).toEqual([1, 2]);
    });

    it('declares the members of a number and of a string, a string\'s slice its unnamed indexer, and none of a Boolean', () => {
        const ownMembers = name => Vocabulary.getTypeDeclaration(name).members.filter(member => member.kind !== 'operator').map(member => member.name ?? '[]');

        expect(ownMembers('Number')).toEqual(['round', 'floor', 'ceiling', 'truncate', 'abs', 'min', 'max', 'clamp', 'sequence']);
        expect(ownMembers('String')).toEqual(['length', 'trim', 'lowercase', 'uppercase', 'startsWith', 'endsWith', 'contains', 'indexOf', 'replace', 'split', '[]']);
        expect(ownMembers('Boolean')).toEqual([]);
        expect(Vocabulary.getTypeDeclaration('String').members.at(-1)).toMatchObject({ kind: 'indexer', result: 'String', parameters: [{ name: 'range', type: 'Range' }] });
    });

    it('reads a list\'s count, its first and last item, and, through its unnamed indexer, the item at a whole index from zero, null where there is none', () => {
        const unnamedIndexer = registry.getUnnamedIndexers().find(indexer => list.members.includes(indexer));

        expect(read('count', [1, 2, 3])).toBe(3);
        expect([read('first', [1, 2]), read('last', [1, 2]), read('first', [])]).toEqual([1, 2, null]);
        expect(unnamedIndexer).toBe(list.members[3]);
        expect(unnamedIndexer).toMatchObject({ kind: 'indexer', result: 'T?', parameters: [{ name: 'index', kind: 'value', type: 'Number' }] });
        expect([0, 2, -1, 1.5].map(index => unnamedIndexer.impl({ receiver: ['a', 'b'], args: { index }, env: {} }))).toEqual(['a', null, null, null]);
    });

    it('gives the greatest, the least and the sum of the numbers an expression gives the items, skipping the items it gives null, and keeps the items a predicate holds for', () => {
        const expression = item => item;

        expect(read('max', [1, null, 3], { expression })).toBe(3);
        expect(read('min', [1, null, 3], { expression })).toBe(1);
        expect(read('max', [null], { expression })).toBeNull();
        expect(read('sum', [1, null, 3], { expression })).toBe(4);
        expect(read('sum', [], { expression })).toBe(0);
        expect(read('where', [1, 2, 3], { expression: item => item > 1 })).toEqual([2, 3]);
    });

    it('converts text to a number as HTML\'s valid floating-point number, and between Booleans and text, rejecting a text that is neither', () => {
        expect([' 12 ', '-3.5', '.5', '1e3'].map(text => convert('String', 'Number', text))).toEqual([12, -3.5, 0.5, 1000]);
        expect(convert('String', 'Number', '12px')).toContain('rejected: "12px" is no number');
        expect(convert('String', 'Number', '1e999')).toContain('is too large a number to be finite');
        expect([convert('Number', 'String', -0), convert('Boolean', 'String', true)]).toEqual(['0', 'true']);
        expect([convert('String', 'Boolean', 'true'), convert('String', 'Boolean', 'false')]).toEqual([true, false]);
        expect(convert('String', 'Boolean', 'yes')).toContain('rejected: "yes" is no Boolean');
    });
});
