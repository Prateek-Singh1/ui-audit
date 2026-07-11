import { describe, expect, it } from 'vitest';
import { RuleRegistry } from '../src/core/registry.js';
import type { Rule } from '../src/core/rule.js';

const createRule = (id: string): Rule => ({
  id,
  name: `Rule ${id}`,
  description: `Description for ${id}`,
  category: 'accessibility',
  severity: 'warning',
  evaluate: () => ({
    ruleId: id,
    status: 'passed',
    findings: [],
  }),
});

describe('RuleRegistry', () => {
  it('registers rules and preserves insertion order', () => {
    const registry = new RuleRegistry();
    const first = createRule('alpha');
    const second = createRule('beta');

    registry.register(first);
    registry.register(second);

    expect(registry.has('alpha')).toBe(true);
    expect(registry.get('beta')).toBe(second);
    expect(registry.list()).toEqual([first, second]);
  });

  it('prevents duplicate rule ids with a descriptive error', () => {
    const registry = new RuleRegistry();
    registry.register(createRule('alpha'));

    expect(() => registry.register(createRule('alpha'))).toThrowError(
      'Rule with id "alpha" is already registered.',
    );
  });

  it('unregisters and clears rules', () => {
    const registry = new RuleRegistry();
    registry.register(createRule('alpha'));
    registry.register(createRule('beta'));

    expect(registry.unregister('alpha')).toBe(true);
    expect(registry.has('alpha')).toBe(false);
    expect(registry.unregister('missing')).toBe(false);

    registry.clear();
    expect(registry.list()).toEqual([]);
  });
});
