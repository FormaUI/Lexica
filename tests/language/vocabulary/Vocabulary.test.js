import { describe, it, expect } from 'vitest';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

describe('Vocabulary', () => {
    const registry = new LexicaRegistry([Vocabulary.module]);
    const { module } = Vocabulary;

    /** What the implementation of a member answers for its receiver and its arguments. */
    const read = (name, receiver, args = {}) => module.members.find(member => member.name === name).implementation({ receiver, args, env: {} });

    /** What the implementation of a conversion gives the value, or the reason it rejects it. */
    const convert = (from, to, value) => {
        try {
            return module.conversions.find(conversion => conversion.from === from && conversion.to === to).implementation({ value, reject: reason => { throw new Error(reason); } });
        } catch (error) {
            return `rejected: ${error.message}`;
        }
    };

    it('is Lexica\'s own module, one module of its own name, each of its members and conversions carrying its implementation', () => {
        expect(module.name).toBe('lexica');
        expect(module).toBe(Vocabulary.module);
        expect(module.conversions.every(conversion => typeof conversion.implementation === 'function')).toBe(true);
        expect(module.members.every(member => typeof member.implementation === 'function')).toBe(true);
    });

    it('declares the members of lists, the verbs that test a receiver, and the conversions between strings, numbers and Booleans, and nothing of any domain', () => {
        expect(module.members.map(member => `${member.target}.${member.name}`)).toEqual([
            'list<T>.count', 'list<T>.first', 'list<T>.last', 'list<T>.item', 'T.is', 'T.has', 'T.supports', 'list<T>.max', 'list<T>.min', 'list<T>.sum', 'list<T>.where',
        ]);
        expect(module.conversions.map(conversion => `${conversion.from} to ${conversion.to}`)).toEqual(['string to number', 'number to string', 'boolean to string', 'string to boolean']);
        expect(module.types).toEqual([]);
        expect(module.observationTypes).toEqual([]);
        expect([module.typeSelectors, module.selectableTypes]).toEqual([[], []]);
    });

    it.each(['is', 'has', 'supports'])('declares %s as the one function of any receiver, answering what its test, a function of the receiver\'s own type, answers of it', verb => {
        const [declaration] = registry.getMembers(verb);

        expect(registry.getMembers(verb)).toHaveLength(1);
        expect(declaration).toMatchObject({ kind: 'function', syntax: 'function-call', target: 'T', result: 'boolean', updates: { changes: 'derived', reads: 'derived' } });
        expect(declaration.parameters).toEqual([{ name: 'test', kind: 'function', type: 'boolean', parameters: ['T'], required: true }]);
        expect([read(verb, 'oat', { test: receiver => receiver === 'oat' }), read(verb, 'milk', { test: receiver => receiver === 'oat' })]).toEqual([true, false]);
    });

    it('reads a list\'s count, its first and last item, and the item at a whole index from zero, null where there is none', () => {
        expect(read('count', [1, 2, 3])).toBe(3);
        expect([read('first', [1, 2]), read('last', [1, 2]), read('first', [])]).toEqual([1, 2, null]);
        expect([0, 2, -1, 1.5].map(index => read('item', ['a', 'b'], { index }))).toEqual(['a', null, null, null]);
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
        expect([' 12 ', '-3.5', '.5', '1e3'].map(text => convert('string', 'number', text))).toEqual([12, -3.5, 0.5, 1000]);
        expect(convert('string', 'number', '12px')).toContain('rejected: "12px" is no number');
        expect(convert('string', 'number', '1e999')).toContain('is too large a number to be finite');
        expect([convert('number', 'string', -0), convert('boolean', 'string', true)]).toEqual(['0', 'true']);
        expect([convert('string', 'boolean', 'true'), convert('string', 'boolean', 'false')]).toEqual([true, false]);
        expect(convert('string', 'boolean', 'yes')).toContain('rejected: "yes" is no Boolean');
    });
});
