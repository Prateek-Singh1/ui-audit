import chalkDefault, { Chalk, type ChalkInstance } from 'chalk';
import type {
  AuditConfig,
  Finding,
  ProjectContext,
  Reporter,
  ReporterResult,
  Severity,
} from '../core/index.js';
import type { ExecutionError } from '../rule-engine/index.js';
import type { ParserError } from '../parser/index.js';
import type { AuditDiagnostics, AuditResult } from '../pipeline/index.js';
import type { AuditRunMetadata } from './json-reporter.js';

/** Display order for severity groups, most severe first. Deterministic. */
const SEVERITY_ORDER: readonly Severity[] = ['critical', 'error', 'warning', 'info'];

const EMPTY_DIAGNOSTICS: AuditDiagnostics = { scan: [], parse: [] };

/**
 * Options controlling terminal rendering.
 */
export interface TerminalReporterOptions {
  /**
   * Whether to emit ANSI colors. When omitted, chalk's automatic terminal
   * detection is used. Set to `false` for deterministic, color-free output.
   */
  readonly color?: boolean;
}

/**
 * Human-friendly terminal reporter.
 *
 * Implements the core {@link Reporter} contract. Its primary entry point is
 * {@link TerminalReporter.renderResult}, which renders an {@link AuditResult}
 * from the audit pipeline; the core {@link Reporter.render} path is also
 * supported for findings-only inputs.
 *
 * Output structure is deterministic; only ANSI color codes vary with the
 * configured color mode.
 */
export class TerminalReporter implements Reporter {
  readonly name = 'terminal';
  readonly format = 'text';

  private readonly chalk: ChalkInstance;

  constructor(options: TerminalReporterOptions = {}) {
    this.chalk = resolveChalk(options.color);
  }

  /** Renders a full audit result as human-friendly terminal text. */
  renderResult(result: AuditResult): string {
    return this.formatReport(result);
  }

  /**
   * Core {@link Reporter} contract entry point. Run-level statistics are read
   * from optional {@link AuditRunMetadata} when supplied, defaulting otherwise.
   */
  render(results: ReporterResult, _config?: AuditConfig, _project?: ProjectContext): string {
    return this.formatReport(reporterResultToAuditResult(results));
  }

  private formatReport(result: AuditResult): string {
    const lines: string[] = [];

    this.appendSummary(lines, result);
    this.appendFindings(lines, result.findings);
    this.appendParseDiagnostics(lines, result.diagnostics.parse);
    this.appendExecutionErrors(lines, result.executionErrors);
    this.appendFooter(lines, result);

    return lines.join('\n');
  }

  private appendSummary(lines: string[], result: AuditResult): void {
    const { chalk } = this;

    lines.push(`${chalk.bold('ui-audit')} report`);
    lines.push(`Project: ${result.projectRoot}`);
    lines.push('');
    lines.push(chalk.bold('Summary'));
    lines.push(`  Files discovered: ${result.filesDiscovered}`);
    lines.push(`  Files parsed:     ${result.filesParsed}`);
    lines.push(`  Rules executed:   ${result.rulesExecuted}`);
    lines.push(`  Findings:         ${result.findings.length}`);
    lines.push(`  Errors:           ${result.executionErrors.length}`);
    lines.push(`  Duration:         ${formatDuration(result.duration)}`);
  }

