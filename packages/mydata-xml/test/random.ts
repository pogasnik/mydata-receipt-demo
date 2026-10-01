import type { DocumentInput, LineInput } from '../src/index.js';
import { counterpart, issuer } from './fixtures.js';

/** Small deterministic PRNG (mulberry32) so failures are reproducible. */
export function rng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
  return { int, pick };
}

export function randomInput(seed: number): DocumentInput {
  const { int, pick } = rng(seed);
  const lines = Array.from({ length: int(1, 8) }, (_, i): LineInput => {
    const base = {
      name: `Είδος ${i + 1} & <${seed}>`,
      quantity: int(1, 20_000) / pick([1, 10, 100, 1000]),
      unitPriceCents: int(0, 500_000),
      measurementUnit: pick([1, 2, 3] as const),
    };
    const vatCategory = pick([1, 2, 3, 7] as const);
    return vatCategory === 7
      ? { ...base, vatCategory, vatExemptionCategory: int(1, 31) }
      : { ...base, vatCategory };
  });
  const common = {
    issuer,
    series: `S${int(1, 99)}`,
    aa: String(int(1, 99_999)),
    issueDate: '2026-10-01',
    lines,
  };
  return pick(['11.1', '1.1'] as const) === '11.1'
    ? { ...common, documentType: '11.1', paymentMethod: pick([3, 7] as const) }
    : { ...common, documentType: '1.1', counterpart, paymentMethod: pick([3, 5, 7] as const) };
}
