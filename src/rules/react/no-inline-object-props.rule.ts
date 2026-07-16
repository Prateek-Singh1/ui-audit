import type { RuleResult } from "../../core/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import {
  findNodesByKinds,
  getJsxAttributeName,
  getJsxAttributeValue,
  nodeLocation,
} from "./jsx-helpers.js";

/**
 * Flags object literals passed directly as JSX props. A new object identity is
 * created on every render, which can defeat memoization and trigger unnecessary
 * re-renders in child components.
 */
export class NoInlineObjectPropsRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-inline-object-props",
        name: "No inline object props",
        description:
          "Discourages inline object literals passed directly as JSX props.",
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-inline-object-props",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ["JsxAttribute"])
      .filter((attribute) => {
        const value = getJsxAttributeValue(attribute);
        return value?.kind === "ObjectLiteralExpression";
      })
      .map((attribute) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Avoid passing an inline object literal to the "${getJsxAttributeName(context.ast, attribute)}" prop.`,
          location: nodeLocation(context.sourceFile.relativePath, attribute),
          suggestion: "Extract the object into a constant or memoize it.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}
