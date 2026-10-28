/**
 * Lowering — a syntax tree turned into the definition it writes, with the span of text each node, field, local, binding and import of it came from
 */

import { Imports } from './Imports.mjs';
import { Names } from './Names.mjs';
import { Versions } from './Versions.mjs';
import { SyntaxTree } from './SyntaxTree.mjs';

/** @typedef {import('./Parser.mjs').Span} Span */
/** @typedef {import('./SyntaxTree.mjs').SyntaxNode} SyntaxNode */

/** The tokens that make an access optional. */
const OPTIONAL_ACCESSES = new Set(['?.', '?[']);

export class Lowering {
    /** @type {WeakMap<object, Span>} */
    #spans = new WeakMap();

    /** The text the tree was read from, which spells each word a name is. */
    #text;

    /** The local names the script's imports give modules, which a lexical reference reads where no local or field of its name is in scope. @type {ReadonlySet<string>} */
    #namespaceNames;

    /** The names of the locals and the fields in scope where the node being lowered stands, which a name reads; any other name reads the script parameter of its name. @type {Set<string>} */
    #localNames = new Set();

    /** The parameters a bare name reads, where no local or field in scope has its name, rather than written with `~`, which validation marks as written alone. @type {WeakSet<object>} */
    #scriptParametersWrittenAlone = new WeakSet();

