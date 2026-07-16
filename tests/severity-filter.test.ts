import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JsonReporter,
  TerminalReporter,
  buildJsonReport,
  type AuditResult,
  type Finding,
} from "../src/index.js";
import { AuditCommandError, runAuditCommand } from "../src/cli/index.js";
import {
  filterFindingsBySeverity,
  parseSeveritySelection,
} from "../src/cli/severity-filter.js";

const tempRoots: string[] = [];

const createTempProject = async (
  files: Readonly<Record<string, string>>,
): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ui-audit-severity-"));
  tempRoots.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return root;
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

// Trips rules of more than one severity:
// - perf/no-sync-storage, react/inline-style (info)
// - react/no-dangerously-set-inner-html (error)
const MIXED_COMPONENT = `export const Panel = () => {
  const theme = localStorage.getItem('theme');
  return (
    <div style={{ color: 'red' }}>
      <div dangerouslySetInnerHTML={{ __html: theme }} />
      <span>{theme}</span>
    </div>
  );
};
`;

const makeFinding = (
  severity: Finding["severity"],
  ruleId: string,
): Finding => ({
  ruleId,
  severity,
  message: `${ruleId} message`,
  location: { file: "src/x.tsx", line: 1, column: 1 },
});

const severitiesOf = (findings: readonly Finding[]): Set<string> =>
  new Set(findings.map((finding) => finding.severity));

describe("parseSeveritySelection", () => {
  it("selects every severity by default", () => {
    const selection = parseSeveritySelection(undefined);
    expect(selection.filtered).toBe(false);
    expect(selection.severities).toEqual([
      "critical",
      "error",
      "warning",
      "info",
    ]);
  });

  it("is case-insensitive and normalized to most-severe-first order", () => {
    const selection = parseSeveritySelection("warning,ERROR");
    expect(selection.filtered).toBe(true);
    expect(selection.severities).toEqual(["error", "warning"]);
  });

  it("throws a friendly error listing supported severities for unknown values", () => {
    expect(() => parseSeveritySelection("fatal")).toThrow(AuditCommandError);
    expect(() => parseSeveritySelection("fatal")).toThrow(
      /Supported severities: info, warning, error, critical\./,
    );
  });
});

describe("filterFindingsBySeverity", () => {
  const findings = [
    makeFinding("info", "a/info"),
    makeFinding("error", "b/error"),
    makeFinding("warning", "c/warning"),
    makeFinding("info", "d/info"),
  ];

  it("keeps only matching findings and counts the hidden ones, preserving order", () => {
    const { visible, hidden } = filterFindingsBySeverity(findings, [
      "error",
      "warning",
    ]);

    expect(visible.map((finding) => finding.ruleId)).toEqual([
      "b/error",
      "c/warning",
    ]);
    expect(hidden).toBe(2);
  });

  it("is deterministic across repeated calls", () => {
    const a = filterFindingsBySeverity(findings, ["info"]);
    const b = filterFindingsBySeverity(findings, ["info"]);
    expect(a.visible).toEqual(b.visible);
    expect(a.hidden).toBe(b.hidden);
  });
});

describe("JSON reporter severity metadata", () => {
  const base: AuditResult = {
    projectRoot: "/p",
    duration: 1,
    filesDiscovered: 1,
    filesScanned: 1,
    filesParsed: 1,
    rulesExecuted: 5,
    findings: [makeFinding("error", "b/error")],
    executionErrors: [],
    diagnostics: { scan: [], parse: [] },
  };

  it("omits selectedSeverities and preserves the schema when not filtering", () => {
    const report = buildJsonReport(base);
    expect(report.metadata).toEqual({
      tool: "ui-audit",
      reporter: "json",
      schemaVersion: 1,
    });
  });

  it("includes selectedSeverities and only the visible findings when filtering", () => {
    const filtered: AuditResult = {
      ...base,
      selectedSeverities: ["error", "warning"],
      hiddenFindings: 3,
    };
    const parsed = JSON.parse(new JsonReporter().renderResult(filtered));

    expect(parsed.metadata.selectedSeverities).toEqual(["error", "warning"]);
    expect(parsed.metadata.schemaVersion).toBe(1);
    expect(parsed.summary.findingsCount).toBe(1);
    expect(parsed.findings.map((f: Finding) => f.severity)).toEqual(["error"]);
  });
});

