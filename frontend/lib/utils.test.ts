import { describe, expect, it } from 'vitest';
import { formatINR, formatRelative, initials } from './utils';

describe('formatINR', () => {
  it('uses Indian digit grouping without decimals', () => {
    expect(formatINR(1_25_000)).toBe('₹1,25,000');
    expect(formatINR(1_00_00_000)).toBe('₹1,00,00,000');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');

  it('describes past and future times', () => {
    expect(formatRelative('2026-01-01T11:57:00Z', now)).toBe('3 minutes ago');
    expect(formatRelative('2026-01-03T12:00:00Z', now)).toBe('in 2 days');
  });
});

describe('initials', () => {
  it('takes up to two initials', () => {
    expect(initials('Aarav Mehta')).toBe('AM');
    expect(initials('Diya')).toBe('D');
  });
});
