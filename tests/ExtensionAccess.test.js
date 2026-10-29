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
 * Energy's extension of the home's devices: a usage, a label of its own, a reset to a level, a weight of an amount, whether it is active, a setting by its key, its unnamed indexer, and an order its host invokes; and its
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
            createIndexerDeclaration(null, 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('key', 'String')], impl: ({ receiver, args }) => `${receiver.name}[${args.key}]` }),
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

        it('records the extension a property access, a call, a named indexer and an unnamed indexer select, its module where its name is qualified, and writes each as it reads', () => {
            const fan = { kind: 'scriptParameter', name: 'fan' };
            const definitions = {
                'fan:Device.usage': { kind: 'memberAccess', receiver: fan, name: 'usage', extension: { name: 'Device' } },
                'fan:Device.reset(3)': { kind: 'call', callee: { kind: 'memberAccess', receiver: fan, name: 'reset', extension: { name: 'Device' } }, arguments: [{ kind: 'literal', value: 3 }] },
                'fan:Device.setting["mode"]': { kind: 'indexerAccess', receiver: { kind: 'memberAccess', receiver: fan, name: 'setting', extension: { name: 'Device' } }, argument: { kind: 'literal', value: 'mode' } },
                'fan:Device["mode"]': { kind: 'indexerAccess', receiver: fan, extension: { name: 'Device' }, argument: { kind: 'literal', value: 'mode' } },
                'fan:Energy.Device.usage': { kind: 'memberAccess', receiver: fan, name: 'usage', extension: { name: 'Device', module: 'Energy' } },
                'fan?:Device.usage': { kind: 'optionalChain', chain: { kind: 'memberAccess', receiver: fan, name: 'usage', optional: true, extension: { name: 'Device' } } },
            };

            for (const [text, expression] of Object.entries(definitions)) {
                const definition = nexo.parse(text, { imports: ['Energy'] });

                expect(definition.expression, text).toEqual(expression);
                expect(nexo.format(definition, { imports: ['Energy'] }), text).toBe(text);
            }
        });

        it('applies a selection to one member operation, a later colon selecting another for its answer, and binds as a member access does', () => {
            expect(nexo.parse('fan:Device.reset(1):Words.size').expression).toMatchObject({ kind: 'memberAccess', name: 'size', extension: { name: 'Words' }, receiver: { kind: 'call', callee: { name: 'reset', extension: { name: 'Device' } } } });
            expect(nexo.parse('a + b:Numbers.half').expression).toMatchObject({ kind: 'arithmetic', right: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'b' }, extension: { name: 'Numbers' } } });
            expect(nexo.parse('(a + b):Numbers.half').expression).toMatchObject({ kind: 'memberAccess', receiver: { kind: 'arithmetic' } });
        });

        it('reads an extension access within an argument, a colon a space follows starting no argument but a named one, and a word named as a module the imports give as its qualifier', () => {
            expect(nexo.parse('f(x:Device.usage)').expression.arguments[0]).toMatchObject({ kind: 'memberAccess', extension: { name: 'Device' } });
            expect(errorThrownBy(() => nexo.parse('f(x: Device.usage)'))).toMatchObject({ code: 'NEXO1012' });
            expect(errorThrownBy(() => nexo.parse('fan:Energy.usage', { imports: ['Energy'] }))).toMatchObject({ code: 'NEXO1000', location: { offset: 16 } });
        });

        it('refuses a colon brackets follow directly, giving the unnamed indexer and the computed property access, and an extension named with no member after it', () => {
            expect(errorThrownBy(() => nexo.parse('it:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it[…]' for the unnamed indexer, or 'it.[…]'") });
            expect(errorThrownBy(() => nexo.parse('it?:["mode"]'))).toMatchObject({ code: 'NEXO1014', message: expect.stringContaining("write 'it?[…]' for the unnamed indexer, or 'it?.[…]'") });
            expect(errorThrownBy(() => nexo.parse('a.b ?: c'))).toMatchObject({ code: 'NEXO1000', message: expect.stringContaining("no '?:' chooses between two values, which '??' does") });
        });
    });

    describe('resolved and evaluated', () => {
        it('reads a property, calls a function, and indexes by a named and an unnamed indexer of the extension, each a used declaration named by the extension', () => {
            expect(evaluate('{ usage = fan:Device.usage, reset = fan:Device.reset(3), setting = fan:Device.setting["mode"], indexed = fan:Device["k"] }')).toEqual({ usage: 3, reset: 'fan reset 3', setting: 'fan.mode', indexed: 'fan[k]' });
            expect(resolve('fan:Device.usage').usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer])).toEqual([['Device.usage', '/expression']]);
        });

        it('selects among the extension\'s members alone, reaching one ordinary lookup outranks and never falling through to the receiver\'s own', () => {
            expect(evaluate('{ own = fan.label, energy = fan:Device.label }')).toEqual({ own: 'home fan', energy: 'energy fan' });
            expect(refusal('fan:Device.power')).toMatchObject({ code: 'NEXO3062', location: { pointer: '/expression' }, message: expect.stringContaining("The extension 'Device' declares no member 'power'") });
            expect(refusal('lamp:Lights["k"]')).toMatchObject({ code: 'NEXO3062', message: expect.stringContaining("The extension 'Lights' declares no unnamed indexer") });
        });

        it('names an extension imported by name first, then the one among Nexo\'s own and the imported modules\', several refused with their qualified names and one qualified by its module selected', () => {
            expect(evaluate('fan:Power.usage', ['Home', 'Solar', { module: 'Energy', type: 'Device', alias: 'Power' }])).toBe(3);
            expect(refusal('fan:Device.usage', ['Home', 'Energy', 'Solar'])).toMatchObject({ code: 'NEXO3061', location: { pointer: '/expression/extension' }, message: expect.stringContaining("'Energy.Device' or 'Solar.Device'") });
            expect(evaluate('{ energy = fan:Energy.Device.usage, solar = fan:Solar.Device.usage }', ['Home', 'Energy', 'Solar'])).toEqual({ energy: 3, solar: 0 });
            expect(evaluate('fan:E.Device.usage', ['Home', { module: 'Energy', alias: 'E' }])).toBe(3);
        });

        it('refuses a name no reachable extension has, saying so where only an ordinary type has it, one only an unimported module declares, giving the import, and a namespace a selection follows', () => {
            expect(refusal('fan:Missing.usage')).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/extension' }, message: expect.stringContaining("'Missing' names no extension the script reaches") });
            expect(refusal('fan:Light.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Light' is an ordinary type") });
            expect(refusal('fan:Home.Device.usage')).toMatchObject({ code: 'NEXO3026', message: expect.stringContaining("'Home.Device' names no extension; 'Home.Device' is an ordinary type") });
            expect(refusal('fan:Device.usage', ['Home'])).toMatchObject({ code: 'NEXO3005', message: expect.stringContaining("declared only by 'Energy' and 'Solar', which the script does not import: write 'import Energy' or 'import Solar'") });

            const definition = { version: 36, imports: [{ module: 'Home' }], expression: { kind: 'memberAccess', receiver: { kind: 'namespace', name: 'Home' }, name: 'find', extension: { name: 'Device' } } };

            expect(refusal(definition)).toMatchObject({ code: 'NEXO3026', location: { pointer: '/expression/extension' } });
        });

        it('refuses a receiver outside the extension\'s target, and one that can be null with \':\', giving \'?:\', which answers null for a null receiver without evaluating the arguments', () => {
            expect(refusal('fan:Lights.glow')).toMatchObject({ code: 'NEXO3027', message: expect.stringContaining("The extension 'Lights' extends Light, and Device does not satisfy it") });
            expect(refusal('Home.find("fan"):Device.usage')).toMatchObject({ code: 'NEXO3063', message: expect.stringContaining("write 'Home.find(\"fan\")?:Device.usage'") });
            expect(evaluate('{ found = Home.find("fan")?:Device.usage, none = Home.find("none")?:Device.reset(1 / 0) }')).toEqual({ found: 3, none: null });
        });

        it('writes each competing extension in a refused access as the script names it, an aliased module\'s by its local name', () => {
            expect(refusal('fan.usage', ['Home', { module: 'Energy', alias: 'E' }, 'Solar'])).toMatchObject({ code: 'NEXO3024', message: expect.stringContaining("write 'fan:E.Device.usage' or 'fan:Solar.Device.usage' to select one") });
        });

        it('reads a function without a call as a reference bound to its receiver, which takes the function\'s own arguments, called through a local or given as a callback', () => {
            expect(evaluate('let reset = fan:Device.reset\nreturn reset(2)')).toBe('fan reset 2');
            expect(evaluate('counts.sum(fan:Device.weigh)')).toBe(12);
            expect(resolve('let reset = fan:Device.reset\nreturn reset(2)').usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['Device.reset']);
            expect(refusal('let order = fan:Device.order\nreturn order(1)')).toMatchObject({ code: 'NEXO3076', message: expect.stringContaining("'Device.order' is a host call, which its host invokes, so it has no reference") });
        });

        it('reaches a host call through an extension, which keeps its terminal position and its preparation', () => {
            const resolution = resolve('fan:Device.order(2)');
            const call = resolution.createEvaluator(values).prepareHostCall();

            expect(resolution.hostCall).toMatchObject({ name: 'order' });
            expect(call).toMatchObject({ kind: 'prepared', receiver: values.fan, args: { count: 2 } });
        });

        it('selects the extension\'s member for a value of Any, its arguments read by it, and checks the value against the target as it is evaluated', () => {
            expect(evaluate('Home.item("lamp"):Device.reset(1)')).toBe('lamp reset 1');
            expect(resolve('Home.item("lamp"):Device.usage').deferredAccesses).toEqual([]);
            expect(failure('Home.item("word"):Device.usage')).toMatchObject({ code: 'NEXO5012', location: { pointer: '/expression' }, message: expect.stringContaining('read through an extension of Device, and its receiver is String') });
        });
    });
});
