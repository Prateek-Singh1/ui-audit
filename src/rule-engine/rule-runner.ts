import type { Rule } from '../core/rule.js';
import type { RuleContext } from './context.js';
import type { ExecutionError } from './execution-error.js';
import type { RuleInvocationResult } from './execution-result.js';

/**
 * Executes one rule against one rule context and converts thrown errors into diagnostics.
 */
export class RuleRunner {
  /**
   * Runs a rule safely. Rule failures are captured and never rethrown.
   */
  async run(rule: Rule, context: RuleContext): Promise<RuleInvocationResult> {
    const startTime = performance.now();

    try {
      const result = await rule.evaluate(context);

      return {
        success: true,
        findings: result.findings,
        executionTime: elapsedSince(startTime),
      };
    } catch (error) {
      const executionTime = elapsedSince(startTime);

      return {
        success: false,
        findings: [],
        executionTime,
        error: toExecutionError(rule, context, error, executionTime),
      };
    }
  }
}

const toExecutionError = (
  rule: Rule,
  context: RuleContext,
  error: unknown,
  executionTime: number,
): ExecutionError => {
  const message = error instanceof Error ? error.message : 'Unknown rule execution failure.';
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    filePath: context.sourceFile.path,
    message,
    ...(stack ? { stack } : {}),
    executionTime,
  };
};

const elapsedSince = (startTime: number): number => {
  return Math.max(0, performance.now() - startTime);
};
