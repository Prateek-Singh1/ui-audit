import { describe, expect, it } from 'vitest';
import {
  Language,
  TerminalReporter,
  type AuditResult,
  type ExecutionError,
  type Finding,
  type ParserError,
} from '../src/index.js';

const stripAnsi = (value: string): string => value.replace(/\x1b\[[0-9;]*m/g, "");

const makeFinding = (severity: Finding['severity'], ruleId: string, file: string): Finding => ({
  ruleId,
  severity,
  message: `${ruleId} message`,
  location: { file, line: 4, column: 8 },
  suggestion: `${ruleId} suggestion`,
});

const emptyResult: AuditResult = {
  projectRoot: '/project',
  duration: 5,
  filesDiscovered: 2,
  filesScanned: 2,
  filesParsed: 2,
  rulesExecuted: 8,
  findings: [],
  executionErrors: [],
  diagnostics: { scan: [], parse: [] },
};

const multiSeverityResult: AuditResult = {
  projectRoot: '/project',
  duration: 12,
  filesDiscovered: 4,
  filesScanned: 4,
  filesParsed: 3,
  rulesExecuted: 20,
  findings: [
    makeFinding('info', 'react/inline-style', 'src/Button.tsx'),
    makeFinding('critical', 'a11y/no-autofocus', 'src/Modal.tsx'),
    makeFinding('warning', 'react/missing-key', 'src/List.tsx'),
    makeFinding('error', 'react/no-danger', 'src/Raw.tsx'),
    makeFinding('warning', 'react/nested-ternary', 'src/Cond.tsx'),
  ],
  executionErrors: [],
  diagnostics: { scan: [], parse: [] },
};

const parserError: ParserError = {
  kind: 'syntax-error',
  path: '/project/src/broken.ts',
  language: Language.TypeScript,
  message: 'Expression expected.',
  line: 1,
  column: 23,
};

const executionError: ExecutionError = {
  ruleId: 'test/throws',
  ruleName: 'Throwing rule',
  filePath: '/project/src/List.tsx',
  message: 'boom',
  executionTime: 1,
};

describe('TerminalReporter', () => {
  it('conforms to the core Reporter contract', () => {
    const reporter = new TerminalReporter();
    expect(reporter.name).toBe('terminal');
    expect(reporter.format).toBe('text');
  });

  it('renders a clean summary and success footer for an empty report', () => {
    const output = new TerminalReporter({ color: false }).renderResult(emptyResult);

    expect(output).toContain('Files discovered: 2');
    expect(output).toContain('Files parsed:     2');
    expect(output).toContain('Rules executed:   8');
    expect(output).toContain('Findings:         0');
    expect(output).toContain('Errors:           0');
    expect(output).toContain('Duration:         5ms');
    expect(output).toContain('✔ No findings.');
    expect(output).toContain('✔ No issues found.');
  });

  it('groups findings by category, then by severity, in a deterministic order', () => {
    const output = new TerminalReporter({ color: false }).renderResult(multiSeverityResult);

    // Categories render in the fixed order React → Accessibility → Performance.
    const reactAt = output.indexOf('React (4)');
    const accessibilityAt = output.indexOf('Accessibility (1)');

    expect(reactAt).toBeGreaterThan(-1);
    expect(accessibilityAt).toBeGreaterThan(reactAt);

    // Within the React category, severities render most-severe first.
    const errorAt = output.indexOf('ERROR (1)');
    const warningAt = output.indexOf('WARNING (2)');
    const infoAt = output.indexOf('INFO (1)');

    expect(errorAt).toBeGreaterThan(reactAt);
    expect(warningAt).toBeGreaterThan(errorAt);
    expect(infoAt).toBeGreaterThan(warningAt);

    // The lone critical finding sits under Accessibility, after all React output.
    expect(output.indexOf('CRITICAL (1)')).toBeGreaterThan(accessibilityAt);
  });

  it('renders each finding with rule id, location, message, and suggestion', () => {
    const output = new TerminalReporter({ color: false }).renderResult(multiSeverityResult);

    expect(output).toContain('[error] react/no-danger  src/Raw.tsx:4:8');
    expect(output).toContain('react/no-danger message');
    expect(output).toContain('↳ react/no-danger suggestion');
  });

  it('renders parser failures gracefully', () => {
    const result: AuditResult = {
      ...emptyResult,
      diagnostics: { scan: [], parse: [parserError] },
    };
    const output = new TerminalReporter({ color: false }).renderResult(result);

    expect(output).toContain('Parse diagnostics (1)');
    expect(output).toContain('/project/src/broken.ts:1:23  Expression expected.');
  });

  it('renders execution errors and reflects them in the footer', () => {
    const result: AuditResult = { ...emptyResult, executionErrors: [executionError] };
    const output = new TerminalReporter({ color: false }).renderResult(result);

    expect(output).toContain('Execution errors (1)');
    expect(output).toContain('test/throws');
    expect(output).toContain('boom');
    expect(output).toContain('✖');
    expect(output).not.toContain('✔ No issues found.');
  });

  it('produces deterministic output across repeated renders', () => {
    const reporter = new TerminalReporter({ color: false });
    expect(reporter.renderResult(multiSeverityResult)).toBe(
      reporter.renderResult(multiSeverityResult),
    );
  });

  it('matches a stable, color-free snapshot', () => {
    const output = new TerminalReporter({ color: false }).renderResult(multiSeverityResult);
    expect(output).toMatchInlineSnapshot(`
      "ui-audit report
      Project: /project

      Summary
        Files discovered: 4
        Files scanned:    4
        Files parsed:     3
        Rules executed:   20
        Findings:         5
        Errors:           0
        Duration:         12ms
        Category totals:  React 4, Accessibility 1
        Severity totals:  critical 1, error 1, warning 2, info 1

      Findings

      React (4)
        ERROR (1)
          [error] react/no-danger  src/Raw.tsx:4:8
              react/no-danger message
              ↳ react/no-danger suggestion
        WARNING (2)
          [warning] react/missing-key  src/List.tsx:4:8
              react/missing-key message
              ↳ react/missing-key suggestion
          [warning] react/nested-ternary  src/Cond.tsx:4:8
              react/nested-ternary message
              ↳ react/nested-ternary suggestion
        INFO (1)
          [info] react/inline-style  src/Button.tsx:4:8
              react/inline-style message
              ↳ react/inline-style suggestion

      Accessibility (1)
        CRITICAL (1)
          [critical] a11y/no-autofocus  src/Modal.tsx:4:8
              a11y/no-autofocus message
              ↳ a11y/no-autofocus suggestion

      ✖ 5 findings in 3 files (12ms)"
    `);
  });

  it('applies ANSI colors that strip down to the color-free output', () => {
    const colored = new TerminalReporter({ color: true }).renderResult(multiSeverityResult);
    const plain = new TerminalReporter({ color: false }).renderResult(multiSeverityResult);

    expect(colored.length).toBeGreaterThan(plain.length);
    expect(colored).not.toBe(plain);
    expect(stripAnsi(colored)).toBe(plain);
  });

  it('supports the core Reporter interface with run metadata', () => {
    const reporter = new TerminalReporter({ color: false });
    const output = reporter.render({
      project: { projectRoot: '/project', cwd: '/project', files: ['/project/a.tsx'], env: {} },
      findings: [makeFinding('warning', 'react/missing-key', 'src/List.tsx')],
      metadata: {
        duration: 9,
        filesDiscovered: 1,
        filesParsed: 1,
        rulesExecuted: 5,
      },
    });

    expect(output).toContain('Rules executed:   5');
    expect(output).toContain('WARNING (1)');
    expect(output).toContain('Duration:         9ms');
  });
});
