/**
 * A project file discovered on disk and ready for future audit stages.
 */
export interface ProjectFile {
  /** Absolute filesystem path to the file. */
  readonly absolutePath: string;
  /** Path relative to the project root, using the host platform separator. */
  readonly relativePath: string;
  /** Basename of the file, including its extension. */
  readonly name: string;
  /** Lowercase extension without the leading dot. Empty when no extension exists. */
  readonly extension: string;
}
