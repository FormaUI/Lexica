/**
 * A script's way through the public pipeline that several tests take alike: resolved against a registry of the modules, and evaluated with plain values or with bindings created once. A test whose way differs, recording what
 * its implementations or its hooks are given, or resolving and evaluating directly, keeps its own.
 */
import { lexica } from '#lexica/lexica.js';

/** The resolution of the text against a registry of the modules, bound to the plain values given. */
export const resolveWith = (modules, text, values = {}) => lexica.createRegistry(modules).resolve(text, values);

/** The value the text evaluates to against a registry of the modules, the plain values given bound by the resolution and again by the evaluator. */
export const evaluateWith = (modules, text, values = {}) => lexica.createRegistry(modules).resolve(text, values).createEvaluator(values).evaluate().value;

/** The value the text evaluates to against a registry of the modules, its bindings created once from the values given and reused by the resolution and the evaluator. */
export const evaluateWithCreatedBindings = (modules, text, values = {}) => {
    const registry = lexica.createRegistry(modules);
    const bindings = registry.createBindings(values);

    return registry.resolve(text, bindings).createEvaluator(bindings).evaluate().value;
};
