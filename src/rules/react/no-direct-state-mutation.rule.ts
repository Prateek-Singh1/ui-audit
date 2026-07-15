import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, firstExpressionChild, getCallCalleeText, nodeLocation } from './jsx-helpers.js';

const MUTATING_METHOD = /\.(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/;
const SAFE_ASSIGNMENT_TARGET = /^(this\b|.*\.current$)/;

/**
 * Flags direct mutation of objects or arrays: nested property assignment and
 * in-place array mutation methods. React state must be updated immutably.
 */
export class NoDirectStateMutationRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-direct-state-mutation',
        name: 'No direct state mutation',
        description: 'Disallows in-place mutation of objects and arrays.',
        category: RuleCategory.React,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-direct-state-mutation',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [
      ...this.findPropertyAssignments(context),
      ...this.findMutatingCalls(context),
    ];

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private findPropertyAssignments(context: RuleContext): Finding[] {
    return findNodesByKinds(context.ast.root, ['BinaryExpression'])
      .filter((node) => this.isPropertyAssignment(context, node))
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Avoid mutating objects directly; update state immutably instead.',
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Create a new object/array instead of mutating the existing one.',
        }),
      );
  }

  private findMutatingCalls(context: RuleContext): Finding[] {
    return findNodesByKinds(context.ast.root, ['CallExpression'])
      .filter((call) => MUTATING_METHOD.test(getCallCalleeText(context.ast, call)))
      .map((call) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Avoid mutating arrays in place; produce a new array instead.',
          location: nodeLocation(context.sourceFile.relativePath, call),
          suggestion: 'Use non-mutating operations such as spread, map, filter, or concat.',
        }),
      );
  }

  private isPropertyAssignment(context: RuleContext, node: NormalizedAstNode): boolean {
    const hasAssignment = node.children.some((child) => child.kind === 'FirstAssignment');

    if (!hasAssignment) {
      return false;
    }

    const target = firstExpressionChild(node);

    if (!target || (target.kind !== 'PropertyAccessExpression' && target.kind !== 'ElementAccessExpression')) {
      return false;
    }

    return !SAFE_ASSIGNMENT_TARGET.test(getAstNodeText(context.ast, target).trim());
  }
}
