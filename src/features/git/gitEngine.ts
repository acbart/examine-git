import type { GitRepositoryState, GitCommandResult, GitCommit, GitBranch } from './gitTypes';

function generateHash(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getCurrentCommitHash(state: GitRepositoryState): string | undefined {
  const branch = state.branches[state.currentBranch];
  if (branch === undefined) return undefined;
  return branch.commitHashes[branch.commitHashes.length - 1];
}

export function executeGitCommand(
  args: string[],
  state: GitRepositoryState,
  fileContents: Record<string, string>
): GitCommandResult {
  if (args.length === 0) {
    return { output: 'usage: git <command> [args]', newState: state };
  }

  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case 'init': {
      if (state.initialized) {
        return { output: 'Reinitialized existing Git repository in .git/', newState: state };
      }
      return { output: 'Initialized empty Git repository in .git/', newState: { ...state, initialized: true } };
    }

    case 'status': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      const allPaths = Object.keys(fileContents);
      const lines: string[] = [`On branch ${state.currentBranch}`];

      if (state.stagedFiles.length > 0) {
        lines.push('\nChanges to be committed:');
        for (const f of state.stagedFiles) {
          lines.push(`  modified: ${f}`);
        }
      }

      const modified: string[] = [];
      const untracked: string[] = [];
      for (const path of allPaths) {
        if (state.stagedFiles.includes(path)) continue;
        const trackedContent = state.trackedFiles[path];
        const currentContent = fileContents[path];
        if (trackedContent === undefined) {
          untracked.push(path);
        } else if (currentContent !== trackedContent) {
          modified.push(path);
        }
      }

      if (modified.length > 0) {
        lines.push('\nChanges not staged for commit:');
        for (const f of modified) lines.push(`  modified: ${f}`);
      }
      if (untracked.length > 0) {
        lines.push('\nUntracked files:');
        for (const f of untracked) lines.push(`  ${f}`);
      }
      if (state.stagedFiles.length === 0 && modified.length === 0 && untracked.length === 0) {
        lines.push('\nnothing to commit, working tree clean');
      }

      return { output: lines.join('\n'), newState: state };
    }

    case 'add': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      if (rest.length === 0) {
        return { output: 'Nothing specified, nothing added.', newState: state };
      }
      const target = rest[0];

      let toStage: string[];
      if (target === '.') {
        toStage = Object.keys(fileContents);
      } else {
        toStage = [target];
      }

      const newStaged = [...state.stagedFiles];
      for (const f of toStage) {
        if (!newStaged.includes(f)) {
          newStaged.push(f);
        }
      }

      return { output: '', newState: { ...state, stagedFiles: newStaged } };
    }

    case 'commit': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      if (state.stagedFiles.length === 0) {
        return { output: 'On branch ' + state.currentBranch + '\nnothing to commit, working tree clean', newState: state };
      }

      const mIndex = rest.indexOf('-m');
      const message = mIndex >= 0
        ? (mIndex + 1 < rest.length ? rest[mIndex + 1] : 'no message')
        : (rest.length > 0 ? rest.join(' ') : 'no message');

      const hash = generateHash();
      const commitFileContents: Record<string, string> = {};
      for (const f of state.stagedFiles) {
        if (fileContents[f] !== undefined) {
          commitFileContents[f] = fileContents[f] as string;
        }
      }
      const commit: GitCommit = {
        hash,
        message,
        timestamp: new Date().toISOString(),
        files: [...state.stagedFiles],
        fileContents: commitFileContents,
      };

      const newTracked = { ...state.trackedFiles };
      for (const f of state.stagedFiles) {
        newTracked[f] = fileContents[f];
      }

      const currentBranch = state.branches[state.currentBranch];
      const existingHashes = currentBranch?.commitHashes ?? [];
      const updatedBranch: GitBranch = {
        name: state.currentBranch,
        commitHashes: [...existingHashes, hash],
      };

      return {
        output: `[${state.currentBranch} ${hash}] ${message}\n ${state.stagedFiles.length} file(s) changed`,
        newState: {
          ...state,
          stagedFiles: [],
          commits: { ...state.commits, [hash]: commit },
          branches: { ...state.branches, [state.currentBranch]: updatedBranch },
          trackedFiles: newTracked,
        },
      };
    }

    case 'branch': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      if (rest.length === 0) {
        const branchList = Object.keys(state.branches)
          .map((b) => (b === state.currentBranch ? `* ${b}` : `  ${b}`))
          .join('\n');
        return { output: branchList, newState: state };
      }
      const branchName = rest[0];

      if (state.branches[branchName] !== undefined) {
        return { output: `fatal: A branch named '${branchName}' already exists.`, newState: state };
      }

      const currentBranch = state.branches[state.currentBranch];
      const newBranch: GitBranch = {
        name: branchName,
        commitHashes: [...(currentBranch?.commitHashes ?? [])],
      };

      return {
        output: '',
        newState: { ...state, branches: { ...state.branches, [branchName]: newBranch } },
      };
    }

    case 'checkout':
    case 'switch': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }

      if (rest.length === 0) {
        return { output: 'fatal: branch name required', newState: state };
      }

      const firstArg = rest[0];

      if (firstArg === '-b' || firstArg === '-c') {
        if (rest.length < 2) {
          return { output: 'fatal: branch name required', newState: state };
        }
        const newName = rest[1];
        const currentBranch = state.branches[state.currentBranch];
        const newBranch: GitBranch = {
          name: newName,
          commitHashes: [...(currentBranch?.commitHashes ?? [])],
        };
        return {
          output: `Switched to a new branch '${newName}'`,
          newState: {
            ...state,
            currentBranch: newName,
            branches: { ...state.branches, [newName]: newBranch },
          },
        };
      }

      const actualTarget = firstArg;

      if (state.branches[actualTarget] === undefined) {
        return { output: `error: pathspec '${actualTarget}' did not match any file(s) known to git`, newState: state };
      }

      return {
        output: `Switched to branch '${actualTarget}'`,
        newState: { ...state, currentBranch: actualTarget },
      };
    }

    case 'push': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      return {
        output: `Pushing to origin/${state.currentBranch}...\nTo origin\n  * [new branch]  ${state.currentBranch} -> ${state.currentBranch}`,
        newState: state,
      };
    }

    case 'pull': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      return {
        output: 'Already up to date.',
        newState: state,
      };
    }

    case 'merge': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      if (rest.length === 0) {
        return { output: 'fatal: branch name required', newState: state };
      }
      const sourceBranch = rest[0];
      if (state.branches[sourceBranch] === undefined) {
        return { output: `merge: ${sourceBranch} - not something we can merge`, newState: state };
      }
      if (sourceBranch === state.currentBranch) {
        return { output: 'Already up to date.', newState: state };
      }

      const sourceBranchData = state.branches[sourceBranch];
      const currentBranchData = state.branches[state.currentBranch];

      const sourceCommits = sourceBranchData.commitHashes;
      const currentCommits = currentBranchData?.commitHashes ?? [];

      const mergedHashes = [...currentCommits];
      for (const h of sourceCommits) {
        if (!mergedHashes.includes(h)) {
          mergedHashes.push(h);
        }
      }

      const updatedBranch: GitBranch = {
        name: state.currentBranch,
        commitHashes: mergedHashes,
      };

      const newTracked = { ...state.trackedFiles };
      for (const h of sourceCommits) {
        const commit = state.commits[h];
        if (commit !== undefined) {
          for (const f of commit.files) {
            newTracked[f] = fileContents[f];
          }
        }
      }

      const mergeHash = generateHash();
      const mergeCommit: GitCommit = {
        hash: mergeHash,
        message: `Merge branch '${sourceBranch}' into ${state.currentBranch}`,
        timestamp: new Date().toISOString(),
        files: [...Object.keys(newTracked)],
      };

      return {
        output: `Merge made by the 'ort' strategy.\nMerge branch '${sourceBranch}'`,
        newState: {
          ...state,
          branches: { ...state.branches, [state.currentBranch]: updatedBranch },
          commits: { ...state.commits, [mergeHash]: mergeCommit },
          trackedFiles: newTracked,
        },
      };
    }

    case 'log': {
      if (!state.initialized) {
        return { output: 'fatal: not a git repository', newState: state };
      }
      const branch = state.branches[state.currentBranch];
      const hashes = branch?.commitHashes ?? [];
      if (hashes.length === 0) {
        return { output: 'fatal: your current branch has no commits yet', newState: state };
      }
      const lines: string[] = [];
      for (const h of [...hashes].reverse()) {
        const commit = state.commits[h];
        if (commit !== undefined) {
          lines.push(`commit ${commit.hash}`);
          lines.push(`Date:   ${commit.timestamp}`);
          lines.push(`\n    ${commit.message}\n`);
        }
      }
      return { output: lines.join('\n'), newState: state };
    }

    default:
      return { output: `git: '${subcommand}' is not a git command. See 'git help'.`, newState: state };
  }
}

/**
 * Reconstructs file contents for a branch by replaying all of its commits
 * in order and merging each commit's `fileContents`.  The last write to a
 * given path wins, which mirrors real-git semantics for a linear history.
 */
export function getFilesAtBranch(
  branchName: string,
  state: GitRepositoryState,
): Record<string, string> {
  const branch = state.branches[branchName];
  if (branch === undefined) return {};

  const result: Record<string, string> = {};
  for (const hash of branch.commitHashes) {
    const commit = state.commits[hash];
    if (commit !== undefined) {
      Object.assign(result, commit.fileContents);
    }
  }
  return result;
}

export { getCurrentCommitHash };
