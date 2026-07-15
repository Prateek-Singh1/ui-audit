import { describe, expect, it } from 'vitest';
import { parseFile } from '../src/parser/index.js';
import { createRuleContext } from '../src/rule-engine/index.js';
import type { Rule } from '../src/core/index.js';
import type { SourceFile } from '../src/scanner/index.js';
import {
  MaxPropsRule,
  NoAnonymousDefaultExportRule,
  NoArrayIndexKeyRule,
  NoConsoleInJsxRule,
  NoDangerouslySetInnerHtmlRule,
  NoEmptyFragmentRule,
  NoHardcodedColorsRule,
  NoInlineArrayPropsRule,
  NoInlineObjectPropsRule,
  PreferFragmentRule,
} from '../src/rules/react/index.js';
import type { Finding } from '../src/core/index.js';

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
  const result = await rule.evaluate(context);
  return result.findings;
};

const count = async (rule: Rule, source: string): Promise<number> => {
  return (await evaluate(rule, source)).length;
};

describe('react/no-array-index-key', () => {
  const rule = new NoArrayIndexKeyRule();

  it('has correct metadata', () => {
    expect(rule.id).toBe('react/no-array-index-key');
    expect(rule.severity).toBe('warning');
  });

  it('flags key={index} and index-like identifiers', async () => {
    expect(await count(rule, 'const L=()=><ul>{a.map((x,index)=><li key={index}>{x}</li>)}</ul>;')).toBe(1);
    expect(await count(rule, 'const L=()=><ul>{a.map((x,idx)=><li key={idx}>{x}</li>)}</ul>;')).toBe(1);
    expect(await count(rule, 'const L=()=><ul>{a.map((x,i)=><li key={`row-${i}`}>{x}</li>)}</ul>;')).toBe(1);
  });

  it('does not flag stable keys', async () => {
    expect(await count(rule, 'const L=()=><ul>{a.map((x)=><li key={x.id}>{x}</li>)}</ul>;')).toBe(0);
  });

  it('does not flag identifiers that merely contain "index"', async () => {
    expect(await count(rule, 'const L=()=><ul>{a.map((x)=><li key={indexOf(x)}>{x}</li>)}</ul>;')).toBe(0);
  });

  it('reports an accurate location', async () => {
    const [finding] = await evaluate(rule, 'const L=()=><li key={index} />;');
    expect(finding?.location?.file).toBe('a.tsx');
    expect(finding?.location?.line).toBe(1);
    expect(finding?.suggestion).toContain('stable unique identifier');
  });
});

describe('react/no-dangerously-set-inner-html', () => {
  const rule = new NoDangerouslySetInnerHtmlRule();

  it('is an error-severity rule', () => {
    expect(rule.severity).toBe('error');
  });

  it('flags the dangerouslySetInnerHTML prop', async () => {
    expect(await count(rule, 'const D=()=><div dangerouslySetInnerHTML={{__html:x}}/>;')).toBe(1);
  });

  it('does not flag ordinary props', async () => {
    expect(await count(rule, 'const D=()=><div title="x" className="y"/>;')).toBe(0);
  });
});

describe('react/no-inline-object-props', () => {
  const rule = new NoInlineObjectPropsRule();

  it('flags inline object literals', async () => {
    expect(await count(rule, 'const C=()=><Comp options={{a:1}}/>;')).toBe(1);
  });

  it('does not flag referenced objects or plain values', async () => {
    expect(await count(rule, 'const C=()=><Comp options={opts} count={3} name="x"/>;')).toBe(0);
  });

  it('names the offending prop', async () => {
    const [finding] = await evaluate(rule, 'const C=()=><Comp options={{a:1}}/>;');
    expect(finding?.message).toContain('options');
  });
});

describe('react/no-inline-array-props', () => {
  const rule = new NoInlineArrayPropsRule();

  it('flags inline array literals', async () => {
    expect(await count(rule, 'const C=()=><Comp items={[1,2,3]}/>;')).toBe(1);
  });

  it('does not flag referenced arrays', async () => {
    expect(await count(rule, 'const C=()=><Comp items={items}/>;')).toBe(0);
  });
});

