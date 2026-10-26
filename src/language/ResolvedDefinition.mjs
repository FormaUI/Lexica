/**
 * ResolvedDefinition — a definition resolved against the vocabulary: the host call it ends in, the type of its result, and what each of its nodes resolved to
 */

export class ResolvedDefinition {
    #definition;
    #type;
    #hostCall;
    #resolutions;
    #usedDeclarations;

    /** Each node of the definition's expression, by the node itself, with its JSON Pointer and what it resolved to. @type {Map<object, { pointer: string, resolution: object | undefined }>} */
    #nodes = new Map();

    /** The name of each field of each object expression of the definition's expression, in order, by the expression's node. @type {Map<object, string[]>} */
    #fieldNames = new Map();

    /**
     * @param {object} definition The request's definition, whose every node is an object of its own.
     * @param {import('./Type.mjs').Type | null} type The type of its result, null for a host call that supplies nothing.
     * @param {{ node: object, pointer: string, name: string, declaration: object | null } | null} hostCall The host call the script ends in, null for one that gives a value.
     * @param {Map<string, object>} resolutions What each member node, by its JSON Pointer, resolved to.
     * @param {object[]} usedDeclarations The declarations the request uses, each with the pointer that used it and the name a message gives it, qualified by the type its declaration is for.
     * @param {{ node: object, pointer: string, bodyPointer: string }[]} instances The copy of a function's body each call resolved, with the pointer it was resolved under and the pointer of the body it copies.
     */
    constructor(definition, type, hostCall, resolutions, usedDeclarations, instances = []) {
        this.#definition = definition;
        this.#type = type;
        this.#hostCall = hostCall;
        this.#resolutions = resolutions;
        this.#usedDeclarations = Object.freeze([...usedDeclarations]);
        this.#instances = instances;
        this.#index(definition.expression, '/expression');
        instances.forEach(instance => this.#index(instance.node, instance.pointer));
    }

    /** @type {{ node: object, pointer: string, bodyPointer: string }[]} */
    #instances;

    /** Resolves the pointer into the definition a pointer names, a pointer into a call's copy of a function's body naming the part of the body it copies, and any other pointer itself. */
    resolveDefinitionPointer(pointer) {
        return ResolvedDefinition.resolveDefinitionPointer(pointer, this.#instances);
    }

    /** The pointer into the definition a pointer names among the instances, each call's copy of a function's body taken back to the body it copies, a copy within a copy as many times as it is one. */
    static resolveDefinitionPointer(pointer, instances) {
        let definitionPointer = pointer;

        for (let instance = ResolvedDefinition.#instanceOf(definitionPointer, instances); instance !== undefined; instance = ResolvedDefinition.#instanceOf(definitionPointer, instances)) {
            definitionPointer = `${instance.bodyPointer}${definitionPointer.slice(instance.pointer.length)}`;
        }

        return definitionPointer;
    }

    /** The instance whose pointer the pointer is or lies beneath, the innermost one, which is resolved after the one it lies in. */
    static #instanceOf(pointer, instances) {
        return instances.findLast(instance => pointer === instance.pointer || pointer.startsWith(`${instance.pointer}/`));
    }

    /** The request's definition. */
    get definition() {
        return this.#definition;
    }

    /** The type of the request's result, null for a host call that supplies nothing. */
    get type() {
        return this.#type;
    }

    /** The host call the script ends in: its node, where it stands, its name and its declaration, null on a receiver of unknown type; null for a script that gives a value. */
    get hostCall() {
        return this.#hostCall;
    }

    /** The declarations the request uses, with where each is used and the name a message gives it. */
    get usedDeclarations() {
        return this.#usedDeclarations;
    }

    /** The conversions the request uses, each once, a branch evaluation may not take among them. */
    get usedConversions() {
        return [...new Set([...this.#resolutions.values()].filter(resolution => resolution.kind === 'conversion' && resolution.declaration !== null).map(resolution => resolution.declaration))];
    }

    /** What the member node at the pointer resolved to. */
    getResolution(pointer) {
        return this.#resolutions.get(pointer);
    }

    /**
     * What the node of the definition resolved to.
     * @internal
     */
    resolutionOf(node) {
        return this.#nodes.get(node)?.resolution;
    }

    /**
     * The JSON Pointer of the node of the definition.
     * @internal
     */
    pointerOf(node) {
        return this.#nodes.get(node)?.pointer;
    }

    /**
     * The name of each field of the object expression node of the definition, in order: the name it was given, or the one it infers.
     * @internal
     */
    fieldNamesOf(node) {
        return this.#fieldNames.get(node);
    }

    /** Records the node at the pointer and every node beneath it, each with its pointer and its resolution. */
    #index(node, pointer) {
        this.#nodes.set(node, { pointer, resolution: this.#resolutions.get(pointer) });

        if (node.target !== undefined) {
            this.#index(node.target, `${pointer}/target`);
        }

        switch (node.kind) {
            case 'member':
                if (typeof node.name !== 'string') {
                    this.#index(node.name, `${pointer}/name`);
                }
                break;
            case 'indexer':
                this.#index(node.argument, `${pointer}/argument`);
                break;
            case 'object':
                node.locals?.forEach((local, index) => this.#index(local.value, `${pointer}/locals/${index}/value`));
                node.fields.forEach((field, index) => this.#index(field.value, `${pointer}/fields/${index}/value`));
                this.#fieldNames.set(node, node.fields.map(field => field.name));
                break;
            case 'equality':
                this.#index(node.left, `${pointer}/left`);
                this.#index(node.right, `${pointer}/right`);
                break;
            case 'conditional':
                if (node.binding !== undefined) {
                    this.#index(node.binding.value, `${pointer}/binding/value`);
                }

                for (const branch of ['condition', 'consequent', 'alternative']) {
                    if (node[branch] !== undefined) {
                        this.#index(node[branch], `${pointer}/${branch}`);
                    }
                }
                break;
            case 'body':
                node.locals.forEach((local, index) => this.#index(local.value, `${pointer}/locals/${index}/value`));
                this.#index(node.result, `${pointer}/result`);
                break;
            case 'do':
                this.#index(node.body, `${pointer}/body`);
                break;
            case 'function':
                this.#index(node.body, `${pointer}/body`);
                break;
            case 'call':
            case 'functionCall':
                node.arguments.forEach((argument, index) => this.#index(argument, `${pointer}/arguments/${index}`));
                break;
            case 'interpolatedString':
                node.parts.forEach((part, index) => {
                    if (part.kind === 'expression') {
                        this.#index(part.expression, `${pointer}/parts/${index}/expression`);
                    }
                });
                break;
            case 'and':
            case 'or':
            case 'comparison':
                node.operands.forEach((operand, index) => this.#index(operand, `${pointer}/operands/${index}`));
                break;
            case 'not':
            case 'negate':
                this.#index(node.operand, `${pointer}/operand`);
                break;
            case 'arithmetic':
                this.#index(node.left, `${pointer}/left`);
                this.#index(node.right, `${pointer}/right`);
                break;
            case 'coalescing':
                this.#index(node.value, `${pointer}/value`);
                this.#index(node.fallback, `${pointer}/fallback`);
                break;
        }
    }
}
