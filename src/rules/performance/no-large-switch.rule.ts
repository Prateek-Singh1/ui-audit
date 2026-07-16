import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, nodeLocation } from '../react/jsx-helpers.js';
import { countSwitchCases, readPositiveInteger } from './perf-helpers.js';

const DEFAULT_MAX_CASES = 10;

/**
 * Flags switch statements whose `case`/`default` clause count exceeds `maxCases`
 * (default {@link DEFAULT_MAX_CASES}). Very large switches are usually better
 * expressed as a lookup map or dispatch table.
 */
export class NoLargeSwitchRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-large-switch',
        name: 'No large switch',
        description: 'Warns when switch statements exceed a configurable case count.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-large-switch',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxCases = readPositiveInteger(context.config.maxCases, DEFAULT_MAX_CASES);

    const findings = findNodesByKinds(context.ast.root, ['SwitchStatement'])
      .map((node) => ({ node, count: countSwitchCases(node) }))
      .filter(({ count }) => count > maxCases)
      .map(({ node, count }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Switch statement has ${count} cases (limit is ${maxCases}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Replace the switch with a lookup map or dispatch table.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
