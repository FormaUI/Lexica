/**
 * Lexica's API: reading a text into its definition, validating a definition's structure, writing its canonical text, creating the modules that declare a vocabulary
 * and the registries a host resolves scripts against.
 */

/** A script as a host gives it: its source, the text read into its definition, or the definition itself. */
export type LexicaScript = string | LexicaDefinition;

/** A Lexica definition: the JSON document that records a script's meaning, its expression tree with the version of its format and its imports, without the values its script parameters are bound to. */
export interface LexicaDefinition {
    readonly version: number;
    /** The script's imports, those its text writes and those its host supplies, each once, in order of the local name it gives. */
    readonly imports: readonly LexicaImport[];
    readonly expression: LexicaDefinitionNode;
}

/** An import, as a definition records it: its registered module, the local name of the one type it imports where it imports one, and its alias where it gives a local name other than its own. */
export interface LexicaImport {
    readonly module: string;
    readonly type?: string;
    readonly alias?: string;
}

/** An import a host supplies: a module's name, imported under its own, or an import as a definition records it. */
export type LexicaSuppliedImport = string | LexicaImport;

/** The options of reading or writing a script: the imports the host, or the text's destination, supplies. */
export interface LexicaScriptOptions {
    readonly imports?: readonly LexicaSuppliedImport[];
}

/** The extension an access selects explicitly: its name as written, and its module's local name where the module qualifies it. */
export interface LexicaDefinitionExtension {
    readonly name: string;
    readonly module?: string;
}

/** A property access, the member a call names, or a named indexer's name: its receiver, its name or a computed property access's expression, whether it is optional, and the extension it selects. */
export interface LexicaDefinitionMemberAccess {
    readonly kind: 'memberAccess';
    readonly receiver: LexicaDefinitionNode;
    readonly name: string | LexicaDefinitionNode;
    readonly optional?: true;
    readonly extension?: LexicaDefinitionExtension;
}

/** A node of a definition. */
export type LexicaDefinitionNode =
    | { readonly kind: 'literal'; readonly value: string | number | boolean | null }
    | { readonly kind: 'scriptParameter'; readonly name: string }
    | { readonly kind: 'it' }
    | { readonly kind: 'root' }
    /** A module's namespace, by the local name the script's imports give it, the receiver of a member read or called through it alone. */
    | { readonly kind: 'namespace'; readonly name: string }
    | { readonly kind: 'local'; readonly name: string }
    | LexicaDefinitionMemberAccess
    /** A call: of the member its callee names, or of the function the local its callee names holds. */
    | { readonly kind: 'call'; readonly callee: LexicaDefinitionMemberAccess | { readonly kind: 'local'; readonly name: string }; readonly arguments: readonly LexicaDefinitionNode[] }
    | { readonly kind: 'indexerAccess'; readonly receiver: LexicaDefinitionNode; readonly argument: LexicaDefinitionNode; readonly optional?: true; readonly extension?: LexicaDefinitionExtension }
    | { readonly kind: 'object'; readonly context?: LexicaDefinitionNode; readonly locals?: readonly LexicaDefinitionLocal[]; readonly objectFields: readonly LexicaDefinitionObjectField[] }
    /** A list a collection expression writes: its items in order. */
    | { readonly kind: 'list'; readonly items: readonly LexicaDefinitionNode[] }
    /** A dictionary a collection expression writes: its entries in the order written, each its key's string and its value, no two of one key. */
    | { readonly kind: 'dictionary'; readonly entries: readonly { readonly key: string; readonly value: LexicaDefinitionNode }[] }
    | { readonly kind: 'optionalChain'; readonly chain: LexicaDefinitionNode }
    | { readonly kind: 'coalescing'; readonly value: LexicaDefinitionNode; readonly fallback: LexicaDefinitionNode }
    | { readonly kind: 'not'; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'function'; readonly parameters: readonly string[]; readonly body: LexicaDefinitionNode; readonly arrow?: true }
    | { readonly kind: 'body'; readonly locals: readonly LexicaDefinitionLocal[]; readonly result: LexicaDefinitionNode }
    | { readonly kind: 'do'; readonly body: LexicaDefinitionNode }
    | { readonly kind: 'interpolatedString'; readonly parts: readonly ({ readonly kind: 'text'; readonly value: string } | { readonly kind: 'expression'; readonly expression: LexicaDefinitionNode })[] }
    | { readonly kind: 'comparison'; readonly operands: readonly LexicaDefinitionNode[]; readonly operators: readonly ('<' | '<=' | '>' | '>=')[] }
    | { readonly kind: 'arithmetic'; readonly operator: '+' | '-' | '*' | '/' | '%'; readonly left: LexicaDefinitionNode; readonly right: LexicaDefinitionNode }
    | { readonly kind: 'arithmeticNegation'; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'cast'; readonly type: string; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'conversion'; readonly type: string; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'try'; readonly operand: LexicaDefinitionNode }
    | { readonly kind: 'equality'; readonly left: LexicaDefinitionNode; readonly right: LexicaDefinitionNode }
    | { readonly kind: 'conditional'; readonly condition?: LexicaDefinitionNode; readonly binding?: { readonly name: string; readonly value: LexicaDefinitionNode }; readonly consequent: LexicaDefinitionNode; readonly alternative: LexicaDefinitionNode }
    | { readonly kind: 'and' | 'or'; readonly operands: readonly LexicaDefinitionNode[] };

