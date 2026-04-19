import { create } from 'zustand';

export type FileLanguage = 'typescript' | 'javascript' | 'python' | 'html' | 'css' | 'text';

export interface VirtualFile {
  path: string;
  name: string;
  content: string;
  language: FileLanguage;
  updatedAt: string;
}

interface FilesystemState {
  files: Record<string, VirtualFile | undefined>;
  readFile: (path: string) => VirtualFile | undefined;
  writeFile: (path: string, content: string) => void;
  resetFile: (path: string, content: string) => void;
  listFiles: () => VirtualFile[];
}

function detectLanguage(path: string): FileLanguage {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  return 'text';
}

function makeFile(path: string, content: string): VirtualFile {
  const parts = path.split('/');
  const name = parts[parts.length - 1] ?? path;
  return { path, name, content, language: detectLanguage(path), updatedAt: new Date().toISOString() };
}

export const INITIAL_FILES: Record<string, VirtualFile> = {
  'index.html': makeFile('index.html', `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>My Project</title>\n    <link rel="stylesheet" href="src/style.css" />\n  </head>\n  <body>\n    <h1>Hello, World!</h1>\n    <p>Welcome to my project.</p>\n    <script type="module" src="src/main.ts"></script>\n  </body>\n</html>`),
  'src/main.ts': makeFile('src/main.ts', `// Main entry point\nconst greeting: string = 'Hello, TypeScript!';\nconsole.log(greeting);\n\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n\nconsole.log(add(1, 2));\n`),
  'src/style.css': makeFile('src/style.css', `body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 2rem;\n  background: #f5f5f5;\n  color: #333;\n}\n\nh1 {\n  color: #007acc;\n}\n`),
  'src/app.py': makeFile('src/app.py', `#!/usr/bin/env python3\n"""Hello World application."""\n\n\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\n\nif __name__ == "__main__":\n    print(greet("World"))\n`),
  'README.md': makeFile('README.md', `# My Project\n\nA sample project for examine-git.\n\n## Getting Started\n\n1. Open \`index.html\` in a browser\n2. Edit \`src/main.ts\` to modify behavior\n3. Check \`src/app.py\` for the Python version\n`),
};

export const useFilesystemStore = create<FilesystemState>()((set, get) => ({
  files: { ...INITIAL_FILES },
  readFile: (path) => get().files[path],
  writeFile: (path, content) =>
    set((state) => {
      const existing = state.files[path];
      const updated = existing
        ? { ...existing, content, updatedAt: new Date().toISOString() }
        : makeFile(path, content);
      return { files: { ...state.files, [path]: updated } };
    }),
  resetFile: (path, content) =>
    set((state) => {
      const existing = state.files[path];
      const updated = existing
        ? { ...existing, content, updatedAt: new Date().toISOString() }
        : makeFile(path, content);
      return { files: { ...state.files, [path]: updated } };
    }),
  listFiles: () =>
    Object.values(get().files).filter((f): f is VirtualFile => f !== undefined),
}));
