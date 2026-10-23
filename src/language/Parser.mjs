/**
 * Parser — a Lexica text read into its lossless syntax tree, which the lowering turns into its definition
 */

import { LexicaErrors } from './LexicaError.mjs';
import { Names } from './Names.mjs';
import { SyntaxTree } from './SyntaxTree.mjs';
import { Tokenizer } from './Tokenizer.mjs';

/** @typedef {import('./Tokenizer.mjs').Token} Token */
/** @typedef {import('./SyntaxTree.mjs').SyntaxNode} SyntaxNode */
/** @typedef {{ start: number, end: number }} Span */

const TOKEN_DESCRIPTIONS = {
    identifier: 'an identifier',
    literal: 'a literal',
    end: 'the end of the source',
};

/** The tokens that continue a chain after what is before them, and the colons a chain refuses, which no member follows. */
const CHAIN_CONTINUATIONS = new Set(['.', '?.', '[', '?[', ':', '?:', '{']);

/** The tokens that, after a space, make the name before them a member written without its receiver, which no local is: an argument. */
const ARGUMENT_STARTS = new Set(['it', 'literal', 'interpolated-string-start', 'script-parameter', 'lexical-reference']);

/** The tokens that close what encloses a body, the end of a group, a list, an object or a field, before which a body's closer is missing rather than anything following its result. */
const BODY_ENCLOSURE_CLOSINGS = new Set([')', ']', '}', ',']);

/** The keywords that close or divide a construct, whose own messages say what it lacks where a value would stand. */
const STRUCTURAL_KEYWORDS = new Set(['then', 'elseif', 'else', 'end']);

/** The tokens that make an access optional. */
const OPTIONAL_ACCESSES = new Set(['?.', '?[']);

/** The direction each comparison operator points, which every operator of a chain shares. */
const COMPARISON_DIRECTIONS = Object.freeze({ '<': 'ascending', '<=': 'ascending', '>': 'descending', '>=': 'descending' });

/** The kinds of node a member expression is, each beginning with the token that joins it to its receiver. */
const MEMBER_EXPRESSIONS = new Set(['dot-property-access', 'computed-property-access', 'member-call', 'indexer']);

export class Parser {
    #text;
    /** @type {Token[]} */
    #tokens;
    #index = 0;

    /** The module names the text is read with, each beginning its module's namespace where a value stands. @type {ReadonlySet<string>} */
    #moduleNames;

    /** How many bodies' locals are being read, where a name on a new line after a value is a statement no body holds rather than a member written without its dot. */
    #bodyLocalsBeingRead = 0;

    /** The coalescing operators read where no group holds them, which no `and`, `or` or equality may stand beside. @type {WeakSet<SyntaxNode>} */
    #ungroupedCoalescings = new WeakSet();

    /** The conversions read directly after another conversion or a cast of the same chain, without a group between them, which `try` refuses to attempt. @type {WeakSet<SyntaxNode>} */
    #chainedConversions = new WeakSet();

    /**
     * @param {string} text The source text.
     * @param {ReadonlySet<string>} [moduleNames] The module names the text is read with, none for text read without a registry.
     */
    constructor(text, moduleNames = Names.noModuleNames) {
        this.#text = text;
        this.#moduleNames = moduleNames;
        this.#tokens = new Tokenizer(text).tokenize();
    }

    /**
     * Reads the text into its syntax tree, whose script node holds the body, an expression alone or bindings and the `return` that gives its result, and the end of the text, with the trivia before it.
     * @returns {import('./SyntaxTree.mjs').ScriptNode}
     */
    parse() {
        const body = this.#parseBody();

        if (this.#token.type !== 'end') {
            throw this.#afterBody('LEXICA1000', TOKEN_DESCRIPTIONS.end);
        }

        return { kind: 'script', text: this.#text, children: [body, this.#take()] };
    }

    /** Reads an expression: a conditional, a do block, or a simple value expression; a function stands as a local's initializer alone. */
    #parseExpression() {
        if (this.#isKeyword('if')) {
            return this.#parseConditionalExpression([this.#take()]);
        }

        if (this.#isKeyword('do')) {
            return this.#parseDoExpression();
        }

        return this.#parseSimpleValueExpression();
    }

    /**
     * Reads a body: an expression alone, or the locals evaluated in order, each `let`, a name, `=` and a value, and the `return` that gives its result, which completes the body and nothing follows; `return value` alone is a body of no locals.
     * What closes it, the end of the text, `end`, `elseif` or `else`, is its holder's to read.
     */
    #parseBody() {
        if (!this.#isKeyword('let') && !this.#isKeyword('return')) {
            const start = this.#token.start;
            const expression = this.#parseExpression();

            // An expression alone is its body's result, so a `return` after it follows what no binding holds.
            if (this.#isKeyword('return')) {
                throw this.#fail('LEXICA1031', "Only locals may precede a body's result.", start);
            }

            return expression;
        }

        const children = [];

        this.#bodyLocalsBeingRead++;

