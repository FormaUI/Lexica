import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Device, Light, Room, Sensor as HomeSensor, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = lexica.declarations;

/** A sensor of the garden's, a type of the local name the home's sensor has too. */
class GardenSensor {}

/** The home: a device's name, a light's dimming, a room's devices by index, and its own sensor, among its types. */
const createHome = () => lexica.createModule('Home', {
    ...withHome({}, {
        Room: [createIndexerDeclaration(null, 'Device?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('index', 'Number')], impl: ({ receiver, args }) => receiver.devices[args.index] ?? null })],
        Device: [createPropertyDeclaration('name', 'String', { updates: constantUpdates, impl: ({ receiver }) => receiver.name })],
        Light: [createFunctionDeclaration('dim', 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('level', 'Number')], impl: ({ receiver, args }) => `${receiver.name} at ${args.level}` })],
    }),
});

/** The garden: a reading of degrees, written as text by its own conversion, and a sensor of its own. */
const createGarden = () => lexica.createModule('Garden', {
    typeOf: value => (value instanceof GardenSensor ? 'Sensor' : null),
    types: [
        { name: 'Reading', kind: 'structured', members: [...dataPropertyDeclarations({ degrees: 'Number' }), operatorDeclaration('convert', 'String', ({ value }) => `${value.degrees} degrees`)] },
        { name: 'Sensor', kind: 'reference', isInstance: value => value instanceof GardenSensor },
    ],
});

/** Energy: an extension of the home's devices, their usage and the garden's reading of them, and a module member that answers a value of Any. */
const createEnergy = () => lexica.createModule('Energy', {
    types: [
        extensionDeclaration('Devices', 'Home.Device', [
            createPropertyDeclaration('usage', 'Number', { updates: constantUpdates, impl: () => 3 }),
            createPropertyDeclaration('meter', 'Garden.Reading', { updates: constantUpdates, impl: () => ({ degrees: 21 }) }),
        ]),
    ],
    members: [createFunctionDeclaration('anything', 'Any', { updates: constantUpdates, impl: () => new Light('lamp') })],
});

const values = { device: new Device('fan'), light: new Light('lamp'), room: new Room('hall', [new Light('lamp')]), sensor: new HomeSensor(), gardenSensor: new GardenSensor() };

/** A registry of the home, the garden and energy. */
const createRegistry = () => lexica.createRegistry([createHome(), createGarden(), createEnergy()]);

/** The resolution of the text against the registry, its host supplying the imports given. */
const resolve = (text, imports = []) => createRegistry().resolve(text, values, { imports });

/** What the text evaluates to against the registry, its host supplying the imports given. */
const evaluate = (text, imports = []) => resolve(text, imports).createEvaluator(values).evaluate().value;

/** The error resolving the text throws, its host supplying the imports given. */
const refusal = (text, imports = []) => errorThrownBy(() => resolve(text, imports));

