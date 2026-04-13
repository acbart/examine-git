import { create } from 'zustand';
import type { VirtualFile } from '../filesystem/filesystemStore';

export interface PullRequest {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  status: 'open' | 'merged' | 'closed';
}

interface RemoteBranch {
  name: string;
  files: Record<string, VirtualFile | undefined>;
  lastPushedAt: string;
}

interface GithubState {
  remoteBranches: Record<string, RemoteBranch | undefined>;
  pullRequests: PullRequest[];
  nextPrId: number;
  pushBranch: (branchName: string, files: VirtualFile[]) => void;
  createPullRequest: (title: string, description: string, sourceBranch: string, targetBranch: string) => void;
  mergePullRequest: (id: number) => void;
}

export const useGithubStore = create<GithubState>()((set, get) => ({
  remoteBranches: {},
  pullRequests: [],
  nextPrId: 1,
  pushBranch: (branchName, files) => {
    const fileMap: Record<string, VirtualFile> = {};
    for (const f of files) {
      fileMap[f.path] = f;
    }
    const branch: RemoteBranch = {
      name: branchName,
      files: fileMap,
      lastPushedAt: new Date().toISOString(),
    };
    set((state) => ({
      remoteBranches: { ...state.remoteBranches, [branchName]: branch },
    }));
  },
  createPullRequest: (title, description, sourceBranch, targetBranch) => {
    const pr: PullRequest = {
      id: get().nextPrId,
      title,
      description,
      sourceBranch,
      targetBranch,
      createdAt: new Date().toISOString(),
      status: 'open',
    };
    set((state) => ({
      pullRequests: [...state.pullRequests, pr],
      nextPrId: state.nextPrId + 1,
    }));
  },
  mergePullRequest: (id) => {
    set((state) => ({
      pullRequests: state.pullRequests.map((pr) =>
        pr.id === id ? { ...pr, status: 'merged' as const } : pr
      ),
    }));
  },
}));
