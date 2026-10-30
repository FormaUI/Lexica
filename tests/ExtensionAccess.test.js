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

const values = { fan: new Device('fan'), lamp: new Light('lamp'), counts: [1, 2, 3] };

/** The resolution of the text against a registry of the home, Energy and Solar, read with the imports given. */
const resolve = (text, imports = ['Home', 'Energy']) => nexo.createRegistry([createHome(), createEnergy(), createSolar()]).resolve(text, values, { imports });

/** What the text evaluates to, read with the imports given. */
const evaluate = (text, imports) => resolve(text, imports).createEvaluator(values).evaluate().value;

/** The error resolving the text throws, read with the imports given. */
const refusal = (text, imports) => errorThrownBy(() => resolve(text, imports));

/** The error evaluating the text throws, read with the imports given. */
const failure = (text, imports) => errorThrownBy(() => evaluate(text, imports));

describe('extension access', () => {
    describe('in text and definitions', () => {
        it("makes a grouped chain optional with '?:' as with '?.', so it stands as a cast's target within an optional enclosed access", () => {
            const extended = nexo.parse('(?((x?:E.y) as Light).w)').expression;
            const dotted = nexo.parse('(?((x?.y) as Light).w)').expression;

            expect(extended.chain.receiver.operand).toEqual({ kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'x' }, name: 'y', optional: true, extension: { name: 'E' } } });
            expect(dotted.chain.receiver.operand).toEqual({ kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'x' }, name: 'y', optional: true } });
        });

        it('records the member last and the names before it as its extension, its module first where three are written, and writes each form as it reads', () => {
            const fan = { kind: 'scriptParameter', name: 'fan' };
            const definitions = {
                'fan:usage': { kind: 'memberAccess', receiver: fan, name: 'usage', extension: {} },
                'fan:Device.usage': { kind: 'memberAccess', receiver: fan, name: 'usage', extension: { name: 'Device' } },
                'fan:Energy.Device.usage': { kind: 'memberAccess', receiver: fan, name: 'usage', extension: { name: 'Device', module: 'Energy' } },
                'fan:reset(3)': { kind: 'call', callee: { kind: 'memberAccess', receiver: fan, name: 'reset', extension: {} }, arguments: [{ kind: 'literal', value: 3 }] },
                'fan:Device.reset(3)': { kind: 'call', callee: { kind: 'memberAccess', receiver: fan, name: 'reset', extension: { name: 'Device' } }, arguments: [{ kind: 'literal', value: 3 }] },
                'fan:setting["mode"]': { kind: 'indexerAccess', receiver: { kind: 'memberAccess', receiver: fan, name: 'setting', extension: {} }, argument: { kind: 'literal', value: 'mode' } },
                'fan?:usage': { kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: fan, name: 'usage', optional: true, extension: {} } },
                '(fan:label).size': { kind: 'memberAccess', receiver: { kind: 'memberAccess', receiver: fan, name: 'label', extension: {} }, name: 'size' },
            };

            for (const [text, expression] of Object.entries(definitions)) {
                const definition = nexo.parse(text, { imports: ['Energy'] });

                expect(definition.expression, text).toEqual(expression);
                expect(nexo.format(definition, { imports: ['Energy'] }), text).toBe(text);
            }
        });

        it('closes the access at a call or a key, what follows applying to its answer, and binds as a member access does', () => {
            expect(nexo.parse('fan:Device.reset(1):Words.size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', extension: { name: 'Words' }, receiver: { kind: 'call', callee: { name: 'reset', extension: { name: 'Device' } } } });
            expect(nexo.parse('fan:reset(1).size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', receiver: { kind: 'call', callee: { name: 'reset', extension: {} } } });
            expect(nexo.parse('fan:setting["a"].size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', receiver: { kind: 'indexerAccess', receiver: { name: 'setting', extension: {} } } });
            expect(nexo.parse('fan:label:size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', extension: {}, receiver: { kind: 'memberAccess', name: 'label', extension: {} } });
            expect(nexo.parse('a + b:half').expression).toMatchObject({ kind: 'arithmetic', right: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'b' }, extension: {} } });
            expect(nexo.parse('(a + b):half').expression).toMatchObject({ kind: 'memberAccess', receiver: { kind: 'arithmetic' } });
        });

        it('reads a colon after a name as an extension access wherever an expression stands, whatever its spacing, never as a named argument or a shorter access', () => {
            expect(nexo.parse('f(x: Device.usage)')).toEqual(nexo.parse('f(x:Device.usage)'));
            expect(nexo.parse('f(x:Device.usage)').expression.arguments[0]).toMatchObject({ kind: 'memberAccess', extension: { name: 'Device' } });
            expect(nexo.parse('fan:Energy.usage', { imports: ['Energy'] }).expression).toMatchObject({ name: 'usage', extension: { name: 'Energy' } });
            expect(errorThrownBy(() => nexo.parse('count: it.devices.count'))).toMatchObject({ code: 'NEXO1071', location: { offset: 7 }, message: expect.stringContaining("'it' names no module the script imports") });
            expect(errorThrownBy(() => nexo.parse('f(count: it.devices.count)'))).toMatchObject({ code: 'NEXO1071', location: { offset: 9 } });
            expect(errorThrownBy(() => nexo.parse('fan:Energy.Device.usage.size', { imports: ['Energy'] }))).toMatchObject({ code: 'NEXO1071', location: { offset: 24 }, message: expect.stringContaining("group the access before reading what it answers, as '(fan:Energy.Device.usage)'") });
            expect(errorThrownBy(() => nexo.parse('{ count: it.devices.count }'))).toMatchObject({ code: 'NEXO1003', message: expect.stringContaining("write 'count = …'") });
            expect(errorThrownBy(() => nexo.parse('{ count:it.devices }'))).toMatchObject({ code: 'NEXO1003' });
        });

        it('refuses a colon no name follows, giving the unnamed indexer and the computed property access brackets after it may mean', () => {
            expect(errorThrownBy(() => nexo.parse('it:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it[…]' for the unnamed indexer, or 'it.[…]'") });
            expect(errorThrownBy(() => nexo.parse('it?:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it?[…]' for the unnamed indexer, or 'it?.[…]'") });
            expect(errorThrownBy(() => nexo.parse('f(count: 5)'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining('the name of the member it reads follows it') });
            expect(errorThrownBy(() => nexo.parse('a.b ?: 0'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("no '?:' chooses between two values, which '??' does") });
        });
    });

    describe('resolved and evaluated', () => {
        it('reads a property, calls a function and indexes by a named indexer of the extensions, unnamed or through its extension, each a used declaration', () => {
            expect(evaluate('{ usage = fan:usage, reset = fan:reset(3), setting = fan:setting["mode"], named = fan:Device.usage }')).toEqual({ usage: 3, reset: 'fan reset 3', setting: 'fan.mode', named: 3 });
            expect(resolve('{ a = fan:usage, b = fan:Device.usage }').usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([
                ['Device.usage', '/expression/objectFields/0/value'],
                ['Device.usage', '/expression/objectFields/1/value'],
            ]);
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
        });

        it('takes the extension whose target is the most specific, several none of which is refused as ambiguous, giving each through its extension', () => {
            expect(refusal('fan:usage', ['Home', { module: 'Energy', alias: 'E' }, 'Solar'])).toMatchObject({ code: 'NEXO3024', message: expect.stringContaining("write 'fan:E.Device.usage' or 'fan:Solar.Device.usage' to select one") });
            expect(evaluate('{ glow = lamp:glow, usage = lamp:usage }')).toEqual({ glow: 'lamp glows', usage: 4 });
            expect(refusal('fan:glow')).toMatchObject({ code: 'NEXO3062', message: expect.stringContaining("No extension the script reaches declares 'glow' for Device") });
        });

        it('names an extension imported by name first, then the one among Nexo\'s own and the imported modules\', several refused with their qualified names and one qualified by its module selected', () => {
            expect(evaluate('fan:Power.usage', ['Home', 'Solar', { module: 'Energy', type: 'Device', alias: 'Power' }])).toBe(3);
            expect(refusal('fan:Device.usage', ['Home', 'Energy', 'Solar'])).toMatchObject({ code: 'NEXO3061', location: { pointer: '/expression/extension' }, message: expect.stringContaining("'Energy.Device' or 'Solar.Device'") });
            expect(evaluate('{ energy = fan:Energy.Device.usage, solar = fan:Solar.Device.usage }', ['Home', 'Energy', 'Solar'])).toEqual({ energy: 3, solar: 0 });
            expect(evaluate('fan:E.Device.usage', ['Home', { module: 'Energy', alias: 'E' }])).toBe(3);
        });

        it('refuses a name no reachable extension has, giving the group where an extension member has it, one only an unimported module declares, giving the import, and a namespace an extension access follows', () => {
            expect(refusal('fan:Missing.usage')).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/extension' }, message: expect.stringContaining("'Missing' names no extension the script reaches") });
            expect(refusal('fan:Light.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Light' is an ordinary type") });
            expect(refusal('fan:Home.Device.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Home.Device' names no extension; 'Home.Device' is an ordinary type") });
            expect(refusal('fan:label.length')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("write '(fan:label).length' for the access of what the extension member 'label' answers") });
            expect(evaluate('(fan:label).length')).toBe(10);
            expect(refusal('fan:Device.usage', ['Home'])).toMatchObject({ code: 'NEXO3005', message: expect.stringContaining("declared only by 'Energy' and 'Solar', which the script does not import: write 'import Energy' or 'import Solar'") });
            expect(refusal('fan:usage', ['Home'])).toMatchObject({ code: 'NEXO3005', message: expect.stringContaining("declared only by 'Energy' and 'Solar'") });

            for (const extension of [{ name: 'Device' }, {}]) {
                const definition = { version: 37, imports: [{ module: 'Home' }], expression: { kind: 'memberAccess', receiver: { kind: 'namespace', name: 'Home' }, name: 'find', extension } };

                expect(refusal(definition)).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/extension' } });
            }
        });

        it('refuses a receiver outside the extension\'s target, and one that can be null with \':\', giving \'?:\', which answers null for a null receiver without evaluating the arguments', () => {
            expect(refusal('fan:Lights.glow')).toMatchObject({ code: 'NEXO3027', message: expect.stringContaining("The extension 'Lights' extends Light, and Device does not satisfy it") });
            expect(refusal('Home.find("fan"):usage')).toMatchObject({ code: 'NEXO3063', message: expect.stringContaining("write 'Home.find(\"fan\")?:usage'") });
            expect(refusal('Home.find("fan"):Device.usage')).toMatchObject({ code: 'NEXO3063', message: expect.stringContaining("write 'Home.find(\"fan\")?:Device.usage'") });
            expect(evaluate('{ found = Home.find("fan")?:usage, none = Home.find("none")?:reset(1 / 0), named = Home.find("none")?:Device.usage }')).toEqual({ found: 3, none: null, named: null });
        });

        it('reads a function without a call as a reference bound to its receiver, which takes the function\'s own arguments, called through a local or given as a callback', () => {
            expect(evaluate('let reset = fan:reset\nreturn reset(2)')).toBe('fan reset 2');
            expect(evaluate('{ unnamed = counts.sum(fan:weigh), named = counts.sum(fan:Device.weigh) }')).toEqual({ unnamed: 12, named: 12 });
            expect(resolve('let reset = fan:Device.reset\nreturn reset(2)').usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Device.reset']);
            expect(refusal('let order = fan:order\nreturn order(1)')).toMatchObject({ code: 'NEXO3076', message: expect.stringContaining("'Device.order' is a host call, which its host invokes, so it has no reference") });
        });

        it('reaches a host call through an extension, which keeps its terminal position and its preparation', () => {
            for (const text of ['fan:order(2)', 'fan:Device.order(2)']) {
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
