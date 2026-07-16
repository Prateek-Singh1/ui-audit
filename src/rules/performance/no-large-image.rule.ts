import type { Finding, RuleResult } from '../../core/index.js';
import type { NormalizedAstNode } from '../../parser/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import { collectJsxElements, getAttributeStringValue, nodeLocation } from '../react/jsx-helpers.js';
import { readPositiveInteger, readStringArray } from './perf-helpers.js';

const DEFAULT_MAX_DATA_URI_BYTES = 8192;
const DEFAULT_DISALLOWED_FORMATS = ['bmp', 'tiff', 'tif'] as const;
const DATA_URI_IMAGE = /^data:image\/[a-z.+-]+;base64,([\s\S]*)$/i;

/**
 * Flags `<img>` elements that reference oversized or unoptimized assets: inline
 * base64 data URIs whose decoded size exceeds `maxDataUriBytes` (default
 * {@link DEFAULT_MAX_DATA_URI_BYTES}) and references to heavyweight raw formats
 * listed in `disallowedFormats` (default {@link DEFAULT_DISALLOWED_FORMATS}).
 */
export class NoLargeImageRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'perf/no-large-image',
        name: 'No large image',
        description:
          'Flags <img> elements using oversized inline data URIs or unoptimized raw image formats.',
        category: RuleCategory.Performance,
        severity: RuleSeverity.Warning,
        recommended: false,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/performance.md#perfno-large-image',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const maxDataUriBytes = readPositiveInteger(
      context.config.maxDataUriBytes,
      DEFAULT_MAX_DATA_URI_BYTES,
    );
    const disallowedFormats = readStringArray(
      context.config.disallowedFormats,
      DEFAULT_DISALLOWED_FORMATS,
    ).map((format) => format.toLowerCase());

    const findings: Finding[] = [];

    for (const element of collectJsxElements(context.ast, context.ast.root)) {
      if (element.tag !== 'img') {
        continue;
      }

      const src = getAttributeStringValue(context.ast, element.header, 'src');

      if (src === undefined || src.length === 0) {
        continue;
      }

      const finding = this.evaluateSrc(context, element.container, src, maxDataUriBytes, disallowedFormats);

      if (finding) {
        findings.push(finding);
      }
    }

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private evaluateSrc(
    context: RuleContext,
    node: NormalizedAstNode,
    src: string,
    maxDataUriBytes: number,
    disallowedFormats: readonly string[],
  ): Finding | undefined {
    const dataUri = DATA_URI_IMAGE.exec(src.trim());

    if (dataUri) {
      const bytes = decodedByteLength(dataUri[1] ?? '');

      if (bytes > maxDataUriBytes) {
        return createFinding({
          context,
          ruleName: this.name,
          message: `Inline image data URI is ~${bytes} bytes (limit is ${maxDataUriBytes}).`,
          location: nodeLocation(context.sourceFile.relativePath, node),
          suggestion: 'Serve the image from an optimized file and reference it by URL.',
        });
      }

      return undefined;
    }

    const format = fileExtension(src);

    if (format && disallowedFormats.includes(format)) {
      return createFinding({
        context,
        ruleName: this.name,
        message: `Image "${src}" uses the unoptimized "${format}" format.`,
        location: nodeLocation(context.sourceFile.relativePath, node),
        suggestion: 'Compress or convert the image to WebP/AVIF.',
      });
    }

    return undefined;
  }
}

const decodedByteLength = (base64: string): number => {
  const normalized = base64.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

const fileExtension = (src: string): string | undefined => {
  const withoutQuery = src.split(/[?#]/)[0] ?? '';
  const lastDot = withoutQuery.lastIndexOf('.');
  return lastDot >= 0 ? withoutQuery.slice(lastDot + 1).toLowerCase() : undefined;
};
