import { describe, expect, it } from 'vitest';
import { version } from '../src/index.js';
import type { AuditConfig, Rule } from '../src/core/index.js';

describe('core API exports', () => {
  it('exposes a package version and supports the core contract shapes', () => {
    expect(typeof version).toBe('string');

    const config: AuditConfig = {
      projectRoot: './example',
      rules: {
        sample: {
          enabled: true,
          severity: 'warning',
        },
      },
    };

    const rule: Rule = {
      id: 'sample-rule',
      name: 'Sample Rule',
      description: 'A sample rule contract',
      category: 'accessibility',
      severity: 'warning',
      evaluate: () => ({
        ruleId: 'sample-rule',
        status: 'passed',
        findings: [],
      }),
    };

    expect(config.projectRoot).toBe('./example');
    expect(rule.id).toBe('sample-rule');
  });
});
