import { describe, it, expect } from 'vitest';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { expectModuleError } from '../../support/errors.mjs';
import { dataPropertyDeclarations, extensionDeclaration, functionDeclaration, indexerDeclaration, parameterDeclaration, propertyDeclaration } from '../../support/declarations.mjs';

/** The declaration and the declaration key a module error's location names, beside a fragment of its message. */
const refusal = (contents, declarationName, declarationKey, fragment) => {
    const refused = expectModuleError(() => new LexicaModule('charts', contents));

    expect({ declaration: refused.declaration, declarationKey: refused.declarationKey }).toEqual({ declaration: declarationName, declarationKey });
    expect(refused.message).toContain(fragment);
};

/** A module's contents holding the members given in an extension of strings, which take a string as their receiver. */
const onStrings = members => ({ types: [extensionDeclaration('Words', 'String', members)] });

describe('LexicaModule', () => {
    it('keeps its declarations as frozen data, each implementation the function its module gave', () => {
        const implementation = () => 2;
        const module = new LexicaModule('charts', { members: [propertyDeclaration({ name: 'charts', impl: implementation })] });

        expect(module.members[0]).toMatchObject({ name: 'charts', parameters: [], updates: { changes: 'constant', reads: 'fresh', observations: [] } });
        expect(module.members[0].impl).toBe(implementation);
        expect(Object.isFrozen(module.members[0])).toBe(true);
        expect(Object.isFrozen(module.members[0].updates)).toBe(true);
        expect(Object.isFrozen(implementation)).toBe(false);
    });

    it('keeps a reference type\'s own members as frozen copies within it, each validated where it stands and located at its type', () => {
        const lamp = members => ({ name: 'Lamp', kind: 'reference', isInstance: () => true, members });
        const [type] = new LexicaModule('charts', { types: [lamp([propertyDeclaration()])] }).types;

        expect(type.members).toEqual([expect.objectContaining({ name: 'zoom', kind: 'property', result: 'Number', parameters: [] })]);
        expect(Object.isFrozen(type.members[0]) && Object.isFrozen(type.members)).toBe(true);
        expect(expectModuleError(() => new LexicaModule('charts', { types: [lamp([propertyDeclaration({ target: 'Lamp' })])] }))).toMatchObject({ module: 'charts', type: 'Lamp', declaration: 'zoom', declarationKey: 'target' });
        expect(expectModuleError(() => new LexicaModule('charts', { types: [lamp([propertyDeclaration({ result: undefined })])] }))).toMatchObject({ module: 'charts', type: 'Lamp', declaration: 'zoom', declarationKey: 'result' });
        expect(expectModuleError(() => new LexicaModule('charts', { types: [lamp({})] }))).toEqual({ message: expect.stringContaining('members are a list'), module: 'charts', declaration: 'Lamp', declarationKey: 'members' });
    });

    it('refuses the key implementation on a member, an observation type and a conversion, each carrying its code as its impl', () => {
        const implementation = () => 1;
        const refused = contents => {
            const { module, declaration, declarationKey } = expectModuleError(() => new LexicaModule('charts', contents));

            return { module, declaration, declarationKey };
        };

        expect(refused({ members: [propertyDeclaration({ implementation })] })).toEqual({ module: 'charts', declaration: 'zoom', declarationKey: 'implementation' });
        expect(refused({ observationTypes: [{ name: 'tick', contract: 'invalidation', implementation }] })).toEqual({ module: 'charts', declaration: 'tick', declarationKey: 'implementation' });
        expect(refused({ types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }], conversions: [{ from: 'String', to: 'Cup', implementation }] })).toEqual({ module: 'charts', declaration: 'String to Cup', declarationKey: 'implementation' });
        expect(expectModuleError(() => new LexicaModule('charts', { members: [propertyDeclaration({ impl: 'size' })] }))).toEqual({ message: expect.stringContaining('Its `impl` is a function'), module: 'charts', declaration: 'zoom', declarationKey: 'impl' });
    });

    it('refuses a declaration whose data reaches itself, at its declaration key, and takes data two parts share and a function that holds itself', () => {
        const selfList = [];
        const selfObject = { at: 1 };

        selfList.push(selfList);
        selfObject.self = selfObject;

        refusal({ members: [functionDeclaration({ name: 'pan', parameters: [parameterDeclaration({ name: 'by', type: 'List<Number>', required: false, default: selfList })] })] }, 'pan', 'parameters', 'reaches itself');
        refusal({ members: [functionDeclaration({ name: 'pan', parameters: [parameterDeclaration({ name: 'by', required: false, default: selfObject })] })] }, 'pan', 'parameters', 'reaches itself');
        refusal({ types: [{ name: 'Chart', kind: 'structured', members: [selfObject] }] }, 'Chart', 'members', 'reaches itself');
        // An observation's argument is validated by walking its lists, so a cycle there is refused before validation reads into it.
        refusal({
            observationTypes: [{ name: 'tick', contract: 'invalidation' }],
            members: [propertyDeclaration({ name: 'size', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'tick', of: 'receiver', every: selfList }] } })],
        }, 'size', 'updates', 'reaches itself');

        const shared = [1, 2];
        const implementation = () => 1;

        implementation.self = implementation;

        expect(() => new LexicaModule('charts', {
            members: [
                functionDeclaration({ name: 'pan', impl: implementation, parameters: [parameterDeclaration({ name: 'by', type: 'List<Number>', required: false, default: shared })] }),
                functionDeclaration({ name: 'zoom', parameters: [parameterDeclaration({ name: 'by', type: 'List<Number>', required: false, default: shared })] }),
            ],
        })).not.toThrow();
        // Two parts of one declaration share a value, which reaches itself through neither.
        expect(() => new LexicaModule('charts', {
            members: [functionDeclaration({
                name: 'pan',
                parameters: [parameterDeclaration({ name: 'by', type: 'List<Number>', required: false, default: shared }), parameterDeclaration({ name: 'to', type: 'List<Number>', required: false, default: shared })],
            })],
        })).not.toThrow();
    });

    it('refuses a declaration holding a class instance that reaches itself, as freezing walks into one', () => {
        class Anchor {
            constructor() {
                this.self = this;
            }
        }

        refusal({ members: [functionDeclaration({ name: 'pan', parameters: [parameterDeclaration({ name: 'by', required: false, default: new Anchor() })] })] }, 'pan', 'parameters', 'reaches itself');
    });

    it('freezes copies of its declarations, leaving the declarations its caller gave unfrozen through every list and object they hold', () => {
        const option = parameterDeclaration({ name: 'by', type: 'List<Number>', required: false, default: [1, 2] });
        const declared = functionDeclaration({ name: 'pan', parameters: [option] });
        const type = { name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }) };
        const module = new LexicaModule('charts', { types: [type], members: [declared] });

        expect([declared, declared.parameters, option, option.default, type, type.members, type.members[0]].map(part => Object.isFrozen(part))).toEqual([false, false, false, false, false, false, false]);
        expect([module.members[0].parameters[0].default, module.types[0].members, module.types[0].members[0]].map(part => Object.isFrozen(part))).toEqual([true, true, true]);
        expect(module.members[0].parameters[0]).not.toBe(option);
    });

    it('keeps a member as it is declared, an indexer named or unnamed, filling no key its kind does not take', () => {
        const { members } = new LexicaModule('charts', onStrings([functionDeclaration({ name: 'level' }), indexerDeclaration({ name: 'key' }), indexerDeclaration()])).types[0];

        expect(members.map(member => [member.kind, member.name, member.arguments])).toEqual([['function', 'level', 'positional'], ['indexer', 'key', undefined], ['indexer', undefined, undefined]]);
        expect(members.every(member => !('syntax' in member) && !('default' in member) && !('target' in member))).toBe(true);
    });

    it('refuses a name with a hyphen, which no name holds', () => {
        refusal({ members: [propertyDeclaration({ name: 'chart-size' })] }, 'chart-size', 'name', 'named as a name is');
        expect(expectModuleError(() => new LexicaModule('chart-tools', {})).message).toContain('named as a name is');
    });

    it('names a property, a function, an indexer and a field of a structured type with any word, a keyword and a literal\'s word among them, read after a dot or a colon', () => {
        const chart = members => ({ types: [{ name: 'Chart', kind: 'structured', members: [...dataPropertyDeclarations({ else: 'Number' }), ...members] }] });
        const key = [parameterDeclaration({ name: 'key', type: 'String' })];

        expect(() => new LexicaModule('charts', chart([propertyDeclaration({ name: 'then' }), functionDeclaration({ name: 'if', parameters: key })]))).not.toThrow();
        expect(() => new LexicaModule('charts', chart([indexerDeclaration({ name: 'if', parameters: key })]))).not.toThrow();
        expect(() => new LexicaModule('charts', chart([propertyDeclaration({ name: 'null' })]))).not.toThrow();
    });

    it('offers no way to make a module exempt from the registry\'s rules, whatever its name', () => {
        expect(LexicaModule.createBuiltIn).toBeUndefined();
        expect('isBuiltIn' in new LexicaModule('Lexica', {})).toBe(false);
        expect(Vocabulary.module).toBe(Vocabulary.module);
    });

    it('refuses what a module does not declare, naming it', () => {
        expect(expectModuleError(() => new LexicaModule('charts', { predicates: [] }))).toMatchObject({ module: 'charts', declarationKey: 'predicates', message: expect.stringMatching(/and 'predicates' is none of them \(/) });
        expect(expectModuleError(() => new LexicaModule('charts', { member: [] })).message).toContain("A module declares typeOf, types, members, typeSelectors, mappings, observationTypes, observationTargets, conversions, and 'member' is none of them");
        expect(expectModuleError(() => new LexicaModule('charts', null)).message).toContain("A module's contents are an object declaring typeOf, types, members, typeSelectors");
        expect(expectModuleError(() => new LexicaModule('charts', { members: {} })).message).toContain("A module's members are a list");
        expect(expectModuleError(() => new LexicaModule('charts', { members: [null] })).message).toContain('A member is an object declaring');
    });

    it('takes no second argument of functions, each implementation being its declaration\'s own', () => {
        const module = new LexicaModule('charts', {}, { zoom: () => 1 });

        expect('functions' in module).toBe(false);
    });

    describe('members, each kind taking the fields it needs alone', () => {
        it('refuse a field their kind does not take, naming it', () => {
            refusal({ members: [propertyDeclaration({ syntax: 'function-call' })] }, 'zoom', 'syntax', "A member of kind 'property' declares");
            refusal({ members: [propertyDeclaration({ arguments: 'positional' })] }, 'zoom', 'arguments', "A member of kind 'property' declares");
            refusal({ members: [propertyDeclaration({ parameters: [] })] }, 'zoom', 'parameters', "A member of kind 'property' declares");
            refusal({ members: [propertyDeclaration({ default: true })] }, 'zoom', 'default', "A member of kind 'property' declares");
            refusal({ members: [functionDeclaration({ syntax: 'indexer' })] }, 'zoom', 'syntax', "A member of kind 'function' declares");
            refusal({ members: [indexerDeclaration({ default: true })] }, '[]', 'default', "A member of kind 'indexer' declares");
            refusal({ members: [indexerDeclaration({ name: 'setting', arguments: 'positional' })] }, 'setting', 'arguments', "A member of kind 'indexer' declares");
            refusal({ members: [functionDeclaration({ tolerence: 1 })] }, 'zoom', 'tolerence', "'tolerence' is none of them");
            refusal({ members: [propertyDeclaration({ on: 'Element' })] }, 'zoom', 'on', "'on' is none of them");
            refusal({ members: [propertyDeclaration({ function: 'zoom' })] }, 'zoom', 'function', "'function' is none of them");
        });

        it('are a property or a function', () => {
            refusal({ members: [propertyDeclaration({ kind: 'operation' })] }, 'zoom', 'kind', 'A member is one of property, function');

            for (const kind of ['eventSource', 'action', 'behavior']) {
                refusal({ members: [functionDeclaration({ kind })] }, 'zoom', 'kind', 'A member is one of property, function');
            }
        });

        it('take no target, where a member stands giving it its receiver, or none for a module member', () => {
            refusal({ members: [propertyDeclaration({ target: 'String' })] }, 'zoom', 'target', "'target' is none of them");
            refusal(onStrings([propertyDeclaration({ target: 'String' })]), 'zoom', 'target', "'target' is none of them");
        });

        it('declare their result', () => {
            refusal({ members: [propertyDeclaration({ result: 'List<' })] }, 'zoom', 'result', 'type of its result');
            refusal({ members: [propertyDeclaration({ result: undefined })] }, 'zoom', 'result', 'type of its result');
        });

        it('take updates where the evaluator reads them, a property and a function it invokes', () => {
            refusal({ members: [propertyDeclaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
            refusal({ members: [functionDeclaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
        });

        it('are written as their kind says, an indexer given its one key, a required value parameter, an unnamed one located as its access is written', () => {
            refusal({ members: [indexerDeclaration({ name: 'setting', parameters: [parameterDeclaration({ required: false, default: 1 })] })] }, 'setting', 'parameters', 'An indexer takes its key as its one parameter');
            refusal({ members: [indexerDeclaration({ parameters: [parameterDeclaration(), parameterDeclaration({ name: 'more' })] })] }, '[]', 'parameters', 'An indexer takes its key as its one parameter');
            refusal({ members: [functionDeclaration({ kind: 'infix' })] }, 'zoom', 'kind', 'A member is one of property, function, indexer');
        });

        it('declare the form of their arguments where they have parameters, an optional one included, and refuse one where they have none', () => {
            const two = [parameterDeclaration({ name: 'first' }), parameterDeclaration({ name: 'second', required: false, default: 1 })];

            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ arguments: 'options', parameters: two })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ arguments: 'positional', parameters: two })] })).not.toThrow();
            refusal({ members: [functionDeclaration({ arguments: undefined, parameters: [parameterDeclaration({ required: false, default: 1 })] })] }, 'zoom', 'arguments', 'It has parameters, so it declares the form of its arguments');
            refusal({ members: [functionDeclaration({ parameters: [] })] }, 'zoom', 'arguments', 'It has no parameters, so it declares no form of its arguments');
            refusal({ members: [functionDeclaration({ parameters: [...two].reverse() })] }, 'zoom', 'parameters', "The required parameter 'first' follows an optional one");
        });

        it('take a function parameter in a function the evaluator invokes', () => {
            const callback = parameterDeclaration({ name: 'f', kind: 'function', parameterTypes: [], nulls: undefined });

            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ parameters: [callback] })] })).not.toThrow();
            refusal({ members: [propertyDeclaration({ parameters: [callback] })] }, 'zoom', 'parameters', "A member of kind 'property' declares");
        });

        it('carry an implementation that is a function', () => {
            refusal({ members: [propertyDeclaration({ impl: 'zoom' })] }, 'zoom', 'impl', 'Its `impl` is a function');
        });
    });

    describe('host calls, functions the host invokes', () => {
        const hostCall = (overrides = {}) => functionDeclaration({ name: 'dim', invokedBy: 'host', updates: undefined, ...overrides });

        it('are kept as declared, with value parameters, a result where the host supplies values and none where it supplies none', () => {
            const module = new LexicaModule('charts', { members: [hostCall(), hostCall({ name: 'hold', result: undefined }), hostCall({ name: 'reset', parameters: [], arguments: undefined })] });

            expect(module.members.map(member => [member.name, member.invokedBy, member.kind, member.result, 'updates' in member])).toEqual([['dim', 'host', 'function', 'Number', false], ['hold', 'host', 'function', undefined, false], ['reset', 'host', 'function', 'Number', false]]);
            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ invokedBy: 'evaluator' })] })).not.toThrow();
        });

        it('are invoked by the evaluator or by the host, a function alone saying which', () => {
            refusal({ members: [hostCall({ invokedBy: 'user' })] }, 'dim', 'invokedBy', 'A function is invoked by one of evaluator, host');
            refusal({ members: [propertyDeclaration({ invokedBy: 'host' })] }, 'zoom', 'invokedBy', "A member of kind 'property' declares");
            refusal({ members: [functionDeclaration({ result: undefined })] }, 'zoom', 'result', 'It declares the type of its result');
            refusal({ members: [hostCall({ result: 'List<' })] }, 'dim', 'result', 'It declares the type of each value its host supplies, or none');
        });

        it('declare neither updates, since they are never evaluated, nor an implementation, since their host invokes them', () => {
            refusal({ members: [hostCall({ updates: { changes: 'constant', reads: 'fresh' } })] }, 'dim', 'updates', 'the evaluator never evaluates it, so it declares no updates');
            refusal({ members: [hostCall({ impl: () => 1 })] }, 'dim', 'impl', 'its module gives Lexica no implementation of it');
        });

        it('are written as a function call and take value parameters alone', () => {
            refusal({ members: [indexerDeclaration({ name: 'dim', invokedBy: 'host', updates: undefined })] }, 'dim', 'invokedBy', 'A function the host invokes is written as a function call, never as an indexer');
            refusal({ members: [hostCall({ parameters: [parameterDeclaration({ name: 'by', kind: 'expression', context: 'item' })] })] }, 'dim', 'parameters', "A function the host invokes takes value parameters alone, each argument prepared as a value its host keeps, and 'by' is an expression parameter");
            refusal({ members: [hostCall({ parameters: [parameterDeclaration({ name: 'f', kind: 'function', parameterTypes: [], nulls: undefined })] })] }, 'dim', 'parameters', "'f' is a function parameter");
        });
    });

    describe('module members, which take no receiver', () => {
        it('are read through the namespace, any kind among them', () => {
            const module = new LexicaModule('charts', { members: [propertyDeclaration(), functionDeclaration({ name: 'scale' })] });

            expect(module.members.map(member => [member.name, member.kind])).toEqual([['zoom', 'property'], ['scale', 'function']]);
        });

        it('refuse what only a receiver gives: an indexer, being a default indexer, and an observation of the receiver', () => {
            refusal({ members: [indexerDeclaration()] }, '[]', 'kind', 'a module member takes none');
            refusal({ members: [propertyDeclaration({ updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'resize', of: 'receiver' }] } })] }, 'zoom', 'updates.observations', 'a module member takes no receiver');

            expect(() => new LexicaModule('charts', { members: [propertyDeclaration({ updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'visibility', of: 'document' }] } })] })).not.toThrow();
        });
    });

    describe('type selectors and their keys', () => {
        const fails = contents => expectModuleError(() => new LexicaModule('charts', contents));
        const selecting = (overrides = {}) => functionDeclaration({ name: 'report', result: '@selected', parameters: [parameterDeclaration({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector: 'report' })], ...overrides });

        it('are kept as frozen data, a selector by its name alone and a key with the selector it belongs to and the type it maps to', () => {
            const module = new LexicaModule('charts', { typeSelectors: [{ name: 'report' }], mappings: [{ key: 'motion', selector: 'report', type: 'Number' }, { key: 'door:open', selector: 'report', type: 'List<String>' }] });

            expect(module.typeSelectors).toEqual([{ name: 'report' }]);
            expect(module.mappings).toEqual([{ key: 'motion', selector: 'report', type: 'Number' }, { key: 'door:open', selector: 'report', type: 'List<String>' }]);
            expect([...module.typeSelectors, ...module.mappings].every(Object.isFrozen)).toBe(true);
        });

        it('name a selector once in its module, as a name is, and declare nothing else of it', () => {
            expect(fails({ typeSelectors: [{ name: 'report-kind' }] })).toMatchObject({ declaration: 'report-kind', declarationKey: 'name' });
            expect(fails({ typeSelectors: [{ name: 'report' }, { name: 'report' }] }).message).toContain("The type selector 'report' is declared twice");
            expect(fails({ typeSelectors: [{ name: 'report', impl: () => 1 }] })).toMatchObject({ declaration: 'report', declarationKey: 'impl' });
        });

        it('map a key, any string, of the selector it belongs to, to the type it maps to, and declare nothing else of it', () => {
            expect(() => new LexicaModule('charts', { mappings: [{ selector: 'report', key: '1st report', type: 'Number' }] })).not.toThrow();
            expect(fails({ mappings: [{ selector: 'report', key: null, type: 'Number' }] })).toMatchObject({ declarationKey: 'key' });
            expect(fails({ mappings: [{ key: 'motion', type: 'Number' }] })).toMatchObject({ declaration: 'motion', declarationKey: 'selector' });
            expect(fails({ mappings: [{ key: 'motion', selector: 'report', type: 'List<' }] })).toMatchObject({ declaration: 'motion', declarationKey: 'type' });
            expect(fails({ mappings: [{ key: 'motion', selector: 'report', type: 'Number', impl: () => 1 }] })).toMatchObject({ declaration: 'motion', declarationKey: 'impl' });
        });

        it('are selected through by a function\'s one fixed parameter that names its selector, whose result writes @selected', () => {
            expect(() => new LexicaModule('charts', { members: [selecting(), selecting({ name: 'reports', result: 'List<@selected>' })] })).not.toThrow();
            expect(fails({ members: [selecting({ parameters: [parameterDeclaration({ name: 'kind', type: 'String', fixed: true, selects: 'type' })] })] }).message).toContain("The fixed parameter 'kind' selects a type, so it names the type selector it selects through");
            expect(fails({ members: [selecting({ parameters: [parameterDeclaration({ name: 'kind', type: 'String', fixed: true, selects: 'predicate', selector: 'report' })] })] }).message).toContain("The fixed parameter 'kind' declares what it selects, one of type; a test of the receiver is passed as a function, to a function parameter");
            expect(fails({ members: [selecting({ parameters: [parameterDeclaration({ name: 'kind', type: 'String', selector: 'report' })] })] }).message).toContain("The parameter 'kind' selects nothing, since it is not fixed");
        });

        it('are selected through by one parameter at most, and a result writes @selected exactly where a parameter selects a type', () => {
            const kind = name => parameterDeclaration({ name, type: 'String', fixed: true, selects: 'type', selector: 'report' });

            expect(fails({ members: [selecting({ parameters: [kind('first'), kind('second')] })] })).toMatchObject({ declaration: 'report', declarationKey: 'parameters', message: expect.stringContaining("A function has one parameter at most that selects a type, since its result writes one @selected, and 'first' and 'second' each select one") });
            expect(fails({ members: [selecting({ result: 'Number' })] })).toMatchObject({ declaration: 'report', declarationKey: 'result', message: expect.stringContaining("Its parameter 'kind' selects a type, so its result writes @selected where that type stands") });
            expect(fails({ members: [selecting({ result: 'Number' })] }).message).toMatch(/in the module 'charts', in the declaration 'report', at 'result'\)?$/);
            expect(fails({ members: [functionDeclaration({ result: '@selected' })] })).toMatchObject({ declaration: 'zoom', declarationKey: 'result', message: expect.stringContaining('Its result writes @selected, and none of its parameters selects a type') });
        });
    });

    describe('observation targets', () => {
        const fails = observationTargets => expectModuleError(() => new LexicaModule('charts', { observationTargets }));

        it('are kept as frozen data, each found from the receiver or independent of it, one target or several', () => {
            const declared = [{ name: 'page' }, { name: 'frame', from: 'receiver' }, { name: 'frames', from: 'receiver', count: 'many' }];
            const module = new LexicaModule('charts', { observationTargets: declared });

            expect(module.observationTargets).toEqual(declared);
            expect(module.observationTargets[0]).not.toBe(declared[0]);
            expect(module.observationTargets.every(Object.isFrozen)).toBe(true);
        });

        it('are each named once, as a name is, and never receiver, which names an observation\'s receiver', () => {
            expect(fails([{ name: 'chart-area' }])).toMatchObject({ declaration: 'chart-area', declarationKey: 'name' });
            expect(fails([{ name: 'receiver' }]).message).toContain("'receiver' names an observation's receiver");
            expect(fails([{ name: 'page' }, { name: 'page' }]).message).toContain("The observation target 'page' is declared twice");
        });

        it('say from: \'receiver\' and count: \'many\', or leave them out, and declare nothing else', () => {
            expect(fails([{ name: 'page', from: 'Document' }])).toMatchObject({ declaration: 'page', declarationKey: 'from' });
            expect(fails([{ name: 'page', count: 2 }])).toMatchObject({ declaration: 'page', declarationKey: 'count' });
            expect(fails([{ name: 'page', scope: 'all' }])).toMatchObject({ declaration: 'page', declarationKey: 'scope' });
            expect(fails([null]).message).toContain('An observation target is an object declaring name, from, count');
        });
    });

    describe('updates', () => {
        const updating = updates => onStrings([propertyDeclaration({ updates })]);

        it('declare how a member changes and reads', () => {
            refusal(updating({ reads: 'fresh' }), 'zoom', 'updates.changes', 'It declares how it changes');
            refusal(updating({ changes: 'constant' }), 'zoom', 'updates.reads', 'how it reads');
            refusal(updating({ changes: 'constant', reads: 'fresh', staleness: 1 }), 'zoom', 'updates.staleness', "'staleness' is none of them");
        });

        it('state the changes a partly observable member misses, and no other\'s', () => {
            refusal(updating({ changes: 'partly-observable', reads: 'fresh', observations: [{ type: 'resize', of: 'receiver' }] }), 'zoom', 'updates.misses', 'states the changes it misses');
            refusal(updating({ changes: 'constant', reads: 'fresh', misses: 'transforms' }), 'zoom', 'updates.misses', 'so it misses no changes');
        });

        it('name observations where a member changes observably or partly observably, and none otherwise', () => {
            const attributes = { type: 'mutation', of: 'receiver', attributes: true };

            expect(() => new LexicaModule('charts', updating({ changes: 'observable', reads: 'fresh', observations: [attributes] }))).not.toThrow();
            refusal(updating({ changes: 'observable', reads: 'fresh' }), 'zoom', 'updates.observations', 'names the observations that cover its changes');
            refusal(updating({ changes: 'derived', reads: 'derived', observations: [attributes] }), 'zoom', 'updates.observations', 'names no observations');
        });

        it('take a tolerance that is not negative, leaving whether its result holds a number to registration, which knows every type', () => {
            expect(() => new LexicaModule('charts', updating({ changes: 'unobserved', reads: 'fresh', tolerance: 0.5 }))).not.toThrow();
            expect(() => new LexicaModule('charts', { types: [{ name: 'Box', kind: 'structured', members: dataPropertyDeclarations({ width: 'Number' }) }], members: [propertyDeclaration({ result: 'Box?', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] })).not.toThrow();

            for (const tolerance of [-1, '1', Infinity, null]) {
                refusal(updating({ changes: 'unobserved', reads: 'fresh', tolerance }), 'zoom', 'updates.tolerance', 'tolerance');
            }

            expect(() => new LexicaModule('charts', { members: [propertyDeclaration({ result: 'String', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] })).not.toThrow();
        });
    });

    describe('observations', () => {
        const attributes = { type: 'mutation', of: 'receiver', attributes: true };
        const observed = (observations, overrides = {}) => propertyDeclaration({ name: 'charts', updates: { changes: 'observable', reads: 'fresh', observations }, ...overrides });
        const fails = contents => expectModuleError(() => new LexicaModule('charts', contents));

        it('observe the receiver, an argument of the member or an observation target by its name, which the registry finds', () => {
            const parameters = [parameterDeclaration({ name: 'other', type: 'Element' })];

            expect(() => new LexicaModule('charts', onStrings([observed([{ type: 'resize', of: { argument: 'other' } }], { kind: 'function', arguments: 'positional', parameters })]))).not.toThrow();
            expect(() => new LexicaModule('charts', onStrings([observed([{ type: 'event', of: 'window', types: ['focus'] }, { type: 'visibility', of: 'parent' }])]))).not.toThrow();
            expect(fails(onStrings([observed([{ type: 'resize', of: 'chart-area' }])]))).toMatchObject({ declaration: 'charts', declarationKey: 'updates.observations' });
            expect(fails(onStrings([observed([{ type: 'resize', of: { argument: 'missing' } }])])).message).toContain('observes the receiver, an argument of the member or an observation target by its name');
            expect(fails(onStrings([observed([{ type: 'resize' }])])).message).toContain('observes the receiver');
        });

        it('give their arguments literals, lists of literals and arguments of the member', () => {
            const parameters = [parameterDeclaration({ name: 'name', type: 'String' })];

            expect(() => new LexicaModule('charts', onStrings([observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name' }, 'type'], subtree: false, depth: 2 }], { kind: 'function', arguments: 'positional', parameters })]))).not.toThrow();
            expect(fails(onStrings([observed([{ type: 'mutation', of: 'receiver', attributes: { anything: 1 } }])])).message).toContain('no literal, list of literals or argument of the member');
            expect(fails(onStrings([observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'missing' }] }])])).message).toContain('no literal, list of literals or argument of the member');
        });

        it('join a prefix, a string, to an argument of a string value parameter, and nowhere else', () => {
            const prefixed = (prefix, type = 'String', kind = 'value') => onStrings([observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name', prefix }] }], { kind: 'function', arguments: 'positional', parameters: [parameterDeclaration({ name: 'name', type, kind, ...(kind === 'expression' ? { context: 'item' } : {}) })] })]);
            const message = 'which a prefix, a string, is joined to only where its parameter is a value parameter of type string';

            expect(() => new LexicaModule('charts', prefixed('aria-'))).not.toThrow();
            expect(fails(prefixed('')).message).toContain(message);
            expect(fails(prefixed(1)).message).toContain(message);
            expect(fails(prefixed('aria-', 'Number')).message).toContain(message);
            expect(fails(prefixed('aria-', 'String?')).message).toContain(message);
            expect(fails(prefixed('aria-', 'String', 'expression')).message).toContain(message);
        });

        it('are never given a function parameter, which lasts only while the member\'s invocation does', () => {
            const callback = parameterDeclaration({ name: 'f', kind: 'function', parameterTypes: [], nulls: undefined });

            expect(fails(onStrings([observed([{ type: 'resize', of: { argument: 'f' } }], { kind: 'function', arguments: 'positional', parameters: [callback] })])).message).toContain("is given the parameter 'f', a function that lasts only while the member's invocation does");
        });

        it('are named for a type that is a name, in a list', () => {
            expect(fails(onStrings([observed([{ type: 'Not a name', of: 'receiver' }])])).message).toContain('names its type as a name is');
            expect(fails(onStrings([observed('resize')]))).toMatchObject({ declarationKey: 'updates.observations' });
            expect(() => new LexicaModule('charts', onStrings([observed([attributes])]))).not.toThrow();
        });
    });

    describe('parameters', () => {
        const declaring = overrides => ({ members: [functionDeclaration({ parameters: [parameterDeclaration(overrides)] })] });

        it('refuse a field a parameter does not take, naming it', () => {
            refusal(declaring({ defualt: 1 }), 'zoom', 'parameters.defualt', "'defualt' is none of them");
        });

        it('refuse a default on a required parameter, and a fixed parameter that selects nothing', () => {
            refusal(declaring({ default: 1 }), 'zoom', 'parameters', 'declares no default');
            refusal(declaring({ fixed: true }), 'zoom', 'parameters', 'what it selects');
        });

        it('leave out a field that holds undefined, a required parameter\'s default among them', () => {
            const module = new LexicaModule('charts', declaring({ default: undefined, selects: undefined }));

            expect(Object.keys(module.members[0].parameters[0])).not.toContain('default');
        });

        it('refuse a fixed parameter that is no Boolean, one that selects without being fixed, and one that is no value parameter of type string', () => {
            refusal(declaring({ type: 'String', fixed: 'yes' }), 'zoom', 'parameters', 'declares whether it is fixed as a Boolean');
            refusal(declaring({ type: 'String', selects: 'type', selector: 'report' }), 'zoom', 'parameters', 'selects nothing, since it is not fixed');
            refusal(declaring({ type: 'Number', fixed: true, selects: 'type', selector: 'report' }), 'zoom', 'parameters', 'is a value parameter of type string');
            refusal(declaring({ type: 'String', fixed: true, selects: 'member' }), 'zoom', 'parameters', 'declares what it selects, one of type');
            refusal(declaring({ type: 'String', fixed: true, selects: 'eventType' }), 'zoom', 'parameters', 'declares what it selects, one of type');
        });

        it('refuse an expression or a predicate parameter that declares no item as its implicit parameter, saying the key that declares it', () => {
            refusal(declaring({ name: 'by', kind: 'expression', nulls: 'accept' }), 'zoom', 'parameters', "The expression parameter 'by' declares its implicit parameter as context: 'item'");
            refusal(declaring({ name: 'by', kind: 'predicate', type: 'Boolean', nulls: 'accept' }), 'zoom', 'parameters', "The predicate parameter 'by' declares its implicit parameter as context: 'item'");
        });

        it('refuse a function parameter that is optional, fixed, given a context, or declares no list of the types it is called with', () => {
            const callback = overrides => declaring({ name: 'f', kind: 'function', parameterTypes: [], nulls: undefined, ...overrides });

            refusal(callback({ required: false }), 'zoom', 'parameters', "The parameter 'f' is a function, so it is required");
            refusal(callback({ fixed: false }), 'zoom', 'parameters', "The parameter 'f' is a function, so it cannot be fixed");
            refusal(callback({ context: 'item' }), 'zoom', 'parameters', "The parameter 'f' is a function, so it declares no 'context'");
            refusal(callback({ parameterTypes: undefined }), 'zoom', 'parameters', "The parameter 'f' is a function that declares its parameterTypes, a list");
            refusal(declaring({ parameterTypes: [] }), 'zoom', 'parameters', "The parameter 'amount' is no function, so it declares no parameterTypes");
            refusal(callback({ parameters: ['String'] }), 'zoom', 'parameters.parameters', "A parameter declares");
        });
    });

    describe('Boolean functions, the tests of a receiver', () => {
        const test = (overrides = {}) => functionDeclaration({ name: 'lit', result: 'Boolean', parameters: [], arguments: undefined, updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: 'receiver', attributes: ['data-lit'] }] }, ...overrides });

        it('are members as any other, each a function whose result is a boolean, with its updates and its implementation', () => {
            const implementation = () => true;
            const [kept] = new LexicaModule('lit', onStrings([test({ impl: implementation })])).types[0].members;

            expect(kept).toMatchObject({ name: 'lit', kind: 'function', result: 'Boolean', parameters: [] });
            expect(kept.impl).toBe(implementation);
        });

        it('are named as every member is, so a name joined by a hyphen is refused, and is written as one name', () => {
            refusal(onStrings([test({ name: 'focus-within' })]), 'focus-within', 'name', 'A member is named as a name is');
            expect(() => new LexicaModule('lit', onStrings([test({ name: 'focusWithin' })]))).not.toThrow();
        });
    });

    describe('function parameters on any receiver', () => {
        it('take a callback of the receiver\'s own type, an extension\'s target that is a type parameter binding it', () => {
            const tested = functionDeclaration({ name: 'passes', result: 'Boolean', parameters: [parameterDeclaration({ name: 'test', kind: 'function', type: 'Boolean', parameterTypes: ['T'], nulls: undefined })], updates: { changes: 'derived', reads: 'derived' } });

            expect(new LexicaModule('charts', { types: [extensionDeclaration('Values<T>', 'T', [tested])] }).types[0].members[0]).toMatchObject({ parameters: [{ kind: 'function', parameterTypes: ['T'], type: 'Boolean' }] });
        });
    });

    describe('types, which run nothing', () => {
        it('refuse an implementation, which would mean nothing for them', () => {
            refusal({ types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }), impl: () => 1 }] }, 'Chart', 'impl', "'impl' is none of them");
        });

        it.each(['Number', 'List', 'Null', 'Never', 'chart', 'null', 'number'])('take a structured type named %s, a casing that is a convention and a name another declaration may share', name => {
            expect(new LexicaModule('charts', { types: [{ name, kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }) }] }).types[0].name).toBe(name);
        });

        it('take a structured type named by one capital letter, a name a declaration reads as a type parameter only where it declares one', () => {
            expect(new LexicaModule('charts', { types: [{ name: 'X', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }) }] }).types[0].name).toBe('X');
        });

        it('take a structured type named as a node of Lexica\'s, which its module tells apart', () => {
            expect(() => new LexicaModule('charts', { types: [{ name: 'Element', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }) }] })).not.toThrow();
        });

        it('take the modules a structured type imports, by their names, each once', () => {
            expect(new LexicaModule('charts', { types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }), import: ['axes'] }] }).types[0].import).toEqual(['axes']);
            refusal({ types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }), import: 'axes' }] }, 'Chart', 'import', 'A type imports modules by their names, as a list');
            refusal({ types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ level: 'Number' }), import: ['axes', 'axes'] }] }, 'Chart', 'import', "imports the module 'axes' twice");
        });

        it('refuse a field they do not take', () => {
            refusal({ types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }), field: {} }] }, 'Chart', 'field', "'field' is none of them");
        });
    });

    describe('observation types', () => {
        const type = overrides => ({ name: 'ticks', contract: 'invalidation', ...overrides });
        const refused = (overrides, declarationKey, fragment) => refusal({ observationTypes: [type(overrides)] }, overrides.name ?? 'ticks', declarationKey, fragment);

        it('are kept as data, with the arguments of their identity, whether they are shared, and their implementation', () => {
            const implementation = () => ({ stop() {} });
            const module = new LexicaModule('charts', { observationTypes: [type(), type({ name: 'sampled', contract: 'maintained', identity: ['root'], shared: false, impl: implementation })] });

            expect(module.observationTypes.map(declared => [declared.name, declared.identity, declared.shared])).toEqual([['ticks', [], true], ['sampled', ['root'], false]]);
            expect(module.observationTypes[1].impl).toBe(implementation);
            expect(Object.isFrozen(module.observationTypes[0])).toBe(true);
        });

        it('are named, have a contract, identity arguments and a sharing that is a Boolean, and refuse a field they do not take', () => {
            refused({ name: 'Not a name' }, 'name', 'observation type is named as a name is');
            refused({ contract: 'sometimes' }, 'contract', 'is one of invalidation, maintained');
            refused({ identity: 'root' }, 'identity', 'identity');
            refused({ shared: 'yes' }, 'shared', 'whether observations are shared');
            refused({ function: 'startTicks' }, 'function', "'function' is none of them");
            refused({ impl: 'startTicks' }, 'impl', 'Its `impl` is a function');
        });
    });
});

