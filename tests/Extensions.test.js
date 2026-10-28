import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { errorThrownBy } from './support/errors.mjs';
import { constantUpdates, derivedUpdates } from './support/updates.mjs';

const { createPropertyDeclaration, createFunctionDeclaration, createValueParameterDeclaration, createFunctionParameterDeclaration } = lexica.declarations;

/**
 * A module of extensions on Lexica's own types: a string's shout, a list's middle item, its `T` the list's items, and a receiver of any type's echo, its `T` the receiver's own type, each a member of its extension, which
 * names no target of its own.
 */
const createWords = () => lexica.createModule('words', {
    types: [
        { name: 'Shouting', kind: 'extension', target: 'String', members: [createPropertyDeclaration('shout', 'String', { updates: constantUpdates, impl: ({ receiver }) => receiver.toUpperCase() })] },
        { name: 'Middles<Item>', kind: 'extension', target: 'List<Item>', members: [createPropertyDeclaration('middle', 'Item?', { updates: derivedUpdates, impl: ({ receiver }) => receiver[Math.floor(receiver.length / 2)] ?? null })] },
        {
            name: 'Echoes<T>',
            kind: 'extension',
            target: 'T',
            members: [createFunctionDeclaration('echoes', 'Boolean', { updates: derivedUpdates, parameters: [createFunctionParameterDeclaration('test', 'Boolean', ['T'])], impl: ({ receiver, args }) => args.test(receiver) })],
        },
    ],
});

const values = { word: 'oat', counts: [1, 2, 3] };

/** The resolution of the text against a registry of the words. */
const resolve = text => lexica.createRegistry([createWords()]).resolve(text, values, { imports: ['words'] });

/** The value the text evaluates to against a registry of the words. */
const evaluate = text => resolve(text).createEvaluator(values).evaluate().value;

describe('extensions', () => {
    it('add members to their targets, read on a value of the target as any member is', () => {
        expect(evaluate('word.shout')).toBe('OAT');
        expect(resolve('word.shout').usedDeclarations.map(({ qualifiedName }) => qualifiedName)).toEqual(['String.shout']);
    });

    it('bind the parameters their names declare from the receiver, whatever a parameter is named, for every member of theirs', () => {
        expect(resolve('counts.middle').type).toBe('Number?');
        expect(evaluate('counts.middle')).toBe(2);
    });

    it('extend a receiver of any type through a parameter they declare and target, bound afresh to each call\'s receiver', () => {
        expect(evaluate('{ word = word.echoes(w => w == "oat"), count = counts.echoes(c => c.count == 3) }')).toEqual({ word: true, count: true });
    });

    it('are never reached through their module\'s namespace, which reaches the members of its own types alone', () => {
        expect(errorThrownBy(() => resolve('words.shout(word)'))).toMatchObject({ code: 'LEXICA3001' });
    });

    it('read a name no declaration around them declares as a type\'s, whatever its length', () => {
        const refused = errorThrownBy(() => lexica.createRegistry([lexica.createModule('words', { types: [{ name: 'Lasts', kind: 'extension', target: 'List<T>', members: [] }] })]));

        expect(refused).toMatchObject({ code: 'LEXICA4047', location: { module: 'words', declaration: 'Lasts' } });
    });
});
