/**
 * DefinitionValidator — a definition checked against Lexica's structure, as its canonical, frozen copy
 */

import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { DefinitionLocations } from './DefinitionLocations.mjs';
import { LexicaErrors } from './LexicaError.mjs';
import { Names } from './Names.mjs';
import { Versions } from './Versions.mjs';

/** @typedef {import('./TextLocations.mjs').TextLocations} TextLocations */

/** The properties each kind of node holds, and those it requires. */
const NODE_PROPERTIES = {
    literal: { properties: ['kind', 'value'], required: ['value'] },
    parameter: { properties: ['kind', 'name'], required: ['name'] },
    it: { properties: ['kind'], required: [] },
    root: { properties: ['kind'], required: [] },
    namespace: { properties: ['kind', 'name'], required: ['name'] },
    local: { properties: ['kind', 'name'], required: ['name'] },
    member: { properties: ['kind', 'target', 'name', 'optional'], required: ['target', 'name'] },
    call: { properties: ['kind', 'target', 'name', 'optional', 'arguments'], required: ['target', 'name', 'arguments'] },
    indexer: { properties: ['kind', 'target', 'optional', 'argument'], required: ['target', 'argument'] },
    object: { properties: ['kind', 'target', 'locals', 'fields'], required: ['fields'] },
    optionalChain: { properties: ['kind', 'target'], required: ['target'] },
    equality: { properties: ['kind', 'left', 'right'], required: ['left', 'right'] },
    comparison: { properties: ['kind', 'operands', 'operators'], required: ['operands', 'operators'] },
    interpolatedString: { properties: ['kind', 'parts'], required: ['parts'] },
    conditional: { properties: ['kind', 'condition', 'binding', 'consequent', 'alternative'], required: ['consequent', 'alternative'] },
    body: { properties: ['kind', 'locals', 'result'], required: ['locals', 'result'] },
    do: { properties: ['kind', 'body'], required: ['body'] },
    function: { properties: ['kind', 'parameters', 'body', 'arrow'], required: ['parameters', 'body'] },
    functionCall: { properties: ['kind', 'name', 'arguments'], required: ['name', 'arguments'] },
    arithmetic: { properties: ['kind', 'operator', 'left', 'right'], required: ['operator', 'left', 'right'] },
    negate: { properties: ['kind', 'operand'], required: ['operand'] },
    coalescing: { properties: ['kind', 'value', 'fallback'], required: ['value', 'fallback'] },
    not: { properties: ['kind', 'operand'], required: ['operand'] },
    cast: { properties: ['kind', 'type', 'target'], required: ['type', 'target'] },
    conversion: { properties: ['kind', 'type', 'target'], required: ['type', 'target'] },
    try: { properties: ['kind', 'target'], required: ['target'] },
    and: { properties: ['kind', 'operands'], required: ['operands'] },
    or: { properties: ['kind', 'operands'], required: ['operands'] },
};

/** The kinds of node that continue a chain through their target, and so carry its optional chain to the access their target is. */
const CHAIN_KINDS = new Set(['member', 'call', 'indexer', 'object']);

/** The kinds of node a cast's target starts from, its receiver, as text writes one: an input, a namespace's member and an object expression following no value among them, or a grouped cast. */
const CAST_RECEIVER_KINDS = new Set(['it', 'parameter', 'root', 'namespace', 'local', 'literal', 'interpolatedString', 'functionCall', 'object', 'cast']);

/** The kinds of node that are accesses of a cast's target, after its receiver. */
const CAST_ACCESS_KINDS = new Set(['member', 'call', 'indexer']);

/** The operators an arithmetic node holds. */
const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%'];

/** The direction each comparison operator points, which every operator of a chain shares. */
/** The properties each kind of part of an interpolated string has. */
const INTERPOLATION_PARTS = Object.freeze({
    text: { properties: ['kind', 'value'], required: ['value'] },
    expression: { properties: ['kind', 'expression'], required: ['expression'] },
});

const COMPARISON_DIRECTIONS = Object.freeze({ '<': 'ascending', '<=': 'ascending', '>': 'descending', '>=': 'descending' });

/** The kinds of node `try` attempts: the operations with a rejection of their own, which an attempt answers null for. */
const ATTEMPTED_KINDS = new Set(['conversion', 'cast']);

/** What a local and a field of an object expression each hold: a name, always written, and a value. */
const ENTRY_PROPERTIES = { properties: ['name', 'value'], required: ['name', 'value'] };

/** Where a node's implicit parameter stands: absent at the top level, present in an object expression following a value, unknown in an argument. */
const ContextAvailability = Object.freeze({ absent: 'absent', present: 'present', unknown: 'unknown' });

export class DefinitionValidator {
    /** Where in the definition its caller supplied each part of a canonical copy came from, for each copy whose validation moved a part. @type {WeakMap<object, DefinitionLocations>} */
    static #suppliedLocations = new WeakMap();

    /** Every canonical definition validation gave, which validating again answers as it is. @type {WeakSet<object>} */
    static #canonical = new WeakSet();

    /** The parameter nodes of canonical definitions that a text wrote alone, a bare name no local in scope has, rather than with `~`. @type {WeakSet<object>} */
    static #namesWrittenAlone = new WeakSet();

    #locations;

    /** The index each part of an interpolated string had in the definition being validated, by the canonical node, for each node whose parts validation moved. @type {WeakMap<object, number[]>} */
    #partIndexes = new WeakMap();

    /** Whether validation moved a part of the definition, which its locations then say. */
    #hasMovedParts = false;

    /** Whether an object expression's locals or fields hold the node being validated, lexically, so an outermost object is being built where it stands. */
    #isInObjectExpression = false;

