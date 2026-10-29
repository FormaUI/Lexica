import { describe, it, expect } from 'vitest';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { errorThrownBy } from '../../support/errors.mjs';
import { constantUpdates } from '../../support/updates.mjs';

/** The module error creating a module of the members throws, as its code and location. */
const refusalOf = members => {
    const error = errorThrownBy(() => new LexicaModule('shop', { members }));

    return { code: error.code, location: error.location };
};

describe('Declarations', () => {
    it('creates each member with no receiver of its own, where it stands giving it one, a null name leaving an indexer unnamed', () => {
        const key = Declarations.createValueParameterDeclaration('key', 'String');

        expect(Declarations.createPropertyDeclaration('price', 'Number', { updates: constantUpdates })).toEqual({ name: 'price', kind: 'property', result: 'Number', updates: constantUpdates });
        expect(Declarations.createFunctionDeclaration('pad', 'String', { updates: constantUpdates, parameters: [key] })).toEqual({ name: 'pad', kind: 'function', result: 'String', parameters: [key], arguments: 'positional', updates: constantUpdates });
        expect(Declarations.createIndexerDeclaration(null, 'String?', { updates: constantUpdates, parameters: [key] })).toEqual({ kind: 'indexer', result: 'String?', parameters: [key], updates: constantUpdates });
    });

    it('creates a property without updates as a property of a structured type\'s data, which a module member is refused for lacking', () => {
        expect(Declarations.createPropertyDeclaration('price', 'Number')).toEqual({ name: 'price', kind: 'property', result: 'Number' });
        expect(refusalOf([Declarations.createPropertyDeclaration('price', 'Number', { impl: () => 1 })])).toEqual({ code: 'NEXO4032', location: { module: 'shop', declaration: 'price', declarationKey: 'updates' } });
        expect(() => new LexicaModule('shop', { types: [{ name: 'Cup', kind: 'structured', members: [Declarations.createPropertyDeclaration('price', 'Number')] }] })).not.toThrow();
        expect(() => new LexicaModule('shop', { members: [Declarations.createPropertyDeclaration('price', 'Number', { updates: constantUpdates, impl: () => 1 })] })).not.toThrow();
    });

    it('writes no updates for a function the host invokes, whatever it is given', () => {
        expect(Declarations.createFunctionDeclaration('dim', 'Number', { invokedBy: 'host', updates: constantUpdates })).toEqual({ name: 'dim', kind: 'function', invokedBy: 'host', result: 'Number', parameters: [] });
    });

    it('creates the parameters in their declaration shape, each with the defaults its contract gives it', () => {
        expect(Declarations.createValueParameterDeclaration('width', 'Number', { default: 2 })).toEqual({ name: 'width', kind: 'value', type: 'Number', required: false, fixed: false, nulls: 'propagate', default: 2 });
        expect(Declarations.createExpressionParameterDeclaration('Number')).toEqual({ name: 'expression', kind: 'expression', type: 'Number', context: 'item', required: true, fixed: false, nulls: 'propagate' });
        expect(Declarations.createExpressionParameterDeclaration('U', { nulls: 'accept' })).toEqual({ name: 'expression', kind: 'expression', type: 'U', context: 'item', required: true, fixed: false, nulls: 'accept' });
        expect(Declarations.createPredicateParameterDeclaration()).toEqual({ name: 'expression', kind: 'predicate', type: 'Boolean', context: 'item', required: true, fixed: false, nulls: 'propagate' });
        expect(Declarations.createFunctionParameterDeclaration('test', 'Boolean', ['String'])).toEqual({ name: 'test', kind: 'function', type: 'Boolean', parameterTypes: ['String'], required: true });
    });
});
