import type { Rule, RuleResult } from '../core/index.js';
import type { RuleContext as CoreRuleContext } from '../core/index.js';
import type { RuleContext } from '../rule-engine/index.js';
import type { RuleMetadata } from './metadata.js';
import { toCoreRuleDefinition, validateRuleMetadata } from './metadata.js';

/**
 * Function used to evaluate a rule created through the SDK.
 */
export type RuleEvaluator = (
  context: RuleContext,
) => RuleResult | Promise<RuleResult>;

/**
 * Input accepted by createRule.
 */
export interface CreateRuleInput {
  /** Rule metadata. */
  readonly metadata: RuleMetadata;
  /** Rule evaluation function. */
  readonly evaluate: RuleEvaluator;
}

/**
 * Creates a core-compatible rule from SDK metadata and an evaluator.
 */
export const createRule = (input: CreateRuleInput): Rule => {
  const validation = validateRuleMetadata(input.metadata);

  if (!validation.valid) {
    const details = validation.issues
      .map((issue) => `${String(issue.field)}: ${issue.message}`)
      .join(' ');
    throw new Error(`Invalid rule metadata. ${details}`);
  }

  const definition = toCoreRuleDefinition(input.metadata);

  return {
    ...definition,
    evaluate(context: CoreRuleContext) {
      return input.evaluate(context as RuleContext);
    },
  };
};
