import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { repositoryRoot } from '../support/paths.mjs';

/** The imports a text is read with where it reads the examples' namespaces, which a text without imports reads as parameters. */
const EXAMPLE_IMPORTS = ['Home', 'Energy'];

/** Every file under the directory whose name the pattern matches, its dependencies' folders aside. */
const filesUnder = (directory, pattern) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
        return entry.name === 'node_modules' ? [] : filesUnder(path, pattern);
    }

    return pattern.test(entry.name) ? [path] : [];
});

/** The string literals a test's source writes, single-quoted, double-quoted or a template without substitutions, each as the string it is. */
const literalsOf = source => [...source.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.)*`/g)].map(([literal]) => {
    try {
        return new Function(`return ${literal}`)();
    } catch {
        return null;
    }
}).filter(text => typeof text === 'string' && text.trim() !== '');

/** The `lexica` blocks a document holds, each block's text whole. */
const blocksOf = source => [...source.matchAll(/^```lexica\n([\s\S]*?)^```$/gm)].map(([, block]) => block.replace(/\n$/, ''));

/** The definition the text reads as, with no imports supplied or the examples' imports, or null where it reads as neither. */
const definitionOf = text => {
    for (const imports of [[], EXAMPLE_IMPORTS]) {
        try {
            return { definition: lexica.parse(text, { imports }), imports };
        } catch {
            // A text that reads as no script, or not without the imports, is tried with them, and otherwise is no script.
        }
    }

    return null;
};

/** Every script the tests and the documents write, each with the imports it is read with, once each. */
const scripts = (() => {
    const sources = [
        ...filesUnder(resolve(repositoryRoot, 'tests'), /\.(m?js)$/).map(path => literalsOf(readFileSync(path, 'utf8'))).flat(),
        ...[...filesUnder(resolve(repositoryRoot, 'spec'), /\.md$/), ...filesUnder(resolve(repositoryRoot, 'docs'), /\.md$/), resolve(repositoryRoot, 'README.md')].map(path => blocksOf(readFileSync(path, 'utf8'))).flat(),
    ];

    return [...new Set(sources)].map(text => ({ text, read: definitionOf(text) })).filter(({ read }) => read !== null);
})();

describe('canonical text', () => {
    it('reads back as the same definition, laid out or compact, and gives itself again, for every script the tests and the documents write', () => {
        expect(scripts.length).toBeGreaterThan(500);

        for (const { text, read: { definition, imports } } of scripts) {
            const formatted = lexica.format(definition);
            const quoted = lexica.quote(definition);

            expect(lexica.parse(formatted), `format of ${JSON.stringify(text)}`).toEqual(definition);
            expect(lexica.parse(quoted), `quote of ${JSON.stringify(text)}`).toEqual(definition);
            expect(lexica.format(formatted), `format of format of ${JSON.stringify(text)}`).toBe(formatted);
            expect(lexica.quote(quoted), `quote of quote of ${JSON.stringify(text)}`).toBe(quoted);
            expect(lexica.parse(lexica.quote(definition, { imports }), { imports }), `quote of ${JSON.stringify(text)} with its imports supplied`).toEqual(definition);
        }
    });

    it('writes a body that uses return on lines of its own, a block holding one in block form, laid out and compact alike', () => {
        const body = 'let a = 1\nreturn a';
        const block = 'do\n    let a = 1\n    return a\nend';
        const local = 'let f = function(x)\n    let y = x\n    return y\nend\nreturn f(1)';

        expect([lexica.format(body), lexica.quote(body)]).toEqual([body, body]);
        expect([lexica.format('do\nlet a = 1\nreturn a\nend'), lexica.quote('do\nlet a = 1\nreturn a\nend')]).toEqual([block, block]);
        expect([lexica.format(local), lexica.quote(local)]).toEqual([local, local]);
    });

    it('writes a function expression or a do block whose one expression spans lines in block form, and one whose expression does not on one line', () => {
        const spanning = 'let f = function(x)\n    if x then\n        let y = 1\n        return y\n    else\n        return 0\n    end\nend\nreturn f(true)';

        expect([lexica.format(spanning), lexica.quote(spanning)]).toEqual([spanning, spanning]);
        expect(lexica.quote('let f = function(x) x end\nreturn do f(1) end')).toBe('let f = function(x) x end\nreturn do f(1) end');
    });

    it('writes a conditional with an elseif in block form laid out, and on one line compact where nothing in it spans lines', () => {
        const text = 'if a then 1 elseif b then 2 else 3 end';

        expect(lexica.format(text)).toBe('if a then\n    1\nelseif b then\n    2\nelse\n    3\nend');
        expect(lexica.quote(text)).toBe(text);
    });

    it('propagates block form outward from a body nested in an object, a call and a conditional, continuing after the end on its own line', () => {
        const inner = 'do\n    let x = 1\n    return x\nend';
        const object = '{\n    a = do\n        let x = 1\n        return x\n    end,\n    b = 2\n}';
        const call = 'f(if c then\n    {\n        a = 1,\n        b = 2\n    }\nelse\n    null\nend,\n2)';
        const conditional = 'if c then\n    do\n        let x = 1\n        return x\n    end\nelse\n    0\nend';
        const grouped = `(${inner}\n) + 2`;

        expect([lexica.format(object), lexica.quote(object)]).toEqual([object, object]);
        expect([lexica.format(call), lexica.quote(call)]).toEqual([call, 'f(if c then { a = 1, b = 2 } else null end, 2)']);
        expect([lexica.format(conditional), lexica.quote(conditional)]).toEqual([conditional, conditional]);
        expect([lexica.format(grouped), lexica.quote(grouped)]).toEqual([grouped, grouped]);
        expect(lexica.quote('{\n    a = 1,\n    b = 2\n}')).toBe('{ a = 1, b = 2 }');
    });

    it('writes imports with aliases and type imports, each on a line of its own in order of its local name, leaving out those the destination supplies', () => {
        const text = 'import Measures = Measurements\nimport Home.Sensor\nimport HomeLight = Home.Light\nMeasures.reading';

        expect(lexica.format(text)).toBe('import HomeLight = Home.Light\nimport Measures = Measurements\nimport Home.Sensor\n\nMeasures.reading');
        expect(lexica.quote(text)).toBe('import HomeLight = Home.Light\nimport Measures = Measurements\nimport Home.Sensor\nMeasures.reading');
        expect(lexica.quote(text, { imports: [{ module: 'Measurements', alias: 'Measures' }] })).toBe('import HomeLight = Home.Light\nimport Home.Sensor\nMeasures.reading');
        expect(lexica.format(text, { imports: [{ module: 'Measurements', alias: 'Measures' }, { module: 'Home', type: 'Sensor' }] })).toBe('import HomeLight = Home.Light\n\nMeasures.reading');
    });

    it('keeps an expression with no block in it on one line, however deeply nested', () => {
        const text = 'room { lit = it.devices.where(d => d.active() and not d.dimmed).count + (it.climate?.temperature ?? 0) * 2, name = $"{it.name}!" }';

        expect(lexica.quote(text)).toBe(text);
        expect(lexica.format('room.devices.where(d => d.active() and not d.dimmed).count + (room.climate?.temperature ?? 0) * 2')).toBe('room.devices.where(d => d.active() and not d.dimmed).count + (room.climate?.temperature ?? 0) * 2');
    });
});
