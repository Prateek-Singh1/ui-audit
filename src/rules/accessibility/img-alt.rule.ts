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
} from '../react/jsx-helpers.js';

/**
 * Flags `<img>` elements that declare no `alt` attribute. Screen readers cannot
 * describe an image without alt text.
 */
export class ImgAltRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/img-alt',
        name: 'Image alt text',
        description: 'Requires an alt attribute on <img> elements.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yimg-alt',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'img')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !hasAttribute(context.ast, element.header, 'alt'))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<img> is missing an alt attribute.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Provide meaningful alt text, or alt="" for decorative images.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
