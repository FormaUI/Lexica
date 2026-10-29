import { describe, it, expect } from 'vitest';
import { nexo, NexoError } from '#nexo/nexo.js';
import { Tokenizer } from '#nexo/language/Tokenizer.mjs';
import { errorThrownBy } from '../support/errors.mjs';

/** Expects each text to fail to parse with a syntax error of the code. */
const expectSyntaxCode = (code, texts, parse = nexo.parse) => {
    for (const text of texts) {
        const error = errorThrownBy(() => parse(text));

        expect(error, text).toBeInstanceOf(NexoError);
        expect({ text, code: error.code, kind: error.kind }).toEqual({ text, code, kind: 'syntax' });
    }
};

describe('the codes of syntax errors', () => {
    describe('the parser', () => {
        it('gives NEXO1000 to text that does not follow the syntax', () => {
            expectSyntaxCode('NEXO1000', [
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

        it('gives NEXO1029 to a function or a do block without its end', () => {
            expectSyntaxCode('NEXO1029', ['let f = function() 1', 'do 1']);
        });

        it('gives NEXO1505 to a conditional without its else', () => {
            expectSyntaxCode('NEXO1505', ['if a then b']);
        });

        it('gives NEXO1507 to a question mark after the dot of a computed property access', () => {
            expectSyntaxCode('NEXO1507', ['a.?[p]']);
        });

        it('gives NEXO1508 to an argument after a dot written without parentheses', () => {
            expectSyntaxCode('NEXO1508', ['a.b "x"']);
        });

        it('gives NEXO1511 to a function or a do block with an empty body', () => {
            expectSyntaxCode('NEXO1511', ['let f = function() end return f', 'do end']);
        });

        it('gives NEXO1051 to a local or a conditional binding written without its name', () => {
            expectSyntaxCode('NEXO1051', ['let = 1 return 1', 'if let = 1 then 1 else 2 end']);
        });

        it('gives NEXO1013 to a comparison written without its left operand', () => {
            expectSyntaxCode('NEXO1013', ['< a']);
        });

        it('gives NEXO1506 to a namespace read with no member after its dot', () => {
            expectSyntaxCode('NEXO1506', ['import shop\nshop', 'import shop\nshop?.open', 'shop'], text => nexo.parse(text, { imports: text.startsWith('import') ? [] : ['shop'] }));
            expect(errorThrownBy(() => nexo.parse('import shop\nshop')).message).toContain("write '@shop' for the local, object field, conditional binding or function parameter of that name, or '~shop' for the script parameter");
        });

        it('gives NEXO1001 to a comparison operator written with whitespace inside it', () => {
            expectSyntaxCode('NEXO1001', ['a < = b', 'a > = b', 'a = = b', 'let f = a = > 1 return f', 'a ? . b', 'a ? ? b', 'a ? [0]', '( ? a.b)', 'a ! = b']);
        });

        it('gives NEXO1003 to a colon after a name that takes its value after =', () => {
            expectSyntaxCode('NEXO1003', ['{ count: 1 }', 'let x: 1 return x', 'if let k: 1 then k else 2 end']);
        });

        it('gives NEXO1004 to = where no name takes its value', () => {
            expectSyntaxCode('NEXO1004', ['a = b', 'if a = b then 1 else 2 end', 'let x = = 1 return x', '{ a = = 1 }']);
        });

        it('gives NEXO1008 to @ in a declaration or before a member name', () => {
            expectSyntaxCode('NEXO1008', ['let f = function(@x) x end return f', 'a.@b', 'let @to = 1 return 1', '{ @true = 1 }']);
            expectSyntaxCode('NEXO1008', ['shop.@open'], text => nexo.parse(text, { imports: ['shop'] }));
        });

        it('gives NEXO1010 to a keyword where a value stands', () => {
            expectSyntaxCode('NEXO1010', ['1 + as', '{ a = to }', 'to Number', 'a + then', 'if a then end']);
            expect(errorThrownBy(() => nexo.parse('{ a = to }')).message).toContain("Found 'to', a keyword: write '@to' for the local, object field, conditional binding or function parameter of that name");
            expect(errorThrownBy(() => nexo.parse('import to = Home\nto.rooms')).message).toContain("write '@to' for the local, object field, conditional binding or function parameter of that name, or, where none is in scope, the namespace the script's import gives that name");
        });

        it('reads import as a keyword, refused where a value stands, its parameter read with ~ and a member of its name after a dot', () => {
            expectSyntaxCode('NEXO1000', ['import', 'import Home.', 'import A =', 'import 1']);
            expect(nexo.parse('~import').expression).toEqual({ kind: 'scriptParameter', name: 'import' });
            expect(nexo.parse('item.import').expression).toEqual({ kind: 'memberAccess', receiver: { kind: 'scriptParameter', name: 'item' }, name: 'import' });
            expect(nexo.format({ version: 36, imports: [], expression: { kind: 'scriptParameter', name: 'import' } })).toBe('~import');
        });

        it('gives NEXO1044 to an import, or the body after the imports, sharing its line with earlier code', () => {
            expectSyntaxCode('NEXO1044', ['import Home import Energy\n1', 'import Home 1', 'import Home Home.rooms', 'import Home /* */ import Energy\n1']);
            expect(errorThrownBy(() => nexo.parse('import Home\nimport Energy Energy.usage'))).toMatchObject({ message: expect.stringContaining('The body after the imports starts on a line of its own'), location: { line: 2, column: 15 } });
            expect(nexo.parse('// the home\nimport Home // its rooms\r\nimport Energy\n\nHome.rooms').imports).toEqual([{ module: 'Energy' }, { module: 'Home' }]);
            expect(errorThrownBy(() => nexo.parse('import Home'))).toMatchObject({ code: 'NEXO1000', message: expect.stringContaining('Expected a value, found the end of the source') });
        });

        it("gives NEXO1045 to an import anywhere but the script's start, after its first local, within its expression or after its result", () => {
            expectSyntaxCode('NEXO1045', ['1 + import', '{ a = import }', 'let a = 1\nimport Home\nreturn a', 'a\nimport Home', 'return a\nimport Home', '{ a = 1 }\nimport Home', 'do 1\nimport Home end']);
            expect(errorThrownBy(() => nexo.parse('a\nimport Home'))).toMatchObject({ message: expect.stringContaining('Imports stand at the start of the script'), location: { line: 2, column: 1 } });
        });

        it("gives NEXO1046 to an import of Nexo's own module or of one of its types", () => {
            expectSyntaxCode('NEXO1046', ['import Nexo\n1', 'import Items = Nexo.List\n1', 'import Nexo.Number\n1']);
            expect(errorThrownBy(() => nexo.parse('import Items = Nexo.List\n1'))).toMatchObject({ message: expect.stringContaining("Nexo's own vocabulary is always available"), location: { column: 16 } });
        });

        it('gives NEXO1048 to two imports giving one local name to different declarations, naming both, and takes one declaration under one name twice', () => {
            expectSyntaxCode('NEXO1048', ['import Measures = Measurements\nimport Measures = Home.Sensor\n1', 'import Home.Sensor\nimport Sensor = Garden.Sensor\n1', 'import Home\nimport Home = Garden\n1']);
            expect(errorThrownBy(() => nexo.parse('import Measures = Measurements\nimport Measures = Home.Sensor\n1'))).toMatchObject({ message: expect.stringContaining("'Measures' is the local name both 'import Measures = Measurements' and 'import Measures = Home.Sensor' give"), location: { line: 2, column: 1 } });
            expect(errorThrownBy(() => nexo.parse('import Home = Garden\n1', { imports: ['Home'] })).code).toBe('NEXO1048');
            expect(nexo.parse('import HomeSensor = Home.Sensor\nimport GardenSensor = Garden.Sensor\nimport Home\nimport Home\n1').imports).toEqual([{ module: 'Garden', type: 'Sensor', alias: 'GardenSensor' }, { module: 'Home' }, { module: 'Home', type: 'Sensor', alias: 'HomeSensor' }]);
        });

        it('gives NEXO1011 to a member name after a value without its dot', () => {
            expectSyntaxCode('NEXO1011', ['device active', 'a.b c(1)']);
        });

        it('gives NEXO1012 to an argument written as a named one', () => {
            expectSyntaxCode('NEXO1012', ['a.b(name = 1)', 'a.b(name: 1)', 'f(x = 1)']);
        });

        it('gives NEXO1013 to an equality without its left operand', () => {
            expectSyntaxCode('NEXO1013', ['== a', 'a + != b']);
        });

        it('gives NEXO1014 to a colon in a chain that names no extension', () => {
            expectSyntaxCode('NEXO1014', ['it:["mode"]', 'it?:["mode"]']);
        });

        it('gives NEXO1015 to an optional enclosed access written directly as an argument', () => {
            expectSyntaxCode('NEXO1015', ['a.b(?c.d)', 'f(?c.d)']);
        });

        it('gives NEXO1016 to an optional enclosed access of no access, or holding more than its chain', () => {
            expectSyntaxCode('NEXO1016', ['(?a)', '(?a.b + 1)']);
        });

        it('gives NEXO1017 to an indexer of no key or of several', () => {
            expectSyntaxCode('NEXO1017', ['a.b[]', 'a[1, 2]']);
        });

        it('gives NEXO1018 to an object expression with no field', () => {
            expectSyntaxCode('NEXO1018', ['{ }', '{ let x = 1, }', '{ let x = 1 }']);
        });

        it('gives NEXO1019 to a comparison chain whose operators point two ways', () => {
            expectSyntaxCode('NEXO1019', ['a < b > c', 'a >= b <= c']);
        });

        it('gives NEXO1020 to a chained equality', () => {
            expectSyntaxCode('NEXO1020', ['a == b == c', 'a != b == c']);
        });

        it('gives NEXO1021 to ?? beside an operator without a group', () => {
            expectSyntaxCode('NEXO1021', ['not a ?? b', 'a == b ?? c', 'a < b ?? c', 'a ?? not b', 'a ?? b == c', 'a + 1 ?? b', 'a ?? b + 1', 'a ?? b and c', 'a ?? b or c']);
        });

        it('gives NEXO1022 to try before anything but one cast or one conversion', () => {
            expectSyntaxCode('NEXO1022', ['try try a to Number', 'try a', 'try a to String to Number', 'try a as B to String']);
            expect(errorThrownBy(() => nexo.parse('try a to Home.Light to Number')).message).toContain("as in 'try (… to Home.Light) to Number'");
        });

        it('gives NEXO1024 to casts chained without a group', () => {
            expectSyntaxCode('NEXO1024', ['a as B as C']);
        });

        it('gives NEXO1023 to an attempt as a cast target', () => {
            expectSyntaxCode('NEXO1023', ['(try a as Device) as Light', '(try a to String) as Light']);
        });

        it('gives NEXO1025 to a cast whose target no text writes', () => {
            expectSyntaxCode('NEXO1025', ['a to String as Light', '(if a then b else c end) as Light', '(a.b) as Light', '(?((a.b) as Light).c)', '(?((a ?? b).c as Light).d)', '(try a as Device).b as Light']);
        });

        it('gives NEXO1026 to a string where a cast or a conversion names its type', () => {
            expectSyntaxCode('NEXO1026', ['a as "Light"', "a to 'Number'"]);
        });

        it('gives NEXO1027 to a conditional or a do block used ungrouped as a condition or an operand', () => {
            expectSyntaxCode('NEXO1027', ['if if a then b else c end then 1 else 2 end', '1 + if a then b else c end', '1 + do 1 end']);
        });

        it('gives NEXO1028 to a conditional or a do block that is the receiver of a chain', () => {
            expectSyntaxCode('NEXO1028', ['(if a then b else c end).d', 'do 1 end.x']);
        });

        it('gives NEXO1029 to a conditional without its end', () => {
            expectSyntaxCode('NEXO1029', ['if a then b else c', 'if a then b else c )']);
        });

        it('gives NEXO1030 to locals whose body has no return', () => {
            expectSyntaxCode('NEXO1030', ['let x = 1', 'let x = 1\nx']);
        });

        it('gives NEXO1031 to an expression no local holds before a return', () => {
            expectSyntaxCode('NEXO1031', ['a.b return 1', 'let x = 1\na.b return x']);
        });

        it('gives NEXO1032 to a local declaration or a return where a value stands', () => {
            expectSyntaxCode('NEXO1032', ['a.b(let x = 1)', 'a.b(return 1)', '1 + return 2']);
        });

        it('gives NEXO1033 to return among the fields', () => {
            expectSyntaxCode('NEXO1033', ['{ return 1 }', '{ a = 1, return a }']);
        });

        it('gives NEXO1034 to a function that is not a local initializer', () => {
            expectSyntaxCode('NEXO1034', ['1 + function() 1 end', '{ a = function() 1 end }']);
        });

        it('gives NEXO1035 to a regular function written directly as an argument', () => {
            expectSyntaxCode('NEXO1035', ['a.b(function(x) x end)']);
        });

        it('gives NEXO1036 to an arrow function whose body is no simple expression', () => {
            expectSyntaxCode('NEXO1036', ['a.b(x => return 1)', 'a.b(x => let y = 1)', 'a.b(x => y => y)']);
        });

        it('gives NEXO1039 to an empty interpolation', () => {
            expectSyntaxCode('NEXO1039', ['$"{}"']);
        });

        it('gives NEXO1051 to a field written without its name', () => {
            expectSyntaxCode('NEXO1051', ['{ = 1 }', '{ it.size }', '{ size }', '{ "a" = 1 }', '{ 1 = 2 }']);
        });

        it('gives NEXO1052 to a comparison beside an equality without a group', () => {
            expectSyntaxCode('NEXO1052', ['a == b < c', 'a < b == c']);
        });

        it('gives NEXO1053 to a chain continuing a cast without a group', () => {
            expectSyntaxCode('NEXO1053', ['a as Light[0]', 'a as Light?.b']);
            expect(errorThrownBy(() => nexo.parse('a as Home . Light[0]')).message).toContain("write '(… as Home.Light)…'");
        });

        it('gives NEXO1054 to a conditional whose branches give their results in two styles', () => {
            expectSyntaxCode('NEXO1054', ['if a then return 1 else 2 end']);
        });

        it('gives NEXO1055 to anything after a body result', () => {
            expectSyntaxCode('NEXO1055', [
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

        it('gives NEXO1056 to a return with no value', () => {
            expectSyntaxCode('NEXO1056', ['let x = 1 return', 'if a then let x = 1 return else 2 end']);
        });

        it('gives NEXO1057 to an arrow function that is neither a local initializer nor an argument', () => {
            expectSyntaxCode('NEXO1057', ['1 + x => x', '{ a = x => x }']);
        });

        it('gives NEXO1501 to a chain continuing a conversion without a group', () => {
            expectSyntaxCode('NEXO1501', ['a to Number[0]', 'a to Number?.b']);
            expect(errorThrownBy(() => nexo.parse('a to Home /* its */ . Reading[0]')).message).toContain("as in '(… to Home.Reading).value'");
        });

        it('gives NEXO1502 to an optional enclosed access whose receiver is neither an input nor a grouped cast', () => {
            expectSyntaxCode('NEXO1502', ['(?(?a.b).c)', '(?(a.b).c)']);
        });

        it('gives NEXO1503 to a name an argument follows after a space, written as a member without its receiver', () => {
            expectSyntaxCode('NEXO1503', ['count "x"', 'count 1']);
        });

        it('gives NEXO1504 to a local written after a field of its object expression', () => {
            expectSyntaxCode('NEXO1504', ['{ a = 1, let b = 2 }']);
        });
    });

    describe('the tokenizer', () => {
        it('gives NEXO1002 to U+2028 or U+2029 outside a string\'s literal text, in code, a comment and an interpolation\'s expression alike, naming the character', () => {
            expectSyntaxCode('NEXO1002', ['1 +  2', '1 +  2', '// a b\n1', '/*   */ 1', '$"{1 }"']);
            expect(errorThrownBy(() => nexo.parse('1 +  2'))).toMatchObject({ message: expect.stringContaining('U+2028'), location: { offset: 3 } });
            expect(nexo.parse('"a b"').expression).toEqual({ kind: 'literal', value: 'a b' });
            expect(nexo.parse('$"a {1}"').expression.parts[0]).toEqual({ kind: 'text', value: 'a ' });
        });

        it('breaks a line at LF, CRLF and a lone CR alike, in a diagnostic\'s location and in where a body local\'s value ends', () => {
            for (const lineBreak of ['\n', '\r\n', '\r']) {
                expect(errorThrownBy(() => nexo.parse(`1${lineBreak}${lineBreak}@`)).location, JSON.stringify(lineBreak)).toEqual({ offset: 1 + 2 * lineBreak.length, line: 3, column: 1 });
                expect(errorThrownBy(() => nexo.parse(`let a = 1${lineBreak}b`)), JSON.stringify(lineBreak)).toMatchObject({ code: 'NEXO1030', location: { line: 2, column: 1 } });
            }

            expect(nexo.parse('let a = 1 // one\rreturn a').expression.result).toEqual({ kind: 'local', name: 'a' });
        });

        it('gives NEXO1000 to text that is no token', () => {
            expectSyntaxCode('NEXO1000', ['a # b']);
        });

        it('gives NEXO1509 to a lone exclamation mark', () => {
            expectSyntaxCode('NEXO1509', ['a ! b']);
        });

        it('gives NEXO1510 to a string never closed', () => {
            expectSyntaxCode('NEXO1510', ['"abc', "'abc", '$"abc', '$"{a}']);
        });

        it('gives NEXO1005 to $ anywhere but directly before a quote', () => {
            expectSyntaxCode('NEXO1005', ['$ "a"', '$a']);
        });

        it('gives NEXO1006 to an escape no string takes', () => {
            expectSyntaxCode('NEXO1006', ['"\\q"', '"\\{"', '"\\u0041"', '"\\u{}"', '$"\\q"']);
        });

        it('gives NEXO1007 to an unclosed block comment', () => {
            expectSyntaxCode('NEXO1007', ['a /* b']);
        });

        it('gives NEXO1009 to ~ with no identifier directly after it', () => {
            expectSyntaxCode('NEXO1009', ['~ a', '~1']);
        });

        it('gives NEXO1037 to a line break in an inline string', () => {
            expectSyntaxCode('NEXO1037', ['"a\nb"', "'a\nb'", '$"a\nb"']);
        });

        it('gives NEXO1038 to a block whose opening delimiter has anything after it on its line', () => {
            expectSyntaxCode('NEXO1038', ['"""  \nabc\n"""', '"""abc"""', '$"""abc"""']);
        });

        it('gives NEXO1040 to an interpolation holding a line break, a line comment or a block', () => {
            expectSyntaxCode('NEXO1040', ['$"{a\n}"', '$"{a // c\n}"', '$"{a /* \n */}"', '$"{"""\nx\n"""}"']);
        });

        it('gives NEXO1049 to a Unicode escape naming a surrogate or a value above 10FFFF', () => {
            expectSyntaxCode('NEXO1049', ['"\\u{D800}"', '"\\u{110000}"']);
        });

        it('gives NEXO1050 to @ with no identifier directly after it', () => {
            expectSyntaxCode('NEXO1050', ['@ a', '@', '@1']);
        });

        it('gives NEXO1058 to a block never closed', () => {
            expectSyntaxCode('NEXO1058', ['"""\nabc', "$'''\nabc"]);
        });

        it('gives NEXO1059 to a block whose closing run is longer than its delimiter', () => {
            expectSyntaxCode('NEXO1059', ['"""\nabc\n""""']);
        });

        it('gives NEXO1060 to a run of quotes in a block as long as its delimiter', () => {
            expectSyntaxCode('NEXO1060', ['"""\na """ b\n"""']);
        });

        it('gives NEXO1061 to a block line that lacks its margin', () => {
            expectSyntaxCode('NEXO1061', ['"""\n  a\n b\n  """']);
        });

        it('gives NEXO1062 to a lone } in an interpolated string', () => {
            expectSyntaxCode('NEXO1062', ['$"a } b"']);
        });

        it('gives NEXO1063 to an interpolation beginning with an object expression', () => {
            expectSyntaxCode('NEXO1063', ['$"{ { x = 1 }.x}"', '$"{/* c */{ x = 1 }.x}"']);
        });

        it('keeps the code of each diagnostic on the invalid tokens of a tolerant reading', () => {
            const tokens = Tokenizer.scan('a ! b "\\q" @ $"x } y"');
            const diagnostics = tokens.filter(token => token.type === 'invalid').map(token => token.diagnostic);

            expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(['NEXO1509', 'NEXO1006', 'NEXO1050', 'NEXO1062']);
            diagnostics.forEach(diagnostic => expect(diagnostic).toEqual({ code: expect.any(String), message: expect.any(String), offset: expect.any(Number) }));
        });

        it('gives the strict reading the code of the tolerant reading', () => {
            const text = 'a + "\\u{D800}"';
            const [invalid] = Tokenizer.scan(text).filter(token => token.type === 'invalid');

            expect(errorThrownBy(() => new Tokenizer(text).tokenize())).toMatchObject({ code: invalid.diagnostic.code, kind: 'syntax' });
        });
    });
});
