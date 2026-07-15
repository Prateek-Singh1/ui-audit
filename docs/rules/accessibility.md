# Accessibility Rule Catalog

Built-in rules in the `a11y` (Accessibility) category. Every rule runs against
the normalized AST, reuses the shared JSX helpers, and reports accurate
`file:line:column` locations with a remediation suggestion.

Severities can be overridden per rule (including `off`) in `ui-audit.config.ts`.

## Pack 1

### a11y/img-alt
- **Severity:** error
- Flags `<img>` elements with no `alt` attribute (elements using spread props are
  skipped to avoid false positives).
- **Fix:** Provide meaningful alt text, or `alt=""` for decorative images.

### a11y/button-accessible-name
- **Severity:** error
- Flags `<button>` elements with no accessible name — no text, no child
  expression, and no `aria-label`/`aria-labelledby`/`title`.
- **Fix:** Add visible text or an ARIA labelling attribute.

### a11y/input-label
- **Severity:** error
- Flags `<input>` elements not associated with a label (wrapping `<label>`,
  matching `htmlFor`/`id`) and lacking `aria-label`/`aria-labelledby`. Hidden and
  button-like input types are exempt.
- **Fix:** Associate a `<label>`, or add an ARIA labelling attribute.

### a11y/anchor-valid
- **Severity:** warning
- Flags anchors that are not real links: missing `href`, `href="#"`, or a
  `javascript:` URL.
- **Fix:** Use a real destination `href`, or a `<button>` for actions.

### a11y/no-autofocus
- **Severity:** info
- Flags the `autoFocus` attribute, which moves focus unexpectedly on mount.
- **Fix:** Manage focus explicitly instead.

### a11y/no-positive-tabindex
- **Severity:** warning
- Flags positive `tabIndex` values (numeric or string), which disrupt the
  natural tab order.
- **Fix:** Use `tabIndex={0}` or `tabIndex={-1}` and rely on DOM order.

### a11y/html-lang
- **Severity:** warning
- Flags `<html>` elements without a `lang` attribute.
- **Fix:** Add a `lang` attribute such as `lang="en"`.

### a11y/video-caption
- **Severity:** warning
- Flags `<video>` elements without a `<track kind="captions">` child.
- **Fix:** Add a captions track.

### a11y/svg-title
- **Severity:** info
- Flags `<svg>` elements with no `<title>` child and no
  `aria-label`/`aria-labelledby`/`aria-hidden`/`role`.
- **Fix:** Add a `<title>`, an ARIA label, or `aria-hidden="true"` if decorative.

### a11y/form-field-name
- **Severity:** error
- Flags `input`, `textarea`, and `select` controls with no accessible name via a
  label association or ARIA attribute. Hidden/button-like input types are exempt.
- **Fix:** Associate a `<label>`, or add an ARIA labelling attribute.
