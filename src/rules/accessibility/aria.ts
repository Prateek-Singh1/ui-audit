/**
 * Shared ARIA reference data for accessibility rules.
 */

/** Valid WAI-ARIA role names (common subset). */
export const VALID_ARIA_ROLES: ReadonlySet<string> = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell',
  'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo',
  'definition', 'dialog', 'directory', 'document', 'feed', 'figure', 'form',
  'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox',
  'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option',
  'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row',
  'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
  'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist',
  'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
  'treegrid', 'treeitem',
]);

/** Required ARIA attributes for selected roles. */
export const ROLE_REQUIRED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  checkbox: ['aria-checked'],
  radio: ['aria-checked'],
  switch: ['aria-checked'],
  slider: ['aria-valuenow'],
  spinbutton: ['aria-valuenow'],
  combobox: ['aria-expanded'],
  heading: ['aria-level'],
  option: ['aria-selected'],
  scrollbar: ['aria-controls', 'aria-valuenow'],
};

/**
 * Implicit ARIA roles for common HTML tags. When an element sets `role` to its
 * implicit role the attribute is redundant. `a` maps to `link` only when it has
 * an `href`, so it is resolved separately by the rule.
 */
export const IMPLICIT_ROLES: Readonly<Record<string, string>> = {
  button: 'button',
  img: 'img',
  nav: 'navigation',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  table: 'table',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  article: 'article',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  form: 'form',
  select: 'listbox',
  textarea: 'textbox',
  dialog: 'dialog',
};