  private appendFindings(lines: string[], findings: readonly Finding[]): void {
    lines.push('');

    if (findings.length === 0) {
      lines.push(this.chalk.green('✔ No findings.'));
      return;
    }

    lines.push(this.chalk.bold('Findings'));

    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((finding) => finding.severity === severity);

      if (group.length === 0) {
        continue;
      }

      const paint = this.colorFor(severity);
      lines.push('');
      lines.push(paint(`${severity.toUpperCase()} (${group.length})`));

      for (const finding of group) {
        lines.push(
          `  ${paint(`[${severity}]`)} ${this.chalk.bold(finding.ruleId)}  ` +
            this.chalk.dim(formatLocation(finding)),
        );
        lines.push(`      ${finding.message}`);

        if (finding.suggestion) {
          lines.push(`      ${this.chalk.dim(`↳ ${finding.suggestion}`)}`);
        }
      }
    }
  }

  private appendParseDiagnostics(lines: string[], parseErrors: readonly ParserError[]): void {
    if (parseErrors.length === 0) {
      return;
    }

    lines.push('');
    lines.push(this.chalk.yellow(`Parse diagnostics (${parseErrors.length})`));

    for (const error of parseErrors) {
      lines.push(`  ${formatParserLocation(error)}  ${error.message}`);
    }
  }

  private appendExecutionErrors(lines: string[], errors: readonly ExecutionError[]): void {
    if (errors.length === 0) {
      return;
    }

    lines.push('');
    lines.push(this.chalk.red(`Execution errors (${errors.length})`));

    for (const error of errors) {
      lines.push(`  ${this.chalk.bold(error.ruleId)}  ${this.chalk.dim(error.filePath)}  ${error.message}`);
    }
  }

  private appendFooter(lines: string[], result: AuditResult): void {
    const { chalk } = this;
    const findingCount = result.findings.length;
    const errorCount = result.executionErrors.length;

    lines.push('');

    if (findingCount === 0 && errorCount === 0) {
      lines.push(`${chalk.green('✔ No issues found.')} ${chalk.dim(`(${formatDuration(result.duration)})`)}`);
      return;
    }

    const paint = this.colorFor(footerSeverity(result));
    const summary =
      `${footerSymbol(result)} ${findingCount} ${pluralize(findingCount, 'finding', 'findings')}` +
      (errorCount > 0 ? `, ${errorCount} ${pluralize(errorCount, 'error', 'errors')}` : '') +
      ` in ${result.filesParsed} ${pluralize(result.filesParsed, 'file', 'files')}`;

    lines.push(`${paint(summary)} ${chalk.dim(`(${formatDuration(result.duration)})`)}`);
  }

  private colorFor(severity: Severity): ChalkInstance {
    switch (severity) {
      case 'critical':
        return this.chalk.magenta;
      case 'error':
        return this.chalk.red;
      case 'warning':
        return this.chalk.yellow;
      case 'info':
      default:
        return this.chalk.blue;
    }
  }
}

const resolveChalk = (color?: boolean): ChalkInstance => {
  if (color === undefined) {
    return chalkDefault;
  }

  return new Chalk({ level: color ? 1 : 0 });
};

const reporterResultToAuditResult = (results: ReporterResult): AuditResult => {
  const stats = (results.metadata ?? {}) as AuditRunMetadata;
  const executionErrors = stats.executionErrors ?? [];

  return {
    projectRoot: results.project.projectRoot,
    duration: stats.duration ?? 0,
    filesDiscovered: stats.filesDiscovered ?? results.project.files.length,
    filesScanned: stats.filesScanned ?? 0,
    filesParsed: stats.filesParsed ?? 0,
    rulesExecuted: stats.rulesExecuted ?? 0,
    findings: results.findings,
    executionErrors,
    diagnostics: stats.diagnostics ?? EMPTY_DIAGNOSTICS,
  };
};

const formatLocation = (finding: Finding): string => {
  const location = finding.location;

  if (!location) {
    return '(no location)';
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

const formatParserLocation = (error: ParserError): string => {
  let formatted = error.path;

  if (error.line !== undefined) {
    formatted += `:${error.line}`;

    if (error.column !== undefined) {
      formatted += `:${error.column}`;
    }
  }

  return formatted;
};

const footerSeverity = (result: AuditResult): Severity => {
  if (result.executionErrors.length > 0) {
    return 'error';
  }

  for (const severity of SEVERITY_ORDER) {
    if (result.findings.some((finding) => finding.severity === severity)) {
      return severity;
    }
  }

  return 'info';
};

const footerSymbol = (result: AuditResult): string => {
  const severity = footerSeverity(result);

  if (severity === 'critical' || severity === 'error') {
    return '✖';
  }

  if (severity === 'warning') {
    return '⚠';
  }

  return 'ℹ';
};

const formatDuration = (duration: number): string => {
  return `${Math.round(duration)}ms`;
};

const pluralize = (count: number, singular: string, plural: string): string => {
  return count === 1 ? singular : plural;
};
