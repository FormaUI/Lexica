/**
 * Nexo — a general-purpose, embeddable language whose domain each application defines: reads, validates and writes source and definitions, creates the modules that declare a vocabulary and the registries a host resolves scripts against,
 * binds values, and evaluates a resolved script for its host, describing its result; and says which build it is and which specification it follows
 */

import { DefinitionValidator } from './language/DefinitionValidator.mjs';
import { DefinitionWriter } from './language/DefinitionWriter.mjs';
import { Evaluator } from './language/Evaluator.mjs';
import { Imports } from './language/Imports.mjs';
import { LanguageResolver } from './language/LanguageResolver.mjs';
import { LexicaError, LexicaErrors } from './language/LexicaError.mjs';
import { ParameterBindings } from './language/ParameterBindings.mjs';
import { ParsedTexts } from './language/ParsedTexts.mjs';
import { ResultPath } from './language/ResultPath.mjs';
import { Versions } from './language/Versions.mjs';
import { Declarations } from './language/vocabulary/Declarations.mjs';
import { LexicaModule } from './language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from './language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from './language/vocabulary/Vocabulary.mjs';

/** The parameter bindings each bindings object a registry's `createBindings` created stands for. @type {WeakMap<object, ParameterBindings>} */
const PARAMETER_BINDINGS = new WeakMap();

/** The imports a host supplies in a call's options, as a definition records them, checked as a definition's are; none where it supplies none. */
const suppliedImportsOf = options => Imports.createSuppliedImports(options?.imports);

/**
 * The definition a script gives: its source read with the imports a host supplies and checked, or its definition checked, each the same frozen definition its canonical text would give. A definition records its imports, so
 * the imports supplied apply to a source alone.
 */
const definitionOf = (script, suppliedImports = []) => (typeof script === 'string' ? ParsedTexts.parse(script, suppliedImports) : new DefinitionValidator().validate(script));

/** What `parse` reads, a script's source, read with the imports a host supplies. */
const parse = (source, options) => {
    if (typeof source !== 'string') {
        throw LexicaErrors.structure('NEXO2645', "What parse reads is a script's source", {});
    }

    return ParsedTexts.parse(source, suppliedImportsOf(options));
};

/** The canonical text of a script, laid out or compact, read with the imports its destination supplies and leaving them out. */
const write = (script, options, isCompact) => {
    const supplied = suppliedImportsOf(options);
    const definition = definitionOf(script, supplied);

    return isCompact ? DefinitionWriter.quoteScript(definition, supplied) : DefinitionWriter.formatScript(definition, supplied);
};

/**
 * Bindings, the registry's: the values bound by name, data a frozen copy of the data given and each reference itself, the type each value gives its binding or its host declares for it, in type notation, and the resolution key
 * that says which resolutions they may reuse.
 */
const createBindings = (registry, values = {}, options = {}) => {
    const parameterBindings = new ParameterBindings(registry, values, options);
    const bindings = Object.freeze({
        resolutionKey: parameterBindings.resolutionKey,
        has: name => parameterBindings.has(name),
        readValue: name => parameterBindings.readValue(name),
        getType: name => (parameterBindings.has(name) ? String(parameterBindings.getType(name)) : undefined),
    });

    PARAMETER_BINDINGS.set(bindings, parameterBindings);

    return bindings;
};

/**
 * The parameter bindings the registry's `createBindings` created for the bindings, or undefined for any other value, plain values among them, which its caller binds; bindings another registry created are refused. It creates
 * nothing, so it calls no module's `typeOf`.
 */
const getParameterBindings = (registry, bindings) => {
    const parameterBindings = PARAMETER_BINDINGS.get(bindings);

    if (parameterBindings === undefined) {
        return undefined;
    }

    if (parameterBindings.registry !== registry) {
        throw LexicaErrors.structure('NEXO2024', 'These bindings belong to another registry, which recognized their references; bind them with this registry', {});
    }

    return parameterBindings;
};

/** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
const locate = (definition, pointer) => {
    if (typeof pointer !== 'string' || !(pointer === '' || pointer.startsWith('/'))) {
        throw LexicaErrors.structure('NEXO2643', 'A pointer is a JSON Pointer into the definition, as /expression/objectFields/0', {});
    }

    let node = definition;

    for (const segment of pointer.split('/').slice(1).map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, segment)) {
            throw LexicaErrors.structure('NEXO2644', `The definition holds nothing at ${pointer}`, { pointer });
        }

        node = node[segment];
    }

    return Object.freeze(ParsedTexts.locationsOf(definition)?.locate(pointer) ?? { pointer });
};

/**
 * A resolution: the script resolved against the registry with bindings of one resolution key, reused with any bindings of that key while it is current: until a module declaring a `typeOf` is registered, where
 * it may recognize values as it is evaluated, and for good where it may not.
 * An evaluator it creates holds one binding set and the environment the host owns, and evaluates one evaluation at a time.
 */
const resolutionOf = (registry, definition, parameterBindings) => {
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, parameterBindings, locations).resolveDefinition(definition);
    const { resolutionKey } = parameterBindings;
    const { revision } = registry;
    const useOf = ({ declaration, qualifiedName, pointer }) => Object.freeze({ declaration, name: declaration.name ?? null, qualifiedName, pointer });
    const usedDeclarations = Object.freeze(resolved.usedDeclarations.map(useOf));
    const deferredAccesses = Object.freeze(resolved.deferredAccesses.map(({ name, pointer }) => Object.freeze({ name, pointer })));

    // A registration changes a resolution through recognition alone, so only a module declaring a `typeOf`, registered since, makes stale a resolution that may recognize values.
    const isCurrent = () => registry.revision === revision || !resolved.mayRecognize || registry.recognitionRevision <= revision;

    const requireCurrent = () => {
        if (!isCurrent()) {
            throw LexicaErrors.structure('NEXO2040', 'A module declaring a typeOf was registered since this script was resolved, and the script may recognize values as it is evaluated, so its resolution is stale; resolve the script again', {});
        }
    };

    const createEvaluator = (bindings, env = {}) => {
        // Plain values are bound here, which asks every module's `typeOf` of them, before the resolution key and the registry's revision are checked.
        const evaluatorBindings = getParameterBindings(registry, bindings) ?? new ParameterBindings(registry, bindings ?? {});

        if (evaluatorBindings.resolutionKey !== resolutionKey) {
            throw LexicaErrors.structure('NEXO2025', 'These bindings resolve the script otherwise than the bindings it was resolved with, by a type or a value that selects; resolve it with these bindings', {});
        }

        requireCurrent();

        // A declaration without an implementation is resolved against and never invoked, so a script that uses one, in a branch it may not take among them, is refused before anything is evaluated; a host call has none, its host invoking it.
        // A structured type's data property is read from the data, and a cast operator permits its cast, so neither takes an implementation.
        const unimplemented = usedDeclarations.find(({ declaration }) => registry.getImplementation(declaration) === undefined && !LexicaModule.isInvokedByHost(declaration) && !registry.isDataProperty(declaration) && !(declaration.kind === 'operator' && declaration.name === 'cast'));

        if (unimplemented !== undefined) {
            const { declaration, qualifiedName } = unimplemented;
            const containing = registry.getContainingType(declaration);
            // A member within a type or an extension is located at it, as any of its module's errors is.
            const location = { module: registry.getDeclaringModuleName(declaration), ...(containing === undefined ? {} : { type: containing.name }), declaration: declaration.name, declarationKey: 'impl' };
            const subject = declaration.kind === 'operator' ? `The conversion from ${qualifiedName}` : `'${qualifiedName}'`;

            throw LexicaErrors.module('NEXO4001', `${subject} has no implementation, so a script that uses it is resolved and never evaluated`, location);
        }

        const evaluator = new Evaluator(registry, resolved, evaluatorBindings, env, locations);
        let isEvaluating = false;

        // Each entry point checks the registry has not moved, and evaluates one evaluation at a time.
        const enter = run => {
            requireCurrent();

            if (isEvaluating) {
                throw LexicaErrors.evaluation('NEXO5010', 'An evaluator evaluates one evaluation at a time, and this one is evaluating; evaluate with an evaluator of its own', {});
            }

            isEvaluating = true;

            try {
                return run();
            } finally {
                isEvaluating = false;
            }
        };

        // A prepared call projects through the same entry, so each projection checks the registry and evaluates alone, as an evaluation does.
        const prepareHostCall = () => {
            const call = enter(() => evaluator.prepareHostCall());

            return call.project === undefined ? call : Object.freeze({ ...call, project: (value, hooks = null) => enter(() => call.project(value, hooks)) });
        };

        return Object.freeze({
            evaluate: (hooks = null) => enter(() => evaluator.evaluate(hooks)),
            prepareHostCall,
        });
    };

    const { hostCall } = resolved;

    // A host call that supplies nothing gives no result, so no path reaches into one.
    const typeAt = path => {
        if (resolved.type === null) {
            throw LexicaErrors.validation('NEXO3600', `The script ends in the host call '${hostCall.name}', whose host supplies no values, so it has no result for a path to reach`, locate(definition, '/expression'));
        }

        return String(ResultPath.typeAt(resolved.type, path, registry, () => locate(definition, '/expression')));
    };

    return Object.freeze({
        definition,
        hostCall: hostCall === null ? null : Object.freeze({ name: hostCall.name, declaration: hostCall.declaration }),
        type: resolved.type === null ? null : String(resolved.type),
        usedDeclarations,
        deferredAccesses,
        getCandidateDeclarations: () => Object.freeze({ declarations: Object.freeze(resolved.candidateDeclarations.map(useOf)), isOverestimate: deferredAccesses.length > 0 }),
        typeAt,
        getLocation: pointer => locate(definition, pointer),
        get isCurrent() {
            return isCurrent();
        },
        createEvaluator,
    });
};

