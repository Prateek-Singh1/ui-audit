import path from 'node:path';
import type { Finding, ProjectContext, RuleRegistry } from '../core/index.js';
import { loadConfig, type ResolvedUiAuditConfig } from '../config/index.js';
import {
  discoverProjectFiles,
  type FileDiscoveryOptions,
  type ProjectFile,
} from '../discovery/index.js';
import { scanFiles, type ScannerError, type ScannerOptions } from '../scanner/index.js';
import {
  parseFiles,
  type NormalizedAstDocument,
  type ParseOptions,
  type ParserError,
  type ParserResult,
} from '../parser/index.js';
import {
  ConfigAwareRuleExecutor,
  type ExecutionError,
  type RuleExecutor,
} from '../rule-engine/index.js';
import { createDefaultRegistry } from './default-registry.js';
import { resolveAuditConfig, type AuditConfigOverrides } from './resolve-config.js';

/**
 * Non-fatal diagnostics collected while preparing files for evaluation.
 *
 * Reuses the existing scanner and parser error models rather than defining new
 * ones.
 */
export interface AuditDiagnostics {
  /** Files that could not be read from disk. */
  readonly scan: readonly ScannerError[];
  /** Files that could not be parsed into an analyzable AST. */
  readonly parse: readonly ParserError[];
}

/**
 * Complete, strongly typed result of a single audit run.
 */
export interface AuditResult {
  /** Absolute project root that was audited. */
  readonly projectRoot: string;
  /** Total wall-clock duration of the run in milliseconds. */
  readonly duration: number;
  /** Number of candidate files discovered on disk. */
  readonly filesDiscovered: number;
  /** Number of discovered files successfully read into source files. */
  readonly filesScanned: number;
  /** Number of scanned files successfully parsed into analyzable ASTs. */
  readonly filesParsed: number;
  /** Number of rule invocations actually executed. */
  readonly rulesExecuted: number;
  /** Findings emitted across all executed rules. */
  readonly findings: readonly Finding[];
  /** Structured errors from rules that threw during evaluation. */
  readonly executionErrors: readonly ExecutionError[];
  /** Non-fatal scan and parse diagnostics. */
  readonly diagnostics: AuditDiagnostics;
}

/**
 * Construction-time dependencies for the pipeline. All are optional and default
 * to the standard built-in implementations; they exist so callers and tests can
 * substitute registries, executors, or filesystem boundaries.
 */
export interface AuditPipelineOptions {
  /** Rule registry to evaluate. Defaults to the built-in registry. */
  readonly registry?: RuleRegistry;
  /** Rule executor strategy. Defaults to the configuration-aware executor. */
  readonly executor?: RuleExecutor;
  /** Discovery options (filter/filesystem). Overrides config-derived defaults. */
  readonly discovery?: FileDiscoveryOptions;
  /** Scanner options, including an alternate filesystem for tests. */
  readonly scanner?: ScannerOptions;
  /** Parser options, including an alternate parser factory. */
  readonly parse?: ParseOptions;
}

/**
 * Per-run inputs for {@link AuditPipeline.run}.
 */
export interface AuditRunOptions {
  /** Project root to audit. Resolved to an absolute path. */
  readonly projectRoot: string;
  /**
   * Pre-resolved user configuration. When omitted, the pipeline loads it from
   * the project root using the configuration system.
   */
  readonly config?: ResolvedUiAuditConfig;
  /** Optional overrides applied on top of the resolved configuration. */
  readonly overrides?: AuditConfigOverrides;
  /** Optional environment map for the project context. Defaults to process env. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Optional abort signal for cooperative cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Thin orchestration service that assembles the discovery, scanner, parser, and
 * rule-engine subsystems into a complete audit workflow.
 *
 * The pipeline holds no domain logic of its own: each stage is delegated to the
 * module that owns it, and results are aggregated into a single
 * {@link AuditResult}. It performs no I/O beyond delegating to those modules and
 * prints nothing.
 */
export class AuditPipeline {
  private readonly registry: RuleRegistry;
  private readonly executor: RuleExecutor;
  private readonly discoveryOptions?: FileDiscoveryOptions;
  private readonly scannerOptions?: ScannerOptions;
  private readonly parseOptions?: ParseOptions;

