import { Language } from './language.js';

/**
 * Languages that have parser implementations registered by default.
 */
export const SUPPORTED_LANGUAGES = [
  Language.TypeScript,
  Language.TSX,
  Language.JavaScript,
  Language.JSX,
] as const;

/**
 * Extensions recognized by the parser language detector.
 */
export const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
