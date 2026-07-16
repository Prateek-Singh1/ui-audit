import { describe, expect, it } from "vitest";
import { RuleRegistry } from "../src/core/index.js";
import { Language, type NormalizedAstDocument } from "../src/parser/index.js";
import {
  AlwaysFailRule,
  AlwaysPassRule,
  BaseRule,
  NoOpRule,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RuleCategory,
  RuleEngine,
  RuleSdkSeverity,
  createFinding,
  createRule,
  createRuleResult,
  defineRuleMetadata,
  timeExecution,
  toCoreSeverity,
  validateRuleMetadata,
  type RuleEngineRuleContext,
  type RuleMetadata,
} from "../src/index.js";

describe("rule SDK metadata", () => {
  it("creates typed rule metadata", () => {
    const metadata = defineRuleMetadata({
      id: "sdk/sample",
      name: "SDK sample",
      description: "Validates SDK metadata creation.",
      category: RuleCategory.Maintainability,
      severity: RuleSdkSeverity.Warning,
      recommended: true,
      enabledByDefault: true,
      documentationUrl: "https://example.com/rules/sdk-sample",
    });

    expect(metadata).toEqual({
      id: "sdk/sample",
      name: "SDK sample",
      description: "Validates SDK metadata creation.",
      category: RuleCategory.Maintainability,
      severity: RuleSdkSeverity.Warning,
      recommended: true,
      enabledByDefault: true,
      documentationUrl: "https://example.com/rules/sdk-sample",
    });
  });

  it("validates rule metadata without throwing", () => {
    const result = validateRuleMetadata({
      id: "",
      name: "Invalid",
      description: "",
      category: "InvalidCategory" as RuleCategory,
      severity: "fatal" as RuleSdkSeverity,
      recommended: false,
      enabledByDefault: false,
      documentationUrl: "not-a-url",
    });

    expect(result).toEqual({
      valid: false,
      issues: [
        { field: "id", message: "Rule id must be a non-empty string." },
        {
          field: "description",
          message: "Rule description must be a non-empty string.",
        },
        {
          field: "category",
          message: 'Rule category "InvalidCategory" is not supported.',
        },
        {
          field: "severity",
          message: 'Rule severity "fatal" is not supported.',
        },
        {
          field: "documentationUrl",
          message:
            "Rule documentationUrl must be an absolute http or https URL.",
        },
      ],
    });
  });

  it("throws descriptive errors when constructing invalid rules", () => {
    expect(() =>
      createRule({
        metadata: {
          id: "",
          name: "Invalid",
          description: "Invalid rule.",
          category: RuleCategory.Style,
          severity: RuleSdkSeverity.Info,
          recommended: false,
          enabledByDefault: false,
        },
        evaluate: () => createRuleResult(validMetadata, "passed"),
      }),
    ).toThrow("Invalid rule metadata. id: Rule id must be a non-empty string.");
  });
});

describe("rule SDK constants", () => {
  it("exposes built-in rule categories", () => {
    expect(RULE_CATEGORIES).toEqual([
      RuleCategory.Accessibility,
      RuleCategory.Performance,
      RuleCategory.React,
      RuleCategory.NextJS,
      RuleCategory.TypeScript,
      RuleCategory.JavaScript,
      RuleCategory.Security,
      RuleCategory.Maintainability,
      RuleCategory.BestPractices,
      RuleCategory.Style,
    ]);
  });

  it("exposes built-in rule severities", () => {
    expect(RULE_SEVERITIES).toEqual([
      RuleSdkSeverity.Info,
      RuleSdkSeverity.Warning,
      RuleSdkSeverity.Error,
      RuleSdkSeverity.Critical,
    ]);
    expect(toCoreSeverity(RuleSdkSeverity.Critical)).toBe("critical");
  });
});

