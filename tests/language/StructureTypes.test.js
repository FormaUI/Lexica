import { describe, it, expect } from 'vitest';
import { StructureTypes } from '#nexo/language/StructureTypes.mjs';
import { Type } from '#nexo/language/Type.mjs';

describe('StructureTypes', () => {
    const registry = {};
    const point = Type.createNamedType('Point', false, 'Shapes');

    it('answers the type a structured value was recorded as, against the registry that recorded it alone', () => {
        const value = { x: 1 };

        StructureTypes.recordType(value, registry, point);

        expect(StructureTypes.getType(value, registry)).toBe(point);
        expect(StructureTypes.getType(value, {})).toBeUndefined();
        expect(StructureTypes.getType({ x: 1 }, registry)).toBeUndefined();
    });

    it('replaces a value\'s type where it is recorded again', () => {
        const value = { x: 1 };
        const vector = Type.createNamedType('Vector', false, 'Shapes');

        StructureTypes.recordType(value, registry, point);
        StructureTypes.recordType(value, registry, vector);

        expect(StructureTypes.getType(value, registry)).toBe(vector);
    });
});
