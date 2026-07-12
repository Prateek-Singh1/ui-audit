/**
 * Built-in categories used to organize ui-audit rules.
 */
export enum RuleCategory {
  Accessibility = 'Accessibility',
  Performance = 'Performance',
  React = 'React',
  NextJS = 'NextJS',
  TypeScript = 'TypeScript',
  JavaScript = 'JavaScript',
  Security = 'Security',
  Maintainability = 'Maintainability',
  BestPractices = 'BestPractices',
  Style = 'Style',
}

/**
 * Complete list of built-in rule categories.
 */
export const RULE_CATEGORIES = [
  RuleCategory.Accessibility,
  RuleCategory.Performance,
  RuleCategory.React,
  RuleCategory.NextJS,
  RuleCategory.TypeScript,
  RuleCategory.JavaScript,
  RuleCategory.Security,
  RuleCategory.Maintainability,
  RuleCategory.BestPractices,
  RuleCategory.Style,
] as const;
