import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';

/** The error a call throws. */
const getError = call => {
    try {
        call();
    } catch (error) {
        return error;
    }

    throw new Error('The call threw nothing');
};

const { property, valueParameter } = lexica.declarations;
const constant = { changes: 'constant', reads: 'fresh' };

/**
 * A shop's module on words: whether it is open and a greeting, its module members; a word's size, padded, whether it is vegan, and its partner, which a word of `p` lacks; a test of a word's fit beside one of a number's;
 * and an order its host invokes. Every implementation records what it was given, so a test sees which ran.
 */
const createShop = (invoked = []) => lexica.createModule('shop', {
    members: [
        property('open', null, 'Boolean', { updates: { changes: 'unobserved', reads: 'fresh' }, implementation: input => (invoked.push(['open', input]), true) }),
        lexica.declarations.function('greet', null, 'String', { updates: constant, parameters: [valueParameter('name', 'String')], implementation: ({ args }) => (invoked.push(['greet', args.name]), `hi ${args.name}`) }),
        property('size', 'String', 'Number', { updates: constant, implementation: ({ receiver }) => (invoked.push(['size', receiver]), receiver.length) }),
        lexica.declarations.function('pad', 'String', 'String', { updates: constant, parameters: [valueParameter('width', 'Number')], implementation: ({ receiver, args }) => (invoked.push(['pad', receiver]), receiver.padEnd(args.width, '.')) }),
        lexica.declarations.function('vegan', 'String', 'Boolean', { updates: constant, implementation: ({ receiver }) => (invoked.push(['vegan', receiver]), receiver.startsWith('oat')) }),
        property('partner', 'String', 'String?', { updates: constant, implementation: ({ receiver }) => (invoked.push(['partner', receiver]), receiver.startsWith('p') ? null : `${receiver}'s`) }),
        lexica.declarations.function('fits', 'String', 'Boolean', { updates: constant, implementation: ({ receiver }) => receiver.length < 5 }),
        lexica.declarations.function('fits', 'Number', 'Boolean', { updates: constant, implementation: ({ receiver }) => receiver < 5 }),
        lexica.declarations.function('order', 'String', 'Number', { invokedBy: 'host', parameters: [valueParameter('count', 'Number')] }),
    ],
});

const values = { word: 'oat', other: 'milk', missing: null };

/** What the text evaluates to against a registry of the shop, with what each implementation was given. */
const evaluate = (text, bound = values) => {
    const invoked = [];
    const registry = lexica.createRegistry([createShop(invoked)]);
    const bindings = registry.bind(bound);
    const value = registry.resolve(text, bindings).createEvaluator(bindings).evaluate().value;

    return { value, invoked };
};

/** The resolution of the text against a registry of the shop. */
const resolve = (text, bound = values) => lexica.createRegistry([createShop()]).resolve(text, bound);

