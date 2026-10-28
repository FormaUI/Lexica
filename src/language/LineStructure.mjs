/**
 * LineStructure — the layouts a script's text may take: where a line may break between its tokens, where one must, and where none may, checked over its syntax tree, which it never reads otherwise
 */

import { SyntaxTree } from './SyntaxTree.mjs';
import { Tokenizer } from './Tokenizer.mjs';

/** @typedef {import('./SyntaxTree.mjs').SyntaxNode} SyntaxNode */
/** @typedef {import('./Tokenizer.mjs').Token} Token */

/** The binary operators' nodes, each operand and operator a child in turn, a line breaking before an operator only where the expression is enclosed and never after one. */
const OPERATOR_KINDS = new Set(['disjunction', 'conjunction', 'equality', 'comparison', 'additive', 'multiplicative', 'coalescing']);

/** The nodes an enclosure reaches through, the operators of one expression, its prefix operators among them, so an operand of an enclosed expression is enclosed with it. */
const ENCLOSURE_KINDS = new Set([...OPERATOR_KINDS, 'negation', 'arithmetic-negation']);

/** The keyword blocks, each written on one line or, once it spans lines, in block form. */
const KEYWORD_BLOCK_KINDS = new Set(['conditional-expression', 'do-expression', 'function-expression']);

/** The steps of a chain a line may break before, each beginning with `.`, `?.`, `:` or `?:`. */
const STEP_KINDS = new Set(['dot-property-access', 'member-call', 'computed-property-access', 'extension-access']);

/** The calls, each holding its arguments after the index of its `(`. */
const CALL_OPENINGS = Object.freeze({ 'function-call': 1, 'member-call': 2, 'namespace-access': 3 });

/** What alone may follow a keyword block's `end` on its line in block form. */
const CLOSING_PUNCTUATION = new Set([',', ')', ']', '}']);

/** The tokens written directly against the one before them, which a joined form writes with no space. */
const ATTACHED_AFTER = new Set(['(', '[', '?[', ')', ']', ',', '.', '?.', ':', '?:']);

/** The tokens written directly against the one after them. */
const ATTACHED_BEFORE = new Set(['(', '[', '?[', '(?', '.', '?.', ':', '?:', '-']);

/** What a block form gives, which a message about a keyword block that spans lines opens with. */
const BLOCK_FORM = "A conditional, a do block or a function that spans lines is in block form, each 'then', 'else', 'do' and head ending its line, its content on the lines after, and 'end' on a line of its own";

/** A gap where a line may break. */
const ALLOWED = Object.freeze({ kind: 'allowed' });

export class LineStructure {
    #text;

    /** The index of each token in the text's tokens, by the token. @type {Map<Token, number>} */
    #indexes = new Map();

    /** @type {Token[]} */
    #tokens;

    /** @type {(code: string, message: string, offset: number) => never} */
    #fail;

