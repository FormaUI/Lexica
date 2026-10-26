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

    it('writes the updates a member is given, and none it isn\'t, so a member without them is refused for what it lacks', () => {
        expect(Declarations.property('price', 'String', 'Number', { updates: constantUpdates }).updates).toEqual(constantUpdates);
        expect(Declarations.property('price', 'String', 'Number')).not.toHaveProperty('updates');
        expect(refusalOf([Declarations.property('price', 'String', 'Number', { implementation: () => 1 })])).toEqual({ code: 'LEXICA4003', location: { module: 'shop', declaration: 'price', declarationKey: 'updates' } });
        expect(() => new LexicaModule('shop', { members: [Declarations.property('price', 'String', 'Number', { updates: constantUpdates, implementation: () => 1 })] })).not.toThrow();
    });

    it('writes no updates for a function the host invokes, whatever it is given', () => {
        expect(Declarations.function('dim', 'String', 'Number', { invokedBy: 'host', updates: constantUpdates })).not.toHaveProperty('updates');
    });
});
