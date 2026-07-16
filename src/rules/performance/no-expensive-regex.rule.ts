import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { nodeLocation } from '../react/jsx-helpers.js';
import { collectRegexPatterns, isCatastrophicRegex } from './perf-helpers.js';

/**
 * Flags regular expressions with nested quantifiers (`(a+)+`, `(a*)*`,
 * `([a-z]+){2,}`) — the classic super-linear backtracking shapes that cause
 * catastrophic ReDoS blow-up. Covers both `/…/` literals and `new RegExp('…')`.
 */
export class NoExpensiveRegexRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-expensive-regex',
        name: 'No expensive regex',
        description: 'Flags regular expressions with catastrophic nested quantifiers.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-expensive-regex',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectRegexPatterns(context.ast, context.ast.root)
      .filter(({ pattern }) => isCatastrophicRegex(pattern))
      .map(({ node }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Regular expression uses a nested quantifier that can backtrack catastrophically.',
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Rewrite the pattern to avoid nested quantifiers, or use a linear-time matcher.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
