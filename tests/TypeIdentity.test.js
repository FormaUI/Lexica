import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy, messageThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { evaluateWith } from './support/pipeline.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createFunctionDeclaration } = lexica.declarations;

/** A module declaring a structured type `Sensor` of the field given, a module member answering one, and a conversion from a string to it. */
const sensors = (name, field) => lexica.createModule(name, {
    types: [
        { name: 'Sensor', kind: 'structured', members: dataPropertyDeclarations({ [field]: 'Number' }) },
        extensionDeclaration('Readings', 'String', [operatorDeclaration('convert', 'Sensor', ({ value }) => ({ [field]: value.length }))]),
    ],
    members: [createPropertyDeclaration('sensor', 'Sensor', { updates: constantUpdates, impl: () => ({ [field]: 1 }) })],
});

/** A module whose module member takes a home sensor and answers its level. */
const checks = () => lexica.createModule('checks', {
    members: [createFunctionDeclaration('level', 'Number', { updates: constantUpdates, parameters: [createValueParameterDeclaration('sensor', 'home.Sensor')], impl: ({ args }) => args.sensor.level })],
});

describe('type identity', () => {
    describe('of two modules declaring a type of one name', () => {
        it('registers both, each its own type, read by its own fields', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture')];

            expect(evaluateWith(modules, '{ level = home.sensor.level, moisture = garden.sensor.moisture }')).toEqual({ level: 1, moisture: 1 });
            expect(lexica.createRegistry(modules).resolve('home.sensor').type).toBe('Sensor');
        });

        it('takes one where a declaration names it, refusing the other and writing both by their qualified names', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture'), checks()];

            expect(evaluateWith(modules, 'checks.level(home.sensor)')).toBe(1);
            expect(messageThrownBy(() => lexica.createRegistry(modules).resolve('checks.level(garden.sensor)'))).toContain("expects home.Sensor and finds garden.Sensor");
        });

        it('converts to the one a script names qualified, and refuses an unqualified name both share', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture')];

            expect(evaluateWith(modules, '"abc" to home.Sensor')).toEqual({ level: 3 });
            expect(evaluateWith(modules, '"abc" to garden.Sensor')).toEqual({ moisture: 3 });
            expect(messageThrownBy(() => lexica.createRegistry(modules).resolve('"abc" to Sensor'))).toContain("'Sensor' names a type several modules declare, so it is named qualified by its module: home.Sensor or garden.Sensor");
        });
    });

    describe("of a module's type spelled as one of Lexica's own", () => {
        it("leaves an unqualified name Lexica's own, the module's named qualified, and a declaration of the module naming its own", () => {
            const measures = lexica.createModule('measures', {
                types: [{ name: 'Number', kind: 'structured', members: dataPropertyDeclarations({ amount: 'String' }) }, extensionDeclaration('Amounts', 'String', [operatorDeclaration('convert', 'Number', ({ value }) => ({ amount: value }))])],
            });

            expect(evaluateWith([measures], '"12" to Number')).toBe(12);
            expect(evaluateWith([measures], '("12" to measures.Number).amount')).toBe('12');
        });
    });

    describe('of a reference in a declaration', () => {
        it('resolves a foreign type written qualified, and refuses one written unqualified, giving its qualified name', () => {
            const axes = lexica.createModule('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] });
            const charting = result => lexica.createModule('charts', { members: [createPropertyDeclaration('axis', result, { updates: constantUpdates, impl: () => ({ length: 2 }) })] });

            expect(evaluateWith([axes, charting('axes.Axis')], 'charts.axis.length')).toBe(2);
            expect(messageThrownBy(() => lexica.createRegistry([axes, charting('Axis')]))).toContain("names the type 'Axis', which only another module declares, so it is named qualified: axes.Axis");
            expect(messageThrownBy(() => lexica.createRegistry([axes, charting('axes.Grid')]))).toContain("names the type 'axes.Grid', which the module 'axes' does not declare");
        });

        it('resolves a structured type\'s fields among the modules it imports, its own module first, and refuses a name two imports share', () => {
            const declaring = (name, fields) => lexica.createModule(name, { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations(fields) }] });
            const charting = (type, ownTypes = []) => lexica.createModule('charts', {
                types: [type, ...ownTypes],
                members: [createPropertyDeclaration('chart', 'Chart', { updates: constantUpdates, impl: () => ({ axis: { length: 2, step: 1 } }) })],
            });
            const chart = imports => ({ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ axis: 'Axis' }), import: imports });

            expect(evaluateWith([declaring('axes', { length: 'Number' }), charting(chart(['axes']))], 'charts.chart.axis.length')).toBe(2);
            expect(evaluateWith([declaring('axes', { length: 'Number' }), charting(chart(['axes']), [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ step: 'Number' }) }])], 'charts.chart.axis.step')).toBe(1);
            expect(messageThrownBy(() => lexica.createRegistry([declaring('axes', { length: 'Number' }), declaring('grids', { step: 'Number' }), charting(chart(['axes', 'grids']))]))).toContain('so it is named qualified: axes.Axis or grids.Axis');
            expect(messageThrownBy(() => lexica.createRegistry([charting(chart(['axes']))]))).toContain("The type imports the module 'axes', which is not registered");
        });

        it('lets a type\'s import reach its own fields alone, never its module\'s members', () => {
            const axes = lexica.createModule('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] });
            const charts = lexica.createModule('charts', {
                types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ axis: 'Axis' }), import: ['axes'] }],
                members: [createPropertyDeclaration('axis', 'Axis', { updates: constantUpdates })],
            });

            expect(messageThrownBy(() => lexica.createRegistry([axes, charts]))).toContain("names the type 'Axis', which only another module declares");
        });

        it('takes a type named as a node of Lexica\'s in its own module, where it names that type, and leaves Lexica\'s node to every other', () => {
            const shapes = lexica.createModule('shapes', {
                types: [{ name: 'Element', kind: 'structured', members: dataPropertyDeclarations({ width: 'Number' }) }],
                members: [createPropertyDeclaration('element', 'Element', { updates: constantUpdates, impl: () => ({ width: 3 }) })],
            });

            expect(evaluateWith([shapes], 'shapes.element.width')).toBe(3);
            expect(lexica.createRegistry([shapes]).resolve('shapes.element').type).toBe('Element');
        });
    });
});
