import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, getJsxAttributeName, nodeLocation } from '../react/jsx-helpers.js';

/**
 * Flags the `autoFocus` attribute, which can disorient screen-reader and
 * keyboard users by moving focus unexpectedly on mount.
 */
export class NoAutofocusRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/no-autofocus',
        name: 'No autofocus',
        description: 'Discourages the autoFocus attribute.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yno-autofocus',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['JsxAttribute'])
      .filter((attribute) => getJsxAttributeName(context.ast, attribute) === 'autoFocus')
      .map((attribute) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Avoid the autoFocus attribute.',
          location: nodeLocation(context.sourceFile.relativePath, attribute),
          suggestion: 'Manage focus explicitly and intentionally instead of using autoFocus.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
