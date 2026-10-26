import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { DefinitionValidator } from '#lexica/language/DefinitionValidator.mjs';
import { errorThrownBy, expectLexicaError } from '../support/errors.mjs';

/** A definition of the version the implementation reads, of the expression. */
const definitionOf = expression => ({ version: lexica.info.versions.definition, expression });

/** The error validating a definition of the expression throws. */
const refusalOf = expression => errorThrownBy(() => lexica.validate(definitionOf(expression)));

const literal = value => ({ kind: 'literal', value });
const parameter = name => ({ kind: 'parameter', name });
const namespace = name => ({ kind: 'namespace', name });
const callWith = (...argumentNodes) => ({ kind: 'call', target: parameter('x'), name: 'f', arguments: argumentNodes });

describe('the structure codes of a definition', () => {
    it('LEXICA2000: a definition that does not follow its structure', () => {
        const expressions = [
            { kind: 'infixCall' },
            { kind: 'nothing' },
            'literal',
            { kind: 'literal', value: 1, extra: true },
            { kind: 'literal' },
            { kind: 'parameter', name: '1a' },
            { kind: 'arithmetic', operator: '^', left: literal(1), right: literal(2) },
            { kind: 'conversion', type: 'A.B.C', target: parameter('x') },
            { kind: 'cast', type: 'A-B', target: parameter('x') },
            { kind: 'conditional', consequent: literal(1), alternative: literal(2) },
            { kind: 'comparison', operands: [literal(1), literal(2)], operators: ['=='] },
            { kind: 'comparison', operands: 'none', operators: [] },
            { kind: 'interpolatedString', parts: [{ kind: 'other' }] },
            { kind: 'interpolatedString', parts: [{ kind: 'text', value: 1 }] },
            { kind: 'body', locals: [{ name: 'f', value: { kind: 'function', parameters: [], body: literal(1), arrow: false } }], result: literal(1) },
            { kind: 'body', locals: [{ name: 'my-name', value: literal(1) }], result: literal(1) },
            { kind: 'literal', value: {} },
            { kind: 'member', target: parameter('x'), name: '1a' },
            { kind: 'member', target: parameter('x'), name: 'a', optional: false },
        ];

        expressions.forEach(expression => expectLexicaError(refusalOf(expression), 'LEXICA2000', 'structure'));
    });

    it('LEXICA2001: a comparison chain whose operators point two ways', () => {
        expectLexicaError(refusalOf({ kind: 'comparison', operands: [literal(1), literal(2), literal(3)], operators: ['<', '>'] }), 'LEXICA2001', 'structure');
    });

    it('LEXICA2002: a cast whose target text could not write', () => {
        expectLexicaError(refusalOf({ kind: 'cast', type: 'Light', target: { kind: 'arithmetic', operator: '+', left: parameter('a'), right: parameter('b') } }), 'LEXICA2002', 'structure');
    });

    it('LEXICA2003: a conditional or a do block that is the receiver of a chain', () => {
        expectLexicaError(refusalOf({ kind: 'member', target: { kind: 'conditional', condition: literal(true), consequent: literal(1), alternative: literal(2) }, name: 'a' }), 'LEXICA2003', 'structure');
        expectLexicaError(refusalOf({ kind: 'object', target: { kind: 'do', body: literal(1) }, fields: [{ name: 'a', value: literal(1) }] }), 'LEXICA2003', 'structure');
    });

    it('LEXICA2004: a regular function that is not a local initializer', () => {
        expectLexicaError(refusalOf({ kind: 'function', parameters: [], body: literal(1) }), 'LEXICA2004', 'structure');
    });

    it('LEXICA2005: a regular function written directly as an argument', () => {
        expectLexicaError(refusalOf(callWith({ kind: 'function', parameters: [], body: literal(1) })), 'LEXICA2005', 'structure');
    });

    it('LEXICA2006: an arrow function whose body is not a simple expression', () => {
        expectLexicaError(refusalOf(callWith({ kind: 'function', parameters: [], arrow: true, body: { kind: 'body', locals: [], result: literal(1) } })), 'LEXICA2006', 'structure');
    });

    it('LEXICA2007: a definition of another version', () => {
        expectLexicaError(errorThrownBy(() => lexica.validate({ version: 1, expression: literal(1) })), 'LEXICA2007', 'structure');
        // A definition of a later version is refused by its version, before a property only that version holds.
        expectLexicaError(errorThrownBy(() => lexica.validate({ version: 34, imports: [], expression: literal(1) })), 'LEXICA2007', 'structure');
    });

    it('LEXICA2009: an object node with no field', () => {
        expectLexicaError(refusalOf({ kind: 'object', fields: [] }), 'LEXICA2009', 'structure');
    });

    it('LEXICA2010: an optional access outside an optional chain', () => {
        expectLexicaError(refusalOf({ kind: 'member', target: parameter('x'), name: 'a', optional: true }), 'LEXICA2010', 'structure');
    });

    it('LEXICA2011: a do block, a conditional binding or a conditional beyond simple branches within a simple expression', () => {
        const conditional = (consequent, alternative = literal(2)) => ({ kind: 'conditional', condition: literal(true), consequent, alternative });
        const expressions = [
            callWith({ kind: 'do', body: literal(1) }),
            callWith(conditional(conditional(literal(1)))),
            callWith({ kind: 'conditional', binding: { name: 'k', value: literal(1) }, consequent: literal(1), alternative: literal(2) }),
            callWith(conditional({ kind: 'body', locals: [], result: literal(1) }, { kind: 'body', locals: [], result: literal(2) })),
        ];

        expressions.forEach(expression => expectLexicaError(refusalOf(expression), 'LEXICA2011', 'structure'));
    });

    it('LEXICA2012: a local no local or field in scope answers', () => {
        expectLexicaError(refusalOf({ kind: 'local', name: 'missing' }), 'LEXICA2012', 'structure');
    });

    it('LEXICA2013: a name read before a local of its name declared later in its scope', () => {
        expectLexicaError(errorThrownBy(() => lexica.parse('{ let n = n, a = n }')), 'LEXICA2013', 'structure');
    });

    it("LEXICA2014: a conditional binding's initializer reading the binding's own name", () => {
        expectLexicaError(errorThrownBy(() => lexica.parse('if let k = k then 1 else 2 end')), 'LEXICA2014', 'structure');
    });

    it('LEXICA2015: two locals of one name in a body or an object expression', () => {
        expectLexicaError(refusalOf({ kind: 'body', locals: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }], result: literal(1) }), 'LEXICA2015', 'structure');
        expectLexicaError(refusalOf({ kind: 'object', locals: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }], fields: [{ name: 'b', value: literal(1) }] }), 'LEXICA2015', 'structure');
    });

    it('LEXICA2016: a function calling itself', () => {
        const recursive = { kind: 'function', parameters: [], body: { kind: 'functionCall', name: 'f', arguments: [] } };

        expectLexicaError(refusalOf({ kind: 'body', locals: [{ name: 'f', value: recursive }], result: literal(1) }), 'LEXICA2016', 'structure');
    });

    it("LEXICA2017: a body anywhere but the script's, a do block's, a function's or a conditional branch's", () => {
        expectLexicaError(refusalOf({ kind: 'equality', left: { kind: 'body', locals: [], result: literal(1) }, right: literal(1) }), 'LEXICA2017', 'structure');
    });

    it('LEXICA2018: a root outside every object expression', () => {
        expectLexicaError(refusalOf({ kind: 'root' }), 'LEXICA2018', 'structure');
    });

    it('LEXICA2019: a numeric literal no finite number holds', () => {
        expectLexicaError(refusalOf(literal(Infinity)), 'LEXICA2019', 'structure');
    });

    it('LEXICA2026: it where the definition alone shows nothing gives it a value', () => {
        expectLexicaError(refusalOf({ kind: 'it' }), 'LEXICA2026', 'structure');
    });

    it('LEXICA2027: an arrow function that is neither a local initializer nor an argument', () => {
        expectLexicaError(refusalOf({ kind: 'function', parameters: [], body: literal(1), arrow: true }), 'LEXICA2027', 'structure');
    });

    it('LEXICA2029: a comparison node of fewer than two operands', () => {
        expectLexicaError(refusalOf({ kind: 'comparison', operands: [literal(1)], operators: [] }), 'LEXICA2029', 'structure');
    });

    it('LEXICA2030: an optional chain holding no optional access', () => {
        expectLexicaError(refusalOf({ kind: 'optionalChain', target: { kind: 'member', target: parameter('x'), name: 'a' } }), 'LEXICA2030', 'structure');
    });

    it('LEXICA2031: two fields of one name', () => {
        expectLexicaError(refusalOf({ kind: 'object', fields: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }] }), 'LEXICA2031', 'structure');
    });

    it('LEXICA2032: two parameters of one name', () => {
        const function_ = { kind: 'function', parameters: ['a', 'a'], body: literal(1) };

        expectLexicaError(refusalOf({ kind: 'body', locals: [{ name: 'f', value: function_ }], result: literal(1) }), 'LEXICA2032', 'structure');
    });

    it('LEXICA2520: a namespace anywhere but the target of a member or a call', () => {
        expectLexicaError(refusalOf(namespace('Home')), 'LEXICA2520', 'structure');
        expectLexicaError(refusalOf({ kind: 'indexer', target: namespace('Home'), argument: literal(0) }), 'LEXICA2520', 'structure');
    });

    it("LEXICA2521: a namespace's member named by a computed property access", () => {
        expectLexicaError(refusalOf({ kind: 'member', target: namespace('Home'), name: parameter('p') }), 'LEXICA2521', 'structure');
    });

    it('LEXICA2522: an optional access through a namespace', () => {
        expectLexicaError(refusalOf({ kind: 'optionalChain', target: { kind: 'member', target: namespace('Home'), name: 'rooms', optional: true } }), 'LEXICA2522', 'structure');
    });

    it('LEXICA2523: an attempt of anything but a conversion or a cast', () => {
        expectLexicaError(refusalOf({ kind: 'try', target: literal(1) }), 'LEXICA2523', 'structure');
        expectLexicaError(refusalOf({ kind: 'try', target: { kind: 'try', target: { kind: 'conversion', type: 'String', target: parameter('a') } } }), 'LEXICA2523', 'structure');
    });

    it('LEXICA2524: a conditional whose branches give their results in two styles', () => {
        expectLexicaError(refusalOf({ kind: 'conditional', condition: literal(true), consequent: { kind: 'body', locals: [], result: literal(1) }, alternative: literal(2) }), 'LEXICA2524', 'structure');
    });

    it('LEXICA2525: an and or an or of fewer than two operands', () => {
        expectLexicaError(refusalOf({ kind: 'and', operands: [literal(true)] }), 'LEXICA2525', 'structure');
        expectLexicaError(refusalOf({ kind: 'or', operands: [] }), 'LEXICA2525', 'structure');
    });

    it('LEXICA2526: a comparison without exactly one operator between each two operands', () => {
        expectLexicaError(refusalOf({ kind: 'comparison', operands: [literal(1), literal(2)], operators: ['<', '<'] }), 'LEXICA2526', 'structure');
    });

    it('LEXICA2527: an object expression declaring locals within a simple expression', () => {
        expectLexicaError(refusalOf(callWith({ kind: 'object', locals: [{ name: 'a', value: literal(1) }], fields: [{ name: 'b', value: literal(1) }] })), 'LEXICA2527', 'structure');
    });

    it('LEXICA2528: a parameter a text wrote alone named as a local in scope', () => {
        // Lowering reads such a name as the local, so only a text's definition given to validation directly holds one.
        const locations = { locate: pointer => ({ pointer }) };
        const writtenAlone = parameter('a');
        const definition = definitionOf({ kind: 'object', locals: [{ name: 'a', value: literal(1) }], fields: [{ name: 'b', value: writtenAlone }] });

        expectLexicaError(errorThrownBy(() => new DefinitionValidator(locations, new WeakSet([writtenAlone])).validate(definition)), 'LEXICA2528', 'structure');
    });
});
