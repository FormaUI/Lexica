/**
 * Lexica's API: reading a text into its definition, checking a definition, writing its canonical text, creating the modules that declare a vocabulary
 * and the registries a host resolves expressions against.
 */

/** A Lexica definition: the JSON document that records an expression's meaning, its expression tree with the version of its format, without the values its parameters are bound to. */
export interface LexicaDefinition {
    readonly version: number;
    readonly expression: LexicaDefinitionNode;
}

/** A node of a definition. */
export type LexicaDefinitionNode =
    | { readonly kind: 'literal'; readonly value: string | number | boolean | null }
    | { readonly kind: 'parameter'; readonly name: string }
    | { readonly kind: 'root'; readonly name: 'document' | 'window' | 'root' }
    | { readonly kind: 'context' }
    | { readonly kind: 'local'; readonly name: string }
    | { readonly kind: 'member'; readonly target: LexicaDefinitionNode; readonly name: string | LexicaDefinitionNode; readonly optional?: true }
    | { readonly kind: 'call'; readonly target: LexicaDefinitionNode; readonly name: string; readonly optional?: true; readonly arguments: readonly LexicaDefinitionNode[] }
    | { readonly kind: 'indexer'; readonly target: LexicaDefinitionNode; readonly name?: string; readonly argument: LexicaDefinitionNode; readonly optional?: true }
    | { readonly kind: 'object'; readonly target?: LexicaDefinitionNode; readonly locals?: readonly LexicaDefinitionLocal[]; readonly fields: readonly LexicaDefinitionField[] }
    | { readonly kind: 'optionalChain'; readonly target: LexicaDefinitionNode }
    | { readonly kind: 'coalescing'; readonly value: LexicaDefinitionNode; readonly fallback: LexicaDefinitionNode }
    | { readonly kind: 'not'; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'function'; readonly parameters: readonly string[]; readonly body: LexicaDefinitionNode; readonly arrow?: true }
    | { readonly kind: 'functionCall'; readonly name: string; readonly arguments: readonly LexicaDefinitionNode[] }
    | { readonly kind: 'body'; readonly locals: readonly LexicaDefinitionLocal[]; readonly result: LexicaDefinitionNode }
    | { readonly kind: 'do'; readonly body: LexicaDefinitionNode }
    | { readonly kind: 'interpolatedString'; readonly parts: readonly ({ readonly kind: 'text'; readonly value: string } | { readonly kind: 'expression'; readonly expression: LexicaDefinitionNode })[] }
    | { readonly kind: 'comparison'; readonly operands: readonly LexicaDefinitionNode[]; readonly operators: readonly ('<' | '<=' | '>' | '>=')[] }
    | { readonly kind: 'arithmetic'; readonly operator: '+' | '-' | '*' | '/' | '%'; readonly left: LexicaDefinitionNode; readonly right: LexicaDefinitionNode }
    | { readonly kind: 'negate'; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'cast'; readonly type: string; readonly target: LexicaDefinitionNode }
    | { readonly kind: 'conversion'; readonly type: string; readonly target: LexicaDefinitionNode }
    | { readonly kind: 'try'; readonly target: LexicaDefinitionNode }
    | { readonly kind: 'equality'; readonly left: LexicaDefinitionNode; readonly right: LexicaDefinitionNode }
    | { readonly kind: 'conditional'; readonly condition?: LexicaDefinitionNode; readonly binding?: { readonly name: string; readonly value: LexicaDefinitionNode }; readonly consequent: LexicaDefinitionNode; readonly alternative: LexicaDefinitionNode }
    | { readonly kind: 'and' | 'or'; readonly operands: readonly LexicaDefinitionNode[] };

/** A local of a body or an object expression: its name, which a `local` node uses, and the value it names, never output. */
export interface LexicaDefinitionLocal {
    readonly name: string;
    readonly value: LexicaDefinitionNode;
}

/** A field of an object expression: its name, always written, and its value. */
export interface LexicaDefinitionField {
    readonly name: string;
    readonly value: LexicaDefinitionNode;
}

/** The values supplied by parameter name, each typed from the value itself. */
export interface LexicaBindingValues {
    [name: string]: unknown;
}

/** Bindings as `lexica.bind` makes them: data a frozen copy of the data given, each reference itself, and the resolution key that says which resolutions they may reuse. */
export interface LexicaBindings {
    /** Each binding's type, with each primitive binding's value, which a resolution is reused with. */
    readonly resolutionKey: string;
    /** Whether a value is bound to the name. */
    has(name: string): boolean;
    /** The value bound to the name: data as a frozen copy, a reference as itself. */
    get(name: string): unknown;
    /** The type the value bound to the name gives it, in type notation, as `list<number?>`. */
    typeOf(name: string): string | undefined;
}

