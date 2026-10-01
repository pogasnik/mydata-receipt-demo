import { describe, expect, it } from 'vitest';
import {
  buildInvoicesDocXml,
  computeDocument,
  MyDataParseError,
  parseInvoicesDocXml,
} from '../src/index.js';
import { invoice, receipt } from './fixtures.js';
import { randomInput } from './random.js';

const receiptXml = buildInvoicesDocXml(receipt);
const invoiceXml = buildInvoicesDocXml(invoice);

describe('round trip: build → parse', () => {
  it('returns exactly the computed document for both document types', () => {
    expect(parseInvoicesDocXml(receiptXml)).toEqual(computeDocument(receipt));
    expect(parseInvoicesDocXml(invoiceXml)).toEqual(computeDocument(invoice));
  });

  it('keeps line names, including characters that need escaping', () => {
    const names = parseInvoicesDocXml(invoiceXml).lines.map((line) => line.description);
    expect(names).toEqual(['Χαρτί A4 (κιβώτιο)', 'Εξαγωγή <test> & "quotes"', 'Ελαιόλαδο']);
  });

  it('round-trips documents built without itemDescr', () => {
    const options = { includeItemDescr: false };
    const parsed = parseInvoicesDocXml(buildInvoicesDocXml(receipt, options));
    expect(parsed).toEqual(computeDocument(receipt, options));
    expect(parsed.lines.every((line) => line.description === undefined)).toBe(true);
  });

  it('holds for 500 random documents', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const input = randomInput(seed);
      expect(parseInvoicesDocXml(buildInvoicesDocXml(input)), `seed ${seed}`).toEqual(
        computeDocument(input),
      );
    }
  });
});

describe('parseInvoicesDocXml accepts equivalent spellings', () => {
  it('any namespace prefix', () => {
    const prefixed = receiptXml
      .replace(/<(\/?)(?!icls:|\?)([A-Za-z]\w*)/g, '<$1inv:$2')
      .replace('xmlns=', 'xmlns:inv=');
    expect(prefixed).toContain('<inv:InvoicesDoc xmlns:inv=');
    expect(parseInvoicesDocXml(prefixed)).toEqual(computeDocument(receipt));
  });

  it('attributes on text elements, trailing zeros, and an absent currency', () => {
    const variant = receiptXml
      .replace('<series>', '<series note="x">')
      .replace('<netValue>3.87<', '<netValue>3.870<')
      .replace('<currency>EUR</currency>', '');
    expect(parseInvoicesDocXml(variant)).toEqual(computeDocument(receipt));
  });

  it('a counterpart without an address', () => {
    const variant = invoiceXml.replace(/<address>[\s\S]*?<\/address>/, '');
    expect(parseInvoicesDocXml(variant).counterpart).toEqual({
      vatNumber: '999999999',
      country: 'GR',
      branch: 0,
    });
  });
});

