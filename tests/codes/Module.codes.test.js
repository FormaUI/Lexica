import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { withHome } from '../support/home.mjs';
import { errorThrownBy, expectLexicaError, expectModuleError } from '../support/errors.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, functionDeclaration, indexerDeclaration, parameterDeclaration, propertyDeclaration } from '../support/declarations.mjs';

const observable = observations => ({ changes: 'observable', reads: 'fresh', observations });

/** A function parameter, its callback taking a string and answering a Boolean. */
const callback = (overrides = {}) => ({ name: 'test', kind: 'function', type: 'Boolean', required: true, parameters: ['String'], ...overrides });

/** A fixed parameter selecting a type through the selector `report`. */
const selecting = (overrides = {}) => parameterDeclaration({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector: 'report', ...overrides });

/** A host call of a string, which declares no updates. */
const hostCall = (overrides = {}) => functionDeclaration({ invokedBy: 'host', updates: undefined, ...overrides });

/** Asserts that the call fails with a module error of the code. */
const expectModuleCode = (call, code) => expectLexicaError(errorThrownBy(call), code, 'module');

const creating = contents => () => lexica.createModule('charts', contents);
const registering = (...modules) => () => lexica.createRegistry(modules);
const module = (name, contents) => lexica.createModule(name, contents);

