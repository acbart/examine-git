import { useState, useEffect } from 'react';
import { FileExplorer } from './FileExplorer';
import { EditorPanel } from './EditorPanel';
import { RunPanel } from './RunPanel';
import { TerminalPanel } from './TerminalPanel';
import { SourceControlPanel } from './SourceControlPanel';
import { QuizPanel } from './QuizPanel';
import { useWorkspaceStore } from '../../store/workspaceStore';

const DESKTOP_BREAKPOINT = 768;

type MobilePanel = 'editor' | 'run' | 'terminal' | 'quiz';

export function DesktopWorkspace() {
  const { activeSidePanel, setActiveSidePanel, quizPanelOpen, setQuizPanelOpen } = useWorkspaceStore();
  const initialMobile = window.innerWidth < DESKTOP_BREAKPOINT;
  const [isMobile, setIsMobile] = useState(initialMobile);
  const [sidebarOpen, setSidebarOpen] = useState(!initialMobile);
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>('editor');

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < DESKTOP_BREAKPOINT;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
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
        <button
          className={`activity-btn ${quizPanelOpen ? 'active' : ''}`}
          onClick={() => setQuizPanelOpen(!quizPanelOpen)}
          title="Quiz"
        >
          📝
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
        {isMobile ? (
          <>
            <div className="mobile-panel-container">
              <div className={`mobile-panel-view${activeMobilePanel === 'editor' ? ' active' : ''}`}>
                <EditorPanel />
              </div>
              <div className={`mobile-panel-view${activeMobilePanel === 'run' ? ' active' : ''}`}>
                <RunPanel />
              </div>
              <div className={`mobile-panel-view${activeMobilePanel === 'terminal' ? ' active' : ''}`}>
                <TerminalPanel />
              </div>
              <div className={`mobile-panel-view${activeMobilePanel === 'quiz' ? ' active' : ''}`}>
                <QuizPanel />
              </div>
            </div>
            <div className="mobile-tab-bar">
              <button
                className={`mobile-tab-btn${activeMobilePanel === 'editor' ? ' active' : ''}`}
                onClick={() => setActiveMobilePanel('editor')}
              >
                📝 Editor
              </button>
              <button
                className={`mobile-tab-btn${activeMobilePanel === 'run' ? ' active' : ''}`}
                onClick={() => setActiveMobilePanel('run')}
              >
                ▶ Run
              </button>
              <button
                className={`mobile-tab-btn${activeMobilePanel === 'terminal' ? ' active' : ''}`}
                onClick={() => setActiveMobilePanel('terminal')}
              >
                $ Terminal
              </button>
              <button
                className={`mobile-tab-btn${activeMobilePanel === 'quiz' ? ' active' : ''}`}
                onClick={() => setActiveMobilePanel('quiz')}
              >
                📋 Quiz
              </button>
            </div>
          </>
        ) : (
          <div className="editor-quiz-area">
            <div className="editor-stack">
              <EditorPanel />
              <RunPanel />
              <TerminalPanel />
            </div>
            {quizPanelOpen && (
              <div className="quiz-right-panel">
                <QuizPanel />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
