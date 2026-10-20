/**
 * Evaluator — evaluates a resolved request against its registry for the host that asks, answering detached data: an expression's value as it reads now, a subscription's projection of each event its source delivers, and an action's result read through the object expression that follows it
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { LexicaError } from './LexicaError.mjs';
import { Type } from './Type.mjs';
import { LexicaModule } from './vocabulary/LexicaModule.mjs';

/** @typedef {Record<string, unknown>} Environment What the host gives an evaluation that does not belong in the expression, passed to every implementation. */

/**
 * What a member's invocation is, as the hooks receive it: the declaration that carries it out, its receiver, its arguments by parameter name, and where it stands in the definition.
 * @typedef {{ declaration: object, receiver: unknown, args: Record<string, unknown>, pointer: string }} InvocationRequest
 */

/**
 * How an evaluation ended, as `afterEvaluation` receives it: completed, with its value; pending, where a sample a member read was pending, with its value; or failed, with the failure.
 * @typedef {{ kind: 'completed' | 'pending', value: unknown } | { kind: 'failed', error: unknown }} EvaluationOutcome
 */

/**
 * What an evaluation tells of a value it answers, beside the value and never part of it: the origin, a token for the expression that produced it, the same token exactly where one expression of one resolution, with one candidate selected, produced two values;
 * the tolerance the producing member declares, applying to every number within the value but a part with a record of its own; the record of each field of an object an object expression built and of each item of a list a projection built;
 * and the value each projected item came from where it is a reference. A part with no record inherits its parent's origin and tolerance.
 * @typedef {{ origin: object, tolerance: number | null, fields?: Record<string, ResultMetadata>, items?: ResultMetadata[], sources?: unknown[] | null }} ResultMetadata
 */

/**
 * The host an evaluation is carried out for, each hook optional.
 * @typedef {object} Host
 * @property {(request: InvocationRequest) => unknown[] | { pending: true } | undefined} [beforeInvoke] Called before a member's implementation is invoked: answers the samples of a member that reads maintained values, that one is pending, or nothing.
 * @property {(request: InvocationRequest, value: unknown) => void} [afterInvoke] Called after an implementation answered a value of its member's result type.
 * @property {(outcome: EvaluationOutcome) => void} [afterEvaluation] Called once, as the evaluation ends.
 */

/**
 * The names one scope declares, as it runs, inside the frame of the scope enclosing it: an application of an object expression, whose locals are evaluated at their first use, a run of a body, whose locals it evaluates in order,
 * a call of a local function, its parameters holding its arguments, or a field the fields after it read, holding its value.
 * @typedef {object} LocalsFrame
 * @property {{ locals: { name: string, value?: object }[] }} node What declares the names: the object expression or the body, or for a call's parameters and a field, a list of them alone.
 * @property {unknown} item The evaluation context the scope runs against, which a local evaluated at its first use is evaluated against.
 * @property {Map<string, { value: unknown, selections: Map<object, object | string> | null }>} values Each name's value evaluated so far, with the selections its evaluation made.
 * @property {LocalsFrame | null} enclosing The frame of the scope enclosing this one, or null for the outermost.
 */

/** The arguments of a call that takes none. */
const NO_ARGUMENTS = Object.freeze({});

/** The kinds of expression whose value is the value of one of the expressions it holds, which it selected as it was evaluated. */
const SELECTING_KINDS = new Set(['conditional', 'coalescing', 'and', 'or']);

/** How many of the records an object expression gave last it keeps for objects whose fields give the same records to share. */
const RECENT_FIELD_RECORDS = 4;

/** The samples of a call that reads none. */
const NO_SAMPLES = Object.freeze([]);

/** What each arithmetic operator answers for its operands: `%` the remainder with the sign of the dividend, as `-5 % 3` is `-2`. */
const ARITHMETIC = Object.freeze({
    '+': (a, b) => a + b,
    '-': (a, b) => a - b,
    '*': (a, b) => a * b,
    '/': (a, b) => a / b,
    '%': (a, b) => a % b,
});

/** What each comparison operator answers for its operands. */
const COMPARISONS = Object.freeze({
    '<': (a, b) => a < b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '>=': (a, b) => a >= b,
});

/** What an evaluation answers: its value and whether a member it read was pending, and the metadata that describes the value, described from the identities its evaluation left where it is first read. */
class EvaluationResult {
    #describe;
    #metadata;

    constructor(value, isPending, describe) {
        this.value = value;
        this.isPending = isPending;
        this.#describe = describe;
    }

    /** The metadata of the value, frozen, the same each time it is read. */
    get metadata() {
        if (this.#describe !== null) {
            this.#metadata = this.#describe();
            this.#describe = null;
        }

        return this.#metadata;
    }
}

export class Evaluator {
    /** The fields of each declared structure, each with its type parsed, by the structure: valid for as long as the structure, which is frozen, and released with it. @type {WeakMap<object, [string, Type][]>} */
    static #fieldTypesByStructure = new WeakMap();

    /**
     * The function each node of a resolved definition compiles to, by the definition and then the node, with the registry they were compiled against: built once, it holds what the node's evaluation needs that no evaluation changes, and takes the evaluator, which holds what one does, and the evaluation context.
     * Beside them, the function each member's arguments compile to, by the member's resolution, for the evaluations that read the member without compiling it.
     * @type {WeakMap<object, { registry: object, functions: Map<object, (evaluator: Evaluator, current: unknown) => unknown>, arguments: Map<object, (evaluator: Evaluator, current: unknown) => object | null> }>}
     */
    static #compilationCache = new WeakMap();

    /** The record of each expression that produces a value itself, holding its origin token, by the definition, then the node, then the candidate it selected, or null: a record lives as long as its resolution, and its evaluations share it. @type {WeakMap<object, Map<object, Map<string | null, object>>>} */
    static #recordsByDefinition = new WeakMap();

    /** The record a part with none of its own takes from each whole record, made once. @type {WeakMap<object, object>} */
    static #inheritedRecords = new WeakMap();

    /** The records each object expression gave last, the latest first, with the context and the records of the fields each was made of, so an object whose fields give the same records shares one, as items that alternate between branches do. @type {WeakMap<object, { context: object | null, fields: object[], record: object }[]>} */
    static #recentFieldRecords = new WeakMap();

    /** The functions this evaluator's nodes compile to. @type {Map<object, (evaluator: Evaluator, evaluationContext: unknown) => unknown>} */
    #compiledFunctions;

    /** The functions the arguments of this evaluator's members compile to, by each member's resolution. @type {Map<object, (evaluator: Evaluator, evaluationContext: unknown) => object | null>} */
    #compiledArguments;

    #moduleRegistry;
    #resolvedDefinition;
    #parameterBindings;
    #environment;
    #locations;

    /** The element each item of a list an object expression projected came from, by the list it produced, for the evaluation in progress. @type {WeakMap<unknown[], (Element | null)[]>} */
    #sourceElementsByList = new WeakMap();

    /** The selections made for each field of an object an object expression gave, as `#selections` holds them, by the object and then the field's name, for the evaluation in progress. @type {WeakMap<object, Map<string, Map<object, object | string>>>} */
    #fieldSelectionsByObject = new WeakMap();

    /**
     * The selections made for the value being evaluated at its place in the result, by the node that made each: the branch a conditional or a coalescing selected, as its node, and the name a bracket property access selected; null where none has been made.
     * A result's identities hold them as their `branches`, a name kept from when conditionals alone made them.
     * @type {Map<object, object | string> | null}
     */
    #selections = null;

    /** The frame of the innermost scope that declares names, with the value of each evaluated so far, inside those of the scopes enclosing it; null outside every one. @type {LocalsFrame | null} */
    #localsFrame = null;

    /** The outermost object being built, which `root`, the object root, refers to, filled field by field; null outside every object expression. @type {object | null} */
    #objectRoot = null;

    /** The selections each completed field of the outermost object made, by the root and then the field's name, which a read of the field through a reference to the root reuses. @type {WeakMap<object, Map<string, Map<object, object | string> | null>>} */
    #objectRootSelections = new WeakMap();

    /** The value each conditional with a binding bound, while its consequent is evaluated, which the uses of its name read. @type {Map<object, unknown>} */
    #boundValues = new Map();

    /** The host the evaluation in progress is carried out for, or null where none is. @type {Host | null} */
    #host = null;

    /** Whether a member the evaluation in progress read answered that its sample is pending. */
    #isPending = false;

    /** The identities of the value `#copyResult` detached last. @type {object | null} */
    #copiedIdentities = null;

    /**
     * The terminal member's node and value while evaluating its projection.
     * The value is an event or an action result. The context is null outside a projection.
     * @type {{ node: object, value: unknown } | null}
     */
    #projectionContext = null;