    /**
     * The definition the tree writes, its imports those the text writes and those a host supplies, each once, in order of the local name it gives; the span of text each of its nodes, fields, locals, conditional bindings
     * and written imports came from, which the tree is no longer needed for; and the parameters written alone.
     * @param {import('./SyntaxTree.mjs').ScriptNode} tree
     * @param {readonly object[]} [suppliedImports] The imports a host supplies, in a definition's shape, checked already.
     */
    static lower(tree, suppliedImports = []) {
        const written = tree.children.filter(child => child.kind === 'import-declaration').map(declaration => {
            const entry = SyntaxTree.importOf(declaration, tree.text);

            return { entry, span: { start: SyntaxTree.startOf(declaration), end: SyntaxTree.endOf(declaration) } };
        });
        const imports = Imports.mergeImports(written.map(({ entry }) => entry), suppliedImports);
        const lowering = new Lowering(tree.text, Imports.namespaceNamesOf(imports));

        // A written import keeps the span its declaration has, where a host's of the same declaration and local name merged into it.
        written.forEach(({ entry, span }) => lowering.#spans.set(entry, span));

        const expression = lowering.#lower(SyntaxTree.bodyOf(tree));

        return { definition: { version: Versions.definition, imports, expression }, spans: lowering.#spans, scriptParametersWrittenAlone: lowering.#scriptParametersWrittenAlone };
    }

    /**
     * @param {string} text The text the tree was read from.
     * @param {ReadonlySet<string>} namespaceNames The local names the script's imports give modules.
     */
    constructor(text, namespaceNames) {
        this.#text = text;
        this.#namespaceNames = namespaceNames;
    }

    #lower(child) {
        if (SyntaxTree.isToken(child)) {
            return this.#lowerToken(child);
        }

        const { children } = child;

        switch (child.kind) {
            case 'conditional-expression':
                return this.#lowerConditional(children, 0, SyntaxTree.endOf(child));
            case 'body':
                return this.#lowerBody(child);
            case 'function-expression': {
                // Its parameters are in scope in its body alone, beside the locals in scope where it is declared.
                const close = children.findIndex(part => SyntaxTree.isToken(part) && part.type === ')');
                const parameters = children.slice(2, close).filter(part => part.type !== ',').map(part => SyntaxTree.wordOf(part, this.#text));
                const enclosingLocalNames = this.#localNames;

                this.#localNames = new Set([...this.#localNames, ...parameters]);

                try {
                    return this.#span({ kind: 'function', parameters, body: this.#lower(children.at(-2)) }, child);
                } finally {
                    this.#localNames = enclosingLocalNames;
                }
            }
            case 'arrow-function': {
                // Its parameters, one name alone or names in parentheses, are in scope in its body alone, an expression whose value is its result.
                const arrow = children.findIndex(part => SyntaxTree.isToken(part) && part.type === '=>');
                const parameters = children.slice(0, arrow).filter(part => part.type !== ',' && part.type !== '(' && part.type !== ')').map(part => SyntaxTree.wordOf(part, this.#text));
                const enclosingLocalNames = this.#localNames;

                this.#localNames = new Set([...this.#localNames, ...parameters]);

                try {
                    return this.#span({ kind: 'function', parameters, body: this.#lower(children.at(-1)), arrow: true }, child);
                } finally {
                    this.#localNames = enclosingLocalNames;
                }
            }
            case 'function-call':
                // A call of the function a name holds calls the local its name reads, a lexical reference's or a bare name's alike.
                return this.#span({ kind: 'call', callee: this.#span({ kind: 'local', name: children[0].value }, children[0]), arguments: this.#argumentsOf(children.slice(2, -1)) }, child);
            case 'do-expression':
                // A do block holds its body, an expression alone or locals and the `return` that gives its result.
                return this.#span({ kind: 'do', body: this.#lower(children[1]) }, child);
            case 'disjunction':
            case 'conjunction':
                return this.#span({ kind: child.kind === 'disjunction' ? 'or' : 'and', operands: children.filter((_, index) => index % 2 === 0).map(operand => this.#lower(operand)) }, child);
            case 'negation':
                return this.#span({ kind: 'not', operand: this.#lower(children[1]) }, child);
            case 'equality': {
                // `!=` is the negation of `==`, which spans what the equality does.
                const equality = this.#span({ kind: 'equality', left: this.#lower(children[0]), right: this.#lower(children[2]) }, child);

                return children[1].type === '!=' ? this.#span({ kind: 'not', operand: equality }, child) : equality;
            }
            case 'comparison':
                // A chain is one comparison, its operands in order and an operator between each two.
                return this.#span({ kind: 'comparison', operands: children.filter((_, index) => index % 2 === 0).map(operand => this.#lower(operand)), operators: children.filter((_, index) => index % 2 === 1).map(operator => operator.type) }, child);
            case 'additive':
            case 'multiplicative': {
                // Operators of one level associate to the left, each operation spanning from the first operand to its own right operand.
                let value = this.#lower(children[0]);

                for (let index = 1; index < children.length; index += 2) {
                    value = { kind: 'arithmetic', operator: children[index].type, left: value, right: this.#lower(children[index + 1]) };
                    this.#spans.set(value, { start: SyntaxTree.startOf(child), end: SyntaxTree.endOf(children[index + 1]) });
                }

                return value;
            }
            case 'arithmetic-negation': {
                // An arithmetic negation of a numeric literal is the negative literal, negative zero included, as the text writes it.
                const [, operand] = children;

                if (SyntaxTree.isToken(operand) && operand.type === 'literal' && typeof operand.value === 'number') {
                    return this.#span({ kind: 'literal', value: -operand.value }, child);
                }

                return this.#span({ kind: 'arithmeticNegation', operand: this.#lower(operand) }, child);
            }
            case 'coalescing':
                return this.#span({ kind: 'coalescing', value: this.#lower(children[0]), fallback: this.#lower(children[2]) }, child);
            case 'attempt':
                return this.#span({ kind: 'try', operand: this.#lower(children[1]) }, child);
            case 'conversion':
                return this.#span({ kind: 'conversion', type: SyntaxTree.typeNameOf(children[2], this.#text), operand: this.#lower(children[0]) }, child);
            case 'cast': {
                // A cast's operand written as a member chain within an optional enclosed access is the optional chain of its accesses.
                const [operand] = children;

                return this.#span({ kind: 'cast', type: SyntaxTree.typeNameOf(children[2], this.#text), operand: operand.kind === 'member-chain' ? this.#lowerMemberChain(operand, operand) : this.#lower(operand) }, child);
            }
            case 'namespace-access':
                return this.#lowerNamespaceAccess(child);
            case 'parenthesized-expression':
            case 'receiver':
                return this.#lower(children[1]);
            case 'optional-enclosed-access':
                return this.#lowerMemberChain(children[1], child);
            case 'chain':
                return this.#lowerChain(child);
            case 'object':
                return this.#lowerObject(child, undefined, SyntaxTree.startOf(child));
            case 'interpolated-string':
                // Its text and its interpolations in the order written, each run of text the characters it stands for; a run that stands for none, a block's margin before an interpolation, is no part.
                return this.#span({
                    kind: 'interpolatedString',
                    parts: children.slice(1, -1)
                        .filter(part => !SyntaxTree.isToken(part) || part.value !== '')
                        .map(part => (SyntaxTree.isToken(part) ? { kind: 'text', value: part.value } : { kind: 'expression', expression: this.#lower(part.children[1]) })),
                }, child);
            default:
                throw new TypeError(`No definition is lowered from a ${child.kind}`);
        }
    }

    #lowerToken(token) {
        switch (token.type) {
            case 'it':
                return this.#span({ kind: 'it' }, token);
            case 'literal':
                return this.#span({ kind: 'literal', value: token.value }, token);
            case 'identifier': {
                // `root` is the object root wherever it stands; any other name is the local or the field its lexical scope declares, and otherwise the script parameter of its name.
                if (Names.isRoot(token.value)) {
                    return this.#span({ kind: 'root' }, token);
                }

                const read = this.#span({ kind: this.#localNames.has(token.value) ? 'local' : 'scriptParameter', name: token.value }, token);

                if (read.kind === 'scriptParameter') {
                    this.#scriptParametersWrittenAlone.add(read);
                }

                return read;
            }
            case 'lexical-reference':
                // An identifier after `@` is the local or the field of its name in scope, and otherwise the import binding of its name, the namespace of the module an import gives it; validation refuses any other.
                return this.#span({ kind: !this.#localNames.has(token.value) && this.#namespaceNames.has(token.value) ? 'namespace' : 'local', name: token.value }, token);
            case 'script-parameter':
                return this.#span({ kind: 'scriptParameter', name: token.value }, token);
            default:
                throw new TypeError(`No definition is lowered from the token '${token.type}'`);
        }
    }

    /** A namespace access: a member read through the module's namespace, or a call of one through it, its arguments as written, the member spanning the namespace's name to its own and the call the access. */
    #lowerNamespaceAccess(access) {
        const [namespaceName, , nameToken, ...rest] = access.children;
        const receiver = this.#span({ kind: 'namespace', name: namespaceName.value }, namespaceName);
        const member = { kind: 'memberAccess', receiver, name: SyntaxTree.wordOf(nameToken, this.#text) };

        this.#spans.set(member, { start: SyntaxTree.startOf(namespaceName), end: SyntaxTree.endOf(nameToken) });

        if (rest.length === 0) {
            return member;
        }

        return this.#span({ kind: 'call', callee: member, arguments: this.#argumentsOf(rest.slice(1, -1)) }, access);
    }

    /** A body: its locals in order, each in scope after its value, through the locals after it and the result, which its `return` gives. */
    #lowerBody(body) {
        const { children } = body;
        const enclosingLocalNames = this.#localNames;
        const locals = [];

        try {
            for (const part of children.slice(0, -2)) {
                const local = this.#span({ name: SyntaxTree.wordOf(part.children[1], this.#text), value: this.#lower(part.children[3]) }, part);

                locals.push(local);
                this.#localNames = new Set(this.#localNames).add(local.name);
            }

            return this.#span({ kind: 'body', locals, result: this.#lower(children.at(-1)) }, body);
        } finally {
            this.#localNames = enclosingLocalNames;
        }
    }

    /** The conditional whose clause begins at the index, its `if` or an `elseif`, with every clause after it its alternative, each spanning from its keyword to the end of the last alternative. */
    #lowerConditional(children, index, end) {
        const start = children[index].start;
        const test = children[index + 1];
        const isConditionalBinding = test.kind === 'conditional-binding';
        const tested = isConditionalBinding ? this.#span({ name: SyntaxTree.wordOf(test.children[1], this.#text), value: this.#lower(test.children[3]) }, test) : this.#lower(test);
        // A conditional binding's name is in scope in its consequent alone.
        const consequent = isConditionalBinding ? this.#lowerWithin([tested.name], children[index + 3]) : this.#lower(children[index + 3]);
        const next = children[index + 4];
        const alternative = next.value === 'elseif' ? this.#lowerConditional(children, index + 4, end) : this.#lower(children[index + 5]);
        const node = isConditionalBinding ? { kind: 'conditional', binding: tested, consequent, alternative } : { kind: 'conditional', condition: tested, consequent, alternative };

        this.#spans.set(node, { start, end });

        return node;
    }

    /** A chain's input and what continues it, each part spanning from the chain's start to its own end, held by an optional chain where an access of it is optional. */
    #lowerChain(chain) {
        const { children } = chain;
        const start = SyntaxTree.startOf(chain);
        let value = this.#lower(children[0]);
        let isOptional = false;

        for (let index = 1; index < children.length; index++) {
            const part = children[index];

            if (part.kind === 'object') {
                value = this.#lowerObject(part, value, start);
            } else {
                isOptional ||= OPTIONAL_ACCESSES.has(part.children[0].type);
                value = this.#lowerMemberExpression(part, value, start, false);
            }
        }

        return isOptional ? this.#span({ kind: 'optionalChain', chain: value }, chain) : value;
    }

    /**
     * A member after its receiver: a dot property access, a call of the member it names, a computed property access, its name the name a string literal is where it is one, or an indexer, spanning from the start given to
     * its own end, a call's member to its name's, and optional where its token says so or where every access is, as an optional enclosed access makes them.
     */
    #lowerMemberExpression(part, receiver, start, isEveryOptional) {
        const [first, second] = part.children;
        const optional = isEveryOptional || OPTIONAL_ACCESSES.has(first.type);
        const optionalProperty = optional ? { optional } : {};
        let node;

        switch (part.kind) {
            case 'dot-property-access':
                node = { kind: 'memberAccess', receiver, name: SyntaxTree.wordOf(second, this.#text), ...optionalProperty };
                break;
            case 'member-call': {
                const callee = { kind: 'memberAccess', receiver, name: SyntaxTree.wordOf(second, this.#text), ...optionalProperty };

                this.#spans.set(callee, { start, end: SyntaxTree.endOf(second) });
                node = { kind: 'call', callee, arguments: this.#argumentsOf(part.children.slice(3, -1)) };
                break;
            }
            case 'computed-property-access': {
                const expression = this.#lower(part.children[2]);
                const name = expression.kind === 'literal' && Names.isIdentifier(expression.value) ? expression.value : expression;

                node = { kind: 'memberAccess', receiver, name, ...optionalProperty };
                break;
            }
            default:
                // An indexer's receiver is what is before its brackets, the member access of a named indexer's name among them, which resolution reads as one.
                node = { kind: 'indexerAccess', receiver, argument: this.#lower(second), ...optionalProperty };
        }

        this.#spans.set(node, { start, end: SyntaxTree.endOf(part) });

        return node;
    }

    /** The arguments a call's parentheses hold, the commas between them left out. */
    #argumentsOf(parts) {
        return parts.filter(part => !(SyntaxTree.isToken(part) && part.type === ',')).map(argument => this.#lower(argument));
    }

    /** Lowers a member chain into the optional chain of its accesses, every one of them optional, spanning what the span node does. */
    #lowerMemberChain(memberChain, spanned) {
        const { children } = memberChain;
        const start = SyntaxTree.startOf(memberChain);
        let value = this.#lower(children[0]);

        for (let index = 1; index < children.length; index++) {
            value = this.#lowerMemberExpression(children[index], value, start, true);
        }

        return this.#span({ kind: 'optionalChain', chain: value }, spanned);
    }

    /** An object expression, of the context it follows where it follows one, spanning from the start given, its locals left out where it has none. */
    #lowerObject(object, context, start) {
        const node = context === undefined ? { kind: 'object' } : { kind: 'object', context };
        const locals = [];
        const objectFields = [];
        const enclosingLocalNames = this.#localNames;

        // Each local is in scope after its value, through the locals and the fields after it, and each field after its value, through the fields after it.
        for (const child of object.children) {
            if (child.kind === 'local') {
                const local = this.#span({ name: SyntaxTree.wordOf(child.children[1], this.#text), value: this.#lower(child.children[3]) }, child);

                locals.push(local);
                this.#localNames = new Set(this.#localNames).add(local.name);
            } else if (child.kind === 'field') {
                const field = this.#span({ name: SyntaxTree.wordOf(child.children[0], this.#text), value: this.#lower(child.children[2]) }, child);

                objectFields.push(field);
                this.#localNames = new Set(this.#localNames).add(field.name);
            }
        }

        this.#localNames = enclosingLocalNames;

        if (locals.length > 0) {
            node.locals = locals;
        }

        node.objectFields = objectFields;
        this.#spans.set(node, { start, end: SyntaxTree.endOf(object) });

        return node;
    }

    /** The child lowered with the names in scope besides those already. */
    #lowerWithin(names, child) {
        const enclosingLocalNames = this.#localNames;

        this.#localNames = new Set([...this.#localNames, ...names]);

        try {
            return this.#lower(child);
        } finally {
            this.#localNames = enclosingLocalNames;
        }
    }

    /** Records the part as spanning the syntax node or token. */
    #span(part, spanned) {
        this.#spans.set(part, { start: SyntaxTree.startOf(spanned), end: SyntaxTree.endOf(spanned) });

        return part;
    }
}
