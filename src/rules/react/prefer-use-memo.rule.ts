import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  FUNCTION_KINDS,
  containsJsx,
  findNodesByKinds,
  getCallCalleeText,
  isTokenLike,
  nodeLocation,
} from './jsx-helpers.js';

const ARRAY_TRANSFORM = /\.(map|filter|reduce|flatMap|sort|concat)$/;

/**
 * Flags expensive object/array creation performed directly during render inside
 * a component. These values are rebuilt on every render and are good candidates
 * for `useMemo`.
 */
export class PreferUseMemoRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/prefer-use-memo',
        name: 'Prefer useMemo',
        description: 'Suggests useMemo for expensive object/array creation during render.',
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactprefer-use-memo',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const components = findNodesByKinds(context.ast.root, FUNCTION_KINDS).filter((node) => containsJsx(node));
    const byOffset = new Map<number, Finding>();

    for (const component of components) {
      for (const declaration of findNodesByKinds(component, ['VariableDeclaration'])) {
        const initializer = initializerOf(declaration);

        if (!initializer || !this.isExpensiveCreation(context, initializer)) {
          continue;
        }

        if (byOffset.has(declaration.start.offset)) {
          continue;
        }

        byOffset.set(
          declaration.start.offset,
          createFinding({
            context,
            ruleName: this.name,
            message: 'Expensive value created during render; consider memoizing it.',
            location: nodeLocation(context.sourceFile.relativePath, declaration),
            suggestion: 'Wrap the computation in useMemo so it is not recreated on every render.',
          }),
        );
      }
    }

    const findings = [...byOffset.values()];
    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private isExpensiveCreation(context: RuleContext, initializer: NormalizedAstNode): boolean {
    if (initializer.kind === 'ObjectLiteralExpression' || initializer.kind === 'ArrayLiteralExpression') {
      return true;
    }

    if (initializer.kind === 'CallExpression') {
      return ARRAY_TRANSFORM.test(getCallCalleeText(context.ast, initializer));
    }

    return false;
  }
}

const initializerOf = (declaration: NormalizedAstNode): NormalizedAstNode | undefined => {
  const assignmentIndex = declaration.children.findIndex((child) => child.kind === 'FirstAssignment');

  if (assignmentIndex < 0) {
    return undefined;
  }

  return declaration.children.slice(assignmentIndex + 1).find((child) => !isTokenLike(child.kind));
};
