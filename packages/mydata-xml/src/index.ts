import { computeDocument } from './compute.js';
import type { BuildOptions, DocumentInput } from './types.js';
import { writeInvoicesDoc } from './xml/write.js';

export * from './codes.js';
export type * from './types.js';
export { computeDocument } from './compute.js';
export { validateInput, MyDataInputError, type InputIssue } from './validate-input.js';
export { parseInvoicesDocXml, MyDataParseError } from './xml/parse.js';
export { writeInvoicesDoc } from './xml/write.js';
export {
  grossPricedLine,
  netPricedLine,
  lineAmounts,
  sumAmounts,
  vatBreakdown,
  type LineAmounts,
  type VatBreakdownRow,
} from './vat.js';
export { formatAmount, parseAmount, MAX_AMOUNT_CENTS } from './money.js';

/**
 * Validates `input`, computes all amounts and returns the `InvoicesDoc` XML.
 * Throws MyDataInputError (with every issue listed) if the input is invalid.
 */
export function buildInvoicesDocXml(input: DocumentInput, options?: BuildOptions): string {
  return writeInvoicesDoc(computeDocument(input, options));
}
