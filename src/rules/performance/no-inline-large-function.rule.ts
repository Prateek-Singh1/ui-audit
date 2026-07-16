import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  findNodesByKinds,
  getCallArguments,
  getJsxAttributeValue,
  getJsxAttributes,
  nodeLocation,
} from '../react/jsx-helpers.js';
import { isFunctionLiteral, lineSpan, readPositiveInteger } from './perf-helpers.js';

const DEFAULT_MAX_LINES = 20;

/**
 * Flags inline callbacks — arrow/function expressions passed as call arguments
 * or JSX prop values — that span more than `maxLines` lines (default
 * {@link DEFAULT_MAX_LINES}). Large inline functions are re-created on every
 * evaluation and hurt readability; extracting them enables memoization.
 */
export class NoInlineLargeFunctionRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-inline-large-function',
        name: 'No inline large function',
        description: 'Flags inline callbacks that exceed a configurable line limit.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-inline-large-function',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxLines = readPositiveInteger(context.config.maxLines, DEFAULT_MAX_LINES);

    const byOffset = new Map<number, NormalizedAstNode>();

    for (const call of findNodesByKinds(context.ast.root, ['CallExpression', 'NewExpression'])) {
      for (const arg of getCallArguments(call)) {
        if (isFunctionLiteral(arg)) {
          byOffset.set(arg.start.offset, arg);
        }
      }
    }

    for (const header of findNodesByKinds(context.ast.root, [
      'JsxOpeningElement',
      'JsxSelfClosingElement',
    ])) {
      for (const attribute of getJsxAttributes(header)) {
        const value = getJsxAttributeValue(attribute);

        if (value && isFunctionLiteral(value)) {
          byOffset.set(value.start.offset, value);
        }
      }
    }

    const findings = [...byOffset.values()]
      .map((node) => ({ node, lines: lineSpan(node) }))
      .filter(({ lines }) => lines > maxLines)
      .sort((a, b) => a.node.start.offset - b.node.start.offset)
      .map(({ node, lines }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Inline callback spans ${lines} lines (limit is ${maxLines}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Extract the callback to a named function, and memoize it if needed.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
