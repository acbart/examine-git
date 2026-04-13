import { useFilesystemStore } from '../../features/filesystem/filesystemStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function FileExplorer() {
  const { listFiles } = useFilesystemStore();
  const { openFile, activeFilePath } = useWorkspaceStore();

  const files = listFiles().sort((a, b) => a.path.localeCompare(b.path));

  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      folders.add(parts.slice(0, -1).join('/'));
    }
  }

  const rootFiles = files.filter((f) => !f.path.includes('/'));
  const nestedFiles = files.filter((f) => f.path.includes('/'));

  const folderMap: Record<string, typeof files> = {};
  for (const folder of folders) {
    folderMap[folder] = nestedFiles.filter((f) => f.path.startsWith(folder + '/'));
  }

  return (
    <div className="file-explorer">
      <div className="panel-header">EXPLORER</div>
      <div className="file-tree">
        {Array.from(folders).sort().map((folder) => (
          <div key={folder} className="folder-group">
            <div className="folder-item">📁 {folder}</div>
            {(folderMap[folder] ?? []).map((file) => (
              <div
                key={file.path}
                className={`file-item nested ${activeFilePath === file.path ? 'active' : ''}`}
                onClick={() => openFile(file.path)}
              >
                📄 {file.name}
              </div>
            ))}
          </div>
        ))}
        {rootFiles.map((file) => (
          <div
            key={file.path}
            className={`file-item ${activeFilePath === file.path ? 'active' : ''}`}
            onClick={() => openFile(file.path)}
          >
            📄 {file.name}
          </div>
        ))}
      </div>
    </div>
  );
}
