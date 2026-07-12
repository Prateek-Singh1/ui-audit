/**
 * Structured error captured when a rule invocation fails.
 */
export interface ExecutionError {
  /** Identifier of the rule that failed. */
  readonly ruleId: string;
  /** Human-readable rule name. */
  readonly ruleName: string;
  /** Absolute path to the file being evaluated when the failure occurred. */
  readonly filePath: string;
  /** Human-readable error message. */
  readonly message: string;
  /** Stack trace captured from the thrown error when available. */
  readonly stack?: string;
  /** Execution time for the failed invocation in milliseconds. */
  readonly executionTime: number;
}
