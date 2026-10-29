import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { DefinitionValidator } from '#nexo/language/DefinitionValidator.mjs';
import { DefinitionWriter } from '#nexo/language/DefinitionWriter.mjs';
import { Versions } from '#nexo/language/Versions.mjs';

const literal = value => ({ kind: 'literal', value });
const parameter = name => ({ kind: 'scriptParameter', name });

/** The canonical expression a definition given directly holds, as validation answers it. */
const canonicalOf = expression => new DefinitionValidator().validate({ version: Versions.definition, imports: [], expression }).expression;

describe('DefinitionWriter', () => {
    it.each([
        ['a local of its object expression', { kind: 'object', locals: [{ name: 'a', value: literal(1) }], objectFields: [{ name: 'b', value: parameter('a') }] }, '{ let a = 1, b = ~a }'],
        ['an object field before it', { kind: 'object', objectFields: [{ name: 'a', value: literal(1) }, { name: 'b', value: parameter('a') }] }, '{ a = 1, b = ~a }'],
        ['a local of its body', { kind: 'body', locals: [{ name: 'a', value: literal(1) }], result: parameter('a') }, 'let a = 1\nreturn ~a'],
        ['a local its body declares later', { kind: 'body', locals: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }], result: literal(0) }, 'let b = ~a\nlet a = 1\nreturn 0'],
        ['a local its object expression declares later', { kind: 'object', locals: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }], objectFields: [{ name: 'c', value: literal(0) }] }, '{ let b = ~a, let a = 1, c = 0 }'],
        ['a function parameter', { kind: 'body', locals: [{ name: 'f', value: { kind: 'function', parameters: ['a'], body: parameter('a') } }], result: { kind: 'call', callee: { kind: 'local', name: 'f' }, arguments: [literal(1)] } }, 'let f = function(a) ~a end\nreturn f(1)'],
        ['a conditional binding, in its consequent alone', { kind: 'conditional', binding: { name: 'a', value: literal(1) }, consequent: parameter('a'), alternative: parameter('a') }, 'if let a = 1 then ~a else a end'],
        ['a conditional binding, in its own value', { kind: 'conditional', binding: { name: 'a', value: parameter('a') }, consequent: literal(1), alternative: literal(0) }, 'if let a = ~a then 1 else 0 end'],
    ])('writes a script parameter that %s hides with ~', (_, expression, text) => {
        expect(DefinitionWriter.quote(canonicalOf(expression))).toBe(text);
    });

    it('writes a script parameter alone where nothing in scope hides it, an object field after it among them', () => {
        expect(DefinitionWriter.quote(canonicalOf({ kind: 'object', objectFields: [{ name: 'b', value: parameter('a') }, { name: 'a', value: literal(1) }] }))).toBe('{ b = a, a = 1 }');
        expect(DefinitionWriter.quote(canonicalOf({ kind: 'object', objectFields: [{ name: 'b', value: parameter('a') }] }))).toBe('{ b = a }');
    });

    it('writes a hidden script parameter with ~ in a part of the definition written alone, and in a copy of it, as it reads where it stands', () => {
        const expression = canonicalOf({ kind: 'body', locals: [{ name: 'a', value: literal(1) }], result: { kind: 'memberAccess', receiver: parameter('a'), name: 'size' } });

        expect(DefinitionWriter.quote(expression.result)).toBe('~a.size');
        expect(DefinitionWriter.quote(DefinitionValidator.copyOf(expression.result))).toBe('~a.size');
    });

    it("lays out a conditional that spans lines in block form, and closes a group after a block's end on the line after it, as line structure reads them", () => {
        const condition = parameter('lit');
        const elseif = canonicalOf({ kind: 'conditional', condition, consequent: literal(1), alternative: { kind: 'conditional', condition: parameter('dim'), consequent: literal(2), alternative: literal(3) } });
        const spanning = canonicalOf({ kind: 'object', objectFields: [{ name: 'a', value: { kind: 'conditional', condition, consequent: { kind: 'do', body: { kind: 'body', locals: [], result: literal(1) } }, alternative: literal(2) } }] });
        const sum = canonicalOf({ kind: 'arithmetic', operator: '+', left: { kind: 'do', body: { kind: 'body', locals: [], result: literal(1) } }, right: literal(2) });

        expect(DefinitionWriter.format(elseif)).toBe('if lit then\n    1\nelseif dim then\n    2\nelse\n    3\nend');
        expect(DefinitionWriter.format(spanning)).toBe('{\n    a = if lit then\n        do\n            return 1\n        end\n    else\n        2\n    end\n}');
        expect(DefinitionWriter.format(sum)).toBe('(do\n    return 1\nend\n) + 2');
        expect(DefinitionWriter.format(canonicalOf({ kind: 'conditional', condition, consequent: literal(1), alternative: literal(2) }))).toBe('if lit then 1 else 2 end');
    });

    it("starts a call's argument after one ending in a block's end on the next line, since only closing punctuation follows end on its line", () => {
        const formatted = nexo.format('f(if c then { a = 1, b = 2 } else null end, 2)');

        expect(formatted).toBe('f(if c then\n    {\n        a = 1,\n        b = 2\n    }\nelse\n    null\nend,\n2)');
        expect(nexo.parse(formatted)).toEqual(nexo.parse('f(if c then { a = 1, b = 2 } else null end, 2)'));
    });

    it("writes a script's imports before its body, each on a line of its own in the definition's order, an alias and = before its source, leaving out those its destination supplies", () => {
        const imports = [{ module: 'Home' }, { module: 'Home', type: 'Sensor', alias: 'HomeSensor' }, { module: 'Measurements', alias: 'Measures' }];
        const definition = new DefinitionValidator().validate({ version: Versions.definition, imports, expression: { kind: 'object', objectFields: [{ name: 'a', value: { kind: 'memberAccess', receiver: { kind: 'namespace', name: 'Measures' }, name: 'rooms' } }, { name: 'b', value: literal(1) }] } });

        expect(DefinitionWriter.formatScript(definition)).toBe('import Home\nimport HomeSensor = Home.Sensor\nimport Measures = Measurements\n\n{\n    a = Measures.rooms,\n    b = 1\n}');
        expect(DefinitionWriter.quoteScript(definition)).toBe('import Home\nimport HomeSensor = Home.Sensor\nimport Measures = Measurements\n{ a = Measures.rooms, b = 1 }');
        expect(DefinitionWriter.formatScript(definition, [{ module: 'Home' }, { module: 'Measurements', alias: 'Measures' }])).toBe('import HomeSensor = Home.Sensor\n\n{\n    a = Measures.rooms,\n    b = 1\n}');
        expect(DefinitionWriter.quoteScript(definition, imports)).toBe('{ a = Measures.rooms, b = 1 }');
    });

    it("writes a call by its callee, a member's after its receiver and a held function's by the local's name, and an extension selection's colon and name, its module's local name qualifying it", () => {
        const receiver = parameter('x');

        expect(DefinitionWriter.quote({ kind: 'call', callee: { kind: 'memberAccess', receiver, name: 'pad', optional: true }, arguments: [literal(1)] })).toBe('x?.pad(1)');
        expect(DefinitionWriter.quote({ kind: 'call', callee: { kind: 'local', name: 'if' }, arguments: [] })).toBe('@if()');
        expect(DefinitionWriter.quote({ kind: 'memberAccess', receiver, name: 'usage', extension: { name: 'Device', module: 'Energy' } })).toBe('x:Energy.Device.usage');
        expect(DefinitionWriter.quote({ kind: 'indexerAccess', receiver, argument: literal(0), optional: true, extension: { name: 'Cells' } })).toBe('x?:Cells[0]');
        expect(DefinitionWriter.quote({ kind: 'memberAccess', receiver: { kind: 'namespace', name: 'if' }, name: 'open' }, new Set(['if']))).toBe('@if.open');
    });
});
