import type { RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult, getAstNodeText } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { findNodesByKinds, nodeLocation } from '../react/jsx-helpers.js';
import { readPositiveInteger, readStringArray } from './perf-helpers.js';

const DEFAULT_HEAVY_MODULES = [
  'lodash',
  'moment',
  'three',
  'chart.js',
  'd3',
  'rxjs',
  '@mui/material',
  'highcharts',
  'pdfjs-dist',
  'monaco-editor',
] as const;
const DEFAULT_MAX_NAMED_IMPORTS = 8;

/**
 * Flags large static imports that are good candidates for dynamic
 * `import()`-based code splitting: imports from heavyweight packages
 * (`heavyModules`) and imports pulling in more than `maxNamedImports` bindings.
 */
export class PreferLazyImportRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/prefer-lazy-import',
        name: 'Prefer lazy import',
        description: 'Flags large static imports that could be dynamically imported.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Info,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfprefer-lazy-import',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const heavyModules = readStringArray(context.config.heavyModules, DEFAULT_HEAVY_MODULES);
    const maxNamedImports = readPositiveInteger(
      context.config.maxNamedImports,
      DEFAULT_MAX_NAMED_IMPORTS,
    );

    const findings = findNodesByKinds(context.ast.root, ['ImportDeclaration'])
      .filter((node) => !isTypeOnlyImport(context, node))
      .map((node) => ({ node, reason: this.reason(context, node, heavyModules, maxNamedImports) }))
      .filter((entry): entry is { node: NormalizedAstNode; reason: string } => entry.reason !== undefined)
      .map(({ node, reason }) =>
        createFinding({
          context,
          ruleName: this.name,
          message: reason,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Load the module on demand with a dynamic import() (e.g. React.lazy).',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private reason(
    context: RuleContext,
    node: NormalizedAstNode,
    heavyModules: readonly string[],
    maxNamedImports: number,
  ): string | undefined {
    const moduleName = moduleSpecifier(context, node);

    if (moduleName && heavyModules.includes(moduleName)) {
      return `Static import of heavyweight module "${moduleName}".`;
    }

    const named = namedImportCount(node);

    if (named > maxNamedImports) {
      return `Static import pulls in ${named} named bindings (limit is ${maxNamedImports}).`;
    }

    return undefined;
  }
}

const isTypeOnlyImport = (context: RuleContext, node: NormalizedAstNode): boolean => {
  return /^import\s+type\b/.test(getAstNodeText(context.ast, node).trimStart());
};

const moduleSpecifier = (context: RuleContext, node: NormalizedAstNode): string | undefined => {
  const literal = node.children.find((child) => child.kind === 'StringLiteral');
  return literal ? getAstNodeText(context.ast, literal).replace(/^['"`]|['"`]$/g, '') : undefined;
};

const namedImportCount = (node: NormalizedAstNode): number => {
  const named = findNodesByKinds(node, ['NamedImports']);
  return named.length > 0 ? findNodesByKinds(named[0]!, ['ImportSpecifier']).length : 0;
};
