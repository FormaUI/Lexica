/**
 * Lexica — an extensible expression language: reads, checks and writes source and definitions, creates the modules that declare a vocabulary and the registries a host resolves expressions against,
 * binds values, and evaluates a resolved expression for its host, describing its result; and says which build it is and which specification it follows
 */

import { DefinitionValidator } from './language/DefinitionValidator.mjs';
import { DefinitionWriter } from './language/DefinitionWriter.mjs';
import { Evaluator } from './language/Evaluator.mjs';
import { LanguageResolver } from './language/LanguageResolver.mjs';
import { LexicaError } from './language/LexicaError.mjs';
import { ParameterBindings } from './language/ParameterBindings.mjs';
import { ParsedTexts } from './language/ParsedTexts.mjs';
import { ResultPath } from './language/ResultPath.mjs';
import { Specification } from './language/Specification.mjs';
import { Declarations } from './language/vocabulary/Declarations.mjs';
import { LexicaModule } from './language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from './language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from './language/vocabulary/Vocabulary.mjs';

/**
 * The version of this build of the library: the package's version, which bundling sets, or, where Lexica runs from its sources, the library's version marked as source by its build metadata.
 * @type {string}
 */
const LIBRARY_VERSION = typeof LEXICA_VERSION === 'string' ? LEXICA_VERSION : '1.0.0-alpha+source';

/** The parameter bindings each bindings object `bind` made stands for. @type {WeakMap<object, ParameterBindings>} */
const PARAMETER_BINDINGS = new WeakMap();

/** The definition a source gives: a text read and checked, or a definition checked, each the same frozen definition the text's canonical form would give. */
const definitionOf = source => (typeof source === 'string' ? ParsedTexts.parse(source) : new DefinitionValidator().validate(source));

/** Bindings: the values bound by name, data a frozen copy of the data given and each reference itself, the type each value gives its binding, in type notation, and the resolution key that says which resolutions they may reuse. */
const bind = (values = {}) => {
    const parameterBindings = new ParameterBindings(values);
    const bindings = Object.freeze({
        resolutionKey: parameterBindings.resolutionKey,
        has: name => parameterBindings.has(name),
        get: name => parameterBindings.get(name),
        typeOf: name => (parameterBindings.has(name) ? String(parameterBindings.getType(name)) : undefined),
    });

    PARAMETER_BINDINGS.set(bindings, parameterBindings);

    return bindings;
};

/** The parameter bindings of bindings `bind` made, or of plain values, bound now. */
const parameterBindingsOf = bindings => PARAMETER_BINDINGS.get(bindings) ?? new ParameterBindings(bindings ?? {});

/** Where a pointer stands in the source a definition was read from, or the pointer alone for a definition given directly; a pointer the definition does not hold is refused. */
const locate = (definition, pointer) => {
    if (typeof pointer !== 'string' || !(pointer === '' || pointer.startsWith('/'))) {
        throw LexicaError.structure('A pointer is a JSON Pointer into the definition, as /expression/fields/0', {});
    }

    let node = definition;

    for (const segment of pointer.split('/').slice(1).map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, segment)) {
            throw LexicaError.structure(`The definition holds nothing at ${pointer}`, { pointer });
        }

        node = node[segment];
    }

    return Object.freeze(ParsedTexts.locationsOf(definition)?.locate(pointer) ?? { pointer });
};

/**
 * A resolution: the expression resolved against the registry with bindings of one resolution key, reused with any bindings of that key while the registry stays at the revision it was resolved at.
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
            throw LexicaError.structure('A module was registered since this expression was resolved, so its resolution is stale; resolve the expression again', {});
        }
    };

    const createEvaluator = (bindings, env = {}) => {
        const evaluatorBindings = parameterBindingsOf(bindings);

        if (evaluatorBindings.resolutionKey !== resolutionKey) {
            throw LexicaError.structure('These bindings resolve the expression otherwise than the bindings it was resolved with, by a type or a value that selects; resolve it with these bindings', {});
        }

        requireCurrent();

        const evaluator = new Evaluator(registry, resolved, evaluatorBindings, env, locations);
        let isEvaluating = false;

        // Each entry point checks the registry has not moved, and evaluates one evaluation at a time.
        const enter = run => {
            requireCurrent();

            if (isEvaluating) {
                throw LexicaError.structure('An evaluator evaluates one evaluation at a time, and this one is evaluating; evaluate with an evaluator of its own', {});
            }

            isEvaluating = true;

            try {
                return run();
            } finally {
                isEvaluating = false;
            }
        };

        return Object.freeze({
            evaluate: (host = null) => enter(() => evaluator.evaluate(host)),
            project: (event, host = null) => enter(() => evaluator.project(event, host)),
            resolveSource: () => enter(() => evaluator.resolveSource()),
            resolveAction: () => enter(() => evaluator.resolveAction()),
            resolveBehavior: () => enter(() => evaluator.resolveBehavior()),
            projectResult: (result, execution) => enter(() => evaluator.projectResult(result, execution)),
        });
    };

    return Object.freeze({
        definition,
        kind: resolved.kind,
        type: String(resolved.type),
        usedDeclarations,
        typeAt: path => String(ResultPath.typeAt(resolved.type, path, registry, () => locate(definition, '/expression'))),
        locate: pointer => locate(definition, pointer),
        createEvaluator,
    });
};

/**
 * A registry a host resolves expressions against: Lexica's own module and the modules the host registers, each module's vocabulary in effect for every expression resolved after it.
 * No registry is shared, so two hosts never see each other's modules.
 */
const registryOf = modules => {
    const registry = new LexicaRegistry([Vocabulary.module, ...modules]);

    return Object.freeze({
        registerModule: module => registry.registerModule(module),
        get moduleNames() {
            return registry.moduleNames;
        },
        get revision() {
            return registry.revision;
        },
        getObservationType: name => registry.getObservationType(name),
        getOwner: declaration => registry.getOwner(declaration),
        getFunction: declaration => registry.getFunction(declaration),
        resolve: (source, bindings = {}) => resolutionOf(registry, definitionOf(source), parameterBindingsOf(bindings)),
    });
};

/** The declaration helpers, each giving a declaration as a module declares it; `function` declares a member the expression calls. */
const declarations = Object.freeze({
    property: Declarations.property,
    function: Declarations.operation,
    condition: Declarations.condition,
    valueParameter: Declarations.valueParameter,
    expressionParameter: Declarations.expressionParameter,
    predicateParameter: Declarations.predicateParameter,
});

/** Result paths: a path's shape checked, and the value it reaches in a result. */
const paths = Object.freeze({
    check: path => ResultPath.checkShape(path),
    valueAt: (value, path) => ResultPath.valueAt(value, path),
});

/** Lexica: reads, checks and writes source and definitions, declares and registers vocabulary, binds values, resolves and evaluates, and says which build it is and which specification it follows. */
export const lexica = Object.freeze({
    parse: text => {
        if (typeof text !== 'string') {
            throw LexicaError.structure('What parse reads is a text', {});
        }

        return ParsedTexts.parse(text);
    },
    validate: definition => new DefinitionValidator().validate(definition),
    format: source => DefinitionWriter.format(definitionOf(source).expression),
    quote: source => DefinitionWriter.write(definitionOf(source).expression),
    locate,
    createModule: (name, contents, functions = null) => new LexicaModule(name, contents, functions),
    declarations,
    createRegistry: (modules = []) => registryOf(modules),
    bind,
    paths,
    info: Object.freeze({ version: LIBRARY_VERSION, specificationVersion: Specification.version, definitionVersion: Specification.definitionVersion }),
});

export { LexicaError };
