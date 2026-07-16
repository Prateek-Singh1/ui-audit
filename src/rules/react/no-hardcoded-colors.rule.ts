import type { RuleResult } from "../../core/index.js";
import type { RuleContext } from "../../rule-engine/index.js";
import { BaseRule } from "../base-rule.js";
import { RuleCategory } from "../categories.js";
import { createFinding, createRuleResult, getAstNodeText } from "../helpers.js";
import { defineRuleMetadata } from "../metadata.js";
import { RuleSeverity } from "../severity.js";
import {
  findNodesByKinds,
  getJsxAttributeName,
  getJsxAttributeValue,
  nodeLocation,
} from "./jsx-helpers.js";

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOR = /^(?:rgb|rgba|hsl|hsla)\s*\(/i;
const NAMED_COLORS = new Set([
  "red",
  "blue",
  "green",
  "black",
  "white",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "brown",
  "gold",
  "silver",
  "navy",
  "teal",
  "lime",
  "maroon",
  "olive",
  "aqua",
  "fuchsia",
]);

/**
 * Flags hardcoded color values inside inline `style` objects. Colors should come
 * from design tokens or CSS variables so themes stay consistent.
 */
export class NoHardcodedColorsRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-hardcoded-colors",
        name: "No hardcoded colors",
        description:
          "Disallows hardcoded color values in inline style objects.",
        category: RuleCategory.React,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-hardcoded-colors",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const styleObjects = findNodesByKinds(context.ast.root, ["JsxAttribute"])
      .filter(
        (attribute) => getJsxAttributeName(context.ast, attribute) === "style",
      )
      .map((attribute) => getJsxAttributeValue(attribute))
      .filter(
        (value): value is NonNullable<typeof value> =>
          value?.kind === "ObjectLiteralExpression",
      );

    const findings = styleObjects
      .flatMap((object) => findNodesByKinds(object, ["StringLiteral"]))
      .filter((literal) =>
        isHardcodedColor(getAstNodeText(context.ast, literal)),
      )
      .map((literal) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `Avoid the hardcoded color value ${getAstNodeText(context.ast, literal)} in inline styles.`,
          location: nodeLocation(context.sourceFile.relativePath, literal),
          suggestion: "Use design tokens or CSS variables.",
        }),
      );

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }
}

const isHardcodedColor = (rawLiteral: string): boolean => {
  const value = rawLiteral.replace(/^['"`]|['"`]$/g, "").trim();

  if (value.length === 0) {
    return false;
  }

  return (
    HEX_COLOR.test(value) ||
    FUNCTIONAL_COLOR.test(value) ||
    NAMED_COLORS.has(value.toLowerCase())
  );
};
