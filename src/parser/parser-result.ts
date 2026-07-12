import type { Language } from './language.js';
import type { ParserDiagnostic, ParserError } from './parser-error.js';

/**
 * Normalized source position for a parsed AST node.
 */
export interface AstPosition {
  /** Zero-based character offset. */
  readonly offset: number;
  /** One-based line number. */
  readonly line: number;
  /** One-based column number. */
  readonly column: number;
}

/**
 * Normalized AST node independent from parser implementation internals.
 */
export interface NormalizedAstNode {
  /** Parser-independent node kind name. */
  readonly kind: string;
  /** Original parser-specific numeric node kind. */
  readonly rawKind: number;
  /** Start position of the node. */
  readonly start: AstPosition;
  /** End position of the node. */
  readonly end: AstPosition;
  /** Child nodes in source order. */
  readonly children: readonly NormalizedAstNode[];
}

/**
 * Normalized AST document produced for a parsed source file.
 */
export interface NormalizedAstDocument {
  /** Absolute path to the parsed file. */
  readonly path: string;
  /** Path to the parsed file relative to the project root. */
  readonly relativePath: string;
  /** Language used for parsing. */
  readonly language: Language;
  /** Root AST node. */
  readonly root: NormalizedAstNode;
}

/**
 * Result returned by every parser implementation.
 */
export interface ParserResult<TAst extends NormalizedAstDocument = NormalizedAstDocument> {
  /** Whether parsing completed without syntax errors or parser-level failures. */
  readonly success: boolean;
  /** Language used or attempted for parsing. */
  readonly language: Language;
  /** Absolute path to the parsed file. */
  readonly path: string;
  /** Normalized AST, or null when parsing could not produce one. */
  readonly ast: TAst | null;
  /** Parse duration in milliseconds. */
  readonly durationMs: number;
  /** Syntax errors reported by the parser. */
  readonly syntaxErrors: readonly ParserError[];
  /** All parser errors, including syntax errors and non-syntax parser failures. */
  readonly errors: readonly ParserError[];
  /** Non-fatal diagnostics collected while parsing. */
  readonly diagnostics: readonly ParserDiagnostic[];
}
