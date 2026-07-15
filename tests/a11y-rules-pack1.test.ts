import { describe, expect, it } from 'vitest';
import { parseFile } from '../src/parser/index.js';
import { createRuleContext } from '../src/rule-engine/index.js';
import type { Finding, Rule } from '../src/core/index.js';
import type { SourceFile } from '../src/scanner/index.js';
import {
  AnchorValidRule,
  ButtonAccessibleNameRule,
  FormFieldNameRule,
  HtmlLangRule,
  ImgAltRule,
  InputLabelRule,
  NoAutofocusRule,
  NoPositiveTabindexRule,
  SvgTitleRule,
  VideoCaptionRule,
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

describe('a11y/img-alt', () => {
  const rule = new ImgAltRule();

  it('is in the accessibility category with error severity', () => {
    expect(rule.category).toBe('Accessibility');
    expect(rule.severity).toBe('error');
  });

  it('flags images without alt', async () => {
    expect(await count(rule, 'const C=()=><img src="x"/>;')).toBe(1);
  });

  it('allows alt text and decorative alt=""', async () => {
    expect(await count(rule, 'const C=()=><img src="x" alt="A cat"/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><img src="x" alt=""/>;')).toBe(0);
  });

  it('does not flag images with spread props', async () => {
    expect(await count(rule, 'const C=()=><img {...rest}/>;')).toBe(0);
  });

  it('flags nested images (nested JSX)', async () => {
    expect(await count(rule, 'const C=()=><div><figure><img src="x"/></figure></div>;')).toBe(1);
  });

  it('reports a precise location', async () => {
    const [finding] = await evaluate(rule, 'const C=()=><img src="x"/>;');
    expect(finding?.location?.file).toBe('a.tsx');
    expect(finding?.suggestion).toContain('alt');
  });
});

describe('a11y/button-accessible-name', () => {
  const rule = new ButtonAccessibleNameRule();

  it('flags empty buttons and element-only buttons', async () => {
    expect(await count(rule, 'const C=()=><button></button>;')).toBe(1);
    expect(await count(rule, 'const C=()=><button><span /></button>;')).toBe(1);
    expect(await count(rule, 'const C=()=><button/>;')).toBe(1);
  });

  it('allows text, expressions, and aria-label', async () => {
    expect(await count(rule, 'const C=()=><button>Save</button>;')).toBe(0);
    expect(await count(rule, 'const C=()=><button>{label}</button>;')).toBe(0);
    expect(await count(rule, 'const C=()=><button aria-label="Save"/>;')).toBe(0);
  });
});

describe('a11y/input-label', () => {
  const rule = new InputLabelRule();

  it('flags unlabelled inputs', async () => {
    expect(await count(rule, 'const C=()=><input type="text"/>;')).toBe(1);
  });

  it('accepts aria-label, wrapping label, and htmlFor association', async () => {
    expect(await count(rule, 'const C=()=><input aria-label="Name"/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><label>Name<input type="text"/></label>;')).toBe(0);
    expect(
      await count(rule, 'const C=()=><div><label htmlFor="n">Name</label><input id="n"/></div>;'),
    ).toBe(0);
  });

  it('ignores hidden inputs', async () => {
    expect(await count(rule, 'const C=()=><input type="hidden"/>;')).toBe(0);
  });
});

describe('a11y/anchor-valid', () => {
  const rule = new AnchorValidRule();

  it('flags missing href, "#", and javascript: URLs', async () => {
    expect(await count(rule, 'const C=()=><a>go</a>;')).toBe(1);
    expect(await count(rule, 'const C=()=><a href="#">go</a>;')).toBe(1);
    expect(await count(rule, 'const C=()=><a href="javascript:void(0)">go</a>;')).toBe(1);
  });

  it('allows real and dynamic destinations', async () => {
    expect(await count(rule, 'const C=()=><a href="/home">go</a>;')).toBe(0);
    expect(await count(rule, 'const C=()=><a href={url}>go</a>;')).toBe(0);
  });
});

describe('a11y/no-autofocus', () => {
  const rule = new NoAutofocusRule();

  it('flags autoFocus', async () => {
    expect(await count(rule, 'const C=()=><input autoFocus/>;')).toBe(1);
  });

  it('does not flag inputs without autoFocus', async () => {
    expect(await count(rule, 'const C=()=><input/>;')).toBe(0);
  });
});

describe('a11y/no-positive-tabindex', () => {
  const rule = new NoPositiveTabindexRule();

  it('flags positive tab indexes (numeric and string)', async () => {
    expect(await count(rule, 'const C=()=><div tabIndex={1}/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><div tabIndex="5"/>;')).toBe(1);
  });

  it('allows zero, negative, and dynamic values', async () => {
    expect(await count(rule, 'const C=()=><div tabIndex={0}/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><div tabIndex={-1}/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><div tabIndex={n}/>;')).toBe(0);
  });
});

describe('a11y/html-lang', () => {
  const rule = new HtmlLangRule();

  it('flags <html> without lang', async () => {
    expect(await count(rule, 'const C=()=><html><body/></html>;')).toBe(1);
  });

  it('allows <html lang>', async () => {
    expect(await count(rule, 'const C=()=><html lang="en"><body/></html>;')).toBe(0);
  });
});

describe('a11y/video-caption', () => {
  const rule = new VideoCaptionRule();

  it('flags videos without a captions track', async () => {
    expect(await count(rule, 'const C=()=><video src="v"/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><video src="v"><track kind="subtitles"/></video>;')).toBe(1);
  });

  it('allows videos with a captions track', async () => {
    expect(await count(rule, 'const C=()=><video src="v"><track kind="captions"/></video>;')).toBe(0);
  });
});

describe('a11y/svg-title', () => {
  const rule = new SvgTitleRule();

  it('flags svg without a title or label', async () => {
    expect(await count(rule, 'const C=()=><svg><path/></svg>;')).toBe(1);
  });

  it('allows a title child, aria-label, or aria-hidden', async () => {
    expect(await count(rule, 'const C=()=><svg><title>Icon</title><path/></svg>;')).toBe(0);
    expect(await count(rule, 'const C=()=><svg aria-label="Icon"><path/></svg>;')).toBe(0);
    expect(await count(rule, 'const C=()=><svg aria-hidden="true"><path/></svg>;')).toBe(0);
  });
});

describe('a11y/form-field-name', () => {
  const rule = new FormFieldNameRule();

  it('flags unnamed input, textarea, and select', async () => {
    expect(await count(rule, 'const C=()=><textarea/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><select><option/></select>;')).toBe(1);
  });

  it('accepts an aria-label', async () => {
    expect(await count(rule, 'const C=()=><select aria-label="Country"><option/></select>;')).toBe(0);
  });

  it('supports TSX generic components around fields', async () => {
    expect(await count(rule, 'const C=()=><Wrapper<string>><textarea aria-label="Bio"/></Wrapper>;')).toBe(0);
  });
});

describe('Accessibility pack 1 — determinism & fragments', () => {
  it('is deterministic and traverses through fragments', async () => {
    const rule = new ImgAltRule();
    const source = 'const C=()=><><img src="a"/><img src="b"/></>;';
    expect(await count(rule, source)).toBe(2);
    expect(await evaluate(rule, source)).toEqual(await evaluate(rule, source));
  });
});
