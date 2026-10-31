/**
 * ResolvedDefinition — a definition resolved against the vocabulary: the host call it ends in, the type of its result, and what each of its nodes resolved to
 */

/** The character that begins each segment of a JSON Pointer. */
const SLASH = '/'.charCodeAt(0);

export class ResolvedDefinition {
    #definition;
    #type;
    #hostCall;
    #resolutions;
    #usedDeclarations;
    #deferredAccesses;

    /** The JSON Pointer each node of the definition's expression stands at, by the node, a call's copy of a function's body among them, as resolution recorded it reaching the node. @type {WeakMap<object, string>} */
    #pointers;

    /**
     * @param {object} definition The request's definition, whose every node is an object of its own.
     * @param {import('./Type.mjs').Type | null} type The type of its result, null for a host call that supplies nothing.
     * @param {{ node: object, pointer: string, name: string, declaration: object | null } | null} hostCall The host call the script ends in, null for one that gives a value.
     * @param {Map<string, object>} resolutions What each member node, by its JSON Pointer, resolved to.
     * @param {WeakMap<object, string>} pointers The JSON Pointer each node resolution reached stands at, by the node.
     * @param {object[]} usedDeclarations The declarations the request uses, each with the pointer that used it, a call's copy of a function's body among them, and its qualified name, the name a message gives it, qualified
     * by the type its declaration is for.
     * @param {{ name: string | null, pointer: string, candidates: object[] }[]} deferredAccesses The accesses whose member is selected during evaluation, each with the name it accesses, null for an unnamed indexer,
     * and the declarations its selection could choose, each a use at its pointer.
     * @param {{ node: object, pointer: string, bodyPointer: string }[]} functionBodyCopies The copy of a function's body each call resolved, with the pointer it was resolved under and the pointer of the body it copies.
     * @param {boolean} mayRecognize Whether evaluating it may ask a module's `typeOf` of a value, in any branch, reached or not; true where left out, so a resolution that doesn't say is made stale by every module
     * declaring a `typeOf`, never kept current past one.
     */
    constructor(definition, type, hostCall, resolutions, pointers, usedDeclarations, deferredAccesses, functionBodyCopies = [], mayRecognize = true) {
        this.#mayRecognize = mayRecognize;
        this.#definition = definition;
        this.#type = type;
        this.#hostCall = hostCall;
        this.#resolutions = resolutions;
        this.#pointers = pointers;
        this.#functionBodyCopies = functionBodyCopies;
        this.#usedDeclarations = Object.freeze(this.#definitionUsesOf(usedDeclarations));
        this.#deferredAccesses = Object.freeze(this.#definitionAccessesOf(deferredAccesses));
    }

    /** @type {{ node: object, pointer: string, bodyPointer: string }[]} */
    #functionBodyCopies;

    /**
     * The uses, each named by the pointer into the definition it stands at, as a hook's request names its call, a body copy's pointer taken back to the body it copies; a declaration is kept once at each pointer, since
     * every call of one function resolves its body's uses again.
     */
    #definitionUsesOf(usedDeclarations) {
        const kept = [];
        // The declarations kept at each pointer, so a use is looked for among those at its own pointer alone.
        const keptAt = new Map();

        for (const use of usedDeclarations) {
            const pointer = this.resolveDefinitionPointer(use.pointer);
            let declarations = keptAt.get(pointer);

            if (declarations === undefined) {
                declarations = new Set();
                keptAt.set(pointer, declarations);
            }

            if (!declarations.has(use.declaration)) {
                declarations.add(use.declaration);
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

    /**
     * The pointer into the definition each pointer resolved to, by the pointer: valid for good, since the body copies never change, and released with this resolved definition. An evaluation with hooks resolves the pointer
     * of every invocation it reports, which would scan the body copies each time.
     * @type {Map<string, string>}
     */
    #definitionPointers = new Map();

    /** Resolves the pointer into the definition a pointer names, a pointer into a call's copy of a function's body naming the part of the body it copies, and any other pointer itself. */
    resolveDefinitionPointer(pointer) {
        let definitionPointer = this.#definitionPointers.get(pointer);

        if (definitionPointer === undefined) {
            definitionPointer = ResolvedDefinition.resolveDefinitionPointer(pointer, this.#functionBodyCopies);
            this.#definitionPointers.set(pointer, definitionPointer);
        }

        return definitionPointer;
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
        for (let index = functionBodyCopies.length - 1; index >= 0; index--) {
            const bodyCopy = functionBodyCopies[index];
            const { length } = bodyCopy.pointer;

            // The pointer is the copy's, or one beneath it, whose next segment begins with a slash.
            if (pointer.startsWith(bodyCopy.pointer) && (pointer.length === length || pointer.charCodeAt(length) === SLASH)) {
                return bodyCopy;
            }
        }

        return undefined;
    }

    #mayRecognize;

    /**
     * Whether evaluating it may recognize a value, asking each module's `typeOf`, in any branch, reached or not: where a declaration it uses gives the script a value of `Any`, a deferred access among them, or it ends
     * in a host call whose supplied type holds a nullable reference type. A registration changes a resolution through recognition alone, so one that may not stays current whatever is registered after it.
     */
    get mayRecognize() {
        return this.#mayRecognize;
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
        return this.#resolutions.get(this.#pointers.get(node));
    }

    /**
     * The JSON Pointer of the node of the definition.
     * @internal
     */
    pointerOf(node) {
        return this.#pointers.get(node);
    }
}
