import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

describe('Vocabulary', () => {
    const registry = new LexicaRegistry([Vocabulary.module]);
    const { module } = Vocabulary;
    const list = Vocabulary.getTypeDeclaration('List');
    const [verbs] = module.types;

    /** What the implementation of a list's member or a verb answers for its receiver and its arguments. */
    const read = (name, receiver, args = {}) => [...list.members, ...verbs.members].find(member => member.name === name).impl({ receiver, args, env: {} });

    /** How the registry writes each receiver the member is read on, and the member, as a message names it. */
    const writtenOf = member => `${registry.getReceiverTypes(member).join(' or ')}${member.name === undefined ? '[]' : `.${member.name}`}`;

    /** The conversion operators of Lexica's own scalar types, each standing in the type it converts from. */
    const conversions = Vocabulary.valueTypes.filter(type => type.kind === 'scalar').flatMap(type => type.members);

    /** What the implementation of a conversion gives the value, or the reason it rejects it. */
    const convert = (from, to, value) => {
        try {
            return conversions.find(operator => registry.formatOperator(operator) === `${from} to ${to}`).impl({ value, reject: reason => { throw new Error(reason); } });
        } catch (error) {
            return `rejected: ${error.message}`;
        }
    };

    it('is Lexica\'s own module, one module of its own name, each of its members and operators carrying its implementation', () => {
        expect(module.name).toBe('Lexica');
        expect(module).toBe(Vocabulary.module);
        expect(conversions.every(operator => operator.kind === 'operator' && operator.name === 'convert' && typeof operator.impl === 'function')).toBe(true);
        expect([...list.members, ...verbs.members].every(member => typeof member.impl === 'function')).toBe(true);
    });

    it('owns the language\'s value types, declared through its internal form: the scalars, and List<T>, covariant in its items, whose names are the ones written unqualified', () => {
        expect(Vocabulary.valueTypes.map(({ name, kind }) => `${kind} ${name}`)).toEqual(['scalar Number', 'scalar String', 'scalar Boolean', 'generic List']);
        expect(list).toMatchObject({ typeParameters: ['T'], variances: ['covariant'] });
        expect(Vocabulary.builtInTypeNames).toEqual(['Number', 'String', 'Boolean', 'List']);
        expect(Vocabulary.ownTypeNames).toEqual(['Number', 'String', 'Boolean', 'List', 'Any', 'Never']);
        expect(Object.isFrozen(Vocabulary.ownTypeNames)).toBe(true);
        expect([Vocabulary.getTypeDeclaration('Any'), Vocabulary.getTypeDeclaration('VerbExtensions')]).toEqual([undefined, undefined]);
        expect(Object.isFrozen(list) && Object.isFrozen(list.members[0])).toBe(true);
    });

    it('answers its own value types\' declarations through the registry\'s one lookup, whatever a type\'s arguments and nullability, and none for an extension', () => {
        expect(registry.getTypeDeclaration(Type.createListType(Type.createNamedType('Number'), true))).toBe(list);
        expect(registry.getTypeDeclaration(Type.createNamedType('String', true))).toBe(Vocabulary.getTypeDeclaration('String'));
        expect(registry.getTypeDeclaration(Type.createNamedType('VerbExtensions', false, 'Lexica'))).toBeUndefined();
    });

    it('declares the members of lists, the verbs that test a receiver, and the conversion operators of strings, numbers and Booleans, and nothing of any domain', () => {
        // The unnamed indexer has no name, and is written as its access is, brackets after the list; the members of lists read the list's T, and the verbs their extension's, the receiver's own type.
        expect(list.members.map(writtenOf)).toEqual(['List<T>.count', 'List<T>.first', 'List<T>.last', 'List<T>[]', 'List<T>.max', 'List<T>.min', 'List<T>.sum', 'List<T>.where']);
        expect(verbs).toMatchObject({ name: 'VerbExtensions', kind: 'extension', typeParameters: ['T'], target: 'T' });
        expect(verbs.members.map(writtenOf)).toEqual(['T.is', 'T.has', 'T.supports']);
        expect(conversions.map(operator => registry.formatOperator(operator))).toEqual(['Number to String', 'String to Number', 'String to Boolean', 'Boolean to String']);
        expect([module.types.length, module.members]).toEqual([1, []]);
        expect(module.observationTypes).toEqual([]);
        expect([module.typeSelectors, module.mappings]).toEqual([[], []]);
    });

    it.each(['is', 'has', 'supports'])('declares %s as the one function of any receiver, answering what its test, a function of the receiver\'s own type, answers of it', verb => {
        const [declaration] = registry.getReceiverMembers(verb);

        expect(registry.getReceiverMembers(verb)).toHaveLength(1);
        expect(declaration).toBe(verbs.members.find(member => member.name === verb));
        expect(declaration).toMatchObject({ kind: 'function', result: 'Boolean', updates: { changes: 'derived', reads: 'derived' } });
        expect(declaration.parameters).toEqual([{ name: 'test', kind: 'function', type: 'Boolean', parameterTypes: ['T'], required: true }]);
        expect([read(verb, 'oat', { test: receiver => receiver === 'oat' }), read(verb, 'milk', { test: receiver => receiver === 'oat' })]).toEqual([true, false]);
    });

    it('reads a list\'s count, its first and last item, and, through its unnamed indexer, the item at a whole index from zero, null where there is none', () => {
        const [unnamedIndexer] = registry.getUnnamedIndexers();

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