  constructor(options: AuditPipelineOptions = {}) {
    this.registry = options.registry ?? createDefaultRegistry();
    this.executor = options.executor ?? new ConfigAwareRuleExecutor();
    this.discoveryOptions = options.discovery;
    this.scannerOptions = options.scanner;
    this.parseOptions = options.parse;
  }

  /**
   * Runs the full audit pipeline and returns an aggregated result.
   */
  async run(options: AuditRunOptions): Promise<AuditResult> {
    const startTime = performance.now();
    const projectRoot = path.resolve(options.projectRoot);

    // 1. Resolve configuration (loaded from disk unless supplied by the caller).
    const resolved = options.config ?? (await loadConfig(projectRoot));
    const auditConfig = resolveAuditConfig(resolved, options.overrides);

    // 2 & 3. Registry and executor are prepared as construction-time dependencies.

    // 4. Discover candidate files (deterministically ordered by the engine).
    const projectFiles = await discoverProjectFiles(
      projectRoot,
      this.resolveDiscoveryOptions(resolved),
    );

    // 5. Read discovered files into source files, preserving order.
    const scanResult = await scanFiles(projectFiles, this.scannerOptions);

    // 6. Parse source files into normalized AST documents, preserving order.
    const parseResults = await parseFiles(scanResult.files, this.parseOptions);
    const documents = collectAnalyzableDocuments(parseResults);

    // 7. Execute rules against the parsed documents.
    const execution = await this.executor.execute({
      documents,
      registry: this.registry,
      project: buildProjectContext(projectRoot, projectFiles, options),
      config: auditConfig,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    // 8 & 9. Aggregate findings and diagnostics into the complete result.
    return {
      projectRoot,
      duration: elapsedSince(startTime),
      filesDiscovered: projectFiles.length,
      filesScanned: scanResult.files.length,
      filesParsed: documents.length,
      rulesExecuted: execution.executedRules,
      findings: execution.findings,
      executionErrors: execution.errors,
      diagnostics: {
        scan: scanResult.errors,
        parse: collectParseErrors(parseResults),
      },
    };
  }

  /**
   * Uses caller-supplied discovery options when present; otherwise derives a
   * filter from the resolved configuration's extensions and ignore list.
   */
  private resolveDiscoveryOptions(resolved: ResolvedUiAuditConfig): FileDiscoveryOptions {
    if (this.discoveryOptions) {
      return this.discoveryOptions;
    }

    return {
      filterOptions: {
        includeExtensions: resolved.parserOptions.extensions,
        ignoredDirectoryNames: resolved.ignore,
      },
    };
  }
}

/**
 * Convenience helper that runs a single audit with default dependencies.
 */
export const runAudit = async (options: AuditRunOptions): Promise<AuditResult> => {
  return new AuditPipeline().run(options);
};

const buildProjectContext = (
  projectRoot: string,
  projectFiles: readonly ProjectFile[],
  options: AuditRunOptions,
): ProjectContext => {
  return {
    projectRoot,
    cwd: options.overrides?.cwd ?? projectRoot,
    files: projectFiles.map((file) => file.absolutePath),
    env: options.env ?? process.env,
  };
};

/**
 * Selects successfully parsed documents for evaluation using a single pass to
 * avoid intermediate array copies.
 */
const collectAnalyzableDocuments = (
  results: readonly ParserResult[],
): readonly NormalizedAstDocument[] => {
  const documents: NormalizedAstDocument[] = [];

  for (const result of results) {
    if (result.success && result.ast) {
      documents.push(result.ast);
    }
  }

  return documents;
};

const collectParseErrors = (results: readonly ParserResult[]): readonly ParserError[] => {
  const errors: ParserError[] = [];

  for (const result of results) {
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
  }

  return errors;
};

const elapsedSince = (startTime: number): number => {
  return Math.max(0, performance.now() - startTime);
};