/** Where a failure is. */
export interface LexicaErrorLocation {
    /** The failing node's JSON Pointer into the definition. */
    pointer?: string;
    offset?: number;
    line?: number;
    column?: number;
    binding?: string;
    module?: string;
    declaration?: string;
}

/** A failure of Lexica, in the stage it happened in, and where. Its `name` is `LexicaError`. */
export declare class LexicaError extends Error {
    private constructor();
    readonly name: 'LexicaError';
    readonly kind: 'syntax' | 'structure' | 'validation' | 'module' | 'evaluation';
    readonly location: LexicaErrorLocation;
    /** A failure of what a caller gave: bindings, a definition's structure or a host's use of the API. */
    static structure(message: string, location: LexicaErrorLocation): LexicaError;
    /** A request that does not follow the vocabulary, failing before anything is evaluated. */
    static validation(message: string, location: LexicaErrorLocation): LexicaError;
    /** A failure while evaluating, with what caused it. */
    static evaluation(message: string, location: LexicaErrorLocation, options?: { cause?: unknown }): LexicaError;
}

/** How a member changes. */
export type LexicaChangeCategory = 'constant' | 'observable' | 'partly-observable' | 'unobserved' | 'derived';

/** How a member reads. */
export type LexicaReadingMode = 'fresh' | 'maintained' | 'captured' | 'derived';

/** A reference to the argument a call gives for a parameter of the member. */
export interface LexicaArgumentReference {
    argument: string;
}

/** An argument of the member with a prefix joined to it, for a value parameter of type `string`, as `{ argument: 'name', prefix: 'aria-' }` names the attribute `aria-` and the name. */
export interface LexicaPrefixedArgumentReference extends LexicaArgumentReference {
    /** What is joined before the argument, a string no empty one. */
    prefix: string;
}

/** A value an observation gives: a literal, a list of values, or an argument of the member, which can carry a prefix. */
export type LexicaObservationValue = string | number | boolean | null | LexicaArgumentReference | LexicaPrefixedArgumentReference | LexicaObservationValue[];

/** An observation that covers a member's changes: its type, what it observes, and the arguments its type takes. */
export interface LexicaObservationDeclaration {
    /** The name of the type of observation, which a module declares. */
    type: string;
    /** What it observes: the receiver; its root, the root of the tree it is in; its roots, every root of its flat-tree ancestry through slots and shadow hosts, each observed alike; the window; the document; or the argument of the member that names it. A watch follows the receiver to another root or slot, and rebinds what observes its root or roots. */
    of: 'receiver' | 'root' | 'roots' | 'window' | 'document' | LexicaArgumentReference;
    [argument: string]: LexicaObservationValue | undefined;
}

/** A type of observation: what its observations provide, and the function that starts one. */
export interface LexicaObservationTypeDeclaration {
    name: string;
    /** A signal that a result may have changed, or a sampled value a member reads. */
    contract: 'invalidation' | 'maintained';
    /** The arguments that belong to the identity of an observation, beside its target. */
    identity?: string[];
    /** Whether equivalent requests share one observation; one that is not shared is kept for each watch, `evaluateAsync` call or event listener alone, whose later evaluations reach it again. */
    shared?: boolean;
    /** The key of the function that starts an observation, among the module's functions. */
    function: string;
}

/** A conversion from one type of data to another, which `to` asks for: a value already of a type converts to itself, so none is declared from a type to itself. */
export interface LexicaConversionDeclaration {
    /** The type it converts from: `number`, `string`, `boolean` or a structured type. */
    from: string;
    /** The type it converts to: `number`, `string`, `boolean` or a structured type. */
    to: string;
    /** The key of the function that converts, among the module's functions. */
    function: string;
}

/** What the function of a conversion is given beside the value it converts. */
export interface LexicaConversionContext {
    /**
     * Rejects the value, which has no conversion, with a reason that is a diagnostic string. It throws a signal private to Lexica and to this attempt at the conversion,
     * so it never returns and the function stops where it calls it, unlike a promise's `reject`. Any other exception the function throws, and a value not of the type it converts to, is a fault.
     */
    reject(reason: string): never;
}