        try {
            while (this.#isKeyword('let')) {
                children.push(this.#parseLocal());
            }
        } finally {
            this.#bodyLocalsBeingRead--;
        }

        // After its locals a body's result follows its `return`; an expression there is one a `return` follows, which only a local may precede, or the result its `return` was left off.
        if (!this.#isKeyword('return')) {
            const start = this.#token.start;

            if (this.#token.type !== 'end' && !this.#isKeyword('end') && !this.#isKeyword('elseif') && !this.#isKeyword('else')) {
                this.#parseExpression();

                if (this.#isKeyword('return')) {
                    throw this.#fail('LEXICA1031', "Only locals may precede a body's result.", start);
                }
            }

            throw this.#fail('LEXICA1030', "Introduce the body's result with return.", start);
        }

        const returnKeyword = this.#take();

        if (this.#token.type === 'end' || this.#isKeyword('end') || this.#isKeyword('elseif') || this.#isKeyword('else')) {
            throw this.#fail('LEXICA1056', "'return' gives its body's result: write the value after it, as in 'return width'", returnKeyword.start);
        }

        children.push(returnKeyword, this.#parseExpression());

        if (this.#isKeyword('let') || this.#isKeyword('return')) {
            throw this.#fail('LEXICA1055', "Nothing follows a body's result, which ends it", this.#token.start);
        }

        return Parser.#node('body', children);
    }

    /** Reads a function: `function`, its parameters' names in parentheses, separated by commas, the body a call evaluates and the `end` that closes it. */
    #parseFunctionExpression() {
        const children = [this.#take(), this.#expect('(')];

        // A comma stands between two parameters alone, so one before ')' is refused.
        if (this.#token.type !== ')') {
            for (;;) {
                if (this.#token.type === 'lexical-reference') {
                    throw this.#fail('LEXICA1008', `A parameter is declared as it is written, with no '@': write '${this.#token.value}'`, this.#token.start);
                }

                if (!this.#isWord(this.#token)) {
                    throw this.#unexpected('LEXICA1000', "a parameter's name");
                }

                children.push(this.#take());

                if (this.#token.type !== ',') {
                    break;
                }

                children.push(this.#take());
            }

            if (this.#token.type !== ')') {
                throw this.#unexpected('LEXICA1000', "',' before the next parameter, or ')' closing them");
            }
        }

        children.push(this.#take());

        if (this.#isKeyword('end')) {
            throw this.#fail('LEXICA1511', "A function holds a body: write 'function(…) return … end' or the expression it gives", this.#token.start);
        }

        children.push(this.#parseBody());

        if (!this.#isKeyword('end')) {
            throw this.#afterBody('LEXICA1029', "'end' closing the function");
        }

        children.push(this.#take());

        return Parser.#node('function-expression', children);
    }

    /** Whether an arrow function starts here: a parameter's name and `=>`, or the parameters' names in parentheses, separated by commas, and `=>`. */
    #startsArrowFunction() {
        const tokenAt = offset => this.#tokens[this.#index + offset];
        const isWordAt = offset => tokenAt(offset) !== undefined && this.#isWord(tokenAt(offset));

        if (isWordAt(0)) {
            return tokenAt(1)?.type === '=>';
        }

        if (this.#token.type !== '(') {
            return false;
        }

        let offset = 1;

        if (tokenAt(offset)?.type !== ')') {
            for (;;) {
                if (!isWordAt(offset)) {
                    return false;
                }

                offset++;

                if (tokenAt(offset)?.type !== ',') {
                    break;
                }

                offset++;
            }

            if (tokenAt(offset)?.type !== ')') {
                return false;
            }
        }

        return tokenAt(offset + 1)?.type === '=>';
    }

    /**
     * Reads an arrow function: its parameters, one name alone or the names in parentheses, separated by commas, `=>`, and the one simple expression that is its body and gives its result.
     * It declares no locals and holds no body of its own, so what more a function holds is a regular function's, bound to a local.
     */
    #parseArrowFunction() {
        const children = [];

        if (this.#token.type === '(') {
            children.push(this.#take());

            while (this.#token.type !== ')') {
                children.push(this.#take());
            }
        }

        children.push(this.#take(), this.#take());

        if (this.#isKeyword('let') || this.#isKeyword('return') || this.#isKeyword('function') || this.#startsArrowFunction()) {
            throw this.#fail('LEXICA1036', "An arrow function's body is a simple expression, which gives its result: a function that holds more is a regular function bound to a local, passed by its name", this.#token.start);
        }

        children.push(this.#parseExpression());

        return Parser.#node('arrow-function', children);
    }

    /** Reads a call of a local function, the name it is written by given: its name, or a reserved word after `@`, and its arguments in parentheses. */
    #parseFunctionCall(written) {
        const name = this.#take();

        return Parser.#node('function-call', [name, ...this.#parseArguments(written, false)]);
    }

    /** Refuses an optional enclosed access opening a call's parentheses: `(?` is one token, so the call's parenthesis cannot also open the access that is its argument. */
    #refuseEnclosedAccessArgument(token, written) {
        if (token.type === '(?' && !token.spaced) {
            throw this.#fail('LEXICA1015', `A call whose argument is an optional enclosed access writes it in parentheses of its own: '${written}((?…))'`, token.start);
        }
    }

    /**
     * Reads a call's arguments: its opening parenthesis, the arguments separated by commas, a comma standing between two of them alone, and its closing parenthesis.
     * An argument is written as its value alone, so one written as a named one would be is refused, a member's with the options object a member taking options is given instead.
     */
    #parseArguments(written, isMember) {
        const children = [this.#take()];

        if (this.#token.type !== ')') {
            for (;;) {
                if (this.#startsNamedArgument()) {
                    const options = isMember ? `; a member that takes options is given them as the fields of an object, as { ${this.#token.value} = … }` : '';

                    throw this.#fail('LEXICA1012', `An argument is written as its value alone, as '${written}(…)' takes it${options}`, this.#token.start);
                }

                if (this.#isKeyword('function')) {
                    throw this.#fail('LEXICA1035', "A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.", this.#token.start);
                }

                children.push(this.#startsArrowFunction() ? this.#parseArrowFunction() : this.#parseExpression());

                if (this.#token.type !== ',') {
                    break;
                }

                children.push(this.#take());
            }

            if (this.#token.type !== ')') {
                throw this.#unexpected('LEXICA1000', "',' before the next argument, or ')' closing them");
            }
        }

        children.push(this.#take());

        return children;
    }

    /** Reads a do block: `do`, the body it evaluates where execution reaches it, and the `end` that closes it. */
    #parseDoExpression() {
        const doKeyword = this.#take();

        if (this.#isKeyword('end')) {
            throw this.#fail('LEXICA1511', "A do block holds a body: write 'do return … end'", this.#token.start);
        }

        const body = this.#parseBody();

        if (!this.#isKeyword('end')) {
            throw this.#afterBody('LEXICA1029', "'end' closing the do block");
        }

        const node = Parser.#node('do-expression', [doKeyword, body, this.#take()]);

        this.#refuseChainFrom('do-expression');

        return node;
    }

    /** Reads a simple value expression: a disjunction, or an or-operand alone, a coalescing operator among them, which stands beside neither `and` nor `or`. */
    #parseSimpleValueExpression() {
        return this.#parseLogical('or', () => this.#parseOrOperand());
    }

    /** Reads an or-operand: a conjunction, or an and-operand alone. */
    #parseOrOperand() {
        return this.#parseLogical('and', () => this.#parseAndOperand());
    }

    /** Reads an and-operand: a negation, an equality, a comparison, or an equality operand alone. */
    #parseAndOperand() {
        return this.#isKeyword('not') ? this.#parseNegation() : this.#parseEquality();
    }

    /** Reads a negation: `not` and what it negates, another negation, an equality, a comparison or an equality operand, so it associates to the right; a coalescing operator stands beside it only where a group holds it. */
    #parseNegation() {
        const notKeyword = this.#take();
        const operand = this.#parseAndOperand();

        if (this.#ungroupedCoalescings.has(operand)) {
            throw this.#fail('LEXICA1021', "'??' and 'not' stand apart, one of them grouped: write 'not (… ?? …)' or '(not …) ?? …'", SyntaxTree.startOf(operand));
        }

        return Parser.#node('negation', [notKeyword, operand]);
    }

    /**
     * Reads a conditional after its `if`, which the children begin with: each clause's test, a condition or a binding, `let`, a name and a value, and the expression `then` gives it, an `elseif` beginning the next clause,
     * and the alternative `else` gives, which every conditional ends with.
     */
    #parseConditionalExpression(children) {
        const branches = [];

        for (;;) {
            if (this.#isKeyword('if')) {
                throw this.#fail('LEXICA1027', 'A conditional that is a condition is enclosed in parentheses: write if (if … then … else … end) then …', this.#token.start);
            }

            children.push(this.#isKeyword('let') ? this.#parseBinding() : this.#parseSimpleValueExpression());

            if (!this.#isKeyword('then')) {
                throw this.#unexpected('LEXICA1000', "'then' after the condition");
            }

            const thenKeyword = this.#take();
            const consequent = this.#parseBody();

            children.push(thenKeyword, consequent);
            branches.push(consequent);

            if (this.#isKeyword('elseif')) {
                children.push(this.#take());
            } else if (this.#isKeyword('else')) {
                const elseKeyword = this.#take();
                const alternative = this.#parseBody();

                children.push(elseKeyword, alternative);
                branches.push(alternative);

                if (!this.#isKeyword('end')) {
                    throw this.#afterBody('LEXICA1029', "'end' closing the conditional");
                }

                // Every branch of one conditional gives its result with `return`, or none does; an `else` whose expression is a conditional, `else if … end`, follows branches of expressions in either style, and branches that return in theirs, as an `elseif` would.
                const isExplicit = branch => !SyntaxTree.isToken(branch) && branch.kind === 'body';
                const fits = branch => (branch === alternative && !SyntaxTree.isToken(branch) && branch.kind === 'conditional-expression'
                    ? !isExplicit(branches[0]) || isExplicit(branch.children[3])
                    : isExplicit(branch) === isExplicit(branches[0]));
                const differing = branches.find(branch => !fits(branch));

                if (differing !== undefined) {
                    throw this.#fail('LEXICA1054', 'All branches of this conditional must give their results with return, or none of them', SyntaxTree.startOf(isExplicit(differing) ? branches[0] : differing));
                }

                children.push(this.#take());
                this.#refuseChainFrom('conditional-expression');

                return Parser.#node('conditional-expression', children);
            } else {
                throw this.#afterBody('LEXICA1505', "'elseif' or 'else', which every conditional ends with");
            }
        }
    }

    /** Reads a conditional's binding after its `if` or `elseif`: `let`, its name, `=` and the value it binds, a simple value expression. */
    #parseBinding() {
        const letKeyword = this.#take();

        if (!this.#startsEntry()) {
            this.#refuseName('LEXICA1051', 'A conditional binding takes its value after =', 'A conditional binding is written with let, its name and = before its value, as if let mode = it.setting["mode"] then …', 'if let ');
        }

        return Parser.#node('conditional-binding', [letKeyword, this.#take(), this.#take(), this.#parseSimpleValueExpression()]);
    }

    /**
     * Reads an equality: an equality operand, `==` or `!=`, and the equality operand it compares with; an equality operand alone where neither follows it, the comparison it begins where a comparison operator follows it,
     * or the coalescing operator that takes it where `??` follows it. An equality does not chain, and stands beside a coalescing operator or a comparison only where a group holds one of them.
     */
    #parseEquality() {
        this.#refuseOperandStart(this.#token.start);

        const left = this.#parseAdditive();

        if (this.#token.type === '??') {
            return this.#parseCoalescingOperator(left);
        }

        if (this.#isComparisonOperator()) {
            return this.#parseComparison(left);
        }

        if (!this.#isEqualityOperator()) {
            return left;
        }

        const operator = this.#take();

        this.#refuseOperandStart(this.#token.start);

        const equality = Parser.#node('equality', [left, operator, this.#parseAdditive()]);

        if (this.#token.type === '??') {
            throw this.#fail('LEXICA1021', `'??' and '${operator.type}' stand apart, one of them grouped: write '(… ${operator.type} …) ?? …' or '… ${operator.type} (… ?? …)'`, this.#token.start);
        }

        if (this.#isEqualityOperator()) {
            throw this.#fail('LEXICA1020', "An equality compares two values and does not chain: write '(… == …) == …' to compare its result", this.#token.start);
        }

        if (this.#isComparisonOperator()) {
            throw this.#fail('LEXICA1052', Parser.#apartMessage(operator.type, this.#token.type), this.#token.start);
        }

        return equality;
    }

    /**
     * Reads a comparison after its first operand: each comparison operator and the equality operand it compares with, so `0 < width <= 600` compares `width` with both, every operator of the chain pointing one way.
     * A comparison stands beside an equality or a coalescing operator only where a group holds one of them.
     */
    #parseComparison(first) {
        const children = [first];
        const direction = COMPARISON_DIRECTIONS[this.#token.type];

        while (this.#isComparisonOperator()) {
            if (COMPARISON_DIRECTIONS[this.#token.type] !== direction) {
                const previous = children.at(-2).type;

                throw this.#fail('LEXICA1019', `A comparison chain keeps one direction, and '${this.#token.type}' turns it from '${previous}': join two comparisons with 'and', as in 'a ${previous} b and b ${this.#token.type} c'`, this.#token.start);
            }

            children.push(this.#take());
            this.#refuseOperandStart(this.#token.start);
            children.push(this.#parseAdditive());
        }

        const operator = children[1].type;

        if (this.#token.type === '??' || this.#isEqualityOperator()) {
            throw this.#fail(this.#token.type === '??' ? 'LEXICA1021' : 'LEXICA1052', Parser.#apartMessage(operator, this.#token.type), this.#token.start);
        }

        return Parser.#node('comparison', children);
    }

    /** The message for two operators that stand apart, the first written before the second with no group holding either, giving the two ways to group them. */
    static #apartMessage(first, second) {
        return `'${first}' and '${second}' stand apart, one of them grouped: write '(… ${first} …) ${second} …' or '… ${first} (… ${second} …)'`;
    }

    /** Whether the current token compares the value before it: `==` or `!=`. */
    #isEqualityOperator() {
        return this.#token.type === '==' || this.#token.type === '!=';
    }

    /** Whether the current token orders the value before it with the one after: `<`, `<=`, `>` or `>=`. */
    #isComparisonOperator() {
        return Object.hasOwn(COMPARISON_DIRECTIONS, this.#token.type);
    }

    /**
     * Reads an attempt after its `try`: the one conversion or cast the equality operand that follows ends with, which answers null where it rejects its value.
     * It attempts that operation alone, so a conversion of a conversion or of a cast is grouped to say which it attempts, and anything else is refused.
     */
    #parseTry(start) {
        const tryKeyword = this.#take();

        if (this.#isKeyword('try')) {
            throw this.#fail('LEXICA1022', "'try' attempts a conversion or a cast, and no other attempt: write 'try … to type' or 'try … as type'", this.#token.start);
        }

        const operation = this.#parseEqualityOperand();
        const kind = Parser.#kindOf(operation);

        if (kind !== 'conversion' && kind !== 'cast') {
            throw this.#fail('LEXICA1022', "'try' attempts a conversion or a cast: write 'try … to type' or 'try … as type'", start);
        }

        if (this.#chainedConversions.has(operation)) {
            const [target] = operation.children;
            const inner = target.kind === 'cast' ? `as ${this.#typeOf(target)}` : `to ${this.#typeOf(target)}`;

            throw this.#fail('LEXICA1022', `'try' attempts one operation: group the value it converts, as in 'try (… ${inner}) to ${this.#typeOf(operation)}'`, start);
        }

        return Parser.#node('attempt', [tryKeyword, operation]);
    }

    /** Refuses what an equality operand cannot start with: an equality or a comparison operator, which compares the value written before it, and a conditional, which is grouped where it is an operand. */
    #refuseOperandStart(start) {
        if (this.#isEqualityOperator() || this.#isComparisonOperator()) {
            throw this.#fail('LEXICA1013', `'${this.#token.type}' compares the value written before it: write 'it ${this.#token.type} …' to compare the implicit parameter`, start);
        }

        if (this.#isKeyword('if')) {
            throw this.#fail('LEXICA1027', 'A conditional that is an operand is enclosed in parentheses: write (if … then … else … end)', start);
        }

        if (this.#isKeyword('do')) {
            throw this.#fail('LEXICA1027', 'A do block that is an operand is enclosed in parentheses: write (do … end)', start);
        }

        if (this.#isKeyword('function')) {
            throw this.#fail('LEXICA1034', 'A function is the value of a local: write let name = function(…) … end, and call it by its name', start);
        }

        if (this.#startsArrowFunction()) {
            throw this.#fail('LEXICA1057', 'An arrow function is the value of a local or an argument: write let name = … => …, or pass it to a call', start);
        }
    }

    /** Reads a coalescing operator after its value: `??` and its fallback, an equality operand or another coalescing operator, so it associates to the right; binary arithmetic stands beside it only where a group holds one of them. */
    #parseCoalescingOperator(value) {
        this.#refuseArithmeticBeside(value, true);

        const operator = this.#take();
        const fallbackStart = this.#token.start;

        if (this.#isKeyword('not')) {
            throw this.#fail('LEXICA1021', "'??' and 'not' stand apart, one of them grouped: write '… ?? (not …)'", fallbackStart);
        }

        this.#refuseOperandStart(fallbackStart);

        const fallbackValue = this.#parseAdditive();

        this.#refuseArithmeticBeside(fallbackValue, false);

        const fallback = this.#token.type === '??' ? this.#parseCoalescingOperator(fallbackValue) : fallbackValue;

        if (this.#isEqualityOperator() || this.#isComparisonOperator()) {
            throw this.#fail('LEXICA1021', Parser.#apartMessage('??', this.#token.type), this.#token.start);
        }

        const node = Parser.#node('coalescing', [value, operator, fallback]);

        this.#ungroupedCoalescings.add(node);

        return node;
    }

    /** Refuses binary arithmetic no group holds as a side of `??`, which stands apart from it, as it does from `and`, `or` and an equality; an arithmetic negation is no binary arithmetic, so `value ?? -1` stands. */
    #refuseArithmeticBeside(side, isValue) {
        if (side.kind !== 'additive' && side.kind !== 'multiplicative') {
            return;
        }

        const operator = side.children[1].type;
        const grouped = isValue ? `'(… ${operator} …) ?? …' or '… ${operator} (… ?? …)'` : `'(… ?? …) ${operator} …' or '… ?? (… ${operator} …)'`;

        throw this.#fail('LEXICA1021', `'??' and '${operator}' stand apart, one of them grouped: write ${grouped}`, side.children[1].start);
    }

    /** Reads an additive expression: multiplicative expressions joined by `+` and `-`, left to right; the one alone where none follows. */
    #parseAdditive() {
        return this.#parseBinary('additive', ['+', '-'], () => this.#parseMultiplicative());
    }

