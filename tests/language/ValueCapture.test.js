import { describe, it, expect } from 'vitest';
import { Dictionary } from '#nexo/language/Dictionary.mjs';
import { Pair } from '#nexo/language/Pair.mjs';
import { Type } from '#nexo/language/Type.mjs';
import { ValueCapture } from '#nexo/language/ValueCapture.mjs';
import { NexoModule } from '#nexo/language/vocabulary/NexoModule.mjs';
import { NexoRegistry } from '#nexo/language/vocabulary/NexoRegistry.mjs';
import { Vocabulary } from '#nexo/language/vocabulary/Vocabulary.mjs';
import { Light, Thermostat, withHome } from '../support/home.mjs';
import { dataPropertyDeclarations } from '../support/declarations.mjs';

/** A home whose `Spot` is a structure of a size and a light that may be missing. */
const registry = new NexoRegistry([Vocabulary.module, new NexoModule('home', withHome({ types: [{ name: 'Spot', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number', lamp: 'Light?' }) }] }))]);
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

describe('ValueCapture of data reaching itself', () => {
    const registry = new NexoRegistry([Vocabulary.module, new NexoModule('chains', { types: [{ name: 'Link', kind: 'structured', members: dataPropertyDeclarations({ value: 'Number', next: 'Link?' }) }] })]);

    it('gives fail the reason cycle and the path where the data reaches itself, and captures a chain that ends', () => {
        const link = { value: 1 };
        const reasons = [];

        link.next = link;

        expect(() => new ValueCapture(registry).capture(link, Type.createNamedType('Link', false, 'chains'), (path, part, type, reason) => {
            reasons.push([path, reason]);
            throw new Error('refused');
        })).toThrow('refused');
        expect(reasons).toEqual([['next', 'cycle']]);
        expect(new ValueCapture(registry).capture({ value: 1, next: { value: 2 } }, Type.createNamedType('Link', false, 'chains'), () => {
            throw new Error('refused');
        })).toEqual({ value: 1, next: { value: 2, next: null } });
    });
});
