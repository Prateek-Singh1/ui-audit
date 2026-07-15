import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { flattenListChildren, findNodesByKinds, nodeLocation } from './jsx-helpers.js';

const CONTENT_CHILD_KINDS = new Set([
  'JsxElement',
  'JsxSelfClosingElement',
  'JsxFragment',
  'JsxExpression',
]);

/**
 * Flags fragments that wrap exactly one child, where the fragment adds nothing
 * and the child can be returned directly. Empty fragments are handled by
 * `react/no-empty-fragment`.
 */
export class NoUselessFragmentRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-useless-fragment',
        name: 'No useless fragment',
        description: 'Flags fragments that wrap exactly one child.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-useless-fragment',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['JsxFragment'])
      .filter((fragment) => this.contentChildCount(context, fragment) === 1)
      .map((fragment) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Fragment wraps a single child and can be removed.',
          location: nodeLocation(context.sourceFile.relativePath, fragment),
          suggestion: 'Return the child directly instead of wrapping it in a fragment.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private contentChildCount(context: RuleContext, fragment: NormalizedAstNode): number {
    return flattenListChildren(fragment).filter((child) => {
      if (CONTENT_CHILD_KINDS.has(child.kind)) {
        return true;
      }

      return child.kind === 'JsxText' && getAstNodeText(context.ast, child).trim().length > 0;
    }).length;
  }
}
