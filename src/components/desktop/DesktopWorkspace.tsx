import { useState, useEffect } from 'react';
import { FileExplorer } from './FileExplorer';
import { EditorPanel } from './EditorPanel';
import { RunPanel } from './RunPanel';
import { TerminalPanel } from './TerminalPanel';
import { SourceControlPanel } from './SourceControlPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';

const DESKTOP_BREAKPOINT = 768;

export function DesktopWorkspace() {
  const { activeSidePanel, setActiveSidePanel } = useWorkspaceStore();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT);

  useEffect(() => {
    function handleResize() {
      setSidebarOpen(window.innerWidth >= DESKTOP_BREAKPOINT);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleActivityClick(panel: 'explorer' | 'source-control') {
    if (activeSidePanel === panel && sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setActiveSidePanel(panel);
      setSidebarOpen(true);
    }
  }

  return (
    <div className="desktop-workspace">
      <div className="activity-bar">
        <button
          className={`activity-btn ${activeSidePanel === 'explorer' && sidebarOpen ? 'active' : ''}`}
          onClick={() => handleActivityClick('explorer')}
          title="Explorer"
        >
          📁
        </button>
        <button
          className={`activity-btn ${activeSidePanel === 'source-control' && sidebarOpen ? 'active' : ''}`}
          onClick={() => handleActivityClick('source-control')}
          title="Source Control"
        >
          🔀
        </button>
      </div>
      {sidebarOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
          <div className="side-panel">
            {activeSidePanel === 'explorer' ? <FileExplorer /> : <SourceControlPanel />}
          </div>
        </>
      )}
      <div className="main-area">
        <EditorPanel />
        <RunPanel />
        <TerminalPanel />
      </div>
    </div>
  );
}
