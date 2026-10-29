# Versions

<a id="runtime-versions"></a>

An implementation says which it is, and what it follows, in `nexo.info.versions`, three versions that change apart:

| Property | What it is |
| --- | --- |
| `implementation` | The implementation's release version, which its packages carry, as `1.0.0-alpha.37`; its sources and every build of them report the same |
| `language` | The language specification version the implementation follows |
| `definition` | The definition format version the implementation supports |

Each is declared, never computed, and advances for its own reason: the implementation's version with each of its releases, the specification version as the language's contract changes, and the definition version as the serialized definition's does. Their numbers may coincide, and neither determines another, so one specification version is followed by many releases of an implementation, and a specification can describe a version ahead of the one an implementation follows.
