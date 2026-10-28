import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Device, Light, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { extensionDeclaration } from './support/declarations.mjs';
import { importsOf } from './support/pipeline.mjs';

const { createPropertyDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = lexica.declarations;

/** A property answering the text given, internal where it says so. */
const answering = (name, answer, { internal = false } = {}) => ({ ...createPropertyDeclaration(name, 'String', { updates: constantUpdates, impl: () => answer }), ...(internal ? { internal } : {}) });

/** An unnamed indexer answering the text given. */
const indexing = answer => createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: () => answer });

/** The home, which owns its devices: a device's power, its level, a secret no script reaches and its unnamed indexer, and a light's glow. */
const createHome = () => lexica.createModule('Home', withHome({}, {
    Device: [answering('power', 'home'), answering('level', 'home device'), answering('secret', 'home', { internal: true }), indexing('home')],
    Light: [answering('glow', 'home light')],
}));

/** Energy, which extends the home's devices: their power, their usage, a secret and an unnamed indexer of its own. */
const createEnergy = () => lexica.createModule('Energy', { types: [extensionDeclaration('Device', 'Home.Device', [answering('power', 'energy'), answering('usage', 'energy'), answering('secret', 'energy'), indexing('energy')])] });

/** Solar, which extends the target given, the home's lights unless another is given: its usage, its level, and an unnamed indexer of its own. */
const createSolar = (target = 'Home.Light') => lexica.createModule('Solar', { types: [extensionDeclaration('Panel', target, [answering('usage', 'solar'), answering('level', 'solar'), indexing('solar')])] });

const values = { device: new Device('fan'), light: new Light('lamp'), thermostat: new Thermostat('heater'), numbers: [1, 2] };

/** What the text evaluates to against a registry of the modules given, in the order given, with the values given bound. */
const evaluateWith = (modules, text, bound = values) => {
    const registry = lexica.createRegistry(modules);
    const bindings = registry.createBindings(bound);

    return registry.resolve(text, bindings, { imports: importsOf(modules) }).createEvaluator(bindings).evaluate().value;
};

/** The error resolving the text against a registry of the modules given throws, with the values given bound. */
const refusalWith = (modules, text, bound = values) => errorThrownBy(() => lexica.createRegistry(modules).resolve(text, bound, { imports: importsOf(modules) }));

