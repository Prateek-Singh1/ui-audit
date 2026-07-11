#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { version } from './index.js';

const program = new Command();

program.name('ui-audit').description('Audit UI, accessibility, and performance issues').version(version);

program
  .command('audit')
  .description('Run the UI audit workflow')
  .action(() => {
    console.log(chalk.green('✔ UI Audit CLI'));
    console.log('Project scanning will be implemented soon.');
  });

program.parseAsync(process.argv);
