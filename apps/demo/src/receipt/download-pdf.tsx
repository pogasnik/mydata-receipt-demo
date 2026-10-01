import type { ReceiptView } from './view-model';

/**
 * Renders the PDF in the browser. @react-pdf/renderer is large, so it is only
 * loaded the first time someone asks for a PDF.
 */
export async function renderReceiptPdf(view: ReceiptView): Promise<Blob> {
  const [{ pdf }, { ReceiptPdf, registerFonts }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ReceiptPdf'),
  ]);
  registerFonts(`${window.location.origin}/fonts`);
  return pdf(<ReceiptPdf view={view} />).toBlob();
}
