import type {
  AuditConfig,
  Finding,
  ProjectContext,
  Reporter,
  ReporterResult,
  Severity,
} from "../core/index.js";
import type { ExecutionError } from "../rule-engine/index.js";
import { createBuiltInRules } from "../pipeline/default-registry.js";
import type { AuditDiagnostics, AuditResult } from "../pipeline/index.js";
import {
  CATEGORY_DISPLAY_ORDER,
  SEVERITY_ORDER,
  categoryForRuleId,
  groupFindingsByCategory,
} from "./finding-categories.js";
import type { AuditRunMetadata } from "./json-reporter.js";

/** Severities shown as dedicated summary cards, most severe first. */
const SEVERITY_CARDS: readonly Severity[] = [
  "critical",
  "error",
  "warning",
  "info",
];

const EMPTY_DIAGNOSTICS: AuditDiagnostics = { scan: [], parse: [] };

/** Rule display metadata (name + docs URL) resolved from built-in rules. */
interface RuleDisplayInfo {
  readonly name: string;
  readonly docsUrl?: string;
}

let ruleInfoMap: Map<string, RuleDisplayInfo> | undefined;

/** Builds (once) a ruleId→{name, docsUrl} map from built-in rule metadata. */
const ruleInfo = (): Map<string, RuleDisplayInfo> => {
  if (!ruleInfoMap) {
    ruleInfoMap = new Map<string, RuleDisplayInfo>();

    for (const rule of createBuiltInRules()) {
      ruleInfoMap.set(rule.id, {
        name: rule.name,
        ...(rule.docsUrl ? { docsUrl: rule.docsUrl } : {}),
      });
    }
  }

  return ruleInfoMap;
};

/**
 * Production HTML reporter.
 *
 * Renders an {@link AuditResult} as a single, self-contained HTML5 document with
 * embedded CSS and vanilla JS — no frameworks, no external assets. Grouping and
 * ordering are delegated to the shared {@link groupFindingsByCategory} helper so
 * this reporter never re-implements category/severity logic, and output is
 * deterministic for a given result (no timestamps or randomness).
 *
 * Its primary entry point is {@link HtmlReporter.renderResult}; the core
 * {@link Reporter.render} contract is supported via a lightweight adapter.
 */
export class HtmlReporter implements Reporter {
  readonly name = "html";
  readonly format = "html";

  /** Renders a full audit result as a standalone HTML document. */
  renderResult(result: AuditResult): string {
    return renderHtmlReport(result);
  }

  /** Core {@link Reporter} contract entry point (findings + optional run metadata). */
  render(
    results: ReporterResult,
    _config?: AuditConfig,
    _project?: ProjectContext,
  ): string {
    return renderHtmlReport(reporterResultToAuditResult(results));
  }
}

