import { useState } from 'react';
import { RepoBrowser } from './RepoBrowser';
import { PullRequestPage } from './PullRequestPage';
import { DeployedSitePage } from './DeployedSitePage';

type GithubPage = 'repository' | 'pull-requests' | 'deployed';

export function GitHubWorkspace() {
  const [activePage, setActivePage] = useState<GithubPage>('repository');

  return (
    <div className="github-workspace">
      <div className="github-nav">
        <button
          className={`github-nav-btn ${activePage === 'repository' ? 'active' : ''}`}
          onClick={() => setActivePage('repository')}
        >
          Repository
        </button>
        <button
          className={`github-nav-btn ${activePage === 'pull-requests' ? 'active' : ''}`}
          onClick={() => setActivePage('pull-requests')}
        >
          Pull Requests
        </button>
        <button
          className={`github-nav-btn ${activePage === 'deployed' ? 'active' : ''}`}
          onClick={() => setActivePage('deployed')}
        >
          Deployed Site
        </button>
      </div>
      <div className="github-content">
        {activePage === 'repository' && <RepoBrowser />}
        {activePage === 'pull-requests' && <PullRequestPage />}
        {activePage === 'deployed' && <DeployedSitePage />}
      </div>
    </div>
  );
}
