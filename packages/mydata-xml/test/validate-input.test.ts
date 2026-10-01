import { describe, expect, it } from 'vitest';
import {
  buildInvoicesDocXml,
  computeDocument,
  MyDataInputError,
  validateInput,
  type DocumentInput,
} from '../src/index.js';
import { counterpart, invoice, receipt, withLines } from './fixtures.js';

/** Bypasses the static types to simulate untrusted / JavaScript callers. */
const loose = (input: object) => input as unknown as DocumentInput;
const paths = (input: DocumentInput) => validateInput(input).map((issue) => issue.path);

describe('validateInput', () => {
  it('accepts the fixtures', () => {
    expect(validateInput(receipt)).toEqual([]);
    expect(validateInput(invoice)).toEqual([]);
  });

  it('rejects unsupported document types early', () => {
    expect(paths(loose({ ...receipt, documentType: '2.1' }))).toEqual(['documentType']);
  });

  it('enforces counterpart rules per document type', () => {
    expect(paths(loose({ ...receipt, counterpart }))).toEqual(['counterpart']);
    expect(paths(loose({ ...invoice, counterpart: undefined }))).toEqual(['counterpart']);
    expect(
      paths(loose({ ...invoice, counterpart: { ...counterpart, address: undefined } })),
    ).toEqual(['counterpart.address']);
    expect(
      paths(
        loose({
          ...invoice,
          counterpart: {
            ...counterpart,
            vatNumber: '123',
            address: {
              street: 'x'.repeat(151),
              number: 'x'.repeat(21),
              postalCode: ' ',
              city: 'x'.repeat(151),
            },
          },
        }),
      ),
    ).toEqual([
      'counterpart.vatNumber',
      'counterpart.address.postalCode',
      'counterpart.address.city',
      'counterpart.address.street',
      'counterpart.address.number',
    ]);
  });

  it('validates the issuer', () => {
    expect(paths(loose({ ...receipt, issuer: undefined }))).toEqual(['issuer']);
    expect(
      paths(loose({ ...receipt, issuer: { vatNumber: '00000000A', country: 'CY', branch: -1 } })),
    ).toEqual(['issuer.vatNumber', 'issuer.country', 'issuer.branch']);
  });

  it('validates header fields', () => {
    expect(paths({ ...receipt, series: '', aa: 'x'.repeat(51) })).toEqual(['series', 'aa']);
    expect(paths({ ...receipt, series: 'A\u0007' })).toEqual(['series']);
    for (const issueDate of ['2026-02-30', '2026-13-01', '01/10/2026', '']) {
      expect(paths({ ...receipt, issueDate }), issueDate).toEqual(['issueDate']);
    }
    expect(paths({ ...receipt, issueDate: '2028-02-29' })).toEqual([]);
  });

  it('allows only the payment methods of the document type', () => {
    expect(paths(loose({ ...receipt, paymentMethod: 5 }))).toEqual(['paymentMethod']);
    expect(paths({ ...invoice, paymentMethod: 5 })).toEqual([]);
    expect(validateInput(loose({ ...receipt, paymentMethod: 5 }))[0]?.message).toContain(
      'allowed: 3, 7',
    );
  });

  it('requires at least one line', () => {
    expect(paths(withLines(receipt, []))).toEqual(['lines']);
    expect(paths(loose({ ...receipt, lines: undefined }))).toEqual(['lines']);
  });

  it('validates each line', () => {
    const lines = [
      { name: ' ', quantity: 0, unitPriceCents: -1, vatCategory: 1 },
      { name: 'x'.repeat(301), quantity: 1.0005, unitPriceCents: 1.5, vatCategory: 4 },
      { name: 'ok', quantity: 1, unitPriceCents: 100, vatCategory: 1, measurementUnit: 4 },
      { name: 'ok', quantity: Number.NaN, unitPriceCents: 100, vatCategory: 1 },
    ];
    expect(paths(loose({ ...receipt, lines }))).toEqual([
      'lines.0.name',
      'lines.0.quantity',
      'lines.0.unitPriceCents',
      'lines.1.name',
      'lines.1.quantity',
      'lines.1.unitPriceCents',
      'lines.1.vatCategory',
      'lines.2.measurementUnit',
      'lines.3.quantity',
    ]);
  });

  it('requires vatExemptionCategory 1–31 exactly at 0% VAT', () => {
    const line = { name: 'Βιβλίο', quantity: 1, unitPriceCents: 100 };
    const check = (extra: object) => paths(loose({ ...receipt, lines: [{ ...line, ...extra }] }));
    expect(check({ vatCategory: 7 })).toEqual(['lines.0.vatExemptionCategory']);
    expect(check({ vatCategory: 7, vatExemptionCategory: 0 })).toEqual([
      'lines.0.vatExemptionCategory',
    ]);
    expect(check({ vatCategory: 7, vatExemptionCategory: 32 })).toEqual([
      'lines.0.vatExemptionCategory',
    ]);
    expect(check({ vatCategory: 7, vatExemptionCategory: 1.5 })).toEqual([
      'lines.0.vatExemptionCategory',
    ]);
    expect(check({ vatCategory: 7, vatExemptionCategory: 31 })).toEqual([]);
    expect(check({ vatCategory: 1, vatExemptionCategory: 3 })).toEqual([
      'lines.0.vatExemptionCategory',
    ]);
  });

  it('rejects documents whose total exceeds the XSD amount limit', () => {
    const huge = {
      name: 'x',
      quantity: 1,
      unitPriceCents: 600_000_000_000_000,
      vatCategory: 1,
    } as const;
    expect(paths(withLines(receipt, [huge, huge]))).toEqual(['lines']);
    const overflow = { ...huge, quantity: 1_000_000_000, unitPriceCents: Number.MAX_SAFE_INTEGER };
    expect(paths(withLines(receipt, [overflow]))).toEqual(['lines']);
  });
});

describe('computeDocument / buildInvoicesDocXml', () => {
  it('throw MyDataInputError listing every issue', () => {
    const bad = loose({ ...receipt, series: '', paymentMethod: 5 });
    expect(() => computeDocument(bad)).toThrow(MyDataInputError);
    try {
      buildInvoicesDocXml(bad);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MyDataInputError);
      expect((error as MyDataInputError).issues.map((i) => i.path)).toEqual([
        'series',
        'paymentMethod',
      ]);
      expect((error as Error).message).toContain('- series: required');
    }
  });

  it('trims text fields and defaults the measurement unit to pieces', () => {
    const doc = computeDocument({
      ...receipt,
      series: ' A ',
      lines: [{ name: '  Espresso ', quantity: 1, unitPriceCents: 240, vatCategory: 1 }],
    });
    expect(doc.series).toBe('A');
    expect(doc.lines[0]).toMatchObject({ description: 'Espresso', measurementUnit: 1 });
  });

  it('omits empty optional address parts', () => {
    const doc = computeDocument({
      ...invoice,
      counterpart: { ...counterpart, address: { street: ' ', postalCode: '00000', city: 'Πόλη' } },
    });
    expect(doc.counterpart?.address).toEqual({ postalCode: '00000', city: 'Πόλη' });
  });
});
