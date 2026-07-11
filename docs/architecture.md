# Architecture

ui-audit is organized around a small set of focused layers:

- CLI entrypoints expose commands to end users
- Commands interpret user input and trigger analysis workflows
- Scanners inspect source files and collect findings
- Analyzers interpret results and normalize them into a consistent report model
- Reporters present results for terminal output or future integrations

The current repository intentionally keeps the implementation minimal while leaving room for future expansion.
