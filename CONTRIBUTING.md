# Contributing to Nexo

Thanks for helping improve Nexo. Bug reports, documentation fixes and code contributions are welcome.

For a small fix, you can open a pull request directly. For a larger change, open an issue first so we can agree on the approach before you spend time implementing it. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Set up

Nexo is a JavaScript library. A small .NET project builds its NuGet package.

You'll need:

- Node.js and npm.
- PowerShell to run the build scripts.
- The .NET SDK pinned in `nuget/global.json`.

After cloning the repository, install the test dependencies and run the tests:

```sh
cd tests
npm install
npm test
```

Run the full build from the repository root:

```powershell
./build.ps1
```

## Find your way around

| Location | Contents |
| --- | --- |
| `src/nexo.js` | The entry point, `nexo`, and its declarations in `src/nexo.d.ts` |
| `src/language/` | The language: text, definitions, types, resolution, errors and locations |
| `src/language/vocabulary/` | Modules, their registry, and Nexo's built-in vocabulary |
| `src/common/` | Object and array operations independent of the language |
| `tests/` | Tests arranged to match the source folders, run in Node with no browser |
| `scripts/` | Bundling scripts |
| `nuget/` | The NuGet package project |
| `spec/` | The specification: the language's contract in `language/` and the runtime's in `runtime/`, one document per subject, with its index |
| `docs/` | The design, the guide and the status overview |

The [specification](spec/README.md) defines the language and the runtime a host builds on, and the [design](docs/nexo-design.md) how Nexo is built. If a change affects either, update the relevant document before implementing it. The [status overview](docs/features-status.md) tracks what is implemented, what is being built, and what remains.

## Develop a change

Keep each change focused, and follow the surrounding code's conventions. Use `.editorconfig` for formatting and style. Add or update tests for every source module you change, beside the corresponding source under `tests/`.

Nexo depends on no domain and no browser: nothing in `src/` imports from outside it, which a test enforces, and its tests run in Node.
