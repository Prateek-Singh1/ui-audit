import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  getAttributeStringValue,
  hasSpreadAttribute,
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';

/**
 * Flags `<video>` elements without a captions `<track>`, which deaf and
 * hard-of-hearing users rely on.
 */
export class VideoCaptionRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/video-caption',
        name: 'Video caption',
        description: 'Requires a captions <track> on <video> elements.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yvideo-caption',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => element.tag === 'video')
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !this.hasCaptionsTrack(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: '<video> has no captions <track>.',
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add a <track kind="captions"> child to the video.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private hasCaptionsTrack(context: RuleContext, video: JsxElementInfo): boolean {
    return collectJsxElements(context.ast, video.container).some(
      (child) => child.tag === 'track' && getAttributeStringValue(context.ast, child.header, 'kind') === 'captions',
    );
  }
}
