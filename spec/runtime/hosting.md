# Hosting Nexo

<a id="runtime"></a>

An **implementation** of Nexo carries the language's rules out for a host: its parser reads a script's source into its definition and validates its structure, its resolver resolves it against a registry, and its **runtime** evaluates it, reporting each read to the host. The runtime contract is the one a host builds on, which every implementation of Nexo offers; this document introduces it, and the documents below set it out.

Three layers meet in every evaluation, and each owns its part:

| Layer | Owns | Specified in |
| --- | --- | --- |
| The language | The rules of what a script means: its syntax, its names and scope, its types, its expressions, and the contracts its vocabulary keeps | [The language contract](../README.md#the-language) |
| The implementation | Carrying those rules out for a host: its parser reads a script, its resolver resolves it against a registry, and its runtime evaluates it, holding its bindings, describing its results and reporting to its host | The runtime contract, these documents |
| The host | The application around the implementation: which modules it registers, when it evaluates, what it does with each result, what it does with each host call, and anything that spans evaluations, as keeping a result current | The host's own specification |

A host uses an implementation in four steps: it binds its values, resolves the script against its registry, creates an evaluator, and evaluates it as often as it needs.

```js
const bindings = registry.createBindings({ room: livingRoom });
const resolution = registry.resolve('{ name = room.name, total = room.devices.count }', bindings);
const evaluator = resolution.createEvaluator(bindings, env);
const { value, metadata } = evaluator.evaluate();
```

Each part of the contract has a document of its own:

| Document | What it sets out |
| --- | --- |
| [Bindings](bindings.md) | Binding a host's values to a script's parameters, how each is typed, and the resolution key |
| [Resolution](resolution.md) | Resolving a script, what a resolution answers, result paths, locations and reusing a resolution |
| [Evaluation](evaluation.md) | Evaluators and their hooks, results and their metadata, and a value in a host's form |
| [Host calls](host-calls.md) | Preparing a host call and projecting what its host supplies |
| [Modules](modules.md) | Creating a module, declaring its types and operators, internal declarations, duplicates and registries |
| [Members](members.md) | Declaring a member, its parameters, the declaration helpers, and how a member reads and changes |
| [Extensions](extensions.md) | Declaring an extension |
| [Observations](observations.md) | Observation types and targets, and the observations a member names |
| [Type selectors](type-selectors.md) | Declaring type selectors and their keys |
| [Definition](definition.md) | The JSON definition, its structural validation and its canonical text |
| [Versions](versions.md) | The versions an implementation reports |
