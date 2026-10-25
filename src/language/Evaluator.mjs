/**
 * Evaluator — evaluates a resolved script against its registry for the host that asks, answering detached data: a script's value as it reads now, and for a script that ends in a host call, the call prepared for its host and each value its host supplies projected through it
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { LexicaErrors } from './LexicaError.mjs';
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
 * and the input each item of a list a projection built came from, a list no projection built having no sources. A part with no record inherits its parent's origin and tolerance.
 * @typedef {{ origin: object, tolerance: number | null, fields?: Record<string, ResultMetadata>, items?: ResultMetadata[], sources?: readonly ProjectionSource[] }} ResultMetadata
 */

/**
 * The input a projected item came from, of the kind its established type gives it: a reference value as the host holds it, data as Lexica's own frozen copy, or null.
 * @typedef {{ kind: 'reference', value: unknown } | { kind: 'data', value: unknown } | { kind: 'null' }} ProjectionSource
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
 * @property {unknown} item The implicit parameter the scope runs against, which a local evaluated at its first use is evaluated against.
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

/** What an evaluation answers, frozen: its value and whether a member it read was pending, and the metadata that describes the value, described from the identities its evaluation left where it is first read. */
class Evaluation {
    /** The function that creates the metadata at its first read, null once it has. */
    #createMetadata;
    #metadata;

    constructor(value, isPending, createMetadata) {
        this.value = value;
        this.isPending = isPending;
        this.#createMetadata = createMetadata;
        Object.freeze(this);
    }

    /** The metadata of the value, frozen, the same each time it is read. */
    get metadata() {
        if (this.#createMetadata !== null) {
            this.#metadata = this.#createMetadata();
            this.#createMetadata = null;
        }

        return this.#metadata;
    }
}

export class Evaluator {
    /** The fields of each declared structure, each with its type parsed, by the structure: valid for as long as the structure, which is frozen, and released with it. @type {WeakMap<object, [string, Type][]>} */
    static #fieldTypesByStructure = new WeakMap();

    /**
     * The function each node of a resolved definition compiles to, by the definition and then the node, with the registry they were compiled against: built once, it holds what the node's evaluation needs that no evaluation changes, and takes the evaluator, which holds what one does, and the implicit parameter.
     * Beside them, the function each member's arguments compile to, by the member's resolution, for the evaluations that read the member without compiling it.
     * @type {WeakMap<object, { registry: object, functions: Map<object, (evaluator: Evaluator, current: unknown) => unknown>, arguments: Map<object, (evaluator: Evaluator, current: unknown) => object | null> }>}
     */
    static #compilationCache = new WeakMap();

    /**
     * The record of each expression that produces a value itself, holding its origin token, indexed resolved definition → expression node → selected candidate, or null → record. Keyed weakly by the resolved definition, a record
     * lives exactly as long as its resolution, and every evaluation of the resolution shares it. @type {WeakMap<object, Map<object, Map<string | null, object>>>}
     */
    static #expressionRecordCache = new WeakMap();

    /** The record a part with none of its own takes, indexed whole record → inherited record, made once for each whole and released with it. @type {WeakMap<object, object>} */
    static #inheritedRecordCache = new WeakMap();

    /** The records each object expression gave last, the latest first, with the implicit parameter's record and the records of the fields each was made of, so an object whose fields give the same records shares one, as items that alternate between branches do. @type {WeakMap<object, { contextRecord: object | null, fields: object[], record: object }[]>} */
    static #recentFieldRecords = new WeakMap();

    /** The functions this evaluator's nodes compile to. @type {Map<object, (evaluator: Evaluator, context: unknown) => unknown>} */
    #compiledFunctions;

    /** The functions the arguments of this evaluator's members compile to, by each member's resolution. @type {Map<object, (evaluator: Evaluator, context: unknown) => object | null>} */
    #compiledArguments;

    /** The compiled invocations of this evaluator's declarations, by each declaration, one for each result type it answers. @type {Map<object, object[]>} */
    #compiledInvocations;

    #moduleRegistry;
    #resolvedDefinition;
    #parameterBindings;
    #environment;
    #locations;

    /** The source of each item of a list an object expression projected, by the list it produced, for the evaluation in progress. @type {WeakMap<unknown[], readonly ProjectionSource[]>} */
    #sourcesByList = new WeakMap();

    /**
     * The selections each field of an object made, as `#selections` holds them, by the object and then the field's name: every completed field of an outermost object, which a read through a reference to it reuses as it is built, and
     * each field that made any of another object an object expression built. Each object is built anew by the evaluation that reads it, so the store is kept as long as the evaluator, a local built before a host call read by its projection.
     * @type {WeakMap<object, Map<string, Map<object, object | string> | null>>}
     */
    #objectFieldSelections = new WeakMap();

    /**
     * The selections made for the value being evaluated at its place in the result, by the node that made each: the branch a conditional or a coalescing selected, as its node, and the name a bracket property access selected; null where none has been made.
     * A result's identities hold them as their `selections`.
     * @type {Map<object, object | string> | null}
     */
    #selections = null;

    /** The frame of the innermost scope that declares names, with the value of each evaluated so far, inside those of the scopes enclosing it; null outside every one. @type {LocalsFrame | null} */
    #localsFrame = null;

    /** The outermost object being built, which `root`, the object root, refers to, filled field by field; null outside every object expression. @type {object | null} */
    #objectRoot = null;

    /** The host the evaluation in progress is carried out for, or null where none is. @type {Host | null} */
    #host = null;

    /** Whether a member the evaluation in progress read answered that its sample is pending. */
    #isPending = false;

    /**
     * The host call's node and the value its host supplied, while the call's result projection is evaluated against it.
     * The value is what the implicit parameter stands for, and the call's node answers it; null outside a projection.
     * @type {{ node: object, value: unknown } | null}
     */
    #projectionContext = null;

    /**
     * @param {import('./vocabulary/LexicaRegistry.mjs').LexicaRegistry} moduleRegistry The vocabulary the request was resolved against.
     * @param {import('./ResolvedDefinition.mjs').ResolvedDefinition} resolvedDefinition The resolved definition to read.
     * @param {import('./ParameterBindings.mjs').ParameterBindings} parameterBindings What the request's parameters are bound to.
     * @param {Environment} environment What the host gives the evaluation, passed to every implementation.
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
            compilation = { registry: moduleRegistry, functions: new Map(), arguments: new Map(), invocations: new Map() };
            Evaluator.#compilationCache.set(resolvedDefinition, compilation);
        }

        this.#compiledFunctions = compilation.functions;
        this.#compiledArguments = compilation.arguments;
        this.#compiledInvocations = compilation.invocations;
    }

    /**
     * Evaluates the expression once, synchronously, for the host given, answering the detached result, the metadata that describes it, and whether a member it read was pending.
     * Without a host, or without its `beforeInvoke`, a member that reads maintained values fails the evaluation, since nothing answers its samples.
     * @param {Host | null} [host] What the evaluation is carried out for.
     */
    evaluate(host = null) {
        return this.#evaluateForHost(host, () => this.#evaluateScript());
    }

    /**
     * Prepares the host call the script ends in for its host: evaluates the locals before it, each body's along the script's terminal position in order, then its receiver and its arguments, once, as `evaluate` evaluates a script without a host.
     * It answers a prepared call, with its declaration, its receiver, its arguments by parameter name and where it stands, whose `project` projects each value its host supplies where the call declares a result; or a skipped call where the
     * receiver, or an argument whose parameter propagates null, is null, or the call has no declaration yet, its receiver's type unknown, so there is nothing to invoke. Each prepared call keeps the locals it was prepared with, so the prepared
     * calls of one evaluator stay apart.
     * @returns {{ kind: 'prepared', declaration: object, receiver: unknown, args: Record<string, unknown>, location: object, project?: (value: unknown, host?: Host | null) => Evaluation } | { kind: 'skipped', location: object }}
     */
    prepareCall() {
        const { hostCall } = this.#resolvedDefinition;

        if (hostCall === null) {
            this.#fail('LEXICA5014', 'The script gives a value and ends in no host call, so there is nothing to prepare; evaluate it', '/expression');
        }

        const { node, pointer, declaration } = hostCall;
        const location = this.#locate(pointer);
        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const { terminalNode, localsFrame } = this.#evaluateLocalsBefore();
        // A qualified form's receiver is its first argument, and a module member has none, so nothing it lacks skips it.
        const hasReceiver = declaration === null || this.#moduleRegistry.hasReceiver(declaration);
        const enclosingSelections = this.#selections;
        let receiver;
        let args;

        // The receiver and the arguments are evaluated within the locals' frame, and no result records the selections they make.
        try {
            ({ receiver, args } = this.#evaluateWithin(localsFrame, this.#objectRoot, evaluator => {
                const evaluatedReceiver = declaration === null ? null : hasReceiver ? evaluator.#evaluateNode(resolution.receiverNode, null) : undefined;

                return { receiver: evaluatedReceiver, args: evaluatedReceiver === null ? null : evaluator.#evaluateArguments(resolution, null) };
            }, null));
        } finally {
            this.#selections = enclosingSelections;
        }

