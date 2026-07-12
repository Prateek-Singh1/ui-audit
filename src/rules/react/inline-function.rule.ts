import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, findAstNodes, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Detects inline function props in JSX.
 */
export class InlineFunctionRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/inline-function-prop',
        name: 'Inline function prop',
        description: 'Detects inline callback functions passed directly to JSX props.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findAstNodes(
      context.ast.root,
      (node) => node.kind === 'JsxAttribute' && this.isInlineFunctionProp(context, node),
    ).map((node) =>
      createFinding({
        context,
        ruleName: this.name,
        message: 'Avoid inline function props in JSX when the callback can be extracted.',
        location: {
          file: context.sourceFile.relativePath,
          line: node.start.line,
          column: node.start.column,
        },
        suggestion: 'Extract the callback to a named function or memoized handler.',
      }),
    );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isInlineFunctionProp(context: RuleContext, node: NormalizedAstNode): boolean {
    const text = getAstNodeText(context.ast, node);

    return /\bon[A-Z][A-Za-z0-9_$]*\s*=\s*{\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*=>/.test(
      text,
    );
  }
}