describe('conversions', () => {
    const conversion = (overrides = {}) => ({ from: 'String', to: 'Chart', ...overrides });
    const declaring = conversions => new LexicaModule('charts', { types: [{ name: 'Chart', kind: 'structured', members: dataPropertyDeclarations({ points: 'Number' }) }], conversions });

    it('are kept as data, each from a type to another with its implementation', () => {
        const implementation = ({ value }) => ({ points: value.length });

        expect(declaring([conversion({ impl: implementation })]).conversions[0]).toMatchObject({ from: 'String', to: 'Chart', impl: implementation });
    });

    it.each([
        ['a list', { to: 'List<Number>' }, 'to'],
        ['a nullable type', { from: 'String?' }, 'from'],
        ['null', { to: 'null' }, 'to'],
    ])('convert between types of data alone, never %s', (_, overrides, declarationKey) => {
        const refused = expectModuleError(() => declaring([conversion(overrides)]));

        expect(refused.declarationKey).toBe(declarationKey);
        expect(refused.message).toContain('A conversion is from a type of data to another');
    });

    it('are never declared from a type to itself, which a value already of it converts to', () => {
        expect(expectModuleError(() => declaring([conversion({ from: 'Chart', to: 'Chart' })])).message).toContain('A value already of a type converts to itself');
    });

    it('take from, to and implementation alone, the implementation a function', () => {
        expect(expectModuleError(() => declaring([conversion({ function: 'parse' })]))).toMatchObject({ declaration: 'String to Chart', declarationKey: 'function' });
        expect(expectModuleError(() => declaring([conversion({ impl: 'parse' })]))).toMatchObject({ declaration: 'String to Chart', declarationKey: 'impl' });
    });

    it('take to as a member name, a property, a function call or an indexer, since it converts only after a value', () => {
        expect(new LexicaModule('charts', { members: [functionDeclaration({ name: 'to' })] }).members[0].kind).toBe('function');
        expect(new LexicaModule('charts', { members: [propertyDeclaration({ name: 'to' })] }).members[0].name).toBe('to');
        expect(new LexicaModule('charts', onStrings([indexerDeclaration({ name: 'to' })])).types[0].members[0].kind).toBe('indexer');
    });
});
