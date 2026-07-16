import { describe, expect, it } from 'vitest';
import { parseFile } from '../src/parser/index.js';
import { createRuleContext } from '../src/rule-engine/index.js';
import type { Finding, Rule } from '../src/core/index.js';
import type { SourceFile } from '../src/scanner/index.js';
import {
  NoDeeplyNestedJsxRule,
  NoExpensiveRegexRule,
  NoInlineLargeFunctionRule,
  NoLargeArrayLiteralRule,
  NoLargeImageRule,
  NoLargeObjectLiteralRule,
  NoLargeSwitchRule,
  NoSyncStorageRule,
  NoUnnecessaryFragmentRule,
  PreferLazyImportRule,
} from '../src/rules/performance/index.js';

const project = { projectRoot: '/x', cwd: '/x', files: [], env: {} };

const evaluate = async (
  rule: Rule,
  source: string,
  ruleConfig: Readonly<Record<string, unknown>> = {},
  extension: 'tsx' | 'ts' = 'tsx',
): Promise<readonly Finding[]> => {
  const file: SourceFile = {
    path: `/x/a.${extension}`,
    relativePath: `a.${extension}`,
    extension,
    language: extension === 'tsx' ? 'TSX' : 'TypeScript',
    contents: source,
    size: source.length,
    lastModified: new Date(0),
  };
  const parsed = await parseFile(file);
  if (!parsed.ast) {
    throw new Error('failed to parse fixture');
  }
  const context = createRuleContext({
    project,
    ruleId: rule.id,
    severity: rule.severity,
    ast: parsed.ast,
    ruleConfig,
  });
  return (await rule.evaluate(context)).findings;
};

const count = async (
  rule: Rule,
  source: string,
  ruleConfig: Readonly<Record<string, unknown>> = {},
  extension: 'tsx' | 'ts' = 'tsx',
): Promise<number> => (await evaluate(rule, source, ruleConfig, extension)).length;

describe('perf/no-large-image', () => {
  const rule = new NoLargeImageRule();
  const bigDataUri = `data:image/png;base64,${'A'.repeat(20000)}`;
  const smallDataUri = 'data:image/png;base64,QUJD';

  it('is a warning rule with correct metadata', () => {
    expect(rule.id).toBe('perf/no-large-image');
    expect(rule.severity).toBe('warning');
    expect(rule.category).toBe('Performance');
    expect(rule.docsUrl).toContain('performance.md#perfno-large-image');
  });

  it('flags oversized inline data URIs', async () => {
    expect(await count(rule, `const C = () => <img src="${bigDataUri}" />;`)).toBe(1);
  });

  it('does not flag small data URIs', async () => {
    expect(await count(rule, `const C = () => <img src="${smallDataUri}" />;`)).toBe(0);
  });

  it('flags unoptimized raw formats', async () => {
    expect(await count(rule, 'const C = () => <img src="/assets/hero.bmp" />;')).toBe(1);
    expect(await count(rule, 'const C = () => <img src="/assets/hero.tiff" />;')).toBe(1);
  });

  it('does not flag optimized formats', async () => {
    expect(await count(rule, 'const C = () => <img src="/assets/hero.webp" />;')).toBe(0);
    expect(await count(rule, 'const C = () => <img src="/assets/hero.png" />;')).toBe(0);
  });

  it('ignores non-img elements and missing src', async () => {
    expect(await count(rule, 'const C = () => <video src="/x.bmp" />;')).toBe(0);
    expect(await count(rule, 'const C = () => <img alt="x" />;')).toBe(0);
  });

  it('honors configurable thresholds', async () => {
    expect(await count(rule, `const C = () => <img src="${smallDataUri}" />;`, { maxDataUriBytes: 1 })).toBe(1);
    expect(await count(rule, 'const C = () => <img src="/a.gif" />;', { disallowedFormats: ['gif'] })).toBe(1);
  });
});

