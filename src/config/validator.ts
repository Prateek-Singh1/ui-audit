import path from 'node:path';
import type {
  ConfigValidationIssue,
  ConfigValidationResult,
  ParserOptions,
  PluginEntry,
  ResolvedUiAuditConfig,
  RuleSeverity,
  RuleSeverityMap,
  UiAuditConfig,
} from './config.js';
import { DEFAULT_CONFIG } from './defaults.js';

const VALID_SEVERITIES = new Set<RuleSeverity>(['off', 'info', 'warning', 'error']);
const KNOWN_TOP_LEVEL_KEYS = new Set(['ignore', 'rules', 'parserOptions', 'plugins']);

export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigValidationIssue[];

  constructor(issues: readonly ConfigValidationIssue[]) {
    super(formatValidationMessage(issues));
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export interface ValidateConfigOptions {
  readonly projectRoot: string;
  readonly configFile?: string;
}

export const validateConfig = (
  config: unknown,
  options: ValidateConfigOptions,
): ConfigValidationResult => {
  const issues: ConfigValidationIssue[] = [];

  if (!isPlainObject(config)) {
    return {
      ok: false,
      errors: [
        {
          path: 'config',
          message: 'Configuration must export an object.',
        },
      ],
    };
  }

  validateKnownKeys(config, issues);
  validateIgnore(config.ignore, issues);
  validateRules(config.rules, issues);
  validateParserOptions(config.parserOptions, issues);
  validatePlugins(config.plugins, issues);

  if (issues.length > 0) {
    return { ok: false, errors: issues };
  }

  return {
    ok: true,
    config: mergeWithDefaults(config as UiAuditConfig, options),
  };
};

export const assertValidConfig = (
  config: unknown,
  options: ValidateConfigOptions,
): ResolvedUiAuditConfig => {
  const result = validateConfig(config, options);

  if (!result.ok) {
    throw new ConfigValidationError(result.errors);
  }

  return result.config;
};

const mergeWithDefaults = (
  config: UiAuditConfig,
  options: ValidateConfigOptions,
): ResolvedUiAuditConfig => {
  return {
    projectRoot: path.resolve(options.projectRoot),
    ...(options.configFile ? { configFile: options.configFile } : {}),
    ignore: mergeUnique(DEFAULT_CONFIG.ignore, config.ignore ?? []),
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...(config.rules ?? {}),
    },
    parserOptions: {
      ...DEFAULT_CONFIG.parserOptions,
      ...(config.parserOptions ?? {}),
      extensions: mergeUnique(
        DEFAULT_CONFIG.parserOptions.extensions,
        config.parserOptions?.extensions ?? [],
      ),
    },
    plugins: [...DEFAULT_CONFIG.plugins, ...(config.plugins ?? [])],
  };
};

const validateKnownKeys = (
  config: Readonly<Record<string, unknown>>,
  issues: ConfigValidationIssue[],
): void => {
  for (const key of Object.keys(config)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      issues.push({
        path: key,
        message: `Unknown configuration option "${key}".`,
      });
    }
  }
};

const validateIgnore = (ignore: unknown, issues: ConfigValidationIssue[]): void => {
  if (ignore === undefined) {
    return;
  }

  if (!Array.isArray(ignore)) {
    issues.push({ path: 'ignore', message: 'Expected an array of strings.' });
    return;
  }

  ignore.forEach((pattern, index) => {
    if (typeof pattern !== 'string' || pattern.length === 0) {
      issues.push({
        path: `ignore[${index}]`,
        message: 'Ignore entries must be non-empty strings.',
      });
    }
  });
};

const validateRules = (rules: unknown, issues: ConfigValidationIssue[]): void => {
  if (rules === undefined) {
    return;
  }

  if (!isPlainObject(rules)) {
    issues.push({ path: 'rules', message: 'Expected an object keyed by rule id.' });
    return;
  }

  for (const [ruleId, severity] of Object.entries(rules)) {
    if (!VALID_SEVERITIES.has(severity as RuleSeverity)) {
      issues.push({
        path: `rules.${ruleId}`,
        message: 'Rule severity must be one of: off, info, warning, error.',
      });
    }
  }
};

const validateParserOptions = (
  parserOptions: unknown,
  issues: ConfigValidationIssue[],
): void => {
  if (parserOptions === undefined) {
    return;
  }

  if (!isPlainObject(parserOptions)) {
    issues.push({ path: 'parserOptions', message: 'Expected an object.' });
    return;
  }

  if (parserOptions.extensions !== undefined) {
    if (!Array.isArray(parserOptions.extensions)) {
      issues.push({
        path: 'parserOptions.extensions',
        message: 'Expected an array of file extensions.',
      });
    } else {
      parserOptions.extensions.forEach((extension, index) => {
        if (typeof extension !== 'string' || extension.length === 0) {
          issues.push({
            path: `parserOptions.extensions[${index}]`,
            message: 'Parser extensions must be non-empty strings.',
          });
        }
      });
    }
  }

  validateOptionalBoolean(parserOptions.jsx, 'parserOptions.jsx', issues);
  validateOptionalBoolean(parserOptions.typescript, 'parserOptions.typescript', issues);

  if (parserOptions.options !== undefined && !isPlainObject(parserOptions.options)) {
    issues.push({
      path: 'parserOptions.options',
      message: 'Expected an object for parser-specific options.',
    });
  }
};

const validatePlugins = (plugins: unknown, issues: ConfigValidationIssue[]): void => {
  if (plugins === undefined) {
    return;
  }

  if (!Array.isArray(plugins)) {
    issues.push({ path: 'plugins', message: 'Expected an array of plugin entries.' });
    return;
  }

  plugins.forEach((plugin, index) => {
    if (typeof plugin === 'string') {
      if (plugin.length === 0) {
        issues.push({ path: `plugins[${index}]`, message: 'Plugin names must be non-empty.' });
      }
      return;
    }

    if (!isPlainObject(plugin)) {
      issues.push({
        path: `plugins[${index}]`,
        message: 'Plugin entries must be strings or objects with a name.',
      });
      return;
    }

    if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
      issues.push({
        path: `plugins[${index}].name`,
        message: 'Plugin object entries must include a non-empty name.',
      });
    }

    if (plugin.options !== undefined && !isPlainObject(plugin.options)) {
      issues.push({
        path: `plugins[${index}].options`,
        message: 'Plugin options must be an object.',
      });
    }
  });
};

const validateOptionalBoolean = (
  value: unknown,
  optionPath: string,
  issues: ConfigValidationIssue[],
): void => {
  if (value !== undefined && typeof value !== 'boolean') {
    issues.push({ path: optionPath, message: 'Expected a boolean.' });
  }
};

const mergeUnique = <T>(defaults: readonly T[], overrides: readonly T[]): readonly T[] => {
  return [...new Set([...defaults, ...overrides])];
};

const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const formatValidationMessage = (issues: readonly ConfigValidationIssue[]): string => {
  const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join(' ');
  return `Invalid ui-audit configuration. ${details}`;
};

export type { ParserOptions, PluginEntry, ResolvedUiAuditConfig, RuleSeverityMap };
