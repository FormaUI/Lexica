import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { withHome } from '../support/home.mjs';

const constant = { changes: 'constant', reads: 'fresh' };
const observable = observations => ({ changes: 'observable', reads: 'fresh', observations });

/** A property of a string, constant and fresh, with what a test changes. */
const property = (overrides = {}) => ({ name: 'zoom', kind: 'property', target: 'String', result: 'Number', updates: constant, ...overrides });

/** A function of a string taking one value parameter, positional, constant and fresh, with what a test changes. */
const func = (overrides = {}) => property({ kind: 'function', arguments: 'positional', parameters: [parameter()], ...overrides });

const parameter = (overrides = {}) => ({ name: 'amount', kind: 'value', type: 'Number', required: true, nulls: 'propagate', ...overrides });

/** A function parameter, its callback taking a string and answering a Boolean. */
const callback = (overrides = {}) => ({ name: 'test', kind: 'function', type: 'Boolean', required: true, parameters: ['String'], ...overrides });

/** A fixed parameter selecting a type through the selector `report`. */
const selecting = (overrides = {}) => parameter({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector: 'report', ...overrides });

/** A host call of a string, which declares no updates. */
const hostCall = (overrides = {}) => func({ invokedBy: 'host', updates: undefined, ...overrides });

/** The error the call throws, which is a Lexica error. */
const errorOf = call => {
    try {
        call();
    } catch (error) {
        expect(error).toBeInstanceOf(LexicaError);

        return error;
    }

    throw new Error('The call threw nothing');
};

/** Asserts that the call fails with a module error of the code. */
const expectCode = (call, code) => {
    const error = errorOf(call);

    expect({ code: error.code, kind: error.kind }).toEqual({ code, kind: 'module' });
};

const creating = contents => () => lexica.createModule('charts', contents);
const registering = (...modules) => () => lexica.createRegistry(modules);
const module = (name, contents) => lexica.createModule(name, contents);

