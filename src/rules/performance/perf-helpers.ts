import type { NormalizedAstDocument, NormalizedAstNode } from '../../parser/index.js';
import { getAstNodeText } from '../helpers.js';
import {
  findNodesByKinds,
  firstExpressionChild,
  flattenListChildren,
  getCallArguments,
} from '../react/jsx-helpers.js';

/**
 * Shared AST helpers for the built-in performance rules.
 *
 * These build on the normalized-AST traversal utilities in `helpers.ts` and the
 * JSX helpers, so performance rules reason structurally over a single shared
 * traversal implementation rather than re-scanning source text.
 */

/** Reads a positive-integer config value, falling back when absent or invalid. */
export const readPositiveInteger = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
};

/** Reads a string-array config value, falling back when absent or invalid. */
export const readStringArray = (
  value: unknown,
  fallback: readonly string[],
): readonly string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? (value as readonly string[])
    : fallback;
};

/** Number of source lines a node spans, inclusive of its first and last line. */
export const lineSpan = (node: NormalizedAstNode): number => {
  return node.end.line - node.start.line + 1;
};

const OBJECT_MEMBER_KINDS = new Set([
  'PropertyAssignment',
  'ShorthandPropertyAssignment',
  'SpreadAssignment',
  'MethodDeclaration',
  'GetAccessor',
  'SetAccessor',
]);

/** Counts the direct members declared on an object-literal node. */
export const countObjectProperties = (node: NormalizedAstNode): number => {
  return flattenListChildren(node).filter((child) => OBJECT_MEMBER_KINDS.has(child.kind)).length;
};

/** Counts the elements declared in an array-literal node (holes included). */
export const countArrayElements = (node: NormalizedAstNode): number => {
  const list = node.children.find((child) => child.kind === 'SyntaxList');
  return list ? list.children.filter((child) => child.kind !== 'CommaToken').length : 0;
};

/** Counts the `case`/`default` clauses inside a switch statement. */
export const countSwitchCases = (node: NormalizedAstNode): number => {
  const caseBlock = node.children.find((child) => child.kind === 'CaseBlock');

  if (!caseBlock) {
    return 0;
  }

  return flattenListChildren(caseBlock).filter(
    (child) => child.kind === 'CaseClause' || child.kind === 'DefaultClause',
  ).length;
};

/** Node kinds that represent a function literal (arrow or function expression). */
export const FUNCTION_LITERAL_KINDS = ['ArrowFunction', 'FunctionExpression'] as const;

/** Whether a node is a function literal that can appear inline. */
export const isFunctionLiteral = (node: NormalizedAstNode): boolean => {
  return (FUNCTION_LITERAL_KINDS as readonly string[]).includes(node.kind);
};

/** A regex pattern discovered in source, with the node that produced it. */
export interface RegexPattern {
  readonly node: NormalizedAstNode;
  readonly pattern: string;
}

/**
 * Collects regex patterns from `/.../ ` literals and `new RegExp('…')` /
 * `RegExp('…')` calls with a string-literal first argument.
 */
export const collectRegexPatterns = (
  ast: NormalizedAstDocument,
  root: NormalizedAstNode,
): readonly RegexPattern[] => {
  const patterns: RegexPattern[] = [];

  for (const node of findNodesByKinds(root, ['RegularExpressionLiteral'])) {
    patterns.push({ node, pattern: stripRegexLiteral(getAstNodeText(ast, node)) });
  }

  for (const node of findNodesByKinds(root, ['NewExpression', 'CallExpression'])) {
    const callee = firstExpressionChild(node);

    if (!callee || getAstNodeText(ast, callee) !== 'RegExp') {
      continue;
    }

    const firstArg = getCallArguments(node)[0];

    if (firstArg && firstArg.kind === 'StringLiteral') {
      patterns.push({ node, pattern: unquote(getAstNodeText(ast, firstArg)) });
    }
  }

  return patterns;
};

/**
 * Whether a regex pattern contains a nested quantifier — a repeated group whose
 * body itself repeats (e.g. `(a+)+`, `(a*)*`, `([a-z]+){2,}`). These are the
 * classic super-linear ReDoS shapes.
 */
export const isCatastrophicRegex = (pattern: string): boolean => {
  const repeatedGroup = /\(([^()]*)\)(?:[*+]|\{\d*,\d*\}|\{\d+,\})/g;
  const innerRepetition = /[*+]|\{\d*,/;

  let match: RegExpExecArray | null;

  while ((match = repeatedGroup.exec(pattern)) !== null) {
    if (innerRepetition.test(match[1] ?? '')) {
      return true;
    }
  }

  return false;
};

const stripRegexLiteral = (text: string): string => {
  const closing = text.lastIndexOf('/');
  return closing > 0 ? text.slice(1, closing) : text;
};

const unquote = (text: string): string => {
  return text.replace(/^['"`]|['"`]$/g, '');
};
