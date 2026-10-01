/**
 * Money and quantity arithmetic on integers only.
 *
 * - Amounts are integer euro cents.
 * - Quantities are integer thousandths ("milli"), so up to 3 decimals are exact.
 * - Every division rounds half-up (away from zero; all values are non-negative).
 *
 * Intermediate products use BigInt, so qty × price cannot lose precision even
 * when it exceeds Number.MAX_SAFE_INTEGER.
 */

/** Largest amount the XSD AmountType allows (totalDigits 15, fractionDigits 2), in cents. */
export const MAX_AMOUNT_CENTS = 999_999_999_999_999;

export const QUANTITY_SCALE = 1000;

/** round_half_up(a × b / divisor) for non-negative safe integers. */
export function mulDivRoundHalfUp(a: number, b: number, divisor: number): number {
  assertNonNegativeInteger(a, 'a');
  assertNonNegativeInteger(b, 'b');
  if (!Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new RangeError(`divisor must be a positive integer, got ${divisor}`);
  }
  const numerator = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  const result = (2n * numerator + d) / (2n * d);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('result exceeds Number.MAX_SAFE_INTEGER');
  }
  return Number(result);
}

/**
 * Converts a quantity with at most 3 decimals to integer thousandths.
 * Returns null when the value has more precision than that, or is not finite.
 */
export function quantityToMilli(quantity: number): number | null {
  if (!Number.isFinite(quantity)) return null;
  const scaled = quantity * QUANTITY_SCALE;
  const milli = Math.round(scaled);
  // Tolerance absorbs binary noise (1.005 * 1000 = 1004.9999999999999) while
  // still rejecting a real fourth decimal (1.0005 * 1000 = 1000.5).
  if (Math.abs(scaled - milli) > 1e-6 || !Number.isSafeInteger(milli)) return null;
  return milli;
}

export function milliToQuantity(milli: number): number {
  return milli / QUANTITY_SCALE;
}

/** Cents → XSD decimal string with exactly two fraction digits ("1234" → "12.34"). */
export function formatAmount(cents: number): string {
  assertNonNegativeInteger(cents, 'cents');
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${euros}.${rest.toString().padStart(2, '0')}`;
}

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a non-negative xs:decimal into an integer of 10^-scale units.
 * Like XSD's fractionDigits facet this looks at the value, not the spelling:
 * trailing zeros are ignored ("3.870" is 3.87), a real extra digit is not.
 */
function parseScaledDecimal(text: string, scale: number): number | null {
  const match = DECIMAL_PATTERN.exec(text);
  if (!match) return null;
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (fraction.length > scale) return null;
  const value = Number(match[1]) * 10 ** scale + Number(fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

/** xs:decimal with at most two significant fraction digits → cents. Null if invalid. */
export function parseAmount(text: string): number | null {
  const cents = parseScaledDecimal(text, 2);
  return cents !== null && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** Thousandths → shortest decimal string ("500" → "0.5", "2000" → "2"). */
export function formatQuantity(milli: number): string {
  assertNonNegativeInteger(milli, 'milli');
  const whole = Math.floor(milli / QUANTITY_SCALE);
  const fraction = (milli % QUANTITY_SCALE).toString().padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

/** xs:decimal with at most three significant fraction digits → thousandths. Null if invalid. */
export function parseQuantity(text: string): number | null {
  return parseScaledDecimal(text, 3);
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, got ${value}`);
  }
}
