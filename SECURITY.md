# Security Policy

## Supported Versions

The current development branch is the only supported version for security fixes. Please report vulnerabilities for the latest release line in this repository.

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately by opening a GitHub Security Advisory or by contacting the maintainers directly through a secure channel. Do not open a public issue for security issues.

Please include:
- a clear description of the vulnerability
- steps to reproduce
- affected versions
- any relevant proof of concept

We will acknowledge receipt as soon as possible and work toward a fix in coordination with the reporter.

## Security Principles

ui-audit is designed to be safe by default:
- ui-audit never executes project code.
- ui-audit performs static analysis only.
- ui-audit reads files without modifying them.
- Telemetry is disabled by default.
- AI features will always be opt-in.
- User code never leaves the machine unless explicitly configured by the user.
