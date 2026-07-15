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
 * Flags `<iframe>` elements without a `title`, which screen readers announce to
 * describe the embedded content.
 */
export class IframeTitleRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/iframe-title',
        name: 'Iframe title',
        description: 'Requires a title attribute on <iframe> elements.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yiframe-title',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'iframe')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !hasAttribute(context.ast, element.header, 'title'))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<iframe> is missing a title attribute.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add a descriptive title attribute to the iframe.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
