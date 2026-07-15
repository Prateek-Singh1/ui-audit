# React Rule Catalog

Built-in rules in the `react` category. Every rule reports accurate
`file:line:column` locations, a severity, and a remediation suggestion. All
rules run against the normalized AST (TS/TSX/JS/JSX).

Severities: `info`, `warning`, `error`, `critical`. Severities can be overridden
per rule (including `off`) in `ui-audit.config.ts`.

## Core rules

### react/missing-key
- **Severity:** warning
- Detects JSX returned from array `map` callbacks without a `key` prop.

### react/inline-function-prop
- **Severity:** info
- Detects inline callback functions passed directly to JSX props.

### react/inline-style
- **Severity:** info
- Detects JSX `style` props that use inline object literals.

### react/large-component
- **Severity:** warning
- Detects React components that exceed 300 lines.

### react/nested-ternary
- **Severity:** warning
- Detects nested conditional expressions in React source files.

## Pack 1

### react/no-array-index-key
- **Severity:** warning
- Flags list keys derived from an array index (`key={index}`).
- **Fix:** Use a stable unique identifier instead of the array index.

### react/no-dangerously-set-inner-html
- **Severity:** error
- Flags the `dangerouslySetInnerHTML` prop (XSS risk).
- **Fix:** Avoid injecting raw HTML unless absolutely necessary.

### react/no-inline-object-props
- **Severity:** info
- Flags object literals passed directly as JSX props (`options={{ a: 1 }}`).
- **Fix:** Extract the object into a constant or memoize it.

### react/no-inline-array-props
- **Severity:** info
- Flags array literals passed directly as JSX props (`items={[1, 2, 3]}`).
- **Fix:** Extract the array into a constant.

### react/no-anonymous-default-export
- **Severity:** warning
- Flags anonymous default exports (arrow, unnamed function/class, object).
- **Fix:** Use a named component.

### react/max-props
- **Severity:** warning
- Flags JSX elements that receive more than 10 props.
- **Fix:** Split the component or use composition.

### react/no-console-in-jsx
- **Severity:** info
- Flags `console.*` calls inside JSX expression containers.

### react/no-hardcoded-colors
- **Severity:** info
- Flags hardcoded color values (named/hex/rgb/hsl) in inline `style` objects.
- **Fix:** Use design tokens or CSS variables.

### react/prefer-fragment
- **Severity:** info
- Flags attribute-free `<div>` wrappers that only group multiple children.

### react/no-empty-fragment
- **Severity:** warning
- Flags empty fragments (`<></>`) that wrap no content.

## Pack 2

### react/no-unused-use-state
- **Severity:** warning
- Flags `useState` declarations whose value or setter is never referenced.
- **Fix:** Remove unused state or prefix intentionally unused names with `_`.

### react/no-direct-state-mutation
- **Severity:** error
- Flags nested property assignment (`state.user.name = …`) and in-place array
  mutation (`items.push(…)`). Ignores `this.*` and `ref.current` targets.
- **Fix:** Update state immutably (spread, `map`, `filter`, `concat`).

### react/no-multiple-state-updates
- **Severity:** info
- Flags two or more sequential state setter calls in the same block.
- **Fix:** Batch the updates or derive the next state in one setter call.

### react/use-effect-cleanup
- **Severity:** warning
- Flags `useEffect` hooks that add a subscription or timer but return no cleanup
  function.
- **Fix:** Return a cleanup function (remove listener, clear timer, unsubscribe).

### react/no-large-jsx-tree
- **Severity:** info
- Flags JSX trees whose element count exceeds a threshold.
- **Config:** `maxNodes` (default `40`).

### react/max-component-lines
- **Severity:** warning
- Flags component functions exceeding a configurable line limit. Only the
  outermost component is reported.
- **Config:** `maxLines` (default `150`).

### react/prefer-use-callback
- **Severity:** info
- Flags inline function callbacks passed as props to component elements
  (capitalized tags).
- **Fix:** Wrap the callback in `useCallback`.

### react/prefer-use-memo
- **Severity:** info
- Flags expensive object/array creation (object/array literals, `map`/`filter`/
  `reduce`/`flatMap`/`sort`/`concat`) performed during render inside a component.
- **Fix:** Wrap the computation in `useMemo`.

### react/no-duplicate-props
- **Severity:** error
- Flags JSX elements that declare the same prop more than once.
- **Fix:** Remove the duplicate; only the last value takes effect.

### react/no-useless-fragment
- **Severity:** info
- Flags fragments that wrap exactly one child. Empty fragments are covered by
  `react/no-empty-fragment`.
- **Fix:** Return the child directly.
