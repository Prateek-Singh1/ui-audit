import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, flattenListChildren, nodeLocation } from './jsx-helpers.js';

const SUBSTANTIVE_CHILD_KINDS = new Set([
  'JsxElement',
  'JsxSelfClosingElement',
  'JsxFragment',
  'JsxExpression',
]);

/**
 * Flags empty JSX fragments (`<></>`) that wrap no content and can be removed.
 */
export class NoEmptyFragmentRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-empty-fragment',
        name: 'No empty fragment',
        description: 'Disallows empty JSX fragments that wrap no content.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react/no-empty-fragment.md',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['JsxFragment'])
      .filter((fragment) => this.isEmpty(context, fragment))
      .map((fragment) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Remove the empty fragment because it wraps no content.',
          location: nodeLocation(context.sourceFile.relativePath, fragment),
          suggestion: 'Remove unnecessary fragments.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isEmpty(context: RuleContext, fragment: NormalizedAstNode): boolean {
    return !flattenListChildren(fragment).some((child) => {
      if (SUBSTANTIVE_CHILD_KINDS.has(child.kind)) {
        return true;
      }

      return child.kind === 'JsxText' && getAstNodeText(context.ast, child).trim().length > 0;
    });
  }
}