    /**
     * @param {string} text The text the syntax tree was read from.
     * @param {Token[]} tokens The text's tokens, in order, the tree's among them.
     */
    constructor(text, tokens) {
        this.#text = text;
        this.#tokens = tokens;
        tokens.forEach((token, index) => this.#indexes.set(token, index));
    }

    /**
     * Validates the script's layout, refusing the first line break, in the order of the text, that a one-line construct holds (LEXICA1041), one before a binary operator outside an enclosure (LEXICA1042) or after one
     * (LEXICA1064), a keyword block spanning lines outside block form (LEXICA1043), and a boundary with earlier code on its line (LEXICA1044), each through the failure given, which throws.
     * @param {import('./SyntaxTree.mjs').ScriptNode} script
     * @param {(code: string, message: string, offset: number) => never} fail
     */
    validate(script, fail) {
        this.#fail = fail;
        this.#validateNode(script, false);
    }

    /** Validates each gap between the node's children, and each child within, in the order of the text, a keyword block's `end` and what follows it on its line last. */
    #validateNode(node, isEnclosed) {
        if (SyntaxTree.isToken(node)) {
            return;
        }

        const isBlock = KEYWORD_BLOCK_KINDS.has(node.kind) && Tokenizer.holdsLineBreak(this.#text, SyntaxTree.startOf(node), SyntaxTree.endOf(node));

        node.children.forEach((child, index) => {
            if (index > 0) {
                this.#validateGap(node, index, isEnclosed, isBlock);
            }

            this.#validateNode(child, LineStructure.#isChildEnclosed(node, index, isEnclosed));
        });

        if (isBlock) {
            this.#validateAfterEnd(node.children.at(-1));
        }
    }

    /** Validates the gap before the node's child at the index, by the rule its position follows. */
    #validateGap(node, index, isEnclosed, isBlock) {
        const before = LineStructure.#lastTokenOf(node.children[index - 1]);
        const after = LineStructure.#firstTokenOf(node.children[index]);
        const breaks = Tokenizer.holdsLineBreak(this.#text, before.end, after.start);
        const rule = this.#ruleOf(node, index, isEnclosed, isBlock);

        switch (rule.kind) {
            case 'refused':
                if (breaks) {
                    this.#fail(rule.code ?? 'LEXICA1041', rule.code === undefined ? `${rule.construct} stand on one line: write '${this.#joined(before, after)}'` : rule.message, after.start);
                }

                break;
            case 'required':
                if (!breaks) {
                    this.#fail(rule.code, rule.message, after.start);
                }

                break;
            case 'operator':
                if (breaks) {
                    this.#fail(rule.code, rule.message, rule.offset);
                }

                break;
            default:
                break;
        }
    }

    /**
     * The rule of the gap before the node's child at the index: refused, a one-line construct's, which names it, or a keyword block's or an operator's, which give their own code; allowed, at a break point; or
     * required, at a boundary. A body that uses `return` starts a line wherever it stands, its locals and its `return` at a boundary each, and a position no rule makes a break point is a one-line construct's.
     */
    #ruleOf(node, index, isEnclosed, isBlock) {
        const child = node.children[index];
        const previous = node.children[index - 1];
        const is = (part, type) => SyntaxTree.isToken(part) && (part.type === type || (part.type === 'keyword' && part.value === type));

        if (!SyntaxTree.isToken(child) && child.kind === 'body') {
            return { kind: 'required', code: 'LEXICA1044', message: "A body that uses return starts on a line of its own, each of its locals and its 'return' on one of their own" };
        }

        switch (node.kind) {
            case 'script':
                if (!SyntaxTree.isToken(child) && child.kind === 'import-declaration') {
                    return { kind: 'required', code: 'LEXICA1044', message: 'An import starts on a line of its own' };
                }

                return index === node.children.length - 1 ? ALLOWED : { kind: 'required', code: 'LEXICA1044', message: 'The body after the imports starts on a line of its own' };
            case 'import-declaration':
                return { kind: 'refused', construct: "An import's words" };
            case 'body':
                return is(previous, 'return') ? { kind: 'refused', construct: "A body's 'return' and the start of its result" } : { kind: 'required', code: 'LEXICA1044', message: "Each local and the 'return' of a body that uses return start on a line of their own" };
            case 'local':
                return index === 3 ? ALLOWED : { kind: 'refused', construct: "A local's 'let', its name and its '='" };
            case 'conditional-binding':
                return index === 3 ? ALLOWED : { kind: 'refused', construct: "A conditional binding's 'let', its name and its '='" };
            case 'field':
                return index === 2 ? ALLOWED : { kind: 'refused', construct: "An object field's name and its '='" };
            case 'object':
            case 'list-expression':
                return is(child, ',') ? { kind: 'refused', construct: 'A comma and what it follows' } : ALLOWED;
            case 'dictionary-expression':
                // An empty dictionary's `[=]` is one construct, and any other's entries break as an object's do.
                if (is(child, '=') || is(previous, '=')) {
                    return { kind: 'refused', construct: "An empty dictionary's '[=]'" };
                }

                return is(child, ',') ? { kind: 'refused', construct: 'A comma and what it follows' } : ALLOWED;
            case 'dictionary-entry':
                return index === 2 ? ALLOWED : { kind: 'refused', construct: "A dictionary entry's key and its '='" };
            case 'function-call':
            case 'member-call':
            case 'namespace-access':
                return LineStructure.#callRuleOf(node, index, child, is);
            case 'dot-property-access':
                return { kind: 'refused', construct: "A member step's '.' and its name" };
            case 'computed-property-access':
                return index === 1 ? { kind: 'refused', construct: "A computed property access's '.' and its '['" } : ALLOWED;
            case 'extension-access':
                if (SyntaxTree.isToken(child)) {
                    return { kind: 'refused', construct: "An extension selector's ':' and its extension's name" };
                }

                return child.kind === 'indexer' ? { kind: 'refused', construct: "An indexer's '[' and what it indexes" } : ALLOWED;
            case 'chain':
            case 'member-chain':
                if (STEP_KINDS.has(child.kind)) {
                    return ALLOWED;
                }

                return child.kind === 'object' ? { kind: 'refused', construct: "An object expression's '{' and its receiver" } : { kind: 'refused', construct: "An indexer's '[' and what it indexes" };
            case 'parenthesized-expression':
            case 'receiver':
            case 'optional-enclosed-access':
            case 'indexer':
            case 'interpolated-string':
            case 'interpolation':
                return ALLOWED;
            case 'type-name':
                return { kind: 'refused', construct: "A qualified type name's words" };
            case 'cast':
                return { kind: 'refused', construct: index === 1 ? "A cast's 'as' and what it casts" : "A cast's 'as' and its type" };
            case 'conversion':
                return { kind: 'refused', construct: index === 1 ? "A conversion's 'to' and what it converts" : "A conversion's 'to' and its type" };
            case 'attempt':
            case 'negation':
            case 'arithmetic-negation':
                return { kind: 'refused', construct: 'A prefix operator and the start of its operand' };
            case 'arrow-function':
                return is(previous, '=>') ? ALLOWED : { kind: 'refused', construct: "An arrow function's parameters and its '=>'" };
            case 'function-expression':
                return LineStructure.#functionRuleOf(index, child, previous, is, isBlock);
            case 'do-expression':
                return isBlock ? { kind: 'required', code: 'LEXICA1043', message: `${BLOCK_FORM}: write the do block's body on the lines after 'do', and 'end' on a line of its own` } : ALLOWED;
            case 'conditional-expression':
                return LineStructure.#conditionalRuleOf(child, previous, is, isBlock);
            default:
                return OPERATOR_KINDS.has(node.kind) ? this.#operatorRuleOf(child, previous, isEnclosed) : { kind: 'refused', construct: 'These tokens' };
        }
    }

