/**
 * Evaluator — evaluates a resolved script against its registry for the host that asks, answering detached data: a script's value as it reads now, and for a script that ends in a host call, the call prepared for its host and each value its host supplies projected through it
 */

import { ArrayUtils } from '../common/ArrayUtils.mjs';
import { ObjectUtils } from '../common/ObjectUtils.mjs';
import { Dictionary } from './Dictionary.mjs';
import { Index } from './Index.mjs';
import { NexoErrors } from './NexoError.mjs';
import { Pair } from './Pair.mjs';
import { Range } from './Range.mjs';
import { StructureTypes } from './StructureTypes.mjs';
import { Type } from './Type.mjs';
import { ValueCapture } from './ValueCapture.mjs';
import { ItemPositions } from './vocabulary/ItemPositions.mjs';
import { NexoModule } from './vocabulary/NexoModule.mjs';
import { ListOrdering } from './vocabulary/ListOrdering.mjs';
import { MemberFailure } from './vocabulary/MemberFailure.mjs';
import { Vocabulary } from './vocabulary/Vocabulary.mjs';

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
 * the input each item of a list a projection built came from, a list no projection built having no sources; and, beside them, each item's provenance, the source the earliest projection it descends from recorded for it.
 * A part with no record inherits its parent's origin and tolerance.
 * @typedef {{ origin: object, tolerance: number | null, objectFields?: Record<string, ResultMetadata>, items?: ResultMetadata[], sources?: readonly ProjectionSource[], provenance?: readonly ProjectionSource[] }} ResultMetadata
 */

/**
 * The input a projected item came from, of the kind its established type gives it: a reference value as the host holds it, data as Nexo's own frozen copy, or null.
 * @typedef {{ kind: 'reference', value: unknown } | { kind: 'data', value: unknown } | { kind: 'null' }} ProjectionSource
 */

/**
 * The hooks a host gives an evaluation, each optional.
 * @typedef {object} EvaluationHooks
 * @property {(request: InvocationRequest) => unknown[] | { pending: true } | undefined} [beforeInvoke] Called before a member's implementation is invoked: answers the samples of a member that reads maintained values, that one is pending, or nothing.
 * @property {(request: InvocationRequest, value: unknown) => void} [afterInvoke] Called after an implementation answered a value of its member's result type.
 * @property {(outcome: EvaluationOutcome) => void} [afterEvaluation] Called once, as the evaluation ends.
 */

/**
 * The names one scope declares, as it runs, inside the frame of the scope enclosing it: an application of an object expression, whose locals are evaluated at their first use, a run of a body, whose locals it evaluates in order,
 * a call of a local function, its parameters holding its arguments, or a field the fields after it read, holding its value.
 * @typedef {object} LocalsFrame
 * @property {readonly string[]} names The names the scope declares, never evaluating anything to find them: a body's or an object expression's locals, a call's parameters, or the one name of a binding, an option or a field.
 * @property {{ locals: { name: string, value: object }[] }} [node] An object expression's frame alone: the node whose locals are evaluated at their first use, which a read finds the initializer in. Every other frame holds each
 * name's value from the start, so it has none.
 * @property {unknown} context The implicit parameter the scope runs against, which a local evaluated at its first use is evaluated against.
 * @property {unknown[]} values Each name's value evaluated so far, at the name's place among the names, a call's own arguments as they were given; undefined where an object expression's local is yet to be evaluated.
 * @property {readonly (Map<object, object | string> | null | undefined)[]} selections The selections each name's evaluation made, at the same place, undefined or null where it made none.
 * @property {LocalsFrame | null} enclosing The frame of the scope enclosing this one, or null for the outermost.
 */

/** The selections of a frame whose names' values made none, as a call's parameters and a binding's name. */
const NO_SELECTIONS = Object.freeze([]);

/** The arguments of a call that takes none. */
const NO_ARGUMENTS = Object.freeze({});

/** The kinds of expression whose value is the value of one of the expressions it holds, which it selected as it was evaluated. */
const SELECTING_KINDS = new Set(['conditional', 'coalescing', 'and', 'or']);

/** How many of the records an object expression gave last it keeps for objects whose fields give the same records to share. */
const RECENT_FIELD_RECORDS = 4;

/** The samples of a call that reads none. */
const NO_SAMPLES = Object.freeze([]);

/** What a message's description marks a number no finite number holds with, as a string JSON writes escaped. */
const NON_FINITE_MARKER = '\u0000non-finite\u0000';

