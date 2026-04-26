import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useGitStore } from '../../features/git/gitStore';
import { useGithubStore } from '../../features/github/githubStore';
import { useFilesystemStore } from '../../features/filesystem/filesystemStore';
import { useExecutionStore } from '../../features/execution/executionStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useQuizStore } from '../../features/quiz/quizStore';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error';
  text: string;
}

export function TerminalPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'output', text: 'Terminal ready. Type "help" for available commands.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [collapsed, setCollapsed] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { runCommand, repo } = useGitStore();
  const { pushBranch } = useGithubStore();
  const { listFiles, readFile } = useFilesystemStore();
  const { run: runCode } = useExecutionStore();
  const { runFilePath } = useWorkspaceStore();
  const { activeTaskId, pauseTask } = useQuizStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function addLine(type: TerminalLine['type'], text: string) {
    const id = nextId.current++;
    setLines((prev) => [...prev, { id, type, text }]);
  }

  function processCommand(cmd: string) {
    const trimmed = cmd.trim();
    if (trimmed === '') return;

    addLine('input', `$ ${trimmed}`);
    setHistory((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);

    const parts = trimmed.split(/\s+/);
    const command = parts[0] ?? '';
    const args = parts.slice(1);

    if (command === 'git') {
      const files = listFiles();
      const fileContents: Record<string, string> = {};
      for (const f of files) {
        fileContents[f.path] = f.content;
      }

      const prevBranch = repo.currentBranch;

      if (args[0] === 'push') {
        const output = runCommand(args, fileContents);
        if (output.length > 0 && !output.startsWith('fatal')) {
          pushBranch(repo.currentBranch, files);
        }
        addLine('output', output);
      } else {
        const output = runCommand(args, fileContents);
        addLine('output', output);
      }

      // If a terminal checkout/switch changed the branch away from the active
      // task branch, pause the task so its state is not corrupted.
      const newBranch = useGitStore.getState().repo.currentBranch;
      if (newBranch !== prevBranch && activeTaskId !== null) {
        pauseTask();
        addLine('output', '⚠ Active task paused because you switched branches.');
      }
    } else if (command === 'run') {
      const filename = (args.length > 0 ? args[0] : runFilePath) ?? '';
      if (!filename) {
        addLine('error', 'No file specified. Usage: run <filename>');
        return;
      }
      const file = readFile(filename);
      if (!file) {
        addLine('error', `File not found: ${filename}`);
        return;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(filename)) {
        addLine('error', `Cannot run ${filename}: only TypeScript/JavaScript files are supported`);
        return;
      }
      addLine('output', `Running ${filename}... (output in Run panel)`);
      void runCode(filename, { [filename]: { contents: file.content } });
    } else if (command === 'ls') {
      const files = listFiles();
      const fileList = files.map((f) => f.name).join('  ');
      addLine('output', fileList);
    } else if (command === 'echo') {
      addLine('output', args.join(' '));
    } else if (command === 'clear') {
      setLines([]);
    } else if (command === 'help') {
      addLine('output', [
        'Available commands:',
        '  git init                    - Initialize repository',
        '  git status                  - Show working tree status',
        '  git add <path|.>           - Stage files',
        '  git commit -m "message"    - Commit staged files',
        '  git branch [name]          - List/create branches',
        '  git checkout <branch>      - Switch branch',
        '  git switch <branch>        - Switch branch',
        '  git push                   - Push to remote',
        '  git pull                   - Pull from remote',
        '  git merge <branch>         - Merge branch',
        '  git log                    - Show commit log',
        '  run [filename]             - Run a TypeScript/JavaScript file',
        '  ls                         - List files',
        '  echo <text>                - Print text',
        '  clear                      - Clear terminal',
        '  help                       - Show this help',
      ].join('\n'));
    } else {
      addLine('error', `${command}: command not found`);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      processCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setInput(history.at(newIndex) ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex === -1 ? '' : (history.at(newIndex) ?? ''));
    }
  }

  return (
    <div className={`terminal-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="terminal-header">
        <span>TERMINAL</span>
        {activeTaskId !== null && (
          <span className="terminal-task-badge" title="You are working on a task">
            🔀 {repo.currentBranch}
          </span>
        )}
        <button
          className="panel-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand terminal' : 'Collapse terminal'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="terminal-output">
            {lines.map((line) => (
              <div key={line.id} className={`terminal-line ${line.type}`}>
                <pre>{line.text}</pre>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="terminal-input-row">
            <span className="terminal-prompt">$</span>
            <input
              type="text"
              className="terminal-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </>
      )}
    </div>
  );
}
