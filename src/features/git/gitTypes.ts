export interface GitCommit {
  hash: string;
  message: string;
  timestamp: string;
  files: string[];
  /** File contents captured at commit time, keyed by path. */
  fileContents: Record<string, string>;
}

export interface GitBranch {
  name: string;
  commitHashes: string[];
}

export interface GitRepositoryState {
  initialized: boolean;
  currentBranch: string;
  branches: Record<string, GitBranch | undefined>;
  commits: Record<string, GitCommit | undefined>;
  stagedFiles: string[];
  trackedFiles: Record<string, string | undefined>;
}

export interface GitCommandResult {
  output: string;
  newState: GitRepositoryState;
}
