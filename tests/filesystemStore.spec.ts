import {
    useFilesystemStore,
    INITIAL_FILES,
} from '../src/features/filesystem/filesystemStore';

function resetStore() {
    useFilesystemStore.setState({ files: { ...INITIAL_FILES } });
}

describe('filesystemStore', () => {
    beforeEach(resetStore);

    // ── readFile ──────────────────────────────────────────────────

    test('readFile returns an existing file', () => {
        const file = useFilesystemStore.getState().readFile('src/main.ts');
        expect(file).toBeDefined();
        expect(file?.path).toBe('src/main.ts');
        expect(file?.name).toBe('main.ts');
        expect(file?.language).toBe('typescript');
    });

    test('readFile returns undefined for a non-existent path', () => {
        expect(useFilesystemStore.getState().readFile('does/not/exist.ts')).toBeUndefined();
    });

    // ── writeFile ─────────────────────────────────────────────────

    test('writeFile updates content of an existing file', () => {
        const { writeFile, readFile } = useFilesystemStore.getState();
        writeFile('src/main.ts', '// updated');
        const file = readFile('src/main.ts');
        expect(file?.content).toBe('// updated');
    });

    test('writeFile creates a new file if it does not exist', () => {
        const { writeFile, readFile } = useFilesystemStore.getState();
        writeFile('src/newfile.ts', 'export const x = 1;');
        const file = readFile('src/newfile.ts');
        expect(file).toBeDefined();
        expect(file?.content).toBe('export const x = 1;');
        expect(file?.name).toBe('newfile.ts');
        expect(file?.language).toBe('typescript');
    });

    test('writeFile preserves other files when updating one', () => {
        const { writeFile, readFile } = useFilesystemStore.getState();
        writeFile('src/main.ts', '// changed');
        expect(readFile('src/style.css')).toBeDefined();
        expect(readFile('README.md')).toBeDefined();
    });

    test('writeFile updates updatedAt timestamp', () => {
        const { writeFile, readFile } = useFilesystemStore.getState();
        const before = readFile('src/main.ts')?.updatedAt ?? '';
        // Ensure some time passes
        const mockNow = new Date(Date.now() + 1000).toISOString();
        jest.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce(mockNow);
        writeFile('src/main.ts', '// new content');
        const after = readFile('src/main.ts')?.updatedAt ?? '';
        expect(after).toBe(mockNow);
        expect(after).not.toBe(before);
        jest.restoreAllMocks();
    });

    // ── listFiles ─────────────────────────────────────────────────

    test('listFiles returns all initial files', () => {
        const files = useFilesystemStore.getState().listFiles();
        const paths = files.map((f) => f.path);
        expect(paths).toContain('src/main.ts');
        expect(paths).toContain('src/style.css');
        expect(paths).toContain('src/app.py');
        expect(paths).toContain('index.html');
        expect(paths).toContain('README.md');
    });

    test('listFiles includes a newly written file', () => {
        const { writeFile, listFiles } = useFilesystemStore.getState();
        writeFile('src/extra.js', 'console.log("hi")');
        const paths = listFiles().map((f) => f.path);
        expect(paths).toContain('src/extra.js');
    });

    // ── language detection ────────────────────────────────────────

    test.each([
        ['foo.ts', 'typescript'],
        ['foo.tsx', 'typescript'],
        ['foo.js', 'javascript'],
        ['foo.jsx', 'javascript'],
        ['foo.py', 'python'],
        ['foo.html', 'html'],
        ['foo.css', 'css'],
        ['foo.txt', 'text'],
        ['Makefile', 'text'],
    ])('detectLanguage for %s → %s', (path, expectedLang) => {
        const { writeFile, readFile } = useFilesystemStore.getState();
        writeFile(path, '');
        expect(readFile(path)?.language).toBe(expectedLang);
    });
});