describe('perf/no-sync-storage', () => {
  const rule = new NoSyncStorageRule();

  it('is an info rule', () => {
    expect(rule.severity).toBe('info');
  });

  it('flags localStorage and sessionStorage access', async () => {
    expect(await count(rule, 'const v = localStorage.getItem("x");', {}, 'ts')).toBe(1);
    expect(await count(rule, 'sessionStorage.setItem("x", "1");', {}, 'ts')).toBe(1);
    expect(await count(rule, 'const v = window.localStorage.length;', {}, 'ts')).toBe(1);
  });

  it('does not flag unrelated member access', async () => {
    expect(await count(rule, 'const v = store.getItem("x");', {}, 'ts')).toBe(0);
    expect(await count(rule, 'const v = myLocalStorageWrapper.get();', {}, 'ts')).toBe(0);
  });

  it('flags storage used during render', async () => {
    expect(await count(rule, 'const C = () => <div>{localStorage.getItem("k")}</div>;')).toBe(1);
  });
});

describe('perf/no-large-object-literal', () => {
  const rule = new NoLargeObjectLiteralRule();
  const object = (n: number): string =>
    `const o = { ${Array.from({ length: n }, (_, i) => `k${i}: ${i}`).join(', ')} };`;

  it('flags objects over the default threshold', async () => {
    expect(await count(rule, object(25), {}, 'ts')).toBe(1);
  });

  it('allows small objects', async () => {
    expect(await count(rule, object(3), {}, 'ts')).toBe(0);
  });

  it('honors a configurable maxProperties threshold', async () => {
    expect(await count(rule, object(4), { maxProperties: 3 }, 'ts')).toBe(1);
  });

  it('counts shorthand and spread members', async () => {
    expect(await count(rule, 'const o = { ...base, a, b, c };', { maxProperties: 3 }, 'ts')).toBe(1);
  });
});

describe('perf/no-large-array-literal', () => {
  const rule = new NoLargeArrayLiteralRule();
  const array = (n: number): string => `const a = [${Array.from({ length: n }, (_, i) => i).join(', ')}];`;

  it('flags arrays over the default threshold', async () => {
    expect(await count(rule, array(60), {}, 'ts')).toBe(1);
  });

  it('allows small arrays', async () => {
    expect(await count(rule, array(3), {}, 'ts')).toBe(0);
  });

  it('honors a configurable maxLength threshold', async () => {
    expect(await count(rule, array(5), { maxLength: 3 }, 'ts')).toBe(1);
  });
});

describe('perf/no-expensive-regex', () => {
  const rule = new NoExpensiveRegexRule();

  it('is a warning rule', () => {
    expect(rule.severity).toBe('warning');
  });

  it('flags nested quantifiers in literals', async () => {
    expect(await count(rule, 'const r = /(a+)+/;', {}, 'ts')).toBe(1);
    expect(await count(rule, 'const r = /(a*)*/;', {}, 'ts')).toBe(1);
    expect(await count(rule, 'const r = /([a-z]+){2,}/;', {}, 'ts')).toBe(1);
  });

  it('flags nested quantifiers in RegExp constructors', async () => {
    expect(await count(rule, 'const r = new RegExp("(a+)+");', {}, 'ts')).toBe(1);
  });

  it('does not flag safe regexes', async () => {
    expect(await count(rule, 'const r = /^[a-z]+$/;', {}, 'ts')).toBe(0);
    expect(await count(rule, 'const r = /\\d{3}-\\d{4}/;', {}, 'ts')).toBe(0);
    expect(await count(rule, 'const r = new RegExp("abc");', {}, 'ts')).toBe(0);
  });
});

describe('perf/no-inline-large-function', () => {
  const rule = new NoInlineLargeFunctionRule();
  const body = (lines: number): string =>
    Array.from({ length: lines }, (_, i) => `  doThing(${i});`).join('\n');

  it('is a warning rule', () => {
    expect(rule.severity).toBe('warning');
  });

  it('flags large inline callbacks passed to calls', async () => {
    expect(await count(rule, `arr.map((x) => {\n${body(25)}\n  return x;\n});`, {}, 'ts')).toBe(1);
  });

  it('flags large inline callbacks passed to JSX props', async () => {
    expect(await count(rule, `const C = () => <button onClick={() => {\n${body(25)}\n}} />;`)).toBe(1);
  });

  it('does not flag small inline callbacks', async () => {
    expect(await count(rule, 'arr.map((x) => x * 2);', {}, 'ts')).toBe(0);
  });

  it('honors a configurable maxLines threshold', async () => {
    expect(await count(rule, `arr.forEach((x) => {\n${body(5)}\n});`, { maxLines: 3 }, 'ts')).toBe(1);
  });

  it('does not double-report the same callback', async () => {
    expect(await count(rule, `foo(bar((x) => {\n${body(25)}\n}));`, {}, 'ts')).toBe(1);
  });
});

