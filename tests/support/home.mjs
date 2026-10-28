/**
 * The home the specification's examples describe, as the tests' reference types: rooms and the devices in them, lights and thermostats among them, each a value with identity its module recognizes
 */

/** A room, holding the devices in it. */
export class Room {
    constructor(name, devices = []) {
        this.name = name;
        this.devices = devices;
    }
}

/** A device, named. */
export class Device {
    constructor(name) {
        this.name = name;
    }
}

/** A light, a device that dims. */
export class Light extends Device {}

/** A thermostat, a device that keeps a temperature. */
export class Thermostat extends Device {}

/** A sensor, a device that reports temperature and motion. */
export class Sensor extends Device {}

/** The home's reference types, a light, a thermostat and a sensor each beneath a device, as a module declares them. */
export const homeTypes = Object.freeze([
    { name: 'Room', kind: 'reference', isInstance: value => value instanceof Room },
    { name: 'Device', kind: 'reference', isInstance: value => value instanceof Device },
    { name: 'Light', kind: 'reference', supertype: 'Device', isInstance: value => value instanceof Light },
    { name: 'Thermostat', kind: 'reference', supertype: 'Device', isInstance: value => value instanceof Thermostat },
    { name: 'Sensor', kind: 'reference', supertype: 'Device', isInstance: value => value instanceof Sensor },
]);

/** The home's recognition of a value: the most specific of its types the value is of, or null. */
export const homeTypeOf = value => {
    if (value instanceof Light) {
        return 'Light';
    }

    if (value instanceof Thermostat) {
        return 'Thermostat';
    }

    if (value instanceof Sensor) {
        return 'Sensor';
    }

    if (value instanceof Device) {
        return 'Device';
    }

    return value instanceof Room ? 'Room' : null;
};

/** A module's contents declaring the home's types and its recognition, with the contents given, their own types after the home's; each of the home's types holds the members given for it by its name, which take it as their receiver. */
export const withHome = (contents = {}, membersByType = {}) => ({
    ...contents,
    typeOf: homeTypeOf,
    types: [...homeTypes.map(type => (membersByType[type.name] === undefined ? type : { ...type, members: membersByType[type.name] })), ...(contents.types ?? [])],
});