    /** Reads a multiplicative expression: unary expressions joined by `*`, `/` and `%`, left to right; the one alone where none follows. */
    #parseMultiplicative() {
        return this.#parseBinary('multiplicative', ['*', '/', '%'], () => this.#parseUnary());
    }

    /** Reads operands the operators join, left to right, as the node of the kind, or the operand alone where no operator follows it. */
    #parseBinary(kind, operators, parseOperand) {
        const first = parseOperand();

        if (!operators.includes(this.#token.type)) {
            return first;
        }

        const children = [first];

        while (operators.includes(this.#token.type)) {
            children.push(this.#take());
            this.#refuseOperandStart(this.#token.start);
            children.push(parseOperand());
        }

        return Parser.#node(kind, children);
    }

    /** Reads a unary expression: `-` and what it negates, another unary expression or an equality operand, so `-x to Number` negates the converted value; or an equality operand alone. */
    #parseUnary() {
        if (this.#token.type !== '-') {
            return this.#parseEqualityOperand();
        }

        const minus = this.#take();

        this.#refuseOperandStart(this.#token.start);

        return Parser.#node('arithmetic-negation', [minus, this.#parseUnary()]);
    }

    /** Reads an equality operand: a chain, the cast that may end it, and the conversions that follow, each converting what is before it. */
    #parseEqualityOperand() {
        const start = this.#token.start;

        if (this.#isKeyword('try')) {
            return this.#parseTry(start);
        }

        const chain = this.#parseChain();
        let value = chain.node;

        if (this.#isKeyword('as')) {
            value = this.#parseCast(value, chain, start);
        }

        while (this.#isConversion(value, start)) {
            const converted = this.#parseConversion(value);

            // A conversion of a conversion or a cast before it in this chain is written ungrouped, which an attempt of one operation refuses.
            if (value.kind === 'conversion' || value.kind === 'cast') {
                this.#chainedConversions.add(converted);
            }

            value = converted;
        }

        return value;
    }

    /**
     * Whether the keyword `to` follows the value, which converts it. A name there is refused: one a colon follows names the next field, which a comma comes before,
     * and any other is a member written after its receiver without the dot that joins it, so the message gives the call to write, of the receiver in a group where it is a cast or a conversion, which a chain continues from only so.
     */
    #isConversion(value, start) {
        if (this.#isKeyword('to')) {
            return true;
        }

        if (this.#token.type !== 'identifier') {
            return false;
        }

        // A name on a line of its own after a body local's value ends that value, and its body says what the name begins.
        if (this.#bodyLocalsBeingRead > 0 && this.#text.slice(this.#tokens[this.#index - 1].end, this.#token.start).includes('\n')) {
            return false;
        }

        if (this.#tokens[this.#index + 1].type === '=') {
            throw this.#unexpected('LEXICA1000', "',' before the next field");
        }

        const written = this.#text.slice(start, this.#tokens[this.#index - 1].end);
        const kind = Parser.#kindOf(value);
        const receiver = kind === 'cast' || kind === 'conversion' ? `(${written})` : written;
        // A name an argument or an options object follows is a call written without its dot, and any other a property access.
        const next = this.#tokens[this.#index + 1];
        const arguments_ = next.type === '(' || next.type === '{' || ARGUMENT_STARTS.has(next.type) ? '(…)' : '';

        throw this.#fail('LEXICA1011', `A member follows its receiver after a dot: write '${receiver}.${this.#token.value}${arguments_}'`, this.#token.start);
    }

    /** Whether the keyword `to` and a type's name stand here, which only a conversion writes, after the value it converts, or a string written in the name's place. */
    #startsConversion() {
        const next = this.#tokens[this.#index + 1];

        return this.#isKeyword('to') && (this.#isWord(next) || (next.type === 'literal' && typeof next.value === 'string'));
    }

    /** Reads a conversion after the value it converts: `to` and the name of the type it converts to, written bare. It ends its chain, and another conversion may follow it. */
    #parseConversion(target) {
        const toKeyword = this.#take();
        const type = this.#readTypeName('to', 'converts to', 'Number');
        const node = Parser.#node('conversion', [target, toKeyword, type]);
        const name = this.#text.slice(SyntaxTree.startOf(type), SyntaxTree.endOf(type));

        if (this.#continuesChain()) {
            throw this.#fail('LEXICA1501', `A conversion ends its chain; group it to continue from its result, as in '(… to ${name}).value'`, this.#token.start);
        }

        if (this.#isKeyword('as')) {
            throw this.#fail('LEXICA1025', `A conversion's result is cast only in a group: write '(… to ${name}) as …'`, this.#token.start);
        }

        return node;
    }

    /**
     * Reads the name of the type a cast or a conversion names after its keyword, written bare: any word, a reserved one included, as a member's name is after its dot, qualified by its module's name and a dot where one follows it,
     * which makes a type-name node of the three. A string in its place is refused with the bare name to write, and anything else with the form the keyword takes.
     */
    #readTypeName(keyword, what, example) {
        const token = this.#token;

        if (token.type === 'literal' && typeof token.value === 'string') {
            const bare = Names.isIdentifier(token.value) ? token.value : example;

            throw this.#fail('LEXICA1026', `'${keyword}' names the type it ${what} bare, as a member's name is written: write '${keyword} ${bare}'`, token.start);
        }

        if (!this.#isWord(token)) {
            throw this.#unexpected('LEXICA1000', `the name of the type it ${what}, as in ${keyword} ${example}`);
        }

        const name = this.#take();

        if (this.#token.type !== '.') {
            return name;
        }

        const dot = this.#take();

        if (!this.#isWord(this.#token)) {
            throw this.#unexpected('LEXICA1000', `the name of the type '${this.#wordOf(name)}' declares, as in ${keyword} ${this.#wordOf(name)}.${example}`);
        }

        return Parser.#node('type-name', [name, dot, this.#take()]);
    }

    /**
     * Reads a chain: a chain input and the members and object expressions that continue it, and what a cast after it needs to know of it: whether an access of it is optional, which a group within it leaves to its own chain,
     * what its input is, what a group it starts with holds, and whether anything continues it or an object expression is among what does.
     */
    #parseChain() {
        const { start } = this.#token;
        const input = this.#token.type === '(' ? 'parenthesizedExpression' : this.#token.type === '(?' ? 'optionalEnclosedAccess' : 'input';
        const first = this.#parseChainInput();
        const grouped = Parser.#kindOf(first);

        this.#refuseChainFrom(grouped);
        const children = [first];
        let isOptional = false;
        let hasObject = false;

        for (;;) {
            if (this.#token.type === '[' || this.#token.type === '?[') {
                isOptional ||= this.#token.type === '?[';
                children.push(this.#parseIndexer());
            } else if (this.#token.type === ':' || this.#token.type === '?:') {
                this.#refuseColon(start);
            } else if (this.#token.type === '.' || this.#token.type === '?.') {
                isOptional ||= this.#token.type === '?.';
                children.push(this.#parseAfterDot(this.#take()));
            } else if (this.#token.type === '{') {
                children.push(this.#parseObject());
                hasObject = true;
            } else {
                const node = children.length === 1 ? first : Parser.#node('chain', children);

                return { node, isOptional, input, grouped, isContinued: children.length > 1, hasObject };
            }
        }
    }

    /**
     * Reads a cast after its target: `as` and the name of the type it casts to, written bare. Its target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access, and a cast continues a chain only from a group.
     */
    #parseCast(target, chain, start) {
        const isTarget = !chain.hasObject && (chain.input === 'input'
            || (chain.input === 'parenthesizedExpression' && (chain.grouped === 'cast' || (chain.grouped === 'coalescing' && !chain.isContinued)))
            || (chain.input === 'optionalEnclosedAccess' && !chain.isContinued));

        if (chain.input === 'parenthesizedExpression' && chain.grouped === 'attempt' && !chain.isContinued) {
            throw this.#fail('LEXICA1023', "An attempt is no cast's target: cast what it attempts, or attempt the cast, as in 'try a as Light'", start);
        }

        if (!isTarget) {
            throw this.#fail('LEXICA1025', `A cast's target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access, and this is none of them`, start);
        }

        return this.#readCast(target);
    }

    /** Reads `as` and the type's name after a cast's target, which nothing continues but a group. */
    #readCast(target) {
        const asKeyword = this.#take();
        const type = this.#readTypeName('as', 'casts to', 'Light');
        const node = Parser.#node('cast', [target, asKeyword, type]);
        const name = this.#text.slice(SyntaxTree.startOf(type), SyntaxTree.endOf(type));

        if (this.#continuesChain()) {
            throw this.#fail('LEXICA1053', `A cast continues a chain only from a group: write '(… as ${name})…'`, this.#token.start);
        }

        if (this.#isKeyword('as')) {
            throw this.#fail('LEXICA1024', `A cast's target holds a cast only in a group: write '(… as ${name}) as …'`, this.#token.start);
        }

        return node;
    }

    /** Reads a chain input: an input, a parenthesized expression, or an optional enclosed access. */
    #parseChainInput() {
        switch (this.#token.type) {
            case '(': {
                // A parenthesized expression holds the expression in its parentheses, which a chain may then continue from, and groups a coalescing operator it holds.
                const open = this.#take();
                const expression = this.#parseExpression();
                const close = this.#expect(')');

                this.#ungroupedCoalescings.delete(expression);

                return Parser.#node('parenthesized-expression', [open, expression, close]);
            }
            case '(?':
                return this.#parseOptionalEnclosedAccess();
            default:
                return this.#parseInput();
        }
    }

    /** Reads an optional enclosed access: its member chain, a receiver followed by at least one member, every access of which is optional, which its closing parenthesis ends. */
    #parseOptionalEnclosedAccess() {
        const open = this.#take();
        const { children, accesses } = this.#parseMemberChain(this.#parseReceiver());

        if (accesses === 0) {
            throw this.#fail('LEXICA1016', 'An optional enclosed access holds a receiver and at least one access after it, as (?room.device(name).brightness)', this.#token.start);
        }

        if (this.#token.type !== ')') {
            throw this.#unexpected('LEXICA1016', "')' closing the optional enclosed access, which holds accesses and calls alone");
        }

        return Parser.#node('optional-enclosed-access', [open, Parser.#node('member-chain', children), this.#take()]);
    }

    /** Reads a receiver within an optional enclosed access: an input, or a grouped cast, its own target's accesses optional as the enclosed access's are, where its target is no group that keeps its own rules. */
    #parseReceiver() {
        if (this.#token.type === '(?') {
            throw this.#fail('LEXICA1502', 'The receiver of an optional enclosed access is an input or a grouped cast, and no other optional enclosed access, as in (?room.device(name).brightness)', this.#token.start);
        }

        if (this.#token.type !== '(') {
            return this.#parseInput();
        }

        const open = this.#take();
        const target = this.#parseCastTarget(this.#token.start);

        if (!this.#isKeyword('as')) {
            throw this.#fail('LEXICA1502', 'A group as the receiver of an optional enclosed access holds a cast, as in (?(room.device(name) as Light).brightness)', this.#token.start);
        }

        const cast = this.#readCast(target);

        return Parser.#node('receiver', [open, cast, this.#expect(')')]);
    }

    /**
     * Reads the target of a cast that is the receiver of an optional enclosed access: a coalescing operator in parentheses or an optional enclosed access, each keeping its own rules as it does outside one,
     * or a receiver and the members after it, every one of them optional.
     */
    #parseCastTarget(start) {
        if (this.#token.type === '(?' || (this.#token.type === '(' && !this.#groupHoldsCast())) {
            const target = this.#parseChainInput();
            const kind = Parser.#kindOf(target);

            if (kind !== 'coalescing' && kind !== 'optionalChain') {
                throw this.#fail('LEXICA1025', `A cast's target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access, and this is none of them`, start);
            }

            if (this.#continuesChain() && this.#token.type !== '{') {
                throw this.#fail('LEXICA1025', 'A grouped target is cast as it is, with nothing after it but its cast, as in ((preferred ?? fallback) as Light)', this.#token.start);
            }

            return target;
        }

        const receiver = this.#parseReceiver();
        const { children, accesses } = this.#parseMemberChain(receiver);

        return accesses > 0 ? Parser.#node('member-chain', children) : receiver;
    }

    /**
     * Whether the group the current parenthesis opens holds a cast at its own level, outside any group, brackets or braces within it: one that holds `as` there and no `??` or other keyword,
     * since a cast's own level holds its target's receiver and accesses alone, while a coalescing operator's side or a conditional's branch may be a cast.
     */
    #groupHoldsCast() {
        let depth = 0;
        let holdsAs = false;

        for (let index = this.#index; index < this.#tokens.length; index++) {
            const token = this.#tokens[index];

            if (token.type === '(' || token.type === '(?' || token.type === '[' || token.type === '?[' || token.type === '{' || token.type === 'interpolation-start') {
                depth++;
            } else if (token.type === ')' || token.type === ']' || token.type === '}' || token.type === 'interpolation-end') {
                depth--;

                if (depth === 0) {
                    return holdsAs;
                }
            } else if (depth === 1 && token.type === '??') {
                return false;
            } else if (depth === 1 && token.type === 'keyword' && token.value !== 'to') {
                if (token.value !== 'as') {
                    return false;
                }

                // The type's name after `as`, and after `to` below, may be any word, a keyword among them, which tells nothing of the group.
                holdsAs = true;
                index++;
            } else if (depth === 1 && token.type === 'keyword') {
                index++;
            } else if (token.type === 'end') {
                return false;
            }
        }

        return false;
    }

    /** Reads the rest of a member chain within an optional enclosed access, the members after its receiver, every one of them optional, and how many there are. */
    #parseMemberChain(receiver) {
        const children = [receiver];
        const start = SyntaxTree.startOf(receiver);

        while (this.#continuesChain() && this.#token.type !== '{') {
            if (this.#token.type === '[' || this.#token.type === '?[') {
                children.push(this.#parseIndexer());
            } else if (this.#token.type === ':' || this.#token.type === '?:') {
                this.#refuseColon(start);
            } else {
                children.push(this.#parseAfterDot(this.#take()));
            }
        }

        return { children, accesses: children.length - 1 };
    }

    /**
     * Reads an input: `it`, a literal, a name, which the lowering reads as a local, a field, the object root or a script parameter, a reserved word after `@`, which it reads as a local or a field, a script parameter after `~`,
     * a namespace access, which a module's name begins in text read with it, or an object expression. A keyword alone keeps its meaning, so one where a value stands gives the form with `@` for the local or the field of its name.
     */
    #parseInput() {
        const token = this.#token;
        const next = this.#tokens[this.#index + 1];

        if (this.#startsConversion()) {
            throw this.#fail('LEXICA1010', `'to' converts the value written before it: write 'it to ${this.#text.slice(next.start, next.end)}' to convert the implicit parameter`, token.start);
        }

        if (token.type === 'identifier' && this.#moduleNames.has(token.value)) {
            return this.#parseNamespaceAccess();
        }

        // A name that starts a chain is a local, a field or a binding, which takes no argument, so one an argument follows after a space is a member written without its receiver; parentheses after it call the local function of its name.
        if (token.type === 'identifier' || token.type === 'lexical-reference') {
            const written = token.type === 'identifier' ? token.value : `@${token.value}`;

            this.#refuseEnclosedAccessArgument(next, written);

            if (next.type === '(') {
                return this.#parseFunctionCall(written);
            }

            if (token.type === 'identifier' && next.spaced && ARGUMENT_STARTS.has(next.type)) {
                throw this.#fail('LEXICA1503', `'${token.value}' follows no receiver: write 'it.${token.value}(…)' for a member of the implicit parameter`, token.start);
            }
        }

        switch (token.type) {
            case 'it':
            case 'literal':
            case 'identifier':
            case 'script-parameter':
            case 'lexical-reference':
                return this.#take();
            case '{':
                return this.#parseObject();
            case 'interpolated-string-start':
                return this.#parseInterpolatedString();
            case 'keyword':
                if (!STRUCTURAL_KEYWORDS.has(token.value)) {
                    // A `return`, or a `let` and the name of the local it declares, where a value stands is a declaration or a result written where only a value may stand.
                    const declares = token.value === 'return' || (token.value === 'let' && this.#isWord(next));

                    throw this.#fail(declares ? 'LEXICA1032' : 'LEXICA1010', `Found '${token.value}', a keyword: write '@${token.value}' for the local or field of that name`, token.start);
                }

                throw this.#unexpected('LEXICA1010', 'a value');
            default:
                throw this.#unexpected('LEXICA1000', 'a value');
        }
    }

    /**
     * Reads a namespace access: a module's name, its dot and the name of one of the module's members, and the arguments of a call through it where parentheses follow. A namespace is never null and has no indexer,
     * so only `.` follows it, and a module's name alone, which reads no value, gives the forms that read the local and the script parameter of its name.
     */
    #parseNamespaceAccess() {
        const moduleName = this.#take();
        const name = moduleName.value;

        if (this.#token.type !== '.') {
            const isOptional = this.#token.type === '?.';
            const access = isOptional ? `A namespace is never null, so its members are read after '.': write '${name}.…'` : `'${name}' is the namespace of the module of that name, whose members are read after a dot, as ${name}.member`;

            throw this.#fail('LEXICA1506', `${access}; write '@${name}' for the local or field of that name, or '~${name}' for the script parameter`, isOptional ? this.#token.start : moduleName.start);
        }

        const dot = this.#take();

        if (this.#token.type === 'lexical-reference') {
            throw this.#fail('LEXICA1008', `A member is named as it is written after its dot, with no '@': write '${name}.${this.#token.value}'`, this.#token.start);
        }

        const nameToken = this.#isWord(this.#token) ? this.#take() : this.#expect('identifier');
        const written = `${name}.${this.#wordOf(nameToken)}`;

        this.#refuseEnclosedAccessArgument(this.#token, written);

        if (this.#token.type !== '(') {
            return Parser.#node('namespace-access', [moduleName, dot, nameToken]);
        }

        return Parser.#node('namespace-access', [moduleName, dot, nameToken, ...this.#parseArguments(written, true)]);
    }

    /** Reads an interpolated string: its `$"`, its runs of text and its interpolations, in the order written, and its closing quote. */
    #parseInterpolatedString() {
        const children = [this.#take()];

        for (;;) {
            switch (this.#token.type) {
                case 'interpolated-text':
                    children.push(this.#take());
                    break;
                case 'interpolation-start':
                    children.push(this.#parseInterpolation());
                    break;
                case 'interpolated-string-end':
                    children.push(this.#take());

                    return Parser.#node('interpolated-string', children);
                default:
                    throw this.#unexpected('LEXICA1000', `'"' closing the interpolated string`);
            }
        }
    }

    /** Reads an interpolation: the `{` that opens it, the one expression it holds and the `}` that closes it. */
    #parseInterpolation() {
        const open = this.#take();

        if (this.#token.type === 'interpolation-end') {
            throw this.#fail('LEXICA1039', "An interpolation holds an expression between '{' and '}'", open.start);
        }

        const expression = this.#parseExpression();

        if (this.#token.type !== 'interpolation-end') {
            throw this.#unexpected('LEXICA1000', "'}' closing the interpolation");
        }

        return Parser.#node('interpolation', [open, expression, this.#take()]);
    }

    /** Refuses a chain continuing from the conditional or the do block of the kind just read, grouped or not, whose value is no receiver: a local holds it first. */
    #refuseChainFrom(kind) {
        if ((kind === 'conditional-expression' || kind === 'do-expression') && this.#continuesChain()) {
            throw this.#fail('LEXICA1028', `${kind === 'do-expression' ? 'A do block' : 'A conditional'} is never the receiver of a chain: bind its value to a local first, and continue from the local`, this.#token.start);
        }
    }

    /** Whether the current token continues a chain: an access, a computed property access, an indexer, each optional or not, or an object expression, or a colon, which the chain refuses. */
    #continuesChain() {
        return CHAIN_CONTINUATIONS.has(this.#token.type);
    }

    /**
     * Reads an indexer: `[`, or `?[` where it is optional, and its one key, an expression, before `]`. The parser knows no indexer: the vocabulary says whether the access before the brackets names a named indexer
     * or a property whose answer the brackets index.
     */
    #parseIndexer() {
        const open = this.#take();

        if (this.#token.type === ']') {
            throw this.#fail('LEXICA1017', 'An indexer takes one key in its brackets', this.#token.start);
        }

        const key = this.#parseExpression();

        if (this.#token.type === ',') {
            throw this.#fail('LEXICA1017', 'An indexer takes one key', this.#token.start);
        }

        return Parser.#node('indexer', [open, key, this.#expect(']')]);
    }

    /**
     * Refuses a colon in a chain, where no member follows one: a named indexer is written after a dot, as `.name[…]`, and a property read by a computed name after one too, as `.[…]`, each after `?.` where it is optional.
     * The message gives the chain from its start with the dot in the colon's place.
     */
    #refuseColon(start) {
        const colon = this.#token;
        const dot = colon.type === '?:' ? '?.' : '.';
        const next = this.#tokens[this.#index + 1];
        const name = this.#isWord(next) ? this.#wordOf(next) : '';

        throw this.#fail(name === '' ? 'LEXICA1014' : 'LEXICA1500', `A member follows its receiver after a dot, never a colon: write '${this.#text.slice(start, colon.start)}${dot}${name}[…]'`, colon.start);
    }

    /** Reads what follows a dot, or the `?.` of an optional access: a property read by a computed name in brackets, a dot property access, or a member call. */
    #parseAfterDot(dot) {
        if (this.#token.type === '?[') {
            throw this.#fail('LEXICA1507', "An optional computed property access writes its '?' before the dot, as '?.[…]', its brackets directly after the dot", this.#token.start);
        }

        if (this.#token.type !== '[') {
            return this.#parseDotPropertyAccessOrMemberCall(dot);
        }

        const open = this.#take();
        const expression = this.#parseExpression();

        return Parser.#node('computed-property-access', [dot, open, expression, this.#expect(']')]);
    }

    /** Reads a member after its dot, or the `?.` of an optional access: a dot property access, or a member call where parentheses follow the name. */
    #parseDotPropertyAccessOrMemberCall(dot) {
        // After a dot only a member's name stands, so any word names one there, a reserved word among them, written as it is.
        if (this.#token.type === 'lexical-reference') {
            throw this.#fail('LEXICA1008', `A member is named as it is written after its dot, with no '@': write '.${this.#token.value}'`, this.#token.start);
        }

        const nameToken = this.#isWord(this.#token) ? this.#take() : this.#expect('identifier');
        const name = this.#wordOf(nameToken);

        this.#refuseEnclosedAccessArgument(this.#token, `.${name}`);

        if (this.#token.type !== '(') {
            if (this.#token.type === 'literal') {
                throw this.#fail('LEXICA1508', `An argument after a dot is enclosed in parentheses, as a call's is, '.${name}(…)'`, this.#token.start);
            }

            return Parser.#node('dot-property-access', [dot, nameToken]);
        }

        return Parser.#node('member-call', [dot, nameToken, ...this.#parseArguments(name, true)]);
    }

    /**
     * Whether what stands here is written as a named argument would be, which no call takes: a name and `=`, as a field gives its value, or a name and a colon, as `relativeTo: other` writes one,
     * rather than a chain the colon is refused in, whose colon brackets follow, or a name and then brackets, as `device:["mode"]` and `device:setting["mode"]` do.
     */
    #startsNamedArgument() {
        return this.#startsEntry() || this.#startsColonEntry();
    }

    /** Whether a word and `=` begin what stands here, as a field, a local's name or a binding's does, whatever the word, a reserved word among them. */
    #startsEntry() {
        return this.#isWord(this.#token) && this.#tokens[this.#index + 1]?.type === '=';
    }

    /**
     * Whether a word and a colon begin what stands here, as no field, local or binding writes its value, rather than a chain from the word whose colon brackets follow directly, or a name and then brackets,
     * which the chain refuses; a space after the colon makes it an entry's, as `k: panel["id"]` is.
     */
    #startsColonEntry() {
        if (!this.#isWord(this.#token) || this.#tokens[this.#index + 1]?.type !== ':') {
            return false;
        }

        const afterColon = this.#tokens[this.#index + 2];

        return afterColon.spaced || !(afterColon.type === '[' || (this.#isWord(afterColon) && this.#tokens[this.#index + 3]?.type === '['));
    }

    /** Whether the token writes a word: a name, a keyword, `it`, or the word of a literal, which a declaration, a member's name and a type's take as they are, whatever the word means where an expression stands. */
    #isWord(token) {
        return token.type === 'identifier' || token.type === 'keyword' || token.type === 'it' || (token.type === 'literal' && (typeof token.value === 'boolean' || token.value === null));
    }

    /** The word a token writes, as its text spells it. */
    #wordOf(token) {
        return this.#text.slice(token.start, token.end);
    }

    /** Written text as a message quotes it: in single quotes, or in double quotes where it holds a single quote and no double one, as a raw string does. */
    static #quote(text) {
        return text.includes("'") && !text.includes('"') ? `"${text}"` : `'${text}'`;
    }

    /** Reads operands joined by the operator, answering the operand alone where there is one. */
    #parseLogical(operator, parseOperand) {
        const first = parseOperand();

        if (!this.#isKeyword(operator)) {
            return first;
        }

        const children = [first];

        while (this.#isKeyword(operator)) {
            this.#refuseUngroupedCoalescing(children.at(-1), operator);
            children.push(this.#take(), parseOperand());
        }

        this.#refuseUngroupedCoalescing(children.at(-1), operator);

        return Parser.#node(operator === 'or' ? 'disjunction' : 'conjunction', children);
    }

    /** Refuses a coalescing operator no group holds as an operand of `and` or `or`, which it never stands beside. */
    #refuseUngroupedCoalescing(operand, operator) {
        if (this.#ungroupedCoalescings.has(operand)) {
            throw this.#fail('LEXICA1021', `'??' and '${operator}' stand apart, one of them grouped: write '(… ?? …) ${operator} …' or '… ?? (… ${operator} …)'`, SyntaxTree.startOf(operand));
        }
    }

    /** Reads an object expression: its locals, each followed by a comma, and then its fields, at least one. */
    #parseObject() {
        const children = [this.#expect('{')];
        let locals = 0;

        while (this.#isLocal()) {
            children.push(this.#parseLocal());
            locals++;

            if (this.#token.type !== ',') {
                // An object expression closed after its local holds no field.
                throw this.#unexpected(this.#token.type === '}' ? 'LEXICA1018' : 'LEXICA1000', "',' after the local, which the fields follow");
            }

            children.push(this.#take());
        }

        if (this.#token.type === '}') {
            const example = locals > 0 ? '{ let climate = it.climate, warmth = climate?.temperature }' : '{ size = it.size }';

            throw this.#fail('LEXICA1018', `An object expression holds at least one field${locals > 0 ? ' after its locals' : ''}, as ${example}`, this.#token.start);
        }

        while (this.#token.type !== '}') {
            children.push(this.#parseField());

            if (this.#token.type === ',') {
                children.push(this.#take());
            } else if (this.#token.type !== '}') {
                throw this.#unexpected('LEXICA1000', "',' or '}'");
            }
        }

        children.push(this.#take());

        return Parser.#node('object', children);
    }

    /** Reads a local, of a body or of an object expression, whose holder reads what separates it from the next: `let`, its name, `=` and its initializer, an expression, a function or an arrow function. */
    #parseLocal() {
        const letKeyword = this.#take();

        if (!this.#startsEntry()) {
            this.#refuseName('LEXICA1051', 'A local takes its value after =', 'A local is written with let, its name and = before its value, as let width = …', 'let ');
        }

        const name = this.#take();
        const equals = this.#take();
        let initializer;

        if (this.#isKeyword('function')) {
            initializer = this.#parseFunctionExpression();
        } else {
            initializer = this.#startsArrowFunction() ? this.#parseArrowFunction() : this.#parseExpression();
        }

        return Parser.#node('local', [letKeyword, name, equals, initializer]);
    }

    /** Reads a field: its name, `=` and its value. */
    #parseField() {
        if (this.#isLocal()) {
            throw this.#fail('LEXICA1504', 'A local is written before the fields of its object expression', this.#token.start);
        }

        if (!this.#startsEntry()) {
            // A field written without its name, and a `return` among the fields, each have a code of their own.
            this.#refuseName(this.#isKeyword('return') ? 'LEXICA1033' : 'LEXICA1051', 'A field takes its value after =', 'A field is written with its name and = before its value, as size = it.size', '');
        }

        return Parser.#node('field', [this.#take(), this.#take(), this.#parseExpression()]);
    }

    /**
     * Refuses what stands where a field, a local or a binding is named: a reserved word after `@`, since a declaration writes its name as it is; a word a colon follows, which gives its value as `=` does,
     * as the colon message says with the form to write, its prefix written before the word; a number or a string `=` or a colon follows, which names nothing; and anything else is written as the message gives,
     * the last two with the code given, the one of the declaration written without its name.
     */
    #refuseName(code, colonMessage, message, prefix) {
        const token = this.#token;

        if (token.type === 'lexical-reference') {
            throw this.#fail('LEXICA1008', `A name is declared as it is written, with no '@': write '${prefix}${token.value} = …'`, token.start);
        }

        if (this.#startsColonEntry()) {
            throw this.#fail('LEXICA1003', `${colonMessage}: write '${prefix}${this.#wordOf(token)} = …'`, this.#tokens[this.#index + 1].start);
        }

        if (token.type === 'literal' && (this.#tokens[this.#index + 1]?.type === '=' || this.#tokens[this.#index + 1]?.type === ':')) {
            throw this.#fail(code, `${Parser.#quote(this.#wordOf(token))} is a literal, and names nothing`, token.start);
        }

        throw this.#fail(code, message, token.start);
    }

    get #token() {
        return this.#tokens[this.#index];
    }

    /** Whether a local starts here: `let`, which `=` or a colon after it would make a field's name instead. */
    #isLocal() {
        const next = this.#tokens[this.#index + 1]?.type;

        return this.#isKeyword('let') && next !== '=' && next !== ':';
    }

    #isKeyword(word) {
        return this.#token.type === 'keyword' && this.#token.value === word;
    }

    #advance() {
        this.#index++;
    }

    /** The current token, moving past it. */
    #take() {
        return this.#tokens[this.#index++];
    }

    #expect(type) {
        const token = this.#token;

        if (token.type !== type) {
            throw this.#unexpected('LEXICA1000', TOKEN_DESCRIPTIONS[type] ?? `'${type}'`);
        }

        this.#advance();

        return token;
    }

    /**
     * The syntax error of the code and the message at the offset, every one the parser reports passing through here, which a strict parse throws. It is where recovery would report from,
     * a foundation for it alone: recovering also needs points to resume from, missing and unexpected tokens handled, and progress through the text guaranteed.
     */
    #fail(code, message, offset) {
        return LexicaErrors.syntax(code, message, this.#text, offset);
    }

    /** The syntax error of a token other than the one expected, of the code given, or of the one of an `=` written where no name takes its value. */
    #unexpected(code, expected) {
        const token = this.#token;

        // `=` gives a field, a local or a binding its value, so one anywhere else is an equality written with one sign, or the second half of a comparison operator written apart.
        if (token.type === '=') {
            const previous = this.#tokens[this.#index - 1];
            const next = this.#tokens[this.#index + 1];

            if (previous?.type === '<' || previous?.type === '>') {
                return this.#fail('LEXICA1001', `'${previous.type}=' is one operator, written with nothing between its signs`, previous.start);
            }

            if (next?.type === '=' || next?.type === '>') {
                return this.#fail('LEXICA1001', `'=${next.type}' is one operator, written with nothing between its signs`, token.start);
            }

            return this.#fail('LEXICA1004', "Unexpected '=' in an expression. Use '==' to compare values.", token.start);
        }
        const found = token.type === 'end' ? TOKEN_DESCRIPTIONS.end : Parser.#quote(this.#text.slice(token.start, token.end));

        return this.#fail(code, `Expected ${expected}, found ${found}`, token.start);
    }

    /**
     * The syntax error of a body's closer not found after its result, of the code given where the closer is missing, the text ending or what encloses the body closing,
     * and of anything else written after the result, which ends its body.
     */
    #afterBody(code, expected) {
        if (this.#token.type === 'end' || this.#token.type === '=' || BODY_ENCLOSURE_CLOSINGS.has(this.#token.type) || (this.#token.type === 'keyword' && STRUCTURAL_KEYWORDS.has(this.#token.value))) {
            return this.#unexpected(code, expected);
        }

        return this.#fail('LEXICA1055', "Nothing follows a body's result, which ends it", this.#token.start);
    }

    static #node(kind, children) {
        return { kind, children };
    }

    /** The name of the type a conversion's or a cast's node names. */
    #typeOf(node) {
        return this.#wordOf(node.children[2]);
    }

    /**
     * The kind of definition node a syntax node lowers to, as far as the parser's checks ask it: a group is what it holds, a chain an optional chain where an access of it is optional,
     * and an optional enclosed access an optional chain.
     */
    static #kindOf(child) {
        switch (child.kind) {
            case 'parenthesized-expression':
                return Parser.#kindOf(child.children[1]);
            case 'chain':
                return child.children.some(part => MEMBER_EXPRESSIONS.has(part.kind) && OPTIONAL_ACCESSES.has(part.children[0].type)) ? 'optionalChain' : 'access';
            case 'optional-enclosed-access':
                return 'optionalChain';
            default:
                return child.kind ?? child.type;
        }
    }
}
