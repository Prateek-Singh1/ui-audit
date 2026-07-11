# Architecture Decision Record

This document records the baseline architectural principles for ui-audit. It is
not a replacement for RFCs. RFCs document individual proposals and decisions;
this ADR describes the engineering posture that should guide those proposals.

## Status

Accepted

## Context

ui-audit is expected to grow from a small CLI into a production-grade developer
tool with a rule catalog, parser pipeline, reporter system, plugin ecosystem,
and optional AI-assisted capabilities. Without clear architectural constraints,
the codebase could become tightly coupled around early implementation choices.

The project therefore adopts a modular, interface-first architecture designed
for correctness, maintainability, performance, and contributor scale.

## Decision

ui-audit will be designed around the following principles.

## SOLID Principles

Subsystems should have clear responsibilities:

- Discovery discovers candidate files.
- Configuration resolves and validates user intent.
- Parsers produce structured representations.
- Rules evaluate structured context.
- Reporters render normalized results.
- Plugins extend through explicit contracts.

Code should be open to extension through public interfaces and closed to
uncontrolled mutation of internal pipeline behavior.

## Composition Over Inheritance

ui-audit should prefer small collaborating objects and functions over deep class
hierarchies. Rules, reporters, scanners, and plugins should satisfy interfaces
rather than inherit from required base classes.

Composition keeps extension points lightweight and avoids forcing plugin authors
into an implementation model that may not fit their use case.

## Dependency Inversion

High-level workflows should depend on abstractions rather than concrete
implementations. For example, discovery can depend on a filesystem interface,
and scanners can depend on a rule registry contract.

This improves testability, allows future runtime adapters, and prevents CLI
concerns from leaking into core logic.

## Framework Agnostic Architecture

The core must not be owned by any single frontend framework. React, Vue, HTML,
and future framework support should be implemented through parsers, adapters,
rules, or plugins that share common contracts where possible.

Framework-specific knowledge belongs at the edges of the system, not in the core
pipeline.

## Interface-First Design

Public contracts should be designed deliberately before broad implementation.
Stable interfaces allow contributors to build rules, reporters, and plugins with
confidence.

Interface-first design also makes review easier: maintainers can evaluate the
shape of the system before implementation details obscure architectural trade-
offs.

## Testability

Every core subsystem should be testable in isolation. Code should avoid global
state, uncontrolled process access, hidden filesystem dependencies, and
side-effect-heavy constructors.

Preferred patterns include:

- Dependency injection for filesystem and runtime boundaries.
- Pure validation functions where practical.
- Deterministic ordering for discovered files and registry contents.
- Structured errors that tests can assert without string parsing.

## Performance Considerations

ui-audit should be fast enough for local development and CI. Performance choices
should be made early in the pipeline:

- Ignore dependency and build output directories before parsing.
- Keep file discovery asynchronous.
- Avoid parsing files that configuration excludes.
- Preserve deterministic work ordering for reproducibility.
- Design future scanner stages for concurrency and cancellation.

Performance optimizations should not compromise correctness or observability.

## Security Considerations

ui-audit should avoid executing user application code during normal audits.
Configuration and plugin loading are trusted boundaries and must be treated with
care.

Security expectations include:

- Validate configuration before using it to drive later stages.
- Keep plugin loading explicit and opt-in.
- Avoid implicit network access in core audit workflows.
- Prefer structured data over evaluating arbitrary project behavior.
- Preserve clear error boundaries for filesystem, configuration, parser, rule,
  and reporter failures.

## Future Scalability

The architecture should support:

- Hundreds of rules without registry or execution sprawl.
- Multiple parser implementations and a unified internal model.
- Human-readable and machine-readable reporters.
- Community plugins with version-aware contracts.
- Monorepo and incremental audit workflows.
- Optional AI insights behind explicit configuration.

Scalability is not only runtime performance. It also includes contributor
scalability: new contributors should be able to understand where a change
belongs and which contract it affects.

## Consequences

This decision may make early development feel more deliberate than a single
end-to-end implementation. That cost is intentional. ui-audit is building a
platform, not a one-off script, and the architecture should preserve room for
future capabilities without rewriting the core.
