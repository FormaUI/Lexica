import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { TypeChecker } from '#lexica/language/TypeChecker.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';

/** The checker of Lexica's own types. */
const checker = new TypeChecker(Vocabulary);

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
            ['Element', 'Window', 'refused'],
            ['Never', 'Number', 'assignable'],
            ['Never', 'Element?', 'assignable'],
            ['List<Never>', 'List<String>', 'assignable'],
            ['List<null>', 'List<Number?>', 'assignable'],
            ['List<null>', 'List<Number>', 'refused'],
            ['Element', 'Node', 'assignable'],
            ['ShadowRoot?', 'Node?', 'assignable'],
            ['List<Document>', 'List<Node>', 'assignable'],
            ['Node', 'Element', 'refused'],
            ['Document', 'Element', 'refused'],
            ['Window', 'Node', 'refused'],
            ['home.Sensor', 'garden.Sensor', 'refused'],
            ['home.Element', 'Node', 'refused'],
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
            const invariant = new TypeChecker({ getGenericType: () => ({ parameters: [{ variance: 'invariant' }] }) });

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
            expect(merge('List<Element>', 'List<Element?>')).toBe('List<Element?>');
        });

        it('answers the other type for never, which adds no value', () => {
            expect(merge('Never', 'Number')).toBe('Number');
            expect(merge('Element?', 'Never')).toBe('Element?');
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

        it('answers a node for two different kinds of node, nullable where either is', () => {
            expect(merge('Element', 'Document')).toBe('Node');
            expect(merge('ShadowRoot?', 'Node')).toBe('Node?');
            expect(merge('DocumentFragment', 'DocumentFragment')).toBe('DocumentFragment');
            expect(merge('Element', 'Window')).toBeNull();
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
            expect(checker.fitsEitherWay(typeOf('Node'), typeOf('Element'))).toBe(true);
            expect(checker.fitsEitherWay(typeOf('String'), typeOf('Number'))).toBe(false);
        });

        it('compare strings, numbers, Booleans and nodes with each other, and any other type with null alone', () => {
            expect(['String', 'Number', 'Boolean', 'Element', 'Node'].map(text => checker.isComparable(typeOf(text)))).toEqual([true, true, true, true, true]);
            expect(['List<Number>', 'home.Sensor', 'home.Element'].map(text => checker.isComparable(typeOf(text)))).toEqual([false, false, false]);
        });

        it('tell a node of Lexica\'s from a type of a module\'s of one name', () => {
            expect(checker.isNode(typeOf('Element'))).toBe(true);
            expect(checker.isNode(typeOf('home.Element'))).toBe(false);
        });
    });

    describe('matchType', () => {
        it('records the argument a type parameter matches', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<T>'), typeOf('List<Element>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T').toString()).toBe('Element');
        });

        it('keeps an item type\'s nullability in the argument it records', () => {
            const typeArguments = new Map();

            checker.matchType(typeOf('List<T>'), typeOf('List<Number?>'), typeArguments);

            expect(typeArguments.get('T').toString()).toBe('Number?');
        });

        it('matches concrete types, recording nothing', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<Element>'), typeOf('List<Element>'), typeArguments)).toBe(true);
            expect(typeArguments.size).toBe(0);
        });

        it.each([
            ['List<T>', 'Number'],
            ['Element', 'Window'],
            ['rectangle', 'size'],
        ])('refuses %s against %s', (declaredType, actualType) => {
            expect(checker.matchType(typeOf(declaredType), typeOf(actualType), new Map())).toBe(false);
        });

        it('matches never, which no value is, against whatever is declared, recording it for a type parameter', () => {
            const typeArguments = new Map();

            expect(checker.matchType(typeOf('List<T>'), typeOf('List<Never>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T')).toBe(Type.never);
            expect(checker.matchType(typeOf('List<Number>'), typeOf('List<Never>'), new Map())).toBe(true);
            expect(checker.matchType(typeOf('Element'), Type.never, new Map())).toBe(true);
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
