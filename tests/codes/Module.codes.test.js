import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { withHome } from '../support/home.mjs';
import { errorThrownBy, expectNexoError, expectModuleError } from '../support/errors.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, functionDeclaration, indexerDeclaration, operatorDeclaration, parameterDeclaration, propertyDeclaration } from '../support/declarations.mjs';

const observable = observations => ({ changes: 'observable', reads: 'fresh', observations });

/** A function parameter, its callback taking a string and answering a Boolean. */
const callback = (overrides = {}) => ({ name: 'test', kind: 'function', type: 'Boolean', required: true, parameterTypes: ['String'], ...overrides });

/** A fixed parameter selecting a type through the selector `report`. */
const selecting = (overrides = {}) => parameterDeclaration({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector: 'report', ...overrides });

/** A host call, which declares no updates. */
const hostCall = (overrides = {}) => functionDeclaration({ invokedBy: 'host', updates: undefined, ...overrides });

/** Asserts that the call fails with a module error of the code. */
const expectModuleCode = (call, code) => expectNexoError(errorThrownBy(call), code, 'module');

const creating = contents => () => nexo.createModule('charts', contents);
const registering = (...modules) => () => nexo.createRegistry(modules);
const module = (name, contents) => nexo.createModule(name, contents);

/** A module's contents, those given beside the members given, which stand in an extension of strings and take a string as their receiver. */
const onStrings = (members, contents = {}) => ({ ...contents, types: [...(contents.types ?? []), extensionDeclaration('Words', 'String', members)] });

