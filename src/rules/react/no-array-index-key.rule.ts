import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, getJsxAttributeName, getJsxAttributeValue, nodeLocation } from './jsx-helpers.js';

const INDEX_IDENTIFIER = /\b(?:index|idx|i)\b/;

/**
 * Flags React `key` props whose value is derived from an array index.
 *
 * Using the array index as a key defeats React's reconciliation when list items
 * are reordered, inserted, or removed.
 */
export class NoArrayIndexKeyRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-array-index-key',
        name: 'No array index key',
        description: 'Disallows using an array index as a React list key.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react/no-array-index-key.md',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['JsxAttribute'])
      .filter((attribute) => getJsxAttributeName(context.ast, attribute) === 'key')
      .filter((attribute) => this.usesArrayIndex(context, attribute))
      .map((attribute) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Avoid using the array index as a React key.',
          location: nodeLocation(context.sourceFile.relativePath, attribute),
          suggestion: 'Use a stable unique identifier instead of the array index.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private usesArrayIndex(context: RuleContext, attribute: NormalizedAstNode): boolean {
    const value = getJsxAttributeValue(attribute);

    if (!value) {
      return false;
    }

    return INDEX_IDENTIFIER.test(getAstNodeText(context.ast, value));
  }
}
