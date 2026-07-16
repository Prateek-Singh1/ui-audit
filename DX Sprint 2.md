Proceed with the Developer Experience Sprint.

Milestone 2 — Category Filtering.

Objective

Allow users to execute only specific rule categories from the CLI.

The rule engine, pipeline, reporters and rules are complete.

Do NOT modify rule implementations.

Implement filtering using the existing rule metadata.

====================================================

CLI

====================================================

Support:

--category react

--category accessibility

--category performance

Support multiple values:

--category react,performance

====================================================

Behavior

====================================================

Only execute rules belonging to the requested categories.

If no category is specified:

Run all rules (current behavior).

Unknown categories should produce a friendly validation error listing the supported categories.

====================================================

Summary

====================================================

Display:

Selected Categories

Rules Executed

Skipped Rules

====================================================

Requirements

Use existing category metadata.

Do not duplicate category definitions.

Do not modify rule implementations.

Do not modify reporters except for displaying selected categories.

Preserve deterministic execution.

====================================================

Tests

Add integration tests covering:

- single category
- multiple categories
- unknown category
- default behavior
- deterministic ordering

====================================================

Validation

Run:

npm test
npm run build
npm run lint

====================================================

Before finishing provide:

Files modified

Example CLI usage

Tests

Build

Lint

Wait for approval before DX Sprint 3.