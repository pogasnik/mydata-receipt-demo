import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatQuantity,
  MAX_AMOUNT_CENTS,
  mulDivRoundHalfUp,
  parseAmount,
  parseQuantity,
  quantityToMilli,
} from '../src/money.js';

describe('mulDivRoundHalfUp', () => {
  it('rounds exact halves up', () => {
    expect(mulDivRoundHalfUp(1, 1, 2)).toBe(1); // 0.5 → 1
    expect(mulDivRoundHalfUp(3, 1, 2)).toBe(2); // 1.5 → 2
    expect(mulDivRoundHalfUp(5, 1, 2)).toBe(3); // 2.5 → 3 (banker's rounding would give 2)
  });

  it('rounds below half down and above half up', () => {
    expect(mulDivRoundHalfUp(1, 1, 3)).toBe(0); // 0.333…
    expect(mulDivRoundHalfUp(2, 1, 3)).toBe(1); // 0.666…
    expect(mulDivRoundHalfUp(1499, 1, 1000)).toBe(1);
    expect(mulDivRoundHalfUp(1500, 1, 1000)).toBe(2);
  });

  it('does not lose precision when the product exceeds 2^53', () => {
    // 9_000_000_000 milli × 1_000_001 cents / 1000 = 9_000_009_000_000 cents exactly
    expect(mulDivRoundHalfUp(9_000_000_000, 1_000_001, 1000)).toBe(9_000_009_000_000);
  });

  it('rejects negative, fractional and unsafe inputs', () => {
    expect(() => mulDivRoundHalfUp(-1, 1, 1)).toThrow(RangeError);
    expect(() => mulDivRoundHalfUp(1.5, 1, 1)).toThrow(RangeError);
    expect(() => mulDivRoundHalfUp(1, 1, 0)).toThrow(RangeError);
    expect(() => mulDivRoundHalfUp(Number.MAX_SAFE_INTEGER, 4, 1)).toThrow(RangeError);
  });
});

describe('quantityToMilli', () => {
  it('converts up to three decimals exactly, despite binary floating point', () => {
    expect(quantityToMilli(0.5)).toBe(500);
    expect(quantityToMilli(1.005)).toBe(1005); // 1.005 * 1000 === 1004.9999999999999
    expect(quantityToMilli(0.001)).toBe(1);
    expect(quantityToMilli(2)).toBe(2000);
  });

  it('rejects a fourth decimal and non-finite values', () => {
    expect(quantityToMilli(1.0005)).toBeNull();
    expect(quantityToMilli(0.0001)).toBeNull();
    expect(quantityToMilli(Number.NaN)).toBeNull();
    expect(quantityToMilli(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('amount strings', () => {
  it('formats cents with exactly two decimals', () => {
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount(5)).toBe('0.05');
    expect(formatAmount(1234)).toBe('12.34');
    expect(formatAmount(MAX_AMOUNT_CENTS)).toBe('9999999999999.99');
    expect(() => formatAmount(-1)).toThrow(RangeError);
  });

  it('parses XSD decimals with up to two fraction digits', () => {
    expect(parseAmount('12.34')).toBe(1234);
    expect(parseAmount('12.3')).toBe(1230);
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('0.05')).toBe(5);
    // Same value semantics as the XSD fractionDigits facet: trailing zeros are fine.
    expect(parseAmount('3.870')).toBe(387);
    expect(parseAmount('3.')).toBeNull();
  });

  it('rejects malformed, negative, over-precise and oversized amounts', () => {
    for (const text of ['', '-1.00', '1.234', '1,00', '1e3', ' 1.00', '.50', '10000000000000.00']) {
      expect(parseAmount(text), text).toBeNull();
    }
  });
});

describe('quantity strings', () => {
  it('formats the shortest decimal', () => {
    expect(formatQuantity(500)).toBe('0.5');
    expect(formatQuantity(2000)).toBe('2');
    expect(formatQuantity(1250)).toBe('1.25');
    expect(formatQuantity(1)).toBe('0.001');
  });

  it('parses up to three decimals', () => {
    expect(parseQuantity('0.5')).toBe(500);
    expect(parseQuantity('2')).toBe(2000);
    expect(parseQuantity('1.005')).toBe(1005);
    expect(parseQuantity('1.0005')).toBeNull();
    expect(parseQuantity('1.5000')).toBe(1500);
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('99999999999999999')).toBeNull();
  });
});
