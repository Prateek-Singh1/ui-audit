Proceed with Phase 3 — React Rules Pack 2.

Objective

Continue expanding ui-audit's production-ready React rule library.

The architecture, pipeline, CLI and reporters are complete.

Do NOT modify infrastructure, the pipeline, reporters, CLI or rule engine.

Only add new React rules, documentation and tests.

====================================================
Implement the following rules
====================================================

1. react/no-unused-use-state

Detect:

const [value, setValue] = useState()

where either value or setter is never used.

Severity:
Warning

Suggestion:
Remove unused state or rename intentionally unused variables.

----------------------------------------------------

2. react/no-direct-state-mutation

Detect direct mutation of state objects or arrays.

Examples:

state.user.name = "John"

items.push(...)

Severity:
Error

----------------------------------------------------

3. react/no-multiple-state-updates

Detect multiple sequential setState/useState setter calls that could be batched.

Severity:
Info

----------------------------------------------------

4. react/use-effect-cleanup

Detect useEffect subscriptions or timers without cleanup.

Severity:
Warning

----------------------------------------------------

5. react/no-large-jsx-tree

Warn when a JSX tree exceeds a configurable threshold.

Severity:
Info

----------------------------------------------------

6. react/max-component-lines

Detect components exceeding configurable line limits.

Severity:
Warning

----------------------------------------------------

7. react/prefer-use-callback

Detect inline callbacks repeatedly passed to memoized children.

Severity:
Info

----------------------------------------------------

8. react/prefer-use-memo

Detect expensive object or array creation during render.

Severity:
Info

----------------------------------------------------

9. react/no-duplicate-props

Detect duplicated JSX props.

Example:

<Button disabled disabled />

Severity:
Error

----------------------------------------------------

10. react/no-useless-fragment

Detect fragments wrapping exactly one child.

Severity:
Info

====================================================
Requirements
====================================================

- Continue using AST traversal.
- Reuse jsx-helpers where possible.
- Keep rules independent.
- Avoid duplicated traversal logic.
- Keep deterministic output.

====================================================
Tests
====================================================

Add comprehensive tests for every rule:

- positive cases
- negative cases
- edge cases
- nested JSX
- TypeScript TSX support

====================================================
Documentation
====================================================

Update the rule catalog/documentation with the new rules.

====================================================
Validation
====================================================

Run:

npm test
npm run build
npm run lint

====================================================
Before finishing provide:

- Rules implemented
- Files created
- Files modified
- Sample findings
- Test results
- Build results
- Lint results

Wait for my approval before moving to Accessibility Rules Pack 1.