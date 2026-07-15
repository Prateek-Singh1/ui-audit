import type { Finding, RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  getAttribute,
  getAttributeStringValue,
  getJsxAttributeValue,
  nodeLocation,
} from '../react/jsx-helpers.js';

/**
 * Flags duplicate static `id` values within a file. Duplicate ids break label
 * associations, `aria-labelledby`/`aria-describedby` references, and anchors.
 */
export class NoDuplicateIdRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/no-duplicate-id',
        name: 'No duplicate id',
        description: 'Flags duplicate id attribute values within a file.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yno-duplicate-id',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const seen = new Set<string>();
    const findings: Finding[] = [];

    for (const element of collectJsxElements(context.ast, context.ast.root)) {
      const attribute = getAttribute(context.ast, element.header, 'id');

      if (!attribute || getJsxAttributeValue(attribute)?.kind !== 'StringLiteral') {
        continue;
      }

      const id = getAttributeStringValue(context.ast, element.header, 'id') ?? '';

      if (id.length === 0) {
        continue;
      }

      if (seen.has(id)) {
        findings.push(
          createFinding({
            context,
            ruleName: this.name,
            message: `Duplicate id "${id}".`,
            location: nodeLocation(context.sourceFile.relativePath, attribute),
            suggestion: 'Make each id unique within the document.',
          }),
        );
      }

      seen.add(id);
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
