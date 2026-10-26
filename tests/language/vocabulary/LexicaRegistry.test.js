import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { declaration, functionDeclaration, messageOf, parameter, refusalOf } from './declarations.mjs';
import { Light, withHome } from '../../support/home.mjs';

describe('LexicaRegistry', () => {
    const own = () => new LexicaModule('charts', {
        types: [{ name: 'Chart', fields: { points: 'Number' } }],
        members: [declaration({ name: 'points', target: 'Chart' }), declaration({ name: 'charts', target: 'String' })],
    });

    it('registers Lexica\'s own module and a module beside it', () => {
        expect(new LexicaRegistry([Vocabulary.module, own()]).moduleNames).toEqual(['lexica', 'charts']);
    });

    it('refuses a module registered twice', () => {
        expect(messageOf(() => new LexicaRegistry([own(), own()]))).toContain("'charts' is registered already");
        expect(messageOf(() => new LexicaRegistry([own(), new LexicaModule('CHARTS', {})]))).toContain("'charts' is registered already");
    });

    it('refuses what no createModule made, naming it', () => {
        expect(messageOf(() => new LexicaRegistry([{ name: 'fake', members: [] }]))).toContain('A module is registered as createModule makes it');
    });

    it('refuses a type a declaration names that neither Lexica nor a module registered with it declares', () => {
        const failing = contents => messageOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', contents)]));

        expect(failing({ members: [declaration({ name: 'charts', result: 'Chart' })] })).toContain("'Chart' names the type 'Chart', which neither Lexica nor a module registered with it declares");
        expect(failing({ members: [declaration({ name: 'charts', result: 'List<Chart?>' })] })).toContain("'List<Chart?>' names the type 'Chart'");
        expect(failing({ types: [{ name: 'Chart', fields: { axis: 'Axis' } }] })).toContain("names the type 'Axis'");
        expect(failing({ typeSelectors: [{ name: 'report' }], selectableTypes: [{ name: 'chartclick', selector: 'report', type: 'ChartEvent' }] })).toContain("names the type 'ChartEvent'");
        expect(failing({ members: [functionDeclaration({ name: 'charts', parameters: [parameter({ name: 'range', type: 'Range' })] })] })).toContain("names the type 'Range'");
    });

    it('refuses Any in a declaration, which deferred selection and its checks admit', () => {
        for (const notation of ['Any', 'Any?', 'List<Any>']) {
            expect(refusalOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', { members: [declaration({ name: 'charts', result: notation })] })]))).toMatchObject({ declaration: 'charts' });
        }
    });

    it('takes a type the module declares wherever it declares it, and one an earlier module declares, qualified, whatever the order of the declarations', () => {
        const axes = new LexicaModule('axes', { types: [{ name: 'Axis', fields: { length: 'Number' } }] });
        const charts = new LexicaModule('charts', {
            members: [declaration({ name: 'charts', result: 'Chart' })],
            types: [{ name: 'Chart', fields: { axis: 'axes.Axis', domain: 'List<Number>' } }],
        });

        expect(() => new LexicaRegistry([Vocabulary.module, axes, charts])).not.toThrow();
        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, charts, axes]))).toContain("names the type 'axes.Axis', and no module named 'axes' is registered");
    });

    it('refuses a default its parameter does not admit, by its type, its nullability and a structure\'s fields', () => {
        const range = new LexicaModule('ranges', { types: [{ name: 'Range', fields: { start: 'Number', end: 'Number?' } }] });
        const registering = (type, value) => () => new LexicaRegistry([Vocabulary.module, range, new LexicaModule('charts', withHome({
            members: [functionDeclaration({ name: 'charts', parameters: [parameter({ name: 'value', type, required: false, default: value })] })],
        }))]);

        expect(messageOf(registering('Number', 'many'))).toContain("The default of 'value' is no Number");
        expect(messageOf(registering('Number', null))).toContain('is no Number');
        expect(messageOf(registering('List<String>', ['a', 1]))).toContain('is no List<String>');
        expect(messageOf(registering('ranges.Range', { start: 0 }))).toContain('is no ranges.Range');
        expect(messageOf(registering('Light?', {}))).toContain('is no Light?');
        expect(messageOf(registering('Light?', new Light('lamp')))).toContain('is no Light?');
        expect(registering('Number?', null)).not.toThrow();
        expect(registering('List<String>', ['a', 'b'])).not.toThrow();
        expect(registering('ranges.Range', { start: 0, end: null })).not.toThrow();
    });

    it('refuses a default holding a number that is not finite or a list with a hole, at the top level and nested, as no evaluation produces them', () => {
        const range = new LexicaModule('ranges', { types: [{ name: 'Range', fields: { start: 'Number', points: 'List<Number>' } }] });
        const registering = (type, value) => () => new LexicaRegistry([Vocabulary.module, range, new LexicaModule('charts', withHome({
            members: [functionDeclaration({ name: 'charts', parameters: [parameter({ name: 'value', type, required: false, default: value })] })],
        }))]);
        const refused = [['Number', Infinity], ['Number', -Infinity], ['Number?', NaN], ['List<Number>', [1, , 3]], ['List<Number>', [1, NaN]], ['List<List<Number>>', [[1], [2, , 4]]], ['ranges.Range', { start: Infinity, points: [] }], ['ranges.Range', { start: 0, points: [, 1] }]];

        for (const [type, value] of refused) {
            expect(messageOf(registering(type, value)), type).toContain(`The default of 'value' is no ${type}`);
        }

        expect(registering('List<Number>', [1, 2, 3])).not.toThrow();
        expect(registering('List<List<Number>>', [[1], [], [2, 4]])).not.toThrow();
        expect(registering('ranges.Range', { start: -0, points: [Number.MAX_VALUE] })).not.toThrow();
    });

    it('refuses a type parameter\'s default that is no data, at the top level and within another type, and takes any data, whatever the parameter binds to', () => {
        const registering = (type, value) => () => new LexicaRegistry([Vocabulary.module, new LexicaModule('lists', {
            members: [functionDeclaration({ name: 'pick', target: 'List<T>', result: 'T?', parameters: [parameter({ name: 'fallback', type, required: false, default: value })] })],
        })]);
        const refused = [['T', Infinity], ['T', NaN], ['T', () => 1], ['T', [1, , 3]], ['T', [1, Infinity]], ['T', { f: () => 1 }], ['T', new Date(0)], ['List<T>', [Infinity]]];

        for (const [type, value] of refused) {
            expect(messageOf(registering(type, value)), `${type} ${String(value)}`).toContain(`The default of 'fallback' is no ${type}`);
        }

        for (const value of [0, 'x', false, [1, [2]], { a: [{ b: null }] }]) {
            expect(registering('T', value), JSON.stringify(value)).not.toThrow();
        }
    });

    it('takes a tolerance for a result of a structured type, whichever module declares it, now that every type is known', () => {
        const boxes = new LexicaModule('boxes', { types: [{ name: 'Box', fields: { width: 'Number' } }] });
        const sized = new LexicaModule('sized', { members: [declaration({ name: 'bounds', result: 'boxes.Box?', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] });

        expect(() => new LexicaRegistry([Vocabulary.module, boxes, sized])).not.toThrow();
    });

    it('lets a module declare a member of any name on a type another module or the language declares', () => {
        const charts = new LexicaModule('charts', { types: [{ name: 'Chart', fields: { points: 'Number' } }] });
        const zoom = new LexicaModule('zoom', { members: [declaration({ name: 'scale', target: 'charts.Chart' }), declaration({ name: 'level', target: 'String' })] });
        const registry = new LexicaRegistry([Vocabulary.module, charts, zoom]);

        expect(registry.getReceiverMembers('scale').map(member => registry.getDeclaringModuleName(member))).toEqual(['zoom']);
        expect(registry.getReceiverMembers('level').map(member => member.target)).toEqual(['String']);
    });

    it('refuses a member the registry already answers on the same receiver, naming its target', () => {
        const module = new LexicaModule('charts', { members: [declaration({ name: 'charts', target: 'String' }), declaration({ name: 'charts', target: 'String' })] });

        expect(refusalOf(() => new LexicaRegistry([module]))).toMatchObject({ declaration: 'charts', declarationKey: 'target' });
        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('count', { members: [declaration({ name: 'count', target: 'List<Number>' })] })]))).toContain('declared already');
    });

    it('refuses a member on a type beneath one that the same name on that type already answers', () => {
        const home = new LexicaModule('home', withHome());
        const owners = new LexicaModule('owner', { members: [declaration({ name: 'owner', target: 'home.Device' })] });

        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, home, owners, new LexicaModule('other', { members: [declaration({ name: 'other', target: 'home.Light' }), declaration({ name: 'owner', target: 'home.Thermostat' })] })]))).toContain('declared already');
    });

    it('lets one name answer on different receivers', () => {
        const owners = new LexicaRegistry([new LexicaModule('host', withHome({ members: [declaration({ name: 'size', target: 'Room' }), declaration({ name: 'size', target: 'Device' })] }))]).getReceiverMembers('size').map(member => member.target);

        expect(owners).toEqual(['Room', 'Device']);
    });

    describe('module members, which have no target', () => {
        it('are declared once by name within their module, and register beside a member of their name on a receiver, which is no duplicate', () => {
            const members = [declaration({ name: 'now', target: undefined }), declaration({ name: 'now', target: 'String' })];

            for (const declared of [members, [...members].reverse()]) {
                expect(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('home', { members: declared })])).not.toThrow();
            }

            expect(refusalOf(() => new LexicaRegistry([new LexicaModule('home', { members: [declaration({ name: 'now', target: undefined }), declaration({ name: 'now', target: undefined })] })]))).toMatchObject({ declaration: 'now', declarationKey: 'name' });
        });

        it('leave a member of their name on a receiver to another module, whose namespace is its own', () => {
            const home = new LexicaModule('home', { members: [declaration({ name: 'now', target: undefined })] });
            const office = new LexicaModule('office', { members: [declaration({ name: 'now', target: 'String' })] });

            expect(() => new LexicaRegistry([Vocabulary.module, home, office])).not.toThrow();
        });

        it('take one name in two modules, each read through its own namespace', () => {
            const declaring = name => new LexicaModule(name, { members: [declaration({ name: 'now', target: undefined })] });
            const [home, office] = [declaring('home'), declaring('office')];
            const registry = new LexicaRegistry([home, office]);

            expect([home, office].map(module => registry.getDeclaringModuleName(module.members[0]))).toEqual(['home', 'office']);
            expect(registry.getReceiverMembers('now')).toEqual([]);
        });
    });

    describe('the queries a declaration is read through', () => {
        const indexer = functionDeclaration({ name: 'letter', syntax: 'indexer', target: 'String', result: 'String?' });
        const declaring = () => new LexicaModule('home', {
            types: [{ name: 'Room', fields: { area: 'Number' } }],
            members: [declaration({ name: 'now', target: undefined }), declaration({ name: 'size', target: 'Room' }), functionDeclaration({ name: 'size', target: 'String' }), indexer],
        });

        it('tell a member with a receiver from a module member, which has none', () => {
            const home = declaring();
            const registry = new LexicaRegistry([home]);

            expect(home.members.map(member => registry.hasReceiver(member))).toEqual([false, true, true, true]);
        });

        it('give the form a script writes each member in', () => {
            const home = declaring();
            const registry = new LexicaRegistry([home]);

            expect(home.members.map(member => registry.formOf(member))).toEqual(['access', 'access', 'function-call', 'indexer']);
        });

        it('find the members of one name a module declares, its module members among them, and none of another module\'s', () => {
            const home = declaring();
            const office = new LexicaModule('office', { members: [declaration({ name: 'size', target: 'Number' })] });
            const registry = new LexicaRegistry([home, office]);

            expect(registry.getMembersDeclaredBy('home', 'size')).toEqual([home.members[1], home.members[2]]);
            expect(registry.getMembersDeclaredBy('home', 'now')).toEqual([home.members[0]]);
            expect(registry.getMembersDeclaredBy('home', 'width')).toEqual([]);
            expect(registry.getMembersDeclaredBy('garden', 'size')).toEqual([]);
        });

        it('answer a structured type\'s data shape, its data properties and their types in declaration order, kept once read; and null for a type that is no structure', () => {
            const registry = new LexicaRegistry([declaring()]);
            const room = Type.createNamedType('Room', false, 'home');
            const shape = registry.getDataShape(room);

            expect([...shape].map(([name, type]) => [name, type.toString()])).toEqual([['area', 'Number']]);
            expect(shape.has('constructor')).toBe(false);
            expect(registry.getDataShape(room)).toBe(shape);
            expect(registry.getDataShape(Type.createNamedType('String'))).toBeNull();
            expect(registry.getDataPropertyTypes('area').map(String)).toEqual(['Number']);
            expect(registry.getDataPropertyTypes('width')).toEqual([]);
        });
    });

    it('refuses a type declared twice in its module, and takes one name in two modules, each type its own', () => {
        const pings = (name, types = [{ name: 'Ping', fields: { at: 'Number' } }]) => new LexicaModule(name, { types });

        expect(refusalOf(() => new LexicaRegistry([pings('first', [{ name: 'Ping', fields: { at: 'Number' } }, { name: 'Ping', fields: { on: 'Number' } }])]))).toMatchObject({ module: 'first', declaration: 'Ping', message: expect.stringContaining("The type 'Ping' is declared already") });

        const registry = new LexicaRegistry([pings('first'), pings('second', [{ name: 'Ping', fields: { on: 'Boolean' } }])]);

        expect(['first', 'second'].map(module => Object.keys(registry.getStructure(Type.createNamedType('Ping', false, module)).fields))).toEqual([['at'], ['on']]);
    });

    describe('observation types', () => {
        const startTicks = () => ({ stop() {} });
        const types = [{ name: 'ticks', contract: 'invalidation', implementation: startTicks }, { name: 'sampled', contract: 'maintained' }];
        const targets = [{ name: 'page' }, { name: 'frame', from: 'receiver' }, { name: 'frames', from: 'receiver', count: 'many' }];
        const watching = (updates = {}, moduleTypes = types) => new LexicaModule('charts', {
            observationTypes: moduleTypes,
            observationTargets: targets,
            members: [declaration({ name: 'charts', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'ticks', of: 'receiver' }], ...updates } })],
        });
        // A module of its own whose member observes, through the charts module's types, the targets it declares.
        const observingFrom = (of, overrides = {}) => new LexicaModule('later', { members: [declaration({ name: 'later', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'ticks', of }] }, ...overrides })] });

        it('are declared by a module, which its members and the members of later modules use', () => {
            const later = new LexicaModule('later', { members: [declaration({ name: 'later', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'ticks', of: 'receiver' }] } })] });

            expect(() => new LexicaRegistry([watching(), later])).not.toThrow();
            expect(new LexicaRegistry([watching()]).getObservationType('ticks')).toMatchObject({ name: 'ticks', contract: 'invalidation', shared: true });
        });

        it('are declared once', () => {
            expect(messageOf(() => new LexicaRegistry([watching(), new LexicaModule('again', { observationTypes: [types[0]] })]))).toContain("observation type 'ticks' is declared already");
        });

        it('are declared by some module for every observation a member names', () => {
            expect(refusalOf(() => new LexicaRegistry([watching({ observations: [{ type: 'unknown', of: 'receiver' }] })]))).toMatchObject({ declaration: 'charts', declarationKey: 'updates.observations' });
        });

        it('give a member that reads maintained values a maintained observation, and give no other member one', () => {
            expect(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'receiver' }] })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching({ reads: 'maintained' })]))).toContain('names a maintained observation');
            expect(messageOf(() => new LexicaRegistry([watching({ observations: [{ type: 'sampled', of: 'receiver' }] })]))).toContain('reads maintained values');
        });

        it('observe a target the module declaring their type declares, whichever module names it', () => {
            expect(() => new LexicaRegistry([watching({ observations: [{ type: 'ticks', of: 'page' }, { type: 'ticks', of: 'frames' }] })])).not.toThrow();
            expect(() => new LexicaRegistry([watching(), observingFrom('frame')])).not.toThrow();
            expect(refusalOf(() => new LexicaRegistry([watching(), observingFrom('panel')]))).toMatchObject({ declaration: 'later', declarationKey: 'updates.observations' });
            expect(messageOf(() => new LexicaRegistry([watching(), observingFrom('panel')]))).toContain("The observation 'ticks' observes 'panel', and the module 'charts', which declares 'ticks', declares no target of that name");
        });

        it('observe a target found from the receiver for a member with a target alone', () => {
            expect(() => new LexicaRegistry([watching(), observingFrom('page', { target: undefined })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching(), observingFrom('frames', { target: undefined })]))).toContain("The observation 'ticks' observes 'frames', a target found from the receiver, and a member without a target has no receiver");
        });

        it('give a maintained observation one target, never a target of several', () => {
            expect(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'frame' }] })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'frames' }] })]))).toContain("The maintained observation 'sampled' gives one sample, so it observes one target, never 'frames', a target of several");
        });

        it('start with the implementation their module gives', () => {
            const registry = new LexicaRegistry([watching()]);

            expect(registry.getImplementation(registry.getObservationType('ticks'))).toBe(startTicks);
            expect(registry.getImplementation(registry.getObservationType('sampled'))).toBeUndefined();
        });
    });
});

