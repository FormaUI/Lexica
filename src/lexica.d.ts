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
    | { readonly kind: 'it' }
    | { readonly kind: 'root' }
    /** A module's namespace, the target of a member read or a call through it alone. */
    | { readonly kind: 'namespace'; readonly name: string }
    | { readonly kind: 'local'; readonly name: string }
    | { readonly kind: 'member'; readonly target: LexicaDefinitionNode; readonly name: string | LexicaDefinitionNode; readonly optional?: true }
    | { readonly kind: 'call'; readonly target: LexicaDefinitionNode; readonly name: string; readonly optional?: true; readonly arguments: readonly LexicaDefinitionNode[] }
    | { readonly kind: 'indexer'; readonly target: LexicaDefinitionNode; readonly argument: LexicaDefinitionNode; readonly optional?: true }
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
    /** The type the value bound to the name gives it, in type notation, as `List<Number?>`. */
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
    /** The field of the declaration a module error is about, as `updates.misses`. */
    field?: string;
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

/** An argument of the member with a prefix joined to it, for a value parameter of type `String`, as `{ argument: 'name', prefix: 'aria-' }` names the attribute `aria-` and the name. */
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
    /** What it observes: the receiver; a target the module declaring its type declares, by its name; or the argument of the member that names it. A member without a target has no receiver, and observes neither it nor a target found from it. */
    of: string | LexicaArgumentReference;
    [argument: string]: LexicaObservationValue | undefined;
}

/** How a member changes and reads, the changes it misses, the tolerance it is compared within and the observations that cover its changes. */
export interface LexicaUpdates {
    changes: LexicaChangeCategory;
    reads: LexicaReadingMode;
    /** The changes a partly observable declaration's observations miss; required where it is partly observable, and refused otherwise. */
    misses?: string;
    /** How far a number it returns, or each number a structured result of it holds, may move before a host reports a different result; taken by a numeric or a structured result alone. */
    tolerance?: number;
    /** The observations that cover its changes, which an observable or partly observable declaration names and no other does. */
    observations?: LexicaObservationDeclaration[];
}

/** What an implementation of an observation type receives: the request it observes, the function it calls when something may have changed, and the environment. */
export interface LexicaObservationImplementationInput {
    readonly request: Readonly<Record<string, unknown>>;
    readonly notify: () => void;
    readonly env: unknown;
}

/** A type of observation: what its observations provide, and the implementation that starts one. */
export interface LexicaObservationTypeDeclaration {
    name: string;
    /** A signal that a result may have changed, or a sampled value a member reads. */
    contract: 'invalidation' | 'maintained';
    /** The arguments that belong to the identity of an observation, beside its target. */
    identity?: string[];
    /** Whether equivalent requests share one observation; one that is not shared is kept for each of its host's evaluations alone. */
    shared?: boolean;
    /** Starts an observation, and answers an object whose `stop` ends it and, for a maintained one, whose `sample` answers its latest sample as `{ pending, value }`, pending until the first arrives. */
    implementation?: (input: LexicaObservationImplementationInput) => { stop(): void; sample?(): { pending: boolean; value?: unknown } };
}

/** A type selector, through which a function's fixed argument selects the type of its result: declared by its name alone. */
export interface LexicaTypeSelectorDeclaration {
    name: string;
}

/** One key of a type selector, named by the key, and the type it maps to. */
export interface LexicaSelectableTypeDeclaration {
    /** The key, which a fixed argument gives. */
    name: string;
    /** The type selector the key belongs to. */
    selector: string;
    /** The type the key maps to, in Lexica's notation. */
    type: string;
}

/** A target a module's observation types observe besides the receiver and an argument of the member, which the host resolves. */
export interface LexicaObservationTargetDeclaration {
    /** Its name, which an observation's `of` gives, and never `receiver`. */
    name: string;
    /** Whether it is found from the receiver, so a member without a target observes none of it, or independent of it, the default. */
    from?: 'receiver';
    /** Whether it is several targets, each observed alike, which a maintained observation never observes, or one, the default. */
    count?: 'many';
}

/** What an implementation of a conversion receives: the value, never null, and `reject`. */
export interface LexicaConversionImplementationInput {
    readonly value: unknown;
    /**
     * Rejects the value, which has no conversion, with a reason that is a diagnostic string. It throws a signal private to Lexica and to this attempt at the conversion,
     * so it never returns and the implementation stops where it calls it, unlike a promise's `reject`. Any other exception it throws, and a value not of the type it converts to, is a fault.
     */
    reject(reason: string): never;
}

