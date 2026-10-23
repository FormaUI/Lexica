import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { Device, Light, Room, Thermostat, withHome } from './support/home.mjs';

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

const { property, function: fn, valueParameter } = lexica.declarations;
const constant = { changes: 'constant', reads: 'fresh' };

/** The home's module: a device's name, which a light and a thermostat read as devices, a light's brightness, a room's devices and the device a room names. */
const createHome = () => lexica.createModule('home', withHome({
    members: [
        property('name', 'Device', 'String', { updates: constant, implementation: ({ receiver }) => receiver.name }),
        property('brightness', 'Light', 'Number', { updates: constant, implementation: () => 40 }),
        property('devices', 'Room', 'List<Device>', { updates: constant, implementation: ({ receiver }) => receiver.devices }),
        fn('device', 'Room', 'Device?', { updates: constant, parameters: [valueParameter('name', 'String')], implementation: ({ receiver, args }) => receiver.devices.find(device => device.name === args.name) ?? null }),
    ],
}));

const lamp = new Light('lamp');
const heater = new Thermostat('heater');
const kitchen = new Room('kitchen', [lamp, heater]);

/** A registry of the home. */
const home = () => lexica.createRegistry([createHome()]);

/** What the text evaluates to, bound to the values given against a registry of the home. */
const evaluate = (text, values) => {
    const registry = home();
    const bindings = registry.bind(values);

    return registry.resolve(text, bindings).createEvaluator(bindings).evaluate().value;
};

describe('reference types', () => {
    it('type a binding as the most specific type its module recognizes, and keep the reference itself', () => {
        const bindings = home().bind({ lamp, room: kitchen, devices: [lamp, heater], lights: [lamp, null] });

        expect(['lamp', 'room', 'devices', 'lights'].map(name => bindings.typeOf(name))).toEqual(['Light', 'Room', 'List<Device>', 'List<Light?>']);
        expect(bindings.get('lamp')).toBe(lamp);
        expect(bindings.get('devices')[0]).toBe(lamp);
        expect(Object.isFrozen(lamp)).toBe(false);
    });

    it('apply a member a supertype declares to a value of a type beneath it', () => {
        expect(evaluate('lamp.name', { lamp })).toBe('lamp');
        expect(evaluate('room.devices { name = it.name }', { room: kitchen })).toEqual([{ name: 'lamp' }, { name: 'heater' }]);
    });

    it('expose a binding\'s declared type alone until a cast narrows it, the value checked by its membership', () => {
        const registry = home();
        const bindings = registry.bind({ device: lamp }, { types: { device: 'Device' } });

        expect(bindings.typeOf('device')).toBe('Device');
        expect(getError(() => registry.resolve('device.brightness', bindings))).toMatchObject({ code: 'LEXICA3001' });
        expect(registry.resolve('(device as Light).brightness', bindings).createEvaluator(bindings).evaluate().value).toBe(40);
        expect(registry.bind({ device: lamp }, { types: { device: 'home.Device' } }).typeOf('device')).toBe('Device');
    });

    it('merge two types of one hierarchy to the nearest supertype they share, and refuse two hierarchies', () => {
        expect(evaluate('let d = if flag then lamp else heater end\nreturn d.name', { flag: true, lamp, heater })).toBe('lamp');
        expect(getError(() => home().resolve('let d = if flag then lamp else heater end\nreturn d.brightness', { flag: true, lamp, heater }))).toMatchObject({ code: 'LEXICA3001' });
        expect(getError(() => home().resolve('if flag then lamp else room end', { flag: true, lamp, room: kitchen }))).toBeInstanceOf(LexicaError);
    });

    it('compare two references of one hierarchy by their identity, and refuse two of different hierarchies', () => {
        expect(evaluate('lamp == other', { lamp, other: lamp })).toBe(true);
        expect(evaluate('lamp == other', { lamp, other: new Light('lamp') })).toBe(false);
        expect(evaluate('room.device("lamp") == lamp', { room: kitchen, lamp })).toBe(true);
        expect(getError(() => home().resolve('lamp == room', { lamp, room: kitchen }))).toMatchObject({ code: 'LEXICA3030' });
    });

    it('cast within a hierarchy, checked by the destination\'s membership, an attempt answering null for a value of another type', () => {
        expect(evaluate('(room.device("lamp") as Light)?.brightness', { room: kitchen })).toBe(40);
        expect(evaluate('(try room.device("heater") as Light) == null', { room: kitchen })).toBe(true);
        expect(evaluate('(lamp as Device).name', { lamp })).toBe('lamp');
        expect(evaluate('(nothing as Light) == null', { nothing: null })).toBe(true);
    });

    it('write a binding\'s type in its resolution key by its qualified identity, so two modules\' types of one name keep two keys', () => {
        const office = lexica.createModule('office', { typeOf: value => (value instanceof Device ? 'Device' : null), types: [{ name: 'Device', kind: 'reference', isInstance: value => value instanceof Device }] });

        expect(home().bind({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:home.Device');
        expect(lexica.createRegistry([office]).bind({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:office.Device');
        expect(home().bind({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: home.Device }');
        expect(lexica.createRegistry([office]).bind({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: office.Device }');
    });

    it('check a member\'s answer by its declared type\'s membership, a reference of another type refused', () => {
        const wrong = lexica.createModule('wrong', withHome({ members: [property('lamp', 'String', 'Light', { updates: constant, implementation: () => heater })] }));
        const registry = lexica.createRegistry([wrong]);

        expect(getError(() => registry.resolve('(word.lamp as Light) == null', { word: 'a' }).createEvaluator({ word: 'a' }).evaluate())).toMatchObject({ code: 'LEXICA5006' });
    });
});