describe('type selectors', () => {
    const reports = () => new LexicaModule('reports', { typeSelectors: [{ name: 'report' }], selectableTypes: [{ name: 'motion', selector: 'report', type: 'Number' }] });
    const keys = (name, selectableTypes, contents = {}) => new LexicaModule(name, { selectableTypes, ...contents });
    const selecting = selector => functionDeclaration({ name: 'report', result: '@selected', parameters: [parameter({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector })] });

    it('map each key to its type, a selector and its keys owned by the modules that declare them', () => {
        const registry = new LexicaRegistry([reports(), keys('doors', [{ name: 'door:open', selector: 'report', type: 'Boolean' }])]);

        expect(registry.getSelectableType('report', 'motion')).toEqual({ name: 'motion', selector: 'report', type: 'Number' });
        expect(registry.getSelectableType('report', 'smoke')).toBeUndefined();
        expect(registry.getDeclaringModuleName(registry.getTypeSelector('report'))).toBe('reports');
        expect(registry.getDeclaringModuleName(registry.getSelectableType('report', 'door:open'))).toBe('doors');
        expect(registry.revision).toBe(2);
    });

    it('are named once across every module', () => {
        expect(refusalOf(() => new LexicaRegistry([reports(), new LexicaModule('again', { typeSelectors: [{ name: 'report' }] })]))).toMatchObject({ module: 'again', declaration: 'report', declarationKey: 'name', message: expect.stringContaining("The type selector 'report' is declared already, by the module 'reports'") });
    });

    it('take each key once, from the module that declares it first, and never replace it', () => {
        const message = "The type selector 'report' maps the key 'motion' already, as the module 'reports' declared it, and a key is never replaced";

        expect(refusalOf(() => new LexicaRegistry([reports(), keys('sensors', [{ name: 'motion', selector: 'report', type: 'String' }])]))).toMatchObject({ module: 'sensors', declaration: 'motion', declarationKey: 'name', message: expect.stringContaining(message) });
        expect(messageOf(() => new LexicaRegistry([keys('reports', [{ name: 'motion', selector: 'report', type: 'Number' }, { name: 'motion', selector: 'report', type: 'String' }], { typeSelectors: [{ name: 'report' }] })]))).toContain(message);
    });

    it('take keys of a selector its own module or one registered before it declares, and of no other', () => {
        expect(() => new LexicaRegistry([keys('reports', [{ name: 'motion', selector: 'report', type: 'Number' }], { typeSelectors: [{ name: 'report' }] })])).not.toThrow();
        expect(refusalOf(() => new LexicaRegistry([keys('sensors', [{ name: 'motion', selector: 'report', type: 'Number' }]), reports()]))).toMatchObject({ module: 'sensors', declaration: 'motion', declarationKey: 'selector', message: expect.stringContaining("The key 'motion' belongs to the type selector 'report', which no module registered declares") });
    });

    it('are selected through by a parameter only once a module declares them, and map keys to types a module declares', () => {
        expect(() => new LexicaRegistry([reports(), new LexicaModule('charts', { members: [selecting('report')] })])).not.toThrow();
        expect(refusalOf(() => new LexicaRegistry([new LexicaModule('charts', { members: [selecting('report')] })]))).toMatchObject({ declaration: 'report', declarationKey: 'parameters', message: expect.stringContaining("The parameter 'kind' selects a type through 'report', which no module registered declares") });
        expect(messageOf(() => new LexicaRegistry([reports(), keys('doors', [{ name: 'door:open', selector: 'report', type: 'door' }])]))).toContain("'door' names the type 'door', which neither Lexica nor a module registered with it declares");
    });
});

