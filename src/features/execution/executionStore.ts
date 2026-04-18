import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
    makeIFrame,
    executeCodeInIFrame,
    terminateIFrame,
    toggleIFrameDebug,
    sendDataToIframe,
} from '../../services/execution/safe_iframe';
import { makeExecutionRequest } from '../../services/execution/ts_assembler';
import {
    handleKettleSystemError,
    processTypeScriptDiagnostic,
    type KettleEngineSystemError,
} from '../../services/execution/ts_traceback';
import { CONSOLE_API_COMMAND_LIST } from '../../services/execution/ts_console';
import type { FeedbackExecutionRequest } from '../../services/execution/ts_assembler';

export type ExecutionStatus =
    | 'idle'
    | 'compiling'
    | 'running'
    | 'finished'
    | 'error'
    | 'terminated';

export interface ConsoleLine {
    id: number;
    type: 'log' | 'error' | 'info' | 'warn' | 'table' | 'clear' | 'system';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[];
    timestamp: number;
}

interface TestCollection {
    expects: string[];
    status: string;
}

interface TestSuite {
    tests: Record<string, TestCollection>;
    status: string;
}

export interface TestResult {
    suiteName: string;
    testName: string;
    passed: boolean;
}

interface ExecutionState {
    status: ExecutionStatus;
    statusMessage: string;
    consoleLines: ConsoleLine[];
    testResults: TestResult[];
    totalPassed: number;
    totalTests: number;
    elapsedMs: number;
    isRunning: boolean;

    run: (mainFilename: string, files: Record<string, { contents: string }>) => Promise<void>;
    terminate: () => void;
    clearConsole: () => void;
}

// Message data coming from the iframe execution environment
interface IframeMessageData {
    engineId?: string;
    type?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contents?: any;
}

let _lineId = 0;
function nextId() {
    return _lineId++;
}

// Singleton iframe + engine state (lives outside React state for performance)
let _iframe: HTMLIFrameElement | null = null;
let _latestListener: ((e: MessageEvent) => void) | null = null;
let _engineId: string = uuidv4();
let _executionConfirmation: ReturnType<typeof setTimeout> | null = null;
let _timerInterval: ReturnType<typeof setInterval> | null = null;
let _startTime = 0;

function getIFrame(): HTMLIFrameElement {
    if (!_iframe) {
        _iframe = makeIFrame();
    }
    return _iframe;
}

function stopTimer() {
    if (_timerInterval !== null) {
        clearInterval(_timerInterval);
        _timerInterval = null;
    }
}

