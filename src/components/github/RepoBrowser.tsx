import { useGithubStore } from '../../features/github/githubStore';
import { useState } from 'react';

export function RepoBrowser() {
  const { remoteBranches } = useGithubStore();
  const branchNames = Object.keys(remoteBranches);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(
    branchNames.length > 0 ? (branchNames[0] ?? null) : null
  );

  if (branchNames.length === 0) {
    return (
      <div className="repo-browser">
        <div className="github-empty">
          <h3>No branches pushed yet</h3>
          <p>Run <code>git push</code> in the terminal to push your changes.</p>
        </div>
      </div>
    );
  }

  const activeBranch = selectedBranch !== null ? remoteBranches[selectedBranch] : undefined;
  const branchFiles = activeBranch !== undefined
    ? Object.values(activeBranch.files).filter((f): f is NonNullable<typeof f> => f !== undefined)
    : [];

  return (
    <div className="repo-browser">
      <div className="repo-header">
        <h3>Repository</h3>
        <div className="branch-selector">
          <label>Branch: </label>
          <select
            value={selectedBranch ?? ''}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branchNames.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="repo-files">
        {branchFiles.map((file) => (
          <div key={file.path} className="repo-file">
            <span className="repo-file-name">📄 {file.path}</span>
            <span className="repo-file-lang">{file.language}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
