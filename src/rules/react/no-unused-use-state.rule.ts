import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstDocument, NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  findNodesByKinds,
  firstChildOfKind,
  flattenListChildren,
  getCallCalleeText,
  nodeLocation,
} from './jsx-helpers.js';

const USE_STATE_CALLEE = /(^|\.)useState$/;
const LEADING_IDENTIFIER = /^([A-Za-z_$][\w$]*)/;

/**
 * Flags `useState` declarations where the value or setter is never referenced.
 * Unused state is dead code and usually signals an incomplete refactor.
 */
export class NoUnusedUseStateRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/no-unused-use-state',
        name: 'No unused useState',
        description: 'Flags useState values or setters that are never used.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-unused-use-state',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const frequency = identifierFrequency(context.ast);
    const findings: Finding[] = [];

    for (const declaration of findNodesByKinds(context.ast.root, ['VariableDeclaration'])) {
      const binding = firstChildOfKind(declaration, 'ArrayBindingPattern');
      const initializer = declaration.children.find((child) => child.kind === 'CallExpression');

      if (!binding || !initializer || !USE_STATE_CALLEE.test(getCallCalleeText(context.ast, initializer))) {
        continue;
      }

      const names = bindingNames(context.ast, binding);
      const roles = ['state value', 'state setter'];

      names.forEach((name, index) => {
        if (!name || name.startsWith('_')) {
          return;
        }

        if ((frequency.get(name) ?? 0) <= 1) {
          findings.push(
            createFinding({
              context,
              ruleName: this.name,
              message: `The ${roles[index] ?? 'binding'} "${name}" from useState is never used.`,
              location: nodeLocation(context.sourceFile.relativePath, declaration),
              suggestion: 'Remove unused state or rename intentionally unused variables with a leading underscore.',
            }),
          );
        }
      });
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }
}

const bindingNames = (ast: NormalizedAstDocument, binding: NormalizedAstNode): string[] => {
  const elements = flattenListChildren(binding).filter((child) => child.kind === 'BindingElement');
  return elements.map((element) => LEADING_IDENTIFIER.exec(getAstNodeText(ast, element).trim())?.[1] ?? '');
};

const identifierFrequency = (ast: NormalizedAstDocument): ReadonlyMap<string, number> => {
  const frequency = new Map<string, number>();

  for (const identifier of findNodesByKinds(ast.root, ['Identifier'])) {
    const name = getAstNodeText(ast, identifier);
    frequency.set(name, (frequency.get(name) ?? 0) + 1);
  }

  return frequency;
};
