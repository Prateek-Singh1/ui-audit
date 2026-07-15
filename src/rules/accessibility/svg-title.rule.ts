import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  hasAttribute,
  hasSpreadAttribute,
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';

const LABELLING_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'aria-hidden', 'role'];

/**
 * Flags `<svg>` elements that expose no accessible name via a `<title>` child
 * or an ARIA labelling attribute.
 */
export class SvgTitleRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/svg-title',
        name: 'SVG title',
        description: 'Requires a title or ARIA label on <svg> elements.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11ysvg-title',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'svg')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !this.isLabelled(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<svg> has no <title> or accessible label.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add a <title> child, an aria-label, or aria-hidden="true" if decorative.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isLabelled(context: RuleContext, svg: JsxElementInfo): boolean {
    if (LABELLING_ATTRIBUTES.some((name) => hasAttribute(context.ast, svg.header, name))) {
      return true;
    }

    return collectJsxElements(context.ast, svg.container).some((child) => child.tag === 'title');
  }
}