/** A local of a body or an object expression: its name, which a `local` node uses, and the value it names, never output. */
export interface LexicaDefinitionLocal {
    readonly name: string;
    readonly value: LexicaDefinitionNode;
}

/** An object field of an object expression: its name, always written, and its value. */
export interface LexicaDefinitionObjectField {
    readonly name: string;
    readonly value: LexicaDefinitionNode;
}

/** The values supplied by parameter name, each typed from the value itself. */
export interface LexicaBindingValues {
    [name: string]: unknown;
}

/** Bindings as a registry's `createBindings` creates them, the registry's own: data a frozen copy of the data given, each reference itself, and the resolution key that says which resolutions they may reuse. */
export interface LexicaBindings {
    /** Each binding's type by its qualified identity, with each primitive binding's value, which a resolution is reused with. */
    readonly resolutionKey: string;
    /** Whether a value is bound to the name. */
    has(name: string): boolean;
    /** Reads the value bound to the name: data as a frozen copy, a reference as itself. */
    readValue(name: string): unknown;
    /** The type the value bound to the name gives it, or its host declared for it, in type notation, as `List<Number?>`. */
    getType(name: string): string | undefined;
}

/** How a registry binds values: the reference type declared for a top-level binding, by its name, unqualified or qualified by its module, in place of recognizing its value. */
export interface LexicaBindingsOptions {
    types?: Record<string, string>;
}

/** A reference type a module declares: its name, the supertype it names, whether it is abstract, the modules whose types its declaration names unqualified, its own members included, the membership a value of it passes, and its own members. */
export interface LexicaReferenceTypeDeclaration {
    name: string;
    kind: 'reference';
    /** Whether the value belongs to the type, answered synchronously, changing nothing. */
    isInstance(value: unknown): boolean;
    supertype?: string;
    abstract?: boolean;
    import?: string[];
    /** The members it declares within it, each taking it as its receiver. */
    members?: LexicaMemberDeclaration[];
    /** Whether it is available within its declaring module alone, `false` where left out: no other module's declaration names it, and no script reaches it; its members are internal with it. */
    internal?: boolean;
}

/** A structured type a module declares, a type of immutable data: its name, the modules whose types its declaration names unqualified, its own members included, and its own members, its data shape among them. */
export interface LexicaStructuredTypeDeclaration {
    name: string;
    kind: 'structured';
    import?: string[];
    /**
     * The members it declares within it, each taking it as its receiver: its data shape is the properties it declares without `updates`, each naming its value's type as its `result`, which
     * Lexica reads from the data and never invokes, so each takes no `impl`.
     */
    members?: LexicaMemberDeclaration[];
    /** Whether it is available within its declaring module alone, `false` where left out: no other module's declaration names it, and no script reaches it; its members are internal with it. */
    internal?: boolean;
}

/**
 * An extension a module declares among its types: the members it adds to its one target, a type another module owns, one of Lexica's own or a parameter it declares, which its members take as their receiver. It is
 * never a value's type.
 */
export interface LexicaExtensionDeclaration {
    /** Its local name, and the type parameters its target and its members share, `ListExtensions<T>`. */
    name: string;
    kind: 'extension';
    /** The type its members extend, never `Any` or nullable: a foreign type qualified, one of Lexica's own, or a parameter it declares. */
    target: string;
    /** The members it adds, each taking its target as its receiver. */
    members?: LexicaMemberDeclaration[];
    /** Whether it is available within its declaring module alone, `false` where left out; its members are internal with it. */
    internal?: boolean;
}

