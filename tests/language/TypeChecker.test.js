import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { TypeChecker } from '#lexica/language/TypeChecker.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
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
            const invariant = new TypeChecker({ getTypeDeclaration: () => ({ kind: 'generic', variances: ['invariant'] }), getSupertype: () => null, isReferenceType: () => false });

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

    describe('inferTypeArguments and matchesType', () => {
        it('infers the argument a type parameter matches, and matches by the same relation', () => {
            const typeArguments = checker.inferTypeArguments(typeOf('List<T>'), typeOf('List<home.Light>'));

            expect(typeArguments.get('T').toString()).toBe('Light');
            expect(checker.matchesType(typeOf('List<T>'), typeOf('List<home.Light>'))).toBe(true);
        });

        it('keeps an item type\'s nullability in the argument it infers', () => {
            expect(checker.inferTypeArguments(typeOf('List<T>'), typeOf('List<Number?>')).get('T').toString()).toBe('Number?');
        });

        it('answers an empty map for concrete types that match, apart from no match at all', () => {
            expect(checker.inferTypeArguments(typeOf('List<home.Light>'), typeOf('List<home.Light>')).size).toBe(0);
            expect(checker.inferTypeArguments(typeOf('List<home.Light>'), typeOf('List<home.Room>'))).toBeNull();
        });

        it.each([
            ['List<T>', 'Number'],
            ['home.Light', 'home.Room'],
            ['rectangle', 'size'],
        ])('refuses %s against %s, inferring nothing', (declaredType, actualType) => {
            expect(checker.matchesType(typeOf(declaredType), typeOf(actualType))).toBe(false);
            expect(checker.inferTypeArguments(typeOf(declaredType), typeOf(actualType))).toBeNull();
        });

        it('matches never, which no value is, against whatever is declared, inferring it for a type parameter', () => {
            expect(checker.inferTypeArguments(typeOf('List<T>'), typeOf('List<Never>')).get('T')).toBe(Type.never);
            expect(checker.matchesType(typeOf('List<Number>'), typeOf('List<Never>'))).toBe(true);
            expect(checker.matchesType(typeOf('home.Light'), Type.never)).toBe(true);
        });

        it('requires a type parameter bound already to match the type it binds to, and leaves the bindings it is given unchanged', () => {
            const bound = new Map([['T', typeOf('Number')]]);

            expect(checker.inferTypeArguments(typeOf('T'), typeOf('Number?'), bound)).not.toBeNull();
            expect(checker.inferTypeArguments(typeOf('T'), typeOf('String'), bound)).toBeNull();
            expect([...bound.keys()]).toEqual(['T']);
            expect(bound.get('T').toString()).toBe('Number');
        });
    });

    describe('resolveApplyingReceiverType, matchesReceiver and inferReceiverTypeArguments', () => {
        it('resolves the first receiver type the receiver applies to a member by, in the order it declares them, any receiver and a type parameter alone among them, which a never takes neither of', () => {
            const property = (name, target) => Declarations.property(name, target, 'String', { updates: { changes: 'constant', reads: 'fresh' }, impl: ({ receiver }) => receiver });
            const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', { members: [property('fade', ['any', 'String']), property('dim', ['T', 'String']), property('glow', ['String', 'any'])] })]);
            const [[anyFirst], [parameterFirst], [stringFirst]] = ['fade', 'dim', 'glow'].map(name => registry.getReceiverMembers(name));
            const { typeChecker } = registry;

            expect(typeChecker.resolveApplyingReceiverType(anyFirst, typeOf('String?'))).toBe('any');
            expect(typeChecker.inferReceiverTypeArguments(anyFirst, typeOf('String'))).toEqual(new Map());
            expect(String(typeChecker.resolveApplyingReceiverType(parameterFirst, typeOf('String')))).toBe('T');
            expect(typeChecker.inferReceiverTypeArguments(parameterFirst, typeOf('String')).get('T').toString()).toBe('String');
            expect(String(typeChecker.resolveApplyingReceiverType(stringFirst, typeOf('String')))).toBe('String');
            expect(typeChecker.resolveApplyingReceiverType(stringFirst, typeOf('Number'))).toBe('any');
            expect(String(typeChecker.resolveApplyingReceiverType(anyFirst, Type.never))).toBe('String');
            expect(typeChecker.resolveApplyingReceiverType(anyFirst, Type.null)).toBeUndefined();
            expect(typeChecker.inferReceiverTypeArguments(anyFirst, Type.null)).toBeNull();
        });

        it('applies a member to a receiver its receiver types match, inferring the type arguments it binds, and a receiver of any type to any value', () => {
            const registry = new LexicaRegistry([Vocabulary.module, new LexicaModule('charts', {})]);
            const [count] = registry.getReceiverMembers('count');
            const [is] = registry.getReceiverMembers('is');

            expect(registry.typeChecker.inferReceiverTypeArguments(count, typeOf('List<Number>?')).get('T').toString()).toBe('Number');
            expect(registry.typeChecker.matchesReceiver(count, typeOf('List<Number>?'))).toBe(true);
            expect(registry.typeChecker.matchesReceiver(count, typeOf('Number'))).toBe(false);
            expect(registry.typeChecker.inferReceiverTypeArguments(count, typeOf('Number'))).toBeNull();
            expect(registry.typeChecker.matchesReceiver(is, typeOf('Number'))).toBe(true);
            expect(registry.typeChecker.inferReceiverTypeArguments(is, typeOf('Number')).get('T').toString()).toBe('Number');
            expect(registry.typeChecker.matchesReceiver(is, Type.never)).toBe(false);
        });
    });
});
