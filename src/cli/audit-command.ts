import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Finding, Severity } from "../core/index.js";
import { access } from "node:fs/promises";
import { loadConfig, type ResolvedUiAuditConfig } from "../config/index.js";
import {
  AuditPipeline,
  createBuiltInRules,
  type AuditResult,
} from "../pipeline/index.js";
import {
  HtmlReporter,
  JsonReporter,
  TerminalReporter,
} from "../reporters/index.js";
import {
  createCategoryFilteredRegistry,
  parseCategorySelection,
} from "./category-filter.js";
import {
  filterFindingsBySeverity,
  parseSeveritySelection,
} from "./severity-filter.js";

/** Reporter names supported by the CLI. */
export const REPORTER_NAMES = ["terminal", "json", "html"] as const;
export type ReporterName = (typeof REPORTER_NAMES)[number];

/** Severity levels accepted by the `--fail-on-severity` and `--severity` options. */
export const SEVERITY_LEVELS: readonly Severity[] = [
  "info",
  "warning",
  "error",
  "critical",
];

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

/**
 * Error thrown for invalid CLI usage (bad option values). Carries an exit code
 * so the command layer can translate it into a process exit status.
 */
export class AuditCommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = "AuditCommandError";
    this.exitCode = exitCode;
  }
}

/**
 * Parsed options for the `audit` command.
 */
export interface AuditCommandOptions {
  /** Positional project path to audit. Defaults to the current directory. */
  readonly path?: string;
  /** Explicit configuration file path. */
  readonly config?: string;
  /** Reporter to render results with. Defaults to `terminal`. */
  readonly reporter?: string;
  /** File to write the rendered report to instead of stdout. */
  readonly output?: string;
  /** Fail (non-zero exit) when any finding is produced. */
  readonly strict?: boolean;
  /** Fail (non-zero exit) when a finding at or above this severity is produced. */
  readonly failOnSeverity?: string;
  /**
   * Comma-separated rule categories to execute (e.g. `react,performance`).
   * When omitted, every category runs.
   */
  readonly category?: string;
  /**
   * Comma-separated severities to report (e.g. `warning,error`). Case-insensitive.
   * When omitted, findings of every severity are reported.
   */
  readonly severity?: string;
  /** Working directory used to resolve relative paths. Defaults to process.cwd(). */
  readonly cwd?: string;
}

/**
 * Outcome of running the `audit` command. The command layer is responsible for
 * printing {@link AuditCommandResult.stdout} and applying the exit code, which
 * keeps this function free of process side effects (aside from writing an
 * explicitly requested output file).
 */
export interface AuditCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly result: AuditResult;
  /** Non-fatal advisories (e.g. unknown rule IDs in config) for the CLI to surface. */
  readonly warnings?: readonly string[];
}

interface AuditResultRenderer {
  renderResult(result: AuditResult): string;
}

/**
 * Executes the end-to-end audit workflow for the CLI:
 * load configuration, build the pipeline (default registry + config-aware
 * executor), run the scan, render with the selected reporter, and compute an
 * exit code from the configured fail policy.
 */
