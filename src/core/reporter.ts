import type { AuditConfig } from './config.js';
import type { Finding } from './finding.js';
import type { ProjectContext } from './context.js';

/**
 * A renderer responsible for presenting audit results in a specific format.
 */
export interface Reporter {
  /** Stable reporter identifier. */
  readonly name: string;
  /** Output format family such as text, json, or sarif. */
  readonly format: string;
  /** Renders the final results for the current run. */
  render(results: ReporterResult, config: AuditConfig, project: ProjectContext): string | Promise<string>;
}

/**
 * Shared payload passed to reporters for output generation.
 */
export interface ReporterResult {
  /** Project context for the run. */
  readonly project: ProjectContext;
  /** All findings collected during the scan. */
  readonly findings: readonly Finding[];
  /** Optional metadata to include in render output. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