describe("a registry's text", () => {
    const registry = lexica.createRegistry([createShop()]);

    it("reads a module's name as its namespace, and writes a local and a script parameter of that name with @ and ~, so its canonical text reads back as the same definition", () => {
        const text = '{ let shop = 2, local = @shop, parameter = ~shop, namespace = shop.open }';
        const formatted = registry.format(text);

        expect(registry.parse('shop.open').expression).toEqual({ kind: 'member', target: { kind: 'namespace', name: 'shop' }, name: 'open' });
        expect(formatted).toBe('{\n    let shop = 2,\n    local = @shop,\n    parameter = ~shop,\n    namespace = shop.open\n}');
        expect(registry.parse(formatted)).toEqual(registry.parse(text));
        expect(registry.format(formatted)).toBe(formatted);
        expect(registry.quote(text)).toBe('{ let shop = 2, local = @shop, parameter = ~shop, namespace = shop.open }');
    });

    it("writes a definition's script parameter and local named after a module as a registry reads them, a definition created directly among them", () => {
        const definition = lexica.validate({ version: 33, expression: { kind: 'arithmetic', operator: '+', left: { kind: 'parameter', name: 'shop' }, right: { kind: 'member', target: { kind: 'namespace', name: 'shop' }, name: 'size' } } });

        expect(registry.format({ version: 33, expression: { kind: 'parameter', name: 'shop' } })).toBe('~shop');
        expect(registry.parse(registry.format(definition))).toEqual(definition);
    });

    it('reads text without a registry as the language alone, a module\'s name an identifier there', () => {
        expect(lexica.parse('shop.open').expression).toEqual({ kind: 'member', target: { kind: 'parameter', name: 'shop' }, name: 'open' });
        expect(lexica.format('{ let shop = 2, value = shop }')).toBe('{\n    let shop = 2,\n    value = shop\n}');
    });

    it('refuses to write a namespace without the module names, and to read a definition read without them that writes one of them alone', () => {
        expect(getError(() => lexica.format(registry.parse('shop.open')))).toMatchObject({ kind: 'structure', message: expect.stringContaining("reads through the namespace 'shop', which text read without a registry's module names cannot write") });
        expect(getError(() => lexica.quote(registry.parse('shop.open')))).toMatchObject({ kind: 'structure' });
        expect(getError(() => registry.resolve(lexica.parse('shop.open')))).toMatchObject({ kind: 'structure', message: expect.stringContaining("writes 'shop' alone, which this registry reads as the namespace of its module 'shop'") });
        expect(registry.resolve(lexica.parse('~shop + 1'), { shop: 1 })).toMatchObject({ type: 'Number' });
    });

    it('locates a name a definition read without the module names writes alone where the text first writes it', () => {
        expect(getError(() => registry.format(lexica.parse('let size = 2\nreturn size + shop.size + shop')))).toMatchObject({ location: { pointer: '/expression/result/left/right/target', line: 2, column: 15 } });
        expect(getError(() => registry.format(lexica.parse('shop(1)'))).location).toMatchObject({ pointer: '/expression', line: 1, column: 1 });
    });

    it('refuses a namespace no module the registry holds gives, and a definition a module registered since reads otherwise', () => {
        const bakery = { version: 33, expression: { kind: 'member', target: { kind: 'namespace', name: 'bakery' }, name: 'open' } };
        const growing = lexica.createRegistry([createShop()]);
        const read = growing.parse('bakery + 1');

        expect(getError(() => registry.resolve(bakery))).toMatchObject({ kind: 'structure', message: expect.stringContaining("reads through the namespace 'bakery', and this registry holds no module of that name"), location: { pointer: '/expression/target' } });
        expect(growing.resolve(read, { bakery: 1 })).toMatchObject({ type: 'Number' });

        growing.registerModule(lexica.createModule('bakery', {}));

        expect(getError(() => growing.resolve(read, { bakery: 1 }))).toMatchObject({ kind: 'structure', message: expect.stringContaining("writes 'bakery' alone") });
        expect(getError(() => growing.parse('bakery + 1'))).toMatchObject({ kind: 'syntax' });
    });

    it("never reserves Lexica's own module's name, which has no namespace", () => {
        expect(registry.parse('lexica.count').expression).toEqual({ kind: 'member', target: { kind: 'parameter', name: 'lexica' }, name: 'count' });
    });

    it('refuses a module named by a word the language reserves, which its text reaches only through an import binding read with @', () => {
        for (const name of ['it', 'root', 'true', 'null', 'if', 'to']) {
            expect(getError(() => lexica.createRegistry([lexica.createModule(name, {})]))).toMatchObject({ kind: 'module', code: 'LEXICA4557', message: expect.stringContaining(`'${name}' is a word the language reserves`) });
        }
    });

    it('gives the form to write in a diagnostic as the registry reads it, a script parameter and a local named after a module written with ~ and @', () => {
        expect(getError(() => resolve('~shop.a()', { shop: { a: 1 } })).message).toContain("write '~shop.a'");
        expect(getError(() => resolve('let shop = { a = 1 }\nreturn @shop.a()')).message).toContain("write '@shop.a'");
    });
});

