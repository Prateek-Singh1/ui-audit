import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ResolvedUiAuditConfig } from './config.js';
import { assertValidConfig } from './validator.js';

export const CONFIG_FILE_NAME = 'ui-audit.config.ts';

export class ConfigLoadError extends Error {
  readonly cause: unknown;
  readonly configFile: string;

  constructor(configFile: string, cause: unknown) {
    super(`Failed to load ui-audit configuration from ${configFile}.`);
    this.name = 'ConfigLoadError';
    this.configFile = configFile;
    this.cause = cause;
  }
}

export interface LoadConfigOptions {
  readonly configFileName?: string;
}

export const loadConfig = async (
  projectRoot: string,
  options: LoadConfigOptions = {},
): Promise<ResolvedUiAuditConfig> => {
  const resolvedRoot = path.resolve(projectRoot);
  const configFile = path.join(resolvedRoot, options.configFileName ?? CONFIG_FILE_NAME);

  if (!(await fileExists(configFile))) {
    return assertValidConfig({}, { projectRoot: resolvedRoot });
  }

  const loadedConfig = await importConfigFile(configFile);
  return assertValidConfig(loadedConfig, { projectRoot: resolvedRoot, configFile });
};

const importConfigFile = async (configFile: string): Promise<unknown> => {
  try {
    const stats = await stat(configFile);
    const url = pathToFileURL(configFile);
    url.searchParams.set('mtime', String(stats.mtimeMs));
    const module = (await import(url.href)) as { default?: unknown };
    return module.default;
  } catch (error) {
    throw new ConfigLoadError(configFile, error);
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};