describe("Terminal reporter severity display", () => {
  const base: AuditResult = {
    projectRoot: "/p",
    duration: 1,
    filesDiscovered: 1,
    filesScanned: 1,
    filesParsed: 1,
    rulesExecuted: 5,
    findings: [makeFinding("error", "react/no-danger")],
    executionErrors: [],
    diagnostics: { scan: [], parse: [] },
  };

  it("shows selected severities, visible and hidden counts when filtering", () => {
    const output = new TerminalReporter({ color: false }).renderResult({
      ...base,
      selectedSeverities: ["error"],
      hiddenFindings: 4,
    });

    expect(output).toContain("Selected severities: error");
    expect(output).toContain("Visible findings:    1");
    expect(output).toContain("Hidden findings:     4");
  });

  it("omits severity lines and the hidden line when not filtering / nothing hidden", () => {
    const noFilter = new TerminalReporter({ color: false }).renderResult(base);
    expect(noFilter).not.toContain("Selected severities:");

    const noneHidden = new TerminalReporter({ color: false }).renderResult({
      ...base,
      selectedSeverities: ["error"],
      hiddenFindings: 0,
    });
    expect(noneHidden).toContain("Selected severities: error");
    expect(noneHidden).not.toContain("Hidden findings:");
  });
});

describe("runAuditCommand --severity", () => {
  it("reports only the single selected severity", async () => {
    const root = await createTempProject({ "src/Panel.tsx": MIXED_COMPONENT });

    const all = await runAuditCommand({ path: root, cwd: root });
    const errorCount = all.result.findings.filter(
      (f) => f.severity === "error",
    ).length;
    expect(errorCount).toBeGreaterThan(0);

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      severity: "error",
    });

    expect(severitiesOf(outcome.result.findings)).toEqual(new Set(["error"]));
    expect(outcome.result.findings.length).toBe(errorCount);
    expect(outcome.result.selectedSeverities).toEqual(["error"]);
    expect(outcome.result.hiddenFindings).toBe(
      all.result.findings.length - errorCount,
    );
    expect(outcome.stdout).toContain("Selected severities: error");
  });

  it("reports multiple selected severities and leaves execution stats intact", async () => {
    const root = await createTempProject({ "src/Panel.tsx": MIXED_COMPONENT });

    const all = await runAuditCommand({ path: root, cwd: root });
    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      severity: "info,error",
    });

    expect(
      [...severitiesOf(outcome.result.findings)].every(
        (s) => s === "info" || s === "error",
      ),
    ).toBe(true);
    // Execution statistics are unaffected by post-execution filtering.
    expect(outcome.result.rulesExecuted).toBe(all.result.rulesExecuted);
    expect(outcome.result.filesParsed).toBe(all.result.filesParsed);
  });

  it("does not weaken the exit code — hidden error findings still fail the run", async () => {
    const root = await createTempProject({
      "src/Danger.tsx":
        "export const D = () => <div dangerouslySetInnerHTML={{ __html: x }} />;\n",
    });

    const unfiltered = await runAuditCommand({ path: root, cwd: root });
    expect(unfiltered.result.findings.some((f) => f.severity === "error")).toBe(
      true,
    );
    expect(unfiltered.exitCode).toBe(1);

    // Filtering to info hides the error from the report but must NOT flip the gate.
    const filtered = await runAuditCommand({
      path: root,
      cwd: root,
      severity: "info",
    });
    expect(filtered.result.findings.some((f) => f.severity === "error")).toBe(
      false,
    );
    expect(filtered.exitCode).toBe(1);
  });

  it("rejects an unknown severity with a friendly validation error", async () => {
    const root = await createTempProject({ "src/Panel.tsx": MIXED_COMPONENT });

    await expect(
      runAuditCommand({ path: root, cwd: root, severity: "fatal" }),
    ).rejects.toThrow(
      /Unknown severity "fatal"\. Supported severities: info, warning, error, critical\./,
    );
  });

  it("leaves behavior unchanged when omitted", async () => {
    const root = await createTempProject({ "src/Panel.tsx": MIXED_COMPONENT });

    const outcome = await runAuditCommand({ path: root, cwd: root });

    expect(outcome.result.selectedSeverities).toBeUndefined();
    expect(outcome.result.hiddenFindings).toBeUndefined();
    expect(outcome.stdout).not.toContain("Selected severities:");
  });

  it("produces deterministic output regardless of token order", async () => {
    const root = await createTempProject({ "src/Panel.tsx": MIXED_COMPONENT });

    const first = await runAuditCommand({
      path: root,
      cwd: root,
      severity: "error,info",
    });
    const second = await runAuditCommand({
      path: root,
      cwd: root,
      severity: "info,error",
    });

    expect(first.result.selectedSeverities).toEqual(
      second.result.selectedSeverities,
    );
    // Compare rendered output ignoring the volatile wall-clock duration.
    expect(withoutDuration(first.stdout)).toBe(withoutDuration(second.stdout));
  });
});

/** Removes the volatile wall-clock duration so output can be compared for determinism. */
const withoutDuration = (output: string): string =>
  output
    .replace(/^\s*Duration:.*$/m, "  Duration:")
    .replace(/\(\d+ms\)/g, "(Nms)");
