import {
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  VAT_CATEGORIES,
  vatBreakdown,
  type MyDataDocument,
} from '@pogasnik/mydata-xml';
import { formatDate, formatEuro, formatQuantity, greekUpperCase } from '@/lib/format';
import { LETTERHEAD } from './letterhead';

export const WATERMARK_EL = 'ΔΕΙΓΜΑ — ΜΗ ΕΓΚΥΡΟ ΦΟΡΟΛΟΓΙΚΟ ΣΤΟΙΧΕΙΟ';
export const WATERMARK_EN = 'DEMO — NOT A VALID FISCAL DOCUMENT';
export const WATERMARK = `${WATERMARK_EL} / ${WATERMARK_EN}`;

/** MARK, UID and the QR code are issued by AADE on transmission; a demo never has them. */
export const NOT_ISSUED = '—';

export interface ReceiptView {
  readonly title: string;
  readonly subtitle: string;
  readonly issuer: { readonly name: string; readonly lines: readonly string[] };
  readonly buyer?: { readonly name: string; readonly lines: readonly string[] };
  readonly meta: readonly (readonly [label: string, value: string])[];
  readonly lines: readonly {
    readonly key: string;
    readonly description: string;
    readonly detail: string;
    readonly amount: string;
  }[];
  readonly amountsInclude: string;
  readonly vatRows: readonly {
    readonly rate: string;
    readonly net: string;
    readonly vat: string;
    readonly gross: string;
  }[];
  readonly totals: readonly (readonly [label: string, value: string])[];
  readonly grandTotal: string;
  readonly payment: string;
  readonly mark: string;
  readonly uid: string;
}

/**
 * Everything printed comes from the parsed XML, except names and the issuer's
 * address, which myDATA does not carry for Greek entities (see letterhead.ts).
 */
export function toReceiptView(doc: MyDataDocument): ReceiptView {
  const spec = DOCUMENT_TYPES[doc.documentType];
  const issuer = LETTERHEAD[doc.issuer.vatNumber];
  const gross = spec.pricing === 'gross';

  const counterpart = doc.counterpart;
  const buyer = counterpart && {
    name: LETTERHEAD[counterpart.vatNumber]?.name ?? NOT_ISSUED,
    lines: [
      `ΑΦΜ ${counterpart.vatNumber}`,
      ...(counterpart.address
        ? [
            [counterpart.address.street, counterpart.address.number].filter(Boolean).join(' '),
            `${counterpart.address.postalCode} ${counterpart.address.city}`,
          ].filter(Boolean)
        : []),
    ],
  };

  return {
    title: greekUpperCase(spec.el),
    subtitle: `${spec.en} · myDATA ${doc.documentType}`,
    issuer: {
      name: issuer?.name ?? NOT_ISSUED,
      lines: [...(issuer?.addressLines ?? []), `ΑΦΜ ${doc.issuer.vatNumber}`],
    },
    ...(buyer ? { buyer } : {}),
    meta: [
      ['Σειρά / Series', doc.series],
      ['Α/Α / No.', doc.aa],
      ['Ημερομηνία / Date', formatDate(doc.issueDate)],
    ],
    lines: doc.lines.map((line) => ({
      key: String(line.lineNumber),
      description: line.description ?? `Γραμμή ${line.lineNumber}`,
      detail: [
        formatQuantity(line.quantity, line.measurementUnit),
        `ΦΠΑ ${VAT_CATEGORIES[line.vatCategory].label}`,
        line.vatExemptionCategory !== undefined ? `εξαίρεση ${line.vatExemptionCategory}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      amount: formatEuro(gross ? line.grossCents : line.netCents),
    })),
    amountsInclude: gross
      ? 'Τιμές με ΦΠΑ / Amounts include VAT'
      : 'Αξίες χωρίς ΦΠΑ / Amounts exclude VAT',
    vatRows: vatBreakdown(doc.lines).map((row) => ({
      rate: `${row.ratePercent}%`,
      net: formatEuro(row.netCents),
      vat: formatEuro(row.vatCents),
      gross: formatEuro(row.grossCents),
    })),
    totals: [
      ['Καθαρή αξία / Net', formatEuro(doc.totals.netCents)],
      ['ΦΠΑ / VAT', formatEuro(doc.totals.vatCents)],
    ],
    grandTotal: formatEuro(doc.totals.grossCents),
    payment: `${PAYMENT_METHODS[doc.payment.method].el} / ${PAYMENT_METHODS[doc.payment.method].en}`,
    mark: NOT_ISSUED,
    uid: NOT_ISSUED,
  };
}
