import { describe, it, expect } from 'vitest';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { declaration, functionDeclaration, messageOf, parameter, refusalOf } from './declarations.mjs';

/** The declaration and the field a module error's location names, beside a fragment of its message. */
const refusal = (contents, declarationName, field, fragment) => {
    const refused = refusalOf(() => new LexicaModule('charts', contents));

    expect({ declaration: refused.declaration, field: refused.field }).toEqual({ declaration: declarationName, field });
    expect(refused.message).toContain(fragment);
};

describe('LexicaModule', () => {
    it('keeps its declarations as frozen data, each implementation the function its module gave', () => {
        const implementation = () => 2;
        const module = new LexicaModule('charts', { members: [declaration({ name: 'charts', implementation })] });

        expect(module.members[0]).toMatchObject({ name: 'charts', target: 'element', parameters: [], updates: { changes: 'constant', reads: 'fresh', observations: [] } });
        expect(module.members[0].implementation).toBe(implementation);
        expect(Object.isFrozen(module.members[0])).toBe(true);
        expect(Object.isFrozen(module.members[0].updates)).toBe(true);
        expect(Object.isFrozen(implementation)).toBe(false);
    });

    it('fills a member\'s defaults: a function call, its arguments positional for an indexer, and empty parameters and observations', () => {
        const module = new LexicaModule('charts', {
            members: [functionDeclaration({ name: 'level' }), functionDeclaration({ name: 'key', syntax: 'indexer', arguments: undefined, parameters: [parameter({ name: 'key', type: 'string' })] })],
        });

        expect(module.members.map(member => [member.syntax, member.arguments])).toEqual([['function-call', 'positional'], ['indexer', 'positional']]);
    });

    it('refuses a name with a hyphen, which no name holds', () => {
        refusal({ members: [declaration({ name: 'chart-size' })] }, 'chart-size', 'name', 'named as a name is');
        expect(messageOf(() => new LexicaModule('chart-tools', {}))).toContain('named as a name is');
    });

    it('names a property, a function, an indexer and a field of a structured type with any word, a keyword and a literal\'s word among them, read after a dot or a colon', () => {
        const types = [{ name: 'chart', fields: { else: 'number' } }];
        const key = [parameter({ name: 'key', type: 'string' })];

        expect(() => new LexicaModule('charts', { types, members: [declaration({ name: 'then', target: 'chart' }), functionDeclaration({ name: 'if', target: 'chart', parameters: key })] })).not.toThrow();
        expect(() => new LexicaModule('charts', { types, members: [functionDeclaration({ name: 'if', syntax: 'indexer', target: 'chart', parameters: key })] })).not.toThrow();
        expect(() => new LexicaModule('charts', { types, members: [declaration({ name: 'null', target: 'chart' })] })).not.toThrow();
    });

    it('offers no way to make a module exempt from the registry\'s rules, whatever its name', () => {
        expect(LexicaModule.createBuiltIn).toBeUndefined();
        expect('isBuiltIn' in new LexicaModule('lexica', {})).toBe(false);
        expect(Vocabulary.module).toBe(Vocabulary.module);
    });

    it('refuses what a module does not declare, telling conditions apart as predicates', () => {
        const conditions = refusalOf(() => new LexicaModule('charts', { conditions: [] }));

        expect(conditions).toMatchObject({ module: 'charts', field: 'conditions' });
        expect(conditions.message).toContain('a Boolean its verb asks by its name is a predicate');
        expect(messageOf(() => new LexicaModule('charts', { member: [] }))).toContain("A module declares types, members, predicates, eventTypes, observationTypes, observationTargets, conversions, and 'member' is none of them");
        expect(messageOf(() => new LexicaModule('charts', null))).toContain("A module's contents are an object declaring types, members, predicates");
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
            refusal({ members: [declaration({ on: 'element' })] }, 'zoom', 'on', "'on' is none of them");
            refusal({ members: [declaration({ function: 'zoom' })] }, 'zoom', 'function', "'function' is none of them");
        });

        it('are one of the five kinds', () => {
            refusal({ members: [declaration({ kind: 'operation' })] }, 'zoom', 'kind', 'A member is one of property, function, eventSource, action, behavior');
        });

        it('declare the types they apply to, or none for a module member', () => {
            expect(() => new LexicaModule('charts', { members: [declaration({ target: ['element', 'document'] }), declaration({ name: 'any', target: 'any' })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [declaration({ target: undefined })] })).not.toThrow();
            refusal({ members: [declaration({ target: [] })] }, 'zoom', 'target', 'It declares the types it applies to');
            refusal({ members: [declaration({ target: 'list<' })] }, 'zoom', 'target', 'It declares the types it applies to');
        });

        it('declare their result, an event source\'s an event<T>', () => {
            refusal({ members: [declaration({ result: 'list<' })] }, 'zoom', 'result', 'type of its result');
            refusal({ members: [declaration({ result: undefined })] }, 'zoom', 'result', 'type of its result');
        });

        it('take updates where they read a value, a property, a function and an event source, and refuse them where they do not, an action and a behavior', () => {
            refusal({ members: [declaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
            refusal({ members: [functionDeclaration({ updates: undefined })] }, 'zoom', 'updates', 'It declares its updates');
            refusal({ members: [functionDeclaration({ kind: 'action' })] }, 'zoom', 'updates', "A member of kind 'action' declares");
            refusal({ members: [functionDeclaration({ kind: 'behavior' })] }, 'zoom', 'updates', "A member of kind 'behavior' declares");
            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ kind: 'action', updates: undefined }), functionDeclaration({ name: 'pin', kind: 'behavior', updates: undefined })] })).not.toThrow();
        });

        it('are written as a function call, the default, or, a function alone, as an indexer', () => {
            refusal({ members: [functionDeclaration({ syntax: 'call' })] }, 'zoom', 'syntax', 'It is written as function-call or indexer');
            refusal({ members: [functionDeclaration({ syntax: 'infix' })] }, 'zoom', 'syntax', 'It is written as function-call or indexer');
            refusal({ members: [functionDeclaration({ kind: 'action', updates: undefined, syntax: 'indexer' })] }, 'zoom', 'syntax', 'An indexer is a function whose key is its one parameter');
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

        it('take a function parameter in a function alone', () => {
            const callback = parameter({ name: 'f', kind: 'function', parameters: [], nulls: undefined });

            expect(() => new LexicaModule('charts', { members: [functionDeclaration({ parameters: [callback] })] })).not.toThrow();
            refusal({ members: [functionDeclaration({ kind: 'action', updates: undefined, parameters: [callback] })] }, 'zoom', 'parameters', "The parameter 'f' belongs to a member of kind 'function'");
        });

        it('carry an implementation that is a function', () => {
            refusal({ members: [declaration({ implementation: 'zoom' })] }, 'zoom', 'implementation', 'Its implementation is a function');
        });
    });

    describe('event sources', () => {
        const type = parameter({ name: 'type', type: 'string', fixed: true, selects: 'eventType' });
        const source = overrides => functionDeclaration({ name: 'on', kind: 'eventSource', result: 'event<@selected>', parameters: [type], updates: { changes: 'constant', reads: 'captured' }, ...overrides });

        it('designate one fixed parameter that selects the event type, any other a value parameter that selects nothing', () => {
            expect(() => new LexicaModule('charts', { members: [source()] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [source({ arguments: 'options', parameters: [type, parameter({ name: 'once', type: 'boolean', required: false, default: false })] })] })).not.toThrow();
            refusal({ members: [source({ parameters: [parameter({ type: 'string' })] })] }, 'on', 'parameters', 'An event source designates one fixed parameter that selects its event type');
            refusal({ members: [source({ parameters: [type, { ...type, name: 'other' }] })] }, 'on', 'parameters', 'An event source designates one fixed parameter');
            refusal({ members: [functionDeclaration({ parameters: [type] })] }, 'zoom', 'parameters', 'Only an event source has a parameter that selects an event type');
        });

        it('are written as a function call, read captured and deliver events', () => {
            refusal({ members: [source({ syntax: 'indexer' })] }, 'on', 'syntax', 'An indexer is a function');
            refusal({ members: [source({ updates: { changes: 'constant', reads: 'fresh' } })] }, 'on', 'updates.reads', 'so it reads captured');
            refusal({ members: [source({ result: 'number' })] }, 'on', 'result', 'its result is an event<…>');
        });

        it('may be module members', () => {
            expect(() => new LexicaModule('charts', { members: [source({ target: undefined })] })).not.toThrow();
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
            expect(fails([{ name: 'chart-area' }])).toMatchObject({ declaration: 'chart-area', field: 'name' });
            expect(fails([{ name: 'receiver' }]).message).toContain("'receiver' names an observation's receiver");
            expect(fails([{ name: 'page' }, { name: 'page' }]).message).toContain("The observation target 'page' is declared twice");
        });

        it('say from: \'receiver\' and count: \'many\', or leave them out, and declare nothing else', () => {
            expect(fails([{ name: 'page', from: 'document' }])).toMatchObject({ declaration: 'page', field: 'from' });
            expect(fails([{ name: 'page', count: 2 }])).toMatchObject({ declaration: 'page', field: 'count' });
            expect(fails([{ name: 'page', scope: 'all' }])).toMatchObject({ declaration: 'page', field: 'scope' });
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
            expect(() => new LexicaModule('charts', { types: [{ name: 'box', fields: { width: 'number' } }], members: [declaration({ result: 'box?', updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] })).not.toThrow();

            for (const tolerance of [-1, '1', Infinity, null]) {
                refusal(updating({ changes: 'unobserved', reads: 'fresh', tolerance }), 'zoom', 'updates.tolerance', 'tolerance');
            }

            for (const result of ['string', 'boolean?', 'list<number>', 'element']) {
                refusal({ members: [declaration({ result, updates: { changes: 'unobserved', reads: 'fresh', tolerance: 1 } })] }, 'zoom', 'updates.tolerance', 'A tolerance applies to a numeric result');
            }
        });
    });

    describe('observations', () => {
        const attributes = { type: 'mutation', of: 'receiver', attributes: true };
        const observed = (observations, overrides = {}) => declaration({ name: 'charts', updates: { changes: 'observable', reads: 'fresh', observations }, ...overrides });
        const fails = contents => refusalOf(() => new LexicaModule('charts', contents));

        it('observe the receiver, an argument of the member or an observation target by its name, which the registry finds', () => {
            const parameters = [parameter({ name: 'other', type: 'element' })];

            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'resize', of: { argument: 'other' } }], { kind: 'function', arguments: 'positional', parameters })] })).not.toThrow();
            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'event', of: 'window', types: ['focus'] }, { type: 'visibility', of: 'parent' }])] })).not.toThrow();
            expect(fails({ members: [observed([{ type: 'resize', of: 'chart-area' }])] })).toMatchObject({ declaration: 'charts', field: 'updates.observations' });
            expect(fails({ members: [observed([{ type: 'resize', of: { argument: 'missing' } }])] }).message).toContain('observes the receiver, an argument of the member or an observation target by its name');
            expect(fails({ members: [observed([{ type: 'resize' }])] }).message).toContain('observes the receiver');
        });

        it('give their arguments literals, lists of literals and arguments of the member', () => {
            const parameters = [parameter({ name: 'name', type: 'string' })];

            expect(() => new LexicaModule('charts', { members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name' }, 'type'], subtree: false, depth: 2 }], { kind: 'function', arguments: 'positional', parameters })] })).not.toThrow();
            expect(fails({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: { anything: 1 } }])] }).message).toContain('no literal, list of literals or argument of the member');
            expect(fails({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'missing' }] }])] }).message).toContain('no literal, list of literals or argument of the member');
        });

        it('join a prefix, a string, to an argument of a string value parameter, and nowhere else', () => {
            const prefixed = (prefix, type = 'string', kind = 'value') => ({ members: [observed([{ type: 'mutation', of: 'receiver', attributes: [{ argument: 'name', prefix }] }], { kind: 'function', arguments: 'positional', parameters: [parameter({ name: 'name', type, kind, ...(kind === 'expression' ? { context: 'item' } : {}) })] })] });
            const message = 'which a prefix, a string, is joined to only where its parameter is a value parameter of type string';

            expect(() => new LexicaModule('charts', prefixed('aria-'))).not.toThrow();
            expect(fails(prefixed('')).message).toContain(message);
            expect(fails(prefixed(1)).message).toContain(message);
            expect(fails(prefixed('aria-', 'number')).message).toContain(message);
            expect(fails(prefixed('aria-', 'string?')).message).toContain(message);
            expect(fails(prefixed('aria-', 'string', 'expression')).message).toContain(message);
        });

        it('are never given a function parameter, which lasts only while the member\'s invocation does', () => {
            const callback = parameter({ name: 'f', kind: 'function', parameters: [], nulls: undefined });

            expect(fails({ members: [observed([{ type: 'resize', of: { argument: 'f' } }], { kind: 'function', arguments: 'positional', parameters: [callback] })] }).message).toContain("is given the parameter 'f', a function that lasts only while the member's invocation does");
        });

        it('are named for a type that is a name, in a list', () => {
            expect(fails({ members: [observed([{ type: 'Not a name', of: 'receiver' }])] }).message).toContain('names its type as a name is');
            expect(fails({ members: [observed('resize')] })).toMatchObject({ field: 'updates.observations' });
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
            refusal(declaring({ type: 'string', fixed: 'yes' }), 'zoom', 'parameters', 'declares whether it is fixed as a Boolean');
            refusal(declaring({ type: 'string', selects: 'eventType' }), 'zoom', 'parameters', 'selects nothing, since it is not fixed');
            refusal(declaring({ type: 'number', fixed: true, selects: 'eventType' }), 'zoom', 'parameters', 'is a value parameter of type string');
            refusal(declaring({ type: 'string', fixed: true, selects: 'member' }), 'zoom', 'parameters', 'declares what it selects, one of eventType, predicate');
        });

        it('refuse an expression or a predicate parameter that declares no item as its implicit parameter, saying the key that declares it', () => {
            refusal(declaring({ name: 'by', kind: 'expression', nulls: 'accept' }), 'zoom', 'parameters', "The expression parameter 'by' declares its implicit parameter as context: 'item'");
            refusal(declaring({ name: 'by', kind: 'predicate', type: 'boolean', nulls: 'accept' }), 'zoom', 'parameters', "The predicate parameter 'by' declares its implicit parameter as context: 'item'");
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

    describe('verbs, whose fixed argument selects the predicate that carries them out', () => {
        const verb = overrides => functionDeclaration({ name: 'is', target: 'any', result: 'boolean', parameters: [parameter({ name: 'name', type: 'string', fixed: true, selects: 'predicate' })], updates: { changes: 'derived', reads: 'derived' }, ...overrides });

        it('are the verbs that ask one, functions that change and read as derived, with no implementation of their own', () => {
            expect(() => new LexicaModule('charts', { members: [verb()] })).not.toThrow();
            refusal({ members: [verb({ name: 'asks' })] }, 'asks', 'parameters', 'belongs to one of the verbs that ask one, is, has, supports');
            refusal({ members: [verb({ updates: { changes: 'constant', reads: 'fresh' } })] }, 'is', 'updates', 'so it changes and reads as derived');
            refusal({ members: [verb({ implementation: () => true })] }, 'is', 'implementation', 'so it has no implementation of its own');
        });
    });

    describe('predicates', () => {
        const predicate = (overrides = {}) => ({ name: 'lit', target: 'element', updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: 'receiver', attributes: ['data-lit'] }] }, ...overrides });
        const declaring = predicates => new LexicaModule('lit', { predicates });
        const refused = (overrides, field, fragment) => {
            const refusedPredicate = refusalOf(() => declaring([predicate(overrides)]));

            expect(refusedPredicate.field).toBe(field);
            expect(refusedPredicate.message).toContain(fragment);
        };

        it('are kept as data, each a name, its target, its verb, is by default, its updates and its implementation', () => {
            const implementation = () => true;
            const [kept] = declaring([predicate({ implementation })]).predicates;

            expect(kept).toMatchObject({ name: 'lit', verb: 'is', target: 'element' });
            expect(kept.implementation).toBe(implementation);
        });

        it.each([
            ['a name that is no words joined by hyphens', { name: 'focus_within' }, 'name', 'A predicate is named by words of letters and digits joined by hyphens'],
            ['no target, a predicate always asking a receiver', { target: undefined }, 'target', 'so it declares the types it applies to'],
            ['no updates', { updates: undefined }, 'updates', 'It declares its updates'],
            ['a change it derives', { updates: { changes: 'derived', reads: 'derived' } }, 'updates', 'A predicate changes as constant, observable, partly-observable or unobserved'],
            ['a reading it captures', { updates: { changes: 'constant', reads: 'captured' } }, 'updates', 'and reads fresh or maintained'],
            ['an observation of an argument, which a predicate takes none of', { updates: { changes: 'observable', reads: 'fresh', observations: [{ type: 'mutation', of: { argument: 'name' } }] } }, 'updates.observations', 'observes the receiver'],
            ['a tolerance, its result being a Boolean', { updates: { changes: 'constant', reads: 'fresh', tolerance: 1 } }, 'updates.tolerance', 'A tolerance applies to a numeric result'],
            ['a field a member takes', { result: 'boolean' }, 'result', "'result' is none of them"],
            ['a kind', { kind: 'function' }, 'kind', "'kind' is none of them"],
            ['parameters', { parameters: [] }, 'parameters', "'parameters' is none of them"],
            ['a verb that asks no predicate', { verb: 'does' }, 'verb', 'A predicate is asked by one verb, is, has, supports'],
            ['an implementation that is no function', { implementation: 'isLit' }, 'implementation', 'Its implementation is a function'],
        ])('refuse %s', (_, overrides, field, fragment) => {
            refused(overrides, field, fragment);
        });
    });

    describe('types and event types, which run nothing', () => {
        it('refuse an implementation, which would mean nothing for them', () => {
            refusal({ types: [{ name: 'chart', fields: { size: 'number' }, implementation: () => 1 }] }, 'chart', 'implementation', "'implementation' is none of them");
            refusal({ eventTypes: [{ name: 'chartclick', data: 'number', implementation: () => 1 }] }, 'chartclick', 'implementation', "'implementation' is none of them");
        });

        it.each(['element', 'null', 'never'])('refuse a structured type named %s, a built-in name', name => {
            refusal({ types: [{ name, fields: { level: 'number' } }] }, name, 'name', 'built-in names');
        });

        it('refuse a field they do not take', () => {
            refusal({ types: [{ name: 'chart', fields: { size: 'number' }, field: {} }] }, 'chart', 'field', "'field' is none of them");
            refusal({ eventTypes: [{ name: 'chartclick', data: 'number', payload: 'number' }] }, 'chartclick', 'payload', "'payload' is none of them");
        });
    });

    describe('observation types', () => {
        const type = overrides => ({ name: 'ticks', contract: 'invalidation', ...overrides });
        const refused = (overrides, field, fragment) => refusal({ observationTypes: [type(overrides)] }, overrides.name ?? 'ticks', field, fragment);

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
    const conversion = (overrides = {}) => ({ from: 'string', to: 'chart', ...overrides });
    const declaring = conversions => new LexicaModule('charts', { types: [{ name: 'chart', fields: { points: 'number' } }], conversions });

    it('are kept as data, each from a type to another with its implementation', () => {
        const implementation = ({ value }) => ({ points: value.length });

        expect(declaring([conversion({ implementation })]).conversions[0]).toMatchObject({ from: 'string', to: 'chart', implementation });
    });

    it.each([
        ['a node', { from: 'element' }, 'from'],
        ['the window', { to: 'window' }, 'to'],
        ['a shadow view', { from: 'shadow' }, 'from'],
        ['a list', { to: 'list<number>' }, 'to'],
        ['a nullable type', { from: 'string?' }, 'from'],
        ['null', { to: 'null' }, 'to'],
    ])('convert between types of data alone, never %s', (_, overrides, field) => {
        const refused = refusalOf(() => declaring([conversion(overrides)]));

        expect(refused.field).toBe(field);
        expect(refused.message).toContain('A conversion is from a type of data to another');
    });

    it('are never declared from a type to itself, which a value already of it converts to', () => {
        expect(messageOf(() => declaring([conversion({ from: 'chart', to: 'chart' })]))).toContain('A value already of a type converts to itself');
    });

    it('take from, to and implementation alone, the implementation a function', () => {
        expect(refusalOf(() => declaring([conversion({ function: 'parse' })]))).toMatchObject({ declaration: 'string to chart', field: 'function' });
        expect(refusalOf(() => declaring([conversion({ implementation: 'parse' })]))).toMatchObject({ declaration: 'string to chart', field: 'implementation' });
    });

    it('take to as a member name, a property, a function call or an indexer, since it converts only after a value', () => {
        expect(new LexicaModule('charts', { members: [functionDeclaration({ name: 'to' })] }).members[0].syntax).toBe('function-call');
        expect(new LexicaModule('charts', { members: [declaration({ name: 'to' })] }).members[0].name).toBe('to');
        expect(new LexicaModule('charts', { members: [functionDeclaration({ name: 'to', syntax: 'indexer', arguments: undefined })] }).members[0].syntax).toBe('indexer');
    });
});
