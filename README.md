# ui-audit

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![npm](https://img.shields.io/badge/npm-placeholder-lightgrey)

ui-audit is a CLI tool for auditing frontend projects from the command line. It focuses on surfacing UI, accessibility, and performance issues with clear, actionable output.

## Project Vision

ui-audit aims to become a trusted open-source companion for teams building modern web experiences with React, Next.js, Vue, HTML, and related stacks. The project is designed around static analysis, practical heuristics, and fast feedback loops that fit naturally into local development and CI.

## Why UI Audit CLI?

- Fast feedback for design and engineering teams
- Zero runtime execution of user project code
- Simple command-line workflows for local use and automation
- A foundation for future accessibility and performance reporting

## Planned Features

- Project scanning for common frontend patterns
- Accessibility checks with actionable guidance
- Performance heuristics and best-practice hints
- Framework-aware analysis for React, Next.js, Vue, and plain HTML
- CI-friendly output and machine-readable reporting

## Roadmap

- Phase 1: CLI scaffolding and repository maturity
- Phase 2: Static scanning for common UI and accessibility issues
- Phase 3: Performance-oriented findings and recommendations
- Phase 4: Richer reporting and framework-specific rules

## Development Setup

```bash
npm install
npm run build
npm run test
npx ui-audit audit
```

## Scripts

- `npm run dev` - run the CLI locally
- `npm run build` - bundle the project with tsup
- `npm run lint` - lint the TypeScript source
- `npm run format` - format the repository with Prettier
- `npm run test` - run the test suite
- `npm run audit:deps` - run dependency audit checks

## Security Principles

ui-audit never executes project code. It performs static analysis only, reads files without modifying them, and does not collect telemetry by default. Any future AI-assisted features will remain opt-in, and user code will never leave the machine unless the user explicitly configures a remote integration.

## Contributing

Contributions are welcome. Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request.

## Good First Issues

Look for issues labeled `good first issue` when contributing to the project. These are ideal starting points for new contributors.
