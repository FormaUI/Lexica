/**
 * DefinitionWriter — a definition's node as the Nexo text that writes it, parenthesized where its grouping needs it: compact, as a diagnostic quotes it, or laid out on lines, as formatting gives its canonical text
 */

import { DefinitionValidator } from './DefinitionValidator.mjs';
import { Imports } from './Imports.mjs';
import { Names } from './Names.mjs';

/** The escape the canonical text writes for each character it escapes with a letter or the character itself; any other character it escapes it writes as a Unicode escape. */
const ESCAPED = Object.freeze({ '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\u001B': '\\e' });

/** The characters the canonical text escapes: a double quote, a backslash, and every character that shows nothing of itself, a control, a format, a line or paragraph separator, or a space separator but the space. */
const ESCAPED_CHARACTERS = /["\\\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|(?! )\p{Zs}/gu;

/** How tightly each kind of expression binds, the loosest lowest: one written where a tighter one stands is parenthesized. An optional chain is a cast's target as it is, and is grouped where a chain continues from it, since its short-circuit ends where it does. */
const PRECEDENCE = { conditional: 0, body: 0, do: 0, function: 0, range: 1, coalescing: 1, or: 2, and: 3, not: 4, equality: 5, comparison: 5, additive: 6, multiplicative: 7, arithmeticNegation: 8, fromEndIndex: 8, try: 9, conversion: 10, cast: 11, optionalChain: 12 };

/** How tightly a chain binds that no optional chain holds: a property access, a call, an indexer, an object expression, `it`, `root`, a namespace, a local, a literal or a script parameter. */
const CHAIN_PRECEDENCE = 13;

/** The indentation of one level of an object expression laid out on lines. */
const INDENTATION = '    ';

export class DefinitionWriter {
    /**
     * Quotes the node: its compact text, as a diagnostic quotes it, which parses: on one line but where a boundary or a keyword block requires a line break, a body that uses `return` its locals and its result each on a
     * line of its own and every keyword block around it in block form, and what follows a block's `end` that is no closing punctuation on the line after it.
     * @param {object} node A node of a definition.
     * @param {ReadonlySet<string>} [namespaceNames] The local names the script's imports give modules, each beginning its namespace, as the language's words keep their meaning; none where its imports give none.
     */
    static quote(node, namespaceNames = Names.noNamespaceNames) {
        return DefinitionWriter.#writing(namespaceNames, true, () => (node.kind === 'body' ? DefinitionWriter.#bodyText(node, 0) : DefinitionWriter.#write(node, 0)));
    }

    /**
     * The canonical text of the node, laid out on lines: an object expression of one field and no locals, whose value is on one line, stays on one line, and any other has a line for each entry, indented a level; a conditional with an `elseif` has a line for each clause.
     * @param {object} node A node of a definition.
     * @param {ReadonlySet<string>} [namespaceNames] The local names the script's imports give modules, each beginning its namespace, as the language's words keep their meaning; none where its imports give none.
     */
    static format(node, namespaceNames = Names.noNamespaceNames) {
        // An expression that is a body writes its locals and its return alone, which a do block elsewhere encloses.
        return DefinitionWriter.#writing(namespaceNames, false, () => (node.kind === 'body' ? DefinitionWriter.#bodyText(node, 0) : DefinitionWriter.#write(node, 0)));
    }

    /**
     * The canonical text of a script's definition, as `nexo.format` gives it: each import it records but those its destination supplies, on a line of its own in order of the local name it gives, an empty line, and its
     * body laid out on lines, its namespaces written by the local names every import gives.
     * @param {object} definition A validated definition.
     * @param {readonly object[]} [suppliedImports] The imports the text's destination supplies, which it leaves out.
     */
    static formatScript(definition, suppliedImports = []) {
        const imports = DefinitionWriter.#writtenImports(definition, suppliedImports);
        const body = DefinitionWriter.format(definition.expression, Imports.namespaceNamesOf(definition.imports));

        return imports.length === 0 ? body : `${imports.join('\n')}\n\n${body}`;
    }

    /**
     * The compact text of a script's definition, as `nexo.quote` gives it: each import it records but those its destination supplies, on a line of its own, since each begins one, and its compact body on the next line,
     * as a diagnostic quotes it.
     * @param {object} definition A validated definition.
     * @param {readonly object[]} [suppliedImports] The imports the text's destination supplies, which it leaves out.
     */
    static quoteScript(definition, suppliedImports = []) {
        const body = DefinitionWriter.quote(definition.expression, Imports.namespaceNamesOf(definition.imports));

        return [...DefinitionWriter.#writtenImports(definition, suppliedImports), body].join('\n');
    }

    /** The text of each import the definition records that its destination does not supply, in the definition's order. */
    static #writtenImports(definition, suppliedImports) {
        return definition.imports.filter(entry => !suppliedImports.some(supplied => Imports.isSameImport(supplied, entry))).map(entry => Imports.quote(entry));
    }

    /** The namespace names the text being written is written with. @type {ReadonlySet<string>} */
    static #namespaceNames = Names.noNamespaceNames;

    /** Whether the text being written is compact, breaking lines only where line structure requires, rather than laid out on lines. */
    static #isCompact = false;

    /**
     * What the writing gives with the namespace names and the layout in effect, in the writer's static state, which holds one writing at a time; those of any writing around it are restored in `finally`, whether the
     * writing completes or throws.
     */
    static #writing(namespaceNames, isCompact, write) {
        const enclosingNamespaceNames = DefinitionWriter.#namespaceNames;
        const enclosingIsCompact = DefinitionWriter.#isCompact;

        try {
            DefinitionWriter.#namespaceNames = namespaceNames;
            DefinitionWriter.#isCompact = isCompact;

            return write();
        } finally {
            DefinitionWriter.#namespaceNames = enclosingNamespaceNames;
            DefinitionWriter.#isCompact = enclosingIsCompact;
        }
    }

    /**
     * The text that writes the node, compact or laid out on lines as the writing is, each line it breaks beginning at the level's indentation.
     * @param {object} node
     * @param {number} level
     */
    static #write(node, level) {
        switch (node.kind) {
            case 'literal':
                return DefinitionWriter.#literal(node.value);
            case 'scriptParameter':
                // A script parameter a reserved word or a namespace name names, or one hidden where it stands, which validation marks on its canonical node, is written with `~`.
                return Names.needsPrefix(node.name, DefinitionWriter.#namespaceNames) || DefinitionValidator.isHidden(node) ? `~${node.name}` : node.name;
            case 'it':
                return 'it';
            case 'root':
                return 'root';
            case 'namespace':
                // A namespace a reserved word names is its import binding, which `@` reads where the word alone keeps its meaning.
                return Names.isReservedWord(node.name) ? `@${node.name}` : node.name;
            case 'local':
                return DefinitionWriter.#localNameText(node.name);
            case 'memberAccess':
                return typeof node.name === 'string'
                    ? `${DefinitionWriter.#within(node.receiver, CHAIN_PRECEDENCE, level)}${DefinitionWriter.#joiner(node)}${node.name}`
                    : `${DefinitionWriter.#within(node.receiver, CHAIN_PRECEDENCE, level)}${DefinitionWriter.#dot(node)}[${DefinitionWriter.#write(node.name, level)}]`;
            case 'call':
                return `${node.callee.kind === 'local' ? DefinitionWriter.#localNameText(node.callee.name) : DefinitionWriter.#write(node.callee, level)}(${DefinitionWriter.#arguments(node, level)})`;
            case 'indexerAccess': {
                const brackets = node.extension === undefined ? (node.optional === true ? '?[' : '[') : `${node.optional === true ? '?:' : ':'}${DefinitionWriter.#extensionText(node.extension)}[`;

                return `${DefinitionWriter.#within(node.receiver, CHAIN_PRECEDENCE, level)}${brackets}${DefinitionWriter.#write(node.argument, level)}]`;
            }
            case 'optionalChain':
                return DefinitionWriter.#write(node.chain, level);
            case 'list':
                return `[${DefinitionWriter.#items(node.items, level)}]`;
            case 'dictionary':
                return DefinitionWriter.#dictionary(node, level);
            case 'equality':
                return DefinitionWriter.#equality(node, '==', level);
            case 'interpolatedString':
                return DefinitionWriter.#interpolatedString(node, level);
            case 'comparison':
                // A chain is written as one, an operator between each two of its operands.
                return node.operands.map((operand, index) => `${index === 0 ? '' : ` ${node.operators[index - 1]} `}${DefinitionWriter.#within(operand, PRECEDENCE.additive, level)}`).join('');
            case 'conditional':
                return DefinitionWriter.#conditional(node, level);
            case 'function':
                return DefinitionWriter.#function(node, level);
            case 'do':
                return DefinitionWriter.#block('do', node.body, level);
            case 'body':
                // The root expression's body, which a do block, a function and a conditional's branch each write their own way.
                return DefinitionWriter.#bodyText(node, level);
            case 'coalescing':
                // A coalescing operator associates to the right, so a fallback that is one is written as it is.
                return `${DefinitionWriter.#within(node.value, PRECEDENCE.arithmeticNegation, level)} ?? ${node.fallback.kind === 'coalescing' ? DefinitionWriter.#write(node.fallback, level) : DefinitionWriter.#within(node.fallback, PRECEDENCE.arithmeticNegation, level)}`;
            case 'arithmetic': {
                // Operators of one level associate to the left, so a right operand of that level is grouped.
                const precedence = DefinitionWriter.#precedenceOf(node);

                return `${DefinitionWriter.#within(node.left, precedence, level)} ${node.operator} ${DefinitionWriter.#within(node.right, precedence + 1, level)}`;
            }
            case 'arithmeticNegation': {
                // A negated negative number, or an arithmetic negation, is grouped, so the signs never run together.
                const { operand } = node;
                const runsTogether = operand.kind === 'arithmeticNegation' || (operand.kind === 'literal' && typeof operand.value === 'number' && (operand.value < 0 || Object.is(operand.value, -0)));

                return `-${runsTogether ? `(${DefinitionWriter.#write(operand, level)})` : DefinitionWriter.#within(operand, PRECEDENCE.arithmeticNegation, level)}`;
            }
            case 'fromEndIndex':
                // An index's offset is an equality operand, so an operator expression or a negative number is grouped after its `^`.
                return `^${DefinitionWriter.#within(node.offset, PRECEDENCE.try, level)}`;
            case 'range':
                // A boundary is an arithmetic negation, so an operator expression or another range is grouped, and `..` stands between them with no space.
                return `${node.start === undefined ? '' : DefinitionWriter.#within(node.start, PRECEDENCE.arithmeticNegation, level)}..${node.end === undefined ? '' : DefinitionWriter.#within(node.end, PRECEDENCE.arithmeticNegation, level)}`;
            case 'not':
                // The negation of an equality is written as `!=`, which is its canonical text.
                return node.operand.kind === 'equality' ? DefinitionWriter.#equality(node.operand, '!=', level) : `not ${DefinitionWriter.#within(node.operand, PRECEDENCE.not, level)}`;
            case 'cast':
                return `${DefinitionWriter.#within(node.operand, PRECEDENCE.optionalChain, level)} as ${node.type}`;
            case 'conversion':
                // A conversion converts what is before it, so one that converts another is written as it is.
                return `${DefinitionWriter.#within(node.operand, PRECEDENCE.conversion, level)} to ${node.type}`;
            case 'try':
                return `try ${DefinitionWriter.#attempted(node.operand, level)}`;
            case 'and':
            case 'or':
                return node.operands.map(operand => DefinitionWriter.#within(operand, PRECEDENCE[node.kind] + 1, level)).join(` ${node.kind} `);
            default: {
                const objectText = DefinitionWriter.#object(node, level);

                return node.context === undefined ? objectText : `${DefinitionWriter.#within(node.context, CHAIN_PRECEDENCE, level)} ${objectText}`;
            }
        }
    }

    /** The dot before an access or a call: `?.` for an optional one, and `.` for one that requires its receiver. */
    static #dot(node) {
        return node.optional === true ? '?.' : '.';
    }

    /** What joins a named access to its receiver: its dot, or, where it selects an extension explicitly, `:` or `?:`, the extension's name as the definition holds it and a dot. */
    static #joiner(node) {
        return node.extension === undefined ? DefinitionWriter.#dot(node) : `${node.optional === true ? '?:' : ':'}${DefinitionWriter.#extensionText(node.extension)}.`;
    }

    /** An extension's name as an extension access writes it: its name, qualified by its module's local name where the definition qualifies it. */
    static #extensionText(extension) {
        return extension.module === undefined ? extension.name : `${extension.module}.${extension.name}`;
    }

    /**
     * A literal as Nexo writes it: a string in double quotes, a double quote, a backslash, a line feed, a carriage return, a tab and an escape character escaped by their letters,
     * any other control, format or separator character but the space as a Unicode escape in upper-case hexadecimal, and every other character as itself; negative zero as `-0`, which JSON writes as zero; anything else as JSON writes it.
     */
    static #literal(value) {
        if (typeof value === 'string') {
            return `"${DefinitionWriter.#stringText(value)}"`;
        }

        return Object.is(value, -0) ? '-0' : JSON.stringify(value);
    }

    /** A string's characters as a string writes them between its quotes, each escape as the canonical text writes it. */
    static #stringText(value) {
        return value.replaceAll(ESCAPED_CHARACTERS, character => ESCAPED[character] ?? `\\u{${character.codePointAt(0).toString(16).toUpperCase()}}`);
    }

    /**
     * An interpolated string: its text as a string's, each brace doubled, and each interpolation's expression compact, as a diagnostic quotes it, which an interpolation's simple expression writes on its one line, so no layout
     * breaks the string, the expression grouped where it begins with an object expression, whose `{` an interpolation never begins with.
     */
    static #interpolatedString(node, level) {
        const parts = node.parts.map(part => {
            if (part.kind === 'text') {
                return DefinitionWriter.#stringText(part.value.replaceAll(/[{}]/g, '$&$&'));
            }

            const expression = DefinitionWriter.#writing(DefinitionWriter.#namespaceNames, true, () => DefinitionWriter.#write(part.expression, level));

            return `{${expression.startsWith('{') ? `(${expression})` : expression}}`;
        });

        return `$"${parts.join('')}"`;
    }

    /**
     * An object expression's braces and entries, its locals first: on one line, or with a line for each entry, indented a level, where it is laid out on lines and is more than one field on one line, or where an entry
     * spans lines, compact or not, since what follows a block's `end` on its line is closing punctuation alone.
     */
    static #object(node, level) {
        const entries = [
            ...(node.locals ?? []).map(local => `let ${local.name} = ${DefinitionWriter.#write(local.value, level + 1)}`),
            ...node.objectFields.map(field => `${field.name} = ${DefinitionWriter.#write(field.value, level + 1)}`),
        ];
        const isOneLine = DefinitionWriter.#isCompact || (node.locals === undefined && entries.length === 1);

        if (isOneLine && !entries.some(entry => entry.includes('\n'))) {
            return `{ ${entries.join(', ')} }`;
        }

        const indentation = INDENTATION.repeat(level + 1);

        return `{\n${entries.map(entry => `${indentation}${entry}`).join(',\n')}\n${INDENTATION.repeat(level)}}`;
    }

    /**
     * A dictionary's brackets and entries, each its key as a string is written, `=` and its value: `[=]` where it holds none, on one line where it is compact or holds one entry, and otherwise with a line for each entry,
     * indented a level, as an object expression is laid out, and so wherever an entry spans lines.
     */
    static #dictionary(node, level) {
        if (node.entries.length === 0) {
            return '[=]';
        }

        const entries = node.entries.map(entry => `${DefinitionWriter.#literal(entry.key)} = ${DefinitionWriter.#write(entry.value, level + 1)}`);
        const isOneLine = DefinitionWriter.#isCompact || entries.length === 1;

        if (isOneLine && !entries.some(entry => entry.includes('\n'))) {
            return `[${entries.join(', ')}]`;
        }

        const indentation = INDENTATION.repeat(level + 1);

        return `[\n${entries.map(entry => `${indentation}${entry}`).join(',\n')}\n${INDENTATION.repeat(level)}]`;
    }

    /** The operation `try` attempts: a cast as it is, and a conversion whose value is grouped where it is a conversion or a cast, so `try` attempts the conversion alone. */
    static #attempted(node, level) {
        if (node.kind !== 'conversion') {
            return DefinitionWriter.#write(node, level);
        }

        const value = node.operand.kind === 'conversion' || node.operand.kind === 'cast' ? `(${DefinitionWriter.#write(node.operand, level)})` : DefinitionWriter.#within(node.operand, PRECEDENCE.conversion, level);

        return `${value} to ${node.type}`;
    }

    /** An equality, or its negation, as its operator writes it: two equality operands, each grouped where it binds more loosely than arithmetic. */
    static #equality(node, operator, level) {
        return `${DefinitionWriter.#within(node.left, PRECEDENCE.additive, level)} ${operator} ${DefinitionWriter.#within(node.right, PRECEDENCE.additive, level)}`;
    }

    /**
     * How tightly the node binds: an arithmetic node by its operator's level, a negative number as an arithmetic negation, since its `-` is one in text, so what follows it, a conversion or an access, groups it,
     * and any other by its kind's.
     */
    static #precedenceOf(node) {
        if (node.kind === 'arithmetic') {
            return node.operator === '+' || node.operator === '-' ? PRECEDENCE.additive : PRECEDENCE.multiplicative;
        }

        if (node.kind === 'literal' && typeof node.value === 'number' && (node.value < 0 || Object.is(node.value, -0))) {
            return PRECEDENCE.arithmeticNegation;
        }

        return PRECEDENCE[node.kind] ?? CHAIN_PRECEDENCE;
    }

    /** The text of a name a lexical reference reads, a local's, an object field's, a conditional binding's or a function parameter's: its name, after `@` where a reserved word or a namespace's local name names it, which written alone keeps its own meaning. */
    static #localNameText(name) {
        return Names.needsPrefix(name, DefinitionWriter.#namespaceNames) ? `@${name}` : name;
    }

    /** A call's arguments, as a list of nodes is written. */
    static #arguments(node, level) {
        return DefinitionWriter.#items(node.arguments, level);
    }

    /** Nodes in order, a call's arguments or a list's items, separated by commas, the one after a node that ends with a block's `end` on the next line, since only closing punctuation follows `end` on its line. */
    static #items(nodes, level) {
        const written = nodes.map(item => DefinitionWriter.#write(item, level));

        return written.map((argument, index) => (index === 0 ? argument : `${DefinitionWriter.#endsWithBlock(written[index - 1]) ? `\n${INDENTATION.repeat(level)}` : ' '}${argument}`)).join(',');
    }

    /** Whether the text ends with a block's `end` on a line of its own, which only closing punctuation may follow on that line. */
    static #endsWithBlock(text) {
        return /\n\s*end$/.test(text);
    }

    /** A function: its parameters, and its body as a block writes it; an arrow function its parameters, one alone or several in parentheses, `=>` and the expression that is its body. */
    static #function(node, level) {
        if (node.arrow === true) {
            const parameters = node.parameters.length === 1 ? node.parameters[0] : `(${node.parameters.join(', ')})`;

            return `${parameters} => ${DefinitionWriter.#write(node.body, level)}`;
        }

        return DefinitionWriter.#block(`function(${node.parameters.join(', ')})`, node.body, level);
    }

    /**
     * A block, a function or a do block, after its header: a body of one expression on its line, or a body that returns its result, or one expression that spans lines, in block form, on the lines a level within it, its
     * `end` back at the block's own, compact or not, since a keyword block that spans lines at all is in block form.
     */
    static #block(header, body, level) {
        if (body.kind !== 'body') {
            const written = DefinitionWriter.#write(body, level + 1);

            return written.includes('\n') ? `${header}\n${INDENTATION.repeat(level + 1)}${written}\n${INDENTATION.repeat(level)}end` : `${header} ${written} end`;
        }

        return `${header}\n${INDENTATION.repeat(level + 1)}${DefinitionWriter.#bodyText(body, level + 1)}\n${INDENTATION.repeat(level)}end`;
    }

    /** A body's locals and the `return` that gives its result, each on a line of the level's indentation, as each starts a line of its own. */
    static #bodyText(node, level) {
        const entries = [...node.locals.map(local => `let ${local.name} = ${DefinitionWriter.#write(local.value, level)}`), `return ${DefinitionWriter.#write(node.result, level)}`];

        return entries.join(`\n${INDENTATION.repeat(level)}`);
    }

    /**
     * A conditional's clauses, each a condition or a conditional binding, and the `end` that closes them: a conditional of its own style nested in its alternative is written as an `elseif`, and one in its condition or consequent in parentheses; every branch gives its result with `return` where the branches are bodies.
     * On one line where none of its branches is a body and none of its text spans lines, compact, or laid out where it has no `elseif` too; otherwise in block form, each clause on a line of its own ending in `then` or
     * `else`, its branch on the lines a level within it, and `end` on a line of its own.
     */
    static #conditional(node, level) {
        const clauses = [];
        let current = node;

        for (;;) {
            const test = current.binding === undefined
                ? DefinitionWriter.#within(current.condition, PRECEDENCE.coalescing, level)
                : `let ${current.binding.name} = ${DefinitionWriter.#within(current.binding.value, PRECEDENCE.coalescing, level)}`;

            clauses.push({ header: `${clauses.length === 0 ? 'if' : 'elseif'} ${test} then`, branch: current.consequent, isAlternative: false });

            // An alternative that is a conditional of the same style is an `elseif`; one of the other is the expression an implicit conditional's `else` gives.
            if (current.alternative.kind !== 'conditional' || (current.alternative.consequent.kind === 'body') !== (current.consequent.kind === 'body')) {
                clauses.push({ header: 'else', branch: current.alternative, isAlternative: true });
                break;
            }

            current = current.alternative;
        }

        const branchText = ({ branch, isAlternative }, branchLevel) => {
            if (branch.kind === 'body') {
                return DefinitionWriter.#bodyText(branch, branchLevel);
            }

            // A do block closes itself with its `end`, so it is a branch as it is; a conditional in a consequent is grouped.
            return isAlternative || branch.kind === 'do' ? DefinitionWriter.#write(branch, branchLevel) : DefinitionWriter.#within(branch, PRECEDENCE.coalescing, branchLevel);
        };
        const hasBody = clauses.some(clause => clause.branch.kind === 'body');

        // A conditional that spans lines at all, one of its branches' or tests' texts among them, is in block form, as line structure requires, and a body's locals and its `return` each start a line.
        const oneLine = `${clauses.map(clause => `${clause.header} ${branchText(clause, level)}`).join(' ')} end`;

        if ((DefinitionWriter.#isCompact || clauses.length === 2) && !hasBody && !oneLine.includes('\n')) {
            return oneLine;
        }

        const lineBreak = `\n${INDENTATION.repeat(level)}`;

        return [...clauses.map(clause => `${clause.header}\n${INDENTATION.repeat(level + 1)}${branchText(clause, level + 1)}`), 'end'].join(lineBreak);
    }

    /** The text of the node where an expression of at least the given precedence stands: in parentheses where its own precedence is lower. */
    static #within(node, precedence, level) {
        const text = DefinitionWriter.#write(node, level);

        if (DefinitionWriter.#precedenceOf(node) >= precedence) {
            return text;
        }

        // A block's `end` ends its line, so the group around a block that spans lines closes on the line after it, where what follows continues.
        return DefinitionWriter.#endsWithBlock(text) ? `(${text}\n${INDENTATION.repeat(level)})` : `(${text})`;
    }
}
