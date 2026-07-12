import type { Language } from './language.js';

/**
 * High-level parser failure classification.
 */
export type ParserErrorKind = 'syntax-error' | 'unsupported-language' | 'parser-exception';

/**
 * Structured parser error returned instead of throwing for per-file failures.
 */
export interface ParserError {
  /** Stable machine-readable error classification. */
  readonly kind: ParserErrorKind;
  /** Absolute path to the file being parsed. */
  readonly path: string;
  /** Language selected for parsing. */
  readonly language: Language;
  /** Human-readable error message. */
  readonly message: string;
  /** Optional parser-specific diagnostic code. */
  readonly code?: string | number;
  /** Zero-based start offset when available. */
  readonly start?: number;
  /** Error length in UTF-16 code units when available. */
  readonly length?: number;
  /** One-based line number when available. */
  readonly line?: number;
  /** One-based column number when available. */
  readonly column?: number;
}

/**
 * Non-fatal parser diagnostic associated with a parse result.
 */
export interface ParserDiagnostic {
  /** Diagnostic severity. */
  readonly severity: 'error' | 'warning' | 'info';
  /** Absolute path to the file being parsed. */
  readonly path: string;
  /** Human-readable diagnostic message. */
  readonly message: string;
  /** Optional parser-specific diagnostic code. */
  readonly code?: string | number;
  /** Zero-based start offset when available. */
  readonly start?: number;
  /** Diagnostic length in UTF-16 code units when available. */
  readonly length?: number;
  /** One-based line number when available. */
  readonly line?: number;
  /** One-based column number when available. */
  readonly column?: number;
}
