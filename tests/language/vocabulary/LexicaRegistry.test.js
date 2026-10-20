import { describe, it, expect } from 'vitest';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { declaration, messageOf } from './declarations.mjs';

describe('LexicaRegistry', () => {
    const own = () => new LexicaModule('charts', {
        types: [{ name: 'chart', fields: { points: 'number' } }],
        members: [declaration({ name: 'points', on: 'chart' }), declaration({ name: 'charts', on: 'element' })],
    });

    it('registers Lexica\'s own module and a module beside it', () => {
        expect(new LexicaRegistry([Vocabulary.module, own()]).moduleNames).toEqual(['lexica', 'charts']);
    });

    it('refuses a module registered twice', () => {
        expect(messageOf(() => new LexicaRegistry([own(), own()]))).toContain('name is taken');
    });

    it('refuses what no createModule made, naming it', () => {
        expect(messageOf(() => new LexicaRegistry([{ name: 'fake', members: [] }]))).toContain('A module is registered as createModule makes it');
    });

    it('refuses a type a declaration names that neither Lexica nor a module registered with it declares', () => {
        const failing = contents => messageOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', contents)]));

        expect(failing({ members: [declaration({ name: 'charts', result: 'chart' })] })).toContain("'chart' names the type 'chart', which neither Lexica nor a module registered with it declares");
        expect(failing({ members: [declaration({ name: 'charts', result: 'list<chart?>' })] })).toContain("'list<chart?>' names the type 'chart'");
        expect(failing({ types: [{ name: 'chart', fields: { axis: 'axis' } }] })).toContain("names the type 'axis'");
        expect(failing({ eventTypes: [{ name: 'chartclick', data: 'chartEvent' }] })).toContain("names the type 'chartEvent'");
        expect(failing({ members: [declaration({ name: 'charts', kind: 'operation', input: 'positional', parameters: [{ name: 'range', kind: 'value', type: 'range', required: true, nulls: 'propagate' }] })] })).toContain("names the type 'range'");
    });

    it('takes a type the module declares wherever it declares it, and one an earlier module declares, whatever the order of the declarations', () => {
        const axes = new LexicaModule('axes', { types: [{ name: 'axis', fields: { length: 'number' } }] });
        const charts = new LexicaModule('charts', {
            members: [declaration({ name: 'charts', result: 'chart' })],
            types: [{ name: 'chart', fields: { axis: 'axis', domain: 'list<number>' } }],
        });

        expect(() => new LexicaRegistry([Vocabulary.module, axes, charts])).not.toThrow();
        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, charts, axes]))).toContain("names the type 'axis'");
    });

    it('refuses a default its parameter does not admit, by its type, its nullability and a structure\'s fields', () => {
        const range = new LexicaModule('ranges', { types: [{ name: 'range', fields: { start: 'number', end: 'number?' } }] });
        const registering = (type, value) => () => new LexicaRegistry([Vocabulary.module, range, new LexicaModule('charts', {
            members: [declaration({ name: 'charts', kind: 'operation', input: 'positional', parameters: [{ name: 'value', kind: 'value', type, required: false, default: value, nulls: 'propagate' }] })],
        })]);

        expect(messageOf(registering('number', 'many'))).toContain("The default of 'value' is no number");
        expect(messageOf(registering('number', null))).toContain('is no number');
        expect(messageOf(registering('list<string>', ['a', 1]))).toContain('is no list<string>');
        expect(messageOf(registering('range', { start: 0 }))).toContain('is no range');
        expect(messageOf(registering('element?', {}))).toContain('is no element?');
        expect(registering('number?', null)).not.toThrow();
        expect(registering('list<string>', ['a', 'b'])).not.toThrow();
        expect(registering('range', { start: 0, end: null })).not.toThrow();
    });

    it('lets a module declare a member of any name on a type another module or the language declares', () => {
        const charts = new LexicaModule('charts', { types: [{ name: 'chart', fields: { points: 'number' } }] });
        const zoom = new LexicaModule('zoom', { members: [declaration({ name: 'scale', on: 'chart' }), declaration({ name: 'level', on: 'element' })] });
        const registry = new LexicaRegistry([Vocabulary.module, charts, zoom]);

        expect(registry.getMembers('scale').map(member => registry.getOwner(member))).toEqual(['zoom']);
        expect(registry.getMembers('level').map(member => member.on)).toEqual(['element']);
    });

    it('refuses a member the registry already answers on the same receiver', () => {
        const module = new LexicaModule('charts', { members: [declaration({ name: 'charts', on: 'element' }), declaration({ name: 'charts', on: 'element' })] });

        expect(messageOf(() => new LexicaRegistry([module]))).toContain('declared already');
        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('count', { members: [declaration({ name: 'count', on: 'list<number>' })] })]))).toContain('declared already');
    });

    it('refuses a member on a kind of node that the same name on node already answers', () => {
        const parents = new LexicaModule('parent', { members: [declaration({ name: 'parent', on: 'node' })] });

        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, parents, new LexicaModule('other', { members: [declaration({ name: 'other', on: 'element' }), declaration({ name: 'parent', on: 'shadowRoot' })] })]))).toContain('declared already');
    });

    it('lets one name answer on different receivers', () => {
        const owners = new LexicaRegistry([new LexicaModule('host', { members: [declaration({ name: 'size', on: 'window' }), declaration({ name: 'size', on: 'element' })] })]).getMembers('size').map(member => member.on);

        expect(owners).toEqual(['window', 'element']);
    });

    it('refuses an event or a type declared twice', () => {
        const events = () => new LexicaModule('twice', { types: [{ name: 'ping', fields: { at: 'number' } }], eventTypes: [{ name: 'tick', data: 'ping' }] });

        expect(messageOf(() => new LexicaRegistry([new LexicaModule('first', { types: [{ name: 'pong', fields: { at: 'number' } }], eventTypes: [{ name: 'tick', data: 'pong' }] }), events()]))).toContain("'tick' is declared already");
    });

