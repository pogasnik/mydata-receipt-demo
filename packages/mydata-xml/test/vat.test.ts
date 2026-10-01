import { describe, expect, it } from 'vitest';
import { computeDocument, grossPricedLine, netPricedLine, vatBreakdown } from '../src/index.js';
import { isConsistentLine } from '../src/vat.js';
import { invoice, receipt, withLines } from './fixtures.js';

describe('gross-priced lines (11.1, VAT included)', () => {
  it('extracts VAT so that net + vat equals the shelf price', () => {
    // 2 × 2.40 = 4.80; net = 4.80 / 1.24 = 3.8709… → 3.87; vat = 0.93
    expect(grossPricedLine(2000, 240, 1)).toEqual({ grossCents: 480, netCents: 387, vatCents: 93 });
    // 15.00 / 1.06 = 14.1509… → 14.15
    expect(grossPricedLine(1000, 1500, 3)).toEqual({
      grossCents: 1500,
      netCents: 1415,
      vatCents: 85,
    });
    // 1.20 / 1.13 = 1.0619… → 1.06
    expect(grossPricedLine(1000, 120, 2)).toEqual({ grossCents: 120, netCents: 106, vatCents: 14 });
  });

  it('rounds qty × unit half-up at 0.005 (0.5 kg × 2.99 = 1.495 → 1.50)', () => {
    expect(grossPricedLine(500, 299, 2).grossCents).toBe(150);
    expect(grossPricedLine(500, 297, 2).grossCents).toBe(149); // 1.485 → 1.49
  });

  it('handles fractional quantities', () => {
    // 0.5 kg × 12.99 = 6.495 → 6.50; 6.50 / 1.13 = 5.752… → 5.75
    expect(grossPricedLine(500, 1299, 2)).toEqual({ grossCents: 650, netCents: 575, vatCents: 75 });
    // 0.333 × 3.00 = 0.999 → 1.00
    expect(grossPricedLine(333, 300, 1).grossCents).toBe(100);
  });

  it('puts the whole amount in net at 0%', () => {
    expect(grossPricedLine(1000, 999, 7)).toEqual({ grossCents: 999, netCents: 999, vatCents: 0 });
  });

  it('handles zero and one-cent lines', () => {
    expect(grossPricedLine(1000, 0, 1)).toEqual({ grossCents: 0, netCents: 0, vatCents: 0 });
    expect(grossPricedLine(1000, 1, 1)).toEqual({ grossCents: 1, netCents: 1, vatCents: 0 });
    expect(grossPricedLine(1000, 3, 1)).toEqual({ grossCents: 3, netCents: 2, vatCents: 1 });
  });
});

describe('net-priced lines (1.1, VAT added)', () => {
  it('rounds VAT half-up at exactly 0.005 (2.50 × 13% = 0.325 → 0.33)', () => {
    // Banker's rounding would give 0.32; a float implementation risks 0.32 too.
    expect(netPricedLine(1000, 250, 2)).toEqual({ netCents: 250, vatCents: 33, grossCents: 283 });
  });

  it('rounds VAT half-up at other rates too', () => {
    // 1.25 × 24% = 0.30 exactly; 0.75 × 6% = 0.045 → 0.05
    expect(netPricedLine(1000, 125, 1).vatCents).toBe(30);
    expect(netPricedLine(1000, 75, 3).vatCents).toBe(5);
  });

  it('rounds the net amount before computing VAT', () => {
    // 1.5 × 8.99 = 13.485 → 13.49; 13.49 × 13% = 1.7537 → 1.75
    expect(netPricedLine(1500, 899, 2)).toEqual({
      netCents: 1349,
      vatCents: 175,
      grossCents: 1524,
    });
  });

  it('adds no VAT at 0%', () => {
    expect(netPricedLine(1000, 1000, 7)).toEqual({ netCents: 1000, vatCents: 0, grossCents: 1000 });
  });
});

describe('document totals', () => {
  it('equal the sum of rounded lines', () => {
    const doc = computeDocument(receipt);
    const sum = (key: 'netCents' | 'vatCents' | 'grossCents') =>
      doc.lines.reduce((total, line) => total + line[key], 0);
    expect(doc.totals).toEqual({
      netCents: sum('netCents'),
      vatCents: sum('vatCents'),
      grossCents: sum('grossCents'),
    });
  });

  it('can differ from a total-level calculation, and the line sum wins', () => {
    // 3 × 0.05 at 13%, VAT included.
    // Per line: net = round(5 / 1.13 = 4.42) = 4, vat = 1  → document net 0.12, vat 0.03.
    // Rounding the total instead: round(15 / 1.13 = 13.27) = 13 → net 0.13, vat 0.02.
    const line = { name: 'Τσίχλα', quantity: 1, unitPriceCents: 5, vatCategory: 2 } as const;
    const doc = computeDocument(withLines(receipt, [line, line, line]));
    expect(doc.totals).toEqual({ netCents: 12, vatCents: 3, grossCents: 15 });
  });

  it('mixes VAT rates and groups them in the breakdown, highest rate first', () => {
    const doc = computeDocument(receipt);
    expect(vatBreakdown(doc.lines)).toEqual([
      { vatCategory: 1, ratePercent: 24, netCents: 387, vatCents: 93, grossCents: 480 },
      // Ψωμί 1.20 (net 1.06) + Τυρί 0.5 kg × 12.99 = 6.50 (net 5.75)
      { vatCategory: 2, ratePercent: 13, netCents: 681, vatCents: 89, grossCents: 770 },
      { vatCategory: 3, ratePercent: 6, netCents: 1415, vatCents: 85, grossCents: 1500 },
    ]);
    expect(doc.totals).toEqual({ netCents: 2483, vatCents: 267, grossCents: 2750 });
    expect(doc.payment.amountCents).toBe(2750);
  });

  it('computes invoice totals with VAT added per line', () => {
    const doc = computeDocument(invoice);
    expect(doc.lines.map((l) => [l.netCents, l.vatCents])).toEqual([
      [6450, 1548],
      [1000, 0],
      [1349, 175],
    ]);
    expect(doc.totals).toEqual({ netCents: 8799, vatCents: 1723, grossCents: 10522 });
  });
});

describe('isConsistentLine', () => {
  it('accepts pairs produced by the pricing rule and rejects others', () => {
    for (let gross = 0; gross <= 2000; gross += 7) {
      for (const category of [1, 2, 3, 7] as const) {
        const g = grossPricedLine(1000, gross, category);
        expect(isConsistentLine('gross', g.netCents, g.vatCents, category)).toBe(true);
        const n = netPricedLine(1000, gross, category);
        expect(isConsistentLine('net', n.netCents, n.vatCents, category)).toBe(true);
      }
    }
    expect(isConsistentLine('net', 250, 32, 2)).toBe(false);
    expect(isConsistentLine('gross', 387, 94, 1)).toBe(false);
  });
});