    /** The names of the locals and the fields in scope where the node being validated stands. @type {Set<string>} */
    #localNames = new Set();

    /** The names of the locals declared later in a scope the node being validated stands in, the local whose value it is among them, which no parameter there may name, each with whether a local or a conditional binding declares it. @type {Map<string, 'local' | 'binding'>} */
    #laterNames = new Map();

    /** The optional chain the node being validated continues, with whether an access of it is optional so far; null where it continues none. @type {{ hasOptional: boolean } | null} */
    #chain = null;

    /**
     * The simple expression the node being validated stands in, an argument, an indexer's key, a computed property access's name or an interpolation's expression, with what its message calls it and whether a conditional holds the node;
     * null outside one. A simple expression nested in another keeps the conditional that holds it.
     * @type {{ holder: string, isInConditional: boolean } | null}
     */
    #simpleExpression = null;

    /** The parameters of a definition parsed from text that were written with `~`, which read the script parameter wherever they stand; null for a definition not parsed from text. @type {WeakSet<object> | null} */
    #parameterReferences;

    /**
     * @param {TextLocations | null} locations Where in a text each part of the definition came from, for one parsed from text.
     * @param {WeakSet<object> | null} parameterReferences The parameters a text wrote with `~`, for one parsed from text.
     */
    constructor(locations = null, parameterReferences = null) {
        this.#locations = locations;
        this.#parameterReferences = parameterReferences;
    }

    /** Whether a canonical definition's parameter node is a name a text wrote alone, which reads a local or field of its name where one is in scope, rather than a script parameter written with `~` or a definition's. */
    static isWrittenAlone(node) {
        return DefinitionValidator.#namesWrittenAlone.has(node);
    }

    /** A deep copy of a canonical definition's node, each parameter node a text wrote alone marked as one in the copy too. */
    static copyOf(node) {
        if (Array.isArray(node)) {
            return node.map(item => DefinitionValidator.copyOf(item));
        }

        if (node === null || typeof node !== 'object') {
            return node;
        }

        const copy = Object.fromEntries(Object.entries(node).map(([key, value]) => [key, DefinitionValidator.copyOf(value)]));

        if (DefinitionValidator.#namesWrittenAlone.has(node)) {
            DefinitionValidator.#namesWrittenAlone.add(copy);
        }

        return copy;
    }

