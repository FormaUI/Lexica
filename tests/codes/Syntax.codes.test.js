import { describe, it, expect } from 'vitest';
import { lexica, LexicaError } from '#lexica/lexica.js';
import { Tokenizer } from '#lexica/language/Tokenizer.mjs';
import { errorThrownBy } from '../support/errors.mjs';

/** A registry of one module, `shop`, whose name begins its namespace in the text it reads. */
const createShopRegistry = () => lexica.createRegistry([lexica.createModule('shop', { members: [] })]);

/** Expects each text to fail to parse with a syntax error of the code. */
const expectSyntaxCode = (code, texts, parse = lexica.parse) => {
    for (const text of texts) {
        const error = errorThrownBy(() => parse(text));

        expect(error, text).toBeInstanceOf(LexicaError);
        expect({ text, code: error.code, kind: error.kind }).toEqual({ text, code, kind: 'syntax' });
    }
};

describe('the codes of syntax errors', () => {
    describe('the parser', () => {
        it('gives LEXICA1000 to text that does not follow the syntax', () => {
            expectSyntaxCode('LEXICA1000', [
                'let f = function(1) 1 end return f',
                'let f = function(a b) 1 end return f',
                'a.b(1 2)',
                'if a',
                '{ a = 1 b = 2 }',
                '{ a = 1 2 }',
                '{ let x = 1 2 }',
                'a as 1',
                'a as B.1',
                ')',
                '$"{a, b}"',
                'a.1',
                '(a',
                '1 )',
                '1 end',
            ]);
        });

        it('gives LEXICA1029 to a function or a do block without its end', () => {
            expectSyntaxCode('LEXICA1029', ['let f = function() 1', 'do 1']);
        });

        it('gives LEXICA1505 to a conditional without its else', () => {
            expectSyntaxCode('LEXICA1505', ['if a then b']);
        });

        it('gives LEXICA1507 to a question mark after the dot of a computed property access', () => {
            expectSyntaxCode('LEXICA1507', ['a.?[p]']);
        });

        it('gives LEXICA1508 to an argument after a dot written without parentheses', () => {
            expectSyntaxCode('LEXICA1508', ['a.b "x"']);
        });

        it('gives LEXICA1511 to a function or a do block with an empty body', () => {
            expectSyntaxCode('LEXICA1511', ['let f = function() end return f', 'do end']);
        });

        it('gives LEXICA1051 to a local or a conditional binding written without its name', () => {
            expectSyntaxCode('LEXICA1051', ['let = 1 return 1', 'if let = 1 then 1 else 2 end']);
        });

        it('gives LEXICA1013 to a comparison written without its left operand', () => {
            expectSyntaxCode('LEXICA1013', ['< a']);
        });

        it('gives LEXICA1506 to a module name read with no member after its dot', () => {
            const registry = createShopRegistry();

            expectSyntaxCode('LEXICA1506', ['shop', 'shop?.open'], text => registry.parse(text));
            expect(errorThrownBy(() => registry.parse('shop')).message).toContain("write '@shop' for the local, object field, conditional binding or function parameter of that name, or '~shop' for the script parameter");
        });

        it('gives LEXICA1001 to a comparison operator written with whitespace inside it', () => {
            expectSyntaxCode('LEXICA1001', ['a < = b', 'a > = b', 'a = = b', 'let f = a = > 1 return f', 'a ? . b', 'a ? ? b', 'a ? [0]', '( ? a.b)', 'a ! = b']);
        });

        it('gives LEXICA1003 to a colon after a name that takes its value after =', () => {
            expectSyntaxCode('LEXICA1003', ['{ count: 1 }', 'let x: 1 return x', 'if let k: 1 then k else 2 end']);
        });

        it('gives LEXICA1004 to = where no name takes its value', () => {
            expectSyntaxCode('LEXICA1004', ['a = b', 'if a = b then 1 else 2 end', 'let x = = 1 return x', '{ a = = 1 }']);
        });

        it('gives LEXICA1008 to @ in a declaration or before a member name', () => {
            expectSyntaxCode('LEXICA1008', ['let f = function(@x) x end return f', 'a.@b', 'let @to = 1 return 1', '{ @true = 1 }']);
            expectSyntaxCode('LEXICA1008', ['shop.@open'], text => createShopRegistry().parse(text));
        });

        it('gives LEXICA1010 to a keyword where a value stands', () => {
            expectSyntaxCode('LEXICA1010', ['1 + as', '{ a = to }', 'to Number', 'a + then', 'if a then end']);
            expect(errorThrownBy(() => lexica.parse('{ a = to }')).message).toContain("Found 'to', a keyword: write '@to' for the local, object field, conditional binding or function parameter of that name");
        });

        it('gives LEXICA1011 to a member name after a value without its dot', () => {
            expectSyntaxCode('LEXICA1011', ['device active', 'a.b c(1)']);
        });

        it('gives LEXICA1012 to an argument written as a named one', () => {
            expectSyntaxCode('LEXICA1012', ['a.b(name = 1)', 'a.b(name: 1)', 'f(x = 1)']);
        });

        it('gives LEXICA1013 to an equality without its left operand', () => {
            expectSyntaxCode('LEXICA1013', ['== a', 'a + != b']);
        });

        it('gives LEXICA1014 to a colon in a chain that names no extension', () => {
            expectSyntaxCode('LEXICA1014', ['it:["mode"]', 'it?:["mode"]']);
        });

        it('gives LEXICA1015 to an optional enclosed access written directly as an argument', () => {
            expectSyntaxCode('LEXICA1015', ['a.b(?c.d)', 'f(?c.d)']);
        });

        it('gives LEXICA1016 to an optional enclosed access of no access, or holding more than its chain', () => {
            expectSyntaxCode('LEXICA1016', ['(?a)', '(?a.b + 1)']);
        });

        it('gives LEXICA1017 to an indexer of no key or of several', () => {
            expectSyntaxCode('LEXICA1017', ['a.b[]', 'a[1, 2]']);
        });

        it('gives LEXICA1018 to an object expression with no field', () => {
            expectSyntaxCode('LEXICA1018', ['{ }', '{ let x = 1, }', '{ let x = 1 }']);
        });

        it('gives LEXICA1019 to a comparison chain whose operators point two ways', () => {
            expectSyntaxCode('LEXICA1019', ['a < b > c', 'a >= b <= c']);
        });

        it('gives LEXICA1020 to a chained equality', () => {
            expectSyntaxCode('LEXICA1020', ['a == b == c', 'a != b == c']);
        });

        it('gives LEXICA1021 to ?? beside an operator without a group', () => {
            expectSyntaxCode('LEXICA1021', ['not a ?? b', 'a == b ?? c', 'a < b ?? c', 'a ?? not b', 'a ?? b == c', 'a + 1 ?? b', 'a ?? b + 1', 'a ?? b and c', 'a ?? b or c']);
        });

        it('gives LEXICA1022 to try before anything but one cast or one conversion', () => {
            expectSyntaxCode('LEXICA1022', ['try try a to Number', 'try a', 'try a to String to Number', 'try a as B to String']);
            expect(errorThrownBy(() => lexica.parse('try a to Home.Light to Number')).message).toContain("as in 'try (… to Home.Light) to Number'");
        });

        it('gives LEXICA1024 to casts chained without a group', () => {
            expectSyntaxCode('LEXICA1024', ['a as B as C']);
        });

        it('gives LEXICA1023 to an attempt as a cast target', () => {
            expectSyntaxCode('LEXICA1023', ['(try a as Device) as Light', '(try a to String) as Light']);
        });

        it('gives LEXICA1025 to a cast whose target no text writes', () => {
            expectSyntaxCode('LEXICA1025', ['a to String as Light', '(if a then b else c end) as Light', '(a.b) as Light', '(?((a.b) as Light).c)', '(?((a ?? b).c as Light).d)', '(try a as Device).b as Light']);
        });

        it('gives LEXICA1026 to a string where a cast or a conversion names its type', () => {
            expectSyntaxCode('LEXICA1026', ['a as "Light"', "a to 'Number'"]);
        });

        it('gives LEXICA1027 to a conditional or a do block used ungrouped as a condition or an operand', () => {
            expectSyntaxCode('LEXICA1027', ['if if a then b else c end then 1 else 2 end', '1 + if a then b else c end', '1 + do 1 end']);
        });

        it('gives LEXICA1028 to a conditional or a do block that is the receiver of a chain', () => {
            expectSyntaxCode('LEXICA1028', ['(if a then b else c end).d', 'do 1 end.x']);
        });

        it('gives LEXICA1029 to a conditional without its end', () => {
            expectSyntaxCode('LEXICA1029', ['if a then b else c', 'if a then b else c )']);
        });

        it('gives LEXICA1030 to locals whose body has no return', () => {
            expectSyntaxCode('LEXICA1030', ['let x = 1', 'let x = 1\nx']);
        });

        it('gives LEXICA1031 to an expression no local holds before a return', () => {
            expectSyntaxCode('LEXICA1031', ['a.b return 1', 'let x = 1\na.b return x']);
        });

        it('gives LEXICA1032 to a local declaration or a return where a value stands', () => {
            expectSyntaxCode('LEXICA1032', ['a.b(let x = 1)', 'a.b(return 1)', '1 + return 2']);
        });

        it('gives LEXICA1033 to return among the fields', () => {
            expectSyntaxCode('LEXICA1033', ['{ return 1 }', '{ a = 1, return a }']);
        });

        it('gives LEXICA1034 to a function that is not a local initializer', () => {
            expectSyntaxCode('LEXICA1034', ['1 + function() 1 end', '{ a = function() 1 end }']);
        });

        it('gives LEXICA1035 to a regular function written directly as an argument', () => {
            expectSyntaxCode('LEXICA1035', ['a.b(function(x) x end)']);
        });

        it('gives LEXICA1036 to an arrow function whose body is no simple expression', () => {
            expectSyntaxCode('LEXICA1036', ['a.b(x => return 1)', 'a.b(x => let y = 1)', 'a.b(x => y => y)']);
        });

        it('gives LEXICA1039 to an empty interpolation', () => {
            expectSyntaxCode('LEXICA1039', ['$"{}"']);
        });

        it('gives LEXICA1051 to a field written without its name', () => {
            expectSyntaxCode('LEXICA1051', ['{ = 1 }', '{ it.size }', '{ size }', '{ "a" = 1 }', '{ 1 = 2 }']);
        });

        it('gives LEXICA1052 to a comparison beside an equality without a group', () => {
            expectSyntaxCode('LEXICA1052', ['a == b < c', 'a < b == c']);
        });

        it('gives LEXICA1053 to a chain continuing a cast without a group', () => {
            expectSyntaxCode('LEXICA1053', ['a as Light[0]', 'a as Light?.b']);
            expect(errorThrownBy(() => lexica.parse('a as Home . Light[0]')).message).toContain("write '(… as Home.Light)…'");
        });

        it('gives LEXICA1054 to a conditional whose branches give their results in two styles', () => {
            expectSyntaxCode('LEXICA1054', ['if a then return 1 else 2 end']);
        });

        it('gives LEXICA1055 to anything after a body result', () => {
            expectSyntaxCode('LEXICA1055', [
                'let x = 1 return x let y = 2',
                'let x = 1 return x return x',
                '1 2',
                'let x = 1 return (x) 5',
                'let f = function() return 1 2 end return f',
                'do return 1 2 end',
                'if a then 1 2 else 3 end',
                'if a then 1 else 3 4 end',
            ]);
        });

        it('gives LEXICA1056 to a return with no value', () => {
            expectSyntaxCode('LEXICA1056', ['let x = 1 return', 'if a then let x = 1 return else 2 end']);
        });

        it('gives LEXICA1057 to an arrow function that is neither a local initializer nor an argument', () => {
            expectSyntaxCode('LEXICA1057', ['1 + x => x', '{ a = x => x }']);
        });

        it('gives LEXICA1500, temporarily, to a colon naming what would be an extension', () => {
            expectSyntaxCode('LEXICA1500', ['device:setting["mode"]', 'a.b ?: c']);
        });

        it('gives LEXICA1501 to a chain continuing a conversion without a group', () => {
            expectSyntaxCode('LEXICA1501', ['a to Number[0]', 'a to Number?.b']);
            expect(errorThrownBy(() => lexica.parse('a to Home /* its */ . Reading[0]')).message).toContain("as in '(… to Home.Reading).value'");
        });

        it('gives LEXICA1502 to an optional enclosed access whose receiver is neither an input nor a grouped cast', () => {
            expectSyntaxCode('LEXICA1502', ['(?(?a.b).c)', '(?(a.b).c)']);
        });

        it('gives LEXICA1503 to a name an argument follows after a space, written as a member without its receiver', () => {
            expectSyntaxCode('LEXICA1503', ['count "x"', 'count 1']);
        });

        it('gives LEXICA1504 to a local written after a field of its object expression', () => {
            expectSyntaxCode('LEXICA1504', ['{ a = 1, let b = 2 }']);
        });
    });

    describe('the tokenizer', () => {
        it('gives LEXICA1000 to text that is no token', () => {
            expectSyntaxCode('LEXICA1000', ['a # b']);
        });

        it('gives LEXICA1509 to a lone exclamation mark', () => {
            expectSyntaxCode('LEXICA1509', ['a ! b']);
        });

        it('gives LEXICA1510 to a string never closed', () => {
            expectSyntaxCode('LEXICA1510', ['"abc', "'abc", '$"abc', '$"{a}']);
        });

        it('gives LEXICA1005 to $ anywhere but directly before a quote', () => {
            expectSyntaxCode('LEXICA1005', ['$ "a"', '$a']);
        });

        it('gives LEXICA1006 to an escape no string takes', () => {
            expectSyntaxCode('LEXICA1006', ['"\\q"', '"\\{"', '"\\u0041"', '"\\u{}"', '$"\\q"']);
        });

        it('gives LEXICA1007 to an unclosed block comment', () => {
            expectSyntaxCode('LEXICA1007', ['a /* b']);
        });

        it('gives LEXICA1009 to ~ with no identifier directly after it', () => {
            expectSyntaxCode('LEXICA1009', ['~ a', '~1']);
        });

        it('gives LEXICA1037 to a line break in an inline string', () => {
            expectSyntaxCode('LEXICA1037', ['"a\nb"', "'a\nb'", '$"a\nb"']);
        });

        it('gives LEXICA1038 to a block whose opening delimiter has anything after it on its line', () => {
            expectSyntaxCode('LEXICA1038', ['"""  \nabc\n"""', '"""abc"""', '$"""abc"""']);
        });

        it('gives LEXICA1040 to an interpolation holding a line break, a line comment or a block', () => {
            expectSyntaxCode('LEXICA1040', ['$"{a\n}"', '$"{a // c\n}"', '$"{a /* \n */}"', '$"{"""\nx\n"""}"']);
        });

        it('gives LEXICA1049 to a Unicode escape naming a surrogate or a value above 10FFFF', () => {
            expectSyntaxCode('LEXICA1049', ['"\\u{D800}"', '"\\u{110000}"']);
        });

        it('gives LEXICA1050 to @ with no identifier directly after it', () => {
            expectSyntaxCode('LEXICA1050', ['@ a', '@', '@1']);
        });

        it('gives LEXICA1058 to a block never closed', () => {
            expectSyntaxCode('LEXICA1058', ['"""\nabc', "$'''\nabc"]);
        });

        it('gives LEXICA1059 to a block whose closing run is longer than its delimiter', () => {
            expectSyntaxCode('LEXICA1059', ['"""\nabc\n""""']);
        });

        it('gives LEXICA1060 to a run of quotes in a block as long as its delimiter', () => {
            expectSyntaxCode('LEXICA1060', ['"""\na """ b\n"""']);
        });

        it('gives LEXICA1061 to a block line that lacks its margin', () => {
            expectSyntaxCode('LEXICA1061', ['"""\n  a\n b\n  """']);
        });

        it('gives LEXICA1062 to a lone } in an interpolated string', () => {
            expectSyntaxCode('LEXICA1062', ['$"a } b"']);
        });

        it('gives LEXICA1063 to an interpolation beginning with an object expression', () => {
            expectSyntaxCode('LEXICA1063', ['$"{ { x = 1 }.x}"', '$"{/* c */{ x = 1 }.x}"']);
        });

        it('keeps the code of each diagnostic on the invalid tokens of a tolerant reading', () => {
            const tokens = Tokenizer.scan('a ! b "\\q" @ $"x } y"');
            const diagnostics = tokens.filter(token => token.type === 'invalid').map(token => token.diagnostic);

            expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(['LEXICA1509', 'LEXICA1006', 'LEXICA1050', 'LEXICA1062']);
            diagnostics.forEach(diagnostic => expect(diagnostic).toEqual({ code: expect.any(String), message: expect.any(String), offset: expect.any(Number) }));
        });

        it('gives the strict reading the code of the tolerant reading', () => {
            const text = 'a + "\\u{D800}"';
            const [invalid] = Tokenizer.scan(text).filter(token => token.type === 'invalid');

            expect(errorThrownBy(() => new Tokenizer(text).tokenize())).toMatchObject({ code: invalid.diagnostic.code, kind: 'syntax' });
        });
    });
});
