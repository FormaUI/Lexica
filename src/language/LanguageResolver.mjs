/**
 * LanguageResolver — resolves a Lexica definition against the vocabulary and validates its types, before anything is evaluated
 */

import { DefinitionWriter } from './DefinitionWriter.mjs';
import { LexicaError } from './LexicaError.mjs';
import { Names } from './Names.mjs';
import { ResolvedDefinition } from './ResolvedDefinition.mjs';
import { Type } from './Type.mjs';
import { LexicaModule } from './vocabulary/LexicaModule.mjs';

const DATA_TYPE_NAMES = new Set(['number', 'string', 'boolean']);

/** How each form of a declaration is written, and the node that writes it. */
const FORM_NODE_KINDS = { access: 'member', 'function-call': 'call', indexer: 'indexer' };

/** No facts, the set a scope starts with: what narrows a stable reference on a path. */
const NO_FACTS = new Map();

export class LanguageResolver {
    #moduleRegistry;
    #bindings;
    #locations;

    /** The names of the modules whose namespaces the registry gives, every module it holds but Lexica's own. @type {ReadonlySet<string>} */
    #namespaceNames;

    /** @type {Map<string, object>} */
    #resolutions = new Map();

    /** @type {object[]} */
    #usedDeclarations = [];

    /** The optional chains being resolved, the innermost last, each with whether an optional access of it can meet a null receiver. @type {{ shortCircuits: boolean }[]} */
    #chains = [];

    /**
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} moduleRegistry The vocabulary to resolve against.
     * @param {import('./ParameterBindings.mjs').ParameterBindings} bindings What the request's parameters are bound to.
     * @param {import('./TextLocations.mjs').TextLocations | null} locations Where in a text each part of the definition came from.
     */
    constructor(moduleRegistry, bindings, locations) {
        this.#moduleRegistry = moduleRegistry;
        this.#bindings = bindings;
        this.#locations = locations;
        this.#namespaceNames = new Set(moduleRegistry.namespaceNames);
    }

    /** Resolves and types the definition, answering what it resolved to or throwing where it cannot. */
    resolveDefinition(definition) {
        const result = this.#resolveTerminal(definition.expression, '/expression', { contextType: null, contextKey: {}, locals: new Map(), facts: NO_FACTS, objectRoot: null });

        // A host call that supplies nothing gives no result, and one that supplies values gives, for each, what its result projection makes of it, or the value itself.
        const type = result.suppliesNothing === true ? null : result.type;

        if (type !== null && LanguageResolver.#heldReferenceOf(type) === 'function') {
            this.#fail('The result would hold a function, which is used within the expression and never part of its result: call it, as name(…)', '/expression');
        }

        if (type !== null && !this.#isData(type)) {
            this.#fail(`The result would hold ${type}, which is no data; read the facts it needs through an object expression`, '/expression');
        }

        const hostCall = result.kind === 'hostCall' ? this.#hostCallOf(definition.expression, '/expression') : null;

        return new ResolvedDefinition(definition, type, hostCall, this.#resolutions, this.#usedDeclarations, this.#instances);
    }

    /** Resolves the node in the script's terminal position, where a host call may stand: the script's expression, the result a body there returns and the body a `do` there holds. */
    #resolveTerminal(node, pointer, scope) {
        switch (node.kind) {
            case 'body':
                return this.#resolveBody(node, pointer, scope, true);
            case 'do':
                return this.#resolveTerminal(node.body, `${pointer}/body`, scope);
            default:
                return this.#resolveNode(node, pointer, scope);
        }
    }

    /** The host call the script ends in, found along its terminal position through bodies, `do` blocks, result projections and its optional chain: its node, where it stands, its name and its declaration, null on a receiver of unknown type. */
    #hostCallOf(node, pointer) {
        switch (node.kind) {
            case 'body':
                return this.#hostCallOf(node.result, `${pointer}/result`);
            case 'do':
                return this.#hostCallOf(node.body, `${pointer}/body`);
            case 'object':
            case 'optionalChain':
                return this.#hostCallOf(node.target, `${pointer}/target`);
            default:
                return { node, pointer, name: node.name, declaration: this.#resolutions.get(pointer).declaration };
        }
    }

    #resolveNode(node, pointer, scope) {
        switch (node.kind) {
            case 'literal':
                return this.#resolveLiteral(node);
            case 'parameter':
                return this.#resolveParameter(node, pointer, scope);
            case 'root':
                return this.#resolveObjectRoot(pointer, scope);
            case 'it':
                if (scope.contextType === null) {
                    this.#fail("'it' is the implicit parameter, and there is none here", pointer);
                }

                // An `it` of an implicit body's own scope makes its argument the body, whose `it` the member supplies.
                if (scope.implicitBody?.key === scope.contextKey) {
                    scope.implicitBody.isRead = true;
                }

                return { type: scope.facts.get(scope.contextKey) ?? scope.contextType, kind: 'value', isFixed: false };
            case 'local':
                return this.#resolveLocal(node, pointer, scope);
            case 'member':
            case 'call':
                return this.#resolveMember(node, pointer, scope);
            case 'indexer':
                return this.#resolveIndexer(node, pointer, scope);
            case 'equality':
                return this.#resolveEquality(node, pointer, scope, false);
            case 'arithmetic':
                // A subtraction of a bare name from a property access may be one name written with a hyphen, as `it.client-size` is, which a failure to find the member suggests.
                const access = node.left.kind === 'optionalChain' ? node.left.target : node.left;

                if (node.operator === '-' && access.kind === 'member' && typeof access.name === 'string' && (node.right.kind === 'parameter' || node.right.kind === 'local')) {
                    this.#joinedNames.set(access, `${access.name}${node.right.name[0].toUpperCase()}${node.right.name.slice(1)}`);
                }

                for (const side of ['left', 'right']) {
                    this.#requireNumber(this.#resolveNode(node[side], `${pointer}/${side}`, scope), `The ${side} operand of '${node.operator}'`, `${pointer}/${side}`);
                }

                return { type: Type.createNamedType('number'), kind: 'value', isFixed: false };
            case 'negate':
                this.#requireNumber(this.#resolveNode(node.operand, `${pointer}/operand`, scope), "What '-' negates", `${pointer}/operand`);

                return { type: Type.createNamedType('number'), kind: 'value', isFixed: false };
            case 'interpolatedString':
                node.parts.forEach((part, index) => {
                    if (part.kind === 'expression') {
                        this.#requireInterpolated(this.#resolveNode(part.expression, `${pointer}/parts/${index}/expression`, scope), `${pointer}/parts/${index}/expression`);
                    }
                });

                return { type: Type.createNamedType('string'), kind: 'value', isFixed: false };
            case 'comparison':
                // Each operand is named by the operator it stands after, the first by the one after it.
                node.operands.forEach((operand, index) => {
                    const what = index === 0 ? `The left operand of '${node.operators[0]}'` : `The right operand of '${node.operators[index - 1]}'`;

                    this.#requireNumber(this.#resolveNode(operand, `${pointer}/operands/${index}`, scope), what, `${pointer}/operands/${index}`, 'a comparison');
                });

                return { type: Type.createNamedType('boolean'), kind: 'value', isFixed: false };
            case 'conditional':
                return this.#resolveConditional(node, pointer, scope);
            case 'body':
                return this.#resolveBody(node, pointer, scope);
            case 'do':
                return this.#resolveNode(node.body, `${pointer}/body`, scope);
            case 'functionCall':
                return this.#resolveFunctionCall(node, pointer, scope);
            case 'function':
                // An arrow function written as an argument is a function value of its own, which captures the scope it is written in.
                return { type: Type.createFunctionType([LanguageResolver.#functionLocalOf(node, pointer, scope)]), kind: 'value', isFixed: false };
            case 'optionalChain':
                return this.#resolveOptionalChain(node, pointer, scope);
            case 'coalescing':
                return this.#resolveCoalescing(node, pointer, scope);
            case 'not':
                return this.#resolveNot(node, pointer, scope);
            case 'cast':
                return this.#resolveCast(node, pointer, scope);
            case 'conversion':
                return this.#resolveConversion(node, pointer, scope);
            case 'try':
                return this.#resolveTry(node, pointer, scope);
            case 'and':
            case 'or':
                return this.#resolveLogical(node, pointer, scope);
            default:
                return this.#resolveObject(node, pointer, scope);
        }
    }

    /** The result each condition and operand resolved to, by its node, which the values a computed property access can give follow where it is fixed or its type tells its falsey part. @type {WeakMap<object, object>} */
    #decidingResults = new WeakMap();

    /**
     * Resolves a coalescing: a value and a fallback of one type, as a conditional's branches are, its type the value's made non-null where the fallback's is; the whole is resolved before any of it is evaluated.
     * Where the value is fixed, it is the side that value selects, fixed where that side is.
     */
    #resolveCoalescing(node, pointer, scope) {
        const results = ['value', 'fallback'].map(side => {
            const result = this.#resolveNode(node[side], `${pointer}/${side}`, scope);

            if (result.kind !== 'value') {
                this.#fail(`The ${side} of '??' is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${side}`);
            }

            this.#decidingResults.set(node[side], result);

            return result;
        });
        const [value, fallback] = results.map(result => result.type);

        // A value of the type null is never anything but null, so the fallback's type is the whole's.
        const type = value.kind === 'null' ? fallback : Type.merge(value.toNonNullable(), fallback);

        if (type === null) {
            this.#fail(`The value and the fallback of '??' are of one type, and these are ${value} and ${fallback}`, `${pointer}/fallback`);
        }

        return LanguageResolver.#fixedAs(type, results[0].isFixed ? results[results[0].value === null ? 1 : 0] : null);
    }

    /** Resolves an optional chain: the chain it holds, nullable where an optional access of it can meet a null receiver, which ends the chain with null. */
    #resolveOptionalChain(node, pointer, scope) {
        const chain = { shortCircuits: false };

        this.#chains.push(chain);

        try {
            const result = this.#resolveNode(node.target, `${pointer}/target`, scope);

            return chain.shortCircuits ? { ...result, type: result.type.toNullable(), isFixed: false } : result;
        } finally {
            this.#chains.pop();
        }
    }

    /**
     * Resolves an equality: two values, compared, and answers a Boolean that is never null, whatever their types.
     * A string, a number, a Boolean or a node is compared with a value of a type one of theirs fits, and a value of any other type with null alone; a value of the type null, and a never, compare with any.
     * Where `==`, or `!=` as it is negated, compares a value with a string that names one of its Boolean members, the refusal gives the member to write.
     */
    #resolveEquality(node, pointer, scope, isNegated) {
        const left = this.#resolveNode(node.left, `${pointer}/left`, scope);
        const right = this.#resolveNode(node.right, `${pointer}/right`, scope);
        // An equality its negation holds is `!=`, as the canonical text writes it.
        const operator = isNegated ? '!=' : '==';

        for (const [side, result] of [['left', left], ['right', right]]) {
            if (result.kind !== 'value') {
                this.#fail(`'${operator}' compares values, and this is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${side}`);
            }
        }

        if (!LanguageResolver.#comparesWithAny(left.type) && !LanguageResolver.#comparesWithAny(right.type)) {
            const leftType = left.type.toNonNullable();
            const rightType = right.type.toNonNullable();

            for (const [side, type] of [['left', leftType], ['right', rightType]]) {
                if (!LanguageResolver.#isComparable(type)) {
                    this.#fail(`'${operator}' compares a value of ${type} with null alone, since only strings, numbers, Booleans and nodes are compared with each other`, `${pointer}/${side}`);
                }
            }

            if (!leftType.isAssignableTo(rightType) && !rightType.isAssignableTo(leftType)) {
                this.#fail(`'${operator}' compares values whose types fit one way or the other, and ${leftType} and ${rightType} fit neither way${this.#testOf(node, left, right, isNegated)}`, pointer);
            }
        }

