import type { RuleResult } from '../../core/index.js';
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
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';
import { IMPLICIT_ROLES } from './aria.js';

/**
 * Flags `role` attributes that merely restate an element's implicit role, such
 * as `<button role="button">` or `<img role="img">`.
 */
export class NoRedundantRoleRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/no-redundant-role',
        name: 'No redundant role',
        description: 'Flags role attributes that duplicate an implicit role.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yno-redundant-role',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => this.isRedundant(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `role="${getAttributeStringValue(context.ast, element.header, 'role')}" is redundant on <${element.tag}>.`,
          location: nodeLocation(context.sourceFile.relativePath, element.header),
          suggestion: 'Remove the redundant role; the element already has it implicitly.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isRedundant(context: RuleContext, element: JsxElementInfo): boolean {
    const role = getAttributeStringValue(context.ast, element.header, 'role');

    if (!role) {
      return false;
    }

    const implicit =
      element.tag === 'a'
        ? hasAttribute(context.ast, element.header, 'href')
          ? 'link'
          : undefined
        : IMPLICIT_ROLES[element.tag];

    return implicit !== undefined && implicit === role.trim();
  }
}