/** Serializes an audit result to a self-contained HTML document. */
export const renderHtmlReport = (result: AuditResult): string => {
  const groups = groupFindingsByCategory(result.findings);
  const title = `ui-audit report — ${result.projectRoot}`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    "<body>",
    renderHeader(result),
    renderMain(result, groups),
    `<script>${SCRIPT}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

const renderHeader = (result: AuditResult): string => {
  const findingsCount = result.findings.length;
  const errorCount = result.executionErrors.length;

  const stats = [
    statCard("Duration", formatDuration(result.duration)),
    statCard("Files scanned", String(result.filesScanned)),
    statCard("Rules executed", String(result.rulesExecuted)),
    statCard("Findings", String(findingsCount)),
    statCard("Errors", String(errorCount)),
  ].join("");

  const categoryCards = CATEGORY_DISPLAY_ORDER.map((category) =>
    countCard("cat", category, countByCategory(result.findings, category)),
  ).join("");

  const severityCards = SEVERITY_CARDS.filter(
    (severity) =>
      severity !== "critical" || hasSeverity(result.findings, "critical"),
  )
    .map((severity) =>
      countCard(
        "sev",
        capitalize(severity),
        countBySeverity(result.findings, severity),
        severity,
      ),
    )
    .join("");

  return [
    '<header class="summary">',
    '<div class="bar">',
    '<div class="titles">',
    "<h1>ui-audit report</h1>",
    `<p class="project" title="${escapeAttr(result.projectRoot)}">${escapeHtml(result.projectRoot)}</p>`,
    "</div>",
    '<div class="controls">',
    '<input type="search" id="search" placeholder="Search findings…" aria-label="Search findings">',
    renderCategorySelect(),
    renderSeveritySelect(),
    '<label class="theme"><input type="checkbox" id="theme-toggle"><span>Dark mode</span></label>',
    "</div>",
    "</div>",
    `<div class="cards stats">${stats}</div>`,
    `<div class="cards group" aria-label="Findings by category">${categoryCards}</div>`,
    `<div class="cards group" aria-label="Findings by severity">${severityCards}</div>`,
    renderFilterBanner(result),
    "</header>",
  ].join("");
};

/**
 * Discloses any active category/severity filtering so a filtered report is not
 * mistaken for a complete one. Rendered only when filtering actually reduced the
 * result (rules skipped or findings hidden).
 */
const renderFilterBanner = (result: AuditResult): string => {
  const rulesSkipped = result.rulesSkipped ?? 0;
  const isFiltered =
    rulesSkipped > 0 || result.selectedSeverities !== undefined;

  if (!isFiltered) {
    return "";
  }

  const parts: string[] = [];

  if (result.selectedCategories !== undefined && rulesSkipped > 0) {
    parts.push(
      `categories: ${escapeHtml(result.selectedCategories.join(", "))}`,
    );
    parts.push(`${rulesSkipped} rules skipped`);
  }

  if (result.selectedSeverities !== undefined) {
    parts.push(
      `severities: ${escapeHtml(result.selectedSeverities.join(", "))}`,
    );
    parts.push(`${result.hiddenFindings ?? 0} findings hidden`);
  }

  return `<div class="filter-banner" role="note"><strong>Filters applied</strong> — ${parts.join(" · ")}</div>`;
};

const renderCategorySelect = (): string => {
  const options = ['<option value="">All categories</option>']
    .concat(
      CATEGORY_DISPLAY_ORDER.map(
        (category) =>
          `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`,
      ),
    )
    .join("");
  return `<select id="filter-category" aria-label="Filter by category">${options}</select>`;
};

const renderSeveritySelect = (): string => {
  const options = ['<option value="">All severities</option>']
    .concat(
      SEVERITY_ORDER.map(
        (severity) =>
          `<option value="${escapeAttr(severity)}">${escapeHtml(capitalize(severity))}</option>`,
      ),
    )
    .join("");
  return `<select id="filter-severity" aria-label="Filter by severity">${options}</select>`;
};

const renderMain = (
  result: AuditResult,
  groups: ReturnType<typeof groupFindingsByCategory>,
): string => {
  const parts: string[] = ['<main id="report">'];

  if (result.findings.length === 0) {
    parts.push('<p class="empty">✔ No findings.</p>');
  } else {
    for (const group of groups) {
      parts.push(renderCategory(group.category, group.findings));
    }
    parts.push(
      '<p class="no-matches" hidden>No findings match the current filters.</p>',
    );
  }

  parts.push(renderErrors(result.executionErrors));
  parts.push("</main>");
  return parts.join("");
};

const renderCategory = (
  category: string,
  findings: readonly Finding[],
): string => {
  const sections: string[] = [];

  for (const severity of SEVERITY_ORDER) {
    const bucket = findings.filter((finding) => finding.severity === severity);

    if (bucket.length === 0) {
      continue;
    }

    sections.push(
      `<section class="severity-group" data-severity="${escapeAttr(severity)}">` +
        `<h3><span class="badge ${escapeAttr(severity)}">${escapeHtml(capitalize(severity))}</span> ` +
        `<span class="count">${bucket.length}</span></h3>` +
        bucket.map((finding) => renderFinding(finding)).join("") +
        "</section>",
    );
  }

  return (
    `<details class="category" data-category="${escapeAttr(category)}" open>` +
    `<summary><span class="cat-name">${escapeHtml(category)}</span> ` +
    `<span class="count">${findings.length}</span></summary>` +
    sections.join("") +
    "</details>"
  );
};

const renderFinding = (finding: Finding): string => {
  const info = ruleInfo().get(finding.ruleId);
  const ruleName = finding.ruleName ?? info?.name ?? finding.ruleId;
  const docsUrl = info?.docsUrl;
  const searchText = [
    finding.ruleId,
    ruleName,
    finding.message,
    formatLocation(finding),
  ]
    .join(" ")
    .toLowerCase();

  const metaItems = [
    `<span class="rule-id">${escapeHtml(finding.ruleId)}</span>`,
    `<span class="rule-name">${escapeHtml(ruleName)}</span>`,
    `<span class="badge ${escapeAttr(finding.severity)}">${escapeHtml(capitalize(finding.severity))}</span>`,
  ].join("");

  const rows: string[] = [
    `<div class="finding-head">${metaItems}</div>`,
    `<div class="location">${escapeHtml(formatLocation(finding))}</div>`,
    `<p class="message">${escapeHtml(finding.message)}</p>`,
  ];

  if (finding.suggestion) {
    rows.push(`<p class="suggestion">↳ ${escapeHtml(finding.suggestion)}</p>`);
  }

  if (docsUrl) {
    rows.push(
      `<p class="docs"><a href="${escapeAttr(docsUrl)}" target="_blank" rel="noreferrer noopener">Documentation ↗</a></p>`,
    );
  }

  return (
    `<article class="finding" data-severity="${escapeAttr(finding.severity)}" ` +
    `data-category="${escapeAttr(categoryForRuleId(finding.ruleId))}" ` +
    `data-search="${escapeAttr(searchText)}">` +
    rows.join("") +
    "</article>"
  );
};

const renderErrors = (errors: readonly ExecutionError[]): string => {
  if (errors.length === 0) {
    return "";
  }

  const items = errors
    .map(
      (error) =>
        `<li><span class="rule-id">${escapeHtml(error.ruleId)}</span> ` +
        `<span class="location">${escapeHtml(error.filePath)}</span> ` +
        `<span class="message">${escapeHtml(error.message)}</span></li>`,
    )
    .join("");

  return `<section class="errors"><h2>Execution errors (${errors.length})</h2><ul>${items}</ul></section>`;
};

const statCard = (label: string, value: string): string => {
  return `<div class="card"><span class="value">${escapeHtml(value)}</span><span class="label">${escapeHtml(label)}</span></div>`;
};

const countCard = (
  kind: string,
  label: string,
  count: number,
  severity?: Severity,
): string => {
  const severityClass = severity ? ` ${escapeAttr(severity)}` : "";
  return (
    `<div class="card count-card ${escapeAttr(kind)}${severityClass}">` +
    `<span class="value">${count}</span><span class="label">${escapeHtml(label)}</span></div>`
  );
};

const countByCategory = (
  findings: readonly Finding[],
  category: string,
): number => {
  return findings.filter(
    (finding) => categoryForRuleId(finding.ruleId) === category,
  ).length;
};

const countBySeverity = (
  findings: readonly Finding[],
  severity: Severity,
): number => {
  return findings.filter((finding) => finding.severity === severity).length;
};

const hasSeverity = (
  findings: readonly Finding[],
  severity: Severity,
): boolean => {
  return findings.some((finding) => finding.severity === severity);
};

const formatLocation = (finding: Finding): string => {
  const location = finding.location;

  if (!location) {
    return "(no location)";
  }

  let formatted = location.file;

  if (location.line !== undefined) {
    formatted += `:${location.line}`;

    if (location.column !== undefined) {
      formatted += `:${location.column}`;
    }
  }

  return formatted;
};

const capitalize = (value: string): string => {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
};

const formatDuration = (duration: number): string => {
  return `${Math.round(duration)}ms`;
};

const reporterResultToAuditResult = (results: ReporterResult): AuditResult => {
  const stats = (results.metadata ?? {}) as AuditRunMetadata;

  return {
    projectRoot: results.project.projectRoot,
    duration: stats.duration ?? 0,
    filesDiscovered: stats.filesDiscovered ?? results.project.files.length,
    filesScanned: stats.filesScanned ?? 0,
    filesParsed: stats.filesParsed ?? 0,
    rulesExecuted: stats.rulesExecuted ?? 0,
    findings: results.findings,
    executionErrors: stats.executionErrors ?? [],
    diagnostics: stats.diagnostics ?? EMPTY_DIAGNOSTICS,
  };
};

/** Escapes text for safe inclusion in HTML element content. */
const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/** Escapes text for safe inclusion in a double-quoted HTML attribute. */
const escapeAttr = (value: string): string => escapeHtml(value);

const STYLES = `
:root {
  --bg: #f6f7f9; --panel: #ffffff; --panel-2: #f0f2f5; --text: #1b1f24;
  --muted: #5b6570; --border: #e1e4e8; --accent: #2f6feb;
  --info: #2f6feb; --warning: #b8860b; --error: #d1242f; --critical: #8250df;
  --shadow: 0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117; --panel: #161b22; --panel-2: #1c2129; --text: #e6edf3;
    --muted: #9198a1; --border: #30363d; --accent: #4c8dff;
    --info: #4c8dff; --warning: #d9a441; --error: #ff6b74; --critical: #b083f0;
    --shadow: 0 1px 2px rgba(0,0,0,.4);
  }
}
:root:has(#theme-toggle:checked) {
  --bg: #0d1117; --panel: #161b22; --panel-2: #1c2129; --text: #e6edf3;
  --muted: #9198a1; --border: #30363d; --accent: #4c8dff;
  --info: #4c8dff; --warning: #d9a441; --error: #ff6b74; --critical: #b083f0;
  --shadow: 0 1px 2px rgba(0,0,0,.4);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.summary {
  position: sticky; top: 0; z-index: 10; background: var(--panel);
  border-bottom: 1px solid var(--border); box-shadow: var(--shadow);
  padding: 12px 20px; display: flex; flex-direction: column; gap: 12px;
}
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between; }
.titles h1 { font-size: 16px; margin: 0; }
.project { margin: 0; color: var(--muted); font-size: 12px; word-break: break-all; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.controls input[type="search"], .controls select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text); font: inherit;
}
.theme { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); cursor: pointer; user-select: none; }
.cards { display: flex; flex-wrap: wrap; gap: 8px; }
.card {
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 12px; min-width: 96px; display: flex; flex-direction: column; gap: 2px;
}
.card .value { font-size: 18px; font-weight: 700; }
.card .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.count-card.sev.error { border-left: 3px solid var(--error); }
.count-card.sev.warning { border-left: 3px solid var(--warning); }
.count-card.sev.info { border-left: 3px solid var(--info); }
.count-card.sev.critical { border-left: 3px solid var(--critical); }
.count-card.cat { border-left: 3px solid var(--accent); }
.filter-banner { background: var(--panel-2); border: 1px solid var(--border); border-left: 3px solid var(--warning); border-radius: 8px; padding: 8px 12px; font-size: 13px; }
main { max-width: 1000px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.empty { font-size: 16px; color: var(--muted); }
.category {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 4px 14px 12px; box-shadow: var(--shadow);
}
.category > summary {
  cursor: pointer; font-size: 15px; font-weight: 700; padding: 10px 0; list-style: none;
  display: flex; align-items: center; gap: 8px;
}
.category > summary::-webkit-details-marker { display: none; }
.category > summary::before { content: "▸"; color: var(--muted); }
.category[open] > summary::before { content: "▾"; }
.count { background: var(--panel-2); border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; font-size: 12px; color: var(--muted); }
.severity-group { margin: 8px 0; }
.severity-group h3 { font-size: 12px; margin: 8px 0; display: flex; align-items: center; gap: 8px; }
.finding {
  border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin: 8px 0;
  background: var(--bg);
}
.finding-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rule-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
.rule-name { color: var(--muted); }
.badge { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 1px 6px; color: #fff; text-transform: uppercase; }
.badge.error { background: var(--error); }
.badge.warning { background: var(--warning); }
.badge.info { background: var(--info); }
.badge.critical { background: var(--critical); }
.location { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); margin-top: 4px; }
.message { margin: 6px 0 0; }
.suggestion { margin: 4px 0 0; color: var(--muted); }
.docs { margin: 6px 0 0; }
.docs a { color: var(--accent); text-decoration: none; }
.docs a:hover { text-decoration: underline; }
.errors { border: 1px solid var(--error); border-radius: 10px; padding: 8px 14px; }
.errors h2 { font-size: 14px; color: var(--error); }
.errors ul { margin: 0; padding-left: 18px; }
.no-matches { color: var(--muted); }
@media (max-width: 640px) {
  .bar { flex-direction: column; align-items: stretch; }
  .controls { justify-content: space-between; }
  .controls input[type="search"] { flex: 1 1 100%; }
}
`;

const SCRIPT = `
(function () {
  var search = document.getElementById('search');
  var catFilter = document.getElementById('filter-category');
  var sevFilter = document.getElementById('filter-severity');
  var findings = Array.prototype.slice.call(document.querySelectorAll('.finding'));
  var noMatches = document.querySelector('.no-matches');

  function apply() {
    var q = (search && search.value || '').trim().toLowerCase();
    var cat = catFilter && catFilter.value || '';
    var sev = sevFilter && sevFilter.value || '';
    var anyVisible = false;

    findings.forEach(function (el) {
      var show = (!cat || el.getAttribute('data-category') === cat)
        && (!sev || el.getAttribute('data-severity') === sev)
        && (!q || (el.getAttribute('data-search') || '').indexOf(q) !== -1);
      el.hidden = !show;
      if (show) anyVisible = true;
    });

    document.querySelectorAll('.severity-group').forEach(function (group) {
      var visible = group.querySelectorAll('.finding:not([hidden])').length;
      group.hidden = visible === 0;
    });
    document.querySelectorAll('.category').forEach(function (cat) {
      var visible = cat.querySelectorAll('.finding:not([hidden])').length;
      cat.hidden = visible === 0;
    });
    if (noMatches) noMatches.hidden = anyVisible || findings.length === 0;
  }

  [search, catFilter, sevFilter].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
})();
`;
