import type { AuditConfig, RuleConfig } from '../core/index.js';
import type { Severity } from '../core/index.js';
import type {
  PluginEntry,
  ResolvedUiAuditConfig,
  RuleSeverity,
} from '../config/index.js';

/**
 * Optional overrides that higher layers (such as the CLI) can supply on top of
 * the resolved user configuration. These map directly onto the core
 * {@link AuditConfig} contract and take precedence over derived values.
 */
export interface AuditConfigOverrides {
  /** Working directory override for the run. */
  readonly cwd?: string;
  /** Preferred reporter name for output rendering. */
  readonly reporter?: string;
  /** Explicit include patterns for the scan. */
  readonly include?: readonly string[];
  /** Additional exclude patterns applied on top of the resolved ignore list. */
  readonly exclude?: readonly string[];
  /** Whether the CLI should fail on rule violations. */
  readonly strict?: boolean;
  /** Severity threshold that should trigger a non-zero exit code. */
  readonly failOnSeverity?: Severity;
  /** Extra metadata merged into the resolved audit configuration. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Maps a user-facing rule severity onto the core finding severity union.
 *
 * The configuration system uses `off | info | warning | error`, while the core
 * contract uses `info | warning | error | critical`. The shared members map
 * one-to-one; `off` is represented by disabling the rule rather than a severity.
 */
const CONFIG_TO_CORE_SEVERITY: Readonly<Record<Exclude<RuleSeverity, 'off'>, Severity>> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
};

/**
 * Bridges the resolved configuration produced by the configuration system into
 * the core {@link AuditConfig} contract consumed by the scanner and rule engine.
 *
 * This adapter is intentionally isolated so the two configuration models can
 * evolve independently without either subsystem depending on the other's shape.
 */
export const resolveAuditConfig = (
  resolved: ResolvedUiAuditConfig,
  overrides: AuditConfigOverrides = {},
): AuditConfig => {
  const rules = toRuleConfigMap(resolved.rules);
  const exclude = mergeUnique(resolved.ignore, overrides.exclude ?? []);

  return {
    projectRoot: resolved.projectRoot,
    ...(overrides.cwd ? { cwd: overrides.cwd } : {}),
    ...(overrides.reporter ? { reporter: overrides.reporter } : {}),
    ...(overrides.include ? { include: overrides.include } : {}),
    ...(exclude.length > 0 ? { exclude } : {}),
    rules,
    ...(overrides.strict !== undefined ? { strict: overrides.strict } : {}),
    ...(overrides.failOnSeverity ? { failOnSeverity: overrides.failOnSeverity } : {}),
    plugins: resolved.plugins.map(toPluginName),
    metadata: {
      parserOptions: resolved.parserOptions,
      ignore: resolved.ignore,
      ...(resolved.configFile ? { configFile: resolved.configFile } : {}),
      ...(overrides.metadata ?? {}),
    },
  };
};

/**
 * Converts the flat severity map into per-rule configuration objects, treating
 * `off` as a disabled rule and every other severity as an enabled override.
 */
const toRuleConfigMap = (
  severities: ResolvedUiAuditConfig['rules'],
): Record<string, RuleConfig> => {
  const rules: Record<string, RuleConfig> = {};

  for (const [ruleId, severity] of Object.entries(severities)) {
    if (severity === 'off') {
      rules[ruleId] = { enabled: false };
      continue;
    }

    rules[ruleId] = {
      enabled: true,
      severity: CONFIG_TO_CORE_SEVERITY[severity],
    };
  }

  return rules;
};

/**
 * Normalizes a plugin entry (string or object form) to its plugin name.
 */
const toPluginName = (entry: PluginEntry): string => {
  return typeof entry === 'string' ? entry : entry.name;
};

const mergeUnique = <T>(base: readonly T[], extra: readonly T[]): readonly T[] => {
  return [...new Set([...base, ...extra])];
};
