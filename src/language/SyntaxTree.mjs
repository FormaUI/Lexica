/**
 * SyntaxTree — the lossless syntax tree of a Lexica text: its constructs, each a node named after the grammar rule that produces it, holding its tokens and the nodes within it, every token with the trivia before it
 */

/** @typedef {import('./Tokenizer.mjs').Token} Token */
/** @typedef {{ kind: string, children: (SyntaxNode | Token)[] }} SyntaxNode */
/** @typedef {{ kind: 'script', text: string, children: (SyntaxNode | Token)[] }} ScriptNode The script's import declarations, its body and the end of its text, with the trivia before it. */
/** @typedef {{ kind: 'whitespace' | 'line-comment' | 'block-comment', start: number, end: number }} TriviaPiece */

/**
 * The kinds a node is, each a construct of the grammar, which tooling reads as they are; a rule that only passes an operand on, a level of precedence or a repetition, is none of them.
 * A contract within Lexica until a public tooling API stabilizes it.
 */
export const SYNTAX_NODE_KINDS = Object.freeze([
    'script',
    'import-declaration',
    'conditional-expression',
    'body',
    'do-expression',
    'function-expression',
    'arrow-function',
    'function-call',
    'conditional-binding',
    'disjunction',
    'conjunction',
    'negation',
    'equality',
    'comparison',
    'additive',
    'multiplicative',
    'arithmetic-negation',
    'coalescing',
    'attempt',
    'conversion',
    'cast',
    'type-name',
    'chain',
    'namespace-access',
    'dot-property-access',
    'computed-property-access',
    'member-call',
    'indexer',
    'parenthesized-expression',
    'optional-enclosed-access',
    'member-chain',
    'receiver',
    'object',
    'interpolated-string',
    'interpolation',
    'local',
    'field',
]);

export class SyntaxTree {
    /**
     * The import an import declaration writes, in a definition's shape: its module, its type where it imports one, and its alias where it gives a local name other than its own, each the word the text spells.
     * @param {SyntaxNode} declaration
     * @param {string} text
     */
    static importOf(declaration, text) {
        const words = declaration.children.slice(1);
        const hasAlias = words[1]?.type === '=';
        const source = hasAlias ? words.slice(2) : words;
        const module = SyntaxTree.wordOf(source[0], text);
        const type = source.length > 1 ? SyntaxTree.wordOf(source[2], text) : undefined;
        const alias = hasAlias ? SyntaxTree.wordOf(words[0], text) : undefined;

        return {
            module,
            ...(type === undefined ? {} : { type }),
            ...(alias === undefined || alias === (type ?? module) ? {} : { alias }),
        };
    }

    /** The body a script holds, after its import declarations. */
    static bodyOf(script) {
        return script.children.at(-2);
    }

    /** Whether the child is a token rather than a node. */
    static isToken(child) {
        return child.kind === undefined;
    }

    /** Where the node's first token begins, its trivia left out. */
    static startOf(child) {
        let current = child;

        while (!SyntaxTree.isToken(current)) {
            current = current.children[0];
        }

        return current.start;
    }

    /** Where the node's last token ends. */
    static endOf(child) {
        let current = child;

        while (!SyntaxTree.isToken(current)) {
            current = current.children.at(-1);
        }

        return current.end;
    }

    /**
     * The word a token writes, as the text spells it.
     * @param {Token} token
     * @param {string} text The text the token was read from.
     */
    static wordOf(token, text) {
        return text.slice(token.start, token.end);
    }

    /**
     * The name of the type a cast's or a conversion's type part writes: its local name, or its module's name, a dot and its local name, whatever trivia the text puts between them.
     * @param {SyntaxNode | Token} part A name token or a `type-name` node.
     * @param {string} text The text the part was read from.
     */
    static typeNameOf(part, text) {
        return SyntaxTree.isToken(part) ? SyntaxTree.wordOf(part, text) : `${SyntaxTree.wordOf(part.children[0], text)}.${SyntaxTree.wordOf(part.children[2], text)}`;
    }

    /**
     * The tokens of the node, in the order of the text.
     * @param {SyntaxNode | Token} child
     * @returns {Generator<Token>}
     */
    static *tokensOf(child) {
        if (SyntaxTree.isToken(child)) {
            yield child;

            return;
        }

        for (const each of child.children) {
            yield* SyntaxTree.tokensOf(each);
        }
    }

    /**
     * The text the tree was read from, rebuilt from its tokens and the trivia before each, the end of the text's included.
     * @param {ScriptNode} tree
     */
    static textOf(tree) {
        let text = '';

        for (const token of SyntaxTree.tokensOf(tree)) {
            text += tree.text.slice(token.triviaStart, token.end);
        }

        return text;
    }

    /**
     * The trivia before the token, each piece whitespace, a line comment or a block comment, in the order of the text.
     * @param {Token} token
     * @param {string} text The text the token was read from.
     * @returns {TriviaPiece[]}
     */
    static triviaOf(token, text) {
        const pieces = [];

        for (let offset = token.triviaStart; offset < token.start;) {
            const start = offset;

            if (text.startsWith('//', offset)) {
                const lineEnd = text.slice(offset, token.start).search(/[\n\r]/);
                // The comment holds the line break that ends it, CRLF one, or runs to the token where none does.
                const breakLength = lineEnd !== -1 && text.startsWith('\r\n', offset + lineEnd) ? 2 : 1;

                offset = lineEnd === -1 ? token.start : offset + lineEnd + breakLength;
                pieces.push({ kind: 'line-comment', start, end: offset });
            } else if (text.startsWith('/*', offset)) {
                offset = text.indexOf('*/', offset + 2) + 2;
                pieces.push({ kind: 'block-comment', start, end: offset });
            } else {
                while (offset < token.start && !text.startsWith('//', offset) && !text.startsWith('/*', offset)) {
                    offset++;
                }

                pieces.push({ kind: 'whitespace', start, end: offset });
            }
        }

        return pieces;
    }
}
