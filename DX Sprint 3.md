Proceed with the Developer Experience Sprint.

Milestone 3 — Severity Filtering.

Objective

Allow users to filter audit execution and reporting by severity.

Do NOT modify rule implementations.

Reuse existing severity metadata.

====================================================

CLI

====================================================

Support:

--severity info

--severity warning

--severity error

Support multiple values:

--severity warning,error

Case-insensitive.

====================================================

Behavior

====================================================

When specified:

Only findings matching the selected severities should be reported.

Examples:

ui-audit audit . --severity error

Only error findings are displayed.

ui-audit audit . --severity warning,error

Only warning and error findings are displayed.

If omitted:

Current behavior remains unchanged.

Unknown severities should produce a friendly validation error.

====================================================

Summary

====================================================

Display:

Selected severities

Hidden findings (if any)

Visible findings

====================================================

Requirements

Reuse existing severity metadata.

Do not duplicate severity definitions.

Do not modify rule implementations.

Keep deterministic ordering.

Filtering should occur after rule execution so execution statistics remain accurate.

====================================================

JSON Reporter

====================================================

Preserve existing JSON schema.

Only include visible findings.

Include selectedSeverities metadata.

====================================================

Terminal Reporter

====================================================

Display selected severities when filtering is active.

====================================================

Tests

====================================================

Add tests for:

- single severity
- multiple severities
- unknown severity
- default behavior
- deterministic ordering
- JSON reporter
- terminal reporter

====================================================

Validation

Run:

npm test

npm run build

npm run lint

====================================================

Before finishing provide:

- Files modified
- Example CLI usage
- Test results
- Build results
- Lint results

Wait for my approval before implementing the HTML Reporter.