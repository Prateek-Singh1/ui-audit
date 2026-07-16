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
  nodeLocation,
} from "./jsx-helpers.js";

/**
 * Flags use of the `dangerouslySetInnerHTML` prop, which injects raw HTML and
 * is a common source of cross-site scripting vulnerabilities.
 */
export class NoDangerouslySetInnerHtmlRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-dangerously-set-inner-html",
        name: "No dangerouslySetInnerHTML",
        description:
          "Disallows the dangerouslySetInnerHTML prop to reduce XSS risk.",
        category: RuleCategory.React,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-dangerously-set-inner-html",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, ["JsxAttribute"])
      .filter(
        (attribute) =>
          getJsxAttributeName(context.ast, attribute) ===
          "dangerouslySetInnerHTML",
      )
      .map((attribute) =>
        createFinding({
          context,
          ruleName: this.name,
          message:
            "Avoid dangerouslySetInnerHTML because it can introduce XSS vulnerabilities.",
          location: nodeLocation(context.sourceFile.relativePath, attribute),
          suggestion: "Avoid injecting raw HTML unless absolutely necessary.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}
