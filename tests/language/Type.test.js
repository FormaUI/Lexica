import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';

describe('Type', () => {
    describe('parse', () => {
        it.each([
            ['Number', 'named', 'Number', false],
            ['Element?', 'named', 'Element', true],
            ['Rectangle', 'named', 'Rectangle', false],
            ['T', 'typeParameter', 'T', false],
            ['T?', 'typeParameter', 'T', true],
            ['@selected', 'typeParameter', '@selected', false],
            ['null', 'null', null, true],
            ['Never', 'never', null, false],
        ])('reads %s', (text, kind, name, isNullable) => {
            const type = Type.parse(text);

            expect(type).toMatchObject({ kind, name, isNullable });
        });

        it('reads lists by their item types, the type a selector selects among them', () => {
            expect(Type.parse('List<Number>').itemType.name).toBe('Number');
            expect(Type.parse('List<T>?')).toMatchObject({ kind: 'list', isNullable: true });
            expect(Type.parse('List<@selected>').itemType.kind).toBe('typeParameter');
            expect(Type.parse('List<List<Element?>>').itemType.itemType.isNullable).toBe(true);
        });

        it.each(['', 'List', 'List<>', 'List<Number', 'Number<Number>', 'Event<Number>', '1number', 'a-b', 'List<Number>>', 'Number?!', null, 5])('refuses %s', text => {
            expect(Type.parse(text)).toBeNull();
        });

        it('answers one type for one notation', () => {
            expect(Type.parse('List<Number>')).toBe(Type.parse('List<Number>'));
        });
    });

    describe('create', () => {
        it('makes each kind of type, nullable where asked', () => {
            expect(Type.createNamedType('Number').equals(Type.parse('Number'))).toBe(true);
            expect(Type.createListType(Type.parse('Element'), true).equals(Type.parse('List<Element>?'))).toBe(true);
            expect(Type.createTypeParameter('T', true).equals(Type.parse('T?'))).toBe(true);
            expect(Type.createObjectType(new Map([['width', Type.parse('Number')]]), true).toString()).toBe('{ width: Number }?');
        });
    });

    describe('toString', () => {
        it.each(['Number', 'Element?', 'List<T>', 'List<Element>?', '@selected', 'List<@selected>', 'null', 'Never', 'List<Never>', 'List<null>'])('writes %s back as it was read', text => {
            expect(Type.parse(text).toString()).toBe(text);
        });

        it('writes an object type by its field types', () => {
            expect(Type.createObjectType(new Map([['width', Type.createNamedType('Number')]])).toString()).toBe('{ width: Number }');
        });
    });

    describe('tryMatchType', () => {
        it('records the argument a type parameter matches', () => {
            const typeArguments = new Map();

            expect(Type.tryMatchType(Type.parse('List<T>'), Type.parse('List<Element>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T').toString()).toBe('Element');
        });

        it('keeps an item type\'s nullability in the argument it records', () => {
            const typeArguments = new Map();

            Type.tryMatchType(Type.parse('List<T>'), Type.parse('List<Number?>'), typeArguments);

            expect(typeArguments.get('T').toString()).toBe('Number?');
        });

        it('matches concrete types, recording nothing', () => {
            const typeArguments = new Map();

            expect(Type.tryMatchType(Type.parse('List<Element>'), Type.parse('List<Element>'), typeArguments)).toBe(true);
            expect(typeArguments.size).toBe(0);
        });

        it.each([
            ['List<T>', 'Number'],
            ['Element', 'Window'],
            ['rectangle', 'size'],
        ])('refuses %s against %s', (declaredType, actualType) => {
            expect(Type.tryMatchType(Type.parse(declaredType), Type.parse(actualType), new Map())).toBe(false);
        });

        it('matches never, which no value is, against whatever is declared, recording it for a type parameter', () => {
            const typeArguments = new Map();

            expect(Type.tryMatchType(Type.parse('List<T>'), Type.parse('List<Never>'), typeArguments)).toBe(true);
            expect(typeArguments.get('T')).toBe(Type.never);
            expect(Type.tryMatchType(Type.parse('List<Number>'), Type.parse('List<Never>'), new Map())).toBe(true);
            expect(Type.tryMatchType(Type.parse('Element'), Type.never, new Map())).toBe(true);
        });

        it('requires a type parameter met twice to match one type', () => {
            const typeArguments = new Map([['T', Type.parse('Number')]]);

            expect(Type.tryMatchType(Type.parse('T'), Type.parse('Number?'), typeArguments)).toBe(true);
            expect(Type.tryMatchType(Type.parse('T'), Type.parse('String'), typeArguments)).toBe(false);
        });
    });

    describe('resolveTypeParameters', () => {
        it('replaces a type parameter by its argument, keeping the nullability the parameter wrote', () => {
            const typeArguments = new Map([['T', Type.parse('Element')]]);

            expect(Type.parse('T?').resolveTypeParameters(typeArguments).toString()).toBe('Element?');
            expect(Type.parse('List<T>').resolveTypeParameters(typeArguments).toString()).toBe('List<Element>');
        });

        it('leaves a concrete type, and a type parameter with no argument, as they are', () => {
            const concrete = Type.parse('Number');

            expect(concrete.resolveTypeParameters(new Map([['T', Type.parse('Element')]]))).toBe(concrete);
            expect(Type.parse('U').resolveTypeParameters(new Map()).toString()).toBe('U');
        });
    });

    describe('merge', () => {
        const merge = (firstType, secondType) => Type.merge(Type.parse(firstType), Type.parse(secondType))?.toString() ?? null;

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

        it('merges object types field by field, whatever their order', () => {
            const firstType = Type.createObjectType(new Map([['a', Type.parse('Number')], ['b', Type.parse('String')]]));
            const secondType = Type.createObjectType(new Map([['b', Type.parse('String?')], ['a', Type.parse('Number')]]));

            expect(Type.merge(firstType, secondType).toString()).toBe('{ a: Number, b: String? }');
        });

        it('answers a node for two different kinds of node, nullable where either is', () => {
            expect(merge('Element', 'Document')).toBe('Node');
            expect(merge('ShadowRoot?', 'Node')).toBe('Node?');
            expect(merge('DocumentFragment', 'DocumentFragment')).toBe('DocumentFragment');
            expect(merge('Element', 'Window')).toBeNull();
        });

        it('answers null for types of different structures', () => {
            expect(merge('Number', 'String')).toBeNull();
            expect(merge('List<Number>', 'List<String>')).toBeNull();
            expect(Type.merge(Type.createObjectType(new Map([['a', Type.parse('Number')]])), Type.createObjectType(new Map([['b', Type.parse('Number')]])))).toBeNull();
        });
    });

    describe('isAssignableTo', () => {
        it.each([
            ['Number', 'Number', true],
            ['Number', 'Number?', true],
            ['Number?', 'Number', false],
            ['Number?', 'Number?', true],
            ['null', 'Number?', true],
            ['null', 'Number', false],
            ['Number', 'String', false],
            ['List<Number>', 'List<Number>', true],
            ['List<Number>', 'List<Number?>', true],
            ['List<Number?>', 'List<Number>', false],
            ['List<Number>', 'List<String>', false],
            ['Number', 'List<Number>', false],
            ['Element', 'Window', false],
            ['Never', 'Number', true],
            ['Never', 'Element?', true],
            ['List<Never>', 'List<String>', true],
            ['List<null>', 'List<Number?>', true],
            ['List<null>', 'List<Number>', false],
            ['Element', 'Node', true],
            ['ShadowRoot?', 'Node?', true],
            ['List<Document>', 'List<Node>', true],
            ['Node', 'Element', false],
            ['Document', 'Element', false],
            ['Window', 'Node', false],
        ])('answers %s to %s as %s', (actualType, otherType, answer) => {
            expect(Type.parse(actualType).isAssignableTo(Type.parse(otherType))).toBe(answer);
        });
    });

    it('converts between nullable and non-nullable', () => {
        expect(Type.parse('Number').toNullable().toString()).toBe('Number?');
        expect(Type.parse('Number?').toNonNullable().toString()).toBe('Number');
        expect(Type.null.toNonNullable()).toBe(Type.null);
        expect(Type.never.toNullable()).toBe(Type.null);
    });
});
