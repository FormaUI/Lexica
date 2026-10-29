import { describe, it, expect } from 'vitest';
import { NexoError, nexo } from '#nexo/nexo.js';
import { Versions } from '#nexo/language/Versions.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { dataPropertyDeclarations, extensionDeclaration, operatorDeclaration } from './support/declarations.mjs';
import { createImportingRegistry } from './support/pipeline.mjs';

describe('nexo', () => {
    it('runs where no browser global exists', () => {
        expect(typeof globalThis.window).toBe('undefined');
        expect(typeof globalThis.document).toBe('undefined');
        expect(typeof globalThis.Node).toBe('undefined');
    });

    it('reads a text into its definition, of the version it writes', () => {
        expect(nexo.parse('{ total = price * quantity }')).toEqual({
            version: Versions.definition,
            imports: [],
            expression: { kind: 'object', objectFields: [{ name: 'total', value: { kind: 'arithmetic', operator: '*', left: { kind: 'scriptParameter', name: 'price' }, right: { kind: 'scriptParameter', name: 'quantity' } } }] },
        });
    });

    it('writes the canonical text of a text or a definition, which gives that text again', () => {
        const text = 'let shown = rows.where(it.visible)\nreturn { count = shown.count, label = $"{shown.count} of {rows.count} shown" }';
        const formatted = nexo.format(text);

        expect(nexo.format(nexo.parse(text))).toBe(formatted);
        expect(nexo.format(formatted)).toBe(formatted);
        expect(nexo.format('{ total = price * quantity }')).toBe('{ total = price * quantity }');
    });

    it('checks a definition given directly, refusing one whose structure is wrong', () => {
        expect(nexo.validate({ version: Versions.definition, imports: [], expression: { kind: 'literal', value: 1 } })).toEqual({ version: Versions.definition, imports: [], expression: { kind: 'literal', value: 1 } });
        const refused = errorThrownBy(() => nexo.validate({ version: Versions.definition, imports: [], expression: { kind: 'nothing' } }));

        expect(refused).toBeInstanceOf(NexoError);
        expect(refused).toMatchObject({ code: 'NEXO2000', kind: 'structure', location: { pointer: '/expression' }, message: expect.stringMatching(/^A node is an object whose kind is literal, /) });
    });

    it('reads definitions of its one version, refusing one of another, version 31 among them, with a structure error naming both', () => {
        const thirtyOne = { version: 31, expression: { kind: 'context' } };

        expect(errorThrownBy(() => nexo.validate(thirtyOne))).toMatchObject({ kind: 'structure', location: { pointer: '/version' }, message: expect.stringContaining(`A definition is of version ${Versions.definition}, the one this implementation reads, and this one is of version 31`) });
        expect(errorThrownBy(() => createImportingRegistry().resolve(thirtyOne))).toMatchObject({ kind: 'structure' });
    });

    it('reads the implicit parameter as it and the object root as root, nodes of their own, and context as an ordinary name', () => {
        expect(nexo.parse('room { size = it.size, total = root.size }').expression).toEqual({ kind: 'object', context: { kind: 'scriptParameter', name: 'room' }, objectFields: [
            { name: 'size', value: { kind: 'memberAccess', receiver: { kind: 'it' }, name: 'size' } },
            { name: 'total', value: { kind: 'memberAccess', receiver: { kind: 'root' }, name: 'size' } },
        ] });
        expect(nexo.parse('context.size').expression).toEqual({ kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'context' }, name: 'size' });
        expect(nexo.format('{ let context = 1, value = context + 1 }')).toBe('{\n    let context = 1,\n    value = context + 1\n}');
        expect(createImportingRegistry().resolve('{ context = context }', { context: 2 }).createEvaluator({ context: 2 }).evaluate().value).toEqual({ context: 2 });
    });

    it('refuses a ~ that names no script parameter, since ~ alone reads nothing', () => {
        expect(errorThrownBy(() => nexo.parse('~.size'))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("no script parameter, which is named directly after '~'") });
        expect(errorThrownBy(() => nexo.parse('~ room'))).toMatchObject({ kind: 'syntax', message: "A script parameter is named directly after '~', as ~room (line 1, column 1)" });
    });

    it('reads a lexical reference before any identifier, the local or the field of its name, and writes one only where the identifier alone means something else', () => {
        expect(createImportingRegistry().resolve('let total = 2\nreturn @total + total', {}).createEvaluator({}).evaluate().value).toBe(4);
        expect(nexo.format('let total = 2\nreturn @total')).toBe('let total = 2\nreturn total');
        expect(nexo.format('let home = 2\nreturn @home')).toBe('let home = 2\nreturn home');
        expect(nexo.format('import home\nlet home = 2\nreturn @home')).toBe('import home\n\nlet home = 2\nreturn @home');
        expect(nexo.format('let home = 2\nreturn @home', { imports: ['home'] })).toBe('let home = 2\nreturn @home');
        expect(errorThrownBy(() => nexo.parse('@room'))).toMatchObject({ kind: 'structure', message: expect.stringContaining("No local, object field, conditional binding or function parameter named 'room' is in scope. Use '~room' to read the script parameter") });
        expect(errorThrownBy(() => nexo.parse('@ room'))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("An identifier follows '@' directly") });
    });

    it('reads a word as the role its position gives it where the position expects a name, a module\'s name among them, and as the language\'s own meaning where a value stands', () => {
        const registry = createImportingRegistry([nexo.createModule('home', {})]);

        expect(nexo.parse('import home\nnode.root + node.home').expression).toEqual({ kind: 'arithmetic', operator: '+', left: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'node' }, name: 'root' }, right: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'node' }, name: 'home' } });
        expect(nexo.format('import home\n{ home = 1, root = 2, b = @home + @root }')).toBe('import home\n\n{\n    home = 1,\n    root = 2,\n    b = @home + @root\n}');
        expect(nexo.parse('import home\nlet f = home => @home + 1\nreturn f(1)').expression.locals[0].value.parameters).toEqual(['home']);
    });

    it('writes a cast\'s and a conversion\'s type bare, a reserved word among them, and refuses a string in its place with the bare name', () => {
        expect(nexo.parse('value to Number').expression).toEqual({ kind: 'conversion', type: 'Number', operand: { kind: 'scriptParameter', name: 'value' } });
        expect(nexo.format('(try value to Number) ?? 0')).toBe('try value to Number ?? 0');
        expect(nexo.format('(node as Element)?.size')).toBe('(node as Element)?.size');
        expect(nexo.format('a as end')).toBe('a as end');
        expect(errorThrownBy(() => nexo.parse('value to "Number"'))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("'to' names the type it converts to bare, as a member's name is written: write 'to Number'") });
        expect(errorThrownBy(() => nexo.parse("node as 'Element'"))).toMatchObject({ kind: 'syntax', message: expect.stringContaining("write 'as Element'") });
        expect(errorThrownBy(() => nexo.validate({ version: Versions.definition, imports: [], expression: { kind: 'conversion', type: 'List<Number>', operand: { kind: 'literal', value: 1 } } }))).toMatchObject({ kind: 'structure', location: { pointer: '/expression/type' } });
    });

    it('refuses a text that is no expression with a syntax error at its place', () => {
        expect(errorThrownBy(() => nexo.parse('a +'))).toMatchObject({ kind: 'syntax', location: { line: 1 } });
        expect(errorThrownBy(() => nexo.parse(1))).toMatchObject({ kind: 'structure' });
    });

    it('carries out each declaration that runs code by its impl: a member and a conversion when evaluated, and an observation type as its host starts it', () => {
        const tick = ({ request }) => ({ stop: () => request.type });
        const module = nexo.createModule('cups', {
            types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }, extensionDeclaration('StringExtensions', 'String', [{ name: 'zoom', kind: 'property', result: 'Number', updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => receiver.length * 2 }, operatorDeclaration('convert', 'Cup', ({ value }) => ({ size: value.length }))])],
            observationTypes: [{ name: 'tick', contract: 'invalidation', impl: tick }],
        });
        const registry = createImportingRegistry([module]);
        const evaluate = text => registry.resolve(text, { word: 'oat' }).createEvaluator({ word: 'oat' }).evaluate().value;

        expect(evaluate('{ zoom = word.zoom, size = (word to Cup).size }')).toEqual({ zoom: 6, size: 3 });
        expect(registry.getImplementation(registry.getObservationType('tick'))).toBe(tick);
        expect(registry.getImplementation(registry.getObservationType('tick'))({ request: { type: 'tick' } }).stop()).toBe('tick');
    });

    it('reads a structured type\'s data properties from the data, each a used declaration that no implementation carries out and no hook is told of', () => {
        const cups = nexo.createModule('cups', {
            types: [{
                name: 'Cup',
                kind: 'structured',
                members: [
                    { name: 'size', kind: 'property', result: 'Number' },
                    { name: 'doubled', kind: 'property', result: 'Number', updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => receiver.size * 2 },
                ],
            }, extensionDeclaration('Orders', 'String', [operatorDeclaration('convert', 'Cup', ({ value }) => ({ size: value.length }))])],
        });
        const resolution = createImportingRegistry([cups]).resolve('{ size = (word to Cup).size, doubled = (word to Cup).doubled }', { word: 'oat' });
        const told = [];

        expect(resolution.usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['String to Cup', 'Cup.size', 'String to Cup', 'Cup.doubled']);
        expect(resolution.createEvaluator({ word: 'oat' }).evaluate({ beforeInvoke: request => void told.push(request.declaration.name) }).value).toEqual({ size: 3, doubled: 6 });
        expect(told).toEqual(['doubled']);
    });

    it('names a used unnamed indexer, which declares no name, by its receiver type and the brackets its access is written with', () => {
        const resolution = createImportingRegistry().resolve('items[0]', { items: [1, 2] });

        expect(resolution.usedDeclarations.map(({ name, qualifiedName, pointer }) => ({ name, qualifiedName, pointer }))).toEqual([{ name: null, qualifiedName: 'List[]', pointer: '/expression' }]);
        expect(resolution.createEvaluator({ items: [1, 2] }).evaluate().value).toBe(1);
    });

    it('creates a module from the vocabulary it declares', () => {
        const module = nexo.createModule('price', {
            types: [extensionDeclaration('StringExtensions', 'String', [{ name: 'price', kind: 'property', result: 'Number', updates: { changes: 'constant', reads: 'fresh' }, impl: () => 1 }])],
        });

        expect(module.name).toBe('price');
        expect(errorThrownBy(() => nexo.createModule('price', { members: [{ name: 'other' }] }))).toMatchObject({ kind: 'module' });
    });

    it('resolves an expression against a registry of its built-in vocabulary and the modules a host registers, each registry its own', () => {
        const prices = nexo.createModule('price', {
            types: [{ name: 'Item', kind: 'structured', members: dataPropertyDeclarations({ price: 'Number', quantity: 'Number' }) }, extensionDeclaration('StringExtensions', 'String', [{ name: 'price', kind: 'property', result: 'Number', updates: { changes: 'constant', reads: 'fresh' } }])],
        });
        const registry = createImportingRegistry([prices]);
        const items = [{ price: 2, quantity: 3 }];

        expect(registry.moduleNames).toEqual(['Nexo', 'price']);
        expect(registry.resolve('items { total = it.price * it.quantity }.count', { items })).toMatchObject({ hostCall: null, type: 'Number' });
        expect(registry.resolve('"10".price + 1')).toMatchObject({ hostCall: null, type: 'Number' });
        expect(createImportingRegistry().moduleNames).toEqual(['Nexo']);
        expect(errorThrownBy(() => createImportingRegistry().resolve('"10".price'))).toMatchObject({ kind: 'validation', location: { line: 1 } });
    });

    it('binds plain values each time it is given them and reuses the bindings its registry created, asking no module\'s typeOf of a script it refuses', () => {
        const asked = [];
        const registry = createImportingRegistry([nexo.createModule('counting', { typeOf: value => (asked.push(value.label), null) })]);
        const bindings = registry.createBindings({ word: { label: 'oat' } });

        expect(asked).toEqual(['oat']);
        registry.resolve('word.label', bindings).createEvaluator(bindings);
        expect(asked).toEqual(['oat']);
        registry.resolve('word.label', { word: { label: 'tea' } }).createEvaluator({ word: { label: 'rye' } });
        expect(asked).toEqual(['oat', 'tea', 'rye']);
        expect(errorThrownBy(() => registry.resolve('word.label +', { word: { label: 'bad' } }))).toMatchObject({ kind: 'syntax' });
        expect(asked).toEqual(['oat', 'tea', 'rye']);
    });

    it('registers a module with a registry, whose expressions resolved afterwards may use its vocabulary', () => {
        const registry = createImportingRegistry();

        registry.registerModule(nexo.createModule('double', {
            types: [extensionDeclaration('NumberExtensions', 'Number', [{ name: 'double', kind: 'property', result: 'Number', updates: { changes: 'constant', reads: 'fresh' } }])],
        }));

        expect(registry.resolve('(2).double')).toMatchObject({ hostCall: null, type: 'Number' });
    });

    it('says which build it is and which specification it follows', () => {
        expect(nexo.info).toEqual({ versions: { implementation: Versions.implementation, language: Versions.language, definition: Versions.definition } });
    });
});
