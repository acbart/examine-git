import { executeGitCommand } from '../src/features/git/gitEngine';
import type { GitRepositoryState } from '../src/features/git/gitTypes';

function makeEmptyState(): GitRepositoryState {
    return {
        initialized: false,
        currentBranch: 'main',
        branches: { main: { name: 'main', commitHashes: [] } },
        commits: {},
        stagedFiles: [],
        trackedFiles: {},
    };
}

function makeInitedState(): GitRepositoryState {
    return { ...makeEmptyState(), initialized: true };
}

const FILES = { 'src/main.ts': 'console.log("hi")', 'README.md': '# readme' };

describe('gitEngine – init', () => {
    test('initialises an empty repo', () => {
        const { output, newState } = executeGitCommand(['init'], makeEmptyState(), {});
        expect(output).toMatch(/Initialized empty Git repository/);
        expect(newState.initialized).toBe(true);
    });

    test('reinitialises an already-initialised repo', () => {
        const { output, newState } = executeGitCommand(['init'], makeInitedState(), {});
        expect(output).toMatch(/Reinitialized/);
        expect(newState.initialized).toBe(true);
    });

    test('returns usage when no command provided', () => {
        const { output } = executeGitCommand([], makeEmptyState(), {});
        expect(output).toMatch(/usage:/);
    });

    test('returns error message for unknown subcommand', () => {
        const { output } = executeGitCommand(['frobnicate'], makeInitedState(), {});
        expect(output).toMatch(/is not a git command/);
    });
});

describe('gitEngine – status', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['status'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('shows untracked files', () => {
        const { output } = executeGitCommand(['status'], makeInitedState(), FILES);
        expect(output).toContain('Untracked files');
        expect(output).toContain('src/main.ts');
        expect(output).toContain('README.md');
    });

    test('shows nothing to commit when working tree clean', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            trackedFiles: { ...FILES },
        };
        const { output } = executeGitCommand(['status'], state, FILES);
        expect(output).toContain('nothing to commit');
    });

    test('shows staged files', () => {
        const state: GitRepositoryState = { ...makeInitedState(), stagedFiles: ['src/main.ts'] };
        const { output } = executeGitCommand(['status'], state, FILES);
        expect(output).toContain('Changes to be committed');
        expect(output).toContain('src/main.ts');
    });

    test('shows modified (tracked but changed) files', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            trackedFiles: { 'src/main.ts': 'old content' },
        };
        const { output } = executeGitCommand(['status'], state, FILES);
        expect(output).toContain('Changes not staged');
        expect(output).toContain('src/main.ts');
    });
});

describe('gitEngine – add', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['add', 'src/main.ts'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('stages a specific file', () => {
        const { newState } = executeGitCommand(['add', 'src/main.ts'], makeInitedState(), FILES);
        expect(newState.stagedFiles).toContain('src/main.ts');
        expect(newState.stagedFiles).not.toContain('README.md');
    });

    test('stages all files with "."', () => {
        const { newState } = executeGitCommand(['add', '.'], makeInitedState(), FILES);
        expect(newState.stagedFiles).toContain('src/main.ts');
        expect(newState.stagedFiles).toContain('README.md');
    });

    test('does not duplicate already-staged files', () => {
        const state: GitRepositoryState = { ...makeInitedState(), stagedFiles: ['src/main.ts'] };
        const { newState } = executeGitCommand(['add', 'src/main.ts'], state, FILES);
        expect(newState.stagedFiles.filter((f) => f === 'src/main.ts')).toHaveLength(1);
    });

    test('returns notice when nothing specified', () => {
        const { output } = executeGitCommand(['add'], makeInitedState(), FILES);
        expect(output).toMatch(/Nothing specified/);
    });
});

