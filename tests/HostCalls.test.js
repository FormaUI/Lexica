import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { Light, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { dataPropertyDeclarations, extensionDeclaration, hostFunctionDeclaration } from './support/declarations.mjs';
import { resolveWith, createImportingRegistry } from './support/pipeline.mjs';

const { createPropertyDeclaration, createValueParameterDeclaration, createFunctionDeclaration } = nexo.declarations;

/** A host call of a device, named by a string: a function its host invokes, which supplies values of the result's type, or none where it declares none. */

/**
 * A home's module: a light dimmed to a level, which supplies the level it reached; a thermostat held at a target, which supplies nothing; a sensor watched for motion, which supplies each motion; a device's reports of a kind,
 * each of the type the selector `event` maps the kind to; a device's reading of a name, of the type the selector `reading` maps the name to; a device's room; the level a device is set to and whether a room is occupied, each read
 * from the environment as it is when read; and a device's partner, which none has. The room and the level record each invocation, so a test sees which ran.
 */
const createHome = (invoked = []) => nexo.createModule('home', {
    types: [
        { name: 'Motion', kind: 'structured', members: dataPropertyDeclarations({ at: 'Number', strength: 'Number' }) },
        { name: 'Change', kind: 'structured', members: dataPropertyDeclarations({ setting: 'String', value: 'String?' }) },
        extensionDeclaration('StringExtensions', 'String', [
            hostFunctionDeclaration('dim', 'Number', { arguments: 'options', parameters: [createValueParameterDeclaration('to', 'Number')] }),
            hostFunctionDeclaration('hold', undefined, { arguments: 'options', parameters: [createValueParameterDeclaration('target', 'Number')] }),
            hostFunctionDeclaration('watch', 'Motion'),
            hostFunctionDeclaration('on', '@selected', { parameters: [createValueParameterDeclaration('type', 'String', { fixed: true, selects: 'type', selector: 'event' })] }),
            createFunctionDeclaration('reading', '@selected', { updates: { changes: 'constant', reads: 'fresh' }, parameters: [createValueParameterDeclaration('name', 'String', { fixed: true, selects: 'type', selector: 'reading' })], impl: ({ args }) => (args.name === 'level' ? 3 : 'warm') }),
            createPropertyDeclaration('room', 'String', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => (invoked.push(`room:${receiver}`), `${receiver}'s room`) }),
            createPropertyDeclaration('level', 'Number', { updates: { changes: 'unobserved', reads: 'fresh' }, impl: ({ receiver, env }) => (invoked.push(`level:${receiver}`), env.levels[receiver]) }),
            createPropertyDeclaration('occupied', 'Boolean', { updates: { changes: 'unobserved', reads: 'fresh' }, impl: ({ receiver, env }) => env.occupied.includes(receiver) }),
            createPropertyDeclaration('partner', 'String?', { updates: { changes: 'constant', reads: 'fresh' }, impl: () => null }),
        ]),
    ],
    typeSelectors: [{ name: 'event' }, { name: 'reading' }],
    mappings: [
        { key: 'motion', selector: 'event', type: 'Motion' },
        { key: 'change', selector: 'event', type: 'Change' },
        { key: 'level', selector: 'reading', type: 'Number' },
        { key: 'tone', selector: 'reading', type: 'String' },
    ],
});

const bindings = { light: 'hall', thermostat: 'hall', sensor: 'porch', lit: true };

/** The resolution of the text against a registry holding the home's module, with the home's bindings. */
const resolve = (text, values = bindings, modules = [createHome()]) => resolveWith(modules, text, values);