describe('observation types', () => {
        const types = [{ name: 'ticks', contract: 'invalidation', function: 'startTicks' }, { name: 'sampled', contract: 'maintained', function: 'startSampled' }];
        const functions = { startTicks: () => ({}), startSampled: () => ({}), zoom: () => 1 };
        const watching = (overrides, moduleTypes = types) => new LexicaModule('charts', { observationTypes: moduleTypes, members: [declaration({ name: 'charts', changes: 'observable', observations: [{ type: 'ticks', of: 'receiver' }], ...overrides })] }, functions);

        it('are declared by a module, which its members and the members of later modules use', () => {
            const later = new LexicaModule('later', { members: [declaration({ name: 'later', changes: 'observable', observations: [{ type: 'ticks', of: 'receiver' }] })] });

            expect(() => new LexicaRegistry([watching({}), later])).not.toThrow();
            expect(new LexicaRegistry([watching({})]).getObservationType('ticks')).toMatchObject({ name: 'ticks', contract: 'invalidation', shared: true });
        });

        it('are declared once', () => {
            expect(messageOf(() => new LexicaRegistry([watching({}), new LexicaModule('again', { observationTypes: [types[0]] }, functions)]))).toContain("observation type 'ticks' is declared already");
        });

        it('are declared by some module for every observation a member names', () => {
            expect(messageOf(() => new LexicaRegistry([watching({ observations: [{ type: 'unknown', of: 'receiver' }] })]))).toContain("observation type 'unknown' is declared by no module");
        });

        it('give a member that reads maintained values a maintained observation, and give no other member one', () => {
            expect(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'receiver' }] })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching({ reads: 'maintained' })]))).toContain('names a maintained observation');
            expect(messageOf(() => new LexicaRegistry([watching({ observations: [{ type: 'sampled', of: 'receiver' }] })]))).toContain('reads maintained values');
        });

        it('give a maintained observation one target, never the roots of a receiver, which are as many as its ancestry has', () => {
            expect(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'root' }] })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'roots' }] })]))).toContain("The maintained observation 'sampled' gives one sample, so it observes one target, never a receiver's roots");
        });

        it('start with the function their module supplies', () => {
            const registry = new LexicaRegistry([watching({})]);

            expect(registry.getFunction(registry.getObservationType('ticks'))).toBe(functions.startTicks);
        });
    });
});

