import type * as ts from 'typescript';
import { extractSourceCodeMap, type SourceCodeMapping } from './ts_source';
import type { CompilationResult } from './ts_compiler';
import { linkObjects, type ModuleLinking } from './ts_linker';

export interface ProgramExecutionRequest {
    code: string;
    offset: {
        syntax: number;
        runtime: number;
    };
    locals: Map<string, ts.Symbol>;
    errors: ts.Diagnostic[];
    original: string;
    sourceCodeMapping: SourceCodeMapping;
    imports: Record<string, string>;
}

export interface FeedbackExecutionRequest {
    header: string;
    student: ProgramExecutionRequest;
    assembled: string;
    noErrors: boolean;
    engineId: string;
    linking: ModuleLinking;
}

export const FUNCTIONS_AVAILABLE_TO_STUDENTS = [
    'console',
    '$importModule',
    'describe',
    'test',
    'expect',
    '_setIframeVisible',
];

export const EXECUTION_HEADER = /*javascript*/ `// Execution Header
let silenceConsole = false;
let parentPost = (type, contents, override=false) => {
    if (!silenceConsole || override) {
        postMessage({ type, contents, isForParent: true });
    }
};
let originalConsole = window.console;
let console = {
    log: (...text) => parentPost("console.log", text),
    error: (...text) => parentPost("console.error", text),
    info: (...text) => parentPost("console.info", text),
    warn: (...text) => parentPost("console.warn", text),
    table: (...text) => parentPost("console.table", text),
    clear: () => parentPost("console.clear", [])
};
let _updateStatus = (message) => { parentPost("execution.update", [message]); };
let _kettleSystemError = (place, category, error) => {
    parentPost("execution.error", {
        place, category,
        error: {
            text: error.toString(),
            message: error.message,
            stack: error.stack,
            raw: JSON.parse(JSON.stringify(error))
        }
    });
};
var _setIframeVisible = (visible) => { parentPost("iframe.visibility", visible); };

var describe, test, expect;
(function() {
const isDeepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const DEFAULT_SUITE = "__GLOBAL";
let currentSuite = DEFAULT_SUITE, currentTest = null;
let _results = {[DEFAULT_SUITE]: { status: "success", tests: {} }};
describe = (name, tests) => {
    currentSuite = name;
    if (name in _results) throw new Error("Test suite name already exists: " + name);
    _results[currentSuite] = { status: "success", tests: {} };
    try { tests(); } catch (e) { _results[name].status = "failed: " + e.toString(); }
    currentSuite = DEFAULT_SUITE;
};
test = (name, assertions) => {
    currentTest = name;
    _results[currentSuite].tests[name] = { status: "success", expects: [] };
    silenceConsole = true;
    try { assertions(); }
    catch (e) {
        _results[currentSuite].tests[name].status = "failed: " + e.toString();
        _results[currentSuite].tests[name].expects.push("error");
    } finally { silenceConsole = false; }
    currentTest = null;
};
const getExpects = () => {
    if (currentTest === null) throw new Error("Trying to run expect outside of a test.");
    return _results[currentSuite].tests[currentTest].expects;
};
expect = (actual) => ({
    toBe: (expected) => { getExpects().push(actual === expected ? "passed" : "failed"); },
    toEqual: (expected) => { getExpects().push(isDeepEqual(actual, expected) ? "passed" : "failed"); },
    toContain: (expected) => { getExpects().push(actual.find(m => m === expected) ? "passed" : "failed"); },
    toBeInstanceOf: (expected) => { getExpects().push(actual instanceof expected ? "passed" : "failed"); },
    toThrowError: (expected) => {
        const expects = getExpects();
        try { actual(); } catch (e) { expects.push(e === expected ? "passed" : "failed"); }
    },
    not: {
        toBe: (expected) => { getExpects().push(actual === expected ? "failed" : "passed"); },
        toEqual: (expected) => { getExpects().push(isDeepEqual(actual, expected) ? "failed" : "passed"); },
        toContain: (expected) => { getExpects().push(actual.find(m => m === expected) ? "failed" : "passed"); },
        toBeInstanceOf: (expected) => { getExpects().push(actual instanceof expected ? "failed" : "passed"); },
        toThrowError: (expected) => {
            const expects = getExpects();
            try { actual(); } catch (e) { expects.push(e === expected ? "passed" : "failed"); }
        },
    },
});
`;

export const EXECUTION_FOOTER = /*javascript*/ `// Execution Footer
parentPost("instructor.tests", _results);
})();
parentPost("execution.finished", []);
`;

export interface WrappedCode {
    code: string;
    offset: { syntax: number; runtime: number };
    lineCount: number;
    locals: Map<string, ts.Symbol>;
}

export function wrapStudentCode(
    code: string,
    offset: number = 0,
    locals: Map<string, ts.Symbol>,
): WrappedCode {
    const functionParameters = FUNCTIONS_AVAILABLE_TO_STUDENTS.map((f) =>
        JSON.stringify(f),
    ).join(', ');
    const functionArguments = FUNCTIONS_AVAILABLE_TO_STUDENTS.join(', ');
    code = code.replace(/[\\`$]/g, '\\$&');
    code += '\nreturn {' + Array.from(locals.keys()).join(', ') + '};';
    const wrapped = `_updateStatus("Executing Student Code");
student = {};
studentNamespace = {};
try {
    const __studentFunction = Function(${functionParameters}, \`"use strict";\n${code}\`).bind(studentNamespace);
    try {
        student = __studentFunction(${functionArguments});
    } catch (e) {
        _kettleSystemError('student', "runtime", e);
    }
} catch (e) {
    _kettleSystemError('student', "syntax", e);
}`.trim();

    return {
        code: wrapped,
        offset: { syntax: 4 + offset, runtime: 6 + offset },
        lineCount: wrapped.split('\n').length + offset,
        locals,
    };
}

// Lazy import to avoid bundling ts_compiler with the main chunk unless needed
let _compile: typeof import('./ts_compiler').compile | null = null;
async function compile(
    mainFilename: string,
    code: Record<string, { contents: string }>,
): Promise<CompilationResult> {
    if (!_compile) {
        const mod = await import('./ts_compiler');
        _compile = mod.compile;
    }
    return _compile(mainFilename, code);
}

function preserveEmptyLines(files: Record<string, { contents: string }>): void {
    for (const key of Object.keys(files)) {
        files[key].contents = files[key].contents.replace(/\n\n/g, '\n//\n');
    }
}

export async function makeExecutionRequest(
    mainFilename: string,
    studentCode: Record<string, { contents: string }>,
    engineId: string,
): Promise<FeedbackExecutionRequest> {
    preserveEmptyLines(studentCode);
    const studentResults: CompilationResult = await compile(mainFilename, studentCode);
    const studentLocals = studentResults.locals;
    const headerOffset = EXECUTION_HEADER.split('\n').length;
    const wrappedStudent = wrapStudentCode(
        studentResults.code ?? '',
        headerOffset,
        studentLocals,
    );
    const assemblage = [EXECUTION_HEADER, wrappedStudent.code, EXECUTION_FOOTER];
    const assembled = assemblage.join('\n');

    const student: ProgramExecutionRequest = {
        ...wrappedStudent,
        imports: studentResults.imports,
        errors: studentResults.diagnostics,
        original: studentCode[mainFilename].contents,
        sourceCodeMapping: extractSourceCodeMap(studentResults.code ?? ''),
    };

    const linking = linkObjects(student);

    return {
        assembled,
        linking,
        header: EXECUTION_HEADER,
        student,
        engineId,
        noErrors: studentResults.diagnostics.length === 0,
    };
}