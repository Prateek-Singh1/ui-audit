import type { SourceFile } from '../scanner/index.js';

/**
 * Source languages understood by the parser layer.
 */
export enum Language {
  TypeScript = 'TypeScript',
  TSX = 'TSX',
  JavaScript = 'JavaScript',
  JSX = 'JSX',
  Unknown = 'Unknown',
}

const EXTENSION_LANGUAGE_MAP = new Map<string, Language>([
  ['ts', Language.TypeScript],
  ['tsx', Language.TSX],
  ['js', Language.JavaScript],
  ['mjs', Language.JavaScript],
  ['cjs', Language.JavaScript],
  ['jsx', Language.JSX],
]);

/**
 * Detects parser language from a file extension.
 */
export const detectLanguageFromExtension = (extension: string): Language => {
  return EXTENSION_LANGUAGE_MAP.get(normalizeExtension(extension)) ?? Language.Unknown;
};

/**
 * Detects parser language from a scanned source file.
 */
export const detectLanguageFromFile = (file: SourceFile): Language => {
  return detectLanguageFromExtension(file.extension);
};

const normalizeExtension = (extension: string): string => {
  return extension.toLowerCase().replace(/^\./, '');
};
