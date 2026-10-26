import { describe, it, expect } from 'vitest';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { declaration, functionDeclaration, messageOf, parameter, refusalOf } from './declarations.mjs';

/** The declaration and the declaration key a module error's location names, beside a fragment of its message. */
const refusal = (contents, declarationName, declarationKey, fragment) => {
    const refused = refusalOf(() => new LexicaModule('charts', contents));

    expect({ declaration: refused.declaration, declarationKey: refused.declarationKey }).toEqual({ declaration: declarationName, declarationKey });
    expect(refused.message).toContain(fragment);
};

describe('LexicaModule', () => {
    it('keeps its declarations as frozen data, each implementation the function its module gave', () => {
        const implementation = () => 2;
        const module = new LexicaModule('charts', { members: [declaration({ name: 'charts', implementation })] });

        expect(module.members[0]).toMatchObject({ name: 'charts', target: 'String', parameters: [], updates: { changes: 'constant', reads: 'fresh', observations: [] } });
        expect(module.members[0].implementation).toBe(implementation);
        expect(Object.isFrozen(module.members[0])).toBe(true);
        expect(Object.isFrozen(module.members[0].updates)).toBe(true);
        expect(Object.isFrozen(implementation)).toBe(false);
    });

    it('fills a member\'s defaults: a function call, its arguments positional for an indexer, and empty parameters and observations', () => {
        const module = new LexicaModule('charts', {
            members: [functionDeclaration({ name: 'level' }), functionDeclaration({ name: 'key', syntax: 'indexer', arguments: undefined, parameters: [parameter({ name: 'key', type: 'String' })] })],
        });

        expect(module.members.map(member => [member.syntax, member.arguments])).toEqual([['function-call', 'positional'], ['indexer', 'positional']]);
    });

    it('refuses a name with a hyphen, which no name holds', () => {
        refusal({ members: [declaration({ name: 'chart-size' })] }, 'chart-size', 'name', 'named as a name is');
        expect(messageOf(() => new LexicaModule('chart-tools', {}))).toContain('named as a name is');
    });

    it('names a property, a function, an indexer and a field of a structured type with any word, a keyword and a literal\'s word among them, read after a dot or a colon', () => {
        const types = [{ name: 'Chart', fields: { else: 'Number' } }];
        const key = [parameter({ name: 'key', type: 'String' })];

        expect(() => new LexicaModule('charts', { types, members: [declaration({ name: 'then', target: 'Chart' }), functionDeclaration({ name: 'if', target: 'Chart', parameters: key })] })).not.toThrow();
        expect(() => new LexicaModule('charts', { types, members: [functionDeclaration({ name: 'if', syntax: 'indexer', target: 'Chart', parameters: key })] })).not.toThrow();
        expect(() => new LexicaModule('charts', { types, members: [declaration({ name: 'null', target: 'Chart' })] })).not.toThrow();
    });

    it('offers no way to make a module exempt from the registry\'s rules, whatever its name', () => {
        expect(LexicaModule.createBuiltIn).toBeUndefined();
        expect('isBuiltIn' in new LexicaModule('lexica', {})).toBe(false);
        expect(Vocabulary.module).toBe(Vocabulary.module);
    });

    it('refuses what a module does not declare, telling predicates apart as Boolean functions among its members', () => {
        const predicates = refusalOf(() => new LexicaModule('charts', { predicates: [] }));

        expect(predicates).toMatchObject({ module: 'charts', declarationKey: 'predicates' });
        expect(predicates.message).toContain('a test of a receiver is one of its members, a function whose result is a boolean');
        expect(messageOf(() => new LexicaModule('charts', { member: [] }))).toContain("A module declares typeOf, types, members, typeSelectors, selectableTypes, observationTypes, observationTargets, conversions, and 'member' is none of them");
        expect(messageOf(() => new LexicaModule('charts', null))).toContain("A module's contents are an object declaring typeOf, types, members, typeSelectors");
        expect(messageOf(() => new LexicaModule('charts', { members: {} }))).toContain("A module's members are a list");
        expect(messageOf(() => new LexicaModule('charts', { members: [null] }))).toContain('A member is an object declaring');
    });

    it('takes no second argument of functions, each implementation being its declaration\'s own', () => {
        const module = new LexicaModule('charts', {}, { zoom: () => 1 });

        expect('functions' in module).toBe(false);
    });

    describe('members, each kind taking the fields it needs alone', () => {
        it('refuse a field their kind does not take, naming it', () => {
            refusal({ members: [declaration({ syntax: 'function-call' })] }, 'zoom', 'syntax', "A member of kind 'property' declares");
            refusal({ members: [declaration({ arguments: 'positional' })] }, 'zoom', 'arguments', "A member of kind 'property' declares");
            refusal({ members: [declaration({ parameters: [] })] }, 'zoom', 'parameters', "A member of kind 'property' declares");
            refusal({ members: [declaration({ default: true })] }, 'zoom', 'default', "A member of kind 'property' declares");
            refusal({ members: [functionDeclaration({ tolerence: 1 })] }, 'zoom', 'tolerence', "'tolerence' is none of them");
            refusal({ members: [declaration({ on: 'Element' })] }, 'zoom', 'on', "'on' is none of them");
            refusal({ members: [declaration({ function: 'zoom' })] }, 'zoom', 'function', "'function' is none of them");
        });

        it('are a property or a function', () => {
            refusal({ members: [declaration({ kind: 'operation' })] }, 'zoom', 'kind', 'A member is one of property, function');

            for (const kind of ['eventSource', 'action', 'behavior']) {
                refusal({ members: [functionDeclaration({ kind })] }, 'zoom', 'kind', 'A member is one of property, function');
            }
        });

        it('declare the types they apply to, or none for a module member', () => {
            expect(() => new LexicaModule('charts', { members: [declaration({ target: ['Element', 'Document'] }), declaration({ name: 'any', target: 'any' })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [declaration({ target: undefined })] })).not.toThrow();
            refusal({ members: [declaration({ target: [] })] }, 'zoom', 'target', 'It declares the types it applies to');
            refusal({ members: [declaration({ target: 'List<' })] }, 'zoom', 'target', 'It declares the types it applies to');
        });

        it('declare their result', () => {
            refusal({ members: [declaration({ result: 'List<' })] }, 'zoom', 'result', 'type of its result');
            refusal({ members: [declaration({ result: undefined })] }, 'zoom', 'result', 'type of its result');
        });

        it('take updates where the evaluator reads them, a property and a function it invokes', () => {
            refusal({ members: [declaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
            refusal({ members: [functionDeclaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
        });

        it('are written as a function call, the default, or, a function alone, as an indexer', () => {
            refusal({ members: [functionDeclaration({ syntax: 'call' })] }, 'zoom', 'syntax', 'It is written as function-call or indexer');
            refusal({ members: [functionDeclaration({ syntax: 'infix' })] }, 'zoom', 'syntax', 'It is written as function-call or indexer');
            refusal({ members: [functionDeclaration({ syntax: 'indexer', parameters: [parameter({ required: false, default: 1 })] })] }, 'zoom', 'syntax', 'An indexer is a function whose key is its one parameter');
            refusal({ members: [functionDeclaration({ syntax: 'indexer', parameters: [parameter(), parameter({ name: 'more' })] })] }, 'zoom', 'syntax', 'An indexer is a function whose key is its one parameter');
            refusal({ members: [functionDeclaration({ syntax: 'indexer', arguments: 'options' })] }, 'zoom', 'arguments', "An indexer's key is its one argument, so its arguments are positional");
        });

        it('declare the form of their arguments where they have parameters, an optional one included, and refuse one where they have none', () => {
            const two = [parameter({ name: 'first' }), parameter({ name: 'second', required: false, default: 1 })];

            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ arguments: 'options', parameters: two })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ arguments: 'positional', parameters: two })] })).not.toThrow();
            refusal({ members: [functionDeclaration({ arguments: undefined, parameters: [parameter({ required: false, default: 1 })] })] }, 'zoom', 'arguments', 'It has parameters, so it declares the form of its arguments');
            refusal({ members: [functionDeclaration({ parameters: [] })] }, 'zoom', 'arguments', 'It has no parameters, so it declares no form of its arguments');
            refusal({ members: [functionDeclaration({ parameters: [...two].reverse() })] }, 'zoom', 'parameters', "The required parameter 'first' follows an optional one");
        });

        it('designate a default indexer only as an indexer, by a Boolean', () => {
            refusal({ members: [functionDeclaration({ default: true })] }, 'zoom', 'default', 'Only an indexer is the default of its receivers');
            refusal({ members: [functionDeclaration({ syntax: 'indexer', default: 'yes' })] }, 'zoom', 'default', 'as a Boolean');
        });

        it('take a function parameter in a function the evaluator invokes', () => {
            const callback = parameter({ name: 'f', kind: 'function', parameters: [], nulls: undefined });

            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ parameters: [callback] })] })).not.toThrow();
            refusal({ members: [declaration({ parameters: [callback] })] }, 'zoom', 'parameters', "A member of kind 'property' declares");
        });

        it('carry an implementation that is a function', () => {
            refusal({ members: [declaration({ implementation: 'zoom' })] }, 'zoom', 'implementation', 'Its implementation is a function');
        });
    });

    describe('host calls, functions the host invokes', () => {
        const hostCall = (overrides = {}) => functionDeclaration({ name: 'dim', invokedBy: 'host', updates: undefined, ...overrides });

        it('are kept as declared, with value parameters, a result where the host supplies values and none where it supplies none', () => {
            const module = new LexicaModule('charts', { members: [hostCall(), hostCall({ name: 'hold', result: undefined }), hostCall({ name: 'reset', target: undefined, parameters: [], arguments: undefined })] });

            expect(module.members.map(member => [member.name, member.invokedBy, member.syntax, member.result, 'updates' in member])).toEqual([['dim', 'host', 'function-call', 'Number', false], ['hold', 'host', 'function-call', undefined, false], ['reset', 'host', 'function-call', 'Number', false]]);
            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ invokedBy: 'evaluator' })] })).not.toThrow();
        });

        it('are invoked by the evaluator or by the host, a function alone saying which', () => {
            refusal({ members: [hostCall({ invokedBy: 'user' })] }, 'dim', 'invokedBy', 'A function is invoked by one of evaluator, host');
            refusal({ members: [declaration({ invokedBy: 'host' })] }, 'zoom', 'invokedBy', "A member of kind 'property' declares");
            refusal({ members: [functionDeclaration({ result: undefined })] }, 'zoom', 'result', 'It declares the type of its result');
            refusal({ members: [hostCall({ result: 'List<' })] }, 'dim', 'result', 'It declares the type of each value its host supplies, or none');
        });

        it('declare neither updates, since they are never evaluated, nor an implementation, since their host invokes them', () => {
            refusal({ members: [hostCall({ updates: { changes: 'constant', reads: 'fresh' } })] }, 'dim', 'updates', 'the evaluator never evaluates it, so it declares no updates');
            refusal({ members: [hostCall({ implementation: () => 1 })] }, 'dim', 'implementation', 'its module gives Lexica no implementation of it');
        });

        it('are written as a function call and take value parameters alone', () => {
            refusal({ members: [hostCall({ syntax: 'indexer' })] }, 'dim', 'syntax', 'A function the host invokes is written as a function call, never as an indexer');
            refusal({ members: [hostCall({ parameters: [parameter({ name: 'by', kind: 'expression', context: 'item' })] })] }, 'dim', 'parameters', "A function the host invokes takes value parameters alone, each argument prepared as a value its host keeps, and 'by' is an expression parameter");
            refusal({ members: [hostCall({ parameters: [parameter({ name: 'f', kind: 'function', parameters: [], nulls: undefined })] })] }, 'dim', 'parameters', "'f' is a function parameter");
        });
    });

    describe('module members, which have no target and so no receiver', () => {
        it('are read through the namespace, any kind among them', () => {
            const module = new LexicaModule('charts', { members: [declaration({ target: undefined }), functionDeclaration({ name: 'scale', target: undefined })] });

            expect(module.members.map(member => member.target)).toEqual([undefined, undefined]);
        });

        it('refuse what only a receiver gives: an indexer, being a default indexer, and an observation of the receiver', () => {
            refusal({ members: [functionDeclaration({ target: undefined, syntax: 'indexer' })] }, 'zoom', 'syntax', 'a member without a target has none');
            refusal({ members: [declaration({ target: undefined, updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'resize', of: 'receiver' }] } })] }, 'zoom', 'updates.observations', 'a member without a target has no receiver');

            expect(() => new LexicaModule('charts', { members: [declaration({ target: undefined, updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'visibility', of: 'document' }] } })] })).not.toThrow();
        });
    });

    describe('type selectors and their keys', () => {
        const fails = contents => refusalOf(() => new LexicaModule('charts', contents));
        const selecting = (overrides = {}) => functionDeclaration({ name: 'report', result: '@selected', parameters: [parameter({ name: 'kind', type: 'String', fixed: true, selects: 'type', selector: 'report' })], ...overrides });

        it('are kept as frozen data, a selector by its name alone and a key with the selector it belongs to and the type it maps to', () => {
            const module = new LexicaModule('charts', { typeSelectors: [{ name: 'report' }], selectableTypes: [{ name: 'motion', selector: 'report', type: 'Number' }, { name: 'door:open', selector: 'report', type: 'List<String>' }] });

            expect(module.typeSelectors).toEqual([{ name: 'report' }]);
            expect(module.selectableTypes).toEqual([{ name: 'motion', selector: 'report', type: 'Number' }, { name: 'door:open', selector: 'report', type: 'List<String>' }]);
            expect([...module.typeSelectors, ...module.selectableTypes].every(Object.isFrozen)).toBe(true);
        });

        it('name a selector once in its module, as a name is, and declare nothing else of it', () => {
            expect(fails({ typeSelectors: [{ name: 'report-kind' }] })).toMatchObject({ declaration: 'report-kind', declarationKey: 'name' });
            expect(fails({ typeSelectors: [{ name: 'report' }, { name: 'report' }] }).message).toContain("The type selector 'report' is declared twice");
            expect(fails({ typeSelectors: [{ name: 'report', implementation: () => 1 }] })).toMatchObject({ declaration: 'report', declarationKey: 'implementation' });
        });

        it('name a key as an event is named, with the selector it belongs to and the type it maps to, and declare nothing else of it', () => {
            expect(fails({ selectableTypes: [{ name: '1st', selector: 'report', type: 'Number' }] })).toMatchObject({ declaration: '1st', declarationKey: 'name' });
            expect(fails({ selectableTypes: [{ name: 'motion', type: 'Number' }] })).toMatchObject({ declaration: 'motion', declarationKey: 'selector' });
            expect(fails({ selectableTypes: [{ name: 'motion', selector: 'report', type: 'List<' }] })).toMatchObject({ declaration: 'motion', declarationKey: 'type' });
            expect(fails({ selectableTypes: [{ name: 'motion', selector: 'report', type: 'Number', implementation: () => 1 }] })).toMatchObject({ declaration: 'motion', declarationKey: 'implementation' });
        });

        it('are selected through by a function\'s one fixed parameter that names its selector, whose result writes @selected', () => {
            expect(() => new LexicaModule('charts', { members: [selecting(), selecting({ name: 'reports', result: 'List<@selected>' })] })).not.toThrow();
            expect(fails({ members: [selecting({ parameters: [parameter({ name: 'kind', type: 'String', fixed: true, selects: 'type' })] })] }).message).toContain("The fixed parameter 'kind' selects a type, so it names the type selector it selects through");
            expect(fails({ members: [selecting({ parameters: [parameter({ name: 'kind', type: 'String', fixed: true, selects: 'predicate', selector: 'report' })] })] }).message).toContain("The fixed parameter 'kind' declares what it selects, one of type; a test of the receiver is passed as a function, to a function parameter");
            expect(fails({ members: [selecting({ parameters: [parameter({ name: 'kind', type: 'String', selector: 'report' })] })] }).message).toContain("The parameter 'kind' selects nothing, since it is not fixed");
        });

        it('are selected through by one parameter at most, and a result writes @selected exactly where a parameter selects a type', () => {
            const kind = name => parameter({ name, type: 'String', fixed: true, selects: 'type', selector: 'report' });

            expect(fails({ members: [selecting({ parameters: [kind('first'), kind('second')] })] })).toMatchObject({ declaration: 'report', declarationKey: 'parameters', message: expect.stringContaining("A function has one parameter at most that selects a type, since its result writes one @selected, and 'first' and 'second' each select one") });
            expect(fails({ members: [selecting({ result: 'Number' })] })).toMatchObject({ declaration: 'report', declarationKey: 'result', message: expect.stringContaining("Its parameter 'kind' selects a type, so its result writes @selected where that type stands") });
            expect(fails({ members: [selecting({ result: 'Number' })] }).message).toMatch(/in the module 'charts', in the declaration 'report', at 'result'\)?$/);
            expect(fails({ members: [functionDeclaration({ result: '@selected' })] })).toMatchObject({ declaration: 'zoom', declarationKey: 'result', message: expect.stringContaining('Its result writes @selected, and none of its parameters selects a type') });
        });
    });

    describe('observation targets', () => {
        const fails = observationTargets => refusalOf(() => new LexicaModule('charts', { observationTargets }));

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
        const updating = updates => ({ members: [declaration({ updates })] });

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

        it('take a tolerance that is not negative, for a numeric or a structured result alone', () => {
            expect(() => new LexicaModule('charts', updating({ changes: 'unobserved', reads: 'fresh', tolerance: 0.5 }))).not.toThrow();
            expect(() => new LexicaModule('charts', { types: [{ name: 'Box', fields: { width: 'Number' } }], members: [declaration({ result: 'Box?', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] })).not.toThrow();

            for (const tolerance of [-1, '1', Infinity, null]) {
                refusal(updating({ changes: 'unobserved', reads: 'fresh', tolerance }), 'zoom', 'updates.tolerance', 'tolerance');
            }

            for (const result of ['String', 'Boolean?', 'List<Number>']) {
                refusal({ members: [declaration({ result, updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] }, 'zoom', 'updates.tolerance', 'A tolerance applies to a numeric result');
            }
        });
    });

    describe('observations', () => {
        const attributes = { type: 'mutation', of: 'receiver', attributes: true };
        const observed = (observations, overrides = {}) => declaration({ name: 'charts', updates: { changes: 'observable', reads: 'fresh', observations }, ...overrides });
        const fails = contents => refusalOf(() => new LexicaModule('charts', contents));

        it('observe the receiver, an argument of the member or an observation target by its name, which the registry finds', () => {
            const parameters = [parameter({ name: 'other', type: 'Element' })];

            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'resize', of: { argument: 'other' } }], { kind: 'function', arguments: 'positional', parameters })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'event', of: 'window', types: ['focus'] }, { type: 'visibility', of: 'parent' }])] })).not.toThrow();
            expect(fails({ members: [observed([{ type: 'resize', of: 'chart-area' }])] })).toMatchObject({ declaration: 'charts', declarationKey: 'updates.observations' });
            expect(fails({ members: [observed([{ type: 'resize', of: { argument: 'missing' } }])] }).message).toContain('observes the receiver, an argument of the member or an observation target by its name');
            expect(fails({ members: [observed([{ type: 'resize' }])] }).message).toContain('observes the receiver');
        });

        it('give their arguments literals, lists of literals and arguments of the member', () => {
            const parameters = [parameter({ name: 'name', type: 'String' })];

            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name' }, 'type'], subtree: false, depth: 2 }], { kind: 'function', arguments: 'positional', parameters })] })).not.toThrow();
            expect(fails({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: { anything: 1 } }])] }).message).toContain('no literal, list of literals or argument of the member');
            expect(fails({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'missing' }] }])] }).message).toContain('no literal, list of literals or argument of the member');
        });

        it('join a prefix, a string, to an argument of a string value parameter, and nowhere else', () => {
            const prefixed = (prefix, type = 'String', kind = 'value') => ({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name', prefix }] }], { kind: 'function', arguments: 'positional', parameters: [parameter({ name: 'name', type, kind, ...(kind === 'expression' ? { context: 'item' } : {}) })] })] });
            const message = 'which a prefix, a string, is joined to only where its parameter is a value parameter of type string';

            expect(() => new LexicaModule('charts', prefixed('aria-'))).not.toThrow();
            expect(fails(prefixed('')).message).toContain(message);
            expect(fails(prefixed(1)).message).toContain(message);
            expect(fails(prefixed('aria-', 'Number')).message).toContain(message);
            expect(fails(prefixed('aria-', 'String?')).message).toContain(message);
            expect(fails(prefixed('aria-', 'String', 'expression')).message).toContain(message);
        });

        it('are never given a function parameter, which lasts only while the member\'s invocation does', () => {
            const callback = parameter({ name: 'f', kind: 'function', parameters: [], nulls: undefined });

            expect(fails({ members: [observed([{ type: 'resize', of: { argument: 'f' } }], { kind: 'function', arguments: 'positional', parameters: [callback] })] }).message).toContain("is given the parameter 'f', a function that lasts only while the member's invocation does");
        });

        it('are named for a type that is a name, in a list', () => {
            expect(fails({ members: [observed([{ type: 'Not a name', of: 'receiver' }])] }).message).toContain('names its type as a name is');
            expect(fails({ members: [observed('resize')] })).toMatchObject({ declarationKey: 'updates.observations' });
            expect(() => new LexicaModule('charts', { members: [observed([attributes])] })).not.toThrow();
        });
    });

    describe('parameters', () => {
        const declaring = overrides => ({ members: [functionDeclaration({ parameters: [parameter(overrides)] })] });

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
            const callback = overrides => declaring({ name: 'f', kind: 'function', parameters: [], nulls: undefined, ...overrides });

            refusal(callback({ required: false }), 'zoom', 'parameters', "The parameter 'f' is a function, so it is required");
            refusal(callback({ fixed: false }), 'zoom', 'parameters', "The parameter 'f' is a function, so it cannot be fixed");
            refusal(callback({ context: 'item' }), 'zoom', 'parameters', "The parameter 'f' is a function, so it declares no 'context'");
            refusal(callback({ parameters: undefined }), 'zoom', 'parameters', "The parameter 'f' is a function that declares its parameters as a list");
            refusal(declaring({ parameters: [] }), 'zoom', 'parameters', "The parameter 'amount' is no function, so it declares no parameters");
        });
    });

    describe('Boolean functions, the tests of a receiver', () => {
        const test = (overrides = {}) => functionDeclaration({ name: 'lit', result: 'Boolean', parameters: [], arguments: undefined, updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: 'receiver', attributes: ['data-lit'] }] }, ...overrides });

        it('are members as any other, each a function whose result is a boolean, with its updates and its implementation', () => {
            const implementation = () => true;
            const [kept] = new LexicaModule('lit', { members: [test({ implementation })] }).members;

            expect(kept).toMatchObject({ name: 'lit', kind: 'function', target: 'String', result: 'Boolean', parameters: [] });
            expect(kept.implementation).toBe(implementation);
        });

        it('are named as every member is, so a name joined by a hyphen is refused, and is written as one name', () => {
            refusal({ members: [test({ name: 'focus-within' })] }, 'focus-within', 'name', 'A member is named as a name is');
            expect(() => new LexicaModule('lit', { members: [test({ name: 'focusWithin' })] })).not.toThrow();
        });
    });

    describe('function parameters on any receiver', () => {
        it('take a callback of the receiver\'s own type, a target that is a type parameter binding it', () => {
            const tested = functionDeclaration({ name: 'passes', target: 'T', result: 'Boolean', parameters: [parameter({ name: 'test', kind: 'function', type: 'Boolean', parameters: ['T'], nulls: undefined })], updates: { changes: 'derived', reads: 'derived' } });

            expect(new LexicaModule('charts', { members: [tested] }).members[0]).toMatchObject({ target: 'T', parameters: [{ kind: 'function', parameters: ['T'], type: 'Boolean' }] });
        });
    });

    describe('types, which run nothing', () => {
        it('refuse an implementation, which would mean nothing for them', () => {
            refusal({ types: [{ name: 'Chart', fields: { size: 'Number' }, implementation: () => 1 }] }, 'Chart', 'implementation', "'implementation' is none of them");
        });

        it.each(['Number', 'List', 'Null', 'Never', 'chart', 'null', 'number'])('take a structured type named %s, a casing that is a convention and a name another declaration may share', name => {
            expect(new LexicaModule('charts', { types: [{ name, fields: { level: 'Number' } }] }).types[0].name).toBe(name);
        });

        it('refuse a structured type named by one capital letter, which is read as a type parameter', () => {
            refusal({ types: [{ name: 'X', fields: { level: 'Number' } }] }, 'X', 'name', "'X', a single capital letter, is read as a type parameter");
        });

        it('take a structured type named as a node of Lexica\'s, which its module tells apart', () => {
            expect(() => new LexicaModule('charts', { types: [{ name: 'Element', fields: { level: 'Number' } }] })).not.toThrow();
        });

        it('take the modules a structured type imports, by their names, each once', () => {
            expect(new LexicaModule('charts', { types: [{ name: 'Chart', fields: { level: 'Number' }, import: ['axes'] }] }).types[0].import).toEqual(['axes']);
            refusal({ types: [{ name: 'Chart', fields: { level: 'Number' }, import: 'axes' }] }, 'Chart', 'import', 'A type imports modules by their names, as a list');
            refusal({ types: [{ name: 'Chart', fields: { level: 'Number' }, import: ['axes', 'axes'] }] }, 'Chart', 'import', "imports the module 'axes' twice");
        });

        it('refuse a field they do not take', () => {
            refusal({ types: [{ name: 'Chart', fields: { size: 'Number' }, field: {} }] }, 'Chart', 'field', "'field' is none of them");
        });
    });

    describe('observation types', () => {
        const type = overrides => ({ name: 'ticks', contract: 'invalidation', ...overrides });
        const refused = (overrides, declarationKey, fragment) => refusal({ observationTypes: [type(overrides)] }, overrides.name ?? 'ticks', declarationKey, fragment);

        it('are kept as data, with the arguments of their identity, whether they are shared, and their implementation', () => {
            const implementation = () => ({ stop() {} });
            const module = new LexicaModule('charts', { observationTypes: [type(), type({ name: 'sampled', contract: 'maintained', identity: ['root'], shared: false, implementation })] });

            expect(module.observationTypes.map(declared => [declared.name, declared.identity, declared.shared])).toEqual([['ticks', [], true], ['sampled', ['root'], false]]);
            expect(module.observationTypes[1].implementation).toBe(implementation);
            expect(Object.isFrozen(module.observationTypes[0])).toBe(true);
        });

        it('are named, have a contract, identity arguments and a sharing that is a Boolean, and refuse a field they do not take', () => {
            refused({ name: 'Not a name' }, 'name', 'observation type is named as a name is');
            refused({ contract: 'sometimes' }, 'contract', 'is one of invalidation, maintained');
            refused({ identity: 'root' }, 'identity', 'identity');
            refused({ shared: 'yes' }, 'shared', 'whether observations are shared');
            refused({ function: 'startTicks' }, 'function', "'function' is none of them");
            refused({ implementation: 'startTicks' }, 'implementation', 'Its implementation is a function');
        });
    });
});