describe('the module error codes', () => {
    describe('of creating a module', () => {
        it('LEXICA4500: a module whose name is not an identifier', () => {
            expectCode(() => lexica.createModule('chart-tools', {}), 'LEXICA4500');
        });

        it('LEXICA4501: a module whose contents are not an object', () => {
            expectCode(creating(null), 'LEXICA4501');
        });

        it('LEXICA4502: a module declaring what a module does not declare', () => {
            expectCode(creating({ member: [] }), 'LEXICA4502');
            expectCode(creating({ predicates: [] }), 'LEXICA4502');
        });

        it('LEXICA4503: a module whose declarations of one kind are not a list', () => {
            expectCode(creating({ members: {} }), 'LEXICA4503');
        });

        it('LEXICA4504: a declaration that is not an object', () => {
            expectCode(creating({ members: [null] }), 'LEXICA4504');
            expectCode(creating({ typeSelectors: [5] }), 'LEXICA4504');
            expectCode(creating({ members: [property({ updates: 5 })] }), 'LEXICA4504');
            expectCode(creating({ members: [func({ parameters: [null] })] }), 'LEXICA4504');
            expectCode(creating({ members: [property({ updates: observable([null]) })] }), 'LEXICA4504');
        });

        it('LEXICA4030: a field a declaration does not take', () => {
            expectCode(creating({ members: [property({ on: 'String' })] }), 'LEXICA4030');
            expectCode(creating({ members: [property({ syntax: 'function-call' })] }), 'LEXICA4030');
            expectCode(creating({ members: [property({ updates: { ...constant, tolerence: 1 } })] }), 'LEXICA4030');
            expectCode(creating({ members: [func({ parameters: [parameter({ fixd: true })] })] }), 'LEXICA4030');
            expectCode(creating({ types: [{ name: 'Chart', fields: { points: 'Number' }, members: [] }] }), 'LEXICA4030');
            expectCode(creating({ members: [hostCall({ updates: constant })] }), 'LEXICA4030');
            expectCode(creating({ members: [hostCall({ implementation: () => 1 })] }), 'LEXICA4030');
            expectCode(creating({ members: [func({ parameters: [callback({ fixed: false })] })] }), 'LEXICA4030');
            expectCode(creating({ members: [func({ parameters: [callback({ context: 'item' })] })] }), 'LEXICA4030');
            expectCode(creating({ members: [func({ parameters: [parameter({ parameters: ['Number'] })] })] }), 'LEXICA4030');
        });

        it('LEXICA4505: an implementation that is not a function', () => {
            expectCode(creating({ members: [property({ implementation: 5 })] }), 'LEXICA4505');
            expectCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', implementation: 'run' }] }), 'LEXICA4505');
        });
    });

    describe('of a type', () => {
        const fields = { points: 'Number' };
        const reference = (overrides = {}) => ({ name: 'Lamp', kind: 'reference', isInstance: () => true, ...overrides });

        it('LEXICA4554: a type of a kind that is none of a type\'s kinds', () => {
            expectCode(creating({ types: [{ name: 'Lamp', kind: 'object', fields }] }), 'LEXICA4554');
        });

        it('LEXICA4556: a type of a kind the declaration model brings', () => {
            expectCode(creating({ types: [{ name: 'Climate', kind: 'structured', fields }] }), 'LEXICA4556');
            expectCode(creating({ types: [{ name: 'Lamps', kind: 'extension', target: 'Light' }] }), 'LEXICA4556');
        });

        it('LEXICA4017: a reference type without isInstance', () => {
            expectCode(creating({ types: [reference({ isInstance: undefined })] }), 'LEXICA4017');
        });

        it('LEXICA4051: a typeOf or an isInstance that is not a function', () => {
            expectCode(creating({ types: [reference({ isInstance: true })] }), 'LEXICA4051');
            expectCode(creating({ typeOf: 'Lamp' }), 'LEXICA4051');
        });

        it('LEXICA4555: an abstract that is not a Boolean', () => {
            expectCode(creating({ types: [reference({ abstract: 'yes' })] }), 'LEXICA4555');
        });

        it('LEXICA4030: a field a reference type does not take, its fields among them', () => {
            expectCode(creating({ types: [reference({ fields })] }), 'LEXICA4030');
            expectCode(creating({ types: [{ name: 'Chart', fields, supertype: 'Lamp' }] }), 'LEXICA4030');
        });

        it('LEXICA4016: a supertype that is not a reference type', () => {
            expectCode(registering(module('charts', { types: [{ name: 'Chart', fields }, reference({ supertype: 'Chart' })] })), 'LEXICA4016');
            expectCode(registering(module('charts', { types: [reference({ supertype: 'String' })] })), 'LEXICA4016');
        });

        it('LEXICA4050: a type hierarchy that is a cycle', () => {
            expectCode(registering(module('charts', { types: [reference({ supertype: 'Bulb' }), reference({ name: 'Bulb', supertype: 'Lamp' })] })), 'LEXICA4050');
            expectCode(registering(module('charts', { types: [reference({ supertype: 'Lamp' })] })), 'LEXICA4050');
        });

        it('takes a type of any name, a lowercase one and one Lexica\'s own types spell among them', () => {
            for (const name of ['chart', 'Number', 'Null', 'List']) {
                expect(() => lexica.createRegistry([module('charts', { types: [{ name, fields }] })])).not.toThrow();
            }
        });

        it('LEXICA4552: a type whose name is not an identifier', () => {
            expectCode(creating({ types: [{ name: 'Chart_1', fields }] }), 'LEXICA4552');
            expectCode(creating({ types: [{ fields }] }), 'LEXICA4552');
        });


        it('LEXICA4506: a type named by a single capital letter', () => {
            expectCode(creating({ types: [{ name: 'C', fields }] }), 'LEXICA4506');
        });

        it('LEXICA4507: a type whose import is not a list of module names', () => {
            expectCode(creating({ types: [{ name: 'Chart', fields, import: 'axes' }] }), 'LEXICA4507');
            expectCode(creating({ types: [{ name: 'Chart', fields, import: ['axes-two'] }] }), 'LEXICA4507');
        });

        it('LEXICA4508: a type importing a module twice', () => {
            expectCode(creating({ types: [{ name: 'Chart', fields, import: ['axes', 'axes'] }] }), 'LEXICA4508');
        });

        it('LEXICA4509: a structured type of no field', () => {
            expectCode(creating({ types: [{ name: 'Chart' }] }), 'LEXICA4509');
        });

        it('LEXICA4510: a field of a structured type that is not a name with a type', () => {
            expectCode(creating({ types: [{ name: 'Chart', fields: { 'point-count': 'Number' } }] }), 'LEXICA4510');
            expectCode(creating({ types: [{ name: 'Chart', fields: { points: 'List<' } }] }), 'LEXICA4510');
        });
    });

    describe('of a type selector and a selectable type', () => {
        it('LEXICA4006: a type selector, an observation type or an observation target not named by an identifier', () => {
            expectCode(creating({ typeSelectors: [{ name: 'chart-report' }] }), 'LEXICA4006');
            expectCode(creating({ observationTypes: [{ name: 'chart-state', contract: 'invalidation' }] }), 'LEXICA4006');
            expectCode(creating({ observationTargets: [{ name: 'chart-home' }] }), 'LEXICA4006');
        });

        it('LEXICA4007: a type selector or an observation type named as one declared already', () => {
            expectCode(creating({ typeSelectors: [{ name: 'report' }, { name: 'report' }] }), 'LEXICA4007');
            expectCode(registering(module('charts', { typeSelectors: [{ name: 'report' }] }), module('graphs', { typeSelectors: [{ name: 'report' }] })), 'LEXICA4007');
            expectCode(registering(module('charts', { observationTypes: [{ name: 'state', contract: 'invalidation' }] }), module('graphs', { observationTypes: [{ name: 'state', contract: 'invalidation' }] })), 'LEXICA4007');
        });

        it('LEXICA4008: a selectable type without its key, selector or type', () => {
            expectCode(creating({ selectableTypes: [{ selector: 'report', type: 'Number' }] }), 'LEXICA4008');
            expectCode(creating({ selectableTypes: [{ name: 'click', type: 'Number' }] }), 'LEXICA4008');
            expectCode(creating({ selectableTypes: [{ name: 'click', selector: 'report' }] }), 'LEXICA4008');
        });

        it('LEXICA4511: a selectable type whose key is not written as a key is', () => {
            expectCode(creating({ selectableTypes: [{ name: 'chart click', selector: 'report', type: 'Number' }] }), 'LEXICA4511');
        });

        it('LEXICA4039: a selectable type of a selector no module declares', () => {
            expectCode(creating({ selectableTypes: [{ name: 'click', selector: 'chart-report', type: 'Number' }] }), 'LEXICA4039');
            expectCode(registering(module('charts', { selectableTypes: [{ name: 'click', selector: 'report', type: 'Number' }] })), 'LEXICA4039');
        });

        it('LEXICA4038: a selectable type whose key its selector maps already', () => {
            const selectable = { name: 'click', selector: 'report', type: 'Number' };

            expectCode(registering(module('charts', { typeSelectors: [{ name: 'report' }], selectableTypes: [selectable, selectable] })), 'LEXICA4038');
            expectCode(registering(module('charts', { typeSelectors: [{ name: 'report' }], selectableTypes: [selectable] }), module('graphs', { selectableTypes: [selectable] })), 'LEXICA4038');
        });

        it('LEXICA4512: a type notation that does not parse', () => {
            expectCode(creating({ selectableTypes: [{ name: 'click', selector: 'report', type: 'List<' }] }), 'LEXICA4512');
            expectCode(creating({ members: [property({ result: 'List<' })] }), 'LEXICA4512');
            expectCode(creating({ members: [func({ parameters: [parameter({ type: 'List<' })] })] }), 'LEXICA4512');
            expectCode(creating({ members: [func({ parameters: [callback({ parameters: ['List<'] })] })] }), 'LEXICA4512');
            expectCode(creating({ types: [{ name: 'Lamp', kind: 'reference', isInstance: () => true, supertype: 'List<' }] }), 'LEXICA4512');
        });
    });

    describe('of a member', () => {
        it('LEXICA4513: a member whose target is not a type, a list of types or any', () => {
            expectCode(creating({ members: [property({ target: [] })] }), 'LEXICA4513');
            expectCode(creating({ members: [property({ target: 'List<' })] }), 'LEXICA4513');
        });

        it('LEXICA4002: a member declared without a name', () => {
            expectCode(creating({ members: [property({ name: undefined })] }), 'LEXICA4002');
        });

        it('LEXICA4523: a member whose name is not an identifier', () => {
            expectCode(creating({ members: [property({ name: 'chart-size' })] }), 'LEXICA4523');
        });

        it('LEXICA4524: a member of a kind that is not a property or a function', () => {
            expectCode(creating({ members: [property({ kind: 'operation' })] }), 'LEXICA4524');
        });

        it('LEXICA4525: a function invoked by neither the evaluator nor the host', () => {
            expectCode(creating({ members: [func({ invokedBy: 'user' })] }), 'LEXICA4525');
        });

        it('LEXICA4003: a member without a field its kind requires', () => {
            expectCode(creating({ members: [property({ result: undefined })] }), 'LEXICA4003');
            expectCode(creating({ members: [property({ updates: undefined })] }), 'LEXICA4003');
            expectCode(creating({ members: [func({ arguments: undefined })] }), 'LEXICA4003');
        });

        it('LEXICA4526: a member whose parameters are not a list', () => {
            expectCode(creating({ members: [func({ parameters: {} })] }), 'LEXICA4526');
        });

        it('LEXICA4527: a member declaring a parameter twice', () => {
            expectCode(creating({ members: [func({ parameters: [parameter(), parameter()] })] }), 'LEXICA4527');
        });

        it('LEXICA4053: a host call written as an indexer', () => {
            expectCode(creating({ members: [hostCall({ syntax: 'indexer', arguments: undefined, parameters: [parameter({ type: 'String' })] })] }), 'LEXICA4053');
        });

        it('LEXICA4528: an indexer declared without a name', () => {
            expectCode(creating({ members: [func({ name: undefined, syntax: 'indexer', arguments: undefined, parameters: [parameter({ type: 'String' })] })] }), 'LEXICA4528');
        });

        it('LEXICA4056: a host call taking a parameter other than a value parameter', () => {
            expectCode(creating({ members: [hostCall({ parameters: [parameter({ kind: 'expression', context: 'item' })] })] }), 'LEXICA4056');
        });

        it('LEXICA4009: a function with more than one parameter that selects a type', () => {
            expectCode(creating({ members: [func({ result: '@selected', parameters: [selecting(), selecting({ name: 'other' })] })] }), 'LEXICA4009');
        });

        it('LEXICA4529: a function with a parameter that selects a type whose result writes no @selected', () => {
            expectCode(creating({ members: [func({ parameters: [selecting()] })] }), 'LEXICA4529');
        });

        it('LEXICA4040: a result writing @selected without a parameter that selects a type', () => {
            expectCode(creating({ members: [func({ result: '@selected' })] }), 'LEXICA4040');
        });
    });

    describe('of how a member is written', () => {
        const key = [parameter({ name: 'key', type: 'String' })];

        it('LEXICA4530: a default on a member that is not an indexer', () => {
            expectCode(creating({ members: [func({ default: true })] }), 'LEXICA4530');
            expect(errorOf(creating({ members: [func({ default: true })] })).message).toContain('which `[…]` invokes');
        });

        it('LEXICA4531: a function written as neither a function call nor an indexer', () => {
            expectCode(creating({ members: [func({ syntax: 'call' })] }), 'LEXICA4531');
        });

        it('LEXICA4020: an indexer without exactly one required value parameter as its key', () => {
            expectCode(creating({ members: [func({ syntax: 'indexer', parameters: [parameter(), parameter({ name: 'more' })] })] }), 'LEXICA4020');
        });

        it('LEXICA4022: a module member that is an indexer', () => {
            expectCode(creating({ members: [func({ syntax: 'indexer', target: undefined, parameters: key })] }), 'LEXICA4022');
        });

        it('LEXICA4532: an indexer whose arguments are not positional', () => {
            expectCode(creating({ members: [func({ syntax: 'indexer', arguments: 'options', parameters: key })] }), 'LEXICA4532');
        });

        it('LEXICA4533: an indexer declaring whether it is the default by what is not a Boolean', () => {
            expectCode(creating({ members: [func({ syntax: 'indexer', default: 'yes', parameters: key })] }), 'LEXICA4533');
        });

        it('LEXICA4534: a function without parameters declaring the form of its arguments', () => {
            expectCode(creating({ members: [func({ parameters: [] })] }), 'LEXICA4534');
        });

        it('LEXICA4535: a function whose arguments are neither positional nor options', () => {
            expectCode(creating({ members: [func({ arguments: 'named' })] }), 'LEXICA4535');
        });

        it('LEXICA4019: a required positional parameter after an optional one', () => {
            expectCode(creating({ members: [func({ parameters: [parameter({ required: false, default: 1 }), parameter({ name: 'more' })] })] }), 'LEXICA4019');
        });
    });

    describe('of a parameter', () => {
        const declaring = overrides => creating({ members: [func({ parameters: [parameter(overrides)] })] });
        const declaringCallback = overrides => creating({ members: [func({ parameters: [callback(overrides)] })] });

        it('LEXICA4536: a parameter without its name, kind, type, required or null policy, or with one it does not take', () => {
            expectCode(declaring({ kind: undefined }), 'LEXICA4536');
            expectCode(declaring({ nulls: 'drop' }), 'LEXICA4536');
            expectCode(declaring({ required: 'yes' }), 'LEXICA4536');
            expectCode(declaring({ type: undefined }), 'LEXICA4536');
        });

        it('LEXICA4054: a function parameter that is optional or has a null policy', () => {
            expectCode(declaringCallback({ nulls: 'propagate' }), 'LEXICA4054');
            expectCode(declaringCallback({ required: false }), 'LEXICA4054');
        });

        it('LEXICA4537: a function parameter not declaring its parameters as a list', () => {
            expectCode(declaringCallback({ parameters: undefined }), 'LEXICA4537');
        });

        it('LEXICA4538: a required parameter with a default', () => {
            expectCode(declaring({ default: 1 }), 'LEXICA4538');
        });

        it('LEXICA4539: an expression or a predicate parameter whose context is not item', () => {
            expectCode(declaring({ kind: 'expression' }), 'LEXICA4539');
        });

        it('LEXICA4540: a predicate parameter not of type Boolean', () => {
            expectCode(declaring({ kind: 'predicate', context: 'item' }), 'LEXICA4540');
        });

        it('LEXICA4541: a parameter declaring whether it is fixed by what is not a Boolean', () => {
            expectCode(declaring({ fixed: 'yes' }), 'LEXICA4541');
        });

        it('LEXICA4542: a parameter that is not fixed declaring what it selects', () => {
            expectCode(declaring({ selects: 'type' }), 'LEXICA4542');
        });

        it('LEXICA4543: a fixed parameter selecting what is not a type', () => {
            expectCode(declaring({ type: 'String', fixed: true, selects: 'value' }), 'LEXICA4543');
        });

        it('LEXICA4544: a fixed parameter not naming its type selector', () => {
            expectCode(declaring({ type: 'String', fixed: true, selects: 'type' }), 'LEXICA4544');
        });

        it('LEXICA4545: a fixed parameter that is not a value parameter of type String', () => {
            expectCode(creating({ members: [func({ result: '@selected', parameters: [selecting({ type: 'Number' })] })] }), 'LEXICA4545');
        });

        it('LEXICA4547: a parameter selecting through a type selector no module declares', () => {
            expectCode(registering(module('charts', { members: [func({ result: '@selected', parameters: [selecting()] })] })), 'LEXICA4547');
        });

        it('LEXICA4548: a parameter default its type does not admit', () => {
            expectCode(registering(module('charts', { members: [func({ parameters: [parameter({ required: false, default: 'many' })] })] })), 'LEXICA4548');
        });
    });

    describe('of updates and observations', () => {
        const state = { name: 'state', contract: 'invalidation' };
        const reading = { name: 'reading', contract: 'maintained' };
        const observing = (updates, overrides = {}) => creating({ observationTypes: [state], members: [property({ updates, ...overrides })] });

        it('LEXICA4023: updates without changes or reads', () => {
            expectCode(observing({ reads: 'fresh' }), 'LEXICA4023');
            expectCode(observing({ changes: 'constant' }), 'LEXICA4023');
        });

        it('LEXICA4514: updates whose changes or reads are none of their categories or modes', () => {
            expectCode(observing({ changes: 'sometimes', reads: 'fresh' }), 'LEXICA4514');
            expectCode(observing({ changes: 'constant', reads: 'lazily' }), 'LEXICA4514');
        });

        it('LEXICA4058: misses missing where partly observable, or present otherwise', () => {
            expectCode(observing({ changes: 'partly-observable', reads: 'fresh', observations: [{ type: 'state', of: 'receiver' }] }), 'LEXICA4058');
            expectCode(observing({ ...constant, misses: 'drains' }), 'LEXICA4058');
        });

        it('LEXICA4515: a tolerance that is not a number that is not negative', () => {
            expectCode(observing({ ...constant, tolerance: -1 }), 'LEXICA4515');
        });

        it('LEXICA4026: a tolerance on a result that holds no number', () => {
            expectCode(observing({ ...constant, tolerance: 1 }, { result: 'String' }), 'LEXICA4026');
            expectCode(registering(module('charts', withHome({ members: [property({ result: 'Light', updates: { ...constant, tolerance: 1 } })] }))), 'LEXICA4026');
        });

        it('LEXICA4516: observations that are not a list', () => {
            expectCode(observing({ ...constant, observations: {} }), 'LEXICA4516');
        });

        it('LEXICA4059: observations missing where observable, or present otherwise', () => {
            expectCode(observing({ changes: 'observable', reads: 'fresh' }), 'LEXICA4059');
            expectCode(observing({ ...constant, observations: [{ type: 'state', of: 'receiver' }] }), 'LEXICA4059');
        });

        it('LEXICA4060: an observation of the wrong type, target or arguments', () => {
            expectCode(observing(observable([{ type: 'chart-state', of: 'receiver' }])), 'LEXICA4060');
            expectCode(observing(observable([{ type: 'state', of: 'chart-home' }])), 'LEXICA4060');
            expectCode(observing(observable([{ type: 'state', of: 'receiver', level: { value: 1 } }])), 'LEXICA4060');
            expectCode(registering(module('charts', { members: [property({ updates: observable([{ type: 'nothing', of: 'receiver' }]) })] })), 'LEXICA4060');
        });

        it('LEXICA4055: a function parameter an observation is given', () => {
            expectCode(creating({ members: [func({ parameters: [callback()], updates: observable([{ type: 'state', of: { argument: 'test' } }]) })] }), 'LEXICA4055');
        });

        it('LEXICA4057: a module member that observes its receiver or a target found from one', () => {
            expectCode(observing(observable([{ type: 'state', of: 'receiver' }]), { target: undefined }), 'LEXICA4057');
            expectCode(registering(module('charts', {
                observationTypes: [state],
                observationTargets: [{ name: 'parent', from: 'receiver' }],
                members: [property({ target: undefined, updates: observable([{ type: 'state', of: 'parent' }]) })],
            })), 'LEXICA4057');
        });

        it('LEXICA4061: a prefix on an argument that is not a String value parameter', () => {
            expectCode(creating({ members: [func({ updates: observable([{ type: 'state', of: 'receiver', attribute: { argument: 'amount', prefix: 'aria-' } }]) })] }), 'LEXICA4061');
        });

        it('LEXICA4024: an observation of a target its observation type\'s module does not declare', () => {
            expectCode(registering(module('charts', { observationTypes: [state], members: [property({ updates: observable([{ type: 'state', of: 'home' }]) })] })), 'LEXICA4024');
        });

        it('LEXICA4025: a member reading maintained values without a maintained observation', () => {
            expectCode(registering(module('charts', { observationTypes: [state], members: [property({ updates: { ...observable([{ type: 'state', of: 'receiver' }]), reads: 'maintained' } })] })), 'LEXICA4025');
        });

        it('LEXICA4062: a member naming a maintained observation without reading maintained values', () => {
            expectCode(registering(module('charts', { observationTypes: [reading], members: [property({ updates: observable([{ type: 'reading', of: 'receiver' }]) })] })), 'LEXICA4062');
        });

        it('LEXICA4063: a maintained observation of a target of many', () => {
            expectCode(registering(module('charts', {
                observationTypes: [reading],
                observationTargets: [{ name: 'sensors', count: 'many' }],
                members: [property({ updates: { ...observable([{ type: 'reading', of: 'sensors' }]), reads: 'maintained' } })],
            })), 'LEXICA4063');
        });
    });

    describe('of an observation target and an observation type', () => {
        it('LEXICA4037: an observation target named receiver', () => {
            expectCode(creating({ observationTargets: [{ name: 'receiver' }] }), 'LEXICA4037');
        });

        it('LEXICA4517: an observation target declared twice', () => {
            expectCode(creating({ observationTargets: [{ name: 'home' }, { name: 'home' }] }), 'LEXICA4517');
        });

        it('LEXICA4518: an observation target whose from is not receiver', () => {
            expectCode(creating({ observationTargets: [{ name: 'home', from: 'parent' }] }), 'LEXICA4518');
        });

        it('LEXICA4519: an observation target whose count is not many', () => {
            expectCode(creating({ observationTargets: [{ name: 'home', count: 2 }] }), 'LEXICA4519');
        });

        it('LEXICA4520: an observation type of neither contract', () => {
            expectCode(creating({ observationTypes: [{ name: 'state', contract: 'push' }] }), 'LEXICA4520');
        });

        it('LEXICA4521: an observation type whose identity is not a list of identifiers', () => {
            expectCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', identity: 'name' }] }), 'LEXICA4521');
        });

        it('LEXICA4522: an observation type declaring whether it is shared by what is not a Boolean', () => {
            expectCode(creating({ observationTypes: [{ name: 'state', contract: 'invalidation', shared: 'yes' }] }), 'LEXICA4522');
        });
    });

    describe('of a conversion', () => {
        it('LEXICA4065: a conversion from or to a type that is not data', () => {
            expectCode(creating({ conversions: [{ from: 'String?', to: 'Number' }] }), 'LEXICA4065');
            expectCode(registering(module('charts', withHome({ types: [{ name: 'Holder', fields: { lamp: 'Light' } }], conversions: [{ from: 'String', to: 'Holder' }] }))), 'LEXICA4065');
        });

        it('LEXICA4066: a conversion from a type to itself', () => {
            expectCode(creating({ conversions: [{ from: 'String', to: 'String' }] }), 'LEXICA4066');
        });

        it('LEXICA4028: a conversion neither of whose types is its module\'s', () => {
            expectCode(registering(module('charts', { conversions: [{ from: 'String', to: 'Number' }] })), 'LEXICA4028');
        });

        it('LEXICA4069: a conversion its module declares twice', () => {
            const box = { name: 'Box', fields: { width: 'Number' } };

            expectCode(registering(module('charts', { types: [box], conversions: [{ from: 'String', to: 'Box' }, { from: 'String', to: 'Box' }] })), 'LEXICA4069');
        });
    });

    describe('of registering a module', () => {
        const chart = { name: 'Chart', fields: { points: 'Number' } };

        it('LEXICA4546: registering what createModule did not make', () => {
            expectCode(registering({ name: 'fake', members: [] }), 'LEXICA4546');
        });

        it('LEXICA4035: a module whose name, compared case-insensitively, is already registered', () => {
            expectCode(registering(module('charts', {}), module('charts', {})), 'LEXICA4035');
            expectCode(registering(module('Charts', {}), module('CHARTS', {})), 'LEXICA4035');
            expectCode(registering(module('LEXICA', {})), 'LEXICA4035');
            expect(lexica.createRegistry([module('Charts', {})]).moduleNames).toContain('Charts');
        });

        it('LEXICA4557: a module named by a reserved word, which text reaches only through an import binding', () => {
            expectCode(registering(module('if', {})), 'LEXICA4557');
        });

        it('LEXICA4033: a type of a name its module already declares', () => {
            expectCode(registering(module('charts', { types: [chart, chart] })), 'LEXICA4033');
        });

        it('LEXICA4015: a type\'s import that does not name a registered module', () => {
            expectCode(registering(module('charts', { types: [{ ...chart, import: ['axes'] }] })), 'LEXICA4015');
        });

        it('LEXICA4047: a type reference resolving to no type', () => {
            const axes = module('axes', { types: [{ name: 'Axis', fields: { length: 'Number' } }] });

            expectCode(registering(module('charts', { members: [property({ result: 'Chart' })] })), 'LEXICA4047');
            expectCode(registering(module('charts', { members: [property({ result: 'axes.Axis' })] })), 'LEXICA4047');
            expectCode(registering(axes, module('charts', { members: [property({ result: 'axes.Scale' })] })), 'LEXICA4047');
        });

        it('LEXICA4048: a type reference resolving to several types', () => {
            const axis = { name: 'Axis', fields: { length: 'Number' } };

            expectCode(registering(module('axes', { types: [axis] }), module('scales', { types: [axis] }), module('charts', { types: [{ name: 'Chart', fields: { axis: 'Axis' }, import: ['axes', 'scales'] }] })), 'LEXICA4048');
        });

        it('LEXICA4049: a foreign type named unqualified outside its import', () => {
            expectCode(registering(module('axes', { types: [{ name: 'Axis', fields: { length: 'Number' } }] }), module('charts', { members: [property({ result: 'Axis' })] })), 'LEXICA4049');
        });

        it('LEXICA4549: a module member its module declares twice', () => {
            const rooms = property({ name: 'rooms', target: undefined });

            expectCode(registering(module('charts', { members: [rooms, rooms] })), 'LEXICA4549');
        });

        it('LEXICA4029: two members of one name on one receiver type of one module', () => {
            expectCode(registering(module('charts', { members: [property(), property()] })), 'LEXICA4029');
            expectCode(registering(module('charts', withHome({ members: [property({ target: 'Light' }), property({ target: ['Room', 'Light'] })] }))), 'LEXICA4029');
            expect(registering(module('charts', withHome({ members: [property({ target: 'Light' }), property({ target: 'Device' })] })))).not.toThrow();
        });

        it('LEXICA4551: a member of a name another module declares on an overlapping receiver', () => {
            expectCode(registering(module('charts', { members: [property()] }), module('graphs', { members: [property()] })), 'LEXICA4551');
        });

        const indexer = (name, target = 'String') => func({ name, target, syntax: 'indexer', default: true, parameters: [parameter({ name: 'key', type: 'String' })] });

        it('LEXICA4068: two unnamed indexers for one receiver type of one module', () => {
            expectCode(registering(module('charts', { members: [indexer('setting'), indexer('option')] })), 'LEXICA4068');
            expect(registering(module('charts', withHome({ members: [indexer('setting', 'Light'), indexer('option', 'Device')] })))).not.toThrow();
        });

        it('LEXICA4550: another module\'s default indexer of an overlapping receiver', () => {
            expectCode(registering(module('charts', { members: [indexer('setting')] }), module('graphs', { members: [indexer('option')] })), 'LEXICA4550');
        });
    });
});
