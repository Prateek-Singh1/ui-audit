import type { Finding, RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  findNodesByKinds,
  getJsxAttributeName,
  getJsxAttributeValue,
  getJsxAttributes,
  getJsxTagName,
  nodeLocation,
} from './jsx-helpers.js';

const COMPONENT_TAG = /^[A-Z]/;
const INLINE_FUNCTION_KINDS = new Set(['ArrowFunction', 'FunctionExpression']);

/**
 * Flags inline function callbacks passed as props to component elements
 * (capitalized tags). Such callbacks get a new identity on every render and
 * defeat `React.memo`; a `useCallback`-memoized handler is usually preferable.
 */
export class PreferUseCallbackRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/prefer-use-callback',
        name: 'Prefer useCallback',
        description: 'Suggests useCallback for inline function props passed to components.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactprefer-use-callback',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    for (const element of findNodesByKinds(context.ast.root, ['JsxOpeningElement', 'JsxSelfClosingElement'])) {
      if (!COMPONENT_TAG.test(getJsxTagName(context.ast, element))) {
        continue;
      }

      for (const attribute of getJsxAttributes(element)) {
        const value = getJsxAttributeValue(attribute);

        if (value && INLINE_FUNCTION_KINDS.has(value.kind)) {
          findings.push(
            createFinding({
              context,
              ruleName: this.name,
              message: `Inline function passed to the "${getJsxAttributeName(context.ast, attribute)}" prop of a component.`,
              location: nodeLocation(context.sourceFile.relativePath, attribute),
              suggestion: 'Wrap the callback in useCallback so memoized children do not re-render.',
            }),
          );
        }
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}