describe('module members', () => {
    it('are read and called through their namespace, their implementations given no receiver', () => {
        const { value, invoked } = evaluate('{ open = shop.open, greeting = shop.greet("ann") }');

        expect(value).toEqual({ open: true, greeting: 'hi ann' });
        expect(invoked).toEqual([['open', { args: {}, env: {} }], ['greet', 'ann']]);
    });

    it('are refused in a form they do not take, and never reached from a receiver', () => {
        expect(getError(() => resolve('shop.open()'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.open' is a property, read as shop.open, and takes no argument") });
        expect(getError(() => resolve('word.open'))).toBeInstanceOf(LexicaError);
        expect(getError(() => resolve('shop.nothing'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("The module 'shop' declares no member 'nothing'") });
    });
});

describe('qualified forms', () => {
    it('call a member of a receiver through its module, the receiver first, as its receiver form does', () => {
        expect(evaluate('{ padded = shop.pad(word, 5), size = shop.size(word), vegan = shop.vegan(word) }').value).toEqual({ padded: 'oat..', size: 3, vegan: true });
        expect(evaluate('{ padded = word.pad(5), size = word.size, vegan = word.vegan() }').value).toEqual({ padded: 'oat..', size: 3, vegan: true });
    });

    it('evaluate their receiver first, a null one answering null without evaluating their own arguments or invoking the member, as ?. does', () => {
        const qualified = evaluate('shop.pad(missing, other.size)');
        const optional = evaluate('missing?.pad(other.size)');

        expect([qualified.value, optional.value]).toEqual([null, null]);
        expect(qualified.invoked).toEqual([]);
        expect(optional.invoked).toEqual([]);
        expect(evaluate('shop.pad(word.partner, other.size)', { word: 'pear', other: 'milk' }).invoked).toEqual([['partner', 'pear']]);
        expect(resolve('shop.pad(missing, other.size)').type).toBe('String?');
        expect(resolve('shop.pad(word.partner, 2)').type).toBe('String?');
        expect(resolve('shop.pad(word, 2)').type).toBe('String');
    });

    it('select the declaration their receiver takes, refusing one no declaration takes, a call without its receiver and an indexer', () => {
        expect(evaluate('{ word = shop.fits(word), number = shop.fits(7) }').value).toEqual({ word: true, number: false });
        expect(getError(() => resolve('shop.pad(3, 2)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.pad' takes a receiver of String, and is given Number") });
        expect(getError(() => resolve('shop.pad()'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('takes the receiver as its first argument') });
        expect(getError(() => resolve('shop.size(word, 1)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'size' takes no argument") });
    });

    it('prepare a host call through its module, its receiver the first argument, and skip it where that receiver is null', () => {
        const registry = lexica.createRegistry([createShop()]);
        const prepared = registry.resolve('shop.order(word, 2)', values).createEvaluator(values).prepareCall();

        expect(prepared).toMatchObject({ kind: 'prepared', receiver: 'oat', args: { count: 2 } });
        expect(registry.resolve('shop.order(missing, 2)', values).createEvaluator(values).prepareCall()).toMatchObject({ kind: 'skipped' });
    });
});

describe('function references', () => {
    it('resolve a held reference\'s call through a receiver of unknown type as its qualified form does, answering null without invoking it', () => {
        const pick = lexica.declarations.function('pick', 'List<Number>', 'List<Number>', { updates: constant, parameters: [lexica.declarations.expressionParameter('Number')], implementation: ({ receiver }) => receiver });
        const registry = lexica.createRegistry([lexica.createModule('lists', { members: [pick] })]);
        const held = registry.resolve('let f = lists.pick\nreturn f(nothing, it + 1)', { nothing: null });

        expect(held.type).toBe('List<Number>?');
        expect(held.type).toBe(registry.resolve('lists.pick(nothing, it + 1)', { nothing: null }).type);
        expect(held.createEvaluator({ nothing: null }).evaluate().value).toBeNull();
    });

    it('are function values of a module\'s functions, a call of one its qualified form\'s call, held, passed and called as any function is', () => {
        expect(evaluate('let pad = shop.pad return pad(word, 4)').value).toBe('oat.');
        expect(evaluate('let greet = shop.greet return greet("bo")').value).toBe('hi bo');
        expect(evaluate('let test = shop.vegan return { word = word.is(test), other = other.is(shop.vegan) }').value).toEqual({ word: true, other: false });
    });

    it('keep their qualified form\'s null rule wherever they are held, passed or chosen, a null receiver skipping the arguments after it', () => {
        const choosing = 'let keep = (w, n) => w\nlet pad = if flag then shop.pad else keep end\nreturn pad(missing, other.size)';
        const held = evaluate('let pad = shop.pad return pad(missing, other.size)');
        const chosen = evaluate(choosing, { ...values, flag: true });
        const arrow = evaluate(choosing, { ...values, flag: false });

        expect([held.value, chosen.value, arrow.value]).toEqual([null, null, null]);
        expect([held.invoked, chosen.invoked]).toEqual([[], []]);
        expect(arrow.invoked).toEqual([['size', 'milk']]);
        expect(resolve('let pad = shop.pad return pad(missing, 2)').type).toBe('String?');
    });

    it('name a declaration where they are written: the one a callback contract takes where they are passed, and the module\'s one function of the name anywhere else', () => {
        expect(evaluate('{ word = word.is(shop.fits), number = (7).is(shop.fits) }').value).toEqual({ word: true, number: false });
        expect(getError(() => resolve('let test = shop.fits return word.is(test)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.fits' names 2 functions, so which it references is ambiguous") });
    });

    it('refuse a property and a host call, which have none, and a declaration a callback contract does not take', () => {
        expect(getError(() => resolve('let size = shop.size return 1'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.size' is a property, read with its receiver as shop.size(receiver), and only a function has a reference") });
        expect(getError(() => resolve('let order = shop.order return 1'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.order' is a host call, which its host invokes, so it has no reference") });
        expect(getError(() => resolve('word.is(shop.pad)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("and 'shop.pad' names no function that takes those or answers that") });
        expect(getError(() => resolve('let pad = shop.pad return word.is(pad)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.pad' is (String, Number) => String") });
    });

    it('read and invoke nothing as they are created, each call reading what its declaration does, and are used declarations of the script', () => {
        const created = evaluate('let pad = shop.pad return 1');

        expect(created).toEqual({ value: 1, invoked: [] });
        expect(resolve('let test = shop.vegan return word.is(test)').usedDeclarations.map(use => use.name)).toEqual(expect.arrayContaining(['shop.vegan', 'is']));
    });

    it('are never reached by a bare name, which reads a local, a field, a function parameter or a script parameter', () => {
        expect(getError(() => resolve('word.is(vegan)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("No local in scope or script parameter is named 'vegan'") });
    });
});
