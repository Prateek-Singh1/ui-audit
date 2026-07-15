import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  firstChildOfKind,
  flattenListChildren,
  getJsxAttributes,
  getJsxTagName,
  nodeLocation,
} from './jsx-helpers.js';

const WRAPPER_ELEMENT_KINDS = new Set(['JsxElement', 'JsxSelfClosingElement', 'JsxFragment']);

/**
 * Flags attribute-free `<div>` wrappers that only group multiple children. Such
 * wrappers add a redundant DOM node where a Fragment would preserve layout.
 */
export class PreferFragmentRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/prefer-fragment',
        name: 'Prefer fragment',
        description: 'Suggests a Fragment instead of an attribute-free wrapper div.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react/prefer-fragment.md',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findJsxElements(context.ast.root)
      .filter((element) => this.isRedundantDivWrapper(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'A wrapper <div> with no props could be a Fragment.',
          location: nodeLocation(context.sourceFile.relativePath, element),
          suggestion: 'Use a Fragment (<>...</>) to avoid an unnecessary DOM node.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isRedundantDivWrapper(context: RuleContext, element: NormalizedAstNode): boolean {
    const opening = firstChildOfKind(element, 'JsxOpeningElement');

    if (!opening || getJsxTagName(context.ast, opening) !== 'div') {
      return false;
    }

    if (getJsxAttributes(opening).length > 0) {
      return false;
    }

    const elementChildren = flattenListChildren(element).filter((child) =>
      WRAPPER_ELEMENT_KINDS.has(child.kind),
    );
    return elementChildren.length >= 2;
  }
}

const findJsxElements = (root: NormalizedAstNode): readonly NormalizedAstNode[] => {
  const matches: NormalizedAstNode[] = [];

  const visit = (node: NormalizedAstNode): void => {
    if (node.kind === 'JsxElement') {
      matches.push(node);
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(root);
  return matches;
};
