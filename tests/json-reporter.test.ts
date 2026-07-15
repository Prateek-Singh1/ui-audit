import { describe, expect, it } from 'vitest';
import {
  JSON_REPORT_SCHEMA_VERSION,
  JsonReporter,
  Language,
  buildJsonReport,
  renderJsonReport,
  type AuditResult,
  type ExecutionError,
  type Finding,
  type ParserError,
} from '../src/index.js';

const findingWithMetadata: Finding = {
  ruleId: 'react/inline-style',
  ruleName: 'Inline style',
  message: 'Avoid inline style object literals in JSX.',
  severity: 'info',
  location: { file: 'src/Button.tsx', line: 2, column: 18 },
  suggestion: 'Prefer CSS classes.',
  metadata: { nested: { count: 3 }, tags: ['a', 'b'] },
};

const secondFinding: Finding = {
  ruleId: 'react/missing-key',
  message: 'JSX in a map callback should include a key prop.',
  severity: 'warning',
  location: { file: 'src/List.tsx', line: 5, column: 10 },
};

const executionError: ExecutionError = {
  ruleId: 'test/throws',
  ruleName: 'Throwing rule',
  filePath: '/project/src/List.tsx',
  message: 'boom',
  executionTime: 1,
};

const baseResult: AuditResult = {
  projectRoot: '/project',
  duration: 12,
  filesDiscovered: 3,
  filesScanned: 3,
  filesParsed: 2,
  rulesExecuted: 10,
  findings: [findingWithMetadata, secondFinding],
  executionErrors: [executionError],
  diagnostics: {
    scan: [
      {
        path: '/project/src/missing.tsx',
        relativePath: 'src/missing.tsx',
        code: 'ENOENT',
        message: 'Unable to scan file.',
      },
    ],
    parse: [
      {
        kind: 'syntax-error',
        path: '/project/src/broken.ts',
        language: Language.TypeScript,
        message: 'Expression expected.',
        line: 1,
        column: 23,
      } satisfies ParserError,
    ],
  },
};

const emptyResult: AuditResult = {
  projectRoot: '/empty',
  duration: 1,
  filesDiscovered: 0,
  filesScanned: 0,
  filesParsed: 0,
  rulesExecuted: 0,
  findings: [],
  executionErrors: [],
  diagnostics: { scan: [], parse: [] },
};

describe('buildJsonReport', () => {
  it('produces an empty, well-formed report for an empty audit result', () => {
    const report = buildJsonReport(emptyResult);

    expect(report.metadata).toEqual({
      tool: 'ui-audit',
      reporter: 'json',
      schemaVersion: JSON_REPORT_SCHEMA_VERSION,
    });
    expect(report.projectRoot).toBe('/empty');
    expect(report.summary).toEqual({
      filesDiscovered: 0,
      filesScanned: 0,
      filesParsed: 0,
      rulesExecuted: 0,
      findingsCount: 0,
      errorCount: 0,
    });
    expect(report.findings).toEqual([]);
    expect(report.executionErrors).toEqual([]);
    expect(report.diagnostics).toEqual({ scan: [], parse: [] });
  });

  it('derives summary counts and preserves all finding metadata', () => {
    const report = buildJsonReport(baseResult);

    expect(report.summary.findingsCount).toBe(2);
    expect(report.summary.errorCount).toBe(1);
    expect(report.summary.filesDiscovered).toBe(3);
    expect(report.summary.rulesExecuted).toBe(10);

    // Finding metadata must survive intact (deep equality, not by reference).
    expect(report.findings[0]).toEqual(findingWithMetadata);
    expect(report.findings[0]?.metadata).toEqual({ nested: { count: 3 }, tags: ['a', 'b'] });
  });

  it('includes execution errors and diagnostics without loss', () => {
    const report = buildJsonReport(baseResult);

    expect(report.executionErrors).toEqual([executionError]);
    expect(report.diagnostics.scan).toHaveLength(1);
    expect(report.diagnostics.parse).toHaveLength(1);
    expect(report.diagnostics.scan[0]?.code).toBe('ENOENT');
  });

  it('preserves deterministic finding ordering', () => {
    const report = buildJsonReport(baseResult);

    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      'react/inline-style',
      'react/missing-key',
    ]);
  });
});

describe('renderJsonReport', () => {
  it('round-trips through JSON.parse without losing data', () => {
    const parsed = JSON.parse(renderJsonReport(baseResult));

    expect(parsed.summary.findingsCount).toBe(2);
    expect(parsed.findings[0].metadata.nested.count).toBe(3);
    expect(parsed.executionErrors[0].message).toBe('boom');
    expect(parsed.diagnostics.parse[0].message).toBe('Expression expected.');
  });

  it('is byte-stable across repeated serialization of the same result', () => {
    expect(renderJsonReport(baseResult)).toBe(renderJsonReport(baseResult));
    expect(renderJsonReport(emptyResult)).toBe(renderJsonReport(emptyResult));
  });

  it('emits pretty-printed JSON', () => {
    expect(renderJsonReport(emptyResult)).toContain('\n  "metadata"');
  });
});

describe('JsonReporter', () => {
  it('conforms to the core Reporter contract', () => {
    const reporter = new JsonReporter();

    expect(reporter.name).toBe('json');
    expect(reporter.format).toBe('json');
  });

  it('renderResult matches the standalone renderer', () => {
    const reporter = new JsonReporter();

    expect(reporter.renderResult(baseResult)).toBe(renderJsonReport(baseResult));
    expect(reporter.report(baseResult)).toEqual(buildJsonReport(baseResult));
  });

  it('renders through the core Reporter interface using findings and run metadata', () => {
    const reporter = new JsonReporter();
    const output = reporter.render({
      project: { projectRoot: '/project', cwd: '/project', files: ['/project/src/Button.tsx'], env: {} },
      findings: [findingWithMetadata],
      metadata: {
        duration: 7,
        filesDiscovered: 1,
        filesScanned: 1,
        filesParsed: 1,
        rulesExecuted: 5,
        executionErrors: [],
        diagnostics: { scan: [], parse: [] },
      },
    });
    const parsed = JSON.parse(output);

    expect(parsed.summary.findingsCount).toBe(1);
    expect(parsed.summary.rulesExecuted).toBe(5);
    expect(parsed.projectRoot).toBe('/project');
    expect(parsed.findings[0].metadata.tags).toEqual(['a', 'b']);
  });

  it('degrades gracefully when the core interface receives only findings', () => {
    const reporter = new JsonReporter();
    const parsed = JSON.parse(
      reporter.render({
        project: { projectRoot: '/p', cwd: '/p', files: [], env: {} },
        findings: [],
      }),
    );

    expect(parsed.summary.findingsCount).toBe(0);
    expect(parsed.summary.rulesExecuted).toBe(0);
    expect(parsed.diagnostics).toEqual({ scan: [], parse: [] });
  });
});