export const runAuditCommand = async (
  options: AuditCommandOptions,
): Promise<AuditCommandResult> => {
  const cwd = options.cwd ?? process.cwd();
  const reporterName = resolveReporterName(options.reporter);
  const failOnSeverity = resolveFailOnSeverity(options.failOnSeverity);
  const projectRoot = path.resolve(cwd, options.path ?? ".");

  const selection = parseCategorySelection(options.category);
  const { registry, rulesSkipped } = createCategoryFilteredRegistry(
    selection.categories,
  );
  const severitySelection = parseSeveritySelection(options.severity);

  const config = await loadResolvedConfig(projectRoot, options.config, cwd);
  const warnings = collectUnknownRuleWarnings(config);

  const pipeline = new AuditPipeline({ registry });
  const baseResult = await pipeline.run({
    projectRoot,
    config,
    overrides: {
      cwd,
      reporter: reporterName,
      ...(options.strict !== undefined ? { strict: options.strict } : {}),
      ...(failOnSeverity ? { failOnSeverity } : {}),
    },
  });

  // Severity filtering is applied to findings after execution so the run's
  // execution statistics stay accurate; only the reported set changes.
  const { visible, hidden } = filterFindingsBySeverity(
    baseResult.findings,
    severitySelection.severities,
  );

  // Attach category- and severity-selection metadata so the reporters can
  // surface it (and so the JSON reporter emits only the visible findings).
  const result: AuditResult = {
    ...baseResult,
    findings: visible,
    selectedCategories: selection.categories,
    rulesSkipped,
    ...(severitySelection.filtered
      ? {
          selectedSeverities: severitySelection.severities,
          hiddenFindings: hidden,
        }
      : {}),
  };

  // The exit code is derived from the full, unfiltered finding set and any
  // execution errors. Display filters (`--severity`) must never weaken the
  // pass/fail gate, and a run where rules threw is never a clean pass.
  const exitCode =
    baseResult.executionErrors.length > 0
      ? 1
      : computeExitCode(baseResult.findings, {
          strict: options.strict ?? false,
          failOnSeverity,
        });

  // HTML reports are large, self-contained documents intended for a file rather
  // than a terminal. Without --output, remind the user instead of dumping HTML.
  if (reporterName === "html" && !options.output) {
    return {
      exitCode,
      stdout:
        "HTML reports are best saved to a file. Re-run with --output to write one, " +
        "e.g. `ui-audit audit --reporter html --output report.html`.",
      result,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  // Disable color when writing to a file; otherwise let the reporter
  // auto-detect terminal color support.
  const rendered = createReporter(reporterName, {
    color: options.output ? false : undefined,
  }).renderResult(result);

  if (options.output) {
    const outputPath = path.resolve(cwd, options.output);
    await writeFile(outputPath, `${rendered}\n`, "utf8");
    return {
      exitCode,
      stdout: `Report written to ${options.output} (${result.findings.length} findings, ${result.executionErrors.length} errors)`,
      result,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  return {
    exitCode,
    stdout: rendered,
    result,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

/**
 * Produces advisory warnings for rule IDs configured by the user that do not
 * match any built-in rule (usually a typo). Such overrides are silently
 * inert otherwise.
 */
const collectUnknownRuleWarnings = (
  config: ResolvedUiAuditConfig,
): string[] => {
  const known = new Set(createBuiltInRules().map((rule) => rule.id));
  const unknown = Object.keys(config.rules ?? {}).filter(
    (ruleId) => !known.has(ruleId),
  );

  if (unknown.length === 0) {
    return [];
  }

  return [
    `Unknown rule ${unknown.length === 1 ? "ID" : "IDs"} in configuration (ignored): ${unknown.join(", ")}.`,
  ];
};

const loadResolvedConfig = async (
  projectRoot: string,
  configPath: string | undefined,
  cwd: string,
): Promise<ResolvedUiAuditConfig> => {
  if (!configPath) {
    return loadConfig(projectRoot);
  }

  const absoluteConfig = path.resolve(cwd, configPath);

  // An explicitly requested config that does not exist is a usage error, rather
  // than silently falling back to defaults.
  if (!(await fileExists(absoluteConfig))) {
    throw new AuditCommandError(`Config file not found: ${configPath}`);
  }

  return loadConfig(path.dirname(absoluteConfig), {
    configFileName: path.basename(absoluteConfig),
  });
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createReporter = (
  reporter: ReporterName,
  options: { readonly color?: boolean },
): AuditResultRenderer => {
  if (reporter === "json") {
    return new JsonReporter();
  }

  if (reporter === "html") {
    return new HtmlReporter();
  }

  return new TerminalReporter({ color: options.color });
};

const resolveReporterName = (reporter: string | undefined): ReporterName => {
  if (reporter === undefined) {
    return "terminal";
  }

  if (!isReporterName(reporter)) {
    throw new AuditCommandError(
      `Unknown reporter "${reporter}". Expected one of: ${REPORTER_NAMES.join(", ")}.`,
    );
  }

  return reporter;
};

const resolveFailOnSeverity = (
  value: string | undefined,
): Severity | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!isSeverity(value)) {
    throw new AuditCommandError(
      `Invalid --fail-on-severity "${value}". Expected one of: ${SEVERITY_LEVELS.join(", ")}.`,
    );
  }

  return value;
};

/**
 * Computes the process exit code from the configured fail policy.
 *
 * - `strict` fails on any finding (threshold `info`).
 * - `failOnSeverity` fails on findings at or above that severity.
 * - Otherwise the default threshold is `error`.
 */
export const computeExitCode = (
  findings: readonly Finding[],
  policy: { readonly strict: boolean; readonly failOnSeverity?: Severity },
): number => {
  const threshold: Severity = policy.strict
    ? "info"
    : (policy.failOnSeverity ?? "error");
  const minRank = SEVERITY_RANK[threshold];

  return findings.some((finding) => SEVERITY_RANK[finding.severity] >= minRank)
    ? 1
    : 0;
};

const isReporterName = (value: string): value is ReporterName => {
  return (REPORTER_NAMES as readonly string[]).includes(value);
};

const isSeverity = (value: string): value is Severity => {
  return (SEVERITY_LEVELS as readonly string[]).includes(value);
};
