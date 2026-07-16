import type { RuleResult } from "../../core/index.js";
import type { NormalizedAstNode } from "../../parser/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import {
  createFinding,
  createRuleResult,
  findAstNodes,
  getAstNodeText,
} from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";

/**
 * Detects JSX returned from array map callbacks without a key prop.
 */
export class ReactKeyRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/missing-key",
        name: "Missing React key",
        description:
          "Detects JSX returned from array map callbacks without a key prop.",
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactmissing-key",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findAstNodes(
      context.ast.root,
      (node) => node.kind === "CallExpression" && this.isMapCall(context, node),
    )
      .map((node) => this.firstReturnedJsxNode(node))
      .filter((node): node is NormalizedAstNode => node !== undefined)
      .filter((node) => !this.hasKeyProp(context, node))
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message:
            "JSX returned from an array map callback should include a stable key prop.",
          location: {
            file: context.sourceFile.relativePath,
            line: node.start.line,
            column: node.start.column,
          },
          suggestion: "Add a stable key prop to the rendered element.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }

  private isMapCall(context: RuleContext, node: NormalizedAstNode): boolean {
    return /\.map\s*\(/.test(getAstNodeText(context.ast, node));
  }

  private firstReturnedJsxNode(
    node: NormalizedAstNode,
  ): NormalizedAstNode | undefined {
    return findFirstNode(
      node,
      (candidate) =>
        candidate.kind === "JsxElement" ||
        candidate.kind === "JsxSelfClosingElement" ||
        candidate.kind === "JsxFragment",
    );
  }

  private hasKeyProp(context: RuleContext, node: NormalizedAstNode): boolean {
    return /\bkey\s*=/.test(getAstNodeText(context.ast, node));
  }
}

const findFirstNode = (
  node: NormalizedAstNode,
  predicate: (node: NormalizedAstNode) => boolean,
): NormalizedAstNode | undefined => {
  if (predicate(node)) {
    return node;
  }

  for (const child of node.children) {
    const match = findFirstNode(child, predicate);

    if (match) {
      return match;
    }
  }

  return undefined;
};
