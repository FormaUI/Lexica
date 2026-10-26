import { describe, it, expect } from 'vitest';
import { DefinitionValidator } from '#lexica/language/DefinitionValidator.mjs';
import { DefinitionWriter } from '#lexica/language/DefinitionWriter.mjs';
import { Versions } from '#lexica/language/Versions.mjs';

const literal = value => ({ kind: 'literal', value });
const parameter = name => ({ kind: 'parameter', name });

/** The canonical expression a definition given directly holds, as validation answers it. */
const canonicalOf = expression => new DefinitionValidator().validate({ version: Versions.definition, expression }).expression;

describe('DefinitionWriter', () => {
    it.each([
        ['a local of its object expression', { kind: 'object', locals: [{ name: 'a', value: literal(1) }], fields: [{ name: 'b', value: parameter('a') }] }, '{ let a = 1, b = ~a }'],
        ['an object field before it', { kind: 'object', fields: [{ name: 'a', value: literal(1) }, { name: 'b', value: parameter('a') }] }, '{ a = 1, b = ~a }'],
        ['a local of its body', { kind: 'body', locals: [{ name: 'a', value: literal(1) }], result: parameter('a') }, 'let a = 1 return ~a'],
        ['a local its body declares later', { kind: 'body', locals: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }], result: literal(0) }, 'let b = ~a let a = 1 return 0'],
        ['a local its object expression declares later', { kind: 'object', locals: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }], fields: [{ name: 'c', value: literal(0) }] }, '{ let b = ~a, let a = 1, c = 0 }'],
        ['a function parameter', { kind: 'body', locals: [{ name: 'f', value: { kind: 'function', parameters: ['a'], body: parameter('a') } }], result: { kind: 'functionCall', name: 'f', arguments: [literal(1)] } }, 'let f = function(a) ~a end return f(1)'],
        ['a conditional binding, in its consequent alone', { kind: 'conditional', binding: { name: 'a', value: literal(1) }, consequent: parameter('a'), alternative: parameter('a') }, 'if let a = 1 then ~a else a end'],
        ['a conditional binding, in its own value', { kind: 'conditional', binding: { name: 'a', value: parameter('a') }, consequent: literal(1), alternative: literal(0) }, 'if let a = ~a then 1 else 0 end'],
    ])('writes a script parameter that %s hides with ~', (_, expression, text) => {
        expect(DefinitionWriter.quote(canonicalOf(expression))).toBe(text);
    });

    it('writes a script parameter alone where nothing in scope hides it, an object field after it among them', () => {
        expect(DefinitionWriter.quote(canonicalOf({ kind: 'object', fields: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }] }))).toBe('{ b = a, a = 1 }');
        expect(DefinitionWriter.quote(canonicalOf({ kind: 'object', fields: [{ name: 'b', value: parameter('a') }] }))).toBe('{ b = a }');
    });

    it('writes a hidden script parameter with ~ in a part of the definition written alone, and in a copy of it, as it reads where it stands', () => {
        const expression = canonicalOf({ kind: 'body', locals: [{ name: 'a', value: literal(1) }], result: { kind: 'member', target: parameter('a'), name: 'size' } });

        expect(DefinitionWriter.quote(expression.result)).toBe('~a.size');
        expect(DefinitionWriter.quote(DefinitionValidator.copyOf(expression.result))).toBe('~a.size');
    });
});
