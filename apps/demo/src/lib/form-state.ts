import {
  DOCUMENT_TYPES,
  type DocumentInput,
  type DocumentType,
  type InputIssue,
  type LineInput,
  type MeasurementUnit,
  type PaymentMethod,
  type VatCategory,
} from '@pogasnik/mydata-xml';
import { DEMO_BUYER, DEMO_ISSUER } from '@/receipt/letterhead';

/** What the form edits: raw strings, exactly as typed. */
export interface LineDraft {
  readonly id: string;
  readonly name: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly measurementUnit: MeasurementUnit;
  readonly vatCategory: VatCategory;
  /** Only sent when vatCategory is 7 (0%). */
  readonly vatExemptionCategory: number;
}

export interface FormState {
  readonly documentType: DocumentType;
  readonly series: string;
  readonly aa: string;
  readonly issueDate: string;
  readonly paymentMethod: PaymentMethod;
  readonly lines: readonly LineDraft[];
}

export interface Preset {
  readonly name: string;
  readonly unitPrice: string;
  readonly vatCategory: VatCategory;
  readonly measurementUnit: MeasurementUnit;
}

export const PRESETS: readonly Preset[] = [
  { name: 'Espresso', unitPrice: '2,40', vatCategory: 1, measurementUnit: 1 },
  { name: 'Βιβλίο', unitPrice: '15,00', vatCategory: 3, measurementUnit: 1 },
  { name: 'Ψωμί', unitPrice: '1,20', vatCategory: 2, measurementUnit: 1 },
];

let nextId = 0;
export function newLineId(): string {
  nextId += 1;
  return `line-${nextId}`;
}

export function lineFromPreset(preset: Preset, quantity = '1'): LineDraft {
  return { id: newLineId(), quantity, vatExemptionCategory: 1, ...preset };
}

export function initialState(today: string): FormState {
  const [espresso, book] = PRESETS as [Preset, Preset, Preset];
  return {
    documentType: '11.1',
    series: 'DEMO',
    aa: '1',
    issueDate: today,
    paymentMethod: 7,
    lines: [
      lineFromPreset(espresso, '2'),
      lineFromPreset(book),
      {
        id: newLineId(),
        name: 'Φέτα',
        quantity: '0,5',
        unitPrice: '12,99',
        measurementUnit: 2,
        vatCategory: 2,
        vatExemptionCategory: 1,
      },
    ],
  };
}

/** Switching type keeps the lines but drops a payment method the new type does not allow. */
export function withDocumentType(state: FormState, documentType: DocumentType): FormState {
  const allowed: readonly PaymentMethod[] = DOCUMENT_TYPES[documentType].paymentMethods;
  return {
    ...state,
    documentType,
    paymentMethod: allowed.includes(state.paymentMethod) ? state.paymentMethod : 3,
  };
}

const DECIMAL = /^\d+(?:[.,]\d+)?$/;

/** "0,5" / "0.5" → 0.5. NaN when it is not a plain decimal; the library then reports it. */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  return DECIMAL.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** "2,40" / "2.4" / "2" → 240 cents. NaN for anything with more than 2 decimals. */
export function parseEuroCents(text: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** The typed library input. Validation is left to the library (validateInput). */
export function toDocumentInput(state: FormState): DocumentInput {
  const lines = state.lines.map((draft): LineInput => {
    const base = {
      name: draft.name,
      quantity: parseDecimal(draft.quantity),
      unitPriceCents: parseEuroCents(draft.unitPrice),
      measurementUnit: draft.measurementUnit,
    };
    return draft.vatCategory === 7
      ? { ...base, vatCategory: 7, vatExemptionCategory: draft.vatExemptionCategory }
      : { ...base, vatCategory: draft.vatCategory };
  });
  const common = {
    issuer: DEMO_ISSUER,
    series: state.series,
    aa: state.aa,
    issueDate: state.issueDate,
    lines,
  };
  if (state.documentType === '1.1') {
    return {
      ...common,
      documentType: '1.1',
      counterpart: DEMO_BUYER,
      paymentMethod: state.paymentMethod,
    };
  }
  return {
    ...common,
    documentType: '11.1',
    paymentMethod: state.paymentMethod === 5 ? 3 : state.paymentMethod,
  };
}

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  name: 'Συμπληρώστε περιγραφή / Enter a description',
  quantity: 'Ποσότητα > 0, έως 3 δεκαδικά / Quantity > 0, up to 3 decimals',
  unitPriceCents: 'Τιμή σε €, έως 2 δεκαδικά / Price in €, up to 2 decimals',
  vatExemptionCategory: 'Επιλέξτε αιτία εξαίρεσης / Choose an exemption reason',
  series: 'Συμπληρώστε σειρά / Enter a series',
  aa: 'Συμπληρώστε α/α / Enter a number',
  issueDate: 'Μη έγκυρη ημερομηνία / Invalid date',
};

/** Bilingual message for a library issue, keyed by the last segment of its path. */
export function describeIssue(issue: InputIssue): string {
  if (issue.path === 'lines') {
    return issue.message.startsWith('at least')
      ? 'Προσθέστε τουλάχιστον μία γραμμή / Add at least one line'
      : 'Το σύνολο είναι πολύ μεγάλο / The total is too large';
  }
  const field = issue.path.split('.').at(-1) ?? issue.path;
  return FIELD_MESSAGES[field] ?? issue.message;
}

/** `lines.2.quantity` → { line: 2, field: 'quantity' } for highlighting inputs. */
export function issueLocation(issue: InputIssue): { line?: number; field: string } {
  const match = /^lines\.(\d+)\.(\w+)$/.exec(issue.path);
  return match ? { line: Number(match[1]), field: match[2] ?? '' } : { field: issue.path };
}
