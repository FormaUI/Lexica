/**
 * The specification's examples' vocabulary, as its document sets it out: the modules `Home` and `Energy`, written once, and the home they read, its rooms and devices, a host binds to every example
 */

import { lexica } from '#lexica/lexica.js';
import { Device, Light, Room, Sensor, Thermostat, homeTypeOf, homeTypes } from './home.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = lexica.declarations;

/** A member's updates: how its answer changes, what it reads, the observations covering its changes and its tolerance, where it has one. */
const updates = (changes, reads, observations = [], extras = {}) => ({ changes, reads, ...(observations.length === 0 ? {} : { observations }), ...extras });

/** An observation of the member's receiver, of the type given. */
const ofReceiver = type => ({ type, of: 'receiver' });

const constant = updates('constant', 'fresh');
const placement = updates('observable', 'fresh', [{ type: 'placement', of: 'Home' }]);
const state = (extras = {}) => updates('observable', 'fresh', [ofReceiver('state')], extras);
const climate = updates('observable', 'fresh', [ofReceiver('climate')]);
const meter = (extras = {}) => updates('observable', 'fresh', [ofReceiver('meter')], extras);

/** A Boolean function of the receiver that takes no arguments, as the home's tests are, answering what the receiver's field of its name holds. */
const test = (name, testUpdates) => createFunctionDeclaration(name, 'Boolean', { updates: testUpdates, parameters: [], impl: ({ receiver }) => receiver[name] === true });

/** A property answering the receiver's field of its name, null where it holds none. */
const field = (name, result, fieldUpdates) => createPropertyDeclaration(name, result, { updates: fieldUpdates, impl: ({ receiver }) => receiver[name] ?? null });

/**
 * The module `Home`: its rooms and devices, lights, thermostats and sensors among them, each a reference type with identity, and its structured types of data, `Climate`, `Change` and `Motion`; its members, its tests, its
 * observation types and the target `Home`; the host calls `on`, `dim` and `hold`; and the selector `event`. Its module members read the home given.
 */
export const createExamplesHome = home => lexica.createModule('Home', {
    typeOf: homeTypeOf,
    types: [
        ...homeTypes.map(type => ({ ...type, members: HOME_MEMBERS[type.name] })),
        { name: 'Climate', kind: 'structured', members: [createPropertyDeclaration('temperature', 'Number'), createPropertyDeclaration('humidity', 'Number')] },
        { name: 'Change', kind: 'structured', members: [createPropertyDeclaration('setting', 'String'), createPropertyDeclaration('value', 'String?')] },
        { name: 'Motion', kind: 'structured', members: [createPropertyDeclaration('at', 'Number'), createPropertyDeclaration('strength', 'Number')] },
    ],
    members: [
        createPropertyDeclaration('rooms', 'List<Room>', { updates: placement, impl: () => home.rooms }),
        createPropertyDeclaration('now', 'Number', { updates: updates('unobserved', 'fresh'), impl: () => home.now }),
    ],
    observationTypes: [
        { name: 'placement', contract: 'invalidation' },
        { name: 'state', contract: 'invalidation' },
        { name: 'climate', contract: 'invalidation' },
        { name: 'presence', contract: 'invalidation' },
        { name: 'reading', contract: 'maintained', impl: () => ({ stop: () => {}, sample: () => ({ pending: false, value: null }) }) },
    ],
    observationTargets: [{ name: 'Home' }],
    typeSelectors: [{ name: 'event' }],
    mappings: [
        { selector: 'event', key: 'change', type: 'Change' },
        { selector: 'event', key: 'motion', type: 'Motion' },
    ],
});

