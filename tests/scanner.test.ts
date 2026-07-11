import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectSourceLanguage, scanFile, scanFiles, type ScannerFileSystem } from '../src/scanner/index.js';
import type { ProjectFile } from '../src/discovery/index.js';

const tempRoots: string[] = [];

const createTempProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-scanner-'));
  tempRoots.push(root);
  return root;
};

const createProjectFile = async (
  root: string,
  relativePath: string,
  contents: string,
): Promise<ProjectFile> => {
  const absolutePath = path.join(root, relativePath);
  await writeFile(absolutePath, contents);

  return toProjectFile(root, relativePath);
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('scanner', () => {
  it('scans one file', async () => {
    const root = await createTempProject();
    const projectFile = await createProjectFile(root, 'component.ts', 'export const value = 1;\n');

    const result = await scanFile(projectFile);

    expect(result.errors).toEqual([]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      path: projectFile.absolutePath,
      relativePath: 'component.ts',
      extension: 'ts',
      language: 'TypeScript',
      contents: 'export const value = 1;\n',
      size: Buffer.byteLength('export const value = 1;\n'),
    });
    expect(result.files[0]?.lastModified).toBeInstanceOf(Date);
  });

  it('scans multiple files', async () => {
    const root = await createTempProject();
    const first = await createProjectFile(root, 'first.js', 'console.log("first");');
    const second = await createProjectFile(root, 'second.jsx', 'export const Second = () => null;');

    const result = await scanFiles([first, second]);

    expect(result.errors).toEqual([]);
    expect(result.files.map((file) => file.relativePath)).toEqual(['first.js', 'second.jsx']);
    expect(result.files.map((file) => file.language)).toEqual(['JavaScript', 'JSX']);
  });

  it('handles empty file', async () => {
    const root = await createTempProject();
    const projectFile = await createProjectFile(root, 'empty.mjs', '');

    const result = await scanFile(projectFile);

    expect(result).toMatchObject({
      errors: [],
      files: [
        {
          contents: '',
          size: 0,
          language: 'ESM',
        },
      ],
    });
  });

  it('detects language', () => {
    expect(detectSourceLanguage('ts')).toBe('TypeScript');
    expect(detectSourceLanguage('.tsx')).toBe('TSX');
    expect(detectSourceLanguage('js')).toBe('JavaScript');
    expect(detectSourceLanguage('jsx')).toBe('JSX');
    expect(detectSourceLanguage('mjs')).toBe('ESM');
    expect(detectSourceLanguage('cjs')).toBe('CommonJS');
    expect(detectSourceLanguage('vue')).toBe('Unknown');
  });

  it('ignores unreadable files', async () => {
    const root = await createTempProject();
    const readable = toProjectFile(root, 'readable.ts');
    const unreadable = toProjectFile(root, 'unreadable.ts');
    const fileSystem: ScannerFileSystem = {
      async readFile(filePath) {
        if (filePath === unreadable.absolutePath) {
          throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
        }

        return 'export const ok = true;';
      },
      async stat() {
        return {
          size: Buffer.byteLength('export const ok = true;'),
          mtime: new Date('2026-01-01T00:00:00.000Z'),
        };
      },
    };

    const result = await scanFiles([readable, unreadable], { fileSystem });

    expect(result.files.map((file) => file.relativePath)).toEqual(['readable.ts']);
    expect(result.errors).toEqual([
      {
        path: unreadable.absolutePath,
        relativePath: 'unreadable.ts',
        code: 'EACCES',
        message: 'Unable to scan file "unreadable.ts": permission denied',
      },
    ]);
  });

  it('preserves ordering', async () => {
    const root = await createTempProject();
    const third = await createProjectFile(root, 'third.cjs', 'module.exports = {};');
    const first = await createProjectFile(root, 'first.tsx', 'export const First = () => null;');
    const second = await createProjectFile(root, 'second.js', 'console.log("second");');

    const result = await scanFiles([third, first, second]);

    expect(result.files.map((file) => file.relativePath)).toEqual([
      'third.cjs',
      'first.tsx',
      'second.js',
    ]);
  });
});

const toProjectFile = (root: string, relativePath: string): ProjectFile => {
  const absolutePath = path.join(root, relativePath);
  const extension = path.extname(relativePath).replace(/^\./, '').toLowerCase();

  return {
    absolutePath,
    relativePath,
    name: path.basename(relativePath),
    extension,
  };
};
