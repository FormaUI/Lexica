import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { Light, Room, withHome } from '../support/home.mjs';
import { errorThrownBy } from '../support/errors.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { dataPropertyDeclarations, extensionDeclaration, hostFunctionDeclaration, operatorDeclaration } from '../support/declarations.mjs';

const { createValueParameterDeclaration, createExpressionParameterDeclaration, createFunctionParameterDeclaration, createPropertyDeclaration, createFunctionDeclaration, createIndexerDeclaration } = lexica.declarations;

/** A property, a member a script calls and an indexer, each unevaluated by these tests. */
const property = (name, result) => createPropertyDeclaration(name, result, { updates: constantUpdates });
const call = (name, result, options = {}) => createFunctionDeclaration(name, result, { updates: constantUpdates, ...options });
const indexer = (name, result, options = {}) => createIndexerDeclaration(name, result, { updates: constantUpdates, ...options });

/** The members of a till, the shop's own type, which its namespace reaches: a function of a receiver, one taking a function, a property, a host call, and a function of a name its cup's shares. */
const tillMembers = () => [
    property('size', 'Number'),
    call('pad', 'String', { parameters: [createValueParameterDeclaration('width', 'Number')] }),
    call('wipe', 'String'),
    call('check', 'Boolean', { parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])] }),
    call('fits', 'Boolean'),
    hostFunctionDeclaration('hold', undefined),
];

/**
 * A shop's module on words, with a member of each shape the conditions need: properties, a named indexer, functions of positional and options arguments, a fixed argument, a function parameter, expression
 * parameters on a list, on a word and on no receiver, members of one name for two kinds of list, module members, host calls and a structured type converted from a word, each on a word declared in an extension of
 * strings; and its own type, a till, whose members its namespace reaches, as no extension's are, for the qualified forms and the function references.
 */
const createShop = () => lexica.createModule('shop', withHome({
    types: [
        // A cup's function of the name a till's has, so a reference to the name names two functions.
        { name: 'Cup', kind: 'structured', members: [...dataPropertyDeclarations({ size: 'Number' }), call('fits', 'Boolean')] },
        { name: 'Till', kind: 'reference', isInstance: () => false, members: tillMembers() },
        extensionDeclaration('Words', 'String', [
            property('size', 'Number'),
            property('partner', 'String?'),
            property('device', 'Device'),
            indexer('letter', 'String?', { parameters: [createValueParameterDeclaration('index', 'Number')] }),
            call('pad', 'String', { parameters: [createValueParameterDeclaration('width', 'Number')] }),
            call('wipe', 'String'),
            call('brew', 'Number', { arguments: 'options', parameters: [createValueParameterDeclaration('strength', 'Number'), createValueParameterDeclaration('milk', 'Boolean', { default: false })] }),
            call('flavored', '@selected', { parameters: [createValueParameterDeclaration('flavor', 'String', { fixed: true, selects: 'type', selector: 'flavor' })] }),
            call('check', 'Boolean', { parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['String'])] }),
            call('scan', 'Number', { parameters: [createExpressionParameterDeclaration('Number')] }),
            hostFunctionDeclaration('order', 'Number', { parameters: [createValueParameterDeclaration('count', 'Number')] }),
            hostFunctionDeclaration('hold', undefined),
            operatorDeclaration('convert', 'Cup', ({ value }) => ({ size: value.length })),
        ]),
        extensionDeclaration('Numbers', 'List<Number>', [
            call('rank', 'Number', { arguments: 'options', parameters: [{ ...createExpressionParameterDeclaration('Number'), name: 'by' }, createValueParameterDeclaration('limit', 'Number', { default: 1 })] }),
            call('total', 'Number'),
        ]),
        extensionDeclaration('Texts', 'List<String>', [call('total', 'Number')]),
    ],
    typeSelectors: [{ name: 'flavor' }],
    mappings: [{ key: 'size', selector: 'flavor', type: 'Number' }],
    members: [
        property('open', 'Boolean'),
        call('sweep', 'Number', { parameters: [createExpressionParameterDeclaration('Number')] }),
        // A parameter its one optional argument binds, which a call that leaves the argument out leaves unbound.
        call('make<T>', 'T', { parameters: [createValueParameterDeclaration('seed', 'T?', { default: null })] }),
        call('greet', 'String', { parameters: [createValueParameterDeclaration('name', 'String')] }),
    ],
}));

