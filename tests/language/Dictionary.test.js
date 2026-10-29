import { describe, it, expect } from 'vitest';
import { Dictionary } from '#nexo/language/Dictionary.mjs';
import { Pair } from '#nexo/language/Pair.mjs';
import { Type } from '#nexo/language/Type.mjs';

describe('Dictionary', () => {
    it('keeps its entries in their order, each key once by Nexo\'s key equality, frozen', () => {
        const reference = {};
        const dictionary = new Dictionary([['b', 2], ['a', 1], [0, 'zero'], [null, 'none'], [reference, 'it']]);

        expect(dictionary.keys).toEqual(['b', 'a', 0, null, reference]);
        expect(dictionary.values).toEqual([2, 1, 'zero', 'none', 'it']);
        expect([dictionary.get(-0), dictionary.get(null), dictionary.get(reference), dictionary.get({})]).toEqual(['zero', 'none', 'it', null]);
        expect(dictionary.count).toBe(5);
        expect(Object.isFrozen(dictionary) && Object.isFrozen(dictionary.keys) && Object.isFrozen(dictionary.entries)).toBe(true);
    });

    it('tells an absent key from a key whose value is null, and answers each entry as a pair', () => {
        const dictionary = new Dictionary([['tea', null]]);

        expect([dictionary.get('tea'), dictionary.get('milk'), dictionary.has('tea'), dictionary.has('milk')]).toEqual([null, null, true, false]);
        expect(dictionary.getEntry('tea')).toEqual(new Pair('tea', null));
        expect(dictionary.getEntry('milk')).toBeNull();
        expect(dictionary.entries).toEqual([new Pair('tea', null)]);
    });
});

describe('Pair', () => {
    it('holds a key and its value, frozen', () => {
        const pair = new Pair('tea', 2);

        expect([pair.key, pair.value, Object.isFrozen(pair)]).toEqual(['tea', 2, true]);
    });
});

describe('Type of collections', () => {
    it('reads Nexo\'s generic types by their arities, each argument after a comma and a space, and refuses any other count or name', () => {
        expect(String(Type.parse('Dictionary<String, List<Number?>>?'))).toBe('Dictionary<String, List<Number?>>?');
        expect(Type.parse('Pair<K, V>').isPair).toBe(true);
        expect(Type.parse('Dictionary<String, Number>').isDictionary).toBe(true);
        expect([Type.parse('Dictionary<String>'), Type.parse('Dictionary<String,Number>'), Type.parse('List<A, B>'), Type.parse('Dictionary'), Type.parse('Box<T>')]).toEqual([null, null, null, null, null]);
        expect(String(Type.createDictionaryType(Type.never, Type.never))).toBe('Dictionary<Never, Never>');
        expect(String(Type.createPairType(Type.createNamedType('Number'), Type.null, true))).toBe('Pair<Number, null>?');
    });
});