    /** The rule of a gap in a call: its name's step and its `(` refused a line break, its arguments' break points after `(` and each comma and before `)`, and a comma refused one before it. */
    static #callRuleOf(node, index, child, is) {
        const opening = CALL_OPENINGS[node.kind];

        if (index < opening) {
            // A namespace's name is a chain's input, which a line may break after, before its dot.
            return node.kind === 'namespace-access' && index === 1 ? ALLOWED : { kind: 'refused', construct: "A member step's '.' and its name" };
        }

        if (index === opening) {
            return { kind: 'refused', construct: "A call's '(' and the name it calls" };
        }

        return is(child, ',') ? { kind: 'refused', construct: 'A comma and what it follows' } : ALLOWED;
    }

    /** The rule of a gap in a function expression: `function` and its `(` on one line, its parameters' break points, and in block form its body on the lines after its head and its `end` on a line of its own. */
    static #functionRuleOf(index, child, previous, is, isBlock) {
        if (index === 1) {
            return { kind: 'refused', construct: "'function' and its '('" };
        }

        if (is(child, ',')) {
            return { kind: 'refused', construct: 'A comma and what it follows' };
        }

        // The body after the head's `)`, and the `end` after the body.
        if (is(previous, ')') || is(child, 'end')) {
            return isBlock ? { kind: 'required', code: 'LEXICA1043', message: `${BLOCK_FORM}: write the function's body on the lines after its head, and 'end' on a line of its own` } : ALLOWED;
        }

        return ALLOWED;
    }

    /**
     * The rule of a gap in a conditional: its `if` or `elseif` and its test's start on one line, and `then` on the line its test ends; in block form, each branch on the lines after its `then` or `else`, and each `elseif`,
     * `else` and `end` starting a line.
     */
    static #conditionalRuleOf(child, previous, is, isBlock) {
        if (is(previous, 'if') || is(previous, 'elseif')) {
            return { kind: 'refused', code: 'LEXICA1043', message: `${BLOCK_FORM}: write its condition's start on the line of its '${previous.value}'` };
        }

        if (is(child, 'then')) {
            return { kind: 'refused', code: 'LEXICA1043', message: `${BLOCK_FORM}: write 'then' at the end of its condition's last line` };
        }

        if (!isBlock) {
            return ALLOWED;
        }

        if (is(previous, 'then') || is(previous, 'else')) {
            return { kind: 'required', code: 'LEXICA1043', message: `${BLOCK_FORM}: write the branch on the lines after its '${previous.value}'` };
        }

        return { kind: 'required', code: 'LEXICA1043', message: `${BLOCK_FORM}: write '${child.value}' at the start of a line of its own` };
    }

    /** The rule of a gap in an operator expression: before an operator, refused outside an enclosure (LEXICA1042); after one, refused always (LEXICA1064); each refusal at the operator. */
    #operatorRuleOf(child, previous, isEnclosed) {
        if (LineStructure.#isOperator(child)) {
            return isEnclosed ? ALLOWED : { kind: 'operator', code: 'LEXICA1042', message: `A line breaks before an operator only inside parentheses, brackets or a condition: enclose the expression in parentheses, or join '${this.#wordOf(child)}' to the line before it`, offset: child.start };
        }

        return { kind: 'operator', code: 'LEXICA1064', message: `A line breaks before an operator, never after it: start the next line with '${this.#wordOf(previous)}'`, offset: previous.start };
    }

    /** Validates what follows a keyword block's `end` on its line in block form, closing punctuation alone (LEXICA1043). */
    #validateAfterEnd(end) {
        let previous = end;

        for (let index = this.#indexes.get(end) + 1; index < this.#tokens.length; index++) {
            const token = this.#tokens[index];

            if (token.type === 'end' || Tokenizer.holdsLineBreak(this.#text, previous.end, token.start)) {
                return;
            }

            if (!CLOSING_PUNCTUATION.has(token.type)) {
                this.#fail('LEXICA1043', `${BLOCK_FORM}: only closing punctuation follows its 'end' on that line, so continue the expression on the line after it, as 'end' then ') + 2'`, token.start);
            }

            previous = token;
        }
    }

    /** Whether the child of an operator expression is one of its operators, a token, rather than an operand. */
    static #isOperator(child) {
        return SyntaxTree.isToken(child) && child.type !== 'literal' && child.type !== 'identifier' && child.type !== 'it' && child.type !== 'script-parameter' && child.type !== 'lexical-reference';
    }

    /**
     * Whether the node's child at the index stands enclosed: the expression a parenthesized group, an argument, an indexer's key, a computed property's expression or a condition holds directly, or an operand of an
     * enclosed operator expression; any other position starts unenclosed again.
     */
    static #isChildEnclosed(node, index, isEnclosed) {
        const child = node.children[index];

        if (SyntaxTree.isToken(child)) {
            return false;
        }

        switch (node.kind) {
            case 'parenthesized-expression':
            case 'receiver':
            case 'optional-enclosed-access':
            case 'indexer':
                return true;
            case 'computed-property-access':
                return index === 2;
            case 'function-call':
            case 'member-call':
            case 'namespace-access':
                return index > CALL_OPENINGS[node.kind];
            case 'conditional-expression': {
                const previous = node.children[index - 1];

                return previous.type === 'keyword' && (previous.value === 'if' || previous.value === 'elseif');
            }
            case 'conditional-binding':
                return isEnclosed;
            default:
                return ENCLOSURE_KINDS.has(node.kind) && isEnclosed;
        }
    }

    /** The two tokens around a gap joined, as a message gives the form that stands on one line, with a space between them unless one is written against the other. */
    #joined(before, after) {
        const space = ATTACHED_BEFORE.has(before.type) || ATTACHED_AFTER.has(after.type) ? '' : ' ';

        return `${this.#wordOf(before)}${space}${this.#wordOf(after)}`;
    }

    #wordOf(token) {
        return SyntaxTree.wordOf(token, this.#text);
    }

    static #firstTokenOf(child) {
        return SyntaxTree.isToken(child) ? child : LineStructure.#firstTokenOf(child.children[0]);
    }

    static #lastTokenOf(child) {
        return SyntaxTree.isToken(child) ? child : LineStructure.#lastTokenOf(child.children.at(-1));
    }
}