    /**
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} moduleRegistry The vocabulary the request was resolved against.
     * @param {import('./ResolvedDefinition.mjs').ResolvedDefinition} resolvedDefinition The resolved definition to read.
     * @param {import('./ParameterBindings.mjs').ParameterBindings} parameterBindings What the request's parameters are bound to.
     * @param {Environment} environment What the host gives the evaluation, passed to every implementation; until module namespaces land, the roots `window` and `document` read its `window` and `document`.
     * @param {import('./TextLocations.mjs').TextLocations | null} locations Where in a text each part of the definition came from.
     */
    constructor(moduleRegistry, resolvedDefinition, parameterBindings, environment, locations) {
        this.#moduleRegistry = moduleRegistry;
        this.#resolvedDefinition = resolvedDefinition;
        this.#parameterBindings = parameterBindings;
        this.#environment = environment;
        this.#locations = locations;

        let compilation = Evaluator.#compilationCache.get(resolvedDefinition);

        if (compilation === undefined || compilation.registry !== moduleRegistry) {
            compilation = { registry: moduleRegistry, functions: new Map(), arguments: new Map() };
            Evaluator.#compilationCache.set(resolvedDefinition, compilation);
        }

        this.#compiledFunctions = compilation.functions;
        this.#compiledArguments = compilation.arguments;
    }

    /**
     * Evaluates the expression once, synchronously, for the host given, answering the detached result, the metadata that describes it, and whether a member it read was pending.
     * Without a host, or without its `beforeInvoke`, a member that reads maintained values fails the evaluation, since nothing answers its samples.
     * @param {Host | null} [host] What the evaluation is carried out for.
     */
    evaluate(host = null) {
        return this.#run(host, () => this.#evaluateValue());
    }

    /**
     * Resolves the event source the subscription ends in into what starts it: the source's name, the function that carries it out, the receiver and arguments it is called with and the environment, how each event it delivers is captured, and where it stands, for a failure to name.
     * The receiver and arguments are evaluated once, now; where one of them is null there is nothing to listen to, and the answer is null.
     * `capture` answers an event as the fields its type declares, read as it is called: a field the event does not carry as a value its type admits is null where the type is nullable, and fails the capture where it is not; an event of a type with no fields is taken whole, where it is of its type.
     * @returns {{ name: string, start: Function, capture: (event: unknown) => unknown, receiver: unknown, args: Record<string, unknown>, environment: Environment, location: object } | null}
     */
    resolveSource() {
        const call = this.#resolveCall('subscription', 'subscribed to');

        return call.args === null ? null : { name: call.name, start: call.implementation, capture: event => this.#captureEvent(event, call.node), receiver: call.receiver, args: call.args, environment: call.environment, location: call.location };
    }

    /**
     * Resolves the action the request ends in into what executes it: the action's name, the function that carries it out, the receiver and arguments it is called with and the environment, and where it stands, for a failure to name.
     * The receiver and arguments are evaluated once, now, as `evaluate` evaluates them without a host; where one of them is null the action is not executed, and the answer is null.
     * @returns {{ name: string, execute: Function, receiver: unknown, args: Record<string, unknown>, environment: Environment, location: object } | null}
     */
    resolveAction() {
        const call = this.#resolveCall('action', 'executed');

        return call.args === null ? null : { name: call.name, execute: call.implementation, receiver: call.receiver, args: call.args, environment: call.environment, location: call.location };
    }

    /**
     * Resolves the behavior the request ends in into what starts it: the behavior's declaration and name, the function that carries it out, the receiver and arguments it is called with and the environment, and where it stands, for a failure to name.
     * The receiver and arguments are evaluated now, as `evaluate` evaluates them without a host; where one of them is null there is nothing to start, and the arguments are null.
     * @returns {{ declaration: object, name: string, start: Function, receiver: unknown, args: Record<string, unknown> | null, environment: Environment, location: object }}
     */
    resolveBehavior() {
        const call = this.#resolveCall('behavior', 'applied');

        return { declaration: call.declaration, name: call.name, start: call.implementation, receiver: call.receiver, args: call.args, environment: call.environment, location: call.location };
    }

    /**
     * The result of an action, checked against the type the action declares and read through the object expression that follows it, if one does: an immutable snapshot containing no live DOM references.
     * The object expression is evaluated as `evaluate` evaluates an expression without a host, so a member maintained by an observation fails it. A result of another type, or an object expression that fails, throws an evaluation error.
     * @param {unknown} result What the action's function answered, or null for an action that was not executed, since its receiver or an argument was null.
     * @param {{ wasExecuted?: boolean }} [execution] Whether the action was executed, so its result is checked against the type it declares.
     */
    projectResult(result, { wasExecuted = true } = {}) {
        const { node, pointer } = this.#findTerminalMember();
        const { declaration, type } = this.#resolvedDefinition.resolutionOf(node);

        if (wasExecuted && !this.#conforms(result, type)) {
            this.#fail(`The action '${declaration.name}' answered ${Evaluator.#describe(result)}, and it declares ${type}`, pointer);
        }

        const copyStructures = Evaluator.#compileStructureCopy(type, this.#moduleRegistry);

        this.#projectionContext = { node, value: copyStructures === null ? result : copyStructures(result) };

        try {
            return this.#evaluateResult().value;
        } finally {
            this.#projectionContext = null;
        }
    }

    /**
     * The member the request ends in, evaluated up to its call: its declaration, the function that carries it out, and its receiver and arguments, which are null where the receiver or an argument is.
     * A member that follows a receiver of unknown type has no declaration and no function, and its receiver is null.
     */
    #resolveCall(kind, operationDescription) {
        if (this.#resolvedDefinition.kind !== kind) {
            this.#fail(`A ${this.#resolvedDefinition.kind} request is not ${operationDescription}`, '/expression');
        }

        const { node, pointer } = this.#findTerminalMember();
        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const { declaration } = resolution;
        const receiver = this.#evaluateNode(node.target, null);

        if (declaration === null) {
            return { declaration, name: node.name, implementation: null, receiver, args: null, environment: this.#environment, location: this.#locate(pointer), node };
        }

        const args = receiver === null ? null : this.#evaluateArguments(resolution, null);

        const implementation = this.#moduleRegistry.getFunction(declaration);

        if (implementation === undefined) {
            this.#fail(`The module '${this.#moduleRegistry.getOwner(declaration)}' supplies no function for '${declaration.name}'`, pointer);
        }

        return { declaration, name: declaration.name, implementation, receiver, args, environment: this.#environment, location: this.#locate(pointer), node };
    }

    /**
     * Evaluates the object expression that follows the event source against one event, as its source captured it, for the host given, answering as `evaluate` does.
     * @param {unknown} event The event, as `capture` answered it.
     * @param {Host | null} [host] What the evaluation is carried out for.
     */
    project(event, host = null) {
        return this.#run(host, () => {
            const { node } = this.#findTerminalMember();

            this.#projectionContext = { node, value: event };

            try {
                return this.#evaluateResult();
            } finally {
                this.#projectionContext = null;
            }
        });
    }

    /**
     * Runs one evaluation for the host, calling its `afterEvaluation` once as it ends: a failure of that hook after a failure is recorded on the failure as its `suppressed`, which stays the one thrown, and after a success fails the evaluation itself.
     */
    #run(host, produce) {
        this.#host = host;
        this.#isPending = false;

        let outcome = null;

        // The outcome is made only for a host that is told it, and the metadata only where it is read.
        const isTold = host?.afterEvaluation !== undefined;

        try {
            const result = produce();
            const isPending = this.#isPending;

            if (isTold) {
                outcome = { kind: isPending ? 'pending' : 'completed', value: result.value };
            }

            return new EvaluationResult(result.value, isPending, () => this.#metadataOf(result.node, result.value, result.identities, null));
        } catch (error) {
            if (isTold) {
                outcome = { kind: 'failed', error };
            }

            throw error;
        } finally {
            this.#host = null;

            if (isTold) {
                try {
                    host.afterEvaluation(Object.freeze(outcome));
                } catch (cleanupError) {
                    if (outcome.kind !== 'failed') {
                        // A failure as the evaluation ends fails it; the finally block's throw replaces the completed result.
                        throw cleanupError;
                    }

                    try {
                        Object.defineProperty(outcome.error, 'suppressed', { value: cleanupError, configurable: true });
                    } catch {
                        // A failure that cannot record it keeps its own.
                    }
                }
            }
        }
    }

    /** The detached result, and the metadata that describes it, which the result itself never holds. */
    #evaluateValue() {
        if (this.#resolvedDefinition.kind !== 'value') {
            this.#fail(`A ${this.#resolvedDefinition.kind} request is not evaluated`, '/expression');
        }

