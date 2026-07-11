import type { Rule } from './rule.js';
import type { Reporter } from './reporter.js';
import type { Scanner } from './scanner.js';
import type { Plugin } from './plugin.js';

/**
 * The central registry used to discover rules, reporters, scanners, and plugins.
 */
export interface RuleRegistryContract {
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

/**
 * Runtime implementation of the rule registry.
 *
 * The registry uses Maps to preserve insertion order while providing fast lookups.
 * Duplicate rule identifiers are rejected to avoid ambiguous behavior.
 */
export class RuleRegistry implements RuleRegistryContract {
  private readonly ruleStore = new Map<string, Rule>();
  private readonly reporterStore = new Map<string, Reporter>();
  private readonly scannerStore = new Map<string, Scanner>();
  private readonly pluginStore = new Map<string, Plugin>();

  public readonly rules: ReadonlyMap<string, Rule> = this.ruleStore;
  public readonly reporters: ReadonlyMap<string, Reporter> = this.reporterStore;
  public readonly scanners: ReadonlyMap<string, Scanner> = this.scannerStore;
  public readonly plugins: ReadonlyMap<string, Plugin> = this.pluginStore;

  /**
   * Registers a rule if its identifier is not already present.
   */
  public register(rule: Rule): void {
    this.registerRule(rule);
  }

  /**
   * Registers a rule with the registry.
   */
  public registerRule(rule: Rule): void {
    if (this.ruleStore.has(rule.id)) {
      throw new Error(`Rule with id "${rule.id}" is already registered.`);
    }

    this.ruleStore.set(rule.id, rule);
  }

  /**
   * Removes a rule from the registry by identifier.
   */
  public unregister(ruleId: string): boolean {
    return this.ruleStore.delete(ruleId);
  }

  /**
   * Returns a rule by identifier if it exists.
   */
  public get(ruleId: string): Rule | undefined {
    return this.getRule(ruleId);
  }

  /**
   * Returns whether the registry contains a rule with the supplied identifier.
   */
  public has(ruleId: string): boolean {
    return this.ruleStore.has(ruleId);
  }

  /**
   * Returns all registered rules in insertion order.
   */
  public list(): readonly Rule[] {
    return Array.from(this.ruleStore.values());
  }

  /**
   * Clears all registered rules.
   *
   * This method is intended for tests and internal reset flows.
   */
  public clear(): void {
    this.ruleStore.clear();
  }

  /**
   * Registers a reporter with the registry.
   */
  public registerReporter(reporter: Reporter): void {
    if (this.reporterStore.has(reporter.name)) {
      throw new Error(`Reporter with name "${reporter.name}" is already registered.`);
    }

    this.reporterStore.set(reporter.name, reporter);
  }

  /**
   * Registers a scanner with the registry.
   */
  public registerScanner(scanner: Scanner): void {
    if (this.scannerStore.has(scanner.name)) {
      throw new Error(`Scanner with name "${scanner.name}" is already registered.`);
    }

    this.scannerStore.set(scanner.name, scanner);
  }

  /**
   * Registers a plugin with the registry.
   */
  public registerPlugin(plugin: Plugin): void {
    if (this.pluginStore.has(plugin.manifest.name)) {
      throw new Error(`Plugin with name "${plugin.manifest.name}" is already registered.`);
    }

    this.pluginStore.set(plugin.manifest.name, plugin);
  }

  /**
   * Returns a registered reporter by name.
   */
  public getRule(id: string): Rule | undefined {
    return this.ruleStore.get(id);
  }

  /**
   * Returns a registered reporter by name.
   */
  public getReporter(name: string): Reporter | undefined {
    return this.reporterStore.get(name);
  }

  /**
   * Returns a registered scanner by name.
   */
  public getScanner(name: string): Scanner | undefined {
    return this.scannerStore.get(name);
  }

  /**
   * Returns a registered plugin by name.
   */
  public getPlugin(name: string): Plugin | undefined {
    return this.pluginStore.get(name);
  }
}
