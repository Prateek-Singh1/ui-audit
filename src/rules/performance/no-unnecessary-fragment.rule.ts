import type { RuleResult } from "../../core/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import {
  findNodesByKinds,
  getJsxChildren,
  nodeLocation,
} from "../react/jsx-helpers.js";

/**
 * Flags fragments that wrap exactly one child (`<><Child/></>`), including a
 * fragment whose sole child is itself a fragment (redundant nesting). A single
 * child never needs a fragment wrapper and the extra node bloats the tree.
 */
export class NoUnnecessaryFragmentRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "perf/no-unnecessary-fragment",
        name: "No unnecessary fragment",
        description:
          "Flags fragments wrapping a single child or nested redundantly.",
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        // Disabled by default: duplicates `react/no-useless-fragment`. Kept for
        // explicit opt-in and API stability.
        enabledByDefault: false,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-unnecessary-fragment",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ["JsxFragment"])
      .filter((node) => getJsxChildren(node).length === 1)
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message: "Fragment wraps a single child and can be removed.",
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion:
            "Return the child directly instead of wrapping it in a fragment.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}
