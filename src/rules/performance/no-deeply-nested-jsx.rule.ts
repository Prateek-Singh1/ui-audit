import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findJsxRoots, nodeLocation } from '../react/jsx-helpers.js';
import { readPositiveInteger } from './perf-helpers.js';

const DEFAULT_MAX_DEPTH = 6;
const JSX_CONTAINER_KINDS = new Set(['JsxElement', 'JsxFragment', 'JsxSelfClosingElement']);

/**
 * Flags JSX whose element nesting depth exceeds `maxDepth` (default
 * {@link DEFAULT_MAX_DEPTH}). Deeply nested markup is hard to read and usually
 * indicates a component that should be decomposed. One finding is reported per
 * top-level JSX tree, anchored at the first element that breaches the limit.
 */
export class NoDeeplyNestedJsxRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-deeply-nested-jsx',
        name: 'No deeply nested JSX',
        description: 'Warns when JSX nesting depth exceeds a configurable limit.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-deeply-nested-jsx',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxDepth = readPositiveInteger(context.config.maxDepth, DEFAULT_MAX_DEPTH);

    const findings = findJsxRoots(context.ast.root)
      .map((root) => firstViolation(root, maxDepth))
      .filter((node): node is NormalizedAstNode => node !== undefined)
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `JSX nesting exceeds the configured depth of ${maxDepth}.`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Extract nested markup into smaller child components.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}

/**
 * Returns the shallowest JSX node whose nesting depth exceeds {@link maxDepth},
 * or `undefined` when the tree stays within the limit. Depth increments only for
 * JSX element/fragment nodes, so intermediate syntax nodes do not inflate it.
 */
const firstViolation = (
  root: NormalizedAstNode,
  maxDepth: number,
): NormalizedAstNode | undefined => {
  let found: NormalizedAstNode | undefined;

  const walk = (node: NormalizedAstNode, depth: number): void => {
    if (found) {
      return;
    }

    const isJsx = JSX_CONTAINER_KINDS.has(node.kind);
    const nextDepth = isJsx ? depth + 1 : depth;

    if (isJsx && nextDepth > maxDepth) {
      found = node;
      return;
    }

    for (const child of node.children) {
      walk(child, nextDepth);
    }
  };

  walk(root, 0);
  return found;
};
