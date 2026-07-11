import path from 'node:path';

const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.cache',
  'storybook-static',
] as const;

const DEFAULT_HIDDEN_SYSTEM_FILES = ['.DS_Store', 'Thumbs.db'] as const;

/**
 * Options that define which filesystem entries are considered discoverable.
 */
export interface FileFilterOptions {
  /** Directory basenames that should not be traversed. */
  readonly ignoredDirectoryNames?: readonly string[];
  /** Hidden system file basenames to skip. */
  readonly hiddenSystemFileNames?: readonly string[];
  /** When provided, only files with these extensions are included. */
  readonly includeExtensions?: readonly string[];
}

/**
 * Encapsulates discovery inclusion rules independently from filesystem walking.
 */
export class FileFilter {
  private readonly ignoredDirectoryNames: ReadonlySet<string>;
  private readonly hiddenSystemFileNames: ReadonlySet<string>;
  private readonly includeExtensions?: ReadonlySet<string>;

  constructor(options: FileFilterOptions = {}) {
    this.ignoredDirectoryNames = new Set(
      options.ignoredDirectoryNames ?? DEFAULT_IGNORED_DIRECTORIES,
    );
    this.hiddenSystemFileNames = new Set(
      options.hiddenSystemFileNames ?? DEFAULT_HIDDEN_SYSTEM_FILES,
    );
    this.includeExtensions = options.includeExtensions
      ? new Set(options.includeExtensions.map((extension) => normalizeExtension(extension)))
      : undefined;
  }

  shouldTraverseDirectory(directoryName: string): boolean {
    return !this.ignoredDirectoryNames.has(directoryName);
  }

  shouldIncludeFile(fileName: string): boolean {
    if (this.isHiddenSystemFile(fileName)) {
      return false;
    }

    if (!this.includeExtensions) {
      return true;
    }

    return this.includeExtensions.has(getExtension(fileName));
  }

  private isHiddenSystemFile(fileName: string): boolean {
    return fileName.startsWith('.') || this.hiddenSystemFileNames.has(fileName);
  }
}

export const getExtension = (fileName: string): string => {
  return normalizeExtension(path.extname(fileName));
};

const normalizeExtension = (extension: string): string => {
  return extension.replace(/^\./, '').toLowerCase();
};
