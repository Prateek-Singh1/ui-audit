import { access, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { ResolvedUiAuditConfig } from "./config.js";
import { assertValidConfig } from "./validator.js";

export const CONFIG_FILE_NAME = "ui-audit.config.ts";

const TS_CONFIG_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

export class ConfigLoadError extends Error {
  readonly configFile: string;

  constructor(configFile: string, cause: unknown) {
    super(`Failed to load ui-audit configuration from ${configFile}.`, {
      cause,
    });
    this.name = "ConfigLoadError";
    this.configFile = configFile;
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
  const configFile = path.join(
    resolvedRoot,
    options.configFileName ?? CONFIG_FILE_NAME,
  );

  if (!(await fileExists(configFile))) {
    return assertValidConfig({}, { projectRoot: resolvedRoot });
  }

  const loadedConfig = await importConfigFile(configFile);
  return assertValidConfig(loadedConfig, {
    projectRoot: resolvedRoot,
    configFile,
  });
};

const importConfigFile = async (configFile: string): Promise<unknown> => {
  try {
    return await importNative(configFile);
  } catch (error) {
    // Node can natively import a TypeScript config only with type-stripping
    // (Node >=22.6). On older-but-supported Node versions the import throws
    // `ERR_UNKNOWN_FILE_EXTENSION`; transpile with the bundled TypeScript
    // compiler and retry so `ui-audit.config.ts` works across the whole
    // supported Node range. A genuine error inside the config is rethrown.
    if (isUnknownTsExtensionError(error, configFile)) {
      try {
        return await importTranspiledTypeScript(configFile);
      } catch (transpileError) {
        throw new ConfigLoadError(configFile, transpileError);
      }
    }

    throw new ConfigLoadError(configFile, error);
  }
};

const importNative = async (configFile: string): Promise<unknown> => {
  const stats = await stat(configFile);
  const url = pathToFileURL(configFile);
  url.searchParams.set("mtime", String(stats.mtimeMs));
  const module = (await import(url.href)) as { default?: unknown };
  return module.default;
};

/**
 * Transpiles a TypeScript config to JavaScript and imports it from a temporary
 * sibling file, so relative and bare-specifier imports still resolve against the
 * project's `node_modules`. The temp file is always cleaned up.
 */
const importTranspiledTypeScript = async (
  configFile: string,
): Promise<unknown> => {
  const source = await readFile(configFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: configFile,
  });

  const stats = await stat(configFile);
  const digest = createHash("sha1")
    .update(`${configFile}:${stats.mtimeMs}`)
    .digest("hex")
    .slice(0, 8);
  const tempFile = path.join(
    path.dirname(configFile),
    `.${path.basename(configFile)}.${digest}.mjs`,
  );

  await writeFile(tempFile, outputText, "utf8");

  try {
    const module = (await import(pathToFileURL(tempFile).href)) as {
      default?: unknown;
    };
    return module.default;
  } finally {
    await unlink(tempFile).catch(() => undefined);
  }
};

const isUnknownTsExtensionError = (
  error: unknown,
  configFile: string,
): boolean => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return (
    code === "ERR_UNKNOWN_FILE_EXTENSION" &&
    TS_CONFIG_EXTENSIONS.includes(path.extname(configFile).toLowerCase())
  );
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};
