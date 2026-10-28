import { describe, it, expect } from 'vitest';
import { TypeNameScope } from '#lexica/language/vocabulary/TypeNameScope.mjs';

/** The parts of a scope, its declaring module, its imports, whether it reaches every module and whether it names modules by their own names. */
const partsOf = scope => ({ declaringModule: scope.declaringModule, imports: scope.imports, reachesEveryModule: scope.reachesEveryModule, namesModulesByOwnName: scope.namesModulesByOwnName });

describe('TypeNameScope', () => {
    it('represents a declaration\'s scope by its module and the modules its type imports, each an import of the module, naming modules by their own names', () => {
        const scope = TypeNameScope.createDeclarationScope('charts', ['axes', 'scales']);

        expect(partsOf(scope)).toEqual({ declaringModule: 'charts', imports: [{ module: 'axes' }, { module: 'scales' }], reachesEveryModule: false, namesModulesByOwnName: true });
        expect(Object.isFrozen(scope.imports) && scope.imports.every(Object.isFrozen)).toBe(true);
    });

    it('represents a declared binding\'s scope as one reaching every module, the same scope each time', () => {
        expect(partsOf(TypeNameScope.bindingScope)).toEqual({ declaringModule: null, imports: [], reachesEveryModule: true, namesModulesByOwnName: true });
        expect(TypeNameScope.bindingScope).toBe(TypeNameScope.bindingScope);
    });

    it('represents a script\'s scope by its imports alone, whose local names qualify, naming no module by its own name', () => {
        const imports = [{ module: 'Home', alias: 'House' }, { module: 'Energy', type: 'Devices' }];
        const scope = TypeNameScope.createScriptScope(imports);

        expect(partsOf(scope)).toEqual({ declaringModule: null, imports, reachesEveryModule: false, namesModulesByOwnName: false });
        expect(Object.isFrozen(scope.imports)).toBe(true);
    });
});
