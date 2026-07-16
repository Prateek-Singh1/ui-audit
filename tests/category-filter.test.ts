import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditCommandError, runAuditCommand } from '../src/cli/index.js';
import {
  availableCategories,
  createCategoryFilteredRegistry,
  parseCategorySelection,
} from '../src/cli/category-filter.js';

const tempRoots: string[] = [];

const createTempProject = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-category-'));
  tempRoots.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// A component that trips rules across all three categories:
// - react/inline-style (React)
// - a11y/img-alt (Accessibility)
// - perf/no-sync-storage (Performance)
const MIXED_COMPONENT = `export const Panel = () => {
  const theme = localStorage.getItem('theme');
  return (
    <div style={{ color: 'red' }}>
      <img src="/logo.png" />
      {theme}
    </div>
  );
};
`;

const ruleIds = (findings: readonly { ruleId: string }[]): string[] =>
  [...new Set(findings.map((finding) => finding.ruleId))].sort();

const categoriesOf = (ids: readonly string[]): Set<string> =>
  new Set(ids.map((id) => id.split('/')[0]));

describe('parseCategorySelection', () => {
  it('selects every available category by default', () => {
    const selection = parseCategorySelection(undefined);
    expect(selection.filtered).toBe(false);
    expect(selection.categories).toEqual(availableCategories());
  });

  it('is case-insensitive and order-normalized', () => {
    const selection = parseCategorySelection('performance,REACT');
    expect(selection.filtered).toBe(true);
    // Normalized to display order regardless of input order/casing.
    expect(selection.categories).toEqual(['React', 'Performance']);
  });

  it('throws a friendly error listing supported categories for unknown values', () => {
    expect(() => parseCategorySelection('foo')).toThrow(AuditCommandError);
    expect(() => parseCategorySelection('foo')).toThrow(
      /Supported categories: react, accessibility, performance\./,
    );
  });
});

describe('createCategoryFilteredRegistry', () => {
  it('registers only rules in the selected categories and counts the rest as skipped', () => {
    const { registry, rulesSelected, rulesSkipped } = createCategoryFilteredRegistry(['Performance']);
    const rules = registry.list();

    expect(rules.length).toBe(rulesSelected);
    expect(rulesSkipped).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.category === 'Performance')).toBe(true);
    expect(rules.every((rule) => rule.id.startsWith('perf/'))).toBe(true);
  });
});

describe('runAuditCommand --category', () => {
  it('runs a single category only', async () => {
    const root = await createTempProject({ 'src/Panel.tsx': MIXED_COMPONENT });

    const outcome = await runAuditCommand({ path: root, cwd: root, category: 'performance' });
    const ids = ruleIds(outcome.result.findings);

    expect(ids.length).toBeGreaterThan(0);
    expect(categoriesOf(ids)).toEqual(new Set(['perf']));
    expect(outcome.result.selectedCategories).toEqual(['Performance']);
    expect(outcome.result.rulesSkipped).toBeGreaterThan(0);
    expect(outcome.stdout).toContain('Selected categories: Performance');
  });

  it('runs multiple categories', async () => {
    const root = await createTempProject({ 'src/Panel.tsx': MIXED_COMPONENT });

    const outcome = await runAuditCommand({ path: root, cwd: root, category: 'react,performance' });
    const cats = categoriesOf(ruleIds(outcome.result.findings));

    expect(cats.has('react')).toBe(true);
    expect(cats.has('perf')).toBe(true);
    expect(cats.has('a11y')).toBe(false);
    expect(outcome.result.selectedCategories).toEqual(['React', 'Performance']);
  });

  it('rejects an unknown category with a friendly validation error', async () => {
    const root = await createTempProject({ 'src/Panel.tsx': MIXED_COMPONENT });

    await expect(
      runAuditCommand({ path: root, cwd: root, category: 'styling' }),
    ).rejects.toThrow(/Unknown category "styling"\. Supported categories: react, accessibility, performance\./);
  });

  it('runs every category by default (current behavior)', async () => {
    const root = await createTempProject({ 'src/Panel.tsx': MIXED_COMPONENT });

    const outcome = await runAuditCommand({ path: root, cwd: root });
    const cats = categoriesOf(ruleIds(outcome.result.findings));

    expect(cats).toEqual(new Set(['react', 'a11y', 'perf']));
    expect(outcome.result.rulesSkipped).toBe(0);
    expect(outcome.result.selectedCategories).toEqual(['React', 'Accessibility', 'Performance']);
  });

  it('produces deterministic findings across repeated filtered runs', async () => {
    const root = await createTempProject({ 'src/Panel.tsx': MIXED_COMPONENT });

    const first = await runAuditCommand({ path: root, cwd: root, category: 'react,performance' });
    const second = await runAuditCommand({ path: root, cwd: root, category: 'performance,react' });

    // Same selection regardless of token order, and identical rendered output
    // (ignoring the wall-clock duration line, which is not part of ordering).
    expect(first.result.selectedCategories).toEqual(second.result.selectedCategories);
    expect(withoutDuration(first.stdout)).toBe(withoutDuration(second.stdout));
  });
});

/** Removes the volatile wall-clock duration so output can be compared for determinism. */
const withoutDuration = (output: string): string =>
  output.replace(/^\s*Duration:.*$/m, '  Duration:').replace(/\(\d+ms\)/g, '(Nms)');
