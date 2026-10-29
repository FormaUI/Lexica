import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates } from './support/updates.mjs';
import { resolveWith } from './support/pipeline.mjs';
import { receiverTestsDeclaration } from './support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createValueParameterDeclaration, createExpressionParameterDeclaration, createFunctionParameterDeclaration } = lexica.declarations;

/** A word the shop sells, a value with identity its module recognizes, written as its text. */
class Word {
    constructor(text) {
        this.text = text;
    }
}

/** A bag the shop fills, holding a count of things. */
class Bag {
    constructor(count) {
        this.count = count;
    }
}

/**
 * A shop's module of its own types, a word and a bag, whose members its namespace reaches: whether it is open and a greeting, its module members; a word's size, padded, whether it is vegan, and its partner, which a word
 * of `p` lacks; a test of a word's fit beside one of a bag's; and an order its host invokes. Every implementation records what it was given, a word by its text, so a test sees which ran.
 */
const createShop = (invoked = []) => lexica.createModule('shop', {
    typeOf: value => (value instanceof Word ? 'Word' : value instanceof Bag ? 'Bag' : null),
    types: [
        receiverTestsDeclaration(),
        {
            name: 'Word',
            kind: 'reference',
            isInstance: value => value instanceof Word,
            members: [
                createPropertyDeclaration('size', 'Number', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push(['size', receiver.text]), receiver.text.length) }),
                createFunctionDeclaration('pad', 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('width', 'Number')], impl: ({ receiver, args }) => (invoked.push(['pad', receiver.text]), receiver.text.padEnd(args.width, '.')) }),
                createFunctionDeclaration('vegan', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push(['vegan', receiver.text]), receiver.text.startsWith('oat')) }),
                createPropertyDeclaration('partner', 'Word?', { updates: constantUpdates, impl: ({ receiver }) => (invoked.push(['partner', receiver.text]), receiver.text.startsWith('p') ? null : new Word(`${receiver.text}'s`)) }),
                createFunctionDeclaration('fits', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => receiver.text.length < 5 }),
                createFunctionDeclaration('order', 'Number', { invokedBy: 'host', parameters: [createValueParameterDeclaration('count', 'Number')] }),
            ],
        },
        { name: 'Bag', kind: 'reference', isInstance: value => value instanceof Bag, members: [createFunctionDeclaration('fits', 'Boolean', { updates: constantUpdates, impl: ({ receiver }) => receiver.count < 5 })] },
    ],
    members: [
        createPropertyDeclaration('open', 'Boolean', { updates: { changes: 'unobserved', reads: 'fresh' }, impl: input => (invoked.push(['open', input]), true) }),
        createFunctionDeclaration('greet', 'String', { updates: constantUpdates, parameters: [createValueParameterDeclaration('name', 'String')], impl: ({ args }) => (invoked.push(['greet', args.name]), `hi ${args.name}`) }),
    ],
});

const values = { word: new Word('oat'), other: new Word('milk'), bag: new Bag(7), missing: null };

/** What the text evaluates to against a registry of the shop, which supplies its import, with what each implementation was given. */
const evaluate = (text, bound = values) => {
    const invoked = [];
    const registry = lexica.createRegistry([createShop(invoked)]);
    const bindings = registry.createBindings(bound);
    const value = registry.resolve(text, bindings, { imports: ['shop'] }).createEvaluator(bindings).evaluate().value;

    return { value, invoked };
};

/** The resolution of the text against a registry of the shop, which supplies its import. */
const resolve = (text, bound = values) => resolveWith([createShop()], text, bound);