/** A parameter of a member. */
export interface LexicaParameterDeclaration {
    name: string;
    /**
     * A value, an expression evaluated against each item, a predicate, an expression of any value whose truthiness the implementation receives, or a function the expression declares,
     * which the implementation calls while its own invocation lasts and only a member of kind `function` takes.
     */
    kind: 'value' | 'expression' | 'predicate' | 'function';
    /** The parameter's type, in Lexica's notation; a predicate's is `boolean`, what its function receives, and a function parameter's the type of the result it takes from the function. */
    type: string;
    /** The types a function parameter's function is called with, in order, in Lexica's notation; only a function parameter declares them. */
    parameters?: string[];
    required: boolean;
    default?: unknown;
    /** Whether the argument names something the vocabulary resolves before any evaluation; a fixed parameter is a value parameter of type `string`. */
    fixed?: boolean;
    /** What a fixed parameter names, and only a fixed one. */
    selects?: 'eventType' | 'condition';
    /** Whether a null argument makes the call answer null, or is accepted; a function parameter, whose function is never null, leaves it out. */
    nulls?: 'propagate' | 'accept';
    /** What an expression or a predicate argument is evaluated against. */
    context?: 'item';
    /** What the member does where an optional argument is left out, said in words for its documentation. */
    omitted?: string;
}

/** A property, function, event source, action or behavior a module adds. */
export interface LexicaMemberDeclaration {
    /** The Lexica name. */
    name: string;
    /** The key of the function that carries it out, among the module's functions; a member whose argument selects a condition names none, since the condition carries it out. */
    function?: string;
    kind: 'property' | 'function' | 'eventSource' | 'action' | 'behavior';
    /** How a member that is no property is written: called, `context.closest(".row")`, the default, or a named indexer, `context:attribute["data-key"]`, a function whose one required value parameter is its key. A property declares none. */
    form?: 'call' | 'indexer';
    /** What its arguments supply, where it has parameters: its parameters, in order, the required ones before the optional ones, or every parameter, as the fields of one options object; an indexer's is positional. */
    input?: 'positional' | 'options';
    /** Whether an indexer is the default of its receivers, which `:[…]` invokes, as `item` is a list's; a receiver has one at most. */
    default?: boolean;
    /** The types it applies to, in Lexica's notation. */
    on: string | string[];
    parameters?: LexicaParameterDeclaration[];
    /** The type of its result, in Lexica's notation. */
    result: string;
    changes: LexicaChangeCategory;
    reads: LexicaReadingMode;
    /** The changes a partly observable member's observations miss. */
    misses?: string;
    /** How far a number it returns may move before a watch reports a different snapshot; the number must change by more, and exactly where it is not declared. */
    tolerance?: number;
    /** The observations that cover its changes, which an observable or partly observable member names and no other does. */
    observations?: LexicaObservationDeclaration[];
}

/** What a module declares. */
export interface LexicaModuleContents {
    members?: LexicaMemberDeclaration[];
    /** The structured types it declares, each with its fields' types. */
    types?: { name: string; fields: Record<string, string> }[];
    /** The event types it declares, each with the type of its event data. */
    eventTypes?: { name: string; data: string }[];
    /** The types of observation it declares. */
    observationTypes?: LexicaObservationTypeDeclaration[];
    /** The conversions it declares, each to or from one of its own types, and one for each source and target. */
    conversions?: LexicaConversionDeclaration[];
    /** The conditions it declares, each asked by name with its verb. */
    conditions?: LexicaConditionDeclaration[];
}

/**
 * A condition: a Boolean of its receivers, which its verb asks by name, as `.is("name")` does, carried out by its own function under its own contract, so one condition's observability is no other's.
 * A module names a condition freely on its own types, and on any other names it for itself, as it does members; a name is declared once for overlapping receivers, whatever its verb.
 */
export interface LexicaConditionDeclaration {
    /** Its name, words of letters and digits joined by hyphens, as `focus-within` is. */
    name: string;
    /** The verb that asks it, its one kind of Boolean question: `is` a state, the default, `has` a possession or a presence, and `supports` a capability. */
    verb?: 'is' | 'has' | 'supports';
    /** The key of the function that tests it, among the module's functions, which takes what a member's does, its name as the one argument, and answers a Boolean. */
    function: string;
    /** The types it applies to, in Lexica's notation. */
    on: string | string[];
    changes: 'constant' | 'observable' | 'partly-observable' | 'unobserved';
    reads: 'fresh' | 'maintained';
    /** The changes a partly observable condition's observations miss. */
    misses?: string;
    /** The observations that cover its changes, which an observable or partly observable condition names and no other does. */
    observations?: LexicaObservationDeclaration[];
}

