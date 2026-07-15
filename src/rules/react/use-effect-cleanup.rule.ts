import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  findNodesByKinds,
  getCallArguments,
  getCallCalleeText,
  nodeLocation,
} from './jsx-helpers.js';

const USE_EFFECT_CALLEE = /(^|\.)useEffect$/;
const SUBSCRIPTION_CALL = /(addEventListener|setInterval|setTimeout|requestAnimationFrame|\.subscribe|\.on)\s*\(/;

/**
 * Flags `useEffect` hooks that set up a subscription or timer but return no
 * cleanup function, a common source of memory leaks.
 */
export class UseEffectCleanupRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'react/use-effect-cleanup',
        name: 'useEffect cleanup',
        description: 'Requires cleanup for useEffect subscriptions and timers.',
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactuse-effect-cleanup',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ['CallExpression'])
      .filter((call) => USE_EFFECT_CALLEE.test(getCallCalleeText(context.ast, call)))
      .filter((call) => this.needsCleanup(context, call))
      .map((call) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'This useEffect sets up a subscription or timer but returns no cleanup function.',
          location: nodeLocation(context.sourceFile.relativePath, call),
          suggestion: 'Return a cleanup function that removes the listener, clears the timer, or unsubscribes.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private needsCleanup(context: RuleContext, call: NormalizedAstNode): boolean {
    const callback = getCallArguments(call).find(
      (argument) => argument.kind === 'ArrowFunction' || argument.kind === 'FunctionExpression',
    );

    if (!callback) {
      return false;
    }

    const body = callback.children.find((child) => child.kind === 'Block');

    if (!body) {
      return false;
    }

    const setsUpSubscription = SUBSCRIPTION_CALL.test(getAstNodeText(context.ast, body));
    const hasCleanup = findNodesByKinds(body, ['ReturnStatement']).length > 0;

    return setsUpSubscription && !hasCleanup;
  }
}
