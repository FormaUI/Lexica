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
class EvaluationResult {
    #describe;
    #metadata;

    constructor(value, isPending, describe) {
        this.value = value;
        this.isPending = isPending;
        this.#describe = describe;
        Object.freeze(this);
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
     * The function each node of a resolved definition compiles to, by the definition and then the node, with the registry they were compiled against: built once, it holds what the node's evaluation needs that no evaluation changes, and takes the evaluator, which holds what one does, and the implicit parameter.
     * Beside them, the function each member's arguments compile to, by the member's resolution, for the evaluations that read the member without compiling it.
     * @type {WeakMap<object, { registry: object, functions: Map<object, (evaluator: Evaluator, current: unknown) => unknown>, arguments: Map<object, (evaluator: Evaluator, current: unknown) => object | null> }>}
     */
    static #compilationCache = new WeakMap();

    /** The record of each expression that produces a value itself, holding its origin token, by the definition, then the node, then the candidate it selected, or null: a record lives as long as its resolution, and its evaluations share it. @type {WeakMap<object, Map<object, Map<string | null, object>>>} */
    static #recordsByDefinition = new WeakMap();

    /** The record a part with none of its own takes from each whole record, made once. @type {WeakMap<object, object>} */
    static #inheritedRecords = new WeakMap();

    /** The records each object expression gave last, the latest first, with the implicit parameter's record and the records of the fields each was made of, so an object whose fields give the same records shares one, as items that alternate between branches do. @type {WeakMap<object, { contextRecord: object | null, fields: object[], record: object }[]>} */
    static #recentFieldRecords = new WeakMap();

    /** The functions this evaluator's nodes compile to. @type {Map<object, (evaluator: Evaluator, context: unknown) => unknown>} */
    #compiledFunctions;

    /** The functions the arguments of this evaluator's members compile to, by each member's resolution. @type {Map<object, (evaluator: Evaluator, context: unknown) => object | null>} */
    #compiledArguments;

    #moduleRegistry;
    #resolvedDefinition;
    #parameterBindings;
    #environment;
    #locations;

    /** The source of each item of a list an object expression projected, by the list it produced, for the evaluation in progress. @type {WeakMap<unknown[], readonly ProjectionSource[]>} */
    #sourcesByList = new WeakMap();

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
     * Prepares the host call the script ends in for its host: evaluates the locals before it, each body's along the script's terminal position in order, then its receiver and its arguments, once, as `evaluate` evaluates a script without a host.
     * It answers a prepared call, with its declaration, its receiver, its arguments by parameter name and where it stands, whose `project` projects each value its host supplies where the call declares a result; or a skipped call where the
     * receiver, or an argument whose parameter propagates null, is null, or the call has no declaration yet, its receiver's type unknown, so there is nothing to invoke. Each prepared call keeps the locals it was prepared with, so the prepared
     * calls of one evaluator stay apart.
     * @returns {{ kind: 'prepared', declaration: object, receiver: unknown, args: Record<string, unknown>, location: object, project?: (value: unknown, host?: Host | null) => EvaluationResult } | { kind: 'skipped', location: object }}
     */
    prepareCall() {
        const { hostCall } = this.#resolvedDefinition;

        if (hostCall === null) {
            this.#fail('LEXICA5014', 'The script gives a value and ends in no host call, so there is nothing to prepare; evaluate it', '/expression');
        }

        const { node, pointer, declaration } = hostCall;
        const location = this.#locate(pointer);
        const enclosingLocals = this.#localsFrame;
        const resolution = this.#resolvedDefinition.resolutionOf(node);

        try {
            const projection = this.#evaluateLocalsBefore();
            const frame = this.#localsFrame;
            // A qualified form's receiver is its first argument, and a module member has none, so nothing it lacks skips it.
            const hasReceiver = declaration === null || this.#moduleRegistry.hasReceiver(declaration);
            const receiver = declaration === null ? null : hasReceiver ? this.#evaluateNode(Evaluator.#receiverNodeOf(node, resolution), null) : undefined;
            const args = receiver === null ? null : this.#evaluateArguments(resolution, null);

            if (args === null) {
                return Object.freeze({ kind: 'skipped', location });
            }

            const call = hasReceiver ? { kind: 'prepared', declaration, receiver, args, location } : { kind: 'prepared', declaration, args, location };

            // A call whose host supplies nothing has nothing to project.
            if (declaration.result !== undefined) {
                call.project = (value, host = null) => this.#run(host, () => this.#project(frame, projection, value));
            }

            return Object.freeze(call);
        } finally {
            this.#localsFrame = enclosingLocals;
            this.#selections = null;
        }
    }

    /**
     * Evaluates the locals of each body along the script's terminal position into a frame of its own, in order, as a run of each body does, leaving the innermost frame the one in scope, and answers the node the terminal position holds
     * after its bodies: the result projection, the optional chain or the host call itself.
     */
    #evaluateLocalsBefore() {
        let node = this.#resolvedDefinition.definition.expression;

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

        return node;
    }