/**
 * The functions that carry a module's members, observation types, conversions and conditions out, by the key each declaration names.
 * A member takes its receiver, its arguments by name and the environment, and a member that reads maintained values also their values, in the order its declaration names the observations; it is not called while one of them is pending.
 * A structure a member or an action answers is taken by its declared fields alone, read as the value offers them, getters included.
 * An event source takes its receiver, its arguments and the environment, and the function it delivers each event to, and returns an object whose `stop` ends the listening.
 * An action takes its receiver, its arguments, the environment and `{ signal }`, and returns its result or a promise of it.
 * A behavior takes its receiver, its arguments, the environment and `{ reportError }`, starts before it returns, and returns an object whose `update(receiver, args)` applies new arguments and whose `dispose` ends it.
 * An observation type takes the request, the function it calls when something may have changed and the environment, and returns an object whose `stop` ends the observation and, for a maintained one, whose `sample` returns its latest sample as `{ pending, value }`, pending until the first arrives.
 * A condition takes what a member does, its name as `{ name }`, and answers a Boolean.
 * A conversion takes the value, never null, and a `LexicaConversionContext`, reads nothing else, and returns the converted value, of the type it converts to, or calls `reject` where the value has none; `to` fails for a rejected value, and `try … to "type"` answers null.
 */
export type LexicaModuleFunctions = Record<string, (...args: any[]) => unknown>;

/** A vocabulary's members as data, and the functions that carry them out. */
export interface LexicaModule {
    readonly name: string;
    readonly members: readonly LexicaMemberDeclaration[];
    readonly types: readonly { readonly name: string; readonly fields: Readonly<Record<string, string>> }[];
    readonly eventTypes: readonly { readonly name: string; readonly data: string }[];
    readonly observationTypes: readonly LexicaObservationTypeDeclaration[];
    readonly conversions: readonly LexicaConversionDeclaration[];
    readonly conditions: readonly LexicaConditionDeclaration[];
    readonly functions: LexicaModuleFunctions | null;
}

/**
 * What an evaluation tells of a value it answers, beside the value and never part of it: the origin, a token for the expression that produced it, the same token exactly where one expression of one resolution,
 * with one candidate selected, produced two values; the tolerance the producing member declares, applying to every number within the value but a part with a record of its own; the records of the fields
 * an object expression built and of the items a projection built, with the reference each item came from. A part with no record inherits its parent's origin and tolerance, and a record's null tolerance overrides it.
 */
export interface LexicaResultMetadata {
    readonly origin: object;
    readonly tolerance: number | null;
    readonly fields?: Readonly<Record<string, LexicaResultMetadata>>;
    readonly items?: readonly LexicaResultMetadata[];
    readonly sources?: readonly unknown[] | null;
}

/** A member's invocation, as the hooks receive it: its declaration as its module declared it, its receiver, its arguments by parameter name, and where it stands. */
export interface LexicaInvocationRequest {
    readonly declaration: object;
    readonly receiver: unknown;
    readonly args: Readonly<Record<string, unknown>>;
    readonly pointer: string;
}

/** How an evaluation ended: completed, pending where a sample a member read was pending, or failed. */
export type LexicaEvaluationOutcome = { readonly kind: 'completed' | 'pending'; readonly value: unknown } | { readonly kind: 'failed'; readonly error: unknown };

/** What a host gives an evaluation's hooks, each optional. */
export interface LexicaHost {
    /** Called before a member's implementation is invoked: answers a maintained member's samples, that one is pending, the implementation then not invoked, or nothing. */
    beforeInvoke?(request: LexicaInvocationRequest): readonly unknown[] | { readonly pending: true } | undefined;
    /** Called after an implementation answered a value of its member's result type. */
    afterInvoke?(request: LexicaInvocationRequest, value: unknown): void;
    /** Called once as the evaluation ends; its failure after a success fails the evaluation, and after a failure is recorded on it as its `suppressed`. */
    afterEvaluation?(outcome: LexicaEvaluationOutcome): void;
}

/** What an evaluation answers: the detached value, whether a member it read was pending, and the metadata that describes the value. */
export interface LexicaEvaluation {
    readonly value: unknown;
    readonly isPending: boolean;
    readonly metadata: LexicaResultMetadata;
}

/** An evaluator of a resolution: one binding set and the environment the host owns, evaluating one evaluation at a time while its registry stays at the resolution's revision. */
export interface LexicaEvaluator {
    evaluate(host?: LexicaHost | null): LexicaEvaluation;
    project(event: unknown, host?: LexicaHost | null): LexicaEvaluation;
    resolveSource(): object | null;
    resolveAction(): object | null;
    resolveBehavior(): object;
    projectResult(result: unknown, execution?: { wasExecuted?: boolean }): unknown;
}