describe('parseInvoicesDocXml rejects', () => {
  const cases: [name: string, xml: string, path: string, message: string][] = [
    ['malformed XML', receiptXml.replace('</invoice>', ''), '(document)', 'not well-formed'],
    ['another root element', '<Other/>', '(document)', 'root element must be InvoicesDoc'],
    ['a non-object document', 'plain text', '(document)', 'not well-formed'],
    [
      'the wrong namespace',
      receiptXml.replace('invoice/v1.0', 'invoice/v2.0'),
      'InvoicesDoc',
      'namespace',
    ],
    [
      'more than one invoice',
      receiptXml.replace(/(<invoice>[\s\S]*<\/invoice>)/, '$1$1'),
      'InvoicesDoc',
      'exactly 1 invoice',
    ],
    [
      'an unsupported invoiceType',
      receiptXml.replace('>11.1<', '>2.1<'),
      'invoice/invoiceHeader/invoiceType',
      'unsupported invoiceType "2.1"',
    ],
    [
      'a missing issuer',
      receiptXml.replace(/<issuer>[\s\S]*?<\/issuer>/, ''),
      'invoice',
      'missing required element issuer',
    ],
    [
      'a counterpart on a retail receipt',
      receiptXml.replace(
        '</issuer>',
        '</issuer><counterpart><vatNumber>999999999</vatNumber><country>GR</country><branch>0</branch></counterpart>',
      ),
      'invoice/counterpart',
      'not allowed for 11.1',
    ],
    [
      'a missing counterpart on an invoice',
      invoiceXml.replace(/<counterpart>[\s\S]*?<\/counterpart>/, ''),
      'invoice',
      'counterpart is required for 1.1',
    ],
    [
      'a GR issuer name (§5.1 note 3)',
      receiptXml.replace('<branch>0</branch>', '<branch>0</branch><name>Demo</name>'),
      'invoice/issuer/name',
      '§5.1 note 3',
    ],
    [
      'a GR issuer address (§5.1 note 3)',
      receiptXml.replace(
        '<branch>0</branch>',
        '<branch>0</branch><address><postalCode>1</postalCode><city>A</city></address>',
      ),
      'invoice/issuer/address',
      'issuer address is not accepted',
    ],
    [
      'a GR counterpart name (§5.1 note 3)',
      invoiceXml.replace(
        '<branch>0</branch>\n      <address>',
        '<branch>0</branch><name>X</name><address>',
      ),
      'invoice/counterpart/name',
      'counterpart name',
    ],
    [
      'a non-EUR currency',
      receiptXml.replace('>EUR<', '>USD<'),
      'invoice/invoiceHeader/currency',
      'only EUR',
    ],
    [
      'no lines',
      receiptXml.replace(/<invoiceDetails>[\s\S]*<\/invoiceDetails>/, ''),
      'invoice',
      'at least one invoiceDetails',
    ],
    [
      'a tampered net total',
      receiptXml.replace('<totalNetValue>24.83<', '<totalNetValue>24.84<'),
      'invoice/invoiceSummary/totalNetValue',
      'does not equal sum of line netValue',
    ],
    [
      'a non-zero unsupported total',
      receiptXml.replace('<totalFeesAmount>0.00<', '<totalFeesAmount>1.00<'),
      'invoice/invoiceSummary/totalFeesAmount',
      'zero',
    ],
    [
      'a tampered gross total',
      receiptXml.replace('<totalGrossValue>27.50<', '<totalGrossValue>27.51<'),
      'invoice/invoiceSummary/totalGrossValue',
      'totalNetValue + totalVatAmount',
    ],
    [
      'a tampered summary classification',
      receiptXml.replace('<icls:amount>24.83<', '<icls:amount>24.80<'),
      'invoice/invoiceSummary',
      'per-line classifications summed',
    ],
    [
      'two payment details',
      receiptXml.replace(/(<paymentMethodDetails>[\s\S]*<\/paymentMethodDetails>)/, '$1$1'),
      'invoice',
      'exactly 1 paymentMethodDetails',
    ],
    [
      'a payment method not allowed for the type',
      receiptXml.replace('<type>7<', '<type>5<'),
      'invoice/paymentMethods/paymentMethodDetails/type',
      'not supported for 11.1',
    ],
    [
      'an unknown payment method',
      receiptXml.replace('<type>7<', '<type>9<'),
      'invoice/paymentMethods/paymentMethodDetails/type',
      'payment method 9',
    ],
    [
      'a payment amount that differs from the total',
      receiptXml.replace('<amount>27.50<', '<amount>27.00<'),
      'invoice/paymentMethods/paymentMethodDetails/amount',
      'totalGrossValue',
    ],
    [
      'a non-integer branch',
      receiptXml.replace('<branch>0<', '<branch>x<'),
      'invoice/issuer/branch',
      'expected an integer >= 0',
    ],
    [
      'an out-of-order lineNumber',
      receiptXml.replace('<lineNumber>2<', '<lineNumber>5<'),
      'invoice/invoiceDetails[2]/lineNumber',
      'expected lineNumber 2',
    ],
    [
      'a missing quantity',
      receiptXml.replace('<quantity>2</quantity>', ''),
      'invoice/invoiceDetails[1]',
      'missing required element quantity',
    ],
    [
      'a four-decimal quantity',
      receiptXml.replace('<quantity>2<', '<quantity>2.0005<'),
      'invoice/invoiceDetails[1]/quantity',
      'at most 3 decimals',
    ],
    [
      'a zero quantity',
      receiptXml.replace('<quantity>2<', '<quantity>0<'),
      'invoice/invoiceDetails[1]/quantity',
      'positive',
    ],
    [
      'an unsupported measurement unit',
      receiptXml.replace('<measurementUnit>1<', '<measurementUnit>4<'),
      'invoice/invoiceDetails[1]/measurementUnit',
      '1, 2, 3',
    ],
    [
      'an unsupported VAT category',
      receiptXml.replace('<vatCategory>1<', '<vatCategory>4<'),
      'invoice/invoiceDetails[1]/vatCategory',
      '1, 2, 3, 7',
    ],
    [
      '0% VAT without an exemption',
      invoiceXml.replace('<vatExemptionCategory>3</vatExemptionCategory>', ''),
      'invoice/invoiceDetails[2]',
      'vatExemptionCategory is required',
    ],
    [
      'an exemption on a taxed line',
      receiptXml.replace(
        '<vatAmount>0.93</vatAmount>',
        '<vatAmount>0.93</vatAmount><vatExemptionCategory>1</vatExemptionCategory>',
      ),
      'invoice/invoiceDetails[1]/vatExemptionCategory',
      'only allowed',
    ],
    [
      'a tampered line VAT',
      receiptXml.replace('<vatAmount>0.93<', '<vatAmount>0.94<'),
      'invoice/invoiceDetails[1]/vatAmount',
      'gross-pricing rounding rule',
    ],
    [
      'a malformed amount',
      receiptXml.replace('<netValue>3.87<', '<netValue>3.875<'),
      'invoice/invoiceDetails[1]/netValue',
      'at most 2 decimals',
    ],
    [
      'two classifications on a line',
      receiptXml.replace(/(<incomeClassification>[\s\S]*?<\/incomeClassification>)/, '$1$1'),
      'invoice/invoiceDetails[1]',
      'exactly 1 incomeClassification',
    ],
    [
      'the classification of another document type',
      receiptXml.replaceAll('E3_561_003', 'E3_561_001'),
      'invoice/invoiceDetails[1]/incomeClassification',
      'expected category1_1 / E3_561_003',
    ],
    [
      'an unsupported classification type',
      receiptXml.replace('E3_561_003', 'E3_106'),
      'invoice/invoiceDetails[1]/incomeClassification/classificationType',
      'unsupported classificationType',
    ],
    [
      'an unsupported classification category',
      receiptXml.replace('category1_1', 'category1_2'),
      'invoice/invoiceDetails[1]/incomeClassification/classificationCategory',
      'unsupported classificationCategory',
    ],
    [
      'a classification amount that differs from net',
      receiptXml.replace('<icls:amount>3.87<', '<icls:amount>3.86<'),
      'invoice/invoiceDetails[1]/incomeClassification',
      'must equal the line netValue',
    ],
    [
      'a duplicated single element',
      receiptXml.replace('<aa>1</aa>', '<aa>1</aa><aa>2</aa>'),
      'invoice/invoiceHeader',
      'at most one aa',
    ],
    [
      'an element instead of text',
      receiptXml.replace('<series>DEMO</series>', '<series><x/></series>'),
      'invoice/invoiceHeader/series',
      'expected a text value',
    ],
  ];

  it.each(cases)('%s', (_name, xml, path, message) => {
    expect(xml).not.toBe(receiptXml);
    try {
      parseInvoicesDocXml(xml);
      expect.unreachable('expected a MyDataParseError');
    } catch (error) {
      expect(error).toBeInstanceOf(MyDataParseError);
      expect((error as MyDataParseError).path).toBe(path);
      expect((error as Error).message).toContain(message);
    }
  });
});