/** A type a module declares, of the kind it says, or an extension it declares among its types. */
export type LexicaTypeDeclaration = LexicaReferenceTypeDeclaration | LexicaStructuredTypeDeclaration | LexicaExtensionDeclaration;

/** The input a projection was given for an item, of the kind its established type gives it: a reference as the host holds it, data as Lexica's own frozen copy, or null; a source and a provenance entry alike. */
export type LexicaProjectionSource = { readonly kind: 'reference'; readonly value: unknown } | { readonly kind: 'data'; readonly value: unknown } | { readonly kind: 'null' };

/**
 * Where something stands, by one group of attributes, never two: in a script, `pointer`, a JSON Pointer into its definition, with `offset`, `line` and `column` where the definition was read from text, and those three
 * alone for a syntax error, which stands in text no definition holds yet; in a module, `module`, with `type` where it concerns a declaration nested in a type, `declaration` where it concerns a declaration, and `declarationKey`, the key it concerns, a declaration's or, with no
 * declaration, the module's own; or in the bindings, `binding`. A failure of the API's use that stands nowhere, as bindings another registry made, holds none. `getLocation` answers the script group; an error, any one.
 */
export interface LexicaLocation {
    /** The node's JSON Pointer into the definition. */
    pointer?: string;
    offset?: number;
    line?: number;
    column?: number;
    binding?: string;
    module?: string;
    /** The type a declaration nested in it stands in, a member a type declares within it. */
    type?: string;
    declaration?: string;
    /** The key it concerns, a declaration's, as `updates.misses`, or the module's own. */
    declarationKey?: string;
}

