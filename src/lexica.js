/**
 * Lexica — a general-purpose, embeddable language whose domain each application defines: reads, validates and writes source and definitions, creates the modules that declare a vocabulary and the registries a host resolves scripts against,
 * binds values, and evaluates a resolved script for its host, describing its result; and says which build it is and which specification it follows
 */

import { DefinitionValidator } from './language/DefinitionValidator.mjs';
import { DefinitionWriter } from './language/DefinitionWriter.mjs';
import { Evaluator } from './language/Evaluator.mjs';
import { LanguageResolver } from './language/LanguageResolver.mjs';
import { LexicaError, LexicaErrors } from './language/LexicaError.mjs';
import { Names } from './language/Names.mjs';
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

/** The definition a script gives: its source read with the namespace names given and checked, or its definition checked, each the same frozen definition its canonical text would give. */
const definitionOf = (script, namespaceNames = Names.noNamespaceNames) => (typeof script === 'string' ? ParsedTexts.parse(script, namespaceNames) : new DefinitionValidator().validate(script));

/** Each namespace the node reads through, with where it stands, in the order written. */
const namespacesOf = (node, pointer, found = []) => {
    if (node === null || typeof node !== 'object') {
        return found;
    }

    if (node.kind === 'namespace') {
        found.push({ name: node.name, pointer });

        return found;
    }

    for (const [key, value] of Object.entries(node)) {
        namespacesOf(value, `${pointer}/${key}`, found);
    }

    return found;
};

/** The definition, refused where text read without namespace names cannot write it: a definition reading through a namespace, which only a registry's namespace names write. */
const withoutNamespaces = definition => {
    const [namespace] = namespacesOf(definition.expression, '/expression');

    if (namespace !== undefined) {
        throw LexicaErrors.structure('LEXICA2640', `The definition reads through the namespace '${namespace.name}', which text read without a registry's module names cannot write; write it with the registry, as registry.format does`, locate(definition, namespace.pointer));
    }

    return definition;
};

/**
 * The definition, refused where the registry would read it otherwise than it was read: one read from text without the registry's namespace names that writes one of them alone, which the registry reads as the module's namespace,
 * and one reading through a namespace no module the registry holds gives. Nothing reads a text otherwise unannounced.
 */
const readWith = (definition, namespaceNames) => {
    const reading = ParsedTexts.readingOf(definition);
    const misread = reading === null ? undefined : [...reading.namesWrittenAlone.keys()].find(name => namespaceNames.has(name) && !reading.namespaceNames.has(name));

    if (misread !== undefined) {
        throw LexicaErrors.structure('LEXICA2641', `The definition was read without this registry's module names, and writes '${misread}' alone, which this registry reads as the namespace of its module '${misread}'; read the text with the registry`, ParsedTexts.locationsOf(definition).locateSpan(reading.namesWrittenAlone.get(misread)));
    }

    const lacking = namespacesOf(definition.expression, '/expression').find(namespace => !namespaceNames.has(namespace.name));

    if (lacking !== undefined) {
        throw LexicaErrors.structure('LEXICA2642', `The definition reads through the namespace '${lacking.name}', and this registry holds no module of that name`, locate(definition, lacking.pointer));
    }

    return definition;
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
        throw LexicaErrors.structure('LEXICA2024', 'These bindings belong to another registry, which recognized their references; bind them with this registry', {});
    }

    return parameterBindings;
};

/** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
const locate = (definition, pointer) => {
    if (typeof pointer !== 'string' || !(pointer === '' || pointer.startsWith('/'))) {
        throw LexicaErrors.structure('LEXICA2643', 'A pointer is a JSON Pointer into the definition, as /expression/fields/0', {});
    }

    let node = definition;

    for (const segment of pointer.split('/').slice(1).map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, segment)) {
            throw LexicaErrors.structure('LEXICA2644', `The definition holds nothing at ${pointer}`, { pointer });
        }

        node = node[segment];
    }

    return Object.freeze(ParsedTexts.locationsOf(definition)?.locate(pointer) ?? { pointer });
};

/**
 * A resolution: the script resolved against the registry with bindings of one resolution key, reused with any bindings of that key while the registry stays at the revision it was resolved at.
 * An evaluator it creates holds one binding set and the environment the host owns, and evaluates one evaluation at a time.
 */
