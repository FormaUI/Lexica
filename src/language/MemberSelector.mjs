/**
 * MemberSelector — the one selection of a declaration among those of a name an access reads for a receiver: a member, a named indexer or an unnamed one, the owner of the receiver's type first and the most specific
 * otherwise; and which members an extension access reads
 */

import { Vocabulary } from './vocabulary/Vocabulary.mjs';

/**
 * What a selection answers: the declaration it selects; the declarations it can't choose among; the internal declarations alone applying, which no script reaches; or none, where none applies.
 * @typedef {{ kind: 'selected', declaration: object } | { kind: 'ambiguous', declarations: object[] } | { kind: 'internal', declarations: object[] } | { kind: 'none' }} Selection
 */

export class MemberSelector {
    /** The registry whose declarations it selects among, which owns their types, their extensions and their accessibility. */
    #registry;

    /** The checker of the relation a receiver applies to a declaration by, and of which receiver type is the more specific. */
    #typeChecker;

    /**
     * @param {object} registry The registry whose declarations it selects among.
     * @param {object} typeChecker The checker of the registry's types.
     */
    constructor(registry, typeChecker) {
        this.#registry = registry;
        this.#typeChecker = typeChecker;
    }

    /**
     * Selects, among the candidates an access reads, the declaration a receiver of the type reads, as a member is selected wherever it is written: of those applicable to the receiver, an internal one is no candidate; an
     * applicable member the owner of the receiver's type declares on the types it owns wins over every other, the most specific of them hiding the others; and otherwise the applicable declaration whose receiver type is more
     * specific than every other's is selected, a member another module declares within a supertype, or an extension member, among them. It answers the competing declarations where none is more specific than every other.
     * Registration order never decides.
     * @param {object[]} candidates The declarations of the name the access reads, `.` the members of types and `:` the extension members, or the unnamed indexers.
     * @returns {Selection}
     */
    select(candidates, receiverType) {
        const applicable = candidates.filter(declaration => this.#typeChecker.resolveApplyingReceiverType(declaration, receiverType) !== undefined);
        const accessible = applicable.filter(declaration => !this.#registry.isInternal(declaration));

        if (accessible.length === 0) {
            return applicable.length === 0 ? { kind: 'none' } : { kind: 'internal', declarations: applicable };
        }

        const owner = MemberSelector.#ownerOf(receiverType);
        const owned = accessible.filter(declaration => this.#isOwnedBy(declaration, owner));
        const competing = this.#typeChecker.mostSpecificOf(owned.length > 0 ? owned : accessible, receiverType);

        // An indexer's signatures compete as one candidate, its first standing for them, which its key's type then chooses among.
        if (competing.length === 1 || this.#areSignaturesOfOne(competing)) {
            return { kind: 'selected', declaration: competing[0] };
        }

        return { kind: 'ambiguous', declarations: competing };
    }

    /** Whether the declarations are all signatures of one indexer, as the registry gives them. */
    #areSignaturesOfOne(declarations) {
        const signatures = this.#registry.getIndexerSignatures(declarations[0]);

        return signatures.length > 1 && declarations.every(declaration => signatures.includes(declaration));
    }

    /** Whether the member is an extension member, which `:` reads and `.` never does: one declared within an extension, whichever module declares it and whichever type it extends. */
    isExtensionMember(declaration) {
        return this.#registry.getContainingType(declaration)?.kind === 'extension';
    }

    /** The candidates a receiver of unknown type may read, which choose no declaration: the accessible ones, an internal one no candidate. */
    getAccessible(candidates) {
        return candidates.filter(declaration => !this.#registry.isInternal(declaration));
    }

    /** The name of the module that owns the type: the module that declares it, Nexo's own for its value types; none for a type no declaration names, an object type among them. */
    static #ownerOf(type) {
        if (type.kind !== 'named') {
            return null;
        }

        return type.moduleName ?? Vocabulary.moduleName;
    }

    /** Whether the member is one the owner declares within a type of its own, a type or Nexo's own value type, never an extension member. */
    #isOwnedBy(declaration, owner) {
        const containing = this.#registry.getContainingType(declaration);

        return owner !== null && containing !== undefined && !this.isExtensionMember(declaration) && this.#registry.getDeclaringModuleName(declaration) === owner;
    }
}
