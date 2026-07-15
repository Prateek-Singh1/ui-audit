import { describe, expect, it } from 'vitest';
import { parseFile } from '../src/parser/index.js';
import { createRuleContext } from '../src/rule-engine/index.js';
import type { Finding, Rule } from '../src/core/index.js';
import type { SourceFile } from '../src/scanner/index.js';
import {
  AriaRequiredAttributesRule,
  AriaRoleValidRule,
  AudioCaptionRule,
  HeadingOrderRule,
  IframeTitleRule,
  ListStructureRule,
  NoDuplicateIdRule,
  NoMarqueeRule,
  NoRedundantRoleRule,
  TableHeaderRule,
} from '../src/rules/accessibility/index.js';

const project = { projectRoot: '/x', cwd: '/x', files: [], env: {} };

const evaluate = async (rule: Rule, source: string): Promise<readonly Finding[]> => {
  const file: SourceFile = {
    path: '/x/a.tsx',
    relativePath: 'a.tsx',
    extension: 'tsx',
    language: 'TSX',
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
  });
  return (await rule.evaluate(context)).findings;
};

const count = async (rule: Rule, source: string): Promise<number> =>
  (await evaluate(rule, source)).length;

describe('a11y/aria-role-valid', () => {
  const rule = new AriaRoleValidRule();

  it('flags unknown roles', async () => {
    expect(await count(rule, 'const C=()=><div role="buton"/>;')).toBe(1);
  });

  it('accepts valid roles and ignores dynamic roles', async () => {
    expect(await count(rule, 'const C=()=><div role="button"/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><div role={dynamic}/>;')).toBe(0);
  });
});

describe('a11y/aria-required-attributes', () => {
  const rule = new AriaRequiredAttributesRule();

  it('flags roles missing required attributes', async () => {
    expect(await count(rule, 'const C=()=><div role="checkbox"/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><div role="slider"/>;')).toBe(1);
  });

  it('accepts roles with their required attributes', async () => {
    expect(await count(rule, 'const C=()=><div role="checkbox" aria-checked={true}/>;')).toBe(0);
  });
});

describe('a11y/no-redundant-role', () => {
  const rule = new NoRedundantRoleRule();

  it('flags roles that match the implicit role', async () => {
    expect(await count(rule, 'const C=()=><button role="button"/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><img role="img" alt="x"/>;')).toBe(1);
  });

  it('does not flag non-implicit roles or href-less anchors', async () => {
    expect(await count(rule, 'const C=()=><div role="button"/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><a role="link">x</a>;')).toBe(0);
  });
});

describe('a11y/no-duplicate-id', () => {
  const rule = new NoDuplicateIdRule();

  it('is an error rule and flags duplicate ids', async () => {
    expect(rule.severity).toBe('error');
    expect(await count(rule, 'const C=()=><div><span id="a"/><span id="a"/></div>;')).toBe(1);
  });

  it('does not flag unique or dynamic ids', async () => {
    expect(await count(rule, 'const C=()=><div><span id="a"/><span id="b"/></div>;')).toBe(0);
    expect(await count(rule, 'const C=()=><div><span id={x}/><span id={y}/></div>;')).toBe(0);
  });
});

describe('a11y/heading-order', () => {
  const rule = new HeadingOrderRule();

  it('flags skipped heading levels', async () => {
    expect(await count(rule, 'const C=()=><div><h1>A</h1><h3>B</h3></div>;')).toBe(1);
  });

  it('does not flag sequential headings', async () => {
    expect(await count(rule, 'const C=()=><div><h1>A</h1><h2>B</h2><h3>C</h3></div>;')).toBe(0);
  });

  it('does not flag going back up (h3 -> h2)', async () => {
    expect(await count(rule, 'const C=()=><div><h2>A</h2><h3>B</h3><h2>C</h2></div>;')).toBe(0);
  });
});

describe('a11y/table-header', () => {
  const rule = new TableHeaderRule();

  it('flags tables without th', async () => {
    expect(await count(rule, 'const C=()=><table><tr><td>x</td></tr></table>;')).toBe(1);
  });

  it('accepts tables with th', async () => {
    expect(await count(rule, 'const C=()=><table><tr><th>x</th></tr></table>;')).toBe(0);
  });
});

describe('a11y/list-structure', () => {
  const rule = new ListStructureRule();

  it('flags non-li DOM children of lists', async () => {
    expect(await count(rule, 'const C=()=><ul><div>x</div></ul>;')).toBe(1);
  });

  it('accepts li children and ignores components and expressions', async () => {
    expect(await count(rule, 'const C=()=><ul><li>x</li></ul>;')).toBe(0);
    expect(await count(rule, 'const C=()=><ul><Item/></ul>;')).toBe(0);
    expect(await count(rule, 'const C=()=><ul>{items.map((i) => <li key={i.id}>{i.n}</li>)}</ul>;')).toBe(0);
  });

  it('handles nested lists independently', async () => {
    expect(await count(rule, 'const C=()=><ul><li><ul><span/></ul></li></ul>;')).toBe(1);
  });
});

describe('a11y/iframe-title', () => {
  const rule = new IframeTitleRule();

  it('flags iframes without a title', async () => {
    expect(await count(rule, 'const C=()=><iframe src="x"/>;')).toBe(1);
  });

  it('accepts titled iframes', async () => {
    expect(await count(rule, 'const C=()=><iframe src="x" title="Map"/>;')).toBe(0);
  });
});

describe('a11y/no-marquee', () => {
  const rule = new NoMarqueeRule();

  it('flags marquee and blink', async () => {
    expect(await count(rule, 'const C=()=><marquee>hi</marquee>;')).toBe(1);
    expect(await count(rule, 'const C=()=><blink>hi</blink>;')).toBe(1);
  });

  it('does not flag ordinary elements', async () => {
    expect(await count(rule, 'const C=()=><div>hi</div>;')).toBe(0);
  });
});

describe('a11y/audio-caption', () => {
  const rule = new AudioCaptionRule();

  it('flags audio and video without a track', async () => {
    expect(await count(rule, 'const C=()=><audio src="a"/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><video src="v"/>;')).toBe(1);
  });

  it('accepts media with a track (including within fragments)', async () => {
    expect(await count(rule, 'const C=()=><audio src="a"><track kind="captions"/></audio>;')).toBe(0);
    expect(await count(rule, 'const C=()=><><audio src="a"><track/></audio></>;')).toBe(0);
  });
});

describe('Accessibility pack 2 — determinism', () => {
  it('produces identical findings across repeated evaluations', async () => {
    const rule = new NoDuplicateIdRule();
    const source = 'const C=()=><div><i id="x"/><i id="x"/><i id="x"/></div>;';
    expect(await evaluate(rule, source)).toEqual(await evaluate(rule, source));
    expect(await count(rule, source)).toBe(2);
  });
});
