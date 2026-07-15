/**
 * Public barrel for the ui-audit pipeline orchestration layer.
 *
 * The pipeline layer composes the existing discovery, scanner, parser, and rule
 * engine subsystems into an end-to-end audit workflow. It depends on the stable
 * core, config, discovery, parser, and rule-engine contracts and does not modify
 * them.
 */
export * from './audit-pipeline.js';
export * from './default-registry.js';
export * from './resolve-config.js';
