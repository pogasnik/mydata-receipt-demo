import { useMemo } from 'react';
import { tokenizeXml } from '@/lib/highlight-xml';

export function XmlView({ xml }: { xml: string }) {
  const tokens = useMemo(() => tokenizeXml(xml), [xml]);
  return (
    <pre className="xml" tabIndex={0} aria-label="InvoicesDoc XML">
      <code>
        {tokens.map((token, i) => (
          <span key={i} className={`xml-${token.kind}`}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
