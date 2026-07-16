import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, nodeLocation } from '../react/jsx-helpers.js';

const STORAGE_OBJECTS = ['localStorage', 'sessionStorage'];

/**
 * Flags synchronous Web Storage access (`localStorage` / `sessionStorage`).
 * These APIs block the main thread and are especially costly when executed
 * during render or other frequently invoked code paths.
 */
export class NoSyncStorageRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-sync-storage',
        name: 'No synchronous storage',
        description: 'Flags synchronous localStorage/sessionStorage access.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-sync-storage',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, [
      'PropertyAccessExpression',
      'ElementAccessExpression',
    ])
      .filter((node) => this.accessesStorage(context, node))
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message: 'Synchronous storage access blocks the main thread.',
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion:
            'Read the value once outside hot paths, or move persistence to an async/cached layer.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private accessesStorage(context: RuleContext, node: NormalizedAstNode): boolean {
    const objectNode = node.children.find((child) => !isPunctuation(child.kind));

    if (!objectNode) {
      return false;
    }

    const objectText = getAstNodeText(context.ast, objectNode);
    return STORAGE_OBJECTS.some(
      (name) => objectText === name || objectText.endsWith(`.${name}`),
    );
  }
}

const isPunctuation = (kind: string): boolean => /Token$/.test(kind);
