import { DOCUMENT_TYPES } from './codes.js';
import { milliToQuantity, quantityToMilli } from './money.js';
import type {
  BuildOptions,
  CounterpartParty,
  DocumentInput,
  DocumentLine,
  IncomeClassification,
  MyDataDocument,
} from './types.js';
import { MyDataInputError, validateInput } from './validate-input.js';
import { lineAmounts, sumAmounts } from './vat.js';

/**
 * Validates the input and computes every amount that goes into the XML.
 * Throws MyDataInputError listing all problems if the input is invalid.
 */
export function computeDocument(input: DocumentInput, options: BuildOptions = {}): MyDataDocument {
  const issues = validateInput(input);
  if (issues.length > 0) throw new MyDataInputError(issues);

  const spec = DOCUMENT_TYPES[input.documentType];
  const includeItemDescr = options.includeItemDescr ?? true;

  const lines = input.lines.map((line, index): DocumentLine => {
    // validateInput guarantees a representable quantity.
    const milli = quantityToMilli(line.quantity) as number;
    const amounts = lineAmounts(spec.pricing, milli, line.unitPriceCents, line.vatCategory);
    return {
      lineNumber: index + 1,
      ...(includeItemDescr ? { description: line.name.trim() } : {}),
      quantity: milliToQuantity(milli),
      measurementUnit: line.measurementUnit ?? 1,
      vatCategory: line.vatCategory,
      ...(line.vatCategory === 7 ? { vatExemptionCategory: line.vatExemptionCategory } : {}),
      ...amounts,
      incomeClassification: { ...spec.incomeClassification, amountCents: amounts.netCents },
    };
  });

  const totals = sumAmounts(lines);

  return {
    documentType: input.documentType,
    issuer: {
      vatNumber: input.issuer.vatNumber,
      country: input.issuer.country,
      branch: input.issuer.branch,
    },
    ...(input.counterpart ? { counterpart: toCounterpart(input.counterpart) } : {}),
    series: input.series.trim(),
    aa: input.aa.trim(),
    issueDate: input.issueDate,
    currency: 'EUR',
    payment: { method: input.paymentMethod, amountCents: totals.grossCents },
    lines,
    totals,
    incomeClassificationSummary: summarizeIncome(lines),
  };
}

function toCounterpart(counterpart: NonNullable<DocumentInput['counterpart']>): CounterpartParty {
  const { street, number, postalCode, city } = counterpart.address;
  return {
    vatNumber: counterpart.vatNumber,
    country: counterpart.country,
    branch: counterpart.branch,
    address: {
      ...(street?.trim() ? { street: street.trim() } : {}),
      ...(number?.trim() ? { number: number.trim() } : {}),
      postalCode: postalCode.trim(),
      city: city.trim(),
    },
  };
}

/** Invoice-level classification: line classifications summed per (type, category). */
export function summarizeIncome(lines: readonly DocumentLine[]): IncomeClassification[] {
  const sums = new Map<string, IncomeClassification>();
  for (const { incomeClassification: c } of lines) {
    const key = `${c.category}|${c.type}`;
    const previous = sums.get(key);
    sums.set(key, { ...c, amountCents: (previous?.amountCents ?? 0) + c.amountCents });
  }
  return [...sums.values()];
}
