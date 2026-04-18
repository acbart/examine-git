import { create } from 'zustand';
import type { GitRepositoryState, GitBranch } from './gitTypes';
import { executeGitCommand } from './gitEngine';
import { INITIAL_FILES } from '../filesystem/filesystemStore';

const INITIAL_HASH = 'a1b2c3d4';

const INITIAL_TRACKED: Record<string, string | undefined> = Object.fromEntries(
  Object.values(INITIAL_FILES).map((f) => [f.path, f.content])
);

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
