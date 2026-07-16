#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { version } from "./index.js";
import {
  AuditCommandError,
  REPORTER_NAMES,
  runAuditCommand,
} from "./cli/index.js";

const program = new Command();

program
  .name("ui-audit")
  .description("Audit UI, accessibility, and performance issues")
  .version(version);

program
  .command("audit")
  .description("Run the UI audit workflow")
  .argument("[path]", "project path to audit", ".")
  .option("--config <path>", "path to a ui-audit config file")
  .option(
    `--reporter <${REPORTER_NAMES.join("|")}>`,
    "reporter used to render results",
    "terminal",
  )
  .option(
    "--output <file>",
    "write the rendered report to a file instead of stdout",
  )
  .option(
    "--category <categories>",
    "only run rules in these comma-separated categories (react, accessibility, performance)",
  )
  .option(
    "--severity <severities>",
    "only report findings of these comma-separated severities (info, warning, error, critical)",
  )
  .option("--strict", "fail if any finding is produced")
  .option(
    "--fail-on-severity <severity>",
    "fail if a finding at or above this severity is produced",
  )
  .action(async (pathArg: string, options: Record<string, unknown>) => {
    try {
      const outcome = await runAuditCommand({
        path: pathArg,
        config: options.config as string | undefined,
        reporter: options.reporter as string | undefined,
        output: options.output as string | undefined,
        category: options.category as string | undefined,
        severity: options.severity as string | undefined,
        strict: options.strict as boolean | undefined,
        failOnSeverity: options.failOnSeverity as string | undefined,
      });

      for (const warning of outcome.warnings ?? []) {
        console.warn(chalk.yellow(`warning: ${warning}`));
      }
      console.log(outcome.stdout);
      process.exitCode = outcome.exitCode;
    } catch (error) {
      process.exitCode =
        error instanceof AuditCommandError ? error.exitCode : 1;
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
      // Surface the underlying cause (e.g. a config syntax error) so failures
      // are diagnosable rather than opaque.
      const cause =
        error instanceof Error ? (error.cause as unknown) : undefined;
      if (cause !== undefined) {
        console.error(
          chalk.dim(cause instanceof Error ? cause.message : String(cause)),
        );
      }
    }
  });

program.parseAsync(process.argv);
