import type { Finding } from '../core/finding.js';
import type { ExecutionError } from './execution-error.js';

/**
 * Normalized result returned by the rule engine.
 */
export interface ExecutionResult {
  /** Number of rule invocations attempted. */
  readonly executedRules: number;
  /** Number of rule invocations that completed without throwing. */
  readonly successfulRules: number;
  /** Number of rule invocations that failed with an exception. */
  readonly failedRules: number;
  /** Findings emitted by all successful rule invocations. */
  readonly findings: readonly Finding[];
  /** Total execution time in milliseconds. */
  readonly executionTime: number;
  /** Structured rule execution failures. */
  readonly errors: readonly ExecutionError[];
}

/**
 * Internal result for one rule invocation.
 */
export interface RuleInvocationResult {
  /** Whether the invocation completed without throwing. */
  readonly success: boolean;
  /** Findings emitted by the invocation. */
  readonly findings: readonly Finding[];
  /** Execution time in milliseconds. */
  readonly executionTime: number;
  /** Captured failure when the invocation throws. */
  readonly error?: ExecutionError;
}
