/**
 * LanguageResolver — resolves a Nexo definition against the vocabulary and validates its types, before anything is evaluated
 */

import { DefinitionValidator } from './DefinitionValidator.mjs';
import { DefinitionWriter } from './DefinitionWriter.mjs';
import { ImportedVocabulary } from './ImportedVocabulary.mjs';
import { Imports } from './Imports.mjs';
import { NexoError, NexoErrors } from './NexoError.mjs';
import { Names } from './Names.mjs';
import { ResolvedDefinition } from './ResolvedDefinition.mjs';
import { Type } from './Type.mjs';
import { NexoModule } from './vocabulary/NexoModule.mjs';
import { Vocabulary } from './vocabulary/Vocabulary.mjs';

/** How each form of a declaration is written, and the node that writes it. */
const FORM_NODE_KINDS = { property: 'memberAccess', function: 'call', indexer: 'indexerAccess' };

/** No facts, the set a scope starts with: what narrows a stable reference on a path. */
const NO_FACTS = new Map();

export class LanguageResolver {
    #registry;
    #typeChecker;
    #bindings;
    #locations;

    /** The local names the definition's imports give modules, each beginning its module's namespace, which a message's text writes as the script does. @type {ReadonlySet<string>} */
    #namespaceNames = Names.noNamespaceNames;

    /** What the definition's imports make available: its namespaces, the types it names, and the declarations it may select, Nexo's own among them. @type {ImportedVocabulary} */
    #imported;

    /** @type {Map<string, object>} */
    #resolutions = new Map();

    /** @type {object[]} */
    #usedDeclarations = [];

    /** The optional chains being resolved, the innermost last, each with whether an optional access of it can meet a null receiver. @type {{ shortCircuits: boolean }[]} */
    #optionalChains = [];

    /**
     * @param {import('./vocabulary/NexoRegistry.mjs').NexoRegistry} registry The vocabulary to resolve against.
     * @param {import('./ParameterBindings.mjs').ParameterBindings} bindings What the request's parameters are bound to.
     * @param {import('./TextLocations.mjs').TextLocations | null} locations Where in a text each part of the definition came from.
     */
    /** The selection of a declaration among those of a name for a receiver, the one every access, indexer and qualified call reads. */
    #memberSelector;

    constructor(registry, bindings, locations) {
        this.#registry = registry;
        this.#typeChecker = registry.typeChecker;
        this.#memberSelector = registry.memberSelector;
        this.#bindings = bindings;
        this.#locations = locations;
        this.#imported = new ImportedVocabulary(registry, []);
    }

    /** Resolves and types the definition, answering what it resolved to or throwing where it cannot. */
    resolveDefinition(definition) {
        this.#resolveImports(definition.imports);

        const result = this.#resolveTerminal(definition.expression, '/expression', { contextType: null, contextKey: {}, locals: new Map(), facts: NO_FACTS, objectRootType: null });

        // A host call that supplies nothing gives no result, and one that supplies values gives, for each, what its result projection makes of it, or the value itself.
        const type = result.suppliesNothing === true ? null : result.type;

        if (type !== null && LanguageResolver.#heldReferenceOf(type) === 'function') {
            this.#fail('NEXO3035', 'The result would hold a function, which is used within the expression and never part of its result: call it, as name(…)', '/expression');
        }

        // A value of Any in it is data or not as it is evaluated, which checks it then.
        if (type !== null && !this.#registry.isDataOnceChecked(type)) {
            this.#fail('NEXO3043', `The result would hold ${type}, which is no data; read the facts it needs through an object expression`, '/expression');
        }

        const hostCall = result.kind === 'hostCall' ? this.#hostCallOf(definition.expression, '/expression') : null;
        const deferredAccesses = this.#deferredAccessesOf();

        // Evaluation recognizes a value of Any, which a declaration it uses gives the script, and a supplied value where its type holds a nullable reference, so a resolution of neither, in any branch, recognizes nothing.
        const suppliedType = hostCall === null || result.suppliesNothing === true ? null : (this.#resolutions.get(hostCall.pointer)?.type ?? Type.any);
        const recognizesSupplied = suppliedType !== null && (suppliedType.kind === 'any' || this.#registry.holdsNullableReference(suppliedType));
        const mayRecognize = recognizesSupplied || deferredAccesses.length > 0 || this.#usedDeclarations.some(({ declaration }) => this.#registry.givesAny(declaration));

        return new ResolvedDefinition(definition, type, hostCall, this.#resolutions, this.#usedDeclarations, deferredAccesses, this.#functionBodyCopies, mayRecognize);
    }

    /**
     * Each deferred access the resolutions hold, by its pointer, with the name it accesses and every declaration its selection could choose, each named as a message names a use, qualified by the type it is declared for,
     * since no receiver's type is known to qualify it by.
     */
    #deferredAccessesOf() {
        const deferred = [...this.#resolutions].filter(([, resolution]) => resolution.kind === 'deferred');

        return deferred.map(([pointer, { name, candidates }]) => ({ name, pointer, candidates: candidates.map(declaration => ({ declaration, qualifiedName: LanguageResolver.#formatQualifiedName(declaration, this.#registry.getReceiverTypes(declaration)[0]), pointer })) }));
    }

    /**
     * Resolves the definition's imports against the registry: each names a module it holds (NEXO3002), and a type import a public type or extension its module declares (NEXO3052, NEXO3053); what they make available
     * is then the vocabulary the script resolves against.
     */
    #resolveImports(imports) {
        imports.forEach((entry, index) => {
            const pointer = `/imports/${index}`;

            if (this.#registry.getModule(entry.module) === undefined) {
                this.#fail('NEXO3002', `'${Imports.quote(entry)}' imports the module '${entry.module}', which the registry does not hold`, pointer);
            }

            if (Imports.isModuleImport(entry)) {
                return;
            }

            const declaration = this.#registry.getModuleType(entry.module, entry.type);

            if (declaration === undefined) {
                this.#fail('NEXO3052', `'${Imports.quote(entry)}' imports '${entry.module}.${entry.type}', which its module does not declare`, pointer);
            }

            if (this.#registry.isInternal(declaration)) {
                this.#fail('NEXO3053', `'${Imports.quote(entry)}' imports '${entry.module}.${entry.type}', which is internal to its module`, pointer);
            }
        });
        this.#imported = new ImportedVocabulary(this.#registry, imports);
        this.#namespaceNames = this.#imported.namespaceNames;
    }

    /** The receiver members of the name `.` reads that the script's imports make available, Nexo's own among them, extension members, which `:` reads, left out. */
    #receiverMembersNamed(name) {
        return this.#imported.getAvailable(this.#membersReadBy({ name }));
    }

    /** The receiver members of the access's name it reads, whatever the script imports: extension members for an extension access, and every other member for any access else. */
    #membersReadBy(access) {
        const isExtensionAccess = access.extension !== undefined;

        return this.#registry.getReceiverMembers(access.name).filter(declaration => this.#memberSelector.isExtensionMember(declaration) === isExtensionAccess);
    }

    /**
     * Refuses an access none of whose declarations the script's imports make available applies to its receiver, where one they leave out does (NEXO3005), naming the modules that declare those and giving the import to
     * write; on a receiver of unknown type, null, any declaration counts. An internal declaration is none, as it is no candidate.
     */
    #refuseUnimported(declared, receiverType, subject, pointer) {
        const unimported = this.#memberSelector.getAccessible(declared).filter(declaration => !this.#imported.makesAvailable(declaration) && (receiverType === null || this.#typeChecker.resolveApplyingReceiverType(declaration, receiverType) !== undefined));

        if (unimported.length === 0) {
            return;
        }

        const modules = [...new Set(unimported.map(declaration => this.#registry.getDeclaringModuleName(declaration)))];

        this.#fail('NEXO3005', `${subject} is declared only by ${modules.map(module => `'${module}'`).join(' and ')}, which the script does not import: write ${modules.map(module => `'import ${module}'`).join(' or ')} at the script's start`, pointer);
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
                return this.#hostCallOf(node.context, `${pointer}/context`);
            case 'optionalChain':
                return this.#hostCallOf(node.chain, `${pointer}/chain`);
            default:
                return { node, pointer, name: LanguageResolver.#accessOf(node).name, declaration: this.#resolutions.get(pointer).declaration ?? null };
        }
    }

    #resolveNode(node, pointer, scope) {
        switch (node.kind) {
            case 'literal':
                return this.#resolveLiteral(node);
            case 'scriptParameter':
                return this.#resolveParameter(node, pointer, scope);
            case 'root':
                return this.#resolveObjectRoot(pointer, scope);
            case 'it':
                if (scope.contextType === null) {
                    this.#fail('NEXO3010', "'it' is the implicit parameter, and there is none here", pointer);
                }

                // An `it` of an argument body's own scope, its implicit parameter, which the member supplies, is recorded on the scope's `argumentBody`, so the argument is read as a body.
                if (scope.argumentBody?.key === scope.contextKey) {
                    scope.argumentBody.isRead = true;
                }

                return { type: scope.facts.get(scope.contextKey) ?? scope.contextType, kind: 'value', isFixed: false };
            case 'local':
                return this.#resolveLocal(node, pointer, scope);
            case 'memberAccess':
                return this.#resolveMemberAccess(node, pointer, scope);
            case 'call':
                // A call of the function a name holds calls the local, and a call of a member the member its callee names.
                return node.callee.kind === 'local' ? this.#resolveFunctionCall(node, pointer, scope) : this.#resolveMemberAccess(node, pointer, scope);
            case 'indexerAccess':
                return this.#resolveIndexerAccess(node, pointer, scope);
            case 'equality':
                return this.#resolveEquality(node, pointer, scope, false);
            case 'arithmetic':
                // A subtraction of a bare name from a property access may be one name written with a hyphen, as `it.client-size` is, which a failure to find the member suggests.
                const access = node.left.kind === 'optionalChain' ? node.left.chain : node.left;

                if (node.operator === '-' && access.kind === 'memberAccess' && typeof access.name === 'string' && (node.right.kind === 'scriptParameter' || node.right.kind === 'local')) {
                    this.#joinedNames.set(access, `${access.name}${node.right.name[0].toUpperCase()}${node.right.name.slice(1)}`);
                }

                for (const side of ['left', 'right']) {
                    this.#requireNumber(this.#resolveNode(node[side], `${pointer}/${side}`, scope), `The ${side} operand of '${node.operator}'`, `${pointer}/${side}`);
                }

                return { type: Type.createNamedType('Number'), kind: 'value', isFixed: false };
            case 'arithmeticNegation':
                this.#requireNumber(this.#resolveNode(node.operand, `${pointer}/operand`, scope), "What '-' negates", `${pointer}/operand`);

                return { type: Type.createNamedType('Number'), kind: 'value', isFixed: false };
            case 'fromEndIndex':
                this.#requirePosition(this.#resolveNode(node.offset, `${pointer}/offset`, scope), "An index's offset", `${pointer}/offset`, false);

                return { type: Type.createNamedType('Index'), kind: 'value', isFixed: false };
            case 'range':
                for (const boundary of ['start', 'end']) {
                    if (node[boundary] !== undefined) {
                        this.#requirePosition(this.#resolveNode(node[boundary], `${pointer}/${boundary}`, scope), `A range's ${boundary}`, `${pointer}/${boundary}`, true);
                    }
                }

                return { type: Type.createNamedType('Range'), kind: 'value', isFixed: false };
            case 'list':
                return { type: Type.createListType(this.#resolveCollectionItems(node.items.map((item, index) => ({ node: item, pointer: `${pointer}/items/${index}` })), scope, pointer, "A list's items", this.#expectedTypes.get(node)?.itemType)), kind: 'value', isFixed: false };
            case 'dictionary': {
                const values = node.entries.map((entry, index) => ({ node: entry.value, pointer: `${pointer}/entries/${index}/value` }));

                return { type: Type.createDictionaryType(Type.createNamedType('String'), this.#resolveCollectionItems(values, scope, pointer, "A dictionary's values")), kind: 'value', isFixed: false };
            }
            case 'interpolatedString':
                node.parts.forEach((part, index) => {
                    if (part.kind === 'expression') {
                        this.#requireInterpolationValue(this.#resolveNode(part.expression, `${pointer}/parts/${index}/expression`, scope), `${pointer}/parts/${index}/expression`);
                    }
                });

                return { type: Type.createNamedType('String'), kind: 'value', isFixed: false };
            case 'comparison':
                // Each operand is named by the operator it stands after, the first by the one after it.
                node.operands.forEach((operand, index) => {
                    const what = index === 0 ? `The left operand of '${node.operators[0]}'` : `The right operand of '${node.operators[index - 1]}'`;

                    this.#requireNumber(this.#resolveNode(operand, `${pointer}/operands/${index}`, scope), what, `${pointer}/operands/${index}`, 'a comparison');
                });

                return { type: Type.createNamedType('Boolean'), kind: 'value', isFixed: false };
            case 'conditional':
                return this.#resolveConditional(node, pointer, scope);
            case 'body':
                return this.#resolveBody(node, pointer, scope);
            case 'do':
                return this.#resolveNode(node.body, `${pointer}/body`, scope);
            case 'function':
                // An arrow function written as an argument is a function reference of its own, which captures the scope it is written in.
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
                return this.#resolveObjectExpression(node, pointer, scope);
        }
    }

    /**
     * The structured type each node constructs, or a list of one, by the node, while the node is being resolved in a place that expects it: given to a value argument by its parameter's type, and passed on to an
     * object field by its property's, to a list's items, to a conditional's branches and to a coalescing's sides, so an object expression written where a structure is expected constructs it. An entry lasts as long
     * as the resolution it is made for, so another reading of the node, a speculative one for another declaration or a receiver's, expects nothing of it.
     * @type {WeakMap<object, Type>}
     */
    #expectedTypes = new WeakMap();

    /** Resolves the node, expecting of it the type given where an object expression can construct that type, a structured type or a list of one, nullable or not, for as long as this resolution of it lasts. */
    #resolveExpecting(node, pointer, scope, type) {
        const constructible = type === undefined ? null : this.#constructibleTypeOf(type.toNonNullable());

        if (constructible === null) {
            return this.#resolveNode(node, pointer, scope);
        }

        this.#expectedTypes.set(node, constructible);

        try {
            return this.#resolveNode(node, pointer, scope);
        } finally {
            this.#expectedTypes.delete(node);
        }
    }

    /** Whether the node is written in a form a structure's type reaches: an object expression following no value, a collection expression of items, a conditional or a coalescing. */
    static #mayConstruct(node) {
        return (node.kind === 'object' && node.context === undefined) || node.kind === 'list' || node.kind === 'conditional' || node.kind === 'coalescing';
    }

    /** The type, where an object expression can construct it, or a list of it at any depth, which its items can; null for any other, a type parameter its receiver hasn't bound among them. */
    #constructibleTypeOf(type) {
        if (type.isList) {
            return this.#constructibleTypeOf(type.itemType.toNonNullable()) === null ? null : type;
        }

        return type.kind === 'named' && type.typeArguments.length === 0 && this.#registry.getDataShape(type) !== null ? type : null;
    }

    /**
     * Checks the object fields an object expression gives against the data shape of the structure it constructs: each value assignable to its property's type, one of Any checked when it is evaluated, and every
     * property it leaves out nullable, which then holds null. It answers the structure, and records the construction for evaluation, with the properties whose values it checks then.
     */
    #resolveConstruction(constructed, shape, fieldTypes, pointer) {
        const checks = new Map();

        for (const [name, propertyType] of shape) {
            if (!fieldTypes.has(name)) {
                if (!propertyType.isNullable) {
                    this.#fail('NEXO3087', `The ${constructed} written here leaves out '${name}', which is ${propertyType} and can't be null`, pointer);
                }

                continue;
            }

            const fieldType = fieldTypes.get(name);
            const assignability = this.#typeChecker.assignabilityOf(fieldType, propertyType);

            if (assignability === 'refused') {
                const [expectedName, actualName] = Type.namesOf(propertyType, fieldType);
                const index = [...fieldTypes.keys()].indexOf(name);

                this.#fail('NEXO3088', `The property '${name}' of the ${constructed} written here is ${expectedName}, and is given ${actualName}`, `${pointer}/objectFields/${index}/value`);
            }

            if (assignability === 'checked') {
                checks.set(name, propertyType);
            }
        }

        this.#resolutions.set(pointer, { kind: 'construction', type: constructed, checks });

        return { type: constructed, kind: 'value', isFixed: false };
    }

    /** The result each condition and operand resolved to, by its node, which the values a computed property access can give follow where it is fixed or its type tells its falsey part. @type {WeakMap<object, object>} */
    #decidingResults = new WeakMap();

    /**
     * Resolves a coalescing: a value and a fallback of one type, as a conditional's branches are, its type the value's made non-null where the fallback's is; the whole is resolved before any of it is evaluated.
     * Where the value is fixed, it is the side that value selects, fixed where that side is.
     */
    #resolveCoalescing(node, pointer, scope) {
        const results = ['value', 'fallback'].map(side => {
            const result = this.#resolveExpecting(node[side], `${pointer}/${side}`, scope, this.#expectedTypes.get(node));

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `The ${side} of '??' is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${side}`);
            }

            this.#decidingResults.set(node[side], result);

            return result;
        });
        const [value, fallback] = results.map(result => result.type);

        // A value of the type null is never anything but null, so the fallback's type is the whole's.
        const type = value.kind === 'null' ? fallback : this.#typeChecker.merge(value.toNonNullable(), fallback);

        if (type === null) {
            this.#fail('NEXO3041', `The value and the fallback of '??' are of one type, and these are ${value} and ${fallback}`, `${pointer}/fallback`);
        }

        return LanguageResolver.#fixedAs(type, results[0].isFixed ? results[results[0].value === null ? 1 : 0] : null);
    }

    /** Resolves an optional chain: the chain it holds, nullable where an optional access of it can meet a null receiver, which ends the chain with null. */
    #resolveOptionalChain(node, pointer, scope) {
        const optionalChain = { shortCircuits: false };

        this.#optionalChains.push(optionalChain);

        try {
            const result = this.#resolveNode(node.chain, `${pointer}/chain`, scope);

            return optionalChain.shortCircuits ? { ...result, type: result.type.toNullable(), isFixed: false } : result;
        } finally {
            this.#optionalChains.pop();
        }
    }

    /**
     * Resolves an equality: two values, compared, and answers a Boolean that is never null, whatever their types.
     * A string, a number, a Boolean or a reference is compared with a value of a type one of theirs fits, and a value of any other type with null alone; a value of the type null, and a never, compare with any.
     * Where `==`, or `!=` as it is negated, compares a value with a string that names one of its Boolean members, the refusal gives the member to write.
     */
    #resolveEquality(node, pointer, scope, isNegated) {
        const left = this.#resolveNode(node.left, `${pointer}/left`, scope);
        const right = this.#resolveNode(node.right, `${pointer}/right`, scope);
        // An equality its negation holds is `!=`, as the canonical text writes it.
        const operator = isNegated ? '!=' : '==';

        for (const [side, result] of [['left', left], ['right', right]]) {
            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `'${operator}' compares values, and this is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${side}`);
            }
        }

        if (!LanguageResolver.#isNullOrNever(left.type) && !LanguageResolver.#isNullOrNever(right.type)) {
            const leftType = left.type.toNonNullable();
            const rightType = right.type.toNonNullable();
            const isChecked = leftType.kind === 'any' || rightType.kind === 'any';

            for (const [side, type] of [['left', leftType], ['right', rightType]]) {
                if (type.kind !== 'any' && !this.#typeChecker.isComparable(type)) {
                    this.#fail('NEXO3066', `'${operator}' compares a value of ${type} with null alone, since only strings, numbers, Booleans and references are compared with each other`, `${pointer}/${side}`);
                }
            }

            if (isChecked) {
                this.#resolutions.set(pointer, { kind: 'equality', isChecked, operator });
            } else if (!this.#typeChecker.fitsEitherWay(leftType, rightType)) {
                this.#fail('NEXO3030', `'${operator}' compares values whose types fit one way or the other, and ${leftType} and ${rightType} fit neither way${this.#formatTestHint(node, left, right, isNegated)}`, pointer);
            }
        }

        return { type: Type.createNamedType('Boolean'), kind: 'value', isFixed: false };
    }

