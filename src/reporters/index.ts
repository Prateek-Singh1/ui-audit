/**
 * Public barrel for ui-audit output reporters.
 *
 * Reporters consume the pipeline's AuditResult (and the core Reporter contract)
 * and render it in a specific output format. They depend on the stable core and
 * pipeline result types and never modify the pipeline or rule engine.
 */
export * from "./json-reporter.js";
export * from "./terminal-reporter.js";
export * from "./html-reporter.js";
