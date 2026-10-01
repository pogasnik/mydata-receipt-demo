import { VAT_CATEGORIES, type Pricing, type VatCategory } from './codes.js';
import { mulDivRoundHalfUp, QUANTITY_SCALE } from './money.js';

export interface LineAmounts {
  readonly netCents: number;
  readonly vatCents: number;
  readonly grossCents: number;
}

/**
 * VAT-inclusive pricing (retail receipt, 11.1):
 *   gross = round(qty × unit)
 *   net   = round(gross / (1 + rate))
 *   vat   = gross − net
 * VAT is taken by difference, so net + vat always equals the shelf total.
 */
export function grossPricedLine(
  quantityMilli: number,
  unitPriceCents: number,
  vatCategory: VatCategory,
): LineAmounts {
  const ratePercent = VAT_CATEGORIES[vatCategory].ratePercent;
  const grossCents = mulDivRoundHalfUp(quantityMilli, unitPriceCents, QUANTITY_SCALE);
  const netCents = mulDivRoundHalfUp(grossCents, 100, 100 + ratePercent);
  return { netCents, vatCents: grossCents - netCents, grossCents };
}

/**
 * Net pricing (sales invoice, 1.1):
 *   net   = round(qty × unit)
 *   vat   = round(net × rate)
 *   gross = net + vat
 */
export function netPricedLine(
  quantityMilli: number,
  unitPriceCents: number,
  vatCategory: VatCategory,
): LineAmounts {
  const ratePercent = VAT_CATEGORIES[vatCategory].ratePercent;
  const netCents = mulDivRoundHalfUp(quantityMilli, unitPriceCents, QUANTITY_SCALE);
  const vatCents = mulDivRoundHalfUp(netCents, ratePercent, 100);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

export function lineAmounts(
  pricing: Pricing,
  quantityMilli: number,
  unitPriceCents: number,
  vatCategory: VatCategory,
): LineAmounts {
  return pricing === 'gross'
    ? grossPricedLine(quantityMilli, unitPriceCents, vatCategory)
    : netPricedLine(quantityMilli, unitPriceCents, vatCategory);
}

/**
 * Whether a (net, vat) pair could have come from `pricing` at this VAT rate.
 * Used by the parser to reject XML whose VAT does not match the rounding rule.
 */
export function isConsistentLine(
  pricing: Pricing,
  netCents: number,
  vatCents: number,
  vatCategory: VatCategory,
): boolean {
  const ratePercent = VAT_CATEGORIES[vatCategory].ratePercent;
  if (pricing === 'net') return mulDivRoundHalfUp(netCents, ratePercent, 100) === vatCents;
  const grossCents = netCents + vatCents;
  return mulDivRoundHalfUp(grossCents, 100, 100 + ratePercent) === netCents;
}

/** Sums of rounded line amounts. Totals are never rounded again. */
export function sumAmounts(lines: readonly LineAmounts[]): LineAmounts {
  let netCents = 0;
  let vatCents = 0;
  for (const line of lines) {
    netCents += line.netCents;
    vatCents += line.vatCents;
  }
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

export interface VatBreakdownRow extends LineAmounts {
  readonly vatCategory: VatCategory;
  readonly ratePercent: number;
}

/** Per-rate totals, highest rate first, as printed in a receipt's VAT analysis. */
export function vatBreakdown(
  lines: readonly (LineAmounts & { readonly vatCategory: VatCategory })[],
): VatBreakdownRow[] {
  const byCategory = new Map<VatCategory, (typeof lines)[number][]>();
  for (const line of lines) {
    const group = byCategory.get(line.vatCategory) ?? [];
    group.push(line);
    byCategory.set(line.vatCategory, group);
  }
  return [...byCategory.entries()]
    .map(([vatCategory, group]) => ({
      vatCategory,
      ratePercent: VAT_CATEGORIES[vatCategory].ratePercent,
      ...sumAmounts(group),
    }))
    .sort((a, b) => b.ratePercent - a.ratePercent);
}
