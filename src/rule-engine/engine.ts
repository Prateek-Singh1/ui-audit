import type { AuditConfig } from "../core/config.js";
import type { ProjectContext } from "../core/context.js";
import type { RuleRegistry } from "../core/registry.js";
import type { NormalizedAstDocument } from "../parser/index.js";
import type { ExecutionResult } from "./execution-result.js";
import type { RuleExecutor } from "./executor.js";
import { ConfigAwareRuleExecutor } from "./config-aware-executor.js";

/**
 * Input accepted by the RuleEngine.
 */
export interface RuleEngineExecuteInput {
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
 * Rule execution engine responsible for coordinating registered audit rules.
 */
export class RuleEngine {
  private readonly executor: RuleExecutor;

  constructor(executor: RuleExecutor = new ConfigAwareRuleExecutor()) {
    this.executor = executor;
  }

  /**
   * Executes registered rules against parsed AST documents.
   */
  execute(input: RuleEngineExecuteInput): Promise<ExecutionResult> {
    return this.executor.execute(input);
  }
}

/**
 * Convenience helper for executing rules with the default rule engine.
 */
export const execute = async (
  input: RuleEngineExecuteInput,
): Promise<ExecutionResult> => {
  return new RuleEngine().execute(input);
};
