import { describe, it, expect } from 'vitest';
import { lexica } from '#lexica/lexica.js';
import { Light, Thermostat, withHome } from './support/home.mjs';
import { errorThrownBy } from './support/errors.mjs';
import { derivedUpdates } from './support/updates.mjs';

const { createFunctionDeclaration, createValueParameterDeclaration, createFunctionParameterDeclaration, createExpressionParameterDeclaration } = lexica.declarations;

/** A value parameter that accepts null, so a call given null is invoked with it. */
const accepting = (name, type) => createValueParameterDeclaration(name, type, { nulls: 'accept' });

/**
 * A kit of generic members on the home: a list's projections by a function and by an expression, each binding its result's `U` from what its callback gives; and module members binding their own `T` from their value
 * arguments, a value as it is, one that may be null, two of one type, a list's items, and a value an option chooses after a test written before it.
 */
const createKit = () => lexica.createModule('kit', withHome({
    types: [{
        name: 'ListExtensions<T>',
        kind: 'extension',
        target: 'List<T>',
        members: [
            createFunctionDeclaration('map<U>', 'List<U>', { updates: derivedUpdates, parameters: [createFunctionParameterDeclaration('f', 'U', ['T'])], impl: ({ receiver, args }) => receiver.map(item => args.f(item)) }),
            createFunctionDeclaration('mapBy<U>', 'List<U>', { updates: derivedUpdates, parameters: [createExpressionParameterDeclaration('U')], impl: ({ receiver, args }) => receiver.map(item => args.expression(item)) }),
        ],
    }],
    members: [
        createFunctionDeclaration('identity<T>', 'T', { updates: derivedUpdates, parameters: [accepting('value', 'T')], impl: ({ args }) => args.value }),
        createFunctionDeclaration('maybe<T>', 'T?', { updates: derivedUpdates, parameters: [accepting('value', 'T?')], impl: ({ args }) => args.value }),
        createFunctionDeclaration('pair<T>', 'List<T>', { updates: derivedUpdates, parameters: [accepting('first', 'T'), accepting('second', 'T')], impl: ({ args }) => [args.first, args.second] }),
        createFunctionDeclaration('firstOf<T>', 'T?', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('list', 'List<T>')], impl: ({ args }) => args.list[0] ?? null }),
        createFunctionDeclaration('choose<T>', 'T?', {
            updates: derivedUpdates,
            arguments: 'options',
            parameters: [createFunctionParameterDeclaration('keep', 'Boolean', ['T']), createValueParameterDeclaration('from', 'T')],
            impl: ({ args }) => (args.keep(args.from) ? args.from : null),
        }),
        createFunctionDeclaration('double', 'Number', { updates: derivedUpdates, parameters: [createValueParameterDeclaration('value', 'Number')], impl: ({ args }) => args.value * 2 }),
    ],
}));

const lamp = new Light('lamp');
const heater = new Thermostat('heater');
const values = { lamp, heater, flag: true, numbers: [1, 2], words: ['oat', 'rye'], empty: [] };

/** The type the text resolves to against a registry of the kit, as a message writes it. */
const typeOf = text => lexica.createRegistry([createKit()]).resolve(text, values, { imports: ['kit'] }).type;

/** What the text evaluates to against a registry of the kit. */
const evaluate = text => {
    const registry = lexica.createRegistry([createKit()]);
    const bindings = registry.createBindings(values);

    return registry.resolve(text, bindings, { imports: ['kit'] }).createEvaluator(bindings).evaluate().value;
};

/** A number the text writes that may be null. */
const maybeOne = 'if flag then 1 else null end';

describe('type parameters', () => {
    describe('bound by value arguments', () => {
        it('take an argument\'s type exactly, a T given it as it is and a T? given it without null', () => {
            expect(typeOf('kit.identity(1)')).toBe('Number');
            expect(typeOf(`kit.identity(${maybeOne})`)).toBe('Number?');
            expect(typeOf(`kit.maybe(${maybeOne})`)).toBe('Number?');
            expect(typeOf('kit.firstOf(numbers)')).toBe('Number?');
            expect(evaluate('kit.identity(lamp) == lamp')).toBe(true);
        });

        it('combine candidates of one type that differ in nullability alone into the nullable type', () => {
            expect(typeOf(`kit.pair(1, ${maybeOne})`)).toBe('List<Number?>');
            expect(typeOf(`kit.pair(${maybeOne}, 1)`)).toBe('List<Number?>');
        });

        it('refuse candidates of different types, whichever comes first, inferring no base type they share', () => {
            for (const text of ['kit.pair(lamp, heater)', 'kit.pair(heater, lamp)', 'kit.pair(1, "a")']) {
                expect(errorThrownBy(() => typeOf(text)), text).toMatchObject({ code: 'NEXO3064', kind: 'validation', message: expect.stringContaining("for its type parameter T, which binds one type") });
            }
        });

        it('read a null as evidence its occurrence accepts null, and a never as evidence of no type', () => {
            expect(typeOf('kit.identity(null)')).toBe('null');
            expect(typeOf('kit.pair(null, 1)')).toBe('List<Number?>');
            expect(typeOf('kit.maybe(null)')).toBe('null');
            expect(typeOf('kit.firstOf(empty)')).toBe('null');
            expect(evaluate('kit.identity(null)')).toBeNull();
        });

        it('are collected before any callback is resolved, whatever the order the arguments are written in', () => {
            expect(typeOf('kit.choose({ keep = it.count > 1, from = numbers })')).toBe('List<Number>?');
            expect(evaluate('kit.choose({ keep = it.count > 1, from = numbers })')).toEqual([1, 2]);
        });
    });

    describe('bound by a callback\'s result', () => {
        it('take the type each form of the callback gives: an arrow function, an implicit body, a module\'s function by reference and an expression', () => {
            expect(typeOf('numbers.map(n => n > 1)')).toBe('List<Boolean>');
            expect(typeOf('numbers.map(it + 1)')).toBe('List<Number>');
            expect(typeOf('numbers.map(kit.double)')).toBe('List<Number>');
            expect(typeOf('words.mapBy(it == "oat")')).toBe('List<Boolean>');
            expect(evaluate('{ arrow = numbers.map(n => n > 1), reference = numbers.map(kit.double), expression = words.mapBy(it == "oat") }')).toEqual({ arrow: [false, true], reference: [2, 4], expression: [true, false] });
        });

        it('bind the result its inputs never take, since a receiver binds the callback\'s inputs first', () => {
            expect(typeOf('kit.pair(lamp, lamp).map(l => l == lamp)')).toBe('List<Boolean>');
        });
    });
});
