import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { collectJsxElements, nodeLocation, type JsxElementInfo } from '../react/jsx-helpers.js';

/**
 * Flags data tables that declare no `<th>` header cells, leaving screen-reader
 * users without column/row context.
 */
export class TableHeaderRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/table-header',
        name: 'Table header',
        description: 'Requires tables to include header cells (<th>).',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11ytable-header',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'table')
      .filter((element) => !this.hasHeaderCell(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<table> has no <th> header cells.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add <th> elements (with an appropriate scope) for table headers.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private hasHeaderCell(context: RuleContext, table: JsxElementInfo): boolean {
    return collectJsxElements(context.ast, table.container).some((child) => child.tag === 'th');
  }
}