describe('the module error codes', () => {
    describe('of creating a module', () => {
        it('LEXICA4500: a module whose name is not an identifier', () => {
            expectModuleCode(() => lexica.createModule('chart-tools', {}), 'LEXICA4500');
        });

        it('LEXICA4501: a module whose contents are not an object', () => {
            expectModuleCode(creating(null), 'LEXICA4501');
        });

        it('LEXICA4502: a module declaring what a module does not declare', () => {
            expectModuleCode(creating({ member: [] }), 'LEXICA4502');
            expectModuleCode(creating({ predicates: [] }), 'LEXICA4502');
        });

        it('LEXICA4503: a module whose declarations of one kind are not a list', () => {
            expectModuleCode(creating({ members: {} }), 'LEXICA4503');
        });

        it('LEXICA4504: a declaration that is not an object', () => {
            expectModuleCode(creating({ members: [null] }), 'LEXICA4504');
            expectModuleCode(creating({ typeSelectors: [5] }), 'LEXICA4504');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: 5 })] }), 'LEXICA4504');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [null] })] }), 'LEXICA4504');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: observable([null]) })] }), 'LEXICA4504');
        });

        it('LEXICA4030: a field a declaration does not take', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ on: 'String' })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [propertyDeclaration({ syntax: 'function-call' })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ syntax: 'indexer' })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ default: true })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [indexerDeclaration({ arguments: 'positional' })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: { ...constantUpdates, tolerence: 1 } })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ fixd: true })] })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [hostCall({ updates: constantUpdates })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [hostCall({ impl: () => 1 })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ fixed: false })] })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ context: 'item' })] })] }), 'LEXICA4030');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ parameters: ['Number'] })] })] }), 'LEXICA4030');
        });

        it('LEXICA4505: an implementation that is not a function', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ impl: 5 })] }), 'LEXICA4505');
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', impl: 'run' }] }), 'LEXICA4505');
        });
    });

    describe('of a type', () => {
        const structured = (overrides = {}) => ({ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }), ...overrides });
        const reference = (overrides = {}) => ({ name: 'Lamp', kind: 'reference', isInstance: () => true, ...overrides });

        it('LEXICA4554: a type of a kind that is none of a type\'s kinds, or of no kind', () => {
            expectModuleCode(creating({ types: [structured({ kind: 'object' })] }), 'LEXICA4554');
            expectModuleCode(creating({ types: [structured({ kind: undefined })] }), 'LEXICA4554');
        });

        it('LEXICA4556: a type of a kind the declaration model brings', () => {
            expectModuleCode(creating({ types: [{ name: 'Lamps', kind: 'extension', target: 'Light' }] }), 'LEXICA4556');
        });

        it('LEXICA4017: a reference type without isInstance', () => {
            expectModuleCode(creating({ types: [reference({ isInstance: undefined })] }), 'LEXICA4017');
        });

        it('LEXICA4051: a typeOf or an isInstance that is not a function', () => {
            expectModuleCode(creating({ types: [reference({ isInstance: true })] }), 'LEXICA4051');
            expectModuleCode(creating({ typeOf: 'Lamp' }), 'LEXICA4051');
        });

        it('LEXICA4555: an abstract that is not a Boolean', () => {
            expectModuleCode(creating({ types: [reference({ abstract: 'yes' })] }), 'LEXICA4555');
        });

        it('LEXICA4030: a declaration key a type\'s kind does not take, a type-level fields collection among them', () => {
            expectModuleCode(creating({ types: [reference({ fields: { points: 'Number' } })] }), 'LEXICA4030');
            expectModuleCode(creating({ types: [structured({ fields: { points: 'Number' } })] }), 'LEXICA4030');
            expectModuleCode(creating({ types: [structured({ supertype: 'Lamp' })] }), 'LEXICA4030');
        });

        it('LEXICA4016: a supertype that is not a reference type', () => {
            expectModuleCode(registering(module('charts', { types: [structured(), reference({ supertype: 'Chart' })] })), 'LEXICA4016');
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'String' })] })), 'LEXICA4016');
        });

        it('LEXICA4050: a type hierarchy that is a cycle', () => {
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'Bulb' }), reference({ name: 'Bulb', supertype: 'Lamp' })] })), 'LEXICA4050');
            expectModuleCode(registering(module('charts', { types: [reference({ supertype: 'Lamp' })] })), 'LEXICA4050');
        });

        it('takes a type of any name, a lowercase one and one Lexica\'s own types spell among them, and a structured type of no data property', () => {
            for (const name of ['chart', 'Number', 'Null', 'List']) {
                expect(() => lexica.createRegistry([module('charts', { types: [structured({ name })] })])).not.toThrow();
            }

            expect(lexica.createRegistry([module('charts', { types: [structured({ members: [] }), structured({ name: 'Axis', members: undefined })] })]).moduleNames).toContain('charts');
        });

        it('LEXICA4552: a type whose name is not an identifier', () => {
            expectModuleCode(creating({ types: [structured({ name: 'Chart_1' })] }), 'LEXICA4552');
            expectModuleCode(creating({ types: [structured({ name: undefined })] }), 'LEXICA4552');
        });

        it('LEXICA4506: a type named by a single capital letter', () => {
            expectModuleCode(creating({ types: [structured({ name: 'C' })] }), 'LEXICA4506');
        });

        it('LEXICA4507: a type whose import is not a list of module names', () => {
            expectModuleCode(creating({ types: [structured({ import: 'axes' })] }), 'LEXICA4507');
            expectModuleCode(creating({ types: [structured({ import: ['axes-two'] })] }), 'LEXICA4507');
        });

        it('LEXICA4508: a type importing a module twice', () => {
            expectModuleCode(creating({ types: [structured({ import: ['axes', 'axes'] })] }), 'LEXICA4508');
        });

        it('LEXICA4503: a type\'s members that are not a list', () => {
            expectModuleCode(creating({ types: [structured({ members: {} })] }), 'LEXICA4503');
        });

        it('LEXICA4032: a property declared without updates anywhere but directly in a structured type', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ updates: undefined })] }), 'LEXICA4032');
            expectModuleCode(creating({ types: [reference({ members: [propertyDeclaration({ target: undefined, updates: undefined })] })] }), 'LEXICA4032');
        });

        it('refuses a data property that is not a name with a type, or that carries an impl, which Lexica never invokes', () => {
            expectModuleCode(creating({ types: [structured({ members: dataPropertyDeclarations({ 'point-count': 'Number' }) })] }), 'LEXICA4523');
            expectModuleCode(creating({ types: [structured({ members: dataPropertyDeclarations({ points: 'List<' }) })] }), 'LEXICA4512');
            expectModuleCode(creating({ types: [structured({ members: [{ name: 'points', kind: 'property', result: 'Number', impl: () => 1 }] })] }), 'LEXICA4030');
        });
    });

    describe('of a type selector and a selectable type', () => {
        it('LEXICA4006: a type selector, an observation type or an observation target not named by an identifier', () => {
            expectModuleCode(creating({ typeSelectors: [{ name: 'chart-report' }] }), 'LEXICA4006');
            expectModuleCode(creating({ observationTypes: [{ name: 'chart-state', contract: 'invalidation' }] }), 'LEXICA4006');
            expectModuleCode(creating({ observationTargets: [{ name: 'chart-home' }] }), 'LEXICA4006');
        });

        it('LEXICA4007: a type selector or an observation type named as one declared already', () => {
            expectModuleCode(creating({ typeSelectors: [{ name: 'report' }, { name: 'report' }] }), 'LEXICA4007');
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation' }, { name: 'state', contract: 'maintained' }] }), 'LEXICA4007');
            expect(expectModuleError(creating({ observationTypes: [{ name: 'state', contract: 'invalidation' }, { name: 'state', contract: 'maintained' }] }))).toEqual({ message: expect.any(String), module: 'charts', declaration: 'state', declarationKey: 'name' });
            expectModuleCode(registering(module('charts', { typeSelectors: [{ name: 'report' }] }), module('graphs', { typeSelectors: [{ name: 'report' }] })), 'LEXICA4007');
            expectModuleCode(registering(module('charts', { observationTypes: [{ name: 'state', contract: 'invalidation' }] }), module('graphs', { observationTypes: [{ name: 'state', contract: 'invalidation' }] })), 'LEXICA4007');
        });

        it('LEXICA4008: a mapping without its selector, its key, a string, or its type', () => {
            expectModuleCode(creating({ mappings: [{ selector: 'report', type: 'Number' }] }), 'LEXICA4008');
            expectModuleCode(creating({ mappings: [{ selector: 'report', key: 1, type: 'Number' }] }), 'LEXICA4008');
            expectModuleCode(creating({ mappings: [{ key: 'click', type: 'Number' }] }), 'LEXICA4008');
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'report' }] }), 'LEXICA4008');
        });

        it('takes a mapping\'s key of any string, as a fixed argument may give any', () => {
            expect(() => lexica.createRegistry([module('charts', { typeSelectors: [{ name: 'report' }], mappings: [{ selector: 'report', key: 'chart click', type: 'Number' }, { selector: 'report', key: '', type: 'String' }] })])).not.toThrow();
        });

        it('LEXICA4039: a mapping of a selector no module declares', () => {
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'chart-report', type: 'Number' }] }), 'LEXICA4039');
            expectModuleCode(registering(module('charts', { mappings: [{ key: 'click', selector: 'report', type: 'Number' }] })), 'LEXICA4039');
        });

        it('LEXICA4038: a mapping whose key its selector maps already', () => {
            const selectable = { key: 'click', selector: 'report', type: 'Number' };

            expectModuleCode(creating({ typeSelectors: [{ name: 'report' }], mappings: [selectable, selectable] }), 'LEXICA4038');
            expectModuleCode(registering(module('charts', { typeSelectors: [{ name: 'report' }], mappings: [selectable] }), module('graphs', { mappings: [selectable] })), 'LEXICA4038');
        });

        it('LEXICA4512: a type notation that does not parse', () => {
            expectModuleCode(creating({ mappings: [{ key: 'click', selector: 'report', type: 'List<' }] }), 'LEXICA4512');
            expectModuleCode(creating({ members: [propertyDeclaration({ result: 'List<' })] }), 'LEXICA4512');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<' })] })] }), 'LEXICA4512');
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback({ parameters: ['List<'] })] })] }), 'LEXICA4512');
            expectModuleCode(creating({ types: [{ name: 'Lamp', kind: 'reference', isInstance: () => true, supertype: 'List<' }] }), 'LEXICA4512');
        });
    });

    describe('of a member', () => {
        it('LEXICA4513: a member whose target is not a type, a list of types or any', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ target: [] })] }), 'LEXICA4513');
            expectModuleCode(creating({ members: [propertyDeclaration({ target: 'List<' })] }), 'LEXICA4513');
        });

        it('LEXICA4002: a member declared without a name', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ name: undefined })] }), 'LEXICA4002');
        });

        it('LEXICA4523: a member whose name is not an identifier', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ name: 'chart-size' })] }), 'LEXICA4523');
        });

        it('LEXICA4524: a member of a kind that is not a property or a function', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ kind: 'operation' })] }), 'LEXICA4524');
        });

        it('LEXICA4525: a function invoked by neither the evaluator nor the host', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ invokedBy: 'user' })] }), 'LEXICA4525');
        });

        it('LEXICA4003: a member without a field its kind requires', () => {
            expectModuleCode(creating({ members: [propertyDeclaration({ result: undefined })] }), 'LEXICA4003');
            expectModuleCode(creating({ members: [functionDeclaration({ arguments: undefined })] }), 'LEXICA4003');
        });

        it('LEXICA4526: a member whose parameters are not a list', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: {} })] }), 'LEXICA4526');
        });

        it('LEXICA4527: a member declaring a parameter twice', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration(), parameterDeclaration()] })] }), 'LEXICA4527');
        });

        it('LEXICA4053: a host call written as an indexer', () => {
            expectModuleCode(creating({ members: [indexerDeclaration({ invokedBy: 'host', updates: undefined })] }), 'LEXICA4053');
        });

        it('LEXICA4056: a host call taking a parameter other than a value parameter', () => {
            expectModuleCode(creating({ members: [hostCall({ parameters: [parameterDeclaration({ kind: 'expression', context: 'item' })] })] }), 'LEXICA4056');
        });

        it('LEXICA4009: a function with more than one parameter that selects a type', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected', parameters: [selecting(), selecting({ name: 'other' })] })] }), 'LEXICA4009');
        });

        it('LEXICA4529: a function with a parameter that selects a type whose result writes no @selected', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [selecting()] })] }), 'LEXICA4529');
        });

        it('LEXICA4040: a result writing @selected without a parameter that selects a type', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected' })] }), 'LEXICA4040');
        });
    });

    describe('of how a member is written', () => {
        it('LEXICA4020: an indexer without exactly one required value parameter as its key', () => {
            expectModuleCode(creating({ members: [indexerDeclaration({ parameters: [parameterDeclaration(), parameterDeclaration({ name: 'more' })] })] }), 'LEXICA4020');
            expectModuleCode(creating({ members: [indexerDeclaration({ name: 'setting', parameters: [parameterDeclaration({ required: false, default: 1 })] })] }), 'LEXICA4020');
        });

        it('LEXICA4022: a module member that is an indexer', () => {
            expectModuleCode(creating({ members: [indexerDeclaration({ target: undefined })] }), 'LEXICA4022');
        });

        it('LEXICA4534: a function without parameters declaring the form of its arguments', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [] })] }), 'LEXICA4534');
        });

        it('LEXICA4535: a function whose arguments are neither positional nor options', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ arguments: 'named' })] }), 'LEXICA4535');
        });

        it('LEXICA4019: a required positional parameter after an optional one', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: 1 }), parameterDeclaration({ name: 'more' })] })] }), 'LEXICA4019');
        });
    });

    describe('of a parameter', () => {
        const declaring = overrides => creating({ members: [functionDeclaration({ parameters: [parameterDeclaration(overrides)] })] });
        const declaringCallback = overrides => creating({ members: [functionDeclaration({ parameters: [callback(overrides)] })] });

        it('LEXICA4536: a parameter without its name, kind, type, required or null policy, or with one it does not take', () => {
            expectModuleCode(declaring({ kind: undefined }), 'LEXICA4536');
            expectModuleCode(declaring({ nulls: 'drop' }), 'LEXICA4536');
            expectModuleCode(declaring({ required: 'yes' }), 'LEXICA4536');
            expectModuleCode(declaring({ type: undefined }), 'LEXICA4536');
        });

        it('LEXICA4054: a function parameter that is optional or has a null policy', () => {
            expectModuleCode(declaringCallback({ nulls: 'propagate' }), 'LEXICA4054');
            expectModuleCode(declaringCallback({ required: false }), 'LEXICA4054');
        });

        it('LEXICA4537: a function parameter not declaring its parameters as a list', () => {
            expectModuleCode(declaringCallback({ parameters: undefined }), 'LEXICA4537');
        });

        it('LEXICA4538: a required parameter with a default', () => {
            expectModuleCode(declaring({ default: 1 }), 'LEXICA4538');
        });

        it('LEXICA4539: an expression or a predicate parameter whose context is not item', () => {
            expectModuleCode(declaring({ kind: 'expression' }), 'LEXICA4539');
        });

        it('LEXICA4540: a predicate parameter not of type Boolean', () => {
            expectModuleCode(declaring({ kind: 'predicate', context: 'item' }), 'LEXICA4540');
        });

        it('LEXICA4541: a parameter declaring whether it is fixed by what is not a Boolean', () => {
            expectModuleCode(declaring({ fixed: 'yes' }), 'LEXICA4541');
        });

        it('LEXICA4542: a parameter that is not fixed declaring what it selects', () => {
            expectModuleCode(declaring({ selects: 'type' }), 'LEXICA4542');
        });

        it('LEXICA4543: a fixed parameter selecting what is not a type', () => {
            expectModuleCode(declaring({ type: 'String', fixed: true, selects: 'value' }), 'LEXICA4543');
        });

        it('LEXICA4544: a fixed parameter not naming its type selector', () => {
            expectModuleCode(declaring({ type: 'String', fixed: true, selects: 'type' }), 'LEXICA4544');
        });

        it('LEXICA4545: a fixed parameter that is not a value parameter of type String', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ result: '@selected', parameters: [selecting({ type: 'Number' })] })] }), 'LEXICA4545');
        });

        it('LEXICA4547: a parameter selecting through a type selector no module declares', () => {
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ result: '@selected', parameters: [selecting()] })] })), 'LEXICA4547');
        });

        it('LEXICA4548: a parameter default its type does not admit', () => {
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: 'many' })] })] })), 'LEXICA4548');
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ required: false, default: Infinity })] })] })), 'LEXICA4548');
            expectModuleCode(registering(module('charts', { members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<Number>', required: false, default: [1, , 3] })] })] })), 'LEXICA4548');
        });

        it('LEXICA4562: a declaration holding a value that reaches itself', () => {
            const selfList = [];

            selfList.push(selfList);
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [parameterDeclaration({ type: 'List<Number>', required: false, default: selfList })] })] }), 'LEXICA4562');
        });
    });

    describe('of updates and observations', () => {
        const state = { name: 'state', contract: 'invalidation' };
        const reading = { name: 'reading', contract: 'maintained' };
        const observing = (updates, overrides = {}) => creating({ observationTypes: [state], members: [propertyDeclaration({ updates, ...overrides })] });

        it('LEXICA4023: updates without changes or reads', () => {
            expectModuleCode(observing({ reads: 'fresh' }), 'LEXICA4023');
            expectModuleCode(observing({ changes: 'constant' }), 'LEXICA4023');
        });

        it('LEXICA4514: updates whose changes or reads are none of their categories or modes', () => {
            expectModuleCode(observing({ changes: 'sometimes', reads: 'fresh' }), 'LEXICA4514');
            expectModuleCode(observing({ changes: 'constant', reads: 'lazily' }), 'LEXICA4514');
        });

        it('LEXICA4058: misses missing where partly observable, or present otherwise', () => {
            expectModuleCode(observing({ changes: 'partly-observable', reads: 'fresh', observations: [{ type: 'state', of: 'receiver' }] }), 'LEXICA4058');
            expectModuleCode(observing({ ...constantUpdates, misses: 'drains' }), 'LEXICA4058');
        });

        it('LEXICA4515: a tolerance that is not a number that is not negative', () => {
            expectModuleCode(observing({ ...constantUpdates, tolerance: -1 }), 'LEXICA4515');
        });

        it('LEXICA4026: a tolerance on a result that holds no number', () => {
            expectModuleCode(observing({ ...constantUpdates, tolerance: 1 }, { result: 'String' }), 'LEXICA4026');
            expectModuleCode(registering(module('charts', withHome({ members: [propertyDeclaration({ result: 'Light', updates: { ...constantUpdates, tolerance: 1 } })] }))), 'LEXICA4026');
        });

        it('LEXICA4516: observations that are not a list', () => {
            expectModuleCode(observing({ ...constantUpdates, observations: {} }), 'LEXICA4516');
        });

        it('LEXICA4059: observations missing where observable, or present otherwise', () => {
            expectModuleCode(observing({ changes: 'observable', reads: 'fresh' }), 'LEXICA4059');
            expectModuleCode(observing({ ...constantUpdates, observations: [{ type: 'state', of: 'receiver' }] }), 'LEXICA4059');
        });

        it('LEXICA4060: an observation of the wrong type, target or arguments', () => {
            expectModuleCode(observing(observable([{ type: 'chart-state', of: 'receiver' }])), 'LEXICA4060');
            expectModuleCode(observing(observable([{ type: 'state', of: 'chart-home' }])), 'LEXICA4060');
            expectModuleCode(observing(observable([{ type: 'state', of: 'receiver', level: { value: 1 } }])), 'LEXICA4060');
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ updates: observable([{ type: 'nothing', of: 'receiver' }]) })] })), 'LEXICA4060');
        });

        it('LEXICA4055: a function parameter an observation is given', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ parameters: [callback()], updates: observable([{ type: 'state', of: { argument: 'test' } }]) })] }), 'LEXICA4055');
        });

        it('LEXICA4057: a module member that observes its receiver or a target found from one', () => {
            expectModuleCode(observing(observable([{ type: 'state', of: 'receiver' }]), { target: undefined }), 'LEXICA4057');
            expectModuleCode(registering(module('charts', {
                observationTypes: [state],
                observationTargets: [{ name: 'parent', from: 'receiver' }],
                members: [propertyDeclaration({ target: undefined, updates: observable([{ type: 'state', of: 'parent' }]) })],
            })), 'LEXICA4057');
        });

        it('LEXICA4061: a prefix on an argument that is not a String value parameter', () => {
            expectModuleCode(creating({ members: [functionDeclaration({ updates: observable([{ type: 'state', of: 'receiver', attribute: { argument: 'amount', prefix: 'aria-' } }]) })] }), 'LEXICA4061');
        });

        it('LEXICA4024: an observation of a target its observation type\'s module does not declare', () => {
            expectModuleCode(registering(module('charts', { observationTypes: [state], members: [propertyDeclaration({ updates: observable([{ type: 'state', of: 'home' }]) })] })), 'LEXICA4024');
        });

        it('LEXICA4025: a member reading maintained values without a maintained observation', () => {
            expectModuleCode(registering(module('charts', { observationTypes: [state], members: [propertyDeclaration({ updates: { ...observable([{ type: 'state', of: 'receiver' }]), reads: 'maintained' } })] })), 'LEXICA4025');
        });

        it('LEXICA4062: a member naming a maintained observation without reading maintained values', () => {
            expectModuleCode(registering(module('charts', { observationTypes: [reading], members: [propertyDeclaration({ updates: observable([{ type: 'reading', of: 'receiver' }]) })] })), 'LEXICA4062');
        });

        it('LEXICA4063: a maintained observation of a target of many', () => {
            expectModuleCode(registering(module('charts', {
                observationTypes: [reading],
                observationTargets: [{ name: 'sensors', count: 'many' }],
                members: [propertyDeclaration({ updates: { ...observable([{ type: 'reading', of: 'sensors' }]), reads: 'maintained' } })],
            })), 'LEXICA4063');
        });
    });

    describe('of an observation target and an observation type', () => {
        it('LEXICA4037: an observation target named receiver', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'receiver' }] }), 'LEXICA4037');
        });

        it('LEXICA4517: an observation target declared twice', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home' }, { name: 'home' }] }), 'LEXICA4517');
        });

        it('LEXICA4518: an observation target whose from is not receiver', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home', from: 'parent' }] }), 'LEXICA4518');
        });

        it('LEXICA4519: an observation target whose count is not many', () => {
            expectModuleCode(creating({ observationTargets: [{ name: 'home', count: 2 }] }), 'LEXICA4519');
        });

        it('LEXICA4520: an observation type of neither contract', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'push' }] }), 'LEXICA4520');
        });

        it('LEXICA4521: an observation type whose identity is not a list of identifiers', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', identity: 'name' }] }), 'LEXICA4521');
        });

        it('LEXICA4522: an observation type declaring whether it is shared by what is not a Boolean', () => {
            expectModuleCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', shared: 'yes' }] }), 'LEXICA4522');
        });
    });

    describe('of a conversion', () => {
        it('LEXICA4065: a conversion from or to a type that is not data', () => {
            expectModuleCode(creating({ conversions: [{ from: 'String?', to: 'Number' }] }), 'LEXICA4065');
            expectModuleCode(registering(module('charts', withHome({ types: [{ name: 'Holder', kind: 'structured', members: dataPropertyDeclarations({ lamp: 'Light' }) }], conversions: [{ from: 'String', to: 'Holder' }] }))), 'LEXICA4065');
        });

        it('LEXICA4066: a conversion from a type to itself', () => {
            expectModuleCode(creating({ conversions: [{ from: 'String', to: 'String' }] }), 'LEXICA4066');
        });

        it('LEXICA4028: a conversion neither of whose types is its module\'s', () => {
            expectModuleCode(registering(module('charts', { conversions: [{ from: 'String', to: 'Number' }] })), 'LEXICA4028');
        });

        it('LEXICA4069: a conversion its module declares twice', () => {
            const box = { name: 'Box', kind: 'structured', members: dataPropertyDeclarations({ width: 'Number' }) };

            expectModuleCode(registering(module('charts', { types: [box], conversions: [{ from: 'String', to: 'Box' }, { from: 'String', to: 'Box' }] })), 'LEXICA4069');
        });
    });

    describe('of registering a module', () => {
        const chart = { name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }) };

        it('LEXICA4546: registering what createModule did not make', () => {
            expectModuleCode(registering({ name: 'fake', members: [] }), 'LEXICA4546');
        });

        it('LEXICA4035: a module whose name, compared case-insensitively, is already registered', () => {
            expectModuleCode(registering(module('charts', {}), module('charts', {})), 'LEXICA4035');
            expectModuleCode(registering(module('Charts', {}), module('CHARTS', {})), 'LEXICA4035');
            expectModuleCode(registering(module('LEXICA', {})), 'LEXICA4035');
            // Lexica's own module is spelled as the specification spells it, which another spelling of its name collides with.
            expect(expectModuleError(registering(module('lexica', {}))).message).toContain("'Lexica' is registered already");
            expect(lexica.createRegistry([module('Charts', {})]).moduleNames).toContain('Charts');
        });

        it('LEXICA4557: a module named by a reserved word, which text reaches only through an import binding', () => {
            expectModuleCode(registering(module('if', {})), 'LEXICA4557');
        });

        it('LEXICA4033: a type of a name its module already declares', () => {
            expectModuleCode(creating({ types: [chart, chart] }), 'LEXICA4033');
        });

        it('LEXICA4015: a type\'s import that does not name a registered module', () => {
            expectModuleCode(registering(module('charts', { types: [{ ...chart, import: ['axes'] }] })), 'LEXICA4015');
        });

        it('LEXICA4047: a type reference resolving to no type', () => {
            const axes = module('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] });

            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ result: 'Chart' })] })), 'LEXICA4047');
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration({ result: 'axes.Axis' })] })), 'LEXICA4047');
            expectModuleCode(registering(axes, module('charts', { members: [propertyDeclaration({ result: 'axes.Scale' })] })), 'LEXICA4047');
        });

        it('LEXICA4048: a type reference resolving to several types', () => {
            const axis = { name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) };

            expectModuleCode(registering(module('axes', { types: [axis] }), module('scales', { types: [axis] }), module('charts', { types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ axis: 'Axis' }), import: ['axes', 'scales'] }] })), 'LEXICA4048');
        });

        it('LEXICA4049: a foreign type named unqualified outside its import', () => {
            expectModuleCode(registering(module('axes', { types: [{ name: 'Axis', kind: 'structured', members: dataPropertyDeclarations({ length: 'Number' }) }] }), module('charts', { members: [propertyDeclaration({ result: 'Axis' })] })), 'LEXICA4049');
        });

        it('LEXICA4549: a module member its module declares twice', () => {
            const rooms = propertyDeclaration({ name: 'rooms', target: undefined });

            expectModuleCode(creating({ members: [rooms, rooms] }), 'LEXICA4549');
        });

        it('LEXICA4029: two members of one name on one receiver type of one module', () => {
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration(), propertyDeclaration()] })), 'LEXICA4029');
            expectModuleCode(registering(module('charts', withHome({ members: [propertyDeclaration({ target: 'Light' }), propertyDeclaration({ target: ['Room', 'Light'] })] }))), 'LEXICA4029');
            expect(registering(module('charts', withHome({ members: [propertyDeclaration({ target: 'Light' }), propertyDeclaration({ target: 'Device' })] })))).not.toThrow();
        });

        it('LEXICA4551: a member of a name another module declares on an overlapping receiver', () => {
            expectModuleCode(registering(module('charts', { members: [propertyDeclaration()] }), module('graphs', { members: [propertyDeclaration()] })), 'LEXICA4551');
        });

        it('LEXICA4068: two unnamed indexers for one receiver type of one module', () => {
            expectModuleCode(registering(module('charts', { members: [indexerDeclaration(), indexerDeclaration()] })), 'LEXICA4068');
            expect(expectModuleError(registering(module('charts', { members: [indexerDeclaration(), indexerDeclaration()] })))).toEqual({ message: expect.stringContaining('An unnamed indexer of String is declared already'), module: 'charts', declaration: '[]', declarationKey: 'kind' });
            expect(registering(module('charts', withHome({ members: [indexerDeclaration({ target: 'Light' }), indexerDeclaration({ target: 'Device' })] })))).not.toThrow();
        });

        it('LEXICA4550: another module\'s unnamed indexer of an overlapping receiver', () => {
            expectModuleCode(registering(module('charts', { members: [indexerDeclaration()] }), module('graphs', { members: [indexerDeclaration()] })), 'LEXICA4550');
        });
    });
});
