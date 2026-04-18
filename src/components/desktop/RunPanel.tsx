import { useExecutionStore, type ConsoleLine } from '../../features/execution/executionStore';
import { useFilesystemStore } from '../../features/filesystem/filesystemStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatArg(arg: any): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object') {
        try {
            return JSON.stringify(arg, null, 2);
        } catch {
            return String(arg);
        }
    }
    return String(arg);
}

function renderLine(line: ConsoleLine) {
    const text = line.args.map(formatArg).join(' ');
    const classMap: Record<string, string> = {
        error: 'run-line error',
        warn: 'run-line warn',
        info: 'run-line info',
        system: 'run-line system',
        log: 'run-line log',
        table: 'run-line log',
        clear: 'run-line system',
    };
    const cls = classMap[line.type] ?? 'run-line log';
    return (
        <div key={line.id} className={cls}>
            <pre>{text}</pre>
        </div>
    );
}

export function RunPanel() {
    const { status, statusMessage, consoleLines, testResults, totalPassed, totalTests, isRunning, elapsedMs, run, terminate, clearConsole } =
        useExecutionStore();
    const { readFile } = useFilesystemStore();
    const { activeFilePath } = useWorkspaceStore();

    async function handleRun() {
        if (isRunning) {
            terminate();
            return;
        }
        if (!activeFilePath) return;

        // Collect TypeScript/JavaScript files for the compiler
        const file = readFile(activeFilePath);
        if (!file) return;

        const files: Record<string, { contents: string }> = {
            [activeFilePath]: { contents: file.content },
        };
        await run(activeFilePath, files);
    }

    const statusIcon =
        status === 'compiling' || status === 'running' ? '⏳' :
        status === 'finished' ? '✅' :
        status === 'error' ? '❌' :
        status === 'terminated' ? '⏹' : '●';

    const elapsedSec = (elapsedMs / 1000).toFixed(1);

    return (
        <div className="run-panel">
            <div className="run-controls">
                <button
                    className={`run-btn ${isRunning ? 'running' : ''}`}
                    onClick={() => { void handleRun(); }}
                    disabled={!activeFilePath}
                    title={isRunning ? 'Stop execution' : 'Run active file'}
                >
                    {isRunning ? '⏹ Stop' : '▶ Run'}
                </button>
                <span className="run-status">
                    {statusIcon} {statusMessage}
                </span>
                {(status === 'running' || status === 'compiling') && (
                    <span className="run-elapsed">{elapsedSec}s</span>
                )}
                <button
                    className="run-clear-btn"
                    onClick={clearConsole}
                    title="Clear console"
                >
                    🗑
                </button>
            </div>

            {totalTests > 0 && (
                <div className="run-test-summary">
                    <span className={totalPassed === totalTests ? 'tests-passed' : 'tests-failed'}>
                        Tests: {totalPassed}/{totalTests}
                    </span>
                    <div className="run-test-list">
                        {testResults.map((r, i) => (
                            <div key={i} className={`run-test ${r.passed ? 'passed' : 'failed'}`}>
                                {r.passed ? '✅' : '❌'}{' '}
                                {r.suiteName === '__GLOBAL' ? r.testName : `${r.suiteName} › ${r.testName}`}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="run-console">
                <div className="run-console-header">OUTPUT</div>
                <div className="run-console-output">
                    {consoleLines.map(renderLine)}
                </div>
            </div>
        </div>
    );
}
