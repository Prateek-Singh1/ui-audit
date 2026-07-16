import type { AuditConfig, Finding, ProjectContext, Reporter, ReporterResult } from '../core/index.js';
import type { ExecutionError } from '../rule-engine/index.js';
import type { AuditDiagnostics, AuditResult } from '../pipeline/index.js';

/** Current JSON report schema version. Bump on breaking output changes. */
export const JSON_REPORT_SCHEMA_VERSION = 1;

/**
 * Static, deterministic descriptor of the report producer. Intentionally free of
 * timestamps or environment data so serialization is byte-stable across runs.
 */
export interface JsonReportMetadata {
  /** Producing tool identifier. */
  readonly tool: string;
  /** Reporter name that produced this document. */
  readonly reporter: string;
  /** Report schema version for downstream consumers. */
  readonly schemaVersion: number;
  /**
   * Severities the findings were filtered to, when severity filtering was
   * active. Omitted otherwise, preserving the existing schema for unfiltered
   * runs.
   */
  readonly selectedSeverities?: readonly string[];
}

/**
 * Aggregate counts describing the audit run.
 */
export interface JsonReportSummary {
  readonly filesDiscovered: number;
  readonly filesScanned: number;
  readonly filesParsed: number;
  readonly rulesExecuted: number;
  readonly findingsCount: number;
  readonly errorCount: number;
}

/**
 * Structured, machine-readable representation of an {@link AuditResult}.
 */
export interface JsonReport {
  readonly metadata: JsonReportMetadata;
  readonly projectRoot: string;
  readonly duration: number;
  readonly summary: JsonReportSummary;
  readonly findings: readonly Finding[];
  readonly executionErrors: readonly ExecutionError[];
  readonly diagnostics: AuditDiagnostics;
}

/**
 * Optional run-level statistics a caller may attach to a {@link ReporterResult}
 * when driving the reporter through the core {@link Reporter} contract, which
 * itself only carries findings. Absent fields degrade gracefully.
 */
export interface AuditRunMetadata {
  readonly duration?: number;
  readonly filesDiscovered?: number;
  readonly filesScanned?: number;
  readonly filesParsed?: number;
  readonly rulesExecuted?: number;
  readonly executionErrors?: readonly ExecutionError[];
  readonly diagnostics?: AuditDiagnostics;
}

const REPORT_METADATA: JsonReportMetadata = {
  tool: 'ui-audit',
  reporter: 'json',
  schemaVersion: JSON_REPORT_SCHEMA_VERSION,
};

const EMPTY_DIAGNOSTICS: AuditDiagnostics = { scan: [], parse: [] };

/**
 * Builds the canonical plain-object JSON report from an audit result.
 *
 * Findings and errors are passed through by reference so no metadata is lost.
 * No serialization happens here; the return value is a plain object.
 */
export const buildJsonReport = (result: AuditResult): JsonReport => {
  return {
    metadata: result.selectedSeverities
      ? { ...REPORT_METADATA, selectedSeverities: result.selectedSeverities }
      : REPORT_METADATA,
    projectRoot: result.projectRoot,
    duration: result.duration,
    summary: {
      filesDiscovered: result.filesDiscovered,
      filesScanned: result.filesScanned,
      filesParsed: result.filesParsed,
      rulesExecuted: result.rulesExecuted,
      findingsCount: result.findings.length,
      errorCount: result.executionErrors.length,
    },
    findings: result.findings,
    executionErrors: result.executionErrors,
    diagnostics: result.diagnostics,
  };
};

/**
 * Serializes a JSON report to a stable, pretty-printed string. This is the only
 * place serialization occurs.
 */
export const renderJsonReport = (result: AuditResult): string => {
  return serialize(buildJsonReport(result));
};

/**
 * Production JSON reporter.
 *
 * Implements the core {@link Reporter} contract so it can be registered like any
 * other reporter. Its primary, full-fidelity entry point is
 * {@link JsonReporter.renderResult}, which serializes an {@link AuditResult}
 * produced by the audit pipeline.
 */
export class JsonReporter implements Reporter {
  readonly name = 'json';
  readonly format = 'json';

  /** Builds the plain-object report without serializing. */
  report(result: AuditResult): JsonReport {
    return buildJsonReport(result);
  }

  /** Serializes a full audit result to a stable JSON document. */
  renderResult(result: AuditResult): string {
    return renderJsonReport(result);
  }

  /**
   * Core {@link Reporter} contract entry point. The interface carries only
   * findings, so run-level statistics are read from optional
   * {@link AuditRunMetadata} when the caller provides them, defaulting
   * otherwise.
   */
  render(results: ReporterResult, _config?: AuditConfig, _project?: ProjectContext): string {
    return serialize(buildReportFromReporterResult(results));
  }
}

const buildReportFromReporterResult = (results: ReporterResult): JsonReport => {
  const stats = (results.metadata ?? {}) as AuditRunMetadata;
  const executionErrors = stats.executionErrors ?? [];

  return {
    metadata: REPORT_METADATA,
    projectRoot: results.project.projectRoot,
    duration: stats.duration ?? 0,
    summary: {
      filesDiscovered: stats.filesDiscovered ?? results.project.files.length,
      filesScanned: stats.filesScanned ?? 0,
      filesParsed: stats.filesParsed ?? 0,
      rulesExecuted: stats.rulesExecuted ?? 0,
      findingsCount: results.findings.length,
      errorCount: executionErrors.length,
    },
    findings: results.findings,
    executionErrors,
    diagnostics: stats.diagnostics ?? EMPTY_DIAGNOSTICS,
  };
};

const serialize = (report: JsonReport): string => {
  return JSON.stringify(report, null, 2);
};
