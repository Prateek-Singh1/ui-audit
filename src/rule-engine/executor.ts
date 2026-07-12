import type { AuditConfig } from '../core/config.js';
import type { ProjectContext } from '../core/context.js';
import type { Finding } from '../core/finding.js';
import type { RuleRegistry } from '../core/registry.js';
import type { Rule } from '../core/rule.js';
import type { NormalizedAstDocument } from '../parser/index.js';
import { createRuleContext } from './context.js';
import type { ExecutionError } from './execution-error.js';
import type { ExecutionResult } from './execution-result.js';
import { RuleRunner } from './rule-runner.js';

/**
 * Input accepted by rule executors.
 */
export interface RuleExecutorInput {
  /** Parsed AST documents to evaluate. */
  readonly documents: readonly NormalizedAstDocument[];
  /** Registry containing rules to execute. */
  readonly registry: RuleRegistry;
  /** Project context for the current execution. */
  readonly project: ProjectContext;
  /** Project audit configuration available to rules. */
  readonly config: AuditConfig;
  /** Shared metadata attached to every rule context. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional abort signal for cooperative cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Execution strategy contract. Future implementations can run rules in parallel or workers.
 */
export interface RuleExecutor {
  /** Executes registered rules against parsed documents. */
  execute(input: RuleExecutorInput): Promise<ExecutionResult>;
}

/**
 * Sequential rule executor used by the initial rule engine implementation.
 */
export class SequentialRuleExecutor implements RuleExecutor {
  private readonly runner: RuleRunner;

  constructor(runner: RuleRunner = new RuleRunner()) {
    this.runner = runner;
  }

  async execute(input: RuleExecutorInput): Promise<ExecutionResult> {
    const startTime = performance.now();
    const findings: Finding[] = [];
    const errors: ExecutionError[] = [];
    let executedRules = 0;
    let successfulRules = 0;
    let failedRules = 0;

    for (const document of input.documents) {
      for (const rule of input.registry.list()) {
        executedRules += 1;
        const result = await this.runner.run(
          rule,
          createRuleContext({
            project: input.project,
            ruleId: rule.id,
            severity: rule.severity,
            ruleConfig: getRuleConfig(input.config, rule),
            projectConfig: input.config.metadata,
            ast: document,
            metadata: input.metadata,
            signal: input.signal,
          }),
        );

        if (result.success) {
          successfulRules += 1;
          findings.push(...result.findings);
        } else {
          failedRules += 1;
          if (result.error) {
            errors.push(result.error);
          }
        }
      }
    }

    return {
      executedRules,
      successfulRules,
      failedRules,
      findings,
      executionTime: elapsedSince(startTime),
      errors,
    };
  }
}

const getRuleConfig = (
  config: AuditConfig,
  rule: Rule,
): Readonly<Record<string, unknown>> | undefined => {
  return config.rules?.[rule.id]?.config;
};

const elapsedSince = (startTime: number): number => {
  return Math.max(0, performance.now() - startTime);
};
