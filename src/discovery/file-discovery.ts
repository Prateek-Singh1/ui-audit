import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { FileFilter, type FileFilterOptions, getExtension } from './file-filter.js';
import type { ProjectFile } from './project-file.js';

interface DirectoryEntry {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface DiscoveryFileSystem {
  readdir(directoryPath: string): Promise<readonly DirectoryEntry[]>;
  isDirectory(directoryPath: string): Promise<boolean>;
}

export interface FileDiscoveryOptions {
  readonly filter?: FileFilter;
  readonly fileSystem?: DiscoveryFileSystem;
  readonly filterOptions?: FileFilterOptions;
}

const nodeFileSystem: DiscoveryFileSystem = {
  async readdir(directoryPath: string): Promise<readonly DirectoryEntry[]> {
    return readdir(directoryPath, { withFileTypes: true });
  },
  async isDirectory(directoryPath: string): Promise<boolean> {
    const stats = await stat(directoryPath);
    return stats.isDirectory();
  },
};

/**
 * Recursively discovers project files that may later be parsed or audited.
 */
export class FileDiscoveryEngine {
  private readonly filter: FileFilter;
  private readonly fileSystem: DiscoveryFileSystem;

  constructor(options: FileDiscoveryOptions = {}) {
    this.filter = options.filter ?? new FileFilter(options.filterOptions);
    this.fileSystem = options.fileSystem ?? nodeFileSystem;
  }

  async discover(projectRoot: string): Promise<readonly ProjectFile[]> {
    const absoluteRoot = path.resolve(projectRoot);

    if (!(await this.fileSystem.isDirectory(absoluteRoot))) {
      throw new Error(`Project root must be a directory: ${projectRoot}`);
    }

    return this.discoverDirectory(absoluteRoot, absoluteRoot);
  }

  private async discoverDirectory(
    absoluteRoot: string,
    directoryPath: string,
  ): Promise<readonly ProjectFile[]> {
    const entries = await this.fileSystem.readdir(directoryPath);
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    const discoveredFiles: ProjectFile[] = [];

    for (const entry of sortedEntries) {
      const absolutePath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (this.filter.shouldTraverseDirectory(entry.name)) {
          discoveredFiles.push(...(await this.discoverDirectory(absoluteRoot, absolutePath)));
        }

        continue;
      }

      if (entry.isFile() && this.filter.shouldIncludeFile(entry.name)) {
        discoveredFiles.push(toProjectFile(absoluteRoot, absolutePath));
      }
    }

    return discoveredFiles;
  }
}

export const discoverProjectFiles = async (
  projectRoot: string,
  options: FileDiscoveryOptions = {},
): Promise<readonly ProjectFile[]> => {
  return new FileDiscoveryEngine(options).discover(projectRoot);
};

const toProjectFile = (absoluteRoot: string, absolutePath: string): ProjectFile => {
  const name = path.basename(absolutePath);

  return {
    absolutePath,
    relativePath: path.relative(absoluteRoot, absolutePath),
    name,
    extension: getExtension(name),
  };
};
