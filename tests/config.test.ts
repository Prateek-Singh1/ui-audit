import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ConfigLoadError,
  ConfigValidationError,
  DEFAULT_CONFIG,
  CONFIG_FILE_NAME,
  assertValidConfig,
  defineConfig,
  loadConfig,
  validateConfig,
  type UiAuditConfig,
} from '../src/config/index.js';

const tempRoots: string[] = [];

const createTempProject = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ui-audit-config-'));
  tempRoots.push(root);
  return root;
};

const writeConfig = async (root: string, source: string): Promise<void> => {
  await writeFile(path.join(root, CONFIG_FILE_NAME), source);
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('defineConfig', () => {
  it('returns the provided configuration while preserving its type', () => {
    const config = defineConfig({
      ignore: ['fixtures'],
      rules: {
        'a11y/button-name': 'error',
      },
      parserOptions: {
        extensions: ['.astro'],
      },
      plugins: [{ name: '@ui-audit/react', options: { strict: true } }],
    } satisfies UiAuditConfig);

    expect(config.rules?.['a11y/button-name']).toBe('error');
    expect(config.plugins).toEqual([{ name: '@ui-audit/react', options: { strict: true } }]);
  });
});

describe('validateConfig', () => {
  it('merges a valid user configuration with defaults', () => {
    const result = validateConfig(
      {
        ignore: ['fixtures', 'dist'],
        rules: {
          'layout/no-overlap': 'warning',
          'perf/no-large-image': 'off',
        },
        parserOptions: {
          extensions: ['.astro', '.tsx'],
          jsx: false,
          options: {
            framework: 'astro',
          },
        },
        plugins: ['@ui-audit/react'],
      },
      { projectRoot: '/project' },
    );

    expect(result).toMatchObject({ ok: true });

    if (!result.ok) {
      throw new Error('Expected config validation to pass.');
    }

    expect(result.config).toEqual({
      projectRoot: path.resolve('/project'),
      ignore: [...DEFAULT_CONFIG.ignore, 'fixtures'],
      rules: {
        'layout/no-overlap': 'warning',
        'perf/no-large-image': 'off',
      },
      parserOptions: {
        extensions: [...DEFAULT_CONFIG.parserOptions.extensions, '.astro'],
        jsx: false,
        typescript: true,
        options: {
          framework: 'astro',
        },
      },
      plugins: ['@ui-audit/react'],
    });
  });

  it('reports invalid rule severities with precise paths', () => {
    const result = validateConfig(
      {
        rules: {
          valid: 'info',
          invalid: 'fatal',
        },
      },
      { projectRoot: '/project' },
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          path: 'rules.invalid',
          message: 'Rule severity must be one of: off, info, warning, error.',
        },
      ],
    });
  });

  it('reports structural validation errors without throwing generic exceptions', () => {
    const result = validateConfig(
      {
        ignore: ['src', 1],
        parserOptions: {
          extensions: ['.tsx', false],
          jsx: 'yes',
          options: [],
        },
        plugins: ['', { options: true }, { name: 'plugin', options: [] }, false],
        extra: true,
      },
      { projectRoot: '/project' },
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        { path: 'extra', message: 'Unknown configuration option "extra".' },
        { path: 'ignore[1]', message: 'Ignore entries must be non-empty strings.' },
        {
          path: 'parserOptions.extensions[1]',
          message: 'Parser extensions must be non-empty strings.',
        },
        { path: 'parserOptions.jsx', message: 'Expected a boolean.' },
        {
          path: 'parserOptions.options',
          message: 'Expected an object for parser-specific options.',
        },
        { path: 'plugins[0]', message: 'Plugin names must be non-empty.' },
        {
          path: 'plugins[1].name',
          message: 'Plugin object entries must include a non-empty name.',
        },
        { path: 'plugins[1].options', message: 'Plugin options must be an object.' },
        { path: 'plugins[2].options', message: 'Plugin options must be an object.' },
        {
          path: 'plugins[3]',
          message: 'Plugin entries must be strings or objects with a name.',
        },
      ],
    });
  });

  it('throws ConfigValidationError when using the assertion helper', () => {
    expect(() => assertValidConfig({ rules: { sample: 'fatal' } }, { projectRoot: '/project' }))
      .toThrow(ConfigValidationError);
  });
});

describe('loadConfig', () => {
  it('falls back to defaults when ui-audit.config.ts is missing', async () => {
    const root = await createTempProject();

    await expect(loadConfig(root)).resolves.toEqual({
      projectRoot: root,
      ignore: DEFAULT_CONFIG.ignore,
      rules: {},
      parserOptions: DEFAULT_CONFIG.parserOptions,
      plugins: [],
    });
  });

  it('loads and validates ui-audit.config.ts from the project root', async () => {
    const root = await createTempProject();
    await writeConfig(
      root,
      `
        export default {
          ignore: ['fixtures'],
          rules: {
            'a11y/button-name': 'error',
            'layout/no-overlap': 'warning'
          },
          parserOptions: {
            extensions: ['.svelte'],
            typescript: false
          },
          plugins: [{ name: '@ui-audit/vue', options: { version: 3 } }]
        };
      `,
    );

    await expect(loadConfig(root)).resolves.toEqual({
      projectRoot: root,
      configFile: path.join(root, CONFIG_FILE_NAME),
      ignore: [...DEFAULT_CONFIG.ignore, 'fixtures'],
      rules: {
        'a11y/button-name': 'error',
        'layout/no-overlap': 'warning',
      },
      parserOptions: {
        extensions: [...DEFAULT_CONFIG.parserOptions.extensions, '.svelte'],
        jsx: true,
        typescript: false,
      },
      plugins: [{ name: '@ui-audit/vue', options: { version: 3 } }],
    });
  });

  it('surfaces config validation errors from loaded files', async () => {
    const root = await createTempProject();
    await writeConfig(
      root,
      `
        export default {
          rules: {
            sample: 'fatal'
          }
        };
      `,
    );

    await expect(loadConfig(root)).rejects.toThrow(ConfigValidationError);
  });

  it('wraps module loading failures in ConfigLoadError', async () => {
    const root = await createTempProject();
    await writeConfig(
      root,
      `
        throw new Error('broken config');
      `,
    );

    await expect(loadConfig(root)).rejects.toThrow(ConfigLoadError);
  });
});
