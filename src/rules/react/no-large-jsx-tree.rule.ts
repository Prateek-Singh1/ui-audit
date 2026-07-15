import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { JSX_ELEMENT_KINDS, findJsxRoots, findNodesByKinds, nodeLocation } from './jsx-helpers.js';

const DEFAULT_MAX_NODES = 40;

/**
 * Flags JSX trees whose element count exceeds a configurable threshold
 * (`maxNodes`, default {@link DEFAULT_MAX_NODES}). Deeply nested markup is a
 * strong signal that a component should be decomposed.
 */
export class NoLargeJsxTreeRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-large-jsx-tree',
        name: 'No large JSX tree',
        description: 'Flags JSX trees that exceed a configurable element-count threshold.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-large-jsx-tree',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxNodes = readPositiveInteger(context.config.maxNodes, DEFAULT_MAX_NODES);

    const findings = findJsxRoots(context.ast.root)
      .map((root) => ({ root, size: findNodesByKinds(root, JSX_ELEMENT_KINDS).length }))
      .filter(({ size }) => size > maxNodes)
      .map(({ root, size }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `JSX tree has ${size} elements (limit is ${maxNodes}).`,
          location: nodeLocation(context.sourceFile.relativePath, root),
          suggestion: 'Break the markup into smaller components.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}

const readPositiveInteger = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
};
