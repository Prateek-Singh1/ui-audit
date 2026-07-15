import type { AuditConfig } from '../core/config.js';
import type { Finding, Severity } from '../core/finding.js';
import type { Rule } from '../core/rule.js';
import type { Language } from '../parser/language.js';
import type { NormalizedAstDocument } from '../parser/index.js';
import { createRuleContext } from './context.js';
import type { ExecutionError } from './execution-error.js';
import type { ExecutionResult } from './execution-result.js';
import type { RuleExecutor, RuleExecutorInput } from './executor.js';
import { RuleRunner } from './rule-runner.js';

/**
 * Optional applicability metadata a rule instance may expose.
 *
 * This is read defensively by {@link ConfigAwareRuleExecutor}: rules that
 * declare a non-empty language list run only against matching documents, while
 * rules that omit it run against every document. The core {@link Rule} contract
 * is intentionally left unchanged; this is a purely optional capability.
 */
export interface LanguageAwareRule {
  /** Languages this rule applies to. When omitted, the rule applies to all. */
  readonly languages?: readonly Language[];
}

/**
 * Rule executor that honors the resolved audit configuration.
 *
 * Compared to the {@link SequentialRuleExecutor}, this executor:
 *
 * - skips rules disabled by configuration (or by their own default),
 * - applies per-rule severity overrides to emitted findings,
 * - respects optional rule language applicability, and
 * - preserves error isolation so one failing rule never aborts the run.
 *
 * It implements the same {@link RuleExecutor} contract and can therefore be
 * supplied to the existing `RuleEngine` without any changes to it.
 */
export class ConfigAwareRuleExecutor implements RuleExecutor {
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
        if (!isRuleEnabled(input.config, rule)) {
          continue;
        }

        if (!isRuleApplicable(rule, document)) {
          continue;
        }

        executedRules += 1;
        const result = await this.runner.run(
          rule,
          createRuleContext({
            project: input.project,
            ruleId: rule.id,
            severity: resolveSeverity(input.config, rule),
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

/**
 * Determines whether a rule should run for the current configuration.
 *
 * Explicit configuration wins; otherwise the rule's own `enabledByDefault`
 * flag applies (treated as enabled when unspecified).
 */
const isRuleEnabled = (config: AuditConfig, rule: Rule): boolean => {
  const ruleConfig = config.rules?.[rule.id];

  if (ruleConfig) {
    return ruleConfig.enabled;
  }

  return rule.enabledByDefault !== false;
};

/**
 * Determines whether a rule applies to the language of the given document.
 */
const isRuleApplicable = (rule: Rule, document: NormalizedAstDocument): boolean => {
  const languages = getRuleLanguages(rule);

  if (!languages) {
    return true;
  }

  return languages.includes(document.language);
};

/**
 * Reads optional language applicability from a rule instance without requiring
 * it to implement any additional contract.
 */
const getRuleLanguages = (rule: Rule): readonly Language[] | undefined => {
  const languages = (rule as Partial<LanguageAwareRule>).languages;

  return Array.isArray(languages) && languages.length > 0 ? languages : undefined;
};

/**
 * Resolves the effective severity for a rule, preferring configuration
 * overrides over the rule's declared default severity.
 */
const resolveSeverity = (config: AuditConfig, rule: Rule): Severity => {
  return config.rules?.[rule.id]?.severity ?? rule.severity;
};

const getRuleConfig = (
  config: AuditConfig,
  rule: Rule,
): Readonly<Record<string, unknown>> | undefined => {
  return config.rules?.[rule.id]?.config;
};

const elapsedSince = (startTime: number): number => {
  return Math.max(0, performance.now() - startTime);
};
