import type { AuditConfig } from './config.js';
import type { Rule } from './rule.js';
import type { Reporter } from './reporter.js';
import type { Scanner } from './scanner.js';

/**
 * Describes the metadata that a plugin exposes to the host application.
 */
export interface PluginManifest {
  /** Plugin identifier. */
  readonly name: string;
  /** Plugin semantic version. */
  readonly version: string;
  /** Short summary of the plugin purpose. */
  readonly description?: string;
  /** Optional keywords for discovery and documentation. */
  readonly keywords?: readonly string[];
  /** Optional entrypoint used by plugin loaders. */
  readonly entrypoint?: string;
}

/**
 * The contract implemented by community or built-in extensions.
 */
export interface Plugin {
  /** Static manifest for plugin identification. */
  readonly manifest: PluginManifest;
  /** Rules contributed by the plugin. */
  readonly rules?: readonly Rule[];
  /** Reporters contributed by the plugin. */
  readonly reporters?: readonly Reporter[];
  /** Scanners contributed by the plugin. */
  readonly scanners?: readonly Scanner[];
  /** Optional initialization hook for plugin setup. */
  readonly initialize?: (config: AuditConfig) => void | Promise<void>;
  /** Optional teardown hook for plugin cleanup. */
  readonly shutdown?: () => void | Promise<void>;
}