const values = { s: 'oat', xs: [1, 2], ys: [3], e: [], nothing: null, no: false, flag: true, p: 'size' };

/** The error resolving the text against a registry of the shop, and of the other modules given, each imported, throws, with the script parameters given. */
const refusalOf = (text, bound = values, modules = []) => errorThrownBy(() => lexica.createRegistry([createShop(), ...modules]).resolve(text, bound, { imports: ['shop', ...modules.map(module => module.name)] }));

/** The error resolving the text against a registry of the shop and of the other modules given throws, with the script parameters given and no import a host supplies. */
const refusalWithoutImportsOf = (text, bound = values, modules = []) => errorThrownBy(() => lexica.createRegistry([createShop(), ...modules]).resolve(text, bound));

/** Expects the text's resolution to fail with the code, of the kind given. */
const expectResolutionCode = (text, code, kind = 'validation', bound = values, modules = []) => {
    const error = refusalOf(text, bound, modules);

    expect(error).toBeInstanceOf(LexicaError);
    expect({ code: error.code, kind: error.kind }).toEqual({ code, kind });
};

describe('the codes of resolution', () => {
    describe('imports', () => {
        it('LEXICA3002, an import of a module the registry does not hold', () => {
            expect(refusalWithoutImportsOf('import shop\nimport elsewhere\n1')).toMatchObject({ code: 'LEXICA3002', kind: 'validation', location: { pointer: '/imports/0', line: 2, column: 1 }, message: expect.stringContaining("'import elsewhere' imports the module 'elsewhere', which the registry does not hold") });
            expect(errorThrownBy(() => lexica.createRegistry([]).resolve('1', {}, { imports: ['shop'] }))).toMatchObject({ code: 'LEXICA3002', location: { pointer: '/imports/0' } });
        });
        it('LEXICA3052, an import of a type its module does not declare', () => expect(refusalWithoutImportsOf('import shop.Mug\n1')).toMatchObject({ code: 'LEXICA3052', location: { pointer: '/imports/0' }, message: expect.stringContaining("imports 'shop.Mug', which its module does not declare") }));
        it('takes an import of an extension by its name, which names no type, and refuses an internal one with LEXICA3053', () => {
            expect(lexica.createRegistry([createShop()]).resolve('import shop.Words\n1', values).type).toBe('Number');
            expect(refusalWithoutImportsOf('import shop.Words\n"oat" as Words')).toMatchObject({ code: 'LEXICA3019' });

            const secret = lexica.createModule('secret', { types: [{ ...extensionDeclaration('Hidden', 'String', [call('hide', 'String')]), internal: true }] });

            expect(refusalWithoutImportsOf('import secret.Hidden\n1', values, [secret])).toMatchObject({ code: 'LEXICA3053', location: { pointer: '/imports/0' }, message: expect.stringContaining("imports 'secret.Hidden', which is internal to its module") });
        });
        it('LEXICA3053, an import of an internal type', () => {
            const secret = lexica.createModule('secret', { types: [{ name: 'Vault', kind: 'structured', internal: true, members: dataPropertyDeclarations({ size: 'Number' }) }] });

            expect(refusalWithoutImportsOf('import secret.Vault\n1', values, [secret])).toMatchObject({ code: 'LEXICA3053', location: { pointer: '/imports/0' }, message: expect.stringContaining("imports 'secret.Vault', which is internal to its module") });
        });
        it("LEXICA3003, a registered module's name read where a value stands, which no import gives and no binding has", () => {
            expect(refusalWithoutImportsOf('shop.open')).toMatchObject({ code: 'LEXICA3003', location: { pointer: '/expression/receiver' }, message: expect.stringContaining("write 'import shop' at the script's start") });
            expect(lexica.createRegistry([createShop()]).resolve('shop.size', { shop: 'oat' }).type).toBe('Number');
            expect(refusalWithoutImportsOf('import Store = shop\nshop.open').code).toBe('LEXICA3003');
            expect(lexica.createRegistry([createShop()]).resolve('import Store = shop\nStore.open').type).toBe('Boolean');
        });
        it('LEXICA3501, an extension selected explicitly, which this implementation resolves once text writes one', () => {
            const definition = { version: 34, imports: [{ module: 'shop' }], expression: { kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 's' }, name: 'size', extension: { name: 'Words', module: 'shop' } } };

            expect(refusalWithoutImportsOf(definition)).toMatchObject({ code: 'LEXICA3501', kind: 'validation', location: { pointer: '/expression/extension' } });
            expect(refusalWithoutImportsOf({ ...definition, expression: { kind: 'call', callee: { ...definition.expression, name: 'pad' }, arguments: [{ kind: 'literal', value: 1 }] } }).location).toEqual({ pointer: '/expression/callee/extension' });
        });
    });

    describe('names and scope', () => {
        it('LEXICA3009, a name no local, field or script parameter has', () => expectResolutionCode('nobody', 'LEXICA3009'));
        it('LEXICA3009, a name no local, field or script parameter has, within a function', () => expectResolutionCode('let f = function(y) return nobody end\nreturn f(1)', 'LEXICA3009'));
        it('LEXICA3051, a script parameter the host did not bind, written with ~ within a function', () => expectResolutionCode('let f = function(y) return ~nobody end\nreturn f(1)', 'LEXICA3051'));
        it('LEXICA3051, a script parameter the host did not bind, selected with ~', () => {
            expectResolutionCode('let q = 1\nreturn ~q', 'LEXICA3051');
            expect(refusalOf('let q = 1\nreturn ~q', values).message).toContain("and '~q' reads a script parameter alone: write 'q' for the local, object field, conditional binding or function parameter of that name");
        });
        it('LEXICA3051, a script parameter the host did not bind, written with ~ where no local has its name', () => expectResolutionCode('~nobody', 'LEXICA3051'));
        it('LEXICA3051, a definition\'s script parameter the host did not bind', () => expectResolutionCode({ version: 34, imports: [], expression: { kind: 'scriptParameter', name: 'nobody' } }, 'LEXICA3051'));
        it('LEXICA3010, it within an argument where nothing gives it a value', () => expectResolutionCode('xs.where(x => it)', 'LEXICA3010'));
        it('LEXICA2012, a definition\'s local no local in scope answers', () => expectResolutionCode({ version: 34, imports: [], expression: { kind: 'local', name: 'q' } }, 'LEXICA2012', 'structure'));
        it('LEXICA2018, root outside every object expression', () => expectResolutionCode({ version: 34, imports: [], expression: { kind: 'root' } }, 'LEXICA2018', 'structure'));
    });

    describe('members', () => {
        it('LEXICA3001, a member no declaration has', () => expectResolutionCode('s.nope', 'LEXICA3001'));
        it('LEXICA3001, a member a declaration has on another receiver', () => expectResolutionCode('xs.pad(1)', 'LEXICA3001'));
        it('LEXICA3001, a member a module does not declare, read through its namespace', () => expectResolutionCode('shop.nope', 'LEXICA3001'));
        it('LEXICA3001, a member called on a receiver of unknown type that no declaration has', () => expectResolutionCode('nothing?.nope(1)', 'LEXICA3001'));
        it('LEXICA3008, a member read with . on a receiver that can be null', () => expectResolutionCode('s.partner.size', 'LEXICA3008'));
        it('LEXICA3011, a named indexer written without its key', () => expectResolutionCode('s.letter', 'LEXICA3011'));
        it('LEXICA3011, a named indexer written as a call', () => expectResolutionCode('s.letter(1)', 'LEXICA3011'));
        it('LEXICA3054, a function written with its argument in brackets', () => expectResolutionCode('s.pad[3]', 'LEXICA3054'));
        it('LEXICA3012, an unnamed indexer on a type that declares none', () => expectResolutionCode('s[0]', 'LEXICA3012'));
        it('LEXICA3012, an unnamed indexer on root', () => expectResolutionCode('{ a = 1, b = root[0] }', 'LEXICA3012'));
        it('LEXICA3017, a property called', () => expectResolutionCode('s.size()', 'LEXICA3017'));
        it('LEXICA3017, a property called on a script parameter a local hides, the access to write naming it with ~ as it reads in place', () => {
            expectResolutionCode('let s = 1\nreturn { a = ~s.size() }', 'LEXICA3017');
            expect(refusalOf('let s = 1\nreturn { a = ~s.size() }', values).message).toContain("write '~s.size'");
        });
        it('LEXICA3017, a function read without its call', () => expectResolutionCode('s.wipe', 'LEXICA3017'));
        it('LEXICA3017, a field of a structured type called', () => expectResolutionCode('(s to Cup).size(1)', 'LEXICA3017'));
        it('LEXICA3017, a field of root called', () => expectResolutionCode('{ a = 1, b = root.a() }', 'LEXICA3017'));
        it('LEXICA3017, a module property called', () => expectResolutionCode('shop.open()', 'LEXICA3017'));
        it('LEXICA3024, a member several declarations take on a List<Never>', () => expectResolutionCode('e.total()', 'LEXICA3024'));
        it('LEXICA3025, a receiver of unknown type whose candidates disagree on who invokes them', () => {
            const cafe = lexica.createModule('cafe', { types: [extensionDeclaration('Orders', 'Number', [call('order', 'Number', { parameters: [createValueParameterDeclaration('count', 'Number')] })])] });

            expectResolutionCode('nothing?.order(1)', 'LEXICA3025', 'validation', values, [cafe]);
        });
    });

    describe('computed property access', () => {
        it('LEXICA3055, a number where a computed property\'s name stands', () => expectResolutionCode('s.[0]', 'LEXICA3055'));
        it('LEXICA3013, a computed property\'s name that can be null', () => expectResolutionCode('s.[nothing]', 'LEXICA3013'));
        it('LEXICA3013, a computed property\'s name that can be false', () => expectResolutionCode('s.[no]', 'LEXICA3013'));
        it('LEXICA3013, a computed property\'s name that can be other than a string', () => {
            expectResolutionCode('s.[p]', 'LEXICA3013', 'validation', { ...values, p: 5 });
            expectResolutionCode('s.[true]', 'LEXICA3013');
        });
        it('LEXICA3014, a computed property\'s name whose names cannot be determined', () => expectResolutionCode('s.[s.partner]', 'LEXICA3014'));
        it('LEXICA3015, possible names whose results no one type holds', () => expectResolutionCode('s.[if s.size > 1 then "size" else "partner" end]', 'LEXICA3015'));
        it('LEXICA3016, a computed property\'s name settling to a named indexer\'s', () => expectResolutionCode('s.[p]', 'LEXICA3016', 'validation', { ...values, p: 'letter' }));
        it('LEXICA3056, a computed property\'s name naming no property of the receiver', () => expectResolutionCode('s.[p]', 'LEXICA3056', 'validation', { ...values, p: 'nope' }));
        it('LEXICA3056, a computed property\'s name naming a function', () => expectResolutionCode('s.[p]', 'LEXICA3056', 'validation', { ...values, p: 'wipe' }));
    });

    describe('arguments', () => {
        it('LEXICA3058, more arguments than a member takes', () => expectResolutionCode('s.pad(1, 2)', 'LEXICA3058'));
        it('LEXICA3058, an argument to a member that takes none', () => expectResolutionCode('s.wipe(1)', 'LEXICA3058'));
        it('LEXICA3058, a second argument to a member of options', () => expectResolutionCode('s.brew({ strength = 1 }, 2)', 'LEXICA3058'));
        it('LEXICA3057, an options member given no object of its options', () => expectResolutionCode('s.brew(1)', 'LEXICA3057'));
        it('LEXICA3018, an options field the member has no parameter for', () => expectResolutionCode('s.brew({ sugar = 1 })', 'LEXICA3018'));
        it('LEXICA3080, a missing required argument', () => expectResolutionCode('s.pad()', 'LEXICA3080'));
        it('LEXICA3080, a qualified form without its receiver', () => expectResolutionCode('shop.pad()', 'LEXICA3080'));
        it('LEXICA3080, a function reference to a member of a receiver called without one', () => expectResolutionCode('let f = shop.wipe\nreturn f()', 'LEXICA3080'));
        it('LEXICA3042, an argument of the wrong type', () => expectResolutionCode('s.pad("x")', 'LEXICA3042'));
        it('LEXICA3042, a qualified form given a receiver of the wrong type', () => expectResolutionCode('shop.pad(1, 2)', 'LEXICA3042'));
        it('LEXICA3042, a function reference given a receiver of the wrong type', () => expectResolutionCode('let f = shop.wipe\nreturn f(1)', 'LEXICA3042'));
        it('LEXICA3042, a qualified form given a function as its receiver', () => expectResolutionCode('let g = x => x\nreturn shop.wipe(g)', 'LEXICA3042'));
        it('LEXICA3042, an expression argument of the wrong type', () => expectResolutionCode('xs.max("a")', 'LEXICA3042'));
        it('LEXICA3011, a named indexer called through its namespace', () => {
            const words = lexica.createModule('words', { types: [{ name: 'Glyphs', kind: 'reference', isInstance: () => false, members: [indexer('glyph', 'String?', { parameters: [createValueParameterDeclaration('index', 'Number')] })] }] });

            expectResolutionCode('words.glyph(s, 1)', 'LEXICA3011', 'validation', values, [words]);
        });
        it('LEXICA3071, a function given to a value parameter', () => expectResolutionCode('let g = x => x\nreturn s.pad(g)', 'LEXICA3071'));
        it('LEXICA3006, a fixed argument resolution cannot settle', () => expectResolutionCode('s.flavored(s.partner ?? "size")', 'LEXICA3006'));
        it('LEXICA3007, a fixed argument whose settled value is null', () => expectResolutionCode('s.flavored(nothing)', 'LEXICA3007'));
        it('LEXICA3050, a type selector\'s key it maps to no type', () => expectResolutionCode('s.flavored("bitter")', 'LEXICA3050'));
        it('LEXICA3046, a read of an option its member declares as an expression', () => expectResolutionCode('xs.rank({ by = it, limit = by })', 'LEXICA3046'));
        it('LEXICA3500, an expression argument to a member whose receiver is not a list', () => expectResolutionCode('s.scan(1)', 'LEXICA3500'));
        it('LEXICA3500, an expression argument to a module member', () => expectResolutionCode('shop.sweep(1)', 'LEXICA3500'));
        it('LEXICA3028, a type parameter no argument binds', () => expectResolutionCode('if shop.make() then 1 else 2 end', 'LEXICA3028'));
        it('LEXICA3028, a predicate of a type parameter no argument binds', () => expectResolutionCode('xs.where(shop.make())', 'LEXICA3028'));
        it('LEXICA3028, a result, a field or an operand of a type parameter no argument binds', () => {
            for (const text of ['shop.make()', '{ a = shop.make() }', 'shop.make() + 1', 'shop.make() == 1', 'shop.make() ?? 1', 'shop.make().size']) {
                expectResolutionCode(text, 'LEXICA3028');
            }
        });
    });

    describe('functions', () => {
        it('LEXICA3033, a call no local function answers', () => expectResolutionCode('nofunc(1)', 'LEXICA3033'));
        it('LEXICA3068, a call of a local holding a value', () => expectResolutionCode('let v = 1\nreturn v(2)', 'LEXICA3068'));
        it('LEXICA3068, a call of a function that may be null', () => expectResolutionCode('let g = x => x\nlet f = if s.size > 1 then g else null end\nreturn f(1)', 'LEXICA3068'));
        it('LEXICA3069, a local function given the wrong number of arguments', () => expectResolutionCode('let f = x => x\nreturn f(1, 2)', 'LEXICA3069'));
        it('LEXICA3080, a delegate that may be a module delegate given too few arguments', () => expectResolutionCode('let g = a => a\nlet f = if s.size > 1 then shop.pad else g end\nreturn f(s)', 'LEXICA3080'));
        it('LEXICA3058, a delegate that may be a module delegate given too many arguments', () => expectResolutionCode('let g = (a, b, c) => a\nlet f = if s.size > 1 then shop.pad else g end\nreturn f(s, 1, 2)', 'LEXICA3058'));
        it('LEXICA3079, a delegate that may be a module delegate whose arguments are no values alone', () => expectResolutionCode('let g = (a, b) => true\nlet f = if s.size > 1 then shop.check else g end\nreturn f(s, 1)', 'LEXICA3079'));
        it('LEXICA3042, a delegate that may be a module delegate given a receiver of the wrong type', () => expectResolutionCode('let g = x => x\nlet f = if s.size > 1 then shop.wipe else g end\nreturn f(1)', 'LEXICA3042'));
        it('LEXICA3070, a call whose functions give no one type', () => expectResolutionCode('let a = x => 1\nlet g = x => "a"\nlet f = if s.size > 1 then a else g end\nreturn f(1)', 'LEXICA3070'));
        it('LEXICA3034, a call reaching a function within its own call', () => expectResolutionCode('let f = g => g(g)\nreturn f(f)', 'LEXICA3034'));
        it('LEXICA3035, a result that would hold a function', () => expectResolutionCode('let f = x => x\nreturn f', 'LEXICA3035'));
        it('LEXICA3035, a field that would hold a function', () => expectResolutionCode('{ let f = x => x, a = f }', 'LEXICA3035'));
        it('LEXICA3036, a function of another number of parameters given to a function parameter', () => expectResolutionCode('s.check((a, b) => true)', 'LEXICA3036'));
        it('LEXICA3036, a function of a result of another type given to a function parameter', () => expectResolutionCode('s.check(x => 1)', 'LEXICA3036'));
        it('LEXICA3036, an implicit body of a result of another type', () => expectResolutionCode('s.check(it.size)', 'LEXICA3036'));
        it('LEXICA3036, a held function reference that does not take the contract', () => expectResolutionCode('let f = shop.pad\nreturn s.check(f)', 'LEXICA3036'));
        it('LEXICA3072, a function that may be null given to a function parameter', () => expectResolutionCode('let g = x => true\nlet f = if s.size > 1 then g else null end\nreturn s.check(f)', 'LEXICA3072'));
        it('LEXICA3073, a value that is not a function given to a function parameter', () => expectResolutionCode('s.check(flag)', 'LEXICA3073'));
        it('LEXICA3074, an expression argument that reads it and gives a function', () => expectResolutionCode('let g = x => 1\nreturn xs.max(if it > 0 then g else g end)', 'LEXICA3074'));
        it('LEXICA3037, a function reference no declaration of its name takes', () => expectResolutionCode('s.check(shop.pad)', 'LEXICA3037'));
        it('LEXICA3075, a function reference several declarations take', () => expectResolutionCode('let t = shop.fits\nreturn s.check(t)', 'LEXICA3075'));
        it('LEXICA3076, a function reference naming a property', () => expectResolutionCode('let r = shop.size\nreturn 1', 'LEXICA3076'));
        it('LEXICA3076, a function reference naming a host call', () => expectResolutionCode('let r = shop.hold\nreturn 1', 'LEXICA3076'));
    });

    describe('operators', () => {
        it('LEXICA3030, an equality of types that fit neither way', () => expectResolutionCode('s == 1', 'LEXICA3030'));
        it('LEXICA3066, an equality of a value that is no string, number, Boolean or reference with one that is not null', () => expectResolutionCode('xs == ys', 'LEXICA3066'));
        it('LEXICA3048, a host call as a condition', () => expectResolutionCode('if s.order(1) then 1 else 2 end', 'LEXICA3048'));
        it('LEXICA3048, a host call as an operand of not', () => expectResolutionCode('not s.order(1)', 'LEXICA3048'));
        it('LEXICA3048, a host call as an operand of and', () => expectResolutionCode('flag and s.order(1)', 'LEXICA3048'));
        it('LEXICA3048, a host call as a conditional binding', () => expectResolutionCode('if let n = s.order(1) then n else 2 end', 'LEXICA3048'));
        it('LEXICA3032, an arithmetic operand that can be null', () => expectResolutionCode('s.partner + 1', 'LEXICA3032'));
        it('LEXICA3067, an arithmetic operand that is not a number', () => expectResolutionCode('s + 1', 'LEXICA3067'));
        it('LEXICA3039, a comparison operand that can be null', () => expectResolutionCode('s.partner < 1', 'LEXICA3039'));
        it('LEXICA3078, a comparison operand that is not a number', () => expectResolutionCode('s < 1', 'LEXICA3078'));
        it('LEXICA3038, an interpolation of a value that can be null', () => expectResolutionCode('$"{s.partner}"', 'LEXICA3038'));
        it('LEXICA3077, an interpolation of no string or number', () => expectResolutionCode('$"{s.size > 1}"', 'LEXICA3077'));
        it('LEXICA3040, an and whose operands give values no one type holds', () => expectResolutionCode('(s.size > 1) and "a"', 'LEXICA3040'));
        it('LEXICA3041, branches of different types', () => expectResolutionCode('if s.size > 1 then 1 else "a" end', 'LEXICA3041'));
        it('LEXICA3041, a coalescing operator\'s value and fallback of different types', () => expectResolutionCode('s.partner ?? 1', 'LEXICA3041'));
    });

    describe('casts and conversions', () => {
        it('LEXICA3019, a cast to a type nothing declares', () => expectResolutionCode('s as Foo', 'LEXICA3019'));
        it('LEXICA3019, a conversion to a type nothing declares', () => expectResolutionCode('s to Foo', 'LEXICA3019'));
        it('LEXICA3004, a type qualified by a local name no import gives a module', () => {
            expectResolutionCode('s to elsewhere.Cup', 'LEXICA3004');
            expect(refusalWithoutImportsOf('s to shop.Cup')).toMatchObject({ code: 'LEXICA3004', message: expect.stringContaining("'shop.Cup' is qualified by 'shop', which no import of the script gives a module: write 'import shop' at the script's start") });
            expect(refusalWithoutImportsOf('import Shop = shop\ns to shop.Cup')).toMatchObject({ code: 'LEXICA3004', location: { pointer: '/expression' } });
        });
        it('LEXICA3019, a type qualified by a module that does not declare it', () => expectResolutionCode('s to shop.Mug', 'LEXICA3019'));
        it('LEXICA3059, a type several modules share unqualified', () => {
            const mugs = lexica.createModule('mugs', { types: [{ name: 'Cup', kind: 'structured', members: dataPropertyDeclarations({ size: 'Number' }) }] });

            expectResolutionCode('s to Cup', 'LEXICA3059', 'validation', values, [mugs]);
        });
        it('LEXICA3020, a cast to a name that is not a reference type', () => expectResolutionCode('s as Number', 'LEXICA3020'));
        it('LEXICA3060, a cast of a target that can never be of its type', () => {
            expectResolutionCode('s as Light', 'LEXICA3060');
            expectResolutionCode('room as Light', 'LEXICA3060', 'validation', { ...values, room: new Room('kitchen') });
        });
        it('LEXICA3021, a conversion to a type that is not data', () => expectResolutionCode('s to Device', 'LEXICA3021'));
        it('LEXICA3022, a conversion no conversion operator joins', () => expectResolutionCode('s.size to Cup', 'LEXICA3022'));
    });

    describe('objects, root and results', () => {
        it('LEXICA3043, a result that would contain a reference value', () => {
            expectResolutionCode('s.device', 'LEXICA3043');
            expectResolutionCode('lamp', 'LEXICA3043', 'validation', { ...values, lamp: new Light('lamp') });
        });
        it('LEXICA3043, a field that would contain a reference value', () => expectResolutionCode('{ a = s.device }', 'LEXICA3043'));
        it('LEXICA3044, a field read through root that is not completed there', () => expectResolutionCode('{ a = root.b, b = 1 }', 'LEXICA3044'));
        it('LEXICA3047, a field that would hold root', () => expectResolutionCode('{ a = 1, b = root }', 'LEXICA3047'));
    });

    describe('host calls', () => {
        it('LEXICA3048, a host call in a field', () => expectResolutionCode('{ a = s.order(1) }', 'LEXICA3048'));
        it('LEXICA3048, a host call as an arithmetic operand', () => expectResolutionCode('s.order(1) + 1', 'LEXICA3048'));
        it('LEXICA3048, a host call in an interpolation', () => expectResolutionCode('$"{s.order(1)}"', 'LEXICA3048'));
        it('LEXICA3048, a host call as an argument', () => expectResolutionCode('s.pad(s.order(1))', 'LEXICA3048'));
        it('LEXICA3048, a host call as a receiver', () => expectResolutionCode('s.order(1).size', 'LEXICA3048'));
        it('LEXICA3048, a host call compared', () => expectResolutionCode('s.order(1) == 1', 'LEXICA3048'));
        it('LEXICA3048, a host call as a coalescing operator\'s value', () => expectResolutionCode('s.order(1) ?? 1', 'LEXICA3048'));
        it('LEXICA3048, a host call as a branch', () => expectResolutionCode('if flag then s.order(1) else 1 end', 'LEXICA3048'));
        it('LEXICA3048, a host call converted', () => expectResolutionCode('s.order(1) to String', 'LEXICA3048'));
        it('LEXICA3048, a host call as a local\'s value', () => expectResolutionCode('let a = s.order(1)\nreturn a', 'LEXICA3048'));
        it('LEXICA3048, a host call as a function\'s result', () => expectResolutionCode('let f = x => s.order(x)\nreturn f(1)', 'LEXICA3048'));
        it('LEXICA3049, a result projection after a host call that declares no result', () => expectResolutionCode('s.hold() { a = it }', 'LEXICA3049'));
    });
});
