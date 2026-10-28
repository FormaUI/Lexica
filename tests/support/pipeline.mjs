/**
 * A script's way through the public pipeline that several tests take alike: resolved against a registry of the modules, which supplies every script an import of each of them, as a host whose scripts all use its modules
 * does, and evaluated with plain values or with bindings created once. A test whose way differs, recording what its implementations or its hooks are given, or resolving and evaluating directly, keeps its own.
 */
import { lexica } from '#lexica/lexica.js';

/** The imports a host of the modules supplies: one of each, under its own name. */
export const importsOf = modules => modules.map(module => module.name);

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