    /**
     * Projects one value the host supplied for a prepared call: captures it as the type the call declares, then evaluates the result projection against it as an evaluation of its own, within the frame of the locals the call was prepared
     * with, which it reads and never evaluates again.
     */
    #project(frame, projection, value) {
        const { node, pointer, declaration } = this.#resolvedDefinition.hostCall;
        const { type } = this.#resolvedDefinition.resolutionOf(node);

        // A part of the value is named by its path within it, the value itself by none.
        const fail = (path, part, partType) => {
            const supplied = path === '' ? Evaluator.#describe(part) : part === undefined ? `a value without '${path}'` : `a value whose '${path}' is ${Evaluator.#describe(part)}`;

            this.#fail('LEXICA5015', `The host call '${declaration.name}' supplied ${supplied}, and ${path === '' ? 'it declares' : `'${path}' is declared`} ${partType}`, pointer);
        };

        const captured = this.#capture(value, type, '', fail);
        const enclosingLocals = this.#localsFrame;

        this.#localsFrame = frame;
        this.#projectionContext = { node, value: captured };

        try {
            return this.#evaluateResult(projection);
        } finally {
            this.#projectionContext = null;
            this.#localsFrame = enclosingLocals;
        }
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
    #evaluateValue() {
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

                return (evaluator, context) => {
                    const value = left(evaluator, context);

                    return value === right(evaluator, context);
                };
            }
            case 'conditional': {
                const consequent = this.#getCompiledFunction(node.consequent);
                const alternative = this.#getCompiledFunction(node.alternative);

                if (node.binding !== undefined) {
                    const bind = this.#getCompiledFunction(node.binding.value);

                    // The value is evaluated once; where it is truthy, the consequent reads it through the name it is bound to, and the branch taken is recorded for the value's place in the result.
                    return (evaluator, context) => {
                        const value = bind(evaluator, context);
                        const isTruthy = Evaluator.#isTruthy(value);

                        (evaluator.#selections ??= new Map()).set(node, isTruthy ? node.consequent : node.alternative);

                        if (!isTruthy) {
                            return alternative(evaluator, context);
                        }

                        const enclosing = evaluator.#boundValues.get(node);

                        evaluator.#boundValues.set(node, value);

                        try {
                            return consequent(evaluator, context);
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
                // A function's value is its closure: the locals, the implicit parameter and the object root where it is declared, which each call evaluates its body in.
                return (evaluator, context) => ({ function: node, frame: evaluator.#localsFrame, context, objectRoot: evaluator.#objectRoot });
            case 'functionCall': {
                const { targets: resolvedTargets, binding } = this.#resolvedDefinition.resolutionOf(node);
                const local = { name: node.name };
                const closureOf = evaluator => (binding === undefined ? evaluator.#evaluateLocal(local) : evaluator.#boundValues.get(binding));

                // A call of one function reference alone is its qualified form's call, and the reference it is reads nothing.
                if (resolvedTargets.length === 1 && resolvedTargets[0].invocation?.kind === 'member') {
                    return this.#compileInvocation(node, resolvedTargets[0].invocation);
                }

                const targets = this.#compileTargets(resolvedTargets);
                const evaluateArguments = node.arguments.map(argument => this.#getCompiledFunction(argument));

                // The arguments are evaluated once each, left to right, in the caller's scope, and the body of the function the name holds in its closure's, so no local of the caller's is visible in it;
                // where the name may hold one of several, the one it holds is recorded for the value's place in the result. A function reference's receiver argument is evaluated first, and a null one answers null before the others are.
                return (evaluator, context) => {
                    const closure = closureOf(evaluator);
                    const target = targets.length === 1 ? targets[0] : targets.find(candidate => (candidate.reference ?? candidate.function) === (closure.reference ?? closure.function));

                    if (targets.length > 1) {
                        (evaluator.#selections ??= new Map()).set(node, target.reference ?? target.function);
                    }

                    if (target.reference !== undefined && target.hasReceiver) {
                        const receiver = evaluateArguments[0](evaluator, context);

                        if (receiver === null) {
                            return null;
                        }

                        return evaluator.#callClosure(closure, target, [receiver, ...evaluateArguments.slice(1).map(evaluateArgument => evaluateArgument(evaluator, context))], node);
                    }

                    return evaluator.#callClosure(closure, target, evaluateArguments.map(evaluateArgument => evaluateArgument(evaluator, context)), node);
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
        const target = this.#getCompiledFunction(node.target);
        const { type, targetType } = this.#resolvedDefinition.resolutionOf(node);
        const asked = `the cast to ${type}`;
        // A value of a type above the cast's is one that isn't of the cast's type, and a value of the cast's own type, or of one beneath it, is one its supertypes refuse.
        const what = this.#moduleRegistry.typeChecker.isAssignable(type, targetType) && !this.#moduleRegistry.typeChecker.isAssignable(targetType, type) ? `${Evaluator.#articleOf(targetType)} that isn't ${Evaluator.#articleOf(type)}` : Evaluator.#articleOf(targetType);

        return (evaluator, context) => {
            const value = target(evaluator, context);

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
    static #articleOf(type) {
        const name = String(type);

        return /^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`;
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

        return (evaluator, context) => {
            const value = target(evaluator, context);

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

        // A function reference is a function value, the same for every read of it, which reads nothing.
        if (resolution?.kind === 'reference') {
            const closure = Evaluator.#referenceClosureOf(resolution.declaration);

            return () => closure;
        }

        if (resolution === undefined || resolution.kind === 'computedPropertyAccess' || (resolution.kind !== 'field' && resolution.kind !== 'objectRootField' && resolution.declaration === null)) {
            return (evaluator, context) => evaluator.#evaluateMember(node, context);
        }

        if (resolution.kind === 'member') {
            return this.#compileInvocation(node, resolution);
        }

        const target = this.#getCompiledFunction(node.target);

        if (resolution.kind === 'objectRootField') {
            const { name } = resolution;

            return (evaluator, context) => evaluator.#readObjectRootField(target(evaluator, context), name);
        }

        const { name } = resolution;

        // A field of data, which a projection's host call never is.
        return (evaluator, context) => {
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            return evaluator.#readField(target(evaluator, context), name);
        };
    }

    /**
     * An invocation of a member's declaration, with its function, its arguments and the check of its result made once: its receiver evaluated first, the node's target, a named indexer's the access its name is written in has,
     * or a qualified form's first argument, a null one answering null before its own
     * arguments are evaluated, and a module member's none; then its arguments, null where one makes the call answer null.
     */
    #compileInvocation(node, resolution) {
        const { type, declaration, qualified } = resolution;
        const hasReceiver = this.#moduleRegistry.hasReceiver(declaration);
        const target = !hasReceiver ? null : this.#getCompiledFunction(Evaluator.#receiverNodeOf(node, resolution));
        const implementation = this.#moduleRegistry.getImplementation(declaration);
        const conforms = Evaluator.#compileTypeCheck(type, this.#moduleRegistry, `the answer of '${declaration.name}'`);
        const copyStructures = Evaluator.#compileStructureCopy(type, this.#moduleRegistry);
        const evaluateArguments = this.#compileArguments(resolution);

        return (evaluator, context) => {
            // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            const receiver = target === null ? undefined : target(evaluator, context);

            if (receiver === null) {
                return null;
            }

            const args = evaluateArguments(evaluator, context);

            return args === null ? null : evaluator.#invokeImplementation(declaration, implementation, conforms, copyStructures, receiver, args, type, node);
        };
    }

    /** The function value each function reference is, by its declaration: the same for every evaluation, since it holds nothing an evaluation bound. @type {WeakMap<object, { reference: object }>} */
    static #referenceClosures = new WeakMap();

    static #referenceClosureOf(declaration) {
        let closure = Evaluator.#referenceClosures.get(declaration);

        if (closure === undefined) {
            closure = Object.freeze({ reference: declaration });
            Evaluator.#referenceClosures.set(declaration, closure);
        }

        return closure;
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
        const isOptions = resolution.declaration.arguments === 'options';
        const argumentPlans = resolution.arguments.map((argument, index) => {
            const { parameter } = argument;
            const isOption = isOptions && !argument.isDefault && parameter.kind !== 'expression' && parameter.kind !== 'predicate' && argument.callback?.implicit !== true;
            const isRead = isOption && resolution.arguments.slice(index + 1).some(later => !later.isDefault && Evaluator.#readsLocal(later.node, parameter.name));
            const isField = isOption && buildsObjectRoot === true;

            if (argument.isDefault || parameter.fixed) {
                return { name: parameter.name, kind: 'constant', value: argument.isDefault ? parameter.default : argument.value, isRead, isField };
            }

            const plan = { name: parameter.name, kind: parameter.kind, evaluate: this.#getCompiledFunction(argument.node), propagatesNull: parameter.nulls === 'propagate', isOption, isRead, isField };

            if (argument.callback === undefined) {
                return plan;
            }

            const { targets, parameterTypes, resultType, implicit } = argument.callback;
            const callback = { ...plan, propagatesNull: false, member: resolution.declaration.name, parameterTypes, resultType, pointer: argument.pointer, node: argument.node };

            // A function given to an expression or a predicate parameter is called with each item, as its body would be evaluated against it.
            if (parameter.kind !== 'function') {
                return { ...callback, kind: 'itemFunction', policy: parameter.kind, targets: this.#compileTargets(targets) };
            }

            // An implicit body is the argument's expression, evaluated against each argument the member calls it with, which is its implicit parameter.
            return implicit === true ? { ...callback, kind: 'implicitBody' } : { ...callback, targets: this.#compileTargets(targets) };
        });

        return (evaluator, context) => {
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
                    } else if (plan.kind === 'itemFunction') {
                        // The function value is evaluated where it is written, once, and the member calls it with each item; a predicate's receives the truthiness of what it gives.
                        const callback = evaluator.#callbackOf(plan.evaluate(evaluator, context), plan);

                        args[plan.name] = plan.policy === 'expression' ? callback : evaluator.#sharingLifetime(item => Evaluator.#isTruthy(callback(item)), callback);
                    } else if (plan.kind === 'implicitBody') {
                        // The member calls it when it chooses, each call evaluating the expression anew against its argument, with the names and the object root of the place it is written.
                        args[plan.name] = evaluator.#implicitBodyOf(plan, evaluator.#localsFrame, evaluator.#objectRoot);
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

                        // A function value goes to the member as a function it calls, while the expression's own names and fields hold the value itself.
                        held = value;
                        args[plan.name] = plan.kind === 'function' ? evaluator.#callbackOf(value, plan) : value;
                    }

                    if (plan.isField) {
                        object[plan.name] = held;
                        rootSelections.set(plan.name, selections);
                    }

                    if (plan.isRead) {
                        evaluator.#localsFrame = { node: { locals: [{ name: plan.name }] }, item: context, values: new Map([[plan.name, { value: held, selections }]]), enclosing: evaluator.#localsFrame };
                    }
                }

                return args;
            } finally {
                evaluator.#objectRoot = enclosingObjectRoot;
                evaluator.#localsFrame = enclosingLocals;
            }
        };
    }

    /**
     * The functions a call may evaluate, each compiled once: a function the script declares, its parameters and its body's compiled function; or a function reference, its declaration, whether it takes a receiver,
     * and the names of the parameters its values supply after it, the rest left to their defaults.
     */
    #compileTargets(targets) {
        return targets.map(target => {
            if (target.reference === undefined) {
                return { function: target.function, parameters: target.parameters, evaluateBody: this.#getCompiledFunction(target.body) };
            }

            const declaration = target.reference;
            const hasReceiver = this.#moduleRegistry.hasReceiver(declaration);
            const type = this.#moduleRegistry.getDeclaredType(declaration, declaration.result);

            return { reference: declaration, hasReceiver, parameters: declaration.parameters, conforms: Evaluator.#compileTypeCheck(type, this.#moduleRegistry, `the answer of '${declaration.name}'`), copyStructures: Evaluator.#compileStructureCopy(type, this.#moduleRegistry), type };
        });
    }

    /**
     * The value of a call of the closure: the target's body, evaluated in the closure's scope, implicit parameter and object root, its parameters bound to the values in order; or, for a function reference, its declaration invoked as its qualified form is,
     * its receiver the first value, a null one answering null, and its parameters the values after it, each one left out taking its default, its failures named at the node that called it.
     */
    #callClosure(closure, target, values, node = null) {
        if (target.reference !== undefined) {
            return this.#callReference(target, values, node);
        }

        const { parameters } = target;
        const enclosingFrame = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;

        this.#localsFrame = { node: { locals: parameters.map(parameter => ({ name: parameter })) }, item: closure.context, values: new Map(parameters.map((parameter, index) => [parameter, { value: values[index], selections: null }])), enclosing: closure.frame };
        this.#objectRoot = closure.objectRoot;

        try {
            return target.evaluateBody(this, closure.context);
        } finally {
            this.#localsFrame = enclosingFrame;
            this.#objectRoot = enclosingObjectRoot;
        }
    }

    /** A call of a function reference with the values given: its receiver the first where its declaration has one, null answering null, and its own arguments by its parameters' names, those left out taking their defaults. */
    #callReference(target, values, node) {
        const { reference: declaration, hasReceiver, parameters } = target;
        const receiver = hasReceiver ? values[0] : undefined;

        if (receiver === null) {
            return null;
        }

        const own = hasReceiver ? values.slice(1) : values;
        const args = {};

        parameters.forEach((parameter, index) => {
            args[parameter.name] = index < own.length ? own[index] : parameter.default;
        });

        // A null argument whose parameter propagates null makes the call answer null without invoking it.
        if (parameters.some((parameter, index) => index < own.length && own[index] === null && parameter.nulls === 'propagate')) {
            return null;
        }

        return this.#invokeImplementation(declaration, this.#moduleRegistry.getImplementation(declaration), target.conforms, target.copyStructures, receiver, args, target.type, node);
    }

    /**
     * The function a member is given for an implicit body: the argument's expression evaluated against the one value the member calls it with, which is its implicit parameter, with the names and the object root of the place it is written,
     * the value checked against the contract's argument type and the result against its result type. It is called while the member's invocation lasts, which closes it, and fails once that is over.
     */
    #implicitBodyOf(plan, frame, objectRoot) {
        const { evaluate } = plan;

        return this.#callbackOf({ implicitBody: value => this.#evaluateWithin(frame, objectRoot, () => evaluate(this, value)) }, plan);
    }

    /**
     * The function a member is given for a parameter its contract declares to take one: a call of the closure with the member's arguments, each checked against the contract's parameter types, and its result against the contract's result type.
     * It is called while the member's invocation lasts, which closes it, and fails once that is over.
     */
    #callbackOf(closure, plan) {
        const { name, member, targets, parameterTypes, resultType, pointer } = plan;
        const target = closure.implicitBody !== undefined ? null : targets.length === 1 ? targets[0] : targets.find(candidate => (candidate.reference ?? candidate.function) === (closure.reference ?? closure.function));
        const lifetime = { isOpen: true };
        const callback = (...values) => {
            try {
                if (!lifetime.isOpen) {
                    this.#fail('LEXICA5008', `The function given as '${name}' of '${member}' is called after '${member}' returned, and a member calls the functions it is given only while its own invocation lasts`, pointer);
                }

                if (values.length !== parameterTypes.length) {
                    this.#fail('LEXICA5503', `The function given as '${name}' of '${member}' is called with ${values.length === 1 ? 'one argument' : `${values.length} arguments`}, and its contract declares ${parameterTypes.length}`, pointer);
                }

                values.forEach((value, index) => {
                    if (!this.#conforms(value, parameterTypes[index], `the function given as '${name}' of '${member}'`)) {
                        this.#fail('LEXICA5503', `The function given as '${name}' of '${member}' is called with ${Evaluator.#describe(value)}, and its contract declares ${parameterTypes[index]}`, pointer);
                    }
                });

                const value = target === null ? closure.implicitBody(values[0]) : this.#callClosure(closure, target, values, plan.node);

                if (resultType !== null && !this.#conforms(value, resultType, `the function given as '${name}' of '${member}'`)) {
                    this.#fail('LEXICA5504', `The function given as '${name}' of '${member}' gave ${Evaluator.#describe(value)}, and its contract declares ${resultType}`, pointer);
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

    /** The function, given the lifetime of the callback it calls, so the member's invocation ending ends both. */
    #sharingLifetime(fn, callback) {
        this.#callbackLifetimes.set(fn, this.#callbackLifetimes.get(callback));

        return fn;
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
        const target = hasTarget ? this.#getCompiledFunction(node.target) : null;
        // An item's source is of the kind its established type gives it, a reference where its items are of a reference type, whatever the value itself is.
        const projection = this.#resolvedDefinition.resolutionOf(node);
        const isOfReferences = projection?.kind === 'projection' && this.#moduleRegistry.isReferenceType(projection.itemType.toNonNullable());
        const names = this.#resolvedDefinition.fieldNamesOf(node);
        // A field the entries after it read is in scope for them, by the name the definition gives it.
        const fields = node.fields.map((field, index) => ({
            name: names[index],
            local: field.name,
            isRead: node.fields.slice(index + 1).some(later => Evaluator.#readsLocal(later.value, field.name)),
            evaluate: this.#getCompiledFunction(field.value),
        }));

        return (evaluator, context) => {
            const value = hasTarget ? target(evaluator, context) : context;

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

    /** Whether a value is one the type admits, as `#conforms` answers, with the type's structure found once and each declared structure's fields at its first check. */
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

                if (structure === undefined) {
                    return value => (type.module === null && Evaluator.#isOfBuiltIn(value, name)) ?? false;
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

    /** The node a member's receiver is: a qualified form's first argument, a named indexer's the receiver of the access its name is written in, and any other member's its target. */
    static #receiverNodeOf(node, resolution) {
        if (resolution?.qualified === true) {
            return node.arguments[0];
        }

        return resolution?.isNamedIndexer === true ? node.target.target : node.target;
    }

    #evaluateMember(node, context) {
        // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
        if (node === this.#projectionContext?.node) {
            return this.#projectionContext.value;
        }

        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const receiver = this.#evaluateNode(Evaluator.#receiverNodeOf(node, resolution), context);

        if (receiver === null) {
            return null;
        }

        if (resolution.kind !== 'computedPropertyAccess') {
            return this.#readResolvedMember(resolution, receiver, node, context);
        }

        // A computed property access computes its name once and reads the property it selects, which is recorded for the value's place in the result.
        const name = this.#evaluateNode(node.name, context);

        (this.#selections ??= new Map()).set(node, name);

        return this.#readResolvedMember(resolution.candidates.get(name), receiver, node, context);
    }

    /** Reads the member the resolution names of the receiver: a field of its data, a field of the outermost object, or the declaration's function with the arguments it is given. */
    #readResolvedMember(resolution, receiver, node, context) {
        if (resolution.kind === 'field') {
            return this.#readField(receiver, resolution.name);
        }

        if (resolution.kind === 'objectRootField') {
            return this.#readObjectRootField(receiver, resolution.name);
        }

        const args = this.#evaluateArguments(resolution, context);

        return args === null ? null : this.#invokeMember(resolution.declaration, receiver, args, resolution.type, node);
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

    /** Carries out a declaration's implementation, checking that its result is of the declared type. */
    #invokeMember(declaration, receiver, args, type, node) {
        return this.#invokeImplementation(declaration, this.#moduleRegistry.getImplementation(declaration), value => this.#conforms(value, type, `the answer of '${declaration.name}'`), Evaluator.#compileStructureCopy(type, this.#moduleRegistry), receiver, args, type, node);
    }

    /** Carries out the implementation of a declaration whose implementation, check of its result and copy of the structures it holds are found already, giving it one object it reads by name. */
    #invokeImplementation(declaration, implementation, conforms, copyStructures, receiver, args, type, node) {
        if (implementation === undefined) {
            throw LexicaErrors.module('LEXICA4001', `The module '${this.#moduleRegistry.getOwner(declaration)}' gives '${declaration.name}' no implementation`, this.#locate(this.#pointerOf(node)));
        }

        // A module member is read and called through its namespace, and has no receiver.
        const received = this.#moduleRegistry.hasReceiver(declaration) ? { receiver } : {};
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

        if (!conforms(value)) {
            this.#fail('LEXICA5006', `${this.#subjectOf(declaration, node)} answered ${Evaluator.#describe(value)}, and it declares ${type}`, this.#pointerOf(node));
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

    /** What a message names as carrying a member out. */
    #subjectOf(declaration) {
        return `The member '${declaration.name}'`;
    }

    /**
     * The samples a member's invocation reads, as the host's `beforeInvoke` answers them, or null where one is pending, which makes the member answer null and the evaluation pending.
     * Without the hook, a member that reads maintained values fails, since nothing answers its samples.
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
        const isOfBuiltIn = type.module === null ? Evaluator.#isOfBuiltIn(value, type.name) : undefined;

        if (isOfBuiltIn !== undefined) {
            if (!isOfBuiltIn) {
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

    /** Whether the value is one the type admits. */
    #conforms(value, type, asked) {
        if (value === undefined) {
            return false;
        }

        if (value === null) {
            return type.isNullable;
        }

        if (type.isList) {
            return Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(item => this.#conforms(item, type.itemType, asked));
        }

        switch (type.kind) {
            case 'typeParameter':
                return true;
            case 'object':
                return ObjectUtils.isNonArrayObject(value) && [...type.fieldTypes].every(([name, fieldType]) => this.#conforms(value[name], fieldType, asked));
            default:
                return this.#conformsNamed(value, type, asked);
        }
    }

    #conformsNamed(value, type, asked) {
        const isOfBuiltIn = type.module === null ? Evaluator.#isOfBuiltIn(value, type.name) : undefined;

        if (isOfBuiltIn !== undefined) {
            return isOfBuiltIn;
        }

        if (this.#moduleRegistry.isReferenceType(type)) {
            return this.#moduleRegistry.belongsTo(value, type, asked);
        }

        const structure = this.#moduleRegistry.getStructure(type);

        return structure !== undefined && ObjectUtils.isNonArrayObject(value) && Evaluator.#fieldTypesOf(structure, this.#moduleRegistry).every(([field, fieldType]) => this.#conforms(value[field], fieldType, asked));
    }

    /** Whether the value is of the built-in type the name names, or undefined where the name names a structure a module declares. */
    static #isOfBuiltIn(value, name) {
        switch (name) {
            case 'Number':
                return Number.isFinite(value);
            case 'String':
                return typeof value === 'string';
            case 'Boolean':
                return typeof value === 'boolean';
            default:
                return undefined;
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
     * The node evaluated and detached, the script's expression or a host call's result projection, with the metadata that describes it, built from the identities the copy left, which the evaluator lets go of once it hands them over,
     * so it holds no source between evaluations.
     */
    #evaluateResult(node) {
        this.#sourcesByList = new WeakMap();
        this.#fieldSelectionsByObject = new WeakMap();
        this.#selections = null;

        try {
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

            const sources = this.#sourcesByList.get(value) ?? null;

            this.#copiedIdentities = sources === null && !hasIdentities ? null : { sources, items: itemIdentities };

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
     * object-root fields, the branch or operand a selecting expression selected and the property a computed property access selected; a field read keeps the record its whole has for that field, or its whole's own.
     * An object expression's value records each field, and a projection's each item and the input it came from. The value is undefined where the expression is described for a part read from it, and nothing beyond its record is described then.
     * The context record is the record of the value `it` stands for where the expression stands, the value an object expression follows or the item it projects, or null where there is none.
     */
    #metadataOf(node, value, identities, contextRecord) {
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
                    const called = targets.length === 1 ? targets[0] : targets.find(target => (target.reference ?? target.function) === branches?.get(node));

                    if (called === undefined) {
                        return this.#recordOf(node, null, null);
                    }

                    // A call of a function reference produces its value itself, as the member it invokes does.
                    if (called.reference !== undefined) {
                        return this.#recordOf(node, null, called.reference.updates?.tolerance ?? null);
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
                        const whole = this.#metadataOf(node.target, undefined, identities, contextRecord);

                        return whole.fields?.[candidate ?? resolution.name] ?? Evaluator.#inherited(whole);
                    }

                    return this.#recordOf(node, candidate, resolution?.declaration?.updates?.tolerance ?? null);
                }
                case 'it':
                    return contextRecord ?? this.#recordOf(node, null, null);
                case 'object':
                    return this.#metadataOfObject(node, value, identities, contextRecord);
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
    #metadataOfObject(node, value, identities, contextRecord) {
        // The fields read `it` as the value the expression follows, each item of it where it projects a list, and as the enclosing one where it follows none.
        const followed = node.target === undefined ? null : this.#metadataOf(node.target, undefined, identities, contextRecord);

        if (Array.isArray(value)) {
            const itemContextRecord = followed === null ? contextRecord : Evaluator.#inherited(followed);
            const items = value.map((item, index) => this.#metadataOfFields(node, item, identities?.items?.[index] ?? null, itemContextRecord));
            const sources = identities?.sources ?? null;

            // A list no projection built records no sources at all, so a null source and absent sources stay apart.
            return Object.freeze({ origin: this.#recordOf(node, null, null).origin, tolerance: null, items: Object.freeze(items), ...(sources === null ? {} : { sources }) });
        }

        return value === null ? this.#recordOf(node, null, null) : this.#metadataOfFields(node, value, identities, followed ?? contextRecord);
    }

    /** The record of an object an object expression built, with each field's, by its name in the order written; a field described for a part read from it is described from the selections of the place it is read. */
    #metadataOfFields(node, object, identities, contextRecord) {
        const { fields } = node;
        const records = new Array(fields.length);

        for (let index = 0; index < fields.length; index++) {
            const field = fields[index];

            records[index] = this.#metadataOf(field.value, object === undefined ? undefined : object?.[field.name], object === undefined ? identities : identities?.fields?.[field.name] ?? null, contextRecord);
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

        const record = Object.freeze({ origin: this.#recordOf(node, null, null).origin, tolerance: null, fields: Object.freeze(byName) });

        recent.unshift({ contextRecord, fields: records, record });

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
