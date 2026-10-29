import { describe, it, expect } from 'vitest';
import { Dictionary } from '#lexica/language/Dictionary.mjs';
import { Pair } from '#lexica/language/Pair.mjs';
import { Type } from '#lexica/language/Type.mjs';
import { ValueCapture } from '#lexica/language/ValueCapture.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { Light, Thermostat, withHome } from '../support/home.mjs';
import { dataPropertyDeclarations } from '../support/declarations.mjs';

/** A home whose `Spot` is a structure of a size and a light that may be missing. */
const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('home', withHome({ types: [{ name: 'Spot', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number', lamp: 'Light?' }) }] }))]);
const capture = new ValueCapture(registry);
const named = (name, isNullable = false) => Type.createNamedType(name, isNullable, 'home');

/** What capturing the value as the type answers, or the path, the part and the type it failed at. */
const capturedAs = (value, type) => {
    try {
        return { value: capture.capture(value, type, (path, part, partType) => {
            throw { path, part, type: String(partType) };
        }) };
    } catch (failure) {
        return { failure };
    }
};

describe('ValueCapture', () => {
    const lamp = new Light('lamp');

    it('captures a structure as its data shape alone, a property it leaves out null where its type is nullable', () => {
        expect(capturedAs({ size: 2, extra: true }, named('Spot'))).toEqual({ value: { size: 2, lamp: null } });
        expect(capturedAs({ size: 2, lamp }, named('Spot')).value.lamp).toBe(lamp);
    });

    it('captures a reference of another type as null where a nullable reference type is declared, and refuses it where the type is not nullable', () => {
        expect(capturedAs({ size: 2, lamp: new Thermostat('heater') }, named('Spot'))).toEqual({ value: { size: 2, lamp: null } });
        expect(capturedAs(new Thermostat('heater'), named('Light')).failure).toMatchObject({ path: '', type: 'Light' });
    });

    it('captures a list item by item, a dictionary from a map and a pair from an object of a key and a value', () => {
        expect(capturedAs([{ size: 1 }], Type.createListType(named('Spot'))).value).toEqual([{ size: 1, lamp: null }]);
        expect(capturedAs(new Map([['a', 1]]), Type.parse('Dictionary<String, Number>')).value).toBeInstanceOf(Dictionary);
        expect(capturedAs({ key: 'a', value: 1 }, Type.parse('Pair<String, Number>')).value).toEqual(new Pair('a', 1));
    });

    it('refuses data its type does not admit, naming the part by its path within the value', () => {
        expect(capturedAs({ size: 'big' }, named('Spot')).failure).toMatchObject({ path: 'size', part: 'big', type: 'Number' });
        expect(capturedAs([{ size: 1 }, { lamp }], Type.createListType(named('Spot'))).failure).toMatchObject({ path: '[1].size', part: undefined, type: 'Number' });
        expect(capturedAs(null, Type.parse('Number')).failure).toMatchObject({ path: '', part: null });
    });

    it('tells a scalar type\'s values: a finite number, a string and a Boolean', () => {
        expect([ValueCapture.belongsToScalar(1, 'Number'), ValueCapture.belongsToScalar(Infinity, 'Number'), ValueCapture.belongsToScalar('a', 'String'), ValueCapture.belongsToScalar(false, 'Boolean'), ValueCapture.belongsToScalar(1, 'List')]).toEqual([true, false, true, true, false]);
    });
});
