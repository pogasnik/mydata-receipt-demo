import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildInvoicesDocXml, parseInvoicesDocXml } from '@pogasnik/mydata-xml';
import { describe, expect, it } from 'vitest';
import { initialState, toDocumentInput, withDocumentType } from '@/lib/form-state';
import { ReceiptPdf, registerFonts } from '@/receipt/ReceiptPdf';
import { toReceiptView } from '@/receipt/view-model';

registerFonts(fileURLToPath(new URL('../public/fonts', import.meta.url)));

async function render(state: ReturnType<typeof initialState>) {
  const doc = parseInvoicesDocXml(buildInvoicesDocXml(toDocumentInput(state)));
  return renderToBuffer(<ReceiptPdf view={toReceiptView(doc)} />);
}

describe('ReceiptPdf', () => {
  it('renders a single-page PDF with the Greek font embedded', async () => {
    for (const type of ['11.1', '1.1'] as const) {
      const pdf = await render(withDocumentType(initialState('2026-10-01'), type));
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${type}.pdf`, pdf);
      const text = pdf.toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toMatch(/\/FontName \/[A-Z]{6}\+NotoSans-Regular/);
      expect(text).toMatch(/\/FontName \/[A-Z]{6}\+NotoSans-Bold/);
      expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
    }
  });
});
