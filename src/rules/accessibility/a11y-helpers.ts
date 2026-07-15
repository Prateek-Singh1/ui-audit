import type { NormalizedAstDocument, NormalizedAstNode } from '../../parser/index.js';
import {
  collectJsxElements,
  getAttributeStringValue,
  hasAttribute,
} from '../react/jsx-helpers.js';

/** Attributes that can supply an accessible name for a control. */
export const NAME_ATTRIBUTES = ['aria-label', 'aria-labelledby', 'title'];

interface LabelSpan {
  readonly start: number;
  readonly end: number;
}

/** Index of `<label>` associations within a document, computed once per run. */
export interface LabelIndex {
  /** Values referenced by label `htmlFor`/`for` attributes. */
  readonly forIds: ReadonlySet<string>;
  /** Source spans of label elements, used to detect wrapped controls. */
  readonly spans: readonly LabelSpan[];
}

/** Builds the {@link LabelIndex} for a document. */
export const buildLabelIndex = (
  ast: NormalizedAstDocument,
  root: NormalizedAstNode,
): LabelIndex => {
  const forIds = new Set<string>();
  const spans: LabelSpan[] = [];

  for (const element of collectJsxElements(ast, root)) {
    if (element.tag !== 'label') {
      continue;
    }

    const target =
      getAttributeStringValue(ast, element.header, 'htmlFor') ??
      getAttributeStringValue(ast, element.header, 'for');

    if (target) {
      forIds.add(target);
    }

    spans.push({ start: element.container.start.offset, end: element.container.end.offset });
  }

  return { forIds, spans };
};

/**
 * Whether a form control has an accessible name via an ARIA attribute, an
 * associated label (`htmlFor`/`id`), or by being wrapped in a `<label>`.
 */
export const hasAccessibleFieldName = (
  ast: NormalizedAstDocument,
  header: NormalizedAstNode,
  container: NormalizedAstNode,
  labels: LabelIndex,
): boolean => {
  if (NAME_ATTRIBUTES.some((name) => hasAttribute(ast, header, name))) {
    return true;
  }

  const id = getAttributeStringValue(ast, header, 'id');

  if (id && labels.forIds.has(id)) {
    return true;
  }

  return labels.spans.some(
    (span) =>
      span.start <= container.start.offset &&
      span.end >= container.end.offset &&
      !(span.start === container.start.offset && span.end === container.end.offset),
  );
};
