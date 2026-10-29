import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';

const registry = lexica.createRegistry();
const evaluate = (text, values = {}) => registry.resolve(text, values).createEvaluator(values).evaluate().value;

describe("a string's members", () => {
    it('counts its code units, a character outside the basic plane two', () => {
        expect(evaluate('[word.length, "".length, smile.length]', { word: 'oat', smile: '\u{1F600}' })).toEqual([3, 0, 2]);
    });

    it('trims the whitespace at either end alone, a no-break space and a line separator among it', () => {
        expect(evaluate('text.trim', { text: '\t  a b  \n' })).toBe('a b');
    });

    it('changes case without a locale, its length changing where a mapping does', () => {
        expect(evaluate('[word.lowercase, word.uppercase, "ß".uppercase]', { word: 'Istanbul' })).toEqual(['istanbul', 'ISTANBUL', 'SS']);
    });

    it('tells whether it begins with, ends with or holds a text, exactly by code unit, the empty text at every position', () => {
        expect(evaluate('[w.startsWith("ca"), w.endsWith("dle"), w.contains("and"), w.contains("And"), w.startsWith(""), w.contains("")]', { w: 'candle' })).toEqual([true, true, true, false, true, true]);
    });

    it('answers where a text first stands, null where it stands nowhere and 0 for the empty text', () => {
        expect(evaluate('[w.indexOf("a"), w.indexOf("z"), w.indexOf("")]', { w: 'banana' })).toEqual([1, null, 0]);
    });

    it('replaces every occurrence literally, left to right and none overlapping, and splits at a separator, an empty part where two meet or one stands at an end', () => {
        expect(evaluate('[w.replace("aa", "b"), w.replace(".", "!")]', { w: 'aaa.' })).toEqual(['ba.', 'aaa!']);
        expect(evaluate('[w.split(","), "none".split(",")]', { w: ',a,,b,' })).toEqual([['', 'a', '', 'b', ''], ['none']]);
    });

    it('refuses the empty text to replace or to split at, where it is evaluated', () => {
        expect(errorThrownBy(() => evaluate('"ab".replace("", "-")'))).toMatchObject({ code: 'LEXICA5040', message: expect.stringContaining("'replace' is given the empty text") });
        expect(errorThrownBy(() => evaluate('"ab".split("")'))).toMatchObject({ code: 'LEXICA5040', message: expect.stringContaining('no occurrence to split at') });
    });

    it('slices by a range as strictly as a list, never parting a surrogate pair', () => {
        expect(evaluate('[w[1..3], w[^3..], w[..], w[2..2]]', { w: 'candle' })).toEqual(['an', 'dle', 'candle', '']);
        expect(evaluate('s[0..2]', { s: '\u{1F600}!' })).toBe('\u{1F600}');
        expect(errorThrownBy(() => evaluate('w[4..9]', { w: 'oat' }))).toMatchObject({ code: 'LEXICA5033', message: expect.stringContaining('stands beyond the text') });
        expect(errorThrownBy(() => evaluate('s[1..]', { s: '\u{1F600}!' }))).toMatchObject({ code: 'LEXICA5041', message: expect.stringContaining('parts the surrogate pair at 1') });
    });
});
