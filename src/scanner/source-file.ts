/**
 * Language classification inferred from a discovered file extension.
 */
export type SourceLanguage =
  | 'TypeScript'
  | 'TSX'
  | 'JavaScript'
  | 'JSX'
  | 'ESM'
  | 'CommonJS'
  | 'Unknown';

/**
 * A discovered project file with its source contents loaded for later pipeline stages.
 */
export interface SourceFile {
  /** Absolute filesystem path to the source file. */
  readonly path: string;
  /** Path to the source file relative to the project root. */
  readonly relativePath: string;
  /** Lowercase file extension without the leading dot. */
  readonly extension: string;
  /** Best-effort language classification derived from the file extension. */
  readonly language: SourceLanguage;
  /** UTF-8 file contents. */
  readonly contents: string;
  /** File size in bytes at the time it was scanned. */
  readonly size: number;
  /** Last modified timestamp at the time it was scanned. */
  readonly lastModified: Date;
}

/**
 * Detects the source language represented by a file extension.
 */
export const detectSourceLanguage = (extension: string): SourceLanguage => {
  switch (extension.toLowerCase().replace(/^\./, '')) {
    case 'ts':
      return 'TypeScript';
    case 'tsx':
      return 'TSX';
    case 'js':
      return 'JavaScript';
    case 'jsx':
      return 'JSX';
    case 'mjs':
      return 'ESM';
    case 'cjs':
      return 'CommonJS';
    default:
      return 'Unknown';
  }
};
