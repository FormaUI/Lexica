import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { nexo } from '#nexo/nexo.js';
import { Versions } from '#nexo/language/Versions.mjs';
import { repositoryRoot } from './support/paths.mjs';

// A path from the repository root, read as text.
const read = path => readFileSync(resolve(repositoryRoot, path), 'utf8');

describe('Alignment', () => {
    const specification = read('spec/README.md');
    const status = read('docs/features-status.md');
    const design = read('docs/nexo-design.md');
    const project = read('nuget/Forma.Nexo.csproj');
    const npmPackage = JSON.parse(read('package.json'));

    it('has a specification and a design titled with the one version the specification describes, which its version line names and the design describes, with the definition version', () => {
        const [, described] = specification.match(/^# Nexo Specification v(\S+)$/m);
        const [, definition] = specification.match(/describes definition version (\d+)\./);

        expect(design.match(/^# Nexo Design v(\S+)$/m)[1]).toBe(described);
        expect(specification).toContain(`describes language version \`${described}\``);
        expect(design).toContain(`describes language version \`${described}\` and definition version ${definition}`);
    });

    it('reports the language and definition versions it implements, which the status table names', () => {
        const [, language] = status.match(/^\| Language \| `([^`]+)` \|/m);
        const [, definition] = status.match(/^\| Definition format \| (\d+) \|/m);

        expect(language).toBe(nexo.info.versions.language);
        expect(Number(definition)).toBe(nexo.info.versions.definition);
    });

    it('has a specification whose example definition is of the definition version it describes', () => {
        const [, version] = read('spec/runtime/definition.md').match(/"version": (\d+),/);
        const [, described] = specification.match(/describes definition version (\d+)\./);

        expect(Number(version)).toBe(Number(described));
    });

    it('has packages and a bundle that carry the implementation version the sources declare, and report it', async () => {
        const { bundle } = await import('../scripts/bundle.mjs');

        expect(project).toContain('src\\language\\Versions.mjs');
        expect(npmPackage.version).toBe(Versions.implementation);
        expect(nexo.info.versions.implementation).toBe(Versions.implementation);
        expect(await bundle()).toContain(JSON.stringify(Versions.implementation));
    });

    it('has a language history whose newest entry is the version the specification describes, with its definition format', () => {
        const history = read('LANGUAGE-HISTORY.md');
        const [, newest, format] = history.match(/^## `([^`]+)`\r?\n\r?\n\*[^·*]+· definition format (\d+)\*/m);
        const [, described] = specification.match(/^# Nexo Specification v(\S+)$/m);
        const [, definition] = specification.match(/describes definition version (\d+)\./);

        expect(newest).toBe(described);
        expect(Number(format)).toBe(Number(definition));
    });

    it('has a README that names the implementation\'s version and the language version it implements, the one the specification describes', () => {
        const readme = read('README.md');
        const [, described] = specification.match(/^# Nexo Specification v(\S+)$/m);

        expect(nexo.info.versions.language).toBe(described);
        expect(readme).toContain(`The implementation, \`${nexo.info.versions.implementation}\`, implements language version \`${described}\`.`);
    });
});
