# Rule Catalog

Built-in rules shipped with ui-audit, grouped by category. Every rule runs on
the normalized AST, reports precise `file:line:column` locations, and can be
configured (including disabled) per rule in `ui-audit.config.ts`.

| Category | Rules | Reference |
|---|---|---|
| React | 25 | [react.md](./react.md) |
| Accessibility (`a11y`) | 10 | [accessibility.md](./accessibility.md) |

## Severities

`info` · `warning` · `error` · `critical`

Configure per rule:

```ts
import { defineConfig } from 'ui-audit';

export default defineConfig({
  rules: {
    'a11y/img-alt': 'error',
    'react/no-console-in-jsx': 'off',
  },
});
```
