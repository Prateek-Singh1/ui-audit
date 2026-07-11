import type { Rule } from './rule.js';
import type { Reporter } from './reporter.js';
import type { Scanner } from './scanner.js';
import type { Plugin } from './plugin.js';

/**
 * The central registry used to discover rules, reporters, scanners, and plugins.
 */
export interface RuleRegistry {
  /** Registered rules keyed by identifier. */
  readonly rules: ReadonlyMap<string, Rule>;
  /** Registered reporters keyed by name. */
  readonly reporters: ReadonlyMap<string, Reporter>;
  /** Registered scanners keyed by name. */
  readonly scanners: ReadonlyMap<string, Scanner>;
  /** Registered plugins keyed by plugin name. */
  readonly plugins: ReadonlyMap<string, Plugin>;
  /** Registers a rule with the registry. */
  registerRule(rule: Rule): void;
  /** Registers a reporter with the registry. */
  registerReporter(reporter: Reporter): void;
  /** Registers a scanner with the registry. */
  registerScanner(scanner: Scanner): void;
  /** Registers a plugin with the registry. */
  registerPlugin(plugin: Plugin): void;
  /** Returns a registered rule by identifier. */
  getRule(id: string): Rule | undefined;
  /** Returns a registered reporter by name. */
  getReporter(name: string): Reporter | undefined;
  /** Returns a registered scanner by name. */
  getScanner(name: string): Scanner | undefined;
  /** Returns a registered plugin by name. */
  getPlugin(name: string): Plugin | undefined;
}
