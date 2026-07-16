import type { Finding, Severity } from '../core/index.js';
import { createBuiltInRules } from '../pipeline/default-registry.js';
import { RuleCategory } from '../rules/categories.js';

/**
 * Presentation helpers that group audit findings into logical rule categories
 * for the terminal reporter.
 *
 * Category attribution reuses existing rule metadata: an id→category map is
 * built once from the built-in rule set (`rule.category`). Findings from rules
 * outside the built-in set fall back to their id namespace (`react/`, `a11y/`,
 * `perf/`) and finally to an "Other" bucket, so nothing is ever silently
 * dropped. No rule implementation, the rule engine, or the JSON reporter is
 * touched — this module only shapes presentation.
 */

/** Category render order required by the enhanced reporter. */
export const CATEGORY_DISPLAY_ORDER: readonly RuleCategory[] = [
  RuleCategory.React,
  RuleCategory.Accessibility,
  RuleCategory.Performance,
];

/** Severity render order, most severe first. Deterministic. */
export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'error', 'warning', 'info'];

/** Bucket used for findings that map to no known category. */
export const OTHER_CATEGORY = 'Other';

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

const PREFIX_CATEGORY: Readonly<Record<string, RuleCategory>> = {
  react: RuleCategory.React,
  a11y: RuleCategory.Accessibility,
  perf: RuleCategory.Performance,
};

/** A category paired with its sorted findings. */
export interface CategoryGroup {
  /** Human-readable category name. */
  readonly category: string;
  /** Findings in this category, already sorted deterministically. */
  readonly findings: readonly Finding[];
}

let ruleCategoryMap: Map<string, string> | undefined;

/** Builds (once) the id→category map from built-in rule metadata. */
const categoryMap = (): Map<string, string> => {
  if (!ruleCategoryMap) {
    ruleCategoryMap = new Map<string, string>();

    for (const rule of createBuiltInRules()) {
      ruleCategoryMap.set(rule.id, rule.category);
    }
  }

  return ruleCategoryMap;
};

/** Resolves the display category for a rule id, reusing rule metadata. */
export const categoryForRuleId = (ruleId: string): string => {
  const mapped = categoryMap().get(ruleId);

  if (mapped) {
    return mapped;
  }

  const prefix = ruleId.split('/')[0] ?? '';
  return PREFIX_CATEGORY[prefix] ?? OTHER_CATEGORY;
};

/**
 * Deterministic finding comparator: severity (most severe first), then rule id,
 * then file, then line — all ascending after severity.
 */
export const compareFindings = (a: Finding, b: Finding): number => {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

  if (bySeverity !== 0) {
    return bySeverity;
  }

  if (a.ruleId !== b.ruleId) {
    return a.ruleId < b.ruleId ? -1 : 1;
  }

  const fileA = a.location?.file ?? '';
  const fileB = b.location?.file ?? '';

  if (fileA !== fileB) {
    return fileA < fileB ? -1 : 1;
  }

  return (a.location?.line ?? 0) - (b.location?.line ?? 0);
};

/**
 * Groups findings by category in the required display order (known categories
 * first, any others alphabetically), each group sorted by {@link compareFindings}.
 * Categories with no findings are omitted.
 */
export const groupFindingsByCategory = (
  findings: readonly Finding[],
): readonly CategoryGroup[] => {
  const byCategory = new Map<string, Finding[]>();

  for (const finding of findings) {
    const category = categoryForRuleId(finding.ruleId);
    const bucket = byCategory.get(category);

    if (bucket) {
      bucket.push(finding);
    } else {
      byCategory.set(category, [finding]);
    }
  }

  const known = CATEGORY_DISPLAY_ORDER.filter((category) => byCategory.has(category));
  const extras = [...byCategory.keys()]
    .filter((category) => !CATEGORY_DISPLAY_ORDER.includes(category as RuleCategory))
    .sort();

  return [...known, ...extras].map((category) => ({
    category,
    findings: [...(byCategory.get(category) ?? [])].sort(compareFindings),
  }));
};

/** Ordered `Category count` totals across all display categories with findings. */
export const categoryTotals = (findings: readonly Finding[]): readonly string[] => {
  return groupFindingsByCategory(findings).map(
    (group) => `${group.category} ${group.findings.length}`,
  );
};

/** Ordered `severity count` totals for every severity that has findings. */
export const severityTotals = (findings: readonly Finding[]): readonly string[] => {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ severity, count }) => `${severity} ${count}`);
};
