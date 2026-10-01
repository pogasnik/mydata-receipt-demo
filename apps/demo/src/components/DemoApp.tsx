'use client';

import {
  buildInvoicesDocXml,
  parseInvoicesDocXml,
  validateInput,
  vatBreakdown,
  type MyDataDocument,
} from '@pogasnik/mydata-xml';
import { useMemo, useState } from 'react';
import { initialState, toDocumentInput, type FormState } from '@/lib/form-state';
import { DocumentForm, VatTotals } from './DocumentForm';
import { HowItWorks } from './HowItWorks';
import { OutputPanel } from './OutputPanel';

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * form state → DocumentInput → XML → parsed document. Everything to the right
 * of the XML (totals, preview, PDF) uses the parsed document only.
 */
function usePipeline(state: FormState) {
  return useMemo(() => {
    const input = toDocumentInput(state);
    const issues = validateInput(input);
    if (issues.length > 0) return { issues, xml: null, doc: null };
    const xml = buildInvoicesDocXml(input);
    const doc: MyDataDocument = parseInvoicesDocXml(xml);
    return { issues, xml, doc };
  }, [state]);
}

export default function DemoApp() {
  const [state, setState] = useState(() => initialState(todayIso()));
  const { issues, xml, doc } = usePipeline(state);

  return (
    <div className="workspace">
      <div className="column">
        <DocumentForm state={state} onChange={setState} issues={issues} />
        {doc && <VatTotals rows={vatBreakdown(doc.lines)} total={doc.totals} />}
        <HowItWorks />
      </div>
      <div className="column column-sticky">
        <OutputPanel xml={xml} doc={doc} />
      </div>
    </div>
  );
}
