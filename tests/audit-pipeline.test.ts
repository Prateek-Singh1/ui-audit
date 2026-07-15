import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AuditPipeline,
  RuleRegistry,
  assertValidConfig,
  runAudit,
  type Rule,
} from '../src/index.js';

const tempRoots: string[] = [];

const createTempProject = async (
  files: Readonly<Record<string, string>> = {},
): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-pipeline-'));
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

const INLINE_STYLE_COMPONENT = `export const Button = () => {
  return <button style={{ color: 'red' }}>Click</button>;
};
`;

const CLEAN_COMPONENT = `export const Hello = () => {
  return <span>hello world</span>;
};
`;

describe('AuditPipeline', () => {
  it('returns an empty, well-formed result for an empty project', async () => {
    const root = await createTempProject();

    const result = await runAudit({ projectRoot: root });

    expect(result.projectRoot).toBe(path.resolve(root));
    expect(result.filesDiscovered).toBe(0);
    expect(result.filesScanned).toBe(0);
    expect(result.filesParsed).toBe(0);
    expect(result.rulesExecuted).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.executionErrors).toEqual([]);
    expect(result.diagnostics.scan).toEqual([]);
    expect(result.diagnostics.parse).toEqual([]);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('produces findings for a project that violates a rule', async () => {
    const root = await createTempProject({ 'src/Button.tsx': INLINE_STYLE_COMPONENT });

    const result = await runAudit({ projectRoot: root });

    expect(result.filesDiscovered).toBe(1);
    expect(result.filesScanned).toBe(1);
    expect(result.filesParsed).toBe(1);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.ruleId === 'react/inline-style')).toBe(true);
    expect(result.executionErrors).toEqual([]);
  });

  it('reports no findings for a clean project', async () => {
    const root = await createTempProject({ 'src/Hello.tsx': CLEAN_COMPONENT });

    const result = await runAudit({ projectRoot: root });

    expect(result.filesParsed).toBe(1);
    expect(result.rulesExecuted).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
    expect(result.executionErrors).toEqual([]);
  });

  it('surfaces parser failures as diagnostics and excludes them from analysis', async () => {
    const root = await createTempProject({
      'src/broken.ts': 'export const broken = ;\n',
      'src/Hello.tsx': CLEAN_COMPONENT,
    });

    const result = await runAudit({ projectRoot: root });

    expect(result.filesDiscovered).toBe(2);
    expect(result.filesScanned).toBe(2);
    // The broken file is not analyzable; only the clean component parses.
    expect(result.filesParsed).toBe(1);
    expect(result.diagnostics.parse.length).toBeGreaterThan(0);
    expect(result.diagnostics.parse.some((error) => error.path.endsWith('broken.ts'))).toBe(true);
  });

  it('isolates rule failures and still returns a result', async () => {
    const throwingRule: Rule = {
      id: 'test/throws',
      name: 'Throwing rule',
      description: 'Always throws to exercise error isolation.',
      category: 'react',
      severity: 'warning',
      enabledByDefault: true,
      evaluate() {
        throw new Error('boom');
      },
    };
    const registry = new RuleRegistry();
    registry.registerRule(throwingRule);

    const root = await createTempProject({ 'src/Hello.tsx': CLEAN_COMPONENT });
    const pipeline = new AuditPipeline({ registry });

    const result = await pipeline.run({ projectRoot: root });

    expect(result.executionErrors.length).toBe(1);
    expect(result.executionErrors[0]?.ruleId).toBe('test/throws');
    expect(result.executionErrors[0]?.message).toBe('boom');
    expect(result.findings).toEqual([]);
  });

  it('skips rules disabled by configuration', async () => {
    const root = await createTempProject({ 'src/Button.tsx': INLINE_STYLE_COMPONENT });

    const enabled = await runAudit({ projectRoot: root });
    expect(enabled.findings.some((finding) => finding.ruleId === 'react/inline-style')).toBe(true);

    const config = assertValidConfig(
      { rules: { 'react/inline-style': 'off' } },
      { projectRoot: root },
    );
    const disabled = await runAudit({ projectRoot: root, config });

    expect(disabled.findings.some((finding) => finding.ruleId === 'react/inline-style')).toBe(false);
  });

  it('applies configured severity overrides to findings', async () => {
    const root = await createTempProject({ 'src/Button.tsx': INLINE_STYLE_COMPONENT });

    const config = assertValidConfig(
      { rules: { 'react/inline-style': 'error' } },
      { projectRoot: root },
    );
    const result = await runAudit({ projectRoot: root, config });

    const finding = result.findings.find((entry) => entry.ruleId === 'react/inline-style');
    expect(finding?.severity).toBe('error');
  });

  it('produces deterministic, stable ordering across runs', async () => {
    const root = await createTempProject({
      'src/b/Second.tsx': INLINE_STYLE_COMPONENT,
      'src/a/First.tsx': INLINE_STYLE_COMPONENT,
      'src/Hello.tsx': CLEAN_COMPONENT,
    });

    const first = await runAudit({ projectRoot: root });
    const second = await runAudit({ projectRoot: root });

    expect(first.findings).toEqual(second.findings);
    expect(first.findings.map((finding) => finding.location?.file)).toEqual(
      second.findings.map((finding) => finding.location?.file),
    );
    expect(first.filesDiscovered).toBe(second.filesDiscovered);
  });
});
