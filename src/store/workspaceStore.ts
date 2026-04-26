import { create } from 'zustand';

export type WorkspaceType = 'desktop' | 'github';
export type SidePanel = 'explorer' | 'source-control';

export interface LineJump {
  path: string;
  line: number;
}

interface WorkspaceState {
  activeWorkspace: WorkspaceType;
  activeFilePath: string | null;
  openTabs: string[];
  dirtyFiles: string[];
  activeSidePanel: SidePanel;
  runFilePath: string | null;
  quizPanelOpen: boolean;
  pendingLineJump: LineJump | null;
  /**
   * When true the quiz panel shows git-aware terminology (branch names, commit
   * hashes, "Push Branch" etc.).  When false a friendlier novice mode is shown.
   */
  preferExpertMode: boolean;
  setActiveWorkspace: (workspace: WorkspaceType) => void;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  setActiveSidePanel: (panel: SidePanel) => void;
  setRunFilePath: (path: string | null) => void;
  toggleQuizPanel: () => void;
  requestLineJump: (path: string, line: number) => void;
  clearLineJump: () => void;
  toggleExpertMode: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  activeWorkspace: 'desktop',
  activeFilePath: 'src/main.ts',
  openTabs: ['src/main.ts'],
  dirtyFiles: [],
  activeSidePanel: 'explorer',
  runFilePath: 'src/main.ts',
  quizPanelOpen: true,
  pendingLineJump: null,
  preferExpertMode: false,
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
  toggleQuizPanel: () => set((state) => ({ quizPanelOpen: !state.quizPanelOpen })),
  requestLineJump: (path, line) => set({ pendingLineJump: { path, line } }),
  clearLineJump: () => set({ pendingLineJump: null }),
  toggleExpertMode: () => set((state) => ({ preferExpertMode: !state.preferExpertMode })),
}));
