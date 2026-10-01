import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import {
  DOCUMENT_TYPES,
  INVOICE_NAMESPACE,
  isDocumentType,
  isMeasurementUnit,
  isPaymentMethod,
  isVatCategory,
  type DocumentTypeSpec,
  type IncomeClassificationCategory,
  type IncomeClassificationType,
} from '../codes.js';
import { summarizeIncome } from '../compute.js';
import { milliToQuantity, parseAmount, parseQuantity } from '../money.js';
import type {
  Address,
  CounterpartParty,
  DocumentLine,
  IncomeClassification,
  MyDataDocument,
  Party,
} from '../types.js';
import { isConsistentLine, sumAmounts } from '../vat.js';

export class MyDataParseError extends Error {
  /** Element path where the problem was found, e.g. `invoice/invoiceDetails[2]/vatAmount`. */
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'MyDataParseError';
    this.path = path;
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
});

/**
 * Parses an `InvoicesDoc` produced for one of the supported document types back
 * into a typed MyDataDocument.
 *
 * Besides reading values, it checks that the document is internally consistent
 * (line VAT follows the rounding rule, totals equal the sum of lines, payment
 * equals the gross total), so anything rendered from the result is trustworthy.
 * It does not replace XSD validation; run `validateInvoicesDocXml` for that.
 */
export function parseInvoicesDocXml(xml: string): MyDataDocument {
  try {
    SyntaxValidator.validate(xml, { multipleRoots: false });
  } catch (error) {
    const line = (error as { line?: number }).line ?? '?';
    const reason = error instanceof Error ? error.message : String(error);
    throw new MyDataParseError('(document)', `not well-formed XML at line ${line}: ${reason}`);
  }

  const parsed: unknown = parser.parse(xml);
  const rootKey = isObject(parsed)
    ? Object.keys(parsed).find((key) => localName(key) === 'InvoicesDoc')
    : undefined;
  if (!isObject(parsed) || rootKey === undefined) {
    throw new MyDataParseError('(document)', 'root element must be InvoicesDoc');
  }
  const root = parsed[rootKey];
  const prefix = rootKey.includes(':') ? `:${rootKey.split(':')[0]}` : '';
  if (!isObject(root) || root[`@_xmlns${prefix}`] !== INVOICE_NAMESPACE) {
    throw new MyDataParseError('InvoicesDoc', `must be in namespace ${INVOICE_NAMESPACE}`);
  }

  const invoices = children(root, 'invoice');
  if (invoices.length !== 1) {
    throw new MyDataParseError(
      'InvoicesDoc',
      `expected exactly 1 invoice, found ${invoices.length}`,
    );
  }
  return parseInvoice(new Cursor(invoices[0], 'invoice'));
}

function parseInvoice(invoice: Cursor): MyDataDocument {
  const header = invoice.one('invoiceHeader');
  const typeCursor = header.one('invoiceType');
  const documentType = typeCursor.text();
  if (!isDocumentType(documentType)) {
    throw typeCursor.error(`unsupported invoiceType "${documentType}" (supported: 11.1, 1.1)`);
  }
  const spec: DocumentTypeSpec = DOCUMENT_TYPES[documentType];

  const issuer = parseParty(invoice.one('issuer'), 'issuer');

  const counterpartCursor = invoice.optional('counterpart');
  if (spec.counterpart === 'required' && !counterpartCursor) {
    throw invoice.error(`counterpart is required for ${documentType}`);
  }
  if (spec.counterpart === 'forbidden' && counterpartCursor) {
    throw counterpartCursor.error(`counterpart is not allowed for ${documentType}`);
  }
  const counterpart = counterpartCursor && parseCounterpart(counterpartCursor);

  const currencyCursor = header.optional('currency');
  if (currencyCursor && currencyCursor.text() !== 'EUR') {
    throw currencyCursor.error('only EUR is supported');
  }

  const lineCursors = invoice.many('invoiceDetails');
  if (lineCursors.length === 0) throw invoice.error('at least one invoiceDetails is required');
  const lines = lineCursors.map((cursor, index) => parseLine(cursor, index, spec));

  const totals = sumAmounts(lines);
  const summary = invoice.one('invoiceSummary');
  expectAmount(summary.one('totalNetValue'), totals.netCents, 'sum of line netValue');
  expectAmount(summary.one('totalVatAmount'), totals.vatCents, 'sum of line vatAmount');
  for (const name of [
    'totalWithheldAmount',
    'totalFeesAmount',
    'totalStampDutyAmount',
    'totalOtherTaxesAmount',
    'totalDeductionsAmount',
  ]) {
    expectAmount(summary.one(name), 0, 'zero (not supported by this library)');
  }
  expectAmount(summary.one('totalGrossValue'), totals.grossCents, 'totalNetValue + totalVatAmount');

  const incomeClassificationSummary = summary
    .many('incomeClassification')
    .map(parseIncomeClassification);
  const expectedSummary = summarizeIncome(lines);
  if (JSON.stringify(incomeClassificationSummary) !== JSON.stringify(expectedSummary)) {
    throw summary.error('incomeClassification must equal the per-line classifications summed');
  }

  const paymentDetails = invoice.one('paymentMethods').many('paymentMethodDetails');
  const [payment] = paymentDetails;
  if (paymentDetails.length !== 1 || payment === undefined) {
    throw invoice.error('expected exactly 1 paymentMethodDetails');
  }
  const methodCursor = payment.one('type');
  const method = Number(methodCursor.text());
  if (!isPaymentMethod(method) || !(spec.paymentMethods as readonly number[]).includes(method)) {
    throw methodCursor.error(
      `payment method ${methodCursor.text()} not supported for ${documentType}`,
    );
  }
  expectAmount(payment.one('amount'), totals.grossCents, 'totalGrossValue');

  return {
    documentType,
    issuer,
    ...(counterpart ? { counterpart } : {}),
    series: header.one('series').text(),
    aa: header.one('aa').text(),
    issueDate: header.one('issueDate').text(),
    currency: 'EUR',
    payment: { method, amountCents: totals.grossCents },
    lines,
    totals,
    incomeClassificationSummary,
  };
}

