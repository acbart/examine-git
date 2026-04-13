import { create } from 'zustand';
import type { GitRepositoryState, GitBranch } from './gitTypes';
import { executeGitCommand } from './gitEngine';

const INITIAL_HASH = 'a1b2c3d4';

const INITIAL_TRACKED: Record<string, string | undefined> = {
  'index.html': '',
  'src/main.ts': '',
  'src/style.css': '',
  'src/app.py': '',
  'README.md': '',
};

const INITIAL_BRANCH: GitBranch = {
  name: 'main',
  commitHashes: [INITIAL_HASH],
};

const INITIAL_STATE: GitRepositoryState = {
  initialized: true,
  currentBranch: 'main',
  branches: { main: INITIAL_BRANCH },
  commits: {
    [INITIAL_HASH]: {
      hash: INITIAL_HASH,
      message: 'Initial commit',
      timestamp: new Date().toISOString(),
      files: Object.keys(INITIAL_TRACKED),
    },
  },
  stagedFiles: [],
  trackedFiles: INITIAL_TRACKED,
};

interface GitStoreState {
  repo: GitRepositoryState;
  lastOutput: string;
  runCommand: (args: string[], fileContents: Record<string, string>) => string;
}

export const useGitStore = create<GitStoreState>()((set, get) => ({
  repo: INITIAL_STATE,
  lastOutput: '',
  runCommand: (args, fileContents) => {
    const result = executeGitCommand(args, get().repo, fileContents);
    set({ repo: result.newState, lastOutput: result.output });
    return result.output;
  },
}));
