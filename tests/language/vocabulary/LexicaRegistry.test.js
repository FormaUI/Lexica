import { describe, it, expect } from 'vitest';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { declaration, functionDeclaration, messageOf, parameter, refusalOf } from './declarations.mjs';

describe('LexicaRegistry', () => {
    const own = () => new LexicaModule('charts', {
        types: [{ name: 'chart', fields: { points: 'number' } }],
        members: [declaration({ name: 'points', target: 'chart' }), declaration({ name: 'charts', target: 'element' })],
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
        expect(failing({ members: [functionDeclaration({ name: 'charts', parameters: [parameter({ name: 'range', type: 'range' })] })] })).toContain("names the type 'range'");
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
            members: [functionDeclaration({ name: 'charts', parameters: [parameter({ name: 'value', type, required: false, default: value })] })],
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

    it('takes a tolerance for a result of a structured type, whichever module declares it, now that every type is known', () => {
        const boxes = new LexicaModule('boxes', { types: [{ name: 'box', fields: { width: 'number' } }] });
        const sized = new LexicaModule('sized', { members: [declaration({ name: 'bounds', result: 'box?', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] });

        expect(() => new LexicaRegistry([Vocabulary.module, boxes, sized])).not.toThrow();
    });

    it('lets a module declare a member of any name on a type another module or the language declares', () => {
        const charts = new LexicaModule('charts', { types: [{ name: 'chart', fields: { points: 'number' } }] });
        const zoom = new LexicaModule('zoom', { members: [declaration({ name: 'scale', target: 'chart' }), declaration({ name: 'level', target: 'element' })] });
        const registry = new LexicaRegistry([Vocabulary.module, charts, zoom]);

        expect(registry.getMembers('scale').map(member => registry.getOwner(member))).toEqual(['zoom']);
        expect(registry.getMembers('level').map(member => member.target)).toEqual(['element']);
    });

    it('refuses a member the registry already answers on the same receiver, naming its target', () => {
        const module = new LexicaModule('charts', { members: [declaration({ name: 'charts', target: 'element' }), declaration({ name: 'charts', target: 'element' })] });

        expect(refusalOf(() => new LexicaRegistry([module]))).toMatchObject({ declaration: 'charts', field: 'target' });
        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, new LexicaModule('count', { members: [declaration({ name: 'count', target: 'list<number>' })] })]))).toContain('declared already');
    });

    it('refuses a member on a kind of node that the same name on node already answers', () => {
        const parents = new LexicaModule('parent', { members: [declaration({ name: 'parent', target: 'node' })] });

        expect(messageOf(() => new LexicaRegistry([Vocabulary.module, parents, new LexicaModule('other', { members: [declaration({ name: 'other', target: 'element' }), declaration({ name: 'parent', target: 'shadowRoot' })] })]))).toContain('declared already');
    });

    it('lets one name answer on different receivers', () => {
        const owners = new LexicaRegistry([new LexicaModule('host', { members: [declaration({ name: 'size', target: 'window' }), declaration({ name: 'size', target: 'element' })] })]).getMembers('size').map(member => member.target);

        expect(owners).toEqual(['window', 'element']);
    });

    describe('module members, which have no target', () => {
        it('are declared once by name within their module, which no member of a receiver collides with', () => {
            const home = new LexicaModule('home', { members: [declaration({ name: 'now', target: undefined }), declaration({ name: 'now', target: 'element' })] });

            expect(() => new LexicaRegistry([Vocabulary.module, home])).not.toThrow();
            expect(refusalOf(() => new LexicaRegistry([new LexicaModule('home', { members: [declaration({ name: 'now', target: undefined }), declaration({ name: 'now', target: undefined })] })]))).toMatchObject({ declaration: 'now', field: 'name' });
        });

        it('take one name in two modules, each read through its own namespace', () => {
            const declaring = name => new LexicaModule(name, { members: [declaration({ name: 'now', target: undefined })] });
            const [home, office] = [declaring('home'), declaring('office')];
            const registry = new LexicaRegistry([home, office]);

            expect([home, office].map(module => registry.getOwner(module.members[0]))).toEqual(['home', 'office']);
            expect(registry.getMembers('now')).toEqual([]);
        });
    });

    it('refuses an event or a type declared twice', () => {
        const events = () => new LexicaModule('twice', { types: [{ name: 'ping', fields: { at: 'number' } }], eventTypes: [{ name: 'tick', data: 'ping' }] });

        expect(messageOf(() => new LexicaRegistry([new LexicaModule('first', { types: [{ name: 'pong', fields: { at: 'number' } }], eventTypes: [{ name: 'tick', data: 'pong' }] }), events()]))).toContain("'tick' is declared already");
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
            expect(refusalOf(() => new LexicaRegistry([watching({ observations: [{ type: 'unknown', of: 'receiver' }] })]))).toMatchObject({ declaration: 'charts', field: 'updates.observations' });
        });

        it('give a member that reads maintained values a maintained observation, and give no other member one', () => {
            expect(() => new LexicaRegistry([watching({ reads: 'maintained', observations: [{ type: 'sampled', of: 'receiver' }] })])).not.toThrow();
            expect(messageOf(() => new LexicaRegistry([watching({ reads: 'maintained' })]))).toContain('names a maintained observation');
            expect(messageOf(() => new LexicaRegistry([watching({ observations: [{ type: 'sampled', of: 'receiver' }] })]))).toContain('reads maintained values');
        });

        it('observe a target the module declaring their type declares, whichever module names it', () => {
            expect(() => new LexicaRegistry([watching({ observations: [{ type: 'ticks', of: 'page' }, { type: 'ticks', of: 'frames' }] })])).not.toThrow();
            expect(() => new LexicaRegistry([watching(), observingFrom('frame')])).not.toThrow();
            expect(refusalOf(() => new LexicaRegistry([watching(), observingFrom('panel')]))).toMatchObject({ declaration: 'later', field: 'updates.observations' });
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
    const reports = () => new LexicaModule('reports', { typeSelectors: [{ name: 'report' }], selectableTypes: [{ name: 'motion', selector: 'report', type: 'number' }] });
    const keys = (name, selectableTypes, contents = {}) => new LexicaModule(name, { selectableTypes, ...contents });
    const selecting = selector => functionDeclaration({ name: 'report', result: '@selected', parameters: [parameter({ name: 'kind', type: 'string', fixed: true, selects: 'type', selector })] });

    it('map each key to its type, a selector and its keys owned by the modules that declare them', () => {
        const registry = new LexicaRegistry([reports(), keys('doors', [{ name: 'door:open', selector: 'report', type: 'boolean' }])]);

        expect(registry.getSelectableType('report', 'motion')).toEqual({ name: 'motion', selector: 'report', type: 'number' });
        expect(registry.getSelectableType('report', 'smoke')).toBeUndefined();
        expect(registry.getOwner(registry.getTypeSelector('report'))).toBe('reports');
        expect(registry.getOwner(registry.getSelectableType('report', 'door:open'))).toBe('doors');
        expect(registry.revision).toBe(2);
    });

    it('are named once across every module', () => {
        expect(refusalOf(() => new LexicaRegistry([reports(), new LexicaModule('again', { typeSelectors: [{ name: 'report' }] })]))).toMatchObject({ module: 'again', declaration: 'report', field: 'name', message: expect.stringContaining("The type selector 'report' is declared already, by the module 'reports'") });
    });

    it('take each key once, from the module that declares it first, and never replace it', () => {
        const message = "The type selector 'report' maps the key 'motion' already, as the module 'reports' declared it, and a key is never replaced";

        expect(refusalOf(() => new LexicaRegistry([reports(), keys('sensors', [{ name: 'motion', selector: 'report', type: 'string' }])]))).toMatchObject({ module: 'sensors', declaration: 'motion', field: 'name', message: expect.stringContaining(message) });
        expect(messageOf(() => new LexicaRegistry([keys('reports', [{ name: 'motion', selector: 'report', type: 'number' }, { name: 'motion', selector: 'report', type: 'string' }], { typeSelectors: [{ name: 'report' }] })]))).toContain(message);
    });

    it('take keys of a selector its own module or one registered before it declares, and of no other', () => {
        expect(() => new LexicaRegistry([keys('reports', [{ name: 'motion', selector: 'report', type: 'number' }], { typeSelectors: [{ name: 'report' }] })])).not.toThrow();
        expect(refusalOf(() => new LexicaRegistry([keys('sensors', [{ name: 'motion', selector: 'report', type: 'number' }]), reports()]))).toMatchObject({ module: 'sensors', declaration: 'motion', field: 'selector', message: expect.stringContaining("The key 'motion' belongs to the type selector 'report', which no module registered declares") });
    });

    it('are selected through by a parameter only once a module declares them, and map keys to types a module declares', () => {
        expect(() => new LexicaRegistry([reports(), new LexicaModule('charts', { members: [selecting('report')] })])).not.toThrow();
        expect(refusalOf(() => new LexicaRegistry([new LexicaModule('charts', { members: [selecting('report')] })]))).toMatchObject({ declaration: 'report', field: 'parameters', message: expect.stringContaining("The parameter 'kind' selects a type through 'report', which no module registered declares") });
        expect(messageOf(() => new LexicaRegistry([reports(), keys('doors', [{ name: 'door:open', selector: 'report', type: 'door' }])]))).toContain("'door' names the type 'door', which neither Lexica nor a module registered with it declares");
    });
});

describe('conversions', () => {
    const chart = { name: 'chart', fields: { points: 'number' } };
    const charts = (conversions, types = [chart]) => new LexicaModule('charts', { types, conversions });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, ...modules]);

    it('are found by their source type and their target, and listed by their source', () => {
        const parse = ({ value }) => ({ points: value.length });
        const registry = registering(charts([{ from: 'string', to: 'chart', implementation: parse }, { from: 'chart', to: 'string' }]))();

        expect(registry.getConversion('string', 'chart')).toEqual({ from: 'string', to: 'chart', implementation: parse });
        expect(registry.getConversion('chart', 'number')).toBeUndefined();
        expect(registry.getConversionTargets('string')).toEqual(['number', 'boolean', 'chart']);
        expect(registry.getOwner(registry.getConversion('string', 'chart'))).toBe('charts');
    });

    it('are declared once for each source and target', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart' }, { from: 'string', to: 'chart' }])))).toContain('The conversion from string to chart is declared already');
    });

    it('take disjoint sources to one target', () => {
        const registry = registering(new LexicaModule('charts', { types: [chart, { name: 'other', fields: { a: 'number' } }], conversions: [{ from: 'string', to: 'chart' }, { from: 'other', to: 'chart' }, { from: 'number', to: 'chart' }] }))();

        expect(['string', 'other', 'number'].map(from => registry.getConversion(from, 'chart')?.from)).toEqual(['string', 'other', 'number']);
    });

    it('convert to or from a type of their own module, Lexica\'s own module alone converting between the language\'s types', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'number' }])))).toContain("A conversion converts to or from one of its module's own types");
        expect(messageOf(() => new LexicaRegistry([new LexicaModule('lexica', { conversions: [{ from: 'string', to: 'number' }] })]))).toContain("converts to or from one of its module's own types");
        expect(new LexicaRegistry([Vocabulary.module]).getConversion('string', 'number')).toMatchObject({ from: 'string', to: 'number' });
        expect(messageOf(registering(charts([{ from: 'number', to: 'boolean' }])))).toContain("converts to or from one of its module's own types");
    });

    it('convert between types of data a module declares, never one that holds a node or that no module declares', () => {
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart' }, { from: 'pointerEvent', to: 'chart' }])))).toContain("'pointerEvent' is no type of data");
        expect(messageOf(registering(charts([{ from: 'axis', to: 'chart' }])))).toContain("'axis' is no type of data");
        expect(messageOf(registering(charts([{ from: 'string', to: 'chart' }], [{ name: 'chart', fields: { anchor: 'element' } }])))).toContain("'chart' is no type of data");
    });

    it('convert a structured type that holds a list of data as any other, a list itself waiting for the collection model', () => {
        const registry = registering(charts([{ from: 'string', to: 'chart' }], [{ name: 'chart', fields: { points: 'list<number>' } }]))();

        expect(registry.getConversion('string', 'chart')).toBeDefined();
        expect(registry.isConvertible('chart')).toBe(true);
        expect(registry.isConvertible('list<number>')).toBe(false);
    });
});

