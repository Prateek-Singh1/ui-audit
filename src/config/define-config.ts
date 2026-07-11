import type { UiAuditConfig } from './config.js';

/**
 * Provides type inference for ui-audit configuration files.
 */
export const defineConfig = <TConfig extends UiAuditConfig>(config: TConfig): TConfig => {
  return config;
};