export const useExecutionStore = create<ExecutionState>()((set, get) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function addLine(type: ConsoleLine['type'], args: any[]) {
        set((state) => ({
            consoleLines: [
                ...state.consoleLines,
                { id: nextId(), type, args, timestamp: Date.now() },
            ],
        }));
    }

    function setStatus(status: ExecutionStatus, message: string) {
        set({ status, statusMessage: message });
    }

    function handleExecutionStopped(reason: string) {
        stopTimer();
        if (_executionConfirmation !== null) {
            clearTimeout(_executionConfirmation);
            _executionConfirmation = null;
        }
        set({ isRunning: false });
        setStatus(
            reason === 'Execution Finished' ? 'finished' : 'terminated',
            reason,
        );
    }

    function handleTestResults(testResults: Record<string, TestSuite>) {
        const results: TestResult[] = [];
        let totalPassed = 0;
        let totalTests = 0;
        Object.entries(testResults).forEach(([suiteName, suite]) => {
            if (suiteName === '_signedKey') return;
            Object.entries(suite.tests).forEach(([testName, test]) => {
                const passed = test.expects.every((r) => r === 'passed');
                totalPassed += passed ? 1 : 0;
                totalTests += 1;
                results.push({ suiteName, testName, passed });
            });
        });
        set({ testResults: results, totalPassed, totalTests });
    }

    function handleExecutionEvents(
        event: MessageEvent<IframeMessageData>,
        feedbackRequest: FeedbackExecutionRequest,
    ) {
        const data = event.data;
        if (data.engineId !== _engineId) return;

        const handled = CONSOLE_API_COMMAND_LIST.find((type) => {
            if (data.type === `console.${type}`) {
                if (type === 'clear') {
                    set({ consoleLines: [] });
                } else {
                    addLine(type as ConsoleLine['type'], data.contents as string[]);
                }
                return true;
            }
            return false;
        });

        if (handled) return;

        if (data.type === 'execution.begun') {
            if (_executionConfirmation !== null) clearTimeout(_executionConfirmation);
        } else if (data.type === 'execution.error') {
            const errData = data.contents as KettleEngineSystemError;
            const message = handleKettleSystemError(errData, feedbackRequest);
            addLine('error', [message]);
            setStatus('error', `${errData.category} ${errData.place} error`);
        } else if (data.type === 'execution.update') {
            setStatus('running', (data.contents as string[])[0]);
        } else if (data.type === 'execution.finished') {
            handleExecutionStopped('Execution Finished');
        } else if (data.type === 'instructor.tests') {
            handleTestResults(data.contents as Record<string, TestSuite>);
        }
    }

    function executeRequest(request: FeedbackExecutionRequest, attempts = 3) {
        const iframe = getIFrame();

        if (_executionConfirmation !== null) clearTimeout(_executionConfirmation);
        _executionConfirmation = setTimeout(() => {
            if (attempts > 0) {
                addLine('system', [
                    `Execution engine failed to respond. Retrying (${attempts} attempts left).`,
                ]);
                iframe.onload = () => executeRequest(request, attempts - 1);
                // Reload the iframe by reassigning its src
                const currentSrc = iframe.src;
                iframe.src = '';
                iframe.src = currentSrc;
            } else {
                addLine('error', ['The execution engine failed to load. Please refresh.']);
                handleExecutionStopped('Execution Failure');
            }
        }, 5000);

        if (_latestListener !== null) {
            window.removeEventListener('message', _latestListener);
        }
        _latestListener = (e: MessageEvent<IframeMessageData>) =>
            handleExecutionEvents(e, request);
        window.addEventListener('message', _latestListener);

        if (iframe.contentWindow) {
            try {
                toggleIFrameDebug(iframe, _engineId, false);
                sendDataToIframe(iframe, 'require', request.linking.require);
                sendDataToIframe(iframe, '$importModule', request.linking.$importModule);
                executeCodeInIFrame(iframe, request.assembled, _engineId);
            } catch (e) {
                addLine('error', ['Error sending code to iframe', (e as Error).message]);
                handleExecutionStopped('Execution Error');
            }
        } else {
            addLine('error', ['Iframe not ready for execution.']);
            handleExecutionStopped('Execution Error');
        }
    }

    return {
        status: 'idle',
        statusMessage: 'Ready',
        consoleLines: [],
        testResults: [],
        totalPassed: 0,
        totalTests: 0,
        elapsedMs: 0,
        isRunning: false,

        async run(mainFilename, files) {
            if (get().isRunning) return;

            set({
                consoleLines: [],
                testResults: [],
                totalPassed: 0,
                totalTests: 0,
                elapsedMs: 0,
                isRunning: true,
            });
            setStatus('compiling', 'Compiling…');

            _engineId = uuidv4();
            _startTime = Date.now();
            stopTimer();
            _timerInterval = setInterval(() => {
                set({ elapsedMs: Date.now() - _startTime });
            }, 500);

            let request: FeedbackExecutionRequest;
            try {
                request = await makeExecutionRequest(mainFilename, files, _engineId);
            } catch (e) {
                stopTimer();
                addLine('error', ['Failed to compile code:', (e as Error).message]);
                set({ isRunning: false });
                setStatus('error', 'Compilation failed');
                return;
            }

            if (!request.noErrors) {
                const msgs = request.student.errors.map((d) =>
                    processTypeScriptDiagnostic(d),
                );
                msgs.forEach((m) => addLine('error', [m]));
                stopTimer();
                set({ isRunning: false });
                setStatus('error', 'TypeScript error');
                return;
            }

            setStatus('running', 'Running…');
            executeRequest(request);
        },

        terminate() {
            const iframe = getIFrame();
            terminateIFrame(iframe, _engineId);
            handleExecutionStopped('Terminated by user');
        },

        clearConsole() {
            set({ consoleLines: [] });
        },
    };
});
