import { validateXML } from 'xmllint-wasm';
import { MAIN_XSD, PRELOAD_XSDS } from './generated/xsd.js';

export interface XsdValidationResult {
  readonly valid: boolean;
  /** xmllint messages, without the temporary file name prefix. */
  readonly errors: readonly string[];
}

/** Schema version the vendored XSD files belong to. */
export const XSD_VERSION = '2.0.2';

/**
 * Validates XML against the official AADE myDATA v2.0.2 XSD using libxml2
 * compiled to WebAssembly. Works in Node and in browsers (it starts a worker).
 * Kept in its own entry point so the WASM is only loaded when needed.
 */
export async function validateInvoicesDocXml(xml: string): Promise<XsdValidationResult> {
  const result = await validateXML({
    xml: [{ fileName: 'invoice.xml', contents: xml }],
    schema: [MAIN_XSD],
    preload: [...PRELOAD_XSDS],
  });
  return { valid: result.valid, errors: result.errors.map((error) => error.message.trim()) };
}
