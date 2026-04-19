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

const EDITOR_MOUNT_DELAY_MS = 50;

export function EditorPanel() {
  const { activeFilePath, openTabs, closeTab, dirtyFiles, markDirty, markClean, lineJumpRequest, clearLineJump } = useWorkspaceStore();
  const { readFile, writeFile } = useFilesystemStore();
  const openFile = useWorkspaceStore((s) => s.openFile);

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
    ];

    const state = EditorState.create({ doc, extensions });
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;
    activePathRef.current = activeFilePath;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [activeFilePath, readFile, markDirty, saveCurrentFile]);

  // Handle line jump requests from the quiz panel
  useEffect(() => {
    if (lineJumpRequest === null) return;
    const { path, line } = lineJumpRequest;
    const view = viewRef.current;
    // Open the file if it isn't already active
    if (path !== activeFilePath) {
      openFile(path);
    }
    const timer = setTimeout(() => {
      const v = viewRef.current;
      if (v === null) return;
      const doc = v.state.doc;
      const targetLine = Math.max(1, Math.min(line, doc.lines));
      const lineObj = doc.line(targetLine);
      v.dispatch({
        selection: { anchor: lineObj.from },
        effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' }),
      });
      v.focus();
    }, EDITOR_MOUNT_DELAY_MS);
    clearLineJump();
    return () => clearTimeout(timer);
  }, [lineJumpRequest, activeFilePath, openFile, clearLineJump]);

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
        <div className="editor-content" ref={editorContainerRef} />
      ) : (
        <div className="editor-empty">
          <p>Open a file from the Explorer to start editing</p>
        </div>
      )}
    </div>
  );
}
