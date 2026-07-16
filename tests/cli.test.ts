import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AuditCommandError,
  computeExitCode,
  runAuditCommand,
  type Finding,
} from "../src/cli/index.js";

const tempRoots: string[] = [];

const createTempProject = async (
  files: Readonly<Record<string, string>> = {},
): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ui-audit-cli-"));
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

const INLINE_STYLE_COMPONENT = `export const Button = () => {
  return <button style={{ color: 'red' }}>Click</button>;
};
`;

const CLEAN_COMPONENT = `export const Hello = () => {
  return <span>hello world</span>;
};
`;

const finding = (severity: Finding["severity"]): Finding => ({
  ruleId: "x/rule",
  severity,
  message: "message",
});

describe("computeExitCode", () => {
  it("defaults to failing only on error or higher", () => {
    expect(
      computeExitCode([finding("info"), finding("warning")], { strict: false }),
    ).toBe(0);
    expect(computeExitCode([finding("error")], { strict: false })).toBe(1);
    expect(computeExitCode([finding("critical")], { strict: false })).toBe(1);
    expect(computeExitCode([], { strict: false })).toBe(0);
  });

  it("fails on any finding when strict", () => {
    expect(computeExitCode([finding("info")], { strict: true })).toBe(1);
    expect(computeExitCode([], { strict: true })).toBe(0);
  });

  it("honors an explicit fail-on-severity threshold", () => {
    expect(
      computeExitCode([finding("warning")], {
        strict: false,
        failOnSeverity: "warning",
      }),
    ).toBe(1);
    expect(
      computeExitCode([finding("info")], {
        strict: false,
        failOnSeverity: "warning",
      }),
    ).toBe(0);
  });
});

describe("runAuditCommand", () => {
  it("runs an end-to-end terminal audit and exits 0 for a clean project", async () => {
    const root = await createTempProject({ "src/Hello.tsx": CLEAN_COMPONENT });

    const outcome = await runAuditCommand({ path: root, cwd: root });

    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain("ui-audit report");
    expect(outcome.stdout).toContain("✔ No findings.");
    expect(outcome.result.filesParsed).toBe(1);
  });

  it("reports findings and exits 0 by default for sub-error severities", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
    });

    const outcome = await runAuditCommand({ path: root, cwd: root });

    expect(outcome.stdout).toContain("react/inline-style");
    expect(outcome.result.findings.length).toBeGreaterThan(0);
    // inline-style is info severity, below the default error threshold.
    expect(outcome.exitCode).toBe(0);
  });

  it("exits 1 under --strict when any finding is produced", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
    });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      strict: true,
    });

    expect(outcome.exitCode).toBe(1);
  });

  it("renders machine-readable JSON with --reporter json", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
    });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      reporter: "json",
    });
    const parsed = JSON.parse(outcome.stdout);

    expect(parsed.metadata.reporter).toBe("json");
    expect(parsed.summary.findingsCount).toBeGreaterThan(0);
    expect(parsed.findings[0].ruleId).toBe("react/inline-style");
  });

  it("writes the report to a file with --output", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
    });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      reporter: "json",
      output: "report.json",
    });

    expect(outcome.stdout).toContain("Report written to report.json");
    const written = await readFile(path.join(root, "report.json"), "utf8");
    const parsed = JSON.parse(written);
    expect(parsed.summary.findingsCount).toBeGreaterThan(0);
  });

  it("honors severity overrides from a discovered config file", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
      "ui-audit.config.ts": `export default { rules: { 'react/inline-style': 'error' } };\n`,
    });

    const outcome = await runAuditCommand({ path: root, cwd: root });

    const inlineStyle = outcome.result.findings.find(
      (f) => f.ruleId === "react/inline-style",
    );
    expect(inlineStyle?.severity).toBe("error");
    // Elevated to error, so the default threshold now fails the run.
    expect(outcome.exitCode).toBe(1);
  });

  it("loads an explicit config path via --config", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
      "configs/custom.config.ts": `export default { rules: { 'react/inline-style': 'off' } };\n`,
    });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      config: "configs/custom.config.ts",
    });

    expect(
      outcome.result.findings.some((f) => f.ruleId === "react/inline-style"),
    ).toBe(false);
  });

  it("rejects an unknown reporter", async () => {
    const root = await createTempProject();

    await expect(
      runAuditCommand({ path: root, cwd: root, reporter: "xml" }),
    ).rejects.toThrow(AuditCommandError);
  });

  it("rejects an invalid --fail-on-severity value", async () => {
    const root = await createTempProject();

    await expect(
      runAuditCommand({ path: root, cwd: root, failOnSeverity: "fatal" }),
    ).rejects.toThrow(AuditCommandError);
  });

  it("errors when an explicit --config path does not exist", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
    });

    await expect(
      runAuditCommand({
        path: root,
        cwd: root,
        config: "does-not-exist.config.ts",
      }),
    ).rejects.toThrow(AuditCommandError);
  });

  it("warns about unknown rule IDs in configuration", async () => {
    const root = await createTempProject({
      "src/Button.tsx": INLINE_STYLE_COMPONENT,
      "ui-audit.config.ts": `export default { rules: { 'react/not-a-real-rule': 'error' } };\n`,
    });

    const outcome = await runAuditCommand({ path: root, cwd: root });

    expect(
      outcome.warnings?.some((w) => w.includes("react/not-a-real-rule")),
    ).toBe(true);
  });
});
