import type {
  Finding,
  RuleResult,
  RuleStatus,
  SourceLocation,
} from "../core/index.js";
import type {
  NormalizedAstDocument,
  NormalizedAstNode,
} from "../parser/index.js";
import type { RuleContext } from "../rule-engine/index.js";
import type { RuleMetadata } from "./metadata.js";

/**
 * Input for creating a normalized finding from a rule.
 */
export interface CreateFindingInput {
  /** Rule context for the active invocation. */
  readonly context: RuleContext;
  /** Finding message. */
  readonly message: string;
  /** Human-readable rule name. */
  readonly ruleName?: string;
  /** Optional source location. */
  readonly location?: SourceLocation;
  /** Optional remediation guidance. */
  readonly suggestion?: string;
  /** Optional structured metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result returned when measuring a rule operation.
 */
export interface TimedExecutionResult<TValue> {
  /** Value returned by the measured operation. */
  readonly value: TValue;
  /** Elapsed time in milliseconds. */
  readonly durationMs: number;
}

/**
 * Creates a normalized finding using the active rule context.
 */
export const createFinding = (input: CreateFindingInput): Finding => {
  return {
    ruleId: input.context.ruleId,
    ...(input.ruleName ? { ruleName: input.ruleName } : {}),
    severity: input.context.severity,
    message: input.message,
    ...(input.location ? { location: input.location } : {}),
    ...(input.suggestion ? { suggestion: input.suggestion } : {}),
    ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
  };
};

/**
 * Visits every node in a normalized AST using pre-order traversal.
 */
export const visitAst = (
  node: NormalizedAstNode,
  visitor: (node: NormalizedAstNode) => void,
): void => {
  visitor(node);

  for (const child of node.children) {
    visitAst(child, visitor);
  }
};

/**
 * Cache of the flattened, pre-order node list for a given subtree root.
 *
 * Rules each query the AST many times (often the whole document, once per rule),
 * and every query previously re-walked the tree. Caching the single pre-order
 * walk per root collapses that into one traversal per document, shared across
 * all rules, with identical ordering and results. Keyed weakly so entries are
 * released with their AST.
 */
const nodeListCache = new WeakMap<
  NormalizedAstNode,
  readonly NormalizedAstNode[]
>();

/**
 * Returns every node in a subtree in pre-order, memoized per root node.
 */
export const getAllAstNodes = (
  node: NormalizedAstNode,
): readonly NormalizedAstNode[] => {
  const cached = nodeListCache.get(node);

  if (cached) {
    return cached;
  }

  const all: NormalizedAstNode[] = [];
  visitAst(node, (currentNode) => all.push(currentNode));
  nodeListCache.set(node, all);
  return all;
};

/**
 * Returns all AST nodes matching a predicate, in pre-order.
 */
export const findAstNodes = (
  node: NormalizedAstNode,
  predicate: (node: NormalizedAstNode) => boolean,
): readonly NormalizedAstNode[] => {
  return getAllAstNodes(node).filter((currentNode) => predicate(currentNode));
};

/**
 * Returns whether an AST node contains a descendant with the supplied kind.
 */
export const hasAstDescendantKind = (
  node: NormalizedAstNode,
  kind: string,
): boolean => {
  return node.children.some(
    (child) => child.kind === kind || hasAstDescendantKind(child, kind),
  );
};

/**
 * Extracts source text for a normalized AST node when document contents are available.
 */
export const getAstNodeText = (
  document: NormalizedAstDocument,
  node: NormalizedAstNode,
): string => {
  return document.contents?.slice(node.start.offset, node.end.offset) ?? "";
};

/**
 * Measures an asynchronous operation and returns its value with elapsed time.
 */
export const timeExecution = async <TValue>(
  operation: () => TValue | Promise<TValue>,
): Promise<TimedExecutionResult<TValue>> => {
  const startTime = performance.now();
  const value = await operation();

  return {
    value,
    durationMs: Math.max(0, performance.now() - startTime),
  };
};

/**
 * Creates a normalized rule result.
 */
export const createRuleResult = (
  metadata: RuleMetadata,
  status: RuleStatus,
  findings: readonly Finding[] = [],
): RuleResult => {
  return {
    ruleId: metadata.id,
    status,
    findings,
  };
};
