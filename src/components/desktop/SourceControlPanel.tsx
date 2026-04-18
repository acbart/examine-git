import { useGitStore } from '../../features/git/gitStore';
import { useFilesystemStore, type VirtualFile } from '../../features/filesystem/filesystemStore';

export function SourceControlPanel() {
  const { repo } = useGitStore();
  const { files } = useFilesystemStore();

  const allFiles = Object.values(files).filter((f): f is VirtualFile => f !== undefined);

  const modified: string[] = [];
  const untracked: string[] = [];

  for (const file of allFiles) {
    if (repo.stagedFiles.includes(file.path)) continue;
    const trackedContent = repo.trackedFiles[file.path];
    if (trackedContent === undefined) {
      untracked.push(file.path);
    } else if (files[file.path]?.content !== trackedContent) {
      modified.push(file.path);
    }
  }

  return (
    <div className="source-control-panel">
      <div className="panel-header">SOURCE CONTROL</div>
      <div className="sc-branch">Branch: <strong>{repo.currentBranch}</strong></div>

      {repo.stagedFiles.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-title">Staged Changes ({repo.stagedFiles.length})</div>
          {repo.stagedFiles.map((f) => (
            <div key={f} className="sc-file staged">{f}</div>
          ))}
        </div>
      )}

      {modified.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-title">Changes ({modified.length})</div>
          {modified.map((f) => (
            <div key={f} className="sc-file modified">{f}</div>
          ))}
        </div>
      )}

      {untracked.length > 0 && (
        <div className="sc-section">
          <div className="sc-section-title">Untracked ({untracked.length})</div>
          {untracked.map((f) => (
            <div key={f} className="sc-file untracked">{f}</div>
          ))}
        </div>
      )}

      {repo.stagedFiles.length === 0 && modified.length === 0 && untracked.length === 0 && (
        <div className="sc-clean">No changes</div>
      )}
    </div>
  );
}
