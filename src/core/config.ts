import type { Severity } from './finding.js';

/**
 * Configuration values that can be overridden for an individual rule.
 */
export interface RuleConfig {
  /** Whether the rule should run for the current audit. */
  readonly enabled: boolean;
  /** Optional severity override for findings from this rule. */
  readonly severity?: Severity;
  /** Optional rule-specific configuration data. */
  readonly config?: Readonly<Record<string, unknown>>;
}

/**
 * Top-level configuration for an audit run.
 */
export interface AuditConfig {
  /** The filesystem root that should be audited. */
  readonly projectRoot: string;
  /** Optional working directory override. */
  readonly cwd?: string;
  /** Preferred reporter name for output rendering. */
  readonly reporter?: string;
  /** Files or globs that should be included in the scan. */
  readonly include?: readonly string[];
  /** Files or globs that should be excluded from the scan. */
  readonly exclude?: readonly string[];
  /** Per-rule configuration keyed by rule identifier. */
  readonly rules?: Readonly<Record<string, RuleConfig>>;
  /** Whether the CLI should fail on rule violations. */
  readonly strict?: boolean;
  /** Optional severity threshold for causing a non-zero exit code. */
  readonly failOnSeverity?: Severity;
  /** Plugin identifiers to load for the current run. */
  readonly plugins?: readonly string[];
  /** Arbitrary metadata for future toolchain integrations. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
