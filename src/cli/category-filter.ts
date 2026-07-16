import { RuleRegistry } from '../core/index.js';
import { createBuiltInRules } from '../pipeline/index.js';
import { CATEGORY_DISPLAY_ORDER } from '../reporters/finding-categories.js';
import { AuditCommandError } from './audit-command.js';

/**
 * Category filtering for the `audit` command.
 *
 * Selection is driven entirely by existing rule metadata (`rule.category`): the
 * set of selectable categories is derived from the built-in rules rather than a
 * duplicated list, so it always matches what actually ships. Filtering happens
 * at the registry level — a {@link RuleRegistry} containing only the selected
 * rules is handed to the pipeline — so no rule implementation or the rule engine
 * is touched, and execution order stays deterministic.
 */

/** Result of resolving a `--category` value. */
export interface CategorySelection {
  /** Selected category names, in display order. */
  readonly categories: readonly string[];
  /** Whether the user actively restricted the categories. */
  readonly filtered: boolean;
}

/** A registry restricted to a set of categories, with selection counts. */
export interface CategoryFilteredRegistry {
  /** Registry populated with only the selected rules. */
  readonly registry: RuleRegistry;
  /** Number of rules that will run. */
  readonly rulesSelected: number;
  /** Number of built-in rules excluded by the filter. */
  readonly rulesSkipped: number;
}

/** Orders categories by the shared display order, with any extras appended alphabetically. */
const orderCategories = (categories: Iterable<string>): string[] => {
  const set = new Set(categories);
  const known = CATEGORY_DISPLAY_ORDER.filter((category) => set.has(category));
  const extras = [...set]
    .filter((category) => !(CATEGORY_DISPLAY_ORDER as readonly string[]).includes(category))
    .sort();

  return [...known, ...extras];
};

/** Categories that have at least one built-in rule, derived from rule metadata. */
export const availableCategories = (): readonly string[] => {
  return orderCategories(createBuiltInRules().map((rule) => rule.category));
};

/**
 * Parses a comma-separated `--category` value into a canonical selection.
 *
 * Matching is case-insensitive against the lowercased category names. An
 * unspecified or empty value selects every category (current behavior). Unknown
 * tokens raise an {@link AuditCommandError} listing the supported categories.
 */
export const parseCategorySelection = (raw: string | undefined): CategorySelection => {
  const available = availableCategories();

  if (raw === undefined) {
    return { categories: available, filtered: false };
  }

  const tokens = raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { categories: available, filtered: false };
  }

  const byToken = new Map(available.map((category) => [category.toLowerCase(), category]));
  const selected = new Set<string>();
  const unknown: string[] = [];

  for (const token of tokens) {
    const canonical = byToken.get(token.toLowerCase());

    if (canonical) {
      selected.add(canonical);
    } else {
      unknown.push(token);
    }
  }

  if (unknown.length > 0) {
    const label = unknown.length === 1 ? 'category' : 'categories';
    const supported = available.map((category) => category.toLowerCase()).join(', ');

    throw new AuditCommandError(
      `Unknown ${label} ${unknown.map((value) => `"${value}"`).join(', ')}. ` +
        `Supported categories: ${supported}.`,
    );
  }

  return { categories: orderCategories(selected), filtered: true };
};

/**
 * Builds a registry containing only rules whose category is in {@link categories}.
 * Built-in rule order is preserved, keeping execution deterministic.
 */
export const createCategoryFilteredRegistry = (
  categories: readonly string[],
): CategoryFilteredRegistry => {
  const selected = new Set(categories);
  const registry = new RuleRegistry();
  const rules = createBuiltInRules();
  let rulesSkipped = 0;

  for (const rule of rules) {
    if (selected.has(rule.category)) {
      registry.registerRule(rule);
    } else {
      rulesSkipped += 1;
    }
  }

  return { registry, rulesSelected: rules.length - rulesSkipped, rulesSkipped };
};
