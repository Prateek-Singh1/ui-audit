import type { ResolvedUiAuditConfig } from './config.js';

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.cache',
  'storybook-static',
] as const;

export const DEFAULT_CONFIG: Omit<ResolvedUiAuditConfig, 'projectRoot' | 'configFile'> = {
  ignore: DEFAULT_IGNORE_PATTERNS,
  rules: {},
  parserOptions: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html'],
    jsx: true,
    typescript: true,
  },
  plugins: [],
};
