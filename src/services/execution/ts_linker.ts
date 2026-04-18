import type { ProgramExecutionRequest } from './ts_assembler';

export interface ModuleLinking {
    importCache: Record<string, object[]>;
    require: (moduleName: string) => object[];
    $importModule: (moduleName: string) => object[];
}

export function linkObjects(result: ProgramExecutionRequest): ModuleLinking {
    const importCache: Record<string, object[]> = {};

    function $importModule(moduleName: string): object[] {
        if (moduleName in importCache) {
            return importCache[moduleName];
        }
        const exports: object[] = [];
        importCache[moduleName] = exports;

        if (!(moduleName in result.imports)) {
            throw new Error(
                `Module ${moduleName} not found, could not $importModule it.`,
            );
        }

        const module = { id: moduleName, exports };
        const importedCode = result.imports[moduleName];
        // Dynamic code execution is required to run compiled module code
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const importAsFunction = new Function(
            'require',
            'exports',
            'module',
            importedCode,
        ) as (req: (m: string) => object[], exp: object[], mod: object) => void;
        try {
            importAsFunction($importModule, exports, module);
        } catch (e) {
            console.error('Error loading module', moduleName, e);
            throw e;
        }
        return exports;
    }

    return { importCache, require: $importModule, $importModule };
}
