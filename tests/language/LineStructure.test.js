import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { Tokenizer } from '#nexo/language/Tokenizer.mjs';
import { errorThrownBy } from '../support/errors.mjs';

/** The syntax error parsing the text throws, its code, the start of its message's key part and where it stands. */
const refusalOf = text => errorThrownBy(() => nexo.parse(text));

/** Expects the text refused with the code at the line and column, its message holding the fragment. */
const expectRefused = (text, code, line, column, fragment = '') => expect(refusalOf(text), JSON.stringify(text)).toMatchObject({ code, kind: 'syntax', location: { line, column }, message: expect.stringContaining(fragment) });

/** The text with each line break written as the one given. */
const withLineBreaks = (text, lineBreak) => text.replaceAll('\n', lineBreak);

describe('LineStructure', () => {
    describe('one-line constructs', () => {
        it('refuse a line break inside them with NEXO1041, naming the construct and giving the form joined, at what must share its line', () => {
            expectRefused('rooms.\nwhere', 'NEXO1041', 2, 1, "A member step's '.' and its name stand on one line: write '.where'");
            expectRefused('let\nwidth = 1\nreturn width', 'NEXO1041', 2, 1, "A local's 'let', its name and its '=' stand on one line: write 'let width'");
            expectRefused('room { size\n= 1 }', 'NEXO1041', 2, 1, "An object field's name and its '=' stand on one line: write 'size ='");
            expectRefused('let f = x => x\nreturn f\n(1)', 'NEXO1041', 3, 1, "A call's '(' and the name it calls stand on one line: write 'f('");
            expectRefused('room.device\n("lamp")', 'NEXO1041', 2, 1, "write 'device('");
            expectRefused('rooms\n[0]', 'NEXO1041', 2, 1, "An indexer's '[' and what it indexes stand on one line: write 'rooms['");
            expectRefused('room\n{ size = it.size }', 'NEXO1041', 2, 1, "An object expression's '{' and its receiver stand on one line");
            expectRefused('(device as\nLight).power', 'NEXO1041', 2, 1, "A cast's 'as' and its type stand on one line: write 'as Light'");
            expectRefused('-\nwidth', 'NEXO1041', 2, 1, 'A prefix operator and the start of its operand stand on one line');
            expectRefused('not\nlit', 'NEXO1041', 2, 1, 'A prefix operator');
            expectRefused('rooms.map((a,\nb) => a)', 'NEXO1041', 2, 1, "An arrow function's parameters and its '=>' stand on one line");
            expectRefused('room.device("a"\n, "b")', 'NEXO1041', 2, 1, 'A comma and what it follows stand on one line');
            expectRefused('room.\n["size"]', 'NEXO1041', 2, 1, "A computed property access's '.' and its '[' stand on one line: write '.['");
        });

        it('refuse one within an import, an extension selector and a qualified type name', () => {
            expectRefused('import\nHome\nHome.rooms', 'NEXO1041', 2, 1, "An import's words stand on one line: write 'import Home'");
            expectRefused('item:\nWords.shout', 'NEXO1041', 2, 1, "An extension selector's ':' and its extension's name stand on one line");
            expectRefused('import Home\n(device as Home.\nLight).power', 'NEXO1041', 3, 1, "A qualified type name's words stand on one line");
            expect(nexo.parse('item:Words\n    .shout').expression).toMatchObject({ kind: 'memberAccess', name: 'shout', extension: { name: 'Words' } });
        });

        it('take a comment that holds no line break, and a line comment after a completed construct', () => {
            expect(nexo.parse('rooms./* the */where').expression).toMatchObject({ kind: 'memberAccess', name: 'where' });
            expect(nexo.parse('let width = 1 // one\nreturn width').expression).toMatchObject({ kind: 'body' });
            expectRefused('rooms. // the\nwhere', 'NEXO1041', 2, 1, "write '.where'");
        });
    });

    describe('break points', () => {
        it('take a line break before a chain\'s steps, within arguments, keys and objects, after an = and after an arrow', () => {
            const texts = [
                'room.devices\n    .where(it.active())\n    .count',
                'room.device(\n    "lamp"\n).power',
                'room.device("a",\n    "b")',
                'rooms[\n    0\n]',
                'room {\n    size = it.size,\n    name = it.name\n}',
                'room { size =\n    it.size }',
                'let width =\n    1\nreturn width',
                'rooms.map(r =>\n    r.size)',
                'item:Words\n    .shout',
            ];

            texts.forEach(text => expect(() => nexo.parse(text), text).not.toThrow());
        });
    });

    describe('operator expressions', () => {
        it('take a line break before an operator where the expression is enclosed, in a group, an argument, a key or a condition', () => {
            const texts = ['(a\n    + b)', 'room.device(a\n    ?? b)', 'rooms[a\n    - 1]', 'if a\n    and b then\n    1\nelse\n    2\nend', '(a\n    * b\n    + c)', '(not a\n    and b)'];

            texts.forEach(text => expect(() => nexo.parse(text), text).not.toThrow());
        });

        it('refuse one before an operator anywhere else with NEXO1042, at the operator, an enclosure belonging to its one position', () => {
            expectRefused('let a = b\n-1\nreturn a', 'NEXO1042', 2, 1, 'A line breaks before an operator only inside parentheses, brackets or a condition');
            expectRefused('room { gap = a\n    - b }', 'NEXO1042', 2, 5);
            expectRefused('room.dim({\n    value = a\n        + b\n})', 'NEXO1042', 3, 9);
            expectRefused('a\n    and b', 'NEXO1042', 2, 5);
        });

        it('refuse one after an operator with NEXO1064, at the operator, enclosed or not', () => {
            expectRefused('(a +\n    b)', 'NEXO1064', 1, 4, "A line breaks before an operator, never after it: start the next line with '+'");
            expectRefused('a ??\n    b', 'NEXO1064', 1, 3, "'??'");
        });
    });

    describe('keyword blocks', () => {
        it('take one on one line, and one in block form once it spans lines', () => {
            const texts = [
                'if lit then "on" else "off" end',
                'if lit then\n    "on"\nelseif dim then\n    "dim"\nelse\n    "off"\nend',
                'do\n    let a = 1\n    return a\nend',
                'let f = function(x)\n    return x\nend\nreturn f(1)',
                'room { state = if lit then\n    "on"\nelse\n    "off"\nend }',
                'return (do\n    return 1\nend\n) + 2',
            ];

            texts.forEach(text => expect(() => nexo.parse(text), text).not.toThrow());
        });

        it('refuse any mixture with NEXO1043, giving the block form', () => {
            expectRefused('if lit then "on"\nelse "off" end', 'NEXO1043', 1, 13, "write the branch on the lines after its 'then'");
            expectRefused('if lit\nthen\n    "on"\nelse\n    "off"\nend', 'NEXO1043', 2, 1, "write 'then' at the end of its condition's last line");
            expectRefused('if\nlit then 1 else 2 end', 'NEXO1043', 2, 1, "write its condition's start on the line of its 'if'");
            expectRefused('if lit then\n    "on"\nelse\n    "off" end', 'NEXO1043', 4, 11, "write 'end' at the start of a line of its own");
            expectRefused('(do\n    return 1\nend) + 2', 'NEXO1043', 3, 6, "only closing punctuation follows its 'end' on that line");
            expectRefused('let f = function\n(x) x end\nreturn f(1)', 'NEXO1041', 2, 1, "'function' and its '(' stand on one line: write 'function('");
            expectRefused('let f = function(x) x\nend\nreturn f(1)', 'NEXO1043', 1, 21, "write the function's body on the lines after its head");
        });
    });

    describe('boundaries', () => {
        it('refuse an import, the body after the imports, and a local or return of a body that uses return sharing a line with earlier code, NEXO1044', () => {
            expectRefused('import Home import Garden\nHome.rooms', 'NEXO1044', 1, 13, 'An import starts on a line of its own');
            expectRefused('import Home Home.rooms', 'NEXO1044', 1, 13, 'The body after the imports starts on a line of its own');
            expectRefused('let a = 1 let b = 2\nreturn a', 'NEXO1044', 1, 11, "Each local and the 'return' of a body that uses return start on a line of their own");
            expectRefused('let a = 1 return a', 'NEXO1044', 1, 11);
            expectRefused('do return 1 end', 'NEXO1044', 1, 4, 'A body that uses return starts on a line of its own');
            expectRefused('return\n1', 'NEXO1041', 2, 1, "A body's 'return' and the start of its result stand on one line");
        });
    });

    describe('line breaks', () => {
        it('apply alike to LF, CRLF and a lone CR', () => {
            for (const lineBreak of ['\n', '\r\n', '\r']) {
                expect(refusalOf(withLineBreaks('rooms.\nwhere', lineBreak)), JSON.stringify(lineBreak)).toMatchObject({ code: 'NEXO1041', location: { line: 2, column: 1 } });
                expect(refusalOf(withLineBreaks('let a = b\n-1\nreturn a', lineBreak))).toMatchObject({ code: 'NEXO1042', location: { line: 2, column: 1 } });
                expect(refusalOf(withLineBreaks('let a = 1 return a', lineBreak))).toMatchObject({ code: 'NEXO1044' });
                expect(() => nexo.parse(withLineBreaks('do\n    let a = 1\n    return a\nend', lineBreak))).not.toThrow();
            }

            expect([Tokenizer.holdsLineBreak('a\r\nb', 0, 4), Tokenizer.holdsLineBreak('a\rb', 1, 2), Tokenizer.holdsLineBreak('a b', 0, 3), Tokenizer.holdsLineBreak('a\nb', 2, 3)]).toEqual([true, true, false, false]);
        });

        it('never change a reading: every accepted layout of one script gives one definition', () => {
            const layouts = [
                'let devices = room.devices.where(it.active())\nreturn { count = devices.count, gap = (devices.count - 1) }',
                'let devices = room.devices\n    .where(it.active())\nreturn {\n    count = devices.count,\n    gap = (devices.count\n        - 1)\n}',
                'let devices =\n    room.devices.where(\n        it.active()\n    )\nreturn { count = devices\n    .count, gap = (\n    devices.count - 1\n) }',
            ];
            const [first, ...rest] = layouts.map(text => nexo.parse(text));

            rest.forEach(definition => expect(definition).toEqual(first));
        });
    });
});
