import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { Device, Light, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { extensionDeclaration } from './support/declarations.mjs';
import { importsOf, createImportingRegistry } from './support/pipeline.mjs';

const { createPropertyDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = nexo.declarations;

/** A property answering the text given, internal where it says so. */
const answering = (name, answer, { internal = false } = {}) => ({ ...createPropertyDeclaration(name, 'String', { updates: constantUpdates, impl: () => answer }), ...(internal ? { internal } : {}) });

/** An unnamed indexer answering the text given. */
const indexing = answer => createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: () => answer });

/** The home, which owns its devices: a device's power, its level, a secret no script reaches and its unnamed indexer, and a light's glow. */
const createHome = () => nexo.createModule('Home', withHome({}, {
    Device: [answering('power', 'home'), answering('level', 'home device'), answering('secret', 'home', { internal: true }), indexing('home')],
    Light: [answering('glow', 'home light')],
}));

/** Energy, which extends the home's devices: their power, their usage and a secret. */
const createEnergy = () => nexo.createModule('Energy', { types: [extensionDeclaration('Device', 'Home.Device', [answering('power', 'energy'), answering('usage', 'energy'), answering('secret', 'energy')])] });

/** Solar, which extends the target given, the home's lights unless another is given: its usage and its level. */
const createSolar = (target = 'Home.Light') => nexo.createModule('Solar', { types: [extensionDeclaration('Panel', target, [answering('usage', 'solar'), answering('level', 'solar')])] });

const values = { device: new Device('fan'), light: new Light('lamp'), thermostat: new Thermostat('heater'), numbers: [1, 2] };

/** What the text evaluates to against a registry of the modules given, in the order given, with the values given bound. */
const evaluateWith = (modules, text, bound = values) => {
    const registry = createImportingRegistry(modules);
    const bindings = registry.createBindings(bound);

    return registry.resolve(text, bindings, { imports: importsOf(modules) }).createEvaluator(bindings).evaluate().value;
};

/** The error resolving the text against a registry of the modules given throws, with the values given bound. */
const refusalWith = (modules, text, bound = values) => errorThrownBy(() => createImportingRegistry(modules).resolve(text, bound, { imports: importsOf(modules) }));

describe('the selection of a member', () => {
    it("reads the owner's member with '.' and an extension's with ':', the two never competing", () => {
        expect(evaluateWith([createHome(), createEnergy()], '{ own = device.power, extension = device:power, indexed = device["mode"] }')).toEqual({ own: 'home', extension: 'energy', indexed: 'home' });
    });

    it("reads the owner's member on a supertype it owns with '.', whatever an extension of a more specific receiver declares, which ':' reads", () => {
        expect(evaluateWith([createHome(), createSolar()], '{ level = light.level, glow = light.glow, solar = light:level }')).toEqual({ level: 'home device', glow: 'home light', solar: 'solar' });
    });

    it('takes the applicable extension whose target is more specific than every other\'s, whatever order the modules registered in', () => {
        for (const modules of [[createHome(), createEnergy(), createSolar()], [createHome(), createSolar(), createEnergy()]]) {
            expect(evaluateWith(modules, '{ light = light:usage, thermostat = thermostat:usage }')).toEqual({ light: 'solar', thermostat: 'energy' });
        }
    });

    it('registers extensions of one target, and refuses an access both apply to, naming the modules and the extension accesses that select each', () => {
        const modules = [createHome(), createEnergy(), createSolar('Home.Device')];

        expect(refusalWith(modules, 'device:usage')).toMatchObject({
            code: 'NEXO3024',
            message: expect.stringContaining("'usage' on Device is ambiguous between the modules 'Energy' and 'Solar': write 'device:Energy.Device.usage' or 'device:Solar.Panel.usage' to select one"),
        });
        expect(refusalWith([createHome(), nexo.createModule('Energy', { types: [extensionDeclaration('Device', 'Home.Device', [answering('usage', 'energy')])] }), createSolar('Home.Device')], 'device.secret')).toMatchObject({ code: 'NEXO3023' });
        expect(evaluateWith([createHome(), createEnergy(), createSolar('Home.Device')], 'device.power')).toBe('home');
    });

    it("reads Nexo's own members of its own types with '.', and an extension's of their name with ':'", () => {
        const counting = nexo.createModule('Counting', { types: [extensionDeclaration('Numbers', 'List<Number>', [answering('count', 'counting')])] });

        expect(evaluateWith([counting], '{ own = numbers.count, extension = numbers:count }', { numbers: [1, 2] })).toEqual({ own: 2, extension: 'counting' });
    });

    it("reads an unnamed indexer of the receiver's owner alone, refusing an extension that declares one, which no access would reach", () => {
        expect(evaluateWith([createHome(), createEnergy(), createSolar()], '{ light = light["mode"], thermostat = thermostat["mode"] }')).toEqual({ light: 'home', thermostat: 'home' });
        expect(errorThrownBy(() => nexo.createRegistry([createHome(), nexo.createModule('Energy', { types: [extensionDeclaration('Device', 'Home.Device', [indexing('energy')])] })]))).toMatchObject({ code: 'NEXO4564', kind: 'module' });
    });

    it("reads a member another module declares on a supertype with '.', as a type's own, and an extension's of a more specific receiver with ':'", () => {
        class Gadget {}
        class Lamp extends Gadget {}

        const gear = nexo.createModule('Gear', { types: [{ name: 'Gadget', kind: 'reference', isInstance: value => value instanceof Gadget, members: [answering('tag', 'gear')] }] });
        const lamps = nexo.createModule('Lamps', { typeOf: value => (value instanceof Lamp ? 'Lamp' : null), types: [{ name: 'Lamp', kind: 'reference', supertype: 'Gear.Gadget', isInstance: value => value instanceof Lamp }] });
        const shine = nexo.createModule('Shine', { types: [extensionDeclaration('Lamps', 'Lamps.Lamp', [answering('tag', 'shine')])] });
        const registry = createImportingRegistry([gear, lamps, shine]);
        const bindings = registry.createBindings({ lamp: new Lamp() });

        expect(registry.resolve('{ own = lamp.tag, extension = lamp:tag }', bindings).createEvaluator(bindings).evaluate().value).toEqual({ own: 'gear', extension: 'shine' });
    });
});

describe('an internal declaration', () => {
    it("is no candidate, and never makes an extension member of its name one '.' reads", () => {
        expect(evaluateWith([createHome(), createEnergy()], 'device:secret')).toBe('energy');
        expect(refusalWith([createHome(), createEnergy()], 'device.secret')).toMatchObject({ code: 'NEXO3023' });
    });

    it('is refused where it alone applies, through any form, as if no declaration of its name were accessible', () => {
        const hidden = nexo.createModule('Hidden', {
            types: [{ name: 'Vault', kind: 'reference', isInstance: () => false, internal: true }],
            members: [answering('code', 'hidden', { internal: true })],
        });

        expect(refusalWith([createHome()], 'device.secret')).toMatchObject({ code: 'NEXO3023', message: expect.stringContaining("'secret' on Device is internal to the module 'Home', which no script reaches") });
        expect(refusalWith([createHome()], 'Home.secret(device)')).toMatchObject({ code: 'NEXO3023' });
        expect(refusalWith([hidden], 'Hidden.code', {})).toMatchObject({ code: 'NEXO3023' });
        expect(refusalWith([createHome(), hidden], '(device as Vault) == null')).toMatchObject({ code: 'NEXO3023', message: expect.stringContaining("The type 'Vault' is internal to the module 'Hidden'") });
    });
});
