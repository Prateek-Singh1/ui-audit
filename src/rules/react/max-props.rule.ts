import type { RuleResult } from "../../core/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import {
  findNodesByKinds,
  getJsxAttributes,
  getJsxTagName,
  nodeLocation,
} from "./jsx-helpers.js";

const MAX_PROPS = 10;

/**
 * Flags JSX elements that receive more than {@link MAX_PROPS} props, which often
 * signals a component that is doing too much and should be decomposed.
 */
export class MaxPropsRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/max-props",
        name: "Max props",
        description: `Warns when a component receives more than ${MAX_PROPS} props.`,
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactmax-props",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, [
      "JsxOpeningElement",
      "JsxSelfClosingElement",
    ])
      .map((element) => ({ element, count: getJsxAttributes(element).length }))
      .filter(({ count }) => count > MAX_PROPS)
      .map(({ element, count }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `"${getJsxTagName(context.ast, element)}" receives ${count} props (limit is ${MAX_PROPS}).`,
          location: nodeLocation(context.sourceFile.relativePath, element),
          suggestion: "Split the component or use composition.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}
