import type { Finding, RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  getAttributeStringValue,
  hasAttribute,
  hasSpreadAttribute,
  nodeLocation,
} from '../react/jsx-helpers.js';
import { ROLE_REQUIRED_ATTRIBUTES } from './aria.js';

/**
 * Flags elements that declare an ARIA role but omit an attribute required by
 * that role (for example, `role="checkbox"` without `aria-checked`).
 */
export class AriaRequiredAttributesRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/aria-required-attributes',
        name: 'ARIA required attributes',
        description: 'Flags ARIA roles that are missing their required attributes.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yaria-required-attributes',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const element of collectJsxElements(context.ast, context.ast.root)) {
      if (hasSpreadAttribute(element.header)) {
        continue;
      }

      const role = (getAttributeStringValue(context.ast, element.header, 'role') ?? '').trim();
      const required = ROLE_REQUIRED_ATTRIBUTES[role];

      if (!required) {
        continue;
      }

      const missing = required.filter((attribute) => !hasAttribute(context.ast, element.header, attribute));

      if (missing.length > 0) {
        findings.push(
          createFinding({
            context,
            ruleName: this.name,
            message: `role="${role}" is missing required ${missing.length === 1 ? 'attribute' : 'attributes'}: ${missing.join(', ')}.`,
            location: nodeLocation(context.sourceFile.relativePath, element.header),
            suggestion: `Add the required ARIA ${missing.length === 1 ? 'attribute' : 'attributes'} for role="${role}".`,
          }),
        );
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
