import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { TypeChecker } from '#lexica/language/TypeChecker.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { withHome } from '../support/home.mjs';

/** The checker of a registry of the home's types: a light and a thermostat beneath a device, and a room of a hierarchy of its own. */
const checker = new LexicaRegistry([Vocabulary.module, new LexicaModule('home', withHome())]).typeChecker;

/** The type the notation writes, `Any` and `Any?` among them, which no notation a module writes reads yet, and an object type of the fields given. */
const typeOf = text => {
    if (typeof text !== 'string') {
        return Type.createObjectType(new Map(Object.entries(text).map(([name, fieldText]) => [name, typeOf(fieldText)])));
    }

    const list = /^List<(.*)>(\?)?$/.exec(text);

    if (list !== null) {
        return Type.createListType(typeOf(list[1]), list[2] === '?');
    }

    return text === 'Any' ? Type.any : text === 'Any?' ? Type.any.toNullable() : Type.parse(text);
};

describe('TypeChecker', () => {
    describe('assignabilityOf', () => {
        it.each([
            ['Number', 'Number', 'assignable'],
            ['Number', 'Number?', 'assignable'],
            ['Number?', 'Number', 'refused'],
            ['Number?', 'Number?', 'assignable'],
            ['null', 'Number?', 'assignable'],
            ['null', 'Number', 'refused'],
            ['Number', 'String', 'refused'],
            ['List<Number>', 'List<Number>', 'assignable'],
            ['List<Number>', 'List<Number?>', 'assignable'],
            ['List<Number?>', 'List<Number>', 'refused'],
            ['List<Number>', 'List<String>', 'refused'],
            ['Number', 'List<Number>', 'refused'],
            ['home.Light', 'home.Room', 'refused'],
            ['Never', 'Number', 'assignable'],
            ['Never', 'home.Light?', 'assignable'],
            ['List<Never>', 'List<String>', 'assignable'],
            ['List<null>', 'List<Number?>', 'assignable'],
            ['List<null>', 'List<Number>', 'refused'],
            ['home.Light', 'home.Device', 'assignable'],
            ['home.Light?', 'home.Device?', 'assignable'],
            ['List<home.Thermostat>', 'List<home.Device>', 'assignable'],
            ['home.Device', 'home.Light', 'refused'],
            ['home.Thermostat', 'home.Light', 'refused'],
            ['home.Room', 'home.Device', 'refused'],
            ['home.Sensor', 'garden.Sensor', 'refused'],
        ])('answers %s to %s as %s', (type, declaredType, answer) => {
            expect(checker.assignabilityOf(typeOf(type), typeOf(declaredType))).toBe(answer);
        });

        it.each([
            ['Number', 'Any', 'assignable'],
            ['List<Number?>', 'Any', 'assignable'],
            ['Number?', 'Any', 'refused'],
            ['null', 'Any', 'refused'],
            ['Number?', 'Any?', 'assignable'],
            ['null', 'Any?', 'assignable'],
            ['Never', 'Any', 'assignable'],
            ['Any', 'Any', 'assignable'],
            ['Any', 'Any?', 'assignable'],
            ['Any?', 'Any', 'checked'],
            ['Any', 'Number', 'checked'],
            ['Any?', 'Number', 'checked'],
            ['Any?', 'Number?', 'checked'],
            ['List<Any>', 'List<Number>', 'checked'],
            ['List<Any>', 'Number', 'refused'],
            ['Any', 'Never', 'refused'],
            ['Any', 'null', 'refused'],
            ['Any?', 'null', 'checked'],
        ])('answers %s to %s as %s, a value of Any waiting for its check', (type, declaredType, answer) => {
            expect(checker.assignabilityOf(typeOf(type), typeOf(declaredType))).toBe(answer);
        });

        it.each([
            [{ name: 'String' }, { name: 'String?' }, 'assignable'],
            [{ name: 'String?' }, { name: 'String' }, 'refused'],
            [{ name: 'String', age: 'Number' }, { name: 'String' }, 'refused'],
            [{ name: 'String' }, { name: 'String', age: 'Number' }, 'refused'],
            [{ name: 'String' }, { title: 'String' }, 'refused'],
            [{ name: 'Any' }, { name: 'String' }, 'checked'],
        ])('relates object types field by field, by the same field names alone', (type, declaredType, answer) => {
            expect(checker.assignabilityOf(typeOf(type), typeOf(declaredType))).toBe(answer);
        });

        it('proves alone what isAssignable answers, so a value that waits for its check is not', () => {
            expect(checker.isAssignable(typeOf('Number'), typeOf('Any'))).toBe(true);
            expect(checker.isAssignable(typeOf('Any'), typeOf('Number'))).toBe(false);
        });

        it('relates a generic type\'s type arguments by the variance its declaration gives each', () => {
            const invariant = new TypeChecker({ getGenericType: () => ({ parameters: [{ variance: 'invariant' }] }), getSupertype: () => null, isReferenceType: () => false });

            expect(invariant.assignabilityOf(typeOf('List<Number>'), typeOf('List<Number?>'))).toBe('refused');
            expect(invariant.assignabilityOf(typeOf('List<Number>'), typeOf('List<Number>'))).toBe('assignable');
            expect(invariant.merge(typeOf('List<Number>'), typeOf('List<Number?>'))).toBeNull();
            expect(checker.assignabilityOf(typeOf('List<Number>'), typeOf('List<Number?>'))).toBe('assignable');
        });
    });

    describe('merge', () => {
        const merge = (firstType, secondType) => checker.merge(typeOf(firstType), typeOf(secondType))?.toString() ?? null;

        it('answers the one type of both, nullable where either is', () => {
            expect(merge('Number', 'Number')).toBe('Number');
            expect(merge('Number', 'Number?')).toBe('Number?');
            expect(merge('null', 'String')).toBe('String?');
            expect(merge('List<home.Light>', 'List<home.Light?>')).toBe('List<Light?>');
        });

        it('answers the other type for never, which adds no value', () => {
            expect(merge('Never', 'Number')).toBe('Number');
            expect(merge('home.Light?', 'Never')).toBe('Light?');
            expect(merge('Never', 'null')).toBe('null');
            expect(merge('List<Never>', 'List<Number>')).toBe('List<Number>');
        });

        it('answers Any for Any and any type, nullable where either can be null', () => {
            expect(merge('Any', 'Number')).toBe('Any');
            expect(merge('Any', 'Number?')).toBe('Any?');
            expect(merge('Any', 'null')).toBe('Any?');
            expect(merge('null', 'Any')).toBe('Any?');
            expect(merge('List<Number>', 'Any?')).toBe('Any?');
            expect(merge('Never', 'Any')).toBe('Any');
            expect(merge('List<Any>', 'List<Number>')).toBe('List<Any>');
        });

        it('merges object types of the same field names field by field, whatever their order', () => {
            expect(merge({ a: 'Number', b: 'String' }, { b: 'String?', a: 'Number' })).toBe('{ a: Number, b: String? }');
            expect(merge({ a: 'Number' }, { b: 'Number' })).toBeNull();
            expect(merge({ a: 'Number' }, { a: 'Number', b: 'Number' })).toBeNull();
            expect(merge({ a: 'Number' }, { a: 'String' })).toBeNull();
        });

        it('answers the nearest supertype two reference types of one hierarchy share, nullable where either is, and none for two hierarchies', () => {
            expect(merge('home.Light', 'home.Thermostat')).toBe('Device');
            expect(merge('home.Light?', 'home.Device')).toBe('Device?');
            expect(merge('home.Light', 'home.Light')).toBe('Light');
            expect(merge('List<home.Light>', 'List<home.Thermostat?>')).toBe('List<Device?>');
            expect(merge('home.Light', 'home.Room')).toBeNull();
        });

        it('answers null for types that don\'t merge', () => {
            expect(merge('Number', 'String')).toBeNull();
            expect(merge('List<Number>', 'List<String>')).toBeNull();
            expect(merge('home.Sensor', 'garden.Sensor')).toBeNull();
        });
    });

    describe('the types an equality compares', () => {
        it('fit where either is assignable to the other', () => {
            expect(checker.fitsEitherWay(typeOf('Number'), typeOf('Number?'))).toBe(true);
            expect(checker.fitsEitherWay(typeOf('home.Device'), typeOf('home.Light'))).toBe(true);
            expect(checker.fitsEitherWay(typeOf('home.Room'), typeOf('home.Light'))).toBe(false);
            expect(checker.fitsEitherWay(typeOf('String'), typeOf('Number'))).toBe(false);
        });

        it('compare strings, numbers, Booleans and references with each other, and any other type with null alone', () => {
            expect(['String', 'Number', 'Boolean', 'home.Light', 'home.Room'].map(text => checker.isComparable(typeOf(text)))).toEqual([true, true, true, true, true]);
            expect(['List<Number>', 'home.Sensor'].map(text => checker.isComparable(typeOf(text)))).toEqual([false, false]);
        });
    });

    describe('matchType', () => {
        it('records the argument a type parameter matches', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<T>'), typeOf('List<home.Light>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T').toString()).toBe('Light');
        });

        it('keeps an item type\'s nullability in the argument it records', () => {
            const typeArguments = new Map();

            checker.matchType(typeOf('List<T>'), typeOf('List<Number?>'), typeArguments);

            expect(typeArguments.get('T').toString()).toBe('Number?');
        });

        it('matches concrete types, recording nothing', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<home.Light>'), typeOf('List<home.Light>'), typeArguments)).toBe(true);
            expect(typeArguments.size).toBe(0);
        });

        it.each([
            ['List<T>', 'Number'],
            ['home.Light', 'home.Room'],
            ['rectangle', 'size'],
        ])('refuses %s against %s', (declaredType, actualType) => {
            expect(checker.matchType(typeOf(declaredType), typeOf(actualType), new Map())).toBe(false);
        });

        it('matches never, which no value is, against whatever is declared, recording it for a type parameter', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<T>'), typeOf('List<Never>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T')).toBe(Type.never);
            expect(checker.matchType(typeOf('List<Number>'), typeOf('List<Never>'), new Map())).toBe(true);
            expect(checker.matchType(typeOf('home.Light'), Type.never, new Map())).toBe(true);
        });

        it('requires a type parameter met twice to match one type', () => {
            const typeArguments = new Map([['T', typeOf('Number')]]);

            expect(checker.matchType(typeOf('T'), typeOf('Number?'), typeArguments)).toBe(true);
            expect(checker.matchType(typeOf('T'), typeOf('String'), typeArguments)).toBe(false);
        });
    });

    describe('matchesReceiver', () => {
        it('applies a member to a receiver its receiver types match, recording the type arguments it binds, and a receiver of any type to any value', () => {
            const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', {})]);
            const [count] = registry.getMembers('count');
            const [is] = registry.getMembers('is');
            const typeArguments = new Map();

            expect(registry.typeChecker.matchesReceiver(count, typeOf('List<Number>?'), typeArguments)).toBe(true);
            expect(typeArguments.get('T').toString()).toBe('Number');
            expect(registry.typeChecker.matchesReceiver(count, typeOf('Number'), new Map())).toBe(false);
            expect(registry.typeChecker.matchesReceiver(is, typeOf('Number'), new Map())).toBe(true);
            expect(registry.typeChecker.matchesReceiver(is, Type.never, new Map())).toBe(false);
        });
    });
});