        if (args === null) {
            return Object.freeze({ kind: 'skipped', location });
        }

        const call = hasReceiver ? { kind: 'prepared', declaration, receiver, args, location } : { kind: 'prepared', declaration, args, location };

        // A call whose host supplies nothing has nothing to project.
        if (declaration.result !== undefined) {
            call.project = (value, host = null) => this.#evaluateForHost(host, () => this.#project(localsFrame, terminalNode, value));
        }

        return Object.freeze(call);
    }

    /**
     * Evaluates the locals of each body along the script's terminal position into a frame of its own, in order, as a run of each body does, each local's value and the selections it made kept in its entry of the frame. It answers
     * the node the terminal position holds after its bodies, the result projection, the optional chain or the host call itself, as `terminalNode`, and the innermost frame as `localsFrame`; the frame in scope and the selections
     * are restored as they were, whether it completes or fails.
     * @returns {{ terminalNode: object, localsFrame: LocalsFrame | null }}
     */
    #evaluateLocalsBefore() {
        const enclosingLocalsFrame = this.#localsFrame;
        const enclosingSelections = this.#selections;
        let node = this.#resolvedDefinition.definition.expression;

        try {
            while (node.kind === 'body' || node.kind === 'do') {
                if (node.kind === 'body') {
                    const frame = { node, item: null, values: new Map(), enclosing: this.#localsFrame };

                    this.#localsFrame = frame;

                    for (const local of node.locals) {
                        this.#selections = null;

                        const value = this.#getCompiledFunction(local.value)(this, null);

                        frame.values.set(local.name, { value, selections: this.#selections });
                    }
                }

                node = node.kind === 'body' ? node.result : node.body;
            }

            return { terminalNode: node, localsFrame: this.#localsFrame };
        } finally {
            this.#localsFrame = enclosingLocalsFrame;
            this.#selections = enclosingSelections;
        }
    }

    /**
     * Projects one value the host supplied for a prepared call: captures it as the type the call declares, then evaluates the terminal node against it as an evaluation of its own, the result projection or the call itself, which
     * answers the captured value, within the frame of the locals the call was prepared with, which it reads and never evaluates again.
     */
    #project(frame, terminalNode, value) {
        const { node, pointer, declaration } = this.#resolvedDefinition.hostCall;
        const { type: resultType } = this.#resolvedDefinition.resolutionOf(node);

        // A part of the value is named by its path within it, the value itself by none.
        const fail = (path, part, partType) => {
            const supplied = path === '' ? Evaluator.#describe(part) : part === undefined ? `a value without '${path}'` : `a value whose '${path}' is ${Evaluator.#describe(part)}`;

            this.#fail('LEXICA5015', `The host call '${declaration.name}' supplied ${supplied}, and ${path === '' ? 'it declares' : `'${path}' is declared`} ${partType}`, pointer);
        };

        const captured = this.#capture(value, resultType, '', fail);
        const enclosingLocalsFrame = this.#localsFrame;

        this.#localsFrame = frame;
        this.#projectionContext = { node, value: captured };

        try {
            return this.#evaluateResult(terminalNode);
        } finally {
            this.#projectionContext = null;
            this.#localsFrame = enclosingLocalsFrame;
        }
    }

    /**
     * Evaluates once for the host, as `evaluate` and a prepared call's `project` each ask: holds the host for the hooks of the invocations the evaluation reaches and clears the pending mark, answers what the evaluation produced, whether
     * a member it read was pending and the metadata, described when it is first read, and calls the host's `afterEvaluation` once as it ends: a failure of that hook after a failure is recorded on the failure as its `suppressed`,
     * which stays the one thrown, and after a success fails the evaluation itself.
     */
    #evaluateForHost(host, produce) {
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

            return new Evaluation(result.value, isPending, () => this.#resolveRecord(result.node, result.value, result.identities, null));
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
                        // A failure as the evaluation ends fails it, as a hook's failure does: one Lexica raised as it is, and anything else the hook threw, a LexicaError it built among them, as the cause of Lexica's own.
                        // The finally block's throw replaces the completed result.
                        if (LexicaErrors.has(cleanupError)) {
                            throw cleanupError;
                        }

                        throw LexicaErrors.evaluation('LEXICA5009', `The host failed after the evaluation: ${Evaluator.#messageOf(cleanupError)}`, this.#locate('/expression'), { cause: cleanupError });
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
    #evaluateScript() {
        const { hostCall } = this.#resolvedDefinition;

        if (hostCall !== null) {
            this.#fail('LEXICA5023', `The script ends in the host call '${hostCall.name}', which its host invokes, so it is never evaluated; prepare it`, hostCall.pointer);
        }

        return this.#evaluateResult(this.#resolvedDefinition.definition.expression);
    }

    #evaluateNode(node, context) {
        return this.#getCompiledFunction(node)(this, context);
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

    /** The node as a function of the evaluator and the implicit parameter, each kind evaluated as its section of the specification sets out, the nodes it holds compiled with it. */
    #compileNode(node) {
        switch (node.kind) {
            case 'literal': {
                const { value } = node;

                return () => value;
            }
            case 'parameter':
                return evaluator => evaluator.#parameterBindings.get(node.name);
            case 'root':
                return evaluator => evaluator.#objectRoot;
            case 'it':
                return (evaluator, context) => context;
            case 'local':
                return evaluator => evaluator.#evaluateLocal(node);
            case 'member':
            case 'call':
            case 'indexer':
                return this.#compileMember(node);
            case 'equality': {
                const left = this.#getCompiledFunction(node.left);
                const right = this.#getCompiledFunction(node.right);

                return (evaluator, context) => {
                    const value = left(evaluator, context);

                    return value === right(evaluator, context);
                };
            }
            case 'conditional': {
                const consequent = this.#getCompiledFunction(node.consequent);
                const alternative = this.#getCompiledFunction(node.alternative);

                if (node.binding !== undefined) {
                    const evaluateBindingValue = this.#getCompiledFunction(node.binding.value);

                    // The value is evaluated once; where it is truthy, the consequent runs in a frame holding it by the name it is bound to, which a function made within it keeps as it keeps every frame around it, and the branch
                    // taken is recorded for the value's place in the result.
                    return (evaluator, context) => {
                        const value = evaluateBindingValue(evaluator, context);
                        const isTruthy = Evaluator.#isTruthy(value);

                        (evaluator.#selections ??= new Map()).set(node, isTruthy ? node.consequent : node.alternative);

                        if (!isTruthy) {
                            return alternative(evaluator, context);
                        }

                        const enclosingLocalsFrame = evaluator.#localsFrame;
                        const { name } = node.binding;

                        evaluator.#localsFrame = { node: { locals: [{ name }] }, item: context, values: new Map([[name, { value, selections: null }]]), enclosing: enclosingLocalsFrame };

                        try {
                            return consequent(evaluator, context);
                        } finally {
                            evaluator.#localsFrame = enclosingLocalsFrame;
                        }
                    };
                }

                const condition = this.#getCompiledFunction(node.condition);

                // The branch the condition selects is recorded for the value's place in the result.
                return (evaluator, context) => {
                    const isTrue = Evaluator.#isTruthy(condition(evaluator, context));

                    (evaluator.#selections ??= new Map()).set(node, isTrue ? node.consequent : node.alternative);

                    return (isTrue ? consequent : alternative)(evaluator, context);
                };
            }
            case 'optionalChain':
                // An access that meets null answers null, and so does everything after it in its chain, which is evaluated no further.
                return this.#getCompiledFunction(node.target);
            case 'coalescing': {
                const value = this.#getCompiledFunction(node.value);
                const fallback = this.#getCompiledFunction(node.fallback);

                return (evaluator, context) => {
                    const answer = value(evaluator, context);

                    (evaluator.#selections ??= new Map()).set(node, answer === null ? node.fallback : node.value);

                    return answer === null ? fallback(evaluator, context) : answer;
                };
            }
            case 'and':
            case 'or': {
                const operands = node.operands.map(operand => this.#getCompiledFunction(operand));
                const decidesWhenTruthy = node.kind === 'or';
                const last = operands.length - 1;

                // The first operand that decides it, falsey for `and` and truthy for `or`, or else the last, is its value as it is, and the operand it is is recorded for the value's place in the result.
                return (evaluator, context) => {
                    for (let index = 0; ; index++) {
                        const value = operands[index](evaluator, context);

                        if (index === last || Evaluator.#isTruthy(value) === decidesWhenTruthy) {
                            (evaluator.#selections ??= new Map()).set(node, node.operands[index]);

                            return value;
                        }
                    }
                };
            }
            case 'not': {
                const operand = this.#getCompiledFunction(node.operand);

                return (evaluator, context) => !Evaluator.#isTruthy(operand(evaluator, context));
            }
            case 'function':
                // A function evaluates to a script delegate, which holds its captured scope: all three of the locals' frame, the implicit parameter and the object root where it is declared, which each call evaluates its body in.
                return (evaluator, context) => ({ function: node, capturedFrame: evaluator.#localsFrame, context, objectRoot: evaluator.#objectRoot });
            case 'functionCall': {
                const resolution = this.#resolvedDefinition.resolutionOf(node);

                // A call of one function reference alone is its qualified form's call, and the reference it is reads nothing; a receiver of unknown type selects no declaration, as the qualified form's selects none.
                if (resolution.functions === undefined) {
                    return resolution.candidates !== undefined ? (evaluator, context) => evaluator.#evaluateMember(node, context) : this.#compileInvocation(node, resolution);
                }

                const functions = this.#compileFunctions(resolution.functions);
                const evaluateArguments = node.arguments.map(argument => this.#getCompiledFunction(argument));

                // The callee is evaluated once, and then the arguments, once each, left to right, in the caller's scope, and the body of the function it is in its captured scope, so no local of the caller's is visible in it;
                // where it may be one of several, the one it is is recorded for the value's place in the result. A function reference's receiver argument is evaluated first, and a null one answers null before the others are.
                return (evaluator, context) => {
                    const callee = evaluator.#evaluateLocal(resolution.callee);
                    const functionKey = Evaluator.#getFunctionKey(callee);

                    if (functions.size > 1) {
                        (evaluator.#selections ??= new Map()).set(node, functionKey);
                    }

                    if (functions.get(functionKey).invocation?.takesReceiver === true) {
                        const receiver = evaluateArguments[0](evaluator, context);

                        if (receiver === null) {
                            return null;
                        }

                        return evaluator.#callFunction(callee, [receiver, ...evaluateArguments.slice(1).map(evaluateArgument => evaluateArgument(evaluator, context))], functions, node);
                    }

                    return evaluator.#callFunction(callee, evaluateArguments.map(evaluateArgument => evaluateArgument(evaluator, context)), functions, node);
                };
            }
            case 'do':
                return this.#getCompiledFunction(node.body);
            case 'body': {
                const locals = node.locals.map(local => ({ name: local.name, evaluate: this.#getCompiledFunction(local.value) }));
                const result = this.#getCompiledFunction(node.result);

                // Each local is evaluated once, in order, whenever the body runs, an unused one included, each seeing those before it, and then the result, all against the body's implicit parameter.
                return (evaluator, context) => {
                    const frame = { node, item: context, values: new Map(), enclosing: evaluator.#localsFrame };
                    const enclosingSelections = evaluator.#selections;

                    evaluator.#localsFrame = frame;

                    try {
                        for (const local of locals) {
                            evaluator.#selections = null;

                            const value = local.evaluate(evaluator, context);

                            frame.values.set(local.name, { value, selections: evaluator.#selections });
                        }

                        evaluator.#selections = enclosingSelections;

                        return result(evaluator, context);
                    } finally {
                        evaluator.#localsFrame = frame.enclosing;
                    }
                };
            }
            case 'interpolatedString': {
                const parts = node.parts.map(part => (part.kind === 'text' ? part.value : { expression: part.expression, evaluate: this.#getCompiledFunction(part.expression) }));

                // Each interpolation is evaluated once, from left to right, and its value inserted as its text: a string as it is and a number as the built-in conversion writes it, negative zero as "0".
                return (evaluator, context) => {
                    let text = '';

                    for (const part of parts) {
                        if (typeof part === 'string') {
                            text += part;
                            continue;
                        }

                        const value = part.evaluate(evaluator, context);

                        if (typeof value !== 'string' && typeof value !== 'number') {
                            throw LexicaErrors.evaluation('LEXICA5500', `An interpolation inserts a string or a number, and is given ${Evaluator.#describe(value)}`, evaluator.#locate(evaluator.#pointerOf(part.expression)));
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
                return (evaluator, context) => {
                    let left = operands[0](evaluator, context);

                    for (let index = 0; index < compares.length; index++) {
                        const right = operands[index + 1](evaluator, context);

                        if (typeof left !== 'number' || typeof right !== 'number') {
                            throw LexicaErrors.evaluation('LEXICA5501', `'${node.operators[index]}' compares numbers, and is given ${Evaluator.#describe(typeof left !== 'number' ? left : right)}`, evaluator.#locate(evaluator.#pointerOf(node)));
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

                return (evaluator, context) => {
                    const leftValue = left(evaluator, context);
                    const rightValue = right(evaluator, context);

                    return evaluator.#arithmeticResult(node, operate(leftValue, rightValue), leftValue, rightValue);
                };
            }
            case 'negate': {
                const operand = this.#getCompiledFunction(node.operand);

                return (evaluator, context) => {
                    const value = operand(evaluator, context);

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
                this.#fail('LEXICA5502', `A '${node.kind}' node has no evaluation`, this.#pointerOf(node));
        }
    }

    /**
     * A cast, with its target evaluated once: its target itself where it belongs to the type, by the type's membership and its supertypes', and null where it is null. A target that doesn't fails the evaluation of a cast, naming the
     * type its target is of, which is never asked again, and an attempted one answers null instead.
     */
    #compileCast(node, isAttempted) {
        const evaluateOperand = this.#getCompiledFunction(node.target);
        const { type, targetType } = this.#resolvedDefinition.resolutionOf(node);
        const asked = `the cast to ${type}`;
        // A value of a type above the cast's is one that isn't of the cast's type, and a value of the cast's own type, or of one beneath it, is one its supertypes refuse.
        const what = this.#moduleRegistry.typeChecker.isAssignable(type, targetType) && !this.#moduleRegistry.typeChecker.isAssignable(targetType, type) ? `${Evaluator.#getNameWithArticle(targetType)} that isn't ${Evaluator.#getNameWithArticle(type)}` : Evaluator.#getNameWithArticle(targetType);

        return (evaluator, context) => {
            const value = evaluateOperand(evaluator, context);

            if (value === null || evaluator.#moduleRegistry.belongsTo(value, type, asked)) {
                return value;
            }

            if (isAttempted) {
                return null;
            }

            return evaluator.#fail('LEXICA5001', `The cast to ${type} rejected its value: it is ${what}`, evaluator.#pointerOf(node));
        };
    }

    /** The type's name with its indefinite article, as a message writes it: `a Light`, `an Outlet`. */
    static #getNameWithArticle(type) {
        const name = String(type);

        return /^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`;
    }

    /**
     * A conversion, with its target evaluated once and its conversion carried out once. Null converts to null, and a value already of the type to itself, without a conversion;
     * a conversion that rejects its value fails the evaluation, and an attempted one answers null instead. A fault fails the evaluation of either, as a failure of its target does.
     */
    #compileConversion(node, isAttempted) {
        const evaluateOperand = this.#getCompiledFunction(node.target);
        const { declaration, type } = this.#resolvedDefinition.resolutionOf(node);

        if (declaration === null) {
            return evaluateOperand;
        }

        const name = LexicaModule.conversionNameOf(declaration);
        const attempt = Evaluator.#compileConversionAttempt(declaration, type, this.#moduleRegistry);

        return (evaluator, context) => {
            const value = evaluateOperand(evaluator, context);

            if (value === null) {
                return null;
            }

            const outcome = attempt(evaluator, value, node);

            if (!outcome.isAccepted) {
                if (isAttempted) {
                    return null;
                }

                evaluator.#fail('LEXICA5016', `The conversion from ${name} rejected its value: ${outcome.reason}`, evaluator.#pointerOf(node));
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
        const convert = moduleRegistry.getImplementation(declaration);
        const conforms = Evaluator.#compileTypeCheck(type, moduleRegistry, `the conversion from ${name}`);
        const copyStructure = Evaluator.#compileStructureCopy(type, moduleRegistry);

        return (evaluator, value, node) => {
            if (convert === undefined) {
                throw LexicaErrors.module('LEXICA4001', `The module '${moduleRegistry.getOwner(declaration)}' gives the conversion from ${name} no implementation`, evaluator.#locate(evaluator.#pointerOf(node)));
            }

            const rejection = { isRejected: false, reason: null };
            const reject = reason => {
                rejection.isRejected = true;
                rejection.reason = reason;

                throw rejection;
            };
            let converted;

            try {
                converted = convert({ value, reject });
            } catch (error) {
                // A failure Lexica raised keeps its own code and place; anything else the conversion threw but its rejection, a LexicaError it built among them, is the cause of Lexica's own, exactly as thrown.
                if (LexicaErrors.has(error)) {
                    throw error;
                }

                if (error !== rejection) {
                    throw LexicaErrors.evaluation('LEXICA5003', `The conversion from ${name} failed: ${Evaluator.#messageOf(error)}`, evaluator.#locate(evaluator.#pointerOf(node)), { cause: error });
                }

                if (typeof rejection.reason !== 'string') {
                    evaluator.#fail('LEXICA5018', `The conversion from ${name} rejected its value with a reason that is no string`, evaluator.#pointerOf(node));
                }

                return { isAccepted: false, reason: rejection.reason };
            }

            if (rejection.isRejected) {
                evaluator.#fail('LEXICA5018', `The conversion from ${name} rejected its value and then answered one`, evaluator.#pointerOf(node));
            }

            if (!conforms(converted)) {
                evaluator.#fail('LEXICA5019', `The conversion from ${name} answered ${Evaluator.#describe(converted)}, and it converts to ${type}`, evaluator.#pointerOf(node));
            }

            return { isAccepted: true, value: copyStructure === null ? converted : copyStructure(converted) };
        };
    }

    /**
     * A property access, a call or an indexer, with its resolution, its function, its arguments and the check of its result made once.
     * A computed property access, and a member of a receiver of unknown type, which answers null without reading anything, are evaluated as the node itself says.
     */
    #compileMember(node) {
        const resolution = this.#resolvedDefinition.resolutionOf(node);

        // A function reference produces a module delegate, the same for every read of it, which reads nothing.
        if (resolution?.kind === 'reference') {
            const delegate = Evaluator.#getModuleDelegate(resolution.declaration);

            return () => delegate;
        }

        if (resolution === undefined || resolution.kind === 'computedPropertyAccess' || (resolution.kind === 'invocation' && resolution.candidates !== undefined)) {
            return (evaluator, context) => evaluator.#evaluateMember(node, context);
        }

        if (resolution.kind === 'invocation') {
            return this.#compileInvocation(node, resolution);
        }

        const evaluateReceiver = this.#getCompiledFunction(node.target);

        if (resolution.kind === 'objectRootField') {
            const { name } = resolution;

            return (evaluator, context) => evaluator.#readObjectRootField(evaluateReceiver(evaluator, context), name);
        }

        const { name } = resolution;

        // A field of data, which a projection's host call never is.
        return (evaluator, context) => {
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            return evaluator.#readField(evaluateReceiver(evaluator, context), name);
        };
    }

    /**
     * An invocation of a member's declaration, with its function, its arguments and the check of its result made once: its receiver evaluated first, the node its resolution records, the node's target, the receiver of the access a named
     * indexer's name is written in, or a qualified call's first argument, a null one answering null before its own arguments are evaluated, and a module member's none; then its arguments, null where one makes the call answer null.
     */
    #compileInvocation(node, resolution) {
        const { type: resultType, declaration, receiverNode } = resolution;
        const evaluateReceiver = receiverNode === undefined ? null : this.#getCompiledFunction(receiverNode);
        const invocation = this.#getCompiledInvocation(declaration, resultType);
        const evaluateArguments = this.#compileArguments(resolution);

        return (evaluator, context) => {
            // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            const receiver = evaluateReceiver === null ? undefined : evaluateReceiver(evaluator, context);

            if (receiver === null) {
                return null;
            }

            const args = evaluateArguments(evaluator, context);

            return args === null ? null : evaluator.#invokeImplementation(invocation, receiver, args, node);
        };
    }

    /**
     * The invocation of the declaration whose implementation answers a value of the result type, as the call it serves resolved it: its implementation, whether it takes a receiver, and the check and the copy of its answer, made once for
     * each declaration and result type and shared by every evaluator of the resolution, so one generic declaration answering two types has two. The result type is the declaration's own, its type parameters bound for the call,
     * which a null the call propagates or the types of other functions it may call never make wider.
     */
    #getCompiledInvocation(declaration, resultType) {
        let invocations = this.#compiledInvocations.get(declaration);

        if (invocations === undefined) {
            invocations = [];
            this.#compiledInvocations.set(declaration, invocations);
        }

        let invocation = invocations.find(candidate => candidate.resultType.equals(resultType));

        if (invocation === undefined) {
            invocation = Object.freeze({
                declaration,
                implementation: this.#moduleRegistry.getImplementation(declaration),
                takesReceiver: this.#moduleRegistry.hasReceiver(declaration),
                resultType,
                isOfResultType: Evaluator.#compileTypeCheck(resultType, this.#moduleRegistry, `the answer of '${declaration.name}'`),
                copyStructure: Evaluator.#compileStructureCopy(resultType, this.#moduleRegistry),
            });
            invocations.push(invocation);
        }

        return invocation;
    }

    /** The module delegate each function reference produces, by its declaration: the same for every evaluation, since it holds nothing an evaluation bound. @type {WeakMap<object, { reference: object }>} */
    static #moduleDelegateCache = new WeakMap();

    /** The module delegate of the declaration, made at its first request and the same at every later one. */
    static #getModuleDelegate(declaration) {
        let delegate = Evaluator.#moduleDelegateCache.get(declaration);

        if (delegate === undefined) {
            delegate = Object.freeze({ reference: declaration });
            Evaluator.#moduleDelegateCache.set(declaration, delegate);
        }

        return delegate;
    }

    /**
     * The arguments a call is given, in the order they are written, each argument's plan made once: its default or fixed value, a callback the member calls, an expression evaluated against its argument or the function a value gives,
     * or a value, null where it makes the call answer null.
     * An options object's written values are its fields: each is in scope after its evaluation for the options after it that read it, holding its value and the selections it made, and one no other object encloses
     * builds the outermost object, which `root` refers to while its options are evaluated, each written value a field of it after its evaluation; a default is none.
     */
    #compileArguments(resolution) {
        if (resolution.arguments.length === 0) {
            return () => NO_ARGUMENTS;
        }

        const { buildsObjectRoot } = resolution;
        const isOptions = resolution.declaration.arguments === 'options';
        const argumentPlans = resolution.arguments.map((argument, index) => {
            const { parameter } = argument;
            const isOption = isOptions && !argument.isDefault && parameter.kind !== 'expression' && parameter.kind !== 'predicate' && argument.callback?.isBody !== true;
            const isReadLater = isOption && resolution.arguments.slice(index + 1).some(later => !later.isDefault && Evaluator.#readsLocal(later.node, parameter.name));
            const isField = isOption && buildsObjectRoot === true;

            if (argument.isDefault || parameter.fixed) {
                return { name: parameter.name, kind: 'constant', value: argument.isDefault ? parameter.default : argument.value, isReadLater, isField };
            }

            const plan = { name: parameter.name, kind: parameter.kind, evaluate: this.#getCompiledFunction(argument.node), propagatesNull: parameter.nulls === 'propagate', isOption, isReadLater, isField };

            if (argument.callback === undefined) {
                return plan;
            }

            // The member calls the function it is given with the arguments the callback contract declares, each checked as the contract's types say, the checks compiled once for every call.
            const { functions, parameterTypes, resultType, isBody } = argument.callback;
            const asked = `the function given as '${parameter.name}' of '${resolution.declaration.name}'`;
            const isOfParameterType = parameterTypes.map(parameterType => Evaluator.#compileTypeCheck(parameterType, this.#moduleRegistry, asked));
            const isOfResultType = resultType === null ? null : Evaluator.#compileTypeCheck(resultType, this.#moduleRegistry, asked);

            return {
                ...plan,
                kind: 'callback',
                propagatesNull: false,
                isBody: isBody === true,
                isPredicate: parameter.kind === 'predicate',
                functions: isBody === true ? null : this.#compileFunctions(functions),
                memberName: resolution.declaration.name,
                parameterTypes,
                resultType,
                isOfParameterType,
                isOfResultType,
                pointer: argument.pointer,
                node: argument.node,
            };
        });

        return (evaluator, context) => {
            const args = {};
            const enclosingObjectRoot = evaluator.#objectRoot;
            const enclosingLocalsFrame = evaluator.#localsFrame;
            const objectRoot = buildsObjectRoot === true ? {} : null;
            const rootSelections = objectRoot === null ? null : new Map();

            if (objectRoot !== null) {
                evaluator.#objectRoot = objectRoot;
                evaluator.#objectFieldSelections.set(objectRoot, rootSelections);
            }

            try {
                for (const plan of argumentPlans) {
                    let selections = null;
                    let argumentValue;

                    if (plan.kind === 'constant') {
                        args[plan.name] = plan.value;
                        argumentValue = plan.value;
                    } else if (plan.kind === 'callback' && plan.isBody) {
                        // The member calls it when it chooses, after its options are evaluated, each call evaluating the expression anew against its argument, with the names and the object root of the place it is written.
                        const { evaluate } = plan;
                        const capturedFrame = evaluator.#localsFrame;
                        const capturedObjectRoot = evaluator.#objectRoot;

                        args[plan.name] = evaluator.#createCallback(plan, argumentValues => evaluator.#evaluateWithin(capturedFrame, capturedObjectRoot, evaluate, argumentValues[0]));
                    } else {
                        let value;

                        if (plan.isOption) {
                            ({ value, selections } = evaluator.#evaluateOption(plan, context));
                        } else {
                            value = plan.evaluate(evaluator, context);
                        }

                        if (value === null && plan.propagatesNull) {
                            return null;
                        }

                        // A delegate is evaluated where it is written, once, and goes to the member as a callback it calls, while the expression's own names and fields hold the value itself.
                        argumentValue = value;
                        args[plan.name] = plan.kind === 'callback' ? evaluator.#createCallback(plan, argumentValues => evaluator.#callFunction(value, argumentValues, plan.functions, plan.node)) : value;
                    }

                    if (plan.isField) {
                        objectRoot[plan.name] = argumentValue;
                        rootSelections.set(plan.name, selections);
                    }

                    if (plan.isReadLater) {
                        evaluator.#localsFrame = { node: { locals: [{ name: plan.name }] }, item: context, values: new Map([[plan.name, { value: argumentValue, selections }]]), enclosing: evaluator.#localsFrame };
                    }
                }

                return args;
            } finally {
                evaluator.#objectRoot = enclosingObjectRoot;
                evaluator.#localsFrame = enclosingLocalsFrame;
            }
        };
    }

    /**
     * The functions a call or a callback contract may call, each compiled once for it and found by its function key: a function the script declares, its parameters and the compiled copy of its body resolved for this call;
     * or a function reference, its argument map and its invocation, of the result type resolved for this call. Each call compiles its own, so one function called at two places evaluates each place's body or specialization.
     * @returns {Map<object, { parameters: string[], evaluateBody: Function } | { argumentMap: object, invocation: object }>}
     */
    #compileFunctions(functions) {
        return new Map(functions.map(entry => [
            Evaluator.#getFunctionKey(entry),
            entry.reference === undefined ? { parameters: entry.parameters, evaluateBody: this.#getCompiledFunction(entry.body) } : { argumentMap: entry.argumentMap, invocation: this.#getCompiledInvocation(entry.reference, entry.resultType) },
        ]));
    }

    /**
     * The key a call finds a function's compiled form by: a function reference's declaration, or the node of a function the script declares. Two delegates of one function share it, whatever each captured, which the callee
     * itself still holds.
     */
    static #getFunctionKey(callee) {
        return callee.reference ?? callee.function;
    }

    /**
     * Calls the callee with its arguments' values, which the caller evaluated, as the call's compiled functions say: a function the script declares, its body evaluated in the callee's captured scope, its locals, implicit parameter and object root,
     * its parameters bound to the values in order; or a function reference, its declaration invoked as its qualified form is, its receiver the first value, a null one answering null without invoking the implementation, and its own
     * arguments bound by its argument map, a null one whose parameter propagates null answering null without invoking it, each parameter the map leaves out taking its default. Its failures are named at the node that called it.
     */
    #callFunction(callee, argumentValues, functions, node) {
        const compiled = functions.get(Evaluator.#getFunctionKey(callee));

        if (compiled.invocation === undefined) {
            const { parameters } = compiled;
            const enclosingLocalsFrame = this.#localsFrame;
            const enclosingObjectRoot = this.#objectRoot;

            this.#localsFrame = { node: { locals: parameters.map(parameter => ({ name: parameter })) }, item: callee.context, values: new Map(parameters.map((parameter, index) => [parameter, { value: argumentValues[index], selections: null }])), enclosing: callee.capturedFrame };
            this.#objectRoot = callee.objectRoot;

            try {
                return compiled.evaluateBody(this, callee.context);
            } finally {
                this.#localsFrame = enclosingLocalsFrame;
                this.#objectRoot = enclosingObjectRoot;
            }
        }

        const { argumentMap, invocation } = compiled;
        const receiver = invocation.takesReceiver ? argumentValues[0] : undefined;

        if (receiver === null) {
            return null;
        }

        const own = invocation.takesReceiver ? argumentValues.slice(1) : argumentValues;
        const args = {};

        for (const [index, { name, propagatesNull }] of argumentMap.supplied.entries()) {
            // A null argument whose parameter propagates null makes the call answer null without invoking the implementation.
            if (own[index] === null && propagatesNull) {
                return null;
            }

            args[name] = own[index];
        }

        for (const { name, value } of argumentMap.defaults) {
            args[name] = value;
        }

        return this.#invokeImplementation(invocation, receiver, args, node);
    }

    /**
     * Creates the function a member is given for a parameter that takes one, and registers its lifetime, which `#invokeImplementation` closes when the member's invocation ends, however it ends: each call checks the member's arguments
     * against the callback contract's parameter types, gives them to the body, which evaluates the argument's expression against the first or calls the function the argument gave, checks the body's result against the contract's
     * result type, and answers it, or its truthiness for a predicate. A call after the invocation fails, while the function the body calls stays callable wherever else it is given or called.
     */
    #createCallback(plan, body) {
        const { name, memberName, parameterTypes, resultType, isOfParameterType, isOfResultType, isPredicate, pointer } = plan;
        const lifetime = { isOpen: true };
        const callback = (...argumentValues) => {
            try {
                if (!lifetime.isOpen) {
                    this.#fail('LEXICA5008', `The function given as '${name}' of '${memberName}' is called after '${memberName}' returned, and a member calls the functions it is given only while its own invocation lasts`, pointer);
                }

                if (argumentValues.length !== parameterTypes.length) {
                    this.#fail('LEXICA5503', `The function given as '${name}' of '${memberName}' is called with ${argumentValues.length === 1 ? 'one argument' : `${argumentValues.length} arguments`}, and its contract declares ${parameterTypes.length}`, pointer);
                }

                for (let index = 0; index < argumentValues.length; index++) {
                    if (!isOfParameterType[index](argumentValues[index])) {
                        this.#fail('LEXICA5503', `The function given as '${name}' of '${memberName}' is called with ${Evaluator.#describe(argumentValues[index])}, and its contract declares ${parameterTypes[index]}`, pointer);
                    }
                }

                const value = body(argumentValues);

                if (isOfResultType !== null && !isOfResultType(value)) {
                    this.#fail('LEXICA5504', `The function given as '${name}' of '${memberName}' gave ${Evaluator.#describe(value)}, and its contract declares ${resultType}`, pointer);
                }

                // A predicate's contract takes any value, and the member receives its truthiness.
                return isPredicate ? Evaluator.#isTruthy(value) : value;
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

    /** What the compiled function gives for the implicit parameter with the frame of names and the object root in scope, those of the place it was written, both restored after it. */
    #evaluateWithin(frame, objectRoot, evaluate, context) {
        const enclosingLocalsFrame = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;

        this.#localsFrame = frame;
        this.#objectRoot = objectRoot;

        try {
            return evaluate(this, context);
        } finally {
            this.#localsFrame = enclosingLocalsFrame;
            this.#objectRoot = enclosingObjectRoot;
        }
    }

    /** The value of a written option and the selections its evaluation made, which are made where the option is evaluated as well. */
    #evaluateOption(plan, context) {
        const enclosingSelections = this.#selections;

        this.#selections = null;

        try {
            const value = plan.evaluate(this, context);

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
        const evaluateSource = hasTarget ? this.#getCompiledFunction(node.target) : null;
        // An item's source is of the kind its established type gives it, a reference where its items are of a reference type, whatever the value itself is.
        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const isOfReferences = resolution?.kind === 'projection' && this.#moduleRegistry.isReferenceType(resolution.itemType.toNonNullable());
        const names = this.#resolvedDefinition.fieldNamesOf(node);
        // A field the entries after it read is in scope for them, by the name the definition gives it.
        const fields = node.fields.map((field, index) => ({
            name: names[index],
            local: field.name,
            isReadLater: node.fields.slice(index + 1).some(later => Evaluator.#readsLocal(later.value, field.name)),
            evaluate: this.#getCompiledFunction(field.value),
        }));

        return (evaluator, context) => {
            const value = hasTarget ? evaluateSource(evaluator, context) : context;

            if (!(hasTarget && Array.isArray(value))) {
                return value === null && hasTarget ? null : evaluator.#applyFields(node, fields, value);
            }

            const items = [];
            const sources = [];

            for (const item of value) {
                items.push(item === null ? null : evaluator.#applyFields(node, fields, item));
                sources.push(Object.freeze(item === null ? { kind: 'null' } : isOfReferences ? { kind: 'reference', value: item } : { kind: 'data', value: Evaluator.#frozenDataOf(item) }));
            }

            // A list is projected item by item, so each item keeps the input it came from; two inputs can project to the same data, and one input can stand more than once.
            evaluator.#sourcesByList.set(items, Object.freeze(sources));

            return items;
        };
    }

    /** The data as Lexica holds it, frozen throughout: the value itself where it is frozen already or is no object, and a frozen copy of its lists and objects otherwise. */
    static #frozenDataOf(value) {
        if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }

        if (Array.isArray(value)) {
            return Object.freeze(value.map(item => Evaluator.#frozenDataOf(item)));
        }

        const copy = {};

        for (const [name, field] of Object.entries(value)) {
            ObjectUtils.defineDataProperty(copy, name, Evaluator.#frozenDataOf(field));
        }

        return Object.freeze(copy);
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
        const enclosingLocalsFrame = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;
        // An application no other encloses builds the outermost object, this object, which `root` refers to in its body; any other builds within that object.
        const rootSelections = enclosingObjectRoot === null ? new Map() : null;
        let fieldSelections = null;

        if (node.locals !== undefined) {
            this.#localsFrame = { node, item, values: new Map(), enclosing: enclosingLocalsFrame };
        }

        if (rootSelections !== null) {
            this.#objectRoot = object;
            this.#objectFieldSelections.set(object, rootSelections);
        }

        try {
            for (const field of fields) {
                this.#selections = null;

                const value = field.evaluate(this, item);

                object[field.name] = value;

                // The outermost object's every field is recorded as it completes, for `root` to read; another object's, where it made any selection.
                if (rootSelections !== null) {
                    rootSelections.set(field.name, this.#selections);
                } else if (this.#selections !== null) {
                    (fieldSelections ??= new Map()).set(field.name, this.#selections);
                }

                if (field.isReadLater) {
                    this.#localsFrame = { node: { locals: [{ name: field.local }] }, item, values: new Map([[field.local, { value, selections: this.#selections }]]), enclosing: this.#localsFrame };
                }
            }
        } finally {
            this.#selections = enclosingSelections;
            this.#localsFrame = enclosingLocalsFrame;
            this.#objectRoot = enclosingObjectRoot;
        }

        if (fieldSelections !== null) {
            this.#objectFieldSelections.set(object, fieldSelections);
        }

        return object;
    }

    /**
     * The copy a type makes of a value it admits: a declared structure as its declared fields alone, each read as the value offers it, a getter's included, so its declaration is the shape a result holds,
     * and a list item by item; null for a type that holds no declared structure, whose values stand as they are. A structure's fields are found at its first copy, so a structure that holds itself is copied as deep as its value goes.
     */
    static #compileStructureCopy(type, moduleRegistry) {
        if (type.isList) {
            const copyItem = Evaluator.#compileStructureCopy(type.itemType, moduleRegistry);

            return copyItem === null ? null : value => (value === null ? null : value.map(item => (item === null ? null : copyItem(item))));
        }

        switch (type.kind) {
            case 'named': {
                const structure = moduleRegistry.getStructure(type);

                if (structure === undefined) {
                    return null;
                }

                // It holds the registry alone, never an evaluator, so it holds nothing an evaluation bound.
                let fields = null;
                let fieldNames = null;
                let isFlat = false;

                return value => {
                    if (value === null) {
                        return null;
                    }

                    if (fields === null) {
                        fields = Evaluator.#fieldTypesOf(structure, moduleRegistry).map(([name, fieldType]) => [name, Evaluator.#compileStructureCopy(fieldType, moduleRegistry)]);
                        fieldNames = new Set(fields.map(([name]) => name));
                        isFlat = fields.every(([, copyField]) => copyField === null);
                    }

                    // An answer that is a plain object of its declared fields alone, none of them a structure, is its declared shape already, as a built-in member's is.
                    if (isFlat && Evaluator.#holdsExactly(value, fieldNames)) {
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

    /** Whether the value is a plain object whose own keys are the names of the declared fields alone. */
    static #holdsExactly(value, fieldNames) {
        if (Object.getPrototypeOf(value) !== Object.prototype) {
            return false;
        }

        let found = 0;

        for (const key in value) {
            if (!fieldNames.has(key)) {
                return false;
            }

            found++;
        }

        return found === fieldNames.size;
    }

    /** Whether a value is one the type admits, with the type's structure found once and each declared structure's fields at its first check. */
    static #compileTypeCheck(type, moduleRegistry, asked) {
        const admits = Evaluator.#compileNonNullTypeCheck(type, moduleRegistry, asked);

        return value => (value === undefined ? false : value === null ? type.isNullable : admits(value));
    }

    /** A compiled function holds the registry alone, never an evaluator, so it holds nothing an evaluation bound; a structure that holds itself is checked as deep as its value goes. */
    static #compileNonNullTypeCheck(type, moduleRegistry, asked) {
        if (type.isList) {
            const checkItem = Evaluator.#compileTypeCheck(type.itemType, moduleRegistry, asked);

            return value => Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(checkItem);
        }

        switch (type.kind) {
            case 'typeParameter':
                return () => true;
            case 'object': {
                const fields = [...type.fieldTypes].map(([name, fieldType]) => [name, Evaluator.#compileTypeCheck(fieldType, moduleRegistry, asked)]);

                return value => ObjectUtils.isNonArrayObject(value) && fields.every(([name, conforms]) => conforms(value[name]));
            }
            default: {
                const { name } = type;
                const structure = moduleRegistry.getStructure(type);

                if (moduleRegistry.isReferenceType(type)) {
                    return value => moduleRegistry.belongsTo(value, type, asked);
                }

                if (type.module === null && LexicaModule.builtInTypeNames.includes(name)) {
                    return value => Evaluator.#belongsToBuiltIn(value, name);
                }

                if (structure === undefined) {
                    return () => false;
                }

                let fields = null;

                return value => {
                    if (!ObjectUtils.isNonArrayObject(value)) {
                        return false;
                    }

                    fields ??= Evaluator.#fieldTypesOf(structure, moduleRegistry).map(([field, fieldType]) => [field, Evaluator.#compileTypeCheck(fieldType, moduleRegistry, asked)]);

                    return fields.every(([field, conforms]) => conforms(value[field]));
                };
            }
        }
    }

    /**
     * The value of the local the node names: evaluated at its first use in the application of the object expression that holds it, against that application's implicit parameter and the locals in scope where it is written, and the same value at every later use there.
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
            const enclosingLocalsFrame = this.#localsFrame;
            const enclosingSelections = this.#selections;

            this.#localsFrame = frame;
            this.#selections = null;

            try {
                cachedLocal = { value: this.#evaluateNode(frame.node.locals.find(local => local.name === node.name).value, frame.item), selections: this.#selections };
            } finally {
                this.#localsFrame = enclosingLocalsFrame;
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

    /** Evaluates a member whose resolution is selected as it is evaluated, its receiver the node an invocation records and any other member's the node it targets. */
    #evaluateMember(node, context) {
        // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
        if (node === this.#projectionContext?.node) {
            return this.#projectionContext.value;
        }

        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const receiver = this.#evaluateNode(resolution?.kind === 'invocation' ? resolution.receiverNode : node.target, context);

        if (receiver === null) {
            return null;
        }

        if (resolution.kind !== 'computedPropertyAccess') {
            return this.#evaluateResolvedAccess(resolution, receiver, node, context);
        }

        // A computed property access computes its name once and reads the property it selects, which is recorded for the value's place in the result.
        const name = this.#evaluateNode(node.name, context);

        (this.#selections ??= new Map()).set(node, name);

        return this.#evaluateResolvedAccess(resolution.candidates.get(name), receiver, node, context);
    }

    /**
     * Evaluates the access the resolution names on the receiver: reads a property of its data or an object field of the object root, or evaluates the arguments the declaration is given and invokes it with them, answering null
     * without invoking it where a null argument propagates.
     */
    #evaluateResolvedAccess(resolution, receiver, node, context) {
        if (resolution.kind === 'field') {
            return this.#readField(receiver, resolution.name);
        }

        if (resolution.kind === 'objectRootField') {
            return this.#readObjectRootField(receiver, resolution.name);
        }

        const args = this.#evaluateArguments(resolution, context);

        return args === null ? null : this.#invokeImplementation(this.#getCompiledInvocation(resolution.declaration, resolution.type), receiver, args, node);
    }

    /** A field of a value, the selections that its value's evaluation made, where an object expression of this evaluation built the value, recorded where it is read; null for no receiver. */
    #readField(receiver, name) {
        if (receiver === null) {
            return null;
        }

        const selections = this.#objectFieldSelections.get(receiver)?.get(name) ?? null;

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

        const selections = this.#objectFieldSelections.get(root)?.get(name) ?? null;

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
            throw LexicaErrors.evaluation('LEXICA5505', `'${operator}' takes numbers, and is given ${typeof left !== 'number' ? Evaluator.#describe(left) : Evaluator.#describe(right)}`, this.#locate(this.#pointerOf(node)));
        }

        if ((operator === '/' || operator === '%') && right === 0 && node.kind === 'arithmetic') {
            throw LexicaErrors.evaluation('LEXICA5005', `'${operator}' divides by zero`, this.#locate(this.#pointerOf(node)));
        }

        if (!Number.isFinite(result)) {
            throw LexicaErrors.evaluation('LEXICA5020', `The result of '${operator}' is no finite number`, this.#locate(this.#pointerOf(node)));
        }

        return result;
    }

    /** The arguments by parameter name, or null where a null argument makes the call answer null, evaluated as a compiled member's are, their plan made once for the member's resolution. */
    #evaluateArguments(resolution, context) {
        let evaluateArguments = this.#compiledArguments.get(resolution);

        if (evaluateArguments === undefined) {
            evaluateArguments = this.#compileArguments(resolution);
            this.#compiledArguments.set(resolution, evaluateArguments);
        }

        return evaluateArguments(this, context);
    }

    /**
     * Carries out a compiled invocation with its receiver and its arguments by parameter name, the one protocol every invocation of an implementation follows: it fails a declaration without an implementation, asks the host's
     * `beforeInvoke` for the samples a maintained member reads, answering null where one is pending, gives the implementation one object it reads by name, closes the functions it was given once it returns, checks its answer
     * against the invocation's result type, tells the host's `afterInvoke`, and answers a copy of the structures the answer holds. Its failures are located at the node that invoked it.
     */
    #invokeImplementation(invocation, receiver, args, node) {
        const { declaration, implementation, takesReceiver, resultType, isOfResultType, copyStructure } = invocation;

        if (implementation === undefined) {
            throw LexicaErrors.module('LEXICA4001', `The module '${this.#moduleRegistry.getOwner(declaration)}' gives '${declaration.name}' no implementation`, this.#locate(this.#pointerOf(node)));
        }

        // A module member is read and called through its namespace, and has no receiver.
        const received = takesReceiver ? { receiver } : {};
        const request = this.#host === null ? null : { declaration, ...received, args, pointer: this.#pointerOf(node) };
        const samples = this.#beforeInvoke(request, declaration, node);

        if (samples === null) {
            return null;
        }

        let value;

        try {
            value = implementation({ ...received, args, env: this.#environment, ...(declaration.updates?.reads === 'maintained' ? { samples } : {}) });
        } catch (error) {
            // A failure Lexica raised, within a function the member was given or a nested evaluation among them, keeps its own code and place; anything else the implementation threw, a LexicaError it built among them,
            // is the cause of Lexica's own, exactly as thrown.
            if (LexicaErrors.has(error) || this.#callbackErrors.has(error)) {
                throw error;
            }

            throw LexicaErrors.evaluation('LEXICA5007', `${this.#subjectOf(declaration, node)} failed: ${Evaluator.#messageOf(error)}`, this.#locate(this.#pointerOf(node)), { cause: error });
        } finally {
            // A function the member was given is called only while its invocation lasts.
            for (const name in args) {
                const lifetime = this.#callbackLifetimes.get(args[name]);

                if (lifetime !== undefined) {
                    lifetime.isOpen = false;
                }
            }
        }

        if (!isOfResultType(value)) {
            this.#fail('LEXICA5006', `${this.#subjectOf(declaration, node)} answered ${Evaluator.#describe(value)}, and it declares ${resultType}`, this.#pointerOf(node));
        }

        if (request !== null && this.#host.afterInvoke !== undefined) {
            try {
                this.#host.afterInvoke(request, value);
            } catch (error) {
                this.#failHook(error, declaration, node, 'after its invocation');
            }
        }

        return copyStructure === null ? value : copyStructure(value);
    }

    /** What a message names as carrying a member out. */
    #subjectOf(declaration) {
        return `The member '${declaration.name}'`;
    }

    /**
     * The evaluator's step before an invocation, at the point the host's hook is named for: calls the host's `beforeInvoke` where there is one and answers the samples a member's invocation reads, or null where one is pending,
     * marking the evaluation pending, so the member answers null. A failure of the hook fails the evaluation at the member. Without the hook, it refuses a member that reads maintained values, since nothing answers its samples.
     */
    #beforeInvoke(request, declaration, node) {
        if (request === null || this.#host.beforeInvoke === undefined) {
            if (declaration.updates?.reads === 'maintained') {
                this.#fail('LEXICA5011', `${this.#subjectOf(declaration, node)} is maintained by an observation, and reading it waits for the first sample, which a synchronous evaluation cannot`, this.#pointerOf(node));
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

    /**
     * Fails the evaluation at the member for what a hook around its invocation threw, a LexicaError the hook built among them, a failure Lexica raised keeping its own place;
     * the hooks are called directly, since they run on every invocation.
     */
    #failHook(error, declaration, node, moment) {
        if (LexicaErrors.has(error) || this.#callbackErrors.has(error)) {
            throw error;
        }

        throw LexicaErrors.evaluation('LEXICA5009', `The host failed ${moment} of ${this.#subjectOf(declaration, node).replace(/^The /, 'the ').replace(/,$/, '')}: ${Evaluator.#messageOf(error)}`, this.#locate(this.#pointerOf(node)), { cause: error });
    }

    /** What a thrown value says, for the message of the failure it causes: an error's message, or the value written as text, whatever it is. */
    static #messageOf(error) {
        try {
            return error?.message ?? String(error);
        } catch {
            return Object.prototype.toString.call(error);
        }
    }

    /**
     * A value a host supplied, captured as its type at every level of it: a value its type admits taken, a structure as its declared fields alone and a list item by item; nothing, or null, null where its type is nullable; and a reference
     * of another type null where a nullable reference type is declared, so the value keeps only the reference its type names. Anything else fails, naming the part of the value by its path.
     */
    #capture(value, type, path, fail) {
        if (value === undefined || value === null) {
            if (!type.isNullable) {
                fail(path, value, type);
            }

            return null;
        }

        if (type.isList) {
            if (!Array.isArray(value) || ArrayUtils.findMissingIndex(value) !== -1) {
                fail(path, value, type);
            }

            return value.map((item, index) => this.#capture(item, type.itemType, `${path}[${index}]`, fail));
        }

        switch (type.kind) {
            case 'typeParameter':
                return value;
            case 'object':
                if (!ObjectUtils.isNonArrayObject(value)) {
                    fail(path, value, type);
                }

                return Object.fromEntries([...type.fieldTypes].map(([name, fieldType]) => [name, this.#capture(value[name], fieldType, Evaluator.#pathOf(path, name), fail)]));
            default:
                return this.#captureNamed(value, type, path, fail);
        }
    }

    /**
     * A value captured as a named type: a built-in type's value and a reference of the type as they are, a reference of another type null where a nullable reference type is declared, and a structure as its declared fields, each captured
     * in turn. A supplied value has no type until it is captured, so where it doesn't belong to a reference type, the registry's recognition tells a reference of another type from mistyped data, which fails whatever its nullability.
     */
    #captureNamed(value, type, path, fail) {
        if (type.module === null && LexicaModule.builtInTypeNames.includes(type.name)) {
            if (!Evaluator.#belongsToBuiltIn(value, type.name)) {
                fail(path, value, type);
            }

            return value;
        }

        if (this.#moduleRegistry.isReferenceType(type)) {
            const asked = 'capturing a supplied value';

            if (this.#moduleRegistry.belongsTo(value, type, asked)) {
                return value;
            }

            if (type.isNullable && this.#moduleRegistry.recognize(value, asked).length > 0) {
                return null;
            }

            fail(path, value, type);
        }

        const structure = this.#moduleRegistry.getStructure(type);

        if (structure === undefined || !ObjectUtils.isNonArrayObject(value)) {
            fail(path, value, type);
        }

        return Object.fromEntries(Evaluator.#fieldTypesOf(structure, this.#moduleRegistry).map(([name, fieldType]) => [name, this.#capture(value[name], fieldType, Evaluator.#pathOf(path, name), fail)]));
    }

    /** The path of a field within the path of the value that holds it. */
    static #pathOf(path, name) {
        return path === '' ? name : `${path}.${name}`;
    }

    /** Whether the value belongs to the built-in type the name names, one of `LexicaModule.builtInTypeNames`: a finite number, a string or a Boolean. */
    static #belongsToBuiltIn(value, typeName) {
        switch (typeName) {
            case 'Number':
                return Number.isFinite(value);
            case 'String':
                return typeof value === 'string';
            case 'Boolean':
                return typeof value === 'boolean';
            default:
                return false;
        }
    }

    #fail(code, message, pointer) {
        throw LexicaErrors.evaluation(code, message, this.#locate(pointer));
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
    static #fieldTypesOf(structure, moduleRegistry) {
        let fields = Evaluator.#fieldTypesByStructure.get(structure);

        if (fields === undefined) {
            fields = moduleRegistry.getFieldTypesOf(structure);
            Evaluator.#fieldTypesByStructure.set(structure, fields);
        }

        return fields;
    }

    /** Whether a value is truthy: every value is but null and false. */
    static #isTruthy(value) {
        return value !== null && value !== false;
    }

    /** What the value is, for a message, its type never asked: nothing, or its data where it has any. */
    static #describe(value) {
        if (value === undefined) {
            return 'nothing';
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

    /**
     * The node evaluated and detached, the script's expression or a host call's result projection, with the metadata that describes it, built from the identities the copy answers beside it, which the evaluator hands over and never
     * keeps, so it holds no source between evaluations.
     */
    #evaluateResult(node) {
        this.#sourcesByList = new WeakMap();
        this.#selections = null;

        try {
            const { value, copiedIdentities } = this.#copyResult(this.#evaluateNode(node, null));

            // The metadata is described where it is first read, from identities no later evaluation changes, so a caller that reads the value alone pays nothing for it.
            return { node, value, identities: Evaluator.#withSelections(copiedIdentities, this.#selections) };
        } finally {
            this.#selections = null;
        }
    }

    /**
     * Copies the data, from one traversal, into `value`, a frozen copy sharing no structure with the original, and `copiedIdentities`, the identities that follow its structure: for a list projected from elements, the element each item
     * came from, for an object field, the selections made for its value, as `selections`, and null where nothing beneath holds either. Each call answers its own, so a caller reads the identities of the part it copied.
     * @returns {{ value: unknown, copiedIdentities: object | null }}
     */
    #copyResult(value) {
        if (Array.isArray(value)) {
            const copy = [];
            const itemIdentities = [];
            let hasIdentities = false;

            for (const item of value) {
                const copied = this.#copyResult(item);

                copy.push(copied.value);
                itemIdentities.push(copied.copiedIdentities);
                hasIdentities ||= copied.copiedIdentities !== null;
            }

            const sources = this.#sourcesByList.get(value) ?? null;

            return { value: Object.freeze(copy), copiedIdentities: sources === null && !hasIdentities ? null : { sources, items: itemIdentities } };
        }

        if (ObjectUtils.isNonArrayObject(value)) {
            const copy = {};
            const fieldSelections = this.#objectFieldSelections.get(value);
            let fieldIdentities = null;

            for (const name of Object.keys(value)) {
                const copied = this.#copyResult(value[name]);
                const field = copied.value;

                // A read copies every field of every row, so an ordinary field is assigned here, where the assignment sees only the copies' shapes; sharing the one in `defineDataProperty` with live state's writes made reads measurably slower.
                if (name === '__proto__') {
                    ObjectUtils.defineDataProperty(copy, name, field);
                } else {
                    copy[name] = field;
                }

                const identities = Evaluator.#withSelections(copied.copiedIdentities, fieldSelections?.get(name) ?? null);

                if (identities !== null) {
                    fieldIdentities ??= {};
                    ObjectUtils.defineDataProperty(fieldIdentities, name, identities);
                }
            }

            return { value: Object.freeze(copy), copiedIdentities: fieldIdentities === null ? null : { fields: fieldIdentities } };
        }

        return { value, copiedIdentities: null };
    }

    /**
     * Resolves which record describes the value an expression gave at its place in the result, read from the identities its copy left there: the record of the expression that produced it, followed through locals, bodies, `do` blocks, function calls,
     * object-root fields, the branch or operand a selecting expression selected and the property a computed property access selected; a field read keeps the record its whole has for that field, or its whole's own.
     * An object expression's value records each field, and a projection's each item and the input it came from. The value is undefined where the expression is described for a part read from it, and nothing beyond its record is described then.
     * The context record is the record of the value `it` stands for where the expression stands, the value an object expression follows or the item it projects, or null where there is none.
     */
    #resolveRecord(node, value, identities, contextRecord) {
        const selections = identities?.selections ?? null;

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
                    const resolution = this.#resolvedDefinition.resolutionOf(node);

                    // A call of one function reference alone produces its value itself, as the member it invokes does, the reference's declaration its one candidate where its receiver's type is unknown.
                    if (resolution.functions === undefined) {
                        return this.#getExpressionRecord(node, null, (resolution.declaration ?? resolution.candidates[0]).updates?.tolerance ?? null);
                    }

                    const { functions } = resolution;
                    const called = functions.length === 1 ? functions[0] : functions.find(entry => Evaluator.#getFunctionKey(entry) === selections?.get(node));

                    if (called === undefined) {
                        return this.#getExpressionRecord(node, null, null);
                    }

                    // A call of a function reference produces its value itself, as the member it invokes does.
                    if (called.reference !== undefined) {
                        return this.#getExpressionRecord(node, null, called.reference.updates?.tolerance ?? null);
                    }

                    node = called.body;
                    continue;
                }
                case 'member':
                case 'call':
                case 'indexer': {
                    let resolution = this.#resolvedDefinition.resolutionOf(node);
                    let candidate = null;

                    if (resolution?.kind === 'computedPropertyAccess') {
                        candidate = selections?.get(node) ?? null;

                        if (candidate === null) {
                            return this.#getExpressionRecord(node, null, null);
                        }

                        resolution = resolution.candidates.get(candidate);
                    }

                    if (resolution?.kind === 'objectRootField') {
                        node = resolution.value;
                        continue;
                    }

                    if (resolution?.kind === 'field') {
                        const whole = this.#resolveRecord(node.target, undefined, identities, contextRecord);

                        return whole.fields?.[candidate ?? resolution.name] ?? Evaluator.#getInheritedRecord(whole);
                    }

                    return this.#getExpressionRecord(node, candidate, resolution?.declaration?.updates?.tolerance ?? null);
                }
                case 'it':
                    return contextRecord ?? this.#getExpressionRecord(node, null, null);
                case 'object':
                    return this.#resolveObjectExpressionRecord(node, value, identities, contextRecord);
                default:
                    if (SELECTING_KINDS.has(node.kind)) {
                        const selected = selections?.get(node);

                        if (selected === undefined) {
                            return this.#getExpressionRecord(node, null, null);
                        }

                        node = selected;
                        continue;
                    }

                    return this.#getExpressionRecord(node, null, null);
            }
        }
    }

    /**
     * Resolves the record of an object expression's value, whichever result it gave: one object's record of each field, a projected list's record of each item with the reference each came from, or its own record alone where it
     * gave null or is described for a part read from it.
     */
    #resolveObjectExpressionRecord(node, value, identities, contextRecord) {
        // The fields read `it` as the value the expression follows, each item of it where it projects a list, and as the enclosing one where it follows none.
        const followed = node.target === undefined ? null : this.#resolveRecord(node.target, undefined, identities, contextRecord);

        if (Array.isArray(value)) {
            const itemContextRecord = followed === null ? contextRecord : Evaluator.#getInheritedRecord(followed);
            const items = value.map((item, index) => this.#createObjectRecord(node, item, identities?.items?.[index] ?? null, itemContextRecord));
            const sources = identities?.sources ?? null;

            // A list no projection built records no sources at all, so a null source and absent sources stay apart.
            return Object.freeze({ origin: this.#getExpressionRecord(node, null, null).origin, tolerance: null, items: Object.freeze(items), ...(sources === null ? {} : { sources }) });
        }

        return value === null ? this.#getExpressionRecord(node, null, null) : this.#createObjectRecord(node, value, identities, followed ?? contextRecord);
    }

    /**
     * Creates the record of one object an object expression built, with each field's, by its name in the order written, called once for a single object and once for each projected item; a field described for a part read from
     * it is described from the selections of the place it is read.
     */
    #createObjectRecord(node, object, identities, contextRecord) {
        const { fields } = node;
        const records = new Array(fields.length);

        for (let index = 0; index < fields.length; index++) {
            const field = fields[index];

            records[index] = this.#resolveRecord(field.value, object === undefined ? undefined : object?.[field.name], object === undefined ? identities : identities?.fields?.[field.name] ?? null, contextRecord);
        }

        // An object whose fields give the records a recent one did, as the items of a list mostly do, shares its record.
        let recent = Evaluator.#recentFieldRecords.get(node);

        if (recent === undefined) {
            recent = [];
            Evaluator.#recentFieldRecords.set(node, recent);
        }

        for (const kept of recent) {
            if (kept.contextRecord === contextRecord && records.every((record, index) => record === kept.fields[index])) {
                return kept.record;
            }
        }

        const byName = Object.create(null);

        for (let index = 0; index < fields.length; index++) {
            byName[fields[index].name] = records[index];
        }

        const record = Object.freeze({ origin: this.#getExpressionRecord(node, null, null).origin, tolerance: null, fields: Object.freeze(byName) });

        recent.unshift({ contextRecord, fields: records, record });

        if (recent.length > RECENT_FIELD_RECORDS) {
            recent.pop();
        }

        return record;
    }

    /**
     * Gets the shared record of a value an expression produced itself, with the candidate it selected and the tolerance that expression applies, from `#expressionRecordCache`, creating it at the first lookup: one for this
     * resolution, its origin a token every evaluation of it shares.
     */
    #getExpressionRecord(node, candidate, tolerance) {
        let records = Evaluator.#expressionRecordCache.get(this.#resolvedDefinition);

        if (records === undefined) {
            records = new Map();
            Evaluator.#expressionRecordCache.set(this.#resolvedDefinition, records);
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

    /** Gets the shared record a part with none of its own inherits from its whole, its whole's origin and tolerance without the whole's fields or items, from `#inheritedRecordCache`, creating it at the first lookup. */
    static #getInheritedRecord(whole) {
        if (whole.fields === undefined && whole.items === undefined) {
            return whole;
        }

        let inherited = Evaluator.#inheritedRecordCache.get(whole);

        if (inherited === undefined) {
            inherited = Object.freeze({ origin: whole.origin, tolerance: whole.tolerance });
            Evaluator.#inheritedRecordCache.set(whole, inherited);
        }

        return inherited;
    }

    /** The identities of a value with the selections made for it beside them, as their `selections`, or the identities alone where none were made. */
    static #withSelections(identities, selections) {
        return selections === null ? identities : { ...identities, selections };
    }
}
