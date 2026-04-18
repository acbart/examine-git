import * as ts from 'typescript';

export const STUDENT_MAIN = { TS: 'student_main.ts', JS: 'student_main.js' };

/** TypeScript type definitions for the pseudo-Jest library we support. */
const KETTLE_JEST_D_TS = `
    interface Assertion {
        toBe: (expected: any) => void;
        toEqual: (expected: any) => void;
        toContain: (expected: any) => void;
        toBeInstanceOf: (expected: any) => void;
        toThrowError: (expected: any) => void;
        not: Assertion;
    }
    declare function describe(name: string, tests: any): void;
    declare function test(name: string, assertions: any): void;
    declare function expect(actual: any): Assertion;
    declare function _setIframeVisible(visible: boolean): void;
    declare var student: Record<string, any>;
`;

export interface CompilationResult {
    code?: string;
    files: Record<string, string>;
    imports: Record<string, string>;
    diagnostics: ts.Diagnostic[];
    locals: Map<string, ts.Symbol>;
}

function makeDiagnostic(message: string): ts.Diagnostic {
    return {
        category: ts.DiagnosticCategory.Error,
        code: 0,
        file: undefined,
        start: 0,
        length: 0,
        messageText: message,
    };
}

export function removeEmptyExports(code: string): string {
    return code.replace(/export\s*\{\s*\}/g, '');
}

const EXTRA_TYPES = ['.txt', '.md', '.json', '.yaml', '.html', '.css'];

// TypeScript lib files loaded lazily from public/ts-lib-files.json
let libFiles: Record<string, string> | null = null;

async function getLibFiles(): Promise<Record<string, string>> {
    if (libFiles !== null) return libFiles;
    const resp = await fetch('/ts-lib-files.json');
    libFiles = (await resp.json()) as Record<string, string>;
    return libFiles;
}

const KETTLE_D_TS_FILENAME = 'kettle.d.ts';
const EXTRA_TS_FAKE_FILENAME = 'fake.ts';

interface MockIO {
    fileExists(fileName: string): boolean;
    readFile(fileName: string): string | undefined;
    writeFile(fileName: string, data: string): void;
    rememberImport(moduleName: string, fileName: string): void;
    error(message: string): void;
}

/**
 * AST transformer: removes export/async keywords and converts import declarations
 * to $importModule() calls so the code can run in a plain eval context.
 */
const removeExports = (
    importFile: (file: string) => void,
): ts.TransformerFactory<ts.SourceFile> =>
    ((context) => {
        return (sourceFile) => {
            const visitChildren = (child: ts.Node): ts.Node | undefined => {
                if (
                    child.kind === ts.SyntaxKind.ExportKeyword ||
                    child.kind === ts.SyntaxKind.AsyncKeyword ||
                    child.kind === ts.SyntaxKind.ExportDeclaration
                ) {
                    return undefined;
                }
                return ts.visitEachChild(child, visitChildren, context);
            };
            const convertNode = (node: ts.Node): ts.Node | undefined => {
                if (node.kind === ts.SyntaxKind.ImportDeclaration) {
                    const importChild = node as ts.ImportDeclaration;
                    let identifier: string | ts.BindingName;
                    let isDefault = false;
                    if (
                        importChild.importClause?.namedBindings?.kind ===
                        ts.SyntaxKind.NamedImports
                    ) {
                        const namedBindings =
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            importChild.importClause.namedBindings as ts.NamedImports;
                        identifier = ts.factory.createObjectBindingPattern(
                            namedBindings.elements.map((n) =>
                                ts.factory.createBindingElement(
                                    undefined,
                                    undefined,
                                    ts.factory.createIdentifier(n.getText()),
                                    undefined,
                                ),
                            ),
                        );
                    } else {
                        identifier = importChild.importClause?.getText() ?? '';
                        isDefault = true;
                    }
                    const moduleName = importChild.moduleSpecifier
                        .getText()
                        .replaceAll('"', '')
                        .replaceAll("'", '');
                    importFile(moduleName);
                    const importModuleCall = ts.factory.createCallExpression(
                        ts.factory.createIdentifier('$importModule'),
                        undefined,
                        [ts.factory.createStringLiteral(moduleName)],
                    );
                    return ts.factory.createVariableStatement(
                        undefined,
                        ts.factory.createVariableDeclarationList(
                            [
                                ts.factory.createVariableDeclaration(
                                    identifier,
                                    undefined,
                                    undefined,
                                    isDefault
                                        ? ts.factory.createPropertyAccessExpression(
                                              importModuleCall,
                                              ts.factory.createIdentifier('default'),
                                          )
                                        : importModuleCall,
                                ),
                            ],
                            ts.NodeFlags.Const,
                        ),
                    );
                }
                return ts.visitEachChild(node, visitChildren, context);
            };
            const visit = (node: ts.Node): ts.Node =>
                ts.visitEachChild(node, (n) => convertNode(n), context);
            return ts.visitNode(sourceFile, visit) as ts.SourceFile;
        };
    }) as ts.TransformerFactory<ts.SourceFile>;

