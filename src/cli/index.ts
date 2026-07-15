/**
 * Public barrel for the CLI command layer.
 *
 * The command layer orchestrates existing subsystems (config, pipeline,
 * reporters) into runnable commands. It contains no domain logic of its own.
 */
export * from './audit-command.js';
