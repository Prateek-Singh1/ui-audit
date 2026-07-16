# ui-audit

[![CI](https://github.com/Prateek-Singh1/ui-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/Prateek-Singh1/ui-audit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**ui-audit** is a fast, static CLI for auditing React and frontend TypeScript/JavaScript projects. It parses your source into an AST and runs a set of built-in rules for React best practices, accessibility, and performance — with clear, actionable, CI-friendly output. It never executes your project code.

## Features

- **55 built-in rules** across three categories:
  - **React** (25 rules, prefix `react/`)
  - **Accessibility** (20 rules, prefix `a11y/`)
  - **Performance** (10 rules, prefix `perf/`)
- **Three reporters:** human-friendly `terminal`, machine-readable `json`, and a self-contained interactive `html` report.
- **Category and severity filtering** from the command line.
- **Per-rule configuration** (severity overrides and disabling) via `ui-audit.config.ts`.
- **CI-friendly:** deterministic output and configurable exit codes (`--strict`, `--fail-on-severity`).
- **Safe by design:** static analysis only — your code is never executed and never leaves your machine.

See the full rule catalog in [docs/rules/README.md](docs/rules/README.md).

## Supported inputs

TypeScript, TSX, JavaScript, and JSX — files with extensions `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`.

## Installation

```bash
npm install --save-dev ui-audit
# or run without installing
npx ui-audit audit
```

Requires Node.js >= 20.

## Usage

```bash
ui-audit audit [path] [options]
```

`path` defaults to the current directory.

### Options

| Option                              | Description                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--config <path>`                   | Path to a config file. If given, the file must exist.                                                                |
| `--reporter <terminal\|json\|html>` | Output format (default `terminal`).                                                                                  |
| `--output <file>`                   | Write the report to a file instead of stdout. Required for `--reporter html`.                                        |
| `--category <categories>`           | Only run rules in these comma-separated categories: `react`, `accessibility`, `performance`.                         |
| `--severity <severities>`           | Only report findings of these comma-separated severities: `info`, `warning`, `error`, `critical` (case-insensitive). |
| `--strict`                          | Exit non-zero if any finding is produced.                                                                            |
| `--fail-on-severity <severity>`     | Exit non-zero if a finding at or above this severity is produced.                                                    |

> **Note on names:** `--category` uses the long names (`react`, `accessibility`, `performance`), while rule IDs use the prefixes `react/`, `a11y/`, and `perf/`.

`--severity` affects only what is _reported_; it never weakens the exit code. Execution errors and the full (unfiltered) finding set always determine the pass/fail result.

### Examples

```bash
# Audit the current project
ui-audit audit

# Only run performance rules, and only show warnings and errors
ui-audit audit ./src --category performance --severity warning,error

# Machine-readable output for CI
ui-audit audit --reporter json --output report.json

# Interactive HTML report
ui-audit audit --reporter html --output report.html

# Fail CI on any error-or-higher finding
ui-audit audit --fail-on-severity error
```

## Configuration

Add a `ui-audit.config.ts` to your project root to override rule severities or disable rules:

```ts
import { defineConfig } from "ui-audit";

export default defineConfig({
  rules: {
    "a11y/img-alt": "error",
    "react/no-console-in-jsx": "off",
  },
});
```

Severities: `off`, `info`, `warning`, `error`. Unknown rule IDs are reported as a warning and otherwise ignored.

## Reporters

- **terminal** — grouped by category then severity, with a summary header and colorized output.
- **json** — a stable, schema-versioned document for tooling and CI.
- **html** — a single self-contained file (embedded CSS/JS, no frameworks) with search, category/severity filters, expand/collapse, and light/dark mode.

## Security

ui-audit never executes project code. It performs static analysis only, reads files without modifying them, and collects no telemetry. See [SECURITY.md](SECURITY.md).

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

## Scripts

- `npm run dev` — run the CLI locally (`tsx`)
- `npm run build` — bundle with tsup
- `npm run typecheck` — type-check without emitting
- `npm run lint` — lint the TypeScript source
- `npm run format` — format with Prettier
- `npm test` — run the Vitest suite
- `npm run audit:deps` — audit runtime dependencies

## Contributing

Contributions are welcome. Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request.

## License

[MIT](./LICENSE)
