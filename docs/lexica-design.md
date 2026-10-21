# Lexica Design v1.0.0-alpha.32

The [Lexica specification](../spec/README.md) is the contract: the language, and the [runtime](../spec/runtime.md) a host builds on. This design sets out how this implementation is built to meet it, and the reasons behind the choices that shape it. It describes version 32, as the specification does; [the status overview](features-status.md) says where the implementation still differs.

In this document:

1. [Architecture](#architecture)
2. [Modules and registries](#modules-and-registries)
3. [Evaluation](#evaluation)
4. [Host calls](#host-calls)
5. [Tooling](#tooling)

## Architecture

A script passes through five stages. Each stage's output is the next one's input, and only the last runs a host's code.

| Stage | What it produces | Source |
| --- | --- | --- |
| Reading | A lossless syntax tree of the text, every token and its trivia kept | `Tokenizer`, `Parser`, `SyntaxTree` |
| Lowering | The definition, the script's JSON form, with the text location of each node | `Lowering`, `TextLocations` |
| Validation | The definition checked and frozen, whether text or a host produced it | `DefinitionValidator` |
| Resolution | Every member resolved against a registry, the result typed, the used declarations recorded | `LanguageResolver`, `ResolvedDefinition` |
| Evaluation | The value and its metadata, each read reported to the host | `Evaluator` |

The domain enters as late as it can. Reading knows the language, and, for text read through a registry, the registry's module names alone, since a module's name decides whether a word begins a namespace; it knows nothing else of any module. Lowering and validation know the language alone, so a text is checked, stored and formatted without a vocabulary. Resolution reads a module's declarations as data and runs none of its code; evaluation is the one stage that invokes implementations. That split is what lets a tool check a script before running it, and a host know what an evaluation will depend on before it starts.

`src/lexica.js`, the entry point, composes these stages into the public API and re-exports nothing internal. Nothing in `src/` imports from outside it or reads a browser global, so the runtime runs in any JavaScript host.

## Modules and registries

A module validates its declarations once, as it is created, and freezes them: every declaration is data but its implementation, which is kept by reference and never frozen. One shape serves every kind of declaration, so the same validation covers all of them and a field one kind does not take is refused, never ignored. Keeping implementations in the declarations they carry out means a member's name is written once, and a tool reading the declarations reads exactly what resolution reads.

A registry indexes what its modules declare: members by name, each name holding one declaration for each set of receivers; predicates and observation types by name; conversions by their source type and their target; and the owner of every declaration. Registering checks a module whole against those indexes before it adds anything, so a refused module leaves no trace, and every registration advances the registry's revision. A resolution records the revision it was made at, and an evaluator refuses a registry that has moved since, so no evaluation ever reads a vocabulary its resolution did not.

`ParsedTexts` keeps the definitions of the 256 texts parsed most recently, with the module names each was read with, so reading the same text again, as a host does at every evaluation of the same script, costs a lookup.

## Evaluation

The evaluator compiles each node of a resolved definition once, into a function that holds what no evaluation changes, and keeps those functions by the definition and the registry they were compiled against; each evaluation then runs the functions with the state that is its own. A resolution can be reused by any evaluator with bindings of its key, so a host evaluating one script for many values pays for its resolution and its compilation once.

The hooks a host gives an evaluation are called around each member's implementation, never inside the language's own operators, so what a host learns is exactly what the evaluation read of its domain. An evaluation's state, its pending members and the records of what it read, belongs to it alone, which is why an implementation that evaluates another script never disturbs the one that called it.

A result is detached from everything the evaluation touched: the evaluator copies the data a member answers through the fields its type declares, and freezes the copy, so neither a host's later changes nor an implementation that keeps a reference can alter a result once produced. The metadata beside the value is recorded as the value is built, from the same compiled functions, so describing a result costs nothing until a host reads its metadata.

## Host calls

Lexica resolves and evaluates the scripts a host gives it; when they run, and what a host call does, are the host's. A host's calls differ in their lifecycles, one answering once, one delivering values over time, one running until it is ended, and each lifecycle is a contract of the host with its callers, never a rule of the language. Lexica therefore knows a single fact of a function, who invokes it, and none of the lifecycles: building them into the language as kinds of member and of request would tie every host to one host's operations, and leave each new lifecycle a change to Lexica.

What a host call needs of Lexica is what every call needs: its receiver, its arguments and their types checked, and the values it gives back typed and shaped. Resolution checks a host call as it checks any call, and refuses one anywhere but at a script's end, so no evaluation can reach it. Preparing it evaluates its receiver and its arguments with the compiled functions evaluation uses, and projecting a supplied value checks and takes the value as the evaluator takes any member's answer and runs the result projection as an evaluation of its own, so a host that supplies many values pays for the projection's compilation once. A host call takes value arguments alone, since an expression argument is evaluated by its member while the member's invocation lasts, which a host call's never does within an evaluation.

A type selector is the general form of choosing a call's result type by a fixed argument. A host's reports or commands of many kinds, each with data of its own, are one function whose fixed argument selects the type, and another module extends the selector with keys of its own as it extends another's types; scoping each mapping to its selector keeps one host's keys from colliding with another's.

## Tooling

Resolution is authoritative: it validates every script against the vocabulary available before the script runs, whether text or a definition produced it. Three properties keep validation open to editor tooling, such as analyzers and completion, which can follow without changing the language:

- **Locations.** Text positions and definition-node locations are kept, so a diagnostic names the member, argument or object expression that failed; the mapping from text to definition can be kept apart from the definition.
- **Declarative metadata.** A module's declarations are data, so a tool understands them without running a capability's implementation.
- **Independent validation.** Structural and vocabulary validation run without a host, given the metadata and the bindings' types.

A tool can check a source text known when the code is written against the metadata available to its project; text built at run time, modules registered at run time and checks that depend on bound values remain resolution's.

### The syntax tree

One parser serves the runtime and tooling alike. It reads a text into a lossless syntax tree, and the definition is lowered from that tree, so there is one grammar and one parser, and the definition stays the only contract the runtime resolves and evaluates.

- **Nodes for constructs.** A node stands for a construct written, named after the grammar rule that produces it, as `equality`, `conjunction` and `dot-property-access` are. A rule that only passes an operand on, a level of precedence or a repetition, produces no node of its own. Tokens and their trivia, comments among them, carry the complete text, so the tree gives the text back character for character.
- **Errors in one place.** Every syntax error the parser reports passes through one place, which a strict parse throws from. That is the foundation for recovery: a parser that records a missing token and skips an unexpected one, so a text being written gives a tree and useful diagnostics without cascades. Recovery serves the editor alone; reading a script from text still refuses any syntax error, and a missing token is never permission to guess what the text meant.
- **Tooling apart from the runtime.** Token types and node kinds are listed for tooling, and the tokenizer reads any text tolerantly, an invalid token holding its diagnostic, so a highlighter reads tokens, trivia, ranges and structure without resolving anything. An editor's parser is this one, never a copy of the grammar.
- **From syntax to meaning.** Lowering records the syntax node each definition node comes from, and a resolution maps each definition node to its declarations and types, so a tool joins a position in the text to what resolution knows of it: completion after `room.` reads the receiver's type, and renaming a local follows the scope resolution records for it.
- **What the runtime keeps.** A kept script holds its text, never its tree, so the runtime's memory is what it was before the tree existed; a tool that needs the tree reads the text again. A script created from a definition has no text, and its tree is the one read from its canonical text, marked generated.
- **Formatting that keeps the source.** `lexica.format` writes canonical text, which keeps no comment and no layout. Formatting that keeps comments and each string's written form is a tooling operation over the syntax tree, whose tokens keep each string's quote and delimiter length for it.
- **What it cost.** The tree was measured against the parser before it, before it was kept: the documents' scripts parse 7% slower and malformed texts 8% faster, a 60-field script within 3% with two-thirds more transient allocation, what a kept script retains is unchanged, and the bundle is 3% larger.

The tree is internal until a public tooling API stabilizes it; [the status overview](features-status.md) tracks recovery, that API, source-keeping formatting and editor tooling.
