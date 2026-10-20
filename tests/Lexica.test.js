import { describe, it, expect } from 'vitest';
import { LexicaError, lexica } from '#lexica/lexica.js';
import { Specification } from '#lexica/language/Specification.mjs';

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
            version: Specification.definitionVersion,
            expression: { kind: 'object', fields: [{ name: 'total', value: { kind: 'arithmetic', operator: '*', left: { kind: 'parameter', name: 'price' }, right: { kind: 'parameter', name: 'quantity' } } }] },
        });
    });

    it('writes the canonical text of a text or a definition, which gives that text again', () => {
        const text = 'let shown = rows.where(context.visible)\nreturn { count = shown.count, label = $"{shown.count} of {rows.count} shown" }';
        const formatted = lexica.format(text);

        expect(lexica.format(lexica.parse(text))).toBe(formatted);
        expect(lexica.format(formatted)).toBe(formatted);
        expect(lexica.format('{ total = price * quantity }')).toBe('{ total = price * quantity }');
    });

    it('checks a definition given directly, refusing one whose structure is wrong', () => {
        expect(lexica.validate({ version: Specification.definitionVersion, expression: { kind: 'literal', value: 1 } })).toEqual({ version: Specification.definitionVersion, expression: { kind: 'literal', value: 1 } });
        expect(getError(() => lexica.validate({ version: Specification.definitionVersion, expression: { kind: 'nothing' } }))).toBeInstanceOf(LexicaError);
    });

    it('refuses a text that is no expression with a syntax error at its place', () => {
        expect(getError(() => lexica.parse('a +'))).toMatchObject({ kind: 'syntax', location: { line: 1 } });
        expect(getError(() => lexica.parse(1))).toMatchObject({ kind: 'structure' });
    });

    it('creates a module from the vocabulary it declares', () => {
        const module = lexica.createModule('price', {
            members: [{ name: 'price', function: 'price', kind: 'property', on: 'string', parameters: [], result: 'number', changes: 'constant', reads: 'fresh' }],
        }, { price: () => 1 });

        expect(module.name).toBe('price');
        expect(getError(() => lexica.createModule('price', { members: [{ name: 'other' }] }))).toMatchObject({ kind: 'module' });
    });

    it('resolves an expression against a registry of its built-in vocabulary and the modules a host registers, each registry its own', () => {
        const prices = lexica.createModule('price', {
            types: [{ name: 'item', fields: { price: 'number', quantity: 'number' } }],
            members: [{ name: 'price', function: 'price', kind: 'property', on: 'string', parameters: [], result: 'number', changes: 'constant', reads: 'fresh' }],
        });
        const registry = lexica.createRegistry([prices]);
        const items = [{ price: 2, quantity: 3 }];

        expect(registry.moduleNames).toEqual(['lexica', 'price']);
        expect(registry.resolve('items { total = context.price * context.quantity }.count', { items })).toMatchObject({ kind: 'value', type: 'number' });
        expect(registry.resolve('"10".price + 1')).toMatchObject({ kind: 'value', type: 'number' });
        expect(lexica.createRegistry().moduleNames).toEqual(['lexica']);
        expect(getError(() => lexica.createRegistry().resolve('"10".price'))).toMatchObject({ kind: 'validation', location: { line: 1 } });
    });

    it('registers a module with a registry, whose expressions resolved afterwards may use its vocabulary', () => {
        const registry = lexica.createRegistry();

        registry.registerModule(lexica.createModule('double', {
            members: [{ name: 'double', function: 'double', kind: 'property', on: 'number', parameters: [], result: 'number', changes: 'constant', reads: 'fresh' }],
        }));

        expect(registry.resolve('(2).double')).toMatchObject({ kind: 'value', type: 'number' });
    });

    it('says which build it is and which specification it follows', () => {
        expect(lexica.info).toEqual({ version: '1.0.0-alpha+source', specificationVersion: Specification.version, definitionVersion: Specification.definitionVersion });
    });
});