describe('the selection of a member', () => {
    it('takes the owner\'s applicable member over every extension, whatever order the modules registered in', () => {
        expect(evaluateWith([createHome(), createEnergy()], 'device.power')).toBe('home');
        expect(evaluateWith([createHome(), createEnergy()], 'device["mode"]')).toBe('home');
    });

    it('takes the owner\'s member on a supertype it owns with the owner\'s priority, which an extension of a more specific receiver never defeats', () => {
        expect(evaluateWith([createHome(), createSolar()], '{ level = light.level, glow = light.glow }')).toEqual({ level: 'home device', glow: 'home light' });
    });

    it('takes the applicable extension whose target is more specific than every other\'s where the owner declares none, whatever order the modules registered in', () => {
        for (const modules of [[createHome(), createEnergy(), createSolar()], [createHome(), createSolar(), createEnergy()]]) {
            expect(evaluateWith(modules, '{ light = light.usage, thermostat = thermostat.usage }')).toEqual({ light: 'solar', thermostat: 'energy' });
        }
    });

    it('registers extensions of one target, and refuses an access both apply to, naming the modules and the extension accesses that select each', () => {
        const modules = [createHome(), createEnergy(), createSolar('Home.Device')];

        expect(refusalWith(modules, 'device.usage')).toMatchObject({
            code: 'LEXICA3024',
            message: expect.stringContaining("'usage' on Device is ambiguous between the modules 'Energy' and 'Solar': write 'device:Energy.Device.usage' or 'device:Solar.Panel.usage' to select one"),
        });
        expect(refusalWith([createHome(), lexica.createModule('Energy', { types: [extensionDeclaration('Device', 'Home.Device', [indexing('energy')])] }), createSolar('Home.Device')], 'device.secret')).toMatchObject({ code: 'LEXICA3023' });
        expect(evaluateWith([createHome(), createEnergy(), createSolar('Home.Device')], 'device.power')).toBe('home');
    });

    it('reads Lexica\'s own members of its own types, whatever an extension declares', () => {
        const counting = lexica.createModule('Counting', { types: [extensionDeclaration('Numbers', 'List<Number>', [answering('count', 'counting')])] });

        expect(evaluateWith([counting], 'numbers.count', { numbers: [1, 2] })).toBe(2);
    });

    it('selects an unnamed indexer as it selects a member: the owner\'s first, an extension\'s where it declares none, and none among competing extensions', () => {
        const solarAndEnergy = [createHome(), createEnergy(), createSolar()];

        expect(evaluateWith(solarAndEnergy, '{ light = light["mode"], thermostat = thermostat["mode"] }')).toEqual({ light: 'home', thermostat: 'home' });
        expect(evaluateWith([lexica.createModule('Home', withHome()), createEnergy(), createSolar()], '{ light = light["mode"], thermostat = thermostat["mode"] }')).toEqual({ light: 'solar', thermostat: 'energy' });
        expect(refusalWith([lexica.createModule('Home', withHome()), createEnergy(), createSolar('Home.Device')], 'device["mode"]')).toMatchObject({ code: 'LEXICA3024', message: expect.stringContaining("write 'device:Energy.Device[…]' or 'device:Solar.Panel[…]' to select one") });
    });

    it('gives a member another module declares on a supertype no priority over the extensions, the most specific of them selected', () => {
        class Gadget {}
        class Lamp extends Gadget {}

        const gear = lexica.createModule('Gear', { types: [{ name: 'Gadget', kind: 'reference', isInstance: value => value instanceof Gadget, members: [answering('tag', 'gear')] }] });
        const lamps = lexica.createModule('Lamps', { typeOf: value => (value instanceof Lamp ? 'Lamp' : null), types: [{ name: 'Lamp', kind: 'reference', supertype: 'Gear.Gadget', isInstance: value => value instanceof Lamp }] });
        const shine = lexica.createModule('Shine', { types: [extensionDeclaration('Lamps', 'Lamps.Lamp', [answering('tag', 'shine')])] });
        const registry = lexica.createRegistry([gear, lamps, shine]);
        const bindings = registry.createBindings({ lamp: new Lamp() });

        expect(registry.resolve('lamp.tag', bindings).createEvaluator(bindings).evaluate().value).toBe('shine');
    });
});

describe('an internal declaration', () => {
    it('is no candidate, so an accessible extension resolves where the owner\'s member of its name is internal', () => {
        expect(evaluateWith([createHome(), createEnergy()], 'device.secret')).toBe('energy');
    });

    it('is refused where it alone applies, through any form, as if no declaration of its name were accessible', () => {
        const hidden = lexica.createModule('Hidden', {
            types: [{ name: 'Vault', kind: 'reference', isInstance: () => false, internal: true }],
            members: [answering('code', 'hidden', { internal: true })],
        });

        expect(refusalWith([createHome()], 'device.secret')).toMatchObject({ code: 'LEXICA3023', message: expect.stringContaining("'secret' on Device is internal to the module 'Home', which no script reaches") });
        expect(refusalWith([createHome()], 'Home.secret(device)')).toMatchObject({ code: 'LEXICA3023' });
        expect(refusalWith([hidden], 'Hidden.code', {})).toMatchObject({ code: 'LEXICA3023' });
        expect(refusalWith([createHome(), hidden], '(device as Vault) == null')).toMatchObject({ code: 'LEXICA3023', message: expect.stringContaining("The type 'Vault' is internal to the module 'Hidden'") });
    });
});
