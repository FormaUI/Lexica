import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';

// A path from the repository root, read as text.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

describe('Alignment', () => {
    const specification = read('docs/lexica-specification.md');
    const design = read('docs/lexica-design.md');
    const project = read('nuget/Forma.Lexica.csproj');
    const npmPackage = JSON.parse(read('package.json'));

    it('has a specification and a design titled with the version of the implementation', () => {
        expect(specification.match(/^# Lexica Specification v(\S+)$/m)[1]).toBe(lexica.info.specificationVersion);
        expect(design.match(/^# Lexica Design v(\S+)$/m)[1]).toBe(lexica.info.specificationVersion);
    });

    it('has packages that are the alpha of the specification, the NuGet one numbered by the commits it is built from', () => {
        const [, prefix] = project.match(/<VersionPrefix>(.+?)<\/VersionPrefix>/);

        expect(`${prefix}-alpha`).toBe(lexica.info.specificationVersion);
        expect(npmPackage.version).toBe(lexica.info.specificationVersion);
        expect(project).toContain('<Version>$(VersionPrefix)-alpha.$(CommitCount)</Version>');
        expect(lexica.info.version).toBe(`${prefix}-alpha+source`);
    });

    it('has a specification whose example definition is of the version it describes, saying which version the implementation reads', () => {
        const [, version] = specification.match(/"version": (\d+),\s+"expression"/);
        const [, described, implemented] = specification.match(/describes definition version (\d+)\. The implementation in this repository still reads version (\d+),/);

        expect(Number(version)).toBe(Number(described));
        expect(Number(implemented)).toBe(lexica.info.definitionVersion);
    });
});
