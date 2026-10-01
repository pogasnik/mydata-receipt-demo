import type { MyDataDocument } from '@pogasnik/mydata-xml';
import { useId, useMemo, useState } from 'react';
import { documentFileName, downloadBlob } from '@/lib/download';
import { renderReceiptPdf } from '@/receipt/download-pdf';
import { toReceiptView } from '@/receipt/view-model';
import { ReceiptPreview } from './ReceiptPreview';
import { XmlView } from './XmlView';
import { XsdBadge } from './XsdBadge';

type Tab = 'xml' | 'receipt';

export function OutputPanel({ xml, doc }: { xml: string | null; doc: MyDataDocument | null }) {
  const [tab, setTab] = useState<Tab>('xml');
  const id = useId();

  return (
    <section className="output" aria-label="Αποτέλεσμα / Output">
      <div className="tabs" role="tablist">
        <TabButton id={id} tab="xml" current={tab} onSelect={setTab} el="XML" en="InvoicesDoc" />
        <TabButton
          id={id}
          tab="receipt"
          current={tab}
          onSelect={setTab}
          el="Παραστατικό"
          en="Receipt · PDF"
        />
      </div>
      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`}>
        {!xml || !doc ? (
          <p className="empty">
            Διορθώστε τα πεδία της φόρμας για να δημιουργηθεί το XML.
            <span className="label-en">Fix the highlighted form fields to generate the XML.</span>
          </p>
        ) : tab === 'xml' ? (
          <XmlTab xml={xml} doc={doc} />
        ) : (
          <ReceiptTab doc={doc} />
        )}
      </div>
    </section>
  );
}

function TabButton(props: {
  id: string;
  tab: Tab;
  current: Tab;
  onSelect: (tab: Tab) => void;
  el: string;
  en: string;
}) {
  const selected = props.tab === props.current;
  return (
    <button
      type="button"
      role="tab"
      id={`${props.id}-${props.tab}-tab`}
      aria-selected={selected}
      aria-controls={`${props.id}-${props.tab}-panel`}
      className={selected ? 'tab tab-active' : 'tab'}
      onClick={() => {
        props.onSelect(props.tab);
      }}
    >
      {props.el} <span className="label-en">{props.en}</span>
    </button>
  );
}

function XmlTab({ xml, doc }: { xml: string; doc: MyDataDocument }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="toolbar">
        <XsdBadge xml={xml} />
        <div className="toolbar-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(xml).then(() => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                }, 1500);
              });
            }}
          >
            {copied ? '✓ Αντιγράφηκε' : 'Αντιγραφή'}{' '}
            <span className="label-en">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              downloadBlob(
                new Blob([xml], { type: 'application/xml' }),
                `${documentFileName(doc)}.xml`,
              );
            }}
          >
            Λήψη .xml <span className="label-en">Download</span>
          </button>
        </div>
      </div>
      <XmlView xml={xml} />
    </>
  );
}

function ReceiptTab({ doc }: { doc: MyDataDocument }) {
  const view = useMemo(() => toReceiptView(doc), [doc]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPdf = async (deliver: (blob: Blob) => void): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      deliver(await renderReceiptPdf(view));
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <span className="hint">
          Από το XML, όχι από τη φόρμα{' '}
          <span className="label-en">Rendered from the parsed XML</span>
        </span>
        <div className="toolbar-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => {
              // Open the tab synchronously so popup blockers allow it, then fill it.
              const target = window.open('', '_blank');
              void withPdf((blob) => {
                const url = URL.createObjectURL(blob);
                if (target) target.location.href = url;
                else window.location.href = url;
              }).then((ok) => {
                if (!ok) target?.close();
              });
            }}
          >
            Άνοιγμα PDF <span className="label-en">Open</span>
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={busy}
            onClick={() => {
              void withPdf((blob) => {
                downloadBlob(blob, `${documentFileName(doc)}.pdf`);
              });
            }}
          >
            {busy ? 'Δημιουργία…' : 'Λήψη PDF'}{' '}
            <span className="label-en">{busy ? 'Rendering' : 'Download'}</span>
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <ReceiptPreview view={view} />
    </>
  );
}
