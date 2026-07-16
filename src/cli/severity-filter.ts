import type { Finding, Severity } from '../core/index.js';
import { SEVERITY_ORDER } from '../reporters/finding-categories.js';
import { AuditCommandError, SEVERITY_LEVELS } from './audit-command.js';

/**
 * Severity filtering for the `audit` command.
 *
 * Selectable severities are the existing core severity levels
 * ({@link SEVERITY_LEVELS}) — no new list is defined. Filtering is applied to
 * findings after rule execution, so execution statistics remain accurate and
 * only the reported set is affected. Order is preserved, keeping output
 * deterministic.
 */

/** Result of resolving a `--severity` value. */
export interface SeveritySelection {
  /** Selected severities, in display order (most severe first). */
  readonly severities: readonly Severity[];
  /** Whether the user actively restricted the severities. */
  readonly filtered: boolean;
}

/** The findings kept by a severity filter, plus how many were hidden. */
export interface SeverityFilterResult {
  /** Findings whose severity is in the selection, in their original order. */
  readonly visible: readonly Finding[];
  /** Number of findings removed by the filter. */
  readonly hidden: number;
}

/** Orders severities most-severe-first using the shared severity order. */
const orderSeverities = (severities: Iterable<Severity>): Severity[] => {
  const set = new Set(severities);
  return SEVERITY_ORDER.filter((severity) => set.has(severity));
};

/**
 * Parses a comma-separated `--severity` value into a canonical selection.
 *
 * Matching is case-insensitive. An unspecified or empty value selects every
 * severity (current behavior). Unknown tokens raise an {@link AuditCommandError}
 * listing the supported severities.
 */
export const parseSeveritySelection = (raw: string | undefined): SeveritySelection => {
  if (raw === undefined) {
    return { severities: [...SEVERITY_ORDER], filtered: false };
  }

  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { severities: [...SEVERITY_ORDER], filtered: false };
  }

  const valid = new Set<string>(SEVERITY_LEVELS);
  const selected = new Set<Severity>();
  const unknown: string[] = [];

  for (const token of tokens) {
    const normalized = token.toLowerCase();

    if (valid.has(normalized)) {
      selected.add(normalized as Severity);
    } else {
      unknown.push(token);
    }
  }

  if (unknown.length > 0) {
    const label = unknown.length === 1 ? 'severity' : 'severities';
    const supported = SEVERITY_LEVELS.join(', ');

    throw new AuditCommandError(
      `Unknown ${label} ${unknown.map((value) => `"${value}"`).join(', ')}. ` +
        `Supported severities: ${supported}.`,
    );
  }

  return { severities: orderSeverities(selected), filtered: true };
};

/** Keeps only findings whose severity is in {@link severities}, preserving order. */
export const filterFindingsBySeverity = (
  findings: readonly Finding[],
  severities: readonly Severity[],
): SeverityFilterResult => {
  const allowed = new Set(severities);
  const visible = findings.filter((finding) => allowed.has(finding.severity));

  return { visible, hidden: findings.length - visible.length };
};
