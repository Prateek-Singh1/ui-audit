import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverProjectFiles,
  FileDiscoveryEngine,
  FileFilter,
  type DiscoveryFileSystem,
} from '../src/discovery/index.js';

const tempRoots: string[] = [];

const createTempProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-discovery-'));
  tempRoots.push(root);
  return root;
};

const createFile = async (root: string, relativePath: string): Promise<void> => {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, '');
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FileDiscoveryEngine', () => {
  it('recursively discovers project files with typed metadata', async () => {
    const root = await createTempProject();
    await createFile(root, 'src/App.tsx');
    await createFile(root, 'src/components/Button.vue');
    await createFile(root, 'index.html');

    const files = await discoverProjectFiles(root);

    expect(files).toEqual([
      {
        absolutePath: path.join(root, 'index.html'),
        relativePath: 'index.html',
        name: 'index.html',
        extension: 'html',
      },
      {
        absolutePath: path.join(root, 'src/App.tsx'),
        relativePath: path.join('src', 'App.tsx'),
        name: 'App.tsx',
        extension: 'tsx',
      },
      {
        absolutePath: path.join(root, 'src/components/Button.vue'),
        relativePath: path.join('src', 'components', 'Button.vue'),
        name: 'Button.vue',
        extension: 'vue',
      },
    ]);
  });

  it('ignores common generated and dependency directories', async () => {
    const root = await createTempProject();
    await createFile(root, 'src/App.tsx');
    await Promise.all(
      [
        'node_modules/pkg/index.js',
        'dist/bundle.js',
        'build/output.js',
        'coverage/report.html',
        '.git/config',
        '.next/server.js',
        '.cache/cache.js',
        'storybook-static/index.html',
      ].map((relativePath) => createFile(root, relativePath)),
    );

    const files = await discoverProjectFiles(root);

    expect(files.map((file) => file.relativePath)).toEqual([path.join('src', 'App.tsx')]);
  });

  it('ignores hidden files but still traverses non-ignored hidden directories', async () => {
    const root = await createTempProject();
    await createFile(root, '.DS_Store');
    await createFile(root, '.env');
    await createFile(root, '.storybook/main.ts');

    const files = await discoverProjectFiles(root);

    expect(files.map((file) => file.relativePath)).toEqual([path.join('.storybook', 'main.ts')]);
  });

  it('supports extension-based filtering without changing traversal', async () => {
    const root = await createTempProject();
    await createFile(root, 'src/App.TSX');
    await createFile(root, 'src/styles.css');
    await createFile(root, 'index.html');

    const files = await discoverProjectFiles(root, {
      filterOptions: { includeExtensions: ['tsx', '.html'] },
    });

    expect(files.map((file) => file.relativePath)).toEqual([
      'index.html',
      path.join('src', 'App.TSX'),
    ]);
  });

  it('allows custom directory ignore policy through FileFilter', async () => {
    const root = await createTempProject();
    await createFile(root, 'examples/Fixture.tsx');
    await createFile(root, 'src/App.tsx');

    const files = await discoverProjectFiles(root, {
      filter: new FileFilter({ ignoredDirectoryNames: ['examples'] }),
    });

    expect(files.map((file) => file.relativePath)).toEqual([path.join('src', 'App.tsx')]);
  });

  it('throws a descriptive error when the project root is not a directory', async () => {
    const root = await createTempProject();
    const filePath = path.join(root, 'package.json');
    await writeFile(filePath, '{}');

    await expect(discoverProjectFiles(filePath)).rejects.toThrow(
      `Project root must be a directory: ${filePath}`,
    );
  });

  it('can be tested with an injected filesystem', async () => {
    const fileSystem: DiscoveryFileSystem = {
      async isDirectory(directoryPath) {
        return directoryPath === path.resolve('/virtual');
      },
      async readdir(directoryPath) {
        if (directoryPath === path.resolve('/virtual')) {
          return [
            fileEntry('b.tsx'),
            directoryEntry('node_modules'),
            directoryEntry('src'),
            fileEntry('a.html'),
          ];
        }

        if (directoryPath === path.join(path.resolve('/virtual'), 'src')) {
          return [fileEntry('App.vue')];
        }

        throw new Error(`Unexpected directory: ${directoryPath}`);
      },
    };

    const engine = new FileDiscoveryEngine({ fileSystem });

    await expect(engine.discover('/virtual')).resolves.toEqual([
      {
        absolutePath: path.join(path.resolve('/virtual'), 'a.html'),
        relativePath: 'a.html',
        name: 'a.html',
        extension: 'html',
      },
      {
        absolutePath: path.join(path.resolve('/virtual'), 'b.tsx'),
        relativePath: 'b.tsx',
        name: 'b.tsx',
        extension: 'tsx',
      },
      {
        absolutePath: path.join(path.resolve('/virtual'), 'src', 'App.vue'),
        relativePath: path.join('src', 'App.vue'),
        name: 'App.vue',
        extension: 'vue',
      },
    ]);
  });
});

const fileEntry = (name: string) => ({
  name,
  isDirectory: () => false,
  isFile: () => true,
});

const directoryEntry = (name: string) => ({
  name,
  isDirectory: () => true,
  isFile: () => false,
});
