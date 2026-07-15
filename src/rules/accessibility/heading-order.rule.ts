import type { Finding, RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { collectJsxElements, nodeLocation } from '../react/jsx-helpers.js';

const HEADING_TAG = /^h([1-6])$/;

/**
 * Flags heading levels that skip a level (for example an `<h1>` followed by an
 * `<h3>`), which breaks the document outline for assistive technology.
 */
export class HeadingOrderRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/heading-order',
        name: 'Heading order',
        description: 'Flags skipped heading levels.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yheading-order',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const headings = collectJsxElements(context.ast, context.ast.root)
      .map((element) => ({ element, level: headingLevel(element.tag) }))
      .filter((entry): entry is { element: (typeof entry)['element']; level: number } => entry.level > 0)
      .sort((a, b) => a.element.container.start.offset - b.element.container.start.offset);

    const findings: Finding[] = [];
    let previous: number | undefined;

    for (const { element, level } of headings) {
      if (previous !== undefined && level > previous + 1) {
        findings.push(
          createFinding({
            context,
            ruleName: this.name,
            message: `Heading level skips from h${previous} to h${level}.`,
            location: nodeLocation(context.sourceFile.relativePath, element.container),
            suggestion: 'Do not skip heading levels; increase by at most one.',
          }),
        );
      }

      previous = level;
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}

const headingLevel = (tag: string): number => {
  const match = HEADING_TAG.exec(tag);
  return match ? Number(match[1]) : 0;
};
