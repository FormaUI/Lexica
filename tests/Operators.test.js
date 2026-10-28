import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Device, Light, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';

/** A meter, a value of the energy module's own hierarchy, outside the home's. */
class Meter {
    constructor(name) {
        this.name = name;
    }
}

/** A meter that is a device as well, which the home recognizes as a device, and a binding declares a meter. */
class DeviceMeter extends Device {}

/** The home, which owns its devices, and a temperature it converts to and from text, its own conversion to text in its type. */
const createHome = () => lexica.createModule('Home', withHome({
    types: [
        { name: 'Temperature', kind: 'structured', members: [...dataPropertyDeclarations({ degrees: 'Number' }), operatorDeclaration('convert', 'String', ({ value }) => `${value.degrees} degrees`)] },
        extensionDeclaration('Readings', 'String', [operatorDeclaration('convert', 'Temperature', ({ value, reject }) => (/^\d+$/.test(value) ? { degrees: Number(value) } : reject(`"${value}" is no temperature`)))]),
    ],
}));

/** Energy, whose meters cast to the home's devices by the cast operator given. */
const createEnergy = cast => lexica.createModule('Energy', {
    typeOf: value => (value instanceof Meter ? 'Meter' : null),
    types: [
        { name: 'Meter', kind: 'reference', isInstance: value => value instanceof Meter || value instanceof DeviceMeter, members: [cast] },
    ],
});

const values = { meter: new Meter('m'), deviceMeter: new DeviceMeter('d'), word: '21', temperature: { degrees: 3 } };

/** What the text evaluates to against a registry of the home and energy, its meters cast by the cast operator given. */
const evaluateWith = (cast, text) => {
    const registry = lexica.createRegistry([createHome(), createEnergy(cast)]);
    const bindings = registry.createBindings(values, { types: { deviceMeter: 'Energy.Meter' } });

    return registry.resolve(text, bindings).createEvaluator(bindings).evaluate().value;
};

describe('a conversion operator', () => {
    const cast = operatorDeclaration('cast', 'Home.Device');

    it('is selected by its receiver\'s type and its destination, within the type it converts from or in an extension of a foreign one', () => {
        expect(evaluateWith(cast, '{ text = (word to Temperature) to String, number = "12" to Number }')).toEqual({ text: '21 degrees', number: 12 });
    });

    it('rejects a value it does not convert, failing a conversion and answering null for an attempt', () => {
        expect(evaluateWith(cast, 'try "warm" to Temperature')).toBeNull();
        expect(errorThrownBy(() => evaluateWith(cast, '"warm" to Temperature'))).toMatchObject({ code: 'LEXICA5016', message: expect.stringContaining('The conversion from String to Temperature rejected its value: "warm" is no temperature') });
    });
});

describe('a cast operator', () => {
    it('casts a value of its type to its destination, outside its hierarchy, checked by the destination\'s membership where it has no implementation', () => {
        const cast = operatorDeclaration('cast', 'Home.Device');

        expect(evaluateWith(cast, '(deviceMeter as Device) != null')).toBe(true);
        expect(evaluateWith(cast, '(try meter as Device) == null')).toBe(true);
        expect(errorThrownBy(() => evaluateWith(cast, '(meter as Device) == null'))).toMatchObject({ code: 'LEXICA5001', message: expect.stringContaining('The cast to Device rejected its value') });
    });

    it('answers what its implementation answers, checked by the destination\'s membership, and rejects what it rejects, which an attempt answers null for', () => {
        const cast = operatorDeclaration('cast', 'Home.Device', ({ value, reject }) => (value.name === 'd' ? value : reject('the meter is no device')));

        expect(evaluateWith(cast, '(deviceMeter as Device) != null')).toBe(true);
        expect(evaluateWith(cast, '(try meter as Device) == null')).toBe(true);
        expect(errorThrownBy(() => evaluateWith(cast, '(meter as Device) == null'))).toMatchObject({ code: 'LEXICA5001', message: expect.stringContaining('The cast to Device rejected its value: the meter is no device') });
    });

    it('fails with a fault, which no attempt catches, where its implementation fails other than by its rejection', () => {
        const cast = operatorDeclaration('cast', 'Home.Device', () => {
            throw new Error('the meter is broken');
        });

        expect(errorThrownBy(() => evaluateWith(cast, '(try meter as Device) == null'))).toMatchObject({ code: 'LEXICA5004', message: expect.stringContaining('The cast operator Meter as Home.Device failed: the meter is broken') });
    });

    it('is reached by no cast its destination does not name, a cast within a hierarchy needing none', () => {
        const registry = lexica.createRegistry([createHome(), createEnergy(operatorDeclaration('cast', 'Home.Device'))]);

        expect(errorThrownBy(() => registry.resolve('(meter as Light) == null', { meter: values.meter }))).toMatchObject({ code: 'LEXICA3060' });
        expect(registry.resolve('(lamp as Device) == null', { lamp: new Light('lamp') }).type).toBe('Boolean');
    });

    it('is no candidate where it is internal, which no script reaches', () => {
        const registry = lexica.createRegistry([createHome(), createEnergy({ ...operatorDeclaration('cast', 'Home.Device'), internal: true })]);

        expect(errorThrownBy(() => registry.resolve('(meter as Device) == null', { meter: values.meter }))).toMatchObject({ code: 'LEXICA3023', message: expect.stringContaining('is internal to the module \'Energy\'') });
    });
});

describe('an operator a script uses', () => {
    it('is one of the declarations it uses, named by the syntax that invokes it, and a cast operator without an implementation needs none to evaluate', () => {
        const registry = lexica.createRegistry([createHome(), createEnergy(operatorDeclaration('cast', 'Home.Device'))]);
        const bindings = registry.createBindings(values, { types: { deviceMeter: 'Energy.Meter' } });
        const resolution = registry.resolve('{ text = (word to Temperature) to String, device = (deviceMeter as Device) != null, number = "12" to Number }', bindings);

        expect(resolution.usedDeclarations.map(({ name, qualifiedName, pointer }) => [name, qualifiedName, pointer])).toEqual([
            ['convert', 'String to Temperature', '/expression/fields/0/value/target'],
            ['convert', 'Temperature to String', '/expression/fields/0/value'],
            ['cast', 'Meter as Home.Device', '/expression/fields/1/value/operand/left'],
            ['convert', 'String to Number', '/expression/fields/2/value'],
        ]);
        expect(resolution.createEvaluator(bindings).evaluate().value).toEqual({ text: '21 degrees', device: true, number: 12 });
    });
});