describe('react/no-anonymous-default-export', () => {
  const rule = new NoAnonymousDefaultExportRule();

  it('flags anonymous arrow, function, and object default exports', async () => {
    expect(await count(rule, 'export default () => <div/>;')).toBe(1);
    expect(await count(rule, 'export default function(){ return <div/>; }')).toBe(1);
    expect(await count(rule, 'export default { a: 1 };')).toBe(1);
  });

  it('does not flag named default exports', async () => {
    expect(await count(rule, 'export default function App(){ return <div/>; }')).toBe(0);
    expect(await count(rule, 'const App=()=><div/>; export default App;')).toBe(0);
  });
});

describe('react/max-props', () => {
  const rule = new MaxPropsRule();

  it('flags elements with more than 10 props', async () => {
    expect(await count(rule, 'const C=()=><Comp a b c d e f g h i j k/>;')).toBe(1);
  });

  it('allows exactly 10 props (boundary)', async () => {
    expect(await count(rule, 'const C=()=><Comp a b c d e f g h i j/>;')).toBe(0);
  });

  it('does not flag small components', async () => {
    expect(await count(rule, 'const C=()=><Comp a b c/>;')).toBe(0);
  });

  it('reports the count and tag name', async () => {
    const [finding] = await evaluate(rule, 'const C=()=><Widget a b c d e f g h i j k l/>;');
    expect(finding?.message).toContain('Widget');
    expect(finding?.message).toContain('12');
  });
});

describe('react/no-console-in-jsx', () => {
  const rule = new NoConsoleInJsxRule();

  it('flags console calls inside JSX', async () => {
    expect(await count(rule, 'const C=()=><div>{console.log("x")}</div>;')).toBe(1);
    expect(await count(rule, 'const C=()=><div>{console.warn("x")}</div>;')).toBe(1);
  });

  it('does not flag console calls outside JSX', async () => {
    expect(await count(rule, 'const C=()=>{ console.log("x"); return <div/>; };')).toBe(0);
  });

  it('does not flag ordinary JSX expressions', async () => {
    expect(await count(rule, 'const C=()=><div>{value}</div>;')).toBe(0);
  });
});

describe('react/no-hardcoded-colors', () => {
  const rule = new NoHardcodedColorsRule();

  it('flags named, hex, and functional colors in style objects', async () => {
    expect(await count(rule, 'const C=()=><div style={{color:"red"}}/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><div style={{color:"#ff0000"}}/>;')).toBe(1);
    expect(await count(rule, 'const C=()=><div style={{background:"rgb(0,0,0)"}}/>;')).toBe(1);
  });

  it('does not flag token references or non-color strings', async () => {
    expect(await count(rule, 'const C=()=><div style={{color:tokens.primary}}/>;')).toBe(0);
    expect(await count(rule, 'const C=()=><div style={{content:"hello"}}/>;')).toBe(0);
  });
});

describe('react/prefer-fragment', () => {
  const rule = new PreferFragmentRule();

  it('flags a bare div that only groups multiple children', async () => {
    expect(await count(rule, 'const C=()=><div><A/><B/></div>;')).toBe(1);
  });

  it('does not flag divs with attributes', async () => {
    expect(await count(rule, 'const C=()=><div className="x"><A/><B/></div>;')).toBe(0);
  });

  it('does not flag a single-child div', async () => {
    expect(await count(rule, 'const C=()=><div><A/></div>;')).toBe(0);
  });
});

describe('react/no-empty-fragment', () => {
  const rule = new NoEmptyFragmentRule();

  it('is a warning-severity rule', () => {
    expect(rule.severity).toBe('warning');
  });

  it('flags empty fragments', async () => {
    expect(await count(rule, 'const C=()=><></>;')).toBe(1);
  });

  it('does not flag fragments with element or text content', async () => {
    expect(await count(rule, 'const C=()=><><A/></>;')).toBe(0);
    expect(await count(rule, 'const C=()=><>hello</>;')).toBe(0);
  });
});

describe('React rules pack 1 — determinism', () => {
  it('produces identical findings across repeated evaluations', async () => {
    const rule = new NoInlineObjectPropsRule();
    const source = 'const C=()=><Comp a={{x:1}} b={{y:2}}/>;';
    expect(await evaluate(rule, source)).toEqual(await evaluate(rule, source));
  });
});