describe("rule creation", () => {
  it("creates a core-compatible rule", async () => {
    const rule = createRule({
      metadata: validMetadata,
      evaluate(context) {
        return createRuleResult(validMetadata, "failed", [
          createFinding({
            context,
            message: "Created rule finding.",
          }),
        ]);
      },
    });

    const result = await rule.evaluate(ruleContext());

    expect(rule).toMatchObject({
      id: "sdk/valid",
      name: "Valid SDK rule",
      category: RuleCategory.Maintainability,
      severity: RuleSdkSeverity.Warning,
      enabledByDefault: true,
      docsUrl: "https://example.com/rules/valid",
      tags: ["recommended"],
    });
    expect(result.findings).toEqual([
      {
        ruleId: "sdk/valid",
        severity: "warning",
        message: "Created rule finding.",
      },
    ]);
  });

  it("supports reusable BaseRule subclasses", async () => {
    class CustomRule extends BaseRule {
      constructor() {
        super(validMetadata);
      }

      protected run(context: RuleEngineRuleContext) {
        return createRuleResult(this.metadata, "failed", [
          createFinding({
            context,
            message: "Subclass finding.",
          }),
        ]);
      }
    }

    const rule = new CustomRule();
    const result = await rule.evaluate(ruleContext());

    expect(rule.id).toBe("sdk/valid");
    expect(result.findings).toEqual([
      {
        ruleId: "sdk/valid",
        severity: "warning",
        message: "Subclass finding.",
      },
    ]);
  });
});

describe("rule helper utilities", () => {
  it("creates findings and rule results", () => {
    const context = ruleContext();
    const finding = createFinding({
      context,
      message: "Helper finding.",
      location: {
        file: "src/app.ts",
        line: 1,
      },
      suggestion: "Review the sample.",
      metadata: {
        kind: "sample",
      },
    });

    expect(finding).toEqual({
      ruleId: "sdk/valid",
      severity: "warning",
      message: "Helper finding.",
      location: {
        file: "src/app.ts",
        line: 1,
      },
      suggestion: "Review the sample.",
      metadata: {
        kind: "sample",
      },
    });
    expect(createRuleResult(validMetadata, "failed", [finding])).toEqual({
      ruleId: "sdk/valid",
      status: "failed",
      findings: [finding],
    });
  });

  it("times rule execution helpers", async () => {
    const result = await timeExecution(() => "done");

    expect(result.value).toBe("done");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("sample rules", () => {
  it("provides sample rules for validating the engine and SDK", async () => {
    const registry = new RuleRegistry();
    registry.registerRule(new NoOpRule());
    registry.registerRule(new AlwaysPassRule());
    registry.registerRule(new AlwaysFailRule());

    const result = await new RuleEngine().execute({
      documents: [document()],
      registry,
      project: {
        projectRoot: "/project",
        cwd: "/project",
        files: ["src/app.ts"],
        env: {},
      },
      config: {
        projectRoot: "/project",
        // Sample rules are disabled by default (fixtures); enable them so this
        // test exercises all three through the config-aware engine.
        rules: {
          "sample/no-op": { enabled: true },
          "sample/always-pass": { enabled: true },
          "sample/always-fail": { enabled: true },
        },
      },
    });

    expect(result).toMatchObject({
      executedRules: 3,
      successfulRules: 3,
      failedRules: 0,
      errors: [],
    });
    expect(result.findings).toEqual([
      {
        ruleId: "sample/always-fail",
        severity: "warning",
        message: "Sample rule emitted a finding.",
        location: {
          file: "src/app.ts",
        },
      },
    ]);
  });
});

const validMetadata: RuleMetadata = {
  id: "sdk/valid",
  name: "Valid SDK rule",
  description: "A valid SDK rule used by tests.",
  category: RuleCategory.Maintainability,
  severity: RuleSdkSeverity.Warning,
  recommended: true,
  enabledByDefault: true,
  documentationUrl: "https://example.com/rules/valid",
};

const ruleContext = (): RuleEngineRuleContext => ({
  project: {
    projectRoot: "/project",
    cwd: "/project",
    files: ["src/app.ts"],
    env: {},
  },
  ruleId: validMetadata.id,
  severity: validMetadata.severity,
  config: {},
  projectConfig: {},
  sourceFile: {
    path: "/project/src/app.ts",
    relativePath: "src/app.ts",
    extension: "ts",
  },
  ast: document(),
  language: Language.TypeScript,
  helpers: {
    isNodeKind(node, kind) {
      return node.kind === kind;
    },
    metadata(values = {}) {
      return { ...values };
    },
  },
  metadata: {},
});

const document = (): NormalizedAstDocument => ({
  path: "/project/src/app.ts",
  relativePath: "src/app.ts",
  language: Language.TypeScript,
  root: {
    kind: "SourceFile",
    rawKind: 0,
    start: {
      offset: 0,
      line: 1,
      column: 1,
    },
    end: {
      offset: 0,
      line: 1,
      column: 1,
    },
    children: [],
  },
});