function parseParty(cursor: Cursor, role: 'issuer' | 'counterpart'): Party {
  const country = cursor.one('country').text();
  // §5.1 note 3: myDATA rejects these for Greek entities.
  if (country === 'GR') {
    const name = cursor.optional('name');
    if (name) throw name.error(`${role} name is not accepted for a GR entity (§5.1 note 3)`);
    const address = role === 'issuer' && cursor.optional('address');
    if (address)
      throw address.error('issuer address is not accepted for a GR entity (§5.1 note 3)');
  }
  return {
    vatNumber: cursor.one('vatNumber').text(),
    country,
    branch: cursor.one('branch').integer(0),
  };
}

function parseCounterpart(cursor: Cursor): CounterpartParty {
  const party = parseParty(cursor, 'counterpart');
  const addressCursor = cursor.optional('address');
  if (!addressCursor) return party;
  const street = addressCursor.optional('street')?.text();
  const number = addressCursor.optional('number')?.text();
  const address: Address = {
    ...(street !== undefined ? { street } : {}),
    ...(number !== undefined ? { number } : {}),
    postalCode: addressCursor.one('postalCode').text(),
    city: addressCursor.one('city').text(),
  };
  return { ...party, address };
}

function parseLine(cursor: Cursor, index: number, spec: DocumentTypeSpec): DocumentLine {
  const lineNumberCursor = cursor.one('lineNumber');
  const lineNumber = lineNumberCursor.integer(1);
  if (lineNumber !== index + 1) {
    throw lineNumberCursor.error(`expected lineNumber ${index + 1}, found ${lineNumber}`);
  }

  const description = cursor.optional('itemDescr')?.text();

  const quantityCursor = cursor.one('quantity');
  const milli = parseQuantity(quantityCursor.text());
  if (milli === null || milli === 0) {
    throw quantityCursor.error('must be a positive decimal with at most 3 decimals');
  }

  const unitCursor = cursor.one('measurementUnit');
  const measurementUnit = unitCursor.integer(1);
  if (!isMeasurementUnit(measurementUnit)) throw unitCursor.error('supported values: 1, 2, 3');

  const vatCursor = cursor.one('vatCategory');
  const vatCategory = vatCursor.integer(1);
  if (!isVatCategory(vatCategory)) throw vatCursor.error('supported values: 1, 2, 3, 7');

  const exemptionCursor = cursor.optional('vatExemptionCategory');
  if (vatCategory === 7 && !exemptionCursor) {
    throw cursor.error('vatExemptionCategory is required when vatCategory is 7 (0%)');
  }
  if (vatCategory !== 7 && exemptionCursor) {
    throw exemptionCursor.error('only allowed when vatCategory is 7 (0%)');
  }
  const vatExemptionCategory = exemptionCursor?.integer(1);

  const netCents = cursor.one('netValue').amount();
  const vatAmountCursor = cursor.one('vatAmount');
  const vatCents = vatAmountCursor.amount();
  if (!isConsistentLine(spec.pricing, netCents, vatCents, vatCategory)) {
    throw vatAmountCursor.error(
      `${vatAmountCursor.text()} does not follow the ${spec.pricing}-pricing rounding rule for this net value and VAT rate`,
    );
  }

  const classifications = cursor.many('incomeClassification');
  const [classificationCursor] = classifications;
  if (classifications.length !== 1 || classificationCursor === undefined) {
    throw cursor.error('expected exactly 1 incomeClassification');
  }
  const incomeClassification = parseIncomeClassification(classificationCursor);
  const expected: { readonly type: string; readonly category: string } = spec.incomeClassification;
  if (
    incomeClassification.type !== expected.type ||
    incomeClassification.category !== expected.category
  ) {
    throw classificationCursor.error(`expected ${expected.category} / ${expected.type}`);
  }
  if (incomeClassification.amountCents !== netCents) {
    throw classificationCursor.error('amount must equal the line netValue');
  }

  return {
    lineNumber,
    ...(description !== undefined ? { description } : {}),
    quantity: milliToQuantity(milli),
    measurementUnit,
    vatCategory,
    ...(vatExemptionCategory !== undefined ? { vatExemptionCategory } : {}),
    netCents,
    vatCents,
    grossCents: netCents + vatCents,
    incomeClassification,
  };
}

