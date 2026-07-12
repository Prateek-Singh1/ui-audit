import { RULE_CATEGORIES, type RuleCategory } from './categories.js';
import { RULE_SEVERITIES, type RuleSeverity } from './severity.js';

/**
 * Metadata used to define a ui-audit rule.
 */
export interface RuleMetadata {
  /** Stable rule identifier, usually namespaced by package or domain. */
  readonly id: string;
  /** Human-readable rule name. */
  readonly name: string;
  /** Explanation of what the rule checks. */
  readonly description: string;
  /** Category used for grouping rules. */
  readonly category: RuleCategory;
  /** Default severity emitted by the rule. */
  readonly severity: RuleSeverity;
  /** Whether the rule belongs to the recommended default set. */
  readonly recommended: boolean;
  /** Whether the rule should run by default when available. */
  readonly enabledByDefault: boolean;
  /** Optional documentation URL for users and maintainers. */
  readonly documentationUrl?: string;
}

/**
 * Structured metadata validation issue.
 */
export interface RuleMetadataValidationIssue {
  /** Metadata field that failed validation. */
  readonly field: keyof RuleMetadata;
  /** Human-readable validation message. */
  readonly message: string;
}

/**
 * Result returned when validating rule metadata.
 */
export interface RuleMetadataValidationResult {
  /** Whether metadata is valid. */
  readonly valid: boolean;
  /** Validation issues, empty when valid. */
  readonly issues: readonly RuleMetadataValidationIssue[];
}

/**
 * Creates a typed rule metadata object.
 */
export const defineRuleMetadata = (metadata: RuleMetadata): RuleMetadata => {
  return metadata;
};

/**
 * Validates rule metadata without throwing.
 */
export const validateRuleMetadata = (
  metadata: RuleMetadata,
): RuleMetadataValidationResult => {
  const issues: RuleMetadataValidationIssue[] = [];

  validateNonEmpty(metadata.id, 'id', issues);
  validateNonEmpty(metadata.name, 'name', issues);
  validateNonEmpty(metadata.description, 'description', issues);

  if (!RULE_CATEGORIES.includes(metadata.category)) {
    issues.push({
      field: 'category',
      message: `Rule category "${metadata.category}" is not supported.`,
    });
  }

  if (!RULE_SEVERITIES.includes(metadata.severity)) {
    issues.push({
      field: 'severity',
      message: `Rule severity "${metadata.severity}" is not supported.`,
    });
  }

  if (metadata.documentationUrl !== undefined && !isValidDocumentationUrl(metadata.documentationUrl)) {
    issues.push({
      field: 'documentationUrl',
      message: 'Rule documentationUrl must be an absolute http or https URL.',
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

/**
 * Converts SDK metadata into the public core rule definition shape.
 */
export const toCoreRuleDefinition = (metadata: RuleMetadata) => {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    severity: metadata.severity,
    enabledByDefault: metadata.enabledByDefault,
    ...(metadata.documentationUrl ? { docsUrl: metadata.documentationUrl } : {}),
    tags: metadata.recommended ? ['recommended'] : [],
  };
};

const validateNonEmpty = (
  value: string,
  field: keyof RuleMetadata,
  issues: RuleMetadataValidationIssue[],
): void => {
  if (value.trim().length === 0) {
    issues.push({
      field,
      message: `Rule ${field} must be a non-empty string.`,
    });
  }
};

const isValidDocumentationUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};
