# Performance Rule Catalog

Built-in rules in the `performance` category. Every rule runs against the
normalized AST (TS/TSX/JS/JSX), reports accurate `file:line:column` locations, a
severity, and a remediation suggestion.

Severities: `info`, `warning`, `error`, `critical`. Severities can be overridden
per rule (including `off`) in `ui-audit.config.ts`, and every threshold below is
configurable through the rule's config entry.

## Pack 1

### perf/no-large-image
- **Severity:** warning
- Flags `<img>` elements using oversized inline base64 data URIs or unoptimized
  raw image formats.
- **Config:** `maxDataUriBytes` (default `8192`), `disallowedFormats` (default
  `["bmp", "tiff", "tif"]`).
- **Fix:** Compress/convert the asset (WebP/AVIF) and reference it by URL.

### perf/no-sync-storage
- **Severity:** info
- Flags synchronous `localStorage` / `sessionStorage` access, which blocks the
  main thread — costly in render and other hot paths.
- **Fix:** Read once outside hot paths, or move persistence to an async/cached
  layer.

### perf/no-large-object-literal
- **Severity:** info
- Flags object literals whose direct property count exceeds the threshold.
- **Config:** `maxProperties` (default `20`).
- **Fix:** Extract the literal to a module constant or load it as data.

### perf/no-large-array-literal
- **Severity:** info
- Flags array literals whose element count exceeds the threshold.
- **Config:** `maxLength` (default `50`).
- **Fix:** Move the data to a constant, JSON file, or fetched resource.

### perf/no-expensive-regex
- **Severity:** warning
- Flags regular expressions with nested quantifiers (`(a+)+`, `(a*)*`,
  `([a-z]+){2,}`) — the classic catastrophic-backtracking (ReDoS) shapes. Covers
  both `/…/` literals and `new RegExp("…")` constructors.
- **Fix:** Rewrite to avoid nested quantifiers, or use a linear-time matcher.

### perf/no-inline-large-function
- **Severity:** warning
- Flags inline callbacks (arrow/function expressions) passed as call arguments
  or JSX prop values that exceed a line limit.
- **Config:** `maxLines` (default `20`).
- **Fix:** Extract the callback to a named function, and memoize if needed.

### perf/no-unnecessary-fragment
- **Severity:** info
- Flags fragments that wrap exactly one child, including a fragment whose sole
  child is another fragment (redundant nesting).
- **Fix:** Return the child directly instead of wrapping it in a fragment.

### perf/prefer-lazy-import
- **Severity:** info
- Flags large static imports that are good candidates for dynamic `import()`
  code splitting: imports from heavyweight packages and imports pulling in many
  named bindings. Type-only imports are ignored.
- **Config:** `heavyModules` (default `["lodash", "moment", "three", "chart.js",
  "d3", "rxjs", "@mui/material", "highcharts", "pdfjs-dist", "monaco-editor"]`),
  `maxNamedImports` (default `8`).
- **Fix:** Load the module on demand with a dynamic import (e.g. `React.lazy`).

### perf/no-deeply-nested-jsx
- **Severity:** warning
- Warns when JSX element nesting depth exceeds the limit. One finding is
  reported per top-level JSX tree, anchored at the first offending element.
- **Config:** `maxDepth` (default `6`).
- **Fix:** Extract nested markup into smaller child components.

### perf/no-large-switch
- **Severity:** info
- Warns when a switch statement's `case`/`default` clause count exceeds the
  limit.
- **Config:** `maxCases` (default `10`).
- **Fix:** Replace the switch with a lookup map or dispatch table.
