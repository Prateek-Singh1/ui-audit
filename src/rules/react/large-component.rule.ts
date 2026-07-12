import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, findAstNodes, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';

const MAX_COMPONENT_LINES = 300;

/**
 * Detects React components that exceed the configured line threshold.
 */
export class LargeComponentRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/large-component',
        name: 'Large React component',
        description: 'Detects React components that exceed 300 lines.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const candidates = findAstNodes(
      context.ast.root,
      (node) => node.kind === 'FunctionDeclaration' || node.kind === 'VariableStatement',
    );
    const findings = candidates
      .map((node) => this.toComponentCandidate(context, node))
      .filter((candidate): candidate is ComponentCandidate => candidate !== undefined)
      .filter((candidate) => candidate.lineCount > MAX_COMPONENT_LINES)
      .map((candidate) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `React component "${candidate.name}" is ${candidate.lineCount} lines long.`,
          location: {
            file: context.sourceFile.relativePath,
            line: candidate.node.start.line,
            column: candidate.node.start.column,
          },
          suggestion: 'Split large components into smaller components or extract complex logic.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private toComponentCandidate(
    context: RuleContext,
    node: NormalizedAstNode,
  ): ComponentCandidate | undefined {
    const text = getAstNodeText(context.ast, node);
    const name = getComponentName(text);

    if (!name || !/^[A-Z]/.test(name) || !containsJsx(text)) {
      return undefined;
    }

    return {
      name,
      node,
      lineCount: node.end.line - node.start.line + 1,
    };
  }
}

interface ComponentCandidate {
  readonly name: string;
  readonly node: NormalizedAstNode;
  readonly lineCount: number;
}

const getComponentName = (text: string): string | undefined => {
  return (
    text.match(/\bfunction\s+([A-Z][A-Za-z0-9_$]*)\b/)?.[1] ??
    text.match(/\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=/)?.[1]
  );
};

const containsJsx = (text: string): boolean => {
  return /<[A-Z_a-z][^>]*>/.test(text) || /<[A-Z_a-z][^>]\/>/.test(text);
};