/** A conversion from one type of data to another, which `to` asks for: a value already of a type converts to itself, so none is declared from a type to itself. */
export interface LexicaConversionDeclaration {
    /** The type it converts from: `Number`, `String`, `Boolean` or a structured type. */
    from: string;
    /** The type it converts to: `Number`, `String`, `Boolean` or a structured type. */
    to: string;
    /** Converts the value, reading nothing else, and answers the converted value, of the type it converts to, or calls `reject` where the value has none. */
    implementation?: (input: LexicaConversionImplementationInput) => unknown;
}

/** A parameter of a member. */
export interface LexicaParameterDeclaration {
    name: string;
    /**
     * A value; an expression, a body of each item, written as an expression evaluated against it or as a function of it; a predicate, an expression of any value whose truthiness the implementation receives; or a function: an arrow function, a function a name holds, a module's function
     * by reference or an implicit body, which the implementation calls while its own invocation lasts and only a member of kind `function` takes.
     */
    kind: 'value' | 'expression' | 'predicate' | 'function';
    /** The parameter's type, in Lexica's notation; a predicate's is `Boolean`, what the implementation receives, and a function parameter's the type of its function's result. */
    type: string;
    /** The types its function is called with, in order, in Lexica's notation, which may write a type parameter its member's target binds; only a function parameter declares them. */
    parameters?: string[];
    required: boolean;
    default?: unknown;
    /** Whether the argument names something the vocabulary resolves before any evaluation; a fixed parameter is a value parameter of type `String`. */
    fixed?: boolean;
    /** What a fixed parameter names, and only a fixed one: a type, which a function's result writes as `@selected`, through the type selector `selector` names. */
    selects?: 'type';
    /** The type selector a parameter that selects a type selects through. */
    selector?: string;
    /** Whether a null argument makes the call answer null, or is accepted; a function parameter leaves it out, since a function is never null. */
    nulls?: 'propagate' | 'accept';
    /** What an expression or a predicate argument is evaluated against. */
    context?: 'item';
    /** What the member does where an optional argument is left out, said in words for its documentation. */
    omitted?: string;
}

/** What a member's implementation receives, by name: its receiver, which a module member has none of, its arguments by parameter name, the environment, and what its kind adds. */
export interface LexicaImplementationInput {
    readonly receiver?: unknown;
    readonly args: Readonly<Record<string, unknown>>;
    readonly env: unknown;
    /** A member that reads maintained values: its observations' latest samples, in the order its declaration names them. */
    readonly samples?: readonly unknown[];
}

/**
 * A property or a function a module adds, each taking the fields it needs alone; a member without a target is a module member, read through its module's namespace.
 * A property answers a value, and a function the evaluator invokes its result; a function the host invokes is a host call, which a script ends in, and has no implementation Lexica calls.
 */
export interface LexicaMemberDeclaration {
    /** The Lexica name. */
    name: string;
    kind: 'property' | 'function';
    /** Who invokes a function: the evaluator, the default, or the host, which a script ending in a call of it is prepared for; a function the host invokes takes value parameters alone, and neither updates nor an implementation. */
    invokedBy?: 'evaluator' | 'host';
    /** The types it applies to, in Lexica's notation, `any`, or a type parameter `T` that binds the receiver's type; none for a module member. */
    target?: string | string[];
    /** How a member that is no property is written: a function call, `it.device("lamp")`, the default, or a named indexer, `it.setting["mode"]`, a function whose one required value parameter is its key. A property takes none. */
    syntax?: 'function-call' | 'indexer';
    /** The form its arguments take where it has parameters, an optional one included: one for each parameter, in order, the required ones before the optional ones, or one options object whose fields supply them; an indexer's is positional. */
    arguments?: 'positional' | 'options';
    /** Whether an indexer is the default of its receivers, which `[…]` invokes, as `item` is a list's; a module designates one at most for a receiver type. */
    default?: boolean;
    /** Its parameters; a property takes none. */
    parameters?: LexicaParameterDeclaration[];
    /** The type of its result, in Lexica's notation; a host call's is the type of each value its host supplies, left out where it supplies none. */
    result?: string;
    /** How it changes and reads; a property and a function the evaluator invokes take it, and a host call refuses it. */
    updates?: LexicaUpdates;
    /** What carries it out, given one object it reads by name; a member without one is resolved against and never invoked. */
    implementation?: (input: LexicaImplementationInput) => unknown;
}