describe('predicates', () => {
    const lit = (overrides = {}) => ({ name: 'lit', target: 'element', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: 'receiver', attributes: ['data-lit'] }] }, ...overrides });
    // The observation type the predicates name, which a module of its own declares.
    const observing = new LexicaModule('observing', { observationTypes: [{ name: 'mutation', contract: 'invalidation' }] });
    const registering = (...modules) => () => new LexicaRegistry([Vocabulary.module, observing, ...modules]);

    it('are found by their name, with the module that declares each', () => {
        const registry = registering(new LexicaModule('lit', { predicates: [lit()] }))();

        expect(registry.getPredicates('lit')).toEqual([{ verb: 'is', ...lit() }]);
        expect(registry.getPredicates('dim')).toEqual([]);
        expect(registry.predicateNames).toContain('lit');
        expect(registry.getOwner(registry.getPredicates('lit')[0])).toBe('lit');
    });

    it('take any name on any type, their module\'s own or another\'s, as members do', () => {
        const own = new LexicaModule('glow', { types: [{ name: 'glowView', fields: { level: 'number' } }], predicates: [lit({ name: 'bright', target: 'glowView' }), lit({ name: 'dim', target: 'glowView' })] });

        expect(registering(own)().getPredicates('dim')).toHaveLength(1);
        expect(registering(new LexicaModule('glow', { predicates: [lit({ name: 'bright' })] }))().getPredicates('bright')).toHaveLength(1);
    });

    it('are declared once for any receiver, and once for each of receivers that do not overlap', () => {
        expect(refusalOf(registering(new LexicaModule('lit', { predicates: [lit(), lit()] })))).toMatchObject({ declaration: 'lit', field: 'target' });

        const views = new LexicaModule('views', { types: [{ name: 'panelView', fields: { a: 'number' } }, { name: 'rowView', fields: { a: 'number' } }], predicates: [lit({ name: 'lit', target: 'panelView' }), lit({ name: 'lit', target: 'rowView' })] });

        expect(registering(views)().getPredicates('lit')).toHaveLength(2);
        expect(messageOf(registering(new LexicaModule('lit', { predicates: [lit(), lit({ target: 'node' })] })))).toContain("The predicate 'lit' is declared already for element");
    });

    it('apply to types Lexica or a module declares, through observations a module declares', () => {
        expect(messageOf(registering(new LexicaModule('lit', { predicates: [lit({ target: 'lamp' })] })))).toContain("'lamp' names the type 'lamp', which neither Lexica nor a module registered with it declares");
        expect(messageOf(registering(new LexicaModule('lit', { predicates: [lit({ updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'glow', of: 'receiver' }] } })] })))).toContain("The observation type 'glow' is declared by no module");
    });
});
