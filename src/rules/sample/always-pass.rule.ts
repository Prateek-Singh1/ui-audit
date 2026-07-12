import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Sample rule that always passes and emits no findings.
 */
export class AlwaysPassRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'sample/always-pass',
        name: 'Always pass',
        description: 'Sample rule that always reports a passing result.',
        category: RuleCategory.BestPractices,
        severity: RuleSeverity.Info,
        recommended: true,
        enabledByDefault: true,
      }),
    );
  }

  protected run() {
    return createRuleResult(this.metadata, 'passed');
  }
}
