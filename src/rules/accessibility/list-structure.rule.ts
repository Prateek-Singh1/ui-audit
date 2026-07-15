import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  firstChildOfKind,
  flattenListChildren,
  getJsxTagName,
  nodeLocation,
} from '../react/jsx-helpers.js';

const LIST_TAGS = new Set(['ul', 'ol']);
const DOM_TAG = /^[a-z]/;

/**
 * Flags `<ul>`/`<ol>` lists with direct DOM-element children other than `<li>`.
 * Only lowercase (host) elements are checked so custom components are ignored.
 */
export class ListStructureRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/list-structure',
        name: 'List structure',
        description: 'Flags invalid direct children of <ul>/<ol> lists.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11ylist-structure',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings: Finding[] = [];

    const lists = collectJsxElements(context.ast, context.ast.root).filter(
      (element) => !element.selfClosing && LIST_TAGS.has(element.tag),
    );

    for (const list of lists) {
      for (const child of directElementChildren(list.container)) {
        const tag = this.tagOf(context, child);

        if (DOM_TAG.test(tag) && tag !== 'li') {
          findings.push(
            createFinding({
              context,
              ruleName: this.name,
              message: `<${tag}> is not a valid direct child of a list; use <li>.`,
              location: nodeLocation(context.sourceFile.relativePath, child),
              suggestion: 'Wrap list content in <li> elements.',
            }),
          );
        }
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private tagOf(context: RuleContext, node: NormalizedAstNode): string {
    if (node.kind === 'JsxSelfClosingElement') {
      return getJsxTagName(context.ast, node);
    }

    const opening = firstChildOfKind(node, 'JsxOpeningElement');
    return opening ? getJsxTagName(context.ast, opening) : '';
  }
}

const directElementChildren = (list: NormalizedAstNode): readonly NormalizedAstNode[] => {
  return flattenListChildren(list).filter(
    (child) => child.kind === 'JsxElement' || child.kind === 'JsxSelfClosingElement',
  );
};
