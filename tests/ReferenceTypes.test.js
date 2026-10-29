import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { extensionDeclaration } from './support/declarations.mjs';
import { Device, Light, Room, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { evaluateWithCreatedBindings, createImportingRegistry } from './support/pipeline.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = nexo.declarations;

/** The home's module: a device's name, which a light and a thermostat read as devices, a light's brightness, a room's devices and the device a room names. */
const createHome = () => nexo.createModule('home', withHome({}, {
    Device: [createPropertyDeclaration('name', 'String', { updates: constantUpdates, impl: ({ receiver }) => receiver.name })],
    Light: [createPropertyDeclaration('brightness', 'Number', { updates: constantUpdates, impl: () => 40 })],
    Room: [
        createPropertyDeclaration('devices', 'List<Device>', { updates: constantUpdates, impl: ({ receiver }) => receiver.devices }),
        createFunctionDeclaration('device', 'Device?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ receiver, args }) => receiver.devices.find(device => device.name === args.name) ?? null }),
    ],
}));

const lamp = new Light('lamp');
const heater = new Thermostat('heater');
const kitchen = new Room('kitchen', [lamp, heater]);

/** A registry of the home. */
const home = () => createImportingRegistry([createHome()]);

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
        expect(errorThrownBy(() => registry.resolve('device.brightness', bindings))).toMatchObject({ code: 'NEXO3001' });
        expect(registry.resolve('(device as Light).brightness', bindings).createEvaluator(bindings).evaluate().value).toBe(40);
        expect(registry.createBindings({ device: lamp }, { types: { device: 'home.Device' } }).getType('device')).toBe('Device');
    });

    it('merge two types of one hierarchy to the nearest supertype they share, and refuse two hierarchies', () => {
        expect(evaluate('let d = if flag then lamp else heater end\nreturn d.name', { flag: true, lamp, heater })).toBe('lamp');
        expect(errorThrownBy(() => home().resolve('let d = if flag then lamp else heater end\nreturn d.brightness', { flag: true, lamp, heater }))).toMatchObject({ code: 'NEXO3001' });
        expect(errorThrownBy(() => home().resolve('if flag then lamp else room end', { flag: true, lamp, room: kitchen }))).toBeInstanceOf(NexoError);
    });

    it('compare two references of one hierarchy by their identity, and refuse two of different hierarchies', () => {
        expect(evaluate('lamp == other', { lamp, other: lamp })).toBe(true);
        expect(evaluate('lamp == other', { lamp, other: new Light('lamp') })).toBe(false);
        expect(evaluate('room.device("lamp") == lamp', { room: kitchen, lamp })).toBe(true);
        expect(errorThrownBy(() => home().resolve('lamp == room', { lamp, room: kitchen }))).toMatchObject({ code: 'NEXO3030' });
    });

    it('cast within a hierarchy, checked by the destination\'s membership, an attempt answering null for a value of another type', () => {
        expect(evaluate('(room.device("lamp") as Light)?.brightness', { room: kitchen })).toBe(40);
        expect(evaluate('(try room.device("heater") as Light) == null', { room: kitchen })).toBe(true);
        expect(evaluate('(lamp as Device).name', { lamp })).toBe('lamp');
        expect(evaluate('(nothing as Light) == null', { nothing: null })).toBe(true);
    });

    it('write a binding\'s type in its resolution key by its qualified identity, so two modules\' types of one name keep two keys', () => {
        const office = nexo.createModule('office', { typeOf: value => (value instanceof Device ? 'Device' : null), types: [{ name: 'Device', kind: 'reference', isInstance: value => value instanceof Device }] });

        expect(home().createBindings({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:home.Device');
        expect(createImportingRegistry([office]).createBindings({ lamp: new Device('lamp') }).resolutionKey).toBe('lamp:office.Device');
        expect(home().createBindings({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: home.Device }');
        expect(createImportingRegistry([office]).createBindings({ hall: { lamp: new Device('lamp') } }).resolutionKey).toBe('hall:{ lamp: office.Device }');
    });

    it('register one module\'s members of one name on related receivers, an access resolving through its receiver\'s type, the most specific declaration hiding one above it', () => {
        const key = createValueParameterDeclaration('key', 'String');
        const active = nexo.createModule('home', withHome({}, {
            Device: [
                createPropertyDeclaration('active', 'Boolean', { updates: constantUpdates, impl: () => false }),
                createIndexerDeclaration(null, 'String?', { updates: constantUpdates, parameters: [key], impl: () => 'device' }),
            ],
            Light: [
                createPropertyDeclaration('active', 'Boolean', { updates: constantUpdates, impl: () => true }),
                createIndexerDeclaration(null, 'String?', { updates: constantUpdates, parameters: [key], impl: () => 'light' }),
            ],
        }));
        const registry = createImportingRegistry([active]);
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
        const settings = (propertyType, indexerType) => createImportingRegistry([nexo.createModule('home', withHome({}, {
            [propertyType]: [createPropertyDeclaration('setting', 'Boolean', { updates: constantUpdates, impl: () => true })],
            [indexerType]: [createIndexerDeclaration('setting', 'String?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: () => 'indexer' })],
        }))]);
        const evaluateWith = (registry, text, values) => registry.resolve(text, values).createEvaluator(values).evaluate().value;

        expect(errorThrownBy(() => settings('Light', 'Device').resolve('lamp.setting["mode"]', { lamp }))).toMatchObject({ code: 'NEXO3012' });
        expect(evaluateWith(settings('Light', 'Device'), 'heater.setting["mode"]', { heater })).toBe('indexer');
        expect(evaluateWith(settings('Device', 'Light'), 'lamp.setting["mode"]', { lamp })).toBe('indexer');
        expect(evaluateWith(settings('Device', 'Light'), 'heater.setting', { heater })).toBe(true);
    });

    it('resolve an empty list by the most specific applicable declaration, and refuse it, naming the competing ones, where none is', () => {
        // One extension for each target, its name declaring the parameter a target writes.
        const totals = (...targets) => createImportingRegistry([nexo.createModule('shop', {
            types: targets.map((target, index) => extensionDeclaration(`Totals${index}${target.includes('<T>') ? '<T>' : ''}`, target, [createPropertyDeclaration('total', 'String', { updates: constantUpdates, impl: () => target })])),
        })]);
        const evaluateWith = (registry, values) => registry.resolve('items.total', values).createEvaluator(values).evaluate().value;
        const refused = errorThrownBy(() => totals('List<Number>', 'List<String>').resolve('items.total', { items: [] }));

        expect(refused).toMatchObject({ code: 'NEXO3024' });
        expect(refused.message).toContain("'total' is declared for List<Number> and List<String>, which List<Never> satisfies, and none of them is more specific than the other");
        expect(evaluateWith(totals('List<Number>', 'List<String>'), { items: [1] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<Number>'), { items: [] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<T>', 'List<Number>'), { items: [] })).toBe('List<Number>');
        expect(evaluateWith(totals('List<T>', 'List<Number>'), { items: ['a'] })).toBe('List<T>');
    });

    it('register a module member beside a receiver\'s member of its name, a qualified call taking the one reading resolution accepts and refused where both are accepted', () => {
        const members = moduleMemberParameter => nexo.createModule('home', withHome({
            members: [createFunctionDeclaration('label', 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('of', moduleMemberParameter)], impl: ({ args }) => `module ${args.of.name ?? args.of}` })],
        }, {
            Room: [createPropertyDeclaration('label', 'String', { updates: constantUpdates, impl: ({ receiver }) => `room ${receiver.name}` })],
        }));
        const evaluateWith = (module, text, values) => createImportingRegistry([module]).resolve(text, values, { imports: ['home'] }).createEvaluator(values).evaluate().value;

        expect(evaluateWith(members('String'), 'home.label(room)', { room: kitchen })).toBe('room kitchen');
        expect(evaluateWith(members('String'), 'home.label(word)', { word: 'hall' })).toBe('module hall');
        expect(errorThrownBy(() => createImportingRegistry([members('Room')]).resolve('import home\nhome.label(room)', { room: kitchen }))).toMatchObject({ code: 'NEXO3024' });
        expect(evaluateWith(members('Room'), 'room.label', { room: kitchen })).toBe('room kitchen');
    });

    it('check a member\'s answer by its declared type\'s membership, a reference of another type refused', () => {
        const wrong = nexo.createModule('wrong', withHome({ types: [extensionDeclaration('StringExtensions', 'String', [createPropertyDeclaration('lamp', 'Light', { updates: constantUpdates, impl: () => heater })])] }));
        const registry = createImportingRegistry([wrong]);

        expect(errorThrownBy(() => registry.resolve('(word.lamp as Light) == null', { word: 'a' }).createEvaluator({ word: 'a' }).evaluate())).toMatchObject({ code: 'NEXO5006' });
    });
});

describe('an internal reference type', () => {
    it('is no type a typeOf names, which exposes a value to scripts as a public type alone: naming one is a fault of its module', () => {
        const lamps = nexo.createModule('lamps', { typeOf: () => 'Lamp', types: [{ name: 'Lamp', kind: 'reference', isInstance: () => true, internal: true }] });

        expect(errorThrownBy(() => createImportingRegistry([lamps]).createBindings({ lamp }))).toMatchObject({ code: 'NEXO5002', kind: 'evaluation', message: expect.stringContaining('the internal type Lamp, which no script names') });
    });
});

describe('members declared within their reference type', () => {
    const glow = createPropertyDeclaration('glow', 'String', { updates: constantUpdates, impl: ({ receiver }) => `${receiver.name} glows` });

    /** A module of lamps, a reference type holding the members given, and the declaration keys given. */
    const lamps = (members, type = {}) => nexo.createModule('lamps', {
        typeOf: value => (value instanceof Light ? 'Lamp' : null),
        types: [{ name: 'Lamp', kind: 'reference', isInstance: value => value instanceof Light, members, ...type }],
    });

    it('take their type as their receiver, and are reached through their module\'s qualified form', () => {
        const dim = createPropertyDeclaration('dim', 'Number', { updates: constantUpdates, impl: () => 30 });
        const registry = createImportingRegistry([lamps([glow, dim])]);
        const resolution = registry.resolve('import lamps\n{ glow = lamp.glow, dim = lamp.dim, qualified = lamps.glow(lamp) }', { lamp });

        expect(resolution.createEvaluator({ lamp }).evaluate().value).toEqual({ glow: 'lamp glows', dim: 30, qualified: 'lamp glows' });
        expect(resolution.usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Lamp.glow', 'Lamp.dim', 'Lamp.glow']);
        expect(registry.getDeclaringModuleName(resolution.usedDeclarations[0].declaration)).toBe('lamps');
    });

    it('collide with a member of their name within their type, the later refused at its name', () => {
        const otherGlow = createPropertyDeclaration('glow', 'String', { updates: constantUpdates, impl: () => 'other' });

        expect(errorThrownBy(() => createImportingRegistry([lamps([glow, otherGlow])]))).toMatchObject({ code: 'NEXO4029', location: { module: 'lamps', type: 'Lamp', declaration: 'glow', declarationKey: 'name' } });
    });

    it('read their notations through their type\'s import, a notation naming no type refused at their type', () => {
        const room = createPropertyDeclaration('room', 'Room?', { updates: constantUpdates, impl: () => null });
        // A home declaring rooms, which recognizes no value, so the lamp is the lamps' alone.
        const rooms = () => nexo.createModule('home', { types: [{ name: 'Room', kind: 'reference', isInstance: value => value instanceof Room }] });

        expect(createImportingRegistry([rooms(), lamps([room], { import: ['home'] })]).resolve('lamp.room == null', { lamp }).usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Lamp.room']);
        expect(errorThrownBy(() => createImportingRegistry([rooms(), lamps([room])]))).toMatchObject({ code: 'NEXO4049', location: { module: 'lamps', type: 'Lamp', declaration: 'room' } });
    });
});
