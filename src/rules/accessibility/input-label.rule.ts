import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  getAttributeStringValue,
  hasSpreadAttribute,
  nodeLocation,
} from '../react/jsx-helpers.js';
import { buildLabelIndex, hasAccessibleFieldName } from './a11y-helpers.js';

const UNLABELLED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/**
 * Flags `<input>` elements that are not associated with a label and expose no
 * `aria-label`/`aria-labelledby`.
 */
export class InputLabelRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/input-label',
        name: 'Input label',
        description: 'Requires inputs to have an associated label or ARIA name.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yinput-label',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const labels = buildLabelIndex(context.ast, context.ast.root);

    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'input')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !UNLABELLED_INPUT_TYPES.has(getAttributeStringValue(context.ast, element.header, 'type') ?? ''))
      .filter((element) => !hasAccessibleFieldName(context.ast, element.header, element.container, labels))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<input> has no associated label or accessible name.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Associate a <label>, or add an aria-label or aria-labelledby attribute.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
