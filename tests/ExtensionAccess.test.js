import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { Device, Light, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates, derivedUpdates } from './support/updates.mjs';
import { extensionDeclaration, hostFunctionDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration, createValueParameterDeclaration } = nexo.declarations;

/** What the home holds, each a value of Any its `item` answers by its key. */
const held = { lamp: new Light('lamp'), word: 'oat' };

/** The home: its devices, each labelled by its own `label`, a device found by its name, which may be none, and a value of Any by its key. */
const createHome = () => nexo.createModule('Home', withHome({
    members: [
        createFunctionDeclaration('find', 'Device?', { updates: constantUpdates, parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ args }) => (args.name === 'fan' ? new Device('fan') : null) }),
        createFunctionDeclaration('item', 'Any', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ args }) => held[args.key] }),
    ],
}, {
    Device: [createPropertyDeclaration('label', 'String', { updates: constantUpdates, impl: ({ receiver }) => `home ${receiver.name}` })],
}));

/**
 * Energy's extension of the home's devices: a usage, a label of its own, a reset to a level, a weight of an amount, whether it is active, a setting by its key, and an order its host invokes; and its
 * extension of lights, which glow.
 */
const createEnergy = () => nexo.createModule('Energy', {
    types: [
        extensionDeclaration('Device', 'Home.Device', [
            createPropertyDeclaration('usage', 'Number', { updates: derivedUpdates, impl: ({ receiver }) => receiver.name.length }),
            createPropertyDeclaration('label', 'String', { updates: constantUpdates, impl: ({ receiver }) => `energy ${receiver.name}` }),
            createFunctionDeclaration('reset', 'String', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('level', 'Number')], impl: ({ receiver, args }) => `${receiver.name} reset ${args.level}` }),
            createFunctionDeclaration('weigh', 'Number', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('amount', 'Number')], impl: ({ args }) => args.amount * 2 }),
            createIndexerDeclaration('setting', 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ receiver, args }) => `${receiver.name}.${args.key}` }),
            hostFunctionDeclaration('order', 'Number', { parameters: [createValueParameterDeclaration('count', 'Number')] }),
        ]),
        extensionDeclaration('Lights', 'Home.Light', [createPropertyDeclaration('glow', 'String', { updates: constantUpdates, impl: ({ receiver }) => `${receiver.name} glows` })]),
    ],
});

/** Solar's extension of the home's devices, of the same name as Energy's, which also reads a usage. */
const createSolar = () => nexo.createModule('Solar', { types: [extensionDeclaration('Device', 'Home.Device', [createPropertyDeclaration('usage', 'Number', { updates: derivedUpdates, impl: () => 0 })])] });

/** Labels' extension of the home's devices, named `label` as Energy's member is, which declares a length of its own. */
const createLabels = () => nexo.createModule('Labels', { types: [extensionDeclaration('label', 'Home.Device', [createPropertyDeclaration('length', 'String', { updates: constantUpdates, impl: ({ receiver }) => `${receiver.name} is long` })])] });

const values = { fan: new Device('fan'), lamp: new Light('lamp'), counts: [1, 2, 3] };

/** The resolution of the text against a registry of the home, Energy, Solar and Labels, read with the imports given. */
const resolve = (text, imports = ['Home', 'Energy']) => nexo.createRegistry([createHome(), createEnergy(), createSolar(), createLabels()]).resolve(text, values, { imports });

/** What the text evaluates to, read with the imports given. */
const evaluate = (text, imports) => resolve(text, imports).createEvaluator(values).evaluate().value;

/** The error resolving the text throws, read with the imports given. */
const refusal = (text, imports) => errorThrownBy(() => resolve(text, imports));

/** The error evaluating the text throws, read with the imports given. */
const failure = (text, imports) => errorThrownBy(() => evaluate(text, imports));

/** The first name of an extension access, which its colon is written before, and a later one, which continues it, as a definition records them. */
const first = (receiver, name, marks = {}) => ({ kind: 'memberAccess', receiver, name, ...marks, extension: true });
const then = (receiver, name) => ({ kind: 'memberAccess', receiver, name, continues: true });

