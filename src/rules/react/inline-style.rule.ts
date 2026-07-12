import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, findAstNodes, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

/**
 * Detects inline style object literals in JSX.
 */
export class InlineStyleRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/inline-style',
        name: 'Inline style',
        description: 'Detects JSX style props that use inline object literals.',
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
      (node) => node.kind === 'JsxAttribute' && /\bstyle\s*=\s*{\s*{/.test(getAstNodeText(context.ast, node)),
    ).map((node) =>
      createFinding({
        context,
        ruleName: this.name,
        message: 'Avoid inline style object literals in JSX.',
        location: {
          file: context.sourceFile.relativePath,
          line: node.start.line,
          column: node.start.column,
        },
        suggestion: 'Prefer CSS classes, CSS modules, or extracted style constants.',
      }),
    );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
