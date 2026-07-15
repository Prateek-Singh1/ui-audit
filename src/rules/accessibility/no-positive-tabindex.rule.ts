import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, getJsxAttributeName, nodeLocation } from '../react/jsx-helpers.js';

/**
 * Flags positive `tabIndex` values, which override the natural tab order and
 * make keyboard navigation unpredictable.
 */
export class NoPositiveTabindexRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/no-positive-tabindex',
        name: 'No positive tabindex',
        description: 'Disallows positive tabIndex values.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yno-positive-tabindex',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['JsxAttribute'])
      .filter((attribute) => getJsxAttributeName(context.ast, attribute) === 'tabIndex')
      .filter((attribute) => this.isPositive(context, attribute))
      .map((attribute) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Avoid positive tabIndex values.',
          location: nodeLocation(context.sourceFile.relativePath, attribute),
          suggestion: 'Use tabIndex={0} or tabIndex={-1} and rely on natural DOM order.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isPositive(context: RuleContext, attribute: NormalizedAstNode): boolean {
    // Numeric literals surface as token-like nodes, so read the attribute's
    // value text directly: the expression inside `{...}` or a string literal.
    const expression = attribute.children.find((child) => child.kind === 'JsxExpression');
    const stringValue = attribute.children.find((child) => child.kind === 'StringLiteral');

    const raw = expression
      ? getAstNodeText(context.ast, expression).replace(/^\{|\}$/g, '')
      : stringValue
        ? getAstNodeText(context.ast, stringValue).replace(/^['"]|['"]$/g, '')
        : '';

    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) && parsed > 0;
  }
}