/** A failure of Lexica, in the stage it happened in, and where. Its `name` is `LexicaError`. */
export declare class LexicaError extends Error {
    private constructor();
    readonly name: 'LexicaError';
    /** The code of the condition that failed: `LEXICA` and four digits for Lexica's own, in its kind's range, and a host's own prefix for a host's. */
    readonly code: string;
    /** The kind of the failure: `syntax`, text that breaks the grammar; `structure`, what a caller gave breaking a structural rule, a definition `lexica.validate` refuses among it; `validation`, a script resolution finds does not fit its vocabulary or its types; `module`, a declaration breaking its contract; `evaluation`, a failure while evaluating. */
    readonly kind: 'syntax' | 'structure' | 'validation' | 'module' | 'evaluation';
    readonly location: LexicaLocation;
    /** A failure of what a caller gave: bindings, a definition's structure or a host's use of the API. */
    static structure(code: string, message: string, location: LexicaLocation): LexicaError;
    /** A script resolution finds does not fit its vocabulary or its types, before anything is evaluated. */
    static validation(code: string, message: string, location: LexicaLocation): LexicaError;
    /** A failure while evaluating, with what caused it. */
    static evaluation(code: string, message: string, location: LexicaLocation, options?: { cause?: unknown }): LexicaError;
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

/** An argument an observation gives its observation type: a literal, a reference to an argument of the member, which can carry a prefix, or a list of them. */
export type LexicaObservationArgument = string | number | boolean | null | LexicaArgumentReference | LexicaPrefixedArgumentReference | LexicaObservationArgument[];

/** An observation that covers a member's changes: its type, what it observes, and the arguments its type takes. */
export interface LexicaObservationDeclaration {
    /** The name of the type of observation, which a module declares. */
    type: string;
    /** What it observes: the receiver; a target the module declaring its type declares, by its name; or the argument of the member that names it. A module member takes no receiver, and observes neither it nor a target found from it. */
    of: string | LexicaArgumentReference;
    [argument: string]: LexicaObservationArgument | undefined;
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

/** What an implementation of an observation type receives: the request it observes, `{ type, target, arguments }`, as the specification's observation types define it, the function it calls when something may have changed, and the environment. */
export interface LexicaObservationTypeImplementationInput {
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
    impl?: (input: LexicaObservationTypeImplementationInput) => { stop(): void; sample?(): { pending: boolean; value?: unknown } };
}

/** A type selector, through which a function's fixed argument selects the type of its result: declared by its name alone. */
export interface LexicaTypeSelectorDeclaration {
    name: string;
}

/** A mapping of one key of a type selector to the type it maps to, its selector and its key its identity. */
export interface LexicaMappingDeclaration {
    /** The type selector the key belongs to. */
    selector: string;
    /** The key, any string, as a fixed argument gives it. */
    key: string;
    /** The type the key maps to, in Lexica's notation. */
    type: string;
}

/** A target a module's observation types observe besides the receiver and an argument of the member, which the host resolves. */
export interface LexicaObservationTargetDeclaration {
    /** Its name, which an observation's `of` gives, and never `receiver`. */
    name: string;
    /** Whether it is found from the receiver, so a module member observes none of it, or independent of it, the default. */
    from?: 'receiver';
    /** Whether it is several targets, each observed alike, which a maintained observation never observes, or one, the default. */
    count?: 'many';
}

/** What an implementation of an operator receives: the value, never null, and `reject`. */
export interface LexicaOperatorImplementationInput {
    readonly value: unknown;
    /**
     * Rejects the value, which the operator does not cast or convert, with a reason that is a diagnostic string. It throws a signal private to Lexica and to this attempt at the operator,
     * so it never returns and the implementation stops where it calls it, unlike a promise's `reject`. Any other exception it throws, and a value not of its destination, is a fault.
     */
    reject(reason: string): never;
}

/** A parameter of a member. */
export interface LexicaParameterDeclaration {
    name: string;
    /**
     * A value; an expression, a body of each item, written as an expression evaluated against it or as a function of it; a predicate, an expression of any value whose truthiness the implementation receives; or a function: an arrow function, a function a name holds, a module's function
     * by reference or an implicit body, which only a member of kind `function` takes. The implementation receives an expression, a predicate and a function as a function it calls only while its own invocation lasts, with the
     * arguments its contract declares: one item for an expression and a predicate.
     */
    kind: 'value' | 'expression' | 'predicate' | 'function';
    /** The parameter's type, in Lexica's notation; a predicate's is `Boolean`, what the implementation receives, and a function parameter's the type of its function's result. */
    type: string;
    /** The types its function is called with, in order, in Lexica's notation, which may write a type parameter its member's receiver binds; only a function parameter declares them, beside its member's `parameters`, which are declarations. */
    parameterTypes?: string[];
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
export interface LexicaMemberImplementationInput {
    readonly receiver?: unknown;
    readonly args: Readonly<Record<string, unknown>>;
    readonly env: unknown;
    /** A member that reads maintained values: its observations' latest samples, in the order its declaration names them. */
    readonly samples?: readonly unknown[];
}

/**
 * A property, a function, an indexer or an operator a module declares, each taking the fields it needs alone: within a type, whose receiver the type is, within an extension, whose receiver its target is, or among the module's
 * `members`, a module member, which takes no receiver and is read through its module's namespace.
 * A property answers a value, and a function the evaluator invokes its result; a script ending in a call of a function the host invokes ends in a host call, and the function has no implementation Lexica calls.
 */
export interface LexicaMemberDeclaration {
    /** The Lexica name, and the type parameters it declares in angle brackets after it, `identity<T>`, where it is declared within a type, an extension or the module; left out for an unnamed indexer, which brackets after its receiver invoke. */
    name?: string;
    /** A property, read by its name; a function, called; an indexer, given its one key in brackets, after its name, `it.setting["mode"]`, or, unnamed, after its receiver, `rooms[0]`; or an operator, named `cast` or `convert`, which `as` or `to` invokes. */
    kind: 'property' | 'function' | 'indexer' | 'operator';
    /** Who invokes a function: the evaluator, the default, or the host, which a script ending in a call of it is prepared for; a function the host invokes takes value parameters alone, and neither updates nor an implementation. */
    invokedBy?: 'evaluator' | 'host';
    /** The form its arguments take where it has parameters, an optional one included: one for each parameter, in order, the required ones before the optional ones, or one options object whose fields supply them; a function alone takes it, since an indexer's one key is positional. */
    arguments?: 'positional' | 'options';
    /** Its parameters; a property takes none. */
    parameters?: LexicaParameterDeclaration[];
    /** The type of its result, in Lexica's notation, an operator's its destination; a function the host invokes declares the type of each value its host supplies, left out where it supplies none. */
    result?: string;
    /** How it changes and reads; a property and a function the evaluator invokes take it, and a function the host invokes refuses it. */
    updates?: LexicaUpdates;
    /** What carries it out, given one object it reads by name, an operator's its value and `reject`; a member without one is resolved against and never invoked, and a cast operator without one answers its value. */
    impl?: ((input: LexicaMemberImplementationInput) => unknown) | ((input: LexicaOperatorImplementationInput) => unknown);
    /** Whether it is available within its declaring module alone, `false` where left out: no other module's declaration names it, and no script reaches it; a member within an internal type is internal whatever it says. */
    internal?: boolean;
}

/** What a module declares. */
export interface LexicaModuleContents {
    /** Its recognition of a host's value: the name of the most specific of its own reference types the value is of, or null. */
    typeOf?(value: unknown): string | null;
    /** The reference types and the structured types it declares, and its extensions. */
    types?: LexicaTypeDeclaration[];
    /** Its module members, each named as a name is, which take no receiver; a member of a type stands within the type or an extension of it. */
    members?: LexicaMemberDeclaration[];
    /** The type selectors it declares, each by its name alone, named once across every module. */
    typeSelectors?: LexicaTypeSelectorDeclaration[];
    /** The keys it maps for type selectors, its own or a module's registered before it, each once in its selector. */
    mappings?: LexicaMappingDeclaration[];
    /** The types of observation it declares. */
    observationTypes?: LexicaObservationTypeDeclaration[];
    /** The targets its observation types observe besides the receiver and an argument of the member, each named once. */
    observationTargets?: LexicaObservationTargetDeclaration[];
}

/** A vocabulary's declarations as data, each that runs code carrying its implementation. */
export interface LexicaModule {
    readonly name: string;
    readonly typeOf: ((value: unknown) => string | null) | undefined;
    readonly types: readonly Readonly<LexicaTypeDeclaration>[];
    readonly members: readonly LexicaMemberDeclaration[];
    readonly typeSelectors: readonly LexicaTypeSelectorDeclaration[];
    readonly mappings: readonly LexicaMappingDeclaration[];
    readonly observationTypes: readonly LexicaObservationTypeDeclaration[];
    readonly observationTargets: readonly LexicaObservationTargetDeclaration[];
}

/**
 * A dictionary as an implementation receives one, immutable: its entries in their order, each key once by Lexica's key equality. A host gives one as a `Map` where a declaration names a `Dictionary<K, V>`, and a result
 * exports one as `{ entries: [{ key, value }, …] }`.
 */
export interface LexicaDictionary<K = unknown, V = unknown> {
    readonly count: number;
    /** Whether it holds the key, a key whose value is null among them. */
    has(key: K): boolean;
    /** The key's value, or null where it holds no such key. */
    get(key: K): V | null;
    /** The key's entry, or null where it holds no such key. */
    getEntry(key: K): LexicaPair<K, V> | null;
    readonly keys: readonly K[];
    readonly values: readonly V[];
    readonly entries: readonly LexicaPair<K, V>[];
}

/** A pair as an implementation receives one, immutable: a key and its value. A host gives one as `{ key, value }` where a declaration names a `Pair<K, V>`, and a result exports one so. */
export interface LexicaPair<K = unknown, V = unknown> {
    readonly key: K;
    readonly value: V;
}

/**
 * What an evaluation tells of a value it answers, beside the value and never part of it: the origin, a token for the expression that produced it, the same token exactly where one expression of one resolution,
 * with one candidate selected, produced two values; the tolerance the producing member declares, applying to every number within the value but a part with a record of its own; the records of the object fields
 * an object expression built and of the items a projection built, with the input each item came from, a list no projection built having no sources; and each such item's provenance. A part with no record inherits its
 * parent's origin and tolerance, and a record's null tolerance overrides it.
 */
export interface LexicaResultMetadata {
    readonly origin: object;
    readonly tolerance: number | null;
    readonly objectFields?: Readonly<Record<string, LexicaResultMetadata>>;
    readonly items?: readonly LexicaResultMetadata[];
    /** The input each item of a list a projection built came from, its immediate input, a null one included; absent for a list no projection built. */
    readonly sources?: readonly LexicaProjectionSource[];
    /**
     * Each item's provenance, beside `sources`: the source the earliest projection the item descends from recorded for it, so a list projected from a projection's items names the references the first projection read, and a
     * projection of a list that carries none records its own sources here too. Absent wherever `sources` is, entries repeated where an input repeats, and never a key nor a promise of a unique correspondence.
     */
    readonly provenance?: readonly LexicaProjectionSource[];
}

/** What a member's invocation is, as a hook's request and a prepared host call each give it: its declaration as its module declared it, its receiver, which a module member has none of, its arguments by parameter name, and where the call stands. */
export interface LexicaInvocationRequest {
    readonly declaration: LexicaMemberDeclaration;
    /** Its receiver, a qualified form's first argument, which a module member has none of. */
    readonly receiver?: unknown;
    /** Its arguments, by parameter name. */
    readonly args: Readonly<Record<string, unknown>>;
    /** Where the call stands in the definition, a JSON Pointer `getLocation` expands; a call within a script function's body names the part of the body it is, whichever call of the function reached it. */
    readonly pointer: string;
    /** Whether the member was selected as it was evaluated, its receiver a value of `Any`, rather than by resolution; a prepared host call never is. */
    readonly isDeferred: boolean;
}

/** How an evaluation ended: completed, pending where a sample a member read was pending, or failed. */
export type LexicaEvaluationOutcome = { readonly kind: 'completed' | 'pending'; readonly value: unknown } | { readonly kind: 'failed'; readonly error: unknown };

/** The hooks a host gives an evaluation, each optional. */
export interface LexicaEvaluationHooks {
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
    evaluate(hooks?: LexicaEvaluationHooks | null): LexicaEvaluation;
    /** Prepares the host call a script ends in: evaluates the locals before it, then its receiver and arguments, once, without hooks, as `evaluate` given none evaluates, refusing a script that gives a value. */
    prepareHostCall(): LexicaPreparedCall | LexicaSkippedCall;
}

/** A host call prepared for its host: the invocation its host carries out, which keeps the locals it was prepared with, apart from every other prepared call of its evaluator. */
export interface LexicaPreparedCall extends LexicaInvocationRequest {
    readonly kind: 'prepared';
    /**
     * Projects one value its host supplies: checks it against the call's declared result, then evaluates the result projection against it, reading the locals the call was prepared with, as an evaluation with the hooks given;
     * a call whose host supplies nothing has none. Checking a reference asks the `isInstance` of the declared type and its supertypes, and the modules' `typeOf` where it does not belong, and the evaluation calls
     * the host's hooks as `evaluate` does. It refuses a value the declared result does not admit (LEXICA5015), a registry moved past the resolution (LEXICA2040), and a projection while its evaluator is evaluating (LEXICA5010).
     */
    readonly project?: (value: unknown, hooks?: LexicaEvaluationHooks | null) => LexicaEvaluation;
}

/** A host call there is nothing to invoke for: its receiver, or an argument whose parameter propagates null, is null, or it has no declaration yet. */
export interface LexicaSkippedCall {
    readonly kind: 'skipped';
    /** Where the call stands in the definition, a JSON Pointer `getLocation` expands. */
    readonly pointer: string;
}

/** A declaration a resolution uses, a member or an operator, with its names and where it is used. */
export interface LexicaUsedDeclaration {
    readonly declaration: object;
    /** Its declared name, as `total`, an operator's `convert` or `cast`, and null for an unnamed indexer. */
    readonly name: string | null;
    /**
     * The name a message gives it: qualified by the first of its declaration's receiver types the receiver applies to it by, as `String.total`, or by its module, as `shop.greet`, for a module member or a function referenced
     * through its namespace; its declared name alone where that receiver type is any receiver or a type parameter; an unnamed indexer's brackets after its type, as `List[]`; and an operator by the syntax that
     * invokes it, as `String to Number` and `Meter as Device`. A candidate declaration is qualified by the type it is declared for, its type's or its extension's target.
     */
    readonly qualifiedName: string;
    /** Where it is used, a definition pointer `getLocation` expands; a declaration a script function's body uses is used once at its place in the body, whichever calls reach it. */
    readonly pointer: string;
}

/** An access whose member is selected during evaluation, by its receiver's actual type, since its receiver is a value of `Any`. */
export interface LexicaDeferredAccess {
    /** The name it accesses, null for an unnamed indexer. */
    readonly name: string | null;
    /** Where it stands, a definition pointer `getLocation` expands; an access in a script function's body is reported once, whichever calls reach it. */
    readonly pointer: string;
}

/** Every declaration an evaluation could select, and whether that is an overestimate. */
export interface LexicaCandidateDeclarations {
    /**
     * The used declarations, and each deferred access's candidates at its pointer: every accessible declaration of the name and the form it accesses, inherited members and visible extensions among them, which its value's
     * actual type selects one of, or none of.
     */
    readonly declarations: readonly LexicaUsedDeclaration[];
    /** True where a deferred access remains, so its candidates include declarations no evaluation may select; false where the declarations are the used ones alone. */
    readonly isOverestimate: boolean;
}

/** A script resolved against a registry with bindings of one resolution key, reused with any bindings of that key while the registry stays at the revision it was resolved at. */
export interface LexicaResolution {
    readonly definition: LexicaDefinition;
    /** The host call the script ends in, null for a script that gives a value. */
    readonly hostCall: LexicaHostCall | null;
    /** The type of the result, in type notation, null for a host call whose host supplies no values. */
    readonly type: string | null;
    /**
     * Every declaration it has selected, operators among them, one only an unreached branch uses included, each once at each place it is used. Where a deferred access remains, they are not everything an evaluation might
     * use: `getCandidateDeclarations` answers that, as an overestimate.
     */
    readonly usedDeclarations: readonly LexicaUsedDeclaration[];
    /** The accesses whose member is selected during evaluation, in the order they were resolved; empty where every member is selected during resolution. */
    readonly deferredAccesses: readonly LexicaDeferredAccess[];
    /** Every declaration an evaluation could select: the used declarations, and each deferred access's candidates, an overestimate while a deferred access remains. */
    getCandidateDeclarations(): LexicaCandidateDeclarations;
    /** The type a result path reaches, in type notation, refusing a path the type does not hold. */
    typeAt(path: readonly (string | number)[]): string;
    /** Where a pointer stands in the source the definition was read from, as `lexica.getLocation` answers given the resolution's definition. */
    getLocation(pointer: string): LexicaLocation;
    /**
     * An evaluator holding bindings of this resolution's key and the environment the host gives it. Binding plain values asks the modules' `typeOf` and `isInstance`, as `createBindings` does, and nothing else calls host code
     * until it evaluates. It refuses bindings another registry made (LEXICA2024), bindings of another resolution key (LEXICA2025), a resolution its registry has moved past (LEXICA2040), and a script using a declaration
     * that has no implementation, a conversion operator among them, even in a branch it may not take (LEXICA4001).
     */
    createEvaluator(bindings: LexicaBindings | LexicaBindingValues, env?: unknown): LexicaEvaluator;
}

/** The host call a script ends in: its name, and the declaration it resolved to, null while its receiver's type is unknown. */
export interface LexicaHostCall {
    readonly name: string;
    readonly declaration: LexicaMemberDeclaration | null;
}

/** A registry a host resolves scripts against: Lexica's own module and the modules the host registers. It reads no text of its own, since a script's imports alone decide how its text reads, which `lexica.parse`, `format` and `quote` read and write for every registry. No registry is shared. */
export interface LexicaRegistry {
    /** Registers a module's vocabulary, which every script resolved afterwards may use. */
    registerModule(module: LexicaModule): void;
    /** The names of the modules registered, Lexica's own first. */
    readonly moduleNames: readonly string[];
    /** A number that changes whenever the registry's vocabulary does, so a host that keeps resolutions knows when to resolve again. */
    readonly revision: number;
    /** The observation type of the name, as the module that declares it declared it. */
    getObservationType(name: string): object | undefined;
    /** The name of the module that declares the declaration. */
    getDeclaringModuleName(declaration: object): string | undefined;
    /** The implementation that carries the declaration out, as its module gives it. */
    getImplementation(declaration: object): ((input: any) => unknown) | undefined;
    /**
     * Creates bindings of values by name against the registry, its modules recognizing which are references, each module's `typeOf` asked of every object and the `isInstance` of each type it names, or of a top-level
     * binding's declared type: data as a frozen copy, each reference as itself, a top-level binding of a declared type typed by it.
     */
    createBindings(values?: LexicaBindingValues, options?: LexicaBindingsOptions): LexicaBindings;
    /**
     * Resolves a script against the registered vocabulary and the bindings, the registry's own or plain values it binds, its source read as `parse` reads it, or throws where it does not resolve. Binding plain values asks
     * the modules' `typeOf` and `isInstance`, as `createBindings` does; resolving calls no host code. It reads a source with the imports `options.imports` supplies, a definition recording its own, and refuses
     * bindings another registry made (LEXICA2024), an import the registry can't give (LEXICA3002, LEXICA3052, LEXICA3053), and a script that does not resolve, a validation error locating it.
     */
    resolve(script: LexicaScript, bindings?: LexicaBindings | LexicaBindingValues, options?: LexicaScriptOptions): LexicaResolution;
}

/** The declaration helpers, each creating a declaration as a module declares it, constructing a record and registering nothing; a member takes no receiver of its own, since where it stands gives it one. */
export interface LexicaDeclarations {
    /** A property: with updates, one the evaluator invokes, or, without them, a property of a structured type's data where it stands directly in that type. */
    createPropertyDeclaration(name: string, result: string, options?: object): LexicaMemberDeclaration;
    /** A member a script calls with arguments, or, with `invokedBy: 'host'`, that its host invokes, its result left out where its host supplies nothing. */
    createFunctionDeclaration(name: string, result: string | undefined, options?: object): LexicaMemberDeclaration;
    /** An indexer, given its key in brackets: a named one, `x.name[key]`, or, where its name is null, the unnamed one of its receivers, `x[key]`. */
    createIndexerDeclaration(name: string | null, result: string, options?: object): LexicaMemberDeclaration;
    createValueParameterDeclaration(name: string, type: string, options?: object): LexicaParameterDeclaration;
    /** An expression of each item, its `nulls` `'propagate'` by default, so a null item answers null without its body being evaluated, or `'accept'`, which evaluates its body against every item, its `it` of the item's type. */
    createExpressionParameterDeclaration(type: string, options?: { nulls?: 'propagate' | 'accept' }): LexicaParameterDeclaration;
    createPredicateParameterDeclaration(options?: object): LexicaParameterDeclaration;
    /** A function parameter, always required: the types of the arguments the member calls its function with, in order, and the type of the result it takes from it. */
    createFunctionParameterDeclaration(name: string, type: string, parameterTypes: readonly string[]): LexicaParameterDeclaration;
}

/** Result paths: a path's shape validated, and the value it reaches in a result. */
export interface LexicaPaths {
    validate(path: readonly (string | number)[]): void;
    valueAt(value: unknown, path: readonly (string | number)[]): unknown;
}

/** The versions an implementation of Lexica reports, which change apart. */
export interface LexicaVersions {
    /** The implementation's release version, which the packages and the bundle carry. */
    readonly implementation: string;
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
    /**
     * Reads a text into its definition, its imports and those `options.imports` supplies deciding which of its names begin namespaces, refusing a syntax error, a supplied import that breaks an import's rules (LEXICA2008)
     * or a structure the definition cannot have. A text read with the same imports gives the same definition, whatever registry reads it.
     */
    parse(source: string, options?: LexicaScriptOptions): LexicaDefinition;
    /**
     * Validates a definition given directly against the definition format's structural rules, answering it frozen, as a text giving it would; it checks no vocabulary or types, which resolution validates. It calls
     * no host code, answers a definition it answered already as it is, and refuses a definition of another version (LEXICA2007) and any other structure the format does not allow, a structure error at its pointer.
     */
    validate(definition: unknown): LexicaDefinition;
    /** The canonical text of a text or a definition: every import it records, but those `options.imports` says its destination supplies, then its body, laid out on lines. */
    format(script: LexicaScript, options?: LexicaScriptOptions): string;
    /** The compact canonical text of a text or a definition, as a diagnostic quotes it: its imports, but those its destination supplies, each on a line of its own, and its body on one line where its layout allows. */
    quote(script: LexicaScript, options?: LexicaScriptOptions): string;
    /** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
    getLocation(definition: LexicaDefinition, pointer: string): LexicaLocation;
    /** Creates a module from the declarations it holds and the implementations that carry them out. */
    createModule(name: string, contents: LexicaModuleContents): LexicaModule;
    readonly declarations: LexicaDeclarations;
    /** Creates a registry of Lexica's own module and the modules given, which the host registers more modules with. */
    createRegistry(modules?: readonly LexicaModule[]): LexicaRegistry;
    readonly paths: LexicaPaths;
    readonly info: LexicaInfo;
}

export declare const lexica: Lexica;
