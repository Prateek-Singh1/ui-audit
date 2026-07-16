import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, nodeLocation } from '../react/jsx-helpers.js';
import { countArrayElements, readPositiveInteger } from './perf-helpers.js';

const DEFAULT_MAX_LENGTH = 50;

/**
 * Flags array literals whose element count exceeds `maxLength` (default
 * {@link DEFAULT_MAX_LENGTH}). Large inline arrays are usually static data that
 * belongs in a constant, a JSON file, or a fetched resource.
 */
export class NoLargeArrayLiteralRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-large-array-literal',
        name: 'No large array literal',
        description: 'Flags array literals that exceed a configurable length.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-large-array-literal',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxLength = readPositiveInteger(context.config.maxLength, DEFAULT_MAX_LENGTH);

    const findings = findNodesByKinds(context.ast.root, ['ArrayLiteralExpression'])
      .map((node) => ({ node, count: countArrayElements(node) }))
      .filter(({ count }) => count > maxLength)
      .map(({ node, count }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Array literal has ${count} elements (limit is ${maxLength}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Move the data to a constant, JSON file, or fetched resource.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