function replaceExtension(filename: string, oldExt: string, newExt: string): string {
    if (!filename.endsWith(oldExt)) return filename;
    return filename.slice(0, -oldExt.length) + newExt;
}

function createCompilerHost(
    options: ts.CompilerOptions,
    io: MockIO,
): ts.CompilerHost {
    function resolveModuleNames(
        moduleNames: string[],
        containingFile: string,
    ): (ts.ResolvedModule | undefined)[] {
        const resolved: (ts.ResolvedModule | undefined)[] = [];
        for (const moduleName of moduleNames) {
            const result = ts.resolveModuleName(moduleName, containingFile, options, {
                fileExists: (f) => io.fileExists(f),
                readFile: (f) => io.readFile(f),
            });
            if (result.resolvedModule) {
                resolved.push(result.resolvedModule);
                io.rememberImport(moduleName, result.resolvedModule.resolvedFileName);
            } else if (EXTRA_TYPES.some((ext) => moduleName.endsWith(ext))) {
                if (io.fileExists(moduleName)) {
                    resolved.push({
                        resolvedFileName: moduleName + '.js',
                        isExternalLibraryImport: true,
                        resolvedUsingTsExtension: false,
                        extension: '.d.ts',
                    } as ts.ResolvedModule);
                    io.rememberImport(moduleName, moduleName + '.js');
                    continue;
                }
            } else {
                io.error(`Could not resolve module '${moduleName}' from '${containingFile}'`);
                resolved.push(undefined);
            }
        }
        return resolved;
    }

    return {
        getSourceFile: (fileName, languageVersion) => {
            const text = io.readFile(fileName);
            if (text === undefined) return undefined;
            return ts.createSourceFile(fileName, text, languageVersion);
        },
        getDefaultLibFileName: () => 'lib.es2016.full.d.ts',
        writeFile: (fileName, data) => io.writeFile(fileName, data),
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        getCanonicalFileName: (fileName) => fileName.toLowerCase(),
        getNewLine: () => '\n',
        useCaseSensitiveFileNames: () => false,
        fileExists: (f) => io.fileExists(f),
        readFile: (f) => io.readFile(f),
        resolveModuleNames,
    };
}

