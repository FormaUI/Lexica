/**
 * A script's way through the public pipeline that several tests take alike: resolved against a registry of the modules, which supplies every script an import of each of them, as a host whose scripts all use its modules
 * does, and evaluated with plain values or with bindings created once. A test whose way differs, recording what its implementations or its hooks are given, or resolving and evaluating directly, keeps its own.
 */
import { lexica } from '#lexica/lexica.js';
import { Imports } from '#lexica/language/Imports.mjs';
import { ParsedTexts } from '#lexica/language/ParsedTexts.mjs';

/** The imports a host of the modules supplies: one of each, under its own name. */
export const importsOf = modules => modules.map(module => module.name);

/** The names of the modules a registry holds but Nexo's own, which no script imports, as it holds them when asked. */
const registeredModuleNamesOf = registry => registry.moduleNames.filter(name => name !== 'Nexo');

/**
 * A registry of the modules whose `resolve` supplies every script an import of each module it holds when the script is resolved, those registered afterwards among them, as a host whose scripts all use its modules does;
 * imports the call gives are supplied beside them, and every other operation is the registry's own.
 */
export const createImportingRegistry = (modules = []) => {
    const registry = lexica.createRegistry(modules);

    // The registry's getters stay getters, so its module names and its revision are read as they are when asked.
    return Object.freeze(Object.defineProperties({}, {
        ...Object.getOwnPropertyDescriptors(registry),
        resolve: { enumerable: true, value: (script, bindings, options = {}) => registry.resolve(script, bindings, { ...options, imports: [...registeredModuleNamesOf(registry), ...(options.imports ?? [])] }) },
    }));
};

/** The definition the text parses into with an import of each module the registry holds supplied, as a test resolving directly against an internal registry reads it. */
export const parseImporting = (registry, text) => ParsedTexts.parse(text, Imports.createSuppliedImports(registeredModuleNamesOf(registry)));

/** The resolution of the text against a registry of the modules, each imported, bound to the plain values given. */
export const resolveWith = (modules, text, values = {}) => lexica.createRegistry(modules).resolve(text, values, { imports: importsOf(modules) });

/** The value the text evaluates to against a registry of the modules, each imported, the plain values given bound by the resolution and again by the evaluator. */
export const evaluateWith = (modules, text, values = {}) => resolveWith(modules, text, values).createEvaluator(values).evaluate().value;

/** The value the text evaluates to against a registry of the modules, each imported, its bindings created once from the values given and reused by the resolution and the evaluator. */
export const evaluateWithCreatedBindings = (modules, text, values = {}) => {
    const registry = lexica.createRegistry(modules);
    const bindings = registry.createBindings(values);

    return registry.resolve(text, bindings, { imports: importsOf(modules) }).createEvaluator(bindings).evaluate().value;
};