describe("a script's imports", () => {
    const registry = lexica.createRegistry([createShop()]);

    it("read an imported module's local name as its namespace, and write a local and a script parameter of that name with @ and ~, so its canonical text reads back as the same definition", () => {
        const text = 'import shop\n{ let shop = 2, local = @shop, parameter = ~shop, namespace = shop.open }';
        const formatted = lexica.format(text);

        expect(lexica.parse('import shop\nshop.open')).toEqual({ version: 35, imports: [{ module: 'shop' }], expression: { kind: 'memberAccess', receiver: { kind: 'namespace', name: 'shop' }, name: 'open' } });
        expect(formatted).toBe('import shop\n\n{\n    let shop = 2,\n    local = @shop,\n    parameter = ~shop,\n    namespace = shop.open\n}');
        expect(lexica.parse(formatted)).toEqual(lexica.parse(text));
        expect(lexica.format(formatted)).toBe(formatted);
        expect(lexica.quote(text)).toBe('import shop\n{ let shop = 2, local = @shop, parameter = ~shop, namespace = shop.open }');
    });

    it("write a definition's script parameter named after a namespace its imports give as they read it, a definition created directly among them", () => {
        const definition = lexica.validate({ version: 35, imports: [{ module: 'shop' }], expression: { kind: 'arithmetic', operator: '+', left: { kind: 'scriptParameter', name: 'shop' }, right: { kind: 'memberAccess', receiver: { kind: 'namespace', name: 'shop' }, name: 'size' } } });

        expect(lexica.format({ version: 35, imports: [{ module: 'shop' }], expression: { kind: 'scriptParameter', name: 'shop' } })).toBe('import shop\n\n~shop');
        expect(lexica.format({ version: 35, imports: [], expression: { kind: 'scriptParameter', name: 'shop' } })).toBe('shop');
        expect(lexica.parse(lexica.format(definition))).toEqual(definition);
    });

    it('are the only thing that makes a name a namespace: every reader reads a text alike, and registering a module changes how no text reads', () => {
        const growing = lexica.createRegistry([]);
        const before = lexica.parse('shop.open');

        expect(before.expression).toEqual({ kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'shop' }, name: 'open' });

        growing.registerModule(createShop());

        expect(lexica.parse('shop.open')).toBe(before);
        expect(growing.resolve('shop.open', { shop: { open: true } }).definition).toBe(before);
        expect(['parse', 'format', 'quote'].filter(name => name in growing)).toEqual([]);
        expect(lexica.format('{ shop = shop.size }')).toBe('{ shop = shop.size }');
        expect(registry.resolve('import shop.Word\nshop.size', { shop: new Word('oat') }).type).toBe('Number');
    });

    it('give a module a local name of their own with an alias, which replaces its own, and import one type under its name or an alias', () => {
        const aliased = lexica.parse('import Store = shop\nimport shop.Word\nimport Item = shop.Word\n{ a = Store.open, b = shop }');

        expect(aliased.imports).toEqual([{ module: 'shop', type: 'Word', alias: 'Item' }, { module: 'shop', alias: 'Store' }, { module: 'shop', type: 'Word' }]);
        expect(aliased.expression.objectFields.map(field => field.value)).toEqual([{ kind: 'memberAccess', receiver: { kind: 'namespace', name: 'Store' }, name: 'open' }, { kind: 'scriptParameter', name: 'shop' }]);
        expect(lexica.format(aliased)).toBe('import Item = shop.Word\nimport Store = shop\nimport shop.Word\n\n{\n    a = Store.open,\n    b = shop\n}');
        expect(registry.resolve('import Store = shop\nStore.greet("ann")').type).toBe('String');
        expect(registry.resolve('import Item = shop.Word\n(word as Item).size', { word: new Word('oat') }).type).toBe('Number');
        expect(lexica.parse('import shop\nimport shop\nimport Store = shop\n1').imports).toEqual([{ module: 'shop', alias: 'Store' }, { module: 'shop' }]);
    });

    it('read an import binding with @ where no local of its name is in scope, the namespace a reserved word names among them, and a local of its name first', () => {
        const reserved = lexica.createRegistry([lexica.createModule('if', { members: [createPropertyDeclaration('open', 'Boolean', { updates: constantUpdates, impl: () => true })] })]);

        expect(lexica.parse('import if\n@if.open').expression).toEqual({ kind: 'memberAccess', receiver: { kind: 'namespace', name: 'if' }, name: 'open' });
        expect(lexica.parse('import shop\nlet shop = { open = 1 }\nreturn @shop.open').expression.result).toEqual({ kind: 'memberAccess', receiver: { kind: 'local', name: 'shop' }, name: 'open' });
        expect(lexica.format('import if\n@if.open')).toBe('import if\n\n@if.open');
        expect(reserved.resolve('import if\n@if.open').createEvaluator({}).evaluate().value).toBe(true);
        expect(lexica.createRegistry([createShop()]).resolve('import to = shop\n@to.open').type).toBe('Boolean');
    });

    it('take the imports a host supplies beside the script\'s own, which formatting for that host leaves out', () => {
        const supplied = { imports: ['shop', { module: 'shop', type: 'Word', alias: 'Item' }] };
        const definition = lexica.parse('shop.open', supplied);

        expect(definition.imports).toEqual([{ module: 'shop', type: 'Word', alias: 'Item' }, { module: 'shop' }]);
        expect(lexica.parse('shop.open', supplied)).toBe(definition);
        expect(lexica.parse('shop.open')).not.toBe(definition);
        expect(lexica.format('shop.open', supplied)).toBe('shop.open');
        expect(lexica.format(definition)).toBe('import Item = shop.Word\nimport shop\n\nshop.open');
        expect(lexica.quote('import shop\nshop.open', { imports: ['shop'] })).toBe('shop.open');
        expect(registry.resolve('shop.greet("ann")', {}, { imports: ['shop'] }).definition).toBe(lexica.parse('shop.greet("ann")', { imports: ['shop'] }));
        expect(registry.resolve('shop.greet("ann")', {}, { imports: ['shop'] }).type).toBe('String');
        expect(lexica.parse('import shop\nshop.open', { imports: ['shop'] }).imports).toEqual([{ module: 'shop' }]);
    });

    it("refuse a host's import that breaks an import's rules, and two of them giving one local name to different declarations", () => {
        for (const imports of ['shop', [1], [{ module: 'Lexica' }], [{ module: 'shop', alias: 'shop' }], [{ module: 'shop', alias: 'S' }, { module: 'home', alias: 'S' }]]) {
            expect(errorThrownBy(() => lexica.parse('1', { imports })), JSON.stringify(imports)).toMatchObject({ kind: 'structure', code: 'LEXICA2008' });
        }

        expect(errorThrownBy(() => lexica.parse('import S = home\n1', { imports: [{ module: 'shop', alias: 'S' }] }))).toMatchObject({ kind: 'syntax', code: 'LEXICA1048', location: { line: 1, column: 1 } });
    });

    it('take a module a reserved word names, which an import binding read with @ reaches', () => {
        for (const name of ['it', 'root', 'true', 'null', 'if', 'to']) {
            expect(lexica.createRegistry([lexica.createModule(name, {})]).moduleNames).toContain(name);
        }
    });

    it('give the form to write in a diagnostic as the script reads it, a script parameter and a local named after a namespace written with ~ and @', () => {
        expect(errorThrownBy(() => resolve('~shop.a()', { shop: { a: 1 } })).message).toContain("write '~shop.a'");
        expect(errorThrownBy(() => resolve('let shop = { a = 1 }\nreturn @shop.a()')).message).toContain("write '@shop.a'");
    });
});

