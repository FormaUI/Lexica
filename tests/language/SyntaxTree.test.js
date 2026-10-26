import { describe, it, expect } from 'vitest';
import { SYNTAX_NODE_KINDS, SyntaxTree } from '#lexica/language/SyntaxTree.mjs';
import { Tokenizer } from '#lexica/language/Tokenizer.mjs';

describe('SyntaxTree', () => {
    it('answers the word a token writes as the text spells it, whatever the token is', () => {
        const text = 'item.to + true  -  @end';
        const tokens = Tokenizer.scan(text).filter(token => token.end > token.start);

        expect(tokens.map(token => SyntaxTree.wordOf(token, text))).toEqual(['item', '.', 'to', '+', 'true', '-', '@end']);
    });

    it('names the kind of each node a grammar construct is, frozen', () => {
        expect(SYNTAX_NODE_KINDS).toEqual(expect.arrayContaining(['script', 'conditional-binding', 'arithmetic-negation']));
        expect(Object.isFrozen(SYNTAX_NODE_KINDS)).toBe(true);
    });
});