    /**
     * For an equality of a value and a string that names one of the value's Boolean members, as `input == "disabled"` or `input == state` writes one, the test to write, negated for `!=`: the property read, or the Boolean function called
     * with no argument; nothing for any other. The name is read exactly, and the member is one the value's type has.
     */
    #formatTestHint(node, left, right, isNegated) {
        if (!right.isFixed || typeof right.value !== 'string' || (node.right.kind !== 'literal' && node.right.kind !== 'scriptParameter')) {
            return '';
        }

        const receiverType = left.type.toNonNullable();
        const isTest = candidate => candidate.result === 'Boolean' && !NexoModule.isInvokedByHost(candidate) && (candidate.kind === 'property' || (candidate.kind === 'function' && candidate.parameters.every(parameter => !parameter.required)));
        const selection = this.#memberSelector.select(this.#receiverMembersNamed(right.value).filter(isTest), receiverType);

        if (selection.kind !== 'selected') {
            return '';
        }

        const { declaration } = selection;

        const optional = left.type.isNullable ? { optional: true } : {};
        const name = node.right.kind === 'literal' ? right.value : node.right;
        const test = declaration.kind === 'property' ? { kind: 'memberAccess', receiver: node.left, name, ...optional } : { kind: 'call', callee: { kind: 'memberAccess', receiver: node.left, name: right.value, ...optional }, arguments: [] };

