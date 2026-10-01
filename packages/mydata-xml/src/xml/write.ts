import { INCOME_CLASSIFICATION_NAMESPACE, INVOICE_NAMESPACE } from '../codes.js';
import { formatAmount, formatQuantity, quantityToMilli } from '../money.js';
import type {
  Address,
  CounterpartParty,
  DocumentLine,
  IncomeClassification,
  MyDataDocument,
  Party,
} from '../types.js';

/**
 * A tiny element tree. Children are written in array order, which is how the
 * strict xs:sequence ordering of the XSD is enforced: every builder function
 * below lists its children in exactly the schema's order.
 */
type XmlNode = {
  readonly name: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly content: string | readonly (XmlNode | null | undefined | false)[];
};

const el = (name: string, content: XmlNode['content']): XmlNode => ({ name, content });

/** Serializes a document model to an `InvoicesDoc` XML string (UTF-8, 2-space indent). */
export function writeInvoicesDoc(document: MyDataDocument): string {
  const root: XmlNode = {
    name: 'InvoicesDoc',
    attributes: { xmlns: INVOICE_NAMESPACE, 'xmlns:icls': INCOME_CLASSIFICATION_NAMESPACE },
    content: [invoice(document)],
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(root, 0)}\n`;
}

// AadeBookInvoiceType: uid?, mark?, ..., issuer?, counterpart?, invoiceHeader,
// paymentMethods?, invoiceDetails+, taxesTotals?, invoiceSummary, ...
// uid and mark are assigned by AADE on transmission, so they are never written.
function invoice(d: MyDataDocument): XmlNode {
  return el('invoice', [
    party('issuer', d.issuer),
    d.counterpart && counterpart(d.counterpart),
    el('invoiceHeader', [
      el('series', d.series),
      el('aa', d.aa),
      el('issueDate', d.issueDate),
      el('invoiceType', d.documentType),
      el('currency', d.currency),
    ]),
    el('paymentMethods', [
      el('paymentMethodDetails', [
        el('type', String(d.payment.method)),
        el('amount', formatAmount(d.payment.amountCents)),
      ]),
    ]),
    ...d.lines.map(invoiceRow),
    el('invoiceSummary', [
      el('totalNetValue', formatAmount(d.totals.netCents)),
      el('totalVatAmount', formatAmount(d.totals.vatCents)),
      // Required by the XSD even when zero; this library does not model them.
      el('totalWithheldAmount', '0.00'),
      el('totalFeesAmount', '0.00'),
      el('totalStampDutyAmount', '0.00'),
      el('totalOtherTaxesAmount', '0.00'),
      el('totalDeductionsAmount', '0.00'),
      el('totalGrossValue', formatAmount(d.totals.grossCents)),
      ...d.incomeClassificationSummary.map(incomeClassification),
    ]),
  ]);
}

// PartyType: vatNumber, country, branch, name?, address?, ...
function party(name: string, p: Party, address?: XmlNode): XmlNode {
  return el(name, [
    el('vatNumber', p.vatNumber),
    el('country', p.country),
    el('branch', String(p.branch)),
    address,
  ]);
}

function counterpart(p: CounterpartParty): XmlNode {
  return party('counterpart', p, p.address && address(p.address));
}

// AddressType: street?, number?, postalCode, city
function address(a: Address): XmlNode {
  return el('address', [
    a.street !== undefined && el('street', a.street),
    a.number !== undefined && el('number', a.number),
    el('postalCode', a.postalCode),
    el('city', a.city),
  ]);
}

// InvoiceRowType: lineNumber, ..., itemDescr?, ..., quantity?, measurementUnit?, ...,
// netValue, vatCategory, vatAmount, vatExemptionCategory?, ..., incomeClassification*
function invoiceRow(line: DocumentLine): XmlNode {
  return el('invoiceDetails', [
    el('lineNumber', String(line.lineNumber)),
    line.description !== undefined && el('itemDescr', line.description),
    el('quantity', formatQuantity(quantityToMilli(line.quantity) as number)),
    el('measurementUnit', String(line.measurementUnit)),
    el('netValue', formatAmount(line.netCents)),
    el('vatCategory', String(line.vatCategory)),
    el('vatAmount', formatAmount(line.vatCents)),
    line.vatExemptionCategory !== undefined &&
      el('vatExemptionCategory', String(line.vatExemptionCategory)),
    incomeClassification(line.incomeClassification),
  ]);
}

// IncomeClassificationType (icls namespace): classificationType?, classificationCategory, amount
function incomeClassification(c: IncomeClassification): XmlNode {
  return el('incomeClassification', [
    el('icls:classificationType', c.type),
    el('icls:classificationCategory', c.category),
    el('icls:amount', formatAmount(c.amountCents)),
  ]);
}

function render(node: XmlNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const attributes = Object.entries(node.attributes ?? {})
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join('');
  if (typeof node.content === 'string') {
    return `${indent}<${node.name}${attributes}>${escapeXml(node.content)}</${node.name}>`;
  }
  const children = node.content.filter((child): child is XmlNode => Boolean(child));
  const inner = children.map((child) => render(child, depth + 1)).join('\n');
  return `${indent}<${node.name}${attributes}>\n${inner}\n${indent}</${node.name}>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
