import * as ts from 'typescript';
import type { FeedbackExecutionRequest } from './ts_assembler';
import type { SourceCodeMapping } from './ts_source';

const STUDENT_MAIN_TS = 'student_main.ts';
const STUDENT_MAIN_JS = 'student_main.js';

export interface KettleEngineSystemError {
    place: string;
    category: string;
    error: {
        stack: string;
        message: string;
        text: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw: any;
    };
}

const STACK_TRACE_REGEX = new RegExp(
    '^' +
        '(?:\\s*at )?' +
        '(?:(new) )?' +
        '(?:(.*?) \\()?' +
        '(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' +
        '(?:(.+?):(\\d+):(\\d+)|(native))' +
        '(\\)?)$',
);

function getValueForLowestKey(
    object: Record<number, [number, number]>,
    index: number,
): [number, number] | undefined {
    let returned: [number, number] | undefined;
    for (const key in object) {
        if (parseInt(key, 10) > index) break;
        // Number key iteration on Record<number,...> returns string keys
        returned = object[parseInt(key, 10)];
    }
    return returned;
}

export function cleanStack(
    stack: string,
    sourceCodeMapping: SourceCodeMapping,
): string {
    const lines = stack.split('\n');
    const cleaned: string[] = [];
    const restLines = lines.slice(1);
    restLines.reverse();
    let initialLine: number | null = null;
    for (const originalLine of restLines) {
        const line = originalLine.trim().match(STACK_TRACE_REGEX);
        if (!line) {
            cleaned.push(originalLine);
            continue;
        }
        const functionName =
            line[2] === 'eval' ? 'eval' : !line[2] ? 'code' : line[2];
        const inModule = !line[7].startsWith('blob:');
        let lineNumber = parseInt(line[8], 10);
        const colNumber = parseInt(line[9], 10);
        if (initialLine === null) {
            initialLine = lineNumber;
        } else {
            const best = getValueForLowestKey(
                sourceCodeMapping[lineNumber - 2] ?? {},
                colNumber,
            );
            if (best !== undefined) {
                lineNumber = best[0];
            }
        }
        if (inModule) {
            cleaned.push(`    at ${functionName} (line ${lineNumber}, column ${colNumber})`);
        }
    }
    cleaned.push(lines[0]);
    cleaned.reverse();
    return cleaned.join('\n');
}

export function handleKettleSystemError(
    error: KettleEngineSystemError,
    request: FeedbackExecutionRequest,
): string {
    const place = error.place.charAt(0).toUpperCase() + error.place.slice(1);
    const category = error.category.charAt(0).toUpperCase() + error.category.slice(1);
    const result = [`${category} error in ${place} code:\n`];

    const defaultText =
        error.error.text === '[object Object]'
            ? JSON.stringify(error.error.raw)
            : error.error.text;

    if (error.place === 'student') {
        const sourceCodeMapping = request.student.sourceCodeMapping;
        if (error.category === 'syntax' || error.category === 'runtime') {
            if (error.error.stack) {
                result.push(cleanStack(error.error.stack, sourceCodeMapping));
            } else {
                result.push(defaultText);
            }
        } else {
            result.push(defaultText);
        }
    } else {
        result.push(defaultText);
    }

    return result.join('\n');
}

export function processTypeScriptDiagnostic(
    diagnostic: ts.Diagnostic,
    where: string = '',
): string {
    if (diagnostic.file) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start ?? -1,
        );
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        const prefix = where.length ? where + ' ' : '';
        if (
            diagnostic.file.fileName === STUDENT_MAIN_TS ||
            diagnostic.file.fileName === STUDENT_MAIN_JS
        ) {
            return `${prefix}(Line ${line + 1}, Position ${character + 1}): ${message}`;
        } else {
            return `${prefix}(File ${diagnostic.file.fileName}, Line ${line + 1}, Position ${character + 1}): ${message}`;
        }
    } else {
        return (where ? where + ' ' : '') + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    }
}
