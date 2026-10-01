import { describe, expect, it } from 'vitest';
import {
  describeIssue,
  initialState,
  issueLocation,
  parseDecimal,
  parseEuroCents,
  toDocumentInput,
  withDocumentType,
} from '@/lib/form-state';
import { greekUpperCase } from '@/lib/format';
import { tokenizeXml } from '@/lib/highlight-xml';

describe('form parsing', () => {
  it('accepts Greek and English decimal separators', () => {
    expect(parseDecimal('0,5')).toBe(0.5);
    expect(parseDecimal(' 2.25 ')).toBe(2.25);
    expect(parseDecimal('1,2,3')).toBeNaN();
    expect(parseDecimal('')).toBeNaN();
    expect(parseEuroCents('2,40')).toBe(240);
    expect(parseEuroCents('2.4')).toBe(240);
    expect(parseEuroCents('15')).toBe(1500);
    expect(parseEuroCents('2,345')).toBeNaN();
    expect(parseEuroCents('-1')).toBeNaN();
  });

  it('builds library input with the fixed fictional parties', () => {
    const receipt = toDocumentInput(initialState('2026-10-01'));
    expect(receipt).toMatchObject({ documentType: '11.1', issuer: { vatNumber: '000000000' } });
    expect(receipt.counterpart).toBeUndefined();
    const invoice = toDocumentInput(withDocumentType(initialState('2026-10-01'), '1.1'));
    expect(invoice.counterpart?.vatNumber).toBe('999999999');
  });

  it('drops "on credit" when switching back to a retail receipt', () => {
    const invoice = {
      ...withDocumentType(initialState('2026-10-01'), '1.1'),
      paymentMethod: 5 as const,
    };
    expect(withDocumentType(invoice, '11.1').paymentMethod).toBe(3);
    expect(withDocumentType(initialState('2026-10-01'), '1.1').paymentMethod).toBe(7);
  });

  it('maps library issues to bilingual messages and form locations', () => {
    expect(describeIssue({ path: 'lines.1.unitPriceCents', message: 'x' })).toContain('Price in €');
    expect(describeIssue({ path: 'lines', message: 'at least one line is required' })).toContain(
      'Add at least one line',
    );
    expect(
      describeIssue({ path: 'lines', message: 'document total exceeds the XSD amount limit' }),
    ).toContain('too large');
    expect(describeIssue({ path: 'counterpart.vatNumber', message: 'must be 9 digits' })).toBe(
      'must be 9 digits',
    );
    expect(issueLocation({ path: 'lines.2.quantity', message: '' })).toEqual({
      line: 2,
      field: 'quantity',
    });
    expect(issueLocation({ path: 'series', message: '' })).toEqual({ field: 'series' });
  });
});

describe('greekUpperCase', () => {
  it('removes the tonos but keeps dialytika', () => {
    expect(greekUpperCase('Τιμολόγιο Πώλησης')).toBe('ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ');
    expect(greekUpperCase('Προϊόν')).toBe('ΠΡΟΪΟΝ');
  });
});

describe('tokenizeXml', () => {
  it('reproduces the input exactly and classifies tokens', () => {
    const xml = '<?xml version="1.0"?>\n<a x="1"><b>t &amp; u</b><c/></a>';
    const tokens = tokenizeXml(xml);
    expect(tokens.map((t) => t.text).join('')).toBe(xml);
    expect(tokens.filter((t) => t.kind === 'tag').map((t) => t.text)).toEqual([
      'a',
      'b',
      'b',
      'c',
      'a',
    ]);
    expect(tokens.find((t) => t.kind === 'attribute')?.text).toBe('x');
    expect(tokens.find((t) => t.kind === 'value')?.text).toBe('"1"');
    expect(tokens[0]?.kind).toBe('declaration');
  });

  it('keeps stray markup as text', () => {
    expect(
      tokenizeXml('a < b')
        .map((t) => t.text)
        .join(''),
    ).toBe('a < b');
  });
});
