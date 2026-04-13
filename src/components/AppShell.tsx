import { useWorkspaceStore } from '../store/workspaceStore';
import { DesktopWorkspace } from './desktop/DesktopWorkspace';
import { GitHubWorkspace } from './github/GitHubWorkspace';
import './AppShell.css';

export function AppShell() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <span className="app-title">examine-git</span>
        <div className="workspace-tabs">
          <button
            className={`workspace-tab ${activeWorkspace === 'desktop' ? 'active' : ''}`}
            onClick={() => setActiveWorkspace('desktop')}
          >
            Desktop
          </button>
          <button
            className={`workspace-tab ${activeWorkspace === 'github' ? 'active' : ''}`}
            onClick={() => setActiveWorkspace('github')}
          >
            GitHub
          </button>
        </div>
      </div>
      <div className="app-content">
        {activeWorkspace === 'desktop' ? <DesktopWorkspace /> : <GitHubWorkspace />}
      </div>
    </div>
  );
}
