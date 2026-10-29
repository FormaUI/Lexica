import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';

const registry = lexica.createRegistry();
const evaluate = (text, values = {}) => registry.resolve(text, values).createEvaluator(values).evaluate().value;

describe("a number's members", () => {
    it('rounds a half away from zero, so a number and its negation round to a number and its negation', () => {
        expect(evaluate('[2.5.round, (-2.5).round, 2.4.round, (-2.6).round, 0.5.round, (-0.5).round]')).toEqual([3, -3, 2, -3, 1, -1]);
        expect(evaluate('(-x).round == -(x.round)', { x: 7.5 })).toBe(true);
    });

    it('takes the floor, the ceiling and the truncation, and the absolute value', () => {
        expect(evaluate('[(-1.5).floor, (-1.5).ceiling, (-1.5).truncate, 1.5.truncate, (-3).abs, 3.abs]')).toEqual([-2, -1, -1, 1, 3, 3]);
    });

    it('answers 0 where it would answer -0', () => {
        const values = evaluate('[(-0.4).round, (-0.5).ceiling, (-0.5).truncate, n.abs, n.min(0), n.max(0), n.clamp(0, 1)]', { n: -0 });

        expect(values.map(value => Object.is(value, -0))).toEqual(values.map(() => false));
    });

    it('takes the lesser and the greater of two, and clamps within a low and a high, inclusive', () => {
        expect(evaluate('[3.min(5), 3.max(5), 7.clamp(0, 5), (-2).clamp(0, 5), 3.clamp(3, 3)]')).toEqual([3, 5, 5, 0, 3]);
    });

    it('refuses a clamp whose low stands above its high, where it is evaluated', () => {
        expect(errorThrownBy(() => evaluate('3.clamp(5, 0)'))).toMatchObject({ code: 'LEXICA5039', location: { pointer: '/expression' }, message: expect.stringContaining("'clamp' takes a low no greater than its high, and is given 5 and 0") });
    });

    it('reads a member of a number after a group, a step written by arithmetic around it', () => {
        expect(evaluate('(x * 2).round / 2', { x: 1.26 })).toBe(1.5);
    });
});
