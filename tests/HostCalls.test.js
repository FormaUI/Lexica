import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

const { property, valueParameter } = lexica.declarations;

/** A host call of a device, named by a string: a function its host invokes, which supplies values of the result's type, or none where it declares none. */
const hostCall = (name, result, options) => lexica.declarations.function(name, 'string', result, { invokedBy: 'host', ...options });

/** A home's module: a light dimmed to a level, which supplies the level it reached; a thermostat held at a target, which supplies nothing; a sensor watched for motion, which supplies each motion; and a device's room. */
const createHome = () => lexica.createModule('home', {
    types: [{ name: 'motion', fields: { at: 'number', strength: 'number' } }],
    members: [
        hostCall('dim', 'number', { arguments: 'options', parameters: [valueParameter('to', 'number')] }),
        hostCall('hold', undefined, { arguments: 'options', parameters: [valueParameter('target', 'number')] }),
        hostCall('watch', 'motion'),
        property('room', 'string', 'string', { updates: { changes: 'constant', reads: 'fresh' }, implementation: ({ receiver }) => `${receiver}'s room` }),
    ],
});

const bindings = { light: 'hall', thermostat: 'hall', sensor: 'porch', lit: true };

/** The resolution of the text against a registry holding the home's module, with the home's bindings. */
const resolve = (text, values = bindings, modules = [createHome()]) => lexica.createRegistry(modules).resolve(text, values);

describe('host calls', () => {
    it('end a script, whose resolution answers the call by its name and the declaration it resolved to', () => {
        const home = createHome();
        const registry = lexica.createRegistry([home]);
        const resolution = registry.resolve('light.dim({ to = 40 })', bindings);

        expect(resolution.kind).toBe('hostCall');
        expect(resolution.hostCall).toEqual({ name: 'dim', declaration: home.members[0] });
        expect(Object.isFrozen(resolution.hostCall)).toBe(true);
        expect(registry.getOwner(resolution.hostCall.declaration)).toBe('home');
        expect(resolution.usedDeclarations.map(({ name, pointer }) => [name, pointer])).toEqual([['string.dim', '/expression']]);
        expect(resolve('light.room').hostCall).toBeNull();
    });

    it('are typed by the values their host supplies, as their result projection makes them, and give no result where their host supplies none', () => {
        expect(resolve('light.dim({ to = 40 })').type).toBe('number');
        expect(resolve('sensor.watch() { at = context.at, strong = context.strength > 0.8 }').type).toBe('{ at: number, strong: boolean }');
        expect(resolve('thermostat.hold({ target = 21 })').type).toBeNull();

        const refused = getError(() => resolve('thermostat.hold({ target = 21 })').typeAt([]));

        expect(refused).toBeInstanceOf(LexicaError);
        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression' } });
        expect(refused.message).toContain("The script ends in the host call 'hold', whose host supplies no values, so it has no result for a path to reach");
    });

    it('stand at the end of a body, its locals before them, and in a do block there, as the script\'s terminal position', () => {
        expect(resolve('let target = 21 return thermostat.hold({ target = target })').hostCall.name).toBe('hold');
        expect(resolve('do let level = 40 return light.dim({ to = level }) end').hostCall.name).toBe('dim');
        expect(resolve('let room = sensor.room return sensor.watch() { at = context.at, room = room }').type).toBe('{ at: number, room: string }');
        expect(resolve('light?.dim({ to = 40 })').hostCall.name).toBe('dim');
    });

    it('are refused anywhere else, by a validation error where they stand, though they are the last expression of a body or a function there', () => {
        const refusals = [
            ['{ level = light.dim({ to = 40 }) }', '/expression/fields/0/value', "The field 'level' is a host call, and a field is a value"],
            ['light.dim({ to = light.dim({ to = 1 }) })', '/expression/arguments/0/fields/0/value', "The argument 'to' of 'dim' is a host call, and an argument is a value"],
            ['if light.dim({ to = 40 }) then 1 else 2 end', '/expression/condition', "The condition of 'if' is a value, and this one is a host call"],
            ['light.dim({ to = 40 }) + 1', '/expression/left', "The left operand of '+' is a value, and this one is a host call"],
            ['if lit then light.dim({ to = 40 }) else light.dim({ to = 0 }) end', '/expression/consequent', "A branch of 'if' is a value, and this one is a host call"],
            ['let level = light.dim({ to = 40 }) return level', '/expression/locals/0/value', "The local 'level' is a host call, and a local is a value"],
            ['let level = do return light.dim({ to = 40 }) end return level', '/expression/locals/0/value/body/result', 'A host call ends the script, and this body gives its result to the expression around it, which takes a value'],
            ['let reach = () => light.dim({ to = 40 }) return reach()', '/expression/locals/0/value/body', "'reach' gives a host call, and a function gives a value"],
            ['sensor.watch() { level = light.dim({ to = 40 }) }', '/expression/fields/0/value', "The field 'level' is a host call, and a field is a value"],
            ['sensor.watch().at', '/expression', "'at' follows a host call, which takes no members"],
        ];

        for (const [text, pointer, message] of refusals) {
            const refused = getError(() => resolve(text));

            expect(refused, text).toBeInstanceOf(LexicaError);
            expect({ kind: refused.kind, pointer: refused.location.pointer }, text).toEqual({ kind: 'validation', pointer });
            expect(refused.message, text).toContain(message);
        }
    });

    it('take a result projection where their host supplies values, and none where it supplies none', () => {
        const refused = getError(() => resolve('thermostat.hold({ target = 21 }) { at = 1 }'));

        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression' } });
        expect(refused.message).toContain('The host call this object expression follows declares no result, since its host supplies no values, so it takes no result projection');
    });

    it('on a receiver of unknown type, keep their name and have no declaration yet, and are refused where the declarations disagree on who invokes them', () => {
        const dimmer = lexica.createModule('dimmer', {
            members: [lexica.declarations.function('dim', 'number', 'number', { updates: { changes: 'constant', reads: 'fresh' }, arguments: 'options', parameters: [valueParameter('to', 'number')], implementation: ({ args }) => args.to })],
        });

        expect(resolve('thing?.dim({ to = 40 })', { thing: null })).toMatchObject({ kind: 'hostCall', type: 'number?', hostCall: { name: 'dim', declaration: null } });
        expect(resolve('thing?.hold({ target = 21 })', { thing: null }).type).toBeNull();

        const refused = getError(() => resolve('thing?.dim({ to = 40 })', { thing: null }, [createHome(), dimmer]));

        expect(refused).toMatchObject({ kind: 'validation', location: { pointer: '/expression/target' } });
        expect(refused.message).toContain("'dim' follows a value whose type is unknown, and its declarations make a host call or a value, so what it requests is ambiguous");
    });

    it('have no implementation, which an evaluator needs none of, and are never evaluated', () => {
        const evaluator = resolve('light.dim({ to = 40 })').createEvaluator(bindings);
        const refused = getError(() => evaluator.evaluate());

        expect(refused).toMatchObject({ kind: 'evaluation', location: { pointer: '/expression' } });
        expect(refused.message).toContain("The script ends in the host call 'dim', which its host invokes, so it is never evaluated");
    });

    it('leave the definition as version 31 writes any call, validated and formatted as one', () => {
        const definition = lexica.parse('let target = 21 return thermostat.hold({ target = target })');

        expect(lexica.validate(definition)).toEqual(definition);
        expect(lexica.format(definition)).toBe('let target = 21\nreturn thermostat.hold({ target = target })');
    });
});