describe('conversions', () => {
    const chart = { name: 'chart', fields: { points: 'number' } };
    const charts = (conversions, types = [chart]) => new LexicaModule('charts', { types, conversions });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, ...modules]);

    it('are found by their source type and their target, and listed by their source', () => {
        const registry = registering(charts([{ from: 'string', to: 'chart', function: 'parse' }, { from: 'chart', to: 'string', function: 'write' }]))();

        expect(registry.getConversion('string', 'chart')).toEqual({ from: 'string', to: 'chart', function: 'parse' });
        expect(registry.getConversion('chart', 'number')).toBeUndefined();
        expect(registry.getConversionTargets('string')).toEqual(['number', 'boolean', 'chart']);
        expect(registry.getOwner(registry.getConversion('string', 'chart'))).toBe('charts');
    });

    it('are declared once for each source and target', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart', function: 'parse' }, { from: 'string', to: 'chart', function: 'read' }])))).toContain('The conversion from string to chart is declared already');
    });

    it('take disjoint sources to one target', () => {
        const registry = registering(new LexicaModule('charts', { types: [chart, { name: 'other', fields: { a: 'number' } }], conversions: [{ from: 'string', to: 'chart', function: 'parse' }, { from: 'other', to: 'chart', function: 'convert' }, { from: 'number', to: 'chart', function: 'count' }] }))();

        expect(['string', 'other', 'number'].map(from => registry.getConversion(from, 'chart')?.function)).toEqual(['parse', 'convert', 'count']);
    });

    it('convert to or from a type of their own module, Lexica\'s own module alone converting between the language\'s types', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'number', function: 'parse' }])))).toContain("A conversion converts to or from one of its module's own types");
        expect(messageOf(() => new LexicaRegistry([new LexicaModule('lexica', { conversions: [{ from: 'string', to: 'number', function: 'parse' }] })]))).toContain("converts to or from one of its module's own types");
        expect(new LexicaRegistry([Vocabulary.module]).getConversion('string', 'number')).toMatchObject({ from: 'string', to: 'number' });
        expect(messageOf(registering(charts([{ from: 'number', to: 'boolean', function: 'parse' }])))).toContain("converts to or from one of its module's own types");
    });

    it('convert between types of data a module declares, never one that holds a node or that no module declares', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart', function: 'parse' }, { from: 'pointerEvent', to: 'chart', function: 'read' }])))).toContain("'pointerEvent' is no type of data");
        expect(messageOf(registering(charts([{ from: 'axis', to: 'chart', function: 'read' }])))).toContain("'axis' is no type of data");
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart', function: 'parse' }], [{ name: 'chart', fields: { anchor: 'element' } }])))).toContain("'chart' is no type of data");
    });

    it('convert a structured type that holds a list of data as any other, a list itself waiting for the collection model', () => {
        const registry = registering(charts([{ from: 'string', to: 'chart', function: 'parse' }], [{ name: 'chart', fields: { points: 'list<number>' } }]))();

        expect(registry.getConversion('string', 'chart')?.function).toBe('parse');
        expect(registry.isConvertible('chart')).toBe(true);
        expect(registry.isConvertible('list<number>')).toBe(false);
    });
});

describe('conditions', () => {
    const lit = (overrides = {}) => ({ name: 'lit', function: 'isLit', on: 'element', changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: 'receiver', attributes: ['data-lit'] }], ...overrides });
    // The observation type the conditions name, which a module of its own declares.
    const observing = new LexicaModule('observing', { observationTypes: [{ name: 'mutation', contract: 'invalidation', function: 'observeMutation' }] });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, observing, ...modules]);

    it('are found by their name, with the module that declares each', () => {
        const registry = registering(new LexicaModule('lit', { conditions: [lit()] }))();

        expect(registry.getConditions('lit')).toEqual([{ verb: 'is', ...lit() }]);
        expect(registry.getConditions('dim')).toEqual([]);
        expect(registry.conditionNames).toContain('lit');
        expect(registry.getOwner(registry.getConditions('lit')[0])).toBe('lit');
    });

    it('take any name on any type, their module\'s own or another\'s, as members do', () => {
        const own = new LexicaModule('glow', { types: [{ name: 'glowView', fields: { level: 'number' } }], conditions: [lit({ name: 'bright', on: 'glowView' }), lit({ name: 'dim', on: 'glowView' })] });

        expect(registering(own)().getConditions('dim')).toHaveLength(1);
        expect(registering(new LexicaModule('glow', { conditions: [lit({ name: 'bright' })] }))().getConditions('bright')).toHaveLength(1);
    });

    it('are declared once for any receiver, and once for each of receivers that do not overlap', () => {
        expect(messageOf(registering(new LexicaModule('lit', { conditions: [lit(), lit({ function: 'other' })] })))).toContain("The condition 'lit' is declared already for element");

        const views = new LexicaModule('views', { types: [{ name: 'panelView', fields: { a: 'number' } }, { name: 'rowView', fields: { a: 'number' } }], conditions: [lit({ name: 'lit', on: 'panelView' }), lit({ name: 'lit', on: 'rowView' })] });

        expect(registering(views)().getConditions('lit')).toHaveLength(2);
        expect(messageOf(registering(new LexicaModule('lit', { conditions: [lit(), lit({ on: 'node', function: 'other' })] })))).toContain("The condition 'lit' is declared already for element");
    });

    it('apply to types Lexica or a module declares, through observations a module declares', () => {
        expect(messageOf(registering(new LexicaModule('lit', { conditions: [lit({ on: 'lamp' })] })))).toContain("'lamp' names the type 'lamp', which neither Lexica nor a module registered with it declares");
        expect(messageOf(registering(new LexicaModule('lit', { conditions: [lit({ observations: [{ type: 'glow', of: 'receiver' }] })] })))).toContain("The observation type 'glow' is declared by no module");
    });
});