const resolutionOf = (registry, definition, parameterBindings) => {
    const locations = ParsedTexts.locationsOf(definition);
    const resolved = new LanguageResolver(registry, parameterBindings, locations).resolveDefinition(definition);
    const { resolutionKey } = parameterBindings;
    const { revision } = registry;
    const usedDeclarations = Object.freeze(resolved.usedDeclarations.map(({ declaration, qualifiedName, pointer }) => Object.freeze({ declaration, name: declaration.name ?? null, qualifiedName, pointer })));

    const requireCurrent = () => {
        if (registry.revision !== revision) {
            throw LexicaErrors.structure('LEXICA2040', 'A module was registered since this script was resolved, so its resolution is stale; resolve the script again', {});
        }
    };

    const createEvaluator = (bindings, env = {}) => {
        // Plain values are bound here, which asks every module's `typeOf` of them, before the resolution key and the registry's revision are checked.
        const evaluatorBindings = getParameterBindings(registry, bindings) ?? new ParameterBindings(registry, bindings ?? {});

        if (evaluatorBindings.resolutionKey !== resolutionKey) {
            throw LexicaErrors.structure('LEXICA2025', 'These bindings resolve the script otherwise than the bindings it was resolved with, by a type or a value that selects; resolve it with these bindings', {});
        }

        requireCurrent();

        // A declaration without an implementation is resolved against and never invoked, so a script that uses one, in a branch it may not take among them, is refused before anything is evaluated; a host call has none, its host invoking it.
        // A structured type's data property is read from the data, so it takes no implementation.
        const unimplemented = usedDeclarations.find(use => registry.getImplementation(use.declaration) === undefined && !LexicaModule.isInvokedByHost(use.declaration) && !registry.isDataProperty(use.declaration));

        if (unimplemented !== undefined) {
            throw LexicaErrors.module('LEXICA4001', `'${unimplemented.qualifiedName}' has no implementation, so a script that uses it is resolved and never evaluated`, { module: registry.getDeclaringModuleName(unimplemented.declaration), declaration: unimplemented.declaration.name, declarationKey: 'impl' });
        }

        const unimplementedConversion = resolved.usedConversions.find(conversion => registry.getImplementation(conversion) === undefined);

        // A conversion operator is located at the type or the extension it stands in, as any member within one is.
        if (unimplementedConversion !== undefined) {
            const location = { module: registry.getDeclaringModuleName(unimplementedConversion), type: registry.getContainingType(unimplementedConversion).name, declaration: unimplementedConversion.name, declarationKey: 'impl' };

            throw LexicaErrors.module('LEXICA4001', `The conversion from ${registry.formatOperator(unimplementedConversion)} has no implementation, so a script that uses it is resolved and never evaluated`, location);
        }

        const evaluator = new Evaluator(registry, resolved, evaluatorBindings, env, locations);
        let isEvaluating = false;

        // Each entry point checks the registry has not moved, and evaluates one evaluation at a time.
        const enter = run => {
            requireCurrent();

            if (isEvaluating) {
                throw LexicaErrors.evaluation('LEXICA5010', 'An evaluator evaluates one evaluation at a time, and this one is evaluating; evaluate with an evaluator of its own', {});
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
            throw LexicaErrors.validation('LEXICA3600', `The script ends in the host call '${hostCall.name}', whose host supplies no values, so it has no result for a path to reach`, locate(definition, '/expression'));
        }

        return String(ResultPath.typeAt(resolved.type, path, registry, () => locate(definition, '/expression')));
    };

    return Object.freeze({
        definition,
        hostCall: hostCall === null ? null : Object.freeze({ name: hostCall.name, declaration: hostCall.declaration }),
        type: resolved.type === null ? null : String(resolved.type),
        usedDeclarations,
        typeAt,
        getLocation: pointer => locate(definition, pointer),
        createEvaluator,
    });
};

/**
 * A registry a host resolves scripts against: Lexica's own module and the modules the host registers, each module's vocabulary in effect for every script resolved after it.
 * It reads and writes text with the names of its modules, which begin their namespaces there. No registry is shared, so two hosts never see each other's modules.
 */
const createRegistry = modules => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);
    const namespaceNames = () => new Set(registry.namespaceNames);
    const definitionWith = script => {
        const names = namespaceNames();

        return readWith(definitionOf(script, names), names);
    };

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
        parse: source => {
            if (typeof source !== 'string') {
                throw LexicaErrors.structure('LEXICA2645', "What parse reads is a script's source", {});
            }

            return definitionWith(source);
        },
        format: script => DefinitionWriter.format(definitionWith(script).expression, namespaceNames()),
        quote: script => DefinitionWriter.quote(definitionWith(script).expression, namespaceNames()),
        createBindings: (values = {}, options = {}) => createBindings(registry, values, options),
        resolve: (script, bindings = {}) => {
            // The script is read before its bindings, so one that does not follow the syntax or the structure asks no module's `typeOf`.
            const definition = definitionWith(script);

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

/** Lexica: reads, checks and writes source and definitions, declares and registers vocabulary, binds values, resolves and evaluates, and says which build it is and which specification it follows. */
export const lexica = Object.freeze({
    parse: source => {
        if (typeof source !== 'string') {
            throw LexicaErrors.structure('LEXICA2645', "What parse reads is a script's source", {});
        }

        return ParsedTexts.parse(source);
    },
    validate: definition => new DefinitionValidator().validate(definition),
    format: script => DefinitionWriter.format(withoutNamespaces(definitionOf(script)).expression),
    quote: script => DefinitionWriter.quote(withoutNamespaces(definitionOf(script)).expression),
    getLocation: locate,
    createModule: (name, contents) => new LexicaModule(name, contents),
    declarations,
    createRegistry: (modules = []) => createRegistry(modules),
    paths,
    info: Object.freeze({ versions: Object.freeze({ implementation: Versions.implementation, language: Versions.language, definition: Versions.definition }) }),
});

export { LexicaError };
