import type { AuditConfig } from './config.js';
import type { Finding } from './finding.js';
import type { ProjectContext } from './context.js';
import type { RuleRegistry } from './registry.js';

/**
 * A scanning implementation that can evaluate a project using the registered rules.
 */
export interface Scanner {
  /** Human-readable scanner name. */
  readonly name: string;
  /** Optional scanner version for diagnostics and compatibility checks. */
  readonly version?: string;
  /** Executes the scan workflow for the provided project context. */
  scan(context: ProjectContext, config: AuditConfig, registry: RuleRegistry): Promise<ScannerResult>;
}

/**
 * The result emitted by a scanner after a run completes.
 */
export interface ScannerResult {
  /** Project context associated with the scan. */
  readonly project: ProjectContext;
  /** Findings collected during the audit. */
  readonly findings: readonly Finding[];
  /** Optional metadata for downstream tooling. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}
