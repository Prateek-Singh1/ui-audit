import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Sample rule that performs no work and emits no findings.
 */
export class NoOpRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'sample/no-op',
        name: 'No operation',
        description: 'Sample rule that validates rule execution without emitting findings.',
        category: RuleCategory.Maintainability,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: false,
      }),
    );
  }

  protected run() {
    return createRuleResult(this.metadata, 'skipped');
  }
}
