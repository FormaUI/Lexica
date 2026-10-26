import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy, messageThrownBy } from './support/errors.mjs';

const { property, valueParameter } = lexica.declarations;
const constant = { changes: 'constant', reads: 'fresh' };

/** A module declaring a structured type `Sensor` of the field given, a module member answering one, and a conversion from a string to it. */
const sensors = (name, field) => lexica.createModule(name, {
    types: [{ name: 'Sensor', fields: { [field]: 'Number' } }],
    members: [property('sensor', null, 'Sensor', { updates: constant, implementation: () => ({ [field]: 1 }) })],
    conversions: [{ from: 'String', to: 'Sensor', implementation: ({ value }) => ({ [field]: value.length }) }],
});

/** A module whose module member takes a home sensor and answers its level. */
const checks = () => lexica.createModule('checks', {
    members: [lexica.declarations.function('level', null, 'Number', { updates: constant, parameters: [valueParameter('sensor', 'home.Sensor')], implementation: ({ args }) => args.sensor.level })],
});

/** The value the text gives, read through a registry of the modules. */
const evaluate = (modules, text, bindings = {}) => lexica.createRegistry(modules).resolve(text, bindings).createEvaluator(bindings).evaluate().value;

describe('type identity', () => {
    describe('of two modules declaring a type of one name', () => {
        it('registers both, each its own type, read by its own fields', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture')];

            expect(evaluate(modules, '{ level = home.sensor.level, moisture = garden.sensor.moisture }')).toEqual({ level: 1, moisture: 1 });
            expect(lexica.createRegistry(modules).resolve('home.sensor').type).toBe('Sensor');
        });

        it('takes one where a declaration names it, refusing the other and writing both by their qualified names', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture'), checks()];

            expect(evaluate(modules, 'checks.level(home.sensor)')).toBe(1);
            expect(messageThrownBy(() => lexica.createRegistry(modules).resolve('checks.level(garden.sensor)'))).toContain("expects home.Sensor and finds garden.Sensor");
        });

        it('converts to the one a script names qualified, and refuses an unqualified name both share', () => {
            const modules = [sensors('home', 'level'), sensors('garden', 'moisture')];

            expect(evaluate(modules, '"abc" to home.Sensor')).toEqual({ level: 3 });
            expect(evaluate(modules, '"abc" to garden.Sensor')).toEqual({ moisture: 3 });
            expect(messageThrownBy(() => lexica.createRegistry(modules).resolve('"abc" to Sensor'))).toContain("'Sensor' names a type several modules declare, so it is named qualified by its module: home.Sensor or garden.Sensor");
        });
    });

    describe("of a module's type spelled as one of Lexica's own", () => {
        it("leaves an unqualified name Lexica's own, the module's named qualified, and a declaration of the module naming its own", () => {
            const measures = lexica.createModule('measures', {
                types: [{ name: 'Number', fields: { amount: 'String' } }],
                conversions: [{ from: 'String', to: 'Number', implementation: ({ value }) => ({ amount: value }) }],
            });

            expect(evaluate([measures], '"12" to Number')).toBe(12);
            expect(evaluate([measures], '("12" to measures.Number).amount')).toBe('12');
        });
    });

    describe('of a reference in a declaration', () => {
        it('resolves a foreign type written qualified, and refuses one written unqualified, giving its qualified name', () => {
            const axes = lexica.createModule('axes', { types: [{ name: 'Axis', fields: { length: 'Number' } }] });
            const charting = result => lexica.createModule('charts', { members: [property('axis', null, result, { updates: constant, implementation: () => ({ length: 2 }) })] });

            expect(evaluate([axes, charting('axes.Axis')], 'charts.axis.length')).toBe(2);
            expect(messageThrownBy(() => lexica.createRegistry([axes, charting('Axis')]))).toContain("names the type 'Axis', which only another module declares, so it is named qualified: axes.Axis");
            expect(messageThrownBy(() => lexica.createRegistry([axes, charting('axes.Grid')]))).toContain("names the type 'axes.Grid', which the module 'axes' does not declare");
        });

        it('resolves a structured type\'s fields among the modules it imports, its own module first, and refuses a name two imports share', () => {
            const declaring = (name, fields) => lexica.createModule(name, { types: [{ name: 'Axis', fields }] });
            const charting = (type, ownTypes = []) => lexica.createModule('charts', {
                types: [type, ...ownTypes],
                members: [property('chart', null, 'Chart', { updates: constant, implementation: () => ({ axis: { length: 2, step: 1 } }) })],
            });
            const chart = imports => ({ name: 'Chart', fields: { axis: 'Axis' }, import: imports });

            expect(evaluate([declaring('axes', { length: 'Number' }), charting(chart(['axes']))], 'charts.chart.axis.length')).toBe(2);
            expect(evaluate([declaring('axes', { length: 'Number' }), charting(chart(['axes']), [{ name: 'Axis', fields: { step: 'Number' } }])], 'charts.chart.axis.step')).toBe(1);
            expect(messageThrownBy(() => lexica.createRegistry([declaring('axes', { length: 'Number' }), declaring('grids', { step: 'Number' }), charting(chart(['axes', 'grids']))]))).toContain('so it is named qualified: axes.Axis or grids.Axis');
            expect(messageThrownBy(() => lexica.createRegistry([charting(chart(['axes']))]))).toContain("The type imports the module 'axes', which is not registered");
        });

        it('lets a type\'s import reach its own fields alone, never its module\'s members', () => {
            const axes = lexica.createModule('axes', { types: [{ name: 'Axis', fields: { length: 'Number' } }] });
            const charts = lexica.createModule('charts', {
                types: [{ name: 'Chart', fields: { axis: 'Axis' }, import: ['axes'] }],
                members: [property('axis', null, 'Axis', { updates: constant })],
            });

            expect(messageThrownBy(() => lexica.createRegistry([axes, charts]))).toContain("names the type 'Axis', which only another module declares");
        });

        it('takes a type named as a node of Lexica\'s in its own module, where it names that type, and leaves Lexica\'s node to every other', () => {
            const shapes = lexica.createModule('shapes', {
                types: [{ name: 'Element', fields: { width: 'Number' } }],
                members: [property('element', null, 'Element', { updates: constant, implementation: () => ({ width: 3 }) })],
            });

            expect(evaluate([shapes], 'shapes.element.width')).toBe(3);
            expect(lexica.createRegistry([shapes]).resolve('shapes.element').type).toBe('Element');
        });
    });
});
