import { describe, expect, it } from 'vitest';
import type { AuditConfig } from '../src/core/config.js';
import type { Finding, Severity } from '../src/core/finding.js';
import type { ProjectContext } from '../src/core/index.js';
import { RuleRegistry, type Rule } from '../src/core/index.js';
import { Language, type NormalizedAstDocument } from '../src/parser/index.js';
import { RuleEngine, execute, type RuleEngineRuleContext } from '../src/index.js';

const project: ProjectContext = {
  projectRoot: '/project',
  cwd: '/project',
  files: ['src/app.ts'],
  env: {},
  metadata: {
    workspace: 'test',
  },
};

const config: AuditConfig = {
  projectRoot: '/project',
  rules: {
    'test/context': {
      enabled: true,
      config: {
        option: true,
      },
    },
  },
  metadata: {
    preset: 'strict',
  },
};

describe('RuleEngine', () => {
  it('executes a rule successfully', async () => {
    const registry = new RuleRegistry();
    registry.registerRule(
      createRule('test/noop', () => ({
        ruleId: 'test/noop',
        status: 'passed',
        findings: [],
      })),
    );

    const result = await new RuleEngine().execute({
      documents: [document('src/app.ts')],
      registry,
      project,
      config,
    });

    expect(result).toMatchObject({
      executedRules: 1,
      successfulRules: 1,
      failedRules: 0,
      findings: [],
      errors: [],
    });
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('executes multiple rules against multiple documents sequentially', async () => {
    const registry = new RuleRegistry();
    const calls: string[] = [];
    registry.registerRule(
      createRule('test/first', (context) => {
        calls.push(`first:${context.ast.relativePath}`);
        return {
          ruleId: 'test/first',
          status: 'passed',
          findings: [],
        };
      }),
    );
    registry.registerRule(
      createRule('test/second', (context) => {
        calls.push(`second:${context.ast.relativePath}`);
        return {
          ruleId: 'test/second',
          status: 'passed',
          findings: [],
        };
      }),
    );

    const result = await execute({
      documents: [document('src/one.ts'), document('src/two.tsx', Language.TSX)],
      registry,
      project,
      config,
    });

    expect(result.executedRules).toBe(4);
    expect(result.successfulRules).toBe(4);
    expect(result.failedRules).toBe(0);
    expect(calls).toEqual([
      'first:src/one.ts',
      'second:src/one.ts',
      'first:src/two.tsx',
      'second:src/two.tsx',
    ]);
  });

  it('captures rule failures and continues executing remaining rules', async () => {
    const registry = new RuleRegistry();
    registry.registerRule(
      createRule('test/fails', () => {
        throw new Error('rule exploded');
      }),
    );
    registry.registerRule(
      createRule('test/continues', () => ({
        ruleId: 'test/continues',
        status: 'failed',
        findings: [finding('test/continues', 'continued')],
      })),
    );

    const result = await execute({
      documents: [document('src/app.ts')],
      registry,
      project,
      config,
    });

    expect(result.executedRules).toBe(2);
    expect(result.successfulRules).toBe(1);
    expect(result.failedRules).toBe(1);
    expect(result.findings).toEqual([finding('test/continues', 'continued')]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      ruleId: 'test/fails',
      ruleName: 'Rule test/fails',
      filePath: '/project/src/app.ts',
      message: 'rule exploded',
    });
    expect(result.errors[0]?.stack).toContain('rule exploded');
    expect(result.errors[0]?.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('returns an empty result for an empty registry', async () => {
    const result = await execute({
      documents: [document('src/app.ts')],
      registry: new RuleRegistry(),
      project,
      config,
    });

    expect(result).toMatchObject({
      executedRules: 0,
      successfulRules: 0,
      failedRules: 0,
      findings: [],
      errors: [],
    });
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  it('collects multiple findings from rule results', async () => {
    const registry = new RuleRegistry();
    registry.registerRule(
      createRule('test/multiple', () => ({
        ruleId: 'test/multiple',
        status: 'failed',
        findings: [finding('test/multiple', 'first'), finding('test/multiple', 'second')],
      })),
    );

    const result = await execute({
      documents: [document('src/app.ts')],
      registry,
      project,
      config,
    });

    expect(result.findings).toEqual([
      finding('test/multiple', 'first'),
      finding('test/multiple', 'second'),
    ]);
    expect(result.successfulRules).toBe(1);
    expect(result.failedRules).toBe(0);
  });

  it('provides a strongly typed rule context', async () => {
    const registry = new RuleRegistry();
    const contexts: RuleEngineRuleContext[] = [];
    registry.registerRule(
      createRule('test/context', (context) => {
        contexts.push(context);
        return {
          ruleId: 'test/context',
          status: 'passed',
          findings: [
            {
              ruleId: 'test/context',
              severity: context.severity,
              message: context.helpers.isNodeKind(context.ast.root, 'SourceFile') ? 'ok' : 'bad',
              metadata: context.helpers.metadata({ language: context.language }),
            },
          ],
        };
      }),
    );

    const result = await execute({
      documents: [document('src/app.ts')],
      registry,
      project,
      config,
      metadata: {
        runId: 'abc',
      },
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      project,
      ruleId: 'test/context',
      severity: 'warning',
      config: {
        option: true,
      },
      projectConfig: {
        preset: 'strict',
      },
      sourceFile: {
        path: '/project/src/app.ts',
        relativePath: 'src/app.ts',
        extension: 'ts',
      },
      language: Language.TypeScript,
      metadata: {
        runId: 'abc',
      },
    });
    expect(result.findings).toEqual([
      {
        ruleId: 'test/context',
        severity: 'warning',
        message: 'ok',
        metadata: {
          language: Language.TypeScript,
        },
      },
    ]);
  });

  it('reports execution timing for async rules', async () => {
    const registry = new RuleRegistry();
    registry.registerRule(
      createRule('test/async', async () => ({
        ruleId: 'test/async',
        status: 'passed',
        findings: [],
      })),
    );

    const result = await execute({
      documents: [document('src/app.ts')],
      registry,
      project,
      config,
    });

    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
});

const createRule = (
  id: string,
  evaluate: Rule['evaluate'],
  severity: Severity = 'warning',
): Rule => ({
  id,
  name: `Rule ${id}`,
  description: `Description for ${id}`,
  category: 'test',
  severity,
  evaluate,
});

const finding = (ruleId: string, message: string): Finding => ({
  ruleId,
  message,
  severity: 'warning',
});

const document = (
  relativePath: string,
  language: Language = Language.TypeScript,
): NormalizedAstDocument => ({
  path: `/project/${relativePath}`,
  relativePath,
  language,
  root: {
    kind: 'SourceFile',
    rawKind: 0,
    start: {
      offset: 0,
      line: 1,
      column: 1,
    },
    end: {
      offset: 10,
      line: 1,
      column: 11,
    },
    children: [],
  },
});
