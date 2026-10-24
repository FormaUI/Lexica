import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Versions } from '#lexica/language/Versions.mjs';

// A path from the repository root, read as text.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

describe('Alignment', () => {
    const specification = read('spec/README.md');
    const status = read('docs/features-status.md');
    const design = read('docs/lexica-design.md');
    const project = read('nuget/Forma.Lexica.csproj');
    const npmPackage = JSON.parse(read('package.json'));

    it('has a specification and a design titled with the one version the specification describes, which its version line names', () => {
        const [, described] = specification.match(/^# Lexica Specification v(\S+)$/m);

        expect(design.match(/^# Lexica Design v(\S+)$/m)[1]).toBe(described);
        expect(specification).toContain(`describes language version \`${described}\``);
    });

    it('reports the language and definition versions it implements, which the status table names', () => {
        const [, language] = status.match(/^\| Language \| `([^`]+)` \|/m);
        const [, definition] = status.match(/^\| Definition format \| (\d+) \|/m);

        expect(language).toBe(lexica.info.versions.language);
        expect(Number(definition)).toBe(lexica.info.versions.definition);
    });

    it('has a specification whose example definition is of the definition version it describes', () => {
        const [, version] = read('spec/definition.md').match(/"version": (\d+),/);
        const [, described] = specification.match(/describes definition version (\d+)\./);

        expect(Number(version)).toBe(Number(described));
    });

    it('has packages and a bundle that carry the runtime version the sources declare, and report it', async () => {
        const { bundle } = await import('../scripts/bundle.mjs');

        expect(project).toContain('src\\language\\Versions.mjs');
        expect(npmPackage.version).toBe(Versions.runtime);
        expect(lexica.info.versions.runtime).toBe(Versions.runtime);
        expect(await bundle()).toContain(JSON.stringify(Versions.runtime));
    });

    it('has a README that heads the language\'s features with the version the specification describes, and the implementation\'s with the version it reports', () => {
        const readme = read('README.md');
        const [, described] = specification.match(/^# Lexica Specification v(\S+)$/m);

        expect(readme).toContain(`### Language (\`${described}\`)`);
        expect(readme).toContain(`### Implementation (\`${lexica.info.versions.runtime}\`)`);
        expect(readme).toContain(`implements language version \`${lexica.info.versions.language}\``);
    });
});
