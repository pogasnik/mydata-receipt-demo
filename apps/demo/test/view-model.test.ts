import { buildInvoicesDocXml, parseInvoicesDocXml } from '@pogasnik/mydata-xml';
import { describe, expect, it } from 'vitest';
import { initialState, toDocumentInput, withDocumentType } from '@/lib/form-state';
import { toReceiptView, WATERMARK } from '@/receipt/view-model';

/** Intl puts a no-break space between the amount and €. */
const eur = (text: string) => text.replace(' €', '\u00a0€');

const fromState = (type: '11.1' | '1.1') => {
  const xml = buildInvoicesDocXml(
    toDocumentInput(withDocumentType(initialState('2026-10-01'), type)),
  );
  return { xml, view: toReceiptView(parseInvoicesDocXml(xml)) };
};

describe('toReceiptView', () => {
  it('takes names from the letterhead, because the XML may not carry them (§5.1 note 3)', () => {
    const { xml, view } = fromState('1.1');
    expect(xml).not.toContain('Demo Shop');
    expect(xml).not.toContain('<name>');
    expect(view.issuer.name).toBe('Demo Shop');
    expect(view.buyer?.name).toContain('Demo Πελάτης');
  });

  it('takes the buyer address and every amount from the XML', () => {
    const { view } = fromState('1.1');
    expect(view.buyer?.lines).toEqual(['ΑΦΜ 999999999', 'Οδός Δοκιμής 10', '00000 Δειγματούπολη']);
    expect(view.grandTotal).toBe(eur('29,20 €'));
  });

  it('prints gross line amounts on a receipt and net amounts on an invoice', () => {
    expect(fromState('11.1').view.lines.map((l) => l.amount)).toEqual([
      eur('4,80 €'),
      eur('15,00 €'),
      eur('6,50 €'),
    ]);
    expect(fromState('1.1').view.lines.map((l) => l.amount)).toEqual([
      eur('4,80 €'),
      eur('15,00 €'),
      eur('6,50 €'),
    ]);
    expect(fromState('11.1').view.grandTotal).toBe(eur('26,30 €'));
    expect(fromState('11.1').view.amountsInclude).toContain('include VAT');
    expect(fromState('1.1').view.amountsInclude).toContain('exclude VAT');
  });

  it('marks the document as a demo and never shows a MARK or UID', () => {
    const { view } = fromState('11.1');
    expect(WATERMARK).toBe(
      'ΔΕΙΓΜΑ — ΜΗ ΕΓΚΥΡΟ ΦΟΡΟΛΟΓΙΚΟ ΣΤΟΙΧΕΙΟ / DEMO — NOT A VALID FISCAL DOCUMENT',
    );
    expect(view.mark).toBe('—');
    expect(view.uid).toBe('—');
    expect(view.issuer.lines).toContain('ΑΦΜ 000000000');
  });

  it('uses Greek all-caps without accents for the title', () => {
    expect(fromState('11.1').view.title).toBe('ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ ΠΩΛΗΣΗΣ');
    expect(fromState('1.1').view.title).toBe('ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ');
  });
});
