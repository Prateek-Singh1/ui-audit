import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { collectJsxElements, nodeLocation } from '../react/jsx-helpers.js';

const OBSOLETE_TAGS = new Set(['marquee', 'blink']);

/**
 * Flags obsolete, accessibility-hostile elements such as `<marquee>` and
 * `<blink>`, whose motion cannot be paused and harms readability.
 */
export class NoMarqueeRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/no-marquee',
        name: 'No marquee',
        description: 'Disallows obsolete <marquee> and <blink> elements.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yno-marquee',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => OBSOLETE_TAGS.has(element.tag))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `<${element.tag}> is obsolete and harms accessibility.`,
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Remove the element and use CSS animations with reduced-motion support if needed.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
