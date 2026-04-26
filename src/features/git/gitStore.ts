import { create } from 'zustand';
import type { GitRepositoryState, GitBranch } from './gitTypes';
import { executeGitCommand, getFilesAtBranch as engineGetFilesAtBranch } from './gitEngine';
import { INITIAL_FILES } from '../filesystem/filesystemStore';
import { useFilesystemStore } from '../filesystem/filesystemStore';

const INITIAL_HASH = 'a1b2c3d4';

const INITIAL_TRACKED: Record<string, string> = Object.fromEntries(
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
      fileContents: { ...INITIAL_TRACKED },
    },
  },
  stagedFiles: [],
  trackedFiles: INITIAL_TRACKED,
};

interface GitStoreState {
  repo: GitRepositoryState;
  lastOutput: string;
  runCommand: (args: string[], fileContents: Record<string, string>) => string;
  /** Switch to an existing branch and update the filesystem to match its HEAD. */
  checkoutBranch: (branchName: string) => boolean;
  /** Create a new branch off `fromBranch` without switching to it. */
  createBranchFrom: (newName: string, fromBranch: string) => boolean;
  /** Return reconstructed file contents for a branch. */
  getFilesAtBranch: (branchName: string) => Record<string, string>;
}

export const useGitStore = create<GitStoreState>()((set, get) => ({
  repo: INITIAL_STATE,
  lastOutput: '',
  runCommand: (args, fileContents) => {
    const prevBranch = get().repo.currentBranch;
    const result = executeGitCommand(args, get().repo, fileContents);
    set({ repo: result.newState, lastOutput: result.output });

    // When the branch changed (checkout/switch), sync the filesystem.
    const newBranch = result.newState.currentBranch;
    if (newBranch !== prevBranch) {
      const branchFiles = engineGetFilesAtBranch(newBranch, result.newState);
      useFilesystemStore.getState().setFiles(branchFiles);
    }

    return result.output;
  },
  checkoutBranch: (branchName) => {
    const { repo } = get();
    if (!repo.branches[branchName]) return false;
    const branchFiles = engineGetFilesAtBranch(branchName, repo);
    useFilesystemStore.getState().setFiles(branchFiles);
    set({ repo: { ...repo, currentBranch: branchName } });
    return true;
  },
  createBranchFrom: (newName, fromBranch) => {
    const { repo } = get();
    if (!repo.initialized) return false;
    if (repo.branches[newName] !== undefined) return false;
    const source = repo.branches[fromBranch];
    if (source === undefined) return false;
    const newBranch: GitBranch = {
      name: newName,
      commitHashes: [...source.commitHashes],
    };
    set({ repo: { ...repo, branches: { ...repo.branches, [newName]: newBranch } } });
    return true;
  },
  getFilesAtBranch: (branchName) => {
    return engineGetFilesAtBranch(branchName, get().repo);
  },
}));
