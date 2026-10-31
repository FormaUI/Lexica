import { describe, it, expect } from 'vitest';
import { ScopeLocals } from '#nexo/language/ScopeLocals.mjs';

/** The scope with each name added in turn, each holding its name and its place. */
const scopeOf = (names, scope = ScopeLocals.empty) => names.reduce((scopeSoFar, name, index) => scopeSoFar.with(name, `${name}${index}`), scope);

describe('ScopeLocals', () => {
    it('holds no name when empty', () => {
        expect([ScopeLocals.empty.has('a'), ScopeLocals.empty.get('a')]).toEqual([false, undefined]);
    });

    it('holds each name added, the one added last of a spelling hiding those before it, and leaves the scope it adds to as it was', () => {
        const outer = scopeOf(['a', 'b']);
        const inner = scopeOf(['a', 'c'], outer);

        expect(['a', 'b', 'c', 'd'].map(name => [inner.has(name), inner.get(name)])).toEqual([[true, 'a0'], [true, 'b1'], [true, 'c1'], [false, undefined]]);
        expect(['a', 'b', 'c'].map(name => [outer.has(name), outer.get(name)])).toEqual([[true, 'a0'], [true, 'b1'], [false, undefined]]);
    });

    it('keeps every name and every scope made on the way through as many names as a scope flattens', () => {
        const names = Array.from({ length: 50 }, (_, index) => `n${index % 30}`);
        const scopes = [];

        names.reduce((scope, name, index) => {
            const added = scope.with(name, index);

            scopes.push(added);

            return added;
        }, ScopeLocals.empty);

        scopes.forEach((scope, at) => {
            const expected = new Map(names.slice(0, at + 1).map((name, index) => [name, index]));

            expect(Array.from({ length: 31 }, (_, index) => scope.get(`n${index}`))).toEqual(Array.from({ length: 31 }, (_, index) => expected.get(`n${index}`)));
        });
    });

    it('holds an entry whatever it is, undefined among them', () => {
        const scope = ScopeLocals.empty.with('a', undefined);

        expect([scope.has('a'), scope.get('a')]).toEqual([true, undefined]);
    });
});
