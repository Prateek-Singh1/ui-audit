import type { RuleResult } from '../../core/index.js';
import type { RuleContext } from '../../rule-engine/index.js';
import { BaseRule } from '../base-rule.js';
import { RuleCategory } from '../categories.js';
import { createFinding, createRuleResult } from '../helpers.js';
import { defineRuleMetadata } from '../metadata.js';
import { RuleSeverity } from '../severity.js';
import {
  collectJsxElements,
  hasSpreadAttribute,
  nodeLocation,
  type JsxElementInfo,
} from '../react/jsx-helpers.js';

const MEDIA_TAGS = new Set(['audio', 'video']);

/**
 * Flags `<audio>`/`<video>` media that provide no `<track>` for captions,
 * subtitles, or descriptions. For captions specifically on video, see
 * `a11y/video-caption`.
 */
export class AudioCaptionRule extends BaseRule {
  constructor() {
    super(
      defineRuleMetadata({
        id: 'a11y/audio-caption',
        name: 'Audio caption',
        description: 'Requires media elements to provide a text track.',
        category: RuleCategory.Accessibility,
        severity: RuleSeverity.Warning,
        recommended: true,
        enabledByDefault: true,
        documentationUrl:
          'https://github.com/Prateek-Singh1/ui-audit/blob/main/docs/rules/accessibility.md#a11yaudio-caption',
      }),
    );
  }

  protected run(context: RuleContext): RuleResult {
    const findings = collectJsxElements(context.ast, context.ast.root)
      .filter((element) => MEDIA_TAGS.has(element.tag))
      .filter((element) => !hasSpreadAttribute(element.header))
      .filter((element) => !this.hasTrack(context, element))
      .map((element) =>
        createFinding({
          context,
          ruleName: this.name,
          message: `<${element.tag}> provides no text track (captions, subtitles, or transcript).`,
          location: nodeLocation(context.sourceFile.relativePath, element.container),
          suggestion: 'Add a <track> element or provide an accessible transcript.',
        }),
      );

    return createRuleResult(this.metadata, findings.length > 0 ? 'failed' : 'passed', findings);
  }

  private hasTrack(context: RuleContext, media: JsxElementInfo): boolean {
    return collectJsxElements(context.ast, media.container).some((child) => child.tag === 'track');
  }
}
