import { useState } from 'react';
import { useGithubStore } from '../../features/github/githubStore';
import { useGitStore } from '../../features/git/gitStore';

export function PullRequestPage() {
  const { pullRequests, createPullRequest, mergePullRequest, remoteBranches } = useGithubStore();
  const { repo } = useGitStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceBranch, setSourceBranch] = useState(repo.currentBranch);
  const [showForm, setShowForm] = useState(false);

  const remoteBranchNames = Object.keys(remoteBranches);

  function handleCreate() {
    if (title.trim() === '') return;
    createPullRequest(title.trim(), description.trim(), sourceBranch, 'main');
    setTitle('');
    setDescription('');
    setShowForm(false);
  }

  return (
    <div className="pr-page">
      <div className="pr-header">
        <h3>Pull Requests</h3>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New Pull Request'}
        </button>
      </div>

      {showForm && (
        <div className="pr-form">
          <h4>Create Pull Request</h4>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pull request title"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your changes"
              rows={4}
            />
          </div>
          <div className="form-group">
            <label>From branch</label>
            <select value={sourceBranch} onChange={(e) => setSourceBranch(e.target.value)}>
              {remoteBranchNames.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Into branch: <strong>main</strong></label>
          </div>
          <button className="btn-primary" onClick={handleCreate}>
            Create Pull Request
          </button>
        </div>
      )}

      <div className="pr-list">
        {pullRequests.length === 0 && !showForm && (
          <div className="github-empty">
            <p>No pull requests yet. Push a branch and create a PR.</p>
          </div>
        )}
        {pullRequests.map((pr) => (
          <div key={pr.id} className={`pr-item ${pr.status}`}>
            <div className="pr-item-header">
              <span className={`pr-status-badge ${pr.status}`}>{pr.status}</span>
              <span className="pr-title">#{pr.id} {pr.title}</span>
            </div>
            <div className="pr-item-meta">
              {pr.sourceBranch} → {pr.targetBranch} · {new Date(pr.createdAt).toLocaleDateString()}
            </div>
            {pr.description.length > 0 && <div className="pr-description">{pr.description}</div>}
            {pr.status === 'open' && (
              <button className="btn-merge" onClick={() => mergePullRequest(pr.id)}>
                Merge
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
