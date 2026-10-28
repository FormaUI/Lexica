import { describe, it, expect } from 'vitest';
import { ImportedVocabulary } from '#lexica/language/ImportedVocabulary.mjs';
import { Type } from '#lexica/language/Type.mjs';
import { Declarations } from '#lexica/language/vocabulary/Declarations.mjs';
import { LexicaModule } from '#lexica/language/vocabulary/LexicaModule.mjs';
import { LexicaRegistry } from '#lexica/language/vocabulary/LexicaRegistry.mjs';
import { Vocabulary } from '#lexica/language/vocabulary/Vocabulary.mjs';
import { withHome } from '../support/home.mjs';
import { constantUpdates } from '../support/updates.mjs';
import { extensionDeclaration } from '../support/declarations.mjs';

const { createPropertyDeclaration, createFunctionDeclaration } = Declarations;

const property = name => createPropertyDeclaration(name, 'String', { updates: constantUpdates, impl: () => name });

/** A registry of the home, whose devices and lights hold members of their own, and energy, which extends the home's devices and has a module member. */
const registry = new LexicaRegistry([
    Vocabulary.module,
    new LexicaModule('Home', withHome({}, { Device: [property('name')], Light: [property('glow')], Room: [property('label')] })),
    new LexicaModule('Energy', { types: [extensionDeclaration('Devices', 'Home.Device', [property('usage')])], members: [createFunctionDeclaration('total', 'Number', { updates: constantUpdates, impl: () => 1 })] }),
]);

/** The declaration of the name the registry indexes for receivers, the first of its name. */
const member = name => registry.getReceiverMembers(name)[0];

describe('ImportedVocabulary', () => {
    it('names the module each module import\'s local name begins the namespace of, and none for a type import\'s', () => {
        const imported = new ImportedVocabulary(registry, [{ module: 'Energy', alias: 'Power' }, { module: 'Home', type: 'Light' }]);

        expect(imported.namespaceNames).toEqual(new Set(['Power']));
        expect([imported.getNamespaceModule('Power'), imported.getNamespaceModule('Energy'), imported.getNamespaceModule('Light')]).toEqual(['Energy', undefined, undefined]);
        expect([imported.importsModule('Energy'), imported.importsModule('Home')]).toEqual([true, false]);
    });

    it('answers what an extension access names: an extension a type import gives, the modules imported whole, each module\'s first local name, and the local name a type import gives a declaration', () => {
        const imported = new ImportedVocabulary(registry, [{ module: 'Energy', type: 'Devices', alias: 'Power' }, { module: 'Home', alias: 'House' }, { module: 'Home', alias: 'Place' }]);
        const devices = registry.getModuleType('Energy', 'Devices');

        expect([imported.getImportedExtension('Power'), imported.getImportedExtension('Devices')]).toEqual([devices, undefined]);
        expect(imported.importedModuleNames).toEqual(['Home']);
        expect([imported.getNamespaceName('Home'), imported.getNamespaceName('Energy')]).toEqual(['House', undefined]);
        expect([imported.getLocalNameOf(devices), imported.getLocalNameOf(registry.getModuleType('Home', 'Light'))]).toEqual(['Power', undefined]);
    });

    it('reads the script\'s type names in the scope its imports give, through which an ordinary type import names its type, and an extension\'s none', () => {
        const imports = [{ module: 'Energy', type: 'Devices' }, { module: 'Home', type: 'Light', alias: 'Lamp' }];
        const imported = new ImportedVocabulary(registry, imports);
        const scope = imported.typeNameScope;

        expect({ declaringModule: scope.declaringModule, imports: scope.imports, reachesEveryModule: scope.reachesEveryModule }).toEqual({ declaringModule: null, imports, reachesEveryModule: false });
        expect(registry.resolveTypeName('Lamp', scope)).toEqual({ types: [Type.createNamedType('Light', false, 'Home')] });
        expect([registry.resolveTypeName('Light', scope), registry.resolveTypeName('Devices', scope)]).toEqual([{ types: [] }, { types: [] }]);
    });

    it('makes available Lexica\'s own declarations always, a module\'s through its import, a type\'s own and inherited members through its type\'s, and an extension\'s through its own', () => {
        const count = registry.getReceiverMembers('count')[0];

        expect(new ImportedVocabulary(registry, []).getAvailable([count, member('name'), member('usage')])).toEqual([count]);
        expect(new ImportedVocabulary(registry, [{ module: 'Home' }]).getAvailable([member('name'), member('glow'), member('label'), member('usage')])).toEqual([member('name'), member('glow'), member('label')]);
        expect(new ImportedVocabulary(registry, [{ module: 'Home', type: 'Light' }]).getAvailable([member('name'), member('glow'), member('label'), member('usage')])).toEqual([member('name'), member('glow')]);
        expect(new ImportedVocabulary(registry, [{ module: 'Energy', type: 'Devices' }]).getAvailable([member('name'), member('usage')])).toEqual([member('usage')]);
        expect(new ImportedVocabulary(registry, [{ module: 'Energy', type: 'Devices' }]).makesAvailable(registry.getMembersDeclaredBy('Energy', 'total')[0])).toBe(false);
        expect(new ImportedVocabulary(registry, [{ module: 'Energy' }]).makesAvailable(registry.getMembersDeclaredBy('Energy', 'total')[0])).toBe(true);
    });
});
