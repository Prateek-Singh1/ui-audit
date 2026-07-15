import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  findNodesByKinds,
  hasAttribute,
  hasSpreadAttribute,
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';

const NAME_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'title'];

/**
 * Flags `<button>` elements that expose no accessible name via text content,
 * a labelled child, or an ARIA labelling attribute.
 */
export class ButtonAccessibleNameRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/button-accessible-name',
        name: 'Button accessible name',
        description: 'Requires buttons to expose an accessible name.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11ybutton-accessible-name',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'button')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !this.hasAccessibleName(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<button> has no accessible name.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add visible text, an aria-label, or an aria-labelledby reference.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private hasAccessibleName(context: RuleContext, element: JsxElementInfo): boolean {
    if (NAME_ATTRIBUTES.some((name) => hasAttribute(context.ast, element.header, name))) {
      return true;
    }

    if (element.selfClosing) {
      return false;
    }

    const hasText = findNodesByKinds(element.container, ['JsxText']).some(
      (node) => getAstNodeText(context.ast, node).trim().length > 0,
    );
    const hasExpression = findNodesByKinds(element.container, ['JsxExpression']).length > 0;

    return hasText || hasExpression;
  }
}
