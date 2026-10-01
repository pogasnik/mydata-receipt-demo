import type { DocumentInput, RetailReceiptInput, SalesInvoiceInput } from '../src/index.js';

/** Fictional parties only. 000000000 / 999999999 are not real ΑΦΜ. */
export const issuer = { vatNumber: '000000000', country: 'GR', branch: 0 } as const;

export const counterpart = {
  vatNumber: '999999999',
  country: 'GR',
  branch: 0,
  address: { street: 'Οδός Δοκιμής', number: '10', postalCode: '00000', city: 'Δειγματούπολη' },
} as const;

export const receipt: RetailReceiptInput = {
  documentType: '11.1',
  issuer,
  series: 'DEMO',
  aa: '1',
  issueDate: '2026-10-01',
  paymentMethod: 7,
  lines: [
    { name: 'Espresso', quantity: 2, unitPriceCents: 240, vatCategory: 1 },
    { name: 'Βιβλίο', quantity: 1, unitPriceCents: 1500, vatCategory: 3 },
    { name: 'Ψωμί', quantity: 1, unitPriceCents: 120, vatCategory: 2 },
    { name: 'Τυρί', quantity: 0.5, unitPriceCents: 1299, vatCategory: 2, measurementUnit: 2 },
  ],
};

export const invoice: SalesInvoiceInput = {
  documentType: '1.1',
  issuer,
  counterpart,
  series: 'ΤΠ',
  aa: '42',
  issueDate: '2026-10-01',
  paymentMethod: 5,
  lines: [
    { name: 'Χαρτί A4 (κιβώτιο)', quantity: 3, unitPriceCents: 2150, vatCategory: 1 },
    {
      name: 'Εξαγωγή <test> & "quotes"',
      quantity: 1,
      unitPriceCents: 1000,
      vatCategory: 7,
      vatExemptionCategory: 3,
    },
    { name: 'Ελαιόλαδο', quantity: 1.5, unitPriceCents: 899, vatCategory: 2, measurementUnit: 3 },
  ],
};

export function withLines<T extends DocumentInput>(base: T, lines: T['lines']): T {
  return { ...base, lines };
}
