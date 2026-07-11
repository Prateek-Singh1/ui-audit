import type { Severity } from './finding.js';

/**
 * Represents the current project state for an audit run.
 */
export interface ProjectContext {
  /** The root directory that the audit is scoped to. */
  readonly projectRoot: string;
  /** The current working directory at the start of the run. */
  readonly cwd: string;
  /** The discovered files that are eligible for evaluation. */
  readonly files: readonly string[];
  /** Environment variables visible to the run. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Optional metadata that future features can attach. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Provides the execution context available to a rule implementation.
 */
export interface RuleContext {
  /** The project-level state for the active audit. */
  readonly project: ProjectContext;
  /** The unique identifier of the rule being executed. */
  readonly ruleId: string;
  /** The effective severity for the rule during the run. */
  readonly severity: Severity;
  /** Optional rule-specific configuration values. */
  readonly config?: Readonly<Record<string, unknown>>;
  /** An abort signal that can be used for cooperative cancellation. */
  readonly signal?: AbortSignal;
}
