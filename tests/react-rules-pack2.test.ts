import { describe, expect, it } from "vitest";
import { parseFile } from "../src/parser/index.js";
import { createRuleContext } from "../src/rule-engine/index.js";
import type { Finding, Rule } from "../src/core/index.js";
import type { SourceFile } from "../src/scanner/index.js";
import {
  MaxComponentLinesRule,
  NoDirectStateMutationRule,
  NoDuplicatePropsRule,
  NoLargeJsxTreeRule,
  NoMultipleStateUpdatesRule,
  NoUnusedUseStateRule,
  NoUselessFragmentRule,
  PreferUseCallbackRule,
  PreferUseMemoRule,
  UseEffectCleanupRule,
} from "../src/rules/react/index.js";

const project = { projectRoot: "/x", cwd: "/x", files: [], env: {} };

const evaluate = async (
  rule: Rule,
  source: string,
  ruleConfig: Readonly<Record<string, unknown>> = {},
): Promise<readonly Finding[]> => {
  const file: SourceFile = {
    path: "/x/a.tsx",
    relativePath: "a.tsx",
    extension: "tsx",
    language: "TSX",
    contents: source,
    size: source.length,
    lastModified: new Date(0),
  };
  const parsed = await parseFile(file);
  if (!parsed.ast) {
    throw new Error("failed to parse fixture");
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
): Promise<number> => (await evaluate(rule, source, ruleConfig)).length;

describe("react/no-unused-use-state", () => {
  const rule = new NoUnusedUseStateRule();

  it("flags an unused value or setter", async () => {
    expect(
      await count(
        rule,
        "const C=()=>{const [v,setV]=useState(0); setV(1); return <div/>;};",
      ),
    ).toBe(1);
    expect(
      await count(
        rule,
        "const C=()=>{const [v,setV]=useState(0); return <div>{v}</div>;};",
      ),
    ).toBe(1);
  });

  it("does not flag fully used state", async () => {
    expect(
      await count(
        rule,
        "const C=()=>{const [v,setV]=useState(0); return <div onClick={()=>setV(1)}>{v}</div>;};",
      ),
    ).toBe(0);
  });

  it("respects underscore-prefixed intentionally unused names", async () => {
    expect(
      await count(
        rule,
        "const C=()=>{const [_v,setV]=useState(0); setV(1); return <div/>;};",
      ),
    ).toBe(0);
  });

  it("supports TypeScript generic useState (TSX)", async () => {
    expect(
      await count(
        rule,
        "const C=()=>{const [v,setV]=useState<number>(0); setV(1); return <div/>;};",
      ),
    ).toBe(1);
  });
});

describe("react/no-direct-state-mutation", () => {
  const rule = new NoDirectStateMutationRule();

  it("is an error rule and flags nested assignment and mutating methods on state", async () => {
    expect(rule.severity).toBe("error");
    expect(
      await count(
        rule,
        'const [state,setState]=useState({}); state.user.name = "John";',
      ),
    ).toBe(1);
    expect(
      await count(rule, "const [items,setItems]=useState([]); items.push(1);"),
    ).toBe(1);
  });

  it("does not flag mutation of non-state variables", async () => {
    expect(await count(rule, "const items=[]; items.push(1);")).toBe(0);
    expect(await count(rule, "config.value = 1;")).toBe(0);
  });

  it("ignores this.* and ref.current assignments", async () => {
    expect(
      await count(rule, "const [state,setState]=useState({}); this.value = 1;"),
    ).toBe(0);
    expect(
      await count(
        rule,
        "const [state,setState]=useState({}); ref.current = 1;",
      ),
    ).toBe(0);
  });

  it("does not flag non-mutating array methods on state", async () => {
    expect(
      await count(
        rule,
        "const [items,setItems]=useState([]); const next = items.map((x) => x + 1);",
      ),
    ).toBe(0);
  });
});

describe("react/no-multiple-state-updates", () => {
  const rule = new NoMultipleStateUpdatesRule();

  it("flags two or more setters in one block", async () => {
    expect(await count(rule, "function h(){ setA(1); setB(2); }")).toBe(1);
  });

  it("does not flag a single setter", async () => {
    expect(await count(rule, "function h(){ setA(1); }")).toBe(0);
  });

  it("treats separate blocks independently (nested)", async () => {
    expect(
      await count(
        rule,
        "function h(){ if (x) { setA(1); } else { setB(2); } }",
      ),
    ).toBe(0);
  });
});

describe("react/use-effect-cleanup", () => {
  const rule = new UseEffectCleanupRule();

  it("flags subscriptions/timers without cleanup", async () => {
    expect(
      await count(
        rule,
        'useEffect(()=>{ window.addEventListener("x", h); }, []);',
      ),
    ).toBe(1);
    expect(
      await count(
        rule,
        "useEffect(()=>{ const id = setInterval(tick, 1000); }, []);",
      ),
    ).toBe(1);
  });

  it("does not flag effects that return cleanup", async () => {
    expect(
      await count(
        rule,
        'useEffect(()=>{ window.addEventListener("x", h); return () => window.removeEventListener("x", h); }, []);',
      ),
    ).toBe(0);
  });

  it("does not flag effects without subscriptions", async () => {
    expect(await count(rule, "useEffect(()=>{ doThing(); }, []);")).toBe(0);
  });
});

describe("react/no-large-jsx-tree", () => {
  const rule = new NoLargeJsxTreeRule();
  const tree = (n: number): string =>
    `const C=()=><div>${"<span/>".repeat(n)}</div>;`;

  it("flags trees over the default threshold", async () => {
    expect(await count(rule, tree(45))).toBe(1);
  });

  it("allows small trees", async () => {
    expect(await count(rule, tree(5))).toBe(0);
  });

  it("honors a configurable maxNodes threshold", async () => {
    expect(await count(rule, tree(5), { maxNodes: 3 })).toBe(1);
  });
});

describe("react/max-component-lines", () => {
  const rule = new MaxComponentLinesRule();
  const component = (lines: number): string =>
    `const C=()=>{\n${Array.from({ length: lines }, (_, i) => `  const x${i}=${i};`).join("\n")}\n return <div/>;\n};`;

  it("flags components over a configured line limit", async () => {
    expect(await count(rule, component(20), { maxLines: 10 })).toBe(1);
  });

  it("does not flag small components", async () => {
    expect(await count(rule, component(3), { maxLines: 10 })).toBe(0);
  });
});

describe("react/prefer-use-callback", () => {
  const rule = new PreferUseCallbackRule();

  it("flags inline callbacks passed to components", async () => {
    expect(await count(rule, "const C=()=><Child onClick={()=>go()}/>;")).toBe(
      1,
    );
  });

  it("does not flag inline callbacks on DOM elements", async () => {
    expect(await count(rule, "const C=()=><button onClick={()=>go()}/>;")).toBe(
      0,
    );
  });
});

describe("react/prefer-use-memo", () => {
  const rule = new PreferUseMemoRule();

  it("flags array transforms and object/array creation during render", async () => {
    expect(
      await count(
        rule,
        "const C=()=>{const rows=items.map((x)=>x*2); return <div>{rows}</div>;};",
      ),
    ).toBe(1);
    expect(
      await count(
        rule,
        "const C=()=>{const style={a:1}; return <div>{JSON.stringify(style)}</div>;};",
      ),
    ).toBe(1);
  });

  it("does not flag cheap values", async () => {
    expect(
      await count(rule, "const C=()=>{const n=5; return <div>{n}</div>;};"),
    ).toBe(0);
  });

  it("does not flag values created outside components", async () => {
    expect(
      await count(
        rule,
        "const config={a:1}; export function util(){ return config; }",
      ),
    ).toBe(0);
  });
});

describe("react/no-duplicate-props", () => {
  const rule = new NoDuplicatePropsRule();

  it("is an error rule and flags duplicate props", async () => {
    expect(rule.severity).toBe("error");
    expect(await count(rule, "<Button disabled disabled />;")).toBe(1);
  });

  it("does not flag distinct props", async () => {
    expect(await count(rule, "<Button disabled loading />;")).toBe(0);
  });

  it("flags duplicates on nested elements only where they occur", async () => {
    expect(await count(rule, "<div><Button a a /><Input b /></div>;")).toBe(1);
  });
});

describe("react/no-useless-fragment", () => {
  const rule = new NoUselessFragmentRule();

  it("flags fragments wrapping exactly one child", async () => {
    expect(await count(rule, "const C=()=><><A/></>;")).toBe(1);
    expect(await count(rule, "const C=()=><>{value}</>;")).toBe(1);
  });

  it("does not flag multi-child or empty fragments", async () => {
    expect(await count(rule, "const C=()=><><A/><B/></>;")).toBe(0);
    expect(await count(rule, "const C=()=><></>;")).toBe(0);
  });

  it("handles nested fragments", async () => {
    // Outer wraps two children (ok); inner wraps one child (flagged).
    expect(await count(rule, "const C=()=><><A/><><B/></></>;")).toBe(1);
  });
});

describe("React rules pack 2 — determinism", () => {
  it("produces identical findings across repeated evaluations", async () => {
    const rule = new NoDuplicatePropsRule();
    const source = "<Button a a b b />;";
    expect(await evaluate(rule, source)).toEqual(await evaluate(rule, source));
  });
});
