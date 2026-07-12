/**
 * Supported severity levels for findings and rules.
 */
export type Severity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Describes a specific location within a source file.
 */
export interface SourceLocation {
  /** The normalized path to the file that produced the finding. */
  readonly file: string;
  /** The starting line number, when available. */
  readonly line?: number;
  /** The starting column number, when available. */
  readonly column?: number;
  /** The ending line number, when available. */
  readonly endLine?: number;
  /** The ending column number, when available. */
  readonly endColumn?: number;
}

/**
 * Represents a normalized audit finding emitted by a rule.
 */
export interface Finding {
  /** The identifier of the rule that produced the finding. */
  readonly ruleId: string;
  /** Human-readable name of the rule that produced the finding. */
  readonly ruleName?: string;
  /** A concise explanation of the issue. */
  readonly message: string;
  /** The severity associated with the finding. */
  readonly severity: Severity;
  /** Optional source location for precise reporting. */
  readonly location?: SourceLocation;
  /** Optional remediation guidance for developers. */
  readonly suggestion?: string;
  /** Arbitrary structured metadata for future enrichment. */
  readonly metadata?: Record<string, unknown>;
}
