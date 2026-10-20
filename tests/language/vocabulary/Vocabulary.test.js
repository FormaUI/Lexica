import { describe, it, expect } from 'vitest';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

describe('Vocabulary', () => {
    const registry = new LexicaRegistry([Vocabulary.module]);
    const { functions } = Vocabulary;

    /** What the function of a conversion gives the value, or the reason it rejects it. */
    const convert = (name, value) => {
        try {
            return functions[name](value, { reject: reason => { throw new Error(reason); } });
        } catch (error) {
            return `rejected: ${error.message}`;
        }
    };

    it('is Lexica\'s own module, one module of its own name carrying its functions', () => {
        expect(Vocabulary.module.name).toBe('lexica');
        expect(Vocabulary.module).toBe(Vocabulary.module);
        expect(Vocabulary.module.functions).not.toBeNull();
    });

    it('declares the members of lists, the verbs that ask a condition, and the conversions between strings, numbers and Booleans, and nothing of any domain', () => {
        expect(Vocabulary.module.members.map(member => `${member.on}.${member.name}`)).toEqual([
            'list<T>.count', 'list<T>.first', 'list<T>.last', 'list<T>.item', 'any.is', 'any.has', 'any.supports', 'list<T>.max', 'list<T>.min', 'list<T>.sum', 'list<T>.where',
        ]);
        expect(Vocabulary.module.conversions.map(conversion => `${conversion.from} to ${conversion.to}`)).toEqual(['string to number', 'number to string', 'boolean to string', 'string to boolean']);
        expect(Vocabulary.module.types).toEqual([]);
        expect(Vocabulary.module.conditions).toEqual([]);
        expect(Vocabulary.module.observationTypes).toEqual([]);
        expect(Vocabulary.module.eventTypes).toEqual([]);
    });

    it.each(['is', 'has', 'supports'])('declares %s as the one call that asks a condition of its verb, of any receiver, carried out by the condition it selects', verb => {
        const [declaration] = registry.getMembers(verb);

        expect(registry.getMembers(verb)).toHaveLength(1);
        expect(declaration).toMatchObject({ kind: 'function', form: 'call', on: 'any', result: 'boolean', changes: 'derived', reads: 'derived' });
        expect(declaration.parameters[0]).toMatchObject({ name: 'name', type: 'string', fixed: true, selects: 'condition' });
    });

    it('reads a list\'s count, its first and last item, and the item at a whole index from zero, null where there is none', () => {
        expect(functions.count([1, 2, 3])).toBe(3);
        expect([functions.first([1, 2]), functions.last([1, 2]), functions.first([])]).toEqual([1, 2, null]);
        expect([0, 2, -1, 1.5].map(index => functions.item(['a', 'b'], { index }))).toEqual(['a', null, null, null]);
    });

    it('gives the greatest, the least and the sum of the numbers an expression gives the items, skipping the items it gives null, and keeps the items a predicate holds for', () => {
        const expression = item => item;

        expect(functions.max([1, null, 3], { expression })).toBe(3);
        expect(functions.min([1, null, 3], { expression })).toBe(1);
        expect(functions.max([null], { expression })).toBeNull();
        expect(functions.sum([1, null, 3], { expression })).toBe(4);
        expect(functions.sum([], { expression })).toBe(0);
        expect(functions.where([1, 2, 3], { expression: item => item > 1 })).toEqual([2, 3]);
    });

    it('converts text to a number as HTML\'s valid floating-point number, and between Booleans and text, rejecting a text that is neither', () => {
        expect([' 12 ', '-3.5', '.5', '1e3'].map(text => convert('stringToNumber', text))).toEqual([12, -3.5, 0.5, 1000]);
        expect(convert('stringToNumber', '12px')).toContain('rejected: "12px" is no number');
        expect(convert('stringToNumber', '1e999')).toContain('is too large a number to be finite');
        expect([convert('numberToString', -0), convert('booleanToString', true)]).toEqual(['0', 'true']);
        expect([convert('stringToBoolean', 'true'), convert('stringToBoolean', 'false')]).toEqual([true, false]);
        expect(convert('stringToBoolean', 'yes')).toContain('rejected: "yes" is no Boolean');
    });
});