describe('what a script\'s imports make available', () => {
    describe('members', () => {
        it('are reached by their declaring module\'s import, an extension of another module\'s type without that module\'s', () => {
            expect(evaluate('import Energy\ndevice.usage')).toBe(3);
            expect(refusal('import Energy\ndevice.name')).toMatchObject({ code: 'LEXICA3005', location: { pointer: '/expression' }, message: expect.stringContaining("'name' on Device is declared only by 'Home', which the script does not import: write 'import Home' at the script's start") });
            expect(evaluate('import Home\nimport Energy\n{ name = device.name, usage = device.usage }')).toEqual({ name: 'fan', usage: 3 });
        });

        it('are a type\'s own and those it inherits through its type\'s import, wherever they apply, which gives no namespace and leaves another module\'s extension of it to its own import', () => {
            expect(evaluate('import Home.Light\n{ dimmed = light.dim(2), name = light.name }')).toEqual({ dimmed: 'lamp at 2', name: 'lamp' });
            expect(refusal('import Home.Light\nlight.usage')).toMatchObject({ code: 'LEXICA3005', message: expect.stringContaining("declared only by 'Energy'") });
            expect(refusal('import Home.Light\nHome.rooms')).toMatchObject({ code: 'LEXICA3003', location: { pointer: '/expression/receiver' } });
            // A member is available as the declaration it is, so one a light inherits is read on any device it applies to.
            expect(evaluate('import Home.Light\ndevice.name')).toBe('fan');
        });

        it('are an extension\'s through its import, which names no type', () => {
            expect(evaluate('import Energy.Devices\ndevice.usage')).toBe(3);
            expect(refusal('import Energy.Devices\ndevice.name')).toMatchObject({ code: 'LEXICA3005' });
            expect(refusal('import Energy.Devices\ndevice as Devices')).toMatchObject({ code: 'LEXICA3019' });
        });

        it('leave a dependency\'s type whole without its module\'s import, whose members, its data among them, need it', () => {
            expect(evaluate('import Energy\ndevice.meter')).toEqual({ degrees: 21 });
            expect(refusal('import Energy\ndevice.meter.degrees')).toMatchObject({ code: 'LEXICA3005', message: expect.stringContaining("'degrees' on Reading is declared only by 'Garden'") });
            expect(evaluate('import Energy\nimport Garden\ndevice.meter.degrees')).toBe(21);
        });

        it('include an unnamed indexer and an operator, each by its declaring module\'s import', () => {
            expect(refusal('import Energy\nroom[0]')).toMatchObject({ code: 'LEXICA3005', location: { pointer: '/expression' }, message: expect.stringContaining("The unnamed indexer of Room is declared only by 'Home'") });
            expect(evaluate('import Home\nroom[0]?.name')).toBe('lamp');
            expect(refusal('import Energy\ndevice.meter to String')).toMatchObject({ code: 'LEXICA3005', message: expect.stringContaining("The conversion from Reading to String is declared only by 'Garden'") });
            expect(evaluate('import Energy\nimport Garden\ndevice.meter to String')).toBe('21 degrees');
        });

        it('are a deferred access\'s candidates, so one none of whose declarations is imported is refused', () => {
            expect(resolve('import Energy\nEnergy.anything().name').getCandidateDeclarations().declarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Energy.anything']);
            expect(refusal('import Energy\nEnergy.anything().dim(1)')).toMatchObject({ code: 'LEXICA3005', message: expect.stringContaining("'dim' is declared only by 'Home'") });
            expect(resolve('import Home\nimport Energy\nEnergy.anything().dim(1)').getCandidateDeclarations().declarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Energy.anything', 'Light.dim']);
        });

        it('are what a host supplies as a written import makes them', () => {
            expect(evaluate('device.name', ['Home'])).toBe('fan');
            expect(evaluate('import Energy\n{ name = device.name, usage = device.usage }', ['Home'])).toEqual({ name: 'fan', usage: 3 });
        });
    });

    describe('type names', () => {
        it('are an imported type\'s local name first, then Lexica\'s own, then the one public type of the name among the imported modules', () => {
            expect(resolve('import Home.Sensor\nimport Garden\n(sensor as Sensor) != null').type).toBe('Boolean');
            expect(evaluate('import Home.Sensor\nimport Garden\n{ home = (sensor as Sensor) != null, garden = (gardenSensor as Garden.Sensor) != null }')).toEqual({ home: true, garden: true });
            expect(refusal('import Home.Sensor\nimport Garden\n(gardenSensor as Sensor) != null')).toMatchObject({ code: 'LEXICA3060' });
            expect(refusal('import Home\nimport Garden\n(sensor as Sensor) != null')).toMatchObject({ code: 'LEXICA3059', message: expect.stringContaining('Home.Sensor or Garden.Sensor') });
            expect(evaluate('import Number = Home.Sensor\n(sensor as Number) != null')).toBe(true);
        });

        it('name no type of a module the script does not import, giving the import to write', () => {
            expect(refusal('(sensor as Sensor) != null')).toMatchObject({ code: 'LEXICA3019', message: expect.stringContaining("'Home' and 'Garden' declare it: write 'import Home' or 'import Garden' at the script's start") });
            expect(refusal('import Garden\n(sensor as Home.Sensor) != null')).toMatchObject({ code: 'LEXICA3004' });
        });
    });

    describe('a resolution', () => {
        it('is of its definition, its imports among it, so a script read with other imports is resolved anew', () => {
            const registry = createRegistry();
            const bindings = registry.createBindings(values);
            const withHomeImport = registry.resolve('device.name', bindings, { imports: ['Home'] });
            const withBothImports = registry.resolve('device.name', bindings, { imports: ['Home', 'Energy'] });

            expect(withHomeImport.definition.imports).toEqual([{ module: 'Home' }]);
            expect(withBothImports.definition.imports).toEqual([{ module: 'Energy' }, { module: 'Home' }]);
            expect(withHomeImport.definition).not.toBe(withBothImports.definition);
            expect(registry.resolve('device.name', bindings, { imports: ['Home'] }).definition).toBe(withHomeImport.definition);
            expect(withHomeImport.createEvaluator(bindings).evaluate().value).toBe('fan');
        });
    });
});
