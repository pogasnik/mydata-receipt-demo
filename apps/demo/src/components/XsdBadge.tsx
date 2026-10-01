import { useEffect, useState } from 'react';

type Result = { valid: true } | { valid: false; errors: readonly string[] } | { failed: string };

/**
 * Validates the XML against the official XSD in the browser (libxml2 compiled
 * to WebAssembly, loaded on first use). Results are keyed by the XML they
 * belong to, so a stale result is never shown for newer XML.
 */
function useXsdValidation(xml: string): Result | 'checking' {
  const [checked, setChecked] = useState<{ xml: string; result: Result } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void import('@pogasnik/mydata-xml/validate')
        .then(({ validateInvoicesDocXml }) => validateInvoicesDocXml(xml))
        .then(
          (result): Result =>
            result.valid ? { valid: true } : { valid: false, errors: result.errors },
          (error: unknown): Result => ({ failed: String(error) }),
        )
        .then((result) => {
          if (!cancelled) setChecked({ xml, result });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [xml]);

  return checked?.xml === xml ? checked.result : 'checking';
}

export function XsdBadge({ xml }: { xml: string }) {
  const state = useXsdValidation(xml);

  if (state === 'checking') {
    return (
      <span className="badge badge-pending" role="status">
        Έλεγχος XSD… <span className="label-en">Validating</span>
      </span>
    );
  }
  if ('failed' in state) {
    return (
      <span className="badge badge-pending" role="status" title={state.failed}>
        Ο έλεγχος XSD δεν ήταν διαθέσιμος <span className="label-en">XSD check unavailable</span>
      </span>
    );
  }
  if (state.valid) {
    return (
      <span className="badge badge-ok" role="status">
        ✓ Έγκυρο κατά το XSD της ΑΑΔΕ v2.0.2{' '}
        <span className="label-en">Valid against AADE v2.0.2</span>
      </span>
    );
  }
  return (
    <span className="badge badge-error" role="status">
      ✗ Μη έγκυρο XML <span className="label-en">Invalid: {state.errors.join('; ')}</span>
    </span>
  );
}