describe('the module error codes', () => {
    describe('of creating a module', () => {
        it('NEXO4500: a module whose name is not an identifier', () => {
            expectModuleCode(() => nexo.createModule('chart-tools', {}), 'NEXO4500');
        });

        it('NEXO4501: a module whose contents are not an object', () => {
            expectModuleCode(creating(null), 'NEXO4501');
        });

        it('NEXO4502: a module declaring what a module does not declare', () => {
            expectModuleCode(creating({ member: [] }), 'NEXO4502');
            expectModuleCode(creating({ predicates: [] }), 'NEXO4502');
        });

        it('NEXO4503: a module whose declarations of one kind are not a list', () => {
            expectModuleCode(creating({ members: {} }), 'NEXO4503');
        });

        it('NEXO4504: a declaration that is not an object', () => {
            expectModuleCode(creating({ members: [null] }), 'NEXO4504');
            expectModuleCode(creating({ typeSelectors: [5] }), 'NEXO4504');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: 5 })] }), 'NEXO4504');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [null] })] }), 'NEXO4504');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: observable([null]) })] }), 'NEXO4504');
        });

        it('NEXO4030: a field a declaration does not take', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ on: 'String' })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [propertyDeclaration({ syntax: 'function-call' })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ syntax: 'indexer' })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ default: true })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [indexerDeclaration({ arguments: 'positional' })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: { ...constantUpdates, tolerence: 1 } })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ fixd: true })] })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [hostCall({ updates: constantUpdates })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [hostCall({ impl: () => 1 })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ fixed: false })] })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ context: 'item' })] })] }), 'NEXO4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ parameterTypes: ['Number'] })] })] }), 'NEXO4030');
        });

        it('NEXO4505: an implementation that is not a function', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ impl: 5 })] }), 'NEXO4505');
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', impl: 'run' }] }), 'NEXO4505');
        });
    });

    describe('of a type', () => {
        const structured = (overrides = {}) => ({ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }), ...overrides });
        const reference = (overrides = {}) => ({ name: 'Lamp', kind: 'reference', isInstance: () => true, ...overrides });

        it('NEXO4554: a type of a kind that is none of a type\'s kinds, or of no kind', () => {
            expectModuleCode(creating({ types: [structured({ kind: 'object' })] }), 'NEXO4554');
            expectModuleCode(creating({ types: [structured({ kind: undefined })] }), 'NEXO4554');
        });

        it('NEXO4017: a reference type without isInstance', () => {
            expectModuleCode(creating({ types: [reference({ isInstance: undefined })] }), 'NEXO4017');
        });

        it('NEXO4051: a typeOf or an isInstance that is not a function', () => {
            expectModuleCode(creating({ types: [reference({ isInstance: true })] }), 'NEXO4051');
            expectModuleCode(creating({ typeOf: 'Lamp' }), 'NEXO4051');
        });

        it('NEXO4555: an abstract that is not a Boolean', () => {
            expectModuleCode(creating({ types: [reference({ abstract: 'yes' })] }), 'NEXO4555');
        });

        it('NEXO4030: a declaration key a type\'s kind does not take, a type-level fields collection among them', () => {
            expectModuleCode(creating({ types: [reference({ fields: { points: 'Number' } })] }), 'NEXO4030');
            expectModuleCode(creating({ types: [structured({ fields: { points: 'Number' } })] }), 'NEXO4030');
            expectModuleCode(creating({ types: [structured({ supertype: 'Lamp' })] }), 'NEXO4030');
        });

        it('NEXO4016: a supertype that is not a reference type', () => {
            expectModuleCode(registering(module('charts', { types: [structured(), reference({ supertype: 'Chart' })] })), 'NEXO4016');
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'String' })] })), 'NEXO4016');
        });

        it('NEXO4050: a type hierarchy that is a cycle', () => {
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'Bulb' }), reference({ name: 'Bulb', supertype: 'Lamp' })] })), 'NEXO4050');
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'Lamp' })] })), 'NEXO4050');
        });

        it('takes a type of any name, a lowercase one and one Nexo\'s own types spell among them, and a structured type of no data property', () => {
            for (const name of ['chart', 'Number', 'Null', 'List']) {
                expect(() => nexo.createRegistry([module('charts', { types: [structured({ name })] })])).not.toThrow();
            }

            expect(nexo.createRegistry([module('charts', { types: [structured({ members: [] }), structured({ name: 'Axis', members: undefined })] })]).moduleNames).toContain('charts');
        });

        it('NEXO4552: a type whose name is not an identifier', () => {
            expectModuleCode(creating({ types: [structured({ name: 'Chart_1' })] }), 'NEXO4552');
            expectModuleCode(creating({ types: [structured({ name: undefined })] }), 'NEXO4552');
        });

        it('NEXO4507: a type whose import is not a list of module names', () => {
            expectModuleCode(creating({ types: [structured({ import: 'axes' })] }), 'NEXO4507');
            expectModuleCode(creating({ types: [structured({ import: ['axes-two'] })] }), 'NEXO4507');
        });

        it('NEXO4508: a type importing a module twice', () => {
            expectModuleCode(creating({ types: [structured({ import: ['axes', 'axes'] })] }), 'NEXO4508');
        });

        it('NEXO4503: a type\'s members that are not a list', () => {
            expectModuleCode(creating({ types: [structured({ members: {} })] }), 'NEXO4503');
        });

        it('NEXO4032: a property declared without updates anywhere but directly in a structured type', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: undefined })] }), 'NEXO4032');
            expectModuleCode(creating({ types: [reference({ members: [propertyDeclaration({ updates: undefined })] })] }), 'NEXO4032');
        });

        it('refuses a data property that is not a name with a type, or that carries an impl, which Nexo never invokes', () => {
            expectModuleCode(creating({ types: [structured({ members: dataPropertyDeclarations({ 'point-count': 'Number' }) })] }), 'NEXO4523');
            expectModuleCode(creating({ types: [structured({ members: dataPropertyDeclarations({ points: 'List<' }) })] }), 'NEXO4512');
            expectModuleCode(creating({ types: [structured({ members: [{ name: 'points', kind: 'property', result: 'Number', impl: () => 1 }] })] }), 'NEXO4030');
        });
    });

    describe('of a type selector and a selectable type', () => {
        it('NEXO4006: a type selector, an observation type or an observation target not named by an identifier', () => {
            expectModuleCode(creating({ typeSelectors: [{ name: 'chart-report' }] }), 'NEXO4006');
            expectModuleCode(creating({ observationTypes: [{ name: 'chart-state', contract: 'invalidation' }] }), 'NEXO4006');
            expectModuleCode(creating({ observationTargets: [{ name: 'chart-home' }] }), 'NEXO4006');
        });

        it('NEXO4007: a type selector or an observation type named as one declared already', () => {
            expectModuleCode(creating({ typeSelectors: [{ name: 'report' }, { name: 'report' }] }), 'NEXO4007');
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation' }, { name: 'state', contract: 'maintained' }] }), 'NEXO4007');
            expect(expectModuleError(creating({ observationTypes: [{ name: 'state', contract: 'invalidation' }, { name: 'state', contract: 'maintained' }] }))).toEqual({ message: expect.any(String), module: 'charts', declaration: 'state', declarationKey: 'name' });
            expectModuleCode(registering(module('charts', { typeSelectors: [{ name: 'report' }] }), module('graphs', { typeSelectors: [{ name: 'report' }] })), 'NEXO4007');
            expectModuleCode(registering(module('charts', { observationTypes: [{ name: 'state', contract: 'invalidation' }] }), module('graphs', { observationTypes: [{ name: 'state', contract: 'invalidation' }] })), 'NEXO4007');
        });

        it('NEXO4008: a mapping without its selector, its key, a string, or its type', () => {
            expectModuleCode(creating({ mappings: [{ selector: 'report', type: 'Number' }] }), 'NEXO4008');
            expectModuleCode(creating({ mappings: [{ selector: 'report', key: 1, type: 'Number' }] }), 'NEXO4008');
            expectModuleCode(creating({ mappings: [{ key: 'click', type: 'Number' }] }), 'NEXO4008');
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'report' }] }), 'NEXO4008');
        });

        it('takes a mapping\'s key of any string, as a fixed argument may give any', () => {
            expect(() => nexo.createRegistry([module('charts', { typeSelectors: [{ name: 'report' }], mappings: [{ selector: 'report', key: 'chart click', type: 'Number' }, { selector: 'report', key: '', type: 'String' }] })])).not.toThrow();
        });

        it('NEXO4039: a mapping of a selector no module declares', () => {
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'chart-report', type: 'Number' }] }), 'NEXO4039');
            expectModuleCode(registering(module('charts', { mappings: [{ key: 'click', selector: 'report', type: 'Number' }] })), 'NEXO4039');
        });

        it('NEXO4038: a mapping whose key its selector maps already', () => {
            const selectable = { key: 'click', selector: 'report', type: 'Number' };

            expectModuleCode(creating({ typeSelectors: [{ name: 'report' }], mappings: [selectable, selectable] }), 'NEXO4038');
            expectModuleCode(registering(module('charts', { typeSelectors: [{ name: 'report' }], mappings: [selectable] }), module('graphs', { mappings: [selectable] })), 'NEXO4038');
        });

        it('NEXO4512: a type notation that does not parse', () => {
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'report', type: 'List<' }] }), 'NEXO4512');
            expectModuleCode(creating({ members: [propertyDeclaration({ result: 'List<' })] }), 'NEXO4512');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<' })] })] }), 'NEXO4512');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ parameterTypes: ['List<'] })] })] }), 'NEXO4512');
            expectModuleCode(creating({ types: [{ name: 'Lamp', kind: 'reference', isInstance: () => true, supertype: 'List<' }] }), 'NEXO4512');
        });
    });

    describe('of a member', () => {
        it('NEXO4002: a member declared without a name', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ name: undefined })] }), 'NEXO4002');
        });

        it('NEXO4523: a member whose name is not an identifier', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ name: 'chart-size' })] }), 'NEXO4523');
        });

        it('NEXO4524: a member of a kind that is not a property or a function', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ kind: 'operation' })] }), 'NEXO4524');
        });

        it('NEXO4525: a function invoked by neither the evaluator nor the host', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ invokedBy: 'user' })] }), 'NEXO4525');
        });

        it('NEXO4003: a member without a field its kind requires', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ result: undefined })] }), 'NEXO4003');
            expectModuleCode(creating({ members: [functionDeclaration({ arguments: undefined })] }), 'NEXO4003');
        });

        it('NEXO4526: a member whose parameters are not a list', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: {} })] }), 'NEXO4526');
        });

        it('NEXO4527: a member declaring a parameter twice', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration(), parameterDeclaration()] })] }), 'NEXO4527');
        });

        it('NEXO4053: a host call written as an indexer', () => {
            expectModuleCode(creating({ members: [indexerDeclaration({ invokedBy: 'host', updates: undefined })] }), 'NEXO4053');
        });

        it('NEXO4056: a host call taking a parameter other than a value parameter', () => {
            expectModuleCode(creating({ members: [hostCall({ parameters: [parameterDeclaration({ kind: 'expression', context: 'item' })] })] }), 'NEXO4056');
        });

        it('NEXO4009: a function with more than one parameter that selects a type', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected', parameters: [selecting(), selecting({ name: 'other' })] })] }), 'NEXO4009');
        });

        it('NEXO4529: a function with a parameter that selects a type whose result writes no @selected', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [selecting()] })] }), 'NEXO4529');
        });

        it('NEXO4040: a result writing @selected without a parameter that selects a type', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected' })] }), 'NEXO4040');
        });
    });

    describe('of how a member is written', () => {
        it('NEXO4020: an indexer without exactly one required value parameter as its key', () => {
            expectModuleCode(creating({ members: [indexerDeclaration({ parameters: [parameterDeclaration(), parameterDeclaration({ name: 'more' })] })] }), 'NEXO4020');
            expectModuleCode(creating({ members: [indexerDeclaration({ name: 'setting', parameters: [parameterDeclaration({ required: false, default: 1 })] })] }), 'NEXO4020');
        });

        it('NEXO4022: a module member that is an indexer', () => {
            expectModuleCode(creating({ members: [indexerDeclaration()] }), 'NEXO4022');
        });

        it('NEXO4534: a function without parameters declaring the form of its arguments', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [] })] }), 'NEXO4534');
        });

        it('NEXO4535: a function whose arguments are neither positional nor options', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ arguments: 'named' })] }), 'NEXO4535');
        });

        it('NEXO4019: a required positional parameter after an optional one', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: 1 }), parameterDeclaration({ name: 'more' })] })] }), 'NEXO4019');
        });
    });

    describe('of a parameter', () => {
        const declaring = overrides => creating({ members: [functionDeclaration({ parameters: [parameterDeclaration(overrides)] })] });
        const declaringCallback = overrides => creating({ members: [functionDeclaration({ parameters: [callback(overrides)] })] });

        it('NEXO4536: a parameter without its name, kind, type, required or null policy, or with one it does not take', () => {
            expectModuleCode(declaring({ kind: undefined }), 'NEXO4536');
            expectModuleCode(declaring({ nulls: 'drop' }), 'NEXO4536');
            expectModuleCode(declaring({ required: 'yes' }), 'NEXO4536');
            expectModuleCode(declaring({ type: undefined }), 'NEXO4536');
        });

        it('NEXO4054: a function parameter that is optional or has a null policy', () => {
            expectModuleCode(declaringCallback({ nulls: 'propagate' }), 'NEXO4054');
            expectModuleCode(declaringCallback({ required: false }), 'NEXO4054');
        });

        it('NEXO4537: a function parameter not declaring its parameterTypes as a list', () => {
            expectModuleCode(declaringCallback({ parameterTypes: undefined }), 'NEXO4537');
        });

        it('NEXO4538: a required parameter with a default', () => {
            expectModuleCode(declaring({ default: 1 }), 'NEXO4538');
        });

        it('NEXO4539: an expression or a predicate parameter whose context is not item', () => {
            expectModuleCode(declaring({ kind: 'expression' }), 'NEXO4539');
        });

        it('NEXO4540: a predicate parameter not of type Boolean', () => {
            expectModuleCode(declaring({ kind: 'predicate', context: 'item' }), 'NEXO4540');
        });

        it('NEXO4541: a parameter declaring whether it is fixed by what is not a Boolean', () => {
            expectModuleCode(declaring({ fixed: 'yes' }), 'NEXO4541');
        });

        it('NEXO4542: a parameter that is not fixed declaring what it selects', () => {
            expectModuleCode(declaring({ selects: 'type' }), 'NEXO4542');
        });

        it('NEXO4543: a fixed parameter selecting what is not a type', () => {
            expectModuleCode(declaring({ type: 'String', fixed: true, selects: 'value' }), 'NEXO4543');
        });

        it('NEXO4544: a fixed parameter not naming its type selector', () => {
            expectModuleCode(declaring({ type: 'String', fixed: true, selects: 'type' }), 'NEXO4544');
        });

        it('NEXO4545: a fixed parameter that is not a value parameter of type String', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected', parameters: [selecting({ type: 'Number' })] })] }), 'NEXO4545');
        });

        it('NEXO4547: a parameter selecting through a type selector no module declares', () => {
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ result: '@selected', parameters: [selecting()] })] })), 'NEXO4547');
        });

        it('NEXO4548: a parameter default its type does not admit', () => {
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: 'many' })] })] })), 'NEXO4548');
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: Infinity })] })] })), 'NEXO4548');
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<Number>', required: false, default: [1, , 3] })] })] })), 'NEXO4548');
        });

        it('NEXO4563: a declared dictionary whose key type is no key type', () => {
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ name: 'table', result: 'Dictionary<List<Number>, String>' })] })), 'NEXO4563');
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ name: 'table', result: 'Dictionary<Any, String>' })] })), 'NEXO4563');
        });

        it('NEXO4562: a declaration holding a value that reaches itself', () => {
            const selfList = [];

            selfList.push(selfList);
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<Number>', required: false, default: selfList })] })] }), 'NEXO4562');
        });
    });

    describe('of updates and observations', () => {
        const state = { name: 'state', contract: 'invalidation' };
        const reading = { name: 'reading', contract: 'maintained' };
        const observing = (updates, overrides = {}) => creating(onStrings([propertyDeclaration({ updates, ...overrides })], { observationTypes: [state] }));

        it('NEXO4023: updates without changes or reads', () => {
            expectModuleCode(observing({ reads: 'fresh' }), 'NEXO4023');
            expectModuleCode(observing({ changes: 'constant' }), 'NEXO4023');
        });

        it('NEXO4514: updates whose changes or reads are none of their categories or modes', () => {
            expectModuleCode(observing({ changes: 'sometimes', reads: 'fresh' }), 'NEXO4514');
            expectModuleCode(observing({ changes: 'constant', reads: 'lazily' }), 'NEXO4514');
        });

        it('NEXO4058: misses missing where partly observable, or present otherwise', () => {
            expectModuleCode(observing({ changes: 'partly-observable', reads: 'fresh', observations: [{ type: 'state', of: 'receiver' }] }), 'NEXO4058');
            expectModuleCode(observing({ ...constantUpdates, misses: 'drains' }), 'NEXO4058');
        });

        it('NEXO4515: a tolerance that is not a number that is not negative', () => {
            expectModuleCode(observing({ ...constantUpdates, tolerance: -1 }), 'NEXO4515');
        });

        it('NEXO4026: a tolerance on a result that holds no number', () => {
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ result: 'String', updates: { ...constantUpdates, tolerance: 1 } })] })), 'NEXO4026');
            expectModuleCode(registering(module('charts', withHome({ members: [propertyDeclaration({ result: 'Light', updates: { ...constantUpdates, tolerance: 1 } })] }))), 'NEXO4026');
        });

        it('NEXO4516: observations that are not a list', () => {
            expectModuleCode(observing({ ...constantUpdates, observations: {} }), 'NEXO4516');
        });

        it('NEXO4059: observations missing where observable, or present otherwise', () => {
            expectModuleCode(observing({ changes: 'observable', reads: 'fresh' }), 'NEXO4059');
            expectModuleCode(observing({ ...constantUpdates, observations: [{ type: 'state', of: 'receiver' }] }), 'NEXO4059');
        });

        it('NEXO4060: an observation of the wrong type, target or arguments', () => {
            expectModuleCode(observing(observable([{ type: 'chart-state', of: 'receiver' }])), 'NEXO4060');
            expectModuleCode(observing(observable([{ type: 'state', of: 'chart-home' }])), 'NEXO4060');
            expectModuleCode(observing(observable([{ type: 'state', of: 'receiver', level: { value: 1 } }])), 'NEXO4060');
            expectModuleCode(registering(module('charts', onStrings([propertyDeclaration({ updates: observable([{ type: 'nothing', of: 'receiver' }]) })]))), 'NEXO4060');
        });

        it('NEXO4055: a function parameter an observation is given', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback()], updates: observable([{ type: 'state', of: { argument: 'test' } }]) })] }), 'NEXO4055');
        });

        it('NEXO4057: a module member that observes its receiver or a target found from one', () => {
            expectModuleCode(creating({ observationTypes: [state], members: [propertyDeclaration({ updates: observable([{ type: 'state', of: 'receiver' }]) })] }), 'NEXO4057');
            expectModuleCode(registering(module('charts', {
                observationTypes: [state],
                observationTargets: [{ name: 'parent', from: 'receiver' }],
                members: [propertyDeclaration({ updates: observable([{ type: 'state', of: 'parent' }]) })],
            })), 'NEXO4057');
        });

        it('NEXO4061: a prefix on an argument that is not a String value parameter', () => {
            expectModuleCode(creating(onStrings([functionDeclaration({ updates: observable([{ type: 'state', of: 'receiver', attribute: { argument: 'amount', prefix: 'aria-' } }]) })])), 'NEXO4061');
        });

        it('NEXO4024: an observation of a target its observation type\'s module does not declare', () => {
            expectModuleCode(registering(module('charts', { observationTypes: [state], members: [propertyDeclaration({ updates: observable([{ type: 'state', of: 'home' }]) })] })), 'NEXO4024');
        });

        it('NEXO4025: a member reading maintained values without a maintained observation', () => {
            expectModuleCode(registering(module('charts', onStrings([propertyDeclaration({ updates: { ...observable([{ type: 'state', of: 'receiver' }]), reads: 'maintained' } })], { observationTypes: [state] }))), 'NEXO4025');
        });

        it('NEXO4062: a member naming a maintained observation without reading maintained values', () => {
            expectModuleCode(registering(module('charts', onStrings([propertyDeclaration({ updates: observable([{ type: 'reading', of: 'receiver' }]) })], { observationTypes: [reading] }))), 'NEXO4062');
        });

        it('NEXO4063: a maintained observation of a target of many', () => {
            expectModuleCode(registering(module('charts', {
                observationTypes: [reading],
                observationTargets: [{ name: 'sensors', count: 'many' }],
                members: [propertyDeclaration({ updates: { ...observable([{ type: 'reading', of: 'sensors' }]), reads: 'maintained' } })],
            })), 'NEXO4063');
        });
    });

    describe('of an observation target and an observation type', () => {
        it('NEXO4037: an observation target named receiver', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'receiver' }] }), 'NEXO4037');
        });

        it('NEXO4517: an observation target declared twice', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home' }, { name: 'home' }] }), 'NEXO4517');
        });

        it('NEXO4518: an observation target whose from is not receiver', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home', from: 'parent' }] }), 'NEXO4518');
        });

        it('NEXO4519: an observation target whose count is not many', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home', count: 2 }] }), 'NEXO4519');
        });

        it('NEXO4520: an observation type of neither contract', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'push' }] }), 'NEXO4520');
        });

        it('NEXO4521: an observation type whose identity is not a list of identifiers', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', identity: 'name' }] }), 'NEXO4521');
        });

        it('NEXO4522: an observation type declaring whether it is shared by what is not a Boolean', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', shared: 'yes' }] }), 'NEXO4522');
        });
    });

    describe('of an operator', () => {
        const box = (members = []) => ({ name: 'Box', kind: 'structured', members: [...dataPropertyDeclarations({ width: 'Number' }), ...members] });
        const convert = result => operatorDeclaration('convert', result);
        const cast = result => operatorDeclaration('cast', result);

        it('NEXO4560: an operator named other than cast or convert', () => {
            expectModuleCode(creating({ types: [box([operatorDeclaration('parse', 'String')])] }), 'NEXO4560');
        });

        it('NEXO4561: an operator declaring type parameters', () => {
            expectModuleCode(creating({ types: [box([operatorDeclaration('convert<T>', 'String')])] }), 'NEXO4561');
        });

        it('NEXO4022: a module member that is an operator', () => {
            expectModuleCode(creating({ members: [convert('String')] }), 'NEXO4022');
        });

        it('NEXO4065: a conversion operator from or to a type that is not data', () => {
            expectModuleCode(registering(module('charts', withHome({ types: [{ name: 'Holder', kind: 'structured', members: dataPropertyDeclarations({ lamp: 'Light' }) }, onStrings([convert('Holder')]).types[0]] }))), 'NEXO4065');
            expectModuleCode(registering(module('charts', withHome({ types: [box()] }, { Light: [convert('Box')] }))), 'NEXO4065');
        });

        it('NEXO4066: a conversion operator from a type to itself', () => {
            expectModuleCode(registering(module('charts', { types: [box([convert('Box')])] })), 'NEXO4066');
        });

        it('NEXO4028: a conversion operator neither of whose types is its module\'s', () => {
            expectModuleCode(registering(module('charts', onStrings([convert('Number')]))), 'NEXO4028');
        });

        it('NEXO4027: a cast operator not declared on a reference type, or not casting to one', () => {
            expectModuleCode(registering(module('charts', { types: [box([cast('Box')])] })), 'NEXO4027');
            expectModuleCode(registering(module('charts', withHome({}, { Light: [cast('Number')] }))), 'NEXO4027');
        });

        it('NEXO4064: a cast operator to its own type, its supertype or a type beneath it', () => {
            for (const result of ['Light', 'Device']) {
                expectModuleCode(registering(module('charts', withHome({}, { Light: [cast(result)] }))), 'NEXO4064');
            }

            expectModuleCode(registering(module('charts', withHome({}, { Device: [cast('Light')] }))), 'NEXO4064');
        });

        it('NEXO4069: two operators of one name and destination on one receiver type of one module', () => {
            expectModuleCode(registering(module('charts', { types: [box(), onStrings([convert('Box'), convert('Box')]).types[0]] })), 'NEXO4069');
        });
    });

    describe('of extensions and type parameters', () => {
        const extension = (overrides = {}) => ({ name: 'Usage', kind: 'extension', target: 'String', members: [propertyDeclaration({ name: 'usage' })], ...overrides });

        it('takes an extension of a type another module owns, its name declaring the parameters its target and its members share', () => {
            const [declared] = module('energy', { types: [extension({ name: 'Middles<T>', target: 'List<T>', members: [propertyDeclaration({ name: 'middle', result: 'T?' })] })] }).types;

            expect(declared).toMatchObject({ name: 'Middles', typeParameters: ['T'], kind: 'extension', target: 'List<T>' });
            expect(() => nexo.createRegistry([module('energy', { types: [extension()] })])).not.toThrow();
        });

        it('NEXO4012: an extension that names no target', () => {
            expectModuleCode(creating({ types: [extension({ target: undefined })] }), 'NEXO4012');
        });

        it('NEXO4559: an extension whose target is Any or nullable', () => {
            expectModuleCode(creating({ types: [extension({ target: 'Any' })] }), 'NEXO4559');
            expectModuleCode(creating({ types: [extension({ target: 'String?' })] }), 'NEXO4559');
        });

        it('NEXO4045: an extension whose target its own module owns', () => {
            expectModuleCode(registering(module('charts', withHome({ types: [extension({ target: 'Light' })] }))), 'NEXO4045');
        });

        it('NEXO4030: an extension\'s import, which it never declares, its types its own module\'s, Nexo\'s and foreign ones qualified', () => {
            expectModuleCode(creating({ types: [extension({ import: ['home'] })] }), 'NEXO4030');
        });

        it('NEXO4033: an extension named as a type its module declares', () => {
            expectModuleCode(creating({ types: [{ name: 'Usage', kind: 'structured', members: [] }, extension({ name: 'Usage<T>', target: 'List<T>' })] }), 'NEXO4033');
        });

        it('NEXO4010: empty angle brackets after a declaration\'s name, or a type parameter without a name', () => {
            expectModuleCode(creating({ types: [extension({ name: 'Usage<>' })] }), 'NEXO4010');
            expectModuleCode(creating({ types: [extension({ name: 'Usage<T,>', target: 'List<T>' })] }), 'NEXO4010');
            expectModuleCode(creating({ members: [functionDeclaration({ name: 'pick<>' })] }), 'NEXO4010');
        });

        it('NEXO4041: a type parameter declared twice', () => {
            expectModuleCode(creating({ types: [extension({ name: 'Usage<T,T>', target: 'List<T>' })] }), 'NEXO4041');
        });

        it('NEXO4043: a member declaring a parameter its extension declares', () => {
            expectModuleCode(creating({ types: [extension({ name: 'Middles<T>', target: 'List<T>', members: [propertyDeclaration({ name: 'middle<T>', result: 'T?' })] })] }), 'NEXO4043');
        });

        it('NEXO4042: a type parameter named as a type its declaration reaches unqualified, Nexo\'s own, its module\'s or an imported one', () => {
            expectModuleCode(registering(module('words', { types: [extension({ name: 'Usage<String>', target: 'List<String>' })] })), 'NEXO4042');
            expectModuleCode(registering(module('words', { types: [extension({ name: 'Usage<Never>', target: 'List<Never>' })] })), 'NEXO4042');
            expectModuleCode(registering(module('words', { types: [{ name: 'Word', kind: 'structured', members: [] }], members: [functionDeclaration({ name: 'pick<Word>', parameters: [parameterDeclaration({ type: 'Word' })], result: 'Word' })] })), 'NEXO4042');
            expect(() => nexo.createRegistry([module('words', { members: [functionDeclaration({ name: 'pick<Item>', parameters: [parameterDeclaration({ type: 'Item' })], result: 'Item' })] })])).not.toThrow();
        });

        it('NEXO4011: a member whose result writes a type parameter nothing binds', () => {
            expectModuleCode(registering(module('words', { members: [functionDeclaration({ name: 'make<T>', parameters: [], arguments: undefined, result: 'T' })] })), 'NEXO4011');
            expectModuleCode(registering(module('words', { types: [extension({ name: 'Usage<T>', members: [propertyDeclaration({ name: 'usage', result: 'T' })] })] })), 'NEXO4011');
            expect(() => nexo.createRegistry([module('words', { types: [extension({ name: 'Usage<T>', target: 'List<T>', members: [propertyDeclaration({ name: 'usage', result: 'T?' })] })] })])).not.toThrow();
        });

        it('NEXO4044: a member whose callback\'s input writes a type parameter only another callback\'s result binds', () => {
            const callbacks = [callback({ name: 'make', type: 'U', parameterTypes: [] }), callback({ name: 'use', type: 'Boolean', parameterTypes: ['U'] })];

            expectModuleCode(registering(module('words', { members: [functionDeclaration({ name: 'chain<U>', parameters: callbacks, result: 'Boolean' })] })), 'NEXO4044');
        });

        it('NEXO4558: a reference or structured type declaring type parameters', () => {
            expectModuleCode(creating({ types: [{ name: 'Box<T>', kind: 'structured', members: [] }] }), 'NEXO4558');
            expectModuleCode(creating({ types: [{ name: 'Lamp<T>', kind: 'reference', isInstance: () => true }] }), 'NEXO4558');
        });
    });

    describe('of internal declarations', () => {
        const state = { name: 'ReadingState', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }), internal: true };
        const reading = (members = [], overrides = {}) => ({ name: 'Reading', kind: 'reference', isInstance: () => true, members, ...overrides });
        const readings = contents => module('readings', contents);

        it('NEXO4031: an internal that is no Boolean', () => {
            expectModuleCode(creating({ types: [{ ...state, internal: 'yes' }] }), 'NEXO4031');
            expectModuleCode(creating({ members: [propertyDeclaration({ internal: 1 })] }), 'NEXO4031');
        });

        it('NEXO4052: a public declaration exposing an internal type of its module, as the specification\'s cases set out', () => {
            expectModuleCode(registering(readings({ types: [state], members: [propertyDeclaration({ result: 'ReadingState' })] })), 'NEXO4052');
            expectModuleCode(registering(readings({ types: [state], members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<ReadingState>' })] })] })), 'NEXO4052');
            expectModuleCode(registering(readings({ types: [{ ...reading(), name: 'Inner', internal: true }, reading([], { supertype: 'Inner' })] })), 'NEXO4052');
            expectModuleCode(registering(readings({ types: [state], typeSelectors: [{ name: 'report' }], mappings: [{ selector: 'report', key: 'state', type: 'ReadingState' }] })), 'NEXO4052');
            expect(() => nexo.createRegistry([readings({ types: [state], members: [propertyDeclaration({ result: 'ReadingState', internal: true })] })])).not.toThrow();
            expect(() => nexo.createRegistry([readings({ types: [state, reading([propertyDeclaration({ name: 'state', result: 'ReadingState', internal: true })])] })])).not.toThrow();
        });

        it('takes a member within an internal type as internal, whatever its own flag says, so it exposes the type\'s internal types freely', () => {
            const inner = { ...reading([propertyDeclaration({ name: 'state', result: 'ReadingState', internal: false })]), internal: true };

            expect(() => nexo.createRegistry([readings({ types: [state, inner] })])).not.toThrow();
        });

        it('NEXO4018: a declaration naming another module\'s internal type', () => {
            const refused = expectModuleError(registering(readings({ types: [state] }), module('charts', { members: [propertyDeclaration({ result: 'readings.ReadingState' })] })));

            expect(refused).toEqual({ message: expect.stringContaining("readings.ReadingState, an internal type of the module 'readings'"), module: 'charts', declaration: 'zoom' });
            expectModuleCode(registering(readings({ types: [state] }), module('charts', { typeSelectors: [{ name: 'report' }], mappings: [{ selector: 'report', key: 'state', type: 'readings.ReadingState' }] })), 'NEXO4018');
        });
    });

    describe('of registering a module', () => {
        const chart = { name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }) };

        it('NEXO4546: registering what createModule did not make', () => {
            expectModuleCode(registering({ name: 'fake', members: [] }), 'NEXO4546');
        });

        it('NEXO4035: a module whose name, compared case-insensitively, is already registered', () => {
            expectModuleCode(registering(module('charts', {}), module('charts', {})), 'NEXO4035');
            expectModuleCode(registering(module('Charts', {}), module('CHARTS', {})), 'NEXO4035');
            expectModuleCode(registering(module('NEXO', {})), 'NEXO4035');
            // Nexo's own module is spelled as the specification spells it, which another spelling of its name collides with.
            expect(expectModuleError(registering(module('nexo', {}))).message).toContain("'Nexo' is registered already");
            expect(nexo.createRegistry([module('Charts', {})]).moduleNames).toContain('Charts');
        });

        it('NEXO4033: a type of a name its module already declares', () => {
            expectModuleCode(creating({ types: [chart, chart] }), 'NEXO4033');
        });

        it('NEXO4015: a type\'s import that does not name a registered module', () => {
            expectModuleCode(registering(module('charts', { types: [{ ...chart, import: ['axes'] }] })), 'NEXO4015');
        });

        it('NEXO4047: a type reference resolving to no type', () => {
            const axes = module('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] });

            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ result: 'Chart' })] })), 'NEXO4047');
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ result: 'axes.Axis' })] })), 'NEXO4047');
            expectModuleCode(registering(axes, module('charts', { members: [propertyDeclaration({ result: 'axes.Scale' })] })), 'NEXO4047');
        });

        it('NEXO4048: a type reference resolving to several types', () => {
            const axis = { name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) };

            expectModuleCode(registering(module('axes', { types: [axis] }), module('scales', { types: [axis] }), module('charts', { types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ axis: 'Axis' }), import: ['axes', 'scales'] }] })), 'NEXO4048');
        });

        it('NEXO4049: a foreign type named unqualified outside its import', () => {
            expectModuleCode(registering(module('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] }), module('charts', { members: [propertyDeclaration({ result: 'Axis' })] })), 'NEXO4049');
        });

        it('NEXO4549: a module member its module declares twice', () => {
            const rooms = propertyDeclaration({ name: 'rooms' });

            expectModuleCode(creating({ members: [rooms, rooms] }), 'NEXO4549');
        });

        it('NEXO4029: two members of one name on one receiver type of one module', () => {
            expectModuleCode(registering(module('charts', onStrings([propertyDeclaration(), propertyDeclaration()]))), 'NEXO4029');
            expectModuleCode(registering(module('charts', withHome({}, { Light: [propertyDeclaration(), propertyDeclaration()] }))), 'NEXO4029');
            expect(registering(module('charts', withHome({}, { Light: [propertyDeclaration()], Device: [propertyDeclaration()] })))).not.toThrow();
        });

        it('NEXO4068: two unnamed indexers for one receiver type of one module', () => {
            expectModuleCode(registering(module('charts', withHome({}, { Device: [indexerDeclaration(), indexerDeclaration()] }))), 'NEXO4068');
            expect(expectModuleError(registering(module('charts', withHome({}, { Device: [indexerDeclaration(), indexerDeclaration()] }))))).toEqual({ message: expect.stringContaining('An unnamed indexer of Device is declared already'), module: 'charts', type: 'Device', declaration: '[]', declarationKey: 'kind' });
            expect(registering(module('charts', withHome({}, { Light: [indexerDeclaration()], Device: [indexerDeclaration()] })))).not.toThrow();
        });

        it('NEXO4564: an extension declaring an indexer without a name', () => {
            expectModuleCode(registering(module('charts', onStrings([indexerDeclaration()]))), 'NEXO4564');
            expect(expectModuleError(registering(module('charts', onStrings([indexerDeclaration()]))))).toEqual({ message: expect.stringContaining("The extension 'Words' declares an indexer without a name"), module: 'charts', declaration: 'Words', declarationKey: 'members' });
            expect(registering(module('charts', onStrings([indexerDeclaration({ name: 'cell' })])))).not.toThrow();
        });
    });
});
