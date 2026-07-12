import type { RuleConfig } from '../core/config.js';
import type { ProjectContext, RuleContext as CoreRuleContext } from '../core/context.js';
import type { Severity } from '../core/finding.js';
import type { NormalizedAstDocument } from '../parser/index.js';

/**
 * Source-file details available to a rule during execution.
 */
export interface RuleSourceFile {
  /** Absolute filesystem path to the source file. */
  readonly path: string;
  /** Path to the source file relative to the project root. */
  readonly relativePath: string;
  /** Lowercase file extension without the leading dot when known. */
  readonly extension: string;
}

/**
 * Utility helpers exposed to rule implementations.
 */
export interface RuleContextHelpers {
  /** Returns whether a normalized AST node kind matches the supplied kind. */
  isNodeKind(node: { readonly kind: string }, kind: string): boolean;
  /** Creates a stable metadata object for rule-emitted findings. */
  metadata(values?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
}

/**
 * Project-level configuration made available to rules.
 */
export interface RuleEngineProjectConfig {
  /** Rule configuration keyed by rule identifier. */
  readonly rules?: Readonly<Record<string, RuleConfig>>;
  /** Additional configuration values provided by future integrations. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Strongly typed context supplied to each rule invocation by the rule engine.
 */
export interface RuleContext extends CoreRuleContext {
  /** Rule-specific configuration resolved for this invocation. */
  readonly config: Readonly<Record<string, unknown>>;
  /** Project-level configuration resolved for this execution. */
  readonly projectConfig: Readonly<Record<string, unknown>>;
  /** Source-file details for the AST document under evaluation. */
  readonly sourceFile: RuleSourceFile;
  /** Normalized AST document being evaluated. */
  readonly ast: NormalizedAstDocument;
  /** Language of the AST document being evaluated. */
  readonly language: NormalizedAstDocument['language'];
  /** Helper utilities for rule authors. */
  readonly helpers: RuleContextHelpers;
  /** Shared metadata for cross-cutting integrations. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Input required to construct a rule execution context.
 */
export interface RuleContextInput {
  /** Project context for the current execution. */
  readonly project: ProjectContext;
  /** Rule identifier being executed. */
  readonly ruleId: string;
  /** Effective severity for the active rule. */
  readonly severity: Severity;
  /** Rule-specific configuration values. */
  readonly ruleConfig?: Readonly<Record<string, unknown>>;
  /** Project-level configuration values. */
  readonly projectConfig?: Readonly<Record<string, unknown>>;
  /** AST document under evaluation. */
  readonly ast: NormalizedAstDocument;
  /** Optional shared metadata for all rule invocations. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Optional abort signal for cooperative cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Builds the context object passed to a rule invocation.
 */
export const createRuleContext = (input: RuleContextInput): RuleContext => {
  return {
    project: input.project,
    ruleId: input.ruleId,
    severity: input.severity,
    config: input.ruleConfig ?? {},
    projectConfig: input.projectConfig ?? {},
    sourceFile: {
      path: input.ast.path,
      relativePath: input.ast.relativePath,
      extension: extensionFromPath(input.ast.relativePath),
    },
    ast: input.ast,
    language: input.ast.language,
    helpers: defaultRuleContextHelpers,
    metadata: input.metadata ?? {},
    ...(input.signal ? { signal: input.signal } : {}),
  };
};

const defaultRuleContextHelpers: RuleContextHelpers = {
  isNodeKind(node, kind) {
    return node.kind === kind;
  },
  metadata(values = {}) {
    return { ...values };
  },
};

const extensionFromPath = (filePath: string): string => {
  const extension = filePath.split('.').pop();

  if (!extension || extension === filePath) {
    return '';
  }

  return extension.toLowerCase();
};