describe('conversions', () => {
    const STRING = Type.createNamedType('String');
    const CHART = Type.createNamedType('Chart', false, 'charts');
    const chart = { name: 'Chart', fields: { points: 'Number' } };
    const charts = (conversions, types = [chart]) => new LexicaModule('charts', { types, conversions });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, ...modules]);

    it('are found by their source type and their target, and listed by their source', () => {
        const parse = ({ value }) => ({ points: value.length });
        const registry = registering(charts([{ from: 'String', to: 'Chart', implementation: parse }, { from: 'Chart', to: 'String' }]))();

        expect(registry.getConversion(STRING, CHART)).toEqual({ from: 'String', to: 'Chart', implementation: parse });
        expect(registry.getConversion(CHART, Type.createNamedType('Number'))).toBeUndefined();
        expect(registry.getConversionTargets(STRING).map(type => type.identity)).toEqual(['Number', 'Boolean', 'charts.Chart']);
        expect(registry.getDeclaringModuleName(registry.getConversion(STRING, CHART))).toBe('charts');
    });

    it('are declared once for each source and target', () => {
        expect(messageOf(registering(charts([{ from: 'String', to: 'Chart' }, { from: 'String', to: 'Chart' }])))).toContain('The conversion from String to Chart is declared already');
    });

    it('take disjoint sources to one target', () => {
        const registry = registering(new LexicaModule('charts', { types: [chart, { name: 'Other', fields: { a: 'Number' } }], conversions: [{ from: 'String', to: 'Chart' }, { from: 'Other', to: 'Chart' }, { from: 'Number', to: 'Chart' }] }))();

        expect([STRING, Type.createNamedType('Other', false, 'charts'), Type.createNamedType('Number')].map(from => registry.getConversion(from, CHART)?.from)).toEqual(['String', 'Other', 'Number']);
    });

    it('convert to or from a type of their own module, Lexica\'s own module alone converting between the language\'s types', () => {
        expect(messageOf(registering(charts([{ from: 'String', to: 'Number' }])))).toContain("A conversion converts to or from one of its module's own types");
        expect(messageOf(() => new LexicaRegistry([new LexicaModule('lexica', { conversions: [{ from: 'String', to: 'Number' }] })]))).toContain("converts to or from one of its module's own types");
        expect(new LexicaRegistry([Vocabulary.module]).getConversion(STRING, Type.createNamedType('Number'))).toMatchObject({ from: 'String', to: 'Number' });
        expect(messageOf(registering(charts([{ from: 'Number', to: 'Boolean' }])))).toContain("converts to or from one of its module's own types");
    });

    it('convert between types of data a module declares, never a reference type, one that holds a reference or one that no module declares', () => {
        expect(messageOf(registering(new LexicaModule('charts', withHome({ types: [chart], conversions: [{ from: 'String', to: 'Chart' }, { from: 'Light', to: 'Chart' }] }))))).toContain("'Light' is no type of data");
        expect(messageOf(registering(charts([{ from: 'Axis', to: 'Chart' }])))).toContain("'Axis' names the type 'Axis', which neither Lexica nor a module registered with it declares");
        expect(messageOf(registering(new LexicaModule('charts', withHome({ types: [{ name: 'Chart', fields: { anchor: 'Light' } }], conversions: [{ from: 'String', to: 'Chart' }] }))))).toContain("'Chart' is no type of data");
    });

    it('convert a structured type that holds a list of data as any other, a list itself waiting for the collection model', () => {
        const registry = registering(charts([{ from: 'String', to: 'Chart' }], [{ name: 'Chart', fields: { points: 'List<Number>' } }]))();

        expect(registry.getConversion(STRING, CHART)).toBeDefined();
        expect(registry.isConvertible(CHART)).toBe(true);
        expect(registry.isConvertible(Type.parse('List<Number>'))).toBe(false);
    });

    it('classify a type as data where its values are data, an object type and a structure that holds itself among them, and a reference type or a structure holding one as no data', () => {
        const registry = registering(new LexicaModule('charts', withHome({
            types: [chart, { name: 'Tree', fields: { children: 'List<Tree>' } }, { name: 'Holder', fields: { lamp: 'Light' } }],
        })))();
        const named = name => Type.createNamedType(name, false, 'charts');
        const data = [Type.parse('Number'), Type.parse('null'), Type.never, Type.parse('List<String?>'), Type.createObjectType(new Map([['a', Type.parse('Number')]])), CHART, named('Tree')];
        const notData = [named('Light'), named('Holder'), Type.createObjectType(new Map([['lamp', named('Light')]])), Type.parse('List<Light>')];

        expect(data.map(type => registry.isData(type))).toEqual(data.map(() => true));
        expect(notData.map(type => registry.isData(type))).toEqual(notData.map(() => false));
    });

    it('convert a structured type that holds null, Never or a list of null as data, while null, Never, a list and a nullable type stay no endpoint', () => {
        for (const fieldType of ['null', 'Never', 'List<null>']) {
            const registry = registering(charts([{ from: 'String', to: 'Chart' }, { from: 'Chart', to: 'String' }], [{ name: 'Chart', fields: { points: fieldType } }]))();

            expect(registry.getConversion(STRING, CHART), fieldType).toBeDefined();
            expect(registry.getConversion(CHART, STRING), fieldType).toBeDefined();
            expect(registry.isConvertible(CHART), fieldType).toBe(true);
            expect([Type.parse('null'), Type.never, Type.parse('List<null>'), Type.createNamedType('Chart', true, 'charts')].map(type => registry.isConvertible(type)), fieldType).toEqual([false, false, false, false]);
        }

        for (const [from, to, end] of [['String', 'null', 'to'], ['Never', 'Chart', 'from'], ['String', 'List<null>', 'to'], ['Chart?', 'String', 'from']]) {
            expect(messageOf(() => charts([{ from, to }])), `${from} to ${to}`).toContain(`its '${end}' is none of them`);
        }
    });
});