        return { type: Type.createNamedType('boolean'), kind: 'value', isFixed: false };
    }

    /**
     * For an equality of a value and a string that names one of the value's Boolean members, as `input == "disabled"` or `input == state` writes one, the test to write, negated for `!=`: the property read, or the Boolean function called
     * with no argument; nothing for any other. The name is read exactly, and the member is one the value's type has.
     */
    #testOf(node, left, right, isNegated) {
        if (!right.isFixed || typeof right.value !== 'string' || (node.right.kind !== 'literal' && node.right.kind !== 'parameter')) {
            return '';
        }

        const receiverType = left.type.toNonNullable();
        const isTest = candidate => candidate.result === 'boolean' && !LexicaModule.isHostCall(candidate) && (candidate.kind === 'property' || (candidate.syntax === 'function-call' && candidate.parameters.every(parameter => !parameter.required)));
        const declaration = this.#moduleRegistry.getMembers(right.value).find(candidate => isTest(candidate) && LanguageResolver.#matchesReceiver(candidate, receiverType, new Map()));

        if (declaration === undefined) {
            return '';
        }

        const optional = left.type.isNullable ? { optional: true } : {};
        const name = node.right.kind === 'literal' ? right.value : node.right;
        const test = declaration.kind === 'property' ? { kind: 'member', target: node.left, name, ...optional } : { kind: 'call', target: node.left, name: right.value, arguments: [], ...optional };

        return `: a test is the member that answers it, so write '${DefinitionWriter.write(isNegated ? { kind: 'not', operand: test } : test, this.#namespaceNames)}'`;
    }

    /**
     * Resolves a conditional: a condition, any value, or a binding, any value, whose name the consequent alone sees, bound to that value where it is truthy; and two branches of one type, nullable where either is.
     * The consequent sees what the condition's being truthy guarantees of the stable references it tests, and the alternative what its being falsey does. The whole is resolved before any of it is evaluated.
     */
    #resolveConditional(node, pointer, scope) {
        const condition = node.binding === undefined ? node.condition : node.binding.value;
        const conditionPointer = node.binding === undefined ? `${pointer}/condition` : `${pointer}/binding/value`;
        const tested = this.#resolveNode(condition, conditionPointer, scope);

        this.#requireValue(tested, node.binding === undefined ? "The condition of 'if'" : "What 'if let' binds", conditionPointer);
        this.#decidingResults.set(condition, tested);

        const truthyScope = LanguageResolver.#withFacts(scope, this.#factsOf(condition, scope, true));
        const falseyScope = LanguageResolver.#withFacts(scope, this.#factsOf(condition, scope, false));
        let consequentScope = truthyScope;

        if (node.binding !== undefined) {
            // The consequent is taken where the value is truthy, so it sees the value without null, fixed where the value is fixed; a value that is always falsey is never bound, and is a never there.
            const isFalsey = tested.isFixed && !LanguageResolver.#isTruthy(tested.value);
            const type = isFalsey ? Type.never : LanguageResolver.#truthyPartOf(tested.type);
            const result = tested.isFixed && !isFalsey ? { type, kind: 'value', isFixed: true, value: tested.value } : { type, kind: 'value', isFixed: false };

            consequentScope = LanguageResolver.#consequentScopeOf(node, truthyScope, result);
        }

        const results = ['consequent', 'alternative'].map(branch => {
            const result = this.#resolveNode(node[branch], `${pointer}/${branch}`, branch === 'consequent' ? consequentScope : falseyScope);

            if (result.kind !== 'value') {
                this.#fail(`A branch of 'if' is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${branch}`);
            }

            return result;
        });
        const branches = results.map(result => result.type);
        const type = Type.merge(...branches);

        if (type === null) {
            this.#fail(`The branches of 'if' are of one type, and these are ${branches[0]} and ${branches[1]}`, `${pointer}/alternative`);
        }

        // A fixed condition, or a fixed value bound, selects its branch when the expression is resolved, and the conditional is fixed where that branch is.
        return LanguageResolver.#fixedAs(type, tested.isFixed ? results[LanguageResolver.#isTruthy(tested.value) ? 0 : 1] : null);
    }

    /** A result of the type, fixed to the value of the result that decides it where that one is fixed: a value resolution settles without evaluating a member. */
    static #fixedAs(type, deciding) {
        return deciding?.isFixed ? { type, kind: 'value', isFixed: true, value: deciding.value } : { type, kind: 'value', isFixed: false };
    }

    /**
     * Resolves an and or an or: every value it combines, each seeing what the operands before it guarantee where it is reached, truthy ones for `and` and falsey ones for `or`, so the whole is validated before any of it is evaluated.
     * It answers the operand that decides it: `and` the falsey part of an operand before the last, or the last, and `or` the truthy part of one, or the last; values of more than one type no type holds, which is refused.
     * Where fixed operands decide it, it is the one that does, fixed.
     */
    #resolveLogical(node, pointer, scope) {
        const passesWhenTruthy = node.kind === 'and';
        const results = [];
        let passed = NO_FACTS;

        node.operands.forEach((operand, index) => {
            const operandPointer = `${pointer}/operands/${index}`;
            const operandScope = LanguageResolver.#withFacts(scope, passed);
            const result = this.#resolveNode(operand, operandPointer, operandScope);

            this.#requireValue(result, `An operand of '${node.kind}'`, operandPointer);
            this.#decidingResults.set(operand, result);
            results.push(result);
            passed = LanguageResolver.#unionOf(passed, this.#factsOf(operand, operandScope, passesWhenTruthy));
        });

        const last = results.length - 1;

        // Operands whose values are fixed decide it before anything is evaluated, the operand that decides it giving its value and its type.
        for (let index = 0; index <= last && results[index].isFixed; index++) {
            if (index === last || LanguageResolver.#isTruthy(results[index].value) !== passesWhenTruthy) {
                return results[index];
            }
        }

        const parts = results.map((result, index) => (index === last ? result.type : LanguageResolver.#partOf(result, !passesWhenTruthy)));
        const type = parts.reduce((merged, part) => (merged === null ? null : Type.merge(merged, part)));

        if (type === null) {
            const described = [...new Set(parts.flatMap((part, index) => LanguageResolver.#describePart(part, index === last ? null : !passesWhenTruthy)))];
            const rewrite = node.kind === 'and' && node.operands.length === 2
                ? `write 'if ${DefinitionWriter.write(node.operands[0], this.#namespaceNames)} then ${DefinitionWriter.write(node.operands[1], this.#namespaceNames)} else null end' if null is an acceptable alternative`
                : "a conditional, 'if … then … else … end', chooses between values of one type";

            this.#fail(`What '${node.kind}' gives is ${described.join(' or ')}, which no one type holds; ${rewrite}`, pointer);
        }

        return { type, kind: 'value', isFixed: false };
    }

    /** Whether a value is truthy: every value is but null and false. */
    static #isTruthy(value) {
        return value !== null && value !== false;
    }

    /** The type a value of the type has where it is truthy: the type without null, a Boolean staying one, since no type tells true from false. */
    static #truthyPartOf(type) {
        return type.kind === 'null' ? Type.never : type.toNonNullable();
    }

    /** The type a value of the type has where it is falsey: a Boolean where it is one, null where it can be null, and never where it is always truthy. */
    static #falseyPartOf(type) {
        if (type.kind === 'named' && type.name === 'boolean') {
            return type;
        }

        return type.isNullable ? Type.null : Type.never;
    }

    /** The part of a result that is truthy, or falsey, told from its value where the value is fixed. */
    static #partOf(result, isTruthy) {
        if (result.isFixed) {
            return LanguageResolver.#isTruthy(result.value) === isTruthy ? result.type : Type.never;
        }

        return isTruthy ? LanguageResolver.#truthyPartOf(result.type) : LanguageResolver.#falseyPartOf(result.type);
    }

    /** How a refusal names the part of an operand's type: a Boolean's truthy part as true and its falsey one as false, with null where it can be null; the last operand's, of no part, as its type. */
    static #describePart(part, isTruthy) {
        if (part.kind === 'never') {
            return [];
        }

        if (isTruthy === null || !(part.kind === 'named' && part.name === 'boolean')) {
            return [String(part)];
        }

        return isTruthy ? ['true'] : part.isNullable ? ['false', 'null'] : ['false'];
    }

    /**
     * What the node's being truthy, or falsey, guarantees of the stable references it tests, each by its identity: a local, a conditional binding, a script parameter or the implicit parameter.
     * A reference itself tells its own truthiness, `== null` whether it is null, `not` the opposite, and `and` and `or` what every operand tells on the path taken, or only what each path that reaches the outcome shares.
     */
    #factsOf(node, scope, isTruthy) {
        switch (node.kind) {
            case 'local':
            case 'parameter':
            case 'it': {
                const reference = this.#referenceOf(node, scope);

                return reference === null ? NO_FACTS : new Map([[reference.key, isTruthy ? LanguageResolver.#truthyPartOf(reference.type) : LanguageResolver.#falseyPartOf(reference.type)]]);
            }
            case 'equality': {
                const isNull = side => side.kind === 'literal' && side.value === null;
                const tested = isNull(node.right) ? node.left : isNull(node.left) ? node.right : null;
                const reference = tested === null ? null : this.#referenceOf(tested, scope);

                if (reference === null) {
                    return NO_FACTS;
                }

                return new Map([[reference.key, isTruthy ? Type.null : LanguageResolver.#truthyPartOf(reference.type)]]);
            }
            case 'not':
                return this.#factsOf(node.operand, scope, !isTruthy);
            case 'and':
            case 'or': {
                const passesWhenTruthy = node.kind === 'and';
                const isEveryPassed = isTruthy === passesWhenTruthy;
                const stops = [];
                let passed = NO_FACTS;

                for (const operand of node.operands) {
                    const operandScope = LanguageResolver.#withFacts(scope, passed);

                    if (!isEveryPassed) {
                        stops.push(LanguageResolver.#unionOf(passed, this.#factsOf(operand, operandScope, !passesWhenTruthy)));
                    }

                    passed = LanguageResolver.#unionOf(passed, this.#factsOf(operand, operandScope, passesWhenTruthy));
                }

                return isEveryPassed ? passed : LanguageResolver.#commonOf(stops);
            }
            default:
                return NO_FACTS;
        }
    }

    /** The identity and the type, where it is resolved, of a stable reference, or null for one that is none: a member's value is read anew where it is used, so it tells nothing of a later read. */
    #referenceOf(node, scope) {
        switch (node.kind) {
            case 'local': {
                const local = scope.locals.get(node.name);

                return local === undefined || local.result === null ? null : { key: local, type: scope.facts.get(local) ?? local.result.type };
            }
            case 'parameter': {
                if (!this.#bindings.has(node.name)) {
                    return null;
                }

                const key = `@${node.name}`;

                return { key, type: scope.facts.get(key) ?? this.#bindings.getType(node.name) };
            }
            case 'it':
                return scope.contextType === null ? null : { key: scope.contextKey, type: scope.facts.get(scope.contextKey) ?? scope.contextType };
            default:
                return null;
        }
    }

    /** The scope with the facts added, a later fact on a reference narrowing it further. */
    static #withFacts(scope, facts) {
        return facts.size === 0 ? scope : { ...scope, facts: LanguageResolver.#unionOf(scope.facts, facts) };
    }

    /** Both sets of facts, the second's type for a reference both hold, since it was found where the first holds. */
    static #unionOf(first, second) {
        return second.size === 0 ? first : first.size === 0 ? second : new Map([...first, ...second]);
    }

    /** The facts every set holds, each reference typed as any of them allows; a reference one set lacks tells nothing. */
    static #commonOf(sets) {
        const [first, ...rest] = sets;
        const common = new Map();

        for (const [key, type] of first) {
            const merged = rest.reduce((sum, set) => (sum === null || !set.has(key) ? null : Type.merge(sum, set.get(key))), type);

            if (merged !== null) {
                common.set(key, merged);
            }
        }

        return common;
    }

    /**
     * Resolves a cast: its target, a value, and the type it casts to, a node or one of its kinds, its result of that type, nullable where the target is, since null passes through it.
     * A target that can never be of the type is refused, while one that always is, and null, are not, since a binding typed from its value may be either.
     */
    #resolveCast(node, pointer, scope) {
        const target = this.#resolveNode(node.target, `${pointer}/target`, scope);
        const type = Type.createNamedType(this.#localTypeNameOf(node.type, pointer));

        if (target.kind !== 'value') {
            this.#fail(`A cast's target is a value, and this one is ${LanguageResolver.#descriptionOf(target.kind)}`, `${pointer}/target`);
        }

        if (!type.isNode) {
            this.#fail(`'as' casts to node or one of its kinds, ${Type.nodeKinds.join(', ')}, and '${node.type}' is none of them`, pointer);
        }

        const from = target.type;
        const canBe = from.kind === 'null' || from.kind === 'never' || (from.isNode && (from.name === 'node' || type.name === 'node' || from.name === type.name));

        if (!canBe) {
            this.#fail(`A value of ${from.toNonNullable()} can never be cast to ${node.type}: the cast would always reject it`, pointer);
        }

        return { type: from.kind === 'null' || from.isNullable ? type.toNullable() : type, kind: 'value', isFixed: false };
    }

    /**
     * The local name of the type a cast or a conversion names: the name as written, or, where its module's name qualifies it, the name of the type that registered module declares, refused where no module of that name
     * is registered or the module does not declare a type of that name.
     */
    #localTypeNameOf(name, pointer) {
        const dot = name.indexOf('.');

        if (dot < 0) {
            return name;
        }

        const moduleName = name.slice(0, dot);
        const localName = name.slice(dot + 1);
        const module = this.#moduleRegistry.getModule(moduleName);

        if (module === undefined) {
            this.#fail(`No module named '${moduleName}' is registered, so '${name}' does not name a type`, pointer);
        }

        if (!module.types.some(type => type.name === localName)) {
            this.#fail(`The module '${moduleName}' does not declare a type named '${localName}'`, pointer);
        }

        return localName;
    }

    /** Resolves an attempt: the conversion or the cast it attempts, as it resolves strictly, its result made nullable, since a rejection answers null. */
    #resolveTry(node, pointer, scope) {
        const result = this.#resolveNode(node.target, `${pointer}/target`, scope);

        return { type: result.type.toNullable(), kind: 'value', isFixed: false };
    }

    /**
     * Resolves a conversion: its target, a value, and the type of data it converts to, its result of that type, nullable where the target is.
     * A value already of the type answers itself, which no declaration overrides; any other takes the one conversion declared from its type to that one, never a chain of them.
     * A target of unknown type chooses none: null answers null, and a never is never evaluated.
     */
    #resolveConversion(node, pointer, scope) {
        const target = this.#resolveNode(node.target, `${pointer}/target`, scope);

        if (target.kind !== 'value') {
            this.#fail(`What 'to' converts is a value, and this one is ${LanguageResolver.#descriptionOf(target.kind)}`, `${pointer}/target`);
        }

        const to = Type.parse(this.#localTypeNameOf(node.type, pointer));

        if (to === null || to.kind !== 'named' || to.isNullable || !this.#moduleRegistry.isConvertible(to.name)) {
            const cast = to?.kind === 'named' && to.isNode ? `; a node is cast to one of its kinds with 'as', as in … as ${node.type}` : '';

            this.#fail(`'to' converts to a type of data named as it is declared, number, string, boolean or a structured type the vocabulary declares, and '${node.type}' is none of them${cast}`, pointer);
        }

        const from = target.type;

        if (from.kind === 'null' || from.kind === 'never') {
            this.#resolutions.set(pointer, { kind: 'conversion', declaration: null });

            return { type: from.kind === 'null' ? to.toNullable() : to, kind: 'value', isFixed: false };
        }

        const source = from.toNonNullable();
        const isIdentity = source.kind === 'named' && source.name === to.name;
        const declaration = isIdentity || source.kind !== 'named' ? undefined : this.#moduleRegistry.getConversion(source.name, to.name);

        if (!isIdentity && declaration === undefined) {
            const targets = source.kind === 'named' ? this.#moduleRegistry.getConversionTargets(source.name) : [];
            const available = targets.length === 0 ? `${source} converts to nothing` : `${source} converts to ${targets.join(', ')}`;

            this.#fail(`No conversion from ${source} to ${to.name} is declared, and ${available}`, pointer);
        }

        this.#resolutions.set(pointer, { kind: 'conversion', declaration: declaration ?? null, type: to });

        return { type: from.isNullable ? to.toNullable() : to, kind: 'value', isFixed: false };
    }

    /** The scope a conditional binding's consequent is resolved in: the scope around it, with the binding's name a local holding its value, of the result given. */
    static #consequentScopeOf(node, scope, result) {
        return { ...scope, locals: new Map(scope.locals).set(node.binding.name, { result, value: node.binding.value, scope, binding: node }) };
    }

    /** Resolves a negation: what it negates, any value, and answers a Boolean, true where that value is falsey. */
    #resolveNot(node, pointer, scope) {
        // An equality is negated as `!=` writes it, so the member a refusal gives is negated too.
        const operand = node.operand.kind === 'equality' ? this.#resolveEquality(node.operand, `${pointer}/operand`, scope, true) : this.#resolveNode(node.operand, `${pointer}/operand`, scope);

        this.#requireValue(operand, "What 'not' negates", `${pointer}/operand`);

        return { type: Type.createNamedType('boolean'), kind: 'value', isFixed: false };
    }

    /**
     * Refuses what the operation, arithmetic unless another is named, takes no part in: what is no value, a value that can be null, which a fallback or a test removes first,
     * and a value of any type but a number, which nothing converts to one but `to`.
     */
    #requireNumber(result, what, pointer, operation = 'arithmetic') {
        this.#requireValue(result, what, pointer);

        const { type } = result;

        if (type.kind === 'never') {
            return;
        }

        if (type.isNullable || type.kind === 'null') {
            this.#fail(`${what} can be null, and ${operation} takes numbers alone: give it a fallback, as in (… ?? 0), or test it first`, pointer);
        }

        if (type.kind !== 'named' || type.name !== 'number') {
            this.#fail(`${what} is a number, and this one is ${type}; a conversion makes a number of text, as in … to number`, pointer);
        }
    }

    /** Refuses what an interpolation inserts no text for: what is no value, a value that can be null, which a fallback or a test removes first, and a value of any type but a string or a number, a Boolean's text given by `to`. */
    #requireInterpolated(result, pointer) {
        const what = 'An interpolation';

        this.#requireValue(result, what, pointer);

        const { type } = result;

        if (type.kind === 'never') {
            return;
        }

        if (type.isNullable || type.kind === 'null') {
            this.#fail(`${what} can be null: give it a fallback, as in (… ?? "…"), or test it first`, pointer);
        }

        if (type.kind !== 'named' || (type.name !== 'string' && type.name !== 'number')) {
            const hint = type.kind === 'named' && type.name === 'boolean' ? '; give its text with … to string, or choose it with a conditional' : '';

            this.#fail(`${what} inserts a string or a number, and this one is ${type}${hint}`, pointer);
        }
    }

    /** Refuses what is no value where one is tested for its truthiness, a host call, and a value whose type no receiver gives, which tells nothing of whether it can be falsey. */
    #requireValue(result, what, pointer) {
        if (result.kind !== 'value') {
            this.#fail(`${what} is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, pointer);
        }

        if (LanguageResolver.#holdsTypeParameter(result.type)) {
            this.#fail(`${what} produces ${result.type}, a type no receiver gives`, pointer);
        }
    }

    /**
     * Resolves a body: each local against the scope and the locals before it, a value, and the result against them all, its type the result's.
     * It is fixed only where every local and its result are, so a read a local makes, used or not, is never discarded.
     */
    /** Resolves a body: its locals, each a value, and its result, which is a value too, or the host call the script ends in where the body stands in the script's terminal position. */
    #resolveBody(node, pointer, scope, isTerminal = false) {
        let locals = scope.locals;
        let isFixed = true;

        node.locals.forEach((local, index) => {
            const valuePointer = `${pointer}/locals/${index}/value`;
            const localScope = { ...scope, locals };

            // A function is resolved where it is called, against that call's arguments, so its local holds the scope it was declared in.
            if (local.value.kind === 'function') {
                locals = new Map(locals).set(local.name, LanguageResolver.#functionLocalOf(local.value, valuePointer, localScope));

                return;
            }

            const result = this.#resolveNode(local.value, valuePointer, localScope);

            if (result.kind !== 'value') {
                this.#fail(`The local '${local.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a local is a value`, valuePointer);
            }

            isFixed &&= result.isFixed;
            locals = new Map(locals).set(local.name, { result, value: local.value, scope: localScope });
        });

        const resultPointer = `${pointer}/result`;
        const resultScope = { ...scope, locals };
        const result = isTerminal ? this.#resolveTerminal(node.result, resultPointer, resultScope) : this.#resolveNode(node.result, resultPointer, resultScope);

        // A body gives a value, as a field holds one, and returns a host call only where it stands in the script's terminal position.
        if (result.kind !== 'value' && !(isTerminal && result.kind === 'hostCall')) {
            this.#fail(result.kind === 'hostCall' ? 'A host call ends the script, and this body gives its result to the expression around it, which takes a value' : `A body gives a value, and its result is ${LanguageResolver.#descriptionOf(result.kind)}`, resultPointer);
        }

        return isFixed && result.isFixed ? result : { ...result, isFixed: false };
    }

    /** The local a function declaration gives its name: the function, where it is declared, and the scope it captures, its locals and its implicit parameter. */
    static #functionLocalOf(node, pointer, scope) {
        return { function: node, pointer, scope, result: { type: Type.never, kind: 'function', isFixed: false }, value: node };
    }

    /**
     * Resolves a call of a local function, or of a local or a parameter holding a function value: its arguments against the caller's scope, as many as each function it may be declares,
     * and then, for each one, a copy of its body of its own, against the scope that function captured and its parameters, typed as this call's arguments, their results merged.
     * A local call settles no fixed argument.
     */
    #resolveFunctionCall(node, pointer, scope) {
        const local = scope.locals.get(node.name);

        if (local === undefined) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.name);

            this.#fail(`No function named '${node.name}' is in scope${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        const functions = local.function !== undefined ? [local] : (local.result?.type?.kind === 'function' ? local.result.type.functions : null);

        if (functions === null) {
            this.#fail(`'${node.name}' is a local holding a value, and no function, so it is read without parentheses`, pointer);
        }

        if (local.function === undefined && local.result.type.isNullable) {
            this.#fail(`'${node.name}' may hold null, and only a function is called: bind one to call in its place first, as let call = ${node.name} ?? other`, pointer);
        }

        // A call of one function reference alone is the call its qualified form makes, whatever its arguments' kinds.
        if (functions.length === 1 && functions[0].reference !== undefined) {
            return this.#resolveReferenceCall(node, pointer, scope, local, functions[0].reference);
        }

        for (const target of functions) {
            if (target.reference !== undefined) {
                continue;
            }

            const { parameters } = target.function;

            if (node.arguments.length !== parameters.length) {
                this.#fail(`'${node.name}' takes ${parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`}, and is given ${node.arguments.length}`, pointer);
            }
        }

        const results = node.arguments.map((argument, index) => {
            const argumentPointer = `${pointer}/arguments/${index}`;
            const result = this.#resolveNode(argument, argumentPointer, scope);

            if (result.kind !== 'value') {
                this.#fail(`An argument of '${node.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and an argument is a value`, argumentPointer);
            }

            return result;
        });

        const targets = functions.map((target, index) => (target.reference !== undefined
            ? this.#checkReferenceCall(target.reference, node, results, pointer)
            : this.#resolveFunctionBody(target, node.name, results, node.arguments, scope, functions.length === 1 ? `${pointer}/body` : `${pointer}/bodies/${index}`, pointer)));
        const type = targets.reduce((merged, target) => (merged === null ? null : Type.merge(merged, target.type)), Type.never);

        if (type === null) {
            this.#fail(`'${node.name}' may be any of ${targets.length} functions, whose results are of no one type: ${targets.map(target => target.type).join(', ')}`, pointer);
        }

        // A conditional binding holding the function is read as its conditional bound it, and any other name as its scope holds it.
        const binding = local.binding === undefined ? {} : { binding: local.binding };

        this.#resolutions.set(pointer, { kind: 'functionCall', targets: targets.map(({ function: declared, body, parameters, reference, invocation }) => (reference === undefined ? { function: declared, body, parameters } : { reference, invocation })), ...binding });

        return { type, kind: 'value', isFixed: false };
    }

    /**
     * Resolves a call of a function value that is one function reference: the call its qualified form makes, its receiver argument first where its declaration has a receiver, a null one answering null, and its own arguments after it,
     * each of the kind its parameter declares.
     */
    #resolveReferenceCall(node, pointer, scope, local, declaration) {
        const written = this.#referenceNameOf(declaration);
        let invocation;

        if (declaration.target === undefined) {
            invocation = this.#resolveInvocation(declaration, node, pointer, scope, null, false, { name: written });
        } else {
            if (node.arguments.length === 0) {
                this.#fail(`'${node.name}' holds a reference to '${written}', which takes its receiver as its first argument`, pointer);
            }

            const receiver = this.#resolveReceiverArgument(node, pointer, scope, `'${node.name}'`);
            const receiverType = receiver.type.toNonNullable();

            if (!LanguageResolver.#isOfUnknownType(receiverType) && !LanguageResolver.#matchesReceiver(declaration, receiverType, new Map())) {
                this.#fail(`'${node.name}' holds a reference to '${written}', which takes a receiver of ${[declaration.target].flat().join(', ')}, and is given ${receiverType}`, `${pointer}/arguments/0`);
            }

            invocation = this.#resolveInvocation(declaration, node, pointer, scope, LanguageResolver.#isOfUnknownType(receiverType) ? null : receiverType, receiver.type.isNullable || receiver.type.kind === 'null', { offset: 1, qualified: true, name: written });
        }

        const binding = local.binding === undefined ? {} : { binding: local.binding };

        this.#resolutions.set(pointer, { kind: 'functionCall', targets: [{ reference: declaration, invocation: invocation.resolution }], ...binding });

        return invocation.result;
    }

    /**
     * Checks a call of a function reference among the functions a value may be, whose arguments are evaluated as values, as a call of any of them takes them: its receiver argument first where its declaration has a receiver, then a value for each
     * of its own parameters, each a value parameter its argument fits. It answers the reference, its declaration's parameter names and its type, nullable where its receiver argument, or an argument whose parameter propagates null, can be null.
     */
    #checkReferenceCall(declaration, node, results, pointer) {
        const written = this.#referenceNameOf(declaration);
        const hasReceiver = declaration.target !== undefined;
        const own = hasReceiver ? results.slice(1) : results;
        const { parameters } = declaration;
        const required = parameters.filter(parameter => parameter.required).length;

        if (parameters.some(parameter => parameter.kind !== 'value') || declaration.arguments === 'options') {
            this.#fail(`'${node.name}' may hold a reference to '${written}', whose arguments are no values alone, and a call of a value that may be one of several functions gives each values; call it through '${written}(…)'`, pointer);
        }

        if ((hasReceiver && results.length === 0) || own.length < required || own.length > parameters.length) {
            this.#fail(`'${node.name}' may hold a reference to '${written}', which takes ${hasReceiver ? 'its receiver and ' : ''}${parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`}, and is given ${node.arguments.length}`, pointer);
        }

        let isNullable = false;
        const typeArguments = new Map();

        if (hasReceiver) {
            const receiverType = results[0].type;

            if (!LanguageResolver.#isOfUnknownType(receiverType.toNonNullable()) && !LanguageResolver.#matchesReceiver(declaration, receiverType.toNonNullable(), typeArguments)) {
                this.#fail(`'${node.name}' may hold a reference to '${written}', which takes a receiver of ${[declaration.target].flat().join(', ')}, and is given ${receiverType.toNonNullable()}`, `${pointer}/arguments/0`);
            }

            isNullable = receiverType.isNullable || receiverType.kind === 'null';
        }

        own.forEach((result, index) => {
            const parameter = parameters[index];
            const expected = Type.parse(parameter.type).resolveTypeParameters(typeArguments);

            if (!this.#checkValue(result, expected, parameter, declaration, `${pointer}/arguments/${index + (hasReceiver ? 1 : 0)}`)) {
                isNullable = true;
            }
        });

        const declared = Type.parse(declaration.result).resolveTypeParameters(typeArguments);

        return { reference: declaration, type: isNullable ? declared.toNullable() : declared, invocation: { hasReceiver, names: parameters.slice(0, own.length).map(parameter => parameter.name), defaults: parameters.slice(own.length).map(parameter => [parameter.name, parameter.default]) } };
    }

    /**
     * Resolves a function's body for one call of it: a copy of its own, so the same function serves calls of different types, each resolution kept under the instance's pointer, against the scope the function captured
     * and its parameters, each holding what the call gives it. A function whose body is being resolved is never called again within it, directly or through a function passed to it, which a call reaching it again would.
     */
    #resolveFunctionBody(target, name, argumentResults, argumentNodes, callerScope, instancePointer, callPointer) {
        const { parameters, body } = target.function;

        if (this.#functionsBeingResolved.has(target.function)) {
            this.#fail(`'${name}' would call a function within its own call, through a function passed to it: a function never calls itself, directly or through another`, callPointer);
        }

        let locals = target.scope.locals;

        parameters.forEach((parameter, index) => {
            locals = new Map(locals).set(parameter, { result: argumentResults[index], value: argumentNodes?.[index] ?? null, scope: callerScope });
        });

        const instance = structuredClone(body);

        this.#instances.push({ node: instance, pointer: instancePointer, source: `${target.pointer}/body` });
        this.#functionsBeingResolved.add(target.function);

        let result;

        try {
            result = this.#resolveNode(instance, instancePointer, { ...target.scope, locals });
        } finally {
            this.#functionsBeingResolved.delete(target.function);
        }

        if (result.kind !== 'value') {
            this.#fail(`'${name}' gives ${LanguageResolver.#descriptionOf(result.kind)}, and a function gives a value`, instancePointer);
        }

        return { function: target.function, body: instance, parameters, type: result.type };
    }

    /** The functions whose bodies are being resolved, each for a call within which none is called again. @type {Set<object>} */
    #functionsBeingResolved = new Set();

    /** Resolves a local: what the one in scope with its name resolved to where it was written. A name no local in scope has is refused, with the form of the implicit parameter's member of that name where it has one. */
    #resolveLocal(node, pointer, scope) {
        const local = scope.locals.get(node.name);

        // A function's name read without a call is a function value, which a local holds, an argument passes and a function returns.
        if (local?.function !== undefined) {
            this.#resolutions.set(pointer, { kind: 'local', name: node.name, value: local.value });

            return { type: Type.createFunctionType([local]), kind: 'value', isFixed: false };
        }

        if (local?.option !== undefined) {
            this.#fail(LanguageResolver.#unreadableOptionMessageOf(node.name, local.option), pointer);
        }

        if (local === undefined) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.name);

            this.#fail(`No local named '${node.name}' is in scope${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        // A binding's value is evaluated once, by its conditional, which a use of its name reads; either records the expression its value came from.
        this.#resolutions.set(pointer, local.binding === undefined ? { kind: 'local', name: node.name, value: local.value } : { kind: 'binding', conditional: local.binding, value: local.value });

        const narrowed = scope.facts.get(local);

        return narrowed === undefined ? local.result : { ...local.result, type: narrowed };
    }

    /** The names a property access joins with the bare name a subtraction takes from it, by the access, which a failure to find its member suggests. @type {WeakMap<object, string>} */
    #joinedNames = new WeakMap();

    /**
     * For a property access no member is named as, which a subtraction takes a bare name from, the suggestion of the member the two names joined in camelCase name, as `client` and `size` join as `clientSize`,
     * where the receiver's type has one of that name, compared ignoring case and written as the member spells it; nothing for any other access.
     */
    #joinedNameHintOf(node, receiverType) {
        const joined = this.#joinedNames.get(node)?.toLowerCase();

        if (joined === undefined || LanguageResolver.#isOfUnknownType(receiverType)) {
            return '';
        }

        const name = this.#moduleRegistry.memberNames.find(candidate => candidate.toLowerCase() === joined && this.#memberForm(receiverType, candidate) !== null);

        if (name === undefined) {
            return '';
        }

        // The access written with the member's name, less that name, is its receiver as the access writes it, grouped where it needs to be and ending in `?` where the access is optional.
        const receiver = DefinitionWriter.write({ ...node, name }, this.#namespaceNames).slice(0, -(name.length + 1));

        return `. Did you mean '${this.#memberForm(receiverType, name, receiver)}'?`;
    }

    /** How the member of the type with the name is written after the receiver, `it` unless another is given, or null where the type has none. */
    #memberForm(type, name, receiver = 'it') {
        if (this.#fieldTypeOf(type, name) !== null) {
            return `${receiver}.${name}`;
        }

        const declaration = this.#moduleRegistry.getMembers(name).find(candidate => LanguageResolver.#matchesReceiver(candidate, type, new Map()));

        if (declaration === undefined) {
            return null;
        }

        if (declaration.kind === 'property') {
            return `${receiver}.${name}`;
        }

        return declaration.syntax === 'indexer' ? `${receiver}.${name}[…]` : `${receiver}.${name}(…)`;
    }

    #resolveLiteral(node) {
        const { value } = node;
        const type = value === null ? Type.null : Type.createNamedType(typeof value);

        return { type, kind: 'value', isFixed: true, value };
    }

    #resolveParameter(node, pointer, scope) {
        // A name no local in scope has reads the script parameter of its name, and one the host did not bind may be a member written without its receiver; where a local of its name is in scope, it was written with `~`, which reads no local.
        if (!this.#bindings.has(node.name) && scope.locals.has(node.name)) {
            this.#fail(`No script parameter is named '${node.name}', and '~${node.name}' reads a script parameter alone: write '${Names.needsPrefix(node.name, this.#namespaceNames) ? '@' : ''}${node.name}' for the local or field of that name`, pointer);
        }

        if (!this.#bindings.has(node.name)) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.name);

            this.#fail(`No local in scope or script parameter is named '${node.name}'${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        return { type: scope.facts.get(`@${node.name}`) ?? this.#bindings.getType(node.name), kind: 'value', isFixed: true, value: this.#bindings.get(node.name) };
    }

    /**
     * Resolves a property access, a call or an indexer on its receiver, the node's target resolved where it stands unless its resolution is given, as an indexer gives the receiver it has resolved already;
     * the optional form, which a message gives where the receiver can be null, is the node written with it unless another is given.
     */
    #resolveMember(node, pointer, scope, { receiver: given, optionalForm = { ...node, optional: true } } = {}) {
        if (node.target.kind === 'namespace') {
            return this.#resolveThroughNamespace(node, pointer, scope);
        }

        const receiver = given ?? this.#resolveNode(node.target, `${pointer}/target`, scope);
        const isUnnamedIndexer = node.kind === 'indexer' && node.name === undefined;
        const written = isUnnamedIndexer ? '[…]' : typeof node.name === 'string' ? node.name : `.[${DefinitionWriter.write(node.name, this.#namespaceNames)}]`;

        if (receiver.kind !== 'value') {
            this.#fail(`'${written}' follows ${LanguageResolver.#descriptionOf(receiver.kind)}, which takes no members`, pointer);
        }

        // A member requires a receiver that cannot be null, and an optional one reads it where it is not null, ending its chain with null where it is.
        if (receiver.type.isNullable) {
            if (node.optional !== true) {
                const follows = receiver.type.kind === 'null' ? 'null' : `${receiver.type}, which can be null`;

                this.#fail(`'${written}' follows ${follows}: write '${DefinitionWriter.write(optionalForm, this.#namespaceNames)}' to read it where it is not`, pointer);
            }

            this.#chains.at(-1).shortCircuits = true;
        }

        const receiverType = node.optional === true ? receiver.type.toNonNullable() : receiver.type;

        if (isUnnamedIndexer) {
            return this.#resolveUnnamedIndexer(node, pointer, scope, receiverType);
        }

        if (typeof node.name !== 'string') {
            return this.#resolveComputedPropertyAccess(node, pointer, scope, receiverType);
        }

        return this.#resolveMemberOf(node, pointer, scope, receiverType);
    }

    /**
     * Resolves an indexer. Where what is before its brackets is a member access, by a written name, of a receiver whose type has a named indexer of that name, it is that named indexer, the access giving its receiver
     * and its name and never read alone; once a named indexer applies, a key it refuses is its own error, and never makes the brackets another reading. Optional brackets add nothing to a named indexer, which has
     * no value between its name and its key, so only its access's own marker makes its receiver optional. Otherwise it is the unnamed indexer of the type what is before its brackets answers, which optional
     * brackets skip where that is null.
     */
    #resolveIndexer(node, pointer, scope) {
        const { target } = node;

        if (target.kind !== 'member' || typeof target.name !== 'string' || target.target.kind === 'namespace') {
            return this.#resolveMember(node, pointer, scope);
        }

        // The access's receiver is resolved once, and given to whichever reading applies, so a chain of indexers resolves each part once.
        const accessPointer = `${pointer}/target`;
        const receiver = this.#resolveNode(target.target, `${accessPointer}/target`, scope);
        const syntax = this.#syntaxNamedBy(target, receiver);

        // A function's arguments are written in parentheses, so brackets after its name are a call written as an indexer.
        if (syntax === 'function-call') {
            this.#fail(`'${target.name}' uses call syntax: write '${DefinitionWriter.write({ kind: 'call', target: target.target, name: target.name, arguments: [node.argument], ...(target.optional === true ? { optional: true } : {}) }, this.#namespaceNames)}'`, pointer);
        }

        if (syntax !== 'indexer') {
            const access = this.#resolveMember(target, accessPointer, scope, { receiver });

            return this.#resolveMember(node, pointer, scope, { receiver: access });
        }

        // The named indexer's own node, its receiver the access's, optional where the access is.
        const named = { kind: 'indexer', target: target.target, name: target.name, argument: node.argument, ...(target.optional === true ? { optional: true } : {}) };
        const result = this.#resolveMember(named, pointer, scope, { receiver, optionalForm: { ...node, target: { ...target, optional: true } } });

        this.#resolutions.set(pointer, { ...this.#resolutions.get(pointer), isNamedIndexer: true });

        return result;
    }

    /**
     * The syntax of the member the access names on its receiver's type, `indexer` for a named indexer and `function-call` for a function, among the declarations of its name for that type, or, on a receiver of unknown type,
     * `indexer` where any declaration of its name is a named indexer; null where none is either, as a property's or a field's name is, given the access's receiver as it resolved.
     */
    #syntaxNamedBy(access, receiver) {
        const declarations = this.#moduleRegistry.getMembers(access.name).filter(declaration => declaration.kind !== 'property');

        if (declarations.length === 0 || receiver.kind !== 'value') {
            return null;
        }

        const receiverType = access.optional === true ? receiver.type.toNonNullable() : receiver.type;

        if (LanguageResolver.#isOfUnknownType(receiverType)) {
            return declarations.some(declaration => declaration.syntax === 'indexer') ? 'indexer' : null;
        }

        if (receiverType.kind === 'root' || this.#fieldTypeOf(receiverType, access.name) !== null) {
            return null;
        }

        return declarations.find(declaration => LanguageResolver.#matchesReceiver(declaration, receiverType, new Map()))?.syntax ?? null;
    }

    /**
     * Resolves an unnamed indexer: the one indexer the vocabulary declares the default for the receiver's type, resolved as the indexer it names would be.
     * A receiver of unknown type chooses none, and takes the key every unnamed indexer could; a receiver whose type has none is refused, with the computed property access its key may mean.
     */
    #resolveUnnamedIndexer(node, pointer, scope, receiverType) {
        const defaults = this.#moduleRegistry.getDefaultIndexers();

        if (LanguageResolver.#isOfUnknownType(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiverType, defaults);
        }

        if (receiverType.kind === 'root') {
            return this.#resolveObjectRootField(node, pointer, receiverType);
        }

        const matching = defaults.filter(declaration => LanguageResolver.#matchesReceiver(declaration, receiverType, new Map()));

        if (matching.length === 0) {
            // A string key may name a property of the receiver, which a computed property access reads.
            const key = node.argument.kind === 'literal' ? node.argument.value : null;
            const isNamed = typeof key === 'string' && (this.#fieldTypeOf(receiverType, key) !== null || this.#moduleRegistry.getMembers(key).some(declaration => declaration.kind === 'property' && LanguageResolver.#matchesReceiver(declaration, receiverType, new Map())));
            const computed = isNamed ? DefinitionWriter.write({ kind: 'member', target: node.target, name: node.argument, ...(node.optional === true ? { optional: true } : {}) }, this.#namespaceNames) : null;

            this.#fail(`${receiverType.toNonNullable()} has no unnamed indexer${computed === null ? '' : `: write '${computed}' for a property read by a computed name`}`, pointer);
        }

        // The vocabulary declares one unnamed indexer for any receiver, so only a type holding never fits more than one.
        if (matching.length > 1) {
            this.#fail(`Unnamed indexers are declared for ${matching.flatMap(declaration => [declaration.target].flat()).join(' and ')}, and ${receiverType.toNonNullable()} fits more than one, so which applies is ambiguous`, pointer);
        }

        return this.#resolveMemberOf({ ...node, name: matching[0].name }, pointer, scope, receiverType);
    }

    /**
     * Resolves a computed property access: the names its expression can give, which preparation determines, each a property of the receiver, their types of one type as a conditional's branches are.
     * The resolution keeps each name's, so evaluation reads the one the name selects; on a receiver of unknown type, whether each is a property and whether their types agree are checked once its type is known.
     */
    #resolveComputedPropertyAccess(node, pointer, scope, receiverType) {
        const namePointer = `${pointer}/name`;

        // A number names no property, and is the key an unnamed indexer takes.
        if (node.name.kind === 'literal' && typeof node.name.value === 'number') {
            this.#fail(`A computed property access reads a property by its name, a string, and a number is an indexer's key: write '${DefinitionWriter.write({ kind: 'indexer', target: node.target, argument: node.name, ...(node.optional === true ? { optional: true } : {}) }, this.#namespaceNames)}'`, namePointer);
        }
        const name = this.#resolveNode(node.name, namePointer, scope);
        const possible = name.kind === 'value' ? this.#possibleNamesOf(node.name, scope) : null;

        if (possible === null || possible.canBeOther) {
            this.#fail(`A computed property access reads a name determined when the expression is resolved, which a string literal, null, a script parameter, a local or a conditional binding holding one, or a conditional, a '??', an 'and' or an 'or' of them gives, and '${DefinitionWriter.write(node.name, this.#namespaceNames)}' is none of them`, namePointer);
        }

        if (possible.canBeFalse) {
            this.#fail(`A computed property access reads a string, and '${DefinitionWriter.write(node.name, this.#namespaceNames)}' can be false`, namePointer);
        }

        if (possible.canBeNull || possible.names.size === 0) {
            this.#fail(`A computed property access reads a string, and '${DefinitionWriter.write(node.name, this.#namespaceNames)}' can be null`, namePointer);
        }

        const candidates = new Map();
        const types = [];

        for (const candidate of possible.names) {
            const access = { kind: 'member', target: node.target, name: candidate, ...(node.optional === true ? { optional: true } : {}) };

            types.push(this.#resolveMemberOf(access, pointer, scope, receiverType).type);
            candidates.set(candidate, this.#resolutions.get(pointer));
        }

        let type = types.reduce((merged, candidateType) => (merged === null ? null : Type.merge(merged, candidateType)), Type.never);

        if (type === null) {
            if (!LanguageResolver.#isOfUnknownType(receiverType)) {
                this.#fail(`The properties '${DefinitionWriter.write(node.name, this.#namespaceNames)}' can name are of one type, and these are ${types.join(', ')}`, namePointer);
            }

            type = Type.null;
        }

        this.#resolutions.set(pointer, { kind: 'computedPropertyAccess', candidates });

        return { type, kind: 'value', isFixed: false };
    }

    /**
     * The values a computed property access's expression can give, determined through these forms alone: a string literal, null, a bound parameter, a local whose value is one of them, a conditional binding's name, truthy, whose value is,
     * and a conditional, a `??`, an `and` and an `or` of them, each by the rules that evaluate it: a conditional gives its branches', a `??` its value's and, where its value can be null, its fallback's, and an `and` or an `or` the part of each operand before its last that decides it, falsey for `and` and truthy for `or`, and its last's.
     * A condition or an operand whose value is fixed decides when the expression is resolved, so what evaluation would not reach gives nothing; the falsey part of an `and`'s operand that names nothing is told from its type.
     * The names are the strings it can give, and null, false and any other value are tracked beside them, so a `??` can remove null; any other expression gives no values that can be determined, and answers null.
     * @returns {{ names: Set<string>, canBeNull: boolean, canBeFalse: boolean, canBeOther: boolean } | null}
     */
    #possibleNamesOf(node, scope) {
        switch (node.kind) {
            case 'literal':
                return LanguageResolver.#possibleOf(node.value);
            case 'parameter':
                return LanguageResolver.#possibleOf(this.#bindings.get(node.name));
            case 'local': {
                const local = scope.locals.get(node.name);
                const possible = local === undefined ? null : this.#possibleNamesOf(local.value, local.scope);

                // A conditional binding's name is used where its value is truthy.
                return possible !== null && local.binding !== undefined ? LanguageResolver.#partOfPossible(possible, true) : possible;
            }
            case 'conditional': {
                const tested = this.#decidingResults.get(node.binding === undefined ? node.condition : node.binding.value);
                const consequentScope = node.binding === undefined ? scope : LanguageResolver.#consequentScopeOf(node, scope, null);
                const branches = [[node.consequent, consequentScope], [node.alternative, scope]];
                const reached = tested?.isFixed ? [branches[LanguageResolver.#isTruthy(tested.value) ? 0 : 1]] : branches;
                const sides = reached.map(([branch, branchScope]) => this.#possibleNamesOf(branch, branchScope));

                return sides.includes(null) ? null : sides.reduce(LanguageResolver.#unionOfPossible);
            }
            case 'coalescing': {
                const value = this.#possibleNamesOf(node.value, scope);

                if (value === null || !value.canBeNull) {
                    return value;
                }

                const fallback = this.#possibleNamesOf(node.fallback, scope);

                return fallback === null ? null : LanguageResolver.#unionOfPossible({ ...value, canBeNull: false }, fallback);
            }
            case 'and':
            case 'or': {
                const decidesWhenTruthy = node.kind === 'or';
                const last = node.operands.length - 1;
                let possible = LanguageResolver.#possibleOf(undefined);

                for (let index = 0; index < last; index++) {
                    const operand = node.operands[index];
                    const result = this.#decidingResults.get(operand);

                    // A fixed operand decides, giving its value, or passes evaluation on, giving nothing.
                    if (result?.isFixed) {
                        if (LanguageResolver.#isTruthy(result.value) === decidesWhenTruthy) {
                            return LanguageResolver.#unionOfPossible(possible, LanguageResolver.#possibleOf(result.value));
                        }

                        continue;
                    }

                    const operandPossible = this.#possibleNamesOf(operand, scope);

                    if (operandPossible !== null) {
                        possible = LanguageResolver.#unionOfPossible(possible, LanguageResolver.#partOfPossible(operandPossible, decidesWhenTruthy));
                    } else if (!decidesWhenTruthy && result !== undefined) {
                        possible = LanguageResolver.#unionOfPossible(possible, LanguageResolver.#falseyPossibleOf(result.type));
                    } else {
                        return null;
                    }
                }

                const lastPossible = this.#possibleNamesOf(node.operands[last], scope);

                return lastPossible === null ? null : LanguageResolver.#unionOfPossible(possible, lastPossible);
            }
            default:
                return null;
        }
    }

    /** The values a value gives: a string, its name, null, false, or any other value; undefined gives none. */
    static #possibleOf(value) {
        return {
            names: typeof value === 'string' ? new Set([value]) : new Set(),
            canBeNull: value === null,
            canBeFalse: value === false,
            canBeOther: value !== undefined && value !== null && value !== false && typeof value !== 'string',
        };
    }

    /** The values two sets of them give together. */
    static #unionOfPossible(first, second) {
        return {
            names: new Set([...first.names, ...second.names]),
            canBeNull: first.canBeNull || second.canBeNull,
            canBeFalse: first.canBeFalse || second.canBeFalse,
            canBeOther: first.canBeOther || second.canBeOther,
        };
    }

    /** The truthy part of the values, its names and any other value, or the falsey part, null and false. */
    static #partOfPossible(possible, isTruthy) {
        return isTruthy
            ? { names: possible.names, canBeNull: false, canBeFalse: false, canBeOther: possible.canBeOther }
            : { names: new Set(), canBeNull: possible.canBeNull, canBeFalse: possible.canBeFalse, canBeOther: false };
    }

    /** The falsey values a value of the type can give, which no name is: false for a Boolean and null where it can be null. */
    static #falseyPossibleOf(type) {
        const isBoolean = type.kind === 'named' && type.name === 'boolean';

        return { names: new Set(), canBeNull: type.isNullable, canBeFalse: isBoolean, canBeOther: false };
    }

    /** Resolves the member the node names on a receiver of the type, which its receiver's null policy has already been applied to. */
    #resolveMemberOf(node, pointer, scope, receiverType) {
        if (LanguageResolver.#isOfUnknownType(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiverType);
        }

        if (receiverType.kind === 'root') {
            return this.#resolveObjectRootField(node, pointer, receiverType);
        }

        const field = this.#fieldTypeOf(receiverType, node.name);

        if (field !== null) {
            if (node.kind !== 'member') {
                this.#fail(`'${node.name}' is a field of ${receiverType.toNonNullable()} and takes no argument: write '${DefinitionWriter.write(LanguageResolver.#accessOf(node), this.#namespaceNames)}'`, pointer);
            }

            this.#resolutions.set(pointer, { kind: 'field', name: node.name, receiverType });

            return { type: receiverType.isNullable ? field.toNullable() : field, kind: 'value', isFixed: false };
        }

        const candidates = this.#moduleRegistry.getMembers(node.name);

        if (candidates.length === 0) {
            this.#fail(`'${node.name}' is no member of the vocabulary${this.#joinedNameHintOf(node, receiverType)}`, pointer);
        }

        const matching = candidates.filter(candidate => LanguageResolver.#matchesReceiver(candidate, receiverType, new Map()));

        if (matching.length === 0) {
            this.#fail(`'${node.name}' is not available on ${receiverType.toNonNullable()}; it is available on ${candidates.flatMap(candidate => [candidate.target].flat()).join(', ')}`, pointer);
        }

        // The vocabulary declares a name once for any receiver, so only a type holding never fits more than one declaration.
        if (matching.length > 1) {
            this.#fail(`'${node.name}' is declared for ${matching.flatMap(candidate => [candidate.target].flat()).join(' and ')}, and ${receiverType.toNonNullable()} fits more than one, so which applies is ambiguous`, pointer);
        }

        const [declaration] = matching;

        this.#checkForm(declaration, node, pointer);

        const { result, resolution } = this.#resolveInvocation(declaration, node, pointer, scope, receiverType, receiverType.isNullable, { name: LanguageResolver.#qualifiedNameOf(declaration, receiverType) });

        this.#resolutions.set(pointer, resolution);

        return result;
    }

    /**
     * Resolves an invocation of the declaration: the arguments its node gives it, those after its receiver where the node's first argument is that, its type parameters bound by its receiver's type and the type a fixed argument selects,
     * and answers its result, nullable where its receiver or an argument whose parameter propagates null can be null, with the resolution that records it, which a call through a function reference keeps beside its own.
     */
    #resolveInvocation(declaration, node, pointer, scope, receiverType, isReceiverNullable, { offset = 0, qualified = false, name }) {
        const typeArguments = new Map();

        if (receiverType !== null) {
            LanguageResolver.#matchesReceiver(declaration, receiverType, typeArguments);
        }

        const resolved = this.#resolveArguments(declaration, node, pointer, scope, receiverType, typeArguments, offset);
        const resultTypeArguments = new Map(typeArguments);

        if (resolved.selected !== undefined) {
            resultTypeArguments.set('@selected', resolved.selected.type);
        }

        // A host call that supplies nothing has no value to type, so it is typed as a never, which no value has.
        const declared = declaration.result === undefined ? Type.never : Type.parse(declaration.result).resolveTypeParameters(resultTypeArguments);
        const resolution = { kind: 'member', declaration, receiverType, type: declared, arguments: resolved.arguments, selected: resolved.selected, buildsObjectRoot: resolved.buildsObjectRoot, qualified };

        this.#usedDeclarations.push({ declaration, name, pointer });

        const type = isReceiverNullable || resolved.isNullable ? declared.toNullable() : declared;

        return { result: { type, kind: LanguageResolver.#requestKindOf(declaration), isFixed: false, ...(declaration.result === undefined ? { suppliesNothing: true } : {}) }, resolution };
    }

    /**
     * Resolves a member read or a call through a module's namespace: a module member, read or called; a function reference, one of the module's functions read without a call, which the callback contract it is passed to selects
     * where one is given; or a qualified form, a member the module declares on a type, called with its receiver first and its own arguments after it.
     */
    #resolveThroughNamespace(node, pointer, scope, contract = null) {
        const moduleName = node.target.name;
        const module = this.#namespaceNames.has(moduleName) ? this.#moduleRegistry.getModule(moduleName) : undefined;
        const written = `${moduleName}.${node.name}`;

        if (module === undefined) {
            this.#fail(`No module named '${moduleName}' is registered, so '${written}' reads through no namespace`, `${pointer}/target`);
        }

        const named = module.members.filter(declaration => declaration.name === node.name);
        const declarations = named.filter(declaration => declaration.syntax !== 'indexer');

        if (declarations.length === 0) {
            this.#fail(named.length > 0 ? `'${node.name}' is an indexer, which no namespace qualifies: write its receiver and ':${node.name}[…]'` : `The module '${moduleName}' declares no member '${node.name}'`, pointer);
        }

        const moduleMember = declarations.find(declaration => declaration.target === undefined);

        if (moduleMember !== undefined) {
            return this.#resolveModuleMember(node, pointer, scope, moduleMember, written, contract);
        }

        return node.kind === 'member' ? this.#resolveReference(node, pointer, declarations, contract) : this.#resolveQualified(node, pointer, scope, declarations, written);
    }

    /** Resolves a module member, which has no receiver: a property read through its namespace, a function called through it, or a function read without a call, a function reference. */
    #resolveModuleMember(node, pointer, scope, declaration, written, contract) {
        if (declaration.kind === 'property') {
            if (node.kind === 'call') {
                this.#fail(`'${written}' is a property, read as ${written}, and takes no argument`, pointer);
            }

            const type = Type.parse(declaration.result);

            this.#usedDeclarations.push({ declaration, name: written, pointer });
            this.#resolutions.set(pointer, { kind: 'member', declaration, receiverType: null, type, arguments: [], qualified: false });

            return { type, kind: 'value', isFixed: false };
        }

        if (node.kind === 'member') {
            return this.#resolveReference(node, pointer, [declaration], contract);
        }

        const { result, resolution } = this.#resolveInvocation(declaration, node, pointer, scope, null, false, { name: written });

        this.#resolutions.set(pointer, resolution);

        return result;
    }

    /**
     * Resolves a qualified form: the module's member on a type, called with its receiver as its first argument, which is evaluated first and whose null answers null without the member's own arguments being evaluated, and its own arguments after it.
     * The receiver's type selects the module's declaration of the name; a receiver of unknown type selects none, and is checked as any such receiver is.
     */
    #resolveQualified(node, pointer, scope, declarations, written) {
        if (node.arguments.length === 0) {
            this.#fail(`'${written}' is the qualified form of a member of a receiver, which takes the receiver as its first argument, as ${written}(receiver)`, pointer);
        }

        const receiver = this.#resolveReceiverArgument(node, pointer, scope, `'${written}'`);
        const receiverType = receiver.type.toNonNullable();
        const isReceiverNullable = receiver.type.isNullable || receiver.type.kind === 'null';

        if (LanguageResolver.#isOfUnknownType(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiver.type.kind === 'null' ? Type.null : receiverType, declarations, 1);
        }

        const matching = declarations.filter(declaration => LanguageResolver.#matchesReceiver(declaration, receiverType, new Map()));

        if (matching.length === 0) {
            this.#fail(`'${written}' takes a receiver of ${declarations.flatMap(declaration => [declaration.target].flat()).join(', ')}, and is given ${receiverType}`, `${pointer}/arguments/0`);
        }

        // A module declares a name once for overlapping receivers, so only a type holding never fits more than one declaration.
        if (matching.length > 1) {
            this.#fail(`'${written}' is declared for ${matching.flatMap(declaration => [declaration.target].flat()).join(' and ')}, and ${receiverType} fits more than one, so which applies is ambiguous`, pointer);
        }

        const [declaration] = matching;
        const { result, resolution } = this.#resolveInvocation(declaration, node, pointer, scope, receiverType, isReceiverNullable, { offset: 1, qualified: true, name: LanguageResolver.#qualifiedNameOf(declaration, receiverType) });

        this.#resolutions.set(pointer, resolution);

        return result;
    }

    /** Resolves the receiver a qualified call or a call of a function reference gives as its first argument, a value of any type, which the call evaluates before its own arguments. */
    #resolveReceiverArgument(node, pointer, scope, written) {
        const receiverPointer = `${pointer}/arguments/0`;
        const receiver = this.#resolveNode(node.arguments[0], receiverPointer, scope);

        if (receiver.kind !== 'value') {
            this.#fail(`The receiver ${written} is given is ${LanguageResolver.#descriptionOf(receiver.kind)}, and a receiver is a value`, receiverPointer);
        }

        if (LanguageResolver.#heldReferenceOf(receiver.type) === 'function') {
            this.#fail(`The receiver ${written} is given is a function, which has no members`, receiverPointer);
        }

        return receiver;
    }

    /**
     * Resolves a function reference: one of the module's functions the evaluator invokes, read without a call, a function value that takes its receiver first, where it has one, and its own arguments after it.
     * Passed to a function parameter, it names the declaration whose receiver and parameters take the arguments the callback contract declares; anywhere else, the module's one function of its name. Creating it reads nothing and invokes nothing.
     */
    #resolveReference(node, pointer, declarations, contract) {
        const written = `${node.target.name}.${node.name}`;
        const functions = declarations.filter(declaration => declaration.kind === 'function' && !LexicaModule.isHostCall(declaration));

        if (functions.length === 0) {
            const [declaration] = declarations;
            const message = declaration.kind === 'property'
                ? `'${written}' is a property, read with its receiver as ${written}(receiver), and only a function has a reference`
                : `'${written}' is a host call, which its host invokes, so it has no reference`;

            this.#fail(message, pointer);
        }

        const selected = contract === null ? functions : functions.filter(declaration => this.#takesContract(declaration, contract));
        const alternatives = `write an arrow function, whose receiver's type selects one, as x => x.${node.name}(), or an implicit body, as it.${node.name}()`;

        if (selected.length === 0) {
            this.#fail(`The function given as '${contract.parameter}' of '${contract.member}' is called with ${contract.parameterTypes.join(', ')} and answers ${contract.resultType ?? 'any value'}, and '${written}' names no function that takes those or answers that: it names ${functions.map(declaration => this.#signatureOf(declaration)).join(', ')}`, pointer);
        }

        if (selected.length > 1) {
            this.#fail(`'${written}' names ${selected.length} functions${contract === null ? '' : ` that the contract of '${contract.member}' allows`}, so which it references is ambiguous; ${alternatives}`, pointer);
        }

        const [declaration] = selected;

        this.#usedDeclarations.push({ declaration, name: written, pointer });
        this.#resolutions.set(pointer, { kind: 'reference', declaration });

        return { type: Type.createFunctionType([this.#referenceTargetOf(declaration)]), kind: 'value', isFixed: false };
    }

    /** The one function a function value is for a reference to the declaration, so references to one declaration are one function, as two reads of one local function's name are. @type {WeakMap<object, { reference: object }>} */
    #referenceTargets = new WeakMap();

    #referenceTargetOf(declaration) {
        let target = this.#referenceTargets.get(declaration);

        if (target === undefined) {
            target = Object.freeze({ reference: declaration });
            this.#referenceTargets.set(declaration, target);
        }

        return target;
    }

    /** How a message names a reference's declaration: its module's name and its own, as its reference is written. */
    #referenceNameOf(declaration) {
        return `${this.#moduleRegistry.getOwner(declaration)}.${declaration.name}`;
    }

    /** How a message names a function's signature: its receiver's types where it has one, the types of its parameters, and its result. */
    #signatureOf(declaration) {
        const parameters = [...(declaration.target === undefined ? [] : [[declaration.target].flat().join(' | ')]), ...declaration.parameters.map(parameter => parameter.type)];

        return `(${parameters.join(', ')}) => ${declaration.result}`;
    }

    /**
     * Whether the declaration takes the arguments the callback contract passes and answers a result it takes: its receiver the first, where it has one, of the type the contract gives it, and then one positional value for each of its parameters,
     * those it requires at least. A type of an unknown receiver, a never or a type parameter no receiver bound, fits any.
     */
    #takesContract(declaration, contract) {
        const { parameterTypes, resultType } = contract;
        const hasReceiver = declaration.target !== undefined;
        const fitsAny = type => type.kind === 'never' || type.kind === 'typeParameter';
        const typeArguments = new Map();

        if (hasReceiver) {
            const [receiverType] = parameterTypes;

            if (receiverType === undefined || receiverType.isNullable || (!fitsAny(receiverType) && !LanguageResolver.#matchesReceiver(declaration, receiverType, typeArguments))) {
                return false;
            }
        }

        const own = hasReceiver ? parameterTypes.slice(1) : parameterTypes;
        const { parameters } = declaration;

        if (parameters.some(parameter => parameter.kind !== 'value') || (parameters.length > 0 && declaration.arguments === 'options')) {
            return false;
        }

        if (own.length < parameters.filter(parameter => parameter.required).length || own.length > parameters.length) {
            return false;
        }

        const fitsParameters = own.every((type, index) => fitsAny(type) || type.isAssignableTo(Type.parse(parameters[index].type).resolveTypeParameters(typeArguments)));
        const declared = Type.parse(declaration.result).resolveTypeParameters(typeArguments);

        return fitsParameters && (resultType === null || fitsAny(resultType) || declared.isAssignableTo(resultType));
    }

    /**
     * Resolves a name applied to a receiver of unknown type, which chooses no declaration among the candidates, those of its name or, for an unnamed indexer, every unnamed indexer. A property is accepted whatever its name, since a bound object's fields are named by its data; a call or an indexer must be a member's, written in the form and given the arguments one of its declarations takes. The declarations that take it agree on who invokes it, the evaluator or the host.
     * Its type is the result type they share, made nullable, or left to the optional chain an optional access of null ends, and null where they share none or the name is no member's. Nothing applied to such a receiver is evaluated, so its arguments leave no resolution behind.
     */
    #resolveOnUnknownType(node, pointer, scope, receiverType, candidates = this.#moduleRegistry.getMembers(node.name), offset = 0) {
        const isAccess = node.kind === 'member';
        const fields = isAccess ? this.#moduleRegistry.getFieldTypes(node.name) : [];
        // A qualified form calls a property and a function alike, its receiver its first argument.
        const formOf = candidate => (offset > 0 ? 'function-call' : candidate.kind === 'property' ? 'access' : candidate.syntax);
        const written = candidates.filter(candidate => FORM_NODE_KINDS[formOf(candidate)] === node.kind);

        if (!isAccess && candidates.length === 0) {
            this.#fail(this.#moduleRegistry.getFieldTypes(node.name).length > 0 ? `'${node.name}' is a field and takes no argument: write '${DefinitionWriter.write(LanguageResolver.#accessOf(node), this.#namespaceNames)}'` : `'${node.name}' is no member of the vocabulary`, pointer);
        }

        if (!isAccess && written.length === 0) {
            this.#checkForm(candidates[0], node, pointer);
        }

        const fitting = [];
        let failure = null;

        for (const declaration of written) {
            const attempt = this.#tryResolveArguments(declaration, node, pointer, scope, receiverType, offset);

            if (attempt.error === undefined) {
                fitting.push({ declaration, resolved: attempt.resolved });
            } else {
                failure ??= attempt.error;
            }
        }

        if (!isAccess && fitting.length === 0) {
            throw failure;
        }

        // An access may name a field of data, which is a value.
        const kinds = new Set([...fitting.map(({ declaration }) => LanguageResolver.#requestKindOf(declaration)), ...(isAccess ? ['value'] : [])]);

        if (kinds.size > 1) {
            this.#fail(`'${node.name}' follows a value whose type is unknown, and its declarations disagree on who invokes it, the evaluator or the host, so whether the script ends in a host call is ambiguous`, pointer);
        }

        const resultTypes = [
            ...fitting.filter(({ declaration }) => declaration.result !== undefined).map(({ declaration, resolved }) => Type.parse(declaration.result).resolveTypeParameters(new Map(resolved.selected === undefined ? [] : [['@selected', resolved.selected.type]]))),
            ...fields.map(text => Type.parse(text)),
        ];
        const shared = resultTypes.reduce((merged, type) => (merged === null ? null : Type.merge(merged, type)), Type.never);
        // A member of a never is never evaluated, since no value has that type, so it answers what its declarations share as they declare it, and where none says what it would answer, nothing yet: a never, which fits wherever a value of any type is required.
        const isNever = receiverType.kind === 'never';
        // An optional access of null ends its chain, which is nullable for it, so its own type is the one its declarations share.
        const isShortCircuited = node.optional === true && receiverType.kind === 'null';
        const unknown = isNever ? Type.never : Type.null;
        const type = shared === null || shared.kind === 'never' || LanguageResolver.#holdsTypeParameter(shared) ? unknown : isNever || isShortCircuited ? shared : shared.toNullable();

        this.#resolutions.set(pointer, { kind: 'member', declaration: null, receiverType, type, arguments: [], qualified: offset > 0 });

        // Host calls that agree on their host supplying nothing take no result projection, whichever of them a receiver's type will choose.
        const suppliesNothing = fitting.length > 0 && fitting.every(({ declaration }) => declaration.result === undefined);

        return { type, kind: [...kinds][0], isFixed: false, ...(suppliesNothing ? { suppliesNothing: true } : {}) };
    }

    /** Resolves the arguments the declaration would take, leaving no resolution and no use behind, and answers them or the failure that refuses them. */
    #tryResolveArguments(declaration, node, pointer, scope, receiverType, offset = 0) {
        const resolutions = new Map(this.#resolutions);
        const usedCount = this.#usedDeclarations.length;

        try {
            return { resolved: this.#resolveArguments(declaration, node, pointer, scope, receiverType, new Map(), offset) };
        } catch (error) {
            if (!(error instanceof LexicaError)) {
                throw error;
            }

            return { error };
        } finally {
            this.#resolutions = resolutions;
            this.#usedDeclarations.length = usedCount;
        }
    }

    /** Refuses a member written in a form its declaration does not take, with the form it does: a property is accessed, and a function called or named as its declaration says. */
    #checkForm(declaration, node, pointer) {
        const form = declaration.kind === 'property' ? 'access' : declaration.syntax;

        if (FORM_NODE_KINDS[form] === node.kind) {
            return;
        }

        const described = { access: 'is a property', 'function-call': 'uses call syntax', indexer: 'is an indexer' }[form];

        // An indexer takes one key in brackets, which a node written another way may not give.
        if (form === 'indexer' && node.arguments?.length !== 1) {
            this.#fail(`'${node.name}' ${described}: write '${DefinitionWriter.write(node.target, this.#namespaceNames)}${node.optional === true ? '?.' : '.'}${node.name}[…]'`, pointer);
        }

        this.#fail(`'${node.name}' ${described}: write '${DefinitionWriter.write(LanguageResolver.#writtenAs(node, form), this.#namespaceNames)}'`, pointer);
    }

    /** The node written in the form: an access of its name, a call of its arguments, an indexer's one, or an indexer of its key, a call's one argument. */
    static #writtenAs(node, form) {
        const { target, name } = node;
        const optional = node.optional === true ? { optional: true } : {};

        switch (form) {
            case 'access':
                return LanguageResolver.#accessOf(node);
            case 'function-call':
                return { kind: 'call', target, name, arguments: node.kind === 'indexer' ? [node.argument] : [], ...optional };
            default:
                return { kind: 'indexer', target: { kind: 'member', target, name, ...optional }, argument: node.arguments[0] };
        }
    }

    /**
     * The arguments a call or an indexer is given, as the value of each parameter they supply: in order, the parameters of a positional declaration, an indexer's key its one,
     * or the fields of the one options object an options declaration takes, each by its name; those of a qualified call follow the receiver its first argument is, the offset its own arguments begin at.
     */
    #suppliedArguments(declaration, node, pointer, offset = 0) {
        const { parameters } = declaration;
        const supplied = new Map();
        const given = node.kind === 'indexer'
            ? [{ node: node.argument, pointer: `${pointer}/argument` }]
            : (node.arguments ?? []).slice(offset).map((argument, index) => ({ node: argument, pointer: `${pointer}/arguments/${index + offset}` }));

        if (given.length === 0) {
            return supplied;
        }

        if (parameters.length === 0) {
            this.#fail(`'${declaration.name}' takes no argument`, given[0].pointer);
        }

        if (declaration.arguments !== 'options') {
            if (given.length > parameters.length) {
                const count = parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`;

                this.#fail(`'${declaration.name}' takes ${parameters.some(parameter => !parameter.required) ? 'at most ' : ''}${count}, and is given ${given.length}`, given[parameters.length].pointer);
            }

            given.forEach((argument, index) => supplied.set(parameters[index].name, argument));

            return supplied;
        }

        if (given.length > 1) {
            this.#fail(`'${declaration.name}' takes its arguments as the fields of one object, as { ${parameters[0].name} = … }`, given[1].pointer);
        }

        const [options] = given;

        if (options.node.kind !== 'object' || options.node.target !== undefined) {
            this.#fail(`'${declaration.name}' takes its arguments as the fields of an object, as { ${parameters[0].name} = … }`, options.pointer);
        }

        options.node.fields.forEach((field, index) => {
            const parameter = parameters.find(candidate => candidate.name === field.name);

            if (parameter === undefined) {
                this.#fail(`'${declaration.name}' has no parameter '${field.name}'; it takes ${parameters.map(candidate => candidate.name).join(', ')}`, `${options.pointer}/fields/${index}`);
            }

            supplied.set(parameter.name, { node: field.value, pointer: `${options.pointer}/fields/${index}/value` });
        });

        return supplied;
    }

    #resolveArguments(declaration, node, pointer, scope, receiverType, typeArguments, offset = 0) {
        const parameters = declaration.parameters;
        const supplied = this.#suppliedArguments(declaration, node, pointer, offset);

        const resolved = [];
        let isNullable = false;
        let selected;

        // An options object is an object expression: one no other encloses builds the outermost object, whose fields are its options, and any other builds within the one enclosing it; each option is in scope after its value, as a field is.
        const optionsObject = declaration.arguments === 'options' && supplied.size > 0 ? (node.kind === 'indexer' ? node.argument : node.arguments[offset]) : null;
        const objectExpression = optionsObject !== null && scope.objectRoot === null ? optionsObject : null;
        let argumentScope = scope;

        if (objectExpression !== null) {
            this.#objectRootFields.set(objectExpression, new Map());
            argumentScope = { ...scope, objectRoot: { objectExpression, fieldTypes: new Map() } };
        }

        // The arguments are resolved in the order they are written, an options object's fields among them, and the parameters left to their defaults after them.
        const ordered = [...[...supplied.keys()].map(name => parameters.find(parameter => parameter.name === name)), ...parameters.filter(parameter => !supplied.has(parameter.name))];

        for (const parameter of ordered) {
            const given = supplied.get(parameter.name);

            if (given === undefined) {
                if (parameter.required) {
                    this.#fail(`'${declaration.name}' requires the argument '${parameter.name}'`, pointer);
                }

                resolved.push({ parameter, isDefault: true, value: parameter.default });
                continue;
            }

            const valuePointer = given.pointer;
            const expected = Type.parse(parameter.type).resolveTypeParameters(typeArguments);
            let result;
            let callback;

            if (parameter.kind === 'expression' || parameter.kind === 'predicate') {
                const isOfUnknownType = receiverType === null || LanguageResolver.#isOfUnknownType(receiverType);

                if (receiverType === null) {
                    this.#fail(`'${declaration.name}' evaluates its expression against the items of the list it follows, and a module member follows none`, valuePointer);
                }

                if (receiverType.kind !== 'list' && !isOfUnknownType) {
                    this.#fail(`'${declaration.name}' evaluates its expression against the items of a list, and ${receiverType.toNonNullable()} has none`, valuePointer);
                }

                const itemType = isOfUnknownType ? Type.never : receiverType.itemType;

                ({ result, callback } = this.#resolveItemArgument(given.node, valuePointer, { ...argumentScope, facts: scope.facts }, parameter, declaration, itemType, expected));

                // An expression or a predicate option is evaluated by the member, and has no single value: a name or a field of it after its initializer refuses a read, hiding any enclosing name of its spelling.
                if (optionsObject !== null) {
                    argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { option: parameter.kind, result: null }) };
                }

                if (objectExpression !== null) {
                    this.#objectRootFields.get(objectExpression).set(parameter.name, { option: parameter.kind });
                }
            } else if (parameter.kind === 'function') {
                ({ result, callback } = this.#resolveFunctionArgument(given.node, valuePointer, argumentScope, parameter, declaration, receiverType, typeArguments));

                // An implicit body option is called by the member against the argument it supplies, and has no single value, as an expression option has none.
                if (callback.implicit === true) {
                    if (optionsObject !== null) {
                        argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { option: 'implicitBody', result: null }) };
                    }

                    if (objectExpression !== null) {
                        this.#objectRootFields.get(objectExpression).set(parameter.name, { option: 'implicitBody' });
                    }
                }
            } else {
                result = this.#resolveNode(given.node, valuePointer, argumentScope);
                this.#requireValueArgument(result, parameter, declaration, valuePointer);

                if (!this.#checkValue(result, expected, parameter, declaration, valuePointer)) {
                    isNullable = true;
                }
            }

            if (parameter.kind !== 'expression' && parameter.kind !== 'predicate' && callback?.implicit !== true) {

                // A value or a function option is in scope after its value, through the options after it, read as it was evaluated; one of the outermost object is completed, and read through root after it as the value it was given, of that value's type.
                if (optionsObject !== null) {
                    argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { result, value: given.node, scope: argumentScope }) };
                }

                if (objectExpression !== null) {
                    this.#objectRootFields.get(objectExpression).set(parameter.name, { value: given.node });
                    argumentScope = { ...argumentScope, objectRoot: { objectExpression, fieldTypes: new Map(argumentScope.objectRoot.fieldTypes).set(parameter.name, result.type) } };
                }
            }

            if (parameter.fixed === true) {
                const selection = this.#select(parameter, result, declaration, valuePointer);

                selected = selection.selected ?? selected;
            }

            resolved.push({ parameter, isDefault: false, pointer: valuePointer, node: given.node, value: parameter.fixed === true ? result.value : undefined, ...(callback === undefined ? {} : { callback }) });
        }

        return { arguments: resolved, isNullable, selected, buildsObjectRoot: objectExpression !== null };
    }

    /** Checks a value argument against its parameter, answering false where a null makes the call answer null. */
    #checkValue(result, expected, parameter, declaration, pointer) {
        const actual = result.type;
        const wrong = () => this.#fail(`The argument '${parameter.name}' of '${declaration.name}' expects ${expected} and finds ${actual}`, pointer);

        if (LanguageResolver.#heldReferenceOf(actual) === 'function') {
            this.#fail(`The argument '${parameter.name}' of '${declaration.name}' takes a value, and a function is none: a function is passed to a local function, or to a parameter its member declares to take one`, pointer);
        }

        if (actual.kind === 'null') {
            if (expected.isNullable) {
                return true;
            }

            if (parameter.nulls === 'propagate') {
                return false;
            }

            wrong();
        }

        if (parameter.nulls === 'propagate') {
            if (!actual.toNonNullable().isAssignableTo(expected.toNonNullable())) {
                wrong();
            }

            return !actual.isNullable;
        }

        if (!actual.isAssignableTo(expected)) {
            wrong();
        }

        return true;
    }

    #requireValueArgument(result, parameter, declaration, pointer) {
        if (result.kind !== 'value') {
            this.#fail(`The argument '${parameter.name}' of '${declaration.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and an argument is a value`, pointer);
        }
    }

    /** Resolves the type a fixed argument selects through its parameter's type selector, which must be known before anything is evaluated. */
    #select(parameter, result, declaration, pointer) {
        if (!result.isFixed || typeof result.value !== 'string') {
            this.#fail(`The argument '${parameter.name}' of '${declaration.name}' selects from the vocabulary, so it is a string the expression's resolution settles without evaluating a member, a literal, a script parameter, or a local, a conditional binding, a conditional, a '??', an 'and' or an 'or' that settles to one, never null`, pointer);
        }

        const name = result.value;
        const selectable = this.#moduleRegistry.getSelectableType(parameter.selector, name);

        if (selectable === undefined) {
            this.#fail(`The type selector '${parameter.selector}' maps no type to the key '${name}'`, pointer);
        }

        return { selected: { name, type: Type.parse(selectable.type) } };
    }

    #resolveObject(node, pointer, scope) {
        const target = node.target === undefined ? null : this.#resolveNode(node.target, `${pointer}/target`, scope);

        if (target?.suppliesNothing === true) {
            this.#fail('The host call this object expression follows declares no result, since its host supplies no values, so it takes no result projection', pointer);
        }

        // An object expression that follows a host call is its result projection, and the script still ends in the call.
        const kind = target?.kind === 'hostCall' ? 'hostCall' : 'value';

        let contextType = scope.contextType;
        let contextKey = scope.contextKey;

        if (target !== null) {
            contextKey = {};

            const appliedType = target.type.kind === 'list' ? target.type.itemType : target.type;

            // An object expression following null, or each item of a list of nulls, is never applied, so its fields are resolved against no value.
            contextType = appliedType.kind === 'null' ? Type.never : appliedType.toNonNullable();
        }

        // An object expression no other encloses builds the outermost object, which the object root refers to; any other builds within that object. Its receiver was resolved outside it.
        const objectExpression = scope.objectRoot === null ? node : null;
        let objectRoot = objectExpression === null ? scope.objectRoot : { objectExpression, fieldTypes: new Map() };

        if (objectExpression !== null) {
            this.#objectRootFields.set(objectExpression, new Map());
        }

        // Each local is resolved where it is written, against the implicit parameter and the locals before it, and every field sees them all.
        let locals = scope.locals;
        // An object expression following no value keeps the implicit parameter around it, so an implicit body it stands in reads that body's own `it`.
        const scopeHere = () => ({ ...scope, contextType, contextKey, locals, objectRoot });

        node.locals?.forEach((local, index) => {
            const valuePointer = `${pointer}/locals/${index}/value`;

            if (local.value.kind === 'function') {
                locals = new Map(locals).set(local.name, LanguageResolver.#functionLocalOf(local.value, valuePointer, scopeHere()));

                return;
            }

            const result = this.#resolveNode(local.value, valuePointer, scopeHere());

            if (result.kind !== 'value') {
                this.#fail(`The local '${local.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a local is a value`, valuePointer);
            }

            locals = new Map(locals).set(local.name, { result, value: local.value, scope: scopeHere() });
        });

        const fieldTypes = new Map();

        node.fields.forEach((field, index) => {
            const fieldPointer = `${pointer}/fields/${index}`;
            const { name } = field;
            const result = this.#resolveNode(field.value, `${fieldPointer}/value`, scopeHere());

            if (result.kind !== 'value') {
                this.#fail(`The field '${name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a field is a value`, `${fieldPointer}/value`);
            }

            const heldReference = LanguageResolver.#heldReferenceOf(result.type);

            if (heldReference === 'root') {
                this.#fail(`The field '${name}' would hold root, the object being built, which no result holds; read its fields, as root.name`, `${fieldPointer}/value`);
            }

            if (heldReference === 'function') {
                this.#fail(`The field '${name}' would hold a function, which is used within the expression and never part of its result: call it, as name(…)`, `${fieldPointer}/value`);
            }

            if (!this.#isData(result.type)) {
                this.#fail(`The field '${name}' would hold ${result.type}, which is no data; read the facts it needs through an object expression`, `${fieldPointer}/value`);
            }

            fieldTypes.set(name, result.type);

            // A field is in scope after its value, through the fields after it, its value read as it was evaluated.
            locals = new Map(locals).set(name, { result, value: field.value, scope: scopeHere() });

            // A field of the outermost object is completed, and read through a reference to the root written after it, as the value its evaluation gave.
            if (objectExpression !== null) {
                this.#objectRootFields.get(objectExpression).set(name, { value: field.value });
                objectRoot = { objectExpression, fieldTypes: new Map(objectRoot.fieldTypes).set(name, result.type) };
            }
        });

        const objectType = Type.createObjectType(fieldTypes);
        const isNullable = target?.type.isNullable === true;

        // A list's null item projects to null at its position, so the objects of a list whose items can be null can be null too.
        if (target?.type.kind === 'list') {
            return { type: Type.createListType(target.type.itemType.isNullable ? objectType.toNullable() : objectType, isNullable), kind, isFixed: false };
        }

        return { type: isNullable ? objectType.toNullable() : objectType, kind, isFixed: false };
    }

    /** Resolves the object root, a reference to the outermost object: its type identifies the object expression that builds it and the fields completed where it is written, the fields it reads. */
    #resolveObjectRoot(pointer, scope) {
        if (scope.objectRoot === null) {
            this.#fail("'root' refers to the outermost object being built, and no object expression encloses it here", pointer);
        }

        return { type: Type.createRootType(scope.objectRoot.objectExpression, scope.objectRoot.fieldTypes), kind: 'value', isFixed: false };
    }

    /**
     * Resolves a field read through the object root: one of the fields completed where the reference was written, read as an object's is, with no argument; its resolution keeps the field's value, so what reads it
     * reuses the branches the field selected and compares it within its tolerance.
     */
    #resolveObjectRootField(node, pointer, receiverType) {
        if (node.kind !== 'member') {
            this.#fail(`'root' is read through its fields, as root.name or root.[name], and '${node.name ?? '[…]'}' ${node.kind === 'call' ? 'is called' : 'is an indexer'}`, pointer);
        }

        const option = this.#objectRootFields.get(receiverType.objectExpression).get(node.name)?.option;

        if (option !== undefined) {
            this.#fail(LanguageResolver.#unreadableOptionMessageOf(node.name, option), pointer);
        }

        const fieldType = receiverType.fieldTypes.get(node.name);

        if (fieldType === undefined) {
            const completed = [...receiverType.fieldTypes.keys()];

            this.#fail(`'${node.name}' is no field of root completed where the reference to it is written; ${completed.length === 0 ? 'none is completed there' : `those completed are ${completed.join(', ')}`}`, pointer);
        }

        this.#resolutions.set(pointer, { kind: 'objectRootField', name: node.name, value: this.#objectRootFields.get(receiverType.objectExpression).get(node.name).value });

        return { type: receiverType.isNullable ? fieldType.toNullable() : fieldType, kind: 'value', isFixed: false };
    }

    /** The refusal of a read of an expression, a predicate or an implicit body option, which the member evaluates and which has no value to read. */
    static #unreadableOptionMessageOf(name, kind) {
        const what = kind === 'predicate' ? 'a predicate' : kind === 'implicitBody' ? 'an implicit body' : 'an expression';

        return `Option '${name}' is ${what} evaluated by the member against the implicit parameter it supplies; it has no single value to read here`;
    }

    /** What the type holds that no result may, itself, as a list's item or as an object's field: the object root, or a function value; null for neither. */
    static #heldReferenceOf(type) {
        switch (type.kind) {
            case 'root':
            case 'function':
                return type.kind;
            case 'list':
                return LanguageResolver.#heldReferenceOf(type.itemType);
            case 'object':
                return [...type.fieldTypes.values()].reduce((held, fieldType) => held ?? LanguageResolver.#heldReferenceOf(fieldType), null);
            default:
                return null;
        }
    }

    /**
     * The callback contract a function parameter declares, its member's type parameters bound: the types of the arguments the member calls the function with, in order, and the type of the result it takes from it.
     * A type parameter of a receiver of unknown type, which nothing binds, is a never, which fits wherever a value of any type stands.
     */
    #contractOf(parameter, declaration, receiverType, typeArguments) {
        const isOfUnknownType = receiverType !== null && LanguageResolver.#isOfUnknownType(receiverType);
        const resolve = text => {
            const type = Type.parse(text).resolveTypeParameters(typeArguments);

            return isOfUnknownType && LanguageResolver.#holdsTypeParameter(type) ? Type.never : type;
        };

        return { member: declaration.name, parameter: parameter.name, parameterTypes: parameter.parameters.map(resolve), resultType: resolve(parameter.type) };
    }

    /**
     * Resolves the argument a function parameter is given, and the callback the member calls: a function reference, which the parameter's callback contract selects; for a contract of one argument, an implicit body, an argument
     * no arrow function is that reads an `it` of its own scope, which the argument the member calls it with stands for; or a function value, each function it may be resolved against the contract.
     * An argument's own scope is told by the implicit parameter it resolves against, so an `it` of a projection or of an expression, a predicate or a function argument within it, each of which has its own, makes it no body.
     */
    #resolveFunctionArgument(node, pointer, scope, parameter, declaration, receiverType, typeArguments) {
        const contract = this.#contractOf(parameter, declaration, receiverType, typeArguments);

        if (node.kind === 'member' && node.target.kind === 'namespace') {
            const result = this.#resolveThroughNamespace(node, pointer, scope, contract);

            return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
        }

        if (contract.parameterTypes.length === 1 && node.kind !== 'function') {
            const implicitBody = { key: {}, isRead: false };
            const result = this.#resolveNode(node, pointer, { ...scope, contextType: contract.parameterTypes[0], contextKey: implicitBody.key, implicitBody });

            this.#requireValueArgument(result, parameter, declaration, pointer);

            if (!implicitBody.isRead) {
                return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
            }

            if (!result.type.isAssignableTo(contract.resultType)) {
                this.#fail(`The implicit body given as '${parameter.name}' of '${declaration.name}' gives ${result.type}, and its contract takes ${contract.resultType}`, pointer);
            }

            return { result, callback: { implicit: true, parameterTypes: contract.parameterTypes, resultType: contract.resultType } };
        }

        const result = this.#resolveNode(node, pointer, scope);

        this.#requireValueArgument(result, parameter, declaration, pointer);

        return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
    }

    /**
     * Resolves the argument an expression or a predicate parameter is given, which is a function of each item, as a function parameter's of one argument is: a function the member calls with each item, an arrow function,
     * a function a name holds or a module's function by reference, resolved against the contract of the item's type and the expression's result, a predicate's any value; or any other argument, its body, evaluated against
     * each item, its `it`, which it reads or not, so a body reading no `it` gives each item the same value.
     */
    #resolveItemArgument(node, pointer, scope, parameter, declaration, itemType, expected) {
        // A function of the item is called with each item as it is, null among them where the list holds nulls, while a body reads each item as a value that is not.
        const contract = { member: declaration.name, parameter: parameter.name, parameterTypes: [itemType], resultType: parameter.kind === 'expression' ? expected : null };
        let result;

        if (node.kind === 'function') {
            result = this.#resolveNode(node, pointer, scope);
        } else if (node.kind === 'member' && node.target.kind === 'namespace') {
            result = this.#resolveThroughNamespace(node, pointer, scope, contract);
        } else {
            const body = { key: {}, isRead: false };

            result = this.#resolveNode(node, pointer, { ...scope, contextType: itemType.toNonNullable(), contextKey: body.key, implicitBody: body });

            if (result.type.kind === 'function' && body.isRead) {
                this.#fail(`The expression of '${declaration.name}' reads each item as 'it' and gives a function; a function of the item is written as the argument itself, as ${declaration.name}(x => …)`, pointer);
            }
        }

        this.#requireValueArgument(result, parameter, declaration, pointer);

        if (result.type.kind === 'function') {
            return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
        }

        if (!LanguageResolver.#fitsResult(result.type, contract.resultType)) {
            this.#fail(contract.resultType === null ? `The expression of '${declaration.name}' produces ${result.type}, a type no receiver gives` : `The expression of '${declaration.name}' must produce ${expected} and produces ${result.type}`, pointer);
        }

        return { result };
    }

    /** Whether a function's result of the type is one its callback contract takes: a value of the contract's result type, or, where the contract takes any value, as a predicate's does, one of a type a receiver gives. */
    static #fitsResult(type, resultType) {
        return resultType === null ? type.kind !== 'function' && !LanguageResolver.#holdsTypeParameter(type) : type.isAssignableTo(resultType);
    }

    /**
     * Resolves a function value given to a function parameter against its callback contract: each function it may be, a function the script declares, its body resolved for the contract's argument types and its result checked against the contract's result type,
     * or a function reference, whose declaration takes what the contract passes. It answers the targets with those types, which evaluation checks the member's arguments and the function's result against. The member calls it while its own invocation lasts,
     * with as many arguments as the contract declares.
     */
    #resolveCallback(result, contract, pointer, scope) {
        const { type } = result;
        const { member, parameter, parameterTypes, resultType } = contract;

        if (type.kind !== 'function') {
            const implicit = parameterTypes.length === 1 ? ', as an arrow function, a function a name holds, a module\'s function by reference or an implicit body gives' : '';

            this.#fail(`The parameter '${parameter}' of '${member}' takes a function${implicit}, and finds ${type}`, pointer);
        }

        if (type.isNullable) {
            this.#fail(`The parameter '${parameter}' of '${member}' takes a function, and this one may be null`, pointer);
        }

        const argumentResults = parameterTypes.map(parameterType => ({ type: parameterType, kind: 'value', isFixed: false }));

        const targets = type.functions.map((target, index) => {
            if (target.reference !== undefined) {
                if (!this.#takesContract(target.reference, contract)) {
                    this.#fail(`The function given as '${parameter}' of '${member}' is called with ${parameterTypes.join(', ')} and answers ${resultType ?? 'any value'}, and '${this.#referenceNameOf(target.reference)}' is ${this.#signatureOf(target.reference)}`, pointer);
                }

                return { reference: target.reference };
            }

            const count = target.function.parameters.length;

            if (count !== parameterTypes.length) {
                this.#fail(`The function given as '${parameter}' of '${member}' takes ${count === 1 ? 'one argument' : `${count} arguments`}, and its contract passes ${parameterTypes.length}`, pointer);
            }

            const resolved = this.#resolveFunctionBody(target, parameter, argumentResults, null, scope, type.functions.length === 1 ? `${pointer}/callback` : `${pointer}/callbacks/${index}`, pointer);

            if (!LanguageResolver.#fitsResult(resolved.type, resultType)) {
                this.#fail(`The function given as '${parameter}' of '${member}' gives ${resolved.type}, and its contract takes ${resultType ?? 'any value'}`, pointer);
            }

            return { function: resolved.function, body: resolved.body, parameters: resolved.parameters };
        });

        return { targets, parameterTypes, resultType };
    }

    /** The fields of each outermost object, by the object expression that builds it and then by name, each with its value, which a field read through the object root follows. @type {WeakMap<object, Map<string, { value: object }>>} */
    #objectRootFields = new WeakMap();

    /** The type of the field a structured type or an object type declares under the name, or null. */
    #fieldTypeOf(type, name) {
        if (type.kind === 'object') {
            return type.fieldTypes.get(name) ?? null;
        }

        const structure = type.kind === 'named' ? this.#moduleRegistry.getType(type.name) : undefined;
        const text = structure?.fields[name];

        return text === undefined ? null : Type.parse(text);
    }

    /** Whether values of the type are data; a structure already being checked counts as data where it holds itself, since its other fields are checked where it is first met. */
    #isData(type, checking = new Set()) {
        switch (type.kind) {
            case 'null':
            case 'never':
                return true;
            case 'list':
                return this.#isData(type.itemType, checking);
            case 'object':
                return [...type.fieldTypes.values()].every(fieldType => this.#isData(fieldType, checking));
            case 'named': {
                if (DATA_TYPE_NAMES.has(type.name) || checking.has(type.name)) {
                    return true;
                }

                const structure = this.#moduleRegistry.getType(type.name);

                if (structure === undefined) {
                    return false;
                }

                checking.add(type.name);

                return Object.values(structure.fields).every(text => this.#isData(Type.parse(text), checking));
            }
            default:
                return false;
        }
    }

    #fail(message, pointer) {
        const source = ResolvedDefinition.sourcePointerOf(pointer, this.#instances);

        throw LexicaError.validation(message, this.#locations?.locate(source) ?? { pointer: source });
    }

    /** The copy of a function's body each call resolves, with the pointer it is resolved under and the pointer of the body it copies. @type {{ node: object, pointer: string, source: string }[]} */
    #instances = [];

    /** What a resolved node of the kind is, for a message: a host call, a function a local holds, or a value. */
    static #descriptionOf(kind) {
        return kind === 'hostCall' ? 'a host call' : `a ${kind}`;
    }

    /** The property access that writes the node's name after its receiver, optional where the node is. */
    static #accessOf(node) {
        return { kind: 'member', target: node.target, name: node.name, ...(node.optional === true ? { optional: true } : {}) };
    }

    /** What a call of the declaration makes: a host call where its host invokes it, and a value otherwise. */
    static #requestKindOf(declaration) {
        return LexicaModule.isHostCall(declaration) ? 'hostCall' : 'value';
    }

    /** Whether the type says nothing of what its value would be: null's, a null binding's, and never's, which no value has. */
    static #isOfUnknownType(type) {
        return type.kind === 'null' || type.kind === 'never';
    }

    /** Whether the type writes a type parameter anywhere in it. */
    static #holdsTypeParameter(type) {
        if (type.kind === 'typeParameter') {
            return true;
        }

        if (type.itemType !== null) {
            return LanguageResolver.#holdsTypeParameter(type.itemType);
        }

        return type.fieldTypes !== null && [...type.fieldTypes.values()].some(fieldType => LanguageResolver.#holdsTypeParameter(fieldType));
    }

    /**
     * The member's name qualified by the type of the declaration the receiver matched, as `node.root` and `shadow.root` are, so two members of one name are told apart; a declaration for any receiver keeps its name alone.
     * A list is named by its kind, as `list.count` is.
     */
    static #qualifiedNameOf(declaration, receiverType) {
        const base = receiverType.toNonNullable();
        const on = [declaration.target].flat().find(text => text !== 'any' && Type.parse(text).kind !== 'typeParameter' && Type.tryMatchType(Type.parse(text), base, new Map()));

        if (on === undefined) {
            return declaration.name;
        }

        const type = Type.parse(on);

        return `${type.kind === 'named' ? type.name : type.kind}.${declaration.name}`;
    }

    /** Whether a value of the type compares with a value of any type: null, which equals null alone, or a never, which no value has. */
    static #comparesWithAny(type) {
        return type.kind === 'null' || type.kind === 'never';
    }

    /** Whether values of the type are compared with each other, rather than with null alone: strings, numbers, Booleans and nodes. */
    static #isComparable(type) {
        return type.kind === 'named' && (['string', 'number', 'boolean'].includes(type.name) || type.isNode);
    }

    /** Whether the declaration applies to the receiver, recording the arguments of the type parameters its types write. */
    static #matchesReceiver(declaration, receiverType, typeArguments) {
        return LanguageResolver.#matchesAny(declaration.target, receiverType, typeArguments);
    }

    static #matchesAny(on, receiverType, typeArguments = new Map()) {
        const base = receiverType.toNonNullable();
        const isValue = base.kind === 'named' || base.kind === 'list' || base.kind === 'object';

        return [on].flat().some(text => {
            if (text === 'any') {
                return isValue;
            }

            const type = Type.parse(text);

            // A target that is a type parameter alone takes a receiver of any type a value has, and binds the parameter to it.
            return (type.kind !== 'typeParameter' || isValue) && Type.tryMatchType(type, base, typeArguments);
        });
    }
}
