import { describe, it, expect } from 'vitest';
import { Type } from '#lexica/language/Type.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';

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

        it('reads a name qualified by its module\'s name, a list\'s item among them', () => {
            expect(Type.parse('home.Sensor?')).toMatchObject({ kind: 'named', name: 'Sensor', moduleName: 'home', isNullable: true, identity: 'home.Sensor' });
            expect(Type.parse('List<garden.Sensor>').itemType.identity).toBe('garden.Sensor');
            expect(Type.parse('T.Sensor')).toMatchObject({ kind: 'named', moduleName: 'T' });
        });

        it.each(['home.', 'home.Sensor.Light', '@selected.Sensor', 'home.@selected', '.Sensor'])('refuses the qualified name %s', text => {
            expect(Type.parse(text)).toBeNull();
        });

        it('reads lists by their item types, the type a selector selects among them', () => {
            expect(Type.parse('List<Number>').itemType.name).toBe('Number');
            expect(Type.parse('List<T>?')).toMatchObject({ kind: 'named', name: 'List', isNullable: true, isList: true });
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

    describe('identity', () => {
        it('tells two types of one local name apart by their modules, Lexica\'s own unqualified', () => {
            expect(Type.parse('home.Sensor').equals(Type.parse('garden.Sensor'))).toBe(false);
            expect(Type.parse('home.Sensor').equals(Type.createNamedType('Sensor', false, 'home'))).toBe(true);
            expect(Type.parse('Number').identity).toBe('Number');
            expect(Type.parse('List<Number>').identity).toBe('List');
        });

        it('writes two types by their local names, and both qualified where those read alike', () => {
            expect(String(Type.parse('home.Sensor'))).toBe('Sensor');
            expect(Type.namesOf(Type.parse('home.Sensor?'), Type.parse('garden.Sensor?'))).toEqual(['home.Sensor?', 'garden.Sensor?']);
            expect(Type.namesOf(Type.parse('List<home.Sensor>'), Type.parse('List<garden.Sensor>'))).toEqual(['List<home.Sensor>', 'List<garden.Sensor>']);
            expect(Type.namesOf(Type.parse('home.Sensor'), Type.parse('Number'))).toEqual(['Sensor', 'Number']);
            expect(Type.namesOf(Type.parse('home.Sensor'), Type.parse('home.Sensor?'))).toEqual(['Sensor', 'Sensor?']);
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

    it('converts between nullable and non-nullable', () => {
        expect(Type.parse('Number').toNullable().toString()).toBe('Number?');
        expect(Type.parse('Number?').toNonNullable().toString()).toBe('Number');
        expect(Type.null.toNonNullable()).toBe(Type.null);
        expect(Type.never.toNullable()).toBe(Type.null);
        expect(Type.any.toNullable().toString()).toBe('Any?');
        expect(Type.any.toNullable().toNonNullable().equals(Type.any)).toBe(true);
    });

    it('reads Any in the notation, nullable and within a list', () => {
        expect(Type.parse('Any')).toBe(Type.any);
        expect(Type.parse('Any?').equals(Type.any.toNullable())).toBe(true);
        expect(Type.parse('List<Any?>').toString()).toBe('List<Any?>');
    });

    it("gives the type an expression of each item reads: a list's item, a dictionary's value, and none for any other type", () => {
        expect(String(Type.parse('List<Number?>').itemContextType)).toBe('Number?');
        expect(String(Type.parse('Dictionary<String, Number>').itemContextType)).toBe('Number');
        expect([Type.parse('Pair<String, Number>').itemContextType, Type.parse('Number').itemContextType]).toEqual([null, null]);
    });

    it('holds a list as Lexica\'s generic List, its item type its one type argument', () => {
        const list = Type.createListType(Type.parse('Number'));

        expect(list).toMatchObject({ kind: 'named', name: 'List', moduleName: null, isList: true });
        expect(list.typeArguments.map(String)).toEqual(['Number']);
        expect(list.itemType.toString()).toBe('Number');
        expect(Type.parse('Number').itemType).toBeNull();
        expect(list.equals(Type.parse('List<Number>'))).toBe(true);
        expect(list.equals(Type.parse('List<Number?>'))).toBe(false);
    });

    describe('createPrimitiveType', () => {
        it('types a string, a number and a Boolean as the scalar types Lexica\'s own module names, each by its JavaScript type', () => {
            expect(['oat', 1, true].map(value => String(Type.createPrimitiveType(value)))).toEqual(['String', 'Number', 'Boolean']);
            expect(['oat', 1, true].map(value => String(Type.createPrimitiveType(value))).sort()).toEqual([...LexicaModule.scalarTypeNames].sort());
        });
    });

    describe('getObjectFieldType', () => {
        it('answers the type of an object type\'s object field, the type null among them, and null for a field it holds none of and for a type of another kind, the object root among them', () => {
            const fieldTypes = new Map([['a', Type.parse('Number')], ['b', Type.null]]);

            expect(String(Type.createObjectType(fieldTypes).getObjectFieldType('a'))).toBe('Number');
            expect(Type.createObjectType(fieldTypes).getObjectFieldType('b')).toBe(Type.null);
            expect(Type.createObjectType(fieldTypes).getObjectFieldType('c')).toBeNull();
            expect(Type.createObjectRootType({}, fieldTypes).getObjectFieldType('a')).toBeNull();
            expect(Type.parse('Cup').getObjectFieldType('size')).toBeNull();
        });
    });
});