        return this.#evaluateResult();
    }

    #evaluateNode(node, evaluationContext) {
        return this.#getCompiledFunction(node)(this, evaluationContext);
    }

    /** The function the node compiles to, built the first time it is asked for and kept for every evaluation of its resolved definition. */
    #getCompiledFunction(node) {
        let compiledFunction = this.#compiledFunctions.get(node);

        if (compiledFunction === undefined) {
            compiledFunction = this.#compileNode(node);
            this.#compiledFunctions.set(node, compiledFunction);
        }

        return compiledFunction;
    }

    /** The node as a function of the evaluator and the evaluation context, each kind evaluated as its section of the specification sets out, the nodes it holds compiled with it. */
    #compileNode(node) {
        switch (node.kind) {
            case 'literal': {
                const { value } = node;

                return () => value;
            }
            case 'parameter':
                return evaluator => evaluator.#parameterBindings.get(node.name);
            case 'root':
                switch (node.name) {
                    case 'window':
                        return evaluator => evaluator.#environment.window;
                    case 'document':
                        return evaluator => evaluator.#environment.document;
                    default:
                        return evaluator => evaluator.#objectRoot;
                }
            case 'context':
                return (evaluator, evaluationContext) => evaluationContext;
            case 'local': {
                const resolution = this.#resolvedDefinition.resolutionOf(node);

                if (resolution?.kind === 'binding') {
                    const { conditional } = resolution;

                    return evaluator => evaluator.#boundValues.get(conditional);
                }

                return evaluator => evaluator.#evaluateLocal(node);
            }
            case 'member':
            case 'call':
            case 'indexer':
                return this.#compileMember(node);
            case 'equality': {
                const left = this.#getCompiledFunction(node.left);
                const right = this.#getCompiledFunction(node.right);

                return (evaluator, evaluationContext) => {
                    const value = left(evaluator, evaluationContext);

                    return value === right(evaluator, evaluationContext);
                };
            }
            case 'conditional': {
                const consequent = this.#getCompiledFunction(node.consequent);
                const alternative = this.#getCompiledFunction(node.alternative);

                if (node.binding !== undefined) {
                    const bind = this.#getCompiledFunction(node.binding.value);

                    // The value is evaluated once; where it is truthy, the consequent reads it through the name it is bound to, and the branch taken is recorded for the value's place in the result.
                    return (evaluator, evaluationContext) => {
                        const value = bind(evaluator, evaluationContext);
                        const isTruthy = Evaluator.#isTruthy(value);

                        (evaluator.#selections ??= new Map()).set(node, isTruthy ? node.consequent : node.alternative);

                        if (!isTruthy) {
                            return alternative(evaluator, evaluationContext);
                        }

                        const enclosing = evaluator.#boundValues.get(node);

                        evaluator.#boundValues.set(node, value);

                        try {
                            return consequent(evaluator, evaluationContext);
                        } finally {
                            if (enclosing === undefined) {
                                evaluator.#boundValues.delete(node);
                            } else {
                                evaluator.#boundValues.set(node, enclosing);
                            }
                        }
                    };
                }

                const condition = this.#getCompiledFunction(node.condition);

                // The branch the condition selects is recorded for the value's place in the result.
                return (evaluator, evaluationContext) => {
                    const isTrue = Evaluator.#isTruthy(condition(evaluator, evaluationContext));

                    (evaluator.#selections ??= new Map()).set(node, isTrue ? node.consequent : node.alternative);

                    return (isTrue ? consequent : alternative)(evaluator, evaluationContext);
                };
            }
            case 'optionalChain':
                // An access that meets null answers null, and so does everything after it in its chain, which is evaluated no further.
                return this.#getCompiledFunction(node.target);
            case 'coalescing': {
                const value = this.#getCompiledFunction(node.value);
                const fallback = this.#getCompiledFunction(node.fallback);

                return (evaluator, evaluationContext) => {
                    const answer = value(evaluator, evaluationContext);

                    (evaluator.#selections ??= new Map()).set(node, answer === null ? node.fallback : node.value);

                    return answer === null ? fallback(evaluator, evaluationContext) : answer;
                };
            }
            case 'and':
            case 'or': {
                const operands = node.operands.map(operand => this.#getCompiledFunction(operand));
                const decidesWhenTruthy = node.kind === 'or';
                const last = operands.length - 1;

                // The first operand that decides it, falsey for `and` and truthy for `or`, or else the last, is its value as it is, and the operand it is is recorded for the value's place in the result.
                return (evaluator, evaluationContext) => {
                    for (let index = 0; ; index++) {
                        const value = operands[index](evaluator, evaluationContext);

                        if (index === last || Evaluator.#isTruthy(value) === decidesWhenTruthy) {
                            (evaluator.#selections ??= new Map()).set(node, node.operands[index]);

                            return value;
                        }
                    }
                };
            }
            case 'not': {
                const operand = this.#getCompiledFunction(node.operand);

                return (evaluator, evaluationContext) => !Evaluator.#isTruthy(operand(evaluator, evaluationContext));
            }
            case 'function':
                // A function's value is its closure: the locals, the evaluation context and the object root where it is declared, which each call evaluates its body in.
                return (evaluator, evaluationContext) => ({ function: node, frame: evaluator.#localsFrame, evaluationContext, objectRoot: evaluator.#objectRoot });
            case 'functionCall': {
                const { targets: resolvedTargets, binding } = this.#resolvedDefinition.resolutionOf(node);
                const targets = this.#compileTargets(resolvedTargets);
                const evaluateArguments = node.arguments.map(argument => this.#getCompiledFunction(argument));
                const local = { name: node.name };

                // The arguments are evaluated once each, left to right, in the caller's scope, and the body of the function the name holds in its closure's, so no local of the caller's is visible in it;
                // where the name may hold one of several, the one it holds is recorded for the value's place in the result.
                return (evaluator, evaluationContext) => {
                    const closure = binding === undefined ? evaluator.#evaluateLocal(local) : evaluator.#boundValues.get(binding);
                    const values = evaluateArguments.map(evaluateArgument => evaluateArgument(evaluator, evaluationContext));
                    const target = targets.length === 1 ? targets[0] : targets.find(candidate => candidate.function === closure.function);

                    if (targets.length > 1) {
                        (evaluator.#selections ??= new Map()).set(node, target.function);
                    }

                    return evaluator.#callClosure(closure, target, values);
                };
            }
            case 'do':
                return this.#getCompiledFunction(node.body);
            case 'body': {
                const locals = node.locals.map(local => ({ name: local.name, evaluate: this.#getCompiledFunction(local.value) }));
                const result = this.#getCompiledFunction(node.result);

                // Each local is evaluated once, in order, whenever the body runs, an unused one included, each seeing those before it, and then the result, all against the body's evaluation context.
                return (evaluator, evaluationContext) => {
                    const frame = { node, item: evaluationContext, values: new Map(), enclosing: evaluator.#localsFrame };
                    const enclosingSelections = evaluator.#selections;

                    evaluator.#localsFrame = frame;

                    try {
                        for (const local of locals) {
                            evaluator.#selections = null;

                            const value = local.evaluate(evaluator, evaluationContext);

                            frame.values.set(local.name, { value, selections: evaluator.#selections });
                        }

                        evaluator.#selections = enclosingSelections;

                        return result(evaluator, evaluationContext);
                    } finally {
                        evaluator.#localsFrame = frame.enclosing;
                    }
                };
            }
            case 'interpolatedString': {
                const parts = node.parts.map(part => (part.kind === 'text' ? part.value : { expression: part.expression, evaluate: this.#getCompiledFunction(part.expression) }));

                // Each interpolation is evaluated once, from left to right, and its value inserted as its text: a string as it is and a number as the built-in conversion writes it, negative zero as "0".
                return (evaluator, evaluationContext) => {
                    let text = '';

                    for (const part of parts) {
                        if (typeof part === 'string') {
                            text += part;
                            continue;
                        }

                        const value = part.evaluate(evaluator, evaluationContext);

                        if (typeof value !== 'string' && typeof value !== 'number') {
                            throw LexicaError.evaluation(`An interpolation inserts a string or a number, and is given ${Evaluator.#describe(value)}`, evaluator.#locate(evaluator.#pointerOf(part.expression)));
                        }

                        text += String(value);
                    }

                    return text;
                };
            }
            case 'comparison': {
                const operands = node.operands.map(operand => this.#getCompiledFunction(operand));
                const compares = node.operators.map(operator => COMPARISONS[operator]);

                // Each operand is evaluated once, left to right, the one between two operators compared with both, and the first comparison that is false answers false without evaluating the operands after it.
                return (evaluator, evaluationContext) => {
                    let left = operands[0](evaluator, evaluationContext);

                    for (let index = 0; index < compares.length; index++) {
                        const right = operands[index + 1](evaluator, evaluationContext);

                        if (typeof left !== 'number' || typeof right !== 'number') {
                            throw LexicaError.evaluation(`'${node.operators[index]}' compares numbers, and is given ${Evaluator.#describe(typeof left !== 'number' ? left : right)}`, evaluator.#locate(evaluator.#pointerOf(node)));
                        }

                        if (!compares[index](left, right)) {
                            return false;
                        }

                        left = right;
                    }

                    return true;
                };
            }
            case 'arithmetic': {
                // The left operand is evaluated, then the right; arithmetic does not short-circuit, and an operand that fails stops it.
                const left = this.#getCompiledFunction(node.left);
                const right = this.#getCompiledFunction(node.right);
                const operate = ARITHMETIC[node.operator];

                return (evaluator, evaluationContext) => {
                    const leftValue = left(evaluator, evaluationContext);
                    const rightValue = right(evaluator, evaluationContext);

                    return evaluator.#arithmeticResult(node, operate(leftValue, rightValue), leftValue, rightValue);
                };
            }
            case 'negate': {
                const operand = this.#getCompiledFunction(node.operand);

                return (evaluator, evaluationContext) => {
                    const value = operand(evaluator, evaluationContext);

                    return evaluator.#arithmeticResult(node, -value, value, 0);
                };
            }
            case 'cast':
                return this.#compileCast(node, false);
            case 'conversion':
                return this.#compileConversion(node, false);
            case 'try':
                return node.target.kind === 'cast' ? this.#compileCast(node.target, true) : this.#compileConversion(node.target, true);
            case 'object':
                return this.#compileObject(node);
            default:
                this.#fail(`A '${node.kind}' node has no evaluation`, this.#pointerOf(node));
        }
    }

    /**
     * A cast, with its target evaluated once: its target itself where it is of the type, and null where it is null. A target of another type fails the evaluation of a cast, and an attempted one answers null instead.
     */
    #compileCast(node, isAttempted) {
        const target = this.#getCompiledFunction(node.target);
        const { type } = node;

        return (evaluator, evaluationContext) => {
            const value = target(evaluator, evaluationContext);

            if (value === null || evaluator.#conformsNamed(value, type)) {
                return value;
            }

            if (isAttempted) {
                return null;
            }

            return evaluator.#fail(`The cast to ${type} rejected its value: it is ${Evaluator.#describeKind(value)}`, evaluator.#pointerOf(node));
        };
    }

    /**
     * A conversion, with its target evaluated once and its conversion carried out once. Null converts to null, and a value already of the type to itself, without a conversion;
     * a conversion that rejects its value fails the evaluation, and an attempted one answers null instead. A fault fails the evaluation of either, as a failure of its target does.
     */
    #compileConversion(node, isAttempted) {
        const target = this.#getCompiledFunction(node.target);
        const { declaration, type } = this.#resolvedDefinition.resolutionOf(node);

        if (declaration === null) {
            return target;
        }

        const name = LexicaModule.conversionNameOf(declaration);
        const attempt = Evaluator.#compileConversionAttempt(declaration, type, this.#moduleRegistry);

        return (evaluator, evaluationContext) => {
            const value = target(evaluator, evaluationContext);

            if (value === null) {
                return null;
            }

            const outcome = attempt(evaluator, value, node);

            if (!outcome.isAccepted) {
                if (isAttempted) {
                    return null;
                }

                evaluator.#fail(`The conversion from ${name} rejected its value: ${outcome.reason}`, evaluator.#pointerOf(node));
            }

            return outcome.value;
        };
    }

    /**
     * The conversion of a value that is not null, attempted or not: its converted value where it accepts the value, or the reason it rejected it with.
     * A rejection is the signal `reject` throws for this attempt alone; any other exception, a reason that is no string, a rejection the conversion caught and answered past, and a value not of the type are faults, which fail the evaluation, attempted or not.
     */
    static #compileConversionAttempt(declaration, type, moduleRegistry) {
        const name = LexicaModule.conversionNameOf(declaration);
        const convert = moduleRegistry.getFunction(declaration);
        const conforms = Evaluator.#compileTypeCheck(type, moduleRegistry);
        const copyStructure = Evaluator.#compileStructureCopy(type, moduleRegistry);

        return (evaluator, value, node) => {
            if (convert === undefined) {
                evaluator.#fail(`The module '${moduleRegistry.getOwner(declaration)}' supplies no function for the conversion from ${name}`, evaluator.#pointerOf(node));
            }

            const rejection = { isRejected: false, reason: null };
            const reject = reason => {
                rejection.isRejected = true;
                rejection.reason = reason;

                throw rejection;
            };
            let converted;

            try {
                converted = convert(value, { reject });
            } catch (error) {
                if (error !== rejection) {
                    throw LexicaError.evaluation(`The conversion from ${name} failed: ${error?.message ?? String(error)}`, evaluator.#locate(evaluator.#pointerOf(node)), { cause: error });
                }

                if (typeof rejection.reason !== 'string') {
                    evaluator.#fail(`The conversion from ${name} rejected its value with a reason that is no string`, evaluator.#pointerOf(node));
                }

                return { isAccepted: false, reason: rejection.reason };
            }

            if (rejection.isRejected) {
                evaluator.#fail(`The conversion from ${name} rejected its value and then answered one`, evaluator.#pointerOf(node));
            }

            if (!conforms(converted)) {
                evaluator.#fail(`The conversion from ${name} answered ${Evaluator.#describe(converted)}, and it converts to ${type}`, evaluator.#pointerOf(node));
            }

            return { isAccepted: true, value: copyStructure === null ? converted : copyStructure(converted) };
        };
    }

    /**
     * A property access, a call or an indexer, with its resolution, its function, its arguments and the check of its result made once.
     * A bracket property access, and a member of a receiver of unknown type, which answers null without reading anything, are evaluated as the node itself says.
     */
    #compileMember(node) {
        const resolution = this.#resolvedDefinition.resolutionOf(node);

        if (resolution === undefined || resolution.kind === 'bracketPropertyAccess' || (resolution.kind !== 'field' && resolution.kind !== 'objectRootField' && resolution.declaration === null)) {
            return (evaluator, evaluationContext) => evaluator.#evaluateMember(node, evaluationContext);
        }

        const target = this.#getCompiledFunction(node.target);

        if (resolution.kind === 'objectRootField') {
            const { name } = resolution;

            return (evaluator, evaluationContext) => evaluator.#readObjectRootField(target(evaluator, evaluationContext), name);
        }

        if (resolution.kind === 'field') {
            const { name } = resolution;

            return (evaluator, evaluationContext) => {
                if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                    return evaluator.#projectionContext.value;
                }

                return evaluator.#readField(target(evaluator, evaluationContext), name);
            };
        }

        const { type } = resolution;
        // A condition the request selects carries it out as it declares itself.
        const declaration = resolution.contract ?? resolution.declaration;
        const implementation = this.#moduleRegistry.getFunction(declaration);
        const conforms = Evaluator.#compileTypeCheck(type, this.#moduleRegistry);
        const copyStructures = Evaluator.#compileStructureCopy(type, this.#moduleRegistry);
        const evaluateArguments = this.#compileArguments(resolution);

        return (evaluator, evaluationContext) => {
            // A projection stands the event or the result where its member is, so that member is never read again.
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            const receiver = target(evaluator, evaluationContext);

            if (receiver === null) {
                return null;
            }

            const args = evaluateArguments(evaluator, evaluationContext);

            return args === null ? null : evaluator.#invokeImplementation(declaration, implementation, conforms, copyStructures, receiver, args, type, node);
        };
    }

    /**
     * The arguments a call is given, in the order they are written, each argument's plan made once: its default or fixed value, an expression evaluated against each item, or a value, null where it makes the call answer null.
     * An options object's written values are its fields: each is in scope after its evaluation for the options after it that read it, holding its value and the selections it made, and one no other object encloses
     * builds the outermost object, which `root` refers to while its options are evaluated, each written value a field of it after its evaluation; a default is none.
     */
    #compileArguments(resolution) {
        if (resolution.arguments.length === 0) {
            return () => NO_ARGUMENTS;
        }

        const { buildsObjectRoot } = resolution;
        const isOptions = resolution.declaration.input === 'options';
        const argumentPlans = resolution.arguments.map((argument, index) => {
            const { parameter } = argument;
            const isOption = isOptions && !argument.isDefault && parameter.kind !== 'expression' && parameter.kind !== 'predicate';
            const isRead = isOption && resolution.arguments.slice(index + 1).some(later => !later.isDefault && Evaluator.#readsLocal(later.node, parameter.name));
            const isField = isOption && buildsObjectRoot === true;

            if (argument.isDefault || parameter.fixed) {
                return { name: parameter.name, kind: 'constant', value: argument.isDefault ? parameter.default : argument.value, isRead, isField };
            }

            const plan = { name: parameter.name, kind: parameter.kind, evaluate: this.#getCompiledFunction(argument.node), propagatesNull: parameter.nulls === 'propagate', isOption, isRead, isField };

            if (parameter.kind !== 'function') {
                return plan;
            }

            const { targets, parameterTypes, resultType } = argument.callback;

            return { ...plan, propagatesNull: false, member: resolution.declaration.name, targets: this.#compileTargets(targets), parameterTypes, resultType, pointer: argument.pointer };
        });

        return (evaluator, evaluationContext) => {
            const args = {};
            const enclosingObjectRoot = evaluator.#objectRoot;
            const enclosingLocals = evaluator.#localsFrame;
            const object = buildsObjectRoot === true ? {} : null;
            const rootSelections = object === null ? null : new Map();

            if (object !== null) {
                evaluator.#objectRoot = object;
                evaluator.#objectRootSelections.set(object, rootSelections);
            }

            try {
                for (const plan of argumentPlans) {
                    let selections = null;
                    let held;

                    if (plan.kind === 'constant') {
                        args[plan.name] = plan.value;
                        held = plan.value;
                    } else if (plan.kind === 'expression' || plan.kind === 'predicate') {
                        // The member evaluates it when it chooses, after its options are evaluated, so an option keeps the names and the object root in scope where it is written; a positional argument's are the member's own.
                        const { evaluate } = plan;
                        const frame = evaluator.#localsFrame;
                        const objectRoot = evaluator.#objectRoot;
                        const evaluateItem = isOptions ? item => evaluator.#evaluateWithin(frame, objectRoot, () => evaluate(evaluator, item)) : item => evaluate(evaluator, item);

                        args[plan.name] = plan.kind === 'expression' ? evaluateItem : item => Evaluator.#isTruthy(evaluateItem(item));
                    } else {
                        let value;

                        if (plan.isOption) {
                            ({ value, selections } = evaluator.#evaluateOption(plan, evaluationContext));
                        } else {
                            value = plan.evaluate(evaluator, evaluationContext);
                        }

                        if (value === null && plan.propagatesNull) {
                            return null;
                        }

                        // A function value goes to the member as a function it calls, while the expression's own names and fields hold the value itself.
                        held = value;
                        args[plan.name] = plan.kind === 'function' ? evaluator.#callbackOf(value, plan) : value;
                    }

                    if (plan.isField) {
                        object[plan.name] = held;
                        rootSelections.set(plan.name, selections);
                    }

                    if (plan.isRead) {
                        evaluator.#localsFrame = { node: { locals: [{ name: plan.name }] }, item: evaluationContext, values: new Map([[plan.name, { value: held, selections }]]), enclosing: evaluator.#localsFrame };
                    }
                }

                return args;
            } finally {
                evaluator.#objectRoot = enclosingObjectRoot;
                evaluator.#localsFrame = enclosingLocals;
            }
        };
    }

    /** The functions a call may evaluate, each with its body compiled once: the function, its parameters and its body's compiled function. */
    #compileTargets(targets) {
        return targets.map(target => ({ function: target.function, parameters: target.parameters, evaluateBody: this.#getCompiledFunction(target.body) }));
    }

    /** The value of a call of the closure: the target's body, evaluated in the closure's scope, evaluation context and object root, its parameters bound to the values in order. */
    #callClosure(closure, target, values) {
        const { parameters } = target;
        const enclosingFrame = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;

        this.#localsFrame = { node: { locals: parameters.map(parameter => ({ name: parameter })) }, item: closure.evaluationContext, values: new Map(parameters.map((parameter, index) => [parameter, { value: values[index], selections: null }])), enclosing: closure.frame };
        this.#objectRoot = closure.objectRoot;

        try {
            return target.evaluateBody(this, closure.evaluationContext);
        } finally {
            this.#localsFrame = enclosingFrame;
            this.#objectRoot = enclosingObjectRoot;
        }
    }

    /**
     * The function a member is given for a parameter its contract declares to take one: a call of the closure with the member's arguments, each checked against the contract's parameter types, and its result against the contract's result type.
     * It is called while the member's invocation lasts, which closes it, and fails once that is over.
     */
    #callbackOf(closure, plan) {
        const { name, member, targets, parameterTypes, resultType, pointer } = plan;
        const target = targets.length === 1 ? targets[0] : targets.find(candidate => candidate.function === closure.function);
        const lifetime = { isOpen: true };
        const callback = (...values) => {
            try {
                if (!lifetime.isOpen) {
                    this.#fail(`The function given as '${name}' of '${member}' is called after '${member}' returned, and a member calls the functions it is given only while its own invocation lasts`, pointer);
                }

                if (values.length !== parameterTypes.length) {
                    this.#fail(`The function given as '${name}' of '${member}' is called with ${values.length === 1 ? 'one argument' : `${values.length} arguments`}, and its contract declares ${parameterTypes.length}`, pointer);
                }

                values.forEach((value, index) => {
                    if (!this.#conforms(value, parameterTypes[index])) {
                        this.#fail(`The function given as '${name}' of '${member}' is called with ${Evaluator.#describe(value)}, and its contract declares ${parameterTypes[index]}`, pointer);
                    }
                });

                const value = this.#callClosure(closure, target, values);

                if (!this.#conforms(value, resultType)) {
                    this.#fail(`The function given as '${name}' of '${member}' gave ${Evaluator.#describe(value)}, and its contract declares ${resultType}`, pointer);
                }

                return value;
            } catch (error) {
                // A thrown value that is no object is the member's to report, as anything it throws is.
                if (error !== null && typeof error === 'object') {
                    this.#callbackErrors.add(error);
                }

                throw error;
            }
        };

        this.#callbackLifetimes.set(callback, lifetime);

        return callback;
    }

    /** The lifetime of each function given to a member, open while the member's invocation lasts. @type {WeakMap<Function, { isOpen: boolean }>} */
    #callbackLifetimes = new WeakMap();

    /** The errors a function given to a member raised, which reach the expression as they are, not as the member's failure. @type {WeakSet<object>} */
    #callbackErrors = new WeakSet();

    /** What the evaluation gives with the frame of names and the object root in scope, those of the place it was written, both restored after it. */
    #evaluateWithin(frame, objectRoot, evaluate) {
        const enclosingLocals = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;

        this.#localsFrame = frame;
        this.#objectRoot = objectRoot;

        try {
            return evaluate();
        } finally {
            this.#localsFrame = enclosingLocals;
            this.#objectRoot = enclosingObjectRoot;
        }
    }

    /** The value of a written option and the selections its evaluation made, which are made where the option is evaluated as well. */
    #evaluateOption(plan, evaluationContext) {
        const enclosingSelections = this.#selections;

        this.#selections = null;

        try {
            const value = plan.evaluate(this, evaluationContext);

            return { value, selections: this.#selections };
        } finally {
            const selections = this.#selections;

            this.#selections = enclosingSelections;
            selections?.forEach((selection, node) => (this.#selections ??= new Map()).set(node, selection));
        }
    }

    /** An object expression, its target, its fields' names and values and whether it holds locals found once; applied to each item of a list it follows, and to the value it follows otherwise. */
    #compileObject(node) {
        const hasTarget = node.target !== undefined;
        const target = hasTarget ? this.#getCompiledFunction(node.target) : null;
        const names = this.#resolvedDefinition.fieldNamesOf(node);
        // A field the entries after it read is in scope for them, by the name the definition gives it.
        const fields = node.fields.map((field, index) => ({
            name: names[index],
            local: field.name,
            isRead: node.fields.slice(index + 1).some(later => Evaluator.#readsLocal(later.value, field.name)),
            evaluate: this.#getCompiledFunction(field.value),
        }));

        return (evaluator, evaluationContext) => {
            const value = hasTarget ? target(evaluator, evaluationContext) : evaluationContext;

            if (!(hasTarget && Array.isArray(value))) {
                return value === null && hasTarget ? null : evaluator.#applyFields(node, fields, value);
            }

            const items = [];
            let isOfElements = value.length > 0;

            for (const item of value) {
                items.push(item === null ? null : evaluator.#applyFields(node, fields, item));
                isOfElements &&= item === null || item?.nodeType === 1;
            }

            // A list of elements is projected item by item, so each item keeps the element it came from; two elements can project to the same data.
            if (isOfElements) {
                evaluator.#sourceElementsByList.set(items, [...value]);
            }

            return items;
        };
    }

    /** Whether the node reads a local or a field of the name anywhere within it, or calls the function it holds. */
    static #readsLocal(node, name) {
        if (Array.isArray(node)) {
            return node.some(item => Evaluator.#readsLocal(item, name));
        }

        if (node === null || typeof node !== 'object') {
            return false;
        }

        return ((node.kind === 'local' || node.kind === 'functionCall') && node.name === name) || Object.values(node).some(value => Evaluator.#readsLocal(value, name));
    }

    /**
     * The object the fields give the item, evaluated against it in order with the expression's locals in scope, with the selections made for each field; a field's name is a name, so it is assigned as it is.
     * A field the entries after it read is in scope for them from its evaluation on, holding its value and the selections it made, so a read of it evaluates nothing again.
     */
    #applyFields(node, fields, item) {
        const object = {};
        const enclosingSelections = this.#selections;
        const enclosingLocals = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;
        // An application no other encloses builds the outermost object, this object, which `root` refers to in its body; any other builds within that object.
        const rootSelections = enclosingObjectRoot === null ? new Map() : null;
        let fieldSelections = null;

        if (node.locals !== undefined) {
            this.#localsFrame = { node, item, values: new Map(), enclosing: enclosingLocals };
        }

        if (rootSelections !== null) {
            this.#objectRoot = object;
            this.#objectRootSelections.set(object, rootSelections);
        }

        try {
            for (const field of fields) {
                this.#selections = null;

                const value = field.evaluate(this, item);

                object[field.name] = value;

                if (this.#selections !== null) {
                    (fieldSelections ??= new Map()).set(field.name, this.#selections);
                }

                rootSelections?.set(field.name, this.#selections);

                if (field.isRead) {
                    this.#localsFrame = { node: { locals: [{ name: field.local }] }, item, values: new Map([[field.local, { value, selections: this.#selections }]]), enclosing: this.#localsFrame };
                }
            }
        } finally {
            this.#selections = enclosingSelections;
            this.#localsFrame = enclosingLocals;
            this.#objectRoot = enclosingObjectRoot;
        }

        if (fieldSelections !== null) {
            this.#fieldSelectionsByObject.set(object, fieldSelections);
        }

        return object;
    }

    /**
     * The copy a type makes of a value it admits: a declared structure as its declared fields alone, each read as the value offers it, a getter's included, so its declaration is the shape a result holds,
     * and a list item by item; null for a type that holds no declared structure, whose values stand as they are. A structure's fields are found at its first copy, so a structure that holds itself is copied as deep as its value goes.
     */
    static #compileStructureCopy(type, moduleRegistry) {
        switch (type.kind) {
            case 'list': {
                const copyItem = Evaluator.#compileStructureCopy(type.itemType, moduleRegistry);

                return copyItem === null ? null : value => (value === null ? null : value.map(item => (item === null ? null : copyItem(item))));
            }
            case 'named': {
                const structure = moduleRegistry.getType(type.name);

                if (structure === undefined) {
                    return null;
                }

                // It holds the registry alone, never an evaluator, so it holds nothing an evaluation bound.
                let fields = null;
                let isFlat = false;

                return value => {
                    if (value === null) {
                        return null;
                    }

                    if (fields === null) {
                        fields = Evaluator.#fieldTypesOf(structure).map(([name, fieldType]) => [name, Evaluator.#compileStructureCopy(fieldType, moduleRegistry)]);
                        isFlat = fields.every(([, copyField]) => copyField === null);
                    }

                    // An answer that is a plain object of its declared fields alone, none of them a structure, is its declared shape already, as a built-in member's is.
                    if (isFlat && Evaluator.#holdsExactly(value, structure.fields, fields.length)) {
                        return value;
                    }

                    const copy = {};

                    for (const [name, copyField] of fields) {
                        const field = value[name];

                        // A field's name is a name, so it is assigned as it is.
                        copy[name] = copyField === null || field === null ? field : copyField(field);
                    }

                    return copy;
                };
            }
            default:
                return null;
        }
    }

    /** Whether the value is a plain object whose own keys are the declared fields alone. */
    static #holdsExactly(value, declaredFields, count) {
        if (Object.getPrototypeOf(value) !== Object.prototype) {
            return false;
        }

        let found = 0;

        for (const key in value) {
            if (!Object.hasOwn(declaredFields, key)) {
                return false;
            }

            found++;
        }

        return found === count;
    }

    /** Whether a value is one the type admits, as `#conforms` answers, with the type's structure found once and each declared structure's fields at its first check. */
    static #compileTypeCheck(type, moduleRegistry) {
        const admits = Evaluator.#compileNonNullTypeCheck(type, moduleRegistry);

        return value => (value === undefined ? false : value === null ? type.isNullable : admits(value));
    }

    /** A compiled function holds the registry alone, never an evaluator, so it holds nothing an evaluation bound; a structure that holds itself is checked as deep as its value goes. */
    static #compileNonNullTypeCheck(type, moduleRegistry) {
        switch (type.kind) {
            case 'typeParameter':
                return () => true;
            case 'list': {
                const checkItem = Evaluator.#compileTypeCheck(type.itemType, moduleRegistry);

                return value => Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(checkItem);
            }
            case 'object': {
                const fields = [...type.fieldTypes].map(([name, fieldType]) => [name, Evaluator.#compileTypeCheck(fieldType, moduleRegistry)]);

                return value => ObjectUtils.isNonArrayObject(value) && fields.every(([name, conforms]) => conforms(value[name]));
            }
            default: {
                const { name } = type;
                const structure = moduleRegistry.getType(name);

                if (structure === undefined) {
                    return value => Evaluator.#isOfBuiltIn(value, name) ?? false;
                }

                let fields = null;

                return value => {
                    if (!ObjectUtils.isNonArrayObject(value)) {
                        return false;
                    }

                    fields ??= Evaluator.#fieldTypesOf(structure).map(([field, fieldType]) => [field, Evaluator.#compileTypeCheck(fieldType, moduleRegistry)]);

                    return fields.every(([field, conforms]) => conforms(value[field]));
                };
            }
        }
    }

    /**
     * The value of the local the node names: evaluated at its first use in the application of the object expression that holds it, against that application's evaluation context and the locals in scope where it is written, and the same value at every later use there.
     * The selections its evaluation made are recorded at every place in the result it is used.
     */
    #evaluateLocal(node) {
        let frame = this.#localsFrame;

        // A frame is an object expression's, whose locals are evaluated at their first use, or a body's, whose bindings it evaluated in order before its result.
        while (!frame.node.locals.some(local => local.name === node.name)) {
            frame = frame.enclosing;
        }

        let cachedLocal = frame.values.get(node.name);

        if (cachedLocal === undefined) {
            const enclosingLocals = this.#localsFrame;
            const enclosingSelections = this.#selections;

            this.#localsFrame = frame;
            this.#selections = null;

            try {
                cachedLocal = { value: this.#evaluateNode(frame.node.locals.find(local => local.name === node.name).value, frame.item), selections: this.#selections };
            } finally {
                this.#localsFrame = enclosingLocals;
                this.#selections = enclosingSelections;
            }

            frame.values.set(node.name, cachedLocal);
        }

        if (cachedLocal.selections !== null) {
            const selections = (this.#selections ??= new Map());

            cachedLocal.selections.forEach((selection, node) => selections.set(node, selection));
        }

        return cachedLocal.value;
    }

    #evaluateMember(node, evaluationContext) {
        // A projection stands the event or the result where its member is, so that member is never read again.
        if (node === this.#projectionContext?.node) {
            return this.#projectionContext.value;
        }

        const receiver = this.#evaluateNode(node.target, evaluationContext);

        if (receiver === null) {
            return null;
        }

        const resolution = this.#resolvedDefinition.resolutionOf(node);

        if (resolution.kind !== 'bracketPropertyAccess') {
            return this.#readResolvedMember(resolution, receiver, node, evaluationContext);
        }

        // A bracket property access computes its name once and reads the property it selects, which is recorded for the value's place in the result.
        const name = this.#evaluateNode(node.name, evaluationContext);

        (this.#selections ??= new Map()).set(node, name);

        return this.#readResolvedMember(resolution.candidates.get(name), receiver, node, evaluationContext);
    }

    /** Reads the member the resolution names of the receiver: a field of its data, a field of the outermost object, or the declaration's function with the arguments it is given. */
    #readResolvedMember(resolution, receiver, node, evaluationContext) {
        if (resolution.kind === 'field') {
            return this.#readField(receiver, resolution.name);
        }

        if (resolution.kind === 'objectRootField') {
            return this.#readObjectRootField(receiver, resolution.name);
        }

        const args = this.#evaluateArguments(resolution, evaluationContext);

        return args === null ? null : this.#invokeMember(resolution.contract ?? resolution.declaration, receiver, args, resolution.type, node);
    }

    /** A field of a value, the selections that its value's evaluation made, where an object expression of this evaluation built the value, recorded where it is read; null for no receiver. */
    #readField(receiver, name) {
        if (receiver === null) {
            return null;
        }

        const selections = this.#fieldSelectionsByObject.get(receiver)?.get(name) ?? null;

        if (selections !== null) {
            const recorded = (this.#selections ??= new Map());

            selections.forEach((selection, node) => recorded.set(node, selection));
        }

        return receiver[name] ?? null;
    }

    /** A completed field of the outermost object, read through a reference to it as the value its evaluation gave, the selections it made recorded where it is read; null for no root, where a reference that can be null is. */
    #readObjectRootField(root, name) {
        if (root === null) {
            return null;
        }

        const selections = this.#objectRootSelections.get(root)?.get(name) ?? null;

        if (selections !== null) {
            const recorded = (this.#selections ??= new Map());

            selections.forEach((selection, node) => recorded.set(node, selection));
        }

        return root[name] ?? null;
    }

    /**
     * The result of an arithmetic operation, refused where an operand is no number, which a binding of no number can still give, where `/` or `%` divides by zero,
     * and where the result is no finite number, so neither infinity nor NaN reaches a result; each is an evaluation error at the operation.
     */
    #arithmeticResult(node, result, left, right) {
        const operator = node.kind === 'negate' ? '-' : node.operator;

        if (typeof left !== 'number' || typeof right !== 'number') {
            throw LexicaError.evaluation(`'${operator}' takes numbers, and is given ${typeof left !== 'number' ? Evaluator.#describe(left) : Evaluator.#describe(right)}`, this.#locate(this.#pointerOf(node)));
        }

        if ((operator === '/' || operator === '%') && right === 0 && node.kind === 'arithmetic') {
            throw LexicaError.evaluation(`'${operator}' divides by zero`, this.#locate(this.#pointerOf(node)));
        }

        if (!Number.isFinite(result)) {
            throw LexicaError.evaluation(`The result of '${operator}' is no finite number`, this.#locate(this.#pointerOf(node)));
        }

        return result;
    }

    /** The arguments by parameter name, or null where a null argument makes the call answer null, evaluated as a compiled member's are, their plan made once for the member's resolution. */
    #evaluateArguments(resolution, evaluationContext) {
        let evaluateArguments = this.#compiledArguments.get(resolution);

        if (evaluateArguments === undefined) {
            evaluateArguments = this.#compileArguments(resolution);
            this.#compiledArguments.set(resolution, evaluateArguments);
        }

        return evaluateArguments(this, evaluationContext);
    }

    /** Carries out a declaration's function, checking that its result is of the declared type. */
    #invokeMember(declaration, receiver, args, type, node) {
        return this.#invokeImplementation(declaration, this.#moduleRegistry.getFunction(declaration), value => this.#conforms(value, type), Evaluator.#compileStructureCopy(type, this.#moduleRegistry), receiver, args, type, node);
    }

    /** Carries out the function of a declaration whose function, check of its result and copy of the structures it holds are found already. */
    #invokeImplementation(declaration, implementation, conforms, copyStructures, receiver, args, type, node) {
        if (implementation === undefined) {
            this.#fail(`The module '${this.#moduleRegistry.getOwner(declaration)}' supplies no function for ${Evaluator.#isCondition(declaration) ? `the condition '${declaration.name}'` : `'${declaration.name}'`}`, this.#pointerOf(node));
        }

        const request = this.#host === null ? null : { declaration, receiver, args, pointer: this.#pointerOf(node) };
        const samples = this.#beforeInvoke(request, declaration, node);

        if (samples === null) {
            return null;
        }

        let value;

        try {
            value = implementation(receiver, args, this.#environment, samples);
        } catch (error) {
            if (this.#callbackErrors.has(error)) {
                throw error;
            }

            throw LexicaError.evaluation(`${this.#subjectOf(declaration, node)} failed: ${error?.message ?? String(error)}`, this.#locate(this.#pointerOf(node)), { cause: error });
        } finally {
            // A function the member was given is called only while its invocation lasts.
            for (const name in args) {
                const lifetime = this.#callbackLifetimes.get(args[name]);

                if (lifetime !== undefined) {
                    lifetime.isOpen = false;
                }
            }
        }

        if (!conforms(value)) {
            this.#fail(`${this.#subjectOf(declaration, node)} answered ${Evaluator.#describe(value)}, and ${Evaluator.#isCondition(declaration) ? 'a condition answers' : 'it declares'} ${type}`, this.#pointerOf(node));
        }

        if (request !== null && this.#host.afterInvoke !== undefined) {
            try {
                this.#host.afterInvoke(request, value);
            } catch (error) {
                this.#failHook(error, declaration, node, 'after its invocation');
            }
        }

        return copyStructures === null ? value : copyStructures(value);
    }

    /** Whether the declaration carrying a request out is a condition, which a call's fixed argument selects, rather than a member. */
    static #isCondition(declaration) {
        return declaration.kind === undefined;
    }

    /** What a message names as carrying the request out: the member, or the condition the call selects, with the module that declares it. */
    #subjectOf(declaration, node) {
        return Evaluator.#isCondition(declaration)
            ? `The condition '${declaration.name}' that '${node.name}' selects, declared by the module '${this.#moduleRegistry.getOwner(declaration)}',`
            : `The member '${declaration.name}'`;
    }

    /**
     * The samples a member's invocation reads, as the host's `beforeInvoke` answers them, or null where one is pending, which makes the member answer null and the evaluation pending.
     * Without the hook, a member that reads maintained values fails, since nothing answers its samples.
     */
    #beforeInvoke(request, declaration, node) {
        if (request === null || this.#host.beforeInvoke === undefined) {
            if (declaration.reads === 'maintained') {
                this.#fail(`${this.#subjectOf(declaration, node)} is maintained by an observation, and reading it waits for the first sample, which a synchronous evaluation cannot`, this.#pointerOf(node));
            }

            return NO_SAMPLES;
        }

        let answer;

        try {
            answer = this.#host.beforeInvoke(request);
        } catch (error) {
            this.#failHook(error, declaration, node, 'before its invocation');
        }

        if (answer?.pending === true) {
            this.#isPending = true;

            return null;
        }

        return answer ?? NO_SAMPLES;
    }

    /** Fails the evaluation at the member for what a hook around its invocation threw, a Lexica error keeping its own place; the hooks are called directly, since they run on every invocation. */
    #failHook(error, declaration, node, moment) {
        if (error instanceof LexicaError || this.#callbackErrors.has(error)) {
            throw error;
        }

        throw LexicaError.evaluation(`The host failed ${moment} of ${this.#subjectOf(declaration, node).replace(/^The /, 'the ').replace(/,$/, '')}: ${error?.message ?? String(error)}`, this.#locate(this.#pointerOf(node)), { cause: error });
    }


    /** The member a subscription, an action or a behavior request ends in, and where it stands: the object expressions of a request each follow the one before, and the first follows that member, which an optional chain may hold. */
    #findTerminalMember() {
        let node = this.#resolvedDefinition.definition.expression;
        let pointer = '/expression';

        while (node.kind === 'object' || node.kind === 'optionalChain') {
            node = node.target;
            pointer = `${pointer}/target`;
        }

        return { node, pointer };
    }

    /** The event as the fields its type declares, each read and checked now as the event gives it, or the event itself where its type declares no structure; copying the projection's result is what isolates the data it answers. */
    #captureEvent(event, node) {
        const pointer = this.#pointerOf(node);
        const { declaration, type } = this.#resolvedDefinition.resolutionOf(node);
        const { itemType } = type;
        const structure = itemType.kind === 'named' ? this.#moduleRegistry.getType(itemType.name) : undefined;

        if (structure === undefined) {
            if (!this.#conforms(event, itemType)) {
                this.#fail(`The event source '${declaration.name}' delivered ${Evaluator.#describe(event)}, and its event data is ${itemType}`, pointer);
            }

            return event;
        }

        const captured = {};

        for (const [name, fieldType] of Evaluator.#fieldTypesOf(structure)) {
            const value = event?.[name];

            if (this.#conforms(value, fieldType)) {
                const copyStructures = Evaluator.#compileStructureCopy(fieldType, this.#moduleRegistry);

                captured[name] = copyStructures === null ? value : copyStructures(value);
            } else if (fieldType.isNullable) {
                captured[name] = null;
            } else {
                this.#fail(`The event source '${declaration.name}' delivered an event whose '${name}' is ${Evaluator.#describe(value)}, and its type declares ${fieldType}`, pointer);
            }
        }

        return captured;
    }

    /** Whether the value is one the type admits. */
    #conforms(value, type) {
        if (value === undefined) {
            return false;
        }

        if (value === null) {
            return type.isNullable;
        }

        switch (type.kind) {
            case 'typeParameter':
                return true;
            case 'list':
                return Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(item => this.#conforms(item, type.itemType));
            case 'object':
                return ObjectUtils.isNonArrayObject(value) && [...type.fieldTypes].every(([name, fieldType]) => this.#conforms(value[name], fieldType));
            default:
                return this.#conformsNamed(value, type.name);
        }
    }

    #conformsNamed(value, name) {
        const isOfBuiltIn = Evaluator.#isOfBuiltIn(value, name);

        if (isOfBuiltIn !== undefined) {
            return isOfBuiltIn;
        }

        const structure = this.#moduleRegistry.getType(name);

        return structure !== undefined && ObjectUtils.isNonArrayObject(value) && Evaluator.#fieldTypesOf(structure).every(([field, type]) => this.#conforms(value[field], type));
    }

    /** Whether the value is of the built-in type the name names, or undefined where the name names a structure a module declares. */
    static #isOfBuiltIn(value, name) {
        switch (name) {
            case 'number':
                return Number.isFinite(value);
            case 'string':
                return typeof value === 'string';
            case 'boolean':
                return typeof value === 'boolean';
            case 'element':
                return value?.nodeType === 1;
            case 'document':
                return value?.nodeType === 9;
            case 'documentFragment':
                return value?.nodeType === 11 && value.host === undefined;
            case 'shadowRoot':
                return value?.nodeType === 11 && value.host !== undefined;
            case 'node':
                return value?.nodeType === 1 || value?.nodeType === 9 || value?.nodeType === 11;
            // An element's shadow view and its ARIA view are the element itself, which their types, never their values, tell from the element.
            case 'shadow':
            case 'aria':
                return value?.nodeType === 1;
            case 'window':
                return value?.window === value;
            default:
                return undefined;
        }
    }

    #fail(message, pointer) {
        throw LexicaError.evaluation(message, this.#locate(pointer));
    }

    /** Where the node stands in the definition, as a JSON Pointer. */
    #pointerOf(node) {
        return this.#resolvedDefinition.pointerOf(node);
    }

    #locate(pointer) {
        const source = this.#resolvedDefinition.sourcePointerOf(pointer);

        return this.#locations?.locate(source) ?? { pointer: source };
    }

    /** The fields of the declared structure, in order, each with its type. */
    static #fieldTypesOf(structure) {
        let fields = Evaluator.#fieldTypesByStructure.get(structure);

        if (fields === undefined) {
            fields = Object.entries(structure.fields).map(([name, text]) => [name, Type.parse(text)]);
            Evaluator.#fieldTypesByStructure.set(structure, fields);
        }

        return fields;
    }

    /** Whether a value is truthy: every value is but null and false. */
    static #isTruthy(value) {
        return value !== null && value !== false;
    }

    /** What kind of node the value is, for a message, or what it is where it is no node. */
    static #describeKind(value) {
        switch (value?.nodeType) {
            case 1:
                return 'an element';
            case 9:
                return 'a document';
            case 11:
                return value.host === undefined ? 'a document fragment' : 'a shadow root';
            default:
                return Evaluator.#describe(value);
        }
    }

    /** What the value is, for a message: nothing, a node, or its data where it has any. */
    static #describe(value) {
        if (value === undefined) {
            return 'nothing';
        }

        if (typeof value?.nodeType === 'number') {
            return value.nodeType === 1 ? 'an element' : 'a node';
        }

        const hole = Array.isArray(value) ? ArrayUtils.findMissingIndex(value) : -1;

        if (hole !== -1) {
            return `a list with a hole at index ${hole}`;
        }

        // A promise and an instance of a class are named as they are, since what they would be written as says nothing of them.
        if (typeof value?.then === 'function') {
            return 'a promise';
        }

        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !ObjectUtils.isPlainObject(value)) {
            return `an instance of ${value.constructor?.name || 'a class'}`;
        }

        try {
            return JSON.stringify(value) ?? String(value);
        } catch {
            return Object.prototype.toString.call(value);
        }
    }

    /** The expression evaluated and detached, with the metadata that describes it, built from the identities the copy left, which the evaluator lets go of once it hands them over, so it holds no element between evaluations. */
    #evaluateResult() {
        this.#sourceElementsByList = new WeakMap();
        this.#fieldSelectionsByObject = new WeakMap();
        this.#selections = null;

        try {
            const node = this.#resolvedDefinition.definition.expression;
            const value = this.#copyResult(this.#evaluateNode(node, null));

            // The metadata is described where it is first read, from identities no later evaluation changes, so a caller that reads the value alone pays nothing for it.
            return { node, value, identities: Evaluator.#withSelections(this.#copiedIdentities, this.#selections) };
        } finally {
            this.#copiedIdentities = null;
            this.#selections = null;
        }
    }

    /**
     * A frozen copy of the data sharing no structure with the original; the identities that follow its structure are left in `#copiedIdentities`: for a list projected from elements, the element each item came from, for a field, the selections made for its value, as `branches`, and null where nothing beneath holds either.
     */
    #copyResult(value) {
        if (Array.isArray(value)) {
            const copy = [];
            const itemIdentities = [];
            let hasIdentities = false;

            for (const item of value) {
                copy.push(this.#copyResult(item));
                itemIdentities.push(this.#copiedIdentities);
                hasIdentities ||= this.#copiedIdentities !== null;
            }

            const elements = this.#sourceElementsByList.get(value) ?? null;

            this.#copiedIdentities = elements === null && !hasIdentities ? null : { elements, items: itemIdentities };

            return Object.freeze(copy);
        }

        if (ObjectUtils.isNonArrayObject(value)) {
            const copy = {};
            const fieldSelections = this.#fieldSelectionsByObject.get(value);
            let fieldIdentities = null;

            for (const name of Object.keys(value)) {
                const field = this.#copyResult(value[name]);

                // A read copies every field of every row, so an ordinary field is assigned here, where the assignment sees only the copies' shapes; sharing the one in `defineDataProperty` with live state's writes made reads measurably slower.
                if (name === '__proto__') {
                    ObjectUtils.defineDataProperty(copy, name, field);
                } else {
                    copy[name] = field;
                }

                const identities = Evaluator.#withSelections(this.#copiedIdentities, fieldSelections?.get(name) ?? null);

                if (identities !== null) {
                    fieldIdentities ??= {};
                    ObjectUtils.defineDataProperty(fieldIdentities, name, identities);
                }
            }

            this.#copiedIdentities = fieldIdentities === null ? null : { fields: fieldIdentities };

            return Object.freeze(copy);
        }

        this.#copiedIdentities = null;

        return value;
    }

    /**
     * The metadata of the value an expression gave at its place in the result, read from the identities its copy left there: the record of the expression that produced it, followed through locals, bodies, `do` blocks, function calls,
     * object-root fields, the branch or operand a selecting expression selected and the property a bracket property access selected; a field read keeps the record its whole has for that field, or its whole's own.
     * An object expression's value records each field, and a projection's each item and the reference it came from. The value is undefined where the expression is described for a part read from it, and nothing beyond its record is described then.
     * The context is the record of the value `context` stands for where the expression stands, the value an object expression follows or the item it projects, or null where there is none.
     */
    #metadataOf(node, value, identities, context) {
        const branches = identities?.branches ?? null;

        for (;;) {
            switch (node.kind) {
                case 'local':
                    node = this.#resolvedDefinition.resolutionOf(node).value;
                    continue;
                case 'optionalChain':
                    node = node.target;
                    continue;
                case 'body':
                    node = node.result;
                    continue;
                case 'do':
                    node = node.body;
                    continue;
                case 'functionCall': {
                    const { targets } = this.#resolvedDefinition.resolutionOf(node);
                    const called = targets.length === 1 ? targets[0] : targets.find(target => target.function === branches?.get(node));

                    if (called === undefined) {
                        return this.#recordOf(node, null, null);
                    }

                    node = called.body;
                    continue;
                }
                case 'member':
                case 'call':
                case 'indexer': {
                    let resolution = this.#resolvedDefinition.resolutionOf(node);
                    let candidate = null;

                    if (resolution?.kind === 'bracketPropertyAccess') {
                        candidate = branches?.get(node) ?? null;

                        if (candidate === null) {
                            return this.#recordOf(node, null, null);
                        }

                        resolution = resolution.candidates.get(candidate);
                    }

                    if (resolution?.kind === 'objectRootField') {
                        node = resolution.value;
                        continue;
                    }

                    if (resolution?.kind === 'field') {
                        const whole = this.#metadataOf(node.target, undefined, identities, context);

                        return whole.fields?.[candidate ?? resolution.name] ?? Evaluator.#inherited(whole);
                    }

                    return this.#recordOf(node, candidate, resolution?.declaration?.tolerance ?? null);
                }
                case 'context':
                    return context ?? this.#recordOf(node, null, null);
                case 'object':
                    return this.#metadataOfObject(node, value, identities, context);
                default:
                    if (SELECTING_KINDS.has(node.kind)) {
                        const selected = branches?.get(node);

                        if (selected === undefined) {
                            return this.#recordOf(node, null, null);
                        }

                        node = selected;
                        continue;
                    }

                    return this.#recordOf(node, null, null);
            }
        }
    }

    /** The metadata of an object expression's value: an object's record of each field, a projected list's record of each item with the reference each came from, or its own record alone where it gave null or is described for a part read from it. */
    #metadataOfObject(node, value, identities, context) {
        // The fields read `context` as the value the expression follows, each item of it where it projects a list, and as the enclosing one where it follows none.
        const followed = node.target === undefined ? null : this.#metadataOf(node.target, undefined, identities, context);

        if (Array.isArray(value)) {
            const itemContext = followed === null ? context : Evaluator.#inherited(followed);
            const items = value.map((item, index) => this.#metadataOfFields(node, item, identities?.items?.[index] ?? null, itemContext));
            const sources = identities?.elements ?? null;

            return Object.freeze({ origin: this.#recordOf(node, null, null).origin, tolerance: null, items: Object.freeze(items), sources: sources === null ? null : Object.freeze([...sources]) });
        }

        return value === null ? this.#recordOf(node, null, null) : this.#metadataOfFields(node, value, identities, followed ?? context);
    }

    /** The record of an object an object expression built, with each field's, by its name in the order written; a field described for a part read from it is described from the selections of the place it is read. */
    #metadataOfFields(node, object, identities, context) {
        const { fields } = node;
        const records = new Array(fields.length);

        for (let index = 0; index < fields.length; index++) {
            const field = fields[index];

            records[index] = this.#metadataOf(field.value, object === undefined ? undefined : object?.[field.name], object === undefined ? identities : identities?.fields?.[field.name] ?? null, context);
        }

        // An object whose fields give the records a recent one did, as the items of a list mostly do, shares its record.
        let recent = Evaluator.#recentFieldRecords.get(node);

        if (recent === undefined) {
            recent = [];
            Evaluator.#recentFieldRecords.set(node, recent);
        }

        for (const kept of recent) {
            if (kept.context === context && records.every((record, index) => record === kept.fields[index])) {
                return kept.record;
            }
        }

        const byName = Object.create(null);

        for (let index = 0; index < fields.length; index++) {
            byName[fields[index].name] = records[index];
        }

        const record = Object.freeze({ origin: this.#recordOf(node, null, null).origin, tolerance: null, fields: Object.freeze(byName) });

        recent.unshift({ context, fields: records, record });

        if (recent.length > RECENT_FIELD_RECORDS) {
            recent.pop();
        }

        return record;
    }

    /** The record of a value an expression produced itself, with the candidate it selected and the tolerance that expression applies: made once for this resolution, its origin a token every evaluation of it shares. */
    #recordOf(node, candidate, tolerance) {
        let records = Evaluator.#recordsByDefinition.get(this.#resolvedDefinition);

        if (records === undefined) {
            records = new Map();
            Evaluator.#recordsByDefinition.set(this.#resolvedDefinition, records);
        }

        let byCandidate = records.get(node);

        if (byCandidate === undefined) {
            byCandidate = new Map();
            records.set(node, byCandidate);
        }

        let record = byCandidate.get(candidate);

        if (record === undefined) {
            record = Object.freeze({ origin: Object.freeze(Object.create(null)), tolerance });
            byCandidate.set(candidate, record);
        }

        return record;
    }

    /** The record a part with none of its own takes: its whole's origin and tolerance, made once for each whole. */
    static #inherited(whole) {
        if (whole.fields === undefined && whole.items === undefined) {
            return whole;
        }

        let inherited = Evaluator.#inheritedRecords.get(whole);

        if (inherited === undefined) {
            inherited = Object.freeze({ origin: whole.origin, tolerance: whole.tolerance });
            Evaluator.#inheritedRecords.set(whole, inherited);
        }

        return inherited;
    }

    /** The identities of a value with the selections made for it beside them, as their `branches`, or the identities alone where none were made. */
    static #withSelections(identities, selections) {
        return selections === null ? identities : { ...identities, branches: selections };
    }
}
