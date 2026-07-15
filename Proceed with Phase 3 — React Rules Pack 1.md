Proceed with Phase 3 — React Rules Pack 1.

Objective

Expand ui-audit by implementing the next set of production-ready React rules using the existing Rule SDK.

The architecture, pipeline, reporters, CLI and Rule Engine are complete.

Do NOT modify any infrastructure.

Only add new rules and their tests.

====================================================

Create

====================================================

src/rules/react/

Implement the following rules:

1. react/no-array-index-key

Detect:

key={index}

Severity:
Warning

Suggestion:
Use a stable unique identifier instead of the array index.

----------------------------------------------------

2. react/no-dangerously-set-inner-html

Detect:

dangerouslySetInnerHTML

Severity:
Error

Suggestion:
Avoid injecting raw HTML unless absolutely necessary.

----------------------------------------------------

3. react/no-inline-object-props

Detect object literals passed directly as props.

Example:

<Component options={{ a: 1 }} />

Severity:
Info

Suggestion:
Extract object into a constant or memoize it.

----------------------------------------------------

4. react/no-inline-array-props

Detect:

<Component items={[1,2,3]} />

Severity:
Info

Suggestion:
Extract array into a constant.

----------------------------------------------------

5. react/no-anonymous-default-export

Detect:

export default () => { ... }

Severity:
Warning

Suggestion:
Use a named component.

----------------------------------------------------

6. react/max-props

Warn if a component receives more than 10 props.

Severity:
Warning

Suggestion:
Split the component or use composition.

----------------------------------------------------

7. react/no-console-in-jsx

Detect console.log calls directly inside JSX.

Severity:
Info

----------------------------------------------------

8. react/no-hardcoded-colors

Detect:

style={{ color: "red" }}

Severity:
Info

Suggestion:
Use design tokens or CSS variables.

----------------------------------------------------

9. react/prefer-fragment

Detect:

<div>
  ...
</div>

where a Fragment could be used without changing layout.

Severity:
Info

----------------------------------------------------

10. react/no-empty-fragment

Detect:

<></>

Severity:
Warning

Suggestion:
Remove unnecessary fragments.

====================================================

Requirements

====================================================

Use the existing Rule SDK.

Reuse parser utilities where possible.

No regex-only implementations when AST traversal is practical.

Each rule must provide:

- metadata
- documentation
- severity
- suggestion
- accurate location information

====================================================

Tests

====================================================

Add comprehensive Vitest coverage.

For every rule include:

- positive cases
- negative cases
- edge cases

Maintain deterministic behavior.

====================================================

Validation

Run:

npm test

npm run build

npm run lint

====================================================

Before finishing provide:

- Files created
- Files modified
- Rules implemented
- Sample findings
- Test results
- Build results
- Lint results

Wait for my approval before implementing React Rules Pack 2.