describe('extension access', () => {
    describe('in text and definitions', () => {
        it("makes a grouped chain optional with '?:' as with '?.', so it stands as a cast's target within an optional enclosed access", () => {
            const extended = nexo.parse('(?((x?:E.y) as Light).w)').expression;
            const dotted = nexo.parse('(?((x?.y) as Light).w)').expression;
            const x = { kind: 'scriptParameter', name: 'x' };

            expect(extended.chain.receiver.operand).toEqual({ kind: 'optionalChain', chain: then(first(x, 'E', { optional: true }), 'y') });
            expect(dotted.chain.receiver.operand).toEqual({ kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: x, name: 'y', optional: true } });
        });

        it('records each name as written, the first holding the colon and each later one continuing it, a group ending them, and writes each form as it reads', () => {
            const fan = { kind: 'scriptParameter', name: 'fan' };
            const three = { kind: 'literal', value: 3 };
            const definitions = {
                'fan:usage': first(fan, 'usage'),
                'fan:Device.usage': then(first(fan, 'Device'), 'usage'),
                'fan:Energy.Device.usage': then(then(first(fan, 'Energy'), 'Device'), 'usage'),
                'fan:reset(3)': { kind: 'call', callee: first(fan, 'reset'), arguments: [three] },
                'fan:Device.reset(3)': { kind: 'call', callee: then(first(fan, 'Device'), 'reset'), arguments: [three] },
                'fan:setting["mode"]': { kind: 'indexerAccess', receiver: first(fan, 'setting'), argument: { kind: 'literal', value: 'mode' } },
                'fan?:usage': { kind: 'optionalChain', chain: first(fan, 'usage', { optional: true }) },
                'fan:label.length': then(first(fan, 'label'), 'length'),
                '(fan:label).length': { kind: 'memberAccess', receiver: first(fan, 'label'), name: 'length' },
                'fan:label?.length': { kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: first(fan, 'label'), name: 'length', optional: true } },
            };

            for (const [text, expression] of Object.entries(definitions)) {
                const definition = nexo.parse(text, { imports: ['Energy'] });

                expect(definition.expression, text).toEqual(expression);
                expect(nexo.format(definition, { imports: ['Energy'] }), text).toBe(text);
            }
        });

        it('ends its names at anything but a dot and a name, a call or a key closing them, and binds as a member access does', () => {
            expect(nexo.parse('fan:Device.reset(1):Words.size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', continues: true, receiver: { extension: true, name: 'Words', receiver: { kind: 'call', callee: { name: 'reset', continues: true } } } });
            expect(nexo.parse('fan:reset(1).size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', receiver: { kind: 'call', callee: { name: 'reset', extension: true } } });
            expect(nexo.parse('fan:setting["a"].size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', receiver: { kind: 'indexerAccess', receiver: { name: 'setting', extension: true } } });
            expect(nexo.parse('fan:label:size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', extension: true, receiver: { kind: 'memberAccess', name: 'label', extension: true } });
            expect(nexo.parse('a + b:half').expression).toMatchObject({ kind: 'arithmetic', right: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'b' }, extension: true } });
            expect(nexo.parse('(a + b):half').expression).toMatchObject({ kind: 'memberAccess', receiver: { kind: 'arithmetic' } });
        });

        it('reads an access alike whatever spaces and tabs stand between its tokens, a property access, a computed one and an extension access, qualified or not', () => {
            const alike = [
                ['x.y', 'x. y', 'x .y', 'x . y', 'x\t.\ty'],
                ['x:y', 'x: y', 'x :y', 'x : y'],
                ['x.[name]', 'x. [name]', 'x .[name]', 'x . [name]', 'x . [ name ]'],
                ['x:Extension.member', 'x : Extension . member'],
                ['x:Module.Extension.member', 'x : Module . Extension . member'],
                ['f(a:b)', 'f(a: b)', 'f(a : b)'],
            ];

            for (const [written, ...spaced] of alike) {
                for (const text of spaced) {
                    expect(nexo.parse(text, { imports: ['Module'] }), text).toEqual(nexo.parse(written, { imports: ['Module'] }));
                }
            }

            expect(errorThrownBy(() => nexo.parse('x? .y'))).toMatchObject({ code: 'NEXO1001' });
            expect(evaluate('fan : Device . label . length')).toBe(10);
        });

        it('reads a colon after a name as an extension access wherever an expression stands, whatever its spacing, never as a named argument', () => {
            expect(nexo.parse('f(x: Device.usage)')).toEqual(nexo.parse('f(x:Device.usage)'));
            expect(nexo.parse('f(x:Device.usage)').expression.arguments[0]).toEqual(then(first({ kind: 'scriptParameter', name: 'x' }, 'Device'), 'usage'));
            expect(nexo.parse('count: it.devices.count').expression).toMatchObject({ name: 'count', continues: true });
            expect(errorThrownBy(() => nexo.parse('{ count: it.devices.count }'))).toMatchObject({ code: 'NEXO1003', message: expect.stringContaining("write 'count = …'") });
            expect(errorThrownBy(() => nexo.parse('{ count:it.devices }'))).toMatchObject({ code: 'NEXO1003' });
        });

        it('refuses a colon no name follows, giving the unnamed indexer and the computed property access brackets after it may mean', () => {
            expect(errorThrownBy(() => nexo.parse('it:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it[…]' for the unnamed indexer, or 'it.[…]'") });
            expect(errorThrownBy(() => nexo.parse('it?:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it?[…]' for the unnamed indexer, or 'it?.[…]'") });
            expect(errorThrownBy(() => nexo.parse('f(count: 5)'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining('the name of the member it reads follows it') });
            expect(errorThrownBy(() => nexo.parse('a.b ?: 0'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("no '?:' chooses between two values, which '??' does") });
        });

        it('refuses a definition whose names are marked out of place: a continuing name on no extension access, or optional, and a computed one', () => {
            const fan = { kind: 'scriptParameter', name: 'fan' };
            const validating = expression => errorThrownBy(() => nexo.validate({ version: 38, imports: [], expression }));

            expect(validating(then(fan, 'usage'))).toMatchObject({ code: 'NEXO2000', location: { pointer: '/expression/continues' } });
            expect(validating({ kind: 'optionalChain', chain: { ...then(first(fan, 'Device'), 'usage'), optional: true } })).toMatchObject({ code: 'NEXO2000', location: { pointer: '/expression/chain/continues' } });
            expect(validating({ kind: 'memberAccess', receiver: fan, name: { kind: 'literal', value: 'a-b' }, extension: true })).toMatchObject({ code: 'NEXO2000' });
            expect(validating({ ...first(fan, 'usage'), extension: {} })).toMatchObject({ code: 'NEXO2000', location: { pointer: '/expression/extension' } });
        });
    });

    describe('resolved and evaluated', () => {
        it('reads a property, calls a function and indexes by a named indexer of the extensions, unnamed or through its extension, each a used declaration', () => {
            expect(evaluate('{ usage = fan:usage, reset = fan:reset(3), setting = fan:setting["mode"], named = fan:Device.usage, qualified = fan:Energy.Device.usage }')).toEqual({ usage: 3, reset: 'fan reset 3', setting: 'fan.mode', named: 3, qualified: 3 });
            expect(resolve('{ a = fan:usage, b = fan:Device.usage }').usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([
                ['Device.usage', '/expression/objectFields/0/value'],
                ['Device.usage', '/expression/objectFields/1/value'],
            ]);
        });

        it("continues with ordinary access after the member, in each of its three forms, a call's and a key's among it", () => {
            expect(evaluate('{ unnamed = fan:label.length, named = fan:Device.label.length, qualified = fan:Energy.Device.label.length, called = fan:reset(3).length, keyed = fan:setting["mode"].length }')).toEqual({ unnamed: 10, named: 10, qualified: 10, called: 11, keyed: 8 });
            expect(evaluate('{ grouped = (fan:label).length, lines = fan:Device.label\n    .length }')).toEqual({ grouped: 10, lines: 10 });
            expect(resolve('fan:Device.label.length').usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([
                ['Device.label', '/expression/receiver'],
                ['String.length', '/expression'],
            ]);
        });

        it('reads its names the one way their declarations allow, a name filling a role only where it names what the role needs, never a local or a parameter', () => {
            expect(refusal('fan:it.devices.count')).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/receiver/receiver' }, message: expect.stringContaining("'it' names no extension the script reaches, and no extension member of Device has it") });
            expect(refusal('let Device = 1\nreturn fan:Device.usage', ['Home'])).toMatchObject({ code: 'NEXO3005' });
        });

        it('refuses names that read more than one way, giving the group and the qualified extension that write each', () => {
            const imports = ['Home', 'Energy', 'Labels'];

            expect(refusal('fan:label.length', imports)).toMatchObject({
                code: 'NEXO3091',
                location: { pointer: '/expression' },
                message: expect.stringContaining("'fan:label.length' reads 2 ways, as the extension member 'label' of Device, written '(fan:label).length' or 'fan:Energy.Device.label.length', or as the member 'length' of the extension 'label', written 'fan:Labels.label.length'"),
            });
            expect(evaluate('{ member = (fan:label).length, named = fan:Device.label.length, extension = fan:Labels.label.length }', imports)).toEqual({ member: 10, named: 10, extension: 'fan is long' });
        });

        it("reads an extension member with ':' alone, and the owner's with '.', the two never competing", () => {
            expect(evaluate('{ own = fan.label, energy = fan:label }')).toEqual({ own: 'home fan', energy: 'energy fan' });
            expect(refusal('fan.usage')).toMatchObject({ code: 'NEXO3090', location: { pointer: '/expression' }, message: expect.stringContaining("'usage' is an extension member, which ':' reads: write 'fan:usage'") });
            expect(refusal('fan.reset(3)')).toMatchObject({ code: 'NEXO3090', message: expect.stringContaining("write 'fan:reset(3)'") });
            expect(refusal('fan.usage', ['Home'])).toMatchObject({ code: 'NEXO3090' });
            expect(refusal('fan:power')).toMatchObject({ code: 'NEXO3062', location: { pointer: '/expression' }, message: expect.stringContaining("No extension the script reaches declares 'power' for Device") });
            expect(refusal('fan:Device.power')).toMatchObject({ code: 'NEXO3062', message: expect.stringContaining("The extension 'Device' declares no member 'power'") });
            expect(refusal('[[1], [2]]:flatten')).toMatchObject({ code: 'NEXO3062', message: expect.stringContaining("write '[[1], [2]].flatten' for its owner's member") });
            expect(evaluate('[[1], [2]].flatten')).toEqual([1, 2]);
            expect(refusal('[1, 2].flatten')).toMatchObject({ code: 'NEXO3001', message: expect.stringContaining('it is available on List<List<T>>') });
        });

        it('takes the extension whose target is the most specific, several none of which is refused as ambiguous, giving each through its extension', () => {
            expect(refusal('fan:usage', ['Home', { module: 'Energy', alias: 'E' }, 'Solar'])).toMatchObject({ code: 'NEXO3024', message: expect.stringContaining("write 'fan:E.Device.usage' or 'fan:Solar.Device.usage' to select one") });
            expect(evaluate('{ glow = lamp:glow, usage = lamp:usage }')).toEqual({ glow: 'lamp glows', usage: 4 });
            expect(refusal('fan:glow')).toMatchObject({ code: 'NEXO3062', message: expect.stringContaining("No extension the script reaches declares 'glow' for Device") });
        });

        it('names an extension imported by name first, then the one among Nexo\'s own and the imported modules\', several refused with their qualified names and one qualified by its module selected', () => {
            expect(evaluate('fan:Power.usage', ['Home', 'Solar', { module: 'Energy', type: 'Device', alias: 'Power' }])).toBe(3);
            expect(refusal('fan:Device.usage', ['Home', 'Energy', 'Solar'])).toMatchObject({ code: 'NEXO3061', location: { pointer: '/expression/receiver' }, message: expect.stringContaining("'Energy.Device' or 'Solar.Device'") });
            expect(evaluate('{ energy = fan:Energy.Device.usage, solar = fan:Solar.Device.usage }', ['Home', 'Energy', 'Solar'])).toEqual({ energy: 3, solar: 0 });
            expect(evaluate('fan:E.Device.usage', ['Home', { module: 'Energy', alias: 'E' }])).toBe(3);
        });

        it('refuses names no reading fits as the way its first name comes closest to: no extension, an ordinary type, an unimported module, and a namespace an extension access follows', () => {
            expect(refusal('fan:Missing.usage')).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/receiver' }, message: expect.stringContaining("'Missing' names no extension the script reaches, and no extension member of Device has it") });
            expect(refusal('fan:Light.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Light' is an ordinary type") });
            expect(refusal('fan:Home.Device.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Home.Device' names no extension; 'Home.Device' is an ordinary type") });
            expect(refusal('fan:Device.usage', ['Home'])).toMatchObject({ code: 'NEXO3005', message: expect.stringContaining("declared only by 'Energy' and 'Solar', which the script does not import: write 'import Energy' or 'import Solar'") });
            expect(refusal('fan:usage', ['Home'])).toMatchObject({ code: 'NEXO3005', message: expect.stringContaining("declared only by 'Energy' and 'Solar'") });

            const definition = { version: 38, imports: [{ module: 'Home' }], expression: first({ kind: 'namespace', name: 'Home' }, 'find') };

            expect(refusal(definition)).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/extension' } });
        });

        it('refuses a receiver outside the extension\'s target, and one that can be null with \':\', giving \'?:\', which answers null for a null receiver without evaluating the arguments', () => {
            expect(refusal('fan:Lights.glow')).toMatchObject({ code: 'NEXO3027', message: expect.stringContaining("The extension 'Lights' extends Light, and Device does not satisfy it") });
            expect(refusal('Home.find("fan"):usage')).toMatchObject({ code: 'NEXO3063', message: expect.stringContaining("write 'Home.find(\"fan\")?:usage'") });
            expect(refusal('Home.find("fan"):Device.usage')).toMatchObject({ code: 'NEXO3063', message: expect.stringContaining("write 'Home.find(\"fan\")?:Device.usage'") });
            expect(evaluate('{ found = Home.find("fan")?:usage, none = Home.find("none")?:reset(1 / 0), named = Home.find("none")?:Device.usage, chained = Home.find("none")?:Device.label.length }')).toEqual({ found: 3, none: null, named: null, chained: null });
        });

        it('reads a function without a call as a reference bound to its receiver, which takes the function\'s own arguments, called through a local or given as a callback', () => {
            expect(evaluate('let reset = fan:reset\nreturn reset(2)')).toBe('fan reset 2');
            expect(evaluate('{ unnamed = counts.sum(fan:weigh), named = counts.sum(fan:Device.weigh) }')).toEqual({ unnamed: 12, named: 12 });
            expect(resolve('let reset = fan:Device.reset\nreturn reset(2)').usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([['Device.reset', '/expression/locals/0/value'], ['Device.reset', '/expression/result']]);
            expect(refusal('let order = fan:order\nreturn order(1)')).toMatchObject({ code: 'NEXO3076', message: expect.stringContaining("'Device.order' is a host call, which its host invokes, so it has no reference") });
        });

        it('reaches a host call through an extension, which keeps its terminal position and its preparation', () => {
            for (const text of ['fan:order(2)', 'fan:Device.order(2)', 'fan:Energy.Device.order(2)']) {
                const resolution = resolve(text);
                const call = resolution.createEvaluator(values).prepareHostCall();

                expect(resolution.hostCall, text).toMatchObject({ name: 'order' });
                expect(call, text).toMatchObject({ kind: 'prepared', receiver: values.fan, args: { count: 2 } });
            }
        });

        it('selects an extension member for a value of Any as it is evaluated, never through a dot, and checks the value against a named extension\'s target', () => {
            expect(evaluate('{ unnamed = Home.item("lamp"):reset(1), named = Home.item("lamp"):Device.reset(1) }')).toEqual({ unnamed: 'lamp reset 1', named: 'lamp reset 1' });
            expect(resolve('Home.item("lamp"):Device.usage').deferredAccesses).toEqual([]);
            expect(resolve('Home.item("lamp"):usage').deferredAccesses).toEqual([{ pointer: '/expression', name: 'usage' }]);
            expect(failure('Home.item("word"):Device.usage')).toMatchObject({ code: 'NEXO5012', location: { pointer: '/expression' }, message: expect.stringContaining('read through an extension of Device, and its receiver is String') });
            expect(failure('Home.item("word"):usage')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'usage' is not available on String") });
            expect(failure('Home.item("lamp").usage')).toMatchObject({ code: 'NEXO5012', message: expect.stringContaining("'usage' is not available on Light") });
        });
    });
});