/** A marked number as JSON writes it, quoted and escaped, which the description writes as its word. */
const NON_FINITE_WRITTEN = /"\\u0000non-finite\\u0000(-?Infinity|NaN)"/g;

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
    /**
     * The function each node of a resolved definition compiles to, by the definition and then the node, with the registry they were compiled against: built once, it holds what the node's evaluation needs that no evaluation changes, and takes the evaluator, which holds what one does, and the implicit parameter.
     * Beside them, the function each member's arguments compile to, by the member's resolution, for the evaluations that read the member without compiling it.
     * @type {WeakMap<object, { registry: object, functions: Map<object, (evaluator: Evaluator, context: unknown) => unknown>, arguments: Map<object, (evaluator: Evaluator, context: unknown) => object | null> }>}
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

    /** Whether the result's type holds a value of Any, which is data or not as it is evaluated, so each result is checked to be data. */
    #checksResultData;

    #registry;

    /** Captures a value its host supplies as the type its call declares. */
    #valueCapture;

    #resolvedDefinition;
    #parameterBindings;
    #environment;
    #locations;

    /** The source of each item of a list an object expression projected, by the list it produced, for the evaluation in progress. @type {WeakMap<unknown[], readonly ProjectionSource[]>} */
    #sourcesByList = new WeakMap();

    /**
     * The provenance of each item of a list an object expression projected, by the list it produced, for the evaluation in progress: the source the earliest projection the item descends from recorded for it, its own
     * source where the list it projected carries none. @type {WeakMap<unknown[], readonly ProjectionSource[]>}
     */
    #provenanceByList = new WeakMap();

    /**
     * The selections each field of an object made, as `#selections` holds them, by the object and then the field's name: every completed field of an outermost object, which a read through a reference to it reuses as it is built, and
     * each field that made any of another object an object expression built. Each object is built anew by the evaluation that reads it, so a store is made for each evaluation, and for each prepared host call, whose projections
     * share it, since they read the objects its locals built. A store is released with the evaluation, or with its prepared call; one an evaluator kept for good would grow with every evaluation's objects until a collection,
     * and recording in it measured a tenth of the account summary's evaluation.
     * Each object holds a list of each field's name beside its selections, as `#select` records them, a field that made none left out, which reads as one recorded with none.
     * @type {WeakMap<object, unknown[]>}
     */
    #objectFieldSelections = new WeakMap();

    /**
     * The selections made for the value being evaluated at its place in the result, by the node that made each: the branch a conditional or a coalescing selected, as its node, and the name a bracket property access selected; null where none has been made.
     * A result's identities hold them as their `selections`.
     * Each node stands beside its selection in one list, as `#select` records them.
     * @type {unknown[] | null}
     */
    #selections = null;

    /** The frame of the innermost scope that declares names, with the value of each evaluated so far, inside those of the scopes enclosing it; null outside every one. @type {LocalsFrame | null} */
    #localsFrame = null;

    /** The outermost object being built, which `root`, the object root, refers to, filled field by field; null outside every object expression. @type {object | null} */
    #objectRoot = null;

    /** The hooks of the evaluation in progress, or null where it was given none. @type {EvaluationHooks | null} */
    #hooks = null;

    /** Whether a member the evaluation in progress read answered that its sample is pending. */
    #isPending = false;

    /**
     * The host call's node and the value its host supplied, while the call's result projection is evaluated against it.
     * The value is what the implicit parameter stands for, and the call's node answers it; null outside a projection.
     * @type {{ node: object, value: unknown } | null}
     */
    #projectionContext = null;

    /**
     * The deferred access whose member last answered null, which a deferred access it is the receiver of reads, and clears, to tell that null from one an optional access before it met; null where none is to be read.
     * @type {object | null}
     */
    #nullAnswer = null;

    /**
     * @param {import('./vocabulary/NexoRegistry.mjs').NexoRegistry} registry The vocabulary the request was resolved against.
     * @param {import('./ResolvedDefinition.mjs').ResolvedDefinition} resolvedDefinition The resolved definition to read.
     * @param {import('./ParameterBindings.mjs').ParameterBindings} parameterBindings What the request's parameters are bound to.
     * @param {Environment} environment What the host gives the evaluation, passed to every implementation.
     * @param {import('./TextLocations.mjs').TextLocations | null} locations Where in a text each part of the definition came from.
     */
    constructor(registry, resolvedDefinition, parameterBindings, environment, locations) {
        this.#registry = registry;
        this.#valueCapture = new ValueCapture(registry);
        this.#resolvedDefinition = resolvedDefinition;
        this.#parameterBindings = parameterBindings;
        this.#environment = environment;
        this.#locations = locations;

        let compilation = Evaluator.#compilationCache.get(resolvedDefinition);

        if (compilation === undefined || compilation.registry !== registry) {
            const { type } = resolvedDefinition;

            compilation = { registry, functions: new Map(), arguments: new Map(), invocations: new Map(), checksResultData: type !== null && !registry.isData(type) };
            Evaluator.#compilationCache.set(resolvedDefinition, compilation);
        }

        this.#compiledFunctions = compilation.functions;
        this.#compiledArguments = compilation.arguments;
        this.#compiledInvocations = compilation.invocations;
        this.#checksResultData = compilation.checksResultData;
    }

    /**
     * Evaluates the expression once, synchronously, with the hooks given, answering the detached result, the metadata that describes it, and whether a member it read was pending.
     * Without hooks, or without a `beforeInvoke`, a member that reads maintained values fails the evaluation, since nothing answers its samples.
     * @param {EvaluationHooks | null} [hooks] The hooks its host gives the evaluation.
     */
    evaluate(hooks = null) {
        this.#objectFieldSelections = new WeakMap();

        return this.#evaluateForHost(hooks, () => this.#evaluateScript());
    }

    /**
     * Prepares the host call the script ends in for its host: evaluates the locals before it, each body's along the script's terminal position in order, then its receiver and its arguments, once, without hooks, as `evaluate` given none evaluates a script.
     * It answers a prepared call, with its declaration, its receiver, its arguments by parameter name and its definition pointer, as an invocation request names its call, whose `project` projects each value its host supplies where the call declares a result; or a skipped call where the
     * receiver, or an argument whose parameter propagates null, is null, or the call has no declaration yet, its receiver's type unknown, so there is nothing to invoke. Each prepared call keeps the locals it was prepared with, so the prepared
     * calls of one evaluator stay apart.
     * @returns {{ kind: 'prepared', declaration: object, receiver: unknown, args: Record<string, unknown>, pointer: string, isDeferred: false, project?: (value: unknown, hooks?: EvaluationHooks | null) => Evaluation } | { kind: 'skipped', pointer: string }}
     */
    prepareHostCall() {
        const { hostCall } = this.#resolvedDefinition;

        if (hostCall === null) {
            this.#fail('NEXO5014', 'The script gives a value and ends in no host call, so there is nothing to prepare; evaluate it', '/expression');
        }

        const { node, pointer, declaration } = hostCall;
        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const objectFieldSelections = new WeakMap();

        this.#objectFieldSelections = objectFieldSelections;

        const { terminalNode, localsFrame } = this.#evaluateLocalsBefore();
        // A qualified form's receiver is its first argument, and a module member has none, so nothing it lacks skips it.
        const takesReceiver = declaration === null || this.#registry.takesReceiver(declaration);
        const enclosingSelections = this.#selections;
        let receiver;
        let args;

        // The receiver and the arguments are evaluated within the locals' frame, and no result records the selections they make.
        try {
            ({ receiver, args } = this.#evaluateWithin(localsFrame, this.#objectRoot, evaluator => {
                const evaluatedReceiver = declaration === null ? null : takesReceiver ? evaluator.#evaluateNode(resolution.receiverNode, null) : undefined;

                return { receiver: evaluatedReceiver, args: evaluatedReceiver === null ? null : evaluator.#evaluateArguments(resolution, null) };
            }, null));
        } finally {
            this.#selections = enclosingSelections;
        }

        if (args === null) {
            return Object.freeze({ kind: 'skipped', pointer });
        }

        // Resolution selects every host call, so none is deferred.
        const call = takesReceiver ? { kind: 'prepared', declaration, receiver, args, pointer, isDeferred: false } : { kind: 'prepared', declaration, args, pointer, isDeferred: false };

        // A call whose host supplies nothing has nothing to project.
        if (declaration.result !== undefined) {
            call.project = (value, hooks = null) => {
                this.#objectFieldSelections = objectFieldSelections;

                return this.#evaluateForHost(hooks, () => this.#project(localsFrame, terminalNode, value));
            };
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
                    const frame = { names: node.locals.map(local => local.name), context: null, values: [], selections: [], enclosing: this.#localsFrame };

                    this.#localsFrame = frame;

                    for (const local of node.locals) {
                        this.#selections = null;
                        frame.values.push(this.#getCompiledFunction(local.value)(this, null));
                        frame.selections.push(this.#selections);
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
        const fail = (path, part, partType, reason) => {
            if (reason === 'cycle') {
                this.#fail('NEXO5015', `The host call '${NexoModule.writtenNameOf(declaration)}' supplied a value that reaches itself${path === '' ? '' : ` at '${path}'`}, which data never does`, pointer);
            }

            const supplied = path === '' ? Evaluator.#describe(part) : part === undefined ? `a value without '${path}'` : `a value whose '${path}' is ${Evaluator.#describe(part)}`;

            this.#fail('NEXO5015', `The host call '${NexoModule.writtenNameOf(declaration)}' supplied ${supplied}, and ${path === '' ? 'it declares' : `'${path}' is declared`} ${partType}`, pointer);
        };

        const captured = this.#valueCapture.capture(value, resultType, fail);
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
     * Evaluates once for the host, as `evaluate` and a prepared call's `project` each ask: holds the hooks for the invocations the evaluation reaches and clears the pending mark, answers what the evaluation produced, whether
     * a member it read was pending and the metadata, described when it is first read, and calls its `afterEvaluation` hook once as it ends: a failure of that hook after a failure is recorded on the failure as its `suppressed`,
     * which stays the one thrown, and after a success fails the evaluation itself.
     */
    #evaluateForHost(hooks, produce) {
        this.#hooks = hooks;
        this.#isPending = false;
        let outcome = null;

        // The outcome is made only where an `afterEvaluation` hook is told it, and the metadata only where it is read.
        const isTold = hooks?.afterEvaluation !== undefined;

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
            this.#hooks = null;

            if (isTold) {
                try {
                    hooks.afterEvaluation(Object.freeze(outcome));
                } catch (cleanupError) {
                    if (outcome.kind !== 'failed') {
                        // A failure as the evaluation ends fails it, as a hook's failure does: one Nexo raised as it is, and anything else the hook threw, a NexoError it built among them, as the cause of Nexo's own.
                        // The finally block's throw replaces the completed result.
                        if (NexoErrors.isRaisedByNexo(cleanupError)) {
                            throw cleanupError;
                        }

                        this.#fail('NEXO5009', `The host failed after the evaluation: ${Evaluator.#messageOf(cleanupError)}`, '/expression', { cause: cleanupError });
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
            this.#fail('NEXO5023', `The script ends in the host call '${hostCall.name}', which its host invokes, so it is never evaluated; prepare it`, hostCall.pointer);
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
            case 'scriptParameter':
                return evaluator => evaluator.#parameterBindings.readValue(node.name);
            case 'root':
                return evaluator => evaluator.#objectRoot;
            case 'it':
                return (evaluator, context) => context;
            case 'local':
                return evaluator => evaluator.#evaluateLocal(node);
            case 'memberAccess':
            case 'indexerAccess':
                return this.#compileMember(node);
            case 'equality': {
                const left = this.#getCompiledFunction(node.left);
                const right = this.#getCompiledFunction(node.right);

                if (this.#resolvedDefinition.resolutionOf(node)?.isChecked === true) {
                    return (evaluator, context) => {
                        const leftValue = left(evaluator, context);
                        const rightValue = right(evaluator, context);

                        evaluator.#requireComparable(node, leftValue, rightValue);

                        return leftValue === rightValue;
                    };
                }

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
                    const bindingNames = [node.binding.name];

                    // The value is evaluated once; where it is truthy, the consequent runs in a frame holding it by the name it is bound to, which a function made within it keeps as it keeps every frame around it, and the branch
                    // taken is recorded for the value's place in the result.
                    return (evaluator, context) => {
                        const value = evaluateBindingValue(evaluator, context);
                        const isTruthy = Evaluator.#isTruthy(value);

                        evaluator.#selections = Evaluator.#select(evaluator.#selections, node, isTruthy ? node.consequent : node.alternative);

                        if (!isTruthy) {
                            return alternative(evaluator, context);
                        }

                        const enclosingLocalsFrame = evaluator.#localsFrame;
                        const { name } = node.binding;

                        evaluator.#localsFrame = { names: bindingNames, context, values: [value], selections: NO_SELECTIONS, enclosing: enclosingLocalsFrame };

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

                    evaluator.#selections = Evaluator.#select(evaluator.#selections, node, isTrue ? node.consequent : node.alternative);

                    return (isTrue ? consequent : alternative)(evaluator, context);
                };
            }
            case 'optionalChain':
                // An access that meets null answers null, and so does everything after it in its chain, which is evaluated no further.
                return this.#getCompiledFunction(node.chain);
            case 'coalescing': {
                const value = this.#getCompiledFunction(node.value);
                const fallback = this.#getCompiledFunction(node.fallback);

                return (evaluator, context) => {
                    const answer = value(evaluator, context);

                    evaluator.#selections = Evaluator.#select(evaluator.#selections, node, answer === null ? node.fallback : node.value);

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
                            evaluator.#selections = Evaluator.#select(evaluator.#selections, node, node.operands[index]);

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
                // A function evaluates to a reference to a script function, which holds its captured scope: all three of the locals' frame, the implicit parameter and the object root where it is declared, which each call evaluates its body in.
                return (evaluator, context) => ({ function: node, capturedFrame: evaluator.#localsFrame, context, objectRoot: evaluator.#objectRoot });
            case 'call': {
                // A call of a member is compiled as any member is; a call of the function a name holds reads the local its callee names.
                if (node.callee.kind !== 'local') {
                    return this.#compileMember(node);
                }

                const resolution = this.#resolvedDefinition.resolutionOf(node);

                // A call of one a reference to a module's function alone is its qualified form's call, and the reference it is reads nothing; a receiver of unknown type selects no declaration, as the qualified form's selects none.
                if (resolution.functions === undefined) {
                    return resolution.candidates !== undefined ? this.#compileOnUnknownType(resolution) : this.#compileInvocation(node, resolution);
                }

                const functions = this.#compileFunctions(resolution.functions);
                const evaluateArguments = node.arguments.map(argument => this.#getCompiledFunction(argument));

                // The callee is evaluated once, and then the arguments, once each, left to right, in the caller's scope, and the body of the function it is in its captured scope, so no local of the caller's is visible in it;
                // where it may be one of several, the one it is is recorded for the value's place in the result. The receiver argument of a reference to a module's function is evaluated first, and a null one answers null before the others are.
                return (evaluator, context) => {
                    const callee = evaluator.#evaluateLocal(resolution.callee);
                    const functionKey = Evaluator.#getFunctionKey(callee);

                    if (functions.size > 1) {
                        evaluator.#selections = Evaluator.#select(evaluator.#selections, node, functionKey);
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
                const localNames = locals.map(local => local.name);
                const result = this.#getCompiledFunction(node.result);

                // Each local is evaluated once, in order, whenever the body runs, an unused one included, each seeing those before it, and then the result, all against the body's implicit parameter.
                return (evaluator, context) => {
                    const frame = { names: localNames, context, values: [], selections: [], enclosing: evaluator.#localsFrame };
                    const enclosingSelections = evaluator.#selections;

                    evaluator.#localsFrame = frame;

                    try {
                        for (const local of locals) {
                            evaluator.#selections = null;

                            frame.values.push(local.evaluate(evaluator, context));
                            frame.selections.push(evaluator.#selections);
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
                            evaluator.#fail('NEXO5500', `An interpolation inserts a string or a number, and is given ${Evaluator.#describe(value)}`, evaluator.#pointerOf(part.expression));
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
                            evaluator.#fail('NEXO5501', `'${node.operators[index]}' compares numbers, and is given ${Evaluator.#describe(typeof left !== 'number' ? left : right)}`, evaluator.#pointerOf(node));
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
            case 'arithmeticNegation': {
                const operand = this.#getCompiledFunction(node.operand);

                return (evaluator, context) => {
                    const value = operand(evaluator, context);

                    return evaluator.#arithmeticResult(node, -value, value, 0);
                };
            }
            case 'fromEndIndex': {
                const offset = this.#getCompiledFunction(node.offset);

                return (evaluator, context) => new Index(evaluator.#requireOffset(node, offset(evaluator, context), false));
            }
            case 'range': {
                // Its start is evaluated before its end, each where the range holds it.
                const [start, end] = ['start', 'end'].map(boundary => (node[boundary] === undefined ? null : this.#getCompiledFunction(node[boundary])));

                return (evaluator, context) => {
                    const startValue = start === null ? null : evaluator.#requireOffset(node, start(evaluator, context), true);
                    const endValue = end === null ? null : evaluator.#requireOffset(node, end(evaluator, context), true);

                    return new Range(startValue, endValue);
                };
            }
            case 'cast':
                return this.#compileCast(node, false);
            case 'conversion':
                return this.#compileConversion(node, false);
            case 'try':
                return node.operand.kind === 'cast' ? this.#compileCast(node.operand, true) : this.#compileConversion(node.operand, true);
            case 'object':
                return this.#compileObject(node);
            case 'list': {
                // A list's items are evaluated once each, left to right, into a frozen list.
                const items = node.items.map(item => this.#getCompiledFunction(item));

                return (evaluator, context) => Object.freeze(items.map(item => item(evaluator, context)));
            }
            case 'dictionary': {
                // A dictionary's values are evaluated once each, left to right, in the order its entries are written, which validation found of distinct keys.
                const entries = node.entries.map(entry => ({ key: entry.key, value: this.#getCompiledFunction(entry.value) }));

                return (evaluator, context) => new Dictionary(entries.map(({ key, value }) => [key, value(evaluator, context)]));
            }
        }
    }

    /**
     * A cast, with its operand evaluated once: its operand itself where it belongs to the type, by the type's membership and its supertypes', and null where it is null, its cast operator, where one casts across
     * hierarchies, called first where it has an implementation, which answers its operand or rejects it. An operand that doesn't belong, and one the operator rejects, fails the evaluation of a cast, naming the type its
     * operand is of, which is never asked again, or the operator's reason, and an attempted one answers null instead; an operator failing otherwise is a fault, which an attempt does not catch.
     */
    #compileCast(node, isAttempted) {
        const evaluateOperand = this.#getCompiledFunction(node.operand);
        const { type: targetType, sourceType, declaration } = this.#resolvedDefinition.resolutionOf(node);
        const asked = `the cast to ${targetType}`;
        // A value of a type above the cast's is one that isn't of the cast's type, and a value of the cast's own type, or of one beneath it, is one its supertypes refuse.
        const what = this.#registry.typeChecker.isAssignable(targetType, sourceType) && !this.#registry.typeChecker.isAssignable(sourceType, targetType) ? `${Evaluator.#getNameWithArticle(sourceType)} that isn't ${Evaluator.#getNameWithArticle(targetType)}` : Evaluator.#getNameWithArticle(sourceType);
        const implementation = declaration === null ? undefined : this.#registry.getImplementation(declaration);
        const name = declaration === null ? null : this.#registry.formatOperator(declaration);

        return (evaluator, context) => {
            const value = evaluateOperand(evaluator, context);

            if (value === null) {
                return null;
            }

            const outcome = implementation === undefined ? { isAccepted: true, value } : Evaluator.#invokeOperator(evaluator, implementation, value, node, `The cast operator ${name}`, { failure: 'NEXO5004', rejection: 'NEXO5004' });

            if (outcome.isAccepted && evaluator.#registry.belongsTo(outcome.value, targetType, asked)) {
                return outcome.value;
            }

            if (isAttempted) {
                return null;
            }

            return evaluator.#fail('NEXO5001', `The cast to ${targetType} rejected its value: ${outcome.isAccepted ? `it is ${what}` : outcome.reason}`, evaluator.#pointerOf(node));
        };
    }

    /** The type's name with its indefinite article, as a message writes it: `a Light`, `an Outlet`. */
    static #getNameWithArticle(type) {
        const name = String(type);

        return /^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`;
    }

    /**
     * A conversion, with its operand evaluated once and its conversion carried out once. Null converts to null, and a value already of the type to itself, without a conversion;
     * a conversion that rejects its value fails the evaluation, and an attempted one answers null instead. A fault fails the evaluation of either, as a failure of its operand does.
     */
    #compileConversion(node, isAttempted) {
        const evaluateOperand = this.#getCompiledFunction(node.operand);
        const { declaration, type } = this.#resolvedDefinition.resolutionOf(node);

        if (declaration === null) {
            return evaluateOperand;
        }

        const name = this.#registry.formatOperator(declaration);
        const attempt = Evaluator.#compileConversionAttempt(declaration, type, this.#registry);

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

                evaluator.#fail('NEXO5016', `The conversion from ${name} rejected its value: ${outcome.reason}`, evaluator.#pointerOf(node));
            }

            return outcome.value;
        };
    }

    /**
     * The conversion of a value that is not null, attempted or not: its converted value where it accepts the value, or the reason it rejected it with.
     * A rejection is the signal `reject` throws for this attempt alone; any other exception, a reason that is no string, a rejection the conversion caught and answered past, and a value not of the type are faults, which fail the evaluation, attempted or not.
     */
    static #compileConversionAttempt(declaration, type, registry) {
        const name = registry.formatOperator(declaration);
        const convert = registry.getImplementation(declaration);
        const conforms = Evaluator.#compileTypeCheck(type, registry, `the conversion from ${name}`);
        const copyStructure = Evaluator.#compileStructureCopy(type, registry);

        return (evaluator, value, node) => {
            if (convert === undefined) {
                evaluator.#fail('NEXO4001', `The module '${registry.getDeclaringModuleName(declaration)}' gives the conversion from ${name} no implementation`, evaluator.#pointerOf(node));
            }

            const outcome = Evaluator.#invokeOperator(evaluator, convert, value, node, `The conversion from ${name}`, { failure: 'NEXO5003', rejection: 'NEXO5018' });

            if (!outcome.isAccepted) {
                return outcome;
            }

            if (!conforms(outcome.value)) {
                evaluator.#fail('NEXO5019', `The conversion from ${name} answered ${Evaluator.#describe(outcome.value)}, and it converts to ${type}`, evaluator.#pointerOf(node));
            }

            return { isAccepted: true, value: copyStructure === null ? outcome.value : copyStructure(outcome.value) };
        };
    }

    /**
     * An operator's implementation called with a value, never null, and `reject`: what it answers where it accepts the value, or the reason it rejected it with. A rejection is the signal `reject` throws for this call
     * alone; any other exception, the codes' `failure`, and a reason that is no string or a rejection the operator caught and answered past, their `rejection`, are faults, which fail the evaluation, attempted or not.
     * @param {string} subject How a message names the operator, as `The conversion from String to Number`.
     * @param {{ failure: string, rejection: string }} codes The codes of the operator's faults.
     */
    static #invokeOperator(evaluator, implementation, value, node, subject, codes) {
        const rejection = { isRejected: false, reason: null };
        const reject = reason => {
            rejection.isRejected = true;
            rejection.reason = reason;

            throw rejection;
        };
        let answered;

        try {
            answered = implementation({ value, reject });
        } catch (error) {
            // A failure Nexo raised keeps its own code and place; anything else the operator threw but its rejection, a NexoError it built among them, is the cause of Nexo's own, exactly as thrown.
            if (NexoErrors.isRaisedByNexo(error)) {
                throw error;
            }

            if (error !== rejection) {
                evaluator.#fail(codes.failure, `${subject} failed: ${Evaluator.#messageOf(error)}`, evaluator.#pointerOf(node), { cause: error });
            }

            if (typeof rejection.reason !== 'string') {
                evaluator.#fail(codes.rejection, `${subject} rejected its value with a reason that is no string`, evaluator.#pointerOf(node));
            }

            return { isAccepted: false, reason: rejection.reason };
        }

        if (rejection.isRejected) {
            evaluator.#fail(codes.rejection, `${subject} rejected its value and then answered one`, evaluator.#pointerOf(node));
        }

        return { isAccepted: true, value: answered };
    }

    /**
     * A property access, a call or an indexer, with its resolution, its function, its arguments and the check of its result made once.
     * A computed property access, and a member of a receiver of unknown type, which answers null without reading anything, are evaluated as the node itself says.
     */
    #compileMember(node) {
        const resolution = this.#resolvedDefinition.resolutionOf(node);

        // A reference to a module's function is the same for every read of it, and reads nothing.
        if (resolution?.kind === 'functionReference') {
            const reference = Evaluator.#getModuleFunctionReference(resolution.declaration);

            return () => reference;
        }

        if (resolution?.kind === 'boundFunctionReference') {
            return this.#compileBoundFunctionReference(node, resolution);
        }

        if (resolution?.kind === 'deferred') {
            return this.#compileDeferredAccess(node, resolution);
        }

        if (resolution?.kind === 'invocation' && resolution.candidates !== undefined) {
            return this.#compileOnUnknownType(resolution);
        }

        if (resolution === undefined || resolution.kind === 'computedPropertyAccess') {
            return (evaluator, context) => evaluator.#evaluateMember(node, context);
        }

        if (resolution.kind === 'invocation') {
            return this.#compileInvocation(node, resolution);
        }

        const evaluateReceiver = this.#getCompiledFunction(node.receiver);

        if (resolution.kind === 'objectRootField') {
            const { name } = resolution;

            return (evaluator, context) => evaluator.#readStoredValue(evaluateReceiver(evaluator, context), name);
        }

        const { name } = resolution;

        // A stored value, an object field or a property of a structured type's data, read alike, which a projection's host call never is.
        return (evaluator, context) => {
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            return evaluator.#readStoredValue(evaluateReceiver(evaluator, context), name);
        };
    }

    /**
     * An invocation of a member's declaration, with its function, its arguments and the check of its result made once: its receiver evaluated first, the node its resolution records, the access's receiver, the receiver of the access a named
     * indexer's name is written in, a qualified call's first argument, or the receiver a reference bound to it captured, which the local a call's callee names holds, a null one answering null before its own arguments are
     * evaluated, and a module member's none; then its arguments, null where one makes the call answer null.
     */
    #compileInvocation(node, resolution) {
        const { type: resultType, declaration, receiverNode } = resolution;
        const checksReceiver = resolution.checksReceiver === true;
        const evaluateNode = receiverNode === undefined ? null : this.#getCompiledFunction(receiverNode);
        const evaluateReceiver = resolution.readsBoundReceiver === true ? (evaluator, context) => evaluateNode(evaluator, context).receiver : evaluateNode;
        // A local that may hold several functions of one contract invokes the one it holds, each with its own result type, the arguments the contract read named by that function's own parameters.
        const alternatives = resolution.alternatives === undefined ? null : new Map(resolution.alternatives.map(alternative => [alternative.declaration, { invocation: this.#getCompiledInvocation(alternative.declaration, alternative.type), parameterNames: alternative.parameterNames }]));
        const evaluateCallee = alternatives === null ? null : this.#getCompiledFunction(node.callee);
        const parameterNames = declaration.parameters?.map(parameter => parameter.name) ?? [];
        const invocation = this.#getCompiledInvocation(declaration, resultType, alternatives === null && this.#reliesOnAnswer(declaration, resultType));
        const evaluateArguments = this.#compileArguments(resolution);

        return (evaluator, context) => {
            // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
            if (evaluator.#projectionContext !== null && node === evaluator.#projectionContext.node) {
                return evaluator.#projectionContext.value;
            }

            const receiver = evaluateReceiver === null ? undefined : evaluateReceiver(evaluator, context);

            if (receiver === null) {
                return checksReceiver ? evaluator.#answerNullReceiver(node, resolution) : null;
            }

            if (checksReceiver) {
                evaluator.#requireReceiverOf(node, declaration, receiver);
            }

            const args = evaluateArguments(evaluator, context);
            const lifetimes = evaluator.#givenLifetimes;

            if (args === null) {
                return null;
            }

            if (alternatives === null) {
                return evaluator.#invokeImplementation(invocation, receiver, args, node, false, lifetimes);
            }

            const callee = evaluateCallee(evaluator, context);
            const chosen = alternatives.get(callee.reference);

            evaluator.#selections = Evaluator.#select(evaluator.#selections, node, callee.reference);

            return evaluator.#invokeImplementation(chosen.invocation, receiver, Evaluator.#renameArguments(args, parameterNames, chosen.parameterNames), node, false, lifetimes);
        };
    }

    /** The arguments, named by one declaration's parameters, named by another's of the same positions, as functions of one contract name them apart. */
    static #renameArguments(args, names, ownNames) {
        if (names.every((name, index) => name === ownNames[index])) {
            return args;
        }

        return Object.fromEntries(names.filter(name => Object.hasOwn(args, name)).map(name => [ownNames[names.indexOf(name)], args[name]]));
    }

    /**
     * The invocation of the declaration whose implementation answers a value of the result type, as the call it serves resolved it: its implementation, whether it takes a receiver, the capture, the check and the copy of
     * its answer, and whether the call relies on its answer as the language's and of its type, made once for each declaration, result type and reliance and shared by every evaluator of the resolution, so one generic
     * declaration answering two types has two. The result type is the declaration's own, its type parameters bound for the call, which a null the call propagates or the types of other functions it may call never make wider.
     */
    #getCompiledInvocation(declaration, resultType, reliesOnAnswer = false) {
        let invocations = this.#compiledInvocations.get(declaration);

        if (invocations === undefined) {
            invocations = [];
            this.#compiledInvocations.set(declaration, invocations);
        }

        let invocation = invocations.find(candidate => candidate.resultType.equals(resultType) && candidate.reliesOnAnswer === reliesOnAnswer);

        if (invocation === undefined) {
            const takesReceiver = this.#registry.takesReceiver(declaration);

            invocation = Object.freeze({
                declaration,
                implementation: this.#registry.getImplementation(declaration),
                takesReceiver,
                // What the protocol does with the member's answer, and whether it reads samples, decided once for the declaration rather than at each invocation.
                answersReceiverItems: takesReceiver && Vocabulary.answersReceiverItems(declaration),
                projectsItems: takesReceiver && Vocabulary.projectsItems(declaration),
                readsMaintained: declaration.updates?.reads === 'maintained',
                resultType,
                reliesOnAnswer,
                // An answer relied on holds the language's collections already, which is all a capture makes.
                captureCollections: reliesOnAnswer ? null : Evaluator.#compileCollectionCapture(resultType),
                isOfResultType: Evaluator.#compileTypeCheck(resultType, this.#registry, `the answer of '${NexoModule.writtenNameOf(declaration)}'`),
                copyStructure: Evaluator.#compileStructureCopy(resultType, this.#registry),
            });
            invocations.push(invocation);
        }

        return invocation;
    }

    /**
     * Whether the answer of a call needs neither a capture nor a check: the member is one of Nexo's own, which resolution selected, and its result type may hold no reference, nor a value of Any. Its implementation
     * answers the language's own values, built of its receiver's items, its arguments, its functions' results and the numbers it computes, each of the type resolution established for it, so the answer is of the type its
     * declaration gives the call; data shared with a host stays as it was checked. A reference's membership is its type's to answer, so an answer that may hold one is checked again, and so is any other member's.
     */
    #reliesOnAnswer(declaration, resultType) {
        return this.#registry.getDeclaringModuleName(declaration) === Vocabulary.moduleName && !this.#registry.mayHoldReference(resultType);
    }

    /**
     * Whether the argument a function is called with needs no check of its own: the member is one of Nexo's own that calls the functions it is given with its receiver's items alone, the function takes one argument,
     * the receiver's type resolution established holds items of that argument's type, and that type may hold no reference. Each item was checked as that type where the receiver was made, or is of it as an answer of Nexo's own is,
     * since data shared with a host stays as it was.
     */
    #givesCheckedItems({ declaration, receiverType }, parameterTypes) {
        if (receiverType === undefined || parameterTypes.length !== 1 || !Vocabulary.givesReceiverItems(declaration)) {
            return false;
        }

        const itemType = receiverType.toNonNullable().itemContextType;

        return itemType !== null && itemType.equals(parameterTypes[0]) && !this.#registry.mayHoldReference(itemType);
    }

    /**
     * A function an extension access reads without a call: its receiver evaluated once, as the reference is created, and a reference to the function bound to it, which a call gives the receiver it captured before its own
     * arguments. A null receiver, which only an optional access admits, answers null, and a value of Any is checked against the extension's target first.
     */
    #compileBoundFunctionReference(node, resolution) {
        const { declaration, receiverNode } = resolution;
        const evaluateReceiver = this.#getCompiledFunction(receiverNode);
        const checksReceiver = resolution.checksReceiver === true;

        return (evaluator, context) => {
            const receiver = evaluateReceiver(evaluator, context);

            if (receiver === null) {
                return checksReceiver ? evaluator.#answerNullReceiver(node, resolution) : null;
            }

            if (checksReceiver) {
                evaluator.#requireReceiverOf(node, declaration, receiver);
            }

            return Object.freeze({ reference: declaration, isBound: true, receiver });
        };
    }

    /**
     * What an extension access on a value of Any answers where that value is null: null where the access is optional or an optional access before it in its chain met null, which ends the chain, and otherwise the
     * failure of a direct access on null (NEXO5022), as a deferred access fails.
     */
    #answerNullReceiver(node, { receiverNode, isOptional }) {
        const isAnswered = this.#nullAnswer === receiverNode;

        this.#nullAnswer = null;

        if (isOptional === true || Evaluator.#accessOf(node).optional === true || (Evaluator.#followsOptionalAccess(receiverNode) && !isAnswered)) {
            return null;
        }

        this.#fail('NEXO5022', `'${Evaluator.#writtenNameOf(node)}' is read through an extension on a value of Any, and its receiver is null: write '?:' before the extension to read it where its receiver is not null`, this.#pointerOf(node));
    }

    /** Checks a value of Any an extension access is given against the extension's target, before anything is invoked, a value outside it, or of no type the vocabulary knows, failing the access (NEXO5012). */
    #requireReceiverOf(node, declaration, receiver) {
        const written = Evaluator.#writtenNameOf(node);
        const actualType = this.#getActualType(receiver, `the access '${written}'`, this.#failSelectionOf(node));

        if (!this.#registry.typeChecker.matchesReceiver(declaration, actualType)) {
            this.#fail('NEXO5012', `'${written}' is read through an extension of ${this.#registry.getReceiverTypes(declaration).join(', ')}, and its receiver is ${actualType}, which does not satisfy it`, this.#pointerOf(node));
        }
    }

    /**
     * A member of a receiver of unknown type, the type null or a never, which selects no declaration among its candidates: its receiver is evaluated once and is null, so it answers null, invoking nothing and evaluating
     * none of its arguments, as an access of null does; a never is never evaluated, since no value has that type.
     */
    #compileOnUnknownType(resolution) {
        const receiver = this.#getCompiledFunction(resolution.receiverNode);

        return (evaluator, context) => {
            receiver(evaluator, context);

            return null;
        };
    }

    /**
     * An access on a value of Any, its member selected as it is evaluated, by the actual type of its receiver's value, as deferred member selection sets out. A null receiver answers null where the access is optional, or where an
     * optional access before it in its chain met null, which ends the chain, and fails the access otherwise (NEXO5022), its arguments never evaluated. A plain object's own object field is read by its name; any other access
     * is selected among the candidates its resolution kept, and is read or invoked as its selection says, its arguments evaluated after its receiver in the order they are written.
     */
    #compileDeferredAccess(node, resolution) {
        const { receiverNode } = resolution;
        const evaluateReceiver = this.#getCompiledFunction(receiverNode);
        const evaluateArguments = resolution.arguments.map(argument => this.#getCompiledFunction(argument.node));
        const followsOptionalAccess = Evaluator.#followsOptionalAccess(receiverNode);
        const written = Evaluator.#writtenNameOf(node);
        // The selection made for each actual type the access meets, by the type's qualified text. It is kept with the compilation, which its resolved definition and its registry hold, and released with the resolved
        // definition. It stays valid while that resolution is current: its candidates were fixed at resolution and no registration changes a type's hierarchy, so only a module declaring a `typeOf`, which changes
        // the actual types values are found of, could change a selection, and such a registration makes the resolution stale, an access on a value of Any always recognizing. It saves selecting, binding the type parameters the receiver writes and compiling the parameters' checks at every evaluation.
        const selections = new Map();

        return (evaluator, context) => {
            const receiver = evaluateReceiver(evaluator, context);

            if (receiver === null) {
                // A deferred access that answered null itself met no null before it, so no optional access ended its chain.
                const isAnswered = evaluator.#nullAnswer === receiverNode;

                evaluator.#nullAnswer = null;

                if (resolution.isOptional === true || Evaluator.#accessOf(node).optional === true || (followsOptionalAccess && !isAnswered)) {
                    return null;
                }

                evaluator.#fail('NEXO5022', `'${written}' is read on a value of Any, and its receiver is null: write '${resolution.readsExtensionMembers === true ? '?:' : '?.'}' before it to read it where its receiver is not null`, evaluator.#pointerOf(node));
            }

            const receiverType = evaluator.#getActualType(receiver, `the access '${written}'`, evaluator.#failSelectionOf(node));
            // A plain object's object fields are its data, found on each object, since objects of one type need not hold the same fields; an extension access reads extension members alone.
            const isObjectField = node.kind === 'memberAccess' && resolution.readsExtensionMembers !== true && receiverType.kind === 'object' && Object.hasOwn(receiver, node.name);
            const value = isObjectField ? evaluator.#readStoredValue(receiver, node.name) : evaluator.#evaluateDeferredSelection(node, resolution.candidates, receiver, receiverType, selections, evaluateArguments, context);

            if (value === null) {
                evaluator.#nullAnswer = node;
            }

            return value;
        };
    }

    /**
     * Carries out a deferred access on a receiver of its actual type, as the selection made at the access's first meeting of that type says, the selection kept for every later one: a property of a structured type's data is
     * read from the data, and any other member is invoked with the values its arguments give, its request marked deferred. A selection that fails, fails each evaluation that meets it.
     */
    #evaluateDeferredSelection(node, candidates, receiver, receiverType, selections, evaluateArguments, context) {
        const key = receiverType.toString(true);
        let selection = selections.get(key);

        if (selection === undefined) {
            selection = this.#selectDeferred(node, candidates, receiverType);
            selections.set(key, selection);
        }

        if (selection.kind === 'failure') {
            this.#fail(selection.code, selection.message, this.#pointerOf(node));
        }

        if (selection.kind === 'dataProperty') {
            return this.#readStoredValue(receiver, selection.name);
        }

        const values = evaluateArguments.map(evaluate => evaluate(this, context));
        // An indexer of several signatures takes the one its key's value is of, as resolution takes the one its key's type is, and otherwise its first, which refuses the key.
        const chosen = selection.kind === 'signatures' ? (selection.selections.find(signature => signature.parameters[0]?.isOfType?.(values[0]) === true) ?? selection.selections[0]) : selection;
        const args = this.#bindDeferredArguments(node, chosen, receiverType, values);

        if (args === null) {
            return null;
        }

        return this.#invokeImplementation(args.invocation, receiver, args.values, node, true);
    }

    /**
     * The selection a deferred access makes on a receiver of the type, through the selector, as an access its receiver's type selects during resolution: a property of a structured type's data, by its name; a member to
     * invoke, with the type arguments its receiver binds, each parameter's declared type, the check of each a type parameter of its own leaves unwritten, and its invocation where it declares none; or the failure of a type
     * that has no applicable candidate, or several none is more specific than, NEXO5012, and of a host call, NEXO5013, which resolution alone selects.
     */
    #selectDeferred(node, candidates, receiverType) {
        const written = Evaluator.#writtenNameOf(node);
        const outcome = this.#registry.memberSelector.select(candidates, receiverType);

        if (outcome.kind === 'ambiguous') {
            const modules = outcome.declarations.map(declaration => `'${this.#registry.getDeclaringModuleName(declaration)}'`);

            return { kind: 'failure', code: 'NEXO5012', message: `'${written}' on ${receiverType}, the type its receiver's value is of, is declared by ${modules.join(' and ')}, none of them its owner and none more specific than the others` };
        }

        if (outcome.kind !== 'selected') {
            return { kind: 'failure', code: 'NEXO5012', message: `'${written}' is not available on ${receiverType}, the type its receiver's value is of` };
        }

        const { declaration } = outcome;

        if (NexoModule.isInvokedByHost(declaration)) {
            return {
                kind: 'failure',
                code: 'NEXO5013',
                message: `'${written}' on ${receiverType} is a host call, which its host invokes and resolution alone selects: make its receiver known, as a cast does, or select its extension explicitly`,
            };
        }

        if (this.#registry.isDataProperty(declaration)) {
            return { kind: 'dataProperty', name: declaration.name };
        }

        const signatures = this.#registry.getIndexerSignatures(declaration);

        return signatures.length > 1 ? { kind: 'signatures', selections: signatures.map(signature => this.#prepareDeferredInvocation(signature, receiverType, written)) } : this.#prepareDeferredInvocation(declaration, receiverType, written);
    }

    /** The invocation a deferred access makes of the declaration on a receiver of the type: the type arguments its receiver binds, each parameter's declared type and its check, and its invocation where it declares no type parameters of its own. */
    #prepareDeferredInvocation(declaration, receiverType, written) {
        const typeArguments = this.#registry.typeChecker.inferReceiverTypeArguments(declaration, receiverType) ?? new Map();
        const hasOwnTypeParameters = (declaration.typeParameters ?? []).length > 0;
        const parameters = (declaration.parameters ?? []).map(parameter => {
            const declaredType = this.#registry.getDeclaredType(declaration, parameter.type).resolveTypeParameters(typeArguments);
            const isOfType = hasOwnTypeParameters ? null : Evaluator.#compileTypeCheck(declaredType, this.#registry, `the argument '${parameter.name}' of '${written}'`);

            return { parameter, declaredType, isOfType };
        });
        const resultType = this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(typeArguments);

        return { kind: 'invocation', declaration, written, typeArguments, parameters, invocation: hasOwnTypeParameters ? null : this.#getCompiledInvocation(declaration, resultType) };
    }

    /**
     * The arguments a deferred call gives the member its selection invokes, by parameter name, with the invocation of the result type they bind: the values written in order, or the object fields of the one plain object a
     * member taking options is given, each parameter left out taking its default. It answers null where a null value's parameter propagates null. A value whose parameter it doesn't satisfy fails the call (NEXO5021), and
     * so do too many values, a parameter none supplies that requires one, and a parameter a value never satisfies, a function's, an expression's or a fixed one's (NEXO5012).
     */
    /**
     * A position's offset as an index or a range takes it: a nonnegative safe integer, never rounded, `-0` as `0`, or, for a range's boundary, an index; any other value fails where the index or the range stands
     * (NEXO5032), a value of Any's among them.
     */
    #requireOffset(node, value, allowsIndex) {
        if (allowsIndex && value instanceof Index) {
            return value;
        }

        if (Number.isSafeInteger(value) && value >= 0) {
            return value === 0 ? 0 : value;
        }

        const what = node.kind === 'range' ? "A range's boundary" : "An index's offset";

        this.#fail('NEXO5032', `${what} is a nonnegative whole number${allowsIndex ? ' or an index' : ''}, and this one is ${Evaluator.#describe(value)}`, this.#pointerOf(node));
    }

    #bindDeferredArguments(node, selection, receiverType, values) {
        const { declaration, written, parameters } = selection;
        const pointer = this.#pointerOf(node);
        const on = `'${written}' on ${receiverType}`;
        const supplied = new Map();

        if (declaration.arguments === 'options' && values.length > 0) {
            const [options] = values;

            if (values.length > 1 || !ObjectUtils.isPlainObject(options)) {
                this.#fail('NEXO5012', `${on} takes its arguments as the object fields of one object`, pointer);
            }

            for (const [name, value] of Object.entries(options)) {
                if (!parameters.some(({ parameter }) => parameter.name === name)) {
                    this.#fail('NEXO5012', `${on} has no parameter '${name}'; it takes ${parameters.map(({ parameter }) => parameter.name).join(', ')}`, pointer);
                }

                supplied.set(name, value);
            }
        } else {
            if (values.length > parameters.length) {
                this.#fail('NEXO5012', `${on} takes ${parameters.some(({ parameter }) => !parameter.required) ? 'at most ' : ''}${parameters.length === 1 ? 'one argument' : `${parameters.length} arguments`}, and is given ${values.length}`, pointer);
            }

            values.forEach((value, index) => supplied.set(parameters[index].parameter.name, value));
        }

        const args = {};
        const typeArguments = new Map(selection.typeArguments);

        for (const { parameter, declaredType } of parameters) {
            if (!supplied.has(parameter.name)) {
                if (parameter.required) {
                    this.#fail('NEXO5012', `${on} requires the argument '${parameter.name}'`, pointer);
                }

                args[parameter.name] = parameter.default;
                continue;
            }

            if (parameter.kind === 'expression' || parameter.kind === 'predicate' || parameter.kind === 'function' || parameter.fixed === true) {
                const taken = parameter.fixed === true ? 'a fixed value, which selects its result type' : parameter.kind === 'function' ? 'a function' : `an ${parameter.kind}`;

                this.#fail('NEXO5012', `${on} takes ${taken} as '${parameter.name}', and a call selected as it is evaluated gives values alone`, pointer);
            }

            const value = supplied.get(parameter.name);

            if (value === null && parameter.nulls === 'propagate') {
                return null;
            }

            // A type parameter of the member's own is bound by the values it is given, as resolution binds it by their types.
            if (selection.invocation === null && value !== null) {
                const bound = this.#registry.typeChecker.inferTypeArguments(declaredType, this.#getActualType(value, `the access '${written}'`, this.#failSelectionOf(node)), typeArguments);

                bound?.forEach((type, name) => typeArguments.set(name, type));
            }

            args[parameter.name] = value;
        }

        for (const { parameter, declaredType, isOfType } of parameters) {
            if (!supplied.has(parameter.name)) {
                continue;
            }

            const parameterType = isOfType === null ? declaredType.resolveTypeParameters(typeArguments) : declaredType;
            const isAdmitted = isOfType ?? Evaluator.#compileTypeCheck(parameterType, this.#registry, `the argument '${parameter.name}' of '${written}'`);

            if (!isAdmitted(args[parameter.name])) {
                this.#fail('NEXO5021', `The argument '${parameter.name}' of ${on} is declared ${parameterType}, and is given ${Evaluator.#describe(args[parameter.name])}`, pointer);
            }
        }

        const invocation = selection.invocation ?? this.#getCompiledInvocation(declaration, this.#registry.getDeclaredType(declaration, declaration.result).resolveTypeParameters(typeArguments));

        return { invocation, values: args };
    }

    /**
     * The actual type of a value a deferred access meets, as binding types a value, without copying it: a string, a finite number and a Boolean their scalar type; a reference the type its modules recognize it as, the one
     * beneath every other; a structured value the type whose answer gave it; a list the type its items share, Any where they share none, the empty list's being never; and an object the object type of its fields' types.
     * A value of no type, a function, an instance no module recognizes, a list with a hole and data that reaches itself among them, is given to `fail` with the reason it has none, as is a reference several modules recognize
     * as types none of which is beneath the others.
     * @param {unknown} value
     * @param {string} asked What asked for the value's type, as a message names it.
     * @param {(reason: string) => never} fail
     */
    #getActualType(value, asked, fail, ancestors = new Set()) {
        if (value === null) {
            return Type.null;
        }

        if (value instanceof Index || value instanceof Range) {
            return Type.createNamedType(value instanceof Index ? 'Index' : 'Range');
        }

        if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
            return Type.createPrimitiveType(value);
        }

        if (value === undefined || typeof value !== 'object') {
            fail(`${Evaluator.#describe(value)} has none the vocabulary knows`);
        }

        const recognized = this.#registry.recognize(value, asked);

        if (recognized.length > 0) {
            const { typeChecker } = this.#registry;
            const specific = recognized.find(type => recognized.every(other => typeChecker.isAssignable(type, other)));

            if (specific === undefined) {
                fail(`it is recognized as ${recognized.map(type => type.toString(true)).join(' and ')}, of which none is beneath the others`);
            }

            return specific;
        }

        const structured = StructureTypes.getType(value, this.#registry);

        if (structured !== undefined) {
            return structured;
        }

        if (ancestors.has(value)) {
            fail('it reaches itself, which data never does');
        }

        ancestors.add(value);

        try {
            if (Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1) {
                let itemType = Type.never;

                for (const item of value) {
                    const actual = this.#getActualType(item, asked, fail, ancestors);
                    const isNullable = itemType.isNullable || actual.isNullable;

                    itemType = this.#registry.typeChecker.merge(itemType, actual) ?? (isNullable ? Type.any.toNullable() : Type.any);
                }

                return Type.createListType(itemType);
            }

            // A dictionary of the types its keys and its values share, the empty one's never, and a pair of its parts'; a dictionary is the language's, so its keys share one already.
            if (value instanceof Dictionary) {
                const merged = parts => parts.reduce((shared, part) => this.#registry.typeChecker.merge(shared, this.#getActualType(part, asked, fail, ancestors)) ?? Type.any, Type.never);

                return Type.createDictionaryType(merged(value.keys), merged(value.values));
            }

            if (value instanceof Pair) {
                return Type.createPairType(this.#getActualType(value.key, asked, fail, ancestors), this.#getActualType(value.value, asked, fail, ancestors));
            }

            if (ObjectUtils.isPlainObject(value)) {
                return Type.createObjectType(new Map(Object.entries(value).map(([name, field]) => [name, this.#getActualType(field, asked, fail, ancestors)])));
            }
        } finally {
            ancestors.delete(value);
        }

        return fail(`${Evaluator.#describe(value)} has none the vocabulary knows`);
    }

    /** How a deferred access fails where its receiver's value, or an argument's, has no actual type, which it is selected by (NEXO5012). */
    #failSelectionOf(node) {
        return reason => this.#fail('NEXO5012', `'${Evaluator.#writtenNameOf(node)}' is selected by the types of the values it is given, and ${reason}`, this.#pointerOf(node));
    }

    /** The name a message gives an access, its member's name, a call's its callee's, or `[…]` for an unnamed indexer. */
    static #writtenNameOf(node) {
        return node.kind === 'indexerAccess' && node.name === undefined ? '[…]' : Evaluator.#accessOf(node).name;
    }

    /** The access a node of a member makes: a property access and an indexer are their own, and a call of a member the member access its callee is. */
    static #accessOf(node) {
        return node.kind === 'call' ? node.callee : node;
    }

    /** Whether an access of the chain the node ends, the node among them, is optional, so a null the node answers can be one an optional access met, which ends the chain. */
    static #followsOptionalAccess(node) {
        for (let current = node; current?.kind === 'memberAccess' || current?.kind === 'indexerAccess' || (current?.kind === 'call' && current.callee.kind === 'memberAccess'); current = Evaluator.#accessOf(current).receiver) {
            if (Evaluator.#accessOf(current).optional === true) {
                return true;
            }
        }

        return false;
    }

    /** The reference to each module's function, by its declaration: the same for every evaluation, since it holds nothing an evaluation bound. @type {WeakMap<object, { reference: object }>} */
    static #moduleFunctionReferenceCache = new WeakMap();

    /** The reference to the declaration's function, made at its first request and the same at every later one. */
    static #getModuleFunctionReference(declaration) {
        let reference = Evaluator.#moduleFunctionReferenceCache.get(declaration);

        if (reference === undefined) {
            reference = Object.freeze({ reference: declaration });
            Evaluator.#moduleFunctionReferenceCache.set(declaration, reference);
        }

        return reference;
    }

    /**
     * The arguments a call is given, in the order they are written, each argument's plan made once: its default or fixed value, a callback the member calls, an expression evaluated against its argument or the function a value gives,
     * or a value, null where it makes the call answer null.
     * An options object's written values are its fields: each is in scope after its evaluation for the options after it that read it, holding its value and the selections it made, and one no other object encloses
     * builds the outermost object, which `root` refers to while its options are evaluated, each written value a field of it after its evaluation; a default is none.
     */
    #compileArguments(resolution) {
        if (resolution.arguments.length === 0) {
            return evaluator => {
                evaluator.#givenLifetimes = null;

                return NO_ARGUMENTS;
            };
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

            // A value of Any is checked against its parameter's type as it is evaluated.
            const isOfCheckedType = argument.checkedType === undefined ? null : Evaluator.#compileTypeCheck(argument.checkedType, this.#registry, `the argument '${parameter.name}' of '${NexoModule.writtenNameOf(resolution.declaration)}'`);
            const plan = { name: parameter.name, kind: parameter.kind, evaluate: this.#getCompiledFunction(argument.node), propagatesNull: parameter.nulls === 'propagate', isOption, isReadLater, isField, checkedType: argument.checkedType ?? null, isOfCheckedType, pointer: argument.pointer };

            if (argument.callback === undefined) {
                return plan;
            }

            // The member calls the function it is given with the arguments the callback contract declares, each checked as the contract's types say, the checks compiled once for every call.
            const { functions, parameterTypes, resultType, isBody } = argument.callback;
            const asked = `the function given as '${parameter.name}' of '${NexoModule.writtenNameOf(resolution.declaration)}'`;
            // An argument the member gives from its receiver's items is checked as the receiver's items were, null standing for no check of its own.
            const givesCheckedItems = this.#givesCheckedItems(resolution, parameterTypes);
            const isOfParameterType = parameterTypes.map(parameterType => (givesCheckedItems ? null : Evaluator.#compileTypeCheck(parameterType, this.#registry, asked)));
            const isOfResultType = resultType === null ? null : Evaluator.#compileTypeCheck(resultType, this.#registry, asked);

            return {
                ...plan,
                kind: 'callback',
                propagatesNull: false,
                isBody: isBody === true,
                isPredicate: parameter.kind === 'predicate',
                // A body of each item reads its item as a value that is not null, as resolution types it, so a null item answers null and the body is never evaluated against it, unless its parameter accepts null items.
                skipsNullItem: isBody === true && (parameter.kind === 'expression' || parameter.kind === 'predicate') && parameter.nulls !== 'accept',
                functions: isBody === true ? null : this.#compileFunctions(functions),
                memberName: NexoModule.writtenNameOf(resolution.declaration),
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
            // The lifetime of each function the call gives its member, which the invocation closes, handed to it as the arguments are made.
            let lifetimes = null;
            const enclosingObjectRoot = evaluator.#objectRoot;
            const enclosingLocalsFrame = evaluator.#localsFrame;
            const objectRoot = buildsObjectRoot === true ? {} : null;
            let rootSelections = null;

            if (objectRoot !== null) {
                evaluator.#objectRoot = objectRoot;
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

                        const lifetime = { isOpen: true };

                        (lifetimes ??= []).push(lifetime);
                        args[plan.name] = evaluator.#createCallback(plan, lifetime, argumentValues => (plan.skipsNullItem && argumentValues[0] === null ? null : evaluator.#evaluateWithin(capturedFrame, capturedObjectRoot, evaluate, argumentValues[0])));
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

                        if (plan.isOfCheckedType !== null && !plan.isOfCheckedType(value)) {
                            evaluator.#fail('NEXO5021', `The argument '${plan.name}' of '${NexoModule.writtenNameOf(resolution.declaration)}' is declared ${plan.checkedType}, and is given ${Evaluator.#describe(value)}`, plan.pointer);
                        }

                        // A function reference is evaluated where it is written, once, and goes to the member as a callback it calls, while the expression's own names and fields hold the value itself.
                        argumentValue = value;

                        if (plan.kind === 'callback') {
                            const lifetime = { isOpen: true };

                            (lifetimes ??= []).push(lifetime);
                            args[plan.name] = evaluator.#createCallback(plan, lifetime, argumentValues => evaluator.#callFunction(value, argumentValues, plan.functions, plan.node));
                        } else {
                            args[plan.name] = value;
                        }
                    }

                    // A field of the outermost object is recorded where it made any selection, as it completes, for `root` to read, so the list recorded is added to in place.
                    if (plan.isField) {
                        objectRoot[plan.name] = argumentValue;

                        if (selections !== null) {
                            const isFirst = rootSelections === null;

                            rootSelections = Evaluator.#select(rootSelections, plan.name, selections);

                            if (isFirst) {
                                evaluator.#objectFieldSelections.set(objectRoot, rootSelections);
                            }
                        }
                    }

                    if (plan.isReadLater) {
                        evaluator.#localsFrame = { names: [plan.name], context, values: [argumentValue], selections: [selections], enclosing: evaluator.#localsFrame };
                    }
                }

                return args;
            } finally {
                evaluator.#givenLifetimes = lifetimes;
                evaluator.#objectRoot = enclosingObjectRoot;
                evaluator.#localsFrame = enclosingLocalsFrame;
            }
        };
    }

    /**
     * The functions a call or a callback contract may call, each compiled once for it and found by its function key: a function the script declares, its parameters and the compiled copy of its body resolved for this call;
     * or a reference to a module's function, its argument map and its invocation, of the result type resolved for this call. Each call compiles its own, so one function called at two places evaluates each place's body or specialization.
     * @returns {Map<object, { parameters: string[], evaluateBody: Function } | { argumentMap: object, invocation: object }>}
     */
    #compileFunctions(functions) {
        return new Map(functions.map(entry => [
            Evaluator.#getFunctionKey(entry),
            entry.reference === undefined ? { parameters: entry.parameters, evaluateBody: this.#getCompiledFunction(entry.body) } : { argumentMap: entry.argumentMap, invocation: this.#getCompiledInvocation(entry.reference, entry.resultType) },
        ]));
    }

    /**
     * The key a call finds a function's compiled form by: the declaration a reference to a module's function names, or the node of a function the script declares. Two references to one function share it, whatever each captured, which the callee
     * itself still holds.
     */
    static #getFunctionKey(callee) {
        return callee.reference ?? callee.function;
    }

    /**
     * Calls the callee with its arguments' values, which the caller evaluated, as the call's compiled functions say: a function the script declares, its body evaluated in the callee's captured scope, its locals, implicit parameter and object root,
     * its parameters bound to the values in order; or a reference to a module's function, its declaration invoked as its qualified form is, its receiver the first value or, for one bound to its receiver, the receiver it captured, a null one answering null without invoking the implementation, and its own
     * arguments bound by its argument map, a null one whose parameter propagates null answering null without invoking it, each parameter the map leaves out taking its default. Its failures are named at the node that called it.
     */
    #callFunction(callee, values, functions, node) {
        const compiled = functions.get(Evaluator.#getFunctionKey(callee));
        // A reference bound to its receiver gives the receiver it captured before the values it is called with.
        const argumentValues = callee.isBound === true ? [callee.receiver, ...values] : values;

        if (compiled.invocation === undefined) {
            const { parameters } = compiled;
            const enclosingLocalsFrame = this.#localsFrame;
            const enclosingObjectRoot = this.#objectRoot;

            // The parameters hold the arguments in order, as the list the call was given, which nothing changes.
            this.#localsFrame = { names: parameters, context: callee.context, values: argumentValues, selections: NO_SELECTIONS, enclosing: callee.capturedFrame };
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
     * Creates the function a member is given for a parameter that takes one, open while its lifetime is, which `#invokeImplementation` closes when the member's invocation ends, however it ends: each call checks the member's arguments
     * against the callback contract's parameter types, gives them to the body, which evaluates the argument's expression against the first or calls the function the argument gave, checks the body's result against the contract's
     * result type, and answers it, or its truthiness for a predicate. A call after the invocation fails, while the function the body calls stays callable wherever else it is given or called.
     */
    #createCallback(plan, lifetime, body) {
        const { name, memberName, parameterTypes, resultType, isOfParameterType, isOfResultType, isPredicate, pointer } = plan;
        const callback = (...argumentValues) => {
            try {
                if (!lifetime.isOpen) {
                    this.#fail('NEXO5008', `The function given as '${name}' of '${memberName}' is called after '${memberName}' returned, and a member calls the functions it is given only while its own invocation lasts`, pointer);
                }

                if (argumentValues.length !== parameterTypes.length) {
                    this.#fail('NEXO5503', `The function given as '${name}' of '${memberName}' is called with ${argumentValues.length === 1 ? 'one argument' : `${argumentValues.length} arguments`}, and its contract declares ${parameterTypes.length}`, pointer);
                }

                for (let index = 0; index < argumentValues.length; index++) {
                    if (isOfParameterType[index] !== null && !isOfParameterType[index](argumentValues[index])) {
                        this.#fail('NEXO5503', `The function given as '${name}' of '${memberName}' is called with ${Evaluator.#describe(argumentValues[index])}, and its contract declares ${parameterTypes[index]}`, pointer);
                    }
                }

                const value = body(argumentValues);

                if (isOfResultType !== null && !isOfResultType(value)) {
                    this.#fail('NEXO5504', `The function given as '${name}' of '${memberName}' gave ${Evaluator.#describe(value)}, and its contract declares ${resultType}`, pointer);
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

        return callback;
    }

    /**
     * The lifetimes of the functions the arguments made last give their member, or null where they give none, which the caller reads as the arguments are made, before evaluating anything else, and hands to the
     * invocation, which closes them. One the evaluator never closes, given to a host call or to an invocation an argument's failure prevented, keeps its lifetime as it is. An index of every open function, which
     * each invocation searched by its arguments, measured a few hundredths of an evaluation.
     * @type {{ isOpen: boolean }[] | null}
     */
    #givenLifetimes = null;

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
            this.#selections = Evaluator.#joinSelections(this.#selections, selections);
        }
    }

    /** An object expression, its context, its fields' names and values and whether it holds locals found once; applied to each item of a list it follows, and to the value it follows otherwise. */
    #compileObject(node) {
        const hasTarget = node.context !== undefined;
        const evaluateSource = hasTarget ? this.#getCompiledFunction(node.context) : null;
        // An item's source is of the kind its established type gives it, a reference where its items are of a reference type, whatever the value itself is.
        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const isOfReferences = resolution?.kind === 'projection' && this.#registry.isReferenceType(resolution.itemType.toNonNullable());
        const names = this.#resolvedDefinition.fieldNamesOf(node);
        const localNames = node.locals === undefined ? null : node.locals.map(local => local.name);
        // A field the entries after it read is in scope for them, by the name the definition gives it.
        const fields = node.objectFields.map((field, index) => ({
            name: names[index],
            local: field.name,
            isReadLater: node.objectFields.slice(index + 1).some(later => Evaluator.#readsLocal(later.value, field.name)),
            evaluate: this.#getCompiledFunction(field.value),
        }));

        if (resolution?.kind === 'construction') {
            return this.#compileConstruction(node, resolution, fields, localNames);
        }

        return (evaluator, context) => {
            const value = hasTarget ? evaluateSource(evaluator, context) : context;

            if (!(hasTarget && Array.isArray(value))) {
                return value === null && hasTarget ? null : evaluator.#applyFields(node, fields, localNames, value);
            }

            const items = value.map(item => (item === null ? null : evaluator.#applyFields(node, fields, localNames, item)));

            evaluator.#recordLineage(value, items, isOfReferences);

            return items;
        };
    }

    /**
     * An object expression constructing a structure: its fields evaluated as an object's are, in the order written, then the structure of its data shape, a property it leaves out null, each in the shape's order,
     * frozen. A value of Any resolution couldn't check is checked here against its property's type (NEXO5038).
     */
    #compileConstruction(node, { type, checks }, fields, localNames) {
        const shape = [...this.#registry.getDataShape(type).keys()];
        const asked = `constructing ${type}`;
        const checked = [...checks].map(([name, propertyType]) => ({ name, propertyType, conforms: Evaluator.#compileTypeCheck(propertyType, this.#registry, asked) }));
        const pointer = this.#pointerOf(node);

        return (evaluator, context) => {
            const object = evaluator.#applyFields(node, fields, localNames, context);

            for (const { name, propertyType, conforms } of checked) {
                if (!conforms(object[name])) {
                    evaluator.#fail('NEXO5038', `The property '${name}' of the ${type} written here is ${propertyType}, and is given ${Evaluator.#describe(object[name])}`, pointer);
                }
            }

            const structure = Object.fromEntries(shape.map(name => [name, Object.hasOwn(object, name) ? object[name] : null]));

            StructureTypes.recordType(structure, evaluator.#registry, type);

            return Object.freeze(structure);
        };
    }

    /**
     * Records the lineage of a list projected item by item from the input: each item's source, the input item it came from, of the kind the input's established type gives it, and the provenance it inherits, the input's
     * where a projection built the input and its own source otherwise. Two inputs can project to the same data, and one input can stand more than once, each occurrence keeping its own.
     */
    #recordLineage(input, projected, isOfReferences) {
        const inherited = this.#provenanceByList.get(input) ?? null;
        const sources = input.map(item => Object.freeze(item === null ? { kind: 'null' } : isOfReferences ? { kind: 'reference', value: item } : { kind: 'data', value: Evaluator.#frozenDataOf(item) }));

        this.#sourcesByList.set(projected, Object.freeze(sources));
        this.#provenanceByList.set(projected, Object.freeze(sources.map((source, index) => (inherited === null ? source : inherited[index]))));
    }

    /** The data as Nexo holds it, frozen throughout: the value itself where it is frozen already or is no object, and a frozen copy of its lists and objects otherwise. */
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

        return (node.kind === 'local' && node.name === name) || Object.values(node).some(value => Evaluator.#readsLocal(value, name));
    }

    /**
     * The object the fields give the context, the value the expression follows or an item it projects, evaluated against it in order with the expression's locals in scope, the names in `localNames`, with the selections made for each field; a field's name is a name, so it is assigned as it is.
     * A field the entries after it read is in scope for them from its evaluation on, holding its value and the selections it made, so a read of it evaluates nothing again.
     */
    #applyFields(node, fields, localNames, context) {
        const object = {};
        const enclosingSelections = this.#selections;
        const enclosingLocalsFrame = this.#localsFrame;
        const enclosingObjectRoot = this.#objectRoot;
        // An application no other encloses builds the outermost object, this object, which `root` refers to in its body; any other builds within that object.
        const isRoot = enclosingObjectRoot === null;
        let fieldSelections = null;

        if (node.locals !== undefined) {
            this.#localsFrame = { names: localNames, node, context, values: [], selections: [], enclosing: enclosingLocalsFrame };
        }

        if (isRoot) {
            this.#objectRoot = object;
        }

        try {
            for (const field of fields) {
                this.#selections = null;

                const value = field.evaluate(this, context);

                object[field.name] = value;

                // A field is recorded where it made any selection, the outermost object's as it completes, for `root` to read, so the list recorded is added to in place; a field recorded with none reads alike.
                if (this.#selections !== null) {
                    const isFirst = fieldSelections === null;

                    fieldSelections = Evaluator.#select(fieldSelections, field.name, this.#selections);

                    if (isFirst && isRoot) {
                        this.#objectFieldSelections.set(object, fieldSelections);
                    }
                }

                if (field.isReadLater) {
                    this.#localsFrame = { names: [field.local], context, values: [value], selections: [this.#selections], enclosing: this.#localsFrame };
                }
            }
        } finally {
            this.#selections = enclosingSelections;
            this.#localsFrame = enclosingLocalsFrame;
            this.#objectRoot = enclosingObjectRoot;
        }

        if (fieldSelections !== null && !isRoot) {
            this.#objectFieldSelections.set(object, fieldSelections);
        }

        return object;
    }

    /**
     * The copy a type makes of a value it admits: a declared structure as its declared fields alone, each read as the value offers it, a getter's included, so its declaration is the shape a result holds,
     * and a list item by item; null for a type that holds no declared structure, whose values stand as they are. A structure's fields are found at its first copy, so a structure that holds itself is copied as deep as its value goes.
     */
    static #compileStructureCopy(type, registry) {
        if (type.isList) {
            const copyItem = Evaluator.#compileStructureCopy(type.itemType, registry);

            return copyItem === null ? null : value => (value === null ? null : value.map(item => (item === null ? null : copyItem(item))));
        }

        // A dictionary's keys and values, and a pair's, are copied as their types declare them, where either is a structure.
        if (type.isDictionary || type.isPair) {
            const [copyKey, copyValue] = type.typeArguments.map(typeArgument => Evaluator.#compileStructureCopy(typeArgument, registry));
            const copy = (part, copyPart) => (copyPart === null || part === null ? part : copyPart(part));

            if (copyKey === null && copyValue === null) {
                return null;
            }

            return type.isPair
                ? value => (value === null ? null : new Pair(copy(value.key, copyKey), copy(value.value, copyValue)))
                : value => (value === null ? null : new Dictionary(value.entries.map(entry => [copy(entry.key, copyKey), copy(entry.value, copyValue)])));
        }

        switch (type.kind) {
            case 'named': {
                const isStructured = registry.getTypeDeclaration(type)?.kind === 'structured';

                if (!isStructured) {
                    return null;
                }

                // It holds the registry alone, never an evaluator, so it holds nothing an evaluation bound.
                let fields = null;
                let isFlat = false;
                // The type each copy keeps through a value of Any.
                const structured = type.toNonNullable();

                return value => {
                    if (value === null) {
                        return null;
                    }

                    if (fields === null) {
                        fields = [...registry.getDataShape(type)].map(([name, fieldType]) => [name, Evaluator.#compileStructureCopy(fieldType, registry)]);
                        isFlat = fields.every(([, copyField]) => copyField === null);
                    }

                    // A structure Nexo made of the type, of none but its declared fields, none of them a structure, is its declared shape already, as each is made, and a host's own is copied.
                    if (isFlat && StructureTypes.getType(value, registry)?.equals(structured) === true) {
                        return value;
                    }

                    const copy = {};

                    for (const [name, copyField] of fields) {
                        const field = value[name];

                        // A field's name is a name, so it is assigned as it is.
                        copy[name] = copyField === null || field === null ? field : copyField(field);
                    }

                    StructureTypes.recordType(copy, registry, structured);

                    return copy;
                };
            }
            default:
                return null;
        }
    }

    /**
     * The capture of a value a host gives where the type is declared, as the language's collection: a set where a list is, its items in their order, a map where a dictionary is, its entries in their order, and an object
     * of a key and a value alone where a pair is, each item, key and value captured in turn; null where the type holds no collection. A value of the language's form is kept, and one of any other form left for its type's
     * check to refuse, so a capture never makes a value of a type a check would refuse.
     */
    static #compileCollectionCapture(type) {
        if (type.isList) {
            const captureItem = Evaluator.#compileCollectionCapture(type.itemType);

            return value => {
                const items = value instanceof Set ? [...value] : value;

                return captureItem === null || !Array.isArray(items) ? items : items.map(item => (item === null ? null : captureItem(item)));
            };
        }

        if (!type.isDictionary && !type.isPair) {
            return null;
        }

        const [captureKey, captureValue] = type.typeArguments.map(typeArgument => Evaluator.#compileCollectionCapture(typeArgument));
        const capture = (part, capturePart) => (capturePart === null || part === null ? part : capturePart(part));

        if (type.isPair) {
            return value => (ObjectUtils.isPlainObject(value) && Object.keys(value).length === 2 && Object.hasOwn(value, 'key') && Object.hasOwn(value, 'value') ? new Pair(capture(value.key, captureKey), capture(value.value, captureValue)) : value);
        }

        return value => (value instanceof Map ? new Dictionary([...value].map(([key, entry]) => [capture(key, captureKey), capture(entry, captureValue)])) : value);
    }

    /** Whether a value is one the type admits, with the type's structure found once and each declared structure's fields at its first check. */
    static #compileTypeCheck(type, registry, asked) {
        const admits = Evaluator.#compileNonNullTypeCheck(type, registry, asked);

        // A collection, an object, a structure, a scalar and a position refuse null and nothing in their own checks, so where the type is not nullable its check is theirs alone; any other's, a reference's
        // membership among them, is never asked of either.
        if (!type.isNullable && Evaluator.#refusesAbsence(type, registry)) {
            return admits;
        }

        const { isNullable } = type;

        return value => (value === undefined ? false : value === null ? isNullable : admits(value));
    }

    /** Whether the type's own check refuses null and nothing: a list's, a dictionary's, a pair's, an object's and a named type's that no module declares as a reference type, which no check of `Any` or a type parameter does. */
    static #refusesAbsence(type, registry) {
        if (type.isList || type.isDictionary || type.isPair) {
            return true;
        }

        return type.kind === 'object' || (type.kind === 'named' && !registry.isReferenceType(type));
    }

    /** A compiled function holds the registry alone, never an evaluator, so it holds nothing an evaluation bound; a structure that holds itself is checked as deep as its value goes. */
    static #compileNonNullTypeCheck(type, registry, asked) {
        if (type.isList) {
            const checkItem = Evaluator.#compileTypeCheck(type.itemType, registry, asked);

            return value => Array.isArray(value) && ArrayUtils.findMissingIndex(value) === -1 && value.every(checkItem);
        }

        // A dictionary is the language's, each key of its key type and each value of its value type, and a pair each of its parts.
        if (type.isDictionary || type.isPair) {
            const [checkKey, checkValue] = type.typeArguments.map(typeArgument => Evaluator.#compileTypeCheck(typeArgument, registry, asked));

            return type.isPair
                ? value => value instanceof Pair && checkKey(value.key) && checkValue(value.value)
                : value => value instanceof Dictionary && value.keys.every(checkKey) && value.values.every(checkValue);
        }

        switch (type.kind) {
            // A value of Any is of any type, and is checked where a type is declared for it.
            case 'any':
            case 'typeParameter':
                return () => true;
            case 'object': {
                const names = [...type.fieldTypes.keys()];
                const checks = [...type.fieldTypes.values()].map(fieldType => Evaluator.#compileTypeCheck(fieldType, registry, asked));

                return value => ObjectUtils.isNonArrayObject(value) && Evaluator.#fieldsConform(value, names, checks);
            }
            default: {
                const { name } = type;
                const isStructured = registry.getTypeDeclaration(type)?.kind === 'structured';

                if (registry.isReferenceType(type)) {
                    return value => registry.belongsTo(value, type, asked);
                }

                if (type.moduleName === null && NexoModule.scalarTypeNames.includes(name)) {
                    return ValueCapture.getScalarCheck(name);
                }

                // A position is the language's own value of its kind.
                if (type.moduleName === null && (name === 'Index' || name === 'Range')) {
                    const kind = name === 'Index' ? Index : Range;

                    return value => value instanceof kind;
                }

                if (!isStructured) {
                    return () => false;
                }

                let names = null;
                let checks = null;

                return value => {
                    if (!ObjectUtils.isNonArrayObject(value)) {
                        return false;
                    }

                    if (names === null) {
                        const shape = registry.getDataShape(type);

                        names = [...shape.keys()];
                        checks = [...shape.values()].map(fieldType => Evaluator.#compileTypeCheck(fieldType, registry, asked));
                    }

                    return Evaluator.#fieldsConform(value, names, checks);
                };
            }
        }
    }

    /** Whether each field the names name holds a value its check, at the same place, admits, in order, the first that doesn't ending the checks. */
    static #fieldsConform(value, names, checks) {
        for (let index = 0; index < names.length; index++) {
            if (!checks[index](value[names[index]])) {
                return false;
            }
        }

        return true;
    }

    /**
     * The value of the local the node names: evaluated at its first use in the application of the object expression that holds it, against that application's implicit parameter and the locals in scope where it is written, and the same value at every later use there.
     * The selections its evaluation made are recorded at every place in the result it is used.
     */
    #evaluateLocal(node) {
        let frame = this.#localsFrame;

        let index = frame.names.indexOf(node.name);

        // A frame is an object expression's, whose locals are evaluated at their first use, or a body's, whose bindings it evaluated in order before its result.
        while (index === -1) {
            frame = frame.enclosing;
            index = frame.names.indexOf(node.name);
        }

        // An object expression's local is evaluated at its first use; no value the language holds is undefined, so undefined marks one yet to be.
        if (frame.node !== undefined && frame.values[index] === undefined) {
            const enclosingLocalsFrame = this.#localsFrame;
            const enclosingSelections = this.#selections;

            this.#localsFrame = frame;
            this.#selections = null;

            try {
                frame.values[index] = this.#evaluateNode(frame.node.locals[index].value, frame.context);
                frame.selections[index] = this.#selections;
            } finally {
                this.#localsFrame = enclosingLocalsFrame;
                this.#selections = enclosingSelections;
            }
        }

        const localSelections = frame.selections[index] ?? null;

        if (localSelections !== null) {
            this.#selections = Evaluator.#joinSelections(this.#selections, localSelections);
        }

        return frame.values[index];
    }

    /** Evaluates a member whose resolution is selected as it is evaluated, a computed property access's by the name it computes, its receiver the node it targets. */
    #evaluateMember(node, context) {
        // A projection stands the value its host supplied where the host call is, so the call is never evaluated.
        if (node === this.#projectionContext?.node) {
            return this.#projectionContext.value;
        }

        const resolution = this.#resolvedDefinition.resolutionOf(node);
        const receiver = this.#evaluateNode(node.receiver, context);

        if (receiver === null) {
            return null;
        }

        if (resolution.kind !== 'computedPropertyAccess') {
            return this.#evaluateResolvedAccess(resolution, receiver, node, context);
        }

        // A computed property access computes its name once and reads the property it selects, which is recorded for the value's place in the result.
        const name = this.#evaluateNode(node.name, context);

        this.#selections = Evaluator.#select(this.#selections, node, name);

        return this.#evaluateResolvedAccess(resolution.resolutionsByName.get(name), receiver, node, context);
    }

    /**
     * Evaluates the access the resolution names on the receiver: reads a value it stores, or a completed field of the object root, or evaluates the arguments the declaration is given and invokes it with them, answering null
     * without invoking it where a null argument propagates.
     */
    #evaluateResolvedAccess(resolution, receiver, node, context) {
        if (resolution.kind === 'objectField' || resolution.kind === 'dataProperty' || resolution.kind === 'objectRootField') {
            return this.#readStoredValue(receiver, resolution.name);
        }

        const args = this.#evaluateArguments(resolution, context);

        return args === null ? null : this.#invokeImplementation(this.#getCompiledInvocation(resolution.declaration, resolution.type), receiver, args, node, false, this.#givenLifetimes);
    }

    /**
     * A value the receiver stores under the name, an object field or a property of a structured type's data, a completed field of the outermost object read through a reference to it among them, as its evaluation gave it:
     * the selections that evaluation made, where an object expression of this evaluation built the receiver, recorded where it is read; null for no receiver, where a receiver that can be null is. Its metadata is traced by its
     * resolution's kind, which tells a field of the root, which follows its initializer, from any other.
     */
    #readStoredValue(receiver, name) {
        if (receiver === null) {
            return null;
        }

        const selections = Evaluator.#selectionOf(this.#objectFieldSelections.get(receiver) ?? null, name) ?? null;

        if (selections !== null) {
            this.#selections = Evaluator.#joinSelections(this.#selections, selections);
        }

        return receiver[name] ?? null;
    }

    /**
     * Refuses an equality whose operands, one of Any among them, are found as they are evaluated to be of types it never compares, as resolution refuses where it knows them: a structured value, a list or an object
     * compared with a value that isn't null (NEXO5025), and values of two types that fit neither way (NEXO5024). A null operand is compared with any value.
     */
    #requireComparable(node, leftValue, rightValue) {
        if (leftValue === null || rightValue === null) {
            return;
        }

        const { operator } = this.#resolvedDefinition.resolutionOf(node);
        const pointer = this.#pointerOf(node);
        const typeOf = value => this.#getActualType(value, `'${operator}'`, reason => this.#fail('NEXO5025', `'${operator}' compares strings, numbers, Booleans and references, and ${reason}`, pointer));
        const leftType = typeOf(leftValue);
        const rightType = typeOf(rightValue);
        const { typeChecker } = this.#registry;

        for (const type of [leftType, rightType]) {
            if (!typeChecker.isComparable(type)) {
                this.#fail('NEXO5025', `'${operator}' compares a value of ${type} with null alone, since only strings, numbers, Booleans and references are compared with each other`, pointer);
            }
        }

        if (!typeChecker.fitsEitherWay(leftType, rightType)) {
            this.#fail('NEXO5024', `'${operator}' compares values whose types fit one way or the other, and its operands were found to be of ${leftType} and ${rightType}, which fit neither way`, pointer);
        }
    }

    /**
     * The result of an arithmetic operation, refused where an operand is no number, which a binding of no number can still give, where `/` or `%` divides by zero,
     * and where the result is no finite number, so neither infinity nor NaN reaches a result; each is an evaluation error at the operation.
     */
    #arithmeticResult(node, result, left, right) {
        const operator = node.kind === 'arithmeticNegation' ? '-' : node.operator;

        if (typeof left !== 'number' || typeof right !== 'number') {
            this.#fail('NEXO5505', `'${operator}' takes numbers, and is given ${typeof left !== 'number' ? Evaluator.#describe(left) : Evaluator.#describe(right)}`, this.#pointerOf(node));
        }

        if ((operator === '/' || operator === '%') && right === 0 && node.kind === 'arithmetic') {
            this.#fail('NEXO5005', `'${operator}' divides by zero`, this.#pointerOf(node));
        }

        if (!Number.isFinite(result)) {
            this.#fail('NEXO5020', `The result of '${operator}' is no finite number`, this.#pointerOf(node));
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
     * against the invocation's result type, tells the host's `afterInvoke`, and answers a copy of the structures the answer holds. Its failures are located at the node that invoked it. Its request says whether the member was
     * selected as it is evaluated.
     */
    #invokeImplementation(invocation, receiver, args, node, isDeferred = false, lifetimes = null) {
        const { declaration, implementation, takesReceiver, answersReceiverItems, projectsItems, readsMaintained, resultType, reliesOnAnswer, captureCollections, isOfResultType, copyStructure } = invocation;

        if (implementation === undefined) {
            this.#fail('NEXO4001', `The module '${this.#registry.getDeclaringModuleName(declaration)}' gives '${NexoModule.writtenNameOf(declaration)}' no implementation`, this.#pointerOf(node));
        }

        // A request names its call by where it stands in the definition, so a call within a script function's body names the part of the body it is, whichever call of the function reached it. A module member is read and
        // called through its namespace, and has no receiver.
        const pointer = this.#hooks === null ? null : this.#resolvedDefinition.resolveDefinitionPointer(this.#pointerOf(node));
        const request = this.#hooks === null ? null : takesReceiver ? { declaration, receiver, args, pointer, isDeferred } : { declaration, args, pointer, isDeferred };
        const samples = this.#beforeInvoke(request, declaration, node, readsMaintained);

        if (samples === null) {
            return null;
        }

        let value;

        try {
            // The input names the receiver, the arguments, the environment and a maintained member's samples, in that order.
            const input = takesReceiver ? { receiver, args, env: this.#environment } : { args, env: this.#environment };

            if (readsMaintained) {
                input.samples = samples;
            }

            value = implementation(input);
        } catch (error) {
            // A failure Nexo raised, within a function the member was given or a nested evaluation among them, keeps its own code and place; anything else the implementation threw, a NexoError it built among them,
            // is the cause of Nexo's own, exactly as thrown.
            if (NexoErrors.isRaisedByNexo(error) || this.#callbackErrors.has(error)) {
                throw error;
            }

            // One of Nexo's own members refuses the values it is given with a failure of the language's, at the call.
            if (error instanceof MemberFailure && this.#registry.getDeclaringModuleName(declaration) === Vocabulary.moduleName) {
                this.#fail(error.code, error.message, this.#pointerOf(node));
            }

            this.#fail('NEXO5007', `${this.#subjectOf(declaration, node)} failed: ${Evaluator.#messageOf(error)}`, this.#pointerOf(node), { cause: error });
        } finally {
            // A function the member was given is called only while its invocation lasts.
            if (lifetimes !== null) {
                for (const lifetime of lifetimes) {
                    lifetime.isOpen = false;
                }
            }
        }

        // A member answering its receiver's items hands over the position each stood at there, and an ordering keeps the keys that ordered them with the list it answered, which a capture and a copy can replace with another,
        // so both are read from that list as the member returns.
        const implemented = value;
        const positions = answersReceiverItems ? ItemPositions.takePositions(implemented) : undefined;

        // A collection a host gives in a form of its own, a set, a map or a pair's object, is the language's where the member declares one.
        if (captureCollections !== null) {
            value = captureCollections(value);
        }

        if (!reliesOnAnswer && !isOfResultType(value)) {
            this.#fail('NEXO5006', `${this.#subjectOf(declaration, node)} answered ${Evaluator.#describe(value)}, and it declares ${resultType}`, this.#pointerOf(node));
        }

        if (request !== null && this.#hooks.afterInvoke !== undefined) {
            try {
                this.#hooks.afterInvoke(request, value);
            } catch (error) {
                this.#failHook(error, declaration, node, 'after its invocation');
            }
        }

        const answered = copyStructure === null ? value : copyStructure(value);

        // An ordered list's capture and copy keep the keys that ordered it, its items in the same places, so a `thenBy` given it refines it.
        if (answered !== implemented) {
            ListOrdering.carry(implemented, answered);
        }

        // A member answering its receiver's items keeps the lineage each occurrence had there, as each item's own record already follows it; one answering a value for each item, as a projection does, records each item as its source.
        if (answersReceiverItems) {
            this.#realignLineage(receiver, positions, answered);
        } else if (projectsItems) {
            const itemType = this.#resolvedDefinition.resolutionOf(node)?.receiverType?.itemType ?? null;

            this.#recordLineage(receiver, answered, itemType !== null && this.#registry.isReferenceType(itemType.toNonNullable()));
        }

        return answered;
    }

    /**
     * Gives the list a member answered of its receiver's items, its copy where its items were copied, the source and the provenance of each occurrence it answered, by the position the occurrence stood at in the
     * receiver, so a filter, a partition, a reordering and a taking of distinct items alike realign, and items equal to each other keep their own occurrences' lineage. A receiver without either records nothing.
     */
    #realignLineage(receiver, positions, answered) {
        const sources = this.#sourcesByList.get(receiver) ?? null;
        const provenance = this.#provenanceByList.get(receiver) ?? null;

        if (sources !== null) {
            this.#sourcesByList.set(answered, Object.freeze(positions.map(at => sources[at])));
        }

        if (provenance !== null) {
            this.#provenanceByList.set(answered, Object.freeze(positions.map(at => provenance[at])));
        }
    }

    /** What a message names as carrying a member out. */
    #subjectOf(declaration) {
        // An unnamed indexer has no name, and is named by its kind and its module.
        return declaration.name === undefined ? `The unnamed indexer of the module '${this.#registry.getDeclaringModuleName(declaration)}'` : `The member '${declaration.name}'`;
    }

    /**
     * The evaluator's step before an invocation, at the point the host's hook is named for: calls the host's `beforeInvoke` where there is one and answers the samples a member's invocation reads, or null where one is pending,
     * marking the evaluation pending, so the member answers null. A failure of the hook fails the evaluation at the member. Without the hook, it refuses a member that reads maintained values, since nothing answers its samples.
     */
    #beforeInvoke(request, declaration, node, readsMaintained) {
        if (request === null || this.#hooks.beforeInvoke === undefined) {
            if (readsMaintained) {
                this.#fail('NEXO5011', `${this.#subjectOf(declaration, node)} is maintained by an observation, and reading it waits for the first sample, which a synchronous evaluation cannot`, this.#pointerOf(node));
            }

            return NO_SAMPLES;
        }

        let answer;

        try {
            answer = this.#hooks.beforeInvoke(request);
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
     * Fails the evaluation at the member for what a hook around its invocation threw, a NexoError the hook built among them, a failure Nexo raised keeping its own place;
     * the hooks are called directly, since they run on every invocation.
     */
    #failHook(error, declaration, node, moment) {
        if (NexoErrors.isRaisedByNexo(error) || this.#callbackErrors.has(error)) {
            throw error;
        }

        this.#fail('NEXO5009', `The host failed ${moment} of ${this.#subjectOf(declaration, node).replace(/^The /, 'the ').replace(/,$/, '')}: ${Evaluator.#messageOf(error)}`, this.#pointerOf(node), { cause: error });
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
     * Raises an error of the code and the message at the source of the pointer: a module error for a code of the module range, NEXO4…, and an evaluation error for any other, which carries the options given as they are,
     * the failure that caused it among them. Either is raised through Nexo's own factories, which check its code's range and mark it as Nexo's.
     */
    #fail(code, message, pointer, options) {
        const location = this.#locate(pointer);

        throw code.startsWith('NEXO4') ? NexoErrors.module(code, message, location) : NexoErrors.evaluation(code, message, location, options);
    }

    /** Where the node stands in the definition, as a JSON Pointer. */
    #pointerOf(node) {
        return this.#resolvedDefinition.pointerOf(node);
    }

    #locate(pointer) {
        const definitionPointer = this.#resolvedDefinition.resolveDefinitionPointer(pointer);

        return this.#locations?.locate(definitionPointer) ?? { pointer: definitionPointer };
    }

    /** Whether a value is truthy: every value is but null and false. */
    static #isTruthy(value) {
        return value !== null && value !== false;
    }

    /** What the value is, for a message, its type never asked: nothing, or its data where it has any, a number no finite number holds written as `Infinity`, `-Infinity` or `NaN` wherever it stands. */
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

        // JSON writes a number no finite number holds as null, so each is marked as a string JSON escapes and then written as its own word; a string holding the marker's NUL characters is no realistic value.
        const nonFinite = (key, part) => (typeof part === 'number' && !Number.isFinite(part) ? `${NON_FINITE_MARKER}${part}` : part);

        try {
            return JSON.stringify(value, nonFinite)?.replace(NON_FINITE_WRITTEN, '$1') ?? String(value);
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
        this.#provenanceByList = new WeakMap();
        this.#selections = null;

        try {
            const result = this.#evaluateNode(node, null);

            // Resolution proved every other part of the result data.
            if (this.#checksResultData && !this.#isData(result)) {
                this.#fail('NEXO5028', 'The result holds a value of Any that is no data, as a reference or a function is; read the facts it needs through an object expression', this.#pointerOf(node));
            }

            const value = this.#copyResult(result);
            const copiedIdentities = this.#copiedIdentities;

            // The metadata is described where it is first read, from identities no later evaluation changes, so a caller that reads the value alone pays nothing for it.
            return { node, value, identities: Evaluator.#withSelections(copiedIdentities, this.#selections) };
        } finally {
            this.#selections = null;
        }
    }

    /** Whether the value is data at any depth: null, a string, a Boolean, a finite number, a list holding data at every index, or a plain object of data no module recognizes as a reference. */
    #isData(value) {
        if (value === null || typeof value === 'string' || typeof value === 'boolean') {
            return true;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value);
        }

        if (Array.isArray(value)) {
            return ArrayUtils.findMissingIndex(value) === -1 && value.every(item => this.#isData(item));
        }

        // A dictionary is data where every key and every value is, and a pair where both its parts are.
        if (value instanceof Dictionary) {
            return value.keys.every(key => this.#isData(key)) && value.values.every(entry => this.#isData(entry));
        }

        if (value instanceof Pair) {
            return this.#isData(value.key) && this.#isData(value.value);
        }

        return ObjectUtils.isPlainObject(value) && this.#registry.recognize(value, 'the result').length === 0 && Object.values(value).every(field => this.#isData(field));
    }

    /**
     * The identities the last `#copyResult` left beside its copy, which its caller reads as it returns, before copying anything else: for a list projected from elements, the element each item came from, for an object
     * field, the selections made for its value, as `selections`, and null where nothing beneath holds either. Handing them over this way spares a pair for each part copied, a scalar among them.
     * @type {object | null}
     */
    #copiedIdentities = null;

    /**
     * Copies the data, from one traversal, into a frozen copy sharing no structure with the original, which it answers, and the identities that follow its structure, which it leaves in `#copiedIdentities`. Each
     * call leaves its own, so a caller reads the identities of the part it copied.
     */
    #copyResult(value) {
        this.#copiedIdentities = null;

        if (value === null || typeof value !== 'object') {
            return value;
        }

        // A result exports a dictionary as its entries, in their order, and a pair as its key and its value, each a frozen object of data, so it never turns back into a dictionary or a pair when it is bound again.
        if (value instanceof Dictionary) {
            const entries = Object.freeze(value.entries.map(entry => this.#copyResult(entry)));

            this.#copiedIdentities = null;

            return Object.freeze({ entries });
        }

        if (value instanceof Pair) {
            const key = this.#copyResult(value.key);
            const copied = Object.freeze({ key, value: this.#copyResult(value.value) });

            this.#copiedIdentities = null;

            return copied;
        }

        if (Array.isArray(value)) {
            const copy = [];
            const itemIdentities = [];
            let hasIdentities = false;

            for (const item of value) {
                copy.push(this.#copyResult(item));

                const identities = this.#copiedIdentities;

                itemIdentities.push(identities);
                hasIdentities ||= identities !== null;
            }

            const sources = this.#sourcesByList.get(value) ?? null;
            const provenance = this.#provenanceByList.get(value) ?? null;

            this.#copiedIdentities = sources === null && provenance === null && !hasIdentities ? null : { sources, provenance, items: itemIdentities };

            return Object.freeze(copy);
        }

        if (ObjectUtils.isNonArrayObject(value)) {
            const copy = {};
            const fieldSelections = this.#objectFieldSelections.get(value);
            let fieldIdentities = null;

            for (const name of Object.keys(value)) {
                const field = this.#copyResult(value[name]);
                const copied = this.#copiedIdentities;

                // A read copies every field of every row, so an ordinary field is assigned here, where the assignment sees only the copies' shapes; sharing the one in `defineDataProperty` with live state's writes made reads measurably slower.
                if (name === '__proto__') {
                    ObjectUtils.defineDataProperty(copy, name, field);
                } else {
                    copy[name] = field;
                }

                const selections = Evaluator.#selectionOf(fieldSelections ?? null, name) ?? null;
                const identities = selections === null ? copied : Evaluator.#withSelections(copied, selections);

                if (identities !== null) {
                    fieldIdentities ??= {};
                    ObjectUtils.defineDataProperty(fieldIdentities, name, identities);
                }
            }

            this.#copiedIdentities = fieldIdentities === null ? null : { fields: fieldIdentities };

            return Object.freeze(copy);
        }

        return value;
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
                    node = this.#resolvedDefinition.resolutionOf(node).initializer;
                    continue;
                case 'optionalChain':
                    node = node.chain;
                    continue;
                case 'body':
                    node = node.result;
                    continue;
                case 'do':
                    node = node.body;
                    continue;
                case 'call': {
                    const resolution = this.#resolvedDefinition.resolutionOf(node);

                    // A call of a member describes its value as any member's does.
                    if (node.callee.kind !== 'local') {
                        return this.#resolveMemberRecord(node, resolution, identities, contextRecord, selections, value);
                    }

                    // A call of one a reference to a module's function alone produces its value itself, as the member it invokes does, the reference's declaration its one candidate where its receiver's type is unknown.
                    if (resolution.functions === undefined) {
                        return this.#getExpressionRecord(node, null, (resolution.declaration ?? resolution.candidates[0]).updates?.tolerance ?? null);
                    }

                    const { functions } = resolution;
                    const called = functions.length === 1 ? functions[0] : functions.find(entry => Evaluator.#getFunctionKey(entry) === Evaluator.#selectionOf(selections, node));

                    if (called === undefined) {
                        return this.#getExpressionRecord(node, null, null);
                    }

                    // A call of a reference to a module's function produces its value itself, as the member it invokes does.
                    if (called.reference !== undefined) {
                        return this.#getExpressionRecord(node, null, called.reference.updates?.tolerance ?? null);
                    }

                    node = called.body;
                    continue;
                }
                case 'memberAccess':
                case 'indexerAccess': {
                    const resolution = this.#resolvedDefinition.resolutionOf(node);
                    const candidate = resolution?.kind === 'computedPropertyAccess' ? (Evaluator.#selectionOf(selections, node) ?? null) : null;
                    const selected = resolution?.kind === 'computedPropertyAccess' ? (candidate === null ? null : resolution.resolutionsByName.get(candidate)) : resolution;

                    // A field read through the object root follows its initializer.
                    if (selected?.kind === 'objectRootField') {
                        node = selected.initializer;
                        continue;
                    }

                    return this.#resolveMemberRecord(node, resolution, identities, contextRecord, selections, value);
                }
                case 'it':
                    return contextRecord ?? this.#getExpressionRecord(node, null, null);
                case 'object':
                    return this.#resolveObjectExpressionRecord(node, value, identities, contextRecord);
                default:
                    if (SELECTING_KINDS.has(node.kind)) {
                        const selected = Evaluator.#selectionOf(selections, node);

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
     * Resolves the record of a member's value: a computed property access's by the name its evaluation selected, none where it selected none; a stored value's, an object field's or a data property's, the record of that
     * field of what it reads it from; and any other the member's own, with its declaration's tolerance. A field read through the object root is its caller's to follow.
     */
    #resolveMemberRecord(node, resolution, identities, contextRecord, selections, value) {
        let selected = resolution;
        let candidate = null;

        if (resolution?.kind === 'computedPropertyAccess') {
            candidate = Evaluator.#selectionOf(selections, node) ?? null;

            if (candidate === null) {
                return this.#getExpressionRecord(node, null, null);
            }

            selected = resolution.resolutionsByName.get(candidate);
        }

        if (selected?.kind === 'objectField' || selected?.kind === 'dataProperty') {
            const whole = this.#resolveRecord(node.receiver, undefined, identities, contextRecord);

            return whole.objectFields?.[candidate ?? selected.name] ?? Evaluator.#getInheritedRecord(whole);
        }

        const record = this.#getExpressionRecord(node, candidate, selected?.declaration?.updates?.tolerance ?? null);

        // A filter's answer describes each item it kept as its receiver describes it, its items' records, where they have any, and their sources and provenance realigned in its order, under the filter's own origin and
        // tolerance; a receiver no projection built gives it neither.
        if (Array.isArray(value) && selected?.declaration !== undefined && Vocabulary.answersReceiverItems(selected.declaration)) {
            const { items, sources, provenance } = this.#resolveRecord(Evaluator.#accessOf(node).receiver, value, identities, contextRecord);

            return Object.freeze({ ...record, ...(items === undefined ? {} : { items }), ...(sources === undefined ? {} : { sources }), ...(provenance === undefined ? {} : { provenance }) });
        }

        // A selection's answer records each item it read as its source and the provenance that item carried, as a projection's does, its items described by the selection's own record.
        if (Array.isArray(value) && selected?.declaration !== undefined && Vocabulary.projectsItems(selected.declaration) && identities?.sources != null) {
            return Object.freeze({ ...record, sources: identities.sources, provenance: identities.provenance });
        }

        return record;
    }

    /**
     * Resolves the record of an object expression's value, whichever result it gave: one object's record of each field, a projected list's record of each item with the reference each came from, or its own record alone where it
     * gave null or is described for a part read from it.
     */
    #resolveObjectExpressionRecord(node, value, identities, contextRecord) {
        // The fields read `it` as the value the expression follows, each item of it where it projects a list, and as the enclosing one where it follows none.
        const followed = node.context === undefined ? null : this.#resolveRecord(node.context, undefined, identities, contextRecord);

        if (Array.isArray(value)) {
            const itemContextRecord = followed === null ? contextRecord : Evaluator.#getInheritedRecord(followed);
            const items = value.map((item, index) => this.#createObjectRecord(node, item, identities?.items?.[index] ?? null, itemContextRecord));
            const sources = identities?.sources ?? null;
            const provenance = identities?.provenance ?? null;

            // A list no projection built records neither sources nor provenance at all, so a null source and absent sources or provenance stay apart.
            return Object.freeze({ origin: this.#getExpressionRecord(node, null, null).origin, tolerance: null, items: Object.freeze(items), ...(sources === null ? {} : { sources }), ...(provenance === null ? {} : { provenance }) });
        }

        return value === null ? this.#getExpressionRecord(node, null, null) : this.#createObjectRecord(node, value, identities, followed ?? contextRecord);
    }

    /**
     * Creates the record of one object an object expression built, with each field's, by its name in the order written, called once for a single object and once for each projected item; a field described for a part read from
     * it is described from the selections of the place it is read.
     */
    #createObjectRecord(node, object, identities, contextRecord) {
        const { objectFields: fields } = node;
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

        const record = Object.freeze({ origin: this.#getExpressionRecord(node, null, null).origin, tolerance: null, objectFields: Object.freeze(byName) });

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

    /** Gets the shared record a part with none of its own inherits from its whole, its whole's origin and tolerance without the whole's object fields or items, from `#inheritedRecordCache`, creating it at the first lookup. */
    static #getInheritedRecord(whole) {
        if (whole.objectFields === undefined && whole.items === undefined) {
            return whole;
        }

        let inherited = Evaluator.#inheritedRecordCache.get(whole);

        if (inherited === undefined) {
            inherited = Object.freeze({ origin: whole.origin, tolerance: whole.tolerance });
            Evaluator.#inheritedRecordCache.set(whole, inherited);
        }

        return inherited;
    }

    /**
     * The selections with the node's recorded, the list itself where it is one already: a node recorded before takes the newer selection in its place, and null, where none was made, a new list. A map for each
     * place that made any measured a few hundredths of an evaluation's allocation, and a place makes few, so a list of each node beside its selection, searched in turn, holds them.
     * @param {unknown[] | null} selections
     */
    static #select(selections, node, selection) {
        if (selections === null) {
            return [node, selection];
        }

        for (let index = 0; index < selections.length; index += 2) {
            if (selections[index] === node) {
                selections[index + 1] = selection;

                return selections;
            }
        }

        selections.push(node, selection);

        return selections;
    }

    /** The selections with every one the others hold recorded in turn, as `#select` records each, or a copy of the others where there were none, since a list is added to in place. */
    static #joinSelections(selections, others) {
        if (others === null) {
            return selections;
        }

        if (selections === null) {
            return others.slice();
        }

        for (let index = 0; index < others.length; index += 2) {
            Evaluator.#select(selections, others[index], others[index + 1]);
        }

        return selections;
    }

    /** The selection recorded for the node, or undefined where none is. */
    static #selectionOf(selections, node) {
        if (selections !== null) {
            for (let index = 0; index < selections.length; index += 2) {
                if (selections[index] === node) {
                    return selections[index + 1];
                }
            }
        }

        return undefined;
    }

    /** The identities of a value with the selections made for it beside them, as their `selections`, or the identities alone where none were made. */
    static #withSelections(identities, selections) {
        return selections === null ? identities : { ...identities, selections };
    }
}
