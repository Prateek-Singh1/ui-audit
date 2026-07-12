import type { Rule, RuleResult } from '../core/index.js';
import type { RuleContext as CoreRuleContext } from '../core/index.js';
import type { RuleContext } from '../rule-engine/index.js';
import type { RuleMetadata } from './metadata.js';
import { toCoreRuleDefinition, validateRuleMetadata } from './metadata.js';

/**
 * Base class for authoring strongly typed ui-audit rules.
 */
export abstract class BaseRule implements Rule {
  /** SDK metadata used to describe this rule. */
  readonly metadata: RuleMetadata;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly severity: Rule['severity'];
  readonly enabledByDefault: boolean;
  readonly docsUrl?: string;
  readonly tags?: readonly string[];

  constructor(metadata: RuleMetadata) {
    const validation = validateRuleMetadata(metadata);

    if (!validation.valid) {
      const details = validation.issues
        .map((issue) => `${String(issue.field)}: ${issue.message}`)
        .join(' ');
      throw new Error(`Invalid rule metadata. ${details}`);
    }

    const definition = toCoreRuleDefinition(metadata);
    this.metadata = metadata;
    this.id = definition.id;
    this.name = definition.name;
    this.description = definition.description;
    this.category = definition.category;
    this.severity = definition.severity;
    this.enabledByDefault = definition.enabledByDefault;
    this.docsUrl = definition.docsUrl;
    this.tags = definition.tags;
  }

  /**
   * Executes this rule against a rule-engine context.
   */
  evaluate(context: CoreRuleContext): RuleResult | Promise<RuleResult> {
    return this.run(context as RuleContext);
  }

  /**
   * Rule-specific implementation supplied by subclasses.
   */
  protected abstract run(context: RuleContext): RuleResult | Promise<RuleResult>;
}
