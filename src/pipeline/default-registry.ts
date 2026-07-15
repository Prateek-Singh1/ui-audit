import { RuleRegistry } from '../core/index.js';
import type { Rule } from '../core/index.js';
import {
  InlineFunctionRule,
  InlineStyleRule,
  LargeComponentRule,
  MaxComponentLinesRule,
  MaxPropsRule,
  NestedTernaryRule,
  NoAnonymousDefaultExportRule,
  NoArrayIndexKeyRule,
  NoConsoleInJsxRule,
  NoDangerouslySetInnerHtmlRule,
  NoDirectStateMutationRule,
  NoDuplicatePropsRule,
  NoEmptyFragmentRule,
  NoHardcodedColorsRule,
  NoInlineArrayPropsRule,
  NoInlineObjectPropsRule,
  NoLargeJsxTreeRule,
  NoMultipleStateUpdatesRule,
  NoUnusedUseStateRule,
  NoUselessFragmentRule,
  PreferFragmentRule,
  PreferUseCallbackRule,
  PreferUseMemoRule,
  ReactKeyRule,
  UseEffectCleanupRule,
  AnchorValidRule,
  ButtonAccessibleNameRule,
  FormFieldNameRule,
  HtmlLangRule,
  ImgAltRule,
  InputLabelRule,
  NoAutofocusRule,
  NoPositiveTabindexRule,
  SvgTitleRule,
  VideoCaptionRule,
} from '../rules/index.js';

/**
 * Constructs fresh instances of every built-in audit rule shipped with
 * ui-audit.
 *
 * A new array of new instances is returned on each call so callers never share
 * rule state, and so multiple registries can be created independently.
 *
 * Sample rules (`AlwaysFailRule`, `AlwaysPassRule`, `NoOpRule`) are intentionally
 * excluded: they are demonstration/testing fixtures rather than real audit
 * checks.
 */
export const createBuiltInRules = (): Rule[] => {
  return [
    new ReactKeyRule(),
    new InlineFunctionRule(),
    new InlineStyleRule(),
    new LargeComponentRule(),
    new NestedTernaryRule(),
    new NoArrayIndexKeyRule(),
    new NoDangerouslySetInnerHtmlRule(),
    new NoInlineObjectPropsRule(),
    new NoInlineArrayPropsRule(),
    new NoAnonymousDefaultExportRule(),
    new MaxPropsRule(),
    new NoConsoleInJsxRule(),
    new NoHardcodedColorsRule(),
    new PreferFragmentRule(),
    new NoEmptyFragmentRule(),
    new NoUnusedUseStateRule(),
    new NoDirectStateMutationRule(),
    new NoMultipleStateUpdatesRule(),
    new UseEffectCleanupRule(),
    new NoLargeJsxTreeRule(),
    new MaxComponentLinesRule(),
    new PreferUseCallbackRule(),
    new PreferUseMemoRule(),
    new NoDuplicatePropsRule(),
    new NoUselessFragmentRule(),
    new ImgAltRule(),
    new ButtonAccessibleNameRule(),
    new InputLabelRule(),
    new AnchorValidRule(),
    new NoAutofocusRule(),
    new NoPositiveTabindexRule(),
    new HtmlLangRule(),
    new VideoCaptionRule(),
    new SvgTitleRule(),
    new FormFieldNameRule(),
  ];
};

/**
 * Creates a {@link RuleRegistry} pre-populated with all built-in audit rules.
 *
 * This assembles the default rule set without changing the RuleRegistry
 * implementation or introducing any plugin loading / dynamic discovery. Rules
 * are registered in a deterministic, stable order.
 */
export const createDefaultRegistry = (): RuleRegistry => {
  const registry = new RuleRegistry();

  for (const rule of createBuiltInRules()) {
    registry.registerRule(rule);
  }

  return registry;
};
