import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { FUNCTION_KINDS, containsJsx, findNodesByKinds, nodeLocation } from './jsx-helpers.js';

const DEFAULT_MAX_LINES = 150;

/**
 * Flags component functions that exceed a configurable line limit (`maxLines`,
 * default {@link DEFAULT_MAX_LINES}). Only the outermost component is reported so
 * nested render helpers are not double-counted.
 */
export class MaxComponentLinesRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/max-component-lines',
        name: 'Max component lines',
        description: 'Flags component functions that exceed a configurable line limit.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactmax-component-lines',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxLines = readPositiveInteger(context.config.maxLines, DEFAULT_MAX_LINES);

    const components = findNodesByKinds(context.ast.root, FUNCTION_KINDS).filter((node) => containsJsx(node));
    const outermost = components.filter(
      (node) =>
        !components.some(
          (other) =>
            other !== node &&
            other.start.offset <= node.start.offset &&
            other.end.offset >= node.end.offset,
        ),
    );

    const findings = outermost
      .map((node) => ({ node, lines: lineCount(node) }))
      .filter(({ lines }) => lines > maxLines)
      .map(({ node, lines }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Component spans ${lines} lines (limit is ${maxLines}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Split the component into smaller components or extract logic into hooks.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}

const lineCount = (node: NormalizedAstNode): number => {
  return node.end.line - node.start.line + 1;
};

const readPositiveInteger = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
};
