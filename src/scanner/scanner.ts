import { readFile, stat } from 'node:fs/promises';
import type { ProjectFile } from '../discovery/index.js';
import { detectSourceLanguage, type SourceFile } from './source-file.js';

/**
 * File metadata required to construct a scanned source file.
 */
export interface ScannedFileStats {
  /** File size in bytes. */
  readonly size: number;
  /** Last modified timestamp. */
  readonly mtime: Date;
}

/**
 * Filesystem boundary used by the scanner to load source files.
 */
export interface ScannerFileSystem {
  /** Reads a source file as UTF-8 text. */
  readFile(filePath: string): Promise<string>;
  /** Reads source file metadata needed by the scanner result. */
  stat(filePath: string): Promise<ScannedFileStats>;
}

/**
 * Options for file scanning.
 */
export interface ScannerOptions {
  /** Optional filesystem implementation for tests or alternate runtimes. */
  readonly fileSystem?: ScannerFileSystem;
}

/**
 * Diagnostic emitted when a discovered file cannot be scanned.
 */
export interface ScannerError {
  /** Absolute filesystem path to the file that failed to scan. */
  readonly path: string;
  /** Path to the file relative to the project root. */
  readonly relativePath: string;
  /** Stable machine-readable error code when available. */
  readonly code: string;
  /** Human-readable diagnostic message. */
  readonly message: string;
}

/**
 * Result produced by scanning one or more discovered files.
 */
export interface ScannerResult {
  /** Source files that were read successfully, preserving input order. */
  readonly files: readonly SourceFile[];
  /** Diagnostics for files that could not be read or inspected. */
  readonly errors: readonly ScannerError[];
}

const nodeFileSystem: ScannerFileSystem = {
  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  },
  async stat(filePath: string): Promise<ScannedFileStats> {
    return stat(filePath);
  },
};

/**
 * Reads a single discovered project file into a source file result.
 */
export const scanFile = async (
  projectFile: ProjectFile,
  options: ScannerOptions = {},
): Promise<ScannerResult> => {
  const fileSystem = options.fileSystem ?? nodeFileSystem;

  try {
    const [contents, fileStats] = await Promise.all([
      fileSystem.readFile(projectFile.absolutePath),
      fileSystem.stat(projectFile.absolutePath),
    ]);

    return {
      files: [
        {
          path: projectFile.absolutePath,
          relativePath: projectFile.relativePath,
          extension: projectFile.extension,
          language: detectSourceLanguage(projectFile.extension),
          contents,
          size: fileStats.size,
          lastModified: fileStats.mtime,
        },
      ],
      errors: [],
    };
  } catch (error) {
    return {
      files: [],
      errors: [toScannerError(projectFile, error)],
    };
  }
};

/**
 * Reads discovered project files into source files while preserving input order.
 */
export const scanFiles = async (
  projectFiles: readonly ProjectFile[],
  options: ScannerOptions = {},
): Promise<ScannerResult> => {
  const scannedFiles: SourceFile[] = [];
  const scannerErrors: ScannerError[] = [];

  for (const projectFile of projectFiles) {
    const result = await scanFile(projectFile, options);
    scannedFiles.push(...result.files);
    scannerErrors.push(...result.errors);
  }

  return {
    files: scannedFiles,
    errors: scannerErrors,
  };
};

const toScannerError = (projectFile: ProjectFile, error: unknown): ScannerError => {
  const code = getErrorCode(error);
  const reason = error instanceof Error ? error.message : 'Unknown scanner failure.';

  return {
    path: projectFile.absolutePath,
    relativePath: projectFile.relativePath,
    code,
    message: `Unable to scan file "${projectFile.relativePath}": ${reason}`,
  };
};

const getErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { readonly code?: unknown }).code;

    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }

  return 'SCAN_ERROR';
};
