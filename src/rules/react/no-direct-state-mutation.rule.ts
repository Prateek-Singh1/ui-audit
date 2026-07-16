import type { Finding, RuleResult } from "../../core/index.js";
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
  getCallCalleeText,
  nodeLocation,
} from "./jsx-helpers.js";

const MUTATING_METHOD =
  /\.(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/;
const SAFE_ASSIGNMENT_TARGET = /^(this\b|.*\.current$)/;
const STATE_HOOK_CALLEE = /(^|\.)(useState|useReducer)$/;

/**
 * Flags direct mutation of React state: nested property assignment and in-place
 * array mutation on a value obtained from `useState`/`useReducer`. React state
 * must be updated immutably.
 *
 * Detection is scoped to identifiers bound by a state hook (the first element of
 * a `const [value, setValue] = useState(...)` destructuring) so ordinary,
 * legitimate mutation of local variables and props is not flagged.
 */
export class NoDirectStateMutationRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: "react/no-direct-state-mutation",
        name: "No direct state mutation",
        description: "Disallows in-place mutation of objects and arrays.",
        category: RuleCategory.React,
        severity: RuleSeverity.Error,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          "https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/react.md#reactno-direct-state-mutation",
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const stateNames = this.collectStateNames(context);

    if (stateNames.size === 0) {
      return createRuleResult(this.metadata, "passed", []);
    }

    const findings: Finding[] = [
      ...this.findPropertyAssignments(context, stateNames),
      ...this.findMutatingCalls(context, stateNames),
    ];

    return createRuleResult(
      this.metadata,
      findings.length > 0 ? "failed" : "passed",
      findings,
    );
  }

  /**
   * Collects the value identifiers bound by `useState`/`useReducer`, i.e. the
   * first element of a `const [value, setValue] = useState(...)` destructuring.
   */
  private collectStateNames(context: RuleContext): Set<string> {
    const names = new Set<string>();

    for (const declaration of findNodesByKinds(context.ast.root, [
      "VariableDeclaration",
    ])) {
      const binding = declaration.children.find(
        (child) => child.kind === "ArrayBindingPattern",
      );
      const initializer = declaration.children.find(
        (child) => child.kind === "CallExpression",
      );

      if (!binding || !initializer) {
        continue;
      }

      if (
        !STATE_HOOK_CALLEE.test(getCallCalleeText(context.ast, initializer))
      ) {
        continue;
      }

      const valueIdentifier = findNodesByKinds(binding, ["Identifier"])[0];

      if (valueIdentifier) {
        names.add(getAstNodeText(context.ast, valueIdentifier));
      }
    }

    return names;
  }

  private findPropertyAssignments(
    context: RuleContext,
    stateNames: Set<string>,
  ): Finding[] {
    return findNodesByKinds(context.ast.root, ["BinaryExpression"])
      .filter((node) =>
        this.isStatePropertyAssignment(context, node, stateNames),
      )
      .map((node) =>
        createFinding({
          context,
          ruleName: this.name,
          message:
            "Avoid mutating state directly; update it immutably instead.",
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion:
            "Create a new object/array and pass it to the state setter.",
        }),
      );
  }

  private findMutatingCalls(
    context: RuleContext,
    stateNames: Set<string>,
  ): Finding[] {
    return findNodesByKinds(context.ast.root, ["CallExpression"])
      .filter((call) => {
        const callee = getCallCalleeText(context.ast, call);
        return (
          MUTATING_METHOD.test(callee) && stateNames.has(baseIdentifier(callee))
        );
      })
      .map((call) =>
        createFinding({
          context,
          ruleName: this.name,
          message:
            "Avoid mutating state arrays in place; produce a new array instead.",
          location: nodeLocation(context.sourceFile.relativePath, call),
          suggestion:
            "Use non-mutating operations such as spread, map, filter, or concat.",
        }),
      );
  }

  private isStatePropertyAssignment(
    context: RuleContext,
    node: NormalizedAstNode,
    stateNames: Set<string>,
  ): boolean {
    const hasAssignment = node.children.some(
      (child) => child.kind === "FirstAssignment",
    );

    if (!hasAssignment) {
      return false;
    }

    const target = firstExpressionChild(node);

    if (
      !target ||
      (target.kind !== "PropertyAccessExpression" &&
        target.kind !== "ElementAccessExpression")
    ) {
      return false;
    }

    const targetText = getAstNodeText(context.ast, target).trim();

    return (
      !SAFE_ASSIGNMENT_TARGET.test(targetText) &&
      stateNames.has(baseIdentifier(targetText))
    );
  }
}

/** Returns the leading identifier of a member/index/call access expression. */
const baseIdentifier = (text: string): string => {
  return text.split(/[.[(]/)[0]!.trim();
};