describe('conversions', () => {
    const conversion = (overrides = {}) => ({ from: 'String', to: 'Chart', ...overrides });
    const declaring = conversions => new LexicaModule('charts', { types: [{ name: 'Chart', fields: { points: 'Number' } }], conversions });

    it('are kept as data, each from a type to another with its implementation', () => {
        const implementation = ({ value }) => ({ points: value.length });

        expect(declaring([conversion({ implementation })]).conversions[0]).toMatchObject({ from: 'String', to: 'Chart', implementation });
    });

    it.each([
        ['a list', { to: 'List<Number>' }, 'to'],
        ['a nullable type', { from: 'String?' }, 'from'],
        ['null', { to: 'null' }, 'to'],
    ])('convert between types of data alone, never %s', (_, overrides, declarationKey) => {
        const refused = refusalOf(() => declaring([conversion(overrides)]));

        expect(refused.declarationKey).toBe(declarationKey);
        expect(refused.message).toContain('A conversion is from a type of data to another');
    });

    it('are never declared from a type to itself, which a value already of it converts to', () => {
        expect(messageOf(() => declaring([conversion({ from: 'Chart', to: 'Chart' })]))).toContain('A value already of a type converts to itself');
    });

    it('take from, to and implementation alone, the implementation a function', () => {
        expect(refusalOf(() => declaring([conversion({ function: 'parse' })]))).toMatchObject({ declaration: 'String to Chart', declarationKey: 'function' });
        expect(refusalOf(() => declaring([conversion({ implementation: 'parse' })]))).toMatchObject({ declaration: 'String to Chart', declarationKey: 'implementation' });
    });

    it('take to as a member name, a property, a function call or an indexer, since it converts only after a value', () => {
        expect(new LexicaModule('charts', { members: [functionDeclaration({ name: 'to' })] }).members[0].syntax).toBe('function-call');
        expect(new LexicaModule('charts', { members: [declaration({ name: 'to' })] }).members[0].name).toBe('to');
        expect(new LexicaModule('charts', { members: [functionDeclaration({ name: 'to', syntax: 'indexer', arguments: undefined })] }).members[0].syntax).toBe('indexer');
    });
});