describe('gitEngine – commit', () => {
    test('fails when repo not initialised', () => {
        const state: GitRepositoryState = { ...makeEmptyState(), stagedFiles: ['src/main.ts'] };
        const { output } = executeGitCommand(['commit', '-m', 'first'], state, FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('reports nothing to commit when staging area is empty', () => {
        const { output } = executeGitCommand(['commit', '-m', 'empty'], makeInitedState(), FILES);
        expect(output).toMatch(/nothing to commit/);
    });

    test('creates a commit with -m flag', () => {
        const state: GitRepositoryState = { ...makeInitedState(), stagedFiles: ['src/main.ts'] };
        const { output, newState } = executeGitCommand(
            ['commit', '-m', 'initial commit'],
            state,
            FILES,
        );
        expect(output).toContain('initial commit');
        expect(newState.stagedFiles).toHaveLength(0);
        const hashes = newState.branches['main']?.commitHashes ?? [];
        expect(hashes).toHaveLength(1);
        const commitHash = hashes[0]!;
        expect(newState.commits[commitHash]?.message).toBe('initial commit');
        expect(newState.commits[commitHash]?.files).toContain('src/main.ts');
    });

    test('uses "no message" when -m is provided without a value', () => {
        const state: GitRepositoryState = { ...makeInitedState(), stagedFiles: ['src/main.ts'] };
        const { newState } = executeGitCommand(['commit', '-m'], state, FILES);
        const hash = newState.branches['main']?.commitHashes[0] ?? '';
        expect(newState.commits[hash]?.message).toBe('no message');
    });

    test('tracks file contents at commit time', () => {
        const state: GitRepositoryState = { ...makeInitedState(), stagedFiles: ['src/main.ts'] };
        const { newState } = executeGitCommand(['commit', '-m', 'track'], state, FILES);
        expect(newState.trackedFiles['src/main.ts']).toBe(FILES['src/main.ts']);
    });
});

describe('gitEngine – branch', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['branch', 'feat'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('lists branches (marking current with *)', () => {
        const { output } = executeGitCommand(['branch'], makeInitedState(), FILES);
        expect(output).toContain('* main');
    });

    test('creates a new branch', () => {
        const { newState } = executeGitCommand(['branch', 'feat'], makeInitedState(), FILES);
        expect(newState.branches['feat']).toBeDefined();
    });

    test('new branch inherits current commit history', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            branches: {
                main: { name: 'main', commitHashes: ['abc123'] },
            },
        };
        const { newState } = executeGitCommand(['branch', 'feat'], state, FILES);
        expect(newState.branches['feat']?.commitHashes).toEqual(['abc123']);
    });

    test('errors when branch already exists', () => {
        const { output } = executeGitCommand(['branch', 'main'], makeInitedState(), FILES);
        expect(output).toMatch(/already exists/);
    });
});

describe('gitEngine – checkout / switch', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['checkout', 'main'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('switches to an existing branch', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            branches: {
                main: { name: 'main', commitHashes: [] },
                feat: { name: 'feat', commitHashes: [] },
            },
        };
        const { output, newState } = executeGitCommand(['checkout', 'feat'], state, FILES);
        expect(output).toMatch(/Switched to branch/);
        expect(newState.currentBranch).toBe('feat');
    });

    test('errors when switching to a non-existent branch', () => {
        const { output } = executeGitCommand(['checkout', 'nope'], makeInitedState(), FILES);
        expect(output).toMatch(/did not match/);
    });

    test('creates and switches to new branch with -b', () => {
        const { output, newState } = executeGitCommand(
            ['checkout', '-b', 'feat'],
            makeInitedState(),
            FILES,
        );
        expect(output).toMatch(/Switched to a new branch/);
        expect(newState.currentBranch).toBe('feat');
        expect(newState.branches['feat']).toBeDefined();
    });

    test('switch -c also creates and switches branch', () => {
        const { output, newState } = executeGitCommand(
            ['switch', '-c', 'feature2'],
            makeInitedState(),
            FILES,
        );
        expect(output).toMatch(/Switched to a new branch/);
        expect(newState.currentBranch).toBe('feature2');
    });

    test('returns error when -b given without a branch name', () => {
        const { output } = executeGitCommand(['checkout', '-b'], makeInitedState(), FILES);
        expect(output).toMatch(/fatal: branch name required/);
    });

    test('returns error when no branch name given', () => {
        const { output } = executeGitCommand(['checkout'], makeInitedState(), FILES);
        expect(output).toMatch(/fatal: branch name required/);
    });
});

describe('gitEngine – push / pull', () => {
    test('push fails when repo not initialised', () => {
        const { output } = executeGitCommand(['push'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('push succeeds and mentions current branch', () => {
        const { output } = executeGitCommand(['push'], makeInitedState(), FILES);
        expect(output).toContain('main');
    });

    test('pull fails when repo not initialised', () => {
        const { output } = executeGitCommand(['pull'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('pull reports already up to date', () => {
        const { output } = executeGitCommand(['pull'], makeInitedState(), FILES);
        expect(output).toMatch(/Already up to date/);
    });
});

describe('gitEngine – merge', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['merge', 'feat'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('requires a branch name', () => {
        const { output } = executeGitCommand(['merge'], makeInitedState(), FILES);
        expect(output).toMatch(/fatal: branch name required/);
    });

    test('errors when source branch does not exist', () => {
        const { output } = executeGitCommand(['merge', 'ghost'], makeInitedState(), FILES);
        expect(output).toMatch(/not something we can merge/);
    });

    test('reports already up to date when merging current branch', () => {
        const { output } = executeGitCommand(['merge', 'main'], makeInitedState(), FILES);
        expect(output).toMatch(/Already up to date/);
    });

    test('merges another branch commits into current branch', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            commits: {
                abc: { hash: 'abc', message: 'feat commit', timestamp: '', files: ['src/main.ts'] },
            },
            branches: {
                main: { name: 'main', commitHashes: [] },
                feat: { name: 'feat', commitHashes: ['abc'] },
            },
        };
        const { output, newState } = executeGitCommand(['merge', 'feat'], state, FILES);
        expect(output).toContain('feat');
        expect(newState.branches['main']?.commitHashes).toContain('abc');
    });
});

describe('gitEngine – log', () => {
    test('fails when repo not initialised', () => {
        const { output } = executeGitCommand(['log'], makeEmptyState(), FILES);
        expect(output).toMatch(/fatal: not a git repository/);
    });

    test('reports no commits on empty branch', () => {
        const { output } = executeGitCommand(['log'], makeInitedState(), FILES);
        expect(output).toMatch(/no commits yet/);
    });

    test('shows commits in reverse order', () => {
        const state: GitRepositoryState = {
            ...makeInitedState(),
            commits: {
                aaa: { hash: 'aaa', message: 'first', timestamp: '2024-01-01', files: [] },
                bbb: { hash: 'bbb', message: 'second', timestamp: '2024-01-02', files: [] },
            },
            branches: {
                main: { name: 'main', commitHashes: ['aaa', 'bbb'] },
            },
        };
        const { output } = executeGitCommand(['log'], state, FILES);
        const firstIdx = output.indexOf('first');
        const secondIdx = output.indexOf('second');
        // second commit should appear before first in the output (reverse)
        expect(secondIdx).toBeLessThan(firstIdx);
    });
});
