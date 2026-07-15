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

const FORM_FIELD_TAGS = new Set(['input', 'textarea', 'select']);
const UNLABELLED_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/**
 * Flags form controls (`input`, `textarea`, `select`) that expose no accessible
 * name via a label association or ARIA attribute.
 */
export class FormFieldNameRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/form-field-name',
        name: 'Form field name',
        description: 'Requires form controls to expose an accessible name.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yform-field-name',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const labels = buildLabelIndex(context.ast, context.ast.root);

    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => FORM_FIELD_TAGS.has(element.tag))
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter(
        (element) =>
          !(
            element.tag === 'input' &&
            UNLABELLED_INPUT_TYPES.has(getAttributeStringValue(context.ast, element.header, 'type') ?? '')
          ),
      )
      .filter((element) => !hasAccessibleFieldName(context.ast, element.header, element.container, labels))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `<${element.tag}> has no accessible name.`,
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Associate a <label>, or add an aria-label or aria-labelledby attribute.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
