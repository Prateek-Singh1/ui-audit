import type { Finding, Severity } from './finding.js';
import type { RuleContext } from './context.js';

/**
 * Describes the execution outcome for a rule evaluation.
 */
export type RuleStatus = 'passed' | 'failed' | 'skipped' | 'error';

/**
 * The normalized result object returned by a rule execution.
 */
export interface RuleResult {
  /** The identifier of the rule that produced this result. */
  readonly ruleId: string;
  /** The rule execution outcome. */
  readonly status: RuleStatus;
  /** The findings emitted by the rule. */
  readonly findings: readonly Finding[];
  /** Optional human-readable summary for reporting. */
  readonly summary?: string;
  /** Optional structured metadata for future tooling. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Shared metadata that every rule should declare.
 */
export interface RuleDefinition {
  /** Stable identifier used for registration and selection. */
  readonly id: string;
  /** Human-readable name shown in CLI output and docs. */
  readonly name: string;
  /** Explanation of what the rule checks. */
  readonly description: string;
  /** High-level domain category such as accessibility or performance. */
  readonly category: string;
  /** Default severity assigned to findings from this rule. */
  readonly severity: Severity;
  /** Whether the rule should be enabled automatically unless disabled. */
  readonly enabledByDefault?: boolean;
  /** Optional documentation URL for users and contributors. */
  readonly docsUrl?: string;
  /** Optional tags for grouping and discovery. */
  readonly tags?: readonly string[];
}

/**
 * The contract implemented by every audit rule.
 */
export interface Rule extends RuleDefinition {
  /** Executes the rule against the supplied context. */
  readonly evaluate: (context: RuleContext) => RuleResult | Promise<RuleResult>;
}
