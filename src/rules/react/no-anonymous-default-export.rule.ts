import type { RuleResult } from "../../core/index.js";
import type { NormalizedAstNode } from "../../parser/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult, getAstNodeText } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import {
  findNodesByKinds,
  firstExpressionChild,
  nodeLocation,
} from "./jsx-helpers.js";

const ANONYMOUS_EXPRESSION_KINDS = new Set([
  "ArrowFunction",
  "FunctionExpression",
  "ClassExpression",
  "ObjectLiteralExpression",
]);

const ANONYMOUS_FUNCTION_DEFAULT = /^export\s+default\s+function\s*\*?\s*\(/;
const ANONYMOUS_CLASS_DEFAULT = /^export\s+default\s+class\s*(?:\{|extends\b)/;

/**
 * Flags anonymous default exports (arrow functions, unnamed functions/classes,
 * or object literals). Named components improve debugging, display names, and
 * fast-refresh behavior.
 */
export class NoAnonymousDefaultExportRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-anonymous-default-export",
        name: "No anonymous default export",
        description: "Requires default-exported components to be named.",
        category: RuleCategory.React,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-anonymous-default-export",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = findNodesByKinds(context.ast.root, [
      "ExportAssignment",
      "FunctionDeclaration",
      "ClassDeclaration",
    ])
      .filter((node) => this.isAnonymousDefault(context, node))
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message: "Avoid anonymous default exports.",
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: "Use a named component.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }

  private isAnonymousDefault(
    context: RuleContext,
    node: NormalizedAstNode,
  ): boolean {
    if (node.kind === "ExportAssignment") {
      const expression = firstExpressionChild(node);
      return (
        expression !== undefined &&
        ANONYMOUS_EXPRESSION_KINDS.has(expression.kind)
      );
    }

    const text = getAstNodeText(context.ast, node);

    if (node.kind === "FunctionDeclaration") {
      return ANONYMOUS_FUNCTION_DEFAULT.test(text);
    }

    return ANONYMOUS_CLASS_DEFAULT.test(text);
  }
}
