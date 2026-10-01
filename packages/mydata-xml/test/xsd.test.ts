import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildInvoicesDocXml } from '../src/index.js';
import { MAIN_XSD, PRELOAD_XSDS } from '../src/generated/xsd.js';
import { validateInvoicesDocXml } from '../src/validate.js';
import { invoice, receipt } from './fixtures.js';
import { randomInput } from './random.js';

const receiptXml = buildInvoicesDocXml(receipt);

async function expectInvalid(xml: string, messageFragment: string) {
  const result = await validateInvoicesDocXml(xml);
  expect(result.valid).toBe(false);
  expect(result.errors.join('\n')).toContain(messageFragment);
}

describe('XSD validation (AADE myDATA v2.0.2)', () => {
  it('accepts a retail receipt (11.1) and a sales invoice (1.1)', async () => {
    expect(await validateInvoicesDocXml(receiptXml)).toEqual({ valid: true, errors: [] });
    expect(await validateInvoicesDocXml(buildInvoicesDocXml(invoice))).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('accepts documents built without itemDescr', async () => {
    const xml = buildInvoicesDocXml(invoice, { includeItemDescr: false });
    expect(xml).not.toContain('itemDescr');
    expect((await validateInvoicesDocXml(xml)).valid).toBe(true);
  });

  it('accepts randomly generated documents', async () => {
    for (let seed = 1; seed <= 15; seed++) {
      const result = await validateInvoicesDocXml(buildInvoicesDocXml(randomInput(seed)));
      expect(result, `seed ${seed}`).toEqual({ valid: true, errors: [] });
    }
  });

  it('rejects elements out of xs:sequence order', async () => {
    const swapped = receiptXml.replace(
      /(<netValue>[^<]*<\/netValue>)(\s*)(<vatCategory>[^<]*<\/vatCategory>)/,
      '$3$2$1',
    );
    expect(swapped).not.toBe(receiptXml);
    await expectInvalid(swapped, "Element '{http://www.aade.gr/myDATA/invoice/v1.0}vatCategory'");
  });

  it('rejects amounts with three decimals or a minus sign', async () => {
    await expectInvalid(
      receiptXml.replace('<netValue>3.87<', '<netValue>3.875<'),
      'fractionDigits',
    );
    // fractionDigits constrains the value, not the spelling: 3.870 is 3.87 and is valid.
    expect(
      (await validateInvoicesDocXml(receiptXml.replace('<netValue>3.87<', '<netValue>3.870<')))
        .valid,
    ).toBe(true);
    await expectInvalid(receiptXml.replace('<netValue>3.87<', '<netValue>-3.87<'), 'minInclusive');
  });

  it('rejects out-of-range codes', async () => {
    await expectInvalid(receiptXml.replace('<vatCategory>1<', '<vatCategory>11<'), 'maxInclusive');
    await expectInvalid(
      receiptXml.replace('<invoiceType>11.1<', '<invoiceType>99.9<'),
      'enumeration',
    );
    await expectInvalid(receiptXml.replace('E3_561_003', 'E3_000_000'), 'classificationType');
  });

  it('rejects missing required and unknown elements', async () => {
    await expectInvalid(
      receiptXml.replace(/<invoiceSummary>[\s\S]*<\/invoiceSummary>/, ''),
      'Missing child element',
    );
    await expectInvalid(receiptXml.replace('<aa>1</aa>', '<aa>1</aa><bogus/>'), 'bogus');
  });

  it('rejects the wrong namespace', async () => {
    await expectInvalid(
      receiptXml.replace('myDATA/invoice/v1.0', 'myDATA/invoice/v9.9'),
      'No matching global declaration',
    );
  });

  it('uses XSD files identical to the vendored ones', () => {
    const read = (name: string) => readFileSync(new URL(`../xsd/${name}`, import.meta.url), 'utf8');
    expect(MAIN_XSD.fileName).toBe('InvoicesDoc-v2.0.2.xsd');
    for (const file of [MAIN_XSD, ...PRELOAD_XSDS]) {
      expect(file.contents, file.fileName).toBe(read(file.fileName));
    }
  });
});
