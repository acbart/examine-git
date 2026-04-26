import { useEffect, useRef, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import type { Extension } from '@codemirror/state';
import { useFilesystemStore } from '../../features/filesystem/filesystemStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useQuizStore } from '../../features/quiz/quizStore';
import type { FileLanguage } from '../../features/filesystem/filesystemStore';

function getLanguageExtension(language: FileLanguage): Extension {
  switch (language) {
    case 'typescript': return javascript({ typescript: true, jsx: true });
    case 'javascript': return javascript({ jsx: true });
    case 'python': return python();
    case 'html': return html();
    case 'css': return css();
    default: return [];
  }
}

function applyLineJump(view: EditorView, line: number) {
  const lineCount = view.state.doc.lines;
  const targetLine = Math.max(1, Math.min(line, lineCount));
  const pos = view.state.doc.line(targetLine).from;
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'center' }),
  });
}

export function EditorPanel() {
  const { activeFilePath, openTabs, closeTab, dirtyFiles, markDirty, markClean, pendingLineJump, clearLineJump } = useWorkspaceStore();
  const { readFile, writeFile } = useFilesystemStore();
  const openFile = useWorkspaceStore((s) => s.openFile);
  const { activeTaskId, taskStates, resumeTask } = useQuizStore();

  // Compute whether the editor should be locked (a task is paused).
  const pausedTaskId =
    activeTaskId === null
      ? (Object.keys(taskStates).find(
          (id) => taskStates[id]?.status === 'in-progress',
        ) ?? null)
      : null;
  const editorLocked = pausedTaskId !== null;

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const activePathRef = useRef<string | null>(null);

  const saveCurrentFile = useCallback(() => {
    const view = viewRef.current;
    const path = activePathRef.current;
    if (view === null || path === null) return;
    const content = view.state.doc.toString();
    writeFile(path, content);
    markClean(path);
  }, [writeFile, markClean]);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (container === null) return;

    const activeFile = activeFilePath !== null ? readFile(activeFilePath) : undefined;
    const doc = activeFile?.content ?? '';
    const language = activeFile?.language ?? 'text';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const path = activePathRef.current;
        if (path !== null) markDirty(path);
      }
    });

    const saveKeymap = keymap.of([
      {
        key: 'Ctrl-s',
        mac: 'Cmd-s',
        run: () => {
          saveCurrentFile();
          return true;
        },
      },
    ]);

    const extensions: Extension[] = [
      basicSetup,
      oneDark,
      getLanguageExtension(language),
      updateListener,
      saveKeymap,
      EditorState.readOnly.of(editorLocked),
    ];

    const state = EditorState.create({ doc, extensions });
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;
    activePathRef.current = activeFilePath;

    // Apply any pending line jump for the newly opened file.
    const { pendingLineJump: jump, clearLineJump: clearJump } = useWorkspaceStore.getState();
    if (jump && jump.path === activeFilePath) {
      applyLineJump(view, jump.line);
      clearJump();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [activeFilePath, editorLocked, readFile, markDirty, saveCurrentFile]);

  // Handle line jumps for the already-active file (no editor recreation needed).
  useEffect(() => {
    if (!pendingLineJump || pendingLineJump.path !== activeFilePath) return;
    const view = viewRef.current;
    if (!view) return;
    applyLineJump(view, pendingLineJump.line);
    clearLineJump();
  }, [pendingLineJump, activeFilePath, clearLineJump]);

  return (
    <div className="editor-panel">
      <div className="editor-top-bar">
        <div className="editor-tabs">
          {openTabs.map((tabPath) => {
            const file = readFile(tabPath);
            const isDirty = dirtyFiles.includes(tabPath);
            return (
              <div
                key={tabPath}
                className={`editor-tab ${activeFilePath === tabPath ? 'active' : ''}`}
                onClick={() => openFile(tabPath)}
              >
                <span className="tab-name">{file?.name ?? tabPath}</span>
                {isDirty && <span className="tab-dirty">●</span>}
                <button
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tabPath); }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        {activeFilePath !== null && (
          <button
            className={`editor-save-btn${dirtyFiles.includes(activeFilePath) ? ' dirty' : ''}`}
            onClick={saveCurrentFile}
            title="Save (Ctrl+S)"
          >
            💾
          </button>
        )}
      </div>
      {activeFilePath !== null ? (
        <div className="editor-content-wrapper">
          {editorLocked && (
            <div className="editor-lock-banner">
              ⏸ Editor is paused while task is suspended.{' '}
              <button
                className="editor-lock-resume-btn"
                onClick={() => resumeTask(pausedTaskId)}
              >
                Resume task to edit
              </button>
            </div>
          )}
          <div className="editor-content" ref={editorContainerRef} />
        </div>
      ) : (
        <div className="editor-empty">
          <p>Open a file from the Explorer to start editing</p>
        </div>
      )}
    </div>
  );
}
