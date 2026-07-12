import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverProjectFiles } from '../src/discovery/index.js';
import { parseFile, parseFiles } from '../src/parser/index.js';
import {
  InlineFunctionRule,
  InlineStyleRule,
  LargeComponentRule,
  NestedTernaryRule,
  ReactKeyRule,
  RuleEngine,
  RuleRegistry,
  scanFiles,
  type Rule,
  type SourceFile,
} from '../src/index.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('built-in React rules', () => {
  it('detects missing React keys in map-rendered JSX', async () => {
    const result = await runRule(
      new ReactKeyRule(),
      `
        export function List({ items }) {
          return <ul>{items.map((item) => <li>{item.name}</li>)}</ul>;
        }
      `,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'react/missing-key',
        ruleName: 'Missing React key',
        severity: 'warning',
        message: 'JSX returned from an array map callback should include a stable key prop.',
        location: expect.objectContaining({
          file: 'src/App.tsx',
        }),
        suggestion: 'Add a stable key prop to the rendered element.',
      }),
    ]);
    expectFindingLocation(result.findings[0]);
  });

  it('does not report React keys when map-rendered JSX has a key prop', async () => {
    const result = await runRule(
      new ReactKeyRule(),
      `
        export function List({ items }) {
          return <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;
        }
      `,
    );

    expect(result.findings).toEqual([]);
  });

  it('detects inline function props', async () => {
    const result = await runRule(
      new InlineFunctionRule(),
      `
        export function Button() {
          return <button onClick={() => alert('clicked')}>Save</button>;
        }
      `,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'react/inline-function-prop',
        ruleName: 'Inline function prop',
        severity: 'info',
        message: 'Avoid inline function props in JSX when the callback can be extracted.',
        location: expect.objectContaining({
          file: 'src/App.tsx',
        }),
        suggestion: 'Extract the callback to a named function or memoized handler.',
      }),
    ]);
    expectFindingLocation(result.findings[0]);
  });

  it('does not report named function props', async () => {
    const result = await runRule(
      new InlineFunctionRule(),
      `
        export function Button() {
          const handleClick = () => alert('clicked');
          return <button onClick={handleClick}>Save</button>;
        }
      `,
    );

    expect(result.findings).toEqual([]);
  });

  it('detects inline style object literals', async () => {
    const result = await runRule(
      new InlineStyleRule(),
      `
        export function Panel() {
          return <section style={{ color: 'red', padding: 8 }}>Content</section>;
        }
      `,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'react/inline-style',
        ruleName: 'Inline style',
        severity: 'info',
        message: 'Avoid inline style object literals in JSX.',
        location: expect.objectContaining({
          file: 'src/App.tsx',
        }),
        suggestion: 'Prefer CSS classes, CSS modules, or extracted style constants.',
      }),
    ]);
    expectFindingLocation(result.findings[0]);
  });

  it('does not report className styling', async () => {
    const result = await runRule(
      new InlineStyleRule(),
      `
        export function Panel() {
          return <section className="panel">Content</section>;
        }
      `,
    );

    expect(result.findings).toEqual([]);
  });

  it('detects React components exceeding 300 lines', async () => {
    const result = await runRule(new LargeComponentRule(), largeComponentSource(301));

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'react/large-component',
        ruleName: 'Large React component',
        severity: 'warning',
        message: 'React component "LargePanel" is 304 lines long.',
        location: expect.objectContaining({
          file: 'src/App.tsx',
        }),
        suggestion: 'Split large components into smaller components or extract complex logic.',
      }),
    ]);
    expectFindingLocation(result.findings[0]);
  });

  it('does not report small React components', async () => {
    const result = await runRule(new LargeComponentRule(), largeComponentSource(2));

    expect(result.findings).toEqual([]);
  });

  it('detects nested ternary expressions', async () => {
    const result = await runRule(
      new NestedTernaryRule(),
      `
        export function Status({ state }) {
          return <span>{state === 'ok' ? 'Ready' : state === 'warn' ? 'Warning' : 'Error'}</span>;
        }
      `,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: 'react/nested-ternary',
        ruleName: 'Nested ternary',
        severity: 'warning',
        message: 'Avoid nested ternary expressions because they are difficult to read.',
        location: expect.objectContaining({
          file: 'src/App.tsx',
        }),
        suggestion: 'Extract the conditional branches into named variables or helper functions.',
      }),
    ]);
    expectFindingLocation(result.findings[0]);
  });

  it('does not report simple ternary expressions', async () => {
    const result = await runRule(
      new NestedTernaryRule(),
      `
        export function Status({ ready }) {
          return <span>{ready ? 'Ready' : 'Waiting'}</span>;
        }
      `,
    );

    expect(result.findings).toEqual([]);
  });

  it('validates the discovery to findings pipeline with built-in React rules', async () => {
    const root = await createTempProject();
    await writeFile(
      path.join(root, 'App.tsx'),
      `
        export function App({ items }) {
          return (
            <main style={{ margin: 4 }}>
              {items.map((item) => <button onClick={() => item.select()}>{item.label}</button>)}
            </main>
          );
        }
      `,
    );

    const projectFiles = await discoverProjectFiles(root);
    const scanned = await scanFiles(projectFiles);
    const parsed = await parseFiles(scanned.files);
    const registry = new RuleRegistry();
    registry.registerRule(new ReactKeyRule());
    registry.registerRule(new InlineFunctionRule());
    registry.registerRule(new InlineStyleRule());
    const documents = parsed.flatMap((result) => (result.ast ? [result.ast] : []));
    const result = await new RuleEngine().execute({
      documents,
      registry,
      project: {
        projectRoot: root,
        cwd: root,
        files: projectFiles.map((file) => file.relativePath),
        env: {},
      },
      config: {
        projectRoot: root,
      },
    });

    expect(scanned.errors).toEqual([]);
    expect(parsed.every((parseResult) => parseResult.success)).toBe(true);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'react/missing-key',
      'react/inline-function-prop',
      'react/inline-style',
    ]);
  });
});

const runRule = async (rule: Rule, contents: string) => {
  const file = sourceFile(contents);
  const parsed = await parseFile(file);
  const registry = new RuleRegistry();
  registry.registerRule(rule);

  if (!parsed.ast) {
    throw new Error('Expected test source to parse successfully.');
  }

  return new RuleEngine().execute({
    documents: [parsed.ast],
    registry,
    project: {
      projectRoot: '/project',
      cwd: '/project',
      files: [file.relativePath],
      env: {},
    },
    config: {
      projectRoot: '/project',
    },
  });
};

const sourceFile = (contents: string): SourceFile => ({
  path: '/project/src/App.tsx',
  relativePath: 'src/App.tsx',
  extension: 'tsx',
  language: 'TSX',
  contents,
  size: Buffer.byteLength(contents),
  lastModified: new Date('2026-01-01T00:00:00.000Z'),
});

const largeComponentSource = (bodyLines: number): string => {
  const lines = Array.from({ length: bodyLines }, (_, index) => `  const value${index} = ${index};`);

  return [
    'export function LargePanel() {',
    ...lines,
    '  return <section>Large</section>;',
    '}',
  ].join('\n');
};

const createTempProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-react-rules-'));
  tempRoots.push(root);
  return root;
};

const expectFindingLocation = (finding: { readonly location?: { readonly line?: number; readonly column?: number } }): void => {
  expect(typeof finding.location?.line).toBe('number');
  expect(typeof finding.location?.column).toBe('number');
};
