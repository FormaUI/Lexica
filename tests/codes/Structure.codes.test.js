import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { DefinitionValidator } from '#nexo/language/DefinitionValidator.mjs';
import { errorThrownBy, expectNexoError } from '../support/errors.mjs';

/** A definition of the version the implementation reads, of the expression and the imports given. */
const definitionOf = (expression, imports = []) => ({ version: nexo.info.versions.definition, imports, expression });

/** The error validating a definition of the expression, with the imports given, throws. */
const refusalOf = (expression, imports = []) => errorThrownBy(() => nexo.validate(definitionOf(expression, imports)));

const literal = value => ({ kind: 'literal', value });
const parameter = name => ({ kind: 'scriptParameter', name });
const namespace = name => ({ kind: 'namespace', name });
const member = (receiver, name, more = {}) => ({ kind: 'memberAccess', receiver, name, ...more });
const callWith = (...argumentNodes) => ({ kind: 'call', callee: member(parameter('x'), 'f'), arguments: argumentNodes });

describe('the structure codes of a definition', () => {
    it('NEXO2000: a definition that does not follow its structure', () => {
        const expressions = [
            { kind: 'infixCall' },
            { kind: 'nothing' },
            'literal',
            { kind: 'literal', value: 1, extra: true },
            { kind: 'literal' },
            { kind: 'scriptParameter', name: '1a' },
            { kind: 'arithmetic', operator: '^', left: literal(1), right: literal(2) },
            { kind: 'conversion', type: 'A.B.C', operand: parameter('x') },
            { kind: 'cast', type: 'A-B', operand: parameter('x') },
            { kind: 'conditional', consequent: literal(1), alternative: literal(2) },
            { kind: 'comparison', operands: [literal(1), literal(2)], operators: ['=='] },
            { kind: 'comparison', operands: 'none', operators: [] },
            { kind: 'interpolatedString', parts: [{ kind: 'other' }] },
            { kind: 'interpolatedString', parts: [{ kind: 'text', value: 1 }] },
            { kind: 'body', locals: [{ name: 'f', value: { kind: 'function', parameters: [], body: literal(1), arrow: false } }], result: literal(1) },
            { kind: 'body', locals: [{ name: 'my-name', value: literal(1) }], result: literal(1) },
            { kind: 'literal', value: {} },
            member(parameter('x'), '1a'),
            member(parameter('x'), 'a', { optional: false }),
            // Version 33's nodes and properties, which version 34 renamed.
            { kind: 'parameter', name: 'x' },
            { kind: 'member', target: parameter('x'), name: 'a' },
            { kind: 'functionCall', name: 'f', arguments: [] },
            { kind: 'memberAccess', target: parameter('x'), name: 'a' },
            { kind: 'object', fields: [{ name: 'a', value: literal(1) }] },
            // A call's callee is a member access or a local, its member named after its dot.
            { kind: 'call', callee: literal(1), arguments: [] },
            { kind: 'call', callee: member(parameter('x'), parameter('n')), arguments: [] },
            // An extension selection holds its name, an identifier, and its module, and a computed property access holds none.
            member(parameter('x'), 'a', { extension: { name: 'my-name' } }),
            member(parameter('x'), 'a', { extension: { name: 'Words', other: 1 } }),
            member(parameter('x'), parameter('n'), { extension: { name: 'Words' } }),
        ];

        expressions.forEach(expression => expectNexoError(refusalOf(expression), 'NEXO2000', 'structure'));
    });

    it('NEXO2001: a comparison chain whose operators point two ways', () => {
        expectNexoError(refusalOf({ kind: 'comparison', operands: [literal(1), literal(2), literal(3)], operators: ['<', '>'] }), 'NEXO2001', 'structure');
    });

    it('NEXO2002: a cast whose operand text could not write', () => {
        expectNexoError(refusalOf({ kind: 'cast', type: 'Light', operand: { kind: 'arithmetic', operator: '+', left: parameter('a'), right: parameter('b') } }), 'NEXO2002', 'structure');
    });

    it('NEXO2003: a conditional or a do block that is the receiver of a chain', () => {
        expectNexoError(refusalOf(member({ kind: 'conditional', condition: literal(true), consequent: literal(1), alternative: literal(2) }, 'a')), 'NEXO2003', 'structure');
        expectNexoError(refusalOf({ kind: 'object', context: { kind: 'do', body: literal(1) }, objectFields: [{ name: 'a', value: literal(1) }] }), 'NEXO2003', 'structure');
    });

    it('NEXO2004: a regular function that is not a local initializer', () => {
        expectNexoError(refusalOf({ kind: 'function', parameters: [], body: literal(1) }), 'NEXO2004', 'structure');
    });

    it('NEXO2005: a regular function written directly as an argument', () => {
        expectNexoError(refusalOf(callWith({ kind: 'function', parameters: [], body: literal(1) })), 'NEXO2005', 'structure');
    });

    it('NEXO2006: an arrow function whose body is not a simple expression', () => {
        expectNexoError(refusalOf(callWith({ kind: 'function', parameters: [], arrow: true, body: { kind: 'body', locals: [], result: literal(1) } })), 'NEXO2006', 'structure');
    });

    it('NEXO2007: a definition of another version, version 33 among them, before anything else it holds', () => {
        expectNexoError(errorThrownBy(() => nexo.validate({ version: 1, expression: literal(1) })), 'NEXO2007', 'structure');

        const older = errorThrownBy(() => nexo.validate({ version: 33, expression: { kind: 'parameter', name: 'x' } }));

        expectNexoError(older, 'NEXO2007', 'structure');
        expect(older).toMatchObject({ message: expect.stringContaining('this one is of version 33'), location: { pointer: '/version' } });
    });

    it("NEXO2008: a definition's imports that break their rules, located at the import", () => {
        const refusals = [
            [{ module: '1a' }],
            [{ module: 'Home', extra: true }],
            [{ module: 'Nexo' }],
            [{ module: 'Nexo', type: 'List', alias: 'Items' }],
            [{ module: 'Home', type: 'my-type' }],
            [{ module: 'Home', alias: 'Home' }],
            [{ module: 'Home', type: 'Sensor', alias: 'Sensor' }],
            ['Home'],
            [{ module: 'Home' }, { module: 'Energy' }],
            [{ module: 'Home' }, { module: 'Home' }],
            [{ module: 'Measurements', alias: 'Measures' }, { module: 'Home', type: 'Sensor', alias: 'Measures' }],
        ];

        for (const imports of refusals) {
            const refused = refusalOf(literal(1), imports);

            expectNexoError(refused, 'NEXO2008', 'structure');
            expect(refused.location.pointer, JSON.stringify(imports)).toBe(`/imports/${imports.length - 1}`);
        }

        expectNexoError(errorThrownBy(() => nexo.validate({ version: nexo.info.versions.definition, imports: 'Home', expression: literal(1) })), 'NEXO2000', 'structure');
        expectNexoError(errorThrownBy(() => nexo.validate({ version: nexo.info.versions.definition, expression: literal(1) })), 'NEXO2000', 'structure');
        expect(refusalOf(literal(1), [{ module: 'Measurements', alias: 'Measures' }, { module: 'Home', type: 'Sensor', alias: 'Measures' }]).message).toContain("'Measures' is the local name both 'import Measures = Measurements' and 'import Measures = Home.Sensor' give");
    });

    it('NEXO2028: a namespace naming a module no import gives that local name', () => {
        expectNexoError(refusalOf(member(namespace('Home'), 'rooms')), 'NEXO2028', 'structure');
        expect(refusalOf(member(namespace('Home'), 'rooms'), [{ module: 'Home', alias: 'House' }]).location).toEqual({ pointer: '/expression/receiver' });
        expect(refusalOf(member(namespace('Sensor'), 'rooms'), [{ module: 'Home', type: 'Sensor' }]).code).toBe('NEXO2028');
        expect(nexo.validate(definitionOf(member(namespace('House'), 'rooms'), [{ module: 'Home', alias: 'House' }])).expression).toEqual(member(namespace('House'), 'rooms'));
    });

    it('NEXO2009: an object node with no field', () => {
        expectNexoError(refusalOf({ kind: 'object', objectFields: [] }), 'NEXO2009', 'structure');
    });

    it('NEXO2010: an optional access outside an optional chain', () => {
        expectNexoError(refusalOf(member(parameter('x'), 'a', { optional: true })), 'NEXO2010', 'structure');
    });

    it('NEXO2011: a do block, a conditional binding or a conditional beyond simple branches within a simple expression', () => {
        const conditional = (consequent, alternative = literal(2)) => ({ kind: 'conditional', condition: literal(true), consequent, alternative });
        const expressions = [
            callWith({ kind: 'do', body: literal(1) }),
            callWith(conditional(conditional(literal(1)))),
            callWith({ kind: 'conditional', binding: { name: 'k', value: literal(1) }, consequent: literal(1), alternative: literal(2) }),
            callWith(conditional({ kind: 'body', locals: [], result: literal(1) }, { kind: 'body', locals: [], result: literal(2) })),
        ];

        expressions.forEach(expression => expectNexoError(refusalOf(expression), 'NEXO2011', 'structure'));
    });

    it('NEXO2012: a local no local or field in scope answers', () => {
        expectNexoError(refusalOf({ kind: 'local', name: 'missing' }), 'NEXO2012', 'structure');
    });

    it('NEXO2013: a name read before a local of its name declared later in its scope', () => {
        expectNexoError(errorThrownBy(() => nexo.parse('{ let n = n, a = n }')), 'NEXO2013', 'structure');
    });

    it("NEXO2014: a conditional binding's initializer reading the binding's own name", () => {
        expectNexoError(errorThrownBy(() => nexo.parse('if let k = k then 1 else 2 end')), 'NEXO2014', 'structure');
    });

    it('NEXO2015: two locals of one name in a body or an object expression', () => {
        expectNexoError(refusalOf({ kind: 'body', locals: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }], result: literal(1) }), 'NEXO2015', 'structure');
        expectNexoError(refusalOf({ kind: 'object', locals: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }], objectFields: [{ name: 'b', value: literal(1) }] }), 'NEXO2015', 'structure');
    });

    it('NEXO2016: a function calling itself', () => {
        const recursive = { kind: 'function', parameters: [], body: { kind: 'call', callee: { kind: 'local', name: 'f' }, arguments: [] } };

        expectNexoError(refusalOf({ kind: 'body', locals: [{ name: 'f', value: recursive }], result: literal(1) }), 'NEXO2016', 'structure');
    });

    it("NEXO2017: a body anywhere but the script's, a do block's, a function's or a conditional branch's", () => {
        expectNexoError(refusalOf({ kind: 'equality', left: { kind: 'body', locals: [], result: literal(1) }, right: literal(1) }), 'NEXO2017', 'structure');
    });

    it('NEXO2018: a root outside every object expression', () => {
        expectNexoError(refusalOf({ kind: 'root' }), 'NEXO2018', 'structure');
    });

    it('NEXO2019: a numeric literal no finite number holds', () => {
        expectNexoError(refusalOf(literal(Infinity)), 'NEXO2019', 'structure');
    });

    it('NEXO2026: it where the definition alone shows nothing gives it a value', () => {
        expectNexoError(refusalOf({ kind: 'it' }), 'NEXO2026', 'structure');
    });

    it('NEXO2027: an arrow function that is neither a local initializer nor an argument', () => {
        expectNexoError(refusalOf({ kind: 'function', parameters: [], body: literal(1), arrow: true }), 'NEXO2027', 'structure');
    });

    it('NEXO2029: a comparison node of fewer than two operands', () => {
        expectNexoError(refusalOf({ kind: 'comparison', operands: [literal(1)], operators: [] }), 'NEXO2029', 'structure');
    });

    it('NEXO2030: an optional chain holding no optional access', () => {
        expectNexoError(refusalOf({ kind: 'optionalChain', chain: member(parameter('x'), 'a') }), 'NEXO2030', 'structure');
    });

    it('NEXO2031: two fields of one name', () => {
        expectNexoError(refusalOf({ kind: 'object', objectFields: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }] }), 'NEXO2031', 'structure');
    });

    it('NEXO2032: two parameters of one name', () => {
        const function_ = { kind: 'function', parameters: ['a', 'a'], body: literal(1) };

        expectNexoError(refusalOf({ kind: 'body', locals: [{ name: 'f', value: function_ }], result: literal(1) }), 'NEXO2032', 'structure');
    });

    it('NEXO2520: a namespace anywhere but the receiver of a member access', () => {
        const home = [{ module: 'Home' }];

        expectNexoError(refusalOf(namespace('Home'), home), 'NEXO2520', 'structure');
        expectNexoError(refusalOf({ kind: 'indexerAccess', receiver: namespace('Home'), argument: literal(0) }, home), 'NEXO2520', 'structure');
    });

    it("NEXO2521: a namespace's member named by a computed property access", () => {
        expectNexoError(refusalOf(member(namespace('Home'), parameter('p')), [{ module: 'Home' }]), 'NEXO2521', 'structure');
    });

    it('NEXO2522: an optional access through a namespace', () => {
        expectNexoError(refusalOf({ kind: 'optionalChain', chain: member(namespace('Home'), 'rooms', { optional: true }) }, [{ module: 'Home' }]), 'NEXO2522', 'structure');
    });

    it('NEXO2523: an attempt of anything but a conversion or a cast', () => {
        expectNexoError(refusalOf({ kind: 'try', operand: literal(1) }), 'NEXO2523', 'structure');
        expectNexoError(refusalOf({ kind: 'try', operand: { kind: 'try', operand: { kind: 'conversion', type: 'String', operand: parameter('a') } } }), 'NEXO2523', 'structure');
    });

    it('NEXO2524: a conditional whose branches give their results in two styles', () => {
        expectNexoError(refusalOf({ kind: 'conditional', condition: literal(true), consequent: { kind: 'body', locals: [], result: literal(1) }, alternative: literal(2) }), 'NEXO2524', 'structure');
    });

    it('NEXO2525: an and or an or of fewer than two operands', () => {
        expectNexoError(refusalOf({ kind: 'and', operands: [literal(true)] }), 'NEXO2525', 'structure');
        expectNexoError(refusalOf({ kind: 'or', operands: [] }), 'NEXO2525', 'structure');
    });

    it('NEXO2526: a comparison without exactly one operator between each two operands', () => {
        expectNexoError(refusalOf({ kind: 'comparison', operands: [literal(1), literal(2)], operators: ['<', '<'] }), 'NEXO2526', 'structure');
    });

    it('NEXO2527: an object expression declaring locals within a simple expression', () => {
        expectNexoError(refusalOf(callWith({ kind: 'object', locals: [{ name: 'a', value: literal(1) }], objectFields: [{ name: 'b', value: literal(1) }] })), 'NEXO2527', 'structure');
    });

    it('NEXO2528: a parameter a text wrote alone named as a local in scope', () => {
        // Lowering reads such a name as the local, so only a text's definition given to validation directly holds one.
        const locations = { locate: pointer => ({ pointer }) };
        const writtenAlone = parameter('a');
        const definition = definitionOf({ kind: 'object', locals: [{ name: 'a', value: literal(1) }], objectFields: [{ name: 'b', value: writtenAlone }] });

        expectNexoError(errorThrownBy(() => new DefinitionValidator(locations, new WeakSet([writtenAlone])).validate(definition)), 'NEXO2528', 'structure');
    });

    it('takes a definition of every node version 34 names, as canonical text writes it', () => {
        const definition = definitionOf({
            kind: 'object',
            objectFields: [
                { name: 'a', value: { kind: 'call', callee: member(namespace('Measures'), 'f'), arguments: [parameter('x')] } },
                { name: 'b', value: { kind: 'indexerAccess', receiver: member(parameter('x'), 'cells'), argument: literal(0) } },
                { name: 'c', value: { kind: 'arithmeticNegation', operand: parameter('x') } },
                { name: 'd', value: { kind: 'try', operand: { kind: 'conversion', type: 'Number', operand: parameter('x') } } },
                { name: 'e', value: { kind: 'optionalChain', chain: member(parameter('x'), 'a', { optional: true }) } },
            ],
        }, [{ module: 'Measurements', alias: 'Measures' }]);

        expect(nexo.validate(definition)).toEqual(definition);
        expect(nexo.format(definition)).toBe('import Measures = Measurements\n\n{\n    a = Measures.f(x),\n    b = x.cells[0],\n    c = -x,\n    d = try x to Number,\n    e = x?.a\n}');
    });
});
