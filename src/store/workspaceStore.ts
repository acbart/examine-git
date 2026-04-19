import { create } from 'zustand';

export type WorkspaceType = 'desktop' | 'github';
export type SidePanel = 'explorer' | 'source-control';

export interface LineJumpRequest {
  path: string;
  line: number;
  /** Incremented each call so the same path+line can be re-requested */
  serial: number;
}

interface WorkspaceState {
  activeWorkspace: WorkspaceType;
  activeFilePath: string | null;
  openTabs: string[];
  dirtyFiles: string[];
  activeSidePanel: SidePanel;
  runFilePath: string | null;
  quizPanelOpen: boolean;
  lineJumpRequest: LineJumpRequest | null;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  setActiveSidePanel: (panel: SidePanel) => void;
  setRunFilePath: (path: string | null) => void;
  setQuizPanelOpen: (open: boolean) => void;
  requestLineJump: (path: string, line: number) => void;
  clearLineJump: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  activeWorkspace: 'desktop',
  activeFilePath: 'src/main.ts',
  openTabs: ['src/main.ts'],
  dirtyFiles: [],
  activeSidePanel: 'explorer',
  runFilePath: 'src/main.ts',
  quizPanelOpen: false,
  lineJumpRequest: null,
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
  setQuizPanelOpen: (open) => set({ quizPanelOpen: open }),
  requestLineJump: (path, line) =>
    set((state) => ({
      lineJumpRequest: { path, line, serial: (state.lineJumpRequest?.serial ?? 0) + 1 },
    })),
  clearLineJump: () => set({ lineJumpRequest: null }),
}));
