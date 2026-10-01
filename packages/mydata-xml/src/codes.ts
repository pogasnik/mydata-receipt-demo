/**
 * Code tables from the AADE myDATA REST API documentation v2.0.2 (Appendix 8),
 * limited to the values this library supports.
 */

/** §8.2 Κατηγορία ΦΠΑ. Only the categories this library supports. */
export const VAT_CATEGORIES = {
  1: { ratePercent: 24, label: '24%' },
  2: { ratePercent: 13, label: '13%' },
  3: { ratePercent: 6, label: '6%' },
  7: { ratePercent: 0, label: '0%' },
} as const;

export type VatCategory = keyof typeof VAT_CATEGORIES;

/** vatCategory 7 (Άνευ ΦΠΑ) requires a vatExemptionCategory (§5.4 note 3), int 1–31 (§8.3). */
export const ZERO_VAT_CATEGORY = 7 satisfies VatCategory;
export const VAT_EXEMPTION_MIN = 1;
export const VAT_EXEMPTION_MAX = 31;

/** §8.12 Τρόποι Πληρωμής. */
export const PAYMENT_METHODS = {
  3: { el: 'Μετρητά', en: 'Cash' },
  5: { el: 'Επί πιστώσει', en: 'On credit' },
  7: { el: 'POS / e-POS', en: 'Card' },
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** §8.13 Είδος Ποσότητας. */
export const MEASUREMENT_UNITS = {
  1: { el: 'Τεμάχια', short: 'τεμ.', en: 'Pieces' },
  2: { el: 'Κιλά', short: 'kg', en: 'Kilograms' },
  3: { el: 'Λίτρα', short: 'lt', en: 'Litres' },
} as const;

export type MeasurementUnit = keyof typeof MEASUREMENT_UNITS;

/** §8.8 / §8.9 Income classification codes used by the supported document types. */
export type IncomeClassificationCategory = 'category1_1';
export type IncomeClassificationType = 'E3_561_001' | 'E3_561_003';

/**
 * How line amounts are derived from the entered unit price.
 * - `gross`: prices include VAT (retail shelf prices); VAT is extracted.
 * - `net`:   prices exclude VAT (B2B invoices); VAT is added.
 */
export type Pricing = 'gross' | 'net';

export interface DocumentTypeSpec {
  readonly el: string;
  readonly en: string;
  readonly pricing: Pricing;
  /** Whether the XML carries a counterpart (λήπτης) block. */
  readonly counterpart: 'required' | 'forbidden';
  readonly paymentMethods: readonly PaymentMethod[];
  /**
   * Income classification sent with every line. The pairing of document type and
   * E3 code comes from AADE's "combinations" table, not from the XSD.
   */
  readonly incomeClassification: {
    readonly category: IncomeClassificationCategory;
    readonly type: IncomeClassificationType;
  };
}

/**
 * §8.1 Είδος Παραστατικού. Supporting another document type means adding an
 * entry here, plus a branch in the input type if it needs new fields.
 */
export const DOCUMENT_TYPES = {
  '11.1': {
    el: 'Απόδειξη Λιανικής Πώλησης',
    en: 'Retail sales receipt',
    pricing: 'gross',
    counterpart: 'forbidden',
    paymentMethods: [3, 7],
    incomeClassification: { category: 'category1_1', type: 'E3_561_003' },
  },
  '1.1': {
    el: 'Τιμολόγιο Πώλησης',
    en: 'Sales invoice',
    pricing: 'net',
    counterpart: 'required',
    paymentMethods: [3, 7, 5],
    incomeClassification: { category: 'category1_1', type: 'E3_561_001' },
  },
} as const satisfies Record<string, DocumentTypeSpec>;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const INVOICE_NAMESPACE = 'http://www.aade.gr/myDATA/invoice/v1.0';
// Sic: AADE's namespace URI really is spelled "Classificaton".
export const INCOME_CLASSIFICATION_NAMESPACE =
  'https://www.aade.gr/myDATA/incomeClassificaton/v1.0';

export function isVatCategory(value: unknown): value is VatCategory {
  return typeof value === 'number' && Object.hasOwn(VAT_CATEGORIES, value);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'number' && Object.hasOwn(PAYMENT_METHODS, value);
}

export function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  return typeof value === 'number' && Object.hasOwn(MEASUREMENT_UNITS, value);
}

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && Object.hasOwn(DOCUMENT_TYPES, value);
}
