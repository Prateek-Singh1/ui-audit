import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  getAttribute,
  getJsxAttributeValue,
  hasSpreadAttribute,
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';

/**
 * Flags anchors that are not real links: no `href`, `href="#"`, or a
 * `javascript:` URL. These should usually be buttons instead.
 */
export class AnchorValidRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/anchor-valid',
        name: 'Valid anchor',
        description: 'Flags anchors without a valid href destination.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yanchor-valid',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'a')
      .filter((element) => !hasSpreadAttribute(element.header))
      .map((element) => ({ element, reason: this.invalidReason(context, element) }))
      .filter((entry): entry is { element: JsxElementInfo; reason: string } => entry.reason !== undefined)
      .map(({ element, reason }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Anchor is not a valid link: ${reason}.`,
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Use a real destination href, or use a <button> for actions.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private invalidReason(context: RuleContext, element: JsxElementInfo): string | undefined {
    const attribute = getAttribute(context.ast, element.header, 'href');

    if (!attribute) {
      return 'missing href';
    }

    const value = getJsxAttributeValue(attribute);

    if (value?.kind !== 'StringLiteral') {
      return undefined;
    }

    const href = getAstNodeText(context.ast, value).replace(/^['"]|['"]$/g, '').trim();

    if (href === '#') {
      return 'href="#"';
    }

    if (/^javascript:/i.test(href)) {
      return 'javascript: URL';
    }

    return undefined;
  }
}
