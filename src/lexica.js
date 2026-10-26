/**
 * Lexica — a general-purpose, embeddable language whose domain each application defines: reads, validates and writes source and definitions, creates the modules that declare a vocabulary and the registries a host resolves scripsions against,
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

/** The parameter bindings each bindings object a registry's `bind` made stands for. @type {WeakMap<object, ParameterBindings>} */
const PARAMETER_BINDINGS = new WeakMap();

/** The definition a source gives: a text read with the module names given and checked, or a definition checked, each the same frozen definition the text's canonical form would give. */
const definitionOf = (source, moduleNames = Names.noModuleNames) => (typeof source === 'string' ? ParsedTexts.parse(source, moduleNames) : new DefinitionValidator().validate(source));

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

/** The definition, refused where text read without module names cannot write it: a definition reading through a namespace, which only a registry's module names write. */
const withoutNamespaces = definition => {
    const [namespace] = namespacesOf(definition.expression, '/expression');

    if (namespace !== undefined) {
        throw LexicaErrors.structure('LEXICA2640', `The definition reads through the namespace '${namespace.name}', which text read without a registry's module names cannot write; write it with the registry, as registry.format does`, locate(definition, namespace.pointer));
    }

    return definition;
};

/**
 * The definition, refused where the registry would read it otherwise than it was read: one read from text without the registry's module names that writes one of them alone, which the registry reads as the module's namespace,
 * and one reading through a namespace no module the registry holds gives. Nothing reads a text otherwise unannounced.
 */
