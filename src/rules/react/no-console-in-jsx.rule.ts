import type { Finding, RuleResult } from "../../core/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult, getAstNodeText } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import { findNodesByKinds, nodeLocation } from "./jsx-helpers.js";

const CONSOLE_CALL = /^console\s*\.\s*[A-Za-z_$][\w$]*\s*\(/;

/**
 * Flags `console.*` calls embedded directly inside JSX expression containers,
 * which are almost always leftover debugging statements.
 */
export class NoConsoleInJsxRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-console-in-jsx",
        name: "No console in JSX",
        description:
          "Disallows console calls inside JSX expression containers.",
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-console-in-jsx",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const byOffset = new Map<number, Finding>();

    for (const expression of findNodesByKinds(context.ast.root, [
      "JsxExpression",
    ])) {
      for (const call of findNodesByKinds(expression, ["CallExpression"])) {
        if (!CONSOLE_CALL.test(getAstNodeText(context.ast, call))) {
          continue;
        }

        if (byOffset.has(call.start.offset)) {
          continue;
        }

        byOffset.set(
          call.start.offset,
          createFinding({
            context,
            ruleName: this.name,
            message: "Avoid console calls inside JSX.",
            location: nodeLocation(context.sourceFile.relativePath, call),
            suggestion:
              "Remove the console call or move it out of the render output.",
          }),
        );
      }
    }

    const findings = [...byOffset.values()];
    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}
