import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HtmlReporter,
  renderHtmlReport,
  type AuditResult,
  type Finding,
} from "../src/index.js";
import { runAuditCommand } from "../src/cli/index.js";

const tempRoots: string[] = [];

const createTempProject = async (
  files: Readonly<Record<string, string>>,
): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ui-audit-html-"));
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

const makeFinding = (
  severity: Finding["severity"],
  ruleId: string,
  file: string,
  overrides: Partial<Finding> = {},
): Finding => ({
  ruleId,
  ruleName: `${ruleId} name`,
  severity,
  message: `${ruleId} message`,
  location: { file, line: 4, column: 8 },
  suggestion: `${ruleId} suggestion`,
  ...overrides,
});

const base = (findings: readonly Finding[]): AuditResult => ({
  projectRoot: "/project",
  duration: 12,
  filesDiscovered: 3,
  filesScanned: 3,
  filesParsed: 3,
  rulesExecuted: 30,
  findings,
  executionErrors: [],
  diagnostics: { scan: [], parse: [] },
});

const populated = base([
  makeFinding("info", "react/inline-style", "src/Button.tsx"),
  makeFinding("warning", "a11y/img-alt", "src/Hero.tsx"),
  makeFinding("error", "perf/no-large-switch", "src/reducer.ts"),
]);

describe("renderHtmlReport", () => {
  it("produces a valid, self-contained HTML5 document", () => {
    const html = renderHtmlReport(populated);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("</html>");
    // Self-contained: inline style + script, no external asset references.
    expect(html).toContain("<style>");
    expect(html).toContain("<script>");
    expect(html).not.toContain("<link ");
    expect(html).not.toContain('src="http');
  });

  it("renders the scan summary and stat cards", () => {
    const html = renderHtmlReport(populated);

    expect(html).toContain("ui-audit report");
    expect(html).toContain("/project");
    expect(html).toContain("Files scanned");
    expect(html).toContain("Rules executed");
    expect(html).toContain("Duration");
    expect(html).toContain("12ms");
    expect(html).toContain("Findings");
    expect(html).toContain("Errors");
  });

  it("includes a search box, category and severity filters, and a dark-mode toggle", () => {
    const html = renderHtmlReport(populated);

    expect(html).toContain('id="search"');
    expect(html).toContain('id="filter-category"');
    expect(html).toContain('id="filter-severity"');
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain("@media (prefers-color-scheme: dark)");
  });

  it("renders an empty report with no finding cards", () => {
    const html = renderHtmlReport(base([]));

    expect(html).toContain("✔ No findings.");
    expect(html).not.toContain('<article class="finding"');
    // Still a complete document with the dark-mode toggle.
    expect(html).toContain('id="theme-toggle"');
  });

  it("groups findings by category in the required order, each with its findings", () => {
    const html = renderHtmlReport(populated);

    const react = html.indexOf('data-category="React"');
    const accessibility = html.indexOf('data-category="Accessibility"');
    const performance = html.indexOf('data-category="Performance"');

    expect(react).toBeGreaterThan(-1);
    expect(accessibility).toBeGreaterThan(react);
    expect(performance).toBeGreaterThan(accessibility);

    // Category details carry expand/collapse via <details>.
    expect(html).toContain('<details class="category"');
  });

  it("displays each finding field: rule id, name, severity, location, message, suggestion", () => {
    const html = renderHtmlReport(
      base([makeFinding("error", "perf/no-large-switch", "src/reducer.ts")]),
    );

    expect(html).toContain("perf/no-large-switch");
    expect(html).toContain("perf/no-large-switch name");
    expect(html).toContain('<span class="badge error">Error</span>');
    expect(html).toContain("src/reducer.ts:4:8");
    expect(html).toContain("perf/no-large-switch message");
    expect(html).toContain("perf/no-large-switch suggestion");
  });

  it("escapes HTML in dynamic content", () => {
    const html = renderHtmlReport(
      base([
        makeFinding("warning", "react/x", "src/<evil>.tsx", {
          message: `<img src=x onerror="alert(1)"> & 'quote'`,
          suggestion: "<b>bold</b>",
        }),
      ]),
    );

    expect(html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quote&#39;",
    );
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    // The raw injected markup must never appear unescaped.
    expect(html).not.toContain("<img src=x onerror=");
    expect(html).not.toContain("<b>bold</b>");
  });

  it("produces byte-identical output across repeated renders (deterministic)", () => {
    expect(renderHtmlReport(populated)).toBe(renderHtmlReport(populated));
    expect(renderHtmlReport(base([]))).toBe(renderHtmlReport(base([])));
  });

  it("discloses active filtering with a banner, and omits it when unfiltered", () => {
    const unfiltered = renderHtmlReport(populated);
    expect(unfiltered).not.toContain("Filters applied");

    const filtered = renderHtmlReport({
      ...populated,
      selectedCategories: ["React"],
      rulesSkipped: 30,
      selectedSeverities: ["error"],
      hiddenFindings: 2,
    });
    expect(filtered).toContain("Filters applied");
    expect(filtered).toContain("30 rules skipped");
    expect(filtered).toContain("2 findings hidden");
  });

  it("renders execution errors when present", () => {
    const html = renderHtmlReport({
      ...base([]),
      executionErrors: [
        {
          ruleId: "x/throws",
          ruleName: "Throwing rule",
          filePath: "src/List.tsx",
          message: "boom",
          executionTime: 1,
        },
      ],
    });

    expect(html).toContain("Execution errors (1)");
    expect(html).toContain("x/throws");
    expect(html).toContain("boom");
  });
});

describe("HtmlReporter", () => {
  it("conforms to the core Reporter contract", () => {
    const reporter = new HtmlReporter();
    expect(reporter.name).toBe("html");
    expect(reporter.format).toBe("html");
    expect(reporter.renderResult(populated)).toBe(renderHtmlReport(populated));
  });
});

const CLEAN_COMPONENT = `export const Hello = () => <span>hi</span>;\n`;
const DIRTY_COMPONENT = `export const Panel = () => {
  const t = localStorage.getItem('t');
  return <div style={{ color: 'red' }}>{t}</div>;
};
`;

describe("runAuditCommand --reporter html", () => {
  it("reminds the user to use --output instead of dumping HTML to stdout", async () => {
    const root = await createTempProject({ "src/Panel.tsx": DIRTY_COMPONENT });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      reporter: "html",
    });

    expect(outcome.stdout).toContain("--output");
    expect(outcome.stdout).not.toContain("<!doctype html>");
  });

  it("writes a standalone HTML file with --output", async () => {
    const root = await createTempProject({ "src/Panel.tsx": DIRTY_COMPONENT });

    const outcome = await runAuditCommand({
      path: root,
      cwd: root,
      reporter: "html",
      output: "report.html",
    });

    expect(outcome.stdout).toContain("Report written to report.html");
    const written = await readFile(path.join(root, "report.html"), "utf8");
    expect(written.startsWith("<!doctype html>")).toBe(true);
    expect(written).toContain('id="theme-toggle"');
    expect(written).toContain('<article class="finding"');
  });

  it("writes a valid empty report for a clean project", async () => {
    const root = await createTempProject({ "src/Hello.tsx": CLEAN_COMPONENT });

    await runAuditCommand({
      path: root,
      cwd: root,
      reporter: "html",
      output: "report.html",
    });

    const written = await readFile(path.join(root, "report.html"), "utf8");
    expect(written).toContain("✔ No findings.");
  });
});