/** What a module declares. */
export interface LexicaModuleContents {
    /** The structured types it declares, each with its fields' types and the modules whose types its fields name unqualified. */
    types?: { name: string; fields: Record<string, string>; import?: string[] }[];
    /** Its members, each named as a name is; a test of a receiver is a function whose result is a boolean. */
    members?: LexicaMemberDeclaration[];
    /** The type selectors it declares, each by its name alone, named once across every module. */
    typeSelectors?: LexicaTypeSelectorDeclaration[];
    /** The keys it declares for type selectors, its own or a module's registered before it, each once in its selector. */
    selectableTypes?: LexicaSelectableTypeDeclaration[];
    /** The types of observation it declares. */
    observationTypes?: LexicaObservationTypeDeclaration[];
    /** The targets its observation types observe besides the receiver and an argument of the member, each named once. */
    observationTargets?: LexicaObservationTargetDeclaration[];
    /** The conversions it declares, each to or from one of its own types, and one for each source and target. */
    conversions?: LexicaConversionDeclaration[];
}

/** A vocabulary's declarations as data, each that runs code carrying its implementation. */
export interface LexicaModule {
    readonly name: string;
    readonly types: readonly { readonly name: string; readonly fields: Readonly<Record<string, string>>; readonly import?: readonly string[] }[];
    readonly members: readonly LexicaMemberDeclaration[];
    readonly typeSelectors: readonly LexicaTypeSelectorDeclaration[];
    readonly selectableTypes: readonly LexicaSelectableTypeDeclaration[];
    readonly observationTypes: readonly LexicaObservationTypeDeclaration[];
    readonly observationTargets: readonly LexicaObservationTargetDeclaration[];
    readonly conversions: readonly LexicaConversionDeclaration[];
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

/** A member's invocation, as the hooks receive it: its declaration as its module declared it, its receiver, which a module member has none of, its arguments by parameter name, and where it stands. */
export interface LexicaInvocationRequest {
    readonly declaration: object;
    readonly receiver?: unknown;
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

/** What an evaluation answers, frozen through its value and its metadata: the detached value, whether a member it read was pending, and the metadata that describes the value. */
export interface LexicaEvaluation {
    readonly value: unknown;
    readonly isPending: boolean;
    readonly metadata: LexicaResultMetadata;
}

/** An evaluator of a resolution: one binding set and the environment the host owns, evaluating one evaluation at a time while its registry stays at the resolution's revision. */
export interface LexicaEvaluator {
    /** Evaluates a script that gives a value, refusing one that ends in a host call. */
    evaluate(host?: LexicaHost | null): LexicaEvaluation;
    /** Prepares the host call a script ends in: evaluates the locals before it, then its receiver and arguments, once, refusing a script that gives a value. */
    prepareCall(): LexicaPreparedCall | LexicaSkippedCall;
}

/** A host call prepared for its host, which keeps the locals it was prepared with, apart from every other prepared call of its evaluator. */
export interface LexicaPreparedCall {
    readonly kind: 'prepared';
    readonly declaration: LexicaMemberDeclaration;
    /** Its receiver, a qualified form's first argument, which a module member has none of. */
    readonly receiver?: unknown;
    /** Its arguments, by parameter name. */
    readonly args: Readonly<Record<string, unknown>>;
    readonly location: LexicaErrorLocation;
    /**
     * Projects one value its host supplies: checks it against the call's declared result, then evaluates the result projection against it, reading the locals the call was prepared with, as an evaluation for the host given;
     * a call whose host supplies nothing has none.
     */
    readonly project?: (value: unknown, host?: LexicaHost | null) => LexicaEvaluation;
}

/** A host call there is nothing to invoke for: its receiver, or an argument whose parameter propagates null, is null, or it has no declaration yet. */
export interface LexicaSkippedCall {
    readonly kind: 'skipped';
    readonly location: LexicaErrorLocation;
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
    /** The host call the script ends in, null for a script that gives a value. */
    readonly hostCall: LexicaHostCall | null;
    /** The type of the result, in type notation, null for a host call whose host supplies no values. */
    readonly type: string | null;
    readonly usedDeclarations: readonly LexicaUsedDeclaration[];
    /** The type a result path reaches, in type notation, refusing a path the type does not hold. */
    typeAt(path: readonly (string | number)[]): string;
    /** Where a pointer stands in the source the definition was read from. */
    locate(pointer: string): LexicaErrorLocation;
    /** An evaluator holding bindings of this resolution's key and the environment the host gives it. */
    createEvaluator(bindings: LexicaBindings | LexicaBindingValues, env?: unknown): LexicaEvaluator;
}

/** The host call a script ends in: its name, and the declaration it resolved to, null while its receiver's type is unknown. */
export interface LexicaHostCall {
    readonly name: string;
    readonly declaration: LexicaMemberDeclaration | null;
}

/** A registry a host resolves expressions against: Lexica's own module and the modules the host registers, whose names begin their namespaces in the text it reads and writes. No registry is shared. */
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
    /** The implementation that carries the declaration out, as its module gives it. */
    getImplementation(declaration: object): ((input: any) => unknown) | undefined;
    /** Reads a text into its definition with the registry's module names, refusing a syntax error or a structure the definition cannot have. */
    parse(text: string): LexicaDefinition;
    /** The canonical text of a text or a definition, written with the registry's module names, which a registry of the same module names reads back as the same definition. */
    format(source: string | LexicaDefinition): string;
    /** The canonical text of a text or a definition on one line, written with the registry's module names, as a diagnostic quotes it. */
    quote(source: string | LexicaDefinition): string;
    /** Resolves a source against the registered vocabulary and the bindings, a text read as `parse` reads it, or throws where it does not resolve. */
    resolve(source: string | LexicaDefinition, bindings?: LexicaBindings | LexicaBindingValues): LexicaResolution;
}

/** The declaration helpers, each giving a declaration as a module declares it. */
export interface LexicaDeclarations {
    property(name: string, target: string | readonly string[] | null, result: string, options?: object): LexicaMemberDeclaration;
    /** A member the expression calls with arguments, or, with `invokedBy: 'host'`, that its host invokes, its result left out where its host supplies nothing. */
    function(name: string, target: string | readonly string[] | null, result: string | undefined, options?: object): LexicaMemberDeclaration;
    valueParameter(name: string, type: string, options?: object): LexicaParameterDeclaration;
    expressionParameter(type: string, options?: object): LexicaParameterDeclaration;
    predicateParameter(options?: object): LexicaParameterDeclaration;
    /** A function parameter, always required: the types of the arguments the member calls its function with, in order, and the type of the result it takes from it. */
    functionParameter(name: string, type: string, parameters: readonly string[]): LexicaParameterDeclaration;
}

/** Result paths: a path's shape checked, and the value it reaches in a result. */
export interface LexicaPaths {
    check(path: readonly (string | number)[]): void;
    valueAt(value: unknown, path: readonly (string | number)[]): unknown;
}

/** The versions a Lexica runtime reports, which change apart. */
export interface LexicaVersions {
    /** The runtime release version, which the packages and the bundle carry. */
    readonly runtime: string;
    /** The language specification version the implementation follows. */
    readonly language: string;
    /** The definition format version the implementation supports. */
    readonly definition: number;
}

/** Which build this is and what it follows. */
export interface LexicaInfo {
    readonly versions: LexicaVersions;
}

export interface Lexica {
    /** Reads a text into its definition without a registry, knowing no module's name, refusing a syntax error or a structure the definition cannot have. */
    parse(text: string): LexicaDefinition;
    /** Checks a definition given directly, answering it frozen, as a text giving it would. */
    validate(definition: unknown): LexicaDefinition;
    /** The canonical text of a text or a definition, written without module names, so a definition reading through a namespace is refused; a registry's `format` writes one. */
    format(source: string | LexicaDefinition): string;
    /** The canonical text of a text or a definition on one line, as a diagnostic quotes it, written without module names. */
    quote(source: string | LexicaDefinition): string;
    /** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
    locate(definition: LexicaDefinition, pointer: string): LexicaErrorLocation;
    /** Creates a module from the vocabulary it declares and the functions that carry its members out. */
    createModule(name: string, contents: LexicaModuleContents): LexicaModule;
    readonly declarations: LexicaDeclarations;
    /** Creates a registry of Lexica's own module and the modules given, which the host registers more modules with. */
    createRegistry(modules?: readonly LexicaModule[]): LexicaRegistry;
    /** Binds values by name: data as a frozen copy, each reference as itself. */
    bind(values?: LexicaBindingValues): LexicaBindings;
    readonly paths: LexicaPaths;
    readonly info: LexicaInfo;
}

export declare const lexica: Lexica;