/** A declaration a resolution uses, with the name a message gives it and where it is used. */
export interface LexicaUsedDeclaration {
    readonly declaration: object;
    readonly name: string;
    readonly pointer: string;
}

/** An expression resolved against a registry with bindings of one resolution key, reused with any bindings of that key while the registry stays at the revision it was resolved at. */
export interface LexicaResolution {
    readonly definition: LexicaDefinition;
    readonly kind: 'value' | 'subscription' | 'action' | 'behavior';
    /** The type of the result, in type notation. */
    readonly type: string;
    readonly usedDeclarations: readonly LexicaUsedDeclaration[];
    /** The type a result path reaches, in type notation, refusing a path the type does not hold. */
    typeAt(path: readonly (string | number)[]): string;
    /** Where a pointer stands in the source the definition was read from. */
    locate(pointer: string): LexicaErrorLocation;
    /** An evaluator holding bindings of this resolution's key and the environment the host gives it. */
    createEvaluator(bindings: LexicaBindings | LexicaBindingValues, env?: unknown): LexicaEvaluator;
}

/** A registry a host resolves expressions against: Lexica's own module and the modules the host registers. No registry is shared. */
export interface LexicaRegistry {
    /** Registers a module's vocabulary, which every expression resolved afterwards may use. */
    registerModule(module: LexicaModule): void;
    /** The names of the modules registered, Lexica's own first. */
    readonly moduleNames: readonly string[];
    /** A number that changes whenever the registry's vocabulary does, so a host that keeps resolutions knows when to resolve again. */
    readonly revision: number;
    /** The observation type of the name, as the module that declares it declared it. */
    getObservationType(name: string): object | undefined;
    /** The name of the module that declares the declaration. */
    getOwner(declaration: object): string | undefined;
    /** The function that carries the declaration out, as its module supplies it. */
    getFunction(declaration: object): ((...args: any[]) => unknown) | undefined;
    /** Resolves a source against the registered vocabulary and the bindings, or throws where it does not resolve. */
    resolve(source: string | LexicaDefinition, bindings?: LexicaBindings | LexicaBindingValues): LexicaResolution;
}

/** The declaration helpers, each giving a declaration as a module declares it. */
export interface LexicaDeclarations {
    property(name: string, on: string | readonly string[], result: string, options?: object): LexicaMemberDeclaration;
    /** A member the expression calls with arguments. */
    function(name: string, on: string | readonly string[], result: string, options?: object): LexicaMemberDeclaration;
    condition(name: string, on: string | readonly string[], implementation: string, options?: object): LexicaConditionDeclaration;
    valueParameter(name: string, type: string, options?: object): LexicaParameterDeclaration;
    expressionParameter(type: string, options?: object): LexicaParameterDeclaration;
    predicateParameter(options?: object): LexicaParameterDeclaration;
}

/** Result paths: a path's shape checked, and the value it reaches in a result. */
export interface LexicaPaths {
    check(path: readonly (string | number)[]): void;
    valueAt(value: unknown, path: readonly (string | number)[]): unknown;
}

/** Which build this is and which specification it follows. */
export interface LexicaInfo {
    /** The version of this build of the library. */
    readonly version: string;
    /** The version of the specification it follows. */
    readonly specificationVersion: string;
    /** The version of the definition format it reads and writes. */
    readonly definitionVersion: number;
}

export interface Lexica {
    /** Reads a text into its definition, refusing a syntax error or a structure the definition cannot have. */
    parse(text: string): LexicaDefinition;
    /** Checks a definition given directly, answering it frozen, as a text giving it would. */
    validate(definition: unknown): LexicaDefinition;
    /** The canonical text of a text or a definition. */
    format(source: string | LexicaDefinition): string;
    /** The canonical text of a text or a definition on one line, as a diagnostic quotes it. */
    quote(source: string | LexicaDefinition): string;
    /** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
    locate(definition: LexicaDefinition, pointer: string): LexicaErrorLocation;
    /** Creates a module from the vocabulary it declares and the functions that carry its members out. */
    createModule(name: string, contents: LexicaModuleContents, functions?: LexicaModuleFunctions | null): LexicaModule;
    readonly declarations: LexicaDeclarations;
    /** Creates a registry of Lexica's own module and the modules given, which the host registers more modules with. */
    createRegistry(modules?: readonly LexicaModule[]): LexicaRegistry;
    /** Binds values by name: data as a frozen copy, each reference as itself. */
    bind(values?: LexicaBindingValues): LexicaBindings;
    readonly paths: LexicaPaths;
    readonly info: LexicaInfo;
}

export declare const lexica: Lexica;
