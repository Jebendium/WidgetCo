import { describe, it, expect } from 'vitest';
import { formatGBP, penceToPounds, poundsToPence } from './types.js';

describe('money helpers — integer pence everywhere', () => {
  it('converts pounds to integer pence with rounding', () => {
    expect(poundsToPence(14.5)).toBe(1450);
    expect(poundsToPence(0.005)).toBe(1);
    expect(poundsToPence(120_000)).toBe(12_000_000);
  });

  it('converts pence back to pounds', () => {
    expect(penceToPounds(1450)).toBe(14.5);
  });

  it('formats UK currency with grouping and two decimal places', () => {
    expect(formatGBP(1450)).toBe('£14.50');
    expect(formatGBP(123_456_789)).toBe('£1,234,567.89');
    expect(formatGBP(5)).toBe('£0.05');
    expect(formatGBP(-1450)).toBe('-£14.50');
    expect(formatGBP(0)).toBe('£0.00');
  });
});
