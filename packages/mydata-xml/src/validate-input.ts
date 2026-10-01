import {
  DOCUMENT_TYPES,
  isDocumentType,
  isMeasurementUnit,
  isVatCategory,
  VAT_EXEMPTION_MAX,
  VAT_EXEMPTION_MIN,
  ZERO_VAT_CATEGORY,
} from './codes.js';
import { MAX_AMOUNT_CENTS, quantityToMilli } from './money.js';
import type { DocumentInput } from './types.js';
import { lineAmounts } from './vat.js';

export interface InputIssue {
  /** Dotted path into the input, e.g. `lines.2.quantity`. */
  readonly path: string;
  readonly message: string;
}

export class MyDataInputError extends Error {
  readonly issues: readonly InputIssue[];

  constructor(issues: readonly InputIssue[]) {
    super(
      `Invalid myDATA document input:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`,
    );
    this.name = 'MyDataInputError';
    this.issues = issues;
  }
}

const VAT_NUMBER = /^\d{9}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Characters XML 1.0 cannot represent at all, even escaped.
// eslint-disable-next-line no-control-regex
const NOT_XML_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/;

/** The input as it may arrive at runtime (JavaScript callers, form state). */
type Untrusted = Readonly<Record<string, unknown>>;
type Add = (path: string, message: string) => void;

/**
 * Checks business rules the type system cannot express (lengths, ranges,
 * decimals, cross-field rules). Returns every problem found; empty means valid.
 * The static type documents the contract, but every value is re-checked, so
 * untyped callers get issues rather than a crash or invalid XML.
 */
export function validateInput(input: DocumentInput): InputIssue[] {
  const raw = input as unknown as Untrusted;
  const issues: InputIssue[] = [];
  const add: Add = (path, message) => issues.push({ path, message });

  const documentType = raw.documentType;
  if (!isDocumentType(documentType)) {
    add('documentType', `unsupported document type "${String(documentType)}"`);
    return issues;
  }
  const spec = DOCUMENT_TYPES[documentType];

  checkParty(raw.issuer, 'issuer', add);

  if (spec.counterpart === 'required') {
    if (raw.counterpart == null) add('counterpart', `required for ${documentType}`);
    else checkCounterpart(raw.counterpart, add);
  } else if (raw.counterpart != null) {
    add('counterpart', `not allowed for ${documentType}`);
  }

  checkText(raw.series, 'series', 50, add);
  checkText(raw.aa, 'aa', 50, add);
  if (!isIsoDate(raw.issueDate)) add('issueDate', 'must be a valid date in YYYY-MM-DD format');

  if (!(spec.paymentMethods as readonly unknown[]).includes(raw.paymentMethod)) {
    add(
      'paymentMethod',
      `${String(raw.paymentMethod)} is not allowed for ${documentType} (allowed: ${spec.paymentMethods.join(', ')})`,
    );
  }

  const lines: unknown = raw.lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    add('lines', 'at least one line is required');
    return issues;
  }

  let totalGross = 0;
  (lines as unknown[]).forEach((value, index) => {
    const line = isRecord(value) ? value : {};
    const at = (field: string) => `lines.${index}.${field}`;
    checkText(line.name, at('name'), 300, add);

    const milli = typeof line.quantity === 'number' ? quantityToMilli(line.quantity) : null;
    if (milli === null || milli <= 0) {
      add(at('quantity'), 'must be a positive number with at most 3 decimals');
    }

    const price = line.unitPriceCents;
    const priceOk = typeof price === 'number' && Number.isSafeInteger(price) && price >= 0;
    if (!priceOk) add(at('unitPriceCents'), 'must be a non-negative integer number of cents');

    if (line.measurementUnit !== undefined && !isMeasurementUnit(line.measurementUnit)) {
      add(at('measurementUnit'), 'must be 1 (pieces), 2 (kg) or 3 (litres)');
    }

    const vatCategory = line.vatCategory;
    if (!isVatCategory(vatCategory)) {
      add(at('vatCategory'), 'must be 1 (24%), 2 (13%), 3 (6%) or 7 (0%)');
    } else if (vatCategory === ZERO_VAT_CATEGORY) {
      const code = line.vatExemptionCategory;
      const codeOk =
        typeof code === 'number' &&
        Number.isInteger(code) &&
        code >= VAT_EXEMPTION_MIN &&
        code <= VAT_EXEMPTION_MAX;
      if (!codeOk) {
        add(
          at('vatExemptionCategory'),
          `required at 0% VAT, an integer ${VAT_EXEMPTION_MIN}–${VAT_EXEMPTION_MAX}`,
        );
      }
    } else if (line.vatExemptionCategory !== undefined) {
      add(at('vatExemptionCategory'), 'only allowed at 0% VAT');
    }

    if (milli !== null && milli > 0 && priceOk && isVatCategory(vatCategory)) {
      try {
        totalGross += lineAmounts(spec.pricing, milli, price, vatCategory).grossCents;
      } catch {
        totalGross = Infinity; // qty × price beyond safe integers
      }
    }
  });

  if (totalGross > MAX_AMOUNT_CENTS) add('lines', 'document total exceeds the XSD amount limit');

  return issues;
}

function checkParty(value: unknown, path: string, add: Add) {
  if (!isRecord(value)) {
    add(path, 'required');
    return;
  }
  if (typeof value.vatNumber !== 'string' || !VAT_NUMBER.test(value.vatNumber)) {
    add(`${path}.vatNumber`, 'must be 9 digits');
  }
  if (value.country !== 'GR') add(`${path}.country`, 'only GR is supported');
  if (typeof value.branch !== 'number' || !Number.isInteger(value.branch) || value.branch < 0) {
    add(`${path}.branch`, 'must be a non-negative integer (0 = headquarters)');
  }
}

function checkCounterpart(value: unknown, add: Add) {
  checkParty(value, 'counterpart', add);
  const address = isRecord(value) ? value.address : undefined;
  if (!isRecord(address)) {
    add('counterpart.address', 'required (postalCode and city)');
    return;
  }
  checkText(address.postalCode, 'counterpart.address.postalCode', 20, add);
  checkText(address.city, 'counterpart.address.city', 150, add);
  // Optional parts: blank means "omit", so only check them when filled in.
  if (isFilled(address.street)) checkText(address.street, 'counterpart.address.street', 150, add);
  if (isFilled(address.number)) checkText(address.number, 'counterpart.address.number', 20, add);
}

function checkText(value: unknown, path: string, maxLength: number, add: Add) {
  if (!isFilled(value)) add(path, 'required');
  else if (value.length > maxLength) add(path, `at most ${maxLength} characters`);
  else if (NOT_XML_CHAR.test(value)) add(path, 'contains control characters');
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Untrusted {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
