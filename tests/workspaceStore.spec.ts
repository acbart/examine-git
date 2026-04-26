import { useWorkspaceStore } from '../src/store/workspaceStore';

const INITIAL_STATE = {
    activeWorkspace: 'desktop' as const,
    activeFilePath: 'src/main.ts',
    openTabs: ['src/main.ts'],
    dirtyFiles: [],
    activeSidePanel: 'explorer' as const,
    runFilePath: 'src/main.ts',
    quizPanelOpen: true,
    pendingLineJump: null,
};

function resetStore() {
    useWorkspaceStore.setState(INITIAL_STATE);
}

describe('workspaceStore', () => {
    beforeEach(resetStore);

    // ── setActiveWorkspace ────────────────────────────────────────

    test('setActiveWorkspace switches to github', () => {
        useWorkspaceStore.getState().setActiveWorkspace('github');
        expect(useWorkspaceStore.getState().activeWorkspace).toBe('github');
    });

    test('setActiveWorkspace switches back to desktop', () => {
        useWorkspaceStore.getState().setActiveWorkspace('github');
        useWorkspaceStore.getState().setActiveWorkspace('desktop');
        expect(useWorkspaceStore.getState().activeWorkspace).toBe('desktop');
    });

    // ── openFile ──────────────────────────────────────────────────

    test('openFile sets activeFilePath', () => {
        useWorkspaceStore.getState().openFile('src/app.py');
        expect(useWorkspaceStore.getState().activeFilePath).toBe('src/app.py');
    });

    test('openFile adds a new tab if not already open', () => {
        useWorkspaceStore.getState().openFile('src/app.py');
        expect(useWorkspaceStore.getState().openTabs).toContain('src/app.py');
        expect(useWorkspaceStore.getState().openTabs).toHaveLength(2);
    });

    test('openFile does not duplicate tab if already open', () => {
        useWorkspaceStore.getState().openFile('src/main.ts');
        expect(useWorkspaceStore.getState().openTabs).toHaveLength(1);
    });

    // ── closeTab ──────────────────────────────────────────────────

    test('closeTab removes the tab from openTabs', () => {
        useWorkspaceStore.getState().openFile('src/app.py');
        useWorkspaceStore.getState().closeTab('src/app.py');
        expect(useWorkspaceStore.getState().openTabs).not.toContain('src/app.py');
    });

    test('closeTab updates activeFilePath to last remaining tab when closing active tab', () => {
        useWorkspaceStore.getState().openFile('src/app.py');
        useWorkspaceStore.getState().openFile('src/app.py'); // already open, no-op
        useWorkspaceStore.getState().closeTab('src/app.py');
        expect(useWorkspaceStore.getState().activeFilePath).toBe('src/main.ts');
    });

    test('closeTab sets activeFilePath to null when last tab is closed', () => {
        useWorkspaceStore.getState().closeTab('src/main.ts');
        expect(useWorkspaceStore.getState().activeFilePath).toBeNull();
        expect(useWorkspaceStore.getState().openTabs).toHaveLength(0);
    });

    test('closeTab does not change activeFilePath when closing a non-active tab', () => {
        useWorkspaceStore.getState().openFile('src/app.py');
        // Active is still src/main.ts (opened first)
        useWorkspaceStore.setState({ activeFilePath: 'src/main.ts' });
        useWorkspaceStore.getState().closeTab('src/app.py');
        expect(useWorkspaceStore.getState().activeFilePath).toBe('src/main.ts');
    });

    test('closeTab also removes from dirtyFiles', () => {
        useWorkspaceStore.getState().markDirty('src/main.ts');
        useWorkspaceStore.getState().closeTab('src/main.ts');
        expect(useWorkspaceStore.getState().dirtyFiles).not.toContain('src/main.ts');
    });

    // ── markDirty / markClean ─────────────────────────────────────

    test('markDirty adds a file to dirtyFiles', () => {
        useWorkspaceStore.getState().markDirty('src/main.ts');
        expect(useWorkspaceStore.getState().dirtyFiles).toContain('src/main.ts');
    });

    test('markDirty does not duplicate entries', () => {
        useWorkspaceStore.getState().markDirty('src/main.ts');
        useWorkspaceStore.getState().markDirty('src/main.ts');
        expect(useWorkspaceStore.getState().dirtyFiles).toHaveLength(1);
    });

    test('markClean removes a file from dirtyFiles', () => {
        useWorkspaceStore.getState().markDirty('src/main.ts');
        useWorkspaceStore.getState().markClean('src/main.ts');
        expect(useWorkspaceStore.getState().dirtyFiles).not.toContain('src/main.ts');
    });

    test('markClean is a no-op when file is not dirty', () => {
        useWorkspaceStore.getState().markClean('src/main.ts');
        expect(useWorkspaceStore.getState().dirtyFiles).toHaveLength(0);
    });

    // ── setActiveSidePanel ────────────────────────────────────────

    test('setActiveSidePanel switches panel', () => {
        useWorkspaceStore.getState().setActiveSidePanel('source-control');
        expect(useWorkspaceStore.getState().activeSidePanel).toBe('source-control');
    });

    // ── setRunFilePath ────────────────────────────────────────────

    test('setRunFilePath updates runFilePath', () => {
        useWorkspaceStore.getState().setRunFilePath('src/app.py');
        expect(useWorkspaceStore.getState().runFilePath).toBe('src/app.py');
    });

    test('setRunFilePath can set to null', () => {
        useWorkspaceStore.getState().setRunFilePath(null);
        expect(useWorkspaceStore.getState().runFilePath).toBeNull();
    });

    // ── toggleQuizPanel ───────────────────────────────────────────

    test('toggleQuizPanel closes an open panel', () => {
        useWorkspaceStore.setState({ quizPanelOpen: true });
        useWorkspaceStore.getState().toggleQuizPanel();
        expect(useWorkspaceStore.getState().quizPanelOpen).toBe(false);
    });

    test('toggleQuizPanel opens a closed panel', () => {
        useWorkspaceStore.setState({ quizPanelOpen: false });
        useWorkspaceStore.getState().toggleQuizPanel();
        expect(useWorkspaceStore.getState().quizPanelOpen).toBe(true);
    });

    // ── requestLineJump / clearLineJump ───────────────────────────

    test('requestLineJump sets pendingLineJump', () => {
        useWorkspaceStore.getState().requestLineJump('src/main.ts', 5);
        expect(useWorkspaceStore.getState().pendingLineJump).toEqual({
            path: 'src/main.ts',
            line: 5,
        });
    });

    test('clearLineJump resets pendingLineJump to null', () => {
        useWorkspaceStore.getState().requestLineJump('src/main.ts', 5);
        useWorkspaceStore.getState().clearLineJump();
        expect(useWorkspaceStore.getState().pendingLineJump).toBeNull();
    });

    test('requestLineJump overwrites a previous jump', () => {
        useWorkspaceStore.getState().requestLineJump('src/main.ts', 5);
        useWorkspaceStore.getState().requestLineJump('src/app.py', 10);
        expect(useWorkspaceStore.getState().pendingLineJump).toEqual({
            path: 'src/app.py',
            line: 10,
        });
    });
});