describe("a module's own collisions", () => {
    const lit = (overrides = {}) => declaration({ name: 'lit', kind: 'function', target: 'Light', result: 'Boolean', parameters: [], ...overrides });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, ...modules]);

    it('refuse members of one name on one receiver type, an exact duplicate, and register them on overlapping receivers, a type and the type beneath it among them', () => {
        expect(refusalOf(registering(new LexicaModule('lit', withHome({ members: [lit(), lit()] }))))).toMatchObject({ declaration: 'lit', declarationKey: 'target' });
        expect(messageOf(registering(new LexicaModule('lit', withHome({ members: [lit(), lit({ target: ['Room', 'Light'] })] }))))).toContain("'lit' is declared already for Light");
        expect(registering(new LexicaModule('lit', withHome({ members: [lit(), lit({ target: 'Device' })] })))().getReceiverMembers('lit')).toHaveLength(2);
        expect(registering(new LexicaModule('lit', withHome({ members: [lit(), declaration({ name: 'lit', target: 'Device' })] })))().getReceiverMembers('lit')).toHaveLength(2);
    });

    it('take one name on receivers that do not overlap, each receiver selecting its own', () => {
        const views = new LexicaModule('views', { types: [{ name: 'PanelView', fields: { a: 'Number' } }, { name: 'RowView', fields: { a: 'Number' } }], members: [lit({ target: 'PanelView' }), lit({ target: 'RowView' })] });

        expect(registering(views)().getReceiverMembers('lit')).toHaveLength(2);
    });

    it('find a module by its name, which gives its namespace, every module but Lexica\'s own', () => {
        const views = new LexicaModule('views', withHome({ members: [lit()] }));
        const registry = registering(views)();

        expect(registry.getModule('views')).toBe(views);
        expect(registry.namespaceNames).toEqual(['views']);
        expect(registry.moduleNames).toEqual(['lexica', 'views']);
    });
});
