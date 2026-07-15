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

## Pack 2

### a11y/aria-role-valid
- **Severity:** error
- Flags `role` attributes whose statically known value is not a valid WAI-ARIA
  role (dynamic values are ignored).
- **Fix:** Use a valid ARIA role, or remove the attribute.

### a11y/aria-required-attributes
- **Severity:** warning
- Flags elements whose ARIA role omits a required attribute (e.g.
  `role="checkbox"` without `aria-checked`).
- **Fix:** Add the ARIA attributes required by the role.

### a11y/no-redundant-role
- **Severity:** info
- Flags `role` attributes that restate an element's implicit role, such as
  `<button role="button">` or `<img role="img">`.
- **Fix:** Remove the redundant role.

### a11y/no-duplicate-id
- **Severity:** error
- Flags duplicate static `id` values within a file (dynamic ids are ignored).
- **Fix:** Make each id unique.

### a11y/heading-order
- **Severity:** warning
- Flags heading levels that skip a level (e.g. `<h1>` then `<h3>`), evaluated in
  source order.
- **Fix:** Increase heading levels by at most one.

### a11y/table-header
- **Severity:** warning
- Flags `<table>` elements with no `<th>` header cells.
- **Fix:** Add `<th>` header cells with an appropriate `scope`.

### a11y/list-structure
- **Severity:** warning
- Flags `<ul>`/`<ol>` lists with direct DOM-element children other than `<li>`
  (custom components and expressions are ignored).
- **Fix:** Wrap list content in `<li>` elements.

### a11y/iframe-title
- **Severity:** error
- Flags `<iframe>` elements without a `title` attribute.
- **Fix:** Add a descriptive `title`.

### a11y/no-marquee
- **Severity:** warning
- Flags obsolete `<marquee>` and `<blink>` elements.
- **Fix:** Remove them; use CSS animation with reduced-motion support if needed.

### a11y/audio-caption
- **Severity:** warning
- Flags `<audio>`/`<video>` media that provide no `<track>`. Captions on video
  specifically are covered by `a11y/video-caption`.
- **Fix:** Add a `<track>` element or an accessible transcript.
