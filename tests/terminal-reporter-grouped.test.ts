import { describe, expect, it } from 'vitest';
import { TerminalReporter, type AuditResult, type Finding } from '../src/index.js';

const makeFinding = (severity: Finding['severity'], ruleId: string, file: string, line = 4): Finding => ({
  ruleId,
  severity,
  message: `${ruleId} message`,
  location: { file, line, column: 8 },
  suggestion: `${ruleId} suggestion`,
});

const baseResult = (findings: readonly Finding[]): AuditResult => ({
  projectRoot: '/project',
  duration: 7,
  filesDiscovered: 3,
  filesScanned: 3,
  filesParsed: 3,
  rulesExecuted: 30,
  findings,
  executionErrors: [],
  diagnostics: { scan: [], parse: [] },
});

const render = (findings: readonly Finding[]): string =>
  new TerminalReporter({ color: false }).renderResult(baseResult(findings));

describe('TerminalReporter — grouped output', () => {
  it('renders empty results with no category sections', () => {
    const output = render([]);

    expect(output).toContain('Findings:         0');
    expect(output).toContain('Category totals:  none');
    expect(output).toContain('Severity totals:  none');
    expect(output).toContain('✔ No findings.');
    expect(output).not.toContain('React (');
    expect(output).not.toContain('Accessibility (');
    expect(output).not.toContain('Performance (');
  });

  it('renders a single category snapshot', () => {
    const output = render([
      makeFinding('warning', 'perf/no-large-switch', 'src/reducer.ts', 12),
      makeFinding('info', 'perf/no-large-array-literal', 'src/data.ts', 3),
    ]);

    expect(output).toMatchInlineSnapshot(`
      "ui-audit report
      Project: /project

      Summary
        Files discovered: 3
        Files scanned:    3
        Files parsed:     3
        Rules executed:   30
        Findings:         2
        Errors:           0
        Duration:         7ms
        Category totals:  Performance 2
        Severity totals:  warning 1, info 1

      Findings

      Performance (2)
        WARNING (1)
          [warning] perf/no-large-switch  src/reducer.ts:12:8
              perf/no-large-switch message
              ↳ perf/no-large-switch suggestion
        INFO (1)
          [info] perf/no-large-array-literal  src/data.ts:3:8
              perf/no-large-array-literal message
              ↳ perf/no-large-array-literal suggestion

      ⚠ 2 findings in 3 files (7ms)"
    `);
  });

  it('renders multiple categories in the required order', () => {
    const output = render([
      makeFinding('info', 'perf/no-sync-storage', 'src/store.ts'),
      makeFinding('warning', 'a11y/img-alt', 'src/Hero.tsx'),
      makeFinding('error', 'react/no-dangerously-set-inner-html', 'src/Raw.tsx'),
    ]);

    const reactAt = output.indexOf('React (1)');
    const accessibilityAt = output.indexOf('Accessibility (1)');
    const performanceAt = output.indexOf('Performance (1)');

    expect(reactAt).toBeGreaterThan(-1);
    expect(accessibilityAt).toBeGreaterThan(reactAt);
    expect(performanceAt).toBeGreaterThan(accessibilityAt);
    expect(output).toContain('Category totals:  React 1, Accessibility 1, Performance 1');
  });

  it('sorts within a category by severity, then rule id, then file, then line', () => {
    const output = render([
      makeFinding('warning', 'react/max-props', 'src/z.tsx', 30),
      makeFinding('warning', 'react/max-props', 'src/a.tsx', 5),
      makeFinding('error', 'react/no-duplicate-props', 'src/b.tsx', 9),
      makeFinding('warning', 'react/inline-style', 'src/a.tsx', 2),
    ]);

    const order = [
      'react/no-duplicate-props  src/b.tsx:9:8', // error first
      'react/inline-style  src/a.tsx:2:8', // warning, rule id sorts before max-props
      'react/max-props  src/a.tsx:5:8', // same rule id: file a before z
      'react/max-props  src/z.tsx:30:8',
    ].map((needle) => output.indexOf(needle));

    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('produces byte-identical output across repeated renders (deterministic)', () => {
    const findings = [
      makeFinding('info', 'perf/no-sync-storage', 'src/store.ts'),
      makeFinding('warning', 'a11y/img-alt', 'src/Hero.tsx'),
      makeFinding('error', 'react/no-dangerously-set-inner-html', 'src/Raw.tsx'),
      makeFinding('critical', 'a11y/no-autofocus', 'src/Modal.tsx'),
    ];

    expect(render(findings)).toBe(render(findings));
  });
});