/** The members each of the home's reference types declares within it, by the type's name. */
const HOME_MEMBERS = {
    Room: [
        field('name', 'String', constant),
        field('devices', 'List<Device>', placement),
        field('floorArea', 'Number', constant),
        field('climate', 'Climate?', climate),
        field('highestTemperature', 'Number?', updates('observable', 'captured', [ofReceiver('climate')], { tolerance: 0.5 })),
        createFunctionDeclaration('device', 'Device?', { updates: placement, parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ receiver, args }) => receiver.devices.find(device => device.name === args.name) ?? null }),
        test('occupied', updates('observable', 'fresh', [ofReceiver('presence')])),
        test('reserved', updates('observable', 'fresh', [ofReceiver('presence')])),
    ],
    Device: [
        field('name', 'String', constant),
        field('room', 'Room', placement),
        field('power', 'Number', state({ tolerance: 1 })),
        field('battery', 'Number?', updates('partly-observable', 'fresh', [ofReceiver('state')], { misses: "the drain between the device's reports", tolerance: 1 })),
        createIndexerDeclaration('setting', 'String?', { updates: state(), parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ receiver, args }) => receiver.settings?.[args.name] ?? null }),
        createIndexerDeclaration(null, 'String?', { updates: state(), parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ receiver, args }) => receiver.settings?.[args.name] ?? null }),
        test('active', state()),
        test('offline', updates('partly-observable', 'fresh', [ofReceiver('state')], { misses: 'a device that stops reporting before its timeout' })),
        test('batteryPowered', constant),
        test('dimmable', constant),
        createFunctionDeclaration('on', '@selected', { invokedBy: 'host', parameters: [createValueParameterDeclaration('type', 'String', { fixed: true, selects: 'type', selector: 'event' })] }),
    ],
    Light: [
        field('brightness', 'Number', state({ tolerance: 1 })),
        createFunctionDeclaration('dim', 'Number', { invokedBy: 'host', arguments: 'options', parameters: [createValueParameterDeclaration('to', 'Number', { default: 0 })] }),
    ],
    Thermostat: [
        field('target', 'Number', state()),
        createFunctionDeclaration('hold', undefined, { invokedBy: 'host', arguments: 'options', parameters: [createValueParameterDeclaration('target', 'Number'), createValueParameterDeclaration('until', 'Number?', { default: null })] }),
    ],
    Sensor: [
        createPropertyDeclaration('temperature', 'Number?', { updates: updates('observable', 'maintained', [ofReceiver('reading')], { tolerance: 0.5 }), impl: ({ samples: [reading] }) => reading ?? null }),
    ],
};

/**
 * The module `Energy`: its extension `Device` of the home's devices, their usage, the power their meter measures and their meter; the reference type `Meter`, every device as its meter sees it, with its declared cast to
 * the home's `Device`; and its observation type `meter`.
 */
export const createExamplesEnergy = () => lexica.createModule('Energy', {
    types: [
        { name: 'Meter', kind: 'reference', isInstance: value => value instanceof Device, members: [{ kind: 'operator', name: 'cast', result: 'Home.Device' }] },
        {
            name: 'Device',
            kind: 'extension',
            target: 'Home.Device',
            members: [
                createPropertyDeclaration('usage', 'Number', { updates: meter({ tolerance: 0.1 }), impl: ({ receiver }) => receiver.usage ?? 0 }),
                createPropertyDeclaration('power', 'Number', { updates: meter({ tolerance: 1 }), impl: ({ receiver }) => receiver.meteredPower ?? receiver.power }),
                createPropertyDeclaration('meter', 'Meter', { updates: constant, impl: ({ receiver }) => receiver }),
            ],
        },
    ],
    observationTypes: [{ name: 'meter', contract: 'invalidation' }],
});

/**
 * The home the examples read: a living room, occupied, of a lamp whose `level` setting is "40", a heater and a sensor reporting 20.5 degrees, and a bedroom of a bedside light and no sensor, so no climate; with the
 * bindings each example's names suggest, each of the type the examples' vocabulary gives it.
 */
export const createExamplesFixtures = () => {
    const lamp = Object.assign(new Light('lamp'), { power: 60, brightness: 70, settings: { level: '40', mode: 'eco', label: 'Reading lamp', 'night-mode': 'true' }, active: true, dimmable: true, usage: 0.4 });
    const heater = Object.assign(new Thermostat('heater'), { power: 1500, target: 21, settings: { mode: 'eco' }, active: true, usage: 6.2 });
    const sensor = Object.assign(new Sensor('sensor'), { power: 1, battery: 80, batteryPowered: true, temperature: 20.5, active: true });
    const bedside = Object.assign(new Light('bedside'), { power: 40, brightness: 0, settings: {}, dimmable: true });
    const living = Object.assign(new Room('living', [lamp, heater, sensor]), { floorArea: 24, climate: { temperature: 20.5, humidity: 40 }, occupied: true, reserved: false });
    const bedroom = Object.assign(new Room('bedroom', [bedside]), { floorArea: 14, climate: null, occupied: false, reserved: true });

    [lamp, heater, sensor].forEach(device => Object.assign(device, { room: living }));
    bedside.room = bedroom;

    const home = { rooms: [living, bedroom], now: 1700000000 };
    const values = {
        room: living,
        device: lamp,
        light: lamp,
        thermostat: heater,
        sensor,
        rooms: home.rooms,
        name: 'lamp',
        property: null,
        metered: true,
        limit: 100,
        preferred: lamp,
        fallback: heater,
        lamp,
        living,
        bedroom,
        mode: 'eco',
        left: lamp,
        right: heater,
        count: 3,
        busy: false,
        outside: 12,
        rows: [{ visible: true }, { visible: false }, { visible: true }],
    };
    const types = { room: 'Home.Room', device: 'Home.Device', light: 'Home.Light', thermostat: 'Home.Thermostat', sensor: 'Home.Sensor', preferred: 'Home.Device', fallback: 'Home.Device', left: 'Home.Device', right: 'Home.Device', lamp: 'Home.Light', living: 'Home.Room', bedroom: 'Home.Room' };

    return { home, values, types };
};