const readWith = (definition, namespaceNames) => {
    const reading = ParsedTexts.readingOf(definition);
    const misread = reading === null ? undefined : [...reading.namesWrittenAlone.keys()].find(name => namespaceNames.has(name) && !reading.moduleNames.has(name));

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
const bind = (registry, values = {}, options = {}) => {
    const parameterBindings = new ParameterBindings(registry, values, options);
    const bindings = Object.freeze({
        resolutionKey: parameterBindings.resolutionKey,
        has: name => parameterBindings.has(name),
        get: name => parameterBindings.readValue(name),
        typeOf: name => (parameterBindings.has(name) ? String(parameterBindings.getType(name)) : undefined),
    });

    PARAMETER_BINDINGS.set(bindings, parameterBindings);

    return bindings;
};

/** The parameter bindings of bindings the registry's `bind` made, or of plain values, which the registry binds now; bindings another registry made are refused. */
const parameterBindingsOf = (registry, bindings) => {
    const parameterBindings = PARAMETER_BINDINGS.get(bindings);

    if (parameterBindings === undefined) {
        return new ParameterBindings(registry, bindings ?? {});
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
    const usedDeclarations = Object.freeze(resolved.usedDeclarations.map(({ declaration, name, pointer }) => Object.freeze({ declaration, name, pointer })));

    const requireCurrent = () => {
        if (registry.revision !== revision) {
            throw LexicaErrors.structure('LEXICA2040', 'A module was registered since this script was resolved, so its resolution is stale; resolve the script again', {});
        }
    };

    const createEvaluator = (bindings, env = {}) => {
        const evaluatorBindings = parameterBindingsOf(registry, bindings);

        if (evaluatorBindings.resolutionKey !== resolutionKey) {
            throw LexicaErrors.structure('LEXICA2025', 'These bindings resolve the script otherwise than the bindings it was resolved with, by a type or a value that selects; resolve it with these bindings', {});
        }

        requireCurrent();

        // A declaration without an implementation is resolved against and never invoked, so a script that uses one, in a branch it may not take among them, is refused before anything is evaluated; a host call has none, its host invoking it.
        const unimplemented = usedDeclarations.find(use => registry.getImplementation(use.declaration) === undefined && !LexicaModule.isHostCall(use.declaration));

        if (unimplemented !== undefined) {
            throw LexicaErrors.module('LEXICA4001', `'${unimplemented.name}' has no implementation, so a script that uses it is resolved and never evaluated`, { module: registry.getOwner(unimplemented.declaration), declaration: unimplemented.declaration.name, field: 'implementation' });
        }

        const unimplementedConversion = resolved.usedConversions.find(conversion => registry.getImplementation(conversion) === undefined);

        if (unimplementedConversion !== undefined) {
            const name = LexicaModule.conversionNameOf(unimplementedConversion);

            throw LexicaErrors.module('LEXICA4001', `The conversion from ${name} has no implementation, so a script that uses it is resolved and never evaluated`, { module: registry.getOwner(unimplementedConversion), declaration: name, field: 'implementation' });
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
        const prepareCall = () => {
            const call = enter(() => evaluator.prepareCall());

            return call.project === undefined ? call : Object.freeze({ ...call, project: (value, host = null) => enter(() => call.project(value, host)) });
        };

        return Object.freeze({
            evaluate: (host = null) => enter(() => evaluator.evaluate(host)),
            prepareCall,
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
        locate: pointer => locate(definition, pointer),
        createEvaluator,
    });
};

/**
 * A registry a host resolves scripts against: Lexica's own module and the modules the host registers, each module's vocabulary in effect for every script resolved after it.
 * It reads and writes text with the names of its modules, which begin their namespaces there. No registry is shared, so two hosts never see each other's modules.
 */
const registryOf = modules => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);
    const namespaceNames = () => new Set(registry.namespaceNames);
    const definitionWith = source => {
        const names = namespaceNames();

        return readWith(definitionOf(source, names), names);
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
        getOwner: declaration => registry.getOwner(declaration),
        getImplementation: declaration => registry.getImplementation(declaration),
        parse: text => {
            if (typeof text !== 'string') {
                throw LexicaErrors.structure('LEXICA2645', 'What parse reads is a text', {});
            }

            return definitionWith(text);
        },
        format: source => DefinitionWriter.format(definitionWith(source).expression, namespaceNames()),
        quote: source => DefinitionWriter.quote(definitionWith(source).expression, namespaceNames()),
        bind: (values = {}, options = {}) => bind(registry, values, options),
        resolve: (source, bindings = {}) => resolutionOf(registry, definitionWith(source), parameterBindingsOf(registry, bindings)),
    });
};

/** The declaration helpers, each giving a declaration as a module declares it; `function` declares a member a script calls. */
const declarations = Object.freeze({
    property: Declarations.property,
    function: Declarations.function,
    valueParameter: Declarations.valueParameter,
    expressionParameter: Declarations.expressionParameter,
    predicateParameter: Declarations.predicateParameter,
    functionParameter: Declarations.functionParameter,
});

/** Result paths: a path's shape checked, and the value it reaches in a result. */
const paths = Object.freeze({
    check: path => ResultPath.validateShape(path),
    valueAt: (value, path) => ResultPath.valueAt(value, path),
});

/** Lexica: reads, checks and writes source and definitions, declares and registers vocabulary, binds values, resolves and evaluates, and says which build it is and which specification it follows. */
export const lexica = Object.freeze({
    parse: text => {
        if (typeof text !== 'string') {
            throw LexicaErrors.structure('LEXICA2645', 'What parse reads is a text', {});
        }

        return ParsedTexts.parse(text);
    },
    validate: definition => new DefinitionValidator().validate(definition),
    format: source => DefinitionWriter.format(withoutNamespaces(definitionOf(source)).expression),
    quote: source => DefinitionWriter.quote(withoutNamespaces(definitionOf(source)).expression),
    locate,
    createModule: (name, contents) => new LexicaModule(name, contents),
    declarations,
    createRegistry: (modules = []) => registryOf(modules),
    paths,
    info: Object.freeze({ versions: Object.freeze({ runtime: Versions.runtime, language: Versions.language, definition: Versions.definition }) }),
});

export { LexicaError };
