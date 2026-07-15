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
 * Flags `<html>` elements that declare no `lang` attribute, which assistive
 * technologies need to select the correct pronunciation.
 */
export class HtmlLangRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/html-lang',
        name: 'HTML lang',
        description: 'Requires a lang attribute on the <html> element.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yhtml-lang',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'html')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !hasAttribute(context.ast, element.header, 'lang'))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<html> is missing a lang attribute.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add a lang attribute such as lang="en".',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
