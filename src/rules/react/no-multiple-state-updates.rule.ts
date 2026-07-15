import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  findNodesByKinds,
  firstExpressionChild,
  flattenListChildren,
  nodeLocation,
} from './jsx-helpers.js';

const SETTER_CALLEE = /^set[A-Z]/;

/**
 * Flags blocks containing multiple sequential state setter calls, which trigger
 * multiple renders where a single batched update would suffice.
 */
export class NoMultipleStateUpdatesRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-multiple-state-updates',
        name: 'No multiple state updates',
        description: 'Flags multiple sequential state setter calls in the same block.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-multiple-state-updates',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const block of findNodesByKinds(context.ast.root, ['Block'])) {
      const setterCalls = this.directSetterCalls(context, block);

      if (setterCalls.length >= 2) {
        const target = setterCalls[1] ?? setterCalls[0];
        findings.push(
          createFinding({
            context,
            ruleName: this.name,
            message: `${setterCalls.length} sequential state updates in one block may cause extra renders.`,
            location: nodeLocation(context.sourceFile.relativePath, target as NormalizedAstNode),
            suggestion: 'Batch the updates or derive the next state in a single setter call.',
          }),
        );
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private directSetterCalls(context: RuleContext, block: NormalizedAstNode): NormalizedAstNode[] {
    const calls: NormalizedAstNode[] = [];

    for (const statement of flattenListChildren(block)) {
      if (statement.kind !== 'ExpressionStatement') {
        continue;
      }

      const call = statement.children.find((child) => child.kind === 'CallExpression');

      if (!call) {
        continue;
      }

      const callee = firstExpressionChild(call);

      if (callee?.kind === 'Identifier' && SETTER_CALLEE.test(getAstNodeText(context.ast, callee))) {
        calls.push(call);
      }
    }

    return calls;
  }
}
