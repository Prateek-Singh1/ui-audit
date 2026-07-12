export const version = '0.1.0';

export * from './core/index.js';
export * from './config/index.js';
export * from './discovery/index.js';
export {
  detectSourceLanguage,
  scanFile,
  scanFiles,
  type ScannedFileStats,
  type ScannerError,
  type ScannerFileSystem,
  type ScannerOptions,
  type ScannerResult as SourceScannerResult,
  type SourceFile,
  type SourceLanguage,
} from './scanner/index.js';
export * from './parser/index.js';
export {
  RuleEngine,
  SequentialRuleExecutor,
  RuleRunner,
  execute,
  type ExecutionError,
  type ExecutionResult,
  type RuleContext as RuleEngineRuleContext,
  type RuleContextHelpers,
  type RuleEngineExecuteInput,
  type RuleExecutor,
  type RuleExecutorInput,
  type RuleInvocationResult,
  type RuleSourceFile,
} from './rule-engine/index.js';
