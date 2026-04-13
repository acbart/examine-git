import { FileExplorer } from './FileExplorer';
import { EditorPanel } from './EditorPanel';
import { TerminalPanel } from './TerminalPanel';
import { SourceControlPanel } from './SourceControlPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function DesktopWorkspace() {
  const { activeSidePanel, setActiveSidePanel } = useWorkspaceStore();

  return (
    <div className="desktop-workspace">
      <div className="activity-bar">
        <button
          className={`activity-btn ${activeSidePanel === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveSidePanel('explorer')}
          title="Explorer"
        >
          📁
        </button>
        <button
          className={`activity-btn ${activeSidePanel === 'source-control' ? 'active' : ''}`}
          onClick={() => setActiveSidePanel('source-control')}
          title="Source Control"
        >
          🔀
        </button>
      </div>
      <div className="side-panel">
        {activeSidePanel === 'explorer' ? <FileExplorer /> : <SourceControlPanel />}
      </div>
      <div className="main-area">
        <EditorPanel />
        <TerminalPanel />
      </div>
    </div>
  );
}
