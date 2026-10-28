/**
 * ResolvedDefinition — a definition resolved against the vocabulary: the host call it ends in, the type of its result, and what each of its nodes resolved to
 */

export class ResolvedDefinition {
    #definition;
    #type;
    #hostCall;
    #resolutions;
    #usedDeclarations;
    #deferredAccesses;

    /** Each node of the definition's expression, by the node itself, with its JSON Pointer and what it resolved to. @type {Map<object, { pointer: string, resolution: object | undefined }>} */
    #nodes = new Map();

    /** The name of each field of each object expression of the definition's expression, in order, by the expression's node. @type {Map<object, string[]>} */
    #fieldNames = new Map();

    /**
     * @param {object} definition The request's definition, whose every node is an object of its own.
     * @param {import('./Type.mjs').Type | null} type The type of its result, null for a host call that supplies nothing.
     * @param {{ node: object, pointer: string, name: string, declaration: object | null } | null} hostCall The host call the script ends in, null for one that gives a value.
     * @param {Map<string, object>} resolutions What each member node, by its JSON Pointer, resolved to.
     * @param {object[]} usedDeclarations The declarations the request uses, each with the pointer that used it, a call's copy of a function's body among them, and its qualified name, the name a message gives it, qualified
     * by the type its declaration is for.
     * @param {{ name: string | null, pointer: string, candidates: object[] }[]} deferredAccesses The accesses whose member is selected during evaluation, each with the name it accesses, null for an unnamed indexer,
     * and the declarations its selection could choose, each a use at its pointer.
     * @param {{ node: object, pointer: string, bodyPointer: string }[]} functionBodyCopies The copy of a function's body each call resolved, with the pointer it was resolved under and the pointer of the body it copies.
     */
    constructor(definition, type, hostCall, resolutions, usedDeclarations, deferredAccesses, functionBodyCopies = []) {
        this.#definition = definition;
        this.#type = type;
        this.#hostCall = hostCall;
        this.#resolutions = resolutions;
        this.#functionBodyCopies = functionBodyCopies;
        this.#usedDeclarations = Object.freeze(this.#definitionUsesOf(usedDeclarations));
        this.#deferredAccesses = Object.freeze(this.#definitionAccessesOf(deferredAccesses));
        this.#index(definition.expression, '/expression');
        functionBodyCopies.forEach(bodyCopy => this.#index(bodyCopy.node, bodyCopy.pointer));
    }

    /** @type {{ node: object, pointer: string, bodyPointer: string }[]} */
    #functionBodyCopies;

    /**
     * The uses, each named by the pointer into the definition it stands at, as a hook's request names its call, a body copy's pointer taken back to the body it copies; a declaration is kept once at each pointer, since
     * every call of one function resolves its body's uses again.
     */
    #definitionUsesOf(usedDeclarations) {
        const kept = [];

        for (const use of usedDeclarations) {
            const pointer = this.resolveDefinitionPointer(use.pointer);

            if (!kept.some(other => other.declaration === use.declaration && other.pointer === pointer)) {
                kept.push({ ...use, pointer });
            }
        }

        return kept;
    }

    /** The deferred accesses, each named by the pointer into the definition it stands at, as a use is, and kept once at each pointer, since every call of one function resolves its body's accesses again. */
    #definitionAccessesOf(deferredAccesses) {
        const kept = new Map();

        for (const access of deferredAccesses) {
            const pointer = this.resolveDefinitionPointer(access.pointer);

            if (!kept.has(pointer)) {
                kept.set(pointer, { ...access, pointer, candidates: access.candidates.map(candidate => ({ ...candidate, pointer })) });
            }
        }

        return [...kept.values()];
    }

    /** Resolves the pointer into the definition a pointer names, a pointer into a call's copy of a function's body naming the part of the body it copies, and any other pointer itself. */
    resolveDefinitionPointer(pointer) {
        return ResolvedDefinition.resolveDefinitionPointer(pointer, this.#functionBodyCopies);
    }

    /** The pointer into the definition a pointer names among the function body copies, each call's copy of a function's body taken back to the body it copies, a copy within a copy as many times as it is one. */
    static resolveDefinitionPointer(pointer, functionBodyCopies) {
        let definitionPointer = pointer;

        for (let bodyCopy = ResolvedDefinition.#bodyCopyOf(definitionPointer, functionBodyCopies); bodyCopy !== undefined; bodyCopy = ResolvedDefinition.#bodyCopyOf(definitionPointer, functionBodyCopies)) {
            definitionPointer = `${bodyCopy.bodyPointer}${definitionPointer.slice(bodyCopy.pointer.length)}`;
        }

        return definitionPointer;
    }

    /** The body copy whose pointer the pointer is or lies beneath, the innermost one, which is resolved after the one it lies in. */
    static #bodyCopyOf(pointer, functionBodyCopies) {
        return functionBodyCopies.findLast(bodyCopy => pointer === bodyCopy.pointer || pointer.startsWith(`${bodyCopy.pointer}/`));
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

    /** The declarations the request uses, with where each is used in the definition and the name a message gives it. */
    get usedDeclarations() {
        return this.#usedDeclarations;
    }

    /** The accesses whose member is selected during evaluation, by its value's actual type, each with where it stands in the definition, the name it accesses and the declarations its selection could choose. */
    get deferredAccesses() {
        return this.#deferredAccesses;
    }

    /**
     * Every declaration evaluation could select: the used declarations, and each deferred access's candidates at its pointer, every accessible declaration of its name and form, which its value's actual type selects one
     * of or none of, so they are an overestimate wherever a deferred access remains.
     */
    get candidateDeclarations() {
        return this.#definitionUsesOf([...this.#usedDeclarations, ...this.#deferredAccesses.flatMap(access => access.candidates)]);
    }

    /**
     * The copy of a function's body each call resolved, with the pointer it was resolved under and the pointer of the body it copies.
     * @internal
     */
    get functionBodyCopies() {
        return this.#functionBodyCopies;
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

        // What a node continues from or ends at: an access's receiver, a call's callee, an object expression's context and an optional chain's chain.
        for (const property of ['receiver', 'callee', 'context', 'chain']) {
            if (node[property] !== undefined) {
                this.#index(node[property], `${pointer}/${property}`);
            }
        }

        switch (node.kind) {
            case 'memberAccess':
                if (typeof node.name !== 'string') {
                    this.#index(node.name, `${pointer}/name`);
                }
                break;
            case 'indexerAccess':
                this.#index(node.argument, `${pointer}/argument`);
                break;
            case 'object':
                node.locals?.forEach((local, index) => this.#index(local.value, `${pointer}/locals/${index}/value`));
                node.objectFields.forEach((field, index) => this.#index(field.value, `${pointer}/objectFields/${index}/value`));
                this.#fieldNames.set(node, node.objectFields.map(field => field.name));
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
            case 'arithmeticNegation':
            case 'cast':
            case 'conversion':
            case 'try':
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
