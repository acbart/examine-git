import { useGithubStore } from '../../features/github/githubStore';

export function DeployedSitePage() {
  const { remoteBranches } = useGithubStore();

  const mainBranch = remoteBranches['main'];
  const indexFile = mainBranch?.files['index.html'];

  if (mainBranch === undefined || indexFile === undefined) {
    return (
      <div className="deployed-site">
        <div className="github-empty">
          <h3>No deployment available</h3>
          <p>Push your <code>main</code> branch to see the deployed site.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deployed-site">
      <div className="deployed-header">
        <h3>Deployed Site</h3>
        <span className="deploy-status">● Live</span>
      </div>
      <iframe
        className="deployed-frame"
        srcDoc={indexFile.content}
        title="Deployed Site"
        sandbox="allow-scripts"
      />
    </div>
  );
}
