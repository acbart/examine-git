import { create } from 'zustand';

export type WorkspaceType = 'desktop' | 'github';
export type SidePanel = 'explorer' | 'source-control';

interface WorkspaceState {
  activeWorkspace: WorkspaceType;
  activeFilePath: string | null;
  openTabs: string[];
  dirtyFiles: string[];
  activeSidePanel: SidePanel;
  runFilePath: string | null;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  setActiveSidePanel: (panel: SidePanel) => void;
  setRunFilePath: (path: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  activeWorkspace: 'desktop',
  activeFilePath: 'src/main.ts',
  openTabs: ['src/main.ts'],
  dirtyFiles: [],
  activeSidePanel: 'explorer',
  runFilePath: 'src/main.ts',
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  openFile: (path) =>
    set((state) => ({
      activeFilePath: path,
      openTabs: state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path],
    })),
  closeTab: (path) =>
    set((state) => {
      const newTabs = state.openTabs.filter((t) => t !== path);
      const newActive =
        state.activeFilePath === path
          ? (newTabs[newTabs.length - 1] ?? null)
          : state.activeFilePath;
      return { openTabs: newTabs, activeFilePath: newActive, dirtyFiles: state.dirtyFiles.filter((f) => f !== path) };
    }),
  markDirty: (path) =>
    set((state) => ({
      dirtyFiles: state.dirtyFiles.includes(path) ? state.dirtyFiles : [...state.dirtyFiles, path],
    })),
  markClean: (path) =>
    set((state) => ({ dirtyFiles: state.dirtyFiles.filter((f) => f !== path) })),
  setActiveSidePanel: (panel) => set({ activeSidePanel: panel }),
  setRunFilePath: (path) => set({ runFilePath: path }),
}));
