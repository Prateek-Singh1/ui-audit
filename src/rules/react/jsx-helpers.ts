import type { SourceLocation } from '../../core/index.js';
import type { NormalizedAstDocument, NormalizedAstNode } from '../../parser/index.js';
import { findAstNodes, getAstNodeText } from '../helpers.js';

/**
 * Shared AST helpers for the built-in React rules.
 *
 * These functions traverse the normalized AST to locate and scope specific node
 * kinds (attributes, expressions, elements) so rules can reason structurally
 * rather than scanning raw source text.
 */

const TOKEN_KIND = /Token$|Punctuation$|Keyword$/;

/** Whether a node kind represents a syntactic token rather than a real node. */
export const isTokenLike = (kind: string): boolean => TOKEN_KIND.test(kind);

/** Finds every node whose kind is one of the supplied kinds. */
export const findNodesByKinds = (
  root: NormalizedAstNode,
  kinds: readonly string[],
): readonly NormalizedAstNode[] => {
  const set = new Set(kinds);
  return findAstNodes(root, (node) => set.has(node.kind));
};

/** Returns the first child of the given kind, if any. */
export const firstChildOfKind = (
  node: NormalizedAstNode,
  kind: string,
): NormalizedAstNode | undefined => {
  return node.children.find((child) => child.kind === kind);
};

/** Returns the first non-token child, i.e. the meaningful expression node. */
export const firstExpressionChild = (node: NormalizedAstNode): NormalizedAstNode | undefined => {
  return node.children.find((child) => !isTokenLike(child.kind));
};

/**
 * Returns a node's children with one level of `SyntaxList` unwrapped.
 *
 * The normalized AST groups list-structured children (JSX children, attribute
 * lists) under an intermediate `SyntaxList` node; flattening it lets callers
 * inspect the logical direct children.
 */
export const flattenListChildren = (node: NormalizedAstNode): readonly NormalizedAstNode[] => {
  return node.children.flatMap((child) =>
    child.kind === 'SyntaxList' ? child.children : [child],
  );
};

/** Reads the name of a JsxAttribute node (its leading identifier). */
export const getJsxAttributeName = (
  ast: NormalizedAstDocument,
  attribute: NormalizedAstNode,
): string => {
  const identifier = attribute.children.find((child) => child.kind === 'Identifier');
  return identifier ? getAstNodeText(ast, identifier) : '';
};

/**
 * Returns the value expression of a JsxAttribute: the expression inside a
 * `{...}` container, or a string literal, or undefined for boolean attributes.
 */
export const getJsxAttributeValue = (
  attribute: NormalizedAstNode,
): NormalizedAstNode | undefined => {
  const expression = attribute.children.find((child) => child.kind === 'JsxExpression');

  if (expression) {
    return firstExpressionChild(expression);
  }

  return attribute.children.find((child) => child.kind === 'StringLiteral');
};

/** Returns the JsxAttribute nodes declared on an opening/self-closing element. */
export const getJsxAttributes = (element: NormalizedAstNode): readonly NormalizedAstNode[] => {
  const attributes = element.children.find((child) => child.kind === 'JsxAttributes');
  return attributes
    ? flattenListChildren(attributes).filter((child) => child.kind === 'JsxAttribute')
    : [];
};

/** Reads the tag name of an opening or self-closing JSX element. */
export const getJsxTagName = (
  ast: NormalizedAstDocument,
  element: NormalizedAstNode,
): string => {
  const tag = element.children.find(
    (child) => child.kind === 'Identifier' || child.kind === 'PropertyAccessExpression',
  );
  return tag ? getAstNodeText(ast, tag) : '';
};

const JSX_CHILD_KINDS = new Set([
  'JsxElement',
  'JsxSelfClosingElement',
  'JsxFragment',
  'JsxExpression',
]);

/** Returns the substantive JSX children of an element or fragment. */
export const getJsxChildren = (element: NormalizedAstNode): readonly NormalizedAstNode[] => {
  return flattenListChildren(element).filter((child) => JSX_CHILD_KINDS.has(child.kind));
};

/** Node kinds that represent a JSX element or fragment. */
export const JSX_ELEMENT_KINDS = ['JsxElement', 'JsxSelfClosingElement', 'JsxFragment'] as const;

/** Node kinds that represent a function that may be a component. */
export const FUNCTION_KINDS = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction'] as const;

/** Returns the source text of a call expression's callee (the invoked target). */
export const getCallCalleeText = (
  ast: NormalizedAstDocument,
  call: NormalizedAstNode,
): string => {
  const callee = firstExpressionChild(call);
  return callee ? getAstNodeText(ast, callee) : '';
};

/** Returns the argument nodes of a call expression. */
export const getCallArguments = (call: NormalizedAstNode): readonly NormalizedAstNode[] => {
  const list = call.children.find((child) => child.kind === 'SyntaxList');
  return list ? list.children.filter((child) => !isTokenLike(child.kind)) : [];
};

/** Whether a node contains at least one JSX element or fragment. */
export const containsJsx = (node: NormalizedAstNode): boolean => {
  return findNodesByKinds(node, JSX_ELEMENT_KINDS).length > 0;
};

/**
 * Returns the outermost JSX nodes in a tree (those not contained within another
 * JSX node), so callers can reason about complete JSX trees exactly once.
 */
export const findJsxRoots = (root: NormalizedAstNode): readonly NormalizedAstNode[] => {
  const all = findNodesByKinds(root, JSX_ELEMENT_KINDS);
  return all.filter(
    (node) =>
      !all.some(
        (other) =>
          other !== node &&
          other.start.offset <= node.start.offset &&
          other.end.offset >= node.end.offset,
      ),
  );
};

/** Builds a source location for a finding from a node's start position. */
export const nodeLocation = (relativePath: string, node: NormalizedAstNode): SourceLocation => {
  return {
    file: relativePath,
    line: node.start.line,
    column: node.start.column,
  };
};