        return `: a test is the member that answers it, so write '${DefinitionWriter.quote(isNegated ? { kind: 'not', operand: test } : test, this.#namespaceNames)}'`;
    }

    /**
     * Resolves a conditional: a condition, any value, or a conditional binding, any value, whose name the consequent alone sees, bound to that value where it is truthy; and two branches of one type, nullable where either is.
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
            const result = this.#resolveExpecting(node[branch], `${pointer}/${branch}`, branch === 'consequent' ? consequentScope : falseyScope, this.#expectedTypes.get(node));

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `A branch of 'if' is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, `${pointer}/${branch}`);
            }

            return result;
        });
        const branches = results.map(result => result.type);
        const type = this.#typeChecker.merge(...branches);

        if (type === null) {
            this.#fail('NEXO3041', `The branches of 'if' are of one type, and these are ${branches[0]} and ${branches[1]}`, `${pointer}/alternative`);
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
        const type = parts.reduce((merged, part) => (merged === null ? null : this.#typeChecker.merge(merged, part)));

        if (type === null) {
            const described = [...new Set(parts.flatMap((part, index) => LanguageResolver.#describePart(part, index === last ? null : !passesWhenTruthy)))];
            const rewrite = node.kind === 'and' && node.operands.length === 2
                ? `write 'if ${DefinitionWriter.quote(node.operands[0], this.#namespaceNames)} then ${DefinitionWriter.quote(node.operands[1], this.#namespaceNames)} else null end' if null is an acceptable alternative`
                : "a conditional, 'if … then … else … end', chooses between values of one type";

            this.#fail('NEXO3040', `What '${node.kind}' gives is ${described.join(' or ')}, which no one type holds; ${rewrite}`, pointer);
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
        if (type.kind === 'named' && type.name === 'Boolean') {
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

        if (isTruthy === null || !(part.kind === 'named' && part.name === 'Boolean')) {
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
            case 'scriptParameter':
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

                return isEveryPassed ? passed : this.#commonOf(stops);
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
            case 'scriptParameter': {
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
    #commonOf(sets) {
        const [first, ...rest] = sets;
        const common = new Map();

        for (const [key, type] of first) {
            const merged = rest.reduce((sum, set) => (sum === null || !set.has(key) ? null : this.#typeChecker.merge(sum, set.get(key))), type);

            if (merged !== null) {
                common.set(key, merged);
            }
        }

        return common;
    }

    /**
     * Resolves a cast: its operand, a value, and the type it casts to, a reference type, its result of that type, nullable where the operand is, since null passes through it. An operand of the type's hierarchy, beneath it,
     * above it or of it, is cast, and null too, since a binding typed from its value may be either; one that can never be of the type is refused. The cast keeps both types, for its evaluation and its message.
     */
    #resolveCast(node, pointer, scope) {
        const target = this.#resolveNode(node.operand, `${pointer}/operand`, scope);
        const targetType = this.#typeNamed(node.type, pointer);

        if (target.kind !== 'value') {
            this.#fail('NEXO3048', `A cast's operand is a value, and this one is ${LanguageResolver.#descriptionOf(target.kind)}`, `${pointer}/operand`);
        }

        if (!this.#registry.isReferenceType(targetType)) {
            this.#fail(this.#declaresTypeNamed(node.type) ? 'NEXO3020' : 'NEXO3019', `'as' casts to a reference type, and '${node.type}' is none${this.#typeImportHintOf(node.type)}`, pointer);
        }

        const from = target.type;
        const base = from.toNonNullable();
        const isWithinHierarchy = from.kind === 'null' || from.kind === 'never' || base.kind === 'any' || (this.#registry.isReferenceType(base) && (this.#typeChecker.isAssignable(targetType, base) || this.#typeChecker.isAssignable(base, targetType)));
        // A cast across hierarchies is the one a cast operator of its target's type declares to its type.
        const declaration = isWithinHierarchy ? null : this.#selectOperator('cast', base, targetType, `The cast from ${base} to ${targetType}`, pointer);

        if (declaration === undefined) {
            this.#fail('NEXO3060', `A value of ${base} can never be cast to ${node.type}, a type of another hierarchy no cast operator reaches: the cast would always reject it`, pointer);
        }

        // A cast operator is a declaration the script uses, named by the syntax that invokes it, as a message names it.
        if (declaration !== null) {
            this.#usedDeclarations.push({ declaration, qualifiedName: this.#registry.formatOperator(declaration), pointer });
        }

        this.#resolutions.set(pointer, { kind: 'cast', type: targetType, sourceType: base, declaration });

        return { type: from.kind === 'null' || from.isNullable ? targetType.toNullable() : targetType, kind: 'value', isFixed: false };
    }

    /**
     * The type a cast or a conversion names: where the local name an import gives its module qualifies it, the type that module declares, refused where no import gives that local name (NEXO3004) or the module does not
     * declare a type of that name; otherwise, by the script's tiers, the type a type import gives the name, then one of Nexo's own, then the one public type of its name among the modules the script imports, refused where
     * several share it (NEXO3059), extensions taking no part, and a name none of them declares left to the cast or the conversion to refuse.
     */
    #typeNamed(name, pointer) {
        const { moduleName, types } = this.#registry.resolveTypeName(name, this.#imported.typeNameScope);
        const dot = name.indexOf('.');

        if (dot >= 0) {
            const qualifier = name.slice(0, dot);

            if (moduleName === undefined) {
                const isRegistered = this.#registry.getModule(qualifier) !== undefined;

                this.#fail('NEXO3004', `'${name}' is qualified by '${qualifier}', which no import of the script gives a module${isRegistered ? `: write 'import ${qualifier}' at the script's start` : ''}`, pointer);
            }

            if (types.length === 0) {
                this.#fail('NEXO3019', `The module '${moduleName}' does not declare a type named '${name.slice(dot + 1)}'`, pointer);
            }

            if (this.#registry.isInternal(this.#registry.getTypeDeclaration(types[0]))) {
                this.#failInternal(`The type '${name}'`, moduleName, pointer);
            }

            return types[0];
        }

        // A type import's type and Nexo's own are never internal; among the imported modules' an internal type is no candidate, so a name only internal types have names none a script reaches.
        const reached = types.filter(type => type.moduleName === null || !this.#registry.isInternal(this.#registry.getTypeDeclaration(type)));

        if (reached.length > 1) {
            this.#fail('NEXO3059', `'${name}' names a type several modules declare, so it is named qualified by its module: ${reached.map(type => `${type.moduleName}.${name}`).join(' or ')}`, pointer);
        }

        if (reached.length === 0 && types.length > 0) {
            this.#failInternal(`The type '${name}'`, types[0].moduleName, pointer);
        }

        return reached[0] ?? Type.createNamedType(name, false, null);
    }

    /** Whether a type of the name a cast or a conversion writes is one the script names: a qualified one, which its module was found to declare, one a type import gives, one of Nexo's own, or one an imported module declares. */
    #declaresTypeNamed(name) {
        return name.includes('.') || this.#registry.resolveTypeName(name, this.#imported.typeNameScope).types.length > 0;
    }

    /** The import to write for a type name no import gives, where registered modules the script does not import declare a public type of that name, as a message ends; empty otherwise. */
    #typeImportHintOf(name) {
        if (name.includes('.') || this.#declaresTypeNamed(name)) {
            return '';
        }

        const modules = this.#registry.getModuleNamesDeclaringType(name).filter(moduleName => !this.#registry.isInternal(this.#registry.getTypeDeclaration(Type.createNamedType(name, false, moduleName))));

        return modules.length === 0 ? '' : `; ${modules.map(module => `'${module}'`).join(' and ')} declare${modules.length === 1 ? 's' : ''} it: write ${modules.map(module => `'import ${module}'`).join(' or ')} at the script's start`;
    }

    /**
     * The operator of the name a value of the source type is cast or converted to the destination by, among those of that destination the selector selects, the owner's winning and otherwise the extension's whose
     * receiver is more specific than every other's; undefined where none applies, refusing an internal one (NEXO3023) and several none of which is more specific (NEXO3024), since no syntax selects one module's.
     */
    #selectOperator(name, source, destination, subject, pointer) {
        const declared = this.#registry.getOperators(name).filter(operator => this.#registry.getOperatorDestination(operator).equals(destination));
        const selection = this.#memberSelector.select(this.#imported.getAvailable(declared), source);

        if (selection.kind === 'none') {
            this.#refuseUnimported(declared, source, subject, pointer);
        }

        if (selection.kind === 'internal') {
            this.#failInternal(subject, this.#registry.getDeclaringModuleName(selection.declarations[0]), pointer);
        }

        if (selection.kind === 'ambiguous') {
            const modules = [...new Set(selection.declarations.map(operator => this.#registry.getDeclaringModuleName(operator)))];

            this.#fail('NEXO3024', `${subject} is declared by the modules ${modules.map(module => `'${module}'`).join(' and ')}, none of whose receivers is more specific than every other's, so which applies is ambiguous`, pointer);
        }

        return selection.kind === 'selected' ? selection.declaration : undefined;
    }

    /** Resolves an attempt: the conversion or the cast it attempts, as it resolves strictly, its result made nullable, since a rejection answers null. */
    #resolveTry(node, pointer, scope) {
        const result = this.#resolveNode(node.operand, `${pointer}/operand`, scope);

        return { type: result.type.toNullable(), kind: 'value', isFixed: false };
    }

    /**
     * Resolves a conversion: its operand, a value, and the type of data it converts to, its result of that type, nullable where the operand is.
     * A value already of the type answers itself, which no declaration overrides; any other takes the conversion operator of its type to that one the selector selects, never a chain of them.
     * An operand of unknown type chooses none: null answers null, and a never is never evaluated.
     */
    #resolveConversion(node, pointer, scope) {
        const target = this.#resolveNode(node.operand, `${pointer}/operand`, scope);

        if (target.kind !== 'value') {
            this.#fail('NEXO3048', `What 'to' converts is a value, and this one is ${LanguageResolver.#descriptionOf(target.kind)}`, `${pointer}/operand`);
        }

        const to = this.#typeNamed(node.type, pointer);

        if (!this.#registry.isConvertible(to)) {
            const cast = to?.kind === 'named' && this.#registry.isReferenceType(to) ? `; a reference is cast to a type of its hierarchy with 'as', as in … as ${node.type}` : '';

            this.#fail(this.#declaresTypeNamed(node.type) ? 'NEXO3021' : 'NEXO3019', `'to' converts to a type of data named as it is declared, Number, String, Boolean or a structured type the vocabulary declares, and '${node.type}' is none of them${cast}${this.#typeImportHintOf(node.type)}`, pointer);
        }

        const from = target.type;

        if (from.kind === 'null' || from.kind === 'never') {
            this.#resolutions.set(pointer, { kind: 'conversion', declaration: null });

            return { type: from.kind === 'null' ? to.toNullable() : to, kind: 'value', isFixed: false };
        }

        const source = from.toNonNullable();
        const isIdentity = source.kind === 'named' && source.equals(to);
        const declaration = isIdentity ? undefined : this.#selectOperator('convert', source, to, `The conversion from ${source} to ${to}`, pointer);

        if (!isIdentity && declaration === undefined) {
            const targets = [...new Set(this.#memberSelector.getAccessible(this.#imported.getAvailable(this.#registry.getOperators('convert'))).filter(operator => this.#typeChecker.resolveApplyingReceiverType(operator, source) !== undefined).map(operator => String(this.#registry.getOperatorDestination(operator))))];
            const available = targets.length === 0 ? `${source} converts to nothing` : `${source} converts to ${targets.join(', ')}`;

            this.#fail('NEXO3022', `No conversion from ${source} to ${to.name} is declared, and ${available}`, pointer);
        }

        if (declaration !== undefined) {
            this.#usedDeclarations.push({ declaration, qualifiedName: this.#registry.formatOperator(declaration), pointer });
        }

        this.#resolutions.set(pointer, { kind: 'conversion', declaration: declaration ?? null, type: to });

        return { type: from.isNullable ? to.toNullable() : to, kind: 'value', isFixed: false };
    }

    /**
     * Resolves a collection expression's items, a list's or a dictionary's values, in order, and answers the type they merge to, a never where it holds none: each is a value, never a host call (NEXO3048) nor a function,
     * since a collection holds data and references (NEXO3082), and items of no common type are refused (NEXO3081), never widened to Any.
     */
    #resolveCollectionItems(parts, scope, pointer, subject, expectedItemType) {
        const types = [];
        let merged = Type.never;

        for (const part of parts) {
            const result = this.#resolveExpecting(part.node, part.pointer, scope, expectedItemType);

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `${subject} are values, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, part.pointer);
            }

            if (LanguageResolver.#heldReferenceOf(result.type) === 'function') {
                this.#fail('NEXO3082', `${subject} are data and references, and this one holds a function, which a collection never does: call it, and hold what it answers`, part.pointer);
            }

            types.push(result.type);
            merged = merged === null ? null : this.#typeChecker.merge(merged, result.type);
        }

        if (merged === null) {
            this.#fail('NEXO3081', `${subject} share no type: ${[...new Set(types.map(type => String(type)))].join(', ')}`, pointer);
        }

        return merged;
    }

    /** The scope a conditional binding's consequent is resolved in: the scope around it, with the binding's name a local holding its value, of the result given. */
    static #consequentScopeOf(node, scope, result) {
        return { ...scope, locals: new Map(scope.locals).set(node.binding.name, { result, initializer: node.binding.value, scope, conditional: node }) };
    }

    /** Resolves a negation: what it negates, any value, and answers a Boolean, true where that value is falsey. */
    #resolveNot(node, pointer, scope) {
        // An equality is negated as `!=` writes it, so the member a refusal gives is negated too.
        const operand = node.operand.kind === 'equality' ? this.#resolveEquality(node.operand, `${pointer}/operand`, scope, true) : this.#resolveNode(node.operand, `${pointer}/operand`, scope);

        this.#requireValue(operand, "What 'not' negates", `${pointer}/operand`);

        return { type: Type.createNamedType('Boolean'), kind: 'value', isFixed: false };
    }

    /**
     * Refuses what the operation, arithmetic unless another is named, takes no part in: what is no value, a value that can be null, which a fallback or a test removes first,
     * and a value of any type but a number, which nothing converts to one but `to`.
     */
    /**
     * The signature of the indexer the selection chose that the access's key selects: the one signature of an indexer that has one, and otherwise the one whose key type the key's type is assignable to, a key of null
     * or a never the first's; a key none takes, and one of Any where several stand, is refused (NEXO3084), never falling through to another member. The key is resolved to its type alone, its records discarded,
     * since the signature's invocation resolves it.
     */
    #selectSignature(declaration, node, pointer, scope, receiverType) {
        const signatures = this.#registry.getIndexerSignatures(declaration);

        if (signatures.length === 1) {
            return declaration;
        }

        const keyPointer = `${pointer}/argument`;
        const typeArguments = (receiverType === null ? null : this.#typeChecker.inferReceiverTypeArguments(declaration, receiverType)) ?? new Map();
        const keyTypeOf = signature => this.#registry.getDeclaredType(signature, signature.parameters[0].type).resolveTypeParameters(typeArguments);

        // A key written in a form a structure's type reaches constructs the one structure among the signatures' keys it fits, and selects its signature.
        if (LanguageResolver.#mayConstruct(node.argument)) {
            const constructing = signatures.filter(signature => {
                const keyType = keyTypeOf(signature);

                if (this.#constructibleTypeOf(keyType.toNonNullable()) === null) {
                    return false;
                }

                const fits = this.#resolveSpeculatively(() => this.#resolveExpecting(node.argument, keyPointer, scope, keyType), { keepsSuccess: false });

                return fits.error === undefined && this.#typeChecker.isAssignable(fits.result.type.toNonNullable(), keyType.toNonNullable());
            });

            if (constructing.length === 1) {
                return constructing[0];
            }

            if (constructing.length > 1) {
                const subject = declaration.name === undefined ? `The unnamed indexer of ${receiverType?.toNonNullable()}` : `The indexer '${declaration.name}'`;

                this.#fail('NEXO3089', `${subject} is given an object that constructs ${constructing.map(keyTypeOf).map(String).join(', ').replace(/, ([^,]*)$/, ' and $1')} alike, which its signatures take apart; give it a value of one of them`, keyPointer);
            }
        }

        const outcome = this.#resolveSpeculatively(() => this.#resolveNode(node.argument, keyPointer, scope), { keepsSuccess: false });

        if (outcome.error !== undefined) {
            throw outcome.error;
        }

        const keyType = outcome.result.type;

        if (keyType.kind === 'null' || keyType.kind === 'never') {
            return signatures[0];
        }

        const taking = signatures.filter(signature => keyType.kind !== 'any' && this.#typeChecker.isAssignable(keyType.toNonNullable(), keyTypeOf(signature).toNonNullable()));

        if (taking.length === 1) {
            return taking[0];
        }

        const subject = declaration.name === undefined ? `The unnamed indexer of ${receiverType?.toNonNullable()}` : `The indexer '${declaration.name}'`;
        const given = keyType.kind === 'any' ? 'its key is of Any, which selects no signature until its value is known' : `is given ${keyType}`;

        this.#fail('NEXO3084', `${subject} takes ${signatures.map(keyTypeOf).map(String).join(', ').replace(/, ([^,]*)$/, ' or $1')}, and ${given}`, keyPointer);
    }

    /**
     * Refuses a position that is none (NEXO3085): an index's offset is a `Number`, and a range's boundary a `Number` or an `Index`, neither nullable; a never is never evaluated, and a value of Any is checked as it
     * is evaluated.
     */
    #requirePosition(result, what, pointer, allowsIndex) {
        this.#requireValue(result, what, pointer);

        const { type } = result;
        const takes = allowsIndex ? 'a number or an index' : 'a number';

        if (type.kind === 'never' || (type.kind === 'any' && !type.isNullable)) {
            return;
        }

        if (type.isNullable || type.kind === 'null') {
            this.#fail('NEXO3085', `${what} can be null, and is ${takes}`, pointer);
        }

        const isNamed = name => type.kind === 'named' && type.moduleName === null && type.name === name;

        if (!isNamed('Number') && !(allowsIndex && isNamed('Index'))) {
            this.#fail('NEXO3085', `${what} is ${takes}, and this one is ${type}`, pointer);
        }
    }

    #requireNumber(result, what, pointer, operation = 'arithmetic') {
        this.#requireValue(result, what, pointer);

        const { type } = result;

        if (type.kind === 'never') {
            return;
        }

        if (type.isNullable || type.kind === 'null') {
            this.#fail(operation === 'arithmetic' ? 'NEXO3032' : 'NEXO3039', `${what} can be null, and ${operation} takes numbers alone: give it a fallback, as in (… ?? 0), or test it first`, pointer);
        }

        // A value of Any is a number or not as it is evaluated, which checks it then.
        if (type.kind === 'any') {
            return;
        }

        if (type.kind !== 'named' || type.name !== 'Number') {
            this.#fail(operation === 'arithmetic' ? 'NEXO3067' : 'NEXO3078', `${what} is a number, and this one is ${type}; a conversion makes a number of text, as in … to Number`, pointer);
        }
    }

    /** Refuses what an interpolation inserts no text for: what is no value, a value that can be null, which a fallback or a test removes first, and a value of any type but a string or a number, a Boolean's text given by `to`. */
    #requireInterpolationValue(result, pointer) {
        const what = 'An interpolation';

        this.#requireValue(result, what, pointer);

        const { type } = result;

        if (type.kind === 'never') {
            return;
        }

        if (type.isNullable || type.kind === 'null') {
            this.#fail('NEXO3038', `${what} can be null: give it a fallback, as in (… ?? "…"), or test it first`, pointer);
        }

        if (type.kind === 'any') {
            return;
        }

        if (type.kind !== 'named' || (type.name !== 'String' && type.name !== 'Number')) {
            const hint = type.kind === 'named' && type.name === 'Boolean' ? '; give its text with … to String, or choose it with a conditional' : '';

            this.#fail('NEXO3077', `${what} inserts a string or a number, and this one is ${type}${hint}`, pointer);
        }
    }

    /** Refuses what is no value where one is used, a host call, which ends the script alone, and a value whose type no receiver gives, which tells nothing of what it holds. */
    #requireValue(result, what, pointer) {
        if (result.kind !== 'value') {
            this.#fail('NEXO3048', `${what} is a value, and this one is ${LanguageResolver.#descriptionOf(result.kind)}`, pointer);
        }

        if (LanguageResolver.#holdsTypeParameter(result.type)) {
            this.#fail('NEXO3028', `${what} produces ${result.type}, a type no receiver gives`, pointer);
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
                this.#fail('NEXO3048', `The local '${local.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a local is a value`, valuePointer);
            }

            isFixed &&= result.isFixed;
            locals = new Map(locals).set(local.name, { result, initializer: local.value, scope: localScope });
        });

        const resultPointer = `${pointer}/result`;
        const resultScope = { ...scope, locals };
        const result = isTerminal ? this.#resolveTerminal(node.result, resultPointer, resultScope) : this.#resolveNode(node.result, resultPointer, resultScope);

        // A body gives a value, as a field holds one, and returns a host call only where it stands in the script's terminal position.
        if (result.kind !== 'value' && !(isTerminal && result.kind === 'hostCall')) {
            this.#fail('NEXO3048', result.kind === 'hostCall' ? 'A host call ends the script, and this body gives its result to the expression around it, which takes a value' : `A body gives a value, and its result is ${LanguageResolver.#descriptionOf(result.kind)}`, resultPointer);
        }

        return isFixed && result.isFixed ? result : { ...result, isFixed: false };
    }

    /** The local a function declaration gives its name: the function, where it is declared, and the scope it captures, its locals and its implicit parameter. */
    static #functionLocalOf(node, pointer, scope) {
        return { function: node, pointer, scope, result: { type: Type.never, kind: 'function', isFixed: false }, value: node };
    }

    /**
     * Resolves a call of a local function, or of a local or a parameter holding a function reference: its arguments against the caller's scope, as many as each function it may be declares,
     * and then, for each one, a copy of its body of its own, against the scope that function captured and its parameters, typed as this call's arguments, their results merged.
     * A local call settles no fixed argument.
     */
    #resolveFunctionCall(node, pointer, scope) {
        const local = scope.locals.get(node.callee.name);

        if (local === undefined) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.callee.name);

            this.#fail('NEXO3033', `No function named '${node.callee.name}' is in scope${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        const functions = local.function !== undefined ? [local] : (local.result?.type?.kind === 'function' ? local.result.type.functions : null);

        if (functions === null) {
            this.#fail('NEXO3068', `'${node.callee.name}' is a local holding a value, and no function, so it is read without parentheses`, pointer);
        }

        if (local.function === undefined && local.result.type.isNullable) {
            this.#fail('NEXO3068', `'${node.callee.name}' may hold null, and only a function is called: bind one to call in its place first, as let call = ${node.callee.name} ?? other`, pointer);
        }

        // A call of one a reference to a module's function alone is the call its qualified form makes, whatever its arguments' kinds.
        if (functions.length === 1 && functions[0].reference !== undefined && functions[0].isBound !== true) {
            return this.#resolveReferenceCall(node, pointer, scope, local, functions[0].reference);
        }

        for (const target of functions) {
            if (target.reference !== undefined) {
                continue;
            }

            const { parameters } = target.function;

            if (node.arguments.length !== parameters.length) {
                this.#fail('NEXO3069', `'${node.callee.name}' takes ${parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`}, and is given ${node.arguments.length}`, pointer);
            }
        }

        const results = node.arguments.map((argument, index) => {
            const argumentPointer = `${pointer}/arguments/${index}`;
            const result = this.#resolveNode(argument, argumentPointer, scope);

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `An argument of '${node.callee.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and an argument is a value`, argumentPointer);
            }

            return result;
        });

        // A reference bound to its receiver takes it as the reference captured it, before the values the call gives.
        const targets = functions.map((target, index) => (target.reference !== undefined
            ? this.#resolveModuleFunctionCall(target.reference, node, target.isBound === true ? [{ type: target.receiverType, kind: 'value', isFixed: false }, ...results] : results, pointer)
            : this.#resolveScriptFunctionCall(target, node.callee.name, results, node.arguments, scope, functions.length === 1 ? `${pointer}/body` : `${pointer}/bodies/${index}`, pointer)));
        const type = targets.reduce((merged, target) => (merged === null ? null : this.#typeChecker.merge(merged, target.type)), Type.never);

        if (type === null) {
            this.#fail('NEXO3070', `'${node.callee.name}' may be any of ${targets.length} functions, whose results are of no one type: ${targets.map(target => target.type).join(', ')}`, pointer);
        }

        // The callee is the local the call reads its function reference from, which evaluation selects among the functions it may be.
        this.#resolutions.set(pointer, {
            kind: 'invocation',
            functions: targets.map(({ function: declared, body, parameters, reference, argumentMap, resultType }) => (reference === undefined ? { function: declared, body, parameters } : { reference, argumentMap, resultType })),
            callee: node.callee,
        });

        return { type, kind: 'value', isFixed: false };
    }

    /**
     * Resolves the syntax of a call through a known reference to a module's function, the one a local holds: the call its qualified form makes, its arguments interpreted as that form's are, its receiver argument first where its declaration has
     * a receiver, a null one answering null, and its own arguments after it, each of the kind its parameter declares.
     */
    #resolveReferenceCall(node, pointer, scope, local, declaration) {
        const written = this.#referenceNameOf(declaration);

        if (!this.#registry.takesReceiver(declaration)) {
            return this.#storeResolution(pointer, this.#resolveInvocation(declaration, node, pointer, scope, null, written));
        }

        return this.#storeResolution(pointer, this.#resolveQualifiedCall(node, pointer, scope, [declaration], {
            subject: `'${node.callee.name}'`,
            missingReceiver: `'${node.callee.name}' holds a reference to '${written}', which takes its receiver as its first argument`,
            receiverOf: `'${node.callee.name}' holds a reference to '${written}', which takes a receiver of`,
            nameOf: () => written,
        }));
    }

    /**
     * Resolves a call of the module function the declaration is, among the functions a function reference may be, from the results of its arguments, which are evaluated as values, as a call of any of them takes them: its receiver argument
     * first where its declaration has a receiver, then a value for each of its own parameters, each a value parameter its argument fits. It determines their compatibility and answers the reference, its argument map, the result type its implementation answers for this call, its type parameters bound by the receiver,
     * and the call's type, that result type made nullable where its receiver argument, or an argument whose parameter propagates null, can be null.
     */
    #resolveModuleFunctionCall(declaration, node, results, pointer) {
        const written = this.#referenceNameOf(declaration);
        const takesReceiver = this.#registry.takesReceiver(declaration);
        const own = takesReceiver ? results.slice(1) : results;
        const { parameters } = declaration;
        const required = parameters.filter(parameter => parameter.required).length;

        if (parameters.some(parameter => parameter.kind !== 'value') || declaration.arguments === 'options') {
            this.#fail('NEXO3079', `'${node.callee.name}' may hold a reference to '${written}', whose arguments are no values alone, and a call of a value that may be one of several functions gives each values; call it through '${written}(…)'`, pointer);
        }

        const takes = `${takesReceiver ? 'its receiver and ' : ''}${parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`}`;

        if ((takesReceiver && results.length === 0) || own.length < required) {
            this.#fail('NEXO3080', `'${node.callee.name}' may hold a reference to '${written}', which takes ${takes}, and is given ${node.arguments.length}`, pointer);
        }

        if (own.length > parameters.length) {
            this.#fail('NEXO3058', `'${node.callee.name}' may hold a reference to '${written}', which takes ${takes}, and is given ${node.arguments.length}`, pointer);
        }

        let isNullable = false;
        let typeArguments = new Map();

        if (takesReceiver) {
            const receiverType = results[0].type;
            const inferred = LanguageResolver.#isNullOrNever(receiverType.toNonNullable()) ? typeArguments : this.#typeChecker.inferReceiverTypeArguments(declaration, receiverType.toNonNullable());

            typeArguments = inferred ?? typeArguments;

            if (inferred === null) {
                this.#fail('NEXO3042', `'${node.callee.name}' may hold a reference to '${written}', which takes a receiver of ${this.#registry.getReceiverTypes(declaration).join(', ')}, and is given ${receiverType.toNonNullable()}`, `${pointer}/arguments/0`);
            }

            isNullable = receiverType.isNullable || receiverType.kind === 'null';
        }

        // Its own type parameters are bound by the values it is given, as a call's value arguments bind them.
        const evidence = new Map();

        own.forEach((result, index) => {
            if (result.type.kind !== 'function') {
                this.#typeChecker.extractTypeArgumentEvidence(this.#registry.getDeclaredType(declaration, parameters[index].type), result.type, evidence);
            }
        });
        this.#bindTypeArguments(declaration, evidence, typeArguments, pointer);

        own.forEach((result, index) => {
            const parameter = parameters[index];
            const expected = this.#registry.getDeclaredType(declaration, parameter.type).resolveTypeParameters(typeArguments);

            this.#requireArgumentType(result, expected, parameter, declaration, `${pointer}/arguments/${index + (takesReceiver ? 1 : 0)}`);

            if (LanguageResolver.#propagatesNull(result, parameter)) {
                isNullable = true;
            }
        });

        const declared = this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(typeArguments);

        return { reference: declaration, type: isNullable ? declared.toNullable() : declared, resultType: declared, argumentMap: LanguageResolver.#createArgumentMap(declaration, own.length) };
    }

    /**
     * The argument map of a call of a reference to a module's function given the number of its own arguments, those after its receiver where it has one: the parameter each of them binds, in order, with whether a null it is given makes the call
     * answer null without invoking the implementation, and the default each parameter left out takes, so evaluation binds the arguments without reading the parameters again.
     */
    static #createArgumentMap(declaration, count) {
        const { parameters } = declaration;

        return {
            supplied: parameters.slice(0, count).map(parameter => ({ name: parameter.name, propagatesNull: parameter.nulls === 'propagate' })),
            defaults: parameters.slice(count).map(parameter => ({ name: parameter.name, value: parameter.default })),
        };
    }

    /**
     * Resolves one call of a script function: copies its body for the call, so the same function serves calls of different types, registers the copy under the copy's pointer, where each resolution in it is kept and a failure in it is
     * located back to the body it copies, and resolves the copy against the scope the function captured
     * and its parameters, each holding what the call gives it. It refuses a call reaching a function whose body is being resolved, directly or through a function passed to it (NEXO3034), and a body that gives no value
     * (NEXO3048).
     */
    #resolveScriptFunctionCall(target, name, argumentResults, argumentNodes, callerScope, bodyCopyPointer, callPointer) {
        const { parameters, body } = target.function;

        if (this.#functionsBeingResolved.has(target.function)) {
            this.#fail('NEXO3034', `'${name}' would call a function within its own call, through a function passed to it: a function never calls itself, directly or through another`, callPointer);
        }

        let locals = target.scope.locals;

        parameters.forEach((parameter, index) => {
            locals = new Map(locals).set(parameter, { result: argumentResults[index], value: argumentNodes?.[index] ?? null, scope: callerScope });
        });

        const bodyCopy = DefinitionValidator.copyOf(body);

        this.#functionBodyCopies.push({ node: bodyCopy, pointer: bodyCopyPointer, bodyPointer: `${target.pointer}/body` });
        this.#functionsBeingResolved.add(target.function);

        let result;

        try {
            result = this.#resolveNode(bodyCopy, bodyCopyPointer, { ...target.scope, locals });
        } finally {
            this.#functionsBeingResolved.delete(target.function);
        }

        if (result.kind !== 'value') {
            this.#fail('NEXO3048', `'${name}' gives ${LanguageResolver.#descriptionOf(result.kind)}, and a function gives a value`, bodyCopyPointer);
        }

        return { function: target.function, body: bodyCopy, parameters, type: result.type };
    }

    /** The functions whose bodies are being resolved, each for a call within which none is called again. @type {Set<object>} */
    #functionsBeingResolved = new Set();

    /** Resolves a local: what the one in scope with its name resolved to where it was written. A name no local in scope has is refused, with the form of the implicit parameter's member of that name where it has one. */
    #resolveLocal(node, pointer, scope) {
        const local = scope.locals.get(node.name);

        // A function's name read without a call is a function reference, which a local holds, an argument passes and a function returns.
        if (local?.function !== undefined) {
            this.#resolutions.set(pointer, { kind: 'local', name: node.name, initializer: local.initializer });

            return { type: Type.createFunctionType([local]), kind: 'value', isFixed: false };
        }

        if (local?.optionKind !== undefined) {
            this.#fail('NEXO3046', LanguageResolver.#unreadableOptionMessageOf(node.name, local.optionKind), pointer);
        }

        if (local === undefined) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.name);

            this.#fail('NEXO2012', `No local, object field, conditional binding or function parameter named '${node.name}' is in scope${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        // A conditional binding's value is evaluated once, by its conditional, which holds it in a frame its consequent reads as any local's; each records the expression its value came from.
        this.#resolutions.set(pointer, { kind: 'local', name: node.name, initializer: local.initializer });

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

        if (joined === undefined || LanguageResolver.#isNullOrNever(receiverType)) {
            return '';
        }

        const name = this.#registry.receiverMemberNames.find(candidate => candidate.toLowerCase() === joined && this.#memberForm(receiverType, candidate) !== null);

        if (name === undefined) {
            return '';
        }

        // The access written with the member's name, less that name, is its receiver as the access writes it, grouped where it needs to be and ending in `?` where the access is optional.
        const receiver = DefinitionWriter.quote({ ...node, name }, this.#namespaceNames).slice(0, -(name.length + 1));

        return `. Did you mean '${this.#memberForm(receiverType, name, receiver)}'?`;
    }

    /** How the member of the type with the name is written after the receiver, `it` unless another is given, or null where the type has none. */
    #memberForm(type, name, receiver = 'it') {
        if ((type.kind === 'object' ? type.getObjectFieldType(name) : (this.#registry.getDataShape(type)?.get(name) ?? null)) !== null) {
            return `${receiver}.${name}`;
        }

        const selection = this.#memberSelector.select(this.#receiverMembersNamed(name), type);

        if (selection.kind !== 'selected') {
            return null;
        }

        const { declaration } = selection;

        if (declaration.kind === 'property') {
            return `${receiver}.${name}`;
        }

        return declaration.kind === 'indexer' ? `${receiver}.${name}[…]` : `${receiver}.${name}(…)`;
    }

    #resolveLiteral(node) {
        const { value } = node;
        const type = value === null ? Type.null : Type.createPrimitiveType(value);

        return { type, kind: 'value', isFixed: true, value };
    }

    #resolveParameter(node, pointer, scope) {
        if (!this.#bindings.has(node.name) && DefinitionValidator.isWrittenAlone(node) && this.#registry.getModule(node.name) !== undefined && node.name !== Vocabulary.moduleName) {
            this.#fail('NEXO3003', `'${node.name}' names a registered module, which the script does not import, and no script parameter of that name is bound: write 'import ${node.name}' at the script's start to read its namespace`, pointer);
        }

        // A name a text wrote alone, which no local in scope has, reads the script parameter of its name, and one the host did not bind may be a member written without its receiver; one written with `~`, or a definition's, names a script parameter alone, which reads no local.
        if (!this.#bindings.has(node.name) && !DefinitionValidator.isWrittenAlone(node)) {
            const local = scope.locals.has(node.name) ? `, and '~${node.name}' reads a script parameter alone: write '${Names.needsPrefix(node.name, this.#namespaceNames) ? '@' : ''}${node.name}' for the local, object field, conditional binding or function parameter of that name` : '';

            this.#fail('NEXO3051', `No script parameter is named '${node.name}'${local}`, pointer);
        }

        if (!this.#bindings.has(node.name)) {
            const form = scope.contextType === null ? null : this.#memberForm(scope.contextType, node.name);

            this.#fail('NEXO3009', `No local in scope or script parameter is named '${node.name}'${form === null ? '' : `; write '${form}' for the member of the implicit parameter`}`, pointer);
        }

        return { type: scope.facts.get(`@${node.name}`) ?? this.#bindings.getType(node.name), kind: 'value', isFixed: true, value: this.#bindings.readValue(node.name) };
    }

    /**
     * Resolves a property access, a call of a member or an indexer on its receiver, the access's receiver resolved where it stands unless its resolution is given, as an indexer gives the receiver it has resolved already;
     * the optional form, which a message gives where the receiver can be null, is the node written with it unless another is given. An access selecting an extension explicitly selects among its members alone, its
     * selection located where the definition holds it, a named indexer's on the access of its name, which the indexer gives.
     */
    #resolveMemberAccess(node, pointer, scope, { receiver: given, optionalForm = LanguageResolver.#asOptional(node), extensionPointer = LanguageResolver.#extensionPointerOf(node, pointer) } = {}) {
        const access = LanguageResolver.#accessOf(node);

        if (access.receiver.kind === 'namespace') {
            if (access.extension !== undefined) {
                this.#fail('NEXO3026', `'${access.receiver.name}' is a module's namespace, whose members are read after a dot, and no extension extends a namespace`, extensionPointer);
            }

            return this.#resolveThroughNamespace(node, pointer, scope);
        }

        const receiver = given ?? this.#resolveNode(access.receiver, LanguageResolver.#receiverPointerOf(node, pointer), scope);
        const isUnnamedIndexer = node.kind === 'indexerAccess' && node.name === undefined;
        const written = isUnnamedIndexer ? '[…]' : typeof access.name === 'string' ? access.name : `.[${DefinitionWriter.quote(access.name, this.#namespaceNames)}]`;

        if (receiver.kind !== 'value') {
            this.#fail('NEXO3048', `'${written}' follows ${LanguageResolver.#descriptionOf(receiver.kind)}, which takes no members`, pointer);
        }

        // A member requires a receiver that cannot be null, and an optional one reads it where it is not null, ending its chain with null where it is.
        if (receiver.type.isNullable) {
            if (access.optional !== true) {
                const follows = receiver.type.kind === 'null' ? 'null' : `${receiver.type}, which can be null`;

                this.#fail(access.extension === undefined ? 'NEXO3008' : 'NEXO3063', `'${written}' follows ${follows}: write '${DefinitionWriter.quote(optionalForm, this.#namespaceNames)}' to read it where it is not`, pointer);
            }

            this.#optionalChains.at(-1).shortCircuits = true;
        }

        const receiverType = access.optional === true ? receiver.type.toNonNullable() : receiver.type;

        if (access.extension !== undefined) {
            return this.#storeResolution(pointer, this.#resolveThroughExtension(node, pointer, scope, receiverType, extensionPointer));
        }

        if (isUnnamedIndexer) {
            return this.#resolveUnnamedIndexerAccess(node, pointer, scope, receiverType);
        }

        if (typeof access.name !== 'string') {
            return this.#resolveComputedPropertyAccess(node, pointer, scope, receiverType);
        }

        return this.#storeResolution(pointer, this.#resolveMemberOnReceiverType(node, pointer, scope, receiverType));
    }

    /**
     * Resolves an indexer. Where what is before its brackets is a member access, by a written name, of a receiver whose type has a named indexer of that name, it is that named indexer, the access giving its receiver
     * and its name and never read alone; once a named indexer applies, a key it refuses is its own error, and never makes the brackets another reading. Optional brackets add nothing to a named indexer, which has
     * no value between its name and its key, so only its access's own marker makes its receiver optional. Otherwise it is the unnamed indexer of the type what is before its brackets answers, which optional
     * brackets skip where that is null.
     */
    #resolveIndexerAccess(node, pointer, scope) {
        const access = node.receiver;

        if (access.kind === 'memberAccess' && typeof access.name === 'string' && access.receiver.kind !== 'namespace' && access.extension !== undefined) {
            return this.#resolveExtensionIndexerAccess(node, pointer, scope);
        }

        if (access.kind !== 'memberAccess' || typeof access.name !== 'string' || access.receiver.kind === 'namespace' || access.extension !== undefined) {
            return this.#resolveMemberAccess(node, pointer, scope);
        }

        // The access's receiver is resolved once, and given to whichever reading applies, so a chain of indexers resolves each part once.
        const accessPointer = `${pointer}/receiver`;
        const receiver = this.#resolveNode(access.receiver, `${accessPointer}/receiver`, scope);
        const kind = this.#memberKindNamedBy(access, receiver);

        // A function's arguments are written in parentheses, so brackets after its name are a call written as an indexer.
        if (kind === 'function') {
            this.#fail('NEXO3054', `'${access.name}' uses call syntax: write '${DefinitionWriter.quote(LanguageResolver.#createCall(access, [node.argument]), this.#namespaceNames)}'`, pointer);
        }

        if (kind !== 'indexer') {
            const accessResult = this.#resolveMemberAccess(access, accessPointer, scope, { receiver });

            return this.#resolveMemberAccess(node, pointer, scope, { receiver: accessResult });
        }

        // The named indexer's own node, which no definition holds: its receiver the access's, its name the access's, optional where the access is.
        const named = { kind: 'indexerAccess', receiver: access.receiver, name: access.name, argument: node.argument, ...(access.optional === true ? { optional: true } : {}) };
        return this.#resolveMemberAccess(named, pointer, scope, { receiver, optionalForm: { ...node, receiver: { ...access, optional: true } } });
    }

    /**
     * Resolves brackets after an extension access: an extension's named indexer of the access's name, the access giving its receiver, its name and its selection and never read alone, where the extension it names, or
     * for an access naming none an extension the script's imports make available, declares one; and otherwise the unnamed indexer of what the access answers, as brackets after any member's answer index it.
     */
    #resolveExtensionIndexerAccess(node, pointer, scope) {
        const access = node.receiver;
        const accessPointer = `${pointer}/receiver`;
        const extension = access.extension.name === undefined ? null : this.#resolveExtension(access.extension, `${accessPointer}/extension`);
        const declared = extension === null ? this.#imported.getAvailable(this.#membersReadBy(access)) : this.#registry.getReceiverMembers(access.name).filter(declaration => this.#registry.getContainingType(declaration) === extension);
        const isNamedIndexer = declared.some(declaration => declaration.kind === 'indexer');

        // A function's arguments are written in parentheses, so brackets after its name are a call written as an indexer.
        if (!isNamedIndexer && declared.length > 0 && declared.every(declaration => declaration.kind === 'function')) {
            this.#fail('NEXO3054', `'${access.name}' uses call syntax: write '${DefinitionWriter.quote(LanguageResolver.#createCall(access, [node.argument]), this.#namespaceNames)}'`, pointer);
        }

        if (!isNamedIndexer) {
            return this.#resolveMemberAccess(node, pointer, scope);
        }

        const receiver = this.#resolveNode(access.receiver, `${accessPointer}/receiver`, scope);
        const named = { kind: 'indexerAccess', receiver: access.receiver, name: access.name, argument: node.argument, extension: access.extension, ...(access.optional === true ? { optional: true } : {}) };

        return this.#resolveMemberAccess(named, pointer, scope, { receiver, optionalForm: { ...node, receiver: { ...access, optional: true } }, extensionPointer: `${accessPointer}/extension` });
    }

    /**
     * The extension an access selects explicitly, read as a script's type name is, ordinary types taking no part: where its module's local name qualifies it, that module's public extension of the name; otherwise the
     * extension a type import gives the name, and else the one public extension of the name among Nexo's own and the modules the script imports, several refused with their qualified names (NEXO3061). One only
     * modules the script does not import declare is refused giving the import (NEXO3005), an internal one as internal (NEXO3023), and a name no reachable extension has as naming none (NEXO3026), saying so where
     * an ordinary type has it, and giving the hint, the access of the receiver's member of that name, where the caller has one.
     */
    #resolveExtension(selection, pointer, hint = '') {
        const written = selection.module === undefined ? selection.name : `${selection.module}.${selection.name}`;
        const ordinaryType = `; '${written}' is an ordinary type, and the name after ':' is an extension's`;

        if (selection.module !== undefined) {
            const moduleName = this.#imported.getNamespaceModule(selection.module);
            const declaration = this.#registry.getModuleType(moduleName, selection.name);

            if (declaration?.kind !== 'extension') {
                this.#fail('NEXO3026', `'${written}' names no extension${declaration === undefined ? '' : ordinaryType}`, pointer);
            }

            if (this.#registry.isInternal(declaration)) {
                this.#failInternal(`The extension '${written}'`, moduleName, pointer);
            }

            return declaration;
        }

        const imported = this.#imported.getImportedExtension(selection.name);

        if (imported !== undefined) {
            return imported;
        }

        const reached = [Vocabulary.moduleName, ...this.#imported.importedModuleNames].map(moduleName => this.#registry.getModuleType(moduleName, selection.name)).filter(declaration => declaration?.kind === 'extension');
        const extensions = reached.filter(declaration => !this.#registry.isInternal(declaration));

        if (extensions.length > 1) {
            this.#fail('NEXO3061', `'${written}' names an extension several modules the script imports declare, so it is named qualified: ${extensions.map(declaration => `'${this.#formatExtensionName(declaration)}'`).join(' or ')}`, pointer);
        }

        if (extensions.length === 1) {
            return extensions[0];
        }

        if (reached.length > 0) {
            this.#failInternal(`The extension '${written}'`, this.#registry.getDeclaringModuleName(reached[0]), pointer);
        }

        const unimported = this.#registry.moduleNames.filter(moduleName => {
            const declaration = this.#registry.getModuleType(moduleName, selection.name);

            return declaration?.kind === 'extension' && !this.#registry.isInternal(declaration) && !this.#imported.importsModule(moduleName);
        });

        if (unimported.length > 0) {
            this.#fail('NEXO3005', `The extension '${written}' is declared only by ${unimported.map(module => `'${module}'`).join(' and ')}, which the script does not import: write ${unimported.map(module => `'import ${module}'`).join(' or ')} at the script's start`, pointer);
        }

        const isOrdinaryType = Vocabulary.ownTypeNames.includes(selection.name) || this.#registry.resolveTypeName(selection.name, this.#imported.typeNameScope).types.length > 0;

        this.#fail('NEXO3026', `'${written}' names no extension the script reaches${isOrdinaryType ? ordinaryType : ''}${hint}`, pointer);
    }

    /**
     * The hint an extension access naming no extension gives where an extension member's name stands in its extension's place, as `device:readings.first` writes one: the access of what that member answers, grouped,
     * `(device:readings).first`, where an extension member the script reaches of that name applies to the receiver; none otherwise.
     */
    #memberHintOf(node, receiverType) {
        const access = LanguageResolver.#accessOf(node);
        const { name, module } = access.extension;
        const isKnown = !LanguageResolver.#isNullOrNever(receiverType) && receiverType.kind !== 'any';
        const members = this.#imported.getAvailable(this.#membersReadBy({ name, extension: {} }));

        if (module !== undefined || !isKnown || !members.some(declaration => this.#typeChecker.matchesReceiver(declaration, receiverType))) {
            return '';
        }

        const member = { kind: 'memberAccess', receiver: access.receiver, name, ...(access.optional === true ? { optional: true } : {}), extension: {} };
        // The access of what the member answers is an ordinary one, written after the member's group.
        const rest = Object.fromEntries(Object.entries(access).filter(([key]) => key !== 'extension' && key !== 'optional'));
        const written = node.kind === 'call' ? { ...node, callee: { ...rest, receiver: member } } : { ...rest, receiver: member };

        return `: write '${DefinitionWriter.quote(written, this.#namespaceNames)}' for the access of what the extension member '${name}' answers`;
    }

    /** How the script writes the extension's name: the local name a type import gives it, else qualified by the local name its module's import gives, else its own name for one of Nexo's, and qualified by its module otherwise. */
    #formatExtensionName(extension) {
        const moduleName = this.#registry.getDeclaringModuleName(extension);
        const localName = this.#imported.getLocalNameOf(extension);

        if (localName !== undefined) {
            return localName;
        }

        if (moduleName === Vocabulary.moduleName) {
            return extension.name;
        }

        return `${this.#imported.getNamespaceName(moduleName) ?? moduleName}.${extension.name}`;
    }

    /**
     * Resolves an extension access on a receiver of the type, its null policy applied. Naming no extension, it selects among the extension members of its name the script's imports make available, the most specific
     * extension's; naming one, among that extension's members of its name alone. A member none of them declares is refused (NEXO3062), never falling through to the owner's members or to
     * another extension's. A function read without a call is a reference bound to its receiver. It answers the result, the resolution and the use, which the caller stores.
     */
    #resolveThroughExtension(node, pointer, scope, receiverType, extensionPointer) {
        return LanguageResolver.#accessOf(node).extension.name === undefined
            ? this.#resolveExtensionMember(node, pointer, scope, receiverType)
            : this.#resolveThroughNamedExtension(node, pointer, scope, receiverType, extensionPointer);
    }

    /**
     * Resolves an extension access naming no extension: the selector chooses among the extension members of its name the script's imports make available that apply to the receiver, the most specific, several none of which
     * is more specific refused as ambiguous (NEXO3024), giving the access naming each extension; one only modules the script does not import declare refused giving the import (NEXO3005), and none at all (NEXO3062),
     * giving the owner's member of its name where one applies. A receiver of unknown type chooses none, and a value of Any selects among them as it is evaluated, as ordinary access does.
     */
    #resolveExtensionMember(node, pointer, scope, receiverType) {
        const access = LanguageResolver.#accessOf(node);
        const declared = this.#membersReadBy(access);

        if (LanguageResolver.#isNullOrNever(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiverType, declared);
        }

        if (receiverType.kind === 'any') {
            return this.#resolveDeferredAccess(node, pointer, scope);
        }

        const selection = this.#memberSelector.select(this.#imported.getAvailable(declared), receiverType);
        const subject = `'${access.name}' on ${receiverType.toNonNullable()}`;

        if (selection.kind === 'none') {
            this.#refuseUnimported(declared, receiverType, subject, pointer);

            const form = this.#memberForm(receiverType, access.name, DefinitionWriter.quote(access.receiver, this.#namespaceNames));

            this.#fail('NEXO3062', `No extension the script reaches declares '${access.name}' for ${receiverType.toNonNullable()}${form === null ? '' : `: write '${form}' for its owner's member`}`, pointer);
        }

        if (selection.kind === 'internal') {
            this.#failInternal(subject, this.#registry.getDeclaringModuleName(selection.declarations[0]), pointer);
        }

        if (selection.kind === 'ambiguous') {
            this.#fail('NEXO3024', `'${access.name}' ${this.#formatCompetingDeclarations(selection.declarations, receiverType, access.receiver)}`, pointer);
        }

        const { declaration } = selection;
        const name = this.#qualifiedNameOf(declaration, receiverType);

        if (node.kind === 'memberAccess' && declaration.kind === 'function') {
            return this.#resolveBoundFunctionReference(declaration, node, pointer, receiverType, name);
        }

        this.#requireDeclaredForm(declaration, node, pointer);

        return this.#resolveInvocation(declaration, node, pointer, scope, { node: access.receiver, type: receiverType, isNullable: receiverType.isNullable }, name);
    }

    /**
     * Resolves an extension access naming its extension: among the extension's members of the access's name and form alone, a member it does not declare refused (NEXO3062). The selector chooses for the receiver, one
     * outside the extension's target refused (NEXO3027); a receiver of unknown type chooses none, as it does in ordinary lookup; a value of Any invokes the one member the extension declares, its receiver checked against
     * the target as it is evaluated.
     */
    #resolveThroughNamedExtension(node, pointer, scope, receiverType, extensionPointer) {
        const access = LanguageResolver.#accessOf(node);
        const extension = this.#resolveExtension(access.extension, extensionPointer, this.#memberHintOf(node, receiverType));
        // A message names the extension as the access writes it.
        const written = access.extension.module === undefined ? access.extension.name : `${access.extension.module}.${access.extension.name}`;
        const declared = this.#registry.getReceiverMembers(access.name).filter(declaration => this.#registry.getContainingType(declaration) === extension);

        if (declared.length === 0) {
            this.#fail('NEXO3062', `The extension '${written}' declares no member '${access.name}'`, pointer);
        }

        if (LanguageResolver.#isNullOrNever(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiverType, declared);
        }

        const isAny = receiverType.kind === 'any';
        const selection = isAny ? { kind: 'selected', declaration: declared[0] } : this.#memberSelector.select(declared, receiverType);

        if (selection.kind === 'internal' || (isAny && this.#memberSelector.getAccessible(declared).length === 0)) {
            this.#failInternal(`'${written}.${access.name}'`, this.#registry.getDeclaringModuleName(extension), pointer);
        }

        if (selection.kind !== 'selected') {
            this.#fail('NEXO3027', `The extension '${written}' extends ${this.#registry.getReceiverTypes(declared[0]).join(', ')}, and ${receiverType.toNonNullable()} does not satisfy it`, pointer);
        }

        const { declaration } = selection;
        const name = `${written}.${declaration.name}`;

        if (node.kind === 'memberAccess' && declaration.kind === 'function') {
            return this.#resolveBoundFunctionReference(declaration, node, pointer, receiverType, name);
        }

        this.#requireDeclaredForm(declaration, node, pointer);

        const resolved = this.#resolveInvocation(declaration, node, pointer, scope, { node: access.receiver, type: receiverType, isNullable: receiverType.isNullable }, name);

        // A value of Any is checked against the extension's target as the access evaluates it, which no resolution can do before.
        return isAny ? { ...resolved, resolution: { ...resolved.resolution, checksReceiver: true } } : resolved;
    }

    /**
     * Resolves a function an extension access reads without a call: a reference bound to its receiver, which evaluation evaluates and captures once, as it creates the reference, and which takes the function's own arguments
     * alone, its receiver's type binding the type parameters its extension's target writes. A host call has none, since its host invokes it (NEXO3076).
     */
    #resolveBoundFunctionReference(declaration, node, pointer, receiverType, name) {
        if (NexoModule.isInvokedByHost(declaration)) {
            this.#fail('NEXO3076', `'${name}' is a host call, which its host invokes, so it has no reference`, pointer);
        }

        const type = Type.createFunctionType([Object.freeze({ reference: declaration, isBound: true, receiverType: receiverType.toNonNullable() })]);
        const resolution = { kind: 'boundFunctionReference', declaration, receiverNode: node.receiver, ...(receiverType.kind === 'any' ? { checksReceiver: true } : {}) };

        return { result: { type, kind: 'value', isFixed: false }, resolution, use: { declaration, qualifiedName: name, pointer } };
    }

    /**
     * The kind of the member the access names on its receiver's type, `indexer` for a named indexer and `function` for a function, among the declarations of its name for that type, or, on a receiver of unknown type,
     * `indexer` where any declaration of its name is a named indexer; null where none is either, as a property's or a field's name is, given the access's receiver as it resolved. It decides how brackets after the access read.
     */
    #memberKindNamedBy(access, receiver) {
        const declarations = this.#receiverMembersNamed(access.name).filter(declaration => declaration.kind !== 'property');

        if (declarations.length === 0 || receiver.kind !== 'value') {
            return null;
        }

        const receiverType = access.optional === true ? receiver.type.toNonNullable() : receiver.type;

        if (LanguageResolver.#isNullOrNever(receiverType) || receiverType.kind === 'any') {
            return declarations.some(declaration => declaration.kind === 'indexer') ? 'indexer' : null;
        }

        if (receiverType.kind === 'objectRoot' || (receiverType.kind === 'object' ? receiverType.getObjectFieldType(access.name) : (this.#registry.getDataShape(receiverType)?.get(access.name) ?? null)) !== null) {
            return null;
        }

        // The member of the name the receiver selects decides, a property among them, which hides an indexer of its name above it.
        const selection = this.#memberSelector.select(this.#receiverMembersNamed(access.name), receiverType);

        return selection.kind !== 'selected' || selection.declaration.kind === 'property' ? null : selection.declaration.kind;
    }

    /**
     * Resolves an unnamed indexer: the one indexer declared without a name for the receiver's type, resolved as an invocation of it given its key.
     * A receiver of unknown type chooses none, and takes the key every unnamed indexer could; a receiver whose type has none is refused, with the computed property access its key may mean.
     */
    #resolveUnnamedIndexerAccess(node, pointer, scope, receiverType) {
        const unnamedIndexers = this.#registry.getUnnamedIndexers();

        if (LanguageResolver.#isNullOrNever(receiverType)) {
            return this.#storeResolution(pointer, this.#resolveOnUnknownType(node, pointer, scope, receiverType, unnamedIndexers));
        }

        if (receiverType.kind === 'any') {
            return this.#storeResolution(pointer, this.#resolveDeferredAccess(node, pointer, scope));
        }

        if (receiverType.kind === 'objectRoot') {
            return this.#storeResolution(pointer, this.#resolveObjectRootField(node, pointer, receiverType));
        }

        const selection = this.#memberSelector.select(this.#imported.getAvailable(unnamedIndexers), receiverType);

        if (selection.kind === 'none') {
            this.#refuseUnimported(unnamedIndexers, receiverType, `The unnamed indexer of ${receiverType.toNonNullable()}`, pointer);
        }

        if (selection.kind === 'internal') {
            this.#failInternal(`The unnamed indexer of ${receiverType.toNonNullable()}`, this.#registry.getDeclaringModuleName(selection.declarations[0]), pointer);
        }

        if (selection.kind === 'none') {
            // A string key may name a property of the receiver, which a computed property access reads.
            const key = node.argument.kind === 'literal' ? node.argument.value : null;
            const isNamed = typeof key === 'string' && ((receiverType.kind === 'object' ? receiverType.getObjectFieldType(key) : (this.#registry.getDataShape(receiverType)?.get(key) ?? null)) !== null || this.#receiverMembersNamed(key).some(declaration => declaration.kind === 'property' && this.#typeChecker.matchesReceiver(declaration, receiverType)));
            const computed = isNamed ? DefinitionWriter.quote({ kind: 'memberAccess', receiver: node.receiver, name: node.argument, ...(node.optional === true ? { optional: true } : {}) }, this.#namespaceNames) : null;

            this.#fail('NEXO3012', `${receiverType.toNonNullable()} has no unnamed indexer${computed === null ? '' : `: write '${computed}' for a property read by a computed name`}`, pointer);
        }

        if (selection.kind === 'ambiguous') {
            this.#fail('NEXO3024', `The unnamed indexers ${this.#formatCompetingDeclarations(selection.declarations, receiverType, node.receiver)}`, pointer);
        }

        const { declaration } = selection;
        const receiver = { node: node.receiver, type: receiverType, isNullable: receiverType.isNullable };

        return this.#storeResolution(pointer, this.#resolveInvocation(declaration, node, pointer, scope, receiver, this.#qualifiedNameOf(declaration, receiverType)));
    }

    /**
     * Resolves a computed property access: the names its expression can give, which preparation determines, each a property of the receiver, their types of one type as a conditional's branches are.
     * The resolution keeps each name's, so evaluation reads the one the name selects; on a receiver of unknown type, whether each is a property and whether their types agree are checked once its type is known.
     * Each name's use is recorded as soon as the name is resolved, after any its resolution records, and the access stores its own resolution alone.
     */
    #resolveComputedPropertyAccess(node, pointer, scope, receiverType) {
        const namePointer = `${pointer}/name`;

        // A number names no property, and is the key an unnamed indexer takes.
        if (node.name.kind === 'literal' && typeof node.name.value === 'number') {
            this.#fail('NEXO3055', `A computed property access reads a property by its name, a string, and a number is an indexer's key: write '${DefinitionWriter.quote({ kind: 'indexerAccess', receiver: node.receiver, argument: node.name, ...(node.optional === true ? { optional: true } : {}) }, this.#namespaceNames)}'`, namePointer);
        }
        const name = this.#resolveNode(node.name, namePointer, scope);
        const possible = name.kind === 'value' ? this.#possibleNamesOf(node.name, scope) : null;

        if (possible === null) {
            this.#fail('NEXO3014', `A computed property access reads a name determined when the expression is resolved, which a string literal, null, a script parameter, a local or a conditional binding holding one, or a conditional, a '??', an 'and' or an 'or' of them gives, and '${DefinitionWriter.quote(node.name, this.#namespaceNames)}' is none of them`, namePointer);
        }

        if (possible.canBeOther) {
            this.#fail('NEXO3013', `A computed property access reads a string, and '${DefinitionWriter.quote(node.name, this.#namespaceNames)}' can be a value that is not one`, namePointer);
        }

        if (possible.canBeFalse) {
            this.#fail('NEXO3013', `A computed property access reads a string, and '${DefinitionWriter.quote(node.name, this.#namespaceNames)}' can be false`, namePointer);
        }

        if (possible.canBeNull || possible.names.size === 0) {
            this.#fail('NEXO3013', `A computed property access reads a string, and '${DefinitionWriter.quote(node.name, this.#namespaceNames)}' can be null`, namePointer);
        }

        const resolutionsByName = new Map();
        const types = [];

        for (const candidate of possible.names) {
            const access = { kind: 'memberAccess', receiver: node.receiver, name: candidate, ...(node.optional === true ? { optional: true } : {}) };
            const { result, resolution, use } = this.#resolveMemberOnReceiverType(access, pointer, scope, receiverType, true);

            types.push(result.type);
            resolutionsByName.set(candidate, resolution);

            if (use !== null) {
                this.#usedDeclarations.push(use);
            }
        }

        let type = types.reduce((merged, candidateType) => (merged === null ? null : this.#typeChecker.merge(merged, candidateType)), Type.never);

        if (type === null) {
            if (!LanguageResolver.#isNullOrNever(receiverType)) {
                this.#fail('NEXO3015', `The properties '${DefinitionWriter.quote(node.name, this.#namespaceNames)}' can name are of one type, and these are ${types.join(', ')}`, namePointer);
            }

            type = Type.null;
        }

        this.#resolutions.set(pointer, { kind: 'computedPropertyAccess', resolutionsByName });

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
            case 'scriptParameter':
                return LanguageResolver.#possibleOf(this.#bindings.readValue(node.name));
            case 'local': {
                const local = scope.locals.get(node.name);
                const possible = local === undefined ? null : this.#possibleNamesOf(local.initializer, local.scope);

                // A conditional binding's name is used where its value is truthy.
                return possible !== null && local.conditional !== undefined ? LanguageResolver.#partOfPossible(possible, true) : possible;
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
        const isBoolean = type.kind === 'named' && type.name === 'Boolean';

        return { names: new Set(), canBeNull: type.isNullable, canBeFalse: isBoolean, canBeOther: false };
    }

    /**
     * Resolves the member the node names on a receiver of the type, which its receiver's null policy has already been applied to, the name one a computed property access settled to where it is computed. It answers the
     * access's result, its resolution and the use of its declaration, none for a stored value or a receiver of unknown type, and records neither; resolving its arguments records theirs, as resolving any node does.
     */
    #resolveMemberOnReceiverType(node, pointer, scope, receiverType, isComputed = false) {
        const access = LanguageResolver.#accessOf(node);

        if (LanguageResolver.#isNullOrNever(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiverType);
        }

        if (receiverType.kind === 'any') {
            return this.#resolveDeferredAccess(node, pointer, scope);
        }

        if (receiverType.kind === 'objectRoot') {
            return this.#resolveObjectRootField(node, pointer, receiverType);
        }

        // An object type's object field is read by its name, as the object expression or the binding that gave the object holds it.
        const fieldType = receiverType.getObjectFieldType(access.name);

        if (fieldType !== null) {
            this.#requireReadWithoutArgument(node, pointer, `an object field of ${receiverType.toNonNullable()}`);

            return { result: { type: receiverType.isNullable ? fieldType.toNullable() : fieldType, kind: 'value', isFixed: false }, resolution: { kind: 'objectField', name: access.name }, use: null };
        }

        const declared = this.#membersReadBy(access);

        if (declared.length === 0) {
            this.#refuseExtensionMemberRead(node, pointer, receiverType, isComputed);
            this.#fail(isComputed ? 'NEXO3056' : 'NEXO3001', `'${access.name}' is no member of the vocabulary${this.#joinedNameHintOf(node, receiverType)}`, pointer);
        }

        const candidates = this.#imported.getAvailable(declared);
        const selection = this.#memberSelector.select(candidates, receiverType);

        if (selection.kind === 'none') {
            this.#refuseExtensionMemberRead(node, pointer, receiverType, isComputed);
            this.#refuseUnimported(declared, receiverType, `'${access.name}' on ${receiverType.toNonNullable()}`, pointer);
        }

        if (selection.kind === 'internal') {
            this.#failInternal(`'${access.name}' on ${receiverType.toNonNullable()}`, this.#registry.getDeclaringModuleName(selection.declarations[0]), pointer);
        }

        if (selection.kind === 'none') {
            const reached = this.#memberSelector.getAccessible(candidates);
            const types = reached.flatMap(candidate => this.#registry.getReceiverTypes(candidate));

            this.#fail(isComputed ? 'NEXO3056' : 'NEXO3001', `'${access.name}' is not available on ${receiverType.toNonNullable()}${types.length === 0 ? '' : `; it is available on ${types.join(', ')}`}`, pointer);
        }

        if (selection.kind === 'ambiguous') {
            this.#fail('NEXO3024', `'${access.name}' ${this.#formatCompetingDeclarations(selection.declarations, receiverType, access.receiver)}`, pointer);
        }

        const { declaration } = selection;

        // A property of a structured type's data shape is read from the data, never invoked, and is used as every declaration selected is.
        if (this.#registry.isDataProperty(declaration)) {
            this.#requireReadWithoutArgument(node, pointer, `a property of ${receiverType.toNonNullable()}'s data`);

            const type = this.#registry.getDeclaredType(declaration, declaration.result);
            const result = { type: receiverType.isNullable ? type.toNullable() : type, kind: 'value', isFixed: false };

            return { result, resolution: { kind: 'dataProperty', declaration, name: access.name }, use: { declaration, qualifiedName: this.#qualifiedNameOf(declaration, receiverType), pointer } };
        }

        this.#requireDeclaredForm(declaration, node, pointer, isComputed);

        const receiver = { node: access.receiver, type: receiverType, isNullable: receiverType.isNullable };

        return this.#resolveInvocation(declaration, node, pointer, scope, receiver, this.#qualifiedNameOf(declaration, receiverType));
    }

    /**
     * Refuses an extension member read by a written name after a dot, where no member `.` reads applies to the receiver and an extension member of its name, accessible to scripts, does (NEXO3090), giving the
     * extension access to write, whether or not the script imports its module, which that access then asks for.
     */
    #refuseExtensionMemberRead(node, pointer, receiverType, isComputed) {
        const access = LanguageResolver.#accessOf(node);
        const extensionMembers = this.#memberSelector.getAccessible(this.#membersReadBy({ name: access.name, extension: {} }));

        if (isComputed || !extensionMembers.some(declaration => this.#typeChecker.resolveApplyingReceiverType(declaration, receiverType) !== undefined)) {
            return;
        }

        const extensionAccess = node.kind === 'call' ? { ...node, callee: { ...access, extension: {} } } : { ...access, extension: {} };

        this.#fail('NEXO3090', `'${access.name}' is an extension member, which ':' reads: write '${DefinitionWriter.quote(extensionAccess, this.#namespaceNames)}'`, pointer);
    }

    /**
     * Resolves an access on a value of Any, whose member is selected when that value is evaluated, by its actual type, through the selector, as an access its receiver's type selects during resolution is: a property read
     * whatever its name, since a plain object's fields are named by its data, and a call or an indexer of a member some accessible declaration of its name, or an unnamed indexer, takes in that form. Its arguments are read
     * without the declaration, each a value, never an implicit body or a function, whose reading would depend on the declaration (NEXO3029). It answers a value of Any, and records no use, since it chooses no declaration
     * before it is evaluated; its resolution names the access, null for an unnamed indexer, and keeps its candidates, which the resolution reports.
     */
    #resolveDeferredAccess(node, pointer, scope) {
        const access = LanguageResolver.#accessOf(node);
        const isUnnamedIndexer = node.kind === 'indexerAccess' && access.name === undefined;
        const written = isUnnamedIndexer ? '[…]' : access.name;
        const declared = isUnnamedIndexer ? this.#registry.getUnnamedIndexers() : this.#membersReadBy(access);
        const accessible = this.#memberSelector.getAccessible(this.#imported.getAvailable(declared));
        const candidates = isUnnamedIndexer ? accessible : accessible.filter(candidate => FORM_NODE_KINDS[candidate.kind] === node.kind);

        if (node.kind !== 'memberAccess' && candidates.length === 0) {
            if (declared.length === 0) {
                this.#fail('NEXO3001', `'${written}' is no member of the vocabulary`, pointer);
            }

            if (accessible.length === 0) {
                this.#refuseUnimported(declared, null, `'${written}'`, pointer);
            }

            if (accessible.length === 0) {
                this.#failInternal(`'${written}'`, this.#registry.getDeclaringModuleName(declared[0]), pointer);
            }

            this.#requireDeclaredForm(accessible[0], node, pointer);
        }

        const argumentNodes = node.kind === 'call' ? node.arguments : node.kind === 'indexerAccess' ? [node.argument] : [];
        const args = argumentNodes.map((argument, index) => this.#resolveDeferredArgument(argument, node.kind === 'indexerAccess' ? `${pointer}/argument` : `${pointer}/arguments/${index}`, scope, written));

        return { result: { type: Type.any, kind: 'value', isFixed: false }, resolution: { kind: 'deferred', name: isUnnamedIndexer ? null : access.name, candidates, receiverNode: access.receiver, arguments: args }, use: null };
    }

    /** Resolves an argument of a deferred access, read without the declaration it will select: a value, refused where it reads an implicit parameter of its own or gives a function (NEXO3029). */
    #resolveDeferredArgument(argument, pointer, scope, written) {
        // Whether the argument reads its own implicit parameter, which its own context key identifies, as a body would.
        const argumentBody = { key: {}, isRead: false };
        const result = this.#resolveNode(argument, pointer, { ...scope, contextType: Type.any, contextKey: argumentBody.key, argumentBody });

        if (result.kind !== 'value') {
            this.#fail('NEXO3048', `An argument of '${written}' is ${LanguageResolver.#descriptionOf(result.kind)}, and an argument is a value`, pointer);
        }

        if (argumentBody.isRead || LanguageResolver.#heldReferenceOf(result.type) === 'function') {
            this.#fail('NEXO3029', `'${written}' is selected when its receiver, a value of Any, is evaluated, so its arguments are read without its declaration, each a value, and this one is ${argumentBody.isRead ? 'an implicit body' : 'a function'}, which only a declaration gives a reading: make its receiver known, as a cast does, to give it one`, pointer);
        }

        return { node: argument, pointer };
    }

    /** Refuses a call or an indexer of what is read by its name alone, an object field or a property of a structured type's data, which the description names, giving the access to write. */
    #requireReadWithoutArgument(node, pointer, description) {
        if (node.kind !== 'memberAccess') {
            this.#fail('NEXO3017', `'${LanguageResolver.#accessOf(node).name}' is ${description} and takes no argument: write '${DefinitionWriter.quote(LanguageResolver.#createPropertyAccess(node), this.#namespaceNames)}'`, pointer);
        }
    }

    /**
     * Resolves an invocation of the declaration on its receiver, a node with its type and whether it can be null, or on none for a module member: the arguments its node gives it, those after its receiver where the node's first argument is that,
     * its type parameters bound by its receiver's type, its own by its value arguments and then its callbacks' results, and the type a fixed argument selects. It answers its result, nullable where its receiver or an argument whose
     * parameter propagates null can be null, its resolution and the use of its declaration, under the name its messages give it, and stores neither: whoever stores the resolution records the use.
     */
    #resolveInvocation(selected, node, pointer, scope, receiver, name) {
        const receiverType = receiver?.type ?? null;
        const declaration = this.#selectSignature(selected, node, pointer, scope, receiverType);
        // A qualified call's receiver is its first argument, and its own arguments follow it.
        const offset = receiver !== null && receiver.node === node.arguments?.[0] ? 1 : 0;
        // The declaration was selected for its receiver, so its receiver type always applies and binds what it writes; every value argument's binding is collected before any callback is resolved, whatever their order.
        const typeArguments = new Map(receiverType === null ? [] : (this.#typeChecker.inferReceiverTypeArguments(declaration, receiverType) ?? []));

        this.#bindTypeArguments(declaration, this.#collectValueArgumentEvidence(declaration, node, pointer, scope, offset), typeArguments, pointer);

        const resolved = this.#resolveArguments(declaration, node, pointer, scope, receiverType, typeArguments, offset);

        // A callback's result binds what nothing before it bound, once every callback is resolved, so no callback's result establishes another's inputs.
        this.#bindTypeArguments(declaration, resolved.callbackEvidence, typeArguments, pointer);

        const resultTypeArguments = new Map(typeArguments);

        if (resolved.selected !== undefined) {
            resultTypeArguments.set('@selected', resolved.selected.type);
        }

        // A host call that supplies nothing has no value to type, so it is typed as a never, which no value has.
        const declared = declaration.result === undefined ? Type.never : this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(resultTypeArguments);
        const unbound = receiverType !== null && LanguageResolver.#isNullOrNever(receiverType) ? null : LanguageResolver.#typeParameterOf(declared);

        // A type parameter of the result that neither the receiver nor an argument binds leaves the result a type no value has, which the call is refused for; a receiver of unknown type binds none, and is never evaluated.
        if (unbound !== null) {
            this.#fail('NEXO3028', `'${name ?? declaration.name}' produces ${declared}, and nothing it is given binds its type parameter ${unbound}`, pointer);
        }

        const resolution = {
            kind: 'invocation',
            declaration,
            ...(receiver === null ? {} : { receiverNode: receiver.node, receiverType }),
            type: declared,
            arguments: resolved.arguments,
            selected: resolved.selected,
            buildsObjectRoot: resolved.buildsObjectRoot,
        };
        const type = receiver?.isNullable === true || resolved.isNullable ? declared.toNullable() : declared;

        // A dictionary a call answers keys its entries by a key type, which a type parameter its arguments bind may leave it without.
        if (declared.isDictionary && !this.#registry.isKeyType(declared.typeArguments[0])) {
            this.#fail('NEXO3083', `'${name}' answers a dictionary keyed by ${declared.typeArguments[0]}, and a dictionary's keys are scalars, references or null`, pointer);
        }

        return { result: { type, kind: LanguageResolver.#getResultKind(declaration), isFixed: false, ...(declaration.result === undefined ? { suppliesNothing: true } : {}) }, resolution, use: { declaration, qualifiedName: name, pointer } };
    }

    /**
     * The evidence the member's value arguments give the type parameters their parameters' types write, each argument resolved as it will be, against the scope of where it is written, and nothing of it kept: an options
     * object's value options in scope by their names after their values, and its other options, which give no single value, refusing a read. An argument its resolution refuses gives none, and is refused where it is resolved.
     */
    #collectValueArgumentEvidence(declaration, node, pointer, scope, offset) {
        const evidence = new Map();

        if ((declaration.typeParameters ?? []).length === 0) {
            return evidence;
        }

        const supplied = this.#suppliedArguments(declaration, node, pointer, offset);
        const optionsObject = declaration.arguments === 'options' && supplied.size > 0 ? (node.kind === 'indexerAccess' ? node.argument : node.arguments[offset]) : null;
        const objectExpression = optionsObject !== null && scope.objectRootType === null ? optionsObject : null;
        let argumentScope = scope;

        if (objectExpression !== null) {
            this.#objectRootFields.set(objectExpression, new Map());
            argumentScope = { ...scope, objectRootType: Type.createObjectRootType(objectExpression, new Map()) };
        }

        for (const [parameterName, given] of supplied) {
            const parameter = declaration.parameters.find(candidate => candidate.name === parameterName);

            if (parameter.kind !== 'value') {
                if (optionsObject !== null) {
                    argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { optionKind: parameter.kind === 'function' ? 'implicitBody' : parameter.kind, result: null }) };
                }

                continue;
            }

            const outcome = this.#resolveSpeculatively(() => this.#resolveExpecting(given.node, given.pointer, argumentScope, this.#registry.getDeclaredType(declaration, parameter.type)), { keepsSuccess: false });

            if (outcome.error !== undefined) {
                continue;
            }

            if (outcome.result.type.kind !== 'function') {
                this.#typeChecker.extractTypeArgumentEvidence(this.#registry.getDeclaredType(declaration, parameter.type), outcome.result.type, evidence);
            }

            if (optionsObject !== null) {
                argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { result: outcome.result, initializer: given.node, scope: argumentScope }) };
            }

            if (objectExpression !== null) {
                this.#objectRootFields.get(objectExpression).set(parameter.name, { initializer: given.node });
                argumentScope = { ...argumentScope, objectRootType: Type.createObjectRootType(objectExpression, new Map(argumentScope.objectRootType.fieldTypes).set(parameter.name, outcome.result.type)) };
            }
        }

        return evidence;
    }

    /** Binds each of the member's own type parameters that nothing bound yet and the evidence gives a type, refusing candidates of different types (NEXO3064), which no binding reconciles. */
    #bindTypeArguments(declaration, evidence, typeArguments, pointer) {
        for (const parameterName of declaration.typeParameters ?? []) {
            if (typeArguments.has(parameterName) || !evidence.has(parameterName)) {
                continue;
            }

            const resolved = this.#typeChecker.resolveTypeArgument(evidence.get(parameterName));

            if (resolved?.candidates !== undefined) {
                this.#fail('NEXO3064', `'${NexoModule.writtenNameOf(declaration)}' is given ${resolved.candidates.join(' and ')} for its type parameter ${parameterName}, which binds one type, never a type they share`, pointer);
            }

            if (resolved !== null) {
                typeArguments.set(parameterName, resolved.type);
            }
        }
    }

    /** Stores what the node at the pointer resolved to, an access's resolution or an invocation's, and records the use of its declaration, where it chose one, answering its result. */
    #storeResolution(pointer, { result, resolution, use }) {
        this.#resolutions.set(pointer, resolution);

        if (use !== null) {
            this.#usedDeclarations.push(use);
        }

        return result;
    }

    /**
     * Resolves a member read or a call through a module's namespace, the module the local name its imports give names: a module member, read or called; a reference to one of the module's functions, read without a call,
     * which the callback contract it is passed to selects where one is given; or a qualified form, a member the module declares on a type, called with its receiver first and its own arguments after it. A message writes the
     * namespace by its local name, as the script does, and names the module by its own.
     */
    #resolveThroughNamespace(node, pointer, scope, contract = null) {
        const access = LanguageResolver.#accessOf(node);
        const moduleName = this.#imported.getNamespaceModule(access.receiver.name);
        const written = `${access.receiver.name}.${access.name}`;
        const declared = this.#registry.getMembersDeclaredBy(moduleName, access.name);
        const namedDeclarations = this.#memberSelector.getAccessible(declared);

        if (declared.length > 0 && namedDeclarations.length === 0) {
            this.#failInternal(`'${written}'`, moduleName, pointer);
        }

        const declarations = namedDeclarations.filter(declaration => declaration.kind !== 'indexer');

        if (declarations.length === 0) {
            this.#fail(namedDeclarations.length > 0 ? 'NEXO3011' : 'NEXO3001', namedDeclarations.length > 0 ? `'${access.name}' is an indexer, which no namespace qualifies: write its receiver and '${this.#memberSelector.isExtensionMember(namedDeclarations[0]) ? ':' : '.'}${access.name}[…]'` : `The module '${moduleName}' declares no member '${access.name}'`, pointer);
        }

        const moduleMemberDeclaration = declarations.find(declaration => !this.#registry.takesReceiver(declaration));
        const receiverMemberDeclarations = declarations.filter(declaration => this.#registry.takesReceiver(declaration));
        const readings = [
            ...(moduleMemberDeclaration === undefined ? [] : [() => this.#resolveModuleMember(node, pointer, scope, moduleMemberDeclaration, written, contract)]),
            ...(receiverMemberDeclarations.length === 0 ? [] : [() => (node.kind === 'memberAccess' ? this.#resolveFunctionReference(node, pointer, receiverMemberDeclarations, contract) : this.#resolveQualifiedForm(node, pointer, scope, receiverMemberDeclarations, written))]),
        ];

        if (readings.length === 1) {
            return readings[0]();
        }

        // A module member and a member of its name on a receiver are both reached through the namespace, so the one reading resolution and type checking accept is taken, and one both accept is ambiguous.
        const outcomes = readings.map(read => this.#resolveSpeculatively(read, { keepsSuccess: true }));
        const accepted = outcomes.filter(outcome => outcome.error === undefined);

        if (accepted.length > 1) {
            this.#fail('NEXO3024', `'${written}' is both the module member and the qualified form of the member '${access.name}' of a receiver, and this access fits both, so which applies is ambiguous; the receiver form, receiver.${access.name}, reaches the member of the receiver`, pointer);
        }

        if (accepted.length === 0) {
            throw outcomes[0].error;
        }

        return accepted[0].result;
    }

    /**
     * How a message names the competing declarations an access can't choose among, after the access: their receiver types, none more specific than another, which the receiver satisfies, where one module declares them;
     * and the modules that declare them where several do, with the extension access that selects each, its receiver as the access writes it, where every one of them is an extension's.
     */
    #formatCompetingDeclarations(declarations, receiverType, receiverNode) {
        const modules = [...new Set(declarations.map(declaration => this.#registry.getDeclaringModuleName(declaration)))];

        if (modules.length > 1) {
            const extensions = declarations.map(declaration => this.#registry.getContainingType(declaration));
            const receiver = DefinitionWriter.quote(receiverNode, this.#namespaceNames);
            const accesses = declarations.every(declaration => this.#memberSelector.isExtensionMember(declaration))
                ? declarations.map((declaration, index) => `'${receiver}:${this.#formatExtensionName(extensions[index])}.${declaration.name}'`)
                : [];

            return `on ${receiverType.toNonNullable()} is ambiguous between the modules ${modules.map(name => `'${name}'`).join(' and ')}${accesses.length === 0 ? '' : `: write ${accesses.join(' or ')} to select one`}`;
        }

        const types = declarations.flatMap(declaration => this.#registry.getReceiverTypes(declaration));

        return `is declared for ${types.join(' and ')}, which ${receiverType.toNonNullable()} satisfies, and none of them is more specific than ${types.length === 2 ? 'the other' : 'every other'}, so which applies is ambiguous`;
    }

    /** Refuses what a script reaches of an internal declaration, which its declaring module's own declarations alone name, as if no declaration of its name were accessible (NEXO3023). */
    #failInternal(subject, moduleName, pointer) {
        this.#fail('NEXO3023', `${subject} is internal to the module '${moduleName}', which no script reaches`, pointer);
    }

    /**
     * Resolves a possible reading, answering what it resolves to, or the failure that refuses it where that is a NexoError; any other failure propagates. A refused reading leaves the resolutions, the declaration uses
     * and the body copies as they were, and so does a successful one unless `keepsSuccess` keeps its records, its result answered either way. Restoring those three stores is all it promises, since resolution writes
     * nothing else a later reading could take for its own: the functions being resolved and the optional chains are removed as each resolution ends, whether it succeeds or fails; an object expression's object-root
     * fields are reset before they are filled, and read only within it; a structure expected of a node lasts only while the resolution that expects it does; the result a computed property access follows is read only once
     * its own resolution wrote it; the name an access joins comes from its syntax alone;
     * and the module-function cache keeps one entry for each declaration, whichever reading made it, so references to one declaration stay one function.
     * @param {() => object} resolve The resolution of the reading.
     * @param {{ keepsSuccess: boolean }} options Whether a successful reading's records are kept.
     * @returns {{ result: object } | { error: NexoError }}
     */
    #resolveSpeculatively(resolve, { keepsSuccess }) {
        const resolutions = new Map(this.#resolutions);
        const usedCount = this.#usedDeclarations.length;
        const bodyCopyCount = this.#functionBodyCopies.length;
        let isKept = false;

        try {
            const result = resolve();

            isKept = keepsSuccess;

            return { result };
        } catch (error) {
            if (!(error instanceof NexoError)) {
                throw error;
            }

            return { error };
        } finally {
            if (!isKept) {
                this.#resolutions = resolutions;
                this.#usedDeclarations.length = usedCount;
                this.#functionBodyCopies.length = bodyCopyCount;
            }
        }
    }

    /** Resolves a module member, which has no receiver: a property read through its namespace, a function called through it, or a function read without a call, a reference to it. */
    #resolveModuleMember(node, pointer, scope, declaration, written, contract) {
        if (declaration.kind === 'property') {
            if (node.kind === 'call') {
                this.#fail('NEXO3017', `'${written}' is a property, read as ${written}, and takes no argument`, pointer);
            }

            const type = this.#registry.getDeclaredType(declaration, declaration.result);

            this.#usedDeclarations.push({ declaration, qualifiedName: written, pointer });
            this.#resolutions.set(pointer, { kind: 'invocation', declaration, type, arguments: [] });

            return { type, kind: 'value', isFixed: false };
        }

        if (node.kind === 'memberAccess') {
            return this.#resolveFunctionReference(node, pointer, [declaration], contract);
        }

        return this.#storeResolution(pointer, this.#resolveInvocation(declaration, node, pointer, scope, null, written));
    }

    /** Resolves a qualified form: the module's member on a type, called with its receiver as its first argument, as a qualified call. */
    #resolveQualifiedForm(node, pointer, scope, declarations, written) {
        return this.#storeResolution(pointer, this.#resolveQualifiedCall(node, pointer, scope, declarations, {
            subject: `'${written}'`,
            missingReceiver: `'${written}' is the qualified form of a member of a receiver, which takes the receiver as its first argument, as ${written}(receiver)`,
            receiverOf: `'${written}' takes a receiver of`,
            nameOf: (declaration, receiverType) => this.#qualifiedNameOf(declaration, receiverType),
        }));
    }

    /**
     * Resolves a qualified call: a member on a type called with its receiver as its first argument, which is evaluated first and whose null answers null without the member's own arguments being evaluated, and its own arguments after it,
     * as a qualified form calls one of a module's members and a call of a reference to a module's function calls the one it holds. The receiver's type selects among the declarations; a receiver of unknown type selects none, and is checked as any
     * such receiver is. Each message names the call as its wording says; it answers the call's result, its resolution and the use of the declaration it selects, none for a receiver of unknown type, which the caller stores and records.
     */
    #resolveQualifiedCall(node, pointer, scope, declarations, wording) {
        if (node.arguments.length === 0) {
            this.#fail('NEXO3080', wording.missingReceiver, pointer);
        }

        const receiver = this.#resolveReceiverArgument(node, pointer, scope, wording.subject);
        const receiverType = receiver.type.toNonNullable();
        const isReceiverNullable = receiver.type.isNullable || receiver.type.kind === 'null';

        if (LanguageResolver.#isNullOrNever(receiverType)) {
            return this.#resolveOnUnknownType(node, pointer, scope, receiver.type.kind === 'null' ? Type.null : receiverType, declarations, 1);
        }

        const selection = this.#memberSelector.select(declarations, receiverType);

        if (selection.kind === 'none') {
            this.#fail('NEXO3042', `${wording.receiverOf} ${declarations.flatMap(declaration => this.#registry.getReceiverTypes(declaration)).join(', ')}, and is given ${receiverType}`, `${pointer}/arguments/0`);
        }

        // A reference's declaration or a module's, reached through its namespace, is internal to none of them, so no other selection is left.
        if (selection.kind === 'ambiguous') {
            this.#fail('NEXO3024', `${wording.subject} ${this.#formatCompetingDeclarations(selection.declarations, receiverType, node.arguments[0])}`, pointer);
        }

        const { declaration } = selection;

        const receiverArgument = { node: node.arguments[0], type: receiverType, isNullable: isReceiverNullable };

        return this.#resolveInvocation(declaration, node, pointer, scope, receiverArgument, wording.nameOf(declaration, receiverType));
    }

    /** Resolves the receiver a qualified call or a call of a reference to a module's function gives as its first argument, a value of any type, which the call evaluates before its own arguments. */
    #resolveReceiverArgument(node, pointer, scope, written) {
        const receiverPointer = `${pointer}/arguments/0`;
        const receiver = this.#resolveNode(node.arguments[0], receiverPointer, scope);

        if (receiver.kind !== 'value') {
            this.#fail('NEXO3048', `The receiver ${written} is given is ${LanguageResolver.#descriptionOf(receiver.kind)}, and a receiver is a value`, receiverPointer);
        }

        if (LanguageResolver.#heldReferenceOf(receiver.type) === 'function') {
            this.#fail('NEXO3042', `The receiver ${written} is given is a function, which has no members`, receiverPointer);
        }

        return receiver;
    }

    /**
     * Resolves a reference to a module's function: one of the module's functions the evaluator invokes, read without a call, which takes its receiver first, where it has one, and its own arguments after it.
     * Passed to a function parameter, it names the declaration whose receiver and parameters take the arguments the callback contract declares; anywhere else, the module's one function of its name. Creating it reads nothing and invokes nothing.
     */
    #resolveFunctionReference(node, pointer, declarations, contract) {
        const written = `${node.receiver.name}.${node.name}`;
        const functions = declarations.filter(declaration => declaration.kind === 'function' && !NexoModule.isInvokedByHost(declaration));

        if (functions.length === 0) {
            const [declaration] = declarations;
            const message = declaration.kind === 'property'
                ? `'${written}' is a property, read with its receiver as ${written}(receiver), and only a function has a reference`
                : `'${written}' is a host call, which its host invokes, so it has no reference`;

            this.#fail('NEXO3076', message, pointer);
        }

        const selected = contract === null ? functions : functions.filter(declaration => this.#takesContract(declaration, contract));
        const alternatives = `write an arrow function, whose receiver's type selects one, as x => x.${node.name}(), or an implicit body, as it.${node.name}()`;

        if (selected.length === 0) {
            this.#fail('NEXO3037', `The function given as '${contract.parameterName}' of '${contract.memberName}' is called with ${contract.parameterTypes.join(', ')} and answers ${contract.resultType ?? 'any value'}, and '${written}' names no function that takes those or answers that: it names ${functions.map(declaration => this.#signatureOf(declaration)).join(', ')}`, pointer);
        }

        if (selected.length > 1) {
            this.#fail('NEXO3075', `'${written}' names ${selected.length} functions${contract === null ? '' : ` that the contract of '${contract.memberName}' allows`}, so which it references is ambiguous; ${alternatives}`, pointer);
        }

        const [declaration] = selected;

        this.#usedDeclarations.push({ declaration, qualifiedName: written, pointer });
        this.#resolutions.set(pointer, { kind: 'functionReference', declaration });

        return { type: Type.createFunctionType([this.#getModuleFunctionEntry(declaration)]), kind: 'value', isFixed: false };
    }

    /**
     * The function-type entry of each module function, indexed declaration → entry, for as long as the resolver: the one entry a function type's `functions` holds for the declaration, so references to one declaration are one
     * function, as two reads of one local function's name are. @type {WeakMap<object, { reference: object }>}
     */
    #moduleFunctionEntryCache = new WeakMap();

    /** Gets the shared function-type entry for a module function declaration, creating it at the first request: repeated references to the same declaration receive the same entry. */
    #getModuleFunctionEntry(declaration) {
        let entry = this.#moduleFunctionEntryCache.get(declaration);

        if (entry === undefined) {
            entry = Object.freeze({ reference: declaration });
            this.#moduleFunctionEntryCache.set(declaration, entry);
        }

        return entry;
    }

    /** How a message names a reference's declaration: its module's name and its own, as its reference is written. */
    #referenceNameOf(declaration) {
        return `${this.#registry.getDeclaringModuleName(declaration)}.${declaration.name}`;
    }

    /** How a message names a function's signature: its receiver's types where it has one, the types of its parameters, and its result. */
    #signatureOf(declaration) {
        const parameters = [...(this.#registry.takesReceiver(declaration) ? [this.#registry.getReceiverTypes(declaration).join(' | ')] : []), ...declaration.parameters.map(parameter => parameter.type)];

        return `(${parameters.join(', ')}) => ${declaration.result}`;
    }

    /**
     * Whether the declaration takes the arguments the callback contract passes and answers a result it takes: its receiver the first, where it has one, of the type the contract gives it, and then one positional value for each of its parameters,
     * those it requires at least. A type of an unknown receiver, a never or a type parameter no receiver bound, fits any.
     */
    #takesContract(declaration, contract) {
        const { parameterTypes, resultType } = contract;
        const takesReceiver = this.#registry.takesReceiver(declaration);
        const typeArguments = this.#contractTypeArgumentsOf(declaration, contract);

        if (typeArguments === null) {
            return false;
        }

        const own = takesReceiver ? parameterTypes.slice(1) : parameterTypes;
        const { parameters } = declaration;

        if (parameters.some(parameter => parameter.kind !== 'value') || (parameters.length > 0 && declaration.arguments === 'options')) {
            return false;
        }

        if (own.length < parameters.filter(parameter => parameter.required).length || own.length > parameters.length) {
            return false;
        }

        const fitsParameters = own.every((type, index) => LanguageResolver.#fitsAny(type) || this.#typeChecker.isAssignable(type, this.#registry.getDeclaredType(declaration, parameters[index].type).resolveTypeParameters(typeArguments)));
        const declared = this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(typeArguments);

        // A declared result of Any is checked as the callback answers it; a parameter is never, since nothing checks what a reference is called with.
        return fitsParameters && (resultType === null || LanguageResolver.#fitsAny(resultType) || this.#typeChecker.assignabilityOf(declared, resultType) !== 'refused');
    }

    /**
     * The arguments of the type parameters the callback contract binds for the declaration: those its receiver binds, none where the declaration takes no receiver or the contract's receiver type fits any, and its own,
     * which the arguments the contract passes after its receiver bind, as a call's value arguments do. It answers null where the contract gives no receiver, one that can be null, or one the declaration does not apply to,
     * and where it gives an own parameter candidates of different types.
     */
    #contractTypeArgumentsOf(declaration, contract) {
        const takesReceiver = this.#registry.takesReceiver(declaration);
        let typeArguments = new Map();

        if (takesReceiver) {
            const [receiverType] = contract.parameterTypes;

            if (receiverType === undefined || receiverType.isNullable) {
                return null;
            }

            typeArguments = LanguageResolver.#fitsAny(receiverType) ? new Map() : this.#typeChecker.inferReceiverTypeArguments(declaration, receiverType);

            if (typeArguments === null) {
                return null;
            }
        }

        const evidence = new Map();

        (takesReceiver ? contract.parameterTypes.slice(1) : contract.parameterTypes).forEach((type, index) => {
            const parameter = declaration.parameters[index];

            if (parameter !== undefined && !LanguageResolver.#fitsAny(type)) {
                this.#typeChecker.extractTypeArgumentEvidence(this.#registry.getDeclaredType(declaration, parameter.type), type, evidence);
            }
        });

        for (const parameterName of (declaration.typeParameters ?? []).filter(name => !typeArguments.has(name) && evidence.has(name))) {
            const resolved = this.#typeChecker.resolveTypeArgument(evidence.get(parameterName));

            if (resolved.candidates !== undefined) {
                return null;
            }

            typeArguments.set(parameterName, resolved.type);
        }

        return typeArguments;
    }

    /** Whether a type a callback contract gives fits any: a never, the type of an unknown receiver's arguments, or a type parameter no receiver bound. */
    static #fitsAny(type) {
        return type.kind === 'never' || type.kind === 'typeParameter';
    }

    /**
     * Resolves a name applied to a receiver of unknown type, which chooses no declaration among the candidates, those of its name or, for an unnamed indexer, every unnamed indexer. A property is accepted whatever its name, since a bound object's fields are named by its data; a call or an indexer must be a member's, written in the form and given the arguments one of its declarations takes. The declarations that take it agree on who invokes it, the evaluator or the host.
     * Its type is the result type they share, made nullable, or left to the optional chain an optional access of null ends, and null where they share none or the name is no member's. Nothing applied to such a receiver is evaluated, so its arguments leave no resolution behind.
     * It answers its result and its resolution, with no use, since it chooses no declaration, and records neither.
     */
    #resolveOnUnknownType(node, pointer, scope, receiverType, declared = this.#membersReadBy(LanguageResolver.#accessOf(node)), offset = 0) {
        const access = LanguageResolver.#accessOf(node);
        const isAccess = node.kind === 'memberAccess';
        const candidates = this.#memberSelector.getAccessible(this.#imported.getAvailable(declared));

        if (!isAccess && candidates.length === 0) {
            this.#refuseUnimported(declared, null, `'${access.name ?? '[…]'}'`, pointer);
        }

        if (!isAccess && declared.length > 0 && candidates.length === 0) {
            this.#failInternal(`'${access.name}'`, this.#registry.getDeclaringModuleName(declared[0]), pointer);
        }

        // A qualified call, of a qualified form or of a reference to a module's function, calls a property and a function alike, its receiver its first argument.
        const candidatesInForm = offset > 0 ? candidates : candidates.filter(candidate => FORM_NODE_KINDS[candidate.kind] === node.kind);

        if (!isAccess && candidates.length === 0) {
            this.#fail('NEXO3001', `'${access.name}' is no member of the vocabulary`, pointer);
        }

        // A structured type's data property among the candidates is read by its name alone, whichever type a receiver will have.
        if (!isAccess && candidatesInForm.length === 0 && candidates.every(candidate => this.#registry.isDataProperty(candidate))) {
            this.#requireReadWithoutArgument(node, pointer, "a property of a structured type's data");
        }

        if (!isAccess && candidatesInForm.length === 0) {
            this.#requireDeclaredForm(candidates[0], node, pointer);
        }

        const fitting = [];
        let failure = null;

        // Each candidate's arguments are resolved to determine compatibility and any selected type; their resolution records, declaration uses and body copies are discarded.
        for (const declaration of candidatesInForm) {
            const outcome = this.#resolveSpeculatively(() => this.#resolveArguments(declaration, node, pointer, scope, receiverType, new Map(), offset), { keepsSuccess: false });

            if (outcome.error === undefined) {
                fitting.push({ declaration, resolved: outcome.result });
            } else {
                failure ??= outcome.error;
            }
        }

        if (!isAccess && fitting.length === 0) {
            throw failure;
        }

        // An access may name a field of data, which is a value.
        const kinds = new Set([...fitting.map(({ declaration }) => LanguageResolver.#getResultKind(declaration)), ...(isAccess ? ['value'] : [])]);

        if (kinds.size > 1) {
            this.#fail('NEXO3025', `'${access.name}' follows a value whose type is unknown, and its declarations disagree on who invokes it, the evaluator or the host, so whether the script ends in a host call is ambiguous`, pointer);
        }

        const resultTypes = [
            ...fitting.filter(({ declaration }) => declaration.result !== undefined).map(({ declaration, resolved }) => this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(new Map(resolved.selected === undefined ? [] : [['@selected', resolved.selected.type]]))),
        ];
        const shared = resultTypes.reduce((merged, type) => (merged === null ? null : this.#typeChecker.merge(merged, type)), Type.never);
        // A member of a never is never evaluated, since no value has that type, so it answers what its declarations share as they declare it, and where none says what it would answer, nothing yet: a never, which fits wherever a value of any type is required.
        const isNever = receiverType.kind === 'never';
        // An optional access of null ends its chain, which is nullable for it, so its own type is the one its declarations share.
        const isShortCircuited = access.optional === true && receiverType.kind === 'null';
        const unknown = isNever ? Type.never : Type.null;
        const type = shared === null || shared.kind === 'never' || LanguageResolver.#holdsTypeParameter(shared) ? unknown : isNever || isShortCircuited ? shared : shared.toNullable();

        // A qualified call's receiver is its first argument, and any other member's the node it targets.
        const resolution = { kind: 'invocation', candidates: fitting.map(({ declaration }) => declaration), receiverNode: offset > 0 ? node.arguments[0] : access.receiver, receiverType, type, arguments: [] };

        // Host calls that agree on their host supplying nothing take no result projection, whichever of them a receiver's type will choose.
        const suppliesNothing = fitting.length > 0 && fitting.every(({ declaration }) => declaration.result === undefined);

        return { result: { type, kind: [...kinds][0], isFixed: false, ...(suppliesNothing ? { suppliesNothing: true } : {}) }, resolution, use: null };
    }

    /** Refuses a member written in a form its declaration does not take, with the form it does: a property is accessed, and a function called or named as its declaration says. */
    #requireDeclaredForm(declaration, node, pointer, isComputed = false) {
        const { kind } = declaration;

        if (FORM_NODE_KINDS[kind] === node.kind) {
            return;
        }

        const described = { property: 'is a property', function: 'uses call syntax', indexer: 'is an indexer' }[kind];
        // A computed property's name that settles to an indexer's names it rather than a property, and one that settles to a function's names no property at all.
        const code = kind === 'indexer'
            ? (isComputed ? 'NEXO3016' : 'NEXO3011')
            : isComputed ? 'NEXO3056' : kind === 'function' && node.kind === 'indexerAccess' ? 'NEXO3054' : 'NEXO3017';
        const access = LanguageResolver.#accessOf(node);

        // An indexer takes one key in brackets, which a node written another way may not give.
        if (kind === 'indexer' && node.arguments?.length !== 1) {
            const joiner = access.extension === undefined ? '.' : ':';

            this.#fail(code, `'${access.name}' ${described}: write '${DefinitionWriter.quote(access.receiver, this.#namespaceNames)}${access.optional === true ? '?' : ''}${joiner}${access.name}[…]'`, pointer);
        }

        this.#fail(code, `'${access.name}' ${described}: write '${DefinitionWriter.quote(LanguageResolver.#writtenAs(node, kind), this.#namespaceNames)}'`, pointer);
    }

    /** The node written as a member of the kind is: an access of its name, a call of its arguments, an indexer's one, or an indexer of its key, a call's one argument. */
    static #writtenAs(node, kind) {
        switch (kind) {
            case 'property':
                return LanguageResolver.#createPropertyAccess(node);
            case 'function':
                return LanguageResolver.#createCall(node, node.kind === 'indexerAccess' ? [node.argument] : []);
            default:
                return { kind: 'indexerAccess', receiver: LanguageResolver.#createPropertyAccess(node), argument: node.arguments[0] };
        }
    }

    /**
     * The arguments a call or an indexer is given, as the value of each parameter they supply: in order, the parameters of a positional declaration, an indexer's key its one,
     * or the fields of the one options object an options declaration takes, each by its name; those of a qualified call follow the receiver its first argument is, the offset its own arguments begin at.
     * It refuses an argument no parameter takes: one given a declaration without parameters, one beyond its parameters, or a second argument of an options declaration (NEXO3058); an options declaration's argument that is
     * no object expression standing alone (NEXO3057); and an options object's field that names no parameter (NEXO3018).
     */
    #suppliedArguments(declaration, node, pointer, offset = 0) {
        const { parameters } = declaration;
        const supplied = new Map();
        const given = node.kind === 'indexerAccess'
            ? [{ node: node.argument, pointer: `${pointer}/argument` }]
            : (node.arguments ?? []).slice(offset).map((argument, index) => ({ node: argument, pointer: `${pointer}/arguments/${index + offset}` }));

        if (given.length === 0) {
            return supplied;
        }

        if (parameters.length === 0) {
            this.#fail('NEXO3058', `'${NexoModule.writtenNameOf(declaration)}' takes no argument`, given[0].pointer);
        }

        if (declaration.arguments !== 'options') {
            if (given.length > parameters.length) {
                const count = parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`;

                this.#fail('NEXO3058', `'${NexoModule.writtenNameOf(declaration)}' takes ${parameters.some(parameter => !parameter.required) ? 'at most ' : ''}${count}, and is given ${given.length}`, given[parameters.length].pointer);
            }

            given.forEach((argument, index) => supplied.set(parameters[index].name, argument));

            return supplied;
        }

        if (given.length > 1) {
            this.#fail('NEXO3058', `'${NexoModule.writtenNameOf(declaration)}' takes its arguments as the object fields of one object, as { ${parameters[0].name} = … }`, given[1].pointer);
        }

        const [options] = given;

        if (options.node.kind !== 'object' || options.node.context !== undefined) {
            this.#fail('NEXO3057', `'${NexoModule.writtenNameOf(declaration)}' takes its arguments as the object fields of an object, as { ${parameters[0].name} = … }`, options.pointer);
        }

        options.node.objectFields.forEach((field, index) => {
            const parameter = parameters.find(candidate => candidate.name === field.name);

            if (parameter === undefined) {
                this.#fail('NEXO3018', `'${NexoModule.writtenNameOf(declaration)}' has no parameter '${field.name}'; it takes ${parameters.map(candidate => candidate.name).join(', ')}`, `${options.pointer}/objectFields/${index}`);
            }

            supplied.set(parameter.name, { node: field.value, pointer: `${options.pointer}/objectFields/${index}/value` });
        });

        return supplied;
    }

    #resolveArguments(declaration, node, pointer, scope, receiverType, typeArguments, offset = 0) {
        const parameters = declaration.parameters;
        const supplied = this.#suppliedArguments(declaration, node, pointer, offset);

        const resolved = [];
        const callbackEvidence = new Map();
        let isNullable = false;
        let selected;

        // A callback whose result writes a parameter nothing bound is given that parameter by the types its functions or its body give.
        const addCallbackEvidence = (parameter, result, callback) => {
            const declaredResult = this.#registry.getDeclaredType(declaration, parameter.type).resolveTypeParameters(typeArguments);

            if (LanguageResolver.#holdsTypeParameter(declaredResult)) {
                const resultTypes = callback.isBody === true ? [result.type] : callback.functions.map(entry => entry.resultType);

                resultTypes.forEach(type => this.#typeChecker.extractTypeArgumentEvidence(declaredResult, type, callbackEvidence));
            }
        };

        // An options object is an object expression: one no other encloses builds the outermost object, whose fields are its options, and any other builds within the one enclosing it; each option is in scope after its value, as a field is.
        const optionsObject = declaration.arguments === 'options' && supplied.size > 0 ? (node.kind === 'indexerAccess' ? node.argument : node.arguments[offset]) : null;
        const objectExpression = optionsObject !== null && scope.objectRootType === null ? optionsObject : null;
        let argumentScope = scope;

        if (objectExpression !== null) {
            this.#objectRootFields.set(objectExpression, new Map());
            argumentScope = { ...scope, objectRootType: Type.createObjectRootType(objectExpression, new Map()) };
        }

        // The arguments are resolved in the order they are written, an options object's fields among them, and the parameters left to their defaults after them.
        const ordered = [...[...supplied.keys()].map(name => parameters.find(parameter => parameter.name === name)), ...parameters.filter(parameter => !supplied.has(parameter.name))];

        for (const parameter of ordered) {
            const given = supplied.get(parameter.name);
            // The type a value of Any it is given is checked against when it is evaluated.
            let checkedType;

            if (given === undefined) {
                if (parameter.required) {
                    this.#fail('NEXO3080', `'${NexoModule.writtenNameOf(declaration)}' requires the argument '${parameter.name}'`, pointer);
                }

                resolved.push({ parameter, isDefault: true, value: parameter.default });
                continue;
            }

            const valuePointer = given.pointer;
            const expected = this.#registry.getDeclaredType(declaration, parameter.type).resolveTypeParameters(typeArguments);
            let result;
            let callback;

            if (parameter.kind === 'expression' || parameter.kind === 'predicate') {
                const isOfUnknownType = receiverType === null || LanguageResolver.#isNullOrNever(receiverType);

                if (receiverType === null) {
                    this.#fail('NEXO3500', `'${NexoModule.writtenNameOf(declaration)}' evaluates its expression against the items of the collection it follows, and a module member follows none`, valuePointer);
                }

                if (receiverType.itemContextType === null && !isOfUnknownType) {
                    this.#fail('NEXO3500', `'${NexoModule.writtenNameOf(declaration)}' evaluates its expression against the items of a list or the values of a dictionary, and ${receiverType.toNonNullable()} has none`, valuePointer);
                }

                const itemType = isOfUnknownType ? Type.never : receiverType.itemContextType;

                ({ result, callback } = this.#resolveItemArgument(given.node, valuePointer, { ...argumentScope, facts: scope.facts }, parameter, declaration, itemType, expected));
                addCallbackEvidence(parameter, result, callback);

                // An expression or a predicate option is evaluated by the member, and has no single value: a name or a field of it after its initializer refuses a read, hiding any enclosing name of its spelling.
                if (optionsObject !== null) {
                    argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { optionKind: parameter.kind, result: null }) };
                }

                if (objectExpression !== null) {
                    this.#objectRootFields.get(objectExpression).set(parameter.name, { optionKind: parameter.kind });
                }
            } else if (parameter.kind === 'function') {
                ({ result, callback } = this.#resolveFunctionArgument(given.node, valuePointer, argumentScope, parameter, declaration, receiverType, typeArguments));
                addCallbackEvidence(parameter, result, callback);

                // An implicit body option is called by the member against the argument it supplies, and has no single value, as an expression option has none.
                if (callback.isBody === true) {
                    if (optionsObject !== null) {
                        argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { optionKind: 'implicitBody', result: null }) };
                    }

                    if (objectExpression !== null) {
                        this.#objectRootFields.get(objectExpression).set(parameter.name, { optionKind: 'implicitBody' });
                    }
                }
            } else {
                result = this.#resolveExpecting(given.node, valuePointer, argumentScope, expected);
                this.#requireValueArgument(result, parameter, declaration, valuePointer);

                if (this.#requireArgumentType(result, expected, parameter, declaration, valuePointer, { allowsCheck: true }) === 'checked') {
                    checkedType = expected;
                }

                if (LanguageResolver.#propagatesNull(result, parameter)) {
                    isNullable = true;
                }
            }

            if (parameter.kind !== 'expression' && parameter.kind !== 'predicate' && callback?.isBody !== true) {

                // A value or a function option is in scope after its value, through the options after it, read as it was evaluated; one of the outermost object is completed, and read through root after it as the value it was given, of that value's type.
                if (optionsObject !== null) {
                    argumentScope = { ...argumentScope, locals: new Map(argumentScope.locals).set(parameter.name, { result, initializer: given.node, scope: argumentScope }) };
                }

                if (objectExpression !== null) {
                    this.#objectRootFields.get(objectExpression).set(parameter.name, { initializer: given.node });
                    argumentScope = { ...argumentScope, objectRootType: Type.createObjectRootType(objectExpression, new Map(argumentScope.objectRootType.fieldTypes).set(parameter.name, result.type)) };
                }
            }

            if (parameter.fixed === true) {
                const selection = this.#resolveSelectedType(parameter, result, declaration, valuePointer);

                selected = selection.selected ?? selected;
            }

            resolved.push({ parameter, isDefault: false, pointer: valuePointer, node: given.node, value: parameter.fixed === true ? result.value : undefined, ...(callback === undefined ? {} : { callback }), ...(checkedType === undefined ? {} : { checkedType }) });
        }

        return { arguments: resolved, isNullable, selected, buildsObjectRoot: objectExpression !== null, callbackEvidence };
    }

    /**
     * Refuses a value argument its parameter can't take: a function, or a value of a type it doesn't admit, the null of a parameter that propagates null aside, which answers for the call. It answers whether the argument is
     * assignable, or a value of Any checked when it is evaluated, which a caller that records the check allows, and any other refuses.
     * @returns {'assignable' | 'checked'}
     */
    #requireArgumentType(result, expected, parameter, declaration, pointer, { allowsCheck = false } = {}) {
        const actual = result.type;

        if (LanguageResolver.#heldReferenceOf(actual) === 'function') {
            this.#fail('NEXO3071', `The argument '${parameter.name}' of '${NexoModule.writtenNameOf(declaration)}' takes a value, and a function is none: a function is passed to a local function, or to a parameter its member declares to take one`, pointer);
        }

        const assignability = parameter.nulls === 'propagate' ? (actual.kind === 'null' ? 'assignable' : this.#typeChecker.assignabilityOf(actual.toNonNullable(), expected.toNonNullable())) : this.#typeChecker.assignabilityOf(actual, expected);
        const isAdmitted = assignability === 'assignable' || (assignability === 'checked' && allowsCheck);

        if (!isAdmitted) {
            const [expectedName, actualName] = Type.namesOf(expected, actual);

            this.#fail('NEXO3042', `The argument '${parameter.name}' of '${NexoModule.writtenNameOf(declaration)}' expects ${expectedName} and finds ${actualName}`, pointer);
        }

        return assignability;
    }

    /** Whether the argument's null makes the call answer null: its parameter propagates null, and the argument may be null, whatever the parameter's own type admits, as evaluation answers null without invoking. */
    static #propagatesNull(result, parameter) {
        return parameter.nulls === 'propagate' && result.type.isNullable;
    }

    #requireValueArgument(result, parameter, declaration, pointer) {
        if (result.kind !== 'value') {
            this.#fail('NEXO3048', `The argument '${parameter.name}' of '${NexoModule.writtenNameOf(declaration)}' is ${LanguageResolver.#descriptionOf(result.kind)}, and an argument is a value`, pointer);
        }
    }

    /** Resolves the type a fixed argument selects through its parameter's type selector, which must be known before anything is evaluated. */
    #resolveSelectedType(parameter, result, declaration, pointer) {
        if (!result.isFixed || typeof result.value !== 'string') {
            this.#fail(result.isFixed ? 'NEXO3007' : 'NEXO3006', `The argument '${parameter.name}' of '${NexoModule.writtenNameOf(declaration)}' selects from the vocabulary, so it is a string the expression's resolution settles without evaluating a member, a literal, a script parameter, or a local, a conditional binding, a conditional, a '??', an 'and' or an 'or' that settles to one, never null`, pointer);
        }

        const name = result.value;
        const mapping = this.#registry.getMapping(parameter.selector, name);

        if (mapping === undefined) {
            this.#fail('NEXO3050', `The type selector '${parameter.selector}' maps no type to the key '${name}'`, pointer);
        }

        return { selected: { name, type: this.#registry.getDeclaredType(mapping, mapping.type) } };
    }

    /**
     * Resolves an object expression: the value it follows, resolved outside it, a host call's making it that call's result projection, refused where the call supplies nothing; the implicit parameter of its entries, each item of a
     * list it follows or the value, a fresh key standing for it, and the enclosing one where it follows none; the outermost object the object root refers to where no object expression encloses it; its locals in order, each against
     * the scope with those before it; and its fields in order, each a value that is data, holds neither the object root nor a function reference, and is in scope by its name for the fields after it, a field of the outermost object read
     * through the object root once completed. It answers the object's type, a list of them for a list it follows, nullable where what it follows is.
     */
    #resolveObjectExpression(node, pointer, scope) {
        const target = node.context === undefined ? null : this.#resolveNode(node.context, `${pointer}/context`, scope);

        if (target?.suppliesNothing === true) {
            this.#fail('NEXO3049', 'The host call this object expression follows declares no result, since its host supplies no values, so it takes no result projection', pointer);
        }

        // An object expression that follows a host call is its result projection, and the script still ends in the call.
        const kind = target?.kind === 'hostCall' ? 'hostCall' : 'value';

        let contextType = scope.contextType;
        let contextKey = scope.contextKey;

        if (target !== null) {
            contextKey = {};

            const appliedType = target.type.isList ? target.type.itemType : target.type;

            // An object expression following null, or each item of a list of nulls, is never applied, so its fields are resolved against no value.
            contextType = appliedType.kind === 'null' ? Type.never : appliedType.toNonNullable();
        }

        // An object expression no other encloses builds the outermost object, which the object root refers to; any other builds within that object. Its receiver was resolved outside it.
        const objectExpression = scope.objectRootType === null ? node : null;
        let objectRootType = objectExpression === null ? scope.objectRootType : Type.createObjectRootType(objectExpression, new Map());

        if (objectExpression !== null) {
            this.#objectRootFields.set(objectExpression, new Map());
        }

        // Each local is resolved where it is written, against the implicit parameter and the locals before it, and every field sees them all.
        let locals = scope.locals;
        // An object expression following no value keeps the implicit parameter around it, so an implicit body it stands in reads that body's own `it`.
        const scopeHere = () => ({ ...scope, contextType, contextKey, locals, objectRootType });

        node.locals?.forEach((local, index) => {
            const valuePointer = `${pointer}/locals/${index}/value`;

            if (local.value.kind === 'function') {
                locals = new Map(locals).set(local.name, LanguageResolver.#functionLocalOf(local.value, valuePointer, scopeHere()));

                return;
            }

            const result = this.#resolveNode(local.value, valuePointer, scopeHere());

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `The local '${local.name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a local is a value`, valuePointer);
            }

            locals = new Map(locals).set(local.name, { result, initializer: local.value, scope: scopeHere() });
        });

        const fieldTypes = new Map();
        const constructed = target === null ? (this.#expectedTypes.get(node) ?? null) : null;
        const shape = constructed === null ? null : this.#registry.getDataShape(constructed);

        node.objectFields.forEach((field, index) => {
            const fieldPointer = `${pointer}/objectFields/${index}`;
            const { name } = field;

            if (shape !== null && !shape.has(name)) {
                this.#fail('NEXO3086', `The ${constructed} written here has no property '${name}'; it holds ${[...shape.keys()].join(', ')}`, fieldPointer);
            }

            const result = this.#resolveExpecting(field.value, `${fieldPointer}/value`, scopeHere(), shape?.get(name));

            if (result.kind !== 'value') {
                this.#fail('NEXO3048', `The field '${name}' is ${LanguageResolver.#descriptionOf(result.kind)}, and a field is a value`, `${fieldPointer}/value`);
            }

            const heldReference = LanguageResolver.#heldReferenceOf(result.type);

            if (heldReference === 'objectRoot') {
                this.#fail('NEXO3047', `The field '${name}' would hold root, the object being built, which no result holds; read its fields, as root.name`, `${fieldPointer}/value`);
            }

            if (heldReference === 'function') {
                this.#fail('NEXO3035', `The field '${name}' would hold a function, which is used within the expression and never part of its result: call it, as name(…)`, `${fieldPointer}/value`);
            }

            if (shape === null && !this.#registry.isDataOnceChecked(result.type)) {
                this.#fail('NEXO3043', `The field '${name}' would hold ${result.type}, which is no data; read the facts it needs through an object expression`, `${fieldPointer}/value`);
            }

            fieldTypes.set(name, result.type);

            // A field is in scope after its value, through the fields after it, its value read as it was evaluated.
            locals = new Map(locals).set(name, { result, initializer: field.value, scope: scopeHere() });

            // A field of the outermost object is completed, and read through a reference to the root written after it, as the value its evaluation gave.
            if (objectExpression !== null) {
                this.#objectRootFields.get(objectExpression).set(name, { initializer: field.value });
                objectRootType = Type.createObjectRootType(objectExpression, new Map(objectRootType.fieldTypes).set(name, result.type));
            }
        });

        if (shape !== null) {
            return this.#resolveConstruction(constructed, shape, fieldTypes, pointer);
        }

        const objectType = Type.createObjectType(fieldTypes);
        const isNullable = target?.type.isNullable === true;

        // A list's null item projects to null at its position, so the objects of a list whose items can be null can be null too; the projection keeps its items' type, which each item's source follows.
        if (target?.type.isList === true) {
            this.#resolutions.set(pointer, { kind: 'projection', itemType: target.type.itemType });

            return { type: Type.createListType(target.type.itemType.isNullable ? objectType.toNullable() : objectType, isNullable), kind, isFixed: false };
        }

        return { type: isNullable ? objectType.toNullable() : objectType, kind, isFixed: false };
    }

    /**
     * Resolves the object root, a reference to the outermost object, to the type its scope holds, which identifies the object expression that builds it and the fields completed where it is written, the fields it reads; each
     * field completed gives a new type with a field map of its own, so a reference written earlier, and a scope captured earlier, keep the fields they saw.
     */
    #resolveObjectRoot(pointer, scope) {
        if (scope.objectRootType === null) {
            this.#fail('NEXO2018', "'root' refers to the outermost object being built, and no object expression encloses it here", pointer);
        }

        return { type: scope.objectRootType, kind: 'value', isFixed: false };
    }

    /**
     * Resolves a field read through the object root: one of the fields completed where the reference was written, read as an object's is, with no argument; its resolution keeps the field's value, so what reads it
     * reuses the branches the field selected and compares it within its tolerance. It answers its result and its resolution, with no use, and records neither.
     */
    #resolveObjectRootField(node, pointer, receiverType) {
        if (node.kind !== 'memberAccess') {
            this.#fail(node.kind === 'call' ? 'NEXO3017' : 'NEXO3012', `'root' is read through its fields, as root.name or root.[name], and '${LanguageResolver.#accessOf(node).name ?? '[…]'}' ${node.kind === 'call' ? 'is called' : 'is an indexer'}`, pointer);
        }

        const optionKind = this.#objectRootFields.get(receiverType.objectExpression).get(node.name)?.optionKind;

        if (optionKind !== undefined) {
            this.#fail('NEXO3046', LanguageResolver.#unreadableOptionMessageOf(node.name, optionKind), pointer);
        }

        const fieldType = receiverType.fieldTypes.get(node.name);

        if (fieldType === undefined) {
            const completed = [...receiverType.fieldTypes.keys()];

            this.#fail('NEXO3044', `'${node.name}' is no field of root completed where the reference to it is written; ${completed.length === 0 ? 'none is completed there' : `those completed are ${completed.join(', ')}`}`, pointer);
        }

        return {
            result: { type: receiverType.isNullable ? fieldType.toNullable() : fieldType, kind: 'value', isFixed: false },
            resolution: { kind: 'objectRootField', name: node.name, initializer: this.#objectRootFields.get(receiverType.objectExpression).get(node.name).initializer },
            use: null,
        };
    }

    /** The refusal of a read of an expression, a predicate or an implicit body option, which the member evaluates and which has no value to read. */
    static #unreadableOptionMessageOf(name, kind) {
        const what = kind === 'predicate' ? 'a predicate' : kind === 'implicitBody' ? 'an implicit body' : 'an expression';

        return `Option '${name}' is ${what} evaluated by the member against the implicit parameter it supplies; it has no single value to read here`;
    }

    /** What the type holds that no result may, itself, as a list's item or as an object's field: the object root, or a function reference; null for neither. */
    static #heldReferenceOf(type) {
        switch (type.kind) {
            case 'objectRoot':
            case 'function':
                return type.kind;
            case 'named':
                return type.typeArguments.reduce((held, typeArgument) => held ?? LanguageResolver.#heldReferenceOf(typeArgument), null);
            case 'object':
                return [...type.fieldTypes.values()].reduce((held, fieldType) => held ?? LanguageResolver.#heldReferenceOf(fieldType), null);
            default:
                return null;
        }
    }

    /**
     * The callback contract a function parameter declares, its member's type parameters bound: the types of the arguments the member calls the function with, in order, and the type of the result it takes from it, any
     * value where that result writes a parameter nothing bound yet, which the callback's result binds. A type parameter of a receiver of unknown type, which nothing binds, is a never, which fits wherever a value of any type
     * stands.
     */
    #createCallbackContract(parameter, declaration, receiverType, typeArguments) {
        const isOfUnknownType = receiverType !== null && LanguageResolver.#isNullOrNever(receiverType);
        const resolve = text => {
            const type = this.#registry.getDeclaredType(declaration, text).resolveTypeParameters(typeArguments);

            return isOfUnknownType && LanguageResolver.#holdsTypeParameter(type) ? Type.never : type;
        };

        const resultType = resolve(parameter.type);

        return { memberName: NexoModule.writtenNameOf(declaration), parameterName: parameter.name, parameterTypes: parameter.parameterTypes.map(resolve), resultType: LanguageResolver.#holdsTypeParameter(resultType) ? null : resultType };
    }

    /**
     * Resolves the argument a function parameter is given, and the callback the member calls: a reference to a module's function, which the parameter's callback contract selects; for a contract of one argument, an implicit body, an argument
     * no arrow function is that reads an `it` of its own scope, which the argument the member calls it with stands for; or a function reference, each function it may be resolved against the contract.
     * An argument's own scope is told by the implicit parameter it resolves against, so an `it` of a projection or of an expression, a predicate or a function argument within it, each of which has its own, makes it no body.
     */
    #resolveFunctionArgument(node, pointer, scope, parameter, declaration, receiverType, typeArguments) {
        const contract = this.#createCallbackContract(parameter, declaration, receiverType, typeArguments);

        if (node.kind === 'memberAccess' && node.receiver.kind === 'namespace') {
            const result = this.#resolveThroughNamespace(node, pointer, scope, contract);

            return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
        }

        if (contract.parameterTypes.length === 1 && node.kind !== 'function') {
            // Whether the argument reads its own implicit parameter, which its own context key identifies; it holds no syntax of the body.
            const argumentBody = { key: {}, isRead: false };
            const result = this.#resolveNode(node, pointer, { ...scope, contextType: contract.parameterTypes[0], contextKey: argumentBody.key, argumentBody });

            this.#requireValueArgument(result, parameter, declaration, pointer);

            if (!argumentBody.isRead) {
                return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
            }

            if (!this.#fitsResult(result.type, contract.resultType)) {
                this.#fail('NEXO3036', `The implicit body given as '${parameter.name}' of '${NexoModule.writtenNameOf(declaration)}' gives ${result.type}, and its contract takes ${contract.resultType ?? 'any value'}`, pointer);
            }

            return { result, callback: { isBody: true, parameterTypes: contract.parameterTypes, resultType: contract.resultType } };
        }

        const result = this.#resolveNode(node, pointer, scope);

        this.#requireValueArgument(result, parameter, declaration, pointer);

        return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
    }

    /**
     * Resolves the argument an expression or a predicate parameter is given, which is a function of each item, as a function parameter's of one argument is: a function the member calls with each item, an arrow function,
     * a function a name holds or a module's function by reference, resolved against the contract of the item's type and the expression's result, a predicate's any value; or any other argument, its body, evaluated against
     * each item, its `it`, which it reads or not, so a body reading no `it` gives each item the same value. Either is a callback of that contract, which the member calls with one item while its own invocation lasts.
     */
    #resolveItemArgument(node, pointer, scope, parameter, declaration, itemType, expected) {
        // A function of the item is called with each item as it is, null among them where the list holds nulls, while a body reads each item as a value that is not, unless its parameter accepts null items.
        // An expression whose result writes a parameter nothing bound yet takes any value, which then binds it.
        const contract = { memberName: NexoModule.writtenNameOf(declaration), parameterName: parameter.name, parameterTypes: [itemType], resultType: parameter.kind === 'expression' && !LanguageResolver.#holdsTypeParameter(expected) ? expected : null };
        let result;

        if (node.kind === 'function') {
            result = this.#resolveNode(node, pointer, scope);
        } else if (node.kind === 'memberAccess' && node.receiver.kind === 'namespace') {
            result = this.#resolveThroughNamespace(node, pointer, scope, contract);
        } else {
            // Whether the argument reads its own implicit parameter, which its own context key identifies; it holds no syntax of the body.
            const argumentBody = { key: {}, isRead: false };

            result = this.#resolveNode(node, pointer, { ...scope, contextType: parameter.nulls === 'accept' ? itemType : itemType.toNonNullable(), contextKey: argumentBody.key, argumentBody });

            if (result.type.kind === 'function' && argumentBody.isRead) {
                this.#fail('NEXO3074', `The expression of '${NexoModule.writtenNameOf(declaration)}' reads each item as 'it' and gives a function; a function of the item is written as the argument itself, as ${declaration.name}(x => …)`, pointer);
            }
        }

        this.#requireValueArgument(result, parameter, declaration, pointer);

        if (result.type.kind === 'function') {
            return { result, callback: this.#resolveCallback(result, contract, pointer, scope) };
        }

        if (!this.#fitsResult(result.type, contract.resultType)) {
            this.#fail(contract.resultType === null ? 'NEXO3028' : 'NEXO3042', contract.resultType === null ? `The expression of '${NexoModule.writtenNameOf(declaration)}' produces ${result.type}, a type no receiver gives` : `The expression of '${NexoModule.writtenNameOf(declaration)}' must produce ${expected} and produces ${result.type}`, pointer);
        }

        return { result, callback: { isBody: true, parameterTypes: contract.parameterTypes, resultType: contract.resultType } };
    }

    /**
     * Whether a function's result of the type is one its callback contract takes: a value of the contract's result type, a value of Any among them, which the callback checks against it as it is evaluated, or, where the
     * contract takes any value, as a predicate's does, one of a type a receiver gives.
     */
    #fitsResult(type, resultType) {
        return resultType === null ? type.kind !== 'function' && !LanguageResolver.#holdsTypeParameter(type) : this.#typeChecker.assignabilityOf(type, resultType) !== 'refused';
    }

    /**
     * Resolves a function reference given to a function parameter against its callback contract: each function it may be, a function the script declares, its body resolved for the contract's argument types and its result checked against the contract's result type,
     * or a reference to a module's function, whose declaration takes what the contract passes, with its argument map, of as many arguments as the contract passes, and the result type its implementation answers, its type parameters bound by
     * the contract's receiver. It answers the callback, those functions with the contract's types, which evaluation checks the member's arguments and the function's result against. The member calls it while its own invocation
     * lasts, with as many arguments as the contract declares.
     */
    #resolveCallback(result, contract, pointer, scope) {
        const { type } = result;
        const { memberName, parameterName, parameterTypes, resultType } = contract;

        if (type.kind !== 'function') {
            const implicit = parameterTypes.length === 1 ? ', as an arrow function, a function a name holds, a module\'s function by reference or an implicit body gives' : '';

            this.#fail('NEXO3073', `The parameter '${parameterName}' of '${memberName}' takes a function${implicit}, and finds ${type}`, pointer);
        }

        if (type.isNullable) {
            this.#fail('NEXO3072', `The parameter '${parameterName}' of '${memberName}' takes a function, and this one may be null`, pointer);
        }

        const argumentResults = parameterTypes.map(parameterType => ({ type: parameterType, kind: 'value', isFixed: false }));

        const functions = type.functions.map((target, index) => {
            if (target.reference !== undefined) {
                // A reference bound to its receiver takes the arguments the contract passes as its own, after the receiver it captured.
                const reached = target.isBound === true ? { ...contract, parameterTypes: [target.receiverType, ...parameterTypes] } : contract;

                if (!this.#takesContract(target.reference, reached)) {
                    this.#fail('NEXO3036', `The function given as '${parameterName}' of '${memberName}' is called with ${parameterTypes.join(', ')} and answers ${resultType ?? 'any value'}, and '${this.#referenceNameOf(target.reference)}' is ${this.#signatureOf(target.reference)}`, pointer);
                }

                const typeArguments = this.#contractTypeArgumentsOf(target.reference, reached);
                const ownCount = reached.parameterTypes.length - (this.#registry.takesReceiver(target.reference) ? 1 : 0);

                return {
                    reference: target.reference,
                    argumentMap: LanguageResolver.#createArgumentMap(target.reference, ownCount),
                    resultType: this.#registry.getDeclaredType(target.reference, target.reference.result).resolveTypeParameters(typeArguments),
                };
            }

            const count = target.function.parameters.length;

            if (count !== parameterTypes.length) {
                this.#fail('NEXO3036', `The function given as '${parameterName}' of '${memberName}' takes ${count === 1 ? 'one argument' : `${count} arguments`}, and its contract passes ${parameterTypes.length}`, pointer);
            }

            const resolved = this.#resolveScriptFunctionCall(target, parameterName, argumentResults, null, scope, type.functions.length === 1 ? `${pointer}/callback` : `${pointer}/callbacks/${index}`, pointer);

            if (!this.#fitsResult(resolved.type, resultType)) {
                this.#fail('NEXO3036', `The function given as '${parameterName}' of '${memberName}' gives ${resolved.type}, and its contract takes ${resultType ?? 'any value'}`, pointer);
            }

            return { function: resolved.function, body: resolved.body, parameters: resolved.parameters, resultType: resolved.type };
        });

        return { functions, parameterTypes, resultType };
    }

    /** The fields of each outermost object, by the object expression that builds it and then by name, each with its initializer, which a field read through the object root follows. @type {WeakMap<object, Map<string, { initializer: object } | { optionKind: string }>>} */
    #objectRootFields = new WeakMap();

    /** Refuses the definition with the code of the condition it fails, a structure error for a structure code and a validation error otherwise, located at the source of the pointer. */
    #fail(code, message, pointer) {
        const definitionPointer = ResolvedDefinition.resolveDefinitionPointer(pointer, this.#functionBodyCopies);
        const location = this.#locations?.locate(definitionPointer) ?? { pointer: definitionPointer };

        throw code.startsWith('NEXO2') ? NexoErrors.structure(code, message, location) : NexoErrors.validation(code, message, location);
    }

    /** The copy of a function's body each call resolves, with the pointer it is resolved under and the pointer of the body it copies. @type {{ node: object, pointer: string, bodyPointer: string }[]} */
    #functionBodyCopies = [];

    /** What a resolved node of the kind is, for a message: a host call, a function a local holds, or a value. */
    static #descriptionOf(kind) {
        return kind === 'hostCall' ? 'a host call' : `a ${kind}`;
    }

    /** The node written optionally, a call's member access its callee. */
    static #asOptional(node) {
        return node.kind === 'call' ? { ...node, callee: { ...node.callee, optional: true } } : { ...node, optional: true };
    }

    /** The property access that writes the node's name after its receiver, optional where the node is, and an extension access where the node is one. */
    static #createPropertyAccess(node) {
        const access = LanguageResolver.#accessOf(node);

        return { kind: 'memberAccess', receiver: access.receiver, name: access.name, ...(access.optional === true ? { optional: true } : {}), ...(access.extension === undefined ? {} : { extension: access.extension }) };
    }

    /**
     * The access a node of a member makes: a property access and an indexer are their own, and a call of a member the member access its callee is, which holds its receiver, its name, whether it is optional and the
     * extension it selects.
     */
    static #accessOf(node) {
        return node.kind === 'call' ? node.callee : node;
    }

    /** The pointer of the extension a node of a member selects, which a call holds within its callee. */
    static #extensionPointerOf(node, pointer) {
        return node.kind === 'call' ? `${pointer}/callee/extension` : `${pointer}/extension`;
    }

    /** The pointer of the receiver of a node of a member, which a call holds within its callee. */
    static #receiverPointerOf(node, pointer) {
        return node.kind === 'call' ? `${pointer}/callee/receiver` : `${pointer}/receiver`;
    }

    /** The call of a member a property access writes with its arguments, its receiver's optional mark kept on its callee. */
    static #createCall(access, args) {
        return { kind: 'call', callee: LanguageResolver.#createPropertyAccess(access), arguments: args };
    }

    /** What a call of the declaration makes: a host call where its host invokes it, and a value otherwise. */
    static #getResultKind(declaration) {
        return NexoModule.isInvokedByHost(declaration) ? 'hostCall' : 'value';
    }

    /** Whether the type is null, whose only value is null, or Never, which has no values. */
    static #isNullOrNever(type) {
        return type.kind === 'null' || type.kind === 'never';
    }

    /** Whether the type writes a type parameter anywhere in it. */
    static #holdsTypeParameter(type) {
        return LanguageResolver.#typeParameterOf(type) !== null;
    }

    /** The first type parameter the type writes, or null where it writes none. */
    static #typeParameterOf(type) {
        if (type.kind === 'typeParameter') {
            return type;
        }

        if (type.typeArguments.length > 0) {
            return type.typeArguments.map(typeArgument => LanguageResolver.#typeParameterOf(typeArgument)).find(found => found !== null) ?? null;
        }

        return type.fieldTypes === null ? null : [...type.fieldTypes.values()].map(fieldType => LanguageResolver.#typeParameterOf(fieldType)).find(found => found !== null) ?? null;
    }

    /**
     * The member's name qualified by the receiver type the receiver applies to it by, the first its matching takes, as `node.root` and `shadow.root` are, so two members of one name are told apart; a member it applies to by
     * a type parameter alone, which takes a receiver of any type, keeps its name alone. A list is named by its type, Nexo's `List`, as `List.count` is.
     */
    #qualifiedNameOf(declaration, receiverType) {
        return LanguageResolver.#formatQualifiedName(declaration, this.#typeChecker.resolveApplyingReceiverType(declaration, receiverType));
    }

    /** The member's name qualified by the receiver type given, its type's name, or its name alone where none is given or that type is a type parameter. */
    static #formatQualifiedName(declaration, type) {
        // An unnamed indexer is named as its access is written, brackets after its receiver.
        const isUnnamedIndexer = declaration.kind === 'indexer' && declaration.name === undefined;

        if (type === undefined || type.kind === 'typeParameter') {
            return isUnnamedIndexer ? '[]' : declaration.name;
        }

        const typeName = type.kind === 'named' ? type.name : type.kind;

        return isUnnamedIndexer ? `${typeName}[]` : `${typeName}.${declaration.name}`;
    }

}