describe('host calls', () => {
    it('end a script, whose resolution answers the call by its name and the declaration it resolved to', () => {
        const home = createHome();
        const registry = createImportingRegistry([home]);
        const resolution = registry.resolve('light:dim({ to = 40 })', bindings);

        expect(resolution.hostCall).toEqual({ name: 'dim', declaration: home.types[2].members[0] });
        expect(Object.isFrozen(resolution.hostCall)).toBe(true);
        expect(registry.getDeclaringModuleName(resolution.hostCall.declaration)).toBe('home');
        expect(resolution.usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([['String.dim', '/expression']]);
        expect(resolve('light:room').hostCall).toBeNull();
    });

    it('are typed by the values their host supplies, as their result projection makes them, and give no result where their host supplies none', () => {
        expect(resolve('light:dim({ to = 40 })').type).toBe('Number');
        expect(resolve('sensor:watch() { at = it.at, strong = it.strength > 0.8 }').type).toBe('{ at: Number, strong: Boolean }');
        expect(resolve('thermostat:hold({ target = 21 })').type).toBeNull();

        const refused = errorThrownBy(() => resolve('thermostat:hold({ target = 21 })').typeAt([]));

        expect(refused).toBeInstanceOf(NexoError);
        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression' } });
        expect(refused.message).toContain("The script ends in the host call 'hold', whose host supplies no values, so it has no result for a path to reach");
    });

    it('stand at the end of a body, its locals before them, and in a do block there, as the script\'s terminal position', () => {
        expect(resolve('let target = 21\nreturn thermostat:hold({ target = target })').hostCall.name).toBe('hold');
        expect(resolve('do\n    let level = 40\n    return light:dim({ to = level })\nend').hostCall.name).toBe('dim');
        expect(resolve('let room = sensor:room\nreturn sensor:watch() { at = it.at, room = room }').type).toBe('{ at: Number, room: String }');
        expect(resolve('light?:dim({ to = 40 })').hostCall.name).toBe('dim');
    });

    it('are refused anywhere else, by a validation error where they stand, though they are the last expression of a body or a function there', () => {
        const refusals = [
            ['{ level = light:dim({ to = 40 }) }', '/expression/objectFields/0/value', "The field 'level' is a host call, and a field is a value"],
            ['light:dim({ to = light:dim({ to = 1 }) })', '/expression/arguments/0/objectFields/0/value', "The argument 'to' of 'dim' is a host call, and an argument is a value"],
            ['if light:dim({ to = 40 }) then 1 else 2 end', '/expression/condition', "The condition of 'if' is a value, and this one is a host call"],
            ['light:dim({ to = 40 }) + 1', '/expression/left', "The left operand of '+' is a value, and this one is a host call"],
            ['if lit then light:dim({ to = 40 }) else light.dim({ to = 0 }) end', '/expression/consequent', "A branch of 'if' is a value, and this one is a host call"],
            ['let level = light:dim({ to = 40 })\nreturn level', '/expression/locals/0/value', "The local 'level' is a host call, and a local is a value"],
            ['let level = do\n    return light:dim({ to = 40 })\nend\nreturn level', '/expression/locals/0/value/body/result', 'A host call ends the script, and this body gives its result to the expression around it, which takes a value'],
            ['let reach = () => light:dim({ to = 40 })\nreturn reach()', '/expression/locals/0/value/body', "'reach' gives a host call, and a function gives a value"],
            ['sensor:watch() { level = light:dim({ to = 40 }) }', '/expression/objectFields/0/value', "The field 'level' is a host call, and a field is a value"],
            ['sensor:watch().at', '/expression', "'at' follows a host call, which takes no members"],
        ];

        for (const [text, pointer, message] of refusals) {
            const refused = errorThrownBy(() => resolve(text));

            expect(refused, text).toBeInstanceOf(NexoError);
            expect({ kind: refused.kind, pointer: refused.location.pointer }, text).toEqual({ kind: 'validation', pointer });
            expect(refused.message, text).toContain(message);
        }
    });

    it('take a result projection where their host supplies values, and none where it supplies none', () => {
        const refused = errorThrownBy(() => resolve('thermostat:hold({ target = 21 }) { at = 1 }'));

        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression' } });
        expect(refused.message).toContain('The host call this object expression follows declares no result, since its host supplies no values, so it takes no result projection');
    });

    it('on a receiver of unknown type, keep their name and have no declaration yet, and are refused where the declarations disagree on who invokes them', () => {
        const dimmer = nexo.createModule('dimmer', {
            types: [extensionDeclaration('NumberExtensions', 'Number', [createFunctionDeclaration('dim', 'Number', { updates: { changes: 'constant', reads: 'fresh' }, arguments: 'options', parameters: [createValueParameterDeclaration('to', 'Number')], impl: ({ args }) => args.to })])],
        });

        expect(resolve('thing?:dim({ to = 40 })', { thing: null })).toMatchObject({ type: 'Number?', hostCall: { name: 'dim', declaration: null } });
        expect(resolve('thing?:hold({ target = 21 })', { thing: null }).type).toBeNull();

        const refused = errorThrownBy(() => resolve('thing?:dim({ to = 40 })', { thing: null }, [createHome(), dimmer]));

        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression/chain' } });
        expect(refused.message).toContain("'dim' follows a value whose type is unknown, and its declarations disagree on who invokes it, the evaluator or the host, so whether the script ends in a host call is ambiguous");
    });

    it('supply values of the type a fixed argument selects through a type selector, a bound parameter settling it as a literal does', () => {
        expect(resolve('sensor:on("motion") { at = it.at, strong = it.strength > 0.8 }').type).toBe('{ at: Number, strong: Boolean }');
        expect(resolve('sensor:on("change")').type).toBe('Change');
        expect(resolve('sensor:on(kind)', { ...bindings, kind: 'motion' }).type).toBe('Motion');

        const refused = errorThrownBy(() => resolve('sensor:on("smoke")'));

        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression/arguments/0' } });
        expect(refused.message).toContain("The type selector 'event' maps no type to the key 'smoke'");
    });

    it('select a type for a function the evaluator invokes as for one the host invokes', () => {
        const resolution = resolve('{ level = light:reading("level"), tone = light:reading("tone") }');

        expect(resolution.type).toBe('{ level: Number, tone: String }');
        expect(resolution.createEvaluator(bindings).evaluate().value).toEqual({ level: 3, tone: 'warm' });
    });

    it('have no implementation, which an evaluator needs none of, and are never evaluated', () => {
        const evaluator = resolve('light:dim({ to = 40 })').createEvaluator(bindings);
        const refused = errorThrownBy(() => evaluator.evaluate());

        expect(refused).toMatchObject({ kind: 'evaluation', location: { pointer: '/expression' } });
        expect(refused.message).toContain("The script ends in the host call 'dim', which its host invokes, so it is never evaluated; prepare it");
    });

    it('leave the definition as version 31 writes any call, validated and formatted as one', () => {
        const definition = nexo.parse('let target = 21\nreturn thermostat:hold({ target = target })');

        expect(nexo.validate(definition)).toEqual(definition);
        expect(nexo.format(definition)).toBe('let target = 21\nreturn thermostat:hold({ target = target })');
    });
});

describe('prepared calls', () => {
    /** An evaluator of the text against a registry holding the home's module, with the home's bindings and the environment given, and the registry itself. */
    const evaluatorOf = (text, { values = bindings, env = { levels: {}, occupied: [] }, invoked = [] } = {}) => {
        const home = createHome(invoked);
        const registry = createImportingRegistry([home]);

        return { evaluator: registry.resolve(text, values).createEvaluator(values, env), home, registry };
    };

    it('hold the declaration, the receiver and the arguments by parameter name, prepared once, and where the call stands', () => {
        const { evaluator, home } = evaluatorOf('light:dim({ to = 40 })');
        const call = evaluator.prepareHostCall();

        expect(call).toMatchObject({ kind: 'prepared', declaration: home.types[2].members[0], receiver: 'hall', args: { to: 40 }, pointer: '/expression' });
        expect(nexo.getLocation(nexo.parse('light:dim({ to = 40 })'), call.pointer)).toMatchObject({ pointer: '/expression', line: 1, column: 1 });
        expect(typeof call.project).toBe('function');
        expect(Object.isFrozen(call)).toBe(true);
    });

    it('describe a field of an object a local built before the call as an evaluation does, by the branch its value took, in every projection', () => {
        const tolerant = tolerance => ({ updates: { changes: 'constant', reads: 'fresh', tolerance } });
        const module = nexo.createModule('home', {
            types: [
                extensionDeclaration('StringExtensions', 'String', [
                    createPropertyDeclaration('fine', 'Number', { ...tolerant(0.1), impl: () => 1 }),
                    createPropertyDeclaration('coarse', 'Number', { ...tolerant(5), impl: () => 2 }),
                    hostFunctionDeclaration('dim', 'Number', { arguments: 'options', parameters: [createValueParameterDeclaration('to', 'Number')] }),
                ]),
            ],
        });
        const local = 'let o = { v = if lit then light:fine else light:coarse end }\nreturn ';
        const evaluated = resolve(`${local}{ via = o.v }`, bindings, [module]).createEvaluator(bindings).evaluate();
        const prepared = resolve(`${local}light:dim({ to = 40 }) { via = o.v }`, bindings, [module]).createEvaluator(bindings).prepareHostCall();

        expect(evaluated.metadata.objectFields.via.tolerance).toBe(0.1);
        expect(prepared.project(40).metadata.objectFields.via.tolerance).toBe(0.1);
        expect(prepared.project(30).metadata.objectFields.via.tolerance).toBe(0.1);
    });

    it('project each value their host supplies, checked against the type the call declares, answering as an evaluation does', () => {
        const dimmed = evaluatorOf('light:dim({ to = 40 })').evaluator.prepareHostCall();
        const watched = evaluatorOf('sensor:watch() { at = it.at, strong = it.strength > 0.8 }').evaluator.prepareHostCall();
        const projected = watched.project({ at: 5, strength: 0.9 });

        expect(dimmed.project(35)).toMatchObject({ value: 35, isPending: false });
        expect(projected.value).toEqual({ at: 5, strong: true });
        expect(watched.project({ at: 6, strength: 0.2 }).value).toEqual({ at: 6, strong: false });
        expect(Object.isFrozen(projected.value)).toBe(true);
        expect(projected.metadata.origin).toBeDefined();

        const refused = errorThrownBy(() => dimmed.project('bright'));

        expect(refused).toMatchObject({ kind: 'evaluation', location: { pointer: '/expression' } });
        expect(refused.message).toContain("The host call 'dim' supplied \"bright\", and it declares Number");
    });

    it('project for the host given, which is told as each projection ends', () => {
        const outcomes = [];
        const call = evaluatorOf('light:dim({ to = 40 })').evaluator.prepareHostCall();

        call.project(35, { afterEvaluation: outcome => outcomes.push(outcome) });

        expect(outcomes).toEqual([{ kind: 'completed', value: 35 }]);
    });

    it('have no project where their host supplies nothing', () => {
        const call = evaluatorOf('thermostat:hold({ target = 21 })').evaluator.prepareHostCall();

        expect(call).toMatchObject({ kind: 'prepared', args: { target: 21 } });
        expect('project' in call).toBe(false);
    });

    it('are skipped where the receiver, or an argument whose parameter propagates null, is null, or the call has no declaration yet, so there is nothing to invoke or project', () => {
        const skipped = [
            ['light:partner?:dim({ to = 40 })', bindings, '/expression/chain'],
            ['light:dim({ to = level })', { ...bindings, level: null }, '/expression'],
            ['thing?:dim({ to = 40 })', { thing: null }, '/expression/chain'],
        ];

        for (const [text, values, pointer] of skipped) {
            const call = evaluatorOf(text, { values }).evaluator.prepareHostCall();

            expect(call, text).toEqual({ kind: 'skipped', pointer });
            expect(Object.isFrozen(call), text).toBe(true);
        }
    });

    it('are refused for a script that gives a value, which is evaluated', () => {
        const refused = errorThrownBy(() => evaluatorOf('light:room').evaluator.prepareHostCall());

        expect(refused).toMatchObject({ kind: 'evaluation', location: { pointer: '/expression' } });
        expect(refused.message).toContain('The script gives a value and ends in no host call, so there is nothing to prepare; evaluate it');
    });

    it('evaluate the locals before the call once, and read them as prepared in every projection, never running their initializers again', () => {
        const invoked = [];
        const call = evaluatorOf('let room = sensor:room\nreturn sensor:watch() { at = it.at, room = room }', { invoked }).evaluator.prepareHostCall();

        expect(invoked).toEqual(['room:porch']);
        expect([1, 2, 3].map(at => call.project({ at, strength: 1 }).value)).toEqual([1, 2, 3].map(at => ({ at, room: "porch's room" })));
        expect(invoked).toEqual(['room:porch']);
    });

    it('read a member through a local as the projection reads it, and keep a value a local holds as it was prepared', () => {
        const env = { levels: {}, occupied: [] };
        const call = evaluatorOf('let room = sensor:room\nlet occupied = room:occupied\nreturn sensor:watch() { isOccupied = room:occupied, wasOccupied = occupied }', { env }).evaluator.prepareHostCall();

        env.occupied.push("porch's room");

        expect(call.project({ at: 1, strength: 1 }).value).toEqual({ isOccupied: true, wasOccupied: false });
    });

    it('call a function a local before the call holds in any projection', () => {
        const call = evaluatorOf('let label = level => $"{level} lux"\nreturn light:dim({ to = 40 }) { reached = label(it) }').evaluator.prepareHostCall();

        expect(call.project(35).value).toEqual({ reached: '35 lux' });
        expect(call.project(38).value).toEqual({ reached: '38 lux' });
    });

    it('of one evaluator stay apart, each projecting against the locals it was prepared with, interleaved, none evaluated again', () => {
        const invoked = [];
        const env = { levels: { hall: 40 }, occupied: [] };
        const { evaluator } = evaluatorOf('let level = light:level\nreturn light:dim({ to = level }) { reached = it, asked = level }', { env, invoked });
        const first = evaluator.prepareHostCall();

        env.levels.hall = 60;

        const second = evaluator.prepareHostCall();

        expect([first.args, second.args]).toEqual([{ to: 40 }, { to: 60 }]);
        expect(first.project(35).value).toEqual({ reached: 35, asked: 40 });
        expect(second.project(55).value).toEqual({ reached: 55, asked: 60 });
        expect(first.project(38).value).toEqual({ reached: 38, asked: 40 });
        expect(second.project(58).value).toEqual({ reached: 58, asked: 60 });
        expect(invoked).toEqual(['level:hall', 'level:hall']);
    });

    it('of one evaluator are prepared anew after a preparation fails in a local, the failed one leaving nothing in scope', () => {
        const env = { levels: {}, occupied: [] };
        const { evaluator } = evaluatorOf('let level = light:level\nreturn light:dim({ to = level }) { reached = it, asked = level }', { env });

        expect(errorThrownBy(() => evaluator.prepareHostCall())).toMatchObject({ code: 'NEXO5006', location: { pointer: '/expression/locals/0/value' } });

        env.levels.hall = 40;

        const call = evaluator.prepareHostCall();

        expect(call.args).toEqual({ to: 40 });
        expect(call.project(35).value).toEqual({ reached: 35, asked: 40 });
    });

    it('project through the checks every evaluation goes through, a call supplying a number, which capturing never recognizes, projecting on across a module declaring a typeOf', () => {
        const { evaluator, registry } = evaluatorOf('light:dim({ to = 40 })');
        const call = evaluator.prepareHostCall();

        registry.registerModule(nexo.createModule('later', { typeOf: () => null }));

        expect(call.project(35).value).toBe(35);
    });
});

describe('values a host supplies', () => {
    /** A light and a thermostat, references of two types the home declares, which its typeOf recognizes. */
    const lamp = new Light('lamp');
    const heater = new Thermostat('heater');

    /** A desk's module: a report its host supplies, with references, data and spots nested in it; a spot that may be none; and a spot a member answers, which its implementation answers with no label. */
    const createReports = () => nexo.createModule('reports', withHome({
        types: [
            { name: 'Spot', kind: 'structured', members: dataPropertyDeclarations({ x: 'Number', label: 'String?' }) },
            { name: 'Report', kind: 'structured', members: dataPropertyDeclarations({ target: 'Light?', owner: 'Light', note: 'String?', count: 'Number', spot: 'Spot?', spots: 'List<Spot>' }) },
            extensionDeclaration('StringExtensions', 'String', [
                createFunctionDeclaration('report', 'Report', { invokedBy: 'host' }),
                createFunctionDeclaration('maybe', 'Spot?', { invokedBy: 'host' }),
                createPropertyDeclaration('spotted', 'Spot', { updates: { changes: 'constant', reads: 'fresh' }, impl: () => ({ x: 1 }) }),
            ]),
        ],
    }));

    /** The call the text ends in, prepared against a registry holding the desk's module. */
    const prepared = text => createImportingRegistry([createReports()]).resolve(text, { desk: 'desk' }).createEvaluator({ desk: 'desk' }).prepareHostCall();
    const reporting = () => prepared('desk:report() { hasTarget = it.target != null, note = it.note, count = it.count, spot = it.spot, spots = it.spots }');
    const report = overrides => ({ target: lamp, owner: lamp, note: 'filed', count: 1, spot: { x: 1, label: 'a' }, spots: [{ x: 2, label: null }], ...overrides });

    /** The evaluation error a projection fails with, where the call stands, by its message. */
    const refusalOf = (call, value) => {
        const refused = errorThrownBy(() => call.project(value));

        expect(refused).toMatchObject({ kind: 'evaluation', location: { pointer: call.pointer } });

        return refused.message;
    };

    it('are captured as their type declares, a value it admits taken, a structure as its declared fields alone and a list item by item', () => {
        expect(reporting().project(report()).value).toEqual({ hasTarget: true, note: 'filed', count: 1, spot: { x: 1, label: 'a' }, spots: [{ x: 2, label: null }] });
        expect(prepared('desk:maybe()').project({ x: 3, label: 'b', extra: true }).value).toEqual({ x: 3, label: 'b' });
    });

    it('are null where nothing is supplied and the type is nullable, and fail where it is not, at every level', () => {
        const { note, spot, ...withoutNullables } = report();
        const { count, ...withoutCount } = report();

        expect(reporting().project(withoutNullables).value).toMatchObject({ note: null, spot: null });
        expect(reporting().project(report({ spot: { x: 4 } })).value.spot).toEqual({ x: 4, label: null });
        expect(refusalOf(reporting(), withoutCount)).toContain("The host call 'report' supplied a value without 'count', and 'count' is declared Number");
        expect(prepared('desk:maybe()').project(undefined).value).toBeNull();
    });

    it('take null where the type is nullable, and fail where it is not, the value itself among them', () => {
        expect(reporting().project(report({ note: null })).value.note).toBeNull();
        expect(prepared('desk:maybe()').project(null).value).toBeNull();
        expect(refusalOf(reporting(), report({ owner: null }))).toContain("supplied a value whose 'owner' is null, and 'owner' is declared Light");
        expect(refusalOf(reporting(), null)).toContain("The host call 'report' supplied null, and it declares Report");
    });

    it('narrow a reference of another type to null where a nullable reference type is declared, and fail where the type is not nullable', () => {
        expect(reporting().project(report({ target: heater })).value.hasTarget).toBe(false);
        expect(refusalOf(reporting(), report({ owner: heater }))).toContain("supplied a value whose 'owner' is an instance of Thermostat, and 'owner' is declared Light");
        expect(refusalOf(reporting(), report({ target: new Map() }))).toContain("supplied a value whose 'target' is an instance of Map, and 'target' is declared Light?");
    });

    it('fail on mistyped data whatever its type\'s nullability, naming the part of the value by its path at every level', () => {
        expect(refusalOf(reporting(), report({ note: 5 }))).toContain("supplied a value whose 'note' is 5, and 'note' is declared String?");
        expect(refusalOf(reporting(), report({ target: 'desk' }))).toContain("supplied a value whose 'target' is \"desk\", and 'target' is declared Light?");
        expect(refusalOf(reporting(), report({ spot: { x: 'far' } }))).toContain("supplied a value whose 'spot.x' is \"far\", and 'spot.x' is declared Number");
        expect(refusalOf(reporting(), report({ spots: [{ x: 1 }, { x: 'b' }] }))).toContain("supplied a value whose 'spots[1].x' is \"b\", and 'spots[1].x' is declared Number");
        expect(refusalOf(reporting(), report({ spots: [, { x: 1 }] }))).toContain("supplied a value whose 'spots' is");
    });

    it('are captured where a member\'s answer never is, its implementation answering what it declares', () => {
        const refused = errorThrownBy(() => createImportingRegistry([createReports()]).resolve('desk:spotted', { desk: 'desk' }).createEvaluator({ desk: 'desk' }).evaluate());

        expect(refused).toMatchObject({ kind: 'evaluation' });
        expect(prepared('desk:maybe()').project({ x: 1 }).value).toEqual({ x: 1, label: null });
    });
});
