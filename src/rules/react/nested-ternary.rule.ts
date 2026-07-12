import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import {
  createFinding,
  createRuleResult,
  findAstNodes,
  hasAstDescendantKind,
} from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Detects nested conditional expressions.
 */
export class NestedTernaryRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/nested-ternary',
        name: 'Nested ternary',
        description: 'Detects nested conditional expressions in React source files.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findAstNodes(
      context.ast.root,
      (node) => node.kind === 'ConditionalExpression' && hasAstDescendantKind(node, 'ConditionalExpression'),
    ).map((node) =>
      createFinding({
        context,
        ruleName: this.name,
        message: 'Avoid nested ternary expressions because they are difficult to read.',
        location: {
          file: context.sourceFile.relativePath,
          line: node.start.line,
          column: node.start.column,
        },
        suggestion: 'Extract the conditional branches into named variables or helper functions.',
      }),
    );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
