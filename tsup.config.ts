import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Keep runtime dependencies out of the bundle. Bundling packages like
  // "typescript" breaks the ESM output because they rely on dynamic require()
  // (e.g. require("fs")), which is unsupported in an ESM bundle. These are
  // resolved from node_modules at runtime instead.
  external: ['typescript', 'chalk', 'commander'],
});