describe('module members', () => {
    it('are read and called through their namespace, their implementations given no receiver', () => {
        const { value, invoked } = evaluate('{ open = shop.open, greeting = shop.greet("ann") }');

        expect(value).toEqual({ open: true, greeting: 'hi ann' });
        expect(invoked).toEqual([['open', { args: {}, env: {} }], ['greet', 'ann']]);
    });

    it('are refused in a form they do not take, and never reached from a receiver', () => {
        expect(errorThrownBy(() => resolve('shop.open()'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.open' is a property, read as shop.open, and takes no argument") });
        expect(errorThrownBy(() => resolve('word.open'))).toBeInstanceOf(LexicaError);
        expect(errorThrownBy(() => resolve('shop.nothing'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("The module 'shop' declares no member 'nothing'") });
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
        expect(evaluate('shop.pad(word.partner, other.size)', { word: new Word('pear'), other: new Word('milk') }).invoked).toEqual([['partner', 'pear']]);
        expect(resolve('shop.pad(missing, other.size)').type).toBe('String?');
        expect(resolve('shop.pad(word.partner, 2)').type).toBe('String?');
        expect(resolve('shop.pad(word, 2)').type).toBe('String');
    });

    it('select the declaration their receiver takes, refusing one no declaration takes, a call without its receiver and an indexer', () => {
        expect(evaluate('{ word = shop.fits(word), bag = shop.fits(bag) }').value).toEqual({ word: true, bag: false });
        expect(errorThrownBy(() => resolve('shop.pad(3, 2)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.pad' takes a receiver of Word, and is given Number") });
        expect(errorThrownBy(() => resolve('shop.pad()'))).toMatchObject({ kind: 'validation', message: expect.stringContaining('takes the receiver as its first argument') });
        expect(errorThrownBy(() => resolve('shop.size(word, 1)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'size' takes no argument") });
    });

    it('prepare a host call through its module, its receiver the first argument, and skip it where that receiver is null', () => {
        const registry = lexica.createRegistry([createShop()]);
        const prepared = registry.resolve('shop.order(word, 2)', values, { imports: ['shop'] }).createEvaluator(values).prepareHostCall();

        expect(prepared).toMatchObject({ kind: 'prepared', receiver: values.word, args: { count: 2 } });
        expect(registry.resolve('shop.order(missing, 2)', values, { imports: ['shop'] }).createEvaluator(values).prepareHostCall()).toMatchObject({ kind: 'skipped' });
    });

    it('are used declarations once each, where the call invoking them stands, as a module member, a member of a receiver and a held reference\'s call are, a receiver of unknown type choosing none', () => {
        const usesOf = text => resolve(text).usedDeclarations.map(({ qualifiedName, pointer }) => [qualifiedName, pointer]);

        expect(usesOf('{ a = shop.greet("x"), b = shop.pad(word, 4), c = word.size, d = shop.size(missing) }')).toEqual([
            ['shop.greet', '/expression/objectFields/0/value'],
            ['Word.pad', '/expression/objectFields/1/value'],
            ['Word.size', '/expression/objectFields/2/value'],
        ]);
        expect(usesOf('let pad = shop.pad\nreturn pad(word, 4)')).toEqual([['shop.pad', '/expression/locals/0/value'], ['shop.pad', '/expression/result']]);
        expect(usesOf('let pad = shop.pad\nreturn pad(missing, 4)')).toEqual([['shop.pad', '/expression/locals/0/value']]);
    });
});

describe('function references', () => {
    it('resolve a held reference\'s call through a receiver of unknown type as its qualified form does, answering null without invoking it', () => {
        const held = evaluate('let f = shop.pad\nreturn f(missing, 2)');

        expect(resolve('let f = shop.pad\nreturn f(missing, 2)').type).toBe('String?');
        expect(resolve('let f = shop.pad\nreturn f(missing, 2)').type).toBe(resolve('shop.pad(missing, 2)').type);
        expect(held).toEqual({ value: null, invoked: [] });
    });

    it('produce module delegates of a module\'s functions, a call of one its qualified form\'s call, held, passed and called as any function is', () => {
        expect(evaluate('let pad = shop.pad\nreturn pad(word, 4)').value).toBe('oat.');
        expect(evaluate('let greet = shop.greet\nreturn greet("bo")').value).toBe('hi bo');
        expect(evaluate('let test = shop.vegan\nreturn { word = word.is(test), other = other.is(shop.vegan) }').value).toEqual({ word: true, other: false });
    });

    it('keep their qualified form\'s null rule wherever they are held, passed or chosen, a null receiver skipping the arguments after it', () => {
        const choosing = 'let keep = (w, n) => w\nlet pad = if flag then shop.pad else keep end\nreturn pad(missing, other.size)';
        const held = evaluate('let pad = shop.pad\nreturn pad(missing, other.size)');
        const chosen = evaluate(choosing, { ...values, flag: true });
        const arrow = evaluate(choosing, { ...values, flag: false });

        expect([held.value, chosen.value, arrow.value]).toEqual([null, null, null]);
        expect([held.invoked, chosen.invoked]).toEqual([[], []]);
        expect(arrow.invoked).toEqual([['size', 'milk']]);
        expect(resolve('let pad = shop.pad\nreturn pad(missing, 2)').type).toBe('String?');
    });

    it('name a declaration where they are written: the one a callback contract takes where they are passed, and the module\'s one function of the name anywhere else', () => {
        expect(evaluate('{ word = word.is(shop.fits), bag = bag.is(shop.fits) }').value).toEqual({ word: true, bag: false });
        expect(errorThrownBy(() => resolve('let test = shop.fits\nreturn word.is(test)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.fits' names 2 functions, so which it references is ambiguous") });
    });

    it('refuse a property and a host call, which have none, and a declaration a callback contract does not take', () => {
        expect(errorThrownBy(() => resolve('let size = shop.size\nreturn 1'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.size' is a property, read with its receiver as shop.size(receiver), and only a function has a reference") });
        expect(errorThrownBy(() => resolve('let order = shop.order\nreturn 1'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.order' is a host call, which its host invokes, so it has no reference") });
        expect(errorThrownBy(() => resolve('word.is(shop.pad)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("and 'shop.pad' names no function that takes those or answers that") });
        expect(errorThrownBy(() => resolve('let pad = shop.pad\nreturn word.is(pad)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("'shop.pad' is (Word, Number) => String") });
    });

    it('read and invoke nothing as they are created, each call reading what its declaration does, and are used declarations of the script', () => {
        const created = evaluate('let pad = shop.pad\nreturn 1');

        expect(created).toEqual({ value: 1, invoked: [] });
        expect(resolve('let test = shop.vegan\nreturn word.is(test)').usedDeclarations.map(use => use.qualifiedName)).toEqual(expect.arrayContaining(['shop.vegan', 'is']));
    });

    it('are never reached by a bare name, which reads a local, a field, a function parameter or a script parameter', () => {
        expect(errorThrownBy(() => resolve('word.is(vegan)'))).toMatchObject({ kind: 'validation', message: expect.stringContaining("No local in scope or script parameter is named 'vegan'") });
    });
});

describe('a call of a delegate', () => {
    /**
     * A module of words, each a module member of the word it is given: `cut` and `trim`, each taking a width it defaults to 2, `cut`'s propagating null and `trim`'s accepting it; and `long`, a test taking a minimum it
     * defaults to 3. Each records what it is given.
     */
    const createWords = (invoked = []) => {
        const word = createValueParameterDeclaration('word', 'String');

        return lexica.createModule('words', {
            members: [
                createFunctionDeclaration('cut', 'String', { updates: constantUpdates, parameters: [word, createValueParameterDeclaration('width', 'Number', { default: 2 })], impl: ({ args }) => (invoked.push(['cut', args]), args.word.slice(0, args.width)) }),
                createFunctionDeclaration('trim', 'String', { updates: constantUpdates, parameters: [word, createValueParameterDeclaration('width', 'Number?', { default: 2, nulls: 'accept' })], impl: ({ args }) => (invoked.push(['trim', args]), args.word.slice(0, args.width ?? 1)) }),
                createFunctionDeclaration('long', 'Boolean', { updates: constantUpdates, parameters: [word, createValueParameterDeclaration('minimum', 'Number', { default: 3 })], impl: ({ args }) => (invoked.push(['long', args]), args.word.length >= args.minimum) }),
            ],
        });
    };
    const bound = { word: 'oatmeal', short: 'oa', small: new Word('oa'), bag: new Bag(7), flag: true, none: null, numbers: [1, 2] };

    /** What the text evaluates to against the words and the shop, with what the words' implementations were given. */
    const evaluateWords = text => {
        const invoked = [];
        const registry = lexica.createRegistry([createWords(invoked), createShop()]);

        return { value: registry.resolve(text, bound, { imports: ['words', 'shop'] }).createEvaluator(bound).evaluate().value, invoked };
    };

    it('binds a reference\'s omitted argument to its default, and an explicit null by its parameter\'s null policy, held, chosen or given to a member', () => {
        const chosen = name => `let keep = (w) => w\nlet call = if flag then words.${name} else keep end\nreturn call(word)`;

        expect(evaluateWords(chosen('cut'))).toEqual({ value: 'oa', invoked: [['cut', { word: 'oatmeal', width: 2 }]] });
        expect(evaluateWords('let keep = (w, n) => w\nlet cut = if flag then words.cut else keep end\nreturn cut(word, none)')).toEqual({ value: null, invoked: [] });
        expect(evaluateWords('let keep = (w, n) => w\nlet trim = if flag then words.trim else keep end\nreturn trim(word, none)')).toEqual({ value: 'o', invoked: [['trim', { word: 'oatmeal', width: null }]] });
        expect(evaluateWords('{ word = word.is(words.long), short = short.is(words.long) }')).toEqual({ value: { word: true, short: false }, invoked: [['long', { word: 'oatmeal', minimum: 3 }], ['long', { word: 'oa', minimum: 3 }]] });
    });

    it('evaluates a function\'s body in the captured scope each script delegate holds, two of one function keeping their own', () => {
        // One call of addTen evaluates for each item, each making its own script delegate of add, which captures that item.
        expect(evaluateWords('let addTen = function(n)\n    let add = (x) => x + n\n    return add(10)\nend\nreturn numbers.sum(n => addTen(n))').value).toBe(23);
    });

    it('evaluates, at each place a function is called, the body resolved for that call', () => {
        expect(evaluateWords('let check = (x) => shop.fits(x)\nreturn { word = check(small), bag = check(bag) }').value).toEqual({ word: true, bag: false });
    });
});

describe('the answer of a held reference', () => {
    /** A module of lists: `head`, a generic module member answering what the test gives it for the list it is given, and `apply`, a list's member calling the function it is given with its receiver. */
    const createLists = (answer, invoked = []) => lexica.createModule('lists', {
        types: [
            {
                name: 'ListExtensions<T>',
                kind: 'extension',
                target: 'List<T>',
                members: [createFunctionDeclaration('apply', 'T', { updates: constantUpdates, parameters: [createFunctionParameterDeclaration('f', 'T', ['List<T>'])], impl: ({ receiver, args }) => args.f(receiver) })],
            },
        ],
        members: [createFunctionDeclaration('head<T>', 'T', { updates: constantUpdates, parameters: [createValueParameterDeclaration('list', 'List<T>')], impl: ({ args }) => (invoked.push(args.list), answer(args.list)) })],
    });
    const bound = { numbers: [1, 2], words: ['a', 'b'], missing: null, flag: true, full: false };
    // A local that may hold the reference or a function answering null, so the call's own type is nullable while the reference's answer is not.
    const choosing = 'let none = (list) => null\nlet pick = if flag then lists.head else none end\nreturn ';

    /** What the text evaluates to against the lists, `head` answering as given. */
    const evaluateLists = (text, answer, invoked = []) => lexica.createRegistry([createLists(answer, invoked)]).resolve(text, bound, { imports: ['lists'] }).createEvaluator(bound).evaluate().value;

    it('is checked against its result type resolved for the call, as its qualified form\'s is, held, chosen among functions or given to a member', () => {
        const wrong = () => 'x';
        const refusal = { code: 'LEXICA5006', message: expect.stringContaining('and it declares Number') };

        expect(errorThrownBy(() => evaluateLists('lists.head(numbers)', wrong))).toMatchObject(refusal);
        expect(errorThrownBy(() => evaluateLists('let head = lists.head\nreturn head(numbers)', wrong))).toMatchObject(refusal);
        expect(errorThrownBy(() => evaluateLists(`${choosing}pick(numbers)`, wrong))).toMatchObject(refusal);
        expect(errorThrownBy(() => evaluateLists('numbers.apply(lists.head)', wrong))).toMatchObject(refusal);
    });

    it('is checked against each specialization the reference is called with, apart', () => {
        expect(evaluateLists(`${choosing}{ number = pick(numbers), word = pick(words) }`, list => list[0])).toEqual({ number: 1, word: 'a' });
        expect(errorThrownBy(() => evaluateLists(`${choosing}{ number = pick(numbers), word = pick(words) }`, () => 1))).toMatchObject({ code: 'LEXICA5006', message: expect.stringContaining('and it declares String') });
    });

    it('is null where a null receiver short-circuits the call, and refused where the implementation answers null for a result that is not nullable', () => {
        const invoked = [];

        expect(evaluateLists(`${choosing}pick(if full then numbers else missing end)`, () => null, invoked)).toBeNull();
        expect(invoked).toEqual([]);
        expect(errorThrownBy(() => evaluateLists(`${choosing}pick(numbers)`, () => null))).toMatchObject({ code: 'LEXICA5006', message: expect.stringContaining('answered null, and it declares Number') });
    });
});