    /** Checks the definition's structure, returning its canonical, frozen copy; a canonical definition validation already gave is answered as it is, keeping the locations it has. */
    validate(definition) {
        if (DefinitionValidator.#canonical.has(definition)) {
            return definition;
        }

        // One version is read, and none is converted into another, so a definition of another version names both, before anything else its version's contract may hold.
        if (definition !== null && typeof definition === 'object' && Object.hasOwn(definition, 'version') && definition.version !== Versions.definition) {
            this.#fail('LEXICA2007', '/version', `A definition is of version ${Versions.definition}, the one this implementation reads, and this one is of version ${JSON.stringify(definition.version)}`);
        }

        this.#requireProperties(definition, '', { properties: ['version', 'expression'], required: ['version', 'expression'] });

        const validated = Object.freeze({ version: Versions.definition, expression: this.#validateBodyOrExpression(definition.expression, '/expression', ContextAvailability.absent) });

        // A definition parsed from text has its text's locations; one a caller supplied, where a part moved, has locations that name its parts as the caller did.
        if (this.#locations === null && this.#hasMovedParts) {
            DefinitionValidator.#suppliedLocations.set(validated, new DefinitionLocations(validated, this.#partIndexes));
        }

        DefinitionValidator.#canonical.add(validated);

        return validated;
    }

    /** Where in the definition its caller supplied each part of the canonical copy came from, or null where validation moved none, so each part's pointer is the caller's. */
    static locationsOf(definition) {
        return DefinitionValidator.#suppliedLocations.get(definition) ?? null;
    }

    #validateNode(node, pointer, contextAvailability) {
        // A member that takes an argument is written as a call or an indexer, so an infix call is no node, and the message says which nodes take its place.
        if (ObjectUtils.isNonArrayObject(node) && node.kind === 'infixCall') {
            this.#fail('LEXICA2000', pointer, 'An infixCall is not a node: a function is a call node, or an indexer node for a named or unnamed indexer');
        }

        if (!ObjectUtils.isNonArrayObject(node) || !Object.hasOwn(NODE_PROPERTIES, node.kind)) {
            this.#fail('LEXICA2000', pointer, 'A node is an object whose kind is literal, parameter, it, root, namespace, local, member, call, indexer, object, optionalChain, equality, comparison, interpolatedString, body, do, function, functionCall, arithmetic, negate, conditional, coalescing, not, cast, conversion, try, and or or');
        }

        this.#requireProperties(node, pointer, NODE_PROPERTIES[node.kind]);

        const enclosingChain = this.#chain;

        // A chain continues through a property access's, a call's and an object expression's target alone, so any other node ends it.
        if (!CHAIN_KINDS.has(node.kind)) {
            this.#chain = null;
        }

        try {
            return this.#validateKind(node, pointer, contextAvailability);
        } finally {
            this.#chain = enclosingChain;
        }
    }

    #validateKind(node, pointer, contextAvailability) {
        switch (node.kind) {
            case 'literal':
                return this.#validateLiteral(node, pointer);
            case 'parameter':
                if (!Names.isIdentifier(node.name)) {
                    this.#fail('LEXICA2000', `${pointer}/name`, 'A parameter is named by a letter followed by letters and digits');
                }

                // A name a text wrote alone reads the local in scope of its name, so one before a later local of its name reads nothing; a script parameter written with `~` and a definition's parameter read the script parameter wherever they stand.
                if (this.#locations !== null && !this.#parameterReferences?.has(node)) {
                    this.#requireBindingName(node.name, pointer);

                    const parameter = Object.freeze({ kind: 'parameter', name: node.name });

                    DefinitionValidator.#namesWrittenAlone.add(parameter);

                    return parameter;
                }

                return Object.freeze({ kind: 'parameter', name: node.name });
            case 'root':
                // The object root is a reference to the outermost object, which an object expression around the reference builds, lexically.
                if (!this.#isInObjectExpression) {
                    this.#fail('LEXICA2018', pointer, "'root' refers to the outermost object being built, and no object expression encloses it here");
                }

                return Object.freeze({ kind: 'root' });
            case 'it':
                if (contextAvailability === ContextAvailability.absent) {
                    this.#fail('LEXICA2026', pointer, "'it' is the implicit parameter, and the top level has none; a chain there starts from a script parameter, root, a namespace's member, a local, a literal or another input");
                }

                return Object.freeze({ kind: 'it' });
            case 'namespace':
                this.#fail('LEXICA2520', pointer, "A namespace is the target of a member read or a call through it, as home.rooms is, and stands nowhere else");
                break;
            case 'local':
                this.#requireName(node.name, `${pointer}/name`);

                // A local is read where one of its name, or a field, is in scope, which `@` and a reserved word name as a name written alone does any other.
                if (!this.#localNames.has(node.name)) {
                    this.#fail('LEXICA2012', pointer, `No local or field named '${node.name}' is in scope. Use '~${node.name}' to read the script parameter.`);
                }

                return Object.freeze({ kind: 'local', name: node.name });
            case 'member':
            case 'call':
            case 'indexer':
                return this.#validateMember(node, pointer, contextAvailability);
            case 'equality':
                return Object.freeze({
                    kind: 'equality',
                    left: this.#validateNode(node.left, `${pointer}/left`, contextAvailability),
                    right: this.#validateNode(node.right, `${pointer}/right`, contextAvailability),
                });
            case 'comparison':
                return this.#validateComparison(node, pointer, contextAvailability);
            case 'interpolatedString':
                return this.#validateInterpolatedString(node, pointer, contextAvailability);
            case 'arithmetic':
                if (!ARITHMETIC_OPERATORS.includes(node.operator)) {
                    this.#fail('LEXICA2000', `${pointer}/operator`, `An arithmetic operator is ${ARITHMETIC_OPERATORS.join(', ')}`);
                }

                return Object.freeze({
                    kind: 'arithmetic',
                    operator: node.operator,
                    left: this.#validateNode(node.left, `${pointer}/left`, contextAvailability),
                    right: this.#validateNode(node.right, `${pointer}/right`, contextAvailability),
                });
            case 'negate':
                return Object.freeze({ kind: 'negate', operand: this.#validateNode(node.operand, `${pointer}/operand`, contextAvailability) });
            case 'conditional':
                return this.#validateConditional(node, pointer, contextAvailability);
            case 'body':
                this.#fail('LEXICA2017', pointer, "A body is the root expression's, a do block's, a function's or a conditional branch's, and stands nowhere else");
                break;
            case 'do':
                if (this.#simpleExpression !== null) {
                    this.#fail('LEXICA2011', pointer, `${this.#simpleExpression.holder} is a simple expression, which holds no do block: ${this.#simpleExpression.advice ?? "bind the block's value to a local first, and use the local"}`);
                }

                return Object.freeze({ kind: 'do', body: this.#validateBodyOrExpression(node.body, `${pointer}/body`, contextAvailability) });
            case 'function':
                this.#fail(node.arrow === true ? 'LEXICA2027' : 'LEXICA2004', pointer, node.arrow === true ? 'An arrow function is the value of a local or an argument, and stands nowhere else' : 'A function is the value of a local, as let name = function(…) … end, and stands nowhere else');
                break;
            case 'functionCall':
                return this.#validateFunctionCall(node, pointer, contextAvailability);
            case 'and':
            case 'or':
                return this.#validateLogical(node, pointer, contextAvailability);
            case 'optionalChain':
                return this.#validateOptionalChain(node, pointer, contextAvailability);
            case 'not':
                return Object.freeze({ kind: 'not', operand: this.#validateNode(node.operand, `${pointer}/operand`, contextAvailability) });
            case 'cast':
                return this.#validateCast(node, pointer, contextAvailability);
            case 'conversion':
                if (!DefinitionValidator.#isTypeName(node.type)) {
                    this.#fail('LEXICA2000', `${pointer}/type`, "A conversion names the type it converts to by its name, a letter followed by letters and digits, or by its module's name, a dot and its name");
                }

                return Object.freeze({ kind: 'conversion', type: node.type, target: this.#validateNode(node.target, `${pointer}/target`, contextAvailability) });
            case 'try':
                if (!ATTEMPTED_KINDS.has(node.target?.kind)) {
                    this.#fail('LEXICA2523', `${pointer}/target`, "What 'try' attempts is a conversion or a cast");
                }

                return Object.freeze({ kind: 'try', target: this.#validateNode(node.target, `${pointer}/target`, contextAvailability) });
            case 'coalescing':
                return Object.freeze({
                    kind: 'coalescing',
                    value: this.#validateNode(node.value, `${pointer}/value`, contextAvailability),
                    fallback: this.#validateNode(node.fallback, `${pointer}/fallback`, contextAvailability),
                });
            default:
                return this.#validateObject(node, pointer, contextAvailability);
        }
    }

    /**
     * Validates a conditional: a condition or a binding, exactly one of them, its consequent and its alternative.
     * A binding's name is any name, which hides a local or a field of its name outside it, in scope in the consequent alone, never in its own value or the alternative.
     */
    #validateConditional(node, pointer, contextAvailability) {
        if ((node.condition === undefined) === (node.binding === undefined)) {
            this.#fail('LEXICA2000', pointer, 'A conditional holds a condition or a conditional binding, one of them');
        }

        if (this.#simpleExpression !== null) {
            return this.#validateSimpleConditional(node, pointer, contextAvailability);
        }

        // Every branch of one conditional is a body, whose `return` gives its result, or none is; an `elseif` continues its style, and the alternative of one whose branches are expressions may hold a conditional of either, as `else if … end` writes one.
        const isExplicit = node.consequent?.kind === 'body';
        const alternative = node.alternative;
        const isConsistent = alternative?.kind === 'conditional' ? !isExplicit || alternative.consequent?.kind === 'body' : (alternative?.kind === 'body') === isExplicit;

        if (!isConsistent) {
            this.#fail('LEXICA2524', pointer, 'All branches of this conditional must give their results with return, or none of them');
        }

        if (node.condition !== undefined) {
            return Object.freeze({
                kind: 'conditional',
                condition: this.#validateNode(node.condition, `${pointer}/condition`, contextAvailability),
                consequent: this.#validateBodyOrExpression(node.consequent, `${pointer}/consequent`, contextAvailability),
                alternative: this.#validateBodyOrExpression(node.alternative, `${pointer}/alternative`, contextAvailability),
            });
        }

        const bindingPointer = `${pointer}/binding`;

        this.#requireProperties(node.binding, bindingPointer, ENTRY_PROPERTIES);
        this.#requireName(node.binding.name, `${bindingPointer}/name`);

        const { name } = node.binding;


        const value = this.#validateWithLater([name], () => this.#validateNode(node.binding.value, `${bindingPointer}/value`, contextAvailability), 'binding');

        const enclosingLocalNames = this.#localNames;

        this.#localNames = new Set(this.#localNames).add(name);

        let consequent;

        try {
            consequent = this.#validateBodyOrExpression(node.consequent, `${pointer}/consequent`, contextAvailability);
        } finally {
            this.#localNames = enclosingLocalNames;
        }

        return Object.freeze({
            kind: 'conditional',
            binding: Object.freeze({ name, value }),
            consequent,
            alternative: this.#validateBodyOrExpression(node.alternative, `${pointer}/alternative`, contextAvailability),
        });
    }

    /**
     * Validates a conditional within a simple expression: a condition and two branches, each a simple value expression, so it binds no value, its branches give their values without `return` or locals,
     * and it holds no other conditional, an `elseif` among them, through any path, a group, a call, an indexer or an interpolation included.
     */
    #validateSimpleConditional(node, pointer, contextAvailability) {
        const simpleExpression = this.#simpleExpression;
        const { holder } = simpleExpression;
        const advice = simpleExpression.advice ?? "bind the conditional's value to a local first, and use the local";

        if (simpleExpression.isInConditional) {
            this.#fail('LEXICA2011', pointer, `${holder} is a simple expression, whose conditional holds no other conditional, elseif included: ${advice}`);
        }

        if (node.binding !== undefined) {
            this.#fail('LEXICA2011', `${pointer}/binding`, `${holder} is a simple expression, whose conditional tests a value and binds none: ${advice}`);
        }

        for (const branch of ['consequent', 'alternative']) {
            if (node[branch]?.kind === 'body') {
                this.#fail('LEXICA2011', `${pointer}/${branch}`, `${holder} is a simple expression, whose conditional gives each branch's value without return or locals, as if … then … else … end does: ${advice}`);
            }
        }

        this.#simpleExpression = { ...simpleExpression, isInConditional: true };

        try {
            return Object.freeze({
                kind: 'conditional',
                condition: this.#validateNode(node.condition, `${pointer}/condition`, contextAvailability),
                consequent: this.#validateNode(node.consequent, `${pointer}/consequent`, contextAvailability),
                alternative: this.#validateNode(node.alternative, `${pointer}/alternative`, contextAvailability),
            });
        } finally {
            this.#simpleExpression = simpleExpression;
        }
    }

    /**
     * Validates a simple expression the holder names: the node and everything within it, which hold no do block, no local, no conditional binding, no `return`, and no conditional beyond an if branch and an else branch of simple value expressions.
     * A simple expression within another keeps the conditional that holds it, and the advice a refusal gives where a local cannot hold what it refuses, as within an arrow function's body.
     */
    #validateSimpleExpression(node, pointer, contextAvailability, holder, advice = undefined) {
        const enclosingSimpleExpression = this.#simpleExpression;

        this.#simpleExpression = { holder, isInConditional: enclosingSimpleExpression?.isInConditional ?? false, advice: advice ?? enclosingSimpleExpression?.advice };

        try {
            return this.#validateNode(node, pointer, contextAvailability);
        } finally {
            this.#simpleExpression = enclosingSimpleExpression;
        }
    }

    /** Whether the name is a type's as a cast or a conversion writes it: its local name, or its module's name, a dot and its local name, each an identifier. */
    static #isTypeName(name) {
        return typeof name === 'string' && name.split('.').length <= 2 && name.split('.').every(part => Names.isIdentifier(part));
    }

    /** Validates a cast: the name of the type it casts to, and its target, which is a receiver and its accesses, a coalescing operator, another cast, or an optional chain, as text can write one. */
    #validateCast(node, pointer, contextAvailability) {
        if (!DefinitionValidator.#isTypeName(node.type)) {
            this.#fail('LEXICA2000', `${pointer}/type`, "A cast names the type it casts to by its name, a letter followed by letters and digits, or by its module's name, a dot and its name");
        }

        const target = this.#validateNode(node.target, `${pointer}/target`, contextAvailability);

        if (!DefinitionValidator.#isCastTarget(target)) {
            this.#fail('LEXICA2002', `${pointer}/target`, "A cast's target is a receiver and the members after it, a coalescing operator in parentheses, or an optional enclosed access");
        }

        return Object.freeze({ kind: 'cast', type: node.type, target });
    }

    /**
     * Whether the node is a cast's target as text writes one: a coalescing operator or a cast, each grouped as it is, or a receiver and the accesses after it, an optional chain of them included,
     * the receiver an input or a grouped cast, so every target a definition gives is written as text that parses.
     */
    static #isCastTarget(node) {
        if (node.kind === 'coalescing' || node.kind === 'cast') {
            return true;
        }

        let receiver = node.kind === 'optionalChain' ? node.target : node;

        while (CAST_ACCESS_KINDS.has(receiver.kind)) {
            receiver = receiver.target;
        }

        return CAST_RECEIVER_KINDS.has(receiver.kind) && !(receiver.kind === 'object' && receiver.target !== undefined);
    }

    /** Validates an optional chain: the chain whose optional accesses end at it, at least one of them, since a chain with none is the chain alone. */
    #validateOptionalChain(node, pointer, contextAvailability) {
        const chain = { hasOptional: false };

        this.#chain = chain;

        const target = this.#validateNode(node.target, `${pointer}/target`, contextAvailability);

        if (!chain.hasOptional) {
            this.#fail('LEXICA2030', pointer, 'An optional chain holds a chain with an optional access, written ?.');
        }

        return Object.freeze({ kind: 'optionalChain', target });
    }

    /** Validates an and or an or: two or more expressions it combines, each with the implicit parameter the and or the or has. */
    #validateLogical(node, pointer, contextAvailability) {
        this.#requireArray(node.operands, `${pointer}/operands`);

        if (node.operands.length < 2) {
            this.#fail('LEXICA2525', `${pointer}/operands`, `An ${node.kind} combines two or more expressions`);
        }

        return Object.freeze({ kind: node.kind, operands: Object.freeze(node.operands.map((operand, index) => this.#validateNode(operand, `${pointer}/operands/${index}`, contextAvailability))) });
    }

    /** Validates a comparison: two or more operands, each with the implicit parameter the comparison has, and between each two of them a comparison operator, every one pointing one way. */
    #validateComparison(node, pointer, contextAvailability) {
        this.#requireArray(node.operands, `${pointer}/operands`);

        if (node.operands.length < 2) {
            this.#fail('LEXICA2029', `${pointer}/operands`, 'A comparison compares two or more expressions');
        }

        this.#requireArray(node.operators, `${pointer}/operators`);

        if (node.operators.length !== node.operands.length - 1) {
            this.#fail('LEXICA2526', `${pointer}/operators`, 'A comparison has an operator between each two of its operands, one fewer than they are');
        }

        node.operators.forEach((operator, index) => {
            if (!Object.hasOwn(COMPARISON_DIRECTIONS, operator)) {
                this.#fail('LEXICA2000', `${pointer}/operators/${index}`, 'A comparison operator is <, <=, > or >=');
            }

            if (COMPARISON_DIRECTIONS[operator] !== COMPARISON_DIRECTIONS[node.operators[0]]) {
                this.#fail('LEXICA2001', `${pointer}/operators/${index}`, 'A comparison chain keeps one direction: its operators are all < and <=, or all > and >=');
            }
        });

        return Object.freeze({
            kind: 'comparison',
            operands: Object.freeze(node.operands.map((operand, index) => this.#validateNode(operand, `${pointer}/operands/${index}`, contextAvailability))),
            operators: Object.freeze([...node.operators]),
        });
    }

    /**
     * Validates an interpolated string: its parts, each text, a string, or an expression, which has the implicit parameter the string has.
     * Adjacent text is one part and empty text none, so a string written in text and its definition hold the same parts.
     */
    #validateInterpolatedString(node, pointer, contextAvailability) {
        this.#requireArray(node.parts, `${pointer}/parts`);

        const parts = [];
        const indexes = [];

        node.parts.forEach((part, index) => {
            const partPointer = `${pointer}/parts/${index}`;

            if (!ObjectUtils.isNonArrayObject(part) || !Object.hasOwn(INTERPOLATION_PARTS, part.kind)) {
                this.#fail('LEXICA2000', partPointer, 'A part of an interpolated string is an object whose kind is text or expression');
            }

            this.#requireProperties(part, partPointer, INTERPOLATION_PARTS[part.kind]);

            if (part.kind === 'expression') {
                parts.push(Object.freeze({ kind: 'expression', expression: this.#validateSimpleExpression(part.expression, `${partPointer}/expression`, contextAvailability, "An interpolation's expression") }));
                indexes.push(index);

                return;
            }

            if (typeof part.value !== 'string') {
                this.#fail('LEXICA2000', `${partPointer}/value`, 'The text of an interpolated string is a string');
            }

            if (part.value === '') {
                return;
            }

            const previous = parts.at(-1);

            if (previous?.kind === 'text') {
                parts[parts.length - 1] = Object.freeze({ kind: 'text', value: previous.value + part.value });
            } else {
                parts.push(Object.freeze({ kind: 'text', value: part.value }));
                indexes.push(index);
            }
        });

        const validated = Object.freeze({ kind: 'interpolatedString', parts: Object.freeze(parts) });

        // A part joined into the text before it, or empty and dropped, moves each after it, which a diagnostic still names by the index the caller gave it.
        if (indexes.some((original, index) => original !== index)) {
            this.#partIndexes.set(validated, indexes);
            this.#hasMovedParts = true;
        }

        return validated;
    }

    /** Validates what a body stands for, the root expression's, a do block's, a function's or a conditional branch's: a body, or the expression alone it is. */
    #validateBodyOrExpression(node, pointer, contextAvailability) {
        return ObjectUtils.isNonArrayObject(node) && node.kind === 'body' ? this.#validateBody(node, pointer, contextAvailability) : this.#validateNode(node, pointer, contextAvailability);
    }

    /**
     * Validates a body: its locals, each with its name and value, in scope after its value, through the locals after it and the result, and seen by no value before it, and its result, each with the implicit parameter the body has.
     * A body's local may reuse a name an enclosing scope has, which it hides, and two of one body never share one.
     */
    #validateBody(node, pointer, contextAvailability) {
        this.#requireProperties(node, pointer, NODE_PROPERTIES.body);
        this.#requireArray(node.locals, `${pointer}/locals`);

        const names = node.locals.map(local => local?.name);
        const enclosingLocalNames = this.#localNames;
        const enclosingChain = this.#chain;
        const declared = new Set();

        // A body's locals and its result continue no chain of what holds it.
        this.#chain = null;

        try {
            const locals = node.locals.map((local, index) => {
                const localPointer = `${pointer}/locals/${index}`;

                this.#requireProperties(local, localPointer, ENTRY_PROPERTIES);
                this.#requireName(local.name, `${localPointer}/name`);

                if (declared.has(local.name)) {
                    this.#fail('LEXICA2015', localPointer, `Two locals of one body are named '${local.name}'`);
                }

                declared.add(local.name);

                const value = this.#validateWithLater(names.slice(index), () => this.#validateLocalValue(local.value, `${localPointer}/value`, contextAvailability));

                this.#localNames = new Set(this.#localNames).add(local.name);

                return Object.freeze({ name: local.name, value });
            });

            return Object.freeze({ kind: 'body', locals: Object.freeze(locals), result: this.#validateNode(node.result, `${pointer}/result`, contextAvailability) });
        } finally {
            this.#localNames = enclosingLocalNames;
            this.#chain = enclosingChain;
        }
    }

    /** Validates a local's value, which a function may be, as no other node's is. */
    #validateLocalValue(value, pointer, contextAvailability) {
        return value?.kind === 'function' ? this.#validateFunction(value, pointer, contextAvailability) : this.#validateNode(value, pointer, contextAvailability);
    }

    /**
     * Validates a function: its parameters, each a name of its own, and its body, which sees them and the locals in scope where the function is declared, with the implicit parameter it has there.
     * Its own local and those declared after it stay later names in its body, so it calls neither directly. An arrow function's body is one simple expression, which declares no locals.
     */
    #validateFunction(node, pointer, contextAvailability) {
        this.#requireProperties(node, pointer, NODE_PROPERTIES.function);
        this.#requireArray(node.parameters, `${pointer}/parameters`);

        if (node.arrow !== undefined && node.arrow !== true) {
            this.#fail('LEXICA2000', `${pointer}/arrow`, 'An arrow function is marked by arrow: true, and a regular function leaves it out');
        }

        const seen = new Set();

        node.parameters.forEach((parameter, index) => {
            const parameterPointer = `${pointer}/parameters/${index}`;

            this.#requireName(parameter, parameterPointer);

            if (seen.has(parameter)) {
                this.#fail('LEXICA2032', parameterPointer, `Two parameters of one function are named '${parameter}'`);
            }

            seen.add(parameter);
        });

        const enclosingLocalNames = this.#localNames;
        const enclosingLaterNames = this.#laterNames;
        const enclosingChain = this.#chain;

        // Its parameters are declared in its own scope, so in its body each hides a local of its name declared later around it.
        this.#localNames = new Set([...this.#localNames, ...node.parameters]);
        this.#laterNames = new Map([...this.#laterNames].filter(([name]) => !node.parameters.includes(name)));
        this.#chain = null;

        try {
            if (node.arrow !== true) {
                return Object.freeze({ kind: 'function', parameters: Object.freeze([...node.parameters]), body: this.#validateBodyOrExpression(node.body, `${pointer}/body`, contextAvailability) });
            }

            if (node.body?.kind === 'body' || node.body?.kind === 'function') {
                this.#fail('LEXICA2006', `${pointer}/body`, "An arrow function's body is a simple expression, which gives its result: a function that holds more is a regular function bound to a local, passed by its name");
            }

            return Object.freeze({ kind: 'function', parameters: Object.freeze([...node.parameters]), body: this.#validateSimpleExpression(node.body, `${pointer}/body`, contextAvailability, "An arrow function's body", 'a function that holds more is a regular function bound to a local, passed by its name'), arrow: true });
        } finally {
            this.#localNames = enclosingLocalNames;
            this.#laterNames = enclosingLaterNames;
            this.#chain = enclosingChain;
        }
    }

    /** Validates a call of a local function: its name, which no function calls before its local is declared, itself included, and its arguments. */
    #validateFunctionCall(node, pointer, contextAvailability) {
        this.#requireName(node.name, `${pointer}/name`);

        if (this.#laterNames.has(node.name)) {
            this.#fail('LEXICA2016', pointer, `'${node.name}' is called before the local of that name is declared in its scope, so no function calls itself or one declared after it`);
        }

        const enclosingChain = this.#chain;

        this.#chain = null;

        try {
            // Whether an argument has an implicit parameter is the function's to say, a reference's as its qualified form's member does, which only resolution knows, so an `it` there is resolution's to refuse.
            return Object.freeze({ kind: 'functionCall', name: node.name, arguments: this.#validateArguments(node.arguments, `${pointer}/arguments`, ContextAvailability.unknown) });
        } finally {
            this.#chain = enclosingChain;
        }
    }

    /** Validates a call's arguments, each a simple expression or an arrow function; a regular function is bound to a local and passed by its name. */
    #validateArguments(argumentNodes, pointer, contextAvailability) {
        this.#requireArray(argumentNodes, pointer);

        return Object.freeze(argumentNodes.map((argument, index) => {
            const argumentPointer = `${pointer}/${index}`;

            if (argument?.kind !== 'function') {
                return this.#validateSimpleExpression(argument, argumentPointer, contextAvailability, 'An argument');
            }

            if (argument.arrow !== true) {
                this.#fail('LEXICA2005', argumentPointer, "A function declared with 'function' cannot appear directly as an argument. Bind it to a local and pass its name, or use an arrow function.");
            }

            return this.#validateFunction(argument, argumentPointer, contextAvailability);
        }));
    }

    /** Refuses a conditional or a body as the receiver of a chain, whose value a local holds first. */
    #refuseBlockReceiver(target, pointer) {
        if (target?.kind === 'conditional' || target?.kind === 'do') {
            this.#fail('LEXICA2003', `${pointer}/target`, `${target.kind === 'do' ? 'A do block' : 'A conditional'} is never the receiver of a chain: bind its value to a local first, and continue from the local`);
        }
    }

    #validateLiteral(node, pointer) {
        const { value } = node;

        if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' && !Number.isFinite(value)) {
            this.#fail(typeof value === 'number' ? 'LEXICA2019' : 'LEXICA2000', `${pointer}/value`, 'A literal is a string, a finite number, a Boolean or null');
        }

        return Object.freeze({ kind: 'literal', value });
    }

    /** Validates a property access, a call or an indexer: its name, its receiver, whether it is optional, which it is within an optional chain alone, and a call's arguments or an indexer's key, each a simple expression whose implicit parameter its declaration decides. */
    #validateMember(node, pointer, contextAvailability) {
        this.#refuseBlockReceiver(node.target, pointer);

        const name = node.kind === 'member' && ObjectUtils.isNonArrayObject(node.name) ? this.#validateNameExpression(node.name, `${pointer}/name`, contextAvailability) : node.name;

        // A name a computed property access's expression gave is checked as that expression, and an indexer has none; any other is a member's name, which any word can be, a reserved word among them.
        if (name === node.name && node.kind !== 'indexer' && !Names.isIdentifier(name)) {
            this.#fail('LEXICA2000', `${pointer}/name`, 'A member is named by a letter followed by letters and digits');
        }

        if (node.optional !== undefined) {
            if (node.optional !== true) {
                this.#fail('LEXICA2000', `${pointer}/optional`, 'An optional access holds optional: true, and a required one leaves it out');
            }

            if (this.#chain === null) {
                this.#fail('LEXICA2010', pointer, 'An optional access stands within an optional chain, which ends where a null receiver ends it');
            }

            this.#chain.hasOptional = true;
        }

        const target = node.target?.kind === 'namespace' ? this.#validateNamespace(node, pointer) : this.#validateNode(node.target, `${pointer}/target`, contextAvailability);
        const access = Object.freeze({ kind: node.kind, target, ...(name === undefined ? {} : { name }), ...(node.optional === true ? { optional: true } : {}) });

        if (node.kind === 'member') {
            return access;
        }

        this.#chain = null;

        if (node.kind === 'call') {
            return Object.freeze({ ...access, arguments: this.#validateArguments(node.arguments, `${pointer}/arguments`, ContextAvailability.unknown) });
        }

        return Object.freeze({ ...access, argument: this.#validateSimpleExpression(node.argument, `${pointer}/argument`, ContextAvailability.unknown, "An indexer's key") });
    }

    /**
     * Validates the namespace a member read or a call stands on: a module's name, through which a member is named by a dot, never optional, since a namespace is never null, and never through brackets or an indexer,
     * which no namespace has. Which modules a registry holds is the registry's to check.
     */
    #validateNamespace(node, pointer) {
        const namespace = node.target;
        const namespacePointer = `${pointer}/target`;

        this.#requireProperties(namespace, namespacePointer, NODE_PROPERTIES.namespace);
        this.#requireName(namespace.name, `${namespacePointer}/name`);

        if (node.kind === 'indexer') {
            this.#fail('LEXICA2520', pointer, 'No indexer is written through a namespace, which has none');
        }

        if (typeof node.name !== 'string') {
            this.#fail('LEXICA2521', `${pointer}/name`, "A namespace's member is named after its dot, as home.rooms is, and never through brackets");
        }

        if (node.optional === true) {
            this.#fail('LEXICA2522', `${pointer}/optional`, "A namespace is never null, so a member is read through it after '.', and never optionally");
        }

        return Object.freeze({ kind: 'namespace', name: namespace.name });
    }

    /** Validates the expression a computed property access holds, which continues no chain; a string literal that is a name is the name itself, as `.` writes it, so an access has one definition. */
    #validateNameExpression(node, pointer, contextAvailability) {
        const enclosingChain = this.#chain;

        this.#chain = null;

        try {
            const expression = this.#validateSimpleExpression(node, pointer, contextAvailability, 'The name a computed property access reads');

            return expression.kind === 'literal' && Names.isIdentifier(expression.value) ? expression.value : expression;
        } finally {
            this.#chain = enclosingChain;
        }
    }

    #validateObject(node, pointer, contextAvailability) {
        this.#refuseBlockReceiver(node.target, pointer);

        const target = node.target === undefined ? undefined : this.#validateNode(node.target, `${pointer}/target`, contextAvailability);

        this.#requireArray(node.fields, `${pointer}/fields`);

        if (node.fields.length === 0) {
            this.#fail('LEXICA2009', pointer, 'An object expression names at least one field');
        }

        const fieldContextAvailability = target === undefined ? contextAvailability : ContextAvailability.present;
        const enclosingLocalNames = this.#localNames;
        const wasInObjectExpression = this.#isInObjectExpression;

        // An object expression's entries continue no chain of the one it follows, and are built within the outermost object.
        this.#chain = null;
        this.#isInObjectExpression = true;

        try {
            if (node.locals !== undefined && this.#simpleExpression !== null) {
                this.#fail('LEXICA2527', `${pointer}/locals/0`, `${this.#simpleExpression.holder} is a simple expression, whose object expressions hold no locals: ${this.#simpleExpression.advice ?? 'bind each value to a local before the expression, and use the local'}`);
            }

            const locals = node.locals === undefined ? [] : this.#validateLocals(node.locals, `${pointer}/locals`, fieldContextAvailability);

            /** @type {Set<string>} */
            const names = new Set();

            const fields = node.fields.map((field, index) => {
                const fieldPointer = `${pointer}/fields/${index}`;
                this.#requireProperties(field, fieldPointer, ENTRY_PROPERTIES);
                this.#requireName(field.name, `${fieldPointer}/name`);

                const value = this.#validateNode(field.value, `${fieldPointer}/value`, fieldContextAvailability);
                const { name } = field;

                if (names.has(name)) {
                    this.#fail('LEXICA2031', fieldPointer, `Two fields of one object expression are named '${name}'`);
                }

                // A field is in scope after its value, through the fields after it, hiding a local or a field of its name outside it.
                names.add(name);
                this.#localNames = new Set(this.#localNames).add(name);

                return Object.freeze({ name, value });
            });

            return Object.freeze({
                kind: 'object',
                ...(target === undefined ? {} : { target }),
                ...(locals.length === 0 ? {} : { locals: Object.freeze(locals) }),
                fields: Object.freeze(fields),
            });
        } finally {
            this.#localNames = enclosingLocalNames;
            this.#isInObjectExpression = wasInObjectExpression;
        }
    }

    /** Validates an object expression's locals in order, each seeing those before it, and leaves every one in scope for its fields; a local may hide one of its name outside its object expression, and two of one never share a name. */
    #validateLocals(locals, pointer, contextAvailability) {
        this.#requireArray(locals, pointer);

        const names = locals.map(local => local?.name);
        const declared = new Set();

        return locals.map((local, index) => {
            const localPointer = `${pointer}/${index}`;
            this.#requireProperties(local, localPointer, ENTRY_PROPERTIES);
            this.#requireName(local.name, `${localPointer}/name`);

            // A local's value and the locals before it see neither it nor the locals after it, whose names no parameter there reads.
            const value = this.#validateWithLater(names.slice(index), () => this.#validateLocalValue(local.value, `${localPointer}/value`, contextAvailability));
            const { name } = local;

            if (declared.has(name)) {
                this.#fail('LEXICA2015', localPointer, `Two locals of one object expression are named '${name}'`);
            }

            declared.add(name);
            this.#localNames = new Set(this.#localNames).add(name);

            return Object.freeze({ name, value });
        });
    }

    /** What validating answers, with the names given declared later in its scope besides those already, by a local or, for a conditional binding's name, by the binding. */
    #validateWithLater(names, validate, declaredBy = 'local') {
        const enclosingLaterNames = this.#laterNames;

        this.#laterNames = new Map([...this.#laterNames, ...names.map(name => [name, declaredBy])]);

        try {
            return validate();
        } finally {
            this.#laterNames = enclosingLaterNames;
        }
    }

    /**
     * Refuses a parameter that text could not write: one named as a local or a field in scope where it stands, which the name reads there instead, and one named as a local declared later in its scope,
     * the local whose value it is among them, which a name reads only after its declaration and never as a binding of that name before it.
     */
    #requireBindingName(name, pointer) {
        if (this.#localNames.has(name)) {
            this.#fail('LEXICA2528', pointer, `'${name}' names the local or field in scope here, so no binding of that name is read where it is`);
        }

        if (this.#laterNames.has(name)) {
            this.#fail(this.#laterNames.get(name) === 'binding' ? 'LEXICA2014' : 'LEXICA2013', pointer, `'${name}' is used before the local of that name is declared in its scope: a local is read after its declaration, and the name reads no binding before it`);
        }
    }

    #requireProperties(part, pointer, { properties, required }) {
        if (!ObjectUtils.isNonArrayObject(part)) {
            this.#fail('LEXICA2000', pointer, 'This part of a definition is an object');
        }

        for (const key of Object.keys(part)) {
            if (!properties.includes(key)) {
                this.#fail('LEXICA2000', pointer, `'${key}' is no property of this part of a definition`);
            }
        }

        for (const key of required) {
            if (!Object.hasOwn(part, key)) {
                this.#fail('LEXICA2000', pointer, `This part of a definition requires '${key}'`);
            }
        }
    }

    #requireArray(value, pointer) {
        if (!Array.isArray(value)) {
            this.#fail('LEXICA2000', pointer, 'This part of a definition is an array');
        }
    }

    #requireName(value, pointer) {
        if (!Names.isIdentifier(value)) {
            this.#fail('LEXICA2000', pointer, 'A name is a letter followed by letters and digits');
        }
    }

    #fail(code, pointer, message) {
        throw LexicaErrors.structure(code, message, this.#locations?.locate(pointer) ?? { pointer });
    }
}
