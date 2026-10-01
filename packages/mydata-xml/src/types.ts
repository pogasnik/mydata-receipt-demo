import type {
  DocumentType,
  IncomeClassificationCategory,
  IncomeClassificationType,
  MeasurementUnit,
  PaymentMethod,
  VatCategory,
} from './codes.js';

// ---------------------------------------------------------------------------
// Input: what a caller provides
// ---------------------------------------------------------------------------

/**
 * Issuer as it appears in the XML. Per §5.1 note 3, a Greek issuer's name and
 * address are not accepted by myDATA (AADE already knows them from the ΑΦΜ),
 * so there are deliberately no such fields here.
 */
export interface IssuerInput {
  /** ΑΦΜ, 9 digits. */
  readonly vatNumber: string;
  readonly country: 'GR';
  /** Branch (εγκατάσταση) number; 0 for headquarters. */
  readonly branch: number;
}

export interface AddressInput {
  readonly street?: string;
  readonly number?: string;
  readonly postalCode: string;
  readonly city: string;
}

/**
 * Counterpart (λήπτης) for a B2B invoice. Per §5.1 note 3, a Greek counterpart's
 * name is not accepted, but the address is.
 */
export interface CounterpartInput {
  readonly vatNumber: string;
  readonly country: 'GR';
  readonly branch: number;
  readonly address: AddressInput;
}

interface LineInputBase {
  /** Sent as itemDescr (max 300 characters). */
  readonly name: string;
  /** Positive, at most 3 decimals (e.g. 0.5 kg). */
  readonly quantity: number;
  /**
   * Price per unit in integer cents. VAT-inclusive for 11.1, net for 1.1
   * (see `DOCUMENT_TYPES[type].pricing`).
   */
  readonly unitPriceCents: number;
  /** Defaults to 1 (Τεμάχια). */
  readonly measurementUnit?: MeasurementUnit;
}

export type LineInput = LineInputBase &
  (
    | { readonly vatCategory: Exclude<VatCategory, 7>; readonly vatExemptionCategory?: never }
    | {
        readonly vatCategory: 7;
        /** §8.3 Κατηγορία Αιτίας Εξαίρεσης ΦΠΑ, 1–31. Required at 0% VAT. */
        readonly vatExemptionCategory: number;
      }
  );

interface DocumentInputBase {
  readonly issuer: IssuerInput;
  /** Σειρά, max 50 characters. */
  readonly series: string;
  /** Αύξων αριθμός, max 50 characters. */
  readonly aa: string;
  /** ISO date, YYYY-MM-DD. */
  readonly issueDate: string;
  readonly lines: readonly LineInput[];
}

export interface RetailReceiptInput extends DocumentInputBase {
  readonly documentType: '11.1';
  readonly paymentMethod: 3 | 7;
  readonly counterpart?: never;
}

export interface SalesInvoiceInput extends DocumentInputBase {
  readonly documentType: '1.1';
  readonly paymentMethod: 3 | 5 | 7;
  readonly counterpart: CounterpartInput;
}

export type DocumentInput = RetailReceiptInput | SalesInvoiceInput;

export interface BuildOptions {
  /**
   * Emit each line's name as `itemDescr`. Default true, so names survive the
   * XML round trip. Note: §5.4 of the spec accepts itemDescr only for tax-free,
   * invoice-delivery-note and delivery-note documents, so a real 11.1 / 1.1
   * submission would set this to false. The XSD accepts it either way.
   */
  readonly includeItemDescr?: boolean;
}

// ---------------------------------------------------------------------------
// Document: the computed / parsed model (what the XML contains)
// ---------------------------------------------------------------------------

export interface Party {
  readonly vatNumber: string;
  readonly country: string;
  readonly branch: number;
}

export interface Address {
  readonly street?: string;
  readonly number?: string;
  readonly postalCode: string;
  readonly city: string;
}

export interface CounterpartParty extends Party {
  readonly address?: Address;
}

export interface IncomeClassification {
  readonly type: IncomeClassificationType;
  readonly category: IncomeClassificationCategory;
  readonly amountCents: number;
}

export interface DocumentLine {
  readonly lineNumber: number;
  /** itemDescr; absent when built with includeItemDescr: false. */
  readonly description?: string;
  readonly quantity: number;
  readonly measurementUnit: MeasurementUnit;
  readonly vatCategory: VatCategory;
  readonly vatExemptionCategory?: number;
  readonly netCents: number;
  readonly vatCents: number;
  /** netCents + vatCents. Not an XML field; derived for convenience. */
  readonly grossCents: number;
  readonly incomeClassification: IncomeClassification;
}

export interface DocumentTotals {
  readonly netCents: number;
  readonly vatCents: number;
  readonly grossCents: number;
}

/** A myDATA `invoice` element, restricted to what this library supports. */
export interface MyDataDocument {
  readonly documentType: DocumentType;
  readonly issuer: Party;
  readonly counterpart?: CounterpartParty;
  readonly series: string;
  readonly aa: string;
  readonly issueDate: string;
  readonly currency: 'EUR';
  readonly payment: { readonly method: PaymentMethod; readonly amountCents: number };
  readonly lines: readonly DocumentLine[];
  readonly totals: DocumentTotals;
  readonly incomeClassificationSummary: readonly IncomeClassification[];
}
