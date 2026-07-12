import { BaseRule } from '../base-rule.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Sample rule that always emits one finding.
 */
export class AlwaysFailRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'sample/always-fail',
        name: 'Always fail',
        description: 'Sample rule that always emits a validation finding.',
        category: RuleCategory.BestPractices,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: false,
      }),
    );
  }

  protected run(context: RuleContext) {
    return createRuleResult(this.metadata, 'failed', [
      createFinding({
        context,
        message: 'Sample rule emitted a finding.',
        location: {
          file: context.sourceFile.relativePath,
        },
      }),
    ]);
  }
}
