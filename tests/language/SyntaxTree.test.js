import { describe, it, expect } from 'vitest';
import { SYNTAX_NODE_KINDS, SyntaxTree } from '#lexica/language/SyntaxTree.mjs';
import { Tokenizer } from '#lexica/language/Tokenizer.mjs';

describe('SyntaxTree', () => {
    it('answers the word a token writes as the text spells it, whatever the token is', () => {
        const text = 'item.to + true  -  @end';
        const tokens = Tokenizer.scan(text).filter(token => token.end > token.start);

        expect(tokens.map(token => SyntaxTree.wordOf(token, text))).toEqual(['item', '.', 'to', '+', 'true', '-', '@end']);
    });

    it('reads the trivia before a token, a line comment ending with the line break after it, LF, CRLF or a lone CR', () => {
        for (const lineBreak of ['\n', '\r\n', '\r']) {
            const text = `1 // one${lineBreak}  /* two */ + 2`;
            const plus = Tokenizer.scan(text).find(token => token.type === '+');
            const commentEnd = text.indexOf(lineBreak) + lineBreak.length;

            expect(SyntaxTree.triviaOf(plus, text), JSON.stringify(lineBreak)).toEqual([
                { kind: 'whitespace', start: 1, end: 2 },
                { kind: 'line-comment', start: 2, end: commentEnd },
                { kind: 'whitespace', start: commentEnd, end: commentEnd + 2 },
                { kind: 'block-comment', start: commentEnd + 2, end: commentEnd + 11 },
                { kind: 'whitespace', start: commentEnd + 11, end: commentEnd + 12 },
            ]);
        }
    });

    it("tells the tokens that make an access optional, a property access's or a call's ?., an indexer's ?[ and an extension access's ?:, from those that don't", () => {
        expect(['?.', '?[', '?:'].map(type => SyntaxTree.isOptionalAccess(type))).toEqual([true, true, true]);
        expect(['.', '[', ':', '??', '(?'].map(type => SyntaxTree.isOptionalAccess(type))).toEqual([false, false, false, false, false]);
    });

    it('names the kind of each node a grammar construct is, frozen', () => {
        expect(SYNTAX_NODE_KINDS).toEqual(expect.arrayContaining(['script', 'conditional-binding', 'arithmetic-negation', 'import-declaration', 'extension-access']));
        expect(Object.isFrozen(SYNTAX_NODE_KINDS)).toBe(true);
    });
});
