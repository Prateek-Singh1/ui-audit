import type { Finding, RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, getJsxAttributeName, getJsxAttributes, nodeLocation } from './jsx-helpers.js';

/**
 * Flags JSX elements that declare the same prop more than once. Only the last
 * occurrence takes effect, so duplicates are always a mistake.
 */
export class NoDuplicatePropsRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-duplicate-props',
        name: 'No duplicate props',
        description: 'Disallows duplicated props on a JSX element.',
        category: RuleCategory.React,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-duplicate-props',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const element of findNodesByKinds(context.ast.root, ['JsxOpeningElement', 'JsxSelfClosingElement'])) {
      const seen = new Set<string>();

      for (const attribute of getJsxAttributes(element)) {
        const name = getJsxAttributeName(context.ast, attribute);

        if (name.length === 0) {
          continue;
        }

        if (seen.has(name)) {
          findings.push(
            createFinding({
              context,
              ruleName: this.name,
              message: `Duplicate prop "${name}" on a JSX element.`,
              location: nodeLocation(context.sourceFile.relativePath, attribute),
              suggestion: 'Remove the duplicate prop; only the last value takes effect.',
            }),
          );
        }

        seen.add(name);
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