/**
 * A registry a host resolves scripts against: Nexo's own module and the modules the host registers, each module's vocabulary in effect for every script resolved after it.
 * It reads no text of its own: a script's imports decide which of its names are namespaces, so `lexica.parse`, `format` and `quote` read and write a text alike for every registry, and registering a module changes how no text reads. No registry is shared, so two hosts never see each other's modules.
 */
const createRegistry = modules => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);

    return Object.freeze({
        registerModule: module => {
            registry.registerModule(module);
        },
        get moduleNames() {
            return registry.moduleNames;
        },
        get revision() {
            return registry.revision;
        },
        getObservationType: name => registry.getObservationType(name),
        getDeclaringModuleName: declaration => registry.getDeclaringModuleName(declaration),
        getImplementation: declaration => registry.getImplementation(declaration),
        createBindings: (values = {}, options = {}) => createBindings(registry, values, options),
        resolve: (script, bindings = {}, options = {}) => {
            // The script is read before its bindings, so one that does not follow the syntax or the structure asks no module's `typeOf`.
            const definition = definitionOf(script, suppliedImportsOf(options));

            return resolutionOf(registry, definition, getParameterBindings(registry, bindings) ?? new ParameterBindings(registry, bindings ?? {}));
        },
    });
};

/** The declaration helpers, each creating a declaration as a module declares it, a member with no receiver of its own, since where it stands gives it one. */
const declarations = Object.freeze({
    createPropertyDeclaration: Declarations.createPropertyDeclaration,
    createFunctionDeclaration: Declarations.createFunctionDeclaration,
    createIndexerDeclaration: Declarations.createIndexerDeclaration,
    createValueParameterDeclaration: Declarations.createValueParameterDeclaration,
    createExpressionParameterDeclaration: Declarations.createExpressionParameterDeclaration,
    createPredicateParameterDeclaration: Declarations.createPredicateParameterDeclaration,
    createFunctionParameterDeclaration: Declarations.createFunctionParameterDeclaration,
});

/** Result paths: a path's shape validated, and the value it reaches in a result. */
const paths = Object.freeze({
    validate: path => ResultPath.validateShape(path),
    valueAt: (value, path) => ResultPath.valueAt(value, path),
});

/** Nexo: reads, checks and writes source and definitions, declares and registers vocabulary, binds values, resolves and evaluates, and says which build it is and which specification it follows. */
export const lexica = Object.freeze({
    parse: (source, options) => parse(source, options),
    validate: definition => new DefinitionValidator().validate(definition),
    format: (script, options) => write(script, options, false),
    quote: (script, options) => write(script, options, true),
    getLocation: locate,
    createModule: (name, contents) => new LexicaModule(name, contents),
    declarations,
    createRegistry: (modules = []) => createRegistry(modules),
    paths,
    info: Object.freeze({ versions: Object.freeze({ implementation: Versions.implementation, language: Versions.language, definition: Versions.definition }) }),
});

export { LexicaError };
