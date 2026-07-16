import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, nodeLocation } from '../react/jsx-helpers.js';
import { countObjectProperties, readPositiveInteger } from './perf-helpers.js';

const DEFAULT_MAX_PROPERTIES = 20;

/**
 * Flags object literals whose direct property count exceeds `maxProperties`
 * (default {@link DEFAULT_MAX_PROPERTIES}). Large literals allocated inline can
 * signal data that belongs in a module constant or an external resource.
 */
export class NoLargeObjectLiteralRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-large-object-literal',
        name: 'No large object literal',
        description: 'Flags object literals that exceed a configurable property count.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-large-object-literal',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxProperties = readPositiveInteger(context.config.maxProperties, DEFAULT_MAX_PROPERTIES);

    const findings = findNodesByKinds(context.ast.root, ['ObjectLiteralExpression'])
      .map((node) => ({ node, count: countObjectProperties(node) }))
      .filter(({ count }) => count > maxProperties)
      .map(({ node, count }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Object literal declares ${count} properties (limit is ${maxProperties}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Extract the literal to a module constant or load it as data.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
