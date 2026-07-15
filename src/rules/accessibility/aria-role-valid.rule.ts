import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { collectJsxElements, getAttribute, getAttributeStringValue, getJsxAttributeValue, nodeLocation } from '../react/jsx-helpers.js';
import { VALID_ARIA_ROLES } from './aria.js';

/**
 * Flags `role` attributes whose (statically known) value is not a valid ARIA
 * role.
 */
export class AriaRoleValidRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/aria-role-valid',
        name: 'Valid ARIA role',
        description: 'Flags unknown or invalid ARIA role values.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yaria-role-valid',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => {
        const attribute = getAttribute(context.ast, element.header, 'role');
        if (!attribute || getJsxAttributeValue(attribute)?.kind !== 'StringLiteral') {
          return false;
        }
        const role = (getAttributeStringValue(context.ast, element.header, 'role') ?? '').trim();
        return role.length > 0 && !role.split(/\s+/).every((token) => VALID_ARIA_ROLES.has(token));
      })
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Invalid ARIA role "${getAttributeStringValue(context.ast, element.header, 'role')}".`,
          location: nodeLocation(context.sourceFile.relativePath, element.header),
          suggestion: 'Use a valid WAI-ARIA role, or remove the role attribute.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