/** Compile TypeScript source code in the browser. */
export async function compile(
    mainFilename: string,
    code: Record<string, { contents: string }>,
): Promise<CompilationResult> {
    const loadedLibFiles = await getLibFiles();
    const otherFiles: Record<string, string> = { ...loadedLibFiles };
    otherFiles[KETTLE_D_TS_FILENAME] = KETTLE_JEST_D_TS;
    otherFiles[EXTRA_TS_FAKE_FILENAME] = 'export const someValue = 0;';

    // Populate with student code
    Object.entries(code).forEach(([filename, file]) => {
        if (!(filename in otherFiles)) {
            otherFiles['./' + filename] = file.contents;
        }
    });

    const options = ts.getDefaultCompilerOptions();
    options.noImplicitAny = true;
    options.inlineSources = true;
    options.inlineSourceMap = true;
    options.target = ts.ScriptTarget.ES2016;
    options.module = ts.ModuleKind.ESNext;
    options.useCaseSensitiveFileNames = false;
    options.allowJs = true;
    options.noLib = false;
    options.allowSyntheticDefaultImports = true;

    const dummyFileOut = replaceExtension(mainFilename, '.ts', '.js');
    let outputCode: string | undefined;
    const files: Record<string, string> = {};
    const imports: Record<string, string> = {};
    const extraErrors: string[] = [];
    let importedDiagnostics: ts.Diagnostic[] = [];

    // host is declared here and assigned later because io.rememberImport references it (forward reference)
    // eslint-disable-next-line prefer-const
    let host!: ts.CompilerHost;

    const io: MockIO = {
        fileExists: (fileName) => fileName in code || fileName in otherFiles,
        readFile: (fileName) => {
            if (fileName in code) return code[fileName].contents;
            if (fileName in otherFiles) return otherFiles[fileName];
            return undefined;
        },
        writeFile: (fileName, data) => {
            if (fileName === dummyFileOut) {
                outputCode = data;
            }
            otherFiles[fileName] = data;
        },
        error: (message) => extraErrors.push(message),
        rememberImport: (moduleName, fileName) => {
            if (fileName.endsWith('.d.ts')) {
                fileName = replaceExtension(fileName, '.d.ts', '.js');
            } else if (EXTRA_TYPES.some((ext) => moduleName.endsWith(ext))) {
                const rawContent = otherFiles[moduleName];
                otherFiles[fileName] = `Object.defineProperty(exports, "__esModule", { value: true }); exports.default = ${JSON.stringify(rawContent)};`;
            } else if (fileName.endsWith('.ts')) {
                const jsFileName = replaceExtension(fileName, '.ts', '.js');
                if (!(jsFileName in otherFiles)) {
                    try {
                        const subProgram = ts.createProgram(
                            [KETTLE_D_TS_FILENAME, fileName],
                            { ...options, module: ts.ModuleKind.CommonJS },
                            host,
                        );
                        const emitResults = subProgram.emit();
                        importedDiagnostics = importedDiagnostics
                            .concat(ts.getPreEmitDiagnostics(subProgram) as ts.Diagnostic[])
                            .concat(emitResults.diagnostics as ts.Diagnostic[]);
                        otherFiles[jsFileName] = removeEmptyExports(otherFiles[jsFileName] ?? '');
                        fileName = jsFileName;
                    } catch (e) {
                        console.error('Error compiling additional file', fileName, e);
                        io.error(`Error compiling additional file ${fileName}: ${(e as Error).message}`);
                        return;
                    }
                }
            }
            if (fileName in otherFiles) {
                imports[moduleName] = otherFiles[fileName];
            } else {
                console.error('Unknown import', moduleName, fileName);
            }
        },
    };

    const importFile = (_file: string) => {
        files[_file] = `export const someValue = "Hello world!"`;
    };

    host = createCompilerHost(options, io);

    let program: ts.Program;
    try {
        program = ts.createProgram(
            [KETTLE_D_TS_FILENAME, mainFilename],
            options,
            host,
        );
    } catch (e) {
        return {
            files,
            imports,
            diagnostics: [makeDiagnostic((e as Error).toString())].concat(
                extraErrors.map((m) => makeDiagnostic(m)),
            ),
            locals: new Map(),
        };
    }

    const emitResult = program.emit(undefined, undefined, undefined, undefined, {
        before: [removeExports(importFile)],
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    if (outputCode === undefined) {
        return {
            files,
            imports,
            diagnostics: [makeDiagnostic('No output code generated')].concat(
                extraErrors.map((m) => makeDiagnostic(m)),
            ),
            locals: new Map(),
        };
    }

    const resultSourceFile = program.getSourceFile(mainFilename);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const localsRaw = (resultSourceFile as any)?.locals as Map<string, ts.Symbol> | undefined;
    const locals: Map<string, ts.Symbol> = localsRaw ?? new Map<string, ts.Symbol>();

    // Filter out non-value symbols (interfaces, type aliases, etc.)
    const isNonValue = (flags: number) =>
        flags === 0 ||
        (flags & ts.SymbolFlags.Interface) !== 0 ||
        (flags & ts.SymbolFlags.TypeAlias) !== 0 ||
        (flags & ts.SymbolFlags.ConstEnum) !== 0 ||
        (flags & ts.SymbolFlags.NamespaceModule) !== 0;

    locals.forEach((value, key) => {
        if (
            isNonValue(value.flags) ||
            (value.declarations &&
                value.declarations.every(
                    (d) => (d.flags & ts.SymbolFlags.Transient) !== 0,
                ))
        ) {
            locals.delete(key);
        }
    });

    return {
        code: removeEmptyExports(outputCode),
        files,
        imports,
        diagnostics: (emitResult.diagnostics as ts.Diagnostic[])
            .concat(diagnostics as ts.Diagnostic[])
            .concat(extraErrors.map((m) => makeDiagnostic(m)))
            .concat(importedDiagnostics),
        locals,
    };
}