const CLASSIFICATION_TYPES: readonly string[] = [
  'E3_561_001',
  'E3_561_003',
] satisfies IncomeClassificationType[];
const CLASSIFICATION_CATEGORIES: readonly string[] = [
  'category1_1',
] satisfies IncomeClassificationCategory[];

function parseIncomeClassification(cursor: Cursor): IncomeClassification {
  const typeCursor = cursor.one('classificationType');
  const type = typeCursor.text();
  if (!CLASSIFICATION_TYPES.includes(type)) {
    throw typeCursor.error(`unsupported classificationType "${type}"`);
  }
  const categoryCursor = cursor.one('classificationCategory');
  const category = categoryCursor.text();
  if (!CLASSIFICATION_CATEGORIES.includes(category)) {
    throw categoryCursor.error(`unsupported classificationCategory "${category}"`);
  }
  return {
    type: type as IncomeClassificationType,
    category: category as IncomeClassificationCategory,
    amountCents: cursor.one('amount').amount(),
  };
}

function expectAmount(cursor: Cursor, expectedCents: number, meaning: string): void {
  if (cursor.amount() !== expectedCents) {
    throw cursor.error(`${cursor.text()} does not equal ${meaning}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal navigation over fast-xml-parser output, with element paths in errors.
// Elements are matched by local name, so any namespace prefix is accepted.
// ---------------------------------------------------------------------------

type XmlObject = Record<string, unknown>;

class Cursor {
  constructor(
    private readonly node: unknown,
    readonly path: string,
  ) {}

  error(message: string): MyDataParseError {
    return new MyDataParseError(this.path, message);
  }

  many(name: string): Cursor[] {
    const found = children(this.node, name);
    return found.map(
      (node, i) => new Cursor(node, `${this.path}/${name}${found.length > 1 ? `[${i + 1}]` : ''}`),
    );
  }

  optional(name: string): Cursor | undefined {
    const found = this.many(name);
    if (found.length > 1) throw this.error(`expected at most one ${name}, found ${found.length}`);
    return found[0];
  }

  one(name: string): Cursor {
    const found = this.optional(name);
    if (!found) throw this.error(`missing required element ${name}`);
    return found;
  }

  text(): string {
    if (typeof this.node === 'string') return this.node;
    if (isObject(this.node) && typeof this.node['#text'] === 'string') return this.node['#text'];
    throw this.error('expected a text value');
  }

  integer(min: number): number {
    const text = this.text();
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < min) {
      throw this.error(`expected an integer >= ${min}, found "${text}"`);
    }
    return value;
  }

  amount(): number {
    const cents = parseAmount(this.text());
    if (cents === null) {
      throw this.error(
        `expected a non-negative amount with at most 2 decimals, found "${this.text()}"`,
      );
    }
    return cents;
  }
}

function children(node: unknown, name: string): unknown[] {
  if (!isObject(node)) return [];
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('@_') && key !== '#text' && localName(key) === name)
    .flatMap(([, value]): unknown[] => (Array.isArray(value) ? (value as unknown[]) : [value]));
}

function localName(key: string): string {
  const colon = key.indexOf(':');
  return colon === -1 ? key : key.slice(colon + 1);
}

function isObject(value: unknown): value is XmlObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
