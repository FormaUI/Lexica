import { describe, it, expect } from 'vitest';
import { LexicaError, lexica } from '#lexica/lexica.js';
import { Versions } from '#lexica/language/Versions.mjs';

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

describe('lexica', () => {
    it('runs where no browser global exists', () => {
        expect(typeof globalThis.window).toBe('undefined');
        expect(typeof globalThis.document).toBe('undefined');
        expect(typeof globalThis.Node).toBe('undefined');
    });

    it('reads a text into its definition, of the version it writes', () => {
        expect(lexica.parse('{ total = price * quantity }')).toEqual({
            version: Versions.definition,
            expression: { kind: 'object', fields: [{ name: 'total', value: { kind: 'arithmetic', operator: '*', left: { kind: 'parameter', name: 'price' }, right: { kind: 'parameter', name: 'quantity' } } }] },
        });
    });

    it('writes the canonical text of a text or a definition, which gives that text again', () => {
        const text = 'let shown = rows.where(it.visible)\nreturn { count = shown.count, label = $"{shown.count} of {rows.count} shown" }';
        const formatted = lexica.format(text);

        expect(lexica.format(lexica.parse(text))).toBe(formatted);
        expect(lexica.format(formatted)).toBe(formatted);
        expect(lexica.format('{ total = price * quantity }')).toBe('{ total = price * quantity }');
    });

    it('checks a definition given directly, refusing one whose structure is wrong', () => {
        expect(lexica.validate({ version: Versions.definition, expression: { kind: 'literal', value: 1 } })).toEqual({ version: Versions.definition, expression: { kind: 'literal', value: 1 } });
        expect(getError(() => lexica.validate({ version: Versions.definition, expression: { kind: 'nothing' } }))).toBeInstanceOf(LexicaError);
    });

    it('reads definitions of its one version, refusing one of another, version 31 among them, with a structure error naming both', () => {
        const thirtyOne = { version: 31, expression: { kind: 'context' } };

        expect(getError(() => lexica.validate(thirtyOne))).toMatchObject({ kind: 'structure', location: { pointer: '/version' }, message: expect.stringContaining(`A definition is of version ${Versions.definition}, the one this implementation reads, and this one is of version 31`) });
        expect(getError(() => lexica.createRegistry().resolve(thirtyOne))).toMatchObject({ kind: 'structure' });
    });

    it('reads the implicit parameter as it and the object root as root, nodes of their own, and context as an ordinary name', () => {
        expect(lexica.parse('room { size = it.size, total = root.size }').expression).toEqual({ kind: 'object', target: { kind: 'parameter', name: 'room' }, fields: [
            { name: 'size', value: { kind: 'member', target: { kind: 'it' }, name: 'size' } },
            { name: 'total', value: { kind: 'member', target: { kind: 'root' }, name: 'size' } },
        ] });
        expect(lexica.parse('context.size').expression).toEqual({ kind: 'member', target: { kind: 'parameter', name: 'context' }, name: 'size' });
        expect(lexica.format('{ let context = 1, value = context + 1 }')).toBe('{\n    let context = 1,\n    value = context + 1\n}');
        expect(lexica.createRegistry().resolve('{ context = context }', { context: 2 }).createEvaluator({ context: 2 }).evaluate().value).toEqual({ context: 2 });
    });

    it('refuses a parameter reference that names no parameter, since ~ alone reads nothing', () => {
        expect(getError(() => lexica.parse('~.size'))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("names its script parameter directly after '~'") });
        expect(getError(() => lexica.parse('~ room'))).toMatchObject({ kind: 'syntax', message: "A parameter reference names its script parameter directly after '~', as ~room (line 1, column 1)" });
    });

    it('writes a cast\'s and a conversion\'s type bare, a reserved word among them, and refuses a string in its place with the bare name', () => {
        expect(lexica.parse('value to number').expression).toEqual({ kind: 'conversion', type: 'number', target: { kind: 'parameter', name: 'value' } });
        expect(lexica.format('(try value to number) ?? 0')).toBe('try value to number ?? 0');
        expect(lexica.format('(node as element)?.size')).toBe('(node as element)?.size');
        expect(lexica.format('a as end')).toBe('a as end');
        expect(getError(() => lexica.parse('value to "number"'))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("'to' names the type it converts to bare, as a member's name is written: write 'to number'") });
        expect(getError(() => lexica.parse("node as 'element'"))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("write 'as element'") });
        expect(getError(() => lexica.validate({ version: Versions.definition, expression: { kind: 'conversion', type: 'list<number>', target: { kind: 'literal', value: 1 } } }))).toMatchObject({ kind: 'structure', location: { pointer: '/expression/type' } });
    });

    it('refuses a text that is no expression with a syntax error at its place', () => {
        expect(getError(() => lexica.parse('a +'))).toMatchObject({ kind: 'syntax', location: { line: 1 } });
        expect(getError(() => lexica.parse(1))).toMatchObject({ kind: 'structure' });
    });

    it('creates a module from the vocabulary it declares', () => {
        const module = lexica.createModule('price', {
            members: [{ name: 'price', kind: 'property', target: 'string', result: 'number', updates: { changes: 'constant', reads: 'fresh' }, implementation: () => 1 }],
        });

        expect(module.name).toBe('price');
        expect(getError(() => lexica.createModule('price', { members: [{ name: 'other' }] }))).toMatchObject({ kind: 'module' });
    });

    it('resolves an expression against a registry of its built-in vocabulary and the modules a host registers, each registry its own', () => {
        const prices = lexica.createModule('price', {
            types: [{ name: 'item', fields: { price: 'number', quantity: 'number' } }],
            members: [{ name: 'price', kind: 'property', target: 'string', result: 'number', updates: { changes: 'constant', reads: 'fresh' } }],
        });
        const registry = lexica.createRegistry([prices]);
        const items = [{ price: 2, quantity: 3 }];

        expect(registry.moduleNames).toEqual(['lexica', 'price']);
        expect(registry.resolve('items { total = it.price * it.quantity }.count', { items })).toMatchObject({ hostCall: null, type: 'number' });
        expect(registry.resolve('"10".price + 1')).toMatchObject({ hostCall: null, type: 'number' });
        expect(lexica.createRegistry().moduleNames).toEqual(['lexica']);
        expect(getError(() => lexica.createRegistry().resolve('"10".price'))).toMatchObject({ kind: 'validation', location: { line: 1 } });
    });

    it('registers a module with a registry, whose expressions resolved afterwards may use its vocabulary', () => {
        const registry = lexica.createRegistry();

        registry.registerModule(lexica.createModule('double', {
            members: [{ name: 'double', kind: 'property', target: 'number', result: 'number', updates: { changes: 'constant', reads: 'fresh' } }],
        }));

        expect(registry.resolve('(2).double')).toMatchObject({ hostCall: null, type: 'number' });
    });

    it('says which build it is and which specification it follows', () => {
        expect(lexica.info).toEqual({ versions: { runtime: Versions.runtime, language: Versions.language, definition: Versions.definition } });
    });
});
