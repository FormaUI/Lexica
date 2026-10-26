import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { Device, Light, Room, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { evaluateWithCreatedBindings } from './support/pipeline.mjs';

const { property, function: fn, valueParameter } = lexica.declarations;

/** The home's module: a device's name, which a light and a thermostat read as devices, a light's brightness, a room's devices and the device a room names. */
const createHome = () => lexica.createModule('home', withHome({
    members: [
        property('name', 'Device', 'String', { updates: constantUpdates, implementation: ({ receiver }) => receiver.name }),
        property('brightness', 'Light', 'Number', { updates: constantUpdates, implementation: () => 40 }),
        property('devices', 'Room', 'List<Device>', { updates: constantUpdates, implementation: ({ receiver }) => receiver.devices }),
        fn('device', 'Room', 'Device?', { updates: constantUpdates, parameters: [valueParameter('name', 'String')], implementation: ({ receiver, args }) => receiver.devices.find(device => device.name === args.name) ?? null }),
    ],
}));

const lamp = new Light('lamp');
const heater = new Thermostat('heater');
const kitchen = new Room('kitchen', [lamp, heater]);

/** A registry of the home. */
const home = () => lexica.createRegistry([createHome()]);

/** What the text evaluates to, bound to the values given against a registry of the home. */
const evaluate = (text, values) => evaluateWithCreatedBindings([createHome()], text, values);

describe('reference types', () => {
    it('type a binding as the most specific type its module recognizes, and keep the reference itself', () => {
        const bindings = home().createBindings({ lamp, room: kitchen, devices: [lamp, heater], lights: [lamp, null] });

        expect(['lamp', 'room', 'devices', 'lights'].map(name => bindings.getType(name))).toEqual(['Light', 'Room', 'List<Device>', 'List<Light?>']);
        expect(bindings.readValue('lamp')).toBe(lamp);
        expect(bindings.readValue('devices')[0]).toBe(lamp);
        expect(Object.isFrozen(lamp)).toBe(false);
    });

    it('apply a member a supertype declares to a value of a type beneath it', () => {
        expect(evaluate('lamp.name', { lamp })).toBe('lamp');
        expect(evaluate('room.devices { name = it.name }', { room: kitchen })).toEqual([{ name: 'lamp' }, { name: 'heater' }]);
    });

    it('expose a binding\'s declared type alone until a cast narrows it, the value checked by its membership', () => {
        const registry = home();
        const bindings = registry.createBindings({ device: lamp }, { types: { device: 'Device' } });

        expect(bindings.getType('device')).toBe('Device');
        expect(errorThrownBy(() => registry.resolve('device.brightness', bindings))).toMatchObject({ code: 'LEXICA3001' });
        expect(registry.resolve('(device as Light).brightness', bindings).createEvaluator(bindings).evaluate().value).toBe(40);
        expect(registry.createBindings({ device: lamp }, { types: { device: 'home.Device' } }).getType('device')).toBe('Device');
    });

    it('merge two types of one hierarchy to the nearest supertype they share, and refuse two hierarchies', () => {
        expect(evaluate('let d = if flag then lamp else heater end\nreturn d.name', { flag: true, lamp, heater })).toBe('lamp');
        expect(errorThrownBy(() => home().resolve('let d = if flag then lamp else heater end\nreturn d.brightness', { flag: true, lamp, heater }))).toMatchObject({ code: 'LEXICA3001' });
        expect(errorThrownBy(() => home().resolve('if flag then lamp else room end', { flag: true, lamp, room: kitchen }))).toBeInstanceOf(LexicaError);
    });

    it('compare two references of one hierarchy by their identity, and refuse two of different hierarchies', () => {
        expect(evaluate('lamp == other', { lamp, other: lamp })).toBe(true);
        expect(evaluate('lamp == other', { lamp, other: new Light('lamp') })).toBe(false);
        expect(evaluate('room.device("lamp") == lamp', { room: kitchen, lamp })).toBe(true);
        expect(errorThrownBy(() => home().resolve('lamp == room', { lamp, room: kitchen }))).toMatchObject({ code: 'LEXICA3030' });
    });

    it('cast within a hierarchy, checked by the destination\'s membership, an attempt answering null for a value of another type', () => {
        expect(evaluate('(room.device("lamp") as Light)?.brightness', { room: kitchen })).toBe(40);
        expect(evaluate('(try room.device("heater") as Light) == null', { room: kitchen })).toBe(true);
        expect(evaluate('(lamp as Device).name', { lamp })).toBe('lamp');
        expect(evaluate('(nothing as Light) == null', { nothing: null })).toBe(true);
    });

    it('write a binding\'s type in its resolution key by its qualified identity, so two modules\' types of one name keep two keys', () => {
        const office = lexica.createModule('office', { typeOf: value => (value instanceof Device ? 'Device' : null), types: [{ name: 'Device', kind: 'reference', isInstance: value => value instanceof Device }] });

        expect(home().createBindings({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:home.Device');
        expect(lexica.createRegistry([office]).createBindings({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:office.Device');
        expect(home().createBindings({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: home.Device }');
        expect(lexica.createRegistry([office]).createBindings({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: office.Device }');
    });

    it('register one module\'s members of one name on related receivers, an access resolving through its receiver\'s type, the most specific declaration hiding one above it', () => {
        const active = lexica.createModule('home', withHome({
            members: [
                property('active', 'Device', 'Boolean', { updates: constantUpdates, implementation: () => false }),
                property('active', 'Light', 'Boolean', { updates: constantUpdates, implementation: () => true }),
                fn('setting', 'Device', 'String?', { syntax: 'indexer', isDefault: true, updates: constantUpdates, parameters: [valueParameter('key', 'String')], implementation: () => 'device' }),
                fn('lightSetting', 'Light', 'String?', { syntax: 'indexer', isDefault: true, updates: constantUpdates, parameters: [valueParameter('key', 'String')], implementation: () => 'light' }),
            ],
        }));
        const registry = lexica.createRegistry([active]);
        const evaluateHere = (text, values) => registry.resolve(text, values).createEvaluator(values).evaluate().value;

        expect(evaluateHere('heater.active', { heater })).toBe(false);
        expect(evaluateHere('device.active', registry.createBindings({ device: lamp }, { types: { device: 'Device' } }))).toBe(false);
        expect(evaluateHere('lamp.active', { lamp })).toBe(true);
        // A member is selected by its receiver's static type, so a light held as a device reads the device's member: hiding, never a dynamic override.
        expect(evaluateHere('devices { active = it.active }', { devices: [lamp, heater] })).toEqual([{ active: false }, { active: false }]);
        expect(evaluateHere('heater["mode"]', { heater })).toBe('device');
        expect(evaluateHere('lamp["mode"]', { lamp })).toBe('light');
    });

    it('read brackets after a name by the most specific member of it, a property hiding a named indexer above it and an indexer one', () => {
        const settings = (propertyTarget, indexerTarget) => lexica.createRegistry([lexica.createModule('home', withHome({
            members: [
                property('setting', propertyTarget, 'String', { updates: constantUpdates, implementation: () => 'property' }),
                fn('setting', indexerTarget, 'String?', { syntax: 'indexer', updates: constantUpdates, parameters: [valueParameter('key', 'String')], implementation: () => 'indexer' }),
            ],
        }))]);
        const evaluateWith = (registry, text, values) => registry.resolve(text, values).createEvaluator(values).evaluate().value;

        expect(errorThrownBy(() => settings('Light', 'Device').resolve('lamp.setting["mode"]', { lamp }))).toMatchObject({ code: 'LEXICA3012' });
        expect(evaluateWith(settings('Light', 'Device'), 'heater.setting["mode"]', { heater })).toBe('indexer');
        expect(evaluateWith(settings('Device', 'Light'), 'lamp.setting["mode"]', { lamp })).toBe('indexer');
        expect(evaluateWith(settings('Device', 'Light'), 'heater.setting', { heater })).toBe('property');
    });

    it('resolve an empty list by the most specific applicable declaration, and refuse it, naming the competing ones, where none is', () => {
        const totals = (...targets) => lexica.createRegistry([lexica.createModule('shop', {
            members: targets.map(target => property('total', target, 'String', { updates: constantUpdates, implementation: () => target })),
        })]);
        const evaluateWith = (registry, values) => registry.resolve('items.total', values).createEvaluator(values).evaluate().value;
        const refused = errorThrownBy(() => totals('List<Number>', 'List<String>').resolve('items.total', { items: [] }));

        expect(refused).toMatchObject({ code: 'LEXICA3024' });
        expect(refused.message).toContain("'total' is declared for List<Number> and List<String>, which List<Never> satisfies, and none of them is more specific than the other");
        expect(evaluateWith(totals('List<Number>', 'List<String>'), { items: [1] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<Number>'), { items: [] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<T>', 'List<Number>'), { items: [] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<T>', 'List<Number>'), { items: ['a'] })).toBe('List<T>');
    });

    it('register a module member beside a receiver\'s member of its name, a qualified call taking the one reading resolution accepts and refused where both are accepted', () => {
        const members = moduleMemberParameter => lexica.createModule('home', withHome({
            members: [
                property('label', 'Room', 'String', { updates: constantUpdates, implementation: ({ receiver }) => `room ${receiver.name}` }),
                fn('label', null, 'String', { updates: constantUpdates, parameters: [valueParameter('of', moduleMemberParameter)], implementation: ({ args }) => `module ${args.of.name ?? args.of}` }),
            ],
        }));
        const evaluateWith = (module, text, values) => lexica.createRegistry([module]).resolve(text, values).createEvaluator(values).evaluate().value;

        expect(evaluateWith(members('String'), 'home.label(room)', { room: kitchen })).toBe('room kitchen');
        expect(evaluateWith(members('String'), 'home.label(word)', { word: 'hall' })).toBe('module hall');
        expect(errorThrownBy(() => lexica.createRegistry([members('Room')]).resolve('home.label(room)', { room: kitchen }))).toMatchObject({ code: 'LEXICA3024' });
        expect(evaluateWith(members('Room'), 'room.label', { room: kitchen })).toBe('room kitchen');
    });

    it('check a member\'s answer by its declared type\'s membership, a reference of another type refused', () => {
        const wrong = lexica.createModule('wrong', withHome({ members: [property('lamp', 'String', 'Light', { updates: constantUpdates, implementation: () => heater })] }));
        const registry = lexica.createRegistry([wrong]);

        expect(errorThrownBy(() => registry.resolve('(word.lamp as Light) == null', { word: 'a' }).createEvaluator({ word: 'a' }).evaluate())).toMatchObject({ code: 'LEXICA5006' });
    });
});
