import type { Severity } from '../core/index.js';

/**
 * Built-in severity levels supported by ui-audit rules.
 */
export enum RuleSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

/**
 * Complete list of built-in rule severities.
 */
export const RULE_SEVERITIES = [
  RuleSeverity.Info,
  RuleSeverity.Warning,
  RuleSeverity.Error,
  RuleSeverity.Critical,
] as const;

/**
 * Converts an SDK severity value into the core finding severity type.
 */
export const toCoreSeverity = (severity: RuleSeverity): Severity => {
  return severity;
};
