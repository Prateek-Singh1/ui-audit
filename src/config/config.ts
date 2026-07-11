export type RuleSeverity = 'off' | 'info' | 'warning' | 'error';

export type RuleSeverityMap = Readonly<Record<string, RuleSeverity>>;

export interface ParserOptions {
  /** File extensions that parser implementations may consider in future stages. */
  readonly extensions?: readonly string[];
  /** Enables parser implementations to preserve JSX-aware behavior when available. */
  readonly jsx?: boolean;
  /** Enables parser implementations to preserve TypeScript-aware behavior when available. */
  readonly typescript?: boolean;
  /** Parser-specific extension point for future framework support. */
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface PluginConfig {
  /** Package name, local module id, or future registry identifier. */
  readonly name: string;
  /** Plugin-specific configuration passed through without interpretation. */
  readonly options?: Readonly<Record<string, unknown>>;
}

export type PluginEntry = string | PluginConfig;

export interface UiAuditConfig {
  /** Files, directories, or glob-like patterns ignored by future audit stages. */
  readonly ignore?: readonly string[];
  /** Rule severities keyed by rule id. */
  readonly rules?: RuleSeverityMap;
  /** Parser behavior for future parsing stages. */
  readonly parserOptions?: ParserOptions;
  /** Future plugin declarations. */
  readonly plugins?: readonly PluginEntry[];
}

export interface ResolvedUiAuditConfig {
  readonly projectRoot: string;
  readonly configFile?: string;
  readonly ignore: readonly string[];
  readonly rules: RuleSeverityMap;
  readonly parserOptions: Required<Pick<ParserOptions, 'extensions' | 'jsx' | 'typescript'>> &
    Pick<ParserOptions, 'options'>;
  readonly plugins: readonly PluginEntry[];
}

export interface ConfigValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ConfigValidationSuccess {
  readonly ok: true;
  readonly config: ResolvedUiAuditConfig;
}

export interface ConfigValidationFailure {
  readonly ok: false;
  readonly errors: readonly ConfigValidationIssue[];
}

export type ConfigValidationResult = ConfigValidationSuccess | ConfigValidationFailure;