describe('perf/no-unnecessary-fragment', () => {
  const rule = new NoUnnecessaryFragmentRule();

  it('flags fragments wrapping a single child', async () => {
    expect(await count(rule, 'const C = () => <><A /></>;')).toBe(1);
    expect(await count(rule, 'const C = () => <>{value}</>;')).toBe(1);
  });

  it('does not flag multi-child or empty fragments', async () => {
    expect(await count(rule, 'const C = () => <><A /><B /></>;')).toBe(0);
    expect(await count(rule, 'const C = () => <></>;')).toBe(0);
  });

  it('flags redundant nested fragments', async () => {
    // Outer wraps one child (the inner fragment) -> flagged; inner wraps one child -> flagged.
    expect(await count(rule, 'const C = () => <><><A /></></>;')).toBe(2);
  });
});

describe('perf/prefer-lazy-import', () => {
  const rule = new PreferLazyImportRule();

  it('is an info rule', () => {
    expect(rule.severity).toBe('info');
  });

  it('flags imports of heavyweight modules', async () => {
    expect(await count(rule, 'import _ from "lodash";', {}, 'ts')).toBe(1);
    expect(await count(rule, 'import { Button } from "@mui/material";', {}, 'ts')).toBe(1);
  });

  it('flags imports with many named bindings', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `a${i}`).join(', ');
    expect(await count(rule, `import { ${names} } from "./local";`, {}, 'ts')).toBe(1);
  });

  it('does not flag small local imports', async () => {
    expect(await count(rule, 'import { a, b } from "./local";', {}, 'ts')).toBe(0);
  });

  it('ignores type-only imports', async () => {
    expect(await count(rule, 'import type Big from "lodash";', {}, 'ts')).toBe(0);
  });

  it('honors configurable module and binding thresholds', async () => {
    expect(await count(rule, 'import x from "my-heavy-lib";', { heavyModules: ['my-heavy-lib'] }, 'ts')).toBe(1);
    expect(await count(rule, 'import { a, b, c } from "./local";', { maxNamedImports: 2 }, 'ts')).toBe(1);
  });
});

describe('perf/no-deeply-nested-jsx', () => {
  const rule = new NoDeeplyNestedJsxRule();
  const nest = (depth: number): string => {
    let inner = '<span />';
    for (let i = 0; i < depth - 1; i += 1) {
      inner = `<div>${inner}</div>`;
    }
    return `const C = () => (${inner});`;
  };

  it('is a warning rule', () => {
    expect(rule.severity).toBe('warning');
  });

  it('flags JSX deeper than the default limit', async () => {
    expect(await count(rule, nest(8))).toBe(1);
  });

  it('allows shallow JSX', async () => {
    expect(await count(rule, nest(3))).toBe(0);
  });

  it('honors a configurable maxDepth threshold', async () => {
    expect(await count(rule, nest(4), { maxDepth: 2 })).toBe(1);
  });

  it('reports one finding per top-level tree', async () => {
    expect(await count(rule, `${nest(8)}\n${nest(8)}`)).toBe(2);
  });
});

describe('perf/no-large-switch', () => {
  const rule = new NoLargeSwitchRule();
  const sw = (n: number): string =>
    `function f(x: number) { switch (x) { ${Array.from({ length: n }, (_, i) => `case ${i}: return ${i};`).join(' ')} } }`;

  it('flags switches over the default threshold', async () => {
    expect(await count(rule, sw(12), {}, 'ts')).toBe(1);
  });

  it('allows small switches', async () => {
    expect(await count(rule, sw(3), {}, 'ts')).toBe(0);
  });

  it('honors a configurable maxCases threshold and counts default', async () => {
    expect(
      await count(rule, 'function f(x: number) { switch (x) { case 1: break; default: break; } }', { maxCases: 1 }, 'ts'),
    ).toBe(1);
  });
});

describe('Performance rules pack 1 — determinism', () => {
  it('produces identical findings across repeated evaluations', async () => {
    const rule = new NoLargeObjectLiteralRule();
    const source = 'const o = { a: 1, b: 2, c: 3, d: 4 };';
    expect(await evaluate(rule, source, { maxProperties: 2 }, 'ts')).toEqual(
      await evaluate(rule, source, { maxProperties: 2 }, 'ts'),
    );
  });
});